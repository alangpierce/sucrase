"use strict";

module.exports = {
  client: {
    overlay: {
      // Silence warning:
      // "new Worker() will only be bundled if passed a String."
      // which appears to be coming from monaco.
      warnings: false,
    },
  },
};
