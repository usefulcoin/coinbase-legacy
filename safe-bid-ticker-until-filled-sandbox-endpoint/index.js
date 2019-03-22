/*
 * index.js
 *
 * Copyright (c) 2019 Useful Coin LLC. All Rights Reserved.
 *
 * This file is licensed. You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * https://raw.githubusercontent.com/usefulcoin/coinbase/master/LICENSE
 *
 * This script is supposed to submit safe bid and ask pairs to the sandbox. Please read the
 * README.md file for further information.
 *
 */




// load modules...
const aws = require('aws-sdk');
const websocket = require('ws');
const crypto = require('crypto');
const fetch = require('node-fetch');
// loading complete.




// define consts...
const channel = 'level2';
const riskratio = 0.00001;
const percentreturn = 0.01;
const productid = 'BTC-USD';
const recipient = '+12062270634';
const ws = new websocket('wss://ws-feed-public.sandbox.prime.coinbase.com');
// defined key static (const) variables.




// import sensitive data...
const key = process.env.apikey;
const secret = process.env.apisecret;
const passphrase = process.env.apipassphrase;
// importing of sensitive authentication data complete.




// filter an array of objects...
function filter(array, filters) {
  let itemstoinclude = Object.keys(filters);
  return array.filter((item) => itemstoinclude.every((key) => (filters[key].indexOf(item[key]) !== -1)));
}
// filtered array.




// make rest api request...
async function restapirequest(method,requestpath,body){
 
  // create the prehash string by concatenating required parts of request...
  let timestamp = Date.now() / 1000;
  let prehash = timestamp + method + requestpath;
  if ( body !== undefined ) { prehash = prehash + body; }
  // created the prehash.
 
  // base64 decode the secret...
  let base64decodedsecret = Buffer(secret, 'base64');
  // secret decoded.
 
  // create sha256 hmac with the secret...
  let hmac = crypto.createHmac('sha256',base64decodedsecret);
  // created sha256 hmac.
 
  // sign the require message with the hmac and base64 encode the result..
  let signedmessage = hmac.update(prehash).digest('base64');
  // signed message.
 
  // define coinbase required headers...
  let headers = {
    'ACCEPT': 'application/json',
    'CONTENT-TYPE': 'application/json',
    'CB-ACCESS-KEY': key,
    'CB-ACCESS-SIGN': signedmessage,
    'CB-ACCESS-TIMESTAMP': timestamp,
    'CB-ACCESS-PASSPHRASE': passphrase,
  };
  // defined coinbase required headers. yes... content-type is required.
  // see https://docs.prime.coinbase.com/#requests for more information.

  // define request options for http request...
  let requestoptions = { 'method': method, headers };
  if ( body !== undefined ) { requestoptions['body'] = body; }
  // defined request options for http request.

  // define url and send request...
  let url = 'https://api-public.sandbox.prime.coinbase.com' + requestpath;
  let response = await fetch(url,requestoptions);
  let json = await response.json();
  // defined url and sent request.

  return json;
}
// made rest api request.




// post a order...
async function postorder(price,size,side,postonly,productid,stop,stopprice){

  // define parameters...
  let method = 'POST';
  let requestpath = '/orders';
  let body = JSON.stringify({
      'price': price,
      'size': size,
      'side': side,
      'post_only': postonly,
      'product_id': productid,
      'stop': stop,
      'stop_price': stopprice
  });
  // defined parameters.

  let order = await restapirequest(method,requestpath,body);

  return order;
}
// posted a order.




// sign request...
function signrequest(method,requestpath,body){

  // create the prehash string by concatenating required parts of request...
  let timestamp = Date.now() / 1000;
  let prehash = timestamp + method + requestpath;
  if ( body !== undefined ) { prehash = prehash + body; }
  // created the prehash.

  // base64 decode the secret...
  let base64decodedsecret = Buffer(secret, 'base64');
  // secret decoded.

  // create sha256 hmac with the secret...
  let hmac = crypto.createHmac('sha256',base64decodedsecret);
  // created sha256 hmac.

  // sign the require message with the hmac and base64 encode the result..
  let signedmessage = hmac.update(prehash).digest('base64');
  // signed message.

  return { 'signedmessage': signedmessage, 'timestamp': timestamp };
}
// signed request.




