'use strict';

var request = require('request');
var sf = require('sf');
var url = require('url');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var cacheFactory = require('./lib/cache/cacheFactory');

var getCacheDecorator = require('async-deco/callback/cache');
var getFallbackCacheDecorator = require('async-deco/callback/fallback-cache');
var getFallbackDecorator = require('async-deco/callback/fallback');
var getRetryDecorator = require('async-deco/callback/retry');
var getDedupeDecorator = require('async-deco/callback/dedupe');

var statusCodeToErrorLevelMap = {'3': 'info', '4': 'warn', '5': 'error' };


function ReliableGet(config) {

    config = config || {};

    var memoizeCache = cacheFactory(config);
    var cacheDecorator = getCacheDecorator(memoizeCache);
    
    config.requestOpts = config.requestOpts || { agent: false };
    config.requestOpts.followRedirect = config.requestOpts.followRedirect !== false; // make falsey values true

    // Backwards compatibility
    if (config.followRedirect === false) {
        config.requestOpts.followRedirect = false;
    }

    var requestWithDefault = request.defaults(config.requestOpts);

    var get = function (options, next) {
        var self = this,
            start = Date.now();

        // Defaults
        options.headers = options.headers || config.headers || {};
        options.timeout = options.hasOwnProperty('timeout') ? options.timeout : 5000;

        var content = '', inErrorState = false, res;

        function handleError(err, statusCode, headers) {
            if (!inErrorState) {
                inErrorState = true;
                var message = sf('Service {url} responded with {errorMessage}', {
                    url: options.url,
                    errorMessage: err.message
                });
                var statusGroup = '' + Math.floor(statusCode / 100);
                var errorLevel = statusCodeToErrorLevelMap[statusGroup] || 'error';
                var errorMessage = (errorLevel === 'error' ? 'FAIL ' + message : message);
                self.emit('log', errorLevel, errorMessage, {tracer:options.tracer, statusCode: statusCode, type:options.type});
                self.emit('stat', 'increment', options.statsdKey + '.requestError');
                next({statusCode: statusCode || 500, message: message, headers: headers});
            }
        }

        if(!url.parse(options.url).protocol && options.url !== 'cache') { return handleError({message:'Invalid URL ' + options.url}); }

        options.headers.accept = options.headers.accept || 'text/html,application/xhtml+xml,application/xml,application/json';
        options.headers['user-agent'] = options.headers['user-agent'] || 'Reliable-Get-Request-Agent';

        requestWithDefault({ url: options.url, timeout: options.timeout, headers: options.headers })
            .on('error', handleError)
            .on('data', function(data) {
                content += data.toString();
            })
            .on('response', function(response) {
                res = response;
                if(response.statusCode != 200) {
                    handleError({message:'status code ' + response.statusCode}, response.statusCode, response.headers);
                }
            })
            .on('end', function() {
                if(inErrorState) { return; }
                res.content = content;
                res.timing = Date.now() - start;
                next(null, res);
                self.emit('log', 'debug', 'OK ' + options.url, {tracer:options.tracer, responseTime: res.timing, type:options.type});
                self.emit('stat', 'timing', options.statsdKey + '.responseTime', res.timing);
            });
    };

    this.get = cacheDecorator(get);

    this.disconnect = function() {
        if(cache.disconnect) { cache.disconnect(); }
    }

}

util.inherits(ReliableGet, EventEmitter);

module.exports = ReliableGet;
