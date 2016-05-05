'use strict';
var NOCache = require('memoize-cache/no-cache');
var Cache = require('memoize-cache/cache');
var cacheManager = require('cache-manager');
var redisStore = require('cache-manager-redis');
var utils = require('../utils');

function hasCacheControl(res, value) {
    return (res.headers['cache-control'] || '').indexOf(value) !== -1;
}

function getCacheKey(options) {
    if (options.explicitNoCache || options.cacheTTL === 0) {
      return null;
    }
    return options.cacheKey || utils.urlToCacheKey(options.url);      
}

function getCacheTTL(args, res) {
    var options = args[0];
    if (hasCacheControl(res, 'no-cache') || hasCacheControl(res, 'no-store')) {
        return 0;
    }
    if (hasCacheControl(res, 'max-age')) {
        return parseInt(res.headers['cache-control'].split('=')[1], 10) * 1000;
    }

    return options.hasOwnProperty('cacheTTL') ? options.cacheTTL : 60000;      
}

module.exports = function cacheFactory(config) {
    var cache;
    if (config.cache.engine === 'nocache') {
        return new NOCache();
    }
    cache = cacheManager.caching(config.cache);
    return new Cache(cache, getCacheKey, getCacheTTL);
};