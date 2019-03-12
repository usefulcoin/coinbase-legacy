const fetch = require('node-fetch');
const crypto = require('crypto');

// get sensitive data from the enviroment.
let key = process.env.apikey;
let secret = process.env.apisecret;
let passphrase = process.env.apipassphrase;

// define request and make a timestamp.
let method = 'POST';
let timestamp = Date.now() / 1000;
let requestpath = '/orders';
let body = JSON.stringify({
    price: '1.0',
    size: '1.0',
    side: 'buy',
    product_id: 'BTC-USD'
});

// create the prehash string by concatenating required parts of request.
let prehash = timestamp + method + requestpath + body;

// decode the base64 secret.
let key = Buffer(secret, 'base64');

// create sha256 hmac with the secret.
let hmac = crypto.createHmac('sha256', key);

// sign the require message with the hmac
// and finally base64 encode the result
let signedmessage = hmac.update(prehash).digest('base64');

// define coinbase required headers.
let headers = {
  'CB-ACCESS-KEY': key,
  'CB-ACCESS-SIGN': signedmessage,
  'CB-ACCESS-TIMESTAMP': timestamp,
  'CB-ACCESS-PASSPHRASE': passphrase,
};

// define request options for http request.
let requestoptions = { 'method': method.toUpperCase(), headers };

// define url and send request.
let url = 'https://api-public.sandbox.prime.coinbase.com' + requestpath;
response = await fetch(url, requestOptions);

// output response.
json = await response.json();
console.log(json);
