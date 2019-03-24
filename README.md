# Coinbase Prime Scripts

This repository contains scripts used for trading on Coinbase Prime.

# Websocket Usage

Websocket connections to Coinbase are used as much as possible so that REST API rate limits are avoided.

# Sample Usage Script

```sh
#/bin/bash

# remove previous clone if the directory exists.
echo $0 removing previous clone if the directory exists... 
if [ -d ~/coinbase ] ; then rm -rf ~/coinbase ; fi

# clone repository from github.
echo $0 cloning repository from github... 
git clone https://github.com/usefulcoin/coinbase.git

# change directory to the progam you want to run.
echo $0 changing directory... 
cd ~/coinbase/[directory]

# execute the wrapper script.
echo $0 executing the wrapper script... 
bash wrapper.bash

# exiting
echo $0 making a beep to signal the completion of all tasks. && echo -en "\a" 
echo $0 exiting... 
exit 0
```
