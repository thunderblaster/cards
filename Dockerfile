FROM ubuntu:18.04

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && apt-get install -y curl;
RUN curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh && sh nodesource_setup.sh && apt-get update && apt-get install -y build-essential ruby-dev nodejs;
RUN gem install compass;

VOLUME /log

# Create app directory
WORKDIR /usr/src/cards

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied where available (npm@5+)
COPY app/package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 3001

ARG git_hash
ENV env_hash=$git_hash
LABEL git_hash=${git_hash}

ARG git_date
ENV env_date=$git_date
LABEL git_date=${git_date}

ARG git_branch
ENV env_branch=$git_branch
LABEL git_branch=${git_branch}

RUN export NODE_ENV=production

RUN compass compile /usr/src/cards/app;

CMD [ "sh", "-c", "node app/server.js ${env_hash} ${env_date} ${env_branch} 2>&1 | tee -a /log/app.log" ]