'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var compose = require('async-deco/utils/compose');
var getCacheDecorator = require('async-deco/callback/cache');
var getFallbackCacheDecorator = require('async-deco/callback/fallback-cache');
var getDedupeDecorator = require('async-deco/callback/dedupe');
var getLogDecorator = require('async-deco/callback/log');
var addLogger = require('async-deco/utils/add-logger');
var sanitizeAsyncFunction = require('async-deco/utils/sanitizeAsyncFunction');

var cacheFactory = require('./lib/cache/cacheFactory');
var getCacheKey = require('./lib/utils').getCacheKey;
var getRequest = require('./lib/getRequest');

var statusCodeToErrorLevelMap = {'3': 'info', '4': 'warn', '5': 'error' };

function ReliableGet(config) {
    config = config || {};

    var cache = cacheFactory(config);
    var cacheDecorator = getCacheDecorator(cache);
    var fallbackDecorator = getFallbackCacheDecorator(cache, {noPush: true, useStale: true});
    var dedupeDecorator = getDedupeDecorator(getCacheKey(config));

    config.requestOpts = config.requestOpts || { agent: false };
    config.requestOpts.followRedirect = config.requestOpts.followRedirect !== false; // make falsey values true

    // Backwards compatibility
    if (config.followRedirect === false) {
        config.requestOpts.followRedirect = false;
    }

    var req = getRequest(config);

    this.get = function (options, next) {
        var self = this;
        var cacheError = false;
        var fallbackCacheHit = false;
        var fallbackCacheStale = false;
        var error;

        var realTimingStart, realTimingEnd;
        var logDecorator = getLogDecorator();
        var logger = addLogger(function (evt, payload, ts) {
            var result, err, statusGroup, errorLevel, errorMessage;
            if (evt === 'cache-error') {
                cacheError = true;
            }
            else if (evt === 'log-start') {
                realTimingStart = ts;
            }
            else if (evt === 'log-end') {
                realTimingEnd = ts;
                result = payload.result;
                self.emit('log', 'debug', 'OK ' + options.url, {tracer:options.tracer, responseTime: realTimingEnd - realTimingStart, type:options.type});
                self.emit('stat', 'timing', options.statsdKey + '.responseTime', realTimingEnd - realTimingStart);
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
                self.emit('log','debug', 'CACHE HIT for key: ' + payload.key, {tracer:options.tracer, responseTime: payload.timing, type: options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheHit');
            }
            else if (evt === 'cache-miss') {
                self.emit('log', 'debug', 'CACHE MISS for key: ' + payload.key, {tracer:options.tracer, type: options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheMiss');
            }
            else if (evt === 'cache-set') {
                self.emit('log','debug', 'CACHE SET for key: ' + payload.key + ' @ TTL: ' + options.cacheTTL, {tracer:options.tracer,type: options.type});
            }
            else if (evt === 'fallback-cache-hit') {
                fallbackCacheStale = payload.result.stale;
                fallbackCacheHit = true;
                error = payload.actualResult.err;
                self.emit('log', 'debug', 'Serving stale cache for key: ' + payload.key, {tracer: options.tracer, type: options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheStale');
            }
            else if (evt === 'fallback-cache-miss') {
                self.emit('log', 'warn', 'Error and no stale cache available for key: ' + payload.key, {tracer: options.tracer, type: options.type});
                self.emit('stat', 'increment', options.statsdKey + '.cacheNoStale');
            }
            else if (evt === 'dedupe-queue') {
                self.emit('log', 'debug', 'Deduped: ' + payload.key, {tracer: options.tracer, type: options.type});
                self.emit('stat', 'increment', options.statsdKey + '.dedupe-queue');
            }
        });

        var decorator = compose([
            logger,
            logDecorator,
            fallbackDecorator,
            cacheDecorator,
            dedupeDecorator,
            sanitizeAsyncFunction
        ]);

        return decorator(req)(options, function (err, res) {
            if (res) {
                if (fallbackCacheHit && fallbackCacheStale) {
                    err = error;
                    res.stale = true;
                }
                if (cacheError) {
                    res.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
                }

                res.realTiming = realTimingEnd - realTimingStart;
            }
            next(err, res);
        });
    }
}

util.inherits(ReliableGet, EventEmitter);

module.exports = ReliableGet;
