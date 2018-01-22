'use strict';

var connect = require('connect');
var connectRoute = require('connect-route');
var cookieParser = require('cookie-parser');
var fs = require('fs');
var cacheMiddleware = require('../../lib/cache/cacheMiddleware');

// This should probably be made its own project!
function initStubServer(port, next) {

  var app = connect();
  var complexHtml = fs.readFileSync(__dirname + '/complex.html');

  app.use(cookieParser());

  app.use('/middleware', cacheMiddleware({cache:{engine:'redis'}}));

  app.use(connectRoute(function (router) {

    var faultyFn = function(req, res) {
      var faulty = req.originalUrl.indexOf('faulty=true') >= 0 ? true : false;
      setTimeout(function() {
        if(!faulty) {
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end('Faulty service managed to serve good content!');
        } else {
          res.writeHead(500, {'Content-Type': 'text/html'});
          res.end('Faulty service broken');
        }
      }, 100);
    }

    var isFaulty = false;
    var toggleFaultyFn = function(req, res) {
      setTimeout(function() {
        if(!isFaulty) {
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end('Faulty service managed to serve good content!');
        } else {
          res.writeHead(500, {'Content-Type': 'text/html'});
          res.end('Faulty service broken');
        }
        isFaulty = !isFaulty;
      }, 100);
    }

    router.get('/', function(req, res) {
      res.end('OK');
    });

    router.get('/broken', function(req, res) {
      req.socket.end();
    });

    router.get('/nocache', function(req, res) {
      res.writeHead(200, {'cache-control': 'private, max-age=0, no-cache'});
      res.end('' + Date.now());
    });

    router.get('/notfound', function(req, res) {
      var statusCode = req.originalUrl.indexOf('notFound=true') >= 0 ? 404 : 200;
      res.writeHead(statusCode, {'Content-Type': 'text/html'});
      res.end('Status: ' + statusCode);
    });

    router.get('/nocachecustom', function(req, res) {
      res.writeHead(200, {'cache-control': 'no-cache, no-store, must-revalidate, private, max-stale=0, post-check=0, pre-check=0'});
      res.end('' + Date.now());
    });

    router.get('/maxage', function(req, res) {
      res.writeHead(200, {'cache-control': 'private, max-age=5000'});
      res.end('' + Date.now());
    });

    router.get('/set-cookie', function(req, res) {
      var faulty = req.originalUrl.indexOf('faulty=true') >= 0 ? true : false;
      if(!faulty) {
        res.writeHead(200, {'Set-Cookie': 'test=bob', 'Content-Type': 'text/html'});
        res.end('OK');
      } else {
        res.writeHead(500, {'Content-Type': 'text/html'});
        res.end('Faulty service broken');
      }
    });

    router.get('/302', function(req, res) {
      res.writeHead(302, {'location': '/'});
      res.end('302 response: ' + Date.now());
    });

    router.get('/403', function(req, res) {
      res.writeHead(403, {'Content-Type': 'text/html'});
      res.end('Some 403 content from server');
    })

    router.get('/faulty', faultyFn);
    router.get('/toggle-faulty', toggleFaultyFn);
    router.get('/cb-faulty', faultyFn);
    router.get('/cb-faulty-default', faultyFn);

    router.get('/teaching-resource/:resourceStub', function(req, res, next) {
      res.end(complexHtml.toString());
    });

    router.get('/headers', function(req, res) {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(req.headers));
    })

  }));

  app.listen(port).on('listening', next);
}

module.exports = {
  init: initStubServer
};
