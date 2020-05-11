### Sample .env file:
DB_HOST=yourhostnamehere  
DB_NAME=yourdatabasenamehere  
DB_PORT=yourportnumberhere  
DB_USER=yourusernamehere  
DB_PASS=yourpasswordhere

### Docker run steps:
1. Create .env file with database creds
2. Install docker (if needed)
3. `sudo ./build.sh`
4. Run with ----network="host" `sudo ./run-network-host.sh` or run with configured ports `sudo ./run.sh`

### Docker-compose steps:
1. Create .env file with database creds
2. Install docker (if needed)
2. To build service: `docker-compose up --build`
3. To stop service: CTL+C or `docker-compose stop`
4. To teardown service `docker-compose down`

### Native Node.js steps:
1. Create .env with database creds
2. Install node/npm (if needed)
3. `cd app`
4. `npm install`
5. `node server.js`

### SASS Compilation
`app/sass/styles.scss` will be compiled when the the container is built using the docker run and docker-compose steps above. Additionally, docker-compose will continue to compile the SASS file as it is edited. If you are running the server natively with Node.js you can compile the SASS locally using Ruby and Compass using the configuration in the `config.rb` file located in the `app/` directory. Running `compass compile` from the `app/` directory will compile the SASS or running `compass watch` will continually compile the file when changes are made to the SASS file.

Logs are persisted in Docker Volumes.  Node will serve these logs at /log.  Node will also serve a list of all active rooms at /rooms.  If this list is empty, the server is not currently in use and it is safe to take it offline.
