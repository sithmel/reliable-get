/**
 * Stub server for performance and soak testing
 */
var stubServer = require('../tests/stub/server');
stubServer.init(5001, function() {
  console.log('OK Stub Server running on http://localhost:5001');
});
