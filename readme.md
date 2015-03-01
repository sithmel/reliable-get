Reliable HTTP get wrapper (with cache and serve stale on error), best wrapped around things you dont trust very much.

[![Build Status](https://travis-ci.org/tes/reliable-get.svg)](https://travis-ci.org/tes/reliable-get) ![Coverage Status](http://img.shields.io/badge/Coverage-100%25-green.svg)

Basic usage
=============

```js
var ReliableGet = require('reliable-get');
var config = {
  cache:{
    engine:'memorycache'
  }
};
var rg = new ReliableGet();
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

Property|Description|Example / Default|Required
---------|----------|-------------|-------
cache.engine|Cache to use, redis/memorycache/nocache|nocache|No
cache.engine.url|URL to redis|localhost:6379|No

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
cacheTTL|TTL of cached value|1 minute|No
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
  }
```

