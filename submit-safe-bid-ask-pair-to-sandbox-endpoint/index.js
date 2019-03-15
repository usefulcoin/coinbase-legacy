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
const fetch = require('node-fetch');
const crypto = require('crypto');
// loading complete.




// define consts...
const riskratio = 0.0001;
const percentreturn = 0.01;
const productid = 'BTC-USD';
const recipient = '+12062270634';
// defined key static (const) variables.




// import sensitive data...
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




(async function main() {
  try{
    // set bid/ask data...
    let bidprice, askprice;
    let postedbidid, postedaskid;
    // declared bid/ask data.

    // retrieve product information...
    let productidfilter = { id: [productid] };
    let productinformation = await restapirequest('GET','/products');
    let filteredproductinformation = filter(productinformation, productidfilter);
    let baseminimum = filteredproductinformation[0].base_min_size;
    let basemaximum = filteredproductinformation[0].base_max_size;
    let basecurrency = filteredproductinformation[0].base_currency;
    let quotecurrency = filteredproductinformation[0].quote_currency;
    let quoteincrement = filteredproductinformation[0].quote_increment;
    // retrieved product information.

    // retrieve available balance information...
    let quotecurrencyfilter = { currency: [quotecurrency] };
    let accountinformation = await restapirequest('GET','/accounts');
    let quoteaccountinformation = filter(accountinformation, quotecurrencyfilter);
    let quoteavailablebalance = quoteaccountinformation[0].available;
    let quoteriskableavailable = quoteavailablebalance*riskratio;
    // retrieved account balance information.

    // retrieve product ticker information...
    let producttickerinformation = await restapirequest('GET','/products/' + productid + '/ticker');
    bidprice = producttickerinformation.bid;
    // retrieved product ticker information.


    // define safe (riskable) bid quantity...
    let bidquantity = Math.round( (quoteriskableavailable/bidprice) / baseminimum ) * baseminimum;
    // defined safe (riskable) bid quantity...

    if ( baseminimum <= bidquantity && bidquantity <= basemaximum ) { 
      // make bid...
      let postedbid = await postorder(bidprice,bidquantity,'buy',true,productid);
      // made bid.

      // make ask...
      askquantity = bidquantity;
      askprice = Math.round( bidprice * ( 1 + percentreturn ) / quoteincrement ) * quoteincrement;
      askstop = Math.round( ( 10 * quoteincrement + bidprice * ( 1 + percentreturn ) / quoteincrement ) * quoteincrement;
      stop = 'loss';
      console.log(askprice,askquantity,'buy',true,productid,stop,askstop);
      let postedask = await postorder(askprice,askquantity,'buy',true,productid,stop,askstop);
      console.log(postedask);
      sendmessage(productid + '\n bid: ' + postedbid.size + ' ' + quotecurrency + ' @ ' + postedbid.price + ' ' + basecurrency + '/' + quotecurrency
                              + ' ask: ' + postedask.size + ' ' + quotecurrency + ' @ ' + postedask.price + ' ' + basecurrency + '/' + quotecurrency, recipient);
      // made ask.
    } else { 
      console.log('bid quantity is out of bounds.'); 
    }
  } catch (e) {
    console.error('[ ' + Date() + ' ] ', e);
  };
}());
