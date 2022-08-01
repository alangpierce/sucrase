import type {Options} from "../src/Options";
import {
  CREATE_REQUIRE_PREFIX,
  CREATE_STAR_EXPORT_PREFIX,
  ESMODULE_PREFIX,
  IMPORT_DEFAULT_PREFIX,
  IMPORT_WILDCARD_PREFIX,
  JSX_PREFIX,
  NULLISH_COALESCE_PREFIX,
  OPTIONAL_CHAIN_PREFIX,
} from "./prefixes";
import {assertResult, devProps} from "./util";

function assertTypeScriptResult(
  code: string,
  expectedResult: string,
  options: Partial<Options> = {},
): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "imports", "typescript"], ...options});
}

function assertTypeScriptESMResult(
  code: string,
  expectedResult: string,
  options: Partial<Options> = {},
): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "typescript"], ...options});
}

function assertTypeScriptImportResult(
  code: string,
  {expectedCJSResult, expectedESMResult}: {expectedCJSResult: string; expectedESMResult: string},
): void {
  assertTypeScriptResult(code, expectedCJSResult);
  assertTypeScriptESMResult(code, expectedESMResult);
}

describe("typescript transform", () => {
  it("removes type assertions using `as`", () => {
    assertTypeScriptResult(
      `
      const x = 0;
      console.log(x as string);
    `,
      `"use strict";
      const x = 0;
      console.log(x );
    `,
    );
  });

  it("properly handles variables named 'as'", () => {
    assertTypeScriptResult(
      `
      const as = "Hello";
      console.log(as);
    `,
      `"use strict";
      const as = "Hello";
      console.log(as);
    `,
    );
  });

  it("removes access modifiers from class methods and fields", () => {
    assertTypeScriptResult(
      `
      class A {
        private b: number;
        public c(): string {
          return "hi";
        }
      }
    `,
      `"use strict";
      class A {
        
         c() {
          return "hi";
        }
      }
    `,
    );
  });

  it("handles class field assignment with an existing constructor", () => {
    assertTypeScriptResult(
      `
      class A {
        x = 1;
        constructor() {
          this.y = 2;
        }
      }
    `,
      `"use strict";
      class A {
        __init() {this.x = 1}
        constructor() {;A.prototype.__init.call(this);
          this.y = 2;
        }
      }
    `,
    );
  });

  it("handles class field assignment after a constructor with super", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
        constructor(a) {
          super(a);
        }
      }
    `,
      `"use strict";
      class A extends B {
        __init() {this.x = 1}
        constructor(a) {
          super(a);A.prototype.__init.call(this);;
        }
      }
    `,
    );
  });

  it("handles class field assignment after a constructor with multiple super calls", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
        constructor(a) {
          super(a);
          super(b);
        }
      }
    `,
      `"use strict";
      class A extends B {
        __init() {this.x = 1}
        constructor(a) {
          super(a);A.prototype.__init.call(this);;
          super(b);
        }
      }
    `,
    );
  });

  it("handles class field assignment after a constructor with super and super method call", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
        constructor(a) {
          super(a);
          super.b();
        }
      }
    `,
      `"use strict";
      class A extends B {
        __init() {this.x = 1}
        constructor(a) {
          super(a);A.prototype.__init.call(this);;
          super.b();
        }
      }
    `,
    );
  });

  it("handles class field assignment after a constructor with invalid super method before super call", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
        constructor(a) {
          super.b();
          super(a);
        }
      }
    `,
      `"use strict";
      class A extends B {
        __init() {this.x = 1}
        constructor(a) {
          super.b();
          super(a);A.prototype.__init.call(this);;
        }
      }
    `,
    );
  });

  it("handles class field assignment after a constructor with super prop", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
        constructor(a) {
          super();
          super.a;
          super.b = 1;
        }
      }
    `,
      `"use strict";
      class A extends B {
        __init() {this.x = 1}
        constructor(a) {
          super();A.prototype.__init.call(this);;
          super.a;
          super.b = 1;
        }
      }
    `,
    );
  });

  it("handles class field assignment after a constructor with invalid super prop before super call", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
        constructor(a) {
          super.a;
          super.b = 1;
          super();
        }
      }
    `,
      `"use strict";
      class A extends B {
        __init() {this.x = 1}
        constructor(a) {
          super.a;
          super.b = 1;
          super();A.prototype.__init.call(this);;
        }
      }
    `,
    );
  });

  it("handles class field assignment with no constructor", () => {
    assertTypeScriptResult(
      `
      class A {
        x = 1;
      }
    `,
      `"use strict";
      class A {constructor() { A.prototype.__init.call(this); }
        __init() {this.x = 1}
      }
    `,
    );
  });

  it("handles class field assignment with no constructor in a subclass", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
      }
    `,
      `"use strict";
      class A extends B {constructor(...args) { super(...args); A.prototype.__init.call(this); }
        __init() {this.x = 1}
      }
    `,
    );
  });

  it("does not generate a conflicting name in a generated constructor", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        args = 1;
      }
    `,
      `"use strict";
      class A extends B {constructor(...args2) { super(...args2); A.prototype.__init.call(this); }
        __init() {this.args = 1}
      }
    `,
    );
  });

  it("handles readonly constructor initializers", () => {
    assertTypeScriptResult(
      `
      class A {
        constructor(readonly x: number) {
        }
      }
    `,
      `"use strict";
      class A {
        constructor( x) {;this.x = x;
        }
      }
    `,
    );
  });

  it("removes non-null assertion operator but not negation operator", () => {
    assertTypeScriptResult(
      `
      const x = 1!;
      const y = x!;
      const z = !x; 
      const a = (x)!(y);
      const b = x + !y;
    `,
      `"use strict";
      const x = 1;
      const y = x;
      const z = !x; 
      const a = (x)(y);
      const b = x + !y;
    `,
    );
  });

  it("handles static class methods", () => {
    assertTypeScriptResult(
      `
      export default class Foo {
        static run(): Result {
        }
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class Foo {
        static run() {
        }
      } exports.default = Foo;
    `,
    );
  });

  it("handles async class methods", () => {
    assertTypeScriptResult(
      `
      export default class Foo {
        async run(): Promise<Result> {
        }
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class Foo {
        async run() {
        }
      } exports.default = Foo;
    `,
    );
  });

  it("handles type predicates", () => {
    assertTypeScriptResult(
      `
      function foo(x: any): x is number {
        return x === 0;
      }
    `,
      `"use strict";
      function foo(x) {
        return x === 0;
      }
    `,
    );
  });

  it("handles type predicates involving this", () => {
    assertTypeScriptResult(
      `
      class A {
        foo(): this is B {
          return false;
        }
      }
    `,
      `"use strict";
      class A {
        foo() {
          return false;
        }
      }
    `,
    );
  });

  it("export default functions with type parameters", () => {
    assertTypeScriptResult(
      `
      export default function flatMap<T, U>(list: Array<T>, map: (element: T) => Array<U>): Array<U> {
        return list.reduce((memo, item) => memo.concat(map(item)), [] as Array<U>);
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       function flatMap(list, map) {
        return list.reduce((memo, item) => memo.concat(map(item)), [] );
      } exports.default = flatMap;
    `,
    );
  });

  it("handles interfaces using `extends`", () => {
    assertTypeScriptResult(
      `
      export interface A extends B {
      }
    `,
      `"use strict";
      

    `,
    );
  });

  it("removes non-bare import statements consisting of only types", () => {
    assertTypeScriptResult(
      `
      import A from 'a';
      import {default as B} from 'b';
      import 'c';
      import D from 'd';
      import 'd';
      import E from 'e';
      
      function f(a: A): boolean {
        return a instanceof A;
      }
      function g(b: B): boolean {
        return true;
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _a = require('a'); var _a2 = _interopRequireDefault(_a);
      
      require('c');
      var _d = require('d'); var _d2 = _interopRequireDefault(_d);
      
      
      
      function f(a) {
        return a instanceof _a2.default;
      }
      function g(b) {
        return true;
      }
    `,
    );
  });

  it("allows class fields with keyword names", () => {
    assertTypeScriptResult(
      `
      class A {
        readonly function: number;
        f: any = function() {};
      }
    `,
      `"use strict";
      class A {constructor() { A.prototype.__init.call(this); }
        
        __init() {this.f = function() {}}
      }
    `,
    );
  });

  it("allows `export abstract class` syntax", () => {
    assertTypeScriptResult(
      `
      export abstract class A {}
    `,
      `"use strict";${ESMODULE_PREFIX}
       class A {} exports.A = A;
    `,
    );
  });

  it("handles type predicates when processing arrow functions", () => {
    assertTypeScriptResult(
      `
      values.filter((node): node is Node => node !== null);
    `,
      `"use strict";
      values.filter((node) => node !== null);
    `,
    );
  });

  it("allows an explicit type parameter at function invocation time", () => {
    assertTypeScriptResult(
      `
      const f = f<number>(y);
      values.filter<Node>((node): node is Node => node !== null);
      const c = new Cache<number>();
    `,
      `"use strict";
      const f = f(y);
      values.filter((node) => node !== null);
      const c = new Cache();
    `,
    );
  });

  it("allows computed field names", () => {
    assertTypeScriptResult(
      `
      class A {
        [a + b] = 3;
        0 = 1;
        "Hello, world" = 2;
      }
    `,
      `"use strict";
      class A {constructor() { A.prototype.__init.call(this);A.prototype.__init2.call(this);A.prototype.__init3.call(this); }
        __init() {this[a + b] = 3}
        __init2() {this[0] = 1}
        __init3() {this["Hello, world"] = 2}
      }
    `,
    );
  });

  it("allows simple enums", () => {
    assertTypeScriptResult(
      `
      enum Foo {
        A,
        B,
        C
      }
    `,
      `"use strict";
      var Foo; (function (Foo) {
        const A = 0; Foo[Foo["A"] = A] = "A";
        const B = A + 1; Foo[Foo["B"] = B] = "B";
        const C = B + 1; Foo[Foo["C"] = C] = "C";
      })(Foo || (Foo = {}));
    `,
    );
  });

  it("allows simple string enums", () => {
    assertTypeScriptResult(
      `
      enum Foo {
        A = "eh",
        B = "bee",
        C = "sea",
      }
    `,
      `"use strict";
      var Foo; (function (Foo) {
        const A = "eh"; Foo["A"] = A;
        const B = "bee"; Foo["B"] = B;
        const C = "sea"; Foo["C"] = C;
      })(Foo || (Foo = {}));
    `,
    );
  });

  it("handles complex enum cases", () => {
    assertTypeScriptResult(
      `
      enum Foo {
        A = 15.5,
        "Hello world" = A / 2,
        "",
        "D" = "foo".length,
        E = D / D,
        "debugger" = 4,
        default = 7,
        "!" = E << E,
        "\\n",
        ",",
        "'",
        "f f" = "g g"
      }
    `,
      `"use strict";
      var Foo; (function (Foo) {
        const A = 15.5; Foo[Foo["A"] = A] = "A";
        Foo[Foo["Hello world"] = A / 2] = "Hello world";
        Foo[Foo[""] = Foo["Hello world"] + 1] = "";
        const D = "foo".length; Foo[Foo["D"] = D] = "D";
        const E = D / D; Foo[Foo["E"] = E] = "E";
        Foo[Foo["debugger"] = 4] = "debugger";
        Foo[Foo["default"] = 7] = "default";
        Foo[Foo["!"] = E << E] = "!";
        Foo[Foo["\\n"] = Foo["!"] + 1] = "\\n";
        Foo[Foo[","] = Foo["\\n"] + 1] = ",";
        Foo[Foo["'"] = Foo[","] + 1] = "'";
        Foo["f f"] = "g g";
      })(Foo || (Foo = {}));
    `,
    );
  });

  it("handles reserved literals when transforming enums", () => {
    assertTypeScriptESMResult(
      `
      enum Foo {
        true,
        false,
        null,
        undefined
      }
    `,
      `
      var Foo; (function (Foo) {
        Foo[Foo["true"] = 0] = "true";
        Foo[Foo["false"] = Foo["true"] + 1] = "false";
        Foo[Foo["null"] = Foo["false"] + 1] = "null";
        const undefined = Foo["null"] + 1; Foo[Foo["undefined"] = undefined] = "undefined";
      })(Foo || (Foo = {}));
    `,
    );
  });

  it("removes functions without bodies", () => {
    assertTypeScriptResult(
      `
      function foo(x: number);
      export function bar(s: string);
      function foo(x: any) {
        console.log(x);
      }
    `,
      `"use strict";
      

      function foo(x) {
        console.log(x);
      }
    `,
    );
  });

  it("handles and removes `declare module` syntax", () => {
    assertTypeScriptResult(
      `
      declare module "builtin-modules" {
        let result: string[];
        export = result;
      }
    `,
      `"use strict";
      



    `,
    );
  });

  it("handles and removes `declare module` syntax with an identifier", () => {
    assertTypeScriptResult(
      `
      declare module Builtins {
        let result: string[];
        export = result;
      }
    `,
      `"use strict";
      



    `,
    );
  });

  it("handles and removes `declare global` syntax", () => {
    assertTypeScriptResult(
      `
      declare global {
      }
    `,
      `"use strict";
      

    `,
    );
  });

  it("handles and removes `export declare class` syntax", () => {
    assertTypeScriptResult(
      `
      export declare class Foo {
      }
    `,
      `"use strict";
      

    `,
    );
  });

  it("allows a parameter named declare", () => {
    assertTypeScriptResult(
      `
      function foo(declare: boolean): string {
        return "Hello!";
      }
    `,
      `"use strict";
      function foo(declare) {
        return "Hello!";
      }
    `,
    );
  });

  it("properly allows modifier names as params", () => {
    assertTypeScriptResult(
      `
      class Foo {
        constructor(set, readonly) {}
        constructor(set: any, readonly: boolean) {}
      }
    `,
      `"use strict";
      class Foo {
        constructor(set, readonly) {}
        constructor(set, readonly) {}
      }
    `,
    );
  });

  it("properly handles method parameters named readonly", () => {
    assertTypeScriptResult(
      `
      class Foo {
        bar(readonly: number) {
          console.log(readonly);
        }
      }
    `,
      `"use strict";
      class Foo {
        bar(readonly) {
          console.log(readonly);
        }
      }
    `,
    );
  });

  it("handles export default abstract class", () => {
    assertTypeScriptResult(
      `
      export default abstract class Foo {
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class Foo {
      } exports.default = Foo;
    `,
    );
  });

  it("allows calling a function imported via `import *` with TypeScript enabled", () => {
    assertTypeScriptResult(
      `
      import * as f from './myFunc';
      console.log(f());
    `,
      `"use strict";${IMPORT_WILDCARD_PREFIX}
      var _myFunc = require('./myFunc'); var f = _interopRequireWildcard(_myFunc);
      console.log(f());
    `,
    );
  });

  it("treats const enums as regular enums", () => {
    assertTypeScriptResult(
      `
      const enum A {
        Foo,
        Bar,
      }
    `,
      `"use strict";
      var A; (function (A) {
        const Foo = 0; A[A["Foo"] = Foo] = "Foo";
        const Bar = Foo + 1; A[A["Bar"] = Bar] = "Bar";
      })(A || (A = {}));
    `,
    );
  });

  it("allows `export enum`", () => {
    assertTypeScriptResult(
      `
      export enum A {
        Foo,
        Bar,
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
      var A; (function (A) {
        const Foo = 0; A[A["Foo"] = Foo] = "Foo";
        const Bar = Foo + 1; A[A["Bar"] = Bar] = "Bar";
      })(A || (exports.A = A = {}));
    `,
    );
  });

  it("allows exported const enums", () => {
    assertTypeScriptResult(
      `
      export const enum A {
        Foo,
        Bar,
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
      var A; (function (A) {
        const Foo = 0; A[A["Foo"] = Foo] = "Foo";
        const Bar = Foo + 1; A[A["Bar"] = Bar] = "Bar";
      })(A || (exports.A = A = {}));
    `,
    );
  });

  it("properly handles simple abstract classes", () => {
    assertTypeScriptResult(
      `
      abstract class A {
      }
    `,
      `"use strict";
       class A {
      }
    `,
    );
  });

  it("properly handles exported abstract classes with abstract methods", () => {
    assertTypeScriptResult(
      `
      export abstract class A {
        abstract a();
        b(): void {
          console.log("hello");
        }
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class A {
        
        b() {
          console.log("hello");
        }
      } exports.A = A;
    `,
    );
  });

  it("does not prune imports that are then exported", () => {
    assertTypeScriptResult(
      `
      import A from 'a';
      export {A};
    `,
      `"use strict";${ESMODULE_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _a = require('a'); var _a2 = _interopRequireDefault(_a);
      exports.A = _a2.default;
    `,
    );
  });

  it("allows TypeScript CJS-style imports and exports", () => {
    assertTypeScriptResult(
      `
      import a = require('a');
      console.log(a);
      export = 3;
    `,
      `"use strict";
      const a = require('a');
      console.log(a);
      module.exports = 3;
    `,
    );
  });

  it("ignores injectCreateRequireForImportRequire when targeting CJS", () => {
    assertTypeScriptResult(
      `
      import a = require('a');
      console.log(a);
    `,
      `"use strict";
      const a = require('a');
      console.log(a);
    `,
      {injectCreateRequireForImportRequire: true},
    );
  });

  it("preserves import = require by default when targeting ESM", () => {
    assertTypeScriptESMResult(
      `
      import a = require('a');
      console.log(a);
    `,
      `
      const a = require('a');
      console.log(a);
    `,
    );
  });

  it("transforms import = require when targeting ESM and injectCreateRequireForImportRequire is enabled", () => {
    assertTypeScriptESMResult(
      `
      import a = require('a');
      console.log(a);
    `,
      `${CREATE_REQUIRE_PREFIX}
      const a = _require('a');
      console.log(a);
    `,
      {injectCreateRequireForImportRequire: true},
    );
  });

  it("allows this types in functions", () => {
    assertTypeScriptResult(
      `
      function foo(this: number, x: number): number {
        return this + x;
      }
    `,
      `"use strict";
      function foo( x) {
        return this + x;
      }
    `,
    );
  });

  it("supports export * in TypeScript", () => {
    assertTypeScriptResult(
      `
      export * from './MyVars';
    `,
      `"use strict";${ESMODULE_PREFIX}${CREATE_STAR_EXPORT_PREFIX}
      var _MyVars = require('./MyVars'); _createStarExport(_MyVars);
    `,
    );
  });

  it("properly handles access modifiers on constructors", () => {
    assertTypeScriptResult(
      `
      class A {
        x = 1;
        public constructor() {
        }
      }
    `,
      `"use strict";
      class A {
        __init() {this.x = 1}
         constructor() {;A.prototype.__init.call(this);
        }
      }
    `,
    );
  });

  it("allows old-style type assertions in non-JSX TypeScript", () => {
    assertResult(
      `
      const x = <number>3;
    `,
      `"use strict";
      const x = 3;
    `,
      {transforms: ["typescript", "imports"]},
    );
  });

  it("properly handles new declarations within interfaces", () => {
    assertTypeScriptResult(
      `
      interface Foo {
        new(): Foo;
      }
    `,
      `"use strict";
      


    `,
    );
  });

  it("handles code with an index signature", () => {
    assertTypeScriptResult(
      `
      const o: {[k: string]: number} = {
        a: 1,
        b: 2,
      }
    `,
      `"use strict";
      const o = {
        a: 1,
        b: 2,
      }
    `,
    );
  });

  it("handles assert and assign syntax", () => {
    assertTypeScriptResult(
      `
      (a as b) = c;
    `,
      `"use strict";
      (a ) = c;
    `,
    );
  });

  it("handles possible JSX ambiguities", () => {
    assertTypeScriptResult(
      `
      f<T>();
      new C<T>();
      type A = T<T>;
    `,
      `"use strict";
      f();
      new C();
      
    `,
    );
  });

  it("handles the 'unique' contextual keyword", () => {
    assertTypeScriptResult(
      `
      let y: unique symbol;
    `,
      `"use strict";
      let y;
    `,
    );
  });

  it("handles async arrow functions with rest params", () => {
    assertTypeScriptResult(
      `
      const foo = async (...args: any[]) => {}
      const bar = async (...args?: any[]) => {}
    `,
      `"use strict";
      const foo = async (...args) => {}
      const bar = async (...args) => {}
    `,
    );
  });

  it("handles conditional types", () => {
    assertTypeScriptResult(
      `
      type A = B extends C ? D : E;
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles the 'infer' contextual keyword in types", () => {
    assertTypeScriptResult(
      `
      type Element<T> = T extends (infer U)[] ? U : T;
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles definite assignment assertions in classes", () => {
    assertTypeScriptResult(
      `
      class A {
        foo!: number;
        getFoo(): number {
          return foo;
        }
      }
    `,
      `"use strict";
      class A {
        
        getFoo() {
          return foo;
        }
      }
    `,
    );
  });

  it("handles definite assignment assertions in classes with disableESTransforms", () => {
    assertTypeScriptResult(
      `
      class A {
        foo!: number;
      }
    `,
      `"use strict";
      class A {
        foo;
      }
    `,
      {disableESTransforms: true},
    );
  });

  it("handles definite assignment assertions on variables", () => {
    assertTypeScriptResult(
      `
      let x!: number;
      initX();
      console.log(x + 1);
    `,
      `"use strict";
      let x;
      initX();
      console.log(x + 1);
    `,
    );
  });

  it("handles definite assignment assertions on private fields in classes", () => {
    assertTypeScriptResult(
      `
      class A {
        #a!: number;
      }
    `,
      `"use strict";
      class A {
        #a;
      }
    `,
    );
  });

  it("handles definite assignment assertions on private fields in classes with disableESTransforms", () => {
    assertTypeScriptResult(
      `
      class A {
        #a!: number;
      }
    `,
      `"use strict";
      class A {
        #a;
      }
    `,
      {disableESTransforms: true},
    );
  });

  it("handles mapped type modifiers", () => {
    assertTypeScriptResult(
      `
      let map: { +readonly [P in string]+?: number; };
      let map2: { -readonly [P in string]-?: number };
    `,
      `"use strict";
      let map;
      let map2;
    `,
    );
  });

  it("does not prune imported identifiers referenced by JSX", () => {
    assertTypeScriptResult(
      `
      import React from 'react';
      
      import Foo from './Foo';
      import Bar from './Bar';
      import someProp from './someProp';
      import lowercaseComponent from './lowercaseComponent';
      import div from './div';
      
      const x: Bar = 3;
      function render(): JSX.Element {
        return (
          <div>
            <Foo.Bar someProp="a" />
            <lowercaseComponent.Thing />
          </div>
        );
      }
    `,
      `"use strict";${JSX_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      
      var _Foo = require('./Foo'); var _Foo2 = _interopRequireDefault(_Foo);
      
      
      var _lowercaseComponent = require('./lowercaseComponent'); var _lowercaseComponent2 = _interopRequireDefault(_lowercaseComponent);
      
      
      const x = 3;
      function render() {
        return (
          _react2.default.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 13}}
            , _react2.default.createElement(_Foo2.default.Bar, { someProp: "a", __self: this, __source: {fileName: _jsxFileName, lineNumber: 14}} )
            , _react2.default.createElement(_lowercaseComponent2.default.Thing, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 15}} )
          )
        );
      }
    `,
    );
  });

  it("does not elide a React import when the file contains a JSX fragment", () => {
    assertTypeScriptResult(
      `
      import React from 'react';
      function render(): JSX.Element {
        return <>Hello</>;
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      function render() {
        return _react2.default.createElement(_react2.default.Fragment, null, "Hello");
      }
    `,
    );
  });

  it("correctly takes JSX pragmas into account avoiding JSX import elision", () => {
    assertResult(
      `
      import {A, B, C, D} from 'foo';
      function render(): JSX.Element {
        return <>Hello</>;
      }
    `,
      `
      import {A, C,} from 'foo';
      function render() {
        return A.B(C.D, null, "Hello");
      }
    `,
      {transforms: ["typescript", "jsx"], jsxPragma: "A.B", jsxFragmentPragma: "C.D"},
    );
  });

  it("correctly takes JSX pragmas into account avoiding JSX import elision with fragments unused", () => {
    assertResult(
      `
      import {A, B, C, D} from 'foo';
      function render(): JSX.Element {
        return <span />;
      }
    `,
      `const _jsxFileName = "";
      import {A,} from 'foo';
      function render() {
        return A.B('span', {${devProps(4)}} );
      }
    `,
      {transforms: ["typescript", "jsx"], jsxPragma: "A.B", jsxFragmentPragma: "C.D"},
    );
  });

  it("handles TypeScript exported enums in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      export enum Foo {
        X = "Hello",
      }
    `,
      `
      export var Foo; (function (Foo) {
        const X = "Hello"; Foo["X"] = X;
      })(Foo || (Foo = {}));
    `,
    );
  });

  it("changes import = require to plain require in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      import a = require('a');
      a();
    `,
      `
      const a = require('a');
      a();
    `,
    );
  });

  it("properly transforms JSX in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      import React from 'react';
      const x = <Foo />;
    `,
      `${JSX_PREFIX}
      import React from 'react';
      const x = React.createElement(Foo, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 3}} );
    `,
    );
  });

  it("properly prunes TypeScript imported names", () => {
    assertTypeScriptESMResult(
      `
      import a, {n as b, m as c, d} from './e';
      import f, * as g from './h';
      a();
      const x: b = 3;
      const y = c + 1;
    `,
      `
      import a, { m as c,} from './e';

      a();
      const x = 3;
      const y = c + 1;
    `,
    );
  });

  it("properly handles optional class fields with default values", () => {
    assertTypeScriptResult(
      `
      class A {
        n?: number = 3;
      }
    `,
      `"use strict";
      class A {constructor() { A.prototype.__init.call(this); }
        __init() {this.n = 3}
      }
    `,
    );
  });

  // TODO: TypeScript 2.9 makes this required, so we can drop support for this syntax when we don't
  // need to support older versions of TypeScript.
  it("allows trailing commas after rest elements", () => {
    assertTypeScriptResult(
      `
      function foo(a, ...b,) {}
      const {a, ...b,} = c;
      const [a, ...b,] = c;
    `,
      `"use strict";
      function foo(a, ...b,) {}
      const {a, ...b,} = c;
      const [a, ...b,] = c;
    `,
    );
  });

  it("allows index signatures in classes", () => {
    assertTypeScriptResult(
      `
      export class Foo {
          f() {
          }
          [name: string]: any;
          x = 1;
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class Foo {constructor() { Foo.prototype.__init.call(this); }
          f() {
          }
          
          __init() {this.x = 1}
      } exports.Foo = Foo;
    `,
    );
  });

  it("allows destructured params in function types", () => {
    assertTypeScriptResult(
      `
      const f: ({a}: {a: number}) => void = () => {};
      const g: ([a]: Array<number>) => void = () => {};
      const h: ({a: {b: [c]}}: any) => void = () => {};
      const o: ({a: {b: c}}) = {};
    `,
      `"use strict";
      const f = () => {};
      const g = () => {};
      const h = () => {};
      const o = {};
    `,
    );
  });

  it("allows type arguments in JSX elements", () => {
    assertTypeScriptResult(
      `
      const e1 = <Foo<number> x="1" />
      const e2 = <Foo<string>><span>Hello</span></Foo>
    `,
      `"use strict";const _jsxFileName = "";
      const e1 = React.createElement(Foo, { x: "1", __self: this, __source: {fileName: _jsxFileName, lineNumber: 2}} )
      const e2 = React.createElement(Foo, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 3}}, React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 3}}, "Hello"))
    `,
    );
  });

  it("allows type arguments tagged templates", () => {
    assertTypeScriptResult(
      `
      f<T>\`\`;
      new C<T>
      \`\`;
    `,
      `"use strict";
      f\`\`;
      new C
      \`\`;
    `,
    );
  });

  it("allows export default interface", () => {
    assertTypeScriptResult(
      `
      export default interface A {}
    `,
      `"use strict";
      
    `,
    );
  });

  it("parses type arguments on decorators", () => {
    assertTypeScriptResult(
      `
      @decorator<string>()
      class Test {}
    `,
      `"use strict";
      @decorator()
      class Test {}
    `,
    );
  });

  it("parses type arguments on decorators that look like left shift", () => {
    assertTypeScriptResult(
      `
      @decorator<<T>() => void>()
      class Test {}
    `,
      `"use strict";
      @decorator()
      class Test {}
    `,
    );
  });

  it("properly parses tuple types with optional values", () => {
    assertTypeScriptResult(
      `
      let x: [string, number?, (string | number)?];
    `,
      `"use strict";
      let x;
    `,
    );
  });

  it("allows a rest element on a tuple type", () => {
    assertTypeScriptResult(
      `
      let x: [string, ...number[]];
    `,
      `"use strict";
      let x;
    `,
    );
  });

  it("allows rest elements in the middle of tuple types", () => {
    assertTypeScriptResult(
      `
      let x: [...number[], string];
      let y: [...[number, string], string];
    `,
      `"use strict";
      let x;
      let y;
    `,
    );
  });

  it("allows overloads for constructors", () => {
    assertTypeScriptResult(
      `
      class A {
        constructor(s: string)
        constructor(n: number)
        constructor(sn: string | number) {}
      }
    `,
      `"use strict";
      class A {
        

        constructor(sn) {}
      }
    `,
    );
  });

  it("properly elides CJS imports that only have value references in shadowed names", () => {
    assertTypeScriptResult(
      `
      import T from './T';
      
      const x: T = 3;

      function foo() {
        let T = 3;
        console.log(T);
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      
      
      const x = 3;

      function foo() {
        let T = 3;
        console.log(T);
      }
    `,
    );
  });

  it("properly elides ESM imports that only have value references in shadowed names", () => {
    assertTypeScriptESMResult(
      `
      import T, {a as b, c} from './T';
      import {d, e} from './foo';
      
      const x: T = 3;
      console.log(e);

      function foo() {
        let T = 3, b = 4, c = 5, d = 6;
        console.log(T, b, c, d);
      }
    `,
      `

      import { e} from './foo';
      
      const x = 3;
      console.log(e);

      function foo() {
        let T = 3, b = 4, c = 5, d = 6;
        console.log(T, b, c, d);
      }
    `,
    );
  });

  it("produces proper import statements when eliding ESM imported names", () => {
    assertTypeScriptESMResult(
      `
      import keep1, * as elide1 from "./m1";
      import keep2, * as keep3 from "./m2";
      import elide2, * as keep4 from "./m3";
      import keep5, {elide3} from "./m4";
      import keep6, {keep7} from "./m5";
      import elide4, {keep8} from "./m6";
      console.log(keep1, keep2, keep3, keep4, keep5, keep6, keep7, keep8);
    `,
      `
      import keep1 from "./m1";
      import keep2, * as keep3 from "./m2";
      import * as keep4 from "./m3";
      import keep5, {} from "./m4";
      import keep6, {keep7} from "./m5";
      import {keep8} from "./m6";
      console.log(keep1, keep2, keep3, keep4, keep5, keep6, keep7, keep8);
    `,
    );
  });

  it("handles import() types", () => {
    assertTypeScriptESMResult(
      `
      type T1 = import("./foo");
      type T2 = typeof import("./bar");
      type T3 = import("./bar").Point;
      type T4 = import("./utils").HashTable<number>;
    `,
      `
      



    `,
    );
  });

  it("properly compiles class fields with extends in a type parameter", () => {
    assertTypeScriptESMResult(
      `
      class A<B extends C> {
        x = 1;
      }
    `,
      `
      class A {constructor() { A.prototype.__init.call(this); }
        __init() {this.x = 1}
      }
    `,
    );
  });

  it("properly handles a declaration that looks like an assignment to an export (#401)", () => {
    assertTypeScriptResult(
      `
      export class Foo {}
      let foo: Foo = new Foo();
    `,
      `"use strict";${ESMODULE_PREFIX}
       class Foo {} exports.Foo = Foo;
      let foo = new Foo();
    `,
    );
  });

  it("properly handles comparison operators that look like JSX or generics (#408)", () => {
    assertTypeScriptResult(
      `
      a < b > c
    `,
      `"use strict";
      a < b > c
    `,
    );
  });

  it("elides type-only exports", () => {
    assertTypeScriptImportResult(
      `
      type T = number;
      type U = number;
      const w = 3;
      export {T, U as w};
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      

      const w = 3;
      
    `,
        expectedESMResult: `
      

      const w = 3;
      export {};
    `,
      },
    );
  });

  it("preserves non-type exports in ESM mode", () => {
    assertTypeScriptImportResult(
      `
      const T = 3;
      export {T as u};
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      const T = 3;
      exports.u = T;
    `,
        expectedESMResult: `
      const T = 3;
      export {T as u};
    `,
      },
    );
  });

  it("preserves type-and-non-type exports in ESM mode", () => {
    assertTypeScriptImportResult(
      `
      type T = number;
      const T = 3;
      export {T};
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      
      const T = 3;
      exports.T = T;
    `,
        expectedESMResult: `
      
      const T = 3;
      export {T};
    `,
      },
    );
  });

  it("elides unknown and type-only exports in CJS, and only elides type-only exports in ESM", () => {
    assertTypeScriptImportResult(
      `
      import A, {b, c as d} from './foo';
      enum E { X = 1 }
      class F {}
      interface G {}
      function h() {}
      import I = require('./i');
      type J = number;
      export {A, b, c, d, E, F, G, h, I, J};
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _foo = require('./foo'); var _foo2 = _interopRequireDefault(_foo);
      var E; (function (E) { const X = 1; E[E["X"] = X] = "X"; })(E || (E = {}));
      class F {}
      
      function h() {}
      const I = exports.I = require('./i');
      
      exports.A = _foo2.default; exports.b = _foo.b; exports.d = _foo.c; exports.E = E; exports.F = F; exports.h = h; exports.I = I;
    `,
        expectedESMResult: `
      import A, {b, c as d} from './foo';
      var E; (function (E) { const X = 1; E[E["X"] = X] = "X"; })(E || (E = {}));
      class F {}
      
      function h() {}
      const I = require('./i');
      
      export {A, b, c, d, E, F, h, I,};
    `,
      },
    );
  });

  it("preserves exported variables assigned with a destructure", () => {
    assertTypeScriptImportResult(
      `
      const o = {x: 1};
      const {x} = o;
      const {x: y} = o;
      type z = number;
      export {x, y, z};
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      const o = {x: 1};
      const {x} = o;
      const {x: y} = o;
      
      exports.x = x; exports.y = y;
    `,
        expectedESMResult: `
      const o = {x: 1};
      const {x} = o;
      const {x: y} = o;
      
      export {x, y,};
    `,
      },
    );
  });

  it("elides export default when the value is an identifier declared as a type", () => {
    assertTypeScriptImportResult(
      `
      type T = number;
      export default T;
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      
      ;
    `,
        expectedESMResult: `
      
      ;
    `,
      },
    );
  });

  it("does not elide export default when the value is a complex expression", () => {
    assertTypeScriptImportResult(
      `
      type T = number;
      export default T | U;
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      
      exports. default = T | U;
    `,
        expectedESMResult: `
      
      export default T | U;
    `,
      },
    );
  });

  it("does not elide export default when the value is used as a binding within a type", () => {
    assertTypeScriptImportResult(
      `
      type f = (x: number) => void;
      export default x;
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      
      exports. default = x;
    `,
        expectedESMResult: `
      
      export default x;
    `,
      },
    );
  });

  it("preserves export default when the value is an unknown identifier", () => {
    assertTypeScriptImportResult(
      `
      export default window;
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      exports. default = window;
    `,
        expectedESMResult: `
      export default window;
    `,
      },
    );
  });

  it("preserves export default when the value is a plain variable", () => {
    assertTypeScriptImportResult(
      `
      const x = 1;
      export default x;
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      const x = 1;
      exports. default = x;
    `,
        expectedESMResult: `
      const x = 1;
      export default x;
    `,
      },
    );
  });

  it("elides unused import = statements", () => {
    assertTypeScriptImportResult(
      `
      import A = require('A');
      import B = require('B');
      import C = A.C;
      B();
      const c: C = 2;
    `,
      {
        expectedCJSResult: `"use strict";
      ;
      const B = require('B');
      ;
      B();
      const c = 2;
    `,
        expectedESMResult: `
      ;
      const B = require('B');
      ;
      B();
      const c = 2;
    `,
      },
    );
  });

  // We don't support this for now since it needs a more complex implementation than we have
  // anywhere else, and ideally you would just write `const B = A.B;`, which works.
  it.skip("handles transitive references when eliding import = statements", () => {
    assertTypeScriptImportResult(
      `
      import A from 'A';
      import B = A.B;
      B();
    `,
      {
        expectedCJSResult: `"use strict";${ESMODULE_PREFIX}
      const A_1 = require("A");
      const B = A_1.default.B;
      B();
    `,
        expectedESMResult: `
      import A from 'A';
      const B = A.B;
      B();
    `,
      },
    );
  });

  it("handles newlines before class declarations", () => {
    assertTypeScriptResult(
      `
      abstract
      class A {}
      declare
      class B {}
      declare
      const x: number, y: string;
      declare
      const { x, y }: { x: number, y: number };
      declare
      interface I {}
      declare
      let x;
      declare
      var x;
      declare
      var x: any;
      module
      Foo
      {}
      namespace
      Foo
      {}
      type
      Foo = string;
    `,
      `"use strict";
      abstract
      class A {}
      declare
      class B {}
      declare
      const x, y;
      declare
      const { x, y };
      declare
      
      declare
      let x;
      declare
      var x;
      declare
      var x;
      module
      Foo
      {}
      namespace
      Foo
      {}
      type
      Foo = string;
    `,
    );
  });

  it("handles const contexts", () => {
    assertTypeScriptResult(
      `
      let x = 5 as const;
    `,
      `"use strict";
      let x = 5 ;
    `,
    );
  });

  it("handles the readonly type modifier", () => {
    assertTypeScriptResult(
      `
      let z: readonly number[];
      let z1: readonly [number, number];
    `,
      `"use strict";
      let z;
      let z1;
    `,
    );
  });

  it("allows template literal syntax for type literals", () => {
    assertTypeScriptResult(
      `
      let x: \`foo\`;
    `,
      `"use strict";
      let x;
    `,
    );
  });

  it("allows template literal substitutions in literal string types", () => {
    assertTypeScriptResult(
      `
      type Color = "red" | "blue";
      type Quantity = "one" | "two";
      
      type SeussFish = \`\${Quantity | Color} fish\`;
      const fish: SeussFish = "blue fish";
    `,
      `"use strict";
      



      const fish = "blue fish";
    `,
    );
  });

  it("allows complex template literal substitutions in literal string types", () => {
    // Uppercase<T> is an example of a type expression that isn't a valid value
    // expression, ensuring that we're using a type parser for the substitution.
    assertTypeScriptResult(
      `
      type EnthusiasticGreeting<T extends string> = \`\${Uppercase<T>}\`;
    `,
      `"use strict";
      
    `,
    );
  });

  it("allows bigint literal syntax for type literals", () => {
    assertTypeScriptResult(
      `
      let x: 10n;
      type T = { n: 20n, m: -30n };
      function f(arg: [40n]): 50n[] {};
    `,
      `"use strict";
      let x;
      
      function f(arg) {};
    `,
    );
  });

  it("allows decimal literal syntax for type literals", () => {
    assertTypeScriptResult(
      `
      let x: 10m;
      type T = { n: 20m, m: -30m };
      function f(arg: [40m]): 50m[] {};
    `,
      `"use strict";
      let x;
      
      function f(arg) {};
    `,
    );
  });

  it("allows private field syntax", () => {
    assertTypeScriptResult(
      `
      class Foo {
        readonly #x: number;
        readonly #y: number;
      }
    `,
      `"use strict";
      class Foo {
         #x;
         #y;
      }
    `,
    );
  });

  it("allows assertion signature syntax", () => {
    assertTypeScriptResult(
      `
      function assert(condition: any, msg?: string): asserts condition {
          if (!condition) {
              throw new AssertionError(msg)
          }
      }
    `,
      `"use strict";
      function assert(condition, msg) {
          if (!condition) {
              throw new AssertionError(msg)
          }
      }
    `,
    );
  });

  it("allows assertion signature syntax with is", () => {
    assertTypeScriptResult(
      `
      function assertIsDefined<T>(x: T): asserts x is NonNullable<T> {
        if (x == null) throw "oh no";
      }
    `,
      `"use strict";
      function assertIsDefined(x) {
        if (x == null) throw "oh no";
      }
    `,
    );
  });

  it("allows assertion signature syntax using this", () => {
    assertTypeScriptResult(
      `
      class Foo {
        isBar(): asserts this is Foo {}
        isBaz = (): asserts this is Foo => {}
      }
    `,
      `"use strict";
      class Foo {constructor() { Foo.prototype.__init.call(this); }
        isBar() {}
        __init() {this.isBaz = () => {}}
      }
    `,
    );
  });

  it("does not get confused by a user-defined type guard on a variable called asserts", () => {
    assertTypeScriptResult(
      `
      function checkIsDefined(asserts: any): asserts is NonNullable<T> {
        return false;
      }
    `,
      `"use strict";
      function checkIsDefined(asserts) {
        return false;
      }
    `,
    );
  });

  it("does not get confused by a return type called asserts", () => {
    assertTypeScriptResult(
      `
      function checkIsDefined(x: any): asserts {
        return false;
      }
    `,
      `"use strict";
      function checkIsDefined(x) {
        return false;
      }
    `,
    );
  });

  it("correctly parses optional chain calls with type arguments", () => {
    assertTypeScriptResult(
      `
      example.inner?.greet<string>()
    `,
      `"use strict";${OPTIONAL_CHAIN_PREFIX}
      _optionalChain([example, 'access', _ => _.inner, 'optionalAccess', _2 => _2.greet, 'call', _3 => _3()])
    `,
    );
  });

  it("allows optional async methods", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        async method?(val: string): Promise<void>;
      }
    `,
      `"use strict";
      class A extends B {
        
      }
    `,
    );
  });

  it("handles trailing commas at the end of tuple type with rest", () => {
    assertTypeScriptResult(
      `
      let x: [string, ...string[],]
    `,
      `"use strict";
      let x
    `,
    );
  });

  it("supports type arguments with optional chaining", () => {
    assertTypeScriptResult(
      `
      const x = a.b?.<number>();
    `,
      `"use strict";${OPTIONAL_CHAIN_PREFIX}
      const x = _optionalChain([a, 'access', _ => _.b, 'optionalCall', _2 => _2()]);
    `,
    );
  });

  it("parses and removes import type statements in CJS mode", () => {
    assertTypeScriptResult(
      `
      import type foo from 'foo';
      import bar from 'bar';
      console.log(foo, bar);
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      
      var _bar = require('bar'); var _bar2 = _interopRequireDefault(_bar);
      console.log(foo, _bar2.default);
    `,
    );
  });

  it("parses and removes named import type statements in CJS mode", () => {
    assertTypeScriptResult(
      `
      import type {foo} from 'foo';
      import {bar} from 'bar';
      console.log(foo, bar);
    `,
      `"use strict";
      
      var _bar = require('bar');
      console.log(foo, _bar.bar);
    `,
    );
  });

  it("parses and removes import type statements in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      import type foo from 'foo';
      import bar from 'bar';
      console.log(foo, bar);
    `,
      `

      import bar from 'bar';
      console.log(foo, bar);
    `,
    );
  });

  it("allows a default import named type in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      import type from './type';
      console.log(type);
    `,
      `
      import type from './type';
      console.log(type);
    `,
    );
  });

  it("allows a default import named type in CJS mode", () => {
    assertTypeScriptResult(
      `
      import type from './type';
      console.log(type);
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _type = require('./type'); var _type2 = _interopRequireDefault(_type);
      console.log(_type2.default);
    `,
    );
  });

  it("parses and removes named import type statements in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      import type {foo} from 'foo';
      import {bar} from 'bar';
      console.log(foo, bar);
    `,
      `

      import {bar} from 'bar';
      console.log(foo, bar);
    `,
    );
  });

  it("parses and removes export type statements in CJS mode", () => {
    assertTypeScriptResult(
      `
      import T from './T';
      let x: T;
      export type {T};
    `,
      `"use strict";${ESMODULE_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _T = require('./T'); var _T2 = _interopRequireDefault(_T);
      let x;
      ;
    `,
    );
  });

  it("parses and removes export type statements in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      import T from './T';
      let x: T;
      export type {T};
    `,
      `
      import T from './T';
      let x;
      ;
    `,
    );
  });

  it("parses and removes export type re-export statements in CJS mode", () => {
    assertTypeScriptResult(
      `
      export type {T} from './T';
      export type {T1 as TX, T2 as TY} from './OtherTs';
    `,
      `"use strict";${ESMODULE_PREFIX}
      ;
      ;
    `,
    );
  });

  it("parses and removes export type re-export statements in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      export type {T} from './T';
      export type {T1 as TX, T2 as TY} from './OtherTs';
    `,
      `
      ;
      ;
    `,
    );
  });

  it("properly handles default args in constructors", () => {
    assertTypeScriptResult(
      `
      class Foo {
        constructor(p = -1) {}
      }
    `,
      `"use strict";
      class Foo {
        constructor(p = -1) {}
      }
    `,
    );
  });

  it("properly emits assignments with multiple constructor initializers", () => {
    assertTypeScriptResult(
      `
      class Foo {
        constructor(a: number, readonly b: number, private c: number) {}
      }
    `,
      `"use strict";
      class Foo {
        constructor(a,  b,  c) {;this.b = b;this.c = c;}
      }
    `,
    );
  });

  it("properly removes class fields with declare", () => {
    assertTypeScriptResult(
      `
      class Foo {
          declare a: number;
          public declare b: number;
          declare public c: number;
          static declare d: number;
          declare static e: number;
          declare public static f: number;
          public declare static g: number;
          public static declare h: number;
          
          constructor() {
              console.log('Hi');
          }
      }
    `,
      `"use strict";
      class Foo {
          
          
          
          
          
          
          
          
          
          constructor() {
              console.log('Hi');
          }
      }
    `,
    );
  });

  it("properly removes types from catch clauses", () => {
    assertTypeScriptResult(
      `
      try {} catch (e: unknown) {}
      try {} catch (e: string | [...number, string]) {}
    `,
      `"use strict";
      try {} catch (e) {}
      try {} catch (e) {}
    `,
    );
  });

  it("properly removes labeled tuple types", () => {
    assertTypeScriptResult(
      `
      type T1 = [x: number, y?: number, ...rest: number[]];
      function f(args: [s?: string, ...ns: number[]]) {}
    `,
      `"use strict";
      
      function f(args) {}
    `,
    );
  });

  it("properly handles >= and ?? after `as`", () => {
    assertTypeScriptResult(
      `
      const x: string | number = 1;
      if (x as number >= 5) {}
      if (y as unknown ?? false) {}
    `,
      `"use strict";${NULLISH_COALESCE_PREFIX}
      const x = 1;
      if (x  >= 5) {}
      if (_nullishCoalesce(y , () => ( false))) {}
    `,
    );
  });

  it("handles simple template literal interpolations in types", () => {
    assertTypeScriptResult(
      `
      type A = \`make\${A | B}\`;
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles complex template literal interpolations in types", () => {
    assertTypeScriptResult(
      `
      type A = \`foo\${{ [k: string]: number}}\`;
    `,
      `"use strict";
      
    `,
    );
  });

  it("handles mapped type `as` clauses", () => {
    assertTypeScriptResult(
      `
      type MappedTypeWithNewKeys<T> = {
        [K in keyof T as NewKeyType]: T[K]
      };
      
      type RemoveKindField<T> = {
        [K in keyof T as Exclude<K, "kind">]: T[K]
      };
      
      type PickByValueType<T, U> = {
        [K in keyof T as T[K] extends U ? K : never]: T[K]
      };
    `,
      `"use strict";
      










    `,
    );
  });

  it("handles an arrow function with typed destructured params", () => {
    assertTypeScriptResult(
      `
      (
        { a, b }: T,
      ): T => {};
    `,
      `"use strict";
      (
        { a, b },
      ) => {};
    `,
    );
  });

  it("handles various forms of optional parameters in an interface", () => {
    assertTypeScriptResult(
      `
      interface B {
        foo([]?): void;
        bar({}, []?): any;
        baz(a: string, b: number, []?): void;
      }
    `,
      `"use strict";
      




    `,
    );
  });

  it("correctly handles methods and fields named declare", () => {
    assertTypeScriptResult(
      `
      class A {
        declare() {
        }
      }
      class B {
        static declare() {
        }
      }
      class C {
        declare = 2;
      }
    `,
      `"use strict";
      class A {
        declare() {
        }
      }
      class B {
        static declare() {
        }
      }
      class C {constructor() { C.prototype.__init.call(this); }
        __init() {this.declare = 2}
      }
    `,
    );
  });

  it("correctly handles field declarations after function overloads", () => {
    assertTypeScriptResult(
      `
      class Class {
        method(a: number);
        method(a: unknown) {}
        declare field: number;
      }
    `,
      `"use strict";
      class Class {
        
        method(a) {}
        
      }
    `,
    );
  });

  it("correctly transforms enum expressions", () => {
    assertTypeScriptResult(
      `
      import A from './A';
      
      enum E {
        Foo = A.Foo,
        Bar = A.Bar,
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _A = require('./A'); var _A2 = _interopRequireDefault(_A);
      
      var E; (function (E) {
        const Foo = _A2.default.Foo; E[E["Foo"] = Foo] = "Foo";
        const Bar = _A2.default.Bar; E[E["Bar"] = Bar] = "Bar";
      })(E || (E = {}));
    `,
    );
  });

  it("does not handle a module declaration split by newlines", () => {
    // See https://github.com/babel/babel/issues/12773 , the proper parsing of
    // this code is to treat each line as separate valid JS.
    assertTypeScriptESMResult(
      `
      declare
      module
      "A"
      {}
    `,
      `
      declare
      module
      "A"
      {}
    `,
    );
  });

  it("allows and removes namespace statements", () => {
    assertTypeScriptESMResult(
      `
      namespace foo {}
    `,
      `
      
    `,
    );
  });

  it("allows and removes export namespace statements", () => {
    assertTypeScriptESMResult(
      `
      export namespace foo {}
    `,
      `
      
    `,
    );
  });

  it("allows and removes module statements", () => {
    assertTypeScriptESMResult(
      `
      module foo {}
    `,
      `
      
    `,
    );
  });

  it("allows and removes export module statements", () => {
    assertTypeScriptESMResult(
      `
      export module foo {}
    `,
      `
      
    `,
    );
  });

  it("handles abstract constructor signatures", () => {
    assertTypeScriptESMResult(
      `
      let x: abstract new () => void = X;
    `,
      `
      let x = X;
    `,
    );
  });

  it("handles import type =", () => {
    assertTypeScriptESMResult(
      `
      import type A = require("A");
    `,
      `
      ;
    `,
    );
  });

  it("handles importing an identifier named type", () => {
    assertTypeScriptESMResult(
      `
      import type = require("A");
    `,
      `
      ;
    `,
    );
  });

  it("handles export import type =", () => {
    assertTypeScriptESMResult(
      `
      export import type B = require("B");
    `,
      `
      ;
    `,
    );
  });

  it("handles type-only import specifiers", () => {
    assertTypeScriptESMResult(
      `
      import {type Foo, Bar} from "A";
      function f(): Foo {}
      console.log(Bar);
    `,
      `
      import { Bar} from "A";
      function f() {}
      console.log(Bar);
    `,
    );
  });

  it("elides TS imports consisting of only named type imports", () => {
    assertTypeScriptESMResult(
      `
      import {type Foo, type Bar} from "A";
      console.log(Foo);
    `,
      `

      console.log(Foo);
    `,
    );
  });

  it("elides TS type exports in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      class A {}
      class C {}
      class B {}
      export {type A, B, type C as D};
    `,
      `
      class A {}
      class C {}
      class B {}
      export { B,};
    `,
    );
  });

  it("elides TS type exports in CJS mode", () => {
    assertTypeScriptResult(
      `
      class A {}
      class C {}
      class B {}
      export {type A, B, type C as D};
    `,
      `"use strict";${ESMODULE_PREFIX}
      class A {}
      class C {}
      class B {}
      exports.B = B;
    `,
    );
  });

  it("elides ESM type imports used in a value context", () => {
    assertTypeScriptESMResult(
      `
      import {type Foo, type Bar as Baz} from "A";
      console.log(Foo);
      console.log(Bar);
      console.log(Baz);
    `,
      `

      console.log(Foo);
      console.log(Bar);
      console.log(Baz);
    `,
    );
  });

  it("preserves CJS value usage of names defined via a type import", () => {
    assertTypeScriptResult(
      `
      import {type Foo, type Bar as Baz} from "A";
      console.log(Foo);
      console.log(Bar);
      console.log(Baz);
    `,
      `"use strict";
      
      console.log(Foo);
      console.log(Bar);
      console.log(Baz);
    `,
    );
  });

  it("removes re-exported types in ESM mode", () => {
    assertTypeScriptESMResult(
      `
      import {type T, type U, V} from './foo';
      export {T};
      export {U as foo};
      export {V};
    `,
      `
      import { V} from './foo';
      export {};
      export {};
      export {V};
    `,
    );
  });

  it("removes re-exported types in CJS mode", () => {
    assertTypeScriptResult(
      `
      import {type T, type U, V} from './foo';
      export {T};
      export {U as foo};
      export {V};
    `,
      `"use strict";${ESMODULE_PREFIX}
      var _foo = require('./foo');
      
      
      exports.V = _foo.V;
    `,
    );
  });

  it("allows type imports of keyword names", () => {
    assertTypeScriptESMResult(
      `
      import {type default as Foo} from './Foo';
    `,
      `

    `,
    );
  });

  it("allows static index signatures", () => {
    assertTypeScriptESMResult(
      `
      class C {
        static [x: string]: any;
      }
    `,
      `
      class C {
        
      }
    `,
    );
  });

  it("allows static index signatures with other modifiers", () => {
    assertTypeScriptESMResult(
      `
      class C {
        static readonly [x: string]: any;
      }
    `,
      `
      class C {
        
      }
    `,
    );
  });

  it("allows static index signatures not starting with static", () => {
    assertTypeScriptESMResult(
      `
      class C {
        readonly static [x: string]: any;
      }
    `,
      `
      class C {
        
      }
    `,
    );
  });

  it("allows and removes the override keyword on class methods", () => {
    assertTypeScriptESMResult(
      `
      class A extends B {
        override method1(): void {}
        public override method2(): void {}
        override public method3(): void {}
        override field1 = 1;
        static override field2 = 2;
      }
    `,
      `
      class A extends B {constructor(...args) { super(...args); A.prototype.__init.call(this); }
         method1() {}
          method2() {}
          method3() {}
         __init() {this.field1 = 1}
        static  __initStatic() {this.field2 = 2}
      } A.__initStatic();
    `,
    );
  });

  it("allows override on constructor params", () => {
    assertTypeScriptESMResult(
      `
      class A extends B {
        constructor(override foo: string) {
        }
      }
    `,
      `
      class A extends B {
        constructor( foo) {;this.foo = foo;
        }
      }
    `,
    );
  });

  it("allows getters and setters on interfaces and object types", () => {
    assertTypeScriptESMResult(
      `
      interface A {
        get foo(): string;
        set foo(s: string);
      }
      type T = {
        get bar(): number;
        set bar(n: number);
      }
    `,
      `
      







    `,
    );
  });

  it("allows keys named get and set", () => {
    assertTypeScriptESMResult(
      `
      type T = {
        get: 3,
        set: 4,
      }
    `,
      `
      



    `,
    );
  });

  it("transforms constructor initializers even with disableESTransforms", () => {
    assertTypeScriptESMResult(
      `
      class A extends B {
        constructor(readonly x, private y = 2, z: number = 3) {
          console.log("Hello");
          super();
          console.log("World");
        }
      }
    `,
      `
      class A extends B {
        constructor( x,  y = 2, z = 3) {
          console.log("Hello");
          super();this.x = x;this.y = y;;
          console.log("World");
        }
      }
    `,
      {disableESTransforms: true},
    );
  });

  it("removes types from class fields with disableESTransforms", () => {
    assertTypeScriptESMResult(
      `
      class A {
        x: number = 3;
        static y: string = "Hello";
        z: boolean;
        static s: unknown;
      }
    `,
      `
      class A {
        x = 3;
        static y = "Hello";
        z;
        static s;
      }
    `,
      {disableESTransforms: true},
    );
  });

  it("removes declare fields with disableESTransforms", () => {
    assertTypeScriptESMResult(
      `
      class A {
        abstract readonly a: number;
        declare b: string;
        declare static c: string;
        static declare d: string;
        readonly e: string;
        private f: number;
        public g: string = 'hello';
      }
    `,
      `
      class A {
        ;
        ;
        ;
        ;
         e;
         f;
         g = 'hello';
      }
    `,
      {disableESTransforms: true},
    );
  });

  it("doesn't get confused by += within an arrow function in a ternary", () => {
    // https://github.com/alangpierce/sucrase/issues/666
    assertResult(
      `
      0 ? a => (a += 0) : a => 0
    `,
      `
      0 ? a => (a += 0) : a => 0
    `,
      {transforms: ["typescript"]},
    );
  });

  it("doesn't get confused by parenthesized arrow/ternary combination", () => {
    // Regression test for code from https://github.com/babel/babel/issues/13644
    assertResult(
      `
      (a ? v => (sum += 1) : v => 0);
    `,
      `
      (a ? v => (sum += 1) : v => 0);
    `,
      {transforms: ["typescript"]},
    );
  });

  it("allows a line break before an `asserts` clause", () => {
    assertResult(
      `
      function assert(condition: any): 
      asserts condition {}
    `,
      `
      function assert(condition)
 {}
    `,
      {transforms: ["typescript"]},
    );
  });

  it("properly handles ASI for variable followed by exclamation point", () => {
    assertResult(
      `
      let a
      !function(){}()
    `,
      `
      let a
      !function(){}()
    `,
      {transforms: ["typescript"]},
    );
  });

  it("properly parses TS angle brackets that look like left shift", () => {
    assertResult(
      `
      f<<T>(value: T) => void>(g);
    `,
      `
      f(g);
    `,
      {transforms: ["typescript"]},
    );
  });

  it("properly parses actual left shift", () => {
    assertResult(
      `
      const x = f<<T>2;
    `,
      `
      const x = f<<T>2;
    `,
      {transforms: ["typescript"]},
    );
  });

  it("properly parses TS angle brackets that look like left shift in JSX", () => {
    assertResult(
      `
      const elem = <Foo<<T>() => void> />;
    `,
      `${JSX_PREFIX}
      const elem = React.createElement(Foo, {${devProps(2)}} );
    `,
      {transforms: ["typescript", "jsx"]},
    );
  });

  it("properly parses new expression with type arguments that look like left shift", () => {
    assertResult(
      `
      const x = new Foo<<T>() => void>;
    `,
      `
      const x = new Foo;
    `,
      {transforms: ["typescript"]},
    );
  });

  it("properly parses class with super type argument that looks like left shift", () => {
    assertResult(
      `
      class A extends B<<T>() => void> {}
    `,
      `
      class A extends B {}
    `,
      {transforms: ["typescript"]},
    );
  });

  it("properly parses class with implements type argument that looks like left shift", () => {
    assertResult(
      `
      class A implements B<<T>() => void> {}
    `,
      `
      class A  {}
    `,
      {transforms: ["typescript"]},
    );
  });

  it("handles >= as the end of a type parameter followed by assignment", () => {
    assertResult(
      `
      type T<U>=U;
      const a: Array<number>=[];
    `,
      `
      
      const a=[];
    `,
      {transforms: ["typescript"]},
    );
  });

  it("handles TS instantiation expressions", () => {
    assertResult(
      `
      const NumberSet = Set<number>;
      const foo = new NumberSet();
    `,
      `
      const NumberSet = Set;
      const foo = new NumberSet();
    `,
      {transforms: ["typescript"]},
    );
  });

  it("distinguishes between instantiation expressions and greater-than", () => {
    assertResult(
      `
      let notTypeArg = Array<number>3;
      let typeArg = (Array<number>);
      typeArg = ((Array<number>));
      typeArg = Array<number>();
      notTypeArg = Array<number>7;
      typeArg = Array<number>
      if (true) {}
      notTypeArg = Array<number>>3;
      notTypeArg = Array<number>true;
      notTypeArg = Array<number>!true;
      notTypeArg = Array<number>function foo() {};
    `,
      `
      let notTypeArg = Array<number>3;
      let typeArg = (Array);
      typeArg = ((Array));
      typeArg = Array();
      notTypeArg = Array<number>7;
      typeArg = Array
      if (true) {}
      notTypeArg = Array<number>>3;
      notTypeArg = Array<number>true;
      notTypeArg = Array<number>!true;
      notTypeArg = Array<number>function foo() {};
    `,
      {transforms: ["typescript"]},
    );
  });

  it("allows new instantiation expressions", () => {
    assertResult(
      `
      const a = new A < B > C;
      const b = new A<B>;
    `,
      `
      const a = new A < B > C;
      const b = new A;
    `,
      {transforms: ["typescript"]},
    );
  });

  it("allows typeof expressions with instantiation expression type arguments", () => {
    assertResult(
      `
      const f: typeof foo<number> = foo;
    `,
      `
      const f = foo;
    `,
      {transforms: ["typescript"]},
    );
  });

  it("allows instantiation expressions followed by ??", () => {
    assertResult(
      `
      const foo = a<b> ?? c;
    `,
      `${NULLISH_COALESCE_PREFIX}
      const foo = _nullishCoalesce(a, () => ( c));
    `,
      {transforms: ["typescript"]},
    );
  });

  it("allows extends constraints on infer type variables", () => {
    assertResult(
      `
      type FirstString<T> =
        T extends [infer S extends string, ...unknown[]]
            ? S
            : never;
    `,
      `
      



    `,
      {transforms: ["typescript"]},
    );
  });

  it("handles infer with a nested conditional type", () => {
    assertResult(
      `
      type A = T extends (infer U extends number ? U : T) ? U : T;
    `,
      `
      
    `,
      {transforms: ["typescript"]},
    );
  });

  it("properly disallows conditional types within extends type", () => {
    assertResult(
      `
      type A = T extends infer U extends number ? 1 : 0;
    `,
      `
      
    `,
      {transforms: ["typescript"]},
    );
  });

  it("allows nested conditional types within functions", () => {
    assertResult(
      `
      type A = T extends (x: A extends B ? C : D) => void ? 1 : 0;
    `,
      `
      
    `,
      {transforms: ["typescript"]},
    );
  });

  it("allows variance modifiers", () => {
    assertResult(
      `
      interface A<in T> {}
      interface B<out T> {}
      interface C<in out T> {}
      interface D<in out T extends number> {}
      interface E<out> {}
      interface F<out extends number> {}
    `,
      `
      





    `,
      {transforms: ["typescript"]},
    );
  });

  it("allows JSX that looks like variance modifiers", () => {
    assertResult(
      `
      <in T>() => {}</in>
    `,
      `${JSX_PREFIX}
      React.createElement('in', { T: true, ${devProps(2)}}, "() => "  )
    `,
      {transforms: ["typescript", "jsx"]},
    );
  });
});
