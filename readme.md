Reliable HTTP get wrapper (with cache and serve stale on error), best wrapped around things you dont trust very much.

[![Build Status](https://travis-ci.org/tes/reliable-get.svg)](https://travis-ci.org/tes/reliable-get) ![Coverage Status](http://img.shields.io/badge/Coverage-100%25-green.svg)

Behaviour
=========
If reliable-get makes a request that times out or errors, its callback will receive *both* an error object and a previously cached response, if one is present in cache.
You can then decide whether to ignore the error and use the cached response, or not.

Basic usage
=============

```js
var ReliableGet = require('reliable-get');
var config = {
  cache:{
    engine:'memorycache'
  }
};
var rg = new ReliableGet(config);
rg.on('log', function(level, message, data) {
  // Wire up to your favourite logger
});
rg.on('stat', function(type, key, value) {
 // Wire up to your favourite stats library (e.g. statsd)
});
rg.get({url:'http://www.google.com'}, function(err, response) {
   console.log(response.content);
});
```

## Configuration options

When you create an instance of reliable-get you need to specify the cache configuration.  This then applies across all requests.

```js
var config = {
  cache:{
    engine:'redis',
    url:'redis://localhost:6379?db=0'
  }
};
```

You can also pass a property `requestOpts` to pass options to be used in [request](https://github.com/request/request). Example:

```js
var config = {
  cache: {
    engine: 'redis',
    url: 'redis://localhost:6379?db=0'
  },
  requestOpts: {
    forever: true,
    followRedirect: false
  }
}
```

Property|Description|Example / Default|Required
---------|----------|-------------|-------
cache.engine|Cache to use, redis/memcached/memorycache/nocache|nocache|No
cache.engine.url|URL to redis|localhost:6379|No
cache.compress|Use snappy compression|false|No
cache.namespace|Prefix for redis keys|''|No
cache.hosts|Array of host:port combinations for memcached|[]|No
cache.autodiscover|Use Elasticache Auto Discovery|false|No

## GET options

When making a get request, you need to provide a basic options object:

```js
rg.get({url:'http://www.google.com'}, function(err, response) {
   console.log(response.content);
});
```

Property|Description|Example / Default|Required
---------|----------|-------------|-------
url|Service to get|http://my-service.tes.co.uk|Yes
timeout|Timeout for service|5000|No
cacheKey|Key to store cached value against|my-service_tes_co_uk|No
tags|List of tags (surrogate keys)|[]|No
cacheTTL|TTL of cached value in ms|1 minute (60000)|No
explicitNoCache|Do not cache under any circumstances|false|No
headers|Headers to send with request||No
tracer|Unique value to pass with request||No
type|Type of request, used for statsd and logging||No
statsdKey|Key that statsd events will be posted to||No
eventHandler|Object (see below) for logging and stats||No

Example from a Compoxure backend request:

```js
var options = {
  url: targetUrl,
  cacheKey: targetCacheKey,
  cacheTTL: targetCacheTTL,
  timeout: utils.timeToMillis(backend.timeout || DEFAULT_LOW_TIMEOUT),
  headers: backendHeaders,
  tracer: req.tracer,
  statsdKey: 'backend_' + utils.urlToCacheKey(host)
};
```

From a compoxure fragment request:

```js
var options = {
  url: url,
  timeout: timeout,
  cacheKey: cacheKey,
  cacheTTL: cacheTTL,
  explicitNoCache: explicitNoCache,
  headers: optionsHeaders,
  tracer: req.tracer,
  statsdKey: statsdKey
};
```

The `options` object is fully passed down to the request.

## Response fields
The library will decorate with response with some useful keys that you may need to use, there are following:
- `stale` - is added to response when the request to origin failed and a stale cached version is returned instead
- `cached` - is `true` if there was a cache hit, otherwise `false`
- `realTiming` - show the time it took for the response to be returned

Tags
====
Some store (memorycache/redis) supports assigning one or more tags to a certain resource. They are used only if the resource is cached, to purge all cache entries with the same tag.

Configuration
=============

Cache configuration
-------------------
The cache object accept any config value accepted by redis. It also takes:
* config.cache.engine: nocache, memorycache, memcached, redis (use nocache/memorycache for testing only!)
* config.cache.url: redis dsn, it is translated to the connection parameters
* config.cache.compress: enable snappy compression on cached items
* config.cache.namespace: adds this string as a prefix to any key. Useful to share redis with other services or migrations
* config.cache.hosts: Memcached cluster nodes addresses as `<host>:<port>` combinartions in an array
* config.cache.autodiscover: enable AWS Elasticache Auto Discovery of Memcached cache cluster nodes

Request Configuration
---------------------
The "config.requestOpts" contains the default configuration passed to "request".
