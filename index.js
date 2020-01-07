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
var utils = require('./lib/utils');
var getRequest = require('./lib/getRequest');

var statusCodeToErrorLevelMap = {'3': 'info', '4': 'warn', '5': 'error' };

function ReliableGet(config) {
  config = config || {};

  var cache = cacheFactory(config);
  var cacheDecorator = getCacheDecorator(cache, { error: utils.isError });
  var fallbackDecorator = getFallbackCacheDecorator(cache, {noPush: true, useStale: true, error: utils.shouldFallback});
  var dedupeDecorator = getDedupeDecorator(utils.getCacheKey(config));

  config.requestOpts = config.requestOpts || { agent: false };
  config.requestOpts.gzip = true;
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
    var deduped = false;
    var cached = false;
    var error;
    var onLog = options.onLog || function () {};
    var realTimingStart, realTimingEnd;
    var outerLogDecorator = getLogDecorator();
    var innerLogDecorator = getLogDecorator('request-');
    var initialTime;
    var logger = addLogger(function (evt, payload, ts) {
      var result, err, statusGroup, errorLevel, errorMessage, tagsLog;
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
        self.emit('stat', 'timing', options.statsdKey + '.responseTime', options.statsdTags, realTimingEnd - realTimingStart);
      }
      else if (evt === 'log-error') {
        err = payload.err;
        statusGroup = '' + Math.floor(err.statusCode / 100);
        errorLevel = statusCodeToErrorLevelMap[statusGroup] || 'error';
        errorMessage = (errorLevel === 'error' ? 'FAIL ' + err.message + ' URL: ' + options.url: err.message);
        self.emit('log', errorLevel, errorMessage, {tracer:options.tracer, statusCode: err.statusCode, type:options.type});
        self.emit('stat', 'increment', options.statsdKey + '.requestError', options.statsdTags);
      }
      else if (evt === 'cache-hit') {
        result = payload.result.hit;
        cached = true;
        self.emit('log','debug', 'CACHE HIT for key: ' + payload.key, {tracer:options.tracer, responseTime: payload.timing, type: options.type});
        self.emit('stat', 'increment', options.statsdKey + '.cacheHit', options.statsdTags);
      }
      else if (evt === 'cache-miss') {
        self.emit('log', 'debug', 'CACHE MISS for key: ' + payload.key, {tracer:options.tracer, type: options.type});
        self.emit('stat', 'increment', options.statsdKey + '.cacheMiss', options.statsdTags);
      }
      else if (evt === 'cache-set') {
        tagsLog = 'tags' in payload && Array.isArray(payload.tags) && payload.tags.length > 0 ? ' (tags: ' + payload.tags.join(', ') + ')' : '';
        self.emit('log','debug', 'CACHE SET for key: ' + payload.key + tagsLog + ' @ TTL: ' + utils.getCacheValidity(payload.args, payload.res),
        { tracer:options.tracer,type: options.type });
      }
      else if (evt === 'fallback-cache-hit') {
        fallbackCacheStale = payload.result.stale;
        fallbackCacheHit = true;
        error = payload.actualResult.err;
        self.emit('log', 'debug', 'Serving stale cache for key: ' + payload.key, {tracer: options.tracer, type: options.type});
        self.emit('stat', 'increment', options.statsdKey + '.cacheStale', options.statsdTags);
      }
      else if (evt === 'fallback-cache-miss') {
        self.emit('log', 'warn', 'Error and no stale cache available for key: ' + payload.key, {tracer: options.tracer, type: options.type});
        self.emit('stat', 'increment', options.statsdKey + '.cacheNoStale', options.statsdTags);
      }
      else if (evt === 'dedupe-queue') {
        deduped = true;
        self.emit('log', 'debug', 'Deduped: ' + payload.key, {tracer: options.tracer, type: options.type});
        self.emit('stat', 'increment', options.statsdKey + '.dedupe-queue', options.statsdTags);
      }
      initialTime = initialTime || ts;
      onLog(evt, payload, ts - initialTime);
    });

    var decorator = compose([
      logger,
      outerLogDecorator, // this logs begin and and of the whole thing
      fallbackDecorator, // fallback on stale cache
      cacheDecorator, // cache
      dedupeDecorator, // dedupe: let another function, calling the callback of this
      innerLogDecorator, // this logs begin and and of the request
      sanitizeAsyncFunction // prevent double callback and other issues tricky to debug
    ]);

    return decorator(req)(options, function (err, res) {
      if (res) {
        if (fallbackCacheHit && fallbackCacheStale) {
          err = error;
          res.stale = true;
        }
        if (cacheError) {
          res.headers['cache-control'] = 'private, s-maxage=0, no-cache, no-store, must-revalidate, max-age=0';
          res.headers.expires = '0';
          res.headers.pragma = 'no-cache';
        }
        res.cached = cached;
        res.deduped = deduped;
        res.realTiming = realTimingEnd - realTimingStart;
      }
      next(err, res);
    });
  }
}

util.inherits(ReliableGet, EventEmitter);

module.exports = ReliableGet;
