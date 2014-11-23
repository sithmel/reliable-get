'use strict';

var expect = require('expect.js');
var cacheFactory = require('../../lib/cache/cacheFactory');

describe("Redis Cache Engine", function() {

    this.timeout(5000);
    this.slow(3000);

    beforeEach(function() {
        cacheFactory.clearCacheInstances();
    });

	it('should set and get values from cache', function(done) {
        withCache({engine:'redis'}, function(err, cache) {
            cache.set('bar:123', {content:'content', headers:{'header':'1'}}, 1000, function(err) {
                expect(err).to.be(null);
                assertCachedValue(cache, 'bar:123', 'content', function() {
                    assertHeaderValue(cache, 'bar:123', 'header', '1', done);
                });
            });
        });
	});

    it('should set and get values from cache without set callback', function(done) {
        withCache({engine:'redis'}, function(err, cache) {
            cache.set('bar:223', {content:'content', headers:{'header':'1'}}, 1000);
            setTimeout(function() {
                assertCachedValue(cache, 'bar:223', 'content', function() {
                    assertHeaderValue(cache, 'bar:223', 'header', '1', done);
                });
            }, 200); // Long enough
        });
    });

    it('should return null when value not present', function(done) {
        withCache({engine:'redis'}, function(err, cache) {
            assertCachedNullValue(cache, 'bar:212122', done);
        });
    });

    it('should expire values in cache', function(done) {
        withCache({engine:'redis'}, function(err, cache) {
            cache.set('bar:1234', {content:'content', headers:{'header':'1'}}, 1000, function(err) {
                expect(err).to.be(null);
                assertCachedValue(cache, 'bar:1234', 'content', function() {
                    setTimeout(function() {
                        assertCachedNullValue(cache, 'bar:1234', done);
                    }, 1100);
                });
            });
        });
    });

    it('should set and get values from cache', function(done) {
        withCache({engine:'redis'}, function(err, cache) {
            cache.set('bar:123', {content:'content', headers:{'header':'1'}}, 1000, function(err) {
                expect(err).to.be(null);
                assertCachedValue(cache, 'bar:123', 'content', function() {
                    assertHeaderValue(cache, 'bar:123', 'header', '1', done);
                });
            });
        });
    });

    it('should bypass cache is redis is unavailable', function(done) {
        var cache = cacheFactory.getCache({engine:'redis', hostname: 'foobar.acuminous.co.uk'});
        cache.get('anything', function(err, data) {
            expect(err).to.be(undefined);
            expect(data).to.be(undefined);
            done();
        });
    });

    it('should parse url structures with host, port and db', function(done) {
        var cache = cacheFactory.getCache({engine:'redis', url: 'redis://localhost:6379?db=1'});
        cache.get('anything', function(err, data) {
            expect(err).to.be(undefined);
            expect(data).to.be(undefined);
            done();
        });
    });

    it('should parse url structures with host and port', function(done) {
        var cache = cacheFactory.getCache({engine:'redis', url: 'redis://localhost:6379'});
        cache.get('anything', function(err, data) {
            expect(err).to.be(undefined);
            expect(data).to.be(undefined);
            done();
        });
    });

    it('should parse url structures with host', function(done) {
        var cache = cacheFactory.getCache({engine:'redis', url: 'redis://localhost'});
        cache.get('anything', function(err, data) {
            expect(err).to.be(undefined);
            expect(data).to.be(undefined);
            done();
        });
    });

    it('should fail silently if redis connection terminates', function(done) {
        var cache = cacheFactory.getCache({engine:'redis', url: 'redis://localhost'});
        cache.set('bar:125', {content:'content', headers:{'header':'1'}}, 1000, function(err) {
            expect(err).to.be(undefined);
            cache._redisClient.quit();
            cache._redisClient.emit('error', {message:'Test Redis error message'});
            setTimeout(function() {
                cache.get('bar:125', function(err, data) {
                    expect(err).to.be(undefined);
                    expect(data).to.be(undefined);
                    cacheFactory.clearCacheInstances(); // Set back into good state
                    done();
                });
            }, 200);
        });
    });

    function withCache(config, next) {
        var cache = cacheFactory.getCache(config);
        cache.on('ready', function() {
            next(null, cache);
        });
    };

    function assertCachedValue(cache, key, expected, next) {
        cache.get(key, function(err, actual) {
            expect(err).to.be(null);
            expect(actual.content).to.be(expected);
            next();
        });
    }

    function assertCachedNullValue(cache, key, next) {
        cache.get(key, function(err, actual) {
            expect(err).to.be(null);
            expect(actual).to.be(null);
            next();
        });
    }

    function assertHeaderValue(cache, key, header, expected, next) {
        cache.get(key, function(err, actual) {
            expect(err).to.be(null);
            expect(actual.headers[header]).to.be(expected);
            next();
        });
    }


});
