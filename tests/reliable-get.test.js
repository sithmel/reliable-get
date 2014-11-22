'use strict';

var expect = require('expect.js');
var ReliableGet = require('..');
var async = require('async');
var _ = require('lodash');

describe("Reliable Get", function() {

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
      rg.get({url:'http://localhost:5001/faulty?faulty=false', cacheKey: 'memory-faulty-2', cacheTTL: 200}, function(err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(200);
          rg.get({url:'http://localhost:5001/faulty?faulty=true', cacheKey: 'memory-faulty-2', cacheTTL: 200}, function(err, response) {
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
              expect(response.stale.content).to.be('Faulty service managed to serve good content!');
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
              expect(response.stale.content).to.be('Faulty service managed to serve good content!');
              done();
            });
          }, 500);
      });
  });

  it('CIRCUIT BREAKER: should invoke circuit breaker if configured and then open again after window', function(done) {

      this.timeout(20000);

      var config = {cache:{engine:'memorycache'},
        'circuitbreaker':{
            'windowDuration':5000,
            'numBuckets': 5,
            'errorThreshold': 20,
            'volumeThreshold': 3,
            'includePath': true
        }
      };
      var rg = new ReliableGet(config);
      var cbOpen = false;

      rg.on('log', function(level, message) {
        if(_.contains(message, 'CIRCUIT BREAKER OPEN for host')) {
          cbOpen = true;
        }
        if(_.contains(message, 'CIRCUIT BREAKER CLOSED for host')) {
          cbOpen = false;
        }
      });

      async.whilst(function() {
        return !cbOpen;
      }, function(next) {
        rg.get({url:'http://localhost:5001/cb-faulty?faulty=true', cacheKey: 'circuit-breaker', explicitNoCache: true}, function(err, response) {
          expect(err.statusCode).to.be(500);
          next();
        });
      }, function() {
        setTimeout(function() {
          async.whilst(function() {
              return cbOpen;
            }, function(next) {
              rg.get({url:'http://localhost:5001/cb-faulty?faulty=false', cacheKey: 'circuit-breaker', explicitNoCache: true}, function(err, response) {
                setTimeout(next, 500);
              });
            }, function() {
              done();
            }
          );
        }, 5000);
      });
  });

});


