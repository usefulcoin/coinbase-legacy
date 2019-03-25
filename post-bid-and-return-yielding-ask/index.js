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
const aws = require('aws-sdk');
const websocket = require('ws');
const crypto = require('crypto');
const fetch = require('node-fetch');
// loaded modules.




// define consts.
const websocketserver = (process.argv[2]) ? process.argv[2] : 'wss://ws-feed-public.sandbox.prime.coinbase.com';
const restapiserver = (process.argv[3]) ? process.argv[3] : 'https://api-public.sandbox.prime.coinbase.com';
const riskratio = (process.argv[4]) ? process.argv[4] : 0.00001;
const percentreturn = (process.argv[5]) ? process.argv[5] : 0.01;
const productid = (process.argv[6]) ? process.argv[6] : 'BTC-USD';
const recipient = (process.argv[7]) ? process.argv[7] : '+15104594120';
const ws = new websocket(websocketserver);
const channels = ['heartbeat','full','level2'];
// defined key static (const) variables.




// import sensitive data.
const key = process.env.apikey;
const secret = process.env.apisecret;
const passphrase = process.env.apipassphrase;
// imported sensitive authentication data.




// declare quasi-persistent websocket variables.
let subscribed;
let askorder = new Object();
let bidorder = new Object();
let orderscope = new Object();
// declared quasi-persistent websocket variables.




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




async function postorder ( price, size, side, postonly, productid, stop, stopprice ) { // post a order.

  // define parameters.
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

  let order = await restapirequest ( method, requestpath, body );

  return order;

} // posted a order.




function signrequest ( method, requestpath, body ) { // sign request.

  // create the prehash string by concatenating required parts of request.
  let timestamp = Date.now() / 1000;
  let prehash = timestamp + method + requestpath;
  if ( body !== undefined ) { prehash = prehash + body; }
  // created the prehash.

  // base64 decode the secret.
  let base64decodedsecret = Buffer( secret, 'base64' );
  // secret decoded.

  // create sha256 hmac with the secret.
  let hmac = crypto.createHmac('sha256',base64decodedsecret);
  // created sha256 hmac.

  // sign the require message with the hmac and base64 encode the result.
  let signedmessage = hmac.update(prehash).digest('base64');
  // signed message.

  return { 'signedmessage': signedmessage, 'timestamp': timestamp };

} // signed request.




function channelsubscription ( type, productid, channels, signature, key, passphrase ) { // create or discontinue subscription request...

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

} // created or discontinued subscription request.




// configure aws region (use ap-northeast-1 or us-west-2).
aws.config.update( { region: 'us-west-2' } );
// configured aws.




async function sendmessage ( message, phonenumber ) { // send a message.

  // create publish parameters...
  let parameters = { Message: message, PhoneNumber: phonenumber };
  // create publish parameters.

  // create promise and SNS service object.
  let publishedtext; try{ publishedtext = await new aws.SNS( {apiVersion: '2010-03-31'} ).publish( parameters ).promise(); } catch (e) { console.error(e); }
  // created promise and SNS service object

  console.log('sent message with id: ' + publishedtext.MessageId);

} // sent a message.




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




