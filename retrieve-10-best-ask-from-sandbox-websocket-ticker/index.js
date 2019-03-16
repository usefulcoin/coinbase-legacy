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
subscriptionrequest = {
    "type": "subscribe",
    "product_ids": ["BTC-USD"],
    "channels": ["ticker"]
}
// created subscription request...




// create discontinue subscription request...
discontinuesubscriptionrequest = {
    "type": "unsubscribe",
    "product_ids": ["BTC-USD"],
    "channels": ["ticker"]
}
// created discontinue subscription request...




// on open connection and send subscribe request...
ws.on('open', function open() {
  try {
    ws.send(JSON.stringify(subscriptionrequest));
  } catch (e) {
    console.error(e);
  }
});
// opened connection and sent subscribe request...




// update the console when the ticker changes...
count = 0;
ws.on('message', function incoming(data) {
  jsondata = JSON.parse(data);
  console.log("best ask : " + jsondata.best_ask + "\r");
  count = count + 1;
  if ( count === 9 ) { 
    try {
      ws.send(JSON.stringify(discontinuesubscriptionrequest)); 
    } catch (e) {
      console.error(e);
    }
    ws.on('message', function unsubscriberesponse(response) {
      jsonresponse = JSON.parse(response);
      console.log(jsonresponse);
      ws.close();
    }
  }
  
});
// updated the console.
