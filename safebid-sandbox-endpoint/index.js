/*
 * index.js
 *
 * Copyright (c) 2019 Useful Coin LLC. All Rights Reserved.
 *
 * This file is licensed. You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * https://raw.githubusercontent.com/usefulcoin/bitmex/master/LICENSE
 *
 * This script is supposed to order BitMex contracts with a delta server. Please read the
 * README.md file for further information.
 *
 */

// load modules...
const fetch = require('node-fetch');
const crypto = require('crypto');
// loading complete.

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

// retrieve available balance...
async function getaccountinformation(){

  let method = 'GET';
  let timestamp = Date.now() / 1000;
  let requestpath = '/accounts';
  
  // create the prehash string by concatenating required parts of request.
  let prehash = timestamp + method + requestpath;
  
  // base64 decode the secret.
  let base64decodedsecret = Buffer(secret, 'base64');
  
  // create sha256 hmac with the secret.
  let hmac = crypto.createHmac('sha256',base64decodedsecret);
  
  // sign the require message with the hmac
  // and finally base64 encode the result
  let signedmessage = hmac.update(prehash).digest('base64');
  
  // define coinbase required headers.
  let headers = {
    'ACCEPT': 'application/json',
    'CONTENT-TYPE': 'application/json',
    'CB-ACCESS-KEY': key,
    'CB-ACCESS-SIGN': signedmessage,
    'CB-ACCESS-TIMESTAMP': timestamp,
    'CB-ACCESS-PASSPHRASE': passphrase,
  };
  
  // define request options for http request.
  let requestoptions = { 'method': method.toUpperCase(), headers };
  
  // define url and send request.
  let url = 'https://api-public.sandbox.prime.coinbase.com' + requestpath;
  let response = await fetch(url,requestoptions);
  let json = await response.json();
  console.log(json);
  return json;
}
// retrieved balance.

// start main function...
(async function main() {
  try{
    let usdcurrencyfilter = { currency: ['USD'] };
    let accountinformation = await getaccountinformation();
    let usdaccountinformation = filter(accountinformation, usdcurrencyfilter);
    let usdavailablebalance = usdaccountinformation[0].available;
    console.log('usdavailablebalance: ' + usdavailablebalance);
    console.log('The safe bid amount is: $' + usdavailablebalance.toFixed(2));
    console.log('exiting...');
  } catch (e) {
    console.error('[ ' + Date() + ' ] ', e);
  };
}());
// ending main function.
