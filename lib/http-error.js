// Create a new object, that prototypally inherits from the Error constructor
function HTTPError(message, status, headers) {
  this.name = 'HTTPError';
  this.message = message || 'HTTP Error';
  this.statusCode = status || 500;
  this.headers = headers || {};
  this.stack = (new Error()).stack;
}
HTTPError.prototype = Object.create(Error.prototype);
HTTPError.prototype.constructor = HTTPError;

module.exports = HTTPError;