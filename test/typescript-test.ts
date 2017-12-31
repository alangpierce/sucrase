import {ESMODULE_PREFIX, PREFIX} from "./prefixes";
import {assertResult} from "./util";

function assertTypeScriptResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, ["jsx", "imports", "typescript"]);
}

describe("typescript transform", () => {
  it("removes type assertions using `as`", () => {
    assertTypeScriptResult(
      `
      const x = 0;
      console.log(x as string);
    `,
      `${PREFIX}
      const x = 0;
      console.log(x );
    `,
    );
  });

  it.skip("properly handles variables named 'as'", () => {
    assertTypeScriptResult(
      `
      const as = "Hello";
      console.log(as);
    `,
      `${PREFIX}
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
      `${PREFIX}
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
      `${PREFIX}
      class A {
        
        constructor() {;this.x = 1;
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
      `${PREFIX}
      class A extends B {
        
        constructor(a) {
          super(a);this.x = 1;;
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
      `${PREFIX}
      class A {constructor() { this.x = 1; }
        
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
      `${PREFIX}
      class A extends B {constructor(...args) { super(...args); this.x = 1; }
        
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
      `${PREFIX}
      class A extends B {constructor(...args2) { super(...args2); this.args = 1; }
        
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
      `${PREFIX}
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
      `${PREFIX}
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
      `${PREFIX}${ESMODULE_PREFIX}
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
      `${PREFIX}${ESMODULE_PREFIX}
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
      `${PREFIX}
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
      `${PREFIX}${ESMODULE_PREFIX}
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
      `${PREFIX}
      

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
      `${PREFIX}
      var _a = require('a'); var _a2 = _interopRequireDefault(_a);
      
      require('c');
      var _d = require('d'); var _d2 = _interopRequireDefault(_d);
      
      
      
      function f(a) {
        return a instanceof (0, _a2.default);
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
      `${PREFIX}
      class A {constructor() { this.f = function() {}; }
        
        
      }
    `,
    );
  });

  it("allows `export abstract class` syntax", () => {
    assertTypeScriptResult(
      `
      export abstract class A {}
    `,
      `${PREFIX}${ESMODULE_PREFIX}
       class A {} exports.A = A;
    `,
    );
  });

  it("handles type predicates when processing arrow functions", () => {
    assertTypeScriptResult(
      `
      values.filter((node): node is Node => node !== null);
    `,
      `${PREFIX}
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
      `${PREFIX}
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
      `${PREFIX}
      class A {constructor() { this[a + b] = 3;this[0] = 1;this["Hello, world"] = 2; }
        
        
        
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
      `${PREFIX}
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
      `${PREFIX}
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
        "!" = E << E,
        "\\n",
        ",",
        "'",
      }
    `,
      `${PREFIX}
      var Foo; (function (Foo) {
        const A = 15.5; Foo[Foo["A"] = A] = "A";
        Foo[Foo["Hello world"] = A / 2] = "Hello world";
        Foo[Foo[""] = (A / 2) + 1] = "";
        const D = "foo".length; Foo[Foo["D"] = D] = "D";
        const E = D / D; Foo[Foo["E"] = E] = "E";
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
      `${PREFIX}
      

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
      `${PREFIX}
      



    `,
    );
  });

  it("handles and removes `export declare class` syntax", () => {
    assertTypeScriptResult(
      `
      export declare class Foo {
      }
    `,
      `${PREFIX}
      

    `,
    );
  });
});
