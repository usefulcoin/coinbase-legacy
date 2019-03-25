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




// load modules.
const crypto = require('crypto');
const fetch = require('node-fetch');
// loaded modules.




// define consts.
const restapiserver = (process.argv[2]) ? process.argv[2] : 'https://api-public.sandbox.prime.coinbase.com';
const productid = (process.argv[3]) ? process.argv[3] : 'BTC-USD';
const riskratio = (process.argv[4]) ? process.argv[3] : 0.01;
// defined key static (const) variables.




// import sensitive data.
const key = process.env.apikey;
const secret = process.env.apisecret;
const passphrase = process.env.apipassphrase;
// imported sensitive authentication data.




async function scopeorder ( productid ) { // scope order.

  // declare variables.
  let baseminimum;
  let basemaximum;
  let basecurrency;
  let quotecurrency;
  let quoteincrement;
  let quoteriskablebalance;
  // declared variables.

  // retrieve product information.
  let productinformation; try { productinformation = await restapirequest('GET','/products/' + productid); } catch (e) { console.error(e); }
  // retrieved product information.

  // verify response.
  if ( Object.keys(productinformation).length === 0 ) { errormessage = 'unable to retrieve ' + productid + ' product information'; }
  else if ( Object.keys(productinformation).length === 1 ) { errormessage = 'the Coinbase response is "' + productinformation.message + '"'; }
  else {
    baseminimum = productinformation.base_min_size;
    basemaximum = productinformation.base_max_size;
    basecurrency = productinformation.base_currency;
    quotecurrency = productinformation.quote_currency;
    quoteincrement = productinformation.quote_increment;
  } // verified response.

  // retrieve available balance information.
  let quotecurrencyfilter = { currency: [quotecurrency] };
  let accountinformation; try { accountinformation = await restapirequest('GET','/accounts'); } catch (e) { console.error(e); }
  // retrieved account balance information.

  // verify response.
  if ( Object.keys(accountinformation).length === 0 ) { errormessage = 'unable to retrieve account information'; }
  else if ( Object.keys(accountinformation).length === 1 ) { errormessage = 'the Coinbase response is "' + accountinformation.message + '"'; }
  else {
    let quoteaccountinformation = filter(accountinformation, quotecurrencyfilter);
    let quoteavailablebalance = quoteaccountinformation[0].available;
    quoteriskablebalance = quoteavailablebalance*riskratio;
  } // verified response.

  let configurationinformation = { // make configuration information object.
    'baseminimum': baseminimum,
    'basemaximum': basemaximum,
    'basecurrency': basecurrency,
    'quotecurrency': quotecurrency,
    'quoteincrement': quoteincrement,
    'quoteriskablebalance': quoteriskablebalance,
  } // made configuration information object.

  return configurationinformation;

} // scoped order.




async function restapirequest ( method, requestpath, body ) { // make rest api request.
 
  // create the prehash string by concatenating required parts of request.
  let timestamp = Date.now() / 1000;
  let prehash = timestamp + method + requestpath;
  if ( body !== undefined ) { prehash = prehash + body; }
  // created the prehash.
 
  // base64 decode the secret.
  let base64decodedsecret = Buffer(secret, 'base64');
  // secret decoded.
 
  // create sha256 hmac with the secret.
  let hmac = crypto.createHmac('sha256',base64decodedsecret);
  // created sha256 hmac.
 
  // sign the require message with the hmac and base64 encode the result.
  let signedmessage = hmac.update(prehash).digest('base64');
  // signed message.
 
  // define coinbase required headers.
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

  // define request options for http request.
  let requestoptions = { 'method': method, headers };
  if ( body !== undefined ) { requestoptions['body'] = body; }
  // defined request options for http request.

  // define url and send request.
  let url = restapiserver + requestpath;
  let response = await fetch(url,requestoptions);
  let json = await response.json();
  // defined url and sent request.

  return json;

} // made rest api request.




(async function main() {

// make request.
let statistics = await restapirequest ( 'GET', '/products/' + productid + '/stats' );
// made request.

// handle response.
if ( Object.keys(statistics).length === 0 ) { console.log('unable to retrieve information'); }
else if ( Object.keys(statistics).length === 1 ) { console.log('the Coinbase response is "' + statistics.message + '"'); }
else { console.log(statistics); }
// handled response.

// retrieve REST API parameters.
let orderscope = await scopeorder(productid);
console.log(orderscope);
// retrieved REST API parameters.

}());
