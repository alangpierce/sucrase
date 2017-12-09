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
});
