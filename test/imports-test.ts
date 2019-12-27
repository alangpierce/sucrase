import {
  CREATE_NAMED_EXPORT_FROM_PREFIX,
  CREATE_STAR_EXPORT_PREFIX,
  ESMODULE_PREFIX,
  IMPORT_DEFAULT_PREFIX,
  IMPORT_WILDCARD_PREFIX,
  JSX_PREFIX,
} from "./prefixes";
import {assertMultiFileOutput, assertResult, devProps} from "./util";

describe("transform imports", () => {
  it("transforms export default", () => {
    assertResult(
      `
      export default foo;
    `,
      `"use strict";${ESMODULE_PREFIX}
      exports. default = foo;
    `,
    );
  });

  it("keeps a top-level function declaration on export default function", () => {
    assertResult(
      `
      export default function foo() {
        console.log('Hello');
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       function foo() {
        console.log('Hello');
      } exports.default = foo;
    `,
    );
  });

  it("exports a function expression for anonymous functions", () => {
    assertResult(
      `
      export default function () {
        console.log('Hello');
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
      exports. default = function () {
        console.log('Hello');
      }
    `,
    );
  });

  it("keeps a top-level class declaration on export default class", () => {
    assertResult(
      `
      export default class A {}
    `,
      `"use strict";${ESMODULE_PREFIX}
       class A {} exports.default = A;
    `,
    );
  });

  it("exports a class expression for anonymous class", () => {
    assertResult(
      `
      export default class {}
    `,
      `"use strict";${ESMODULE_PREFIX}
      exports. default = class {}
    `,
    );
  });

  it("transforms export var/let/const", () => {
    assertResult(
      `
      export var x = 1;
      export let y = 2;
      export const z = 3;
    `,
      `"use strict";${ESMODULE_PREFIX}
       var x = 1; exports.x = x;
       let y = 2; exports.y = y;
       const z = 3; exports.z = z;
    `,
    );
  });

  it("transforms export function", () => {
    assertResult(
      `
      export function foo(x) {
        return x + 1;
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       function foo(x) {
        return x + 1;
      } exports.foo = foo;
    `,
    );
  });

  it("transforms export async function", () => {
    assertResult(
      `
      export async function foo(x) {
        return x + 1;
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       async function foo(x) {
        return x + 1;
      } exports.foo = foo;
    `,
    );
  });

  it("transforms export class", () => {
    assertResult(
      `
      export class A {
        b() {
          return c;
        }
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class A {
        b() {
          return c;
        }
      } exports.A = A;
    `,
    );
  });

  it("transforms export class with superclass", () => {
    assertResult(
      `
      export class A extends B {
        c() {
          return d;
        }
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class A extends B {
        c() {
          return d;
        }
      } exports.A = A;
    `,
    );
  });

  it("transforms export class with complex superclass", () => {
    assertResult(
      `
      export class A extends b(C) {
        d() {
          return e;
        }
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class A extends b(C) {
        d() {
          return e;
        }
      } exports.A = A;
    `,
    );
  });

  it("transforms export class with complex superclass containing an open-brace", () => {
    assertResult(
      `
      export class A extends b(C({})) {
        d() {
          return e;
        }
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class A extends b(C({})) {
        d() {
          return e;
        }
      } exports.A = A;
    `,
    );
  });

  it("allows exporting names directly", () => {
    assertResult(
      `
      let a = 1, b = 2;
      export {a, b as c};
    `,
      `"use strict";${ESMODULE_PREFIX}
      let a = 1, b = exports.c = 2;
      exports.a = a; exports.c = b;
    `,
    );
  });

  it("allows an empty export statement", () => {
    assertResult(
      `
      export {};
    `,
      `"use strict";${ESMODULE_PREFIX}
      
    `,
    );
  });

  it("allows trailing commas in exported names", () => {
    assertResult(
      `
      let a = 1, b = 2;
      export {
        a,
        b,
      };
    `,
      `"use strict";${ESMODULE_PREFIX}
      let a = 1, b = exports.b = 2;
      


exports.a = a; exports.b = b;
    `,
    );
  });

  it("deconflicts generated names", () => {
    assertResult(
      `
      import * as foo from 'foo';
      import bar from 'bar';
      function _interopRequireWildcard() {
        return 3;
      }
      function _interopRequireDefault() {
        return 4;
      }
      function _interopRequireDefault2() {
        return 5;
      }
    `,
      `"use strict"; function _interopRequireWildcard2(obj) { \
if (obj && obj.__esModule) { return obj; } else { var newObj = {}; \
if (obj != null) { for (var key in obj) { \
if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } \
newObj.default = obj; return newObj; } } function _interopRequireDefault3(obj) { \
return obj && obj.__esModule ? obj : { default: obj }; }
      var _foo = require('foo'); var foo = _interopRequireWildcard2(_foo);
      var _bar = require('bar'); var _bar2 = _interopRequireDefault3(_bar);
      function _interopRequireWildcard() {
        return 3;
      }
      function _interopRequireDefault() {
        return 4;
      }
      function _interopRequireDefault2() {
        return 5;
      }
    `,
    );
  });

  it("rewrites lone default imports", () => {
    assertResult(
      `
      import defaultName from 'moduleName';
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _moduleName = require('moduleName'); var _moduleName2 = _interopRequireDefault(_moduleName);
    `,
    );
  });

  it("rewrites default with named imports", () => {
    assertResult(
      `
      import defaultName, {namedName} from 'moduleName';
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _moduleName = require('moduleName'); var _moduleName2 = _interopRequireDefault(_moduleName);
    `,
    );
  });

  it("rewrites default with wildcard import", () => {
    assertResult(
      `
      import defaultName, * as wildcardName from 'moduleName';
    `,
      `"use strict";${IMPORT_WILDCARD_PREFIX}
      var _moduleName = require('moduleName'); var wildcardName = _interopRequireWildcard(_moduleName);
    `,
    );
  });

  it("rewrites a lone wildcard import", () => {
    assertResult(
      `
      import * as wildcardName from 'moduleName';
    `,
      `"use strict";${IMPORT_WILDCARD_PREFIX}
      var _moduleName = require('moduleName'); var wildcardName = _interopRequireWildcard(_moduleName);
    `,
    );
  });

  it("rewrites a lone named import", () => {
    assertResult(
      `
      import {namedName} from 'moduleName';
    `,
      `"use strict";
      var _moduleName = require('moduleName');
    `,
    );
  });

  it("allows an import statement with no import bindings", () => {
    assertResult(
      `
      import {} from 'moduleName';
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles trailing commas in named imports", () => {
    assertResult(
      `
      import {
        a,
        b,
      } from 'moduleName';
      console.log(a + b);
    `,
      `"use strict";
      


var _moduleName = require('moduleName');
      console.log(_moduleName.a + _moduleName.b);
    `,
    );
  });

  it("rewrites a bare import", () => {
    assertResult(
      `
      import 'moduleName';
    `,
      `"use strict";
      require('moduleName');
    `,
    );
  });

  it("rewrites a duplicated import", () => {
    assertResult(
      `
      import a from 'moduleName';
      import * as b from 'otherModuleName';
      import * as c from 'moduleName';
      import * as d from 'otherModuleName';
    `,
      `"use strict";${IMPORT_WILDCARD_PREFIX}
      var _moduleName = require('moduleName'); var c = _interopRequireWildcard(_moduleName);
      var _otherModuleName = require('otherModuleName'); var b = _interopRequireWildcard(_otherModuleName); var d = _interopRequireWildcard(_otherModuleName);
      
      
    `,
    );
  });

  it("transforms default import access to property access", () => {
    assertResult(
      `
      import foo from 'my-module';
      
      foo.test();
      test.foo();
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _mymodule = require('my-module'); var _mymodule2 = _interopRequireDefault(_mymodule);
      
      _mymodule2.default.test();
      test.foo();
    `,
    );
  });

  it("transforms named import access to property access", () => {
    assertResult(
      `
      import {bar} from 'my-module';
      
      bar();
    `,
      `"use strict";
      var _mymodule = require('my-module');
      
      _mymodule.bar.call(void 0, );
    `,
    );
  });

  it("never breaks weird call expressions", () => {
    assertResult(
      `
      import a from 'a';
      import b from 'b';
      (a)();
      ((a))();
      a(b)();
      (a + b)();
      new (a)();
      `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _a = require('a'); var _a2 = _interopRequireDefault(_a);
      var _b = require('b'); var _b2 = _interopRequireDefault(_b);
      ((0, _a2.default))();
      (((0, _a2.default)))();
      _a2.default.call(void 0, (0, _b2.default))();
      (_a2.default + (0, _b2.default))();
      new ((0, _a2.default))();
      `,
    );
  });

  describe("ASI interop", () => {
    it("prevents accidental invocation for imported functions", () => {
      assertResult(
        `
        import {fun} from 'my-module'

        let arr = []
        fun()
        fun(1, 2)
        `,
        `"use strict";
        var _mymodule = require('my-module');

        let arr = []
        _mymodule.fun.call(void 0, )
        _mymodule.fun.call(void 0, 1, 2)
        `,
      );
    });
  });

  it("uses wildcard name on default access when possible", () => {
    assertResult(
      `
      import defaultName, * as wildcardName from 'my-module';
      
      defaultName.methodName();
    `,
      `"use strict";${IMPORT_WILDCARD_PREFIX}
      var _mymodule = require('my-module'); var wildcardName = _interopRequireWildcard(_mymodule);
      
      wildcardName.default.methodName();
    `,
    );
  });

  it("allows import and export as property names", () => {
    assertResult(
      `
      const a = {
        import: 1,
        export: 2,
      };
      console.log(a.import);
      console.log(a.export);
      class Test {
        import() {}
        export() {}
      }
    `,
      `"use strict";
      const a = {
        import: 1,
        export: 2,
      };
      console.log(a.import);
      console.log(a.export);
      class Test {
        import() {}
        export() {}
      }
    `,
    );
  });

  it("properly handles code with a class constructor", () => {
    assertResult(
      `
      import foo from 'foo';
      
      class A {
        constructor() {
          this.val = foo();
        }
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _foo = require('foo'); var _foo2 = _interopRequireDefault(_foo);
      
      class A {
        constructor() {
          this.val = _foo2.default.call(void 0, );
        }
      }
    `,
    );
  });

  it("allows imported names as object keys", () => {
    assertResult(
      `
      import foo from 'foo';
      
      const o = {
        foo: 3,
      };
      
      function f() {
        return true ? foo : 3;
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _foo = require('foo'); var _foo2 = _interopRequireDefault(_foo);
      
      const o = {
        foo: 3,
      };
      
      function f() {
        return true ? _foo2.default : 3;
      }
    `,
    );
  });

  it("expands object shorthand syntax for imported names", () => {
    assertResult(
      `
      import foo from 'foo';
      
      const o = {
        foo,
        bar,
        baz: foo,
        for: 4,
      };
      
      function f() {
        foo
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _foo = require('foo'); var _foo2 = _interopRequireDefault(_foo);
      
      const o = {
        foo: _foo2.default,
        bar,
        baz: _foo2.default,
        for: 4,
      };
      
      function f() {
        _foo2.default
      }
    `,
    );
  });

  it("allows importing a class used in an `extends` clause in an export", () => {
    assertResult(
      `
      import Superclass from './superclass';
      
      export class Subclass extends Superclass {
      }
    `,
      `"use strict";${ESMODULE_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _superclass = require('./superclass'); var _superclass2 = _interopRequireDefault(_superclass);
      
       class Subclass extends _superclass2.default {
      } exports.Subclass = Subclass;
    `,
    );
  });

  it("properly handles React.createElement created from JSX", () => {
    assertResult(
      `
      import React from 'react';
      import Foo from './Foo';
      
      const elem = <Foo />;
    `,
      `"use strict";${JSX_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      var _Foo = require('./Foo'); var _Foo2 = _interopRequireDefault(_Foo);
      
      const elem = _react2.default.createElement(_Foo2.default, {${devProps(5)}} );
    `,
    );
  });

  it("properly transforms imported JSX props", () => {
    assertResult(
      `
      import React from 'react';
      import value from './value';
      
      <div a={value} />;
    `,
      `"use strict";${JSX_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      var _value = require('./value'); var _value2 = _interopRequireDefault(_value);
      
      _react2.default.createElement('div', { a: _value2.default, ${devProps(5)}} );
    `,
    );
  });

  it("properly transforms an imported JSX element", () => {
    assertResult(
      `
      import React from 'react';
      import value from './value';
      
      const elem = (
        <div>
          <span>
            <span />
            {value}
          </span>        
        </div>
      );
    `,
      `"use strict";${JSX_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      var _value = require('./value'); var _value2 = _interopRequireDefault(_value);
      
      const elem = (
        _react2.default.createElement('div', {${devProps(6)}}
          , _react2.default.createElement('span', {${devProps(7)}}
            , _react2.default.createElement('span', {${devProps(8)}} )
            , _value2.default
          )
        )
      );
    `,
    );
  });

  it("adds module exports suffix when requested", () => {
    assertResult(
      `
      export default 3;
    `,
      `"use strict";${ESMODULE_PREFIX}
      exports. default = 3;
    
module.exports = exports.default;
`,
      {transforms: ["imports"], enableLegacyBabel5ModuleInterop: true},
    );
  });

  it("does not add module exports suffix when there is a named export", () => {
    assertResult(
      `
      export const x = 1;
      export default 4;
    `,
      `"use strict";${ESMODULE_PREFIX}
       const x = 1; exports.x = x;
      exports. default = 4;
    `,
      {transforms: ["imports"], enableLegacyBabel5ModuleInterop: true},
    );
  });

  it("does not modify object keys matching import names", () => {
    assertResult(
      `
      import foo from './foo';
      
      const o1 = {
        foo: 3,
      };
      const o2 = {
        foo() {
          return 4;
        }
      };
      const o3 = {
        async foo() {
          return 5;
        }
      };
      class C1 {
        foo() {
        }
      }
      class C2 {
        async foo() {
        }
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _foo = require('./foo'); var _foo2 = _interopRequireDefault(_foo);
      
      const o1 = {
        foo: 3,
      };
      const o2 = {
        foo() {
          return 4;
        }
      };
      const o3 = {
        async foo() {
          return 5;
        }
      };
      class C1 {
        foo() {
        }
      }
      class C2 {
        async foo() {
        }
      }
    `,
    );
  });

  it("properly transforms function calls within object methods", () => {
    assertResult(
      `
      import {foo} from './foo';
      
      const o = {
        f() {
          foo(3);
        }
      }
      
      class C {
        g() {
          foo(4);
        }
      }
    `,
      `"use strict";
      var _foo = require('./foo');
      
      const o = {
        f() {
          _foo.foo.call(void 0, 3);
        }
      }
      
      class C {
        g() {
          _foo.foo.call(void 0, 4);
        }
      }
    `,
    );
  });

  it("supports basic export...from syntax", () => {
    assertResult(
      `
      export {x} from './MyVars';
      export {a as b, c as d} from './MyOtherVars';
    `,
      `"use strict";${ESMODULE_PREFIX}${CREATE_NAMED_EXPORT_FROM_PREFIX}
      var _MyVars = require('./MyVars'); _createNamedExportFrom(_MyVars, 'x', 'x');
      var _MyOtherVars = require('./MyOtherVars'); _createNamedExportFrom(_MyOtherVars, 'b', 'a'); _createNamedExportFrom(_MyOtherVars, 'd', 'c');
    `,
    );
  });

  it("supports export * from syntax", () => {
    assertResult(
      `
      export * from './MyVars';
    `,
      `"use strict";${ESMODULE_PREFIX}${CREATE_STAR_EXPORT_PREFIX}
      var _MyVars = require('./MyVars'); _createStarExport(_MyVars);
    `,
    );
  });

  it("properly accounts for string interpolations when augmenting tokens", () => {
    assertResult(
      `
      import {foo} from 'things';

      class C {
        m1(id) {
          return \`interpolated \${value}\`;
        }
        m2(id) {
          foo();
        }
      }
    `,
      `"use strict";
      var _things = require('things');

      class C {
        m1(id) {
          return \`interpolated \${value}\`;
        }
        m2(id) {
          _things.foo.call(void 0, );
        }
      }
    `,
    );
  });

  it("updates exported bindings for simple identifier assignments", () => {
    assertResult(
      `
      let foo = 3;
      export {foo as bar};
      foo = 4;
    `,
      `"use strict";${ESMODULE_PREFIX}
      let foo = 3;
      exports.bar = foo;
      foo = exports.bar = 4;
    `,
    );
  });

  it("handles a top-level block with an imported value in it", () => {
    assertResult(
      `
      import {a} from 'a';
      
      {
        a();
      }
    `,
      `"use strict";
      var _a = require('a');
      
      {
        _a.a.call(void 0, );
      }
    `,
    );
  });

  it("handles a switch case block with an imported value in it", () => {
    assertResult(
      `
      import {a} from 'a';
      
      switch (foo) {
        case 1: {
          a();
        }
      }
    `,
      `"use strict";
      var _a = require('a');
      
      switch (foo) {
        case 1: {
          _a.a.call(void 0, );
        }
      }
    `,
    );
  });

  it("handles a switch default block with an imported value in it", () => {
    assertResult(
      `
      import {a} from 'a';
      
      switch (foo) {
        default: {
          a();
        }
      }
    `,
      `"use strict";
      var _a = require('a');
      
      switch (foo) {
        default: {
          _a.a.call(void 0, );
        }
      }
    `,
    );
  });

  it("properly exports imported bindings", () => {
    assertResult(
      `
      import a from 'a';
      export {a};
    `,
      `"use strict";${ESMODULE_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _a = require('a'); var _a2 = _interopRequireDefault(_a);
      exports.a = _a2.default;
    `,
    );
  });

  it("does not transform shadowed identifiers", () => {
    assertResult(
      `
      import a from 'a';
      console.log(a);
      function f() {
        let a = 3;
        a = 7;
        console.log(a);
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _a = require('a'); var _a2 = _interopRequireDefault(_a);
      console.log(_a2.default);
      function f() {
        let a = 3;
        a = 7;
        console.log(a);
      }
    `,
    );
  });

  it("does not transform property accesses in JSX", () => {
    assertResult(
      `
      import React from 'react';
      import Row from 'row';
      
      const e = <foo.Row />;
    `,
      `"use strict";${JSX_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      var _row = require('row'); var _row2 = _interopRequireDefault(_row);
      
      const e = _react2.default.createElement(foo.Row, {${devProps(5)}} );
    `,
    );
  });

  it("handles export namespace as named export", () => {
    assertResult(
      `
      export * as a from 'a';
    `,
      `"use strict";${ESMODULE_PREFIX}${IMPORT_WILDCARD_PREFIX}
      var _a = require('a'); var _a2 = _interopRequireWildcard(_a); exports.a = _a2;
    `,
    );
  });

  it("handles dynamic imports", () => {
    assertResult(
      `
      async function loadThing() {
        const foo = await import('foo');
      }
    `,
      `"use strict";
      async function loadThing() {
        const foo = await Promise.resolve().then(() => require('foo'));
      }
    `,
    );
  });

  it("properly handles object destructuring with imported names", () => {
    assertResult(
      `
      import a from 'a';
      const {b = a} = {};
      if (true) {
        const {a} = {};
        console.log(a);
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _a = require('a'); var _a2 = _interopRequireDefault(_a);
      const {b = _a2.default} = {};
      if (true) {
        const {a} = {};
        console.log(a);
      }
    `,
    );
  });

  it("properly handles arrow functions with parameters shadowing imported names", () => {
    assertResult(
      `
      import a from 'a';
      const f = (a, b);
      const g = (a, b) => c;
      const h = a => c;
      const f2 = async (a) => c;
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _a = require('a'); var _a2 = _interopRequireDefault(_a);
      const f = (_a2.default, b);
      const g = (a, b) => c;
      const h = a => c;
      const f2 = async (a) => c;
    `,
    );
  });

  it("properly handles complex assignments to exported values", () => {
    assertResult(
      `
      export let a = 1;
      ({a} = 2);
      a = 3;
      console.log(a);
    `,
      `"use strict";${ESMODULE_PREFIX}
       let a = 1; exports.a = a;
      ({a: exports.a} = 2);
      exports.a = 3;
      console.log(exports.a);
    `,
    );
  });

  it("allows exported generator functions", () => {
    assertResult(
      `
      export function* foo() {}
      export async function* bar() {}
      export default function* baz() {}
      export default async function* qux() {}
    `,
      `"use strict";${ESMODULE_PREFIX}
       function* foo() {} exports.foo = foo;
       async function* bar() {} exports.bar = bar;
      exports. default = function* baz() {}
      exports. default = async function* qux() {}
    `,
    );
  });

  it("allows exported destructure operations", () => {
    assertResult(
      `
      export let {a = 2, b: [c, d], ...e} = f;
      export var [g = 3, ...h] = i;
      export const {j} = k;
      export let {l = () => {const m = 3;}} = {};
      export let x;
      x = 2;
      export let {y}: Foo = z;
    `,
      `"use strict";${ESMODULE_PREFIX}
      ( {a: exports.a = 2, b: [exports.c, exports.d], ...exports.e} = f);
       [exports.g = 3, ...exports.h] = i;
      ( {j: exports.j} = k);
      ( {l: exports.l = () => {const m = 3;}} = {});
       exports.x;
      exports.x = 2;
      ( {y: exports.y} = z);
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("allows function name inference for direct named exports", () => {
    assertResult(
      `
      export let f = () => {};
      export const g = () => {};
    `,
      `"use strict";${ESMODULE_PREFIX}
       let f = () => {}; exports.f = f;
       const g = () => {}; exports.g = g;
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  // Skipping since this is reasonably obscure and seems hard to implement right in Sucrase.
  // Babel fix: https://github.com/babel/babel/pull/8698
  it.skip("treats 'export default async' as a complete statement", () => {
    assertResult(
      `
      export default async
      function bar() {}
    `,
      `"use strict";${ESMODULE_PREFIX}
      exports. default = async
      function bar() {}
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("properly handles shadowing for simple arrow functions", () => {
    assertResult(
      `
      import a from 'a';
      const f = a => {
        a();
      };
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      
      const f = a => {
        a();
      };
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("properly handles shadowing for simple async arrow functions", () => {
    assertResult(
      `
      import a from 'a';
      const f = async a => {
        a();
      };
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      
      const f = async a => {
        a();
      };
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("handles += of an exported value", () => {
    assertResult(
      `
      let x = 1;
      export {x as y};
      x += 2;
    `,
      `"use strict";${ESMODULE_PREFIX}
      let x = 1;
      exports.y = x;
      x = exports.y += 2;
    `,
      {transforms: ["imports"]},
    );
  });

  it("handles postincrement of an exported value", () => {
    assertResult(
      `
      let x = 1;
      export {x as y};
      console.log(x++);
    `,
      `"use strict";${ESMODULE_PREFIX}
      let x = 1;
      exports.y = x;
      console.log((x = exports.y = x + 1, x - 1));
    `,
      {transforms: ["imports"]},
    );
  });

  it("handles postdecrement of an exported value", () => {
    assertResult(
      `
      let x = 1;
      export {x as y};
      console.log(x--);
    `,
      `"use strict";${ESMODULE_PREFIX}
      let x = 1;
      exports.y = x;
      console.log((x = exports.y = x - 1, x + 1));
    `,
      {transforms: ["imports"]},
    );
  });

  it("handles postincrement of a doubly-exported value", () => {
    assertResult(
      `
      export let x = 1;
      export {x as y};
      console.log(x++);
    `,
      `"use strict";${ESMODULE_PREFIX}
       let x = 1; exports.x = x;
      exports.y = exports.x;
      console.log((exports.x = exports.y = exports.x + 1, exports.x - 1));
    `,
      {transforms: ["imports"]},
    );
  });

  it("handles postincrement of a triply-exported value", () => {
    assertResult(
      `
      export let x = 1;
      export {x as y};
      export {x as z};
      console.log(x++);
    `,
      `"use strict";${ESMODULE_PREFIX}
       let x = 1; exports.x = x;
      exports.y = exports.x;
      exports.z = exports.x;
      console.log((exports.x = exports.y = exports.z = exports.x + 1, exports.x - 1));
    `,
      {transforms: ["imports"]},
    );
  });

  it("handles preincrement of an exported value", () => {
    assertResult(
      `
      let x = 1;
      export {x as y};
      console.log(++x);
    `,
      `"use strict";${ESMODULE_PREFIX}
      let x = 1;
      exports.y = x;
      console.log(exports.y = ++x);
    `,
      {transforms: ["imports"]},
    );
  });

  it("handles shadowing of exported values", () => {
    assertResult(
      `
      let x = 1;
      export {x as y};
      function foo(x) {
        x = 2;
        return x;
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
      let x = 1;
      exports.y = x;
      function foo(x) {
        x = 2;
        return x;
      }
    `,
      {transforms: ["imports"]},
    );
  });

  it("leaves import.meta alone", () => {
    assertResult(
      `
      console.log(import.meta);
    `,
      `"use strict";
      console.log(import.meta);
    `,
      {transforms: ["imports"]},
    );
  });

  it("implements basic live bindings", () => {
    assertMultiFileOutput(
      {
        main: `
          import {x, addOne} from 'otherFile';
          addOne();
          export const output = x;
      `,
        otherFile: `
          export let x = 3;
          export function addOne() {
            x++;
          }
      `,
      },
      4,
    );
  });

  it("does not implement a live binding for export default", () => {
    assertMultiFileOutput(
      {
        main: `
          import x, {addOne} from 'otherFile';
          addOne();
          export const output = x;
      `,
        otherFile: `
          let x = 3;
          export default x;
          export function addOne() {
            x++;
          }
      `,
      },
      3,
    );
  });

  it("implements a live binding for exporting with the name default", () => {
    assertMultiFileOutput(
      {
        main: `
          import x, {setToFive} from 'otherFile';
          setToFive();
          export const output = x;
      `,
        otherFile: `
          let x = 3;
          export {x as default};
          export function setToFive() {
            x = 5;
          }
      `,
      },
      5,
    );
  });

  it("handles ++ with default export live bindings", () => {
    assertMultiFileOutput(
      {
        main: `
          import x, {addOne} from 'otherFile';
          addOne();
          export const output = x;
      `,
        otherFile: `
          let x = 3;
          export {x as default};
          export function addOne() {
            x++;
          }
      `,
      },
      4,
    );
  });

  it("implements live bindings for star imports", () => {
    assertMultiFileOutput(
      {
        main: `
          import * as otherFile from 'otherFile';
          otherFile.setToFive();
          export const output = otherFile.x;
      `,
        otherFile: `
          export let x = 3;
          export function setToFive() {
            x = 5;
          }
      `,
      },
      5,
    );
  });

  it("implements live bindings for re-exported values", () => {
    assertMultiFileOutput(
      {
        main: `
          import * as otherFile from 'otherFile';
          otherFile.setToFive();
          export const output = otherFile.x;
      `,
        otherFile: `
          export * from 'thirdFile';
        `,
        thirdFile: `
          export let x = 3;
          export function setToFive() {
            x = 5;
          }
      `,
      },
      5,
    );
  });
});
