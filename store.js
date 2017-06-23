var log = require('pretty-good-log')('store');
var datastore = require('nedb-promise')({
    filename: 'beantweets.db',
    autoload: true
});

var store = {};

store.addTweet = function(tweet) {
    return datastore.find({ gid: tweet.hash }).then(function(docs) {
        if(docs && docs.length > 0) {
            // this tweet has already been seen
            return false;
        } else {
            datastore.insert(tweet);
            return true;
        }
    });
};

store.flag = function(id) {
    return datastore.update({
        _id: id
    }, {
        $set: {
            tweeted: (+ new Date())
        }
    });
};

store.getTopTweet = function() {
    return datastore.cfindOne({
        tweeted: {
            $exists: false
        }
    }).sort({ gid: 1 }).exec();
};

module.exports = store;
