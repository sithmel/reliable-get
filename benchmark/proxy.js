var ReliableGet = require('..');
var config = {cache:{engine:'nocache'}};
var rg = new ReliableGet(config);
var async = require('async');
var heapdump = require('heapdump');

function spawnStub(next) {

var spawn = require('child_process').spawn,
    stub    = spawn('node', ['benchmark/stub']);

  stub.stdout.on('data', function (data) {
    if(data && data.toString().indexOf('OK') >= 0) {
      next(null, stub);
    }
  });

  stub.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  stub.on('close', function (code) {
    console.log('child process exited with code ' + code);
  });

}

function fireRequest(count, next) {
  rg.get({url:'http://localhost:5001'}, function(err, response) {
     if(err) { console.dir(err); }
     if(count % 1000 === 0) {
        console.log('processed ' + count + ' ' + response.statusCode);
     }
     next(err, count);
  });
}

function fireLotsOfRequests(next) {
  var count = 0;
  async.whilst(
    function () { return count < 10000; },
    function (callback) {
        count++;
        fireRequest(count, callback);
    },next);
}

function initialise() {
  spawnStub(function(err, stub) {
    console.dir('RUNNING ...');
    heapdump.writeSnapshot('./rg-' + Date.now() + '.heapsnapshot');
    fireLotsOfRequests(function() {
      global.gc();
      console.log('Waiting 5 secs for GC ...');
      setTimeout(function() {
        heapdump.writeSnapshot('./rg-' + Date.now() + '.heapsnapshot');
        stub.kill('SIGHUP');
        rg.disconnect();
      }, 5000);
    });
  })
}

initialise();


