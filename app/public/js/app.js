var app = new Vue({
    el: '#app',
    data: {
        whitecards: [],
        players: [],
        blackcard: [],
        room: "",
        name: "",
        roomjoined: false,
        gamestarted: false,
        selectedcards: [],
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
        submitchatlink() {
            this.chatlink.current = this.chatlink.temp;
            socket.emit('chatlink', this.chatlink.current);
        },
        cancelchatlink() {
            this.chatlink.current = this.chatlink.previous;
        },
        editchatlink() {
            this.chatlink.previous = this.chatlink.current;
            this.chatlink.current = "";
        },
        selectCard: function(index) {
            if(this.whitecards[index].selected) { // if the user clicked on the card that is already selected...
                this.whitecards[index].selected = false; //just toggle it to not selected
                socket.emit('selected', false);
                this.$forceUpdate(); // i don't know why Vue isn't automatically updating here, but it's not
                return;
            }
            for(let i=0; i<this.whitecards.length; i++) { //otherwise, let's deselect any other currently selected cards...
                this.whitecards[i].selected = false;
            }
            this.whitecards[index].selected = true; //and select the one the user clicked
            socket.emit('selected', this.whitecards[index].card_text);
            this.$forceUpdate(); // i don't know why Vue isn't automatically updating here, but it's not
        },
        selectWinningCard: function(index) {
            socket.emit('winningcard', app.selectedcards[index]);
            app.turn = false;
        },
        startgame: function () {
            socket.emit('startgame');
        },
        joinroom: function() {
            if(!this.name) {
                alert("Name is required!");
                return;
            }
            if(!this.room) {
                alert("Room is required!");
                return;
            }
            this.room = this.room.toLowerCase();
            
            socket = io();
            socket.on('userlist', function(msg) {
		        app.players = msg;

            })
            socket.on('chatlink', function(msg) {
                app.chatlink.current = msg;
                if(!app.chatlink.visible) {
                    app.chatlink.visible = true;
                }
            })

            socket.on('yourturn', function() {
                app.turn = true;
                if(app.blackcard.length===0) {
                    socket.emit('drawblack');
                }
                
            })
            socket.on('dealcards', function(msg) {
                for(let i=0; i<msg.length; i++) {
                    app.whitecards.push(msg[i]);
                }
            });
            socket.on('dealblack', function(msg) {
                app.blackcard = msg;
            });
            socket.on('gamestarted', function () {
                app.gamestarted = true;
            });
            socket.on('selectedcards', function(msg) {
                app.selectedcards = msg;
                let cardIndex = app.whitecards.findIndex(element => element.selected === true);
                app.whitecards.splice(cardIndex, 1);
                socket.emit('drawonecard');
            });
            socket.on('winningcard', function(msg) {
                let cardIndex = app.selectedcards.findIndex(element => element.name === msg.name);
                app.selectedcards[cardIndex].selected = true;
                window.setTimeout(clearBetweenRounds, 4500);
            });
            socket.on('whoareyou', function() {
                alert('Error occured. The page will be refreshed.');
                location.reload(true);
            })
            socket.emit('joinroom', {room: this.room, name: this.name});
            window.setTimeout(()=>{socket.emit('drawfivecards');}, 1000);
            this.roomjoined = true;
        },
    },
    mounted() {
        const Http = new XMLHttpRequest();
        const url='/version';
        Http.open("GET", url);
        Http.send();

        Http.onreadystatechange = (e) => {
            app.version = JSON.parse(Http.responseText);
        }
        setTimeout(function() {app.chatlink.visible=false;}, 12000);
    }
});

function clearBetweenRounds() {
    app.selectedcards = [];
    app.blackcard = [];
    if(app.turn) {
        window.setTimeout(()=>{socket.emit('drawblack');}, 700);
    }
    
}
