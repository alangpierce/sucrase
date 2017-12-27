import {ESMODULE_PREFIX, PREFIX} from "./prefixes";
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

  it("handles an exported function with type parameters", () => {
    assertResult(
      `
      export function foo(x: number): number {
        return x + 1;
      }
    `,
      `${PREFIX}${ESMODULE_PREFIX}
       function foo(x) {
        return x + 1;
      } exports.foo = foo;
    `,
    );
  });

  it("removes type assignments", () => {
    assertResult(
      `
      type foo = number;
      const x: foo = 3;
    `,
      `${PREFIX}
      ;
      const x = 3;
    `,
    );
  });

  it("handles exported types", () => {
    assertResult(
      `
      export type foo = number | string;
      export const x = 1;
    `,
      `${PREFIX}${ESMODULE_PREFIX}
      ;
       const x = exports.x = 1;
    `,
    );
  });

  it("does not mistake ? in types for a ternary operator", () => {
    assertResult(
      `
      type A<T> = ?number;
      const f = (): number => 3;
    `,
      `${PREFIX}
      ;
      const f = () => 3;
    `,
    );
  });

  it("handles string literal types", () => {
    assertResult(
      `
      function foo(x: "a"): string {
        return x;
      }
    `,
      `${PREFIX}
      function foo(x) {
        return x;
      }
    `,
    );
  });

  it("allows leading pipe operators in types", () => {
    assertResult(
      `
      const x: | number | string = "Hello";
    `,
      `${PREFIX}
      const x = "Hello";
    `,
    );
  });

  it("allows nested generics with a fake right-shift token", () => {
    assertResult(
      `
      const arr1: Array<Array<number> > = [[1]];
      const arr2: Array<Array<number>> = [[2]];
      const arr3: Array<Array<Array<number>>> = [[[3]]];
    `,
      `${PREFIX}
      const arr1 = [[1]];
      const arr2 = [[2]];
      const arr3 = [[[3]]];
    `,
    );
  });

  it("handles interface declarations and `export interface`", () => {
    assertResult(
      `
      interface Cartesian { x: number; y: number; }
      export interface Polar { r: number; theta: number; }
    `,
      `${PREFIX}
      

    `,
    );
  });

  it("supports interface as an object key", () => {
    assertResult(
      `
      const o = {
        interface: true,
      };
    `,
      `${PREFIX}
      const o = {
        interface: true,
      };
    `,
    );
  });

  it("properly removes optional parameter types", () => {
    assertResult(
      `
      function foo(x?: number): string {
        return 'Hi!';
      }
    `,
      `${PREFIX}
      function foo(x) {
        return 'Hi!';
      }
    `,
    );
  });

  it("properly removes class property variance markers", () => {
    assertResult(
      `
      class C {
        +foo: number;
        -bar: number;
      }
    `,
      `${PREFIX}
      class C {
        ;
        ;
      }
    `,
    );
  });

  it("recognizes arrow function types within parameters", () => {
    assertResult(
      `
      function partition<T>(
        list: T[],
        test: (T, number, T[]) => ?boolean,
      ): [T[], T[]] {
        return [];
      }
    `,
      `${PREFIX}
      function partition(
        list,
        test,
      ) {
        return [];
      }
    `,
    );
  });

  it("recognizes arrow function types in variable declarations", () => {
    assertResult(
      `
      const x: a => b = 2;
    `,
      `${PREFIX}
      const x = 2;
    `,
    );
  });
});
