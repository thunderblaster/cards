Run steps:
1. Create app/config.js with database creds
2. Install docker (if needed)
3. `sudo docker build -t cards .`
4. `sudo docker run -d -p 3001:3001 cards`

Alternatively:
1. Create app/config.js with database creds
2. Install node/npm (if needed)
3. In the app dir, `npm install`
4. `node server.js`