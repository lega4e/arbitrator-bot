#!bash
cd `dirname $BASH_SOURCE`
cp .env.prod .env
/root/.nvm/versions/node/v22.16.0/bin/node dist/index.js