async function makeask ( bidprice, bidquantity, configurationinformation ) {

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
  let roeprice = Math.round( ( bidprice * ( 1 + percentreturn ) ) / quoteincrement ) * quoteincrement; /* rounding off... but could just as easily truncate */
  let askprice = Math.round( ( Number(quoteincrement) + Number(roeprice) ) / quoteincrement ) * quoteincrement; /* make sure that the ask prices is at least the quote increment */
  let askquantity = bidquantity;
  askprice = Number( askprice ).toFixed( Math.abs( Math.log10( quoteincrement ) ) );
  askquantity = Number( askquantity ).toFixed( Math.abs( Math.log10( baseminimum ) ) );
  // validated and formatted ask price and quantity.

  // submit ask.
  let askinformation; try { askinformation = await postorder ( askprice, askquantity, 'sell', true, productid ); } catch (e) { console.error(e); }
  // submitted ask.

  // analyze response.
  if ( Object.keys(askinformation).length === 0 ) { errormessage = 'bad ask submission: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else if ( Object.keys(askinformation).length === 1 ) { errormessage = 'the Coinbase response is "' + askinformation.message + '"'; } 
  else if ( askinformation.status === 'rejected' ) { errormessage = 'rejected ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else if ( askinformation.id.length === 36 ) { successmessage = 'submitting ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency; } 
  else { errormessage = 'unexpected error encountered submitting ask: ' + askquantity + ' ' + basecurrency + ' @ ' + askprice + ' ' + basecurrency + '/' + quotecurrency; } 
  // analyze response.

  let asksubmission = { // make output object.
    'id': askinformation.id,
    'price': askinformation.price,
    'quantity': askinformation.size,
    'successmessage': successmessage,
    'errormessage': errormessage
  } // made output object.

  return asksubmission;

}




async function makebid ( askprice, askquantity, configurationinformation ) {

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

  let bidsubmission = { // make output object.
    'id': bidinformation.id,
    'price': bidinformation.price,
    'quantity': bidinformation.size,
    'successmessage': successmessage,
    'errormessage': errormessage
  } // made output object.

  return bidsubmission;

}




(async function main() {




  // create signature required to subscribe to a channel.
  let signature = signrequest('GET','/users/self/verify');
  // created signature required to subscribe to a channel.




  // update console on close connection...
  ws.on('close', function close() { console.log('disconnected'); });
  // updated console on close connection.




  // on open connection and send subscribe request.
  ws.on('open', function open() {
    console.log('connected');
    let subscriptionrequest = channelsubscription('subscribe', productid, channels, signature, key, passphrase);
    try { ws.send(JSON.stringify(subscriptionrequest)); } catch (e) { console.error(e); }
  });
  // opened connection and sent subscribe request.




  ws.on('message', async function incoming(data) { // start handling websocket messages.
    let jsondata = JSON.parse(data);

    function messagehandlerinfo(messagetype,infomessage,additionalinformation) {
      console.log(messagetype.padStart(8) + ' subscription message : ' + infomessage + ' [' + additionalinformation + ']');
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
      else { // capture the first ask from the pile of asks in the snapshot.

        let snapshotprice = jsondata.asks[0][0]; /* capture best ask price from the orderbook. */
        let snapshotsize = jsondata.asks[0][1]; /* capture best ask quantity from the orderbook. */

        // retrieve REST API parameters.
        orderscope = await scopeorder(productid);
        // retrieved REST API parameters.

        // make bid.
        bidorder = await makebid(snapshotprice, snapshotsize, orderscope);
        // made bid.

        // check bid response.
        if ( bidorder.errormessage ) { messagehandlerexit('snapshot',snapshotsize + ' @ ' + snapshotprice,bidorder.errormessage); }
        if ( bidorder.successmessage ) { messagehandlerinfo('snapshot',snapshotsize + ' @ ' + snapshotprice,bidorder.successmessage); }
        // checked bid response.

      } // captured the first ask from the pile of asks in the snapshot.
    } // handled level2 snapshot message.

    if ( jsondata.type === 'done' ) { // handle done message from the full channel.

      // define variables.
      let id = jsondata.order_id;
      let pair = jsondata.product_id;
      let side = jsondata.side;
      let price = jsondata.price;
      let reason = jsondata.reason;
      let remaining = jsondata.remaining_size;
      // defined variables.

      if ( id === bidorder.id ) { 
        messagehandlerinfo('done','order (id: ' + id + ') ' + reason,remaining + ' remaining to ' + side + ' at ' + price + ' [' + pair + ']'); 
        if ( reason === 'filled' ) { // act on filled bid order.

          // make ask.
          askorder = await makeask ( bidorder.price, bidorder.quantity, orderscope ); /* this function takes the bid price and bid quantity as inputs */
          // made ask.

          // check ask response.
          if ( askorder.errormessage ) { messagehandlerexit ( 'done', askorder.quantity + ' @ ' + askorder.price, askorder.errormessage ); }
          if ( askorder.successmessage ) { messagehandlerinfo ( 'done', askorder.quantity + ' @ ' + askorder.price, askorder.successmessage ); }
          // checked ask response.

        } // acted on filled bid order.
        else { messagehandlerexit ( 'done', 'bid order was "' + reason + '" so there is no need to submit an ask. exiting... ' ); } /* exit connection if there is a 'canceled' bid */
      }
      if ( id === askorder.id ) { // act on filled ask order.
        messagehandlerexit ( 'done', 'order (id: ' + id + ') ' + reason, remaining + ' remaining to ' + side + ' at ' + price + ' [' + pair + ']' );
        if ( reason === 'filled' ) { sendmessage ( productid + ' bid: ' + bidorder.successmessage + ' ask: ' + askorder.successmessage, recipient ); }
        else { sendmessage ('unfilled ' + productid + ' ask. however, the bid [' + bidorder.successmessage + '] was filled.', recipient ); }
      }// acted on filled ask order.
    } // handled done message from the full channel.
  }); // end handling websocket messages.




}());
