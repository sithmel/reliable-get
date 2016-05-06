'use strict';
var NOCache = require('memoize-cache/no-cache');
var Cache = require('memoize-cache/cache');
var cacheManager = require('cache-manager');
var redisStore = require('cache-manager-redis');
var getCacheKey = require('../utils').getCacheKey;

function hasCacheControl(res, value) {
    return (res.headers['cache-control'] || '').indexOf(value) !== -1;
}

function getCacheValidity(args, res) {
    var options = args[0];
    if (hasCacheControl(res, 'no-cache') || hasCacheControl(res, 'no-store')) {
        return 0;
    }
    if (hasCacheControl(res, 'max-age')) {
        return parseInt(res.headers['cache-control'].split('=')[1], 10);
    }

    return options.hasOwnProperty('cacheTTL') ? (options.cacheTTL/1000) : 60;      
}

function getCacheTTL(args, res) {
    return getCacheValidity(args, res) * 5;
}

module.exports = function cacheFactory(config) {
    var cache, CMConfig = {};
    if (config.cache.engine === 'nocache') {
        return new NOCache();
    }
    if (config.cache.engine === 'memorycache' ) {
        CMConfig.store = 'memory';
        CMConfig.ttl = 60;
    }
    else if (config.cache.engine === 'redis') {
        CMConfig.store = redisStore;
        CMConfig.ttl = 60;
    }
    cache = cacheManager.caching(CMConfig);
    return new Cache(cache, {key: getCacheKey, maxValidity: getCacheValidity, maxAge: getCacheTTL});
};