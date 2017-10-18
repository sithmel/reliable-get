
/**
* Simple API exposed (if configured and cache is Redis) that allows
* addition and deletion of content into the compoxure cache
*/

var connectRoute = require('connect-route');
var cacheFactory = require('./cacheFactory');


module.exports = function(config) {

  var cache = cacheFactory(config);

  var endError = function(res, statusCode, message) {
    res.writeHead(statusCode, {'Content-Type': 'text/html'});
    res.end(message || 'Error');
  }

  var endSuccess = function(res, message) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(message || 'OK');
  }

  function getCacheKey(req, res) {
    var key = decodeURIComponent(req.params.key);
    if(!key) {
      endError(res, 500, 'No key provided');
    } else {
      cache._get(key, function(err, data) {
        if(err) { return endError(res, 500, err.message); }
        if(!data) { return endError(res, 404, 'No data at key: ' + key); }
        endSuccess(res, JSON.stringify(data));
      });
    }
  }

  function postCacheKey(req, res) {
    var key = decodeURIComponent(req.params.key);
    var bodyParser = require('body-parser').json();
    bodyParser(req, res, function() {
      var json = req.body;
      if(!json.content) { return endError(res, 500, 'You must provide content.'); }
      if(!json.maxAge) { return endError(res, 500, 'You must provide an expires timestamp.'); }
      if(!json.tags) { json.tags = []; }
      cache._set({key: key, tags: json.tags}, json.content, parseInt(json.maxAge), function(err) {
        if(err) { return endError(res, 500, err.message); }
        endSuccess(res, 'Key ' + key + ' set.' )
      })
    });
  }

  function deleteCacheKey(req, res) {
    var key = decodeURIComponent(req.params.key);
    if(!key) {
      endError(res, 500, 'No key provided');
    } else {
      cache.purgeByKeys(key, function(err) {
        if(err) { return endError(res, 500, err.message); }
        return endSuccess(res, 'Key ' + key + ' deleted.');
      });
    }
  }

  function deleteCacheTags(req, res) {
    var key = decodeURIComponent(req.params.key);
    if(!key) {
      endError(res, 500, 'No key provided');
    } else {
      cache.purgeByTags(key, function(err) {
        if(err) { return endError(res, 500, err.message); }
        return endSuccess(res, 'Tags ' + key + ' deleted.');
      });
    }
  }

  return connectRoute(function (router) {
    router.get('/api/cache/:key', getCacheKey);
    router.post('/api/cache/:key', postCacheKey);
    router.delete('/api/cache/tags/:key', deleteCacheTags);
    router.delete('/api/cache/:key', deleteCacheKey);
  });
}
