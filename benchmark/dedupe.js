var ReliableGet = require('..');
//var config = {cache:{engine:'nocache'}};
var config = {cache:{engine:'redis'}};
var rg = new ReliableGet(config);

var urllist = [
  'https://www.tes.com',
  'http://stackoverflow.com/questions/6851909/how-do-i-delete-everything-in-redis',
  'https://github.com/sithmel/async-deco/blob/master/src/cache.js',
  'https://github.com/tes/reliable-get/blob/master/index.js',
  'https://github.com/tes/reliable-get/tree/master/lib/cache',
  'https://www.tes.com/jobs/',
  'https://www.tes.com/teaching-resources',
  'https://community.tes.com/',
  'https://www.tes.com/news/school-news',
  'https://www.tes.com/institute/'
];

function fireRequest(url, next) {
    rg.get({url:url}, function(err, res) {
      if(err) { return next(err); }
      next(err, res);
    });
}

function fireLotsOfRequests() {
    var urls = [];
    var counter = 0;
    for (var i = 0; i < 40; i++){
        urls.push(urllist[i % urllist.length]);
    }

    (function fire() {
      setTimeout(function ( ){
        var url = urls.pop();
        fireRequest(url, function (err, res) {
            console.log('Success:', res.realTiming, counter++);
        });
        if (urls.length) {
            fire();
        }
      }, 10);
    }())
}

fireLotsOfRequests();
