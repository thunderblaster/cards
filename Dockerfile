FROM node:10

# Create app directory
WORKDIR /usr/src/cards

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY app/package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 3001

CMD [ "node", "app/server.js" ]