#!/bin/sh

# UPDATE MODULES
cd /usr/src/cards && npm update;

# START NODEMON / EXPRESS
(cd /usr/src/cards && nodemon /usr/src/cards/server.js localhost 3001 &) >> /log/app.log;

# START SASS COMPILING
(compass watch /usr/src/cards &) >> /log/app.log;

# TAIL LOG
tail -f /log/app.log;
