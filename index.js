var request = require('request-promise');
var config = require('config');
var log = require('pretty-good-log')('main');

var Twitterbot = require('mcccclean-twitterbot');
var bot = new Twitterbot(config.get('twitterbot'));

var quote = require('./quote');
var store = require('./store');

function getQuote() {
    return quote.get();
}

TAGS = { 'NN': 'noun', 'NNS': 'noun' };

function parseTags(tagged) {
    return tagged.match(/\w+\/[A-Z]+/g)
        .map(pair => {
            var bits = pair.split('/');
            var word = bits[0];
            var tag = bits[1];
            var part = TAGS[tag] || null;
            return { word, part, tag };
        });
}

function getPartsOfSpeech(quote) {
    return request({
            url: 'http://text-processing.com/api/tag/',
            json: true,
            form: { text: quote.text },
            method: 'POST'
        })
        .then(j => {
            return Object.assign({}, quote, { parts: parseTags(j.text) });
        });
}

function chooseEmoji() {
    return Promise.resolve({
        type: 'noun',
        codepoint: 0x2615,
        name: ':coffee:'
    });
}

function replaceWithEmoji(taggedQuote, emoji) {
    var parts = taggedQuote.parts.filter(t => !t.emoji && (t.part == emoji.type));
    if(parts.length == 0) {
        throw new Error("Quote did not fit emoji");
    }

    var idx = Math.floor(Math.random() * parts.length);
    var chosen = parts[idx];

    var character = String.fromCodePoint(emoji.codepoint);

    switch(chosen.tag) {
        case 'NNS':
            character += 's';
            break;
        default:
            break;
    }

    var newParts = taggedQuote.parts.map(part => (part !== chosen) ? part : {
        word: character,
        type: null
    });

    var newText = taggedQuote.text.replace(chosen.word, character);

    return Object.assign({}, taggedQuote, { 
        parts: newParts,
        text: newText
    });
}

function tweet(quote) {
    var candidate = `"${quote.text}" – ${quote.author}`;
    return store.flag(quote._id)
        .then(() => {
            log(candidate);
            if(candidate.length <= 140) {
                // actually tweet it
                bot.tweet(candidate);
                return true;
            } else {
                log.warn('too long');
                return false;
            }
        });
}

function process() {
    var quote = getQuote().then(q => getPartsOfSpeech(q));
    var emoji = chooseEmoji();
    return Promise.all([quote, emoji]) 
        .then(p => replaceWithEmoji.apply(null, p))
        .then(p => tweet(p))
        ;
}


var HOUR = 60 * 60 * 1000;
var DIFF = config.max - config.min;
var MIN = config.min;

function run() {
    process()
        .catch(e => log(e))
        .then(() => {
            var interval = Math.random() * DIFF + MIN;
            log('I will tweet again in', interval.toFixed(2), 'hours');
            setTimeout(run, interval * HOUR);
        });
}

run();

