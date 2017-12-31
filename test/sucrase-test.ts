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
      `${PREFIX}
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
      `${PREFIX}
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
      `${PREFIX}
      if (foo.case === 3) {
      }
    `,
      ["jsx", "imports", "typescript"],
    );
  });
});
