# Coinbase Prime Scripts

This repository contains scripts used for trading on Coinbase Prime.

# Websocket Usage

Websocket connections to Coinbase are used as much as possible so that REST API rate limits are avoided.

# Sample Usage Script

```sh
#/bin/bash

# remove previous clone if the directory exists.
if [ -d ~/coinbase ] ; then rm -rf ~/coinbase ; fi

# clone master repository from github.
git clone https://github.com/usefulcoin/coinbase.git

# change directory to the progam you want to run.
cd ~/coinbase/best-post-only-return/

# execute the wrapper script.
bash wrapper.bash

exit 0
```
