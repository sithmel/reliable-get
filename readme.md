Reliable HTTP get wrapper (cache and circuit breaker), best wrapped around things you dont trust very much.

[![Build Status](https://travis-ci.org/tes/reliable-get.svg)](https://travis-ci.org/tes/reliable-get) ![Coverage Status](http://img.shields.io/badge/Coverage-100%25-green.svg)

Basic usage
=============

```
var ReliableGet = require('reliable-get');
var config = {
  cache:{
    engine:'memorycache'
  },
  circuitbreaker:{
    includePath: true
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

When you create an instance of reliable-get you need to specify the cache and circuit breaker behaviour.  This then applies across all requests.

```
var config = {
  cache:{
    engine:'redis',
    url:'redis://localhost:6379?db=0'
  },
  circuitbreaker:{
    windowDuration:5000,
    numBuckets: 5,
    errorThreshold: 20,
    volumeThreshold: 3,
    includePath: true
  }
};
```

Property|Description|Example / Default|Required
---------|----------|-------------|-------
cache.engine|Cache to use, redis/memorycache/nocache|nocache|No
cache.engine.url|URL to redis|localhost:6379|No
circuitbreaker.windowDuration|Window duration to collect errors over|10000|No
circuitbreaker.numBuckets|Number of segments within window|10|No
circuitbreaker.errorThreshold|Percentage of buckets in error before CB opens|50|No
circuitbreaker.volumeThreshold|Number of errored requests before CB opens|10|No

To disable the circuit breaker, simply delete the circuitbreaker configuration.

## GET options

When making a get request, you need to provide a basic options object:

```
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

Example from Compoxure backend request:

```
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

From compoxure fragment request:

```
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

