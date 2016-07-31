
/**
 * Simple API exposed (if configured and cache is Redis) that allows
 * addition and deletion of content into the compoxure cache
 */

var _ = require('lodash');
var connectRoute = require('connect-route');
var cacheManager = require('cache-manager');
var redisStore = require('cache-manager-redis');
var utils = require('../utils');
var getRedisConfig = utils.getRedisConfig;

module.exports = function(config) {

  var cache;

  var endError = function(res, statusCode, message) {
      res.writeHead(statusCode, {'Content-Type': 'text/html'});
      res.end(message || 'Error');
  }

  var endSuccess = function(res, message) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(message || 'OK');
  }

  var getCacheKey = function(namespace) {
    return function(req, res) {
      var key = decodeURIComponent(req.params.key);
      if(!key) {
        endError(res, 500, 'No key provided');
      } else {
        cache.get(namespace + key, function(err, data) {
          if(err) { return endError(res, 500, err.message); }
          if(!data) { return endError(res, 404, 'No data at key: ' + key); }
          endSuccess(res, JSON.stringify(data));
        });
      }
    };
  };

  // var postCacheKey = function(namespace) {
  //   return function(req, res) {
  //     var key = decodeURIComponent(req.params.key);
  //     var bodyParser = require('body-parser').json();
  //     bodyParser(req, res, function() {
  //       var cacheJson = req.body;
  //       if(!cacheJson.content) { return endError(res, 500, 'You must provide content.'); }
  //       if(!cacheJson.expires) { return endError(res, 500, 'You must provide an expires timestamp.'); }
  //       if(!cacheJson.ttl) { cacheJson.ttl = 0; } // ???
  //       cache.set(namespace + key, cacheJson, function(err) {
  //         if(err) { return endError(res, 500, err.message); }
  //         endSuccess(res, 'Key ' + key + ' set.' )
  //       })
  //     });
  //   };
  // };

  var deleteCacheKey = function(namespace) {
    return function(req, res) {
      var key = decodeURIComponent(req.params.key);
      if(!key) {
        endError(res, 500, 'No key provided');
      } else {
        cache.del(namespace + key, function(err) {
          if(err) { return endError(res, 500, err.message); }
          return endSuccess(res, 'Key ' + key + ' deleted.');
        });
      }
    };
  };

  if(config.cache && config.cache.engine === 'redis' && config.cache.apiEnabled) {
    var CMConfig = {};

    var params = getRedisConfig(config.cache);
    CMConfig.store = redisStore;
    CMConfig.ttl = 60;
    _.assign(CMConfig, params);

    cache = cacheManager.caching(CMConfig);

    var namespace = config.cache.namespace || '';

    return connectRoute(function (router) {
      router.get('/api/cache/:key', getCacheKey(namespace));
//      router.post('/api/cache/:key', postCacheKey(namespace));
      router.delete('/api/cache/:key', deleteCacheKey(namespace));
    });
  } else {
    return function(req, res, next) { next(); }
  }
}
