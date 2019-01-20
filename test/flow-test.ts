import {throws} from "assert";
import {transform} from "../src";
import {IMPORT_DEFAULT_PREFIX} from "./prefixes";
import {assertResult} from "./util";

function assertFlowResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "imports", "flow"]});
}

function assertFlowESMResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "flow"]});
}

describe("transform flow", () => {
  it("removes `import type` statements", () => {
    assertFlowResult(
      `
      import type {a} from 'b';
      import c from 'd';
      import type from 'e';
      import {f, type g} from 'h';
      import {type i, type j} from 'k';
      import type L from 'L';
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      
      var _d = require('d'); var _d2 = _interopRequireDefault(_d);
      var _e = require('e'); var _e2 = _interopRequireDefault(_e);
      var _h = require('h');
      
      
    `,
    );
  });

  it("does not mistake ? in types for a ternary operator", () => {
    assertFlowResult(
      `
      type A<T> = ?number;
      const f = (): number => 3;
    `,
      `"use strict";
      
      const f = () => 3;
    `,
    );
  });

  it("properly removes class property variance markers", () => {
    assertFlowResult(
      `
      class C {
        +foo: number;
        -bar: number;
      }
    `,
      `"use strict";
      class C {
        
        
      }
    `,
    );
  });

  it("recognizes arrow function types in variable declarations", () => {
    assertFlowResult(
      `
      const x: a => b = 2;
    `,
      `"use strict";
      const x = 2;
    `,
    );
  });

  it("recognizes arrow function types within parameters", () => {
    assertFlowResult(
      `
      function partition<T>(
        list: T[],
        test: (T, number, T[]) => ?boolean,
      ): [T[], T[]] {
        return [];
      }
    `,
      `"use strict";
      function partition(
        list,
        test,
      ) {
        return [];
      }
    `,
    );
  });

  it("recognizes exact object types", () => {
    assertFlowResult(
      `
      function foo(): {| x: number |} {
        return 3;
      }
    `,
      `"use strict";
      function foo() {
        return 3;
      }
    `,
    );
  });

  it("handles `export type * from`", () => {
    assertFlowResult(
      `
      export type * from "a";
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles `import ... typeof`", () => {
    assertFlowResult(
      `
      import {typeof a as b} from 'c';
      import typeof d from 'e';
    `,
      `"use strict";
      
      
    `,
    );
  });

  it("handles export type for individual types", () => {
    assertFlowResult(
      `
      export type {foo};
    `,
      `"use strict";
      
    `,
    );
  });

  it("properly parses import aliases with the flow parser", () => {
    assertFlowResult(
      `
      import { a as b } from "c";
    `,
      `"use strict";
      var _c = require('c');
    `,
    );
  });

  it("properly parses bounded type parameters", () => {
    assertFlowResult(
      `
      function makeWeakCache<A: B>(): void {
      }
    `,
      `"use strict";
      function makeWeakCache() {
      }
    `,
    );
  });

  it("properly handles star as an arrow type param", () => {
    assertFlowResult(
      `
      const x: *=>3 = null;
    `,
      `"use strict";
      const x = null;
    `,
    );
  });

  it("properly handles @@iterator in a declared class", () => {
    assertFlowResult(
      `
      declare class A {
        @@iterator(): Iterator<File>;
      }
    `,
      `"use strict";
      


    `,
    );
  });

  it("supports the implements keyword", () => {
    assertFlowResult(
      `
      declare class A implements B, C {}
    `,
      `"use strict";
      
    `,
    );
  });

  it("properly prunes flow imported names", () => {
    assertFlowESMResult(
      `
      import a, {type n as b, m as c, type d} from './e';
      import type f from './g';
    `,
      `
      import a, { m as c,} from './e';

    `,
    );
  });

  it("removes @flow directives", () => {
    assertFlowResult(
      `
      /* Hello @flow */
      // World @flow
      function foo(): number {
        return 3;
      }
      // @flow
    `,
      `"use strict";
      /* Hello  */
      // World 
      function foo() {
        return 3;
      }
      // 
    `,
    );
  });

  it("handles internal slot syntax", () => {
    assertFlowResult(
      `
      type T = { [[foo]]: X }
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles optional internal slot syntax", () => {
    assertFlowResult(
      `
      type T = { [[foo]]?: X }
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles flow type arguments", () => {
    assertFlowResult(
      `
      f<T>();
      new C<T>();
    `,
      `"use strict";
      f();
      new C();
    `,
    );
  });

  it("handles flow inline interfaces", () => {
    assertFlowResult(
      `
      type T = interface { p: string }
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles the proto keyword in class declarations", () => {
    assertFlowResult(
      `
      declare class A {
        proto x: T;
      }
    `,
      `"use strict";
      


    `,
    );
  });

  it("allows interface methods named 'static'", () => {
    assertFlowResult(
      `
      type T = interface { static(): number }
    `,
      `"use strict";
      
    `,
    );
  });

  // Note that we don't actually transform private fields at the moment, this just makes sure it
  // parses.
  it("allows private properties with type annotations", () => {
    assertFlowResult(
      `
      class A {
        #prop1: string;
        #prop2: number = value;
      }
    `,
      `"use strict";
      class A {constructor() { A.prototype.__init.call(this); }
        
        __init() {this.prop2 = value}
      }
    `,
    );
  });

  it("allows explicit inexact types", () => {
    assertFlowResult(
      `
      type T = {...};
      type U = {x: number, ...};
      type V = {x: number, ...V, ...U};
    `,
      `"use strict";
      


    `,
    );
  });

  it("allows function types as type parameters", () => {
    assertFlowResult(
      `
      type T = Array<(string) => number> 
    `,
      `"use strict";
       
    `,
    );
  });

  it("allows underscore type arguments in invocations", () => {
    assertFlowResult(
      `
      test<
        _,
        _,
        number,
        _,
        _,
      >();
      new test<_>(); 
    `,
      `"use strict";
      test





();
      new test(); 
    `,
    );
  });

  it("allows type casts in function invocations", () => {
    assertFlowResult(
      `
      foo(n : number);
    `,
      `"use strict";
      foo(n );
    `,
    );
  });

  it("does not infinite loop on declare module declarations", () => {
    throws(
      () =>
        transform(
          `
      declare module 'ReactFeatureFlags' {
        declare module.exports: any;
      }
    `,
          {transforms: ["flow"]},
        ),
      /SyntaxError: Unexpected token \(3:9\)/,
    );
  });

  it("correctly compiles class fields with flow `implements` classes", () => {
    assertFlowResult(
      `
      class Foo implements Bar {
        baz = () => {
      
        }
      }
    `,
      `"use strict";
      class Foo  {constructor() { Foo.prototype.__init.call(this); }
        __init() {this.baz = () => {
      
        }}
      }
    `,
    );
  });
});
