import {
  ESMODULE_PREFIX,
  IMPORT_DEFAULT_PREFIX,
  IMPORT_WILDCARD_PREFIX,
  JSX_PREFIX,
} from "./prefixes";
import {assertResult, devProps} from "./util";

function assertTypeScriptResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "imports", "typescript"]});
}

function assertTypeScriptESMResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "typescript"]});
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
      import B from 'b';
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
      }
    `,
      `"use strict";
      var Foo; (function (Foo) {
        const A = 15.5; Foo[Foo["A"] = A] = "A";
        Foo[Foo["Hello world"] = A / 2] = "Hello world";
        Foo[Foo[""] = (A / 2) + 1] = "";
        const D = "foo".length; Foo[Foo["D"] = D] = "D";
        const E = D / D; Foo[Foo["E"] = E] = "E";
        Foo[Foo["debugger"] = 4] = "debugger";
        Foo[Foo["default"] = 7] = "default";
        Foo[Foo["!"] = E << E] = "!";
        Foo[Foo["\\n"] = (E << E) + 1] = "\\n";
        Foo[Foo[","] = ((E << E) + 1) + 1] = ",";
        Foo[Foo["'"] = (((E << E) + 1) + 1) + 1] = "'";
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
      `"use strict";${IMPORT_DEFAULT_PREFIX}${ESMODULE_PREFIX}
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
      `"use strict";${ESMODULE_PREFIX}
      var _MyVars = require('./MyVars'); Object.keys(_MyVars).filter(key => key !== 'default' && key !== '__esModule').forEach(key => { if (exports.hasOwnProperty(key)) { return; } Object.defineProperty(exports, key, {enumerable: true, get: () => _MyVars[key]}); });
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
});
