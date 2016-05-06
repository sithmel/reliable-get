'use strict';

var url = require('url');

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

function parseRedisConnectionString(connectionString) {
    var params = url.parse(connectionString, true);
    return {
        host: params.hostname,
        port: params.port && parseInt(params.port) || 6379,
        db: params.query.db && parseInt(params.query.db) || 0
    };
}

function getCacheKey(options) {
    if (options.explicitNoCache || options.cacheTTL === 0) {
      return null;
    }
    return options.cacheKey || urlToCacheKey(options.url);      
}

module.exports = {
  getCacheKey: getCacheKey,
	urlToCacheKey: urlToCacheKey,
	cacheKeytoStatsd: cacheKeytoStatsd,
	parseRedisConnectionString: parseRedisConnectionString
};
