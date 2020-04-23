var express = require('express'); // Load Express (web server)
var app = express(); // Initialize it
var http = require('http').createServer(app); // Socket.io requires the Express app to be run through the http library.  Not sure why.
var io = require('socket.io')(http); // Load and initialize Socket.io to our webserver
var mysql = require('mysql'); // Load MySQL
const config = require('./config'); // Get our config file
const util = require('./utilities');
const winston = require('winston');
const winston_mysql = require('winston-mysql');

var options_default = {
    host     : config.database.host,
    user     : config.database.user,
    password : config.database.password,
    database : config.database.database,
    table    : 'log_system'
  };

var pool = mysql.createPool({ // Initialize the MySQL connection pool. Defaulting to 25 connections here, may need to increase later.
    connectionLimit: 25,
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    port: config.database.port
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.json()       
        ),
    exitOnError: false,
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
            level: 'debug',
            format: winston.format.simple()
        }),
        new winston.transports.File({ 
            handleExceptions: true,
            level: 'verbose',
            filename: __dirname + '/log/app.log'
        }),
      new winston_mysql(options_default)
    ]
  });

pool.on('error', function (err) { // Log MySQL errors to STDOUT
    logger.error(err);
});

app.get('/', function (req, res) { // Serve index.html from the public folder when a user requests the webroot
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/version', function (req, res) { // Serve the git information provided as command line args at /version
    let version = {
        hash: process.argv[2],
        date: process.argv[3],
        branch: process.argv[4]
    }
    res.send(version);
});

app.get('/log', function (req, res) { // Send the text file located in the Docker Volume on the container filesystem at /log/app.log
    res.sendFile(__dirname + '/log/app.log');
});

app.use(express.static(__dirname + '/public')); // If someone requests another path, just serve them whatever matches in the public folder

var whitecards, blackcards;

pool.query('SELECT * FROM white_cards', function (error, results, fields) { // Pull cards from DB into array
    whitecards = results;
});

pool.query('SELECT * FROM black_cards', function (error, results, fields) {
    blackcards = results;
});

var rooms = {}; // Initialize our rooms object as a global variable. This will hold the server-side state of all rooms. Moving this to redis would be cool

app.get('/rooms', function (req, res) { // Send the rooms object to anyone requesting it at /rooms.
    res.send(rooms);
})

