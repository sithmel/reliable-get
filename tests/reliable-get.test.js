'use strict';

var expect = require('expect.js');
var ReliableGet = require('..');
var async = require('async');
var _ = require('lodash');

describe("Reliable Get", function() {

  this.slow(10000);

  before(function(done) {
    var stubServer = require('./stub/server');
    stubServer.init(5001, done);
  });

  it('NO CACHE: should be able to make a simple request', function(done) {
      var config = {cache:{engine:'nocache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001'}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          done();
      });
  });

  it('NO CACHE: should fail with an invalid url', function(done) {
      var config = {cache:{engine:'nocache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'Can I haz url?'}, function(err, response) {
          expect(err.statusCode).to.be(500);
          done();
      });
  });

  it('NO CACHE: should fail if it calls a service that is broken', function(done) {
      var config = {cache:{engine:'nocache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/broken'}, function(err, response) {
          expect(err.statusCode).to.be(500);
          done();
      });
  });

  it('NO CACHE: should fail if it calls a service that breaks after a successful request', function(done) {
      var config = {cache:{engine:'nocache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false'}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          rg.get({url:'http://localhost:5001/faulty?faulty=true'}, function(err, response) {
            expect(err.statusCode).to.be(500);
            done();
          });
      });
  });

  it('NO CACHE: should just request service if cache get fails', function(done) {
      var config = {cache:{engine:'nocache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey:'__error__'}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          done();
      });
  });

  it('NO CACHE: should fail if timeout exceeded', function(done) {
      var config = {cache:{engine:'nocache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false', timeout: 5}, function(err, response) {
          expect(err.statusCode).to.be(500);
          done();
      });
  });

 it('NO CACHE: should follow a redirect by default', function(done) {
      var config = {cache:{engine:'nocache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/302', timeout: 5}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          expect(response.content).to.be("OK");
          done();
      });
  });

 it('NO CACHE: should not follow a redirect if configured not to', function(done) {
      var config = {cache:{engine:'nocache'}, followRedirect: false};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/302', timeout: 5}, function(err, response) {
          expect(err.statusCode).to.be(302);
          expect(err.headers.location).to.be('/');
          done();
      });
  });

  it('MEMORY CACHE: should initialise with caching on with simple defaults if none provided', function(done) {
      var config = {cache:{engine:'memorycache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false'}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          rg.get({url:'http://localhost:5001/faulty?faulty=false'}, function(err, response) {
            expect(err).to.be(null);
            expect(response.statusCode).to.be(200);
            done();
          });
      });
  });

  it('MEMORY CACHE: should serve from cache after initial request', function(done) {
      var config = {cache:{engine:'memorycache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey: 'memory-faulty-1', cacheTTL: 200}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey: 'memory-faulty-1', cacheTTL: 200}, function(err, response) {
            expect(err).to.be(null);
            expect(response.statusCode).to.be(200);
            done();
          });
      });
  });

  it('MEMORY CACHE: should serve cached content if it calls a service that breaks after a successful request', function(done) {
      var config = {cache:{engine:'memorycache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey: 'memory-faulty-2', cacheTTL: 10000}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          rg.get({url:'http://localhost:5001/faulty?faulty=true', cacheKey: 'memory-faulty-2', cacheTTL: 10000}, function(err, response) {
            expect(err).to.be(null);
            expect(response.statusCode).to.be(200);
            done();
          });
      });
  });

  it('MEMORY CACHE: should serve stale content if it calls a service that breaks after a successful request and ttl expired', function(done) {
      var config = {cache:{engine:'memorycache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey: 'memory-faulty-3', cacheTTL: 200}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          setTimeout(function() {
            rg.get({url:'http://localhost:5001/faulty?faulty=true', cacheKey: 'memory-faulty-3', cacheTTL: 200}, function(err, response) {
              expect(err.statusCode).to.be(500);
              expect(response.content).to.be('Faulty service managed to serve good content!');
              expect(response.stale).to.be(true);
              done();
            });
          }, 500);
      });
  });

  it('MEMORY CACHE: should return whatever is in cache at the cache key if the url is "cache"', function(done) {
      var config = {cache:{engine:'memorycache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'cache', cacheKey:'memory-faulty-2', cacheTTL: 10000}, function(err, response) {
          expect(response.statusCode).to.be(200);
          expect(response.content).to.be('Faulty service managed to serve good content!');
          done();
      });
  });

  it('MEMORY CACHE: should return 404 if nothing is in cache at the cache key if the url is "cache"', function(done) {
      var config = {cache:{engine:'memorycache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'cache', cacheKey:'invalid-key', cacheTTL: 10000}, function(err, response) {
          expect(response.statusCode).to.be(404);
          expect(response.content).to.be('No content in cache at key: invalid-key');
          done();
      });
  });

  it('MEMORY CACHE: should honor no-cache cache-control headers ', function(done) {
      var config = {cache:{engine:'memorycache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/nocache', cacheKey: 'memory-nocache-1', cacheTTL: 10000}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          var content = response.content;
          setTimeout(function() {
            rg.get({url:'http://localhost:5001/nocache', cacheKey: 'memory-nocache-1', cacheTTL: 10000}, function(err, response) {
              expect(response.statusCode).to.be(200);
              expect(response.content).to.not.be(content);
              done();
            });
          }, 500);
      });
  });

  it('MEMORY CACHE: should honor max age cache-control headers', function(done) {
      var config = {cache:{engine:'memorycache'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/maxage', cacheKey: 'memory-maxage-1', cacheTTL: 50}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          var content = response.content;
          setTimeout(function() {
            rg.get({url:'http://localhost:5001/maxage', cacheKey: 'memory-maxage-1', cacheTTL: 50}, function(err, response) {
              expect(response.statusCode).to.be(200);
              expect(response.content).to.be(content);
              done();
            });
          }, 500);
      });
  });

  it('REDIS CACHE: should serve from cache after initial request', function(done) {
      var config = {cache:{engine:'redis'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey: 'redis-faulty-1', cacheTTL: 200}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          rg.get({url:'http://localhost:5001/faulty?faulty=true', cacheKey: 'redis-faulty-1', cacheTTL: 200}, function(err, response) {
            expect(err).to.be(null);
            expect(response.statusCode).to.be(200);
            done();
          });
      });
  });

  it('REDIS CACHE: should serve cached content if it calls a service that breaks after a successful request', function(done) {
      var config = {cache:{engine:'redis'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey: 'redis-faulty-2', cacheTTL: 200}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          rg.get({url:'http://localhost:5001/faulty?faulty=true', cacheKey: 'redis-faulty-2', cacheTTL: 200}, function(err, response) {
            expect(err).to.be(null);
            expect(response.statusCode).to.be(200);
            done();
          });
      });
  });

  it('REDIS CACHE: should serve stale content if it calls a service that breaks after a successful request and ttl expired', function(done) {
      var config = {cache:{engine:'redis'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey: 'redis-faulty-3', cacheTTL: 200}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          setTimeout(function() {
            rg.get({url:'http://localhost:5001/faulty?faulty=true', cacheKey: 'redis-faulty-3', cacheTTL: 200}, function(err, response) {
              expect(err.statusCode).to.be(500);
              expect(response.content).to.be('Faulty service managed to serve good content!');
              expect(response.stale).to.be(true);
              done();
            });
          }, 500);
      });
  });

  it('REDIS CACHE: should not serve cached set-cookie headers if it calls a service that breaks after a successful request', function(done) {
      var config = {cache:{engine:'redis'}};
      var rg = new ReliableGet(config);
      rg.get({url:'http://localhost:5001/set-cookie?faulty=false', cacheKey: 'redis-set-cookie', cacheTTL: 200}, function(err, response) {
          expect(response.headers['set-cookie']).to.contain('test=bob');
          expect(response.statusCode).to.be(200);
          rg.get({url:'http://localhost:5001/set-cookie?faulty=true', cacheKey: 'redis-set-cookie', cacheTTL: 200}, function(err, response) {
            expect(response.headers).to.not.contain('set-cookie');
            expect(response.statusCode).to.be(200);
            done();
          });
      });
  });

});


