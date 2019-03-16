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
const websocket = require('ws');
// loading complete.




// define consts...
const ws = new websocket('wss://ws-feed-public.sandbox.prime.coinbase.com');
// defined key static (const) variables.




// create subscription request...
let subscriptionrequest = {
    'type': 'subscribe',
    'product_ids': ['BTC-USD'],
    'channels': ['ticker']
}
// created subscription request.




// create discontinue subscription request...
let discontinuesubscriptionrequest = {
    'type': 'unsubscribe',
    'product_ids': ['BTC-USD'],
    'channels': ['ticker']
}
// created discontinue subscription request.




// update console on close connection...
ws.on('close', function close() {
  console.log('disconnected');
});
// updated console on close connection.




// on open connection and send subscribe request...
ws.on('open', function open() {
  console.log('connected');
  try {
    ws.send(JSON.stringify(subscriptionrequest));
  } catch (e) {
    console.error(e);
  }
});
// opened connection and sent subscribe request.



let count = 0;
ws.on('message', function incoming(data) {
  // update the console when the ticker changes...
  let jsondata = JSON.parse(data);
  if ( jsondata.type === 'subscriptions' ) {
    console.log(data);
  } else if ( jsondata.type === 'ticker' ) {
    if ( jsondata.sequence + 1 === jsondata.sequence ) { console.log('best ask [' + jsondata.sequence + '] : ' + jsondata.best_ask); count = count + 1; }
    else if ( count === 9 ) {
      // discontinue subscription if the console is updated 10 times...
      try { ws.send(JSON.stringify(discontinuesubscriptionrequest)); } catch (e) { console.error(e); }
      // discontinued subscription.
      
      // close websocket...
      try { ws.close(); console.log('disconnected'); } catch (e) { console.error(e); }
      // closed websocket.
    }
  }
});
