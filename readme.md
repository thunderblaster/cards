Run steps:
1. Create app/config.js with database creds
2. Install docker (if needed)
3. `sudo ./build.sh`
4. `sudo docker run -d -p 3001:3001 cards`

Alternatively:
1. Create app/config.js with database creds
2. Install node/npm (if needed)
3. `cd app`
4. `npm install`
5. `node server.js`

Logs are persisted in Docker Volumes.  Node will serve these logs at /log.  Node will also serve a list of all active rooms at /rooms.  If this list is empty, the server is not currently in use and it is safe to take it offline.