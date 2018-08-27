import {ESMODULE_PREFIX, IMPORT_DEFAULT_PREFIX} from "./prefixes";
import {assertResult} from "./util";

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
      export {Import as import};
    `,
      `"use strict";${ESMODULE_PREFIX}
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
        
      } A.x = 3;
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
        
      }, _class.x = 3, _class)
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
        
      } C.x = 3; exports.default = C;
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
      class C {constructor() { this.a = _A2.default; }
        
        
      } C.b = _B2.default;
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
        
        c () {
          const d = 1;
        }
      } A.b = {};
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
       class Observer {constructor() { this.update = (v) => {};this.complete = () => {};this.error = (err) => {}; }
        
        
        
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
});
