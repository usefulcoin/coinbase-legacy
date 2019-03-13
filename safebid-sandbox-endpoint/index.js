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




// make GET request...
async function getrequest(endpoint){

  let method = 'GET';
  let timestamp = Date.now() / 1000;
  let requestpath = '/' + endpoint;
  
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
// made GET request.




// start main function...
(async function main() {
  try{
    // define risk ratio and product id...
    let riskratio = 0.01;
    let productid = 'BTC-USD';
    // defined risk ratio and product id.

    // retrieve product information...
    let productidfilter = { id: [productid] };
    let productinformation = await getrequest('products');
    let filteredproductinformation = filter(productinformation, productidfilter);
    let quotecurrency = filteredproductinformation[0].quote_currency;
    let quoteincrement = filteredproductinformation[0].quote_increment;
    // retrieved product information.

    // retrieve available balance information...
    let quotecurrencyfilter = { currency: [quotecurrency] };
    let accountinformation = await getrequest('accounts');
    let quoteaccountinformation = filter(accountinformation, quotecurrencyfilter);
    let quoteavailablebalance = quoteaccountinformation[0].available;
    let quoteriskableavailable = Math.round(quoteavailablebalance*riskratio*(1/quoteincrement))/(1/quoteincrement);
    // retrieved account balance information.

    // retrieve product ticker information...
    let producttickerinformation = await getrequest('/products/' + productid + '/ticker');
    let bid = producttickerinformation.bid;
    // retrieved product ticker information.


    // define safe (riskable) bid quantity...
    let quantity = quoteriskableavailable / bid; 
    // defined safe (riskable) bid quantity...

    console.log('bid: ' + bid);
    console.log('quantity: ' + quantity);
    console.log('exiting...');
  } catch (e) {
    console.error('[ ' + Date() + ' ] ', e);
  };
}());
// ending main function.
