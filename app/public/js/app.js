var app = new Vue({
    el: '#app',
    data: { // All our client side variables
        whitecards: [], // This is our hand
        players: [],
        blackcard: [], // I know, this shouldn't be an array
        room: "", // Name of room
        name: "", // Name of player
        roomjoined: false,
        gamestarted: false,
        selectedcards: [], // These are all the cards submitted to the Card Czar
        turn: false,
        version: {},
        chatlink: {
            current: "",
            temp: "",
            previous: "",
            visible: true
        }
    },
    methods: {
        submitchatlink() { // When a user submits a link
            this.chatlink.current = this.chatlink.temp; // chatlink.temp was modeled to the input, so set the value of the current link to its value
            socket.emit('chatlink', this.chatlink.current); // submit this to the server to be announced to the room
        },
        cancelchatlink() { // User started entering a chatlink, but cancelled
            this.chatlink.current = this.chatlink.previous; // Just set the current value back to whatever it previously was
        },
        editchatlink() { // There exists a chatlink, and the user is changing it
            this.chatlink.previous = this.chatlink.current; // Store the current value in another variable in case the user cancels this edit
            this.chatlink.current = ""; // This triggers the view to display an input field to set the new value
        },
        selectCard: function(index) { // Submit a card to the card czar
            if(!this.gamestarted){ 
                alert("Wait to select a card until the game has started, cheater.");
                return;
            } else {
                if(this.whitecards[index].selected) { // if the user clicked on the card that is already selected...
                    this.whitecards[index].selected = false; //just toggle it to not selected
                    socket.emit('selected', false); // Tell the server that the card was deselected
                    this.$forceUpdate(); // i don't know why Vue isn't automatically updating here, but it's not
                    return;
                }
                for(let i=0; i<this.whitecards.length; i++) { //otherwise, let's deselect any other currently selected cards...
                    this.whitecards[i].selected = false;
                }
                this.whitecards[index].selected = true; //...and select the one the user clicked
                socket.emit('selected', this.whitecards[index].card_text); // Tell the server which card we picked
                this.$forceUpdate(); // i don't know why Vue isn't automatically updating here, but it's not
            }
        },
        selectWinningCard: function(index) { // This is called when its your turn and you select the winning white card
            socket.emit('winningcard', app.selectedcards[index]); // Tell the server which card won
            app.turn = false; // Mark it as no longer your turn
        },
        startgame: function () { // Called when the user clicks the "Start Game" button
            socket.emit('startgame'); // Tell the server we want to start the game
        },
        joinroom: function() { // Called when the user clicks join room
            if(!this.name) { // Don't allow a user to join without a name (this should maybe be a more thorough check to ensure it's not just a space and that it's not 10,000 characters long)
                alert("Name is required!");
                return;
            }
            if(!this.room) { // Can't join a room if you didn't specify room name
                alert("Room is required!");
                return;
            }
            this.room = this.room.toLowerCase(); // We don't want rooms to be case sensitive and treat room1 and Room1 as different rooms
            
            socket = io(); // Okay, we've passed validation, time to create a socket connection with the server.
            // Set up listeners
            socket.on('userlist', function(msg) { // Called whenever the server pushes an updated userlist
		        app.players = msg; // Just replace whatever we had with the newest info from the server

            })
            socket.on('chatlink', function(msg) { // Called when the server is announcing an updated chatlink
                app.chatlink.current = msg; // Replace whatever we had with the new one
                if(!app.chatlink.visible) { // If the chat info was NOT visible...
                    app.chatlink.visible = true; // Let's make it visible to ensure the user knows we got new info
                }
            })

            socket.on('yourturn', function() { // The server is telling us it's our turn
                app.turn = true; // Mark that in our client-side variable to update the view to what we want
                if(app.blackcard.length===0) { // If there isn't currently a black card... (yeah, i know, why is it an array when it's always 1 or 0 cards?)
                    socket.emit('drawblack'); // ...request one from the server
                }
                
            })
            socket.on('dealcards', function(msg) { // The server has given us an arbitrary amount of white cards
                for(let i=0; i<msg.length; i++) { // Loop through them...
                    app.whitecards.push(msg[i]); // ...and add to our hand
                }
            });
            socket.on('dealblack', function(msg) { // The server dealt a black card
                app.blackcard = msg; // Replace whatever we had with the new one
            });
            socket.on('gamestarted', function () { // The server is telling us the game has started
                app.gamestarted = true; // Updated our client-side variable to set the view accordingly
            });
            socket.on('selectedcards', function(msg) { // The server is showing us the white cards submitted by other players for selection by the card czar
                app.selectedcards = msg; // Replace our array with the one from the server
                let cardIndex = app.whitecards.findIndex(element => element.selected === true); // Now that this is commited, remove the card we selected from our hand. 
                app.whitecards.splice(cardIndex, 1); // We don't want to splice the card on selection, because it can be deselected
                socket.emit('drawonecard', this.name); // Request another white card from the server
            });
            socket.on('winningcard', function(msg) { // The card that the czar selected to win
                let cardIndex = app.selectedcards.findIndex(element => element.name === msg.name); // Find this card in our client-side array
                app.selectedcards[cardIndex].selected = true; // Mark it selected so it displays blue
                window.setTimeout(clearBetweenRounds, 4500); // Give us enough time for the player to see before we clear
            });
            socket.on('whoareyou', function() { // This is sent when the server doesn't have a valid session for you
                alert('Error occured. The page will be refreshed.');
                location.reload(true);
            })
            // Okay, listeners set up
            socket.emit('joinroom', {room: this.room, name: this.name}); // let's tell the server we're joining the room
            window.setTimeout(()=>{socket.emit('drawfivecards', this.name);}, 1000); // ask for cards, but give the server a moment to ensure the room gets created and we get joined to it
            this.roomjoined = true; // update the client that we've joined a room to update the view
        },
    },
    mounted() { // This is essentially like jQuery's onReady()
        const Http = new XMLHttpRequest();
        const url='/version'; // We're going to get the git info from Node
        Http.open("GET", url);
        Http.send();

        Http.onreadystatechange = (e) => {
            app.version = JSON.parse(Http.responseText); // And add it to Vue to be displayed on the front page
        }
        setTimeout(function() {app.chatlink.visible=false;}, 12000); // Start with chatlink open, but autohide after a while
    }
});

function clearBetweenRounds() { 
    app.selectedcards = [];
    app.blackcard = [];
    if(app.turn) {
        window.setTimeout(()=>{socket.emit('drawblack');}, 700); // This setTimeout is a lazy hack to fix a race condition where the black card would sometimes
    } // get drawn by a very fast client before the previous black card would have been removed by a very slow client, causing the newly drawn card to be deleted
}
