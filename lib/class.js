var _ = require('lodash');

/**
  A stopgap ES6 class.
  `class Foo { ... }` ----> `var Foo = Class({ ... })`
*/
var Class = function (properties) {
  var constructor = properties.constructor || new function () {};
  delete properties.constructor;

  constructor.prototype = Object.create(properties);
  constructor.prototype.constructor = constructor;

  return constructor;
};

Class.extend = function (base, prototype) {
  var extended = Class(prototype);

  extended.prototype = Object.create(_.extend({}, base.prototype, prototype));
  extended.prototype.constructor = extended;

  return extended;
};

module.exports = Class;