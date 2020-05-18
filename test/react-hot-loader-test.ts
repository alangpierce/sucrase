import type {Transform} from "../src";
import {ESMODULE_PREFIX, IMPORT_DEFAULT_PREFIX, RHL_PREFIX} from "./prefixes";
import {assertResult} from "./util";

function assertCJSResult(
  code: string,
  expectedResult: string,
  extraTransforms: Array<Transform> = [],
): void {
  assertResult(code, expectedResult, {
    transforms: ["jsx", "imports", "react-hot-loader", ...extraTransforms],
    filePath: "sample.tsx",
  });
}

function assertESMResult(
  code: string,
  expectedResult: string,
  extraTransforms: Array<Transform> = [],
): void {
  assertResult(code, expectedResult, {
    transforms: ["jsx", "react-hot-loader", ...extraTransforms],
    filePath: "sample.tsx",
  });
}

describe("transform react-hot-loader", () => {
  it("transforms common cases in CJS mode", () => {
    assertCJSResult(
      `
      import React from 'react';
      
      const x = 3;
      
      function blah() {
      }
      
      class Foo extends React.Component {
        _handleSomething = () => {
          return 3;
        };
      
        render() {
          return <span onChange={this._handleSomething} />;
        }
      }
      
      class SomeOtherClass {
        test() {}
      }
      
      export default 12;
    `,
      `"use strict";const _jsxFileName = "sample.tsx";${RHL_PREFIX}${ESMODULE_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      
      const x = 3;
      
      function blah() {
      }
      
      class Foo extends _react2.default.Component {__reactstandin__regenerateByEval(key, code) {this[key] = eval(code);}constructor(...args) { super(...args); Foo.prototype.__init.call(this); }
        __init() {this._handleSomething = () => {
          return 3;
        }}
      
        render() {
          return _react2.default.createElement('span', { onChange: this._handleSomething, __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}} );
        }
      }
      
      class SomeOtherClass {__reactstandin__regenerateByEval(key, code) {this[key] = eval(code);}
        test() {}
      }
      
      let _default; exports. default = _default = 12;
    
;(function () {
  var reactHotLoader = require('react-hot-loader').default;
  var leaveModule = require('react-hot-loader').leaveModule;
  if (!reactHotLoader) {
    return;
  }
  reactHotLoader.register(x, "x", "sample.tsx");
  reactHotLoader.register(blah, "blah", "sample.tsx");
  reactHotLoader.register(Foo, "Foo", "sample.tsx");
  reactHotLoader.register(SomeOtherClass, "SomeOtherClass", "sample.tsx");
  reactHotLoader.register(_default, "default", "sample.tsx");
  leaveModule(module);
})();`,
    );
  });

  it("transforms common cases in ESM mode", () => {
    assertESMResult(
      `
      import React from 'react';
      
      const x = 3;
      
      function blah() {
      }
      
      class Foo extends React.Component {
        _handleSomething = () => {
          return 3;
        };
      
        render() {
          return <span onChange={this._handleSomething} />;
        }
      }
      
      class SomeOtherClass {
        test() {}
      }
      
      export default 12;
    `,
      `const _jsxFileName = "sample.tsx";${RHL_PREFIX}
      import React from 'react';
      
      const x = 3;
      
      function blah() {
      }
      
      class Foo extends React.Component {__reactstandin__regenerateByEval(key, code) {this[key] = eval(code);}constructor(...args) { super(...args); Foo.prototype.__init.call(this); }
        __init() {this._handleSomething = () => {
          return 3;
        }}
      
        render() {
          return React.createElement('span', { onChange: this._handleSomething, __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}} );
        }
      }
      
      class SomeOtherClass {__reactstandin__regenerateByEval(key, code) {this[key] = eval(code);}
        test() {}
      }
      
      let _default; export default _default = 12;
    
;(function () {
  var reactHotLoader = require('react-hot-loader').default;
  var leaveModule = require('react-hot-loader').leaveModule;
  if (!reactHotLoader) {
    return;
  }
  reactHotLoader.register(x, "x", "sample.tsx");
  reactHotLoader.register(blah, "blah", "sample.tsx");
  reactHotLoader.register(Foo, "Foo", "sample.tsx");
  reactHotLoader.register(SomeOtherClass, "SomeOtherClass", "sample.tsx");
  reactHotLoader.register(_default, "default", "sample.tsx");
  leaveModule(module);
})();`,
    );
  });

  it("does not treat function type params as top-level declarations", () => {
    assertESMResult(
      `
      type Reducer<T, U> = (u: U, t: T) => U;
      const f = (x: number) => x + 1;
    `,
      `${RHL_PREFIX}
      
      const f = (x) => x + 1;
    
;(function () {
  var reactHotLoader = require('react-hot-loader').default;
  var leaveModule = require('react-hot-loader').leaveModule;
  if (!reactHotLoader) {
    return;
  }
  reactHotLoader.register(f, "f", "sample.tsx");
  leaveModule(module);
})();`,
      ["typescript"],
    );
  });

  it("does not extract default to a variable when it already has a name", () => {
    assertESMResult(
      `
      export default function add() {}
    `,
      `${RHL_PREFIX}
      export default function add() {}
    
;(function () {
  var reactHotLoader = require('react-hot-loader').default;
  var leaveModule = require('react-hot-loader').leaveModule;
  if (!reactHotLoader) {
    return;
  }
  reactHotLoader.register(add, "add", "sample.tsx");
  leaveModule(module);
})();`,
      ["typescript"],
    );
  });

  it("guards against ASI issues by starting the suffix with a semicolon", () => {
    assertESMResult(
      `
      export default function add() {}
    `,
      `${RHL_PREFIX}
      export default function add() {}
    
;(function () {
  var reactHotLoader = require('react-hot-loader').default;
  var leaveModule = require('react-hot-loader').leaveModule;
  if (!reactHotLoader) {
    return;
  }
  reactHotLoader.register(add, "add", "sample.tsx");
  leaveModule(module);
})();`,
      ["typescript"],
    );
  });

  it("escapes file paths", () => {
    assertResult(
      `
    import React from 'react';

    export const App = () => <div />;
    `,
      `const _jsxFileName = "C:\\\\dev\\\\sample.tsx";${RHL_PREFIX}
    import React from 'react';

    export const App = () => React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 4}} );
    
;(function () {
  var reactHotLoader = require('react-hot-loader').default;
  var leaveModule = require('react-hot-loader').leaveModule;
  if (!reactHotLoader) {
    return;
  }
  reactHotLoader.register(App, "App", "C:\\\\dev\\\\sample.tsx");
  leaveModule(module);
})();`,
      {
        transforms: ["jsx", "react-hot-loader"],
        filePath: "C:\\dev\\sample.tsx",
      },
    );
  });
});
