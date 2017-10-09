import {assertResult} from './util';

describe('transform imports', () => {
  it('transforms export default', () => {
    assertResult(`
      export default foo;
    `, `'use strict';Object.defineProperty(exports, "__esModule", {value: true});
      exports. default = foo;
    `);
  });

  it('transforms export var/let/const', () => {
    assertResult(`
      export var x = 1;
      export let y = 2;
      export const z = 3;
    `, `'use strict';Object.defineProperty(exports, "__esModule", {value: true});
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
    `, `'use strict';Object.defineProperty(exports, "__esModule", {value: true});
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
    `, `'use strict';Object.defineProperty(exports, "__esModule", {value: true});
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
    `, `'use strict';Object.defineProperty(exports, "__esModule", {value: true});
       class A {
        b() {
          return c;
        }
      } exports.A = A;
    `);
  });
});
