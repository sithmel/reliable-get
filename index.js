'use strict';

var request = require('request');
var sf = require('sf');
var url = require('url');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var cacheFactory = require('./lib/cache/cacheFactory');
var getCacheKey = require('./lib/utils').getCacheKey;
var HTTPError = require('./lib/http-error');

var compose = require('async-deco/utils/compose');
var getCacheDecorator = require('async-deco/callback/cache');
var getFallbackCacheDecorator = require('async-deco/callback/fallback-cache');
var getDedupeDecorator = require('async-deco/callback/dedupe');
var getLogDecorator = require('async-deco/callback/log');
var sanitizeAsyncFunction = require('async-deco/utils/sanitizeAsyncFunction');

var statusCodeToErrorLevelMap = {'3': 'info', '4': 'warn', '5': 'error' };

function ReliableGet(config) {
    config = config || {};

    var cache = cacheFactory(config);

    var cacheDecorator = getCacheDecorator(cache);
    var fallbackDecorator = getFallbackCacheDecorator(cache, {noPush: true, useStale: true});
    var dedupeDecorator = getDedupeDecorator(getCacheKey);

    config.requestOpts = config.requestOpts || { agent: false };
    config.requestOpts.followRedirect = config.requestOpts.followRedirect !== false; // make falsey values true

    // Backwards compatibility
    if (config.followRedirect === false) {
        config.requestOpts.followRedirect = false;
    }

    var requestWithDefault = request.defaults(config.requestOpts);

    var getReq = function (options, next) {
        var start = Date.now();

        // Defaults
        options.headers = options.headers || config.headers || {};
        options.timeout = options.hasOwnProperty('timeout') ? options.timeout : 5000;

        var content = '', inErrorState = false, res;

        var formatError = function (mess) {
            return sf('Service {url} responded with {errorMessage}', {
                url: options.url,
                errorMessage: mess
            });
        };
        if (options.url === 'cache') {
          return next(null, {content: 'No content in cache at key: ' + options.cacheKey, statusCode: 404});
        }
        if(!url.parse(options.url).protocol && options.url !== 'cache') {
            return next(new HTTPError(formatError('Invalid URL ' + options.url)));
        }

        options.headers.accept = options.headers.accept || 'text/html,application/xhtml+xml,application/xml,application/json';
        options.headers['user-agent'] = options.headers['user-agent'] || 'Reliable-Get-Request-Agent';

        requestWithDefault({ url: options.url, timeout: options.timeout, headers: options.headers })
            .on('error', function (err) {
                inErrorState = true;
                next(new HTTPError(formatError(err.message)));
            })
            .on('data', function(data) {
                content += data.toString();
            })
            .on('response', function(response) {
                res = response;
                if(response.statusCode != 200) {
                    inErrorState = true;
                    next(new HTTPError(formatError('status code ' + response.statusCode), response.statusCode, response.headers));
                }
            })
            .on('end', function() {
                if(inErrorState) { return; }
                res.content = content;
                res.timing = Date.now() - start;
                next(null, res);
            });
    };

    this.get = function (options, next) {
        var self = this;
        var cacheError = false;
        //var cacheHit = false;
        var fallbackCacheHit = false;
        var fallbackCacheStale = false;
        var error;
        var result, err, statusGroup, errorLevel, errorMessage;

        var logDecorator = getLogDecorator(function (name, id, ts, evt, payload) {
            //console.log(name, id, ts, evt)
            if (evt === 'cache-error') {
                console.log('cache error', payload.cacheErr)
                cacheError = true;
            }
            else if (evt === 'log-end') {
                result = payload.result;
                self.emit('log', 'debug', 'OK ' + options.url, {tracer:options.tracer, responseTime: result.timing, type:options.type});
                self.emit('stat', 'timing', options.statsdKey + '.responseTime', result.timing);
            }
            else if (evt === 'log-error') {
                err = payload.err;
                statusGroup = '' + Math.floor(err.statusCode / 100);
                errorLevel = statusCodeToErrorLevelMap[statusGroup] || 'error';
                errorMessage = (errorLevel === 'error' ? 'FAIL ' + err.message : err.message);
                self.emit('log', errorLevel, errorMessage, {tracer:options.tracer, statusCode: err.statusCode, type:options.type});
                self.emit('stat', 'increment', options.statsdKey + '.requestError');
            }
            else if (evt === 'cache-hit') {
                result = payload.result.hit;
                self.emit('log','debug', 'CACHE HIT for key: ' + options.cacheKey,{tracer:options.tracer, responseTime: result.timing, type:options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheHit');
            }
            else if (evt === 'cache-miss') {
                self.emit('log', 'debug', 'CACHE MISS for key: ' + options.cacheKey,{tracer:options.tracer, type:options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheMiss');
            }
            else if (evt === 'cache-set') {
                self.emit('log','debug', 'CACHE SET for key: ' + options.cacheKey + ' @ TTL: ' + options.cacheTTL,{tracer:options.tracer,type:options.type});
            }
            else if (evt === 'fallback-cache-hit') {
                fallbackCacheStale = payload.result.stale;
                fallbackCacheHit = true;
                error = payload.actualResult.err;
                self.emit('log', 'debug', 'Serving stale cache for key: ' + options.cacheKey, {tracer: options.tracer, type: options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheStale');
            }
            else if (evt === 'fallback-cache-miss') {
                self.emit('log', 'warn', 'Error and no stale cache available for key: ' + options.cacheKey, {tracer: options.tracer, type: options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheNoStale');
            }
        });

        var decorator = compose([
          logDecorator,
          fallbackDecorator,
          cacheDecorator,
          dedupeDecorator,
          sanitizeAsyncFunction
        ]);

        return decorator(getReq)(options, function (err, res) {
//            console.log('res', res.content)
            if (res) {
                if (fallbackCacheHit && fallbackCacheStale) {
                    err = error;
                    res.stale = true;
                }
                if(cacheError) {
                    res.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
                }
            }
            next(err, res);
        });
    }
    // this.disconnect = function() {
    //     if(cache.disconnect) { cache.disconnect(); }
    // }

}

util.inherits(ReliableGet, EventEmitter);

module.exports = ReliableGet;
