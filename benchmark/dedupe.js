var ReliableGet = require('..');
// var config = {cache:{engine:'nocache'}};
var config = {cache:{engine:'redis'}};
var rg = new ReliableGet(config);

//rg.on('log', function(level, message, data) {
  //if (message.startsWith('Deduped')) {
//    console.log(level, message, data);
  //}
//});

var urllist = [
  'https://www.tes.com',
  'https://www.tes.com/teaching-resource/animal-non-chronological-report-examples-11045757',
  'https://www.tes.com/teaching-resources/blog/supporting-students-core-subjects',
  'https://www.tes.com/news/school-news/breaking-news/education-super-union-step-closer-atl-and-nut-vote-ballot-members',
  'https://www.tes.com/news/school-news/breaking-views/%E2%80%98i-hear-teachers-crying-their-kitchen-floor-because-stress%E2%80%99',
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
            if (err) {
                console.log(err);
                return ;
            }
            console.log(counter++, ' - success:', url,  res.realTiming, res.deduped ? 'deduped' : '');
        });
        if (urls.length) {
            fire();
        }
      }, 10);
    }())
}

fireLotsOfRequests();
