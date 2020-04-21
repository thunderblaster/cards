const config = require('./config'); // Get our config file

module.exports = {
    getRandomIndex: function (array) { // This is used when drawing cards
        return Math.floor(Math.random() * array.length);
    },

    randomInt: function randomInt(low, high) { // This is used when choosing a fake card_id for new cards
        return Math.floor(Math.random() * (high - low) + low)
    },

    shuffle: function (array) { // Used to shuffle selected cards when presented back to Card Czar (and all of the room)
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
};