import * as assert from "assert";
import {parse} from "../sucrase-babylon";
import {IdentifierRole, Token} from "../sucrase-babylon/tokenizer";
import {TokenType as tt} from "../sucrase-babylon/tokenizer/types";

type SimpleToken = Token & {label?: string};
type TokenExpectation = {[K in keyof SimpleToken]?: SimpleToken[K]};

function assertTokens(code: string, expectedTokens: Array<TokenExpectation>): void {
  const tokens: Array<SimpleToken> = parse(code, ["jsx"]).tokens;
  assert.equal(tokens.length, expectedTokens.length);
  const projectedTokens = tokens.map((token, i) => {
    const result = {};
    for (const key of Object.keys(expectedTokens[i])) {
      result[key] = token[key];
    }
    return result;
  });
  assert.deepEqual(projectedTokens, expectedTokens);
}

describe("tokens", () => {
  it("properly provides identifier roles for const, let, and var", () => {
    assertTokens(
      `
      const x = 1;
      let y = 2;
      var z = 3;
    `,
      [
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
      function f() {
      }
      class C {
      }
    `,
      [
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
      [{type: tt.num}, {type: tt.plusMin}, {type: tt.regexp}, {type: tt.eof}],
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
        {type: tt.plusMin},
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
});
