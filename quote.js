
var request = require('request-promise');
var cheerio = require('cheerio');
var hash = require('string-hash');
var log = require('pretty-good-log')('quote');

var store = require('./store');

function loadPage() {
    var url = 'http://www.famousquotesandauthors.com/random_quotes.html';
    log('Fetching quotes page');
    return request(url)
        .then(text => cheerio.load(text))
        .then($ => {
            var mainColumn = $('td[width=460]');
            return mainColumn
                .find('div[align=right]')
                .get();
        })
        .then(links => links.map(l => {
            var text = l.prev.prev.children[0].data;
            var author = l.prev.children[1].children[0].data;
            var gid = hash(text+author);
            return { text, author, gid };
        }));
}

function populateStore() {
    return loadPage()
        .then(quotes => {
            var added = quotes.filter(q => store.addTweet(q));
            log("Added", added.length, "quotes");
            return Promise.all(added);
        })
        .then(() => {
            return new Promise(resolve => setTimeout(resolve, 100));
        });
}

function get() {
    return store.getTopTweet()
        .then(result => {
            if(result) {
                return result;
            } else {
                return populateStore()
                    .then(() => store.getTopTweet());
            }
        })
        .then(quote => {
            return store.flag(quote._id).then(() => quote);
        })
}

module.exports = { get };
