'use strict';

var _ = require('lodash');
var url = require('url');
var keyGetter = require('memoize-cache-utils/key-getter');

function cacheKeytoStatsd(key) {
		key = key.replace(/\./g,'_');
		key = key.replace(/-/g,'_');
		key = key.replace(/:/g,'_');
		key = key.replace(/\//g,'_');
		return key;
}

function urlToCacheKey(url) {
		url = url.replace('http://','');
		url = cacheKeytoStatsd(url);
		return url;
}

function isCached(options) {
  	return !options.explicitNoCache && options.cacheTTL !== 0;
}

function getCacheKey(config) {
	var namespace = 'cache' in config ? (config.cache.namespace || '') : '';
	return keyGetter(function (options) {
		if (!isCached(options)) {
			return null;
		}
    return options.cacheKey || urlToCacheKey(options.url);
	}, namespace);
}

function hasCacheControl(res, value) {
    return (res.headers['cache-control'] || '').indexOf(value) !== -1;
}

function getCacheValidity(args, res) {
    var options = args[0];
    if (options.url === 'cache') {
        return 0;
    }
    if (hasCacheControl(res, 'no-cache') || hasCacheControl(res, 'no-store')) {
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
  	var tenSeconds = 10 * 1000;
		if(config.url) {
				redisConfig = parseRedisConnectionString(config.url);
		} else {
				redisConfig = config;
		}
		redisConfig.options = redisConfig.options || {};

		// Default redis client behaviour is to back off exponentially forever. Not very useful.
		redisConfig.options.retry_max_delay = redisConfig.options.retry_max_delay || tenSeconds;
    return redisConfig;
}

module.exports = {
  getCacheKey: getCacheKey,
	isCached: isCached,
	urlToCacheKey: urlToCacheKey,
	cacheKeytoStatsd: cacheKeytoStatsd,
  filterHeaders: filterHeaders,
	getRedisConfig: getRedisConfig,
	getCacheValidity: getCacheValidity
};
