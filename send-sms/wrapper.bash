#!/bin/bash
#
# script name: wrapper.bash
# script author: munair simpson
# script created: 20190317
# script purpose: spin up node code to interact with Amazon SNS.

### yarn installer script for ubuntu or darwin in environments without the package
#
# name: yarninstall
# purpose: use a simple script to install yarn on ubuntu or darwin 
#
yarninstall()
{
	if uname -v | grep Ubuntu >/dev/null 2>&1 ; then
                curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
		echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
		sudo apt update
		sudo apt -y install yarn
		sudo apt -y install --no-install-recommends yarn
	elif uname -v | grep Darwin >/dev/null 2>&1 ; then
		brew install yarn
	fi
	yarn --version
}

### simple error handler script ###
#
# name: errorexit
# purpose: use a simple error handler to track down errors.
# arguments: three parameters may be passed to the function below.
#   parameter 1: the code returned after execution of the command.
#   parameter 2: the text to display on failure.
#   parameter 3: location of error in code.
#
errorexit()
{
	if [ "${1}" -ne "0" ]; then
                echo -en "\a"
                echo [ $(date) ] made a beep to signal error in step ${3}.
		echo [ $(date) ] something is a bit screwy... error code ${1} : ${2}
                echo [ $(date) ] no point in continuing execution.
                echo [ $(date) ] exiting... 
		exit ${1}
	fi
}

### main script ###
#
# step 1: use arguments passed to the script, otherwise use default values for server, riskratio, percentage return on equity, currency pair, and message recipient.
# step 2: check for required node modules in the node_modules directory. if not found run yarn install.
# step 3: run node on index.js (arguments optional):
# 
# 

# step 1: use arguments passed to the script, otherwise use default values for servers, riskratio, percentage return on equity, currency pair, and message recipient.

if [ $# -eq 2 ]; then
	echo [ $(date) ] executing with the arguments passed on the command line...
	recipient=$1 && echo [ $(date) ] setting recipient = $recipient
	message=$2 && echo [ $(date) ] setting message = $message
else
	echo [ $(date) ] executing with default values for servers, riskratio, percentage return on equity, currency pair, and message recipient... 
	recipient='+15104594120' && echo [ $(date) ] setting recipient = $recipient
	message='default message. think of something creative to send."  && echo [ $(date) ] setting message = $message
fi

# step 2: check for required node modules in the node_modules directory. if not found run yarn install.
if [ -d ${PWD}/node_modules ]; then
	echo [ $(date) ] required node modules in the node_modules directory.
	echo [ $(date) ] skipping step 1...
else
	echo [ $(date) ] required node modules have not been installed.
	echo [ $(date) ] if the node_modules directory is absent perhaps yarn install was never run.
	echo [ $(date) ] yarn install must run for node to be able to execute index.js.
	echo [ $(date) ] starting step 1...
	echo [ $(date) ] checking for yarn...
	yarnrelease=$(yarn --version 2>/dev/null)
	if [[ $yarnrelease == '' ]]; then
		echo [ $(date) ] yarn not found. running yarninstall function to install yarn... && yarninstall && errorexit $? "unable to install yarn" 4
	else
		echo [ $(date) ] yarn release $yarnrelease found. proceeding...
	fi
	echo [ $(date) ] running yarn install...
	yarn install
	errorexit $? "unable to successfully run yarn install. critical issue..." 1
	echo [ $(date) ] node modules successfully installed.
fi

# step 3: run index.js.
echo [ $(date) ] starting step 2...
node index.js $recipient $message
errorexit $? "critical error encountered trying to execute node script." 2
echo [ $(date) ] node code successfully executed.

# exiting
echo [ $(date) ] $0 ending...
echo [ $(date) ] making a beep to signal the completion of all tasks. && echo -en "\a" 
echo [ $(date) ] $0 exiting... 
echo [ $(date) ] 
exit 0
