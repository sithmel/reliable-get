'use strict';

var request = require('request');
var sf = require('sf');
var url = require('url');
var CircuitBreaker = require('./lib/CircuitBreaker');
var CacheFactory = require('./lib/cache/cacheFactory');

function createClient(config) {

    var cache = CacheFactory.getCache(config.cache),
        eventHandler = config.eventHandler || {
            logger: function() {},
            stats: function() {}
        };

    return function(options, next) {

        var start = Date.now(), hasCacheControl = function(res, value) {
            if (typeof value === 'undefined') { return res.headers['cache-control']; }
            return (res.headers['cache-control'] || '').indexOf(value) !== -1;
        };

        options.headers = options.headers || config.headers || {};

        function pipeAndCacheContent(next) {

            var content = '', start = Date.now(), inErrorState = false, res;

            function handleError(err, statusCode) {
                if (!inErrorState) {
                    inErrorState = true;
                    var message = sf('Service {url} FAILED due to {errorMessage}', {
                        url: options.url,
                        errorMessage: err.message
                    });
                    next({statusCode: statusCode, message: message});
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
                    next(null, res);
                    var timing = Date.now() - start;
                    eventHandler.logger('debug', 'OK ' + options.url,{tracer:options.tracer, responseTime: timing, pcType:options.type});
                    eventHandler.stats('timing', options.statsdKey + '.responseTime', timing);
                });

        }

        if(!options.explicitNoCache && options.cacheTTL > 0) {

            cache.get(options.cacheKey, function(err, cacheData, oldCacheData) {

                if (err) { return next(err, {stale: oldCacheData}); }
                if (cacheData && cacheData.content) {
                    var timing = Date.now() - start;
                    eventHandler.logger('debug', 'CACHE HIT for key: ' + options.cacheKey,{tracer:options.tracer, responseTime: timing, pcType:options.type});
                    eventHandler.stats('increment', options.statsdKey + '.cacheHit');
                    next(null, {content: cacheData.content, headers: cacheData.headers});
                    return;
                }

                eventHandler.logger('debug', 'CACHE MISS for key: ' + options.cacheKey,{tracer:options.tracer,pcType:options.type});
                eventHandler.stats('increment', options.statsdKey + '.cacheMiss');

                if(options.url == 'cache') {
                    next(null, {});
                    return;
                }

                new CircuitBreaker(options, config, eventHandler, pipeAndCacheContent, function(err, res) {

                    if (err) {
                        var staleContent = oldCacheData ? {stale: oldCacheData} : undefined;
                        return next(err, staleContent);
                    }

                    if (hasCacheControl(res, 'no-cache') || hasCacheControl(res, 'no-store')) {
                        next(null, {content: res.content, headers: res.headers});
                        return;
                    }
                    if (hasCacheControl(res, 'max-age')) {
                        options.cacheTTL = res.headers['cache-control'].split('=')[1] * 1000;
                    }

                    next(null, {content: res.content, headers:res.headers});

                    cache.set(options.cacheKey, {content: res.content, headers: res.headers}, options.cacheTTL, function() {
                        eventHandler.logger('debug', 'CACHE SET for key: ' + options.cacheKey + ' @ TTL: ' + options.cacheTTL,{tracer:options.tracer,pcType:options.type});
                    });

                });
            });

        } else {

            new CircuitBreaker(options, config, eventHandler, pipeAndCacheContent, function(err, res) {
                if (err) { return next(err); }
                res.headers['cache-control'] = 'no-store';
                next(null, {content: res.content, headers: res.headers});
            });

        }
    }

}

module.exports = createClient;
