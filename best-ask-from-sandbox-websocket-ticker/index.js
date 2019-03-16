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




// on open connection and send subscribe request...
ws.on('open', function open() {
  ws.send(JSON.stringify(subscriptionrequest));
});
// opened connection and sent subscribe request...




// update the console when the ticker changes...
ws.on('message', function incoming(data) {
  json = JSON.parse(data);
  console.log('\r' + json.best_ask);
});
// updated the console.
