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
const quotecurrencies = (process.argv[3]) ? process.argv[3] : ['USD','USDC'];
// defined key static (const) variables.




// import sensitive data.
const key = process.env.apikey;
const secret = process.env.apisecret;
const passphrase = process.env.apipassphrase;
// imported sensitive authentication data.




function filter (array, filters) { // filter an array of objects.
  let itemstoinclude = Object.keys(filters);
  return array.filter((item) => itemstoinclude.every((key) => (filters[key].indexOf(item[key]) !== -1)));
} // filtered array.




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

// retrieve product information.
let productinformation; try { productinformation = await restapirequest('GET','/products/'); } catch (e) { console.error(e); }
// retrieved product information.

// error check.
if ( Object.keys(productinformation).length === 0 ) { console.log('unable to retrieve product information'); }
else if ( Object.keys(productinformation).length === 1 ) { console.log('the Coinbase response is "' + productinformation.message + '"'); }
// errors checked.

// filter product list, if requested.
let products;
if ( quotecurrencies ) {
  let quotecurrencyfilter = { currency: quotecurrencies };
  console.log(quotecurrencyfilter);
  products = filter(productinformation, quotecurrencyfilter);
} else { products = productinformation; }
// filtered product list.

// handle response.
for ( let i = 0, l = products.length; i < l; i++) {
  var product = products[i];

  // report.
  let id = product.id;
  let basecurrency = product.base_currency;
  let quotecurrency = product.quote_currency;
  let baseminimum = product.base_min_size;
  let basemaximum = product.base_max_size;
  let quoteincrement = product.quote_increment;

  console.log( '' );
  console.log( ('-').padStart(44,'-') );
  console.log( id + ' REPORT' );
//  console.log( id.padStart(37) + ' REPORT' );
  console.log( ('-').padStart(44,'-') );
  console.log( ('basecurrency: ').padStart(20) + basecurrency );
  console.log( ('quotecurrency: ').padStart(20) + quotecurrency );
  console.log( ('baseminimum: ').padStart(20) + baseminimum );
  console.log( ('basemaximum: ').padStart(20) + basemaximum );
  console.log( ('quoteincrement: ').padStart(20) + quoteincrement );
  console.log( ('-').padStart(44,'-') );
  console.log( '' );
  // reported.

}
// handled response.

}());
