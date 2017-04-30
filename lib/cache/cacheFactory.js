'use strict';
var _ = require('lodash');
var NOCache = require('memoize-cache/no-cache');
var Cache = require('memoize-cache/cache');
var cacheManager = require('cache-manager');
var memcachedStore = require('cache-manager-memcached-store');
var redisStore = require('cache-manager-redis');
var utils = require('../utils');
var getCacheKey = utils.getCacheKey;
var getMemcachedConfig = utils.getMemcachedConfig;
var getRedisConfig = utils.getRedisConfig;

var cleanupPeriod = 60 * 60 * 24; // 1 day
function getCacheTTL(args, res) {
    return utils.getCacheValidity(args, res) ? cleanupPeriod : 0;
}

function serialize(res) {
  return {
      content: res.content,
      headers: JSON.stringify(res.headers || {}),
      options: JSON.stringify(res.options || {})
  };
}

function deserialize(data) {
  return {
      statusCode: 200,
      content: data.content,
      headers: JSON.parse(data.headers),
      options: JSON.parse(data.options)
  };
}

module.exports = function cacheFactory(config) {
    var cache, CMConfig = {}, params;

    if (config.cache.engine === 'nocache') {
        return new NOCache({key: getCacheKey(config)});
    }
    if (config.cache.engine === 'memorycache' ) {
        CMConfig.store = 'memory';
        CMConfig.ttl = 60;
    }
    else if (config.cache.engine === 'memcached') {
        params = getMemcachedConfig(config.cache);
        CMConfig.store = memcachedStore;
        CMConfig.ttl = 60;
        _.assign(CMConfig, params);
    }
    else if (config.cache.engine === 'redis') {
        params = getRedisConfig(config.cache);
        CMConfig.store = redisStore;
        CMConfig.ttl = 60;
        _.assign(CMConfig, params);
    }
    cache = cacheManager.caching(CMConfig);
    return new Cache(cache, {
      key: getCacheKey(config),
      maxValidity: utils.getCacheValidity,
      maxAge: getCacheTTL,
      serialize: serialize,
      deserialize: deserialize,
      compress: !!config.cache.compress
    });
};
