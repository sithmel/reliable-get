'use strict';

var _ = require('lodash');
var url = require('url');
var keyGetter = require('memoize-cache-utils/key-getter');
var HTTPError = require('./http-error');

function cacheKeytoStatsd(key) {
  key = key.replace(/\./g,'_');
  key = key.replace(/-/g,'_');
  key = key.replace(/:/g,'_');
  key = key.replace(/\//g,'_');
  return key;
}

function isCachedByOptions(options) {
  return !options.explicitNoCache && options.cacheTTL !== 0 && !!options.cacheKey;
}

function hasCacheControl(res, value) {
  return (res.headers['cache-control'] || '').indexOf(value) !== -1;
}

function isCachingDisabled(options, res) {
  return !isCachedByOptions(options) || !res || hasCacheControl(res, 'no-cache') || hasCacheControl(res, 'no-store');
}

function getCacheKey(config) {
  var namespace = 'cache' in config ? (config.cache.namespace || '') : '';
  return keyGetter(function (options) {
    if (!isCachedByOptions(options)) {
      return null;
    }
    return options.cacheKey;
  }, namespace);
}

function getCacheValidity(args, res) {
  var options = args[0];
  if (options.url === 'cache') {
    return 0;
  }
  if (isCachingDisabled(options, res)) {
    return 0;
  }
  if (hasCacheControl(res, 'max-age')) {
    return parseInt(res.headers['cache-control'].split('=')[1], 10);
  }
  return options.hasOwnProperty('cacheTTL') ? (options.cacheTTL/1000) : 60;
}

function filterHeaders(h) {
  var blacklistedHeaders = ['set-cookie'];
  var filteredHeaders;
  if (h) {
    filteredHeaders = _.clone(h);
    blacklistedHeaders.forEach(function(item) {
      delete filteredHeaders[item];
    });
    return filteredHeaders;
  }
  else {
    return h;
  }
}

function getMemcachedConfig(config) {
  return { options: config };
}

function parseRedisConnectionString(connectionString) {
  var params = url.parse(connectionString, true);
  return {
    host: params.hostname,
    port: params.port && parseInt(params.port) || 6379,
    db: params.query.db && parseInt(params.query.db) || 0
  };
}

function getRedisConfig(config) {
  var redisConfig;
  if(config.url) {
    redisConfig = parseRedisConnectionString(config.url);
  } else {
    redisConfig = config;
  }
  redisConfig.options = redisConfig.options || {};
  return redisConfig;
}

function isError(err) {
  return !!err;
}

function shouldFallback(err) {
  if (!err || err instanceof HTTPError && err.statusCode < 500) {
    return false;
  }
  return true;
}

module.exports = {
  getCacheKey: getCacheKey,
  isCachingDisabled: isCachingDisabled,
  cacheKeytoStatsd: cacheKeytoStatsd,
  filterHeaders: filterHeaders,
  getMemcachedConfig: getMemcachedConfig,
  getRedisConfig: getRedisConfig,
  getCacheValidity: getCacheValidity,
  isError: isError,
  shouldFallback: shouldFallback
};
