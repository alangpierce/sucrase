import {
  ASYNC_NULLISH_COALESCE_PREFIX,
  ASYNC_OPTIONAL_CHAIN_DELETE_PREFIX,
  ASYNC_OPTIONAL_CHAIN_PREFIX,
  ESMODULE_PREFIX,
  IMPORT_DEFAULT_PREFIX,
  NULLISH_COALESCE_PREFIX,
  OPTIONAL_CHAIN_DELETE_PREFIX,
  OPTIONAL_CHAIN_PREFIX,
} from "./prefixes";
import {assertOutput, assertResult} from "./util";

/**
 * Test cases that aren't associated with any particular transform.
 */
describe("sucrase", () => {
  it("handles keywords as object keys", () => {
    assertResult(
      `
      export const keywords = {
        break: new KeywordTokenType("break"),
        case: new KeywordTokenType("case", { beforeExpr }),
        catch: new KeywordTokenType("catch"),
        continue: new KeywordTokenType("continue"),
        debugger: new KeywordTokenType("debugger"),
        default: new KeywordTokenType("default", { beforeExpr }),
        do: new KeywordTokenType("do", { isLoop, beforeExpr }),
        else: new KeywordTokenType("else", { beforeExpr }),
        finally: new KeywordTokenType("finally"),
        for: new KeywordTokenType("for", { isLoop }),
        function: new KeywordTokenType("function", { startsExpr }),
        if: new KeywordTokenType("if"),
        return: new KeywordTokenType("return", { beforeExpr }),
        switch: new KeywordTokenType("switch"),
        throw: new KeywordTokenType("throw", { beforeExpr, prefix, startsExpr }),
        try: new KeywordTokenType("try"),
        var: new KeywordTokenType("var"),
        let: new KeywordTokenType("let"),
        const: new KeywordTokenType("const"),
        while: new KeywordTokenType("while", { isLoop }),
        with: new KeywordTokenType("with"),
        new: new KeywordTokenType("new", { beforeExpr, startsExpr }),
        this: new KeywordTokenType("this", { startsExpr }),
        super: new KeywordTokenType("super", { startsExpr }),
        class: new KeywordTokenType("class"),
        extends: new KeywordTokenType("extends", { beforeExpr }),
        export: new KeywordTokenType("export"),
        import: new KeywordTokenType("import", { startsExpr }),
        yield: new KeywordTokenType("yield", { beforeExpr, startsExpr }),
        null: new KeywordTokenType("null", { startsExpr }),
        true: new KeywordTokenType("true", { startsExpr }),
        false: new KeywordTokenType("false", { startsExpr }),
        in: new KeywordTokenType("in", { beforeExpr, binop: 7 }),
        instanceof: new KeywordTokenType("instanceof", { beforeExpr, binop: 7 }),
        typeof: new KeywordTokenType("typeof", { beforeExpr, prefix, startsExpr }),
        void: new KeywordTokenType("void", { beforeExpr, prefix, startsExpr }),
        delete: new KeywordTokenType("delete", { beforeExpr, prefix, startsExpr }),
      };
    `,
      `"use strict";${ESMODULE_PREFIX}
       const keywords = {
        break: new KeywordTokenType("break"),
        case: new KeywordTokenType("case", { beforeExpr }),
        catch: new KeywordTokenType("catch"),
        continue: new KeywordTokenType("continue"),
        debugger: new KeywordTokenType("debugger"),
        default: new KeywordTokenType("default", { beforeExpr }),
        do: new KeywordTokenType("do", { isLoop, beforeExpr }),
        else: new KeywordTokenType("else", { beforeExpr }),
        finally: new KeywordTokenType("finally"),
        for: new KeywordTokenType("for", { isLoop }),
        function: new KeywordTokenType("function", { startsExpr }),
        if: new KeywordTokenType("if"),
        return: new KeywordTokenType("return", { beforeExpr }),
        switch: new KeywordTokenType("switch"),
        throw: new KeywordTokenType("throw", { beforeExpr, prefix, startsExpr }),
        try: new KeywordTokenType("try"),
        var: new KeywordTokenType("var"),
        let: new KeywordTokenType("let"),
        const: new KeywordTokenType("const"),
        while: new KeywordTokenType("while", { isLoop }),
        with: new KeywordTokenType("with"),
        new: new KeywordTokenType("new", { beforeExpr, startsExpr }),
        this: new KeywordTokenType("this", { startsExpr }),
        super: new KeywordTokenType("super", { startsExpr }),
        class: new KeywordTokenType("class"),
        extends: new KeywordTokenType("extends", { beforeExpr }),
        export: new KeywordTokenType("export"),
        import: new KeywordTokenType("import", { startsExpr }),
        yield: new KeywordTokenType("yield", { beforeExpr, startsExpr }),
        null: new KeywordTokenType("null", { startsExpr }),
        true: new KeywordTokenType("true", { startsExpr }),
        false: new KeywordTokenType("false", { startsExpr }),
        in: new KeywordTokenType("in", { beforeExpr, binop: 7 }),
        instanceof: new KeywordTokenType("instanceof", { beforeExpr, binop: 7 }),
        typeof: new KeywordTokenType("typeof", { beforeExpr, prefix, startsExpr }),
        void: new KeywordTokenType("void", { beforeExpr, prefix, startsExpr }),
        delete: new KeywordTokenType("delete", { beforeExpr, prefix, startsExpr }),
      }; exports.keywords = keywords;
    `,
    );
  });

  it("allows keywords as object keys", () => {
    assertResult(
      `
      const o = {
        function: 3,
      };
    `,
      `"use strict";
      const o = {
        function: 3,
      };
    `,
    );
  });

  it("allows computed class method names", () => {
    assertResult(
      `
      class A {
        [b]() {
        }
      }
    `,
      `"use strict";
      class A {
        [b]() {
        }
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("supports getters and setters within classes", () => {
    assertResult(
      `
      class A {
        get foo(): number {
          return 3;
        }
        set bar(b: number) {
        }
      }
    `,
      `"use strict";
      class A {
        get foo() {
          return 3;
        }
        set bar(b) {
        }
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles properties named `case`", () => {
    assertResult(
      `
      if (foo.case === 3) {
      }
    `,
      `"use strict";
      if (foo.case === 3) {
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles labeled switch statements", () => {
    assertResult(
      `
      function foo() {
        outer: switch (a) {
          default:
            return 3;
        }
      }
    `,
      `"use strict";
      function foo() {
        outer: switch (a) {
          default:
            return 3;
        }
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles code with comments", () => {
    assertResult(
      `
      /**
       * This is a JSDoc comment.
       */
      function foo() {
        // This is a variable;
        const x = 3;
      }
    `,
      `"use strict";
      /**
       * This is a JSDoc comment.
       */
      function foo() {
        // This is a variable;
        const x = 3;
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles methods called `get` and `set` in a class", () => {
    assertResult(
      `
      class A {
        get() {
        }
        set() {
        }
      }
    `,
      `"use strict";
      class A {
        get() {
        }
        set() {
        }
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles async class methods", () => {
    assertResult(
      `
      class A {
        async foo() {
        }
      }
    `,
      `"use strict";
      class A {
        async foo() {
        }
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles generator class methods", () => {
    assertResult(
      `
      class A {
        *foo() {
        }
      }
    `,
      `"use strict";
      class A {
        *foo() {
        }
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles async generator class methods", () => {
    assertResult(
      `
      class C {
        async *m() {
          yield await 1;
        }
      }
    `,
      `"use strict";
      class C {
        async *m() {
          yield await 1;
        }
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("removes numeric separators from number literals", () => {
    assertResult(
      `
      const n = 1_000_000;
      const x = 12_34.56_78;
    `,
      `"use strict";
      const n = 1000000;
      const x = 1234.5678;
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("allows using the import keyword as an export", () => {
    assertResult(
      `
      const Import = null;
      export {Import as import};
    `,
      `"use strict";${ESMODULE_PREFIX}
      const Import = null;
      exports.import = Import;
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("properly converts static fields in statement classes", () => {
    assertResult(
      `
      class A {
        static x = 3;
      }
    `,
      `"use strict";
      class A {
        static __initStatic() {this.x = 3}
      } A.__initStatic();
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("properly converts static fields in expression classes", () => {
    assertResult(
      `
      const A = class {
        static x = 3;
      }
    `,
      `"use strict"; var _class;
      const A = (_class = class {
        static __initStatic() {this.x = 3}
      }, _class.__initStatic(), _class)
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("properly converts instance fields in expression classes", () => {
    assertResult(
      `
      const A = class {
        x = 3;
      }
    `,
      `"use strict"; var _class;
      const A = (_class = class {constructor() { _class.prototype.__init.call(this); }
        __init() {this.x = 3}
      }, _class)
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("properly converts exported classes with static fields", () => {
    assertResult(
      `
      export default class C {
        static x = 3;
      }
    `,
      `"use strict";${ESMODULE_PREFIX}
       class C {
        static __initStatic() {this.x = 3}
      } C.__initStatic(); exports.default = C;
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("properly resolves imported names in class fields", () => {
    assertResult(
      `
      import A from 'A';
      import B from 'B';
      class C {
        a = A;
        static b = B;
      }
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _A = require('A'); var _A2 = _interopRequireDefault(_A);
      var _B = require('B'); var _B2 = _interopRequireDefault(_B);
      class C {constructor() { C.prototype.__init.call(this); }
        __init() {this.a = _A2.default}
        static __initStatic() {this.b = _B2.default}
      } C.__initStatic();
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("puts the prefix after a shebang if necessary", () => {
    assertResult(
      `#!/usr/bin/env node
      console.log("Hello");
    `,
      `#!/usr/bin/env node
"use strict";      console.log("Hello");
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles optional catch binding", () => {
    assertResult(
      `
      const e = 3;
      try {
        console.log(e);
      } catch {
        console.log("Failed!");
      }
    `,
      `"use strict";
      const e = 3;
      try {
        console.log(e);
      } catch (e2) {
        console.log("Failed!");
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles array destructuring", () => {
    assertResult(
      `
      [a] = b;
    `,
      `"use strict";
      [a] = b;
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles prefix operators with a parenthesized operand", () => {
    assertResult(
      `
      const x = +(y);
    `,
      `"use strict";
      const x = +(y);
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles async object methods", () => {
    assertResult(
      `
      const o = {
        async f() {
        }
      };
    `,
      `"use strict";
      const o = {
        async f() {
        }
      };
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles strings with escaped quotes", () => {
    assertResult(
      `
      const s = 'ab\\'cd';
    `,
      `"use strict";
      const s = 'ab\\'cd';
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  // Decorators aren't yet supported in any runtime, so passing them through correctly is low priority.
  it.skip("handles decorated classes with static fields", () => {
    assertResult(
      `
      export default @dec class A {
        static x = 1;
      }
    `,
      `"use strict";
       @dec class A {
        
      } A.x = 1; exports.default = A;
    `,
      {transforms: ["jsx", "imports"]},
    );
  });

  it("handles logical assignment operators", () => {
    assertResult(
      `
      a &&= b;
      c ||= d;
      e ??= f;
    `,
      `"use strict";
      a &&= b;
      c ||= d;
      e ??= f;
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles decorators with a parenthesized expression", () => {
    assertResult(
      `
      class Bar{
        @(
          @classDec class { 
            @inner 
            innerMethod() {} 
          }
        )
        outerMethod() {}
      }
    `,
      `"use strict";
      class Bar{
        @(
          @classDec class { 
             
            innerMethod() {} 
          }
        )
        outerMethod() {}
      }
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles variables named createReactClass", () => {
    assertResult(
      `
      const createReactClass = 3;
    `,
      `"use strict";
      const createReactClass = 3;
    `,
      {transforms: ["jsx", "imports", "typescript"]},
    );
  });

  it("handles a static class field without a semicolon", () => {
    assertResult(
      `
      class A {
        static b = {}
        c () {
          const d = 1;
        }
      }
    `,
      `"use strict";
      class A {
        static __initStatic() {this.b = {}}
        c () {
          const d = 1;
        }
      } A.__initStatic();
    `,
      {transforms: ["imports"]},
    );
  });

  it("handles a class with class field bound methods", () => {
    assertResult(
      `
      export class Observer {
        update = (v: any) => {}
        complete = () => {}
        error = (err: any) => {}
      }
      
      export default function() {}
    `,
      `"use strict";${ESMODULE_PREFIX}
       class Observer {constructor() { Observer.prototype.__init.call(this);Observer.prototype.__init2.call(this);Observer.prototype.__init3.call(this); }
        __init() {this.update = (v) => {}}
        __init2() {this.complete = () => {}}
        __init3() {this.error = (err) => {}}
      } exports.Observer = Observer;
      
      exports. default = function() {}
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("removes semicolons from class bodies", () => {
    assertResult(
      `
      class A {
        ;
      }
    `,
      `"use strict";
      class A {
        
      }
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("removes comments within removed ranges rather than removing all whitespace", () => {
    assertResult(
      `
      interface A {
        // This is a comment.
      }
    `,
      `"use strict";
      


    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("handles static class fields with non-identifier names", () => {
    assertResult(
      `
      class C {
        static [f] = 3;
        static 5 = 'Hello';
        static "test" = "value";
      }
    `,
      `"use strict";
      class C {
        static __initStatic() {this[f] = 3}
        static __initStatic2() {this[5] = 'Hello'}
        static __initStatic3() {this["test"] = "value"}
      } C.__initStatic(); C.__initStatic2(); C.__initStatic3();
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("preserves line numbers for multiline fields", () => {
    assertResult(
      `
      class C {
        f() {
        }
        g = () => {
          console.log(1);
          console.log(2);
        }
      }
    `,
      `"use strict";
      class C {constructor() { C.prototype.__init.call(this); }
        f() {
        }
        __init() {this.g = () => {
          console.log(1);
          console.log(2);
        }}
      }
    `,
      {transforms: ["imports", "typescript"]},
    );
  });

  it("allows a class expression followed by a division operator", () => {
    assertResult(
      `
      x = class {} / foo
    `,
      `
      x = class {} / foo
    `,
      {transforms: []},
    );
  });

  it("handles newline after async in paren-less arrow function", () => {
    assertResult(
      `
      import async from 'foo';
      async
      x => x
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}
      var _foo = require('foo'); var _foo2 = _interopRequireDefault(_foo);
      _foo2.default
      x => x
    `,
      {transforms: ["imports"]},
    );
  });

  it("handles various parser edge cases around regexes", () => {
    assertResult(
      `
      for (const {a} of /b/) {}
      
      for (let {a} of /b/) {}
      
      for (var {a} of /b/) {}
      
      function *f() { yield
      {}/1/g
      }
      
      function* bar() { yield class {} }
      
      <>
      <Select prop={{ function: 'test' }} />
      <Select prop={{ class: 'test' }} />
      <Select prop={{ delete: 'test' }} />
      <Select prop={{ enum: 'test' }} />
      </>
    `,
      `const _jsxFileName = "";
      for (const {a} of /b/) {}
      
      for (let {a} of /b/) {}
      
      for (var {a} of /b/) {}
      
      function *f() { yield
      {}/1/g
      }
      
      function* bar() { yield class {} }
      
      React.createElement(React.Fragment, null
      , React.createElement(Select, { prop: { function: 'test' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}} )
      , React.createElement(Select, { prop: { class: 'test' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}} )
      , React.createElement(Select, { prop: { delete: 'test' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}} )
      , React.createElement(Select, { prop: { enum: 'test' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 18}} )
      )
    `,
      {transforms: ["jsx"]},
    );
  });

  it("handles an arrow function with trailing comma params", () => {
    assertResult(
      `
      const f = (
        x: number,
      ) => {
        return x + 1;
      }
    `,
      `
      const f = (
        x,
      ) => {
        return x + 1;
      }
    `,
      {transforms: ["typescript"]},
    );
  });

  it("handles a file with only a single identifier", () => {
    assertResult("a", "a", {transforms: []});
  });

  it("handles a file with only an assignment", () => {
    assertResult("a = 1", '"use strict";a = 1', {transforms: ["imports"]});
  });

  it("handles a standalone comment that looks like it could be a regex", () => {
    assertResult(
      `
      /*/*/;
    `,
      `
      /*/*/;
    `,
      {transforms: []},
    );
  });

  it("handles a comment that looks like it could be a regex after a string", () => {
    assertResult(
      `
      let thing = "sup" /*/*/;
    `,
      `
      let thing = "sup" /*/*/;
    `,
      {transforms: []},
    );
  });

  it("handles smart pipeline syntax", () => {
    assertResult(
      `
      value |> #
      value |> (#)
      value |> # + 1
      value |> (() => # + 1)
      function* f () {
        return x |> (yield #);
      }
    `,
      `
      value |> #
      value |> (#)
      value |> # + 1
      value |> (() => # + 1)
      function* f () {
        return x |> (yield #);
      }
    `,
      {transforms: []},
    );
  });

  it("handles partial application syntax", () => {
    assertResult(
      `
      foo(?)
    `,
      `
      foo(?)
    `,
      {transforms: []},
    );
  });

  it("handles V8 intrinsic syntax", () => {
    assertResult(
      `
      %DebugPrint(foo)
    `,
      `
      %DebugPrint(foo)
    `,
      {transforms: []},
    );
  });

  it("handles comments after trailing comma after elision", () => {
    assertResult(
      `
      function foo([foo, /* not used */, /* not used */]) {
      }
    `,
      `
      function foo([foo, /* not used */, /* not used */]) {
      }
    `,
      {transforms: []},
    );
  });

  it("transpiles basic nullish coalescing", () => {
    assertResult(
      `
      const x = a ?? b;
    `,
      `${NULLISH_COALESCE_PREFIX}
      const x = _nullishCoalesce(a, () => ( b));
    `,
      {transforms: []},
    );
  });

  it("transpiles nested nullish coalescing", () => {
    assertResult(
      `
      const x = a ?? b ?? c;
    `,
      `${NULLISH_COALESCE_PREFIX}
      const x = _nullishCoalesce(_nullishCoalesce(a, () => ( b)), () => ( c));
    `,
      {transforms: []},
    );
  });

  it("handles falsy LHS values correctly in nullish coalescing", () => {
    assertOutput(
      `
      setOutput([undefined ?? 7, null ?? 7, 0 ?? 7, false ?? 7, '' ?? 7]);
    `,
      [7, 7, 0, false, ""],
      {transforms: []},
    );
  });

  it("handles nested nullish coalescing operations", () => {
    assertOutput(
      `
      setOutput(undefined ?? 7 ?? null);
    `,
      7,
      {transforms: []},
    );
  });

  it("transpiles various optional chaining examples", () => {
    assertResult(
      `
      const x = a(b)?.c(d).e?.(f)?.[g(h)];
    `,
      `${OPTIONAL_CHAIN_PREFIX}
      const x = _optionalChain([a, 'call', _ => _(b), 'optionalAccess', _2 => _2.c, 'call', _3 => _3(d), 'access', _4 => _4.e, 'optionalCall', _5 => _5(f), 'optionalAccess', _6 => _6[g(h)]]);
    `,
      {transforms: []},
    );
  });

  it("correctly accesses a nested object when using optional chaining", () => {
    assertOutput(
      `
      const a = {b: {c: 15}}
      setOutput(a?.b.c ?? 10);
    `,
      15,
      {transforms: []},
    );
  });

  it("correctly falls back to a default when using optional chaining and nullish coalescing", () => {
    assertOutput(
      `
      const a = null;
      setOutput(a?.b.c ?? 10);
    `,
      10,
      {transforms: []},
    );
  });

  it("correctly transpiles nullish coalescing with an object right-hand side", () => {
    assertResult(
      `
      null ?? {x: 5}
    `,
      `${NULLISH_COALESCE_PREFIX}
      _nullishCoalesce(null, () => ( {x: 5}))
    `,
      {transforms: []},
    );
  });

  it("correctly handles nullish coalescing with an object on the right-hand side", () => {
    assertOutput(
      `
      const value = null ?? {x: 5};
      setOutput(value.x)
    `,
      5,
      {transforms: []},
    );
  });

  it("specifies the proper this when using optional chaining on a function call", () => {
    assertOutput(
      `
      class A {
        constructor(value) {
          this.value = value;
        }
        run() {
          setOutput(this.value + 3);
        }
      }
      const a = new A(5);
      a.doThing?.();
      a.run?.();
    `,
      8,
      {transforms: []},
    );
  });

  it("transpiles optional chain deletion", () => {
    assertResult(
      `
      delete a?.b.c;
    `,
      `${OPTIONAL_CHAIN_PREFIX}${OPTIONAL_CHAIN_DELETE_PREFIX}
       _optionalChainDelete([a, 'optionalAccess', _ => _.b, 'access', _2 => delete _2.c]);
    `,
      {transforms: []},
    );
  });

  it("correctly identifies last element of optional chain deletion", () => {
    assertResult(
      `
      delete a?.b[c?.c];
    `,
      `${OPTIONAL_CHAIN_PREFIX}${OPTIONAL_CHAIN_DELETE_PREFIX}
       _optionalChainDelete([a, 'optionalAccess', _ => _.b, 'access', _2 => delete _2[_optionalChain([c, 'optionalAccess', _3 => _3.c])]]);
    `,
      {transforms: []},
    );
  });

  it("deletes the property correctly with optional chain deletion", () => {
    assertOutput(
      `
      const o = {x: 1};
      delete o?.x;
      setOutput(o.hasOwnProperty('x'))
    `,
      false,
      {transforms: []},
    );
  });

  it("does not crash with optional chain deletion on null", () => {
    assertOutput(
      `
      const o = null;
      delete o?.x;
      setOutput(o)
    `,
      null,
      {transforms: []},
    );
  });

  it("correctly transforms async functions using await in an optional chain", () => {
    assertResult(
      `
      async function foo() {
        a?.b(await f())
      }
    `,
      `${ASYNC_OPTIONAL_CHAIN_PREFIX}
      async function foo() {
        await _asyncOptionalChain([a, 'optionalAccess', async _ => _.b, 'call', async _2 => _2(await f())])
      }
    `,
      {transforms: []},
    );
  });

  it("does not mistake an unrelated await keyword for an async optional chain", () => {
    assertResult(
      `
      function foo() {
        a?.b(async () => await f())
      }
    `,
      `${OPTIONAL_CHAIN_PREFIX}
      function foo() {
        _optionalChain([a, 'optionalAccess', _ => _.b, 'call', _2 => _2(async () => await f())])
      }
    `,
      {transforms: []},
    );
  });

  it("correctly transforms async functions using await in an optional chain deletion", () => {
    assertResult(
      `
      async function foo() {
        delete a?.[await f()];
      }
    `,
      `${ASYNC_OPTIONAL_CHAIN_PREFIX}${ASYNC_OPTIONAL_CHAIN_DELETE_PREFIX}
      async function foo() {
         await _asyncOptionalChainDelete([a, 'optionalAccess', async _ => _[await f()]]);
      }
    `,
      {transforms: []},
    );
  });

  it("correctly transforms async functions using await in nullish coalescing", () => {
    assertResult(
      `
      async function foo() {
        return a ?? await b();
      }
    `,
      `${ASYNC_NULLISH_COALESCE_PREFIX}
      async function foo() {
        return await _asyncNullishCoalesce(a, async () => ( await b()));
      }
    `,
      {transforms: []},
    );
  });

  it("allows super in an optional chain", () => {
    assertResult(
      `
      class A extends B {
        foo() {
          console.log(super.foo?.a);
        }
      }
    `,
      `${OPTIONAL_CHAIN_PREFIX}
      class A extends B {
        foo() {
          console.log(_optionalChain([super.foo, 'optionalAccess', _ => _.a]));
        }
      }
    `,
      {transforms: []},
    );
  });

  it("allows a super method call in an optional chain", () => {
    assertResult(
      `
      class A extends B {
        foo() {
          console.log(super.a()?.b);
        }
      }
    `,
      `${OPTIONAL_CHAIN_PREFIX}
      class A extends B {
        foo() {
          console.log(_optionalChain([super.a.bind(this), 'call', _ => _(), 'optionalAccess', _2 => _2.b]));
        }
      }
    `,
      {transforms: []},
    );
  });

  it("allows bigint literals as object keys", () => {
    assertResult(
      `
      const o = {0n: 0};
    `,
      `
      const o = {0n: 0};
    `,
      {transforms: []},
    );
  });

  it("allows decimal literals as object keys", () => {
    assertResult(
      `
      const o = {0m: 0};
    `,
      `
      const o = {0m: 0};
    `,
      {transforms: []},
    );
  });
});
