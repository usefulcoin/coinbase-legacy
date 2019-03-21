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
  let orderid;
  let bidprice;
  let orderprice;
  let orderstatus;
  let orderfilled;
  let bidquantity;
  let orderquantity;
  let orderedatprice;
  let initialbid = false;
  let priceshift = false;
  let subscribed = false;
  // declared websocket variables.

  ws.on('message', async function incoming(data) { // start handling websocket messages.
    let jsondata = JSON.parse(data);

   
    if ( jsondata.type === 'error' ) { // report any errors sent by the websocket server...
      console.error(jsondata.message); } // reported errors.

    // start handling subscribe and unsubscribe messages. 
    if ( jsondata.type === 'subscriptions' ) { // report the confirmation of subscription...
      console.log(data); // reported confirmation.
      
      if ( subscribed ) { // close connection if flag set...
        try { ws.close(); } catch (e) { console.error(e); } // closed connection.
      
      } else { // start retrieving essential REST API information once subscribed. only once...
        // retrieve product information...
        let productinformation; try { productinformation = await restapirequest('GET','/products/' + productid); } catch (e) { console.error(e); }
        baseminimum = productinformation.base_min_size;
        basemaximum = productinformation.base_max_size;
        basecurrency = productinformation.base_currency;
        quotecurrency = productinformation.quote_currency;
        quoteincrement = productinformation.quote_increment;
        // retrieved product information.
      
        // retrieve available balance information...
        let quotecurrencyfilter = { currency: [quotecurrency] };
        let accountinformation; try { accountinformation = await restapirequest('GET','/accounts'); } catch (e) { console.error(e); }
        let quoteaccountinformation = filter(accountinformation, quotecurrencyfilter);
        quoteavailablebalance = quoteaccountinformation[0].available;
        quoteriskablebalance = quoteavailablebalance*riskratio;
        // retrieved account balance information.

        subscribed = true; /* subscription request successful. set flag */
      } // end retrieval of essential REST API information once subscribed.
    } // end handling subscribe and unsubscribe messages. 

    // start subscribed messages.
    if ( subscribed && jsondata.type === 'l2update' ) { /* once subscribed, act on each level2 update... */
      let sidechange = jsondata.changes[0][0];
      let pricechange = jsondata.changes[0][1];
      let sizechange = jsondata.changes[0][2];

      if ( sidechange === 'sell' ) { // set bid price and bid quantity
        bidprice = Math.round( ( pricechange - Number(quoteincrement) ) / quoteincrement ) * quoteincrement; /* always add the quote increment to ensure that the bid is never rejected */
        bidquantity = Math.round( (quoteriskablebalance/bidprice) / baseminimum ) * baseminimum; /* defined safe (riskable) bid quantity */
        if ( bidquantity < baseminimum ) { bidquantity = baseminimum } /* make sure bid quantity is within Coinbase bounds... */
        if ( bidquantity > basemaximum ) { bidquantity = basemaximum } /* make sure bid quantity is within Coinbase bounds... */
        bidprice = Number(bidprice).toFixed(Math.abs(Math.log10(quoteincrement))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
        bidquantity = Number(bidquantity).toFixed(Math.abs(Math.log10(baseminimum))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */

        let orderinformation;
        if ( orderid === undefined ) { // handle initial 'sell' message.
          orderedatprice = pricechange;
          try { orderinformation = await postorder(bidprice,bidquantity,'buy',true,productid); } catch (e) { console.error(e); }
          orderid = orderinformation.id;
          orderfilled = orderinformation.filled_size;
          orderstatus = orderinformation.status;
          orderquantity = Math.round(orderinformation.size/baseminimum)*baseminimum;
          orderprice = Math.round(orderinformation.price/quoteincrement)*quoteincrement;
          orderquantity = orderquantity.toFixed(Math.abs(Math.log10(baseminimum))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
          orderprice = orderprice.toFixed(Math.abs(Math.log10(quoteincrement))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
          initialbid = true;
        } // handled initial 'sell' message.
        else { // handle regular 'sell' messages.
          // console.log('bidprice: ' + bidprice);
          // console.log('orderprice: ' + orderprice);
          if ( pricechange !== orderedatprice ) { // cancel previous order and submit updated bid.
            priceshift = true;
            orderedatprice = pricechange;
            try { orderinformation = await restapirequest('GET','/orders/' + orderid); } catch (e) { console.error(e); }
            orderstatus = orderinformation.status;
            // try { orderinformation = await restapirequest('DELETE','/orders/' + orderid); } catch (e) { console.error(e); }
            // try { orderinformation = await postorder(bidprice,bidquantity,'buy',true,productid); } catch (e) { console.error(e); }
            // orderid = orderinformation.id;
            // orderfilled = orderinformation.filled_size;
            // orderstatus = orderinformation.status;
            // orderquantity = Math.round(orderinformation.size/baseminimum)*baseminimum;
            // orderprice = Math.round(orderinformation.price/quoteincrement)*quoteincrement;
            // orderquantity = orderquantity.toFixed(Math.abs(Math.log10(baseminimum))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
            // orderprice = orderprice.toFixed(Math.abs(Math.log10(quoteincrement))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
            // console.log('bid: ' + orderquantity + ' ' + basecurrency + ' @ ' + orderprice + ' ' + basecurrency + '/' + quotecurrency);
          } // cancelled previous order and submitted updated bid.
        } // handled regular 'sell' messages.
      } // set bid price and bid quantity

      let formattedsize = Number(sizechange).toFixed(Math.abs(Math.log10(baseminimum)));
      let formattedprice = Number(pricechange).toFixed(Math.abs(Math.log10(quoteincrement)));
      if ( priceshift ) { // update console.
        priceshift = false;
        console.log(channel + ' channel : [' + sidechange.padEnd(4) + ']  ' + formattedsize + ' @ ' + formattedprice + ' [price shift]');
      } else if ( initialbid ) { 
        initialbid = false;
        console.log(channel + ' channel : [' + sidechange.padEnd(4) + ']  ' + formattedsize + ' @ ' + formattedprice
                            + ' [order submission: ' + orderquantity + ' ' + basecurrency + ' @ ' + orderprice + ' ' + basecurrency + '/' + quotecurrency + ']');
      } // updated console.

      if ( orderstatus === 'filled' || orderstatus === 'rejected' ) { // discontinue subscription if order filled or rejected...
        if ( orderstatus === 'rejected' ) { console.log('order rejected.');
        let subscriptionrequest = channelsubscription('unsubscribe', productid, channel, signature, key, passphrase);
        try { ws.send(JSON.stringify(subscriptionrequest)); } catch (e) { console.error(e); }
      } // discontinued subscription.

      if ( orderstatus === 'filled' ) { // make ask.
        // always add the quote increment to ensure that the ask is never rejected for being the same as the bid.
        let askprice = Math.round( Number(quoteincrement) + orderprice * ( 1 + percentreturn ) / quoteincrement ) * quoteincrement;
        let askquantity = orderquantity;
        let orderinformation = await postorder(askprice,askquantity,'sell',true,productid);
        // update the console with messages subsequent to subscription...
        console.log(channel + ' channel : [' + sidechange + ']  ' + sizechange + ' @ ' + pricechange + ' [asked for ' + askquantity + '@' + askprice + ']'); 
        // updated console.
        sendmessage(productid + '\nbid: ' + Math.round(orderquantity/baseminimum)*baseminimum + ' ' + basecurrency 
                              + ' @ ' + Math.round(orderprice/quoteincrement)*quoteincrement + ' ' + basecurrency + '/' + quotecurrency
                              + ' ask: ' + Math.round(orderinformation.size/baseminimum)*baseminimum + ' ' + basecurrency
                              + ' @ ' + Math.round(orderinformation.price/quoteincrement)*quoteincrement + ' ' + basecurrency + '/' + quotecurrency, recipient);
      } // made ask.
    } // end subscribed messages.
  }); // end handling websocket messages.
}());