// create or discontinue subscription request...
function channelsubscription(type, productid, channel, signature, key, passphrase) {
  let subscriptionrequest = {
      'type': type,
      'product_ids': [productid],
      'channels': [channel],
      'signature': signature.signedmessage,
      'key': key,
      'passphrase': passphrase,
      'timestamp': signature.timestamp
  }
  return subscriptionrequest;
}
// created or discontinued subscription request.




// configure aws region (use ap-northeast-1 or us-west-2)...
aws.config.update({region: 'ap-northeast-1'});
// configured aws.




// send a message...
async function sendmessage(message, phonenumber) {
  // create publish parameters...
  let parameters = { Message: message, PhoneNumber: phonenumber };
  // create publish parameters.

  try{
    // create promise and SNS service object...
    let publishedtext = await new aws.SNS({apiVersion: '2010-03-31'}).publish(parameters).promise();
    console.log('sent message with id: ' + publishedtext.MessageId);
    // created promise and SNS service object
  } catch (e) {
    console.error('[ ' + Date() + ' ] ', e);
  };
}
// sent a message.




(async function main() {

  // create signature required to subscribe to a channel...
  let signature = signrequest('GET','/users/self/verify');
  // created signature required to subscribe to a channel.

  // update console on close connection...
  ws.on('close', function close() { console.log('disconnected'); });
  // updated console on close connection.

  // on open connection and send subscribe request...
  ws.on('open', function open() {
    console.log('connected');
    let subscriptionrequest = channelsubscription('subscribe', productid, channel, signature, key, passphrase);
    try { ws.send(JSON.stringify(subscriptionrequest)); } catch (e) { console.error(e); }
  });
  // opened connection and sent subscribe request.

  // declare rest api variables...
  let baseminimum;
  let basemaximum;
  let basecurrency;
  let quotecurrency;
  let quoteincrement;
  let quoteavailablebalance;
  let quoteriskablebalance;
  // declared rest api variables.

  // declare websocket variables...
  let bidid;
  let bidprice;
  let bidstatus;
  let bidfilled;
  let bidquantity;
  let subscribed;
  let orderedatprice;
  let priceshift = false;
  // declared websocket variables.

  ws.on('message', async function incoming(data) { // start handling websocket messages.
    let jsondata = JSON.parse(data);

    function messagehandlerinfo(messagetype,infomessage,additionalinformation) {
      console.log(channel + ' channel  (' + messagetype.padStart(10) + ' message  )  :  ' + infomessage + ' [' + additionalinformation + ']');
    }

    async function messagehandlerexit(messagetype,exitmessage,additionalinformation) { // gracefully unsubscribe.
      console.log(channel + ' channel  (' + messagetype.padStart(10) + ' message  )  :  ' + exitmessage + ' [' + additionalinformation + ']');
      let subscriptionrequest = channelsubscription('unsubscribe', productid, channel, signature, key, passphrase);
      try { ws.send(JSON.stringify(subscriptionrequest)); } catch (e) { console.error(e); } 
    }; // gracefully unsubscribe.
   
    if ( jsondata.type === 'error' ) { // report any errors sent by the websocket server...
      messagehandlerexit('error',jsondata.message,'error sent by the websocket server'); 
    } // reported errors.

    // handle subscribe and unsubscribe messages. 
    if ( jsondata.type === 'subscriptions' ) { 
      if ( subscribed ) { // reported the confirmation of subscription messages and closed connection.
        console.log('both "subscribe" and "unsubscribe" messages received. closing connection...');
        try { ws.close(); } catch (e) { console.error(e); } // closed connection.
      } // reported the confirmation of subscription messages and closed connection.
      else { subscribed = true; } 
    } // handled subscribe and unsubscribe messages. 

    if ( jsondata.type === 'snapshot' ) { // handle level2 snapshot message.
      if ( Object.keys(jsondata.asks).length === 0 ) { messagehandlerexit('snapshot','there are no asks in the orderbook snapshot',''); } 
      else { // make bid.
        let snapshotprice = jsondata.asks[0][0]; /* capture best ask price from the orderbook. */
        let snapshotsize = jsondata.asks[0][1]; /* capture best ask quantity from the orderbook. */

        // retrieve product information...
        let productinformation; try { productinformation = await restapirequest('GET','/products/' + productid); } catch (e) { console.error(e); }
        if ( Object.keys(productinformation).length === 0 ) { messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,'unable to retrieve ' + productid + ' product information'); }
        if ( Object.keys(productinformation) === 'message' ) { messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,productinformation.message); }
        baseminimum = productinformation.base_min_size;
        basemaximum = productinformation.base_max_size;
        basecurrency = productinformation.base_currency;
        quotecurrency = productinformation.quote_currency;
        quoteincrement = productinformation.quote_increment;
        // retrieved product information.
      
        // retrieve available balance information...
        let quotecurrencyfilter = { currency: [quotecurrency] };
        let accountinformation; try { accountinformation = await restapirequest('GET','/accounts'); } catch (e) { console.error(e); }
        if ( Object.keys(accountinformation).length === 0 ) { messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,'unable to retrieve account information'); }
        if ( Object.keys(accountinformation) === 'message' ) { messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,accountinformation.message); }
        let quoteaccountinformation = filter(accountinformation, quotecurrencyfilter);
        quoteavailablebalance = quoteaccountinformation[0].available;
        quoteriskablebalance = quoteavailablebalance*riskratio;
        // retrieved account balance information.

        bidprice = Math.round( ( snapshotprice - Number(quoteincrement) ) / quoteincrement ) * quoteincrement; /* always subtract the quote increment to ensure that the bid is never rejected */ 
        bidprice = Number(bidprice).toFixed(Math.abs(Math.log10(quoteincrement))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
        bidquantity = Math.round( (quoteriskablebalance/bidprice) / baseminimum ) * baseminimum; /* defined safe (riskable) bid quantity */
        if ( bidquantity < baseminimum ) { bidquantity = baseminimum } /* make sure bid quantity is within Coinbase bounds... */
        if ( bidquantity > basemaximum ) { bidquantity = basemaximum } /* make sure bid quantity is within Coinbase bounds... */
        bidquantity = Number(bidquantity).toFixed(Math.abs(Math.log10(baseminimum))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
        try { bidinformation = await postorder(bidprice,bidquantity,'buy',true,productid); } catch (e) { console.error(e); }
        if ( Object.keys(bidinformation) === 'message' ) {  // discontinue subscription if error message received from rest api server.
          messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,orderinformation.message);
        } // discontinued subscription.
        if ( Object.keys(bidinformation).length === 0 ) { // discontinue subscription if bad bid.
          messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,'bad bid: ' + bidquantity + ' ' + basecurrency + ' @ ' + bidprice + ' ' + basecurrency + '/' + quotecurrency);
        } // discontinued subscription.
        else {
          if ( bidinformation.status === 'rejected' ) { // discontinue subscription if bid rejected.
            messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,'rejected bid: ' + bidquantity + ' ' + basecurrency + ' @ ' + bidprice + ' ' + basecurrency + '/' + quotecurrency);
          } // discontinued subscription if bid rejected. 
          if ( bidinformation.id.length === 36 ) { // valid order submitted. update state variables.
            bidid = bidinformation.id;
            bidfilled = bidinformation.filled_size;
            bidstatus = bidinformation.status;
            messagehandlerinfo('snapshot',snapshotsize + ' @ ' + snapshotprice,'bid: ' + bidquantity + ' ' + basecurrency + ' @ ' + bidprice + ' ' + basecurrency + '/' + quotecurrency);
          } // valid order submitted. updated state variables.
        }
      } // made bid.
    } // handled level2 snapshot message.

    if ( jsondata.type === 'l2update' ) { // handle each level2 update.
      let sidechange = jsondata.changes[0][0];
      let pricechange = jsondata.changes[0][1];
      let sizechange = jsondata.changes[0][2];

      let formattedsize = Number(sizechange).toFixed(Math.abs(Math.log10(baseminimum))); /* make absolutely sure that size is set to a fixed number of decimal places. */
      let formattedprice = Number(pricechange).toFixed(Math.abs(Math.log10(quoteincrement))); /* make absolutely sure that size is set to a fixed number of decimal places. */

      if ( bidstatus === 'done' ) { // make ask then discontinue subscription.
        bidstatus = ''; /* set null status so that duplicates are not created. */
        // always add the quote increment to ensure that the ask is never rejected for being the same as the bid.
        let askprice = Math.round( Number(quoteincrement) + bidprice * ( 1 + percentreturn ) / quoteincrement ) * quoteincrement;
        let askquantity = bidquantity;
        askprice = Number(askprice).toFixed(Math.abs(Math.log10(quoteincrement)));
        askquantity = Number(askquantity).toFixed(Math.abs(Math.log10(baseminimum)));
        let askinformation; try { askinformation = await postorder(askprice,askquantity,'sell',true,productid); } catch (e) { console.error(e); }
        if ( Object.keys(askinformation) === 'message' ) { messagehandlerexit('l2update', sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice, askinformation.message); } 
        if ( Object.keys(askinformation).length === 0 ) { 
          messagehandlerexit('l2update', sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice, 
                             'bad ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency);
        } else {
          if ( askinformation.status === 'rejected' ) { // discontinue subscription if ask rejected.
            messagehandlerexit('l2update', sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice, 
                               'rejected ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency);
          } 
          if ( askinformation.id.length === 36 ) {
            askid = askinformation.id;
            askfilled = askinformation.filled_size;
            askstatus = askinformation.status;
            messagehandlerexit('l2update', sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice, 
                               'ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency);
            // sendmessage(productid + '\nbid: ' + bidquantity + ' ' + basecurrency + ' @ ' + bidprice + ' ' + basecurrency + '/' + quotecurrency
            //                      + ' ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency, recipient);
          } 
        }
      } // made ask and then discontinued the subscription.
      else { // update bid.
        let newbidprice = pricechange - Number(quoteincrement); /* always subtract the quote increment to ensure that the bid is never rejected */
        let newbidquantity = quoteriskablebalance/newbidprice - bidfilled; /* defined safe (riskable) bid quantity */
        if ( newbidquantity < baseminimum ) { newbidquantity = baseminimum } /* make sure that the new bid quantity is within Coinbase bounds... */
        if ( newbidquantity > basemaximum ) { newbidquantity = basemaximum } /* make sure that the new bid quantity is within Coinbase bounds... */
        newbidprice = Number(newbidprice).toFixed(Math.abs(Math.log10(quoteincrement))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
        newbidquantity = Number(newbidquantity).toFixed(Math.abs(Math.log10(baseminimum))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */

        let delta = bidprice - newbidprice;
        if ( sidechange === 'sell' ) { // inspect updated sell offer.
          if ( Math.abs(delta) > 0 ) { // check for a change in the best ask price.
            let orderinformation; try { orderinformation = await restapirequest('GET','/orders/' + bidid); } catch (e) { console.error(e); }
            if ( Object.keys(orderinformation) === 'message' ) { messagehandlerexit('l2update',sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice,orderinformation.message); }
            if ( Object.keys(orderinformation).length === 0 ) { messagehandlerexit('l2update',sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice,'bad request'); }
            else { // handle non-null response from rest api server returned.
              bidstatus = orderinformation.status; 
              bidfilled = orderinformation.filled_size; 
              // if ( bidstatus = 'open' ) { try { await restapirequest('DELETE','/orders/' + orderid); } catch (e) { console.error(e); } }
              // if ( bidstatus = 'open' ) { let orderinformation; try { orderinformation = await postorder(newbidprice,newbidquantity,'buy',true,productid); } catch (e) { console.error(e); } }
              // bidid = orderinformation.id;
              // bidstatus = orderinformation.status; 
              // bidfilled = orderinformation.filled_size; 
            } // handled non-null response from rest api server returned.
          } // checked for a change in the best ask price.
          else { messagehandlerinfo('l2update',sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice,newbidquantity + ' @ ' + newbidprice); }
        } // inspected updated sell offer.
        else { 
          if ( Math.abs(delta) > 0 ) { // check for a change in the best bid price.
              newbidquantity = quoteriskablebalance/bidprice - bidfilled; /* defined safe (riskable) bid quantity */
              if ( newbidquantity < baseminimum ) { newbidquantity = baseminimum } /* make sure that the new bid quantity is within Coinbase bounds... */
              if ( newbidquantity > basemaximum ) { newbidquantity = basemaximum } /* make sure that the new bid quantity is within Coinbase bounds... */
              newbidquantity = Number(newbidquantity).toFixed(Math.abs(Math.log10(baseminimum))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
              messagehandlerinfo('l2update',sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice,'existing bid status: (~' + newbidquantity + ') ' + bidstatus);
          } // checked for a change in the best bid price.
          messagehandlerinfo('l2update',sidechange.padStart(5) + ' ' + formattedsize + ' @ ' + formattedprice,newbidquantity + ' @ ' + newbidprice); } /* log bid offer information to console */
      } // updated bid.
    } // handled each level2 update.
  }); // end handling websocket messages.
}());
