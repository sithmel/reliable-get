'use strict';

var expect = require('expect.js');
var ReliableGet = require('..');

describe("Core caching", function() {

  it('should request something', function(done) {

      var config = {cache:{engine:'memory'}};
      var rg = ReliableGet(config);
      rg({url:'http://www.google.com'}, function(err, response) {
          done();
      });

  });

});


