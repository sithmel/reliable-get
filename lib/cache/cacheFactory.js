'use strict';
var _ = require('lodash');
var NOCache = require('memoize-cache/no-cache');

var Cache = require('memoize-cache-manager');
var RamCache = require('memoize-cache/cache-ram');
var RedisCache = require('memoize-cache-redis');

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


function setupCacheManager(config) {
  var cache, CMConfig = {}, params;

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
  return new Cache({
    cacheManager: cache,
    key: getCacheKey(config),
    maxValidity: utils.getCacheValidity,
    maxAge: getCacheTTL,
    serialize: serialize,
    deserialize: deserialize,
    compress: !!config.cache.compress
  });
}

function getTags(options) {
  return options.tags;
}

function setupRedisCache(config) {
  var redisConfig = _.assign({}, config.cache);

  return new RedisCache({
    redisOpts: redisConfig,
    onReady: config.onReady,
    onError: config.onError,
    key: getCacheKey(config),
    tags: getTags,
    maxValidity: utils.getCacheValidity,
    maxAge: getCacheTTL,
    serialize: serialize,
    deserialize: deserialize,
    compress: !!config.cache.compress
  });
}

function setupRamCache(config) {
  return new RamCache({
    key: getCacheKey(config),
    tags: getTags,
    maxValidity: utils.getCacheValidity,
    maxAge: getCacheTTL,
    serialize: serialize,
    deserialize: deserialize,
  });
}

var cacheEngines = {
  nocache: function (config) { return new NOCache({key: getCacheKey(config)}); },
  cm_memorycache: setupCacheManager,
  memorycache: setupRamCache,

  cm_memcached: setupCacheManager,
  memcached: setupCacheManager,

  cm_redis: setupCacheManager,
  redis: setupRedisCache,
};

module.exports = function cacheFactory(config) {
  if (!(config.cache.engine in cacheEngines)) {
    throw new Error('No cache engine: ' + config.cache.engine);
  }
  return cacheEngines[config.cache.engine](config);
};
