import {ESMODULE_PREFIX, PREFIX} from "./prefixes";
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
      `${PREFIX}${ESMODULE_PREFIX}
       const keywords = exports.keywords = {
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
    );
  });

  it("allows keywords as object keys", () => {
    assertResult(
      `
      const o = {
        function: 3,
      };
    `,
      `${PREFIX}
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
      ["jsx", "imports", "typescript"],
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
      ["jsx", "imports", "typescript"],
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
      ["jsx", "imports", "typescript"],
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
      ["jsx", "imports", "typescript"],
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
      ["jsx", "imports", "typescript"],
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
      ["jsx", "imports", "typescript"],
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
      ["jsx", "imports", "typescript"],
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
      ["jsx", "imports", "typescript"],
    );
  });
});
