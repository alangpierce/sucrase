import {assertResult} from './util';

const PREFIX = `'use strict'; function _interopRequireWildcard(obj) { \
if (obj && obj.__esModule) { return obj; } else { var newObj = {}; \
if (obj != null) { for (var key in obj) { \
if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } \
newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { \
return obj && obj.__esModule ? obj : { default: obj }; }`;
const ESMODULE_PREFIX = 'Object.defineProperty(exports, "__esModule", {value: true});';

describe('transform imports', () => {
  it('transforms export default', () => {
    assertResult(`
      export default foo;
    `, `${PREFIX}${ESMODULE_PREFIX}
      exports. default = foo;
    `);
  });

  it('transforms export var/let/const', () => {
    assertResult(`
      export var x = 1;
      export let y = 2;
      export const z = 3;
    `, `${PREFIX}${ESMODULE_PREFIX}
       var x = exports.x = 1;
       let y = exports.y = 2;
       const z = exports.z = 3;
    `);
  });

  it('transforms export function', () => {
    assertResult(`
      export function foo(x) {
        return x + 1;
      }
    `, `${PREFIX}${ESMODULE_PREFIX}
       function foo(x) {
        return x + 1;
      } exports.foo = foo;
    `);
  });

  it('transforms export async function', () => {
    assertResult(`
      export async function foo(x) {
        return x + 1;
      }
    `, `${PREFIX}${ESMODULE_PREFIX}
       async function foo(x) {
        return x + 1;
      } exports.foo = foo;
    `);
  });

  it('transforms export class', () => {
    assertResult(`
      export class A {
        b() {
          return c;
        }
      }
    `, `${PREFIX}${ESMODULE_PREFIX}
       class A {
        b() {
          return c;
        }
      } exports.A = A;
    `);
  });

  it('transforms export class with superclass', () => {
    assertResult(`
      export class A extends B {
        c() {
          return d;
        }
      }
    `, `${PREFIX}${ESMODULE_PREFIX}
       class A extends B {
        c() {
          return d;
        }
      } exports.A = A;
    `);
  });

  it('transforms export class with complex superclass', () => {
    assertResult(`
      export class A extends b(C) {
        d() {
          return e;
        }
      }
    `, `${PREFIX}${ESMODULE_PREFIX}
       class A extends b(C) {
        d() {
          return e;
        }
      } exports.A = A;
    `);
  });

  it('allows exporting names directly', () => {
    assertResult(`
      let a = 1, b = 2;
      export {a, b as c};
    `, `${PREFIX}${ESMODULE_PREFIX}
      let a = 1, b = 2;
      exports.a = a; exports.c = b;
    `);
  });

  it('allows trailing commas in exported names', () => {
    assertResult(`
      let a = 1, b = 2;
      export {
        a,
        b,
      };
    `, `${PREFIX}${ESMODULE_PREFIX}
      let a = 1, b = 2;
      


exports.a = a; exports.b = b;
    `);
  });

  it('deconflicts generated names', () => {
    assertResult(`
      function _interopRequireWildcard() {
        return 3;
      }
      function _interopRequireDefault() {
        return 4;
      }
      function _interopRequireDefault2() {
        return 5;
      }
    `, `'use strict'; function _interopRequireWildcard2(obj) { \
if (obj && obj.__esModule) { return obj; } else { var newObj = {}; \
if (obj != null) { for (var key in obj) { \
if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } \
newObj.default = obj; return newObj; } } function _interopRequireDefault3(obj) { \
return obj && obj.__esModule ? obj : { default: obj }; }
      function _interopRequireWildcard() {
        return 3;
      }
      function _interopRequireDefault() {
        return 4;
      }
      function _interopRequireDefault2() {
        return 5;
      }
    `);
  });

  it('rewrites lone default imports', () => {
    assertResult(`
      import defaultName from 'moduleName';
    `, `${PREFIX}
      var _moduleName = require('moduleName'); var _moduleName2 = _interopRequireDefault(_moduleName);
    `);
  });

  it('rewrites default with named imports', () => {
    assertResult(`
      import defaultName, {namedName} from 'moduleName';
    `, `${PREFIX}
      var _moduleName = require('moduleName'); var _moduleName2 = _interopRequireDefault(_moduleName);
    `);
  });

  it('rewrites default with wildcard import', () => {
    assertResult(`
      import defaultName, * as wildcardName from 'moduleName';
    `, `${PREFIX}
      var _moduleName = require('moduleName'); var wildcardName = _interopRequireWildcard(_moduleName);
    `);
  });

  it('rewrites a lone wildcard import', () => {
    assertResult(`
      import * as wildcardName from 'moduleName';
    `, `${PREFIX}
      var _moduleName = require('moduleName'); var wildcardName = _interopRequireWildcard(_moduleName);
    `);
  });

  it('rewrites a lone named import', () => {
    assertResult(`
      import {namedName} from 'moduleName';
    `, `${PREFIX}
      var _moduleName = require('moduleName');
    `);
  });

  it('handles trailing commas in named imports', () => {
    assertResult(`
      import {
        a,
        b,
      } from 'moduleName';
      console.log(a + b);
    `, `${PREFIX}
      


var _moduleName = require('moduleName');
      console.log((0, _moduleName.a) + (0, _moduleName.b));
    `);
  });

  it('rewrites a bare import', () => {
    assertResult(`
      import 'moduleName';
    `, `${PREFIX}
      require('moduleName');
    `);
  });

  it('rewrites a duplicated import', () => {
    assertResult(`
      import a from 'moduleName';
      import * as b from 'otherModuleName';
      import * as c from 'moduleName';
      import * as d from 'otherModuleName';
    `, `${PREFIX}
      var _moduleName = require('moduleName'); var c = _interopRequireWildcard(_moduleName);
      var _otherModuleName = require('otherModuleName'); var b = _interopRequireWildcard(_otherModuleName); var d = _interopRequireWildcard(_otherModuleName);
      
      
    `);
  });

  it('transforms default import access to property access', () => {
    assertResult(`
      import foo from 'my-module';
      
      foo.test();
      test.foo();
    `, `${PREFIX}
      var _mymodule = require('my-module'); var _mymodule2 = _interopRequireDefault(_mymodule);
      
      (0, _mymodule2.default).test();
      test.foo();
    `);
  });

  it('transforms named import access to property access', () => {
    assertResult(`
      import {bar} from 'my-module';
      
      bar();
    `, `${PREFIX}
      var _mymodule = require('my-module');
      
      (0, _mymodule.bar)();
    `);
  });

  it('uses wildcard name on default access when possible', () => {
    assertResult(`
      import defaultName, * as wildcardName from 'my-module';
      
      defaultName.methodName();
    `, `${PREFIX}
      var _mymodule = require('my-module'); var wildcardName = _interopRequireWildcard(_mymodule);
      
      (0, wildcardName.default).methodName();
    `);
  });

  it('allows import and export as property names', () => {
    assertResult(`
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
    `, `${PREFIX}
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
    `);
  });

  it('properly handles code with a class constructor', () => {
    assertResult(`
      import foo from 'foo';
      
      class A {
        constructor() {
          this.val = foo();
        }
      }
    `, `${PREFIX}
      var _foo = require('foo'); var _foo2 = _interopRequireDefault(_foo);
      
      class A {
        constructor() {
          this.val = (0, _foo2.default)();
        }
      }
    `);
  });
});
