var ReliableGet = require('..');
// var config = {cache:{engine:'nocache'}};
var config = {cache:{engine:'redis'}, compress: true};
var rg = new ReliableGet(config);
var async = require('async');
var fs = require('fs');
require('./memory');

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

function readLines(input, func, next) {
  var remaining = '', count = 0;
  input.on('data', function(data) {
    input.pause();
    remaining += data.toString();
    var index = remaining.indexOf('\n');
    async.whilst(
      function () { return index > -1; },
      function (callback) {
        var line = remaining.substring(0, index);
        remaining = remaining.substring(index + 1);
        func(line, function() {
          count++;
          if(count % 1000 === 0) {
            console.log('Processed ' + count);
          }
          callback();
        });
        index = remaining.indexOf('\n');
      },
      function () {
        input.resume();
      }
    );
  });

  input.on('end', function() {
    if (remaining.length > 0) {
      func(remaining, next);
    } else {
      next();
    }
  });
}

function fireRequest(url, next) {
  rg.get({url:url}, function(err) {
     if(err) { return next(err); }
     next(err);
  });
}

function fireLotsOfRequests(next) {
  var readStream = fs.createReadStream(__dirname + '/urls.txt');
  readLines(readStream, fireRequest, next);
}

function initialise() {
  spawnStub(function(err, stub) {
    console.dir('RUNNING ...');
    fireLotsOfRequests(function() {
      setTimeout(function() {
        stub.kill('SIGHUP');
        process.exit();

//        rg.disconnect();
      }, 5000);
    });
  })
}

initialise();
