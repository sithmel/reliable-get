'use strict';

var expect = require('expect.js');
var async = require('async');
var _ = require('lodash');
var TEST_SERVER_PORT = 9002;
var request = require('request');

describe("Middleware", function() {

  this.slow(10000);

  before(function(done) {
    var stubServer = require('./stub/server');
    stubServer.init(TEST_SERVER_PORT, done);
  });

  it('set/get key', function(done) {
    request({
      url: 'http://localhost:' + TEST_SERVER_PORT + '/middleware/api/cache/testkey',
      method: "POST",
      json: { content: 'content', maxAge: 60 }
    }, function (err, response) {
      expect(err).to.be(null);
      expect(response.statusCode).to.be(200);
      request({
        url: 'http://localhost:' + TEST_SERVER_PORT + '/middleware/api/cache/testkey',
        method: "GET",
      }, function (err, response) {
        expect(err).to.be(null);
        expect(response.statusCode).to.be(200);
        expect(response.body).to.be('"content"');
        done();
      });
    });
  });

  it('set/delete/get key', function(done) {
    request({
      url: 'http://localhost:' + TEST_SERVER_PORT + '/middleware/api/cache/testkey',
      method: "POST",
      json: { content: 'content', maxAge: 60 }
    }, function (err, response) {
      expect(err).to.be(null);
      expect(response.statusCode).to.be(200);
      request({
        url: 'http://localhost:' + TEST_SERVER_PORT + '/middleware/api/cache/testkey',
        method: "DELETE",
      }, function (err, response) {
        expect(err).to.be(null);
        expect(response.statusCode).to.be(200);
        request({
          url: 'http://localhost:' + TEST_SERVER_PORT + '/middleware/api/cache/testkey',
          method: "GET",
        }, function (err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(404);
          done();
        });
      });
    });
  });

  it('set/delete tag /get key', function(done) {
    request({
      url: 'http://localhost:' + TEST_SERVER_PORT + '/middleware/api/cache/testkey',
      method: "POST",
      json: { content: 'content', maxAge: 60, tags: ['specialtag'] }
    }, function (err, response) {
      expect(err).to.be(null);
      expect(response.statusCode).to.be(200);
      request({
        url: 'http://localhost:' + TEST_SERVER_PORT + '/middleware/api/cache/tags/specialtag',
        method: "DELETE",
      }, function (err, response) {
        expect(err).to.be(null);
        expect(response.statusCode).to.be(200);
        request({
          url: 'http://localhost:' + TEST_SERVER_PORT + '/middleware/api/cache/testkey',
          method: "GET",
        }, function (err, response) {
          expect(err).to.be(null);
          expect(response.statusCode).to.be(404);
          done();
        });
      });
    });
  });

});
