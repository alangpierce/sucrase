import {PREFIX} from "./prefixes";
import {assertResult} from "./util";

describe("transform flow", () => {
  it("removes `import type` statements", () => {
    assertResult(
      `
      import type {a} from 'b';
      import c from 'd';
      import type from 'e';
      import {f, type g} from 'h';
      import {type i, type j} from 'k';
      import type L from 'L';
    `,
      `${PREFIX}
      
      var _d = require('d'); var _d2 = _interopRequireDefault(_d);
      var _e = require('e'); var _e2 = _interopRequireDefault(_e);
      var _h = require('h');
      
      
    `,
    );
  });

  it("removes `implements` from a class declaration", () => {
    assertResult(
      `
      class A implements B {}
      class C extends D implements E {}
    `,
      `${PREFIX}
      class A {}
      class C extends D {}
    `,
    );
  });

  it("removes function return type annotations", () => {
    assertResult(
      `
      function f(): number {
        return 3;
      }
      const g = (): number => 4;
      function h():{}|{}{}{}
      const o = {
        foo(): string | number {
          return 'hi';
        }
      }
      class C {
        bar(): void {
          console.log('Hello');
        }
      }
    `,
      `${PREFIX}
      function f() {
        return 3;
      }
      const g = () => 4;
      function h(){}{}
      const o = {
        foo() {
          return 'hi';
        }
      }
      class C {
        bar() {
          console.log('Hello');
        }
      }
    `,
    );
  });

  it("removes types in parameters and variable declarations", () => {
    assertResult(
      `
      function foo(x: number, y: A | B): void {
        const a: string = "Hello";
        const b = (a: number);
      }
    `,
      `${PREFIX}
      function foo(x, y) {
        const a = "Hello";
        const b = (a);
      }
    `,
    );
  });

  it("removes array types", () => {
    assertResult(
      `
      function foo(): string[] {
        return [];
      }
    `,
      `${PREFIX}
      function foo() {
        return [];
      }
    `,
    );
  });

  it("removes parameterized types", () => {
    assertResult(
      `
      function foo(): Array<string> {
        return [];
      }
    `,
      `${PREFIX}
      function foo() {
        return [];
      }
    `,
    );
  });

  it("removes object types within classes", () => {
    assertResult(
      `
      class A {
        x: number = 2;
        y: {} = {};
      }
    `,
      `${PREFIX}
      class A {
        x = 2;
        y = {};
      }
    `,
    );
  });

  it("removes bare object type definitions", () => {
    assertResult(
      `
      class A {
        x: number;
      }
    `,
      `${PREFIX}
      class A {
        ;
      }
    `,
    );
  });

  it("removes function type parameters", () => {
    assertResult(
      `
      function f<T>(t: T): void {
        console.log(t);
      }
      const o = {
        g<T>(t: T): void {
        }
      }
      class C {
        h<T>(t: T): void {
        }
      }
    `,
      `${PREFIX}
      function f(t) {
        console.log(t);
      }
      const o = {
        g(t) {
        }
      }
      class C {
        h(t) {
        }
      }
    `,
    );
  });
});
