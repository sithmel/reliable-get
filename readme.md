Reliable HTTP get wrapper (cache and circuit breaker), best wrapped around things you dont trust very much.

[![Build Status](https://travis-ci.org/tes/reliable-get.svg)](https://travis-ci.org/tes/reliable-get) http://img.shields.io/badge/Coverage-100%25-green.svg

Example options from Compoxure backend request:

```
var options = {
          url: targetUrl,
          cacheKey: targetCacheKey,
          cacheTTL: targetCacheTTL,
          timeout: utils.timeToMillis(backend.timeout || DEFAULT_LOW_TIMEOUT),
          headers: backendHeaders,
          tracer: req.tracer,
          statsdKey: 'backend_' + utils.urlToCacheKey(host),
          eventHandler: eventHandler
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
      statsdKey: statsdKey,
      eventHandler: eventHandler
  }
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

Event Handler
=============

To allow Reliable Get to report back on status, at the moment we require you to pass in a simple object:

```
var eventHandler = {
  logger: function(level, message, data) {},
  stats: function(type, key, value) {}
}
```

This will likely get replaced with a more standard EventEmitter at some point when we get around to it (this is a legacy of the extraction of this code from another project for now).

