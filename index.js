'use strict';

var request = require('request');
var sf = require('sf');
var url = require('url');
var util = require('util');
var utils = require('./lib/utils');
var EventEmitter = require('events').EventEmitter;
var CircuitBreaker = require('./lib/CircuitBreaker');
var CacheFactory = require('./lib/cache/cacheFactory');

function ReliableGet(config) {

    this.get = function(options, next) {

        var self = this,
            start = Date.now(),
            cache = CacheFactory.getCache(config.cache),
            hasCacheControl = function(res, value) {
                if (typeof value === 'undefined') { return res.headers['cache-control']; }
                return (res.headers['cache-control'] || '').indexOf(value) !== -1;
            };

        // Defaults
        options.headers = options.headers || config.headers || {};
        if(!options.cacheKey) { options.cacheKey = utils.urlToCacheKey(options.url); }

        var pipeAndCacheContent = function(cb) {

            var content = '', start = Date.now(), inErrorState = false, res;

            function handleError(err, statusCode) {
                if (!inErrorState) {
                    inErrorState = true;
                    var message = sf('Service {url} FAILED due to {errorMessage}', {
                        url: options.url,
                        errorMessage: err.message
                    });
                    self.emit('stat', 'error', 'FAIL ' + message, {tracer:options.tracer, statusCode: statusCode, type:options.type});
                    cb({statusCode: statusCode || 500, message: message});
                }
            }

            if(!url.parse(options.url).protocol) { return handleError({message:'Invalid URL ' + options.url}); }

            options.headers.accept = options.headers.accept || 'text/html,application/xhtml+xml,application/xml,application/json';
            options.headers['user-agent'] = 'Reliable-Get-Request-Agent';

            request({url: options.url, agent: false, timeout: options.timeout, headers: options.headers})
                .on('error', handleError)
                .on('data', function(data) {
                    content += data.toString();
                })
                .on('response', function(response) {
                    res = response;
                    if(response.statusCode != 200) {
                        handleError({message:'status code ' + response.statusCode}, response.statusCode);
                    }
                })
                .on('end', function() {
                    if(inErrorState) { return; }
                    res.content = content;
                    cb(null, res);
                    var timing = Date.now() - start;
                    self.emit('log', 'debug', 'OK ' + options.url, {tracer:options.tracer, responseTime: timing, type:options.type});
                    self.emit('stat', 'timing', options.statsdKey + '.responseTime', timing);
                });

        }

        if(!options.explicitNoCache && options.cacheTTL > 0) {

            cache.get(options.cacheKey, function(err, cacheData, oldCacheData) {

                if (err) { return next(err, {stale: oldCacheData}); }
                if (cacheData && cacheData.content) {
                    var timing = Date.now() - start;
                    self.emit('log','debug', 'CACHE HIT for key: ' + options.cacheKey,{tracer:options.tracer, responseTime: timing, type:options.type});
                    self.emit('stat', 'increment', options.statsdKey + '.cacheHit');
                    next(null, {statusCode: 200, content: cacheData.content, headers: cacheData.headers});
                    return;
                }

                self.emit('log', 'debug', 'CACHE MISS for key: ' + options.cacheKey,{tracer:options.tracer, type:options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheMiss');

                if(options.url == 'cache') {
                    next(null, {});
                    return;
                }

                new CircuitBreaker(self, options, config, pipeAndCacheContent, function(err, res) {

                    if (err) {
                        var staleContent = oldCacheData ? {stale: oldCacheData} : undefined;
                        return next(err, staleContent);
                    }

                    if (hasCacheControl(res, 'no-cache') || hasCacheControl(res, 'no-store')) {
                        next(null, {statusCode: 200, content: res.content, headers: res.headers});
                        return;
                    }
                    if (hasCacheControl(res, 'max-age')) {
                        options.cacheTTL = res.headers['cache-control'].split('=')[1] * 1000;
                    }

                    cache.set(options.cacheKey, {content: res.content, headers: res.headers}, options.cacheTTL, function() {
                        next(null, {statusCode: 200, content: res.content, headers:res.headers});
                        self.emit('log','debug', 'CACHE SET for key: ' + options.cacheKey + ' @ TTL: ' + options.cacheTTL,{tracer:options.tracer,type:options.type});
                    });

                });
            });

        } else {

            new CircuitBreaker(self, options, config, pipeAndCacheContent, function(err, res) {
                if (err) { return next(err); }
                res.headers['cache-control'] = 'no-store';
                next(null, {statusCode: res.statusCode, content: res.content, headers: res.headers});
            });

        }

    }

}

util.inherits(ReliableGet, EventEmitter);

module.exports = ReliableGet;