io.on('connection', function (socket) { // The socket.io connection is first called when a user requests to join a room
    socket.on('joinroom', function (msg) { // This is fired immediately from the client when joining a room. Msg is an object with a property room that is the name of the room they wish to join
        logger.verbose("User starting to join room", {roomname: msg.room, username: msg.name});
        if (msg.room) { // If you sent a 'joinroom' request, but didn't specify which room to join please go away
            msg.room = msg.room.trim(); // fixes an issue where phones autocompleting the name will add a trailing space
            let ip = socket.request.headers["x-forwarded-for"] || socket.conn.remoteAddress.split(":")[3] || "localhost"; // Grab the user's IP for logging purposes
            pool.query('INSERT INTO log_user (name, room, ip_addr) VALUES (?, ?, ?)', [msg.name, msg.room, ip], function (error, results, fields) { // Just log who they are, where they're from and which room they're joining
                if(error){
                    logger.error(error.message);
                }
            });
            if (!rooms[msg.room]) { // The requested room doesn't exist in our global variable, so it's a new room and we need to create it
                createRoom(msg.room); // Call the createRoom function
                socket.name = msg.name; // Assign the player's name to their socket so we can get it later without having to send it from the client each time. 
                socket.room = msg.room; // Assign their room as well
                logger.debug("Adding user to room with empty hand", {roomname: msg.room, username: msg.name});
                rooms[msg.room].userlist.push({ id: socket.id, name: msg.name, selected: false, turn: false, points: 0, hand: []}); // Add this user to the playerlist of the newly created room
                // logger.debug("Adding usernames as white cards to the room", {roomname: msg.room, username: msg.name});
                rooms[msg.room].whitecards.push({ card_id: util.randomInt(10000, 99999), card_text: msg.name }); // add this user's name as a white card, for funsies
            } else { // existing room
                if (rooms[msg.room].dclist.length > 0) { // users have disconnected, check if this user is a returning one
                    logger.debug("DC list current has %d users", rooms[msg.room].dclist.length, {roomname: msg.room, username: msg.name});
                    for (let i = rooms[msg.room].dclist.length - 1; i >= 0; i--) { // Count backwards to ensure we're getting their most recent score in case they've disconnected many times
                        if (msg.name === rooms[msg.room].dclist[i].name) { // match as disconnected user, give them their old score back
                            socket.name = msg.name;
                            socket.room = msg.room;
                            rooms[msg.room].userlist.push({ id: socket.id, name: msg.name, selected: false, turn: false, points: rooms[msg.room].dclist[i].points,  hand: rooms[msg.room].dclist[i].hand});
                            logger.verbose("Found user in dc list, added them to the room", {roomname: msg.room, username: msg.name});
                            break;
                        }
                    }
                }
                
                if (!socket.name) { // user was not matched to a disconnected one, treat as new user
			        logger.info("New user", {roomname: msg.room, username: msg.name});
                    socket.name = msg.name;
                    socket.room = msg.room;
                    rooms[msg.room].userlist.push({ id: socket.id, name: msg.name, selected: false, turn: false, points: 0, hand: []});
                    rooms[msg.room].whitecards.push({ card_id: util.randomInt(10000, 99999), card_text: msg.name }); // add this user's name as a white card, for funsies
                }
            }

            socket.join(msg.room); // add to the actual room
            io.to(msg.room).emit('userlist', rooms[msg.room].userlist); // send updated userlist with our new guest
            if (rooms[msg.room].gamestarted) { // if the game is in progress...
                io.to(socket.id).emit('gamestarted'); // ...let the new user know
                io.to(socket.id).emit('dealblack', rooms[socket.room].currentBlack); // ...and show them the current black card
            }
        } else {
            logger.warn("User attempted to join a room but didn't specify which");
        }

    });
    socket.on('chatlink', function (msg) { // If one client sends an updated value for their chat link...
        if (!socket.room) {
            io.to(socket.id).emit('whoareyou'); // This essentially tells the client they have a stale session and need to reload
            return;
        }
        io.to(socket.room).emit('chatlink', msg); // Announce it to everyone in their room
    });
    socket.on('startgame', function () { // Someone clicked to start game
        if (!socket.room) {
            io.to(socket.id).emit('whoareyou'); // This essentially tells the client they have a stale session and need to reload
            return;
        }
        logger.info("User clicked Start Game", {roomname: socket.room});
        io.to(socket.room).emit('gamestarted'); // Announce it to the room
        rooms[socket.room].gamestarted = true; // Note that it's started on our server variable
        rooms[socket.room].userlist[0].turn = true; // First player in the array will go first
        io.to(rooms[socket.room].userlist[0].id).emit('yourturn'); // Tell them so
        io.to(socket.room).emit('userlist', rooms[socket.room].userlist); // Broadcast the updated userlist showing that it's player[0]'s turn
    });
    socket.on('selected', function (msg) { // Player selects a card to submit to Card Czar
        if (!socket.room) {
            logger.warn("Stale session detected, sending whoareyou");
            io.to(socket.id).emit('whoareyou'); // This essentially tells the client they have a stale session and need to reload
            return;
        }

        logger.verbose("Card has been selected", {roomname: socket.room, cardtext: msg.card_text, cardid: msg.card_id, playername: socket.name});

        let userIndex = rooms[socket.room].userlist.findIndex(element => element.id === socket.id); // Grab their index in the user array
        rooms[socket.room].userlist[userIndex].selected = msg; // Note their selected card in their user in the rooms object

        io.to(socket.room).emit('userlist', rooms[socket.room].userlist); // Announce the updated userlist to the room, showing that this user has selected a card
        // We need to check to see if this was the last user to select a card and if so, show the selected cards to everyone and let the Czar make a decision
        let ready = 0; // The ready variable will count how many users are ready (either have selected a card or don't need to because they're the Czar)
        for (let i = 0; i < rooms[socket.room].userlist.length; i++) { // Loop through the users in room
            if (rooms[socket.room].userlist[i].turn || rooms[socket.room].userlist[i].selected) { // if it's your turn, you will not have selected a card
                ready++; // Increment for users who are ready
            }
        }
        if (ready === rooms[socket.room].userlist.length) { // everyone is ready
            logger.verbose("Everyone is ready", {roomname: socket.room});
            let selectedcards = []; // Here's a handy (but somewhat redundant) array to hold all the cards selected for play with this black card
            for (let i = 0; i < rooms[socket.room].userlist.length; i++) { // Loop through all users in room
                if (rooms[socket.room].userlist[i].selected) { // If they've selected a card (remember, one is the czar and will not have)
                    selectedcards.push({ name: rooms[socket.room].userlist[i].name, card_text: rooms[socket.room].userlist[i].selected.card_text, selected: false, card_id : rooms[socket.room].userlist[i].selected.card_text}); // Push to array
                }
            }
            util.shuffle(selectedcards); // This is important, otherwise the white cards will be displayed in the order of the players in the userlist array which means they wouldn't be anonymous
            io.to(socket.room).emit('selectedcards', selectedcards); // Announce the list of selected white cards to the room
        }
    });


    socket.on('drawwhite', function (msg) {
        if (!socket.room) {
            io.to(socket.id).emit('whoareyou'); // This essentially tells the client they have a stale session and need to reload
            return;
        }
        
        dealWhiteCards(socket);
        

    })

    socket.on('drawblack', function () { // Pretty much the same, but different array
        if (!socket.room) {
            io.to(socket.id).emit('whoareyou'); // This essentially tells the client they have a stale session and need to reload
            return;
        }
        let cardsToReturn = [];
        let index = util.getRandomIndex(rooms[socket.room].blackcards);
        let cardDrawn = rooms[socket.room].blackcards.splice(index, 1);
        rooms[socket.room].currentBlack = cardDrawn;
        logger.debug("Dealing a black card", {roomname: socket.room});
        cardsToReturn.push(cardDrawn[0]);
        io.to(socket.room).emit('dealblack', cardsToReturn); // Note we announce this to the whole room and not just the user who requested it
    });

    socket.on('winningcard', function (msg) { // Triggers when the card czar selects a winning card
        if (!socket.room) {
            io.to(socket.id).emit('whoareyou'); // This essentially tells the client they have a stale session and need to reload
            return;
        }
        for (let i = 0; i < rooms[socket.room].userlist.length; i++) { // This is not efficient, but...
            if (rooms[socket.room].userlist[i].selected.card_text === msg.card_text) { // ...figure out who played the card...
                rooms[socket.room].userlist[i].points++; // ... and increment their points
                // A better approach would likely be to tie the username to the selected card when it's announced to the room.
                io.to(socket.room).emit('winningcard', msg); // Announce the winning card to the room
                
                for(let j = 0; j < rooms[socket.room].userlist[i].hand.length; j++){
                    if(rooms[socket.room].userlist[i].hand[j].card_text == msg.card_text) // Search for the winning card from their hand
                    {
                        logger.info("Winning card selected black card_id %s white card_id %s ", rooms[socket.room].currentBlack[0].card_id , msg.card_id, {roomname: socket.room, username: rooms[socket.room].userlist[i].name});
                    }


                }                
            }

            for(let j = 0; j < rooms[socket.room].userlist[i].hand.length; j++){
                if(rooms[socket.room].userlist[i].selected.card_text == rooms[socket.room].userlist[i].hand[j].card_text){
                    logger.verbose("Removing white card from user's hand", {roomname: socket.room, username: rooms[socket.room].userlist[i].name, cardid: rooms[socket.room].userlist[i].hand[j].card_id, cardtext: rooms[socket.room].userlist[i].hand[j].card_text});
                    rooms[socket.room].userlist[i].hand.splice(j, 1);
                    let user = { room: socket.room, name: rooms[socket.room].userlist[i].name, id: rooms[socket.room].userlist[i].id };
                    dealWhiteCards(user);
                }
            }            

            rooms[socket.room].userlist[i].selected = false; // Mark all players as no longer having a selected card
            
        }

        for (let i = 0; i < rooms[socket.room].userlist.length; i++) {
            if (rooms[socket.room].userlist[i].turn) { // Find the player whose turn it just was
                rooms[socket.room].userlist[i].turn = false; // It is no longer their turn
                if (i === rooms[socket.room].userlist.length - 1) { // If we're at the end of the array...
                    rooms[socket.room].userlist[0].turn = true; // ...start back at 0
                    io.to(rooms[socket.room].userlist[0].id).emit('yourturn'); // let this user know its their turn
                } else { // Not at end of array
                    rooms[socket.room].userlist[i + 1].turn = true; // Just take the next player
                    io.to(rooms[socket.room].userlist[i + 1].id).emit('yourturn'); // let them know
                }

                break; // we found what we were looking for, stop looping. There's probably a better way to do this with like array.find()
            }
        }
        io.to(socket.room).emit('userlist', rooms[socket.room].userlist); // Announce the new list showing all players have no selected card and the new czar

    });
    socket.on('disconnect', () => { //check if room is empty and if so, delete
        if (socket.room) {
            logger.debug("Disconnect triggered");
            for (let i = 0; i < rooms[socket.room].userlist.length; i++) {
                if (rooms[socket.room].userlist[i].name == socket.name) { //find the user who d/c'ed
                    logger.verbose("Found a disconnected user", {roomname: rooms[socket.room].name, username: rooms[socket.room].userlist[i].name});

                    if (rooms[socket.room].userlist[i].turn) { //if it's their turn, change that and make it the next player's turn
                        rooms[socket.room].userlist[i].turn = false;
                        if (i === rooms[socket.room].userlist.length - 1) {
                            rooms[socket.room].userlist[0].turn = true;
                            io.to(rooms[socket.room].userlist[0].id).emit('yourturn');
                        } else {
                            rooms[socket.room].userlist[i + 1].turn = true;
                            io.to(rooms[socket.room].userlist[i + 1].id).emit('yourturn');
                        }
                    }
                    
                    logger.debug("Adding disconnected user to DC list, removing from userlist", {roomname: rooms[socket.room].name, username: rooms[socket.room].userlist[i].name});
                    rooms[socket.room].dclist.push(rooms[socket.room].userlist[i]); //add to dc list
                    rooms[socket.room].userlist.splice(i, 1); //remove the d/c'ed user                    

                    break;
                }
            }
            socket.to(socket.room).emit('userlist', rooms[socket.room].userlist); //send updated userlist showing the user removed

            //check if room is ready. this should be its own function and isn't DRY, but whatever. Needs to be done in case all players except the disconnector were ready
            let ready = 0;
            for (let i = 0; i < rooms[socket.room].userlist.length; i++) {
                if (rooms[socket.room].userlist[i].turn || rooms[socket.room].userlist[i].selected) { // if it's your turn, you will not have selected a card
                    ready++;
                }
            }
            if (ready === rooms[socket.room].userlist.length) { // everyone is ready
                logger.info("Everyone is ready", {roomname: socket.room});
                let selectedcards = [];
                for (let i = 0; i < rooms[socket.room].userlist.length; i++) {
                    if (rooms[socket.room].userlist[i].selected) {
                        selectedcards.push({ name: rooms[socket.room].userlist[i].name, card_text: rooms[socket.room].userlist[i].selected, selected: false })
                    }
                }
                util.shuffle(selectedcards);
                io.to(socket.room).emit('selectedcards', selectedcards);
            }
            //end redundant code

            if (rooms[socket.room].userlist.length == 0) {
                logger.info("No users found, deleting room", {roomname: rooms[socket.room].name})
                delete rooms[socket.room];
            }
        }
    });
});

