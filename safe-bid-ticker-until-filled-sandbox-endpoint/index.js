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
const channels = ['heartbeat','full','level2'];
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




// declare quasi-persistent websocket variables...
let askid;
let bidid;
let askprice;
let bidprice;
let askquantity;
let bidquantity;
let asksuccess;
let bidsuccess;
let subscribed;
let orderconfiguration = new Object();
// declared quasi-persistent websocket variables.

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
function channelsubscription(type, productid, channels, signature, key, passphrase) {
  let subscriptionrequest = {
      'type': type,
      'product_ids': [productid],
      'channels': channels,
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




async function configureorder(productid) {
  // declare variables.
  let baseminimum;
  let basemaximum;
  let basecurrency;
  let quotecurrency;
  let quoteincrement;
  let quoteriskablebalance;
  // declared variables.

  // retrieve product information...
  let productinformation; try { productinformation = await restapirequest('GET','/products/' + productid); } catch (e) { console.error(e); }
  if ( Object.keys(productinformation).length === 0 ) { errormessage = 'unable to retrieve ' + productid + ' product information'; }
  else if ( Object.keys(productinformation).length === 1 ) { errormessage = 'the Coinbase response is "' + productinformation.message + '"'; }
  else {
    baseminimum = productinformation.base_min_size;
    basemaximum = productinformation.base_max_size;
    basecurrency = productinformation.base_currency;
    quotecurrency = productinformation.quote_currency;
    quoteincrement = productinformation.quote_increment;
  }
  // retrieved product information.

  // retrieve available balance information...
  let quotecurrencyfilter = { currency: [quotecurrency] };
  let accountinformation; try { accountinformation = await restapirequest('GET','/accounts'); } catch (e) { console.error(e); }
  if ( Object.keys(accountinformation).length === 0 ) { errormessage = 'unable to retrieve account information'; }
  else if ( Object.keys(accountinformation).length === 1 ) { errormessage = 'the Coinbase response is "' + accountinformation.message + '"'; }
  else {
    let quoteaccountinformation = filter(accountinformation, quotecurrencyfilter);
    let quoteavailablebalance = quoteaccountinformation[0].available;
    quoteriskablebalance = quoteavailablebalance*riskratio;
  }
  // retrieved account balance information.

  let configurationinformation = { // make configuration information object.
    'baseminimum': baseminimum,
    'basemaximum': basemaximum,
    'basecurrency': basecurrency,
    'quotecurrency': quotecurrency,
    'quoteincrement': quoteincrement,
    'quoteriskablebalance': quoteriskablebalance,
  } // made configuration information object.

  return configurationinformation;
}




async function makeask(bidprice,bidquantity,configurationinformation) {
  // declare variables.
  let baseminimum = configurationinformation.baseminimum;
  let basemaximum = configurationinformation.basemaximum;
  let basecurrency = configurationinformation.basecurrency;
  let quotecurrency = configurationinformation.quotecurrency;
  let quoteincrement = configurationinformation.quoteincrement;
  let quoteriskablebalance = configurationinformation.quoteriskablebalance;
  let successmessage;
  let errormessage;
  // declared variables.

  // validate and format ask price and quantity.
  let askprice = Math.round( Number(quoteincrement) + bidprice * ( 1 + percentreturn ) / quoteincrement ) * quoteincrement;
  let askquantity = bidquantity;
  askquantity = Math.round( (quoteriskablebalance/askprice) / baseminimum ) * baseminimum; /* defined safe (riskable) ask quantity */
  askprice = Number(askprice).toFixed(Math.abs(Math.log10(quoteincrement)));
  askquantity = Number(askquantity).toFixed(Math.abs(Math.log10(baseminimum)));
  // validated and formatted ask price and quantity.

  // submit ask.
  let askinformation; try { askinformation = await postorder(askprice,askquantity,'sell',true,productid); } catch (e) { console.error(e); }
  // submitted ask.

  // analyze response.
  if ( Object.keys(askinformation).length === 0 ) { errormessage = 'bad ask submission: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else if ( Object.keys(askinformation).length === 1 ) { errormessage = 'the Coinbase response is "' + askinformation.message + '"'; } 
  else if ( askinformation.status === 'rejected' ) { errormessage = 'rejected ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else if ( askinformation.id.length === 36 ) { successmessage = 'submitting ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else { errormessage = 'unexpected error encountered submitting ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency; } 
  // analyze response.

  let asksubmission = {
    'askid': askinformation.id,
    'askprice': askinformation.price,
    'askquantity': askinformation.quantity,
    'successmessage': successmessage,
    'errormessage': errormessage
  }

  return asksubmission;
}




async function makebid(askprice,askquantity,configurationinformation) {
  // declare variables.
  let snapshotprice = askprice; /* capture best ask price from the orderbook. */
  let snapshotsize = askquantity; /* capture best ask quantity from the orderbook. */
  let baseminimum = configurationinformation.baseminimum;
  let basemaximum = configurationinformation.basemaximum;
  let basecurrency = configurationinformation.basecurrency;
  let quotecurrency = configurationinformation.quotecurrency;
  let quoteincrement = configurationinformation.quoteincrement;
  let quoteriskablebalance = configurationinformation.quoteriskablebalance;
  let successmessage;
  let errormessage;
  // declared variables.

  // validate and format bid price and quantity.
  let bidprice = Math.round( ( snapshotprice - Number(quoteincrement) ) / quoteincrement ) * quoteincrement; /* always subtract the quote increment to ensure that the bid is never rejected */
  bidprice = Number(bidprice).toFixed(Math.abs(Math.log10(quoteincrement))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
  let bidquantity = Math.round( (quoteriskablebalance/bidprice) / baseminimum ) * baseminimum; /* defined safe (riskable) bid quantity */
  if ( bidquantity < baseminimum ) { bidquantity = baseminimum } /* make sure bid quantity is within Coinbase bounds... */
  if ( bidquantity > basemaximum ) { bidquantity = basemaximum } /* make sure bid quantity is within Coinbase bounds... */
  bidquantity = Number(bidquantity).toFixed(Math.abs(Math.log10(baseminimum))); /* make absolutely sure that it is rounded and of a fixed number of decimal places. */
  // validated and formatted bid price and quantity.

  // submit bid.
  let bidinformation; try { bidinformation = await postorder(bidprice,bidquantity,'buy',true,productid); } catch (e) { console.error(e); }
  // submitted bid.

  // analyze response.
  if ( Object.keys(bidinformation).length === 0 ) { errormessage = 'bad bid submission: ' + bidquantity + ' ' + basecurrency + ' @ ' + bidprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else if ( Object.keys(bidinformation).length === 1 ) { errormessage = 'the Coinbase response is "' + bidinformation.message + '"'; } 
  else if ( bidinformation.status === 'rejected' ) { errormessage = 'rejected bid: ' + bidquantity + ' ' + basecurrency + ' @ ' + bidprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else if ( bidinformation.id.length === 36 ) { successmessage = 'submitting bid: ' + bidquantity + ' ' + basecurrency + ' @ ' + bidprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else { errormessage = 'unexpected error encountered submitting bid: ' + bidquantity + ' ' + basecurrency + ' @ ' + bidprice + ' ' + basecurrency + '/' + quotecurrency; } 
  // analyze response.

  let bidsubmission = {
    'bidid': bidinformation.id,
    'bidprice': bidinformation.price,
    'bidquantity': bidinformation.quantity,
    'successmessage': successmessage,
    'errormessage': errormessage
  }

  return bidsubmission;
}




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
    let subscriptionrequest = channelsubscription('subscribe', productid, channels, signature, key, passphrase);
    try { ws.send(JSON.stringify(subscriptionrequest)); } catch (e) { console.error(e); }
  });
  // opened connection and sent subscribe request.

  ws.on('message', async function incoming(data) { // start handling websocket messages.
    let jsondata = JSON.parse(data);

    function messagehandlerinfo(messagetype,infomessage,additionalinformation) {
      console.log(messagetype.padStart(8) + ' message : ' + infomessage + ' [' + additionalinformation + ']');
    }

    async function messagehandlerexit(messagetype,exitmessage,additionalinformation) { // gracefully unsubscribe.
      console.log(messagetype.padStart(8) + ' message : ' + exitmessage + ' [' + additionalinformation + ']');
      let subscriptionrequest = channelsubscription('unsubscribe', productid, channels, signature, key, passphrase);
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

        // retrieve REST API parameters.
        orderconfiguration = await configureorder(productid);
        // retrieved REST API parameters.

        let bid = await makebid(snapshotprice, snapshotsize, orderconfiguration);
        bidid = bid.bidid;
        bidsuccess = bid.successmessage;
        biderror = bid.errormessage;
        bidprice = bid.bidprice;
        bidquantity = bid.bidquantity;
        if ( biderror ) { messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,biderror); }
        if ( bidsuccess ) { messagehandlerinfo('snapshot',snapshotsize + ' @ ' + snapshotprice,bidsuccess); }
      } // made bid.
    } // handled level2 snapshot message.


    if ( jsondata.type === 'done' ) { // handle done message from the full channel.
      let id = jsondata.order_id;
      let pair = jsondata.product_id;
      let side = jsondata.side;
      let price = jsondata.price;
      let reason = jsondata.reason;
      let remaining = jsondata.remaining_size;
      if ( id === bidid ) { 
        messagehandlerinfo('done','order (id: ' + id + ') ' + reason,remaining + ' remaining to ' + side + ' at ' + price + ' [' + pair + ']'); 
        if ( reason === 'canceled' ) {
          let ask = await makeask(bidprice, bidquantity, orderconfiguration); /* this function takes the bid price and bid quantity as inputs */
          askid = ask.askid;
          askprice = ask.askprice;
          askquantity = ask.askquantity;
          asksuccess = ask.successmessage;
          askerror = ask.errormessage;
          if ( askerror ) { messagehandlerexit('done',askquantity + ' @ ' + askprice,askerror); }
          if ( asksuccess ) { messagehandlerinfo('done',askquantity + ' @ ' + askprice,asksuccess); }
        }
        else { messagehandlerexit('done','bid order was ' + reason + ' so there is no need to submit an ask. exiting... '); }
      }
      if ( id === askid ) { 
        messagehandlerexit('done','order (id: ' + id + ') ' + reason,remaining + ' remaining to ' + side + ' at ' + price + ' [' + pair + ']');
        // sendmessage(productid + ' bid: ' + bidsuccess + ' ask: ' + asksuccess, recipient);
      }
    } // handled done message from the full channel.
  }); // end handling websocket messages.
}());
