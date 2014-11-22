Reliable HTTP get wrapper (cache and circuit breaker), best wrapped around things you dont trust very much.

[![Build Status](https://travis-ci.org/tes/reliable-get.svg)](https://travis-ci.org/tes/reliable-get)

Example options from Compoxure backend request:

```
var options = {
          url: targetUrl,
          cacheKey: targetCacheKey,
          cacheTTL: targetCacheTTL,
          timeout: utils.timeToMillis(backend.timeout || DEFAULT_LOW_TIMEOUT),
          headers: backendHeaders,
          tracer: req.tracer,
          type: 'backend',
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
      cache: cacheTTL > 0,
      ignore404: ignore404,
      type: 'fragment',
      headers: optionsHeaders,
      tracer: req.tracer,
      statsdKey: statsdKey
  }
```

|Property|Description|Example Value|
------------------------------------
|url|Service to get|http://my-service.tes.co.uk|
