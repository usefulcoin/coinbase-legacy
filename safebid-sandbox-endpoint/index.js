// load modules...
const fetch = require('node-fetch');
const crypto = require('crypto');
// loading complete.

// import sensitive data...
const key = process.env.apikey;
const secret = process.env.apisecret;
const passphrase = process.env.apipassphrase;
// importing of sensitive authentication data complete.

async function postbid(){

  let method = 'GET';
  let timestamp = Date.now() / 1000;
  let requestpath = '/accounts';
  
  // create the prehash string by concatenating required parts of request.
  let prehash = timestamp + method + requestpath + body;
  
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

postbid();
