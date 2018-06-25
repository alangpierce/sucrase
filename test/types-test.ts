import {ESMODULE_PREFIX} from "./prefixes";
import {assertResult} from "./util";

function assertTypeScriptAndFlowResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "imports", "typescript"]});
  assertResult(code, expectedResult, {transforms: ["jsx", "imports", "flow"]});
}

/**
 * Tests for syntax common between flow and typescript.
 */
describe("type transforms", () => {
  it("removes `implements` from a class declaration", () => {
    assertTypeScriptAndFlowResult(
      `
      class A implements B {}
      class C extends D implements E {}
    `,
      `"use strict";
      class A  {}
      class C extends D  {}
    `,
    );
  });

  it("removes function return type annotations", () => {
    assertTypeScriptAndFlowResult(
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
      `"use strict";
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
    assertTypeScriptAndFlowResult(
      `
      function foo(x: number, y: A | B): void {
        const a: string = "Hello";
        const b = (a: number);
      }
    `,
      `"use strict";
      function foo(x, y) {
        const a = "Hello";
        const b = (a);
      }
    `,
    );
  });

  it("removes array types", () => {
    assertTypeScriptAndFlowResult(
      `
      function foo(): string[] {
        return [];
      }
    `,
      `"use strict";
      function foo() {
        return [];
      }
    `,
    );
  });

  it("removes parameterized types", () => {
    assertTypeScriptAndFlowResult(
      `
      function foo(): Array<string> {
        return [];
      }
    `,
      `"use strict";
      function foo() {
        return [];
      }
    `,
    );
  });

  it("removes object types within classes", () => {
    assertTypeScriptAndFlowResult(
      `
      class A {
        x: number = 2;
        y: {} = {};
      }
    `,
      `"use strict";
      class A {constructor() { this.x = 2;this.y = {}; }
        ;
        ;
      }
    `,
    );
  });

  it("removes bare object type definitions", () => {
    assertTypeScriptAndFlowResult(
      `
      class A {
        x: number;
      }
    `,
      `"use strict";
      class A {
        ;
      }
    `,
    );
  });

  it.skip("removes function type parameters", () => {
    assertTypeScriptAndFlowResult(
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
      `"use strict";
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
    assertTypeScriptAndFlowResult(
      `
      export function foo(x: number): number {
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

  it("removes type assignments", () => {
    assertTypeScriptAndFlowResult(
      `
      type foo = number;
      const x: foo = 3;
    `,
      `"use strict";
      
      const x = 3;
    `,
    );
  });

  it("handles exported types", () => {
    assertTypeScriptAndFlowResult(
      `
      export type foo = number | string;
      export const x = 1;
    `,
      `"use strict";${ESMODULE_PREFIX}
      
       exports.x = 1;
    `,
    );
  });

  it("handles string literal types", () => {
    assertTypeScriptAndFlowResult(
      `
      function foo(x: "a"): string {
        return x;
      }
    `,
      `"use strict";
      function foo(x) {
        return x;
      }
    `,
    );
  });

  it("allows leading pipe operators in types", () => {
    assertTypeScriptAndFlowResult(
      `
      const x: | number | string = "Hello";
    `,
      `"use strict";
      const x = "Hello";
    `,
    );
  });

  it("allows nested generics with a fake right-shift token", () => {
    assertTypeScriptAndFlowResult(
      `
      const arr1: Array<Array<number> > = [[1]];
      const arr2: Array<Array<number>> = [[2]];
      const arr3: Array<Array<Array<number>>> = [[[3]]];
    `,
      `"use strict";
      const arr1 = [[1]];
      const arr2 = [[2]];
      const arr3 = [[[3]]];
    `,
    );
  });

  it("handles interface declarations and `export interface`", () => {
    assertTypeScriptAndFlowResult(
      `
      interface Cartesian { x: number; y: number; }
      export interface Polar { r: number; theta: number; }
    `,
      `"use strict";
      

    `,
    );
  });

  it("supports interface as an object key", () => {
    assertTypeScriptAndFlowResult(
      `
      const o = {
        interface: true,
      };
    `,
      `"use strict";
      const o = {
        interface: true,
      };
    `,
    );
  });

  it("properly removes optional parameter types", () => {
    assertTypeScriptAndFlowResult(
      `
      function foo(x?: number): string {
        return 'Hi!';
      }
    `,
      `"use strict";
      function foo(x) {
        return 'Hi!';
      }
    `,
    );
  });

  it("does not confuse type parameters with JSX", () => {
    assertTypeScriptAndFlowResult(
      `
      const f = <T>(t: T): number => 3;
    `,
      `"use strict";
      const f = (t) => 3;
    `,
    );
  });

  it("does not confuse type parameters with JSX in type expressions", () => {
    assertTypeScriptAndFlowResult(
      `
      const f: <T>(t: T) => number = () => 3;
    `,
      `"use strict";
      const f = () => 3;
    `,
    );
  });

  it("supports class declarations with type parameters", () => {
    assertTypeScriptAndFlowResult(
      `
      class Foo<T> {}
    `,
      `"use strict";
      class Foo {}
    `,
    );
  });

  it("allows negative number literals within types", () => {
    assertTypeScriptAndFlowResult(
      `
      function foo(): -1 {
        return -1;
      }
    `,
      `"use strict";
      function foo() {
        return -1;
      }
    `,
    );
  });

  it("removes type parameters from class methods", () => {
    assertTypeScriptAndFlowResult(
      `
      class A {
        b<T>() {
        }
      }
    `,
      `"use strict";
      class A {
        b() {
        }
      }
    `,
    );
  });

  it("allows type aliases with fields with multiple type arguments", () => {
    assertTypeScriptAndFlowResult(
      `
      type A = {
        source: Map<B, C>,
      };
    `,
      `"use strict";
      


    `,
    );
  });

  it("handles classes with constructors", () => {
    assertTypeScriptAndFlowResult(
      `
      class A {
        constructor() {
        }
      }
    `,
      `"use strict";
      class A {
        constructor() {
        }
      }
    `,
    );
  });

  it("handles arrow functions with optional parameters", () => {
    assertTypeScriptAndFlowResult(
      `
      const f = (x?: number) => x + 1;
    `,
      `"use strict";
      const f = (x) => x + 1;
    `,
    );
  });

  it("handles classes extending classes with parameterized types", () => {
    assertTypeScriptAndFlowResult(
      `
      class A extends B<C> {}
    `,
      `"use strict";
      class A extends B {}
    `,
    );
  });
});