pool.query('SELECT CURRENT_TIMESTAMP', function (error, results, fields) { //test db connection and throw error if cannot successfully query
    if (error) throw error;
});

http.listen(3001, function () {
    let now = new Date().toISOString();
    logger.info('Application starting at %s running on commit hash %s', now, process.argv[2]); // This is being output to the log file in the Docker Volume that we are serving at /log
});

function createRoom(roomname) { // Pretty straightforward
    rooms[roomname] = {}; // Initialize our various variables
    rooms[roomname].userlist = [];
    rooms[roomname].dclist = [];
    rooms[roomname].whitecards = [];
    rooms[roomname].blackcards = [];
    rooms[roomname].whitecards = rooms[roomname].whitecards.concat(whitecards); // add cards from global static array into our room's array
    rooms[roomname].blackcards = rooms[roomname].blackcards.concat(blackcards); // add cards from global static array into our room's array

    logger.info('Room started', {roomname: roomname});
}

function dealWhiteCards(user) {
    for (let i = 0; i < rooms[user.room].userlist.length; i++) { // Loop through the users in room
        if (rooms[user.room].userlist[i].name == user.name) { 
            for (let j = 0; j < 7; j++) {
                let index = util.getRandomIndex(rooms[user.room].whitecards);
                let cardDrawn = rooms[user.room].whitecards.splice(index, 1);
                
                if(rooms[user.room].userlist[i].hand == undefined || rooms[user.room].userlist[i].hand.length < 7){
                    logger.debug("Adding one card to user's hand", {roomname: user.room, username: rooms[user.room].userlist[i].name, cardid: cardDrawn[0].card_id});
                    rooms[user.room].userlist[i].hand.push(cardDrawn[0]); //Add drawn card to the user's hand on serverside
                }
    
            }
            io.to(user.id).emit('dealcards', rooms[user.room].userlist[i].hand);
            break;
        }
    }
}