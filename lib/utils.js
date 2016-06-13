'use strict';

var _ = require('lodash');

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

function getCacheKey(options) {
    if (!isCached(options)) {
			return null;
		}
    return options.cacheKey || urlToCacheKey(options.url);
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

module.exports = {
  getCacheKey: getCacheKey,
	isCached: isCached,
	urlToCacheKey: urlToCacheKey,
	cacheKeytoStatsd: cacheKeytoStatsd,
  filterHeaders: filterHeaders
};
