import * as assert from "assert";
import {parse} from "../src/parser";
import {IdentifierRole, Token} from "../src/parser/tokenizer";
import {TokenType as tt} from "../src/parser/tokenizer/types";

type SimpleToken = Token & {label?: string};
type TokenExpectation = {[K in keyof SimpleToken]?: SimpleToken[K]};

function assertTokens(code: string, expectedTokens: Array<TokenExpectation>): void {
  const tokens: Array<SimpleToken> = parse(code, true, true, false).tokens;
  assert.strictEqual(tokens.length, expectedTokens.length);
  const projectedTokens = tokens.map((token, i) => {
    const result = {};
    for (const key of Object.keys(expectedTokens[i])) {
      result[key] = token[key];
    }
    return result;
  });
  assert.deepStrictEqual(projectedTokens, expectedTokens);
}

describe("tokens", () => {
  it("properly provides identifier roles for const, let, and var", () => {
    assertTokens(
      `
      function f() {
        const x = 1;
        let y = 2;
        var z = 3;
      }
    `,
      [
        {type: tt._function},
        {type: tt.name, identifierRole: IdentifierRole.TopLevelDeclaration},
        {type: tt.parenL},
        {type: tt.parenR},
        {type: tt.braceL},
        {type: tt._const},
        {type: tt.name, identifierRole: IdentifierRole.BlockScopedDeclaration},
        {type: tt.eq},
        {type: tt.num},
        {type: tt.semi},
        {type: tt._let},
        {type: tt.name, identifierRole: IdentifierRole.BlockScopedDeclaration},
        {type: tt.eq},
        {type: tt.num},
        {type: tt.semi},
        {type: tt._var},
        {type: tt.name, identifierRole: IdentifierRole.FunctionScopedDeclaration},
        {type: tt.eq},
        {type: tt.num},
        {type: tt.semi},
        {type: tt.braceR},
        {type: tt.eof},
      ],
    );
  });

  it("identifies parameters as function-scoped declarations", () => {
    assertTokens(
      `
      function foo(a, b) {
      }
    `,
      [
        {type: tt._function},
        {type: tt.name},
        {type: tt.parenL},
        {type: tt.name, identifierRole: IdentifierRole.FunctionScopedDeclaration},
        {type: tt.comma},
        {type: tt.name, identifierRole: IdentifierRole.FunctionScopedDeclaration},
        {type: tt.parenR},
        {type: tt.braceL},
        {type: tt.braceR},
        {type: tt.eof},
      ],
    );
  });

  it("identifies catch assignees as block-scoped declarations", () => {
    assertTokens(
      `
      try {
      } catch (e) {
      }
    `,
      [
        {type: tt._try},
        {type: tt.braceL},
        {type: tt.braceR},
        {type: tt._catch},
        {type: tt.parenL},
        {type: tt.name, identifierRole: IdentifierRole.BlockScopedDeclaration},
        {type: tt.parenR},
        {type: tt.braceL},
        {type: tt.braceR},
        {type: tt.eof},
      ],
    );
  });

  it("treats functions as function-scoped and classes as block-scoped", () => {
    assertTokens(
      `
      function wrapper() {
        function f() {
        }
        class C {
        }
      }
    `,
      [
        {type: tt._function},
        {type: tt.name, identifierRole: IdentifierRole.TopLevelDeclaration},
        {type: tt.parenL},
        {type: tt.parenR},
        {type: tt.braceL},
        {type: tt._function},
        {type: tt.name, identifierRole: IdentifierRole.FunctionScopedDeclaration},
        {type: tt.parenL},
        {type: tt.parenR},
        {type: tt.braceL},
        {type: tt.braceR},
        {type: tt._class},
        {type: tt.name, identifierRole: IdentifierRole.BlockScopedDeclaration},
        {type: tt.braceL},
        {type: tt.braceR},
        {type: tt.braceR},
        {type: tt.eof},
      ],
    );
  });

  it("does not get confused by a regex-like sequence of divisions", () => {
    assertTokens(
      `
      5/3/1
    `,
      [
        {type: tt.num},
        {type: tt.slash},
        {type: tt.num},
        {type: tt.slash},
        {type: tt.num},
        {type: tt.eof},
      ],
    );
  });

  it("properly recognizes regexes that look like divisions", () => {
    assertTokens(
      `
      5 + /3/
    `,
      [{type: tt.num}, {type: tt.plus}, {type: tt.regexp}, {type: tt.eof}],
    );
  });

  it("properly recognizes less than and greater than that look like JSX", () => {
    assertTokens(
      `
      x<Hello>2
    `,
      [
        {type: tt.name},
        {type: tt.lessThan},
        {type: tt.name},
        {type: tt.greaterThan},
        {type: tt.num},
        {type: tt.eof},
      ],
    );
  });

  it("properly recognizes JSX in a normal expression context", () => {
    assertTokens(
      `
      x + < Hello / >
    `,
      [
        {type: tt.name},
        {type: tt.plus},
        {type: tt.jsxTagStart},
        {type: tt.jsxName},
        {type: tt.slash},
        {type: tt.jsxTagEnd},
        {type: tt.eof},
      ],
    );
  });

  it("properly recognizes nested JSX content", () => {
    assertTokens(
      `
      <div className="foo">
        Hello, world!
        <span className={bar} />
      </div>
    `,
      [
        {type: tt.jsxTagStart},
        {type: tt.jsxName},
        {type: tt.jsxName},
        {type: tt.eq},
        {type: tt.string},
        {type: tt.jsxTagEnd},
        {type: tt.jsxText},
        {type: tt.jsxTagStart},
        {type: tt.jsxName},
        {type: tt.jsxName},
        {type: tt.eq},
        {type: tt.braceL},
        {type: tt.name},
        {type: tt.braceR},
        {type: tt.slash},
        {type: tt.jsxTagEnd},
        {type: tt.jsxText},
        {type: tt.jsxTagStart},
        {type: tt.slash},
        {type: tt.jsxName},
        {type: tt.jsxTagEnd},
        {type: tt.eof},
      ],
    );
  });

  it("properly recognizes template strings", () => {
    assertTokens(
      `
      \`Hello, \${name} \${surname}\`
    `,
      [
        {type: tt.backQuote},
        {type: tt.template},
        {type: tt.dollarBraceL},
        {type: tt.name},
        {type: tt.braceR},
        {type: tt.template},
        {type: tt.dollarBraceL},
        {type: tt.name},
        {type: tt.braceR},
        {type: tt.template},
        {type: tt.backQuote},
        {type: tt.eof},
      ],
    );
  });

  it("distinguishes pre-increment and post-increment", () => {
    assertTokens(
      `
      a = b
      ++c
      d++
      e = f++
      g = ++h
    `,
      [
        {type: tt.name},
        {type: tt.eq},
        {type: tt.name},
        {type: tt.preIncDec},
        {type: tt.name},
        {type: tt.name},
        {type: tt.postIncDec},
        {type: tt.name},
        {type: tt.eq},
        {type: tt.name},
        {type: tt.postIncDec},
        {type: tt.name},
        {type: tt.eq},
        {type: tt.preIncDec},
        {type: tt.name},
        {type: tt.eof},
      ],
    );
  });

  it("properly parses keyword keys in TS class bodies", () => {
    assertTokens(
      `
      class A {
        abstract?: void;
        readonly!: void;
      }
    `,
      [
        {type: tt._class},
        {type: tt.name},
        {type: tt.braceL},
        {type: tt.name},
        {type: tt.question},
        {type: tt.colon},
        {type: tt._void},
        {type: tt.semi},
        {type: tt.name},
        {type: tt.bang},
        {type: tt.colon},
        {type: tt._void},
        {type: tt.semi},
        {type: tt.braceR},
        {type: tt.eof},
      ],
    );
  });

  it("properly parses import.meta", () => {
    assertTokens(
      `
      f = import.meta
    `,
      [
        {type: tt.name},
        {type: tt.eq},
        {type: tt.name},
        {type: tt.dot},
        {type: tt.name},
        {type: tt.eof},
      ],
    );
  });

  it("properly parses private properties", () => {
    assertTokens(
      `
      class {
        #x = 3
      }
      this.#x = 3
      delete this?.#x
      if (#x in obj) { }
    `,
      [
        {type: tt._class},
        {type: tt.braceL},
        {type: tt.hash},
        {type: tt.name, identifierRole: IdentifierRole.ObjectKey},
        {type: tt.eq},
        {type: tt.num},
        {type: tt.braceR},

        {type: tt._this},
        {type: tt.dot},
        {type: tt.hash},
        {type: tt.name},
        {type: tt.eq},
        {type: tt.num},

        {type: tt._delete},
        {type: tt._this},
        {type: tt.questionDot},
        {type: tt.hash},
        {type: tt.name},

        {type: tt._if},
        {type: tt.parenL},
        {type: tt.hash},
        {type: tt.name},
        {type: tt._in},
        {type: tt.name},
        {type: tt.parenR},
        {type: tt.braceL},
        {type: tt.braceR},
        {type: tt.eof},
      ],
    );
  });
});
