const sucrase = require("..");

/**
 * test262-harness preprocessor documented here:
 https://github.com/bterlson/test262-harness#preprocessor
 */
module.exports = function(test) {
  // Sucrase doesn't attempt to throw SyntaxError on bad syntax, so skip those tests.
  if (test.attrs.negative) {
    return null;
  }

  // Sucrase assumes strict mode, so skip sloppy mode tests.
  if (test.scenario === "default") {
    return null;
  }

  // TCO tests seem to fail in V8 normally, so skip those.
  if (test.attrs.features.includes("tail-call-optimization")) {
    return null;
  }

  try {
    test.contents = sucrase.transform(test.contents, {transforms: []}).code;
  } catch (error) {
    test.result = {
      stderr: `${error.name}: ${error.message}\n`,
      stdout: "",
      error,
    };
  }

  return test;
};
