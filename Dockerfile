FROM node:10

VOLUME /log

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

ARG git_hash
ENV env_hash=$git_hash

ARG git_date
ENV env_date=$git_date

CMD [ "sh", "-c", "node app/server.js ${env_hash} ${env_date} 2>&1 | tee -a /log/app.log" ]