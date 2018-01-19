var request = require('request');
var sf = require('sf');
var url = require('url');
var HTTPError = require('./http-error');
var utils = require('./utils');
var isCachingDisabled = utils.isCachingDisabled;
var filterHeaders = utils.filterHeaders;

function getReq(config) {
  var requestWithDefault = request.defaults(config.requestOpts);

  return function req (options, next) {
    var start = Date.now();

    // Defaults
    options.headers = options.headers || config.headers || {};
    options.timeout = options.hasOwnProperty('timeout') ? options.timeout : 5000;

    var content = '', inErrorState = false, res = {};

    var formatError = function (mess) {
      return sf('Service {url} responded with {errorMessage}', {
        url: options.url,
        errorMessage: mess
      });
    };
    if (options.url === 'cache') {
      return next(null, {content: 'No content in cache at key: ' + options.cacheKey, statusCode: 404});
    }

    if(!url.parse(options.url).protocol && options.url !== 'cache') {
      return next(new HTTPError(formatError('Invalid URL ' + options.url)));
    }

    options.headers.accept = options.headers.accept || 'text/html,application/xhtml+xml,application/xml,application/json';
    options.headers['user-agent'] = options.headers['user-agent'] || 'Reliable-Get-Request-Agent';

    requestWithDefault(options)
    .on('error', function (err) {
      inErrorState = true;
      next(new HTTPError(formatError(err.message)));
    })
    .on('data', function(data) {
      content += data.toString();
    })
    .on('response', function(response) {
      res = response;
      if(!isCachingDisabled(options, response)) {
        res.headers = filterHeaders(res.headers);
      } else if (!('cache-control' in res.headers)){
        res.headers['cache-control'] = 'private, s-maxage=0, no-cache, no-store, must-revalidate, max-age=0';
        res.headers.expires = '0';
        res.headers.pragma = 'no-cache';
      }
    })
    .on('end', function() {
      var err = null;
      res.content = content;
      res.timing = Date.now() - start;
      if(res.statusCode != 200) {
        err = new HTTPError(formatError('status code ' + res.statusCode), res.statusCode, res.headers)
      }
      next(err, res);
    });
  };
}

module.exports = getReq;
