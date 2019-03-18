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
const channel = 'ticker';
const riskratio = 0.0001;
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




(async function main() {

  // create signature required to subscribe to ticker...
  let signature = signrequest('GET','/users/self/verify');
  // created signature required to subscribe to ticker.

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

  let count = 0;
  let subscribed = false;
  let subscriptionreceived = false;
  ws.on('message', function incoming(data) {
    let jsondata = JSON.parse(data);
    if ( jsondata.type === 'subscriptions' ) {
      console.log(data);
      subscribed = true;
    } 
    if ( subscribed && jsondata.type === channel ) {
      // update the console when the ticker changes...
      if ( count === 0 ) { initialsequencenumber = jsondata.sequence; }
      if ( jsondata.sequence + count >= initialsequencenumber ) { count = count + 1; console.log('[' + jsondata.sequence + '] best ask (' + count + ') : ' + jsondata.best_ask); }
      if ( count === 10 ) {
        subscriptionreceived = true;
        // discontinue subscription if the console is updated 10 times...
        let subscriptionrequest = channelsubscription('unsubscribe', productid, channel, signature, key, passphrase);
        try { ws.send(JSON.stringify(subscriptionrequest)); } catch (e) { console.error(e); }
        // discontinued subscription.
      }
    }
    if ( subscriptionreceived ) {
      // close connection...
      try { ws.close(); } catch (e) { console.error(e); }
      // closed connection.
    } 
  });
}());
