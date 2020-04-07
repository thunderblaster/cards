var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
const config = require('./config');


    var pool = mysql.createPool({
	connectionLimit: 25,
	host: config.database.host,
	user: config.database.user,
	password: config.database.password,
    database: config.database.database,
    port: config.database.port
});

pool.on('error', function (err) {
	console.log(err);
});

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/version', function (req, res) {
    let version = {
        hash: process.argv[2],
        date: process.argv[3]
    }
    res.send(version);
});

app.get('/log', function (req, res) {
    res.sendFile('/log/app.log');
});

app.use(express.static(__dirname + '/public'));

var rooms = {};

app.get('/rooms', function (req, res) {
    res.send(rooms);
})

io.on('connection', function (socket) { //need to keep track server side of when users have selected a white card
    socket.on('joinroom', function (msg) {
        if(msg.room) {
            let ip = socket.request.headers["x-forwarded-for"] || socket.conn.remoteAddress.split(":")[3];
            pool.query('INSERT INTO log (name, room, ip_addr) VALUES (?, ?, ?)', [msg.name, msg.room, ip], function (error, results, fields) {
                //cool deal
            });
            if(!rooms[msg.room]) { // new room, create it
                createRoom(msg.room);
                socket.name = msg.name;
                socket.room = msg.room;
                rooms[msg.room].userlist.push({id: socket.id, name: msg.name, selected: false, turn: false, points: 0});
                //Add list of users to the whitecards for giggles
                //rooms[msg.room].whitecards.push(msg.name);
            } else { // existing room
                if (rooms[msg.room].dclist.length>0) { // users have disconnected, check if this user is a returning one
                    for(let i=rooms[msg.room].dclist.length-1; i>=0; i--) {
                        if(msg.name===rooms[msg.room].dclist[i].name) { // match as disconnected user, give them their old score back
                            socket.name = msg.name;
                            socket.room = msg.room;
                            rooms[msg.room].userlist.push({id: socket.id, name: msg.name, selected: false, turn: false, points: rooms[msg.room].dclist[i].points});
                            break;
                        }
                    }
                }
                if(!socket.name) { // user was not matched to a disconnected one, treat as new user
                    socket.name = msg.name;
                    socket.room = msg.room;
                    rooms[msg.room].userlist.push({id: socket.id, name: msg.name, selected: false, turn: false, points: 0});
                    rooms[msg.room].whitecards.push({card_id: randomInt(10000, 99999), card_text: msg.name});
                }
            }
            
            socket.join(msg.room); // add to the actual room
            io.to(msg.room).emit('userlist', rooms[msg.room].userlist); // send updated userlist with our new guest
            if(rooms[msg.room].gamestarted) { // if the game is in progress...
                io.to(socket.id).emit('gamestarted'); // ...let the new user know
                io.to(socket.id).emit('dealblack', rooms[socket.room].currentBlack); // ...and show them the current black card
            }
        }
        
    });
    socket.on('startgame', function () {
        io.to(socket.room).emit('gamestarted');
        rooms[socket.room].gamestarted = true;
        rooms[socket.room].userlist[0].turn = true;
        io.to(rooms[socket.room].userlist[0].id).emit('yourturn');
        io.to(socket.room).emit('userlist', rooms[socket.room].userlist);


        console.log(rooms[socket.room].whitecards.length);

        for(let i=1; i < rooms[socket.room].whitecards.length; i++){
            if(rooms[socket.room].whitecards[i].card_text == 'Nick'){
                console.log('Nicks Card Found');
                break;
            }
           
        }
        console.log(rooms[socket.room].whitecards);


        console.log('Cards searched');


    });
    socket.on('selected', function (msg) {
        if(socket.room) {
            let userIndex = rooms[socket.room].userlist.findIndex(element => element.id === socket.id);
            rooms[socket.room].userlist[userIndex].selected = msg;
            
            io.to(socket.room).emit('userlist', rooms[socket.room].userlist);
            let ready = 0;
            for(let i=0; i<rooms[socket.room].userlist.length; i++) {
                if(rooms[socket.room].userlist[i].turn||rooms[socket.room].userlist[i].selected) { // if it's your turn, you will not have selected a card
                    ready++;
                }
            }
            if(ready===rooms[socket.room].userlist.length) { // everyone is ready
                let selectedcards = [];
                for(let i=0; i<rooms[socket.room].userlist.length; i++) {
                    if(rooms[socket.room].userlist[i].selected) {
                        selectedcards.push({name: rooms[socket.room].userlist[i].name, card_text: rooms[socket.room].userlist[i].selected, selected: false})
                    }
                }
                shuffle(selectedcards);
                io.to(socket.room).emit('selectedcards', selectedcards);
            }
        } else {
            io.to(socket.id).emit('whoareyou');
        }
        
        
    });
    socket.on('drawonecard', function () {
        let cardsToReturn = [];
        let index = getRandomIndex(rooms[socket.room].whitecards);
        let cardDrawn = rooms[socket.room].whitecards.splice(index, 1);
        cardsToReturn.push(cardDrawn[0]);
        io.to(socket.id).emit('dealcards', cardsToReturn);
    });
    socket.on('drawfivecards', function () {
        let cardsToReturn = [];
        for(let i=0; i<7; i++) {
            let index = getRandomIndex(rooms[socket.room].whitecards);
            let cardDrawn = rooms[socket.room].whitecards.splice(index, 1);
            cardsToReturn.push(cardDrawn[0]);
        }
        io.to(socket.id).emit('dealcards', cardsToReturn);
    });
    socket.on('drawblack', function() {
        let cardsToReturn = [];
        let index = getRandomIndex(rooms[socket.room].blackcards);
        let cardDrawn = rooms[socket.room].blackcards.splice(index, 1);
        rooms[socket.room].currentBlack = cardDrawn;
        cardsToReturn.push(cardDrawn[0]);
        io.to(socket.room).emit('dealblack', cardsToReturn);
    });
    socket.on('winningcard', function(msg) {
        if(socket.room) {
            for(let i=0; i<rooms[socket.room].userlist.length; i++) {
                if(rooms[socket.room].userlist[i].selected===msg.card_text) {
                    rooms[socket.room].userlist[i].points++;
                    
                    io.to(socket.room).emit('winningcard', msg);
                }
                rooms[socket.room].userlist[i].selected = false;
            }
    
            for(let i=0; i<rooms[socket.room].userlist.length; i++) {
                if(rooms[socket.room].userlist[i].turn) {
                    rooms[socket.room].userlist[i].turn = false;
                    if(i===rooms[socket.room].userlist.length-1) {
                        rooms[socket.room].userlist[0].turn = true;
                        io.to(rooms[socket.room].userlist[0].id).emit('yourturn');
                    } else {
                        rooms[socket.room].userlist[i+1].turn = true;
                        io.to(rooms[socket.room].userlist[i+1].id).emit('yourturn');
                    }
                    
                break;
                }
            }
            io.to(socket.room).emit('userlist', rooms[socket.room].userlist);
        } else {
            io.to(socket.id).emit('whoareyou');
        }
        
    });
    socket.on('disconnect', () => { //check if room is empty and if so, delete
        if(socket.room) {
            for(let i=0; i<rooms[socket.room].userlist.length; i++) {
                if(rooms[socket.room].userlist[i].name==socket.name) { //find the user who d/c'ed
                    if(rooms[socket.room].userlist[i].turn){ //if it's their turn, change that and make it the next player's turn
                        rooms[socket.room].userlist[i].turn = false;
                        if(i===rooms[socket.room].userlist.length-1) {
                            rooms[socket.room].userlist[0].turn = true;
                            io.to(rooms[socket.room].userlist[0].id).emit('yourturn');
                        } else {
                            rooms[socket.room].userlist[i+1].turn = true;
                            io.to(rooms[socket.room].userlist[i+1].id).emit('yourturn');
                        }
                    }
                    rooms[socket.room].dclist.push(rooms[socket.room].userlist[i]); //add to dc list
                    rooms[socket.room].userlist.splice(i, 1); //remove the d/c'ed user
                    
                break;
                }
            }
            socket.to(socket.room).emit('userlist', rooms[socket.room].userlist); //send updated userlist showing the user removed

            //check if room is ready. this should be its own function and isn't DRY, but whatever
            let ready = 0;
            for(let i=0; i<rooms[socket.room].userlist.length; i++) {
                if(rooms[socket.room].userlist[i].turn||rooms[socket.room].userlist[i].selected) { // if it's your turn, you will not have selected a card
                    ready++;
                }
            }
            if(ready===rooms[socket.room].userlist.length) { // everyone is ready
                let selectedcards = [];
                for(let i=0; i<rooms[socket.room].userlist.length; i++) {
                    if(rooms[socket.room].userlist[i].selected) {
                        selectedcards.push({name: rooms[socket.room].userlist[i].name, card_text: rooms[socket.room].userlist[i].selected, selected: false})
                    }
                }
                shuffle(selectedcards);
                io.to(socket.room).emit('selectedcards', selectedcards);
            }
            //end redundant code
            
            if(rooms[socket.room].userlist.length==0) {
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
    console.log('Application starting at ' + now + ' running on commit hash ' + process.argv[2]);
});

function createRoom (roomname) {
    rooms[roomname] = {};
    rooms[roomname].userlist = [];
    rooms[roomname].dclist = [];
    pool.query('SELECT * FROM white_cards LIMIT 12', function (error, results, fields) {
        rooms[roomname].whitecards = results;
    });
    pool.query('SELECT * FROM black_cards', function (error, results, fields) {
        rooms[roomname].blackcards = results;
    });
}

function getRandomIndex (array) {
    return Math.floor(Math.random() * array.length);
}

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low)
  }

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }
