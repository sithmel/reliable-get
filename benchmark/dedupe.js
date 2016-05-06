var async = require('async');
var ReliableGet = require('..');
var config = {cache:{engine:'nocache'}};
var rg = new ReliableGet(config);

var url = 'https://www.tes.com';

function fireRequest(url, next) {
    rg.get({url:url}, function(err, res) {
      if(err) { return next(err); }
      next(err, res);
    });
}

function fireLotsOfRequests(next) {
    var urls = [];
    var counter = 0;
    for (var i = 0; i < 40; i++){
        urls.push(url);
    }

    (function fire() {
      setTimeout(function ( ){
        var url = urls.pop();
        fireRequest(url, function (err, res) {
            console.log('Success:', res.timing, counter++);
        });
        if (urls.length) fire();
      }, 10);
    }())
}

fireLotsOfRequests();