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
const aws = require('aws-sdk');
const fetch = require('node-fetch');
const crypto = require('crypto');
// loading complete.




// import sensitive data...
const recipient = +12062270634;
const key = process.env.apikey;
const secret = process.env.apisecret;
const passphrase = process.env.apipassphrase;
// importing of sensitive authentication data complete.




// configure aws region (use ap-northeast-1 or us-west-2)...
aws.config.update({region: 'ap-northeast-1'});
// configured aws.




// filter an array of objects...
function filter(array, filters) {
  let itemstoinclude = Object.keys(filters);
  return array.filter((item) => itemstoinclude.every((key) => (filters[key].indexOf(item[key]) !== -1)));
}
// filtered array.



// post a bid...
async function postbid(price,size,side,postonly,productid){

  // create the prehash string by concatenating required parts of request...
  let method = 'POST';
  let timestamp = Date.now() / 1000;
  let requestpath = '/orders';
  let body = JSON.stringify({
      'price': price,
      'size': size,
      'side': side,
      'post_only': postonly,
      'product_id': productid
  });
  let prehash = timestamp + method + requestpath + body;
  // created the prehash.

  // base64 decode the secret...
  let base64decodedsecret = Buffer(secret, 'base64');
  // secret decoded.

  // create sha256 hmac with the secret.
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
  

  // define request options for http request...
  let requestoptions = { 'method': method.toUpperCase(), 'body': body, headers };
  // defined request options for http request.

  // define url and send request...
  let url = 'https://api-public.sandbox.prime.coinbase.com' + requestpath;
  let response = await fetch(url,requestoptions);
  let json = await response.json();
  // defined url and sent request.

  return json;
}
// posted a bid.




// make a generic GET request...
async function getrequest(endpoint){
  
  // create the prehash string by concatenating required parts of request...
  let method = 'GET';
  let timestamp = Date.now() / 1000;
  let requestpath = '/' + endpoint;
  let prehash = timestamp + method + requestpath;
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
  
  // define request options for http request...
  let requestoptions = { 'method': method.toUpperCase(), headers };
  // defined request options for http request.
  
  // define url and send request...
  let url = 'https://api-public.sandbox.prime.coinbase.com' + requestpath;
  let response = await fetch(url,requestoptions);
  let json = await response.json();
  // defined url and sent request.

  return json;
}
// made GET request.




// send a message...
async function sendmessage(message, phonenumber) {
  // create publish parameters...
      console.log(message);
      console.log(phonenumber);
  let parameters = { 'Message': message, 'PhoneNumber': phonenumber };
  // created publish parameters.

  try{
    let publishedtext = await new aws.SNS({'apiVersion': '2010-03-31'}).publish(parameters);
    console.log(publishedtext);
    let messageid = publishedtext.data.MessageId;
    console.log('sent message with id: ' + messageid);
  } catch (e) {
    console.error('[ ' + Date() + ' ] ', e.stack);
  };
}
// sent a message.




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
    let baseminimum = filteredproductinformation[0].base_min_size;
    let basemaximum = filteredproductinformation[0].base_max_size;
    let quotecurrency = filteredproductinformation[0].quote_currency;
    let quoteincrement = filteredproductinformation[0].quote_increment;
    // retrieved product information.

    // retrieve available balance information...
    let quotecurrencyfilter = { currency: [quotecurrency] };
    let accountinformation = await getrequest('accounts');
    let quoteaccountinformation = filter(accountinformation, quotecurrencyfilter);
    let quoteavailablebalance = quoteaccountinformation[0].available;
    let quoteriskableavailable = quoteavailablebalance*riskratio;
    // retrieved account balance information.

    // retrieve product ticker information...
    let producttickerinformation = await getrequest('/products/' + productid + '/ticker');
    let bid = producttickerinformation.bid;
    // retrieved product ticker information.


    // define safe (riskable) bid quantity...
    let quantity = Math.round( (quoteriskableavailable/bid) / baseminimum ) * baseminimum;
    // defined safe (riskable) bid quantity...

    // make bid...
    if ( baseminimum < quantity < basemaximum ) { 
      let postedbid = await postbid(bid,quantity,'buy',true,productid);
      sendmessage('bid posted for : ' + postedbid.size + '@' + postedbid.price, recipient);
    } else { 
      console.log('bid quantity is out of bounds.'); 
    }
    // made bid.
  } catch (e) {
    console.error('[ ' + Date() + ' ] ', e);
  };
}());
// ending main function.
