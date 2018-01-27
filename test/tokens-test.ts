import * as assert from "assert";
import {parse} from "../sucrase-babylon";
import {IdentifierRole, Token} from "../sucrase-babylon/tokenizer";

type SimpleToken = Token & {label?: string};
type TokenExpectation = {[K in keyof SimpleToken]?: SimpleToken[K]};

function assertTokens(code: string, expectedTokens: Array<TokenExpectation>): void {
  const tokens: Array<SimpleToken> = parse(code, ["jsx"]).tokens;
  for (const token of tokens) {
    token.label = token.type.label;
  }
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
        {label: "const"},
        {label: "name", identifierRole: IdentifierRole.BlockScopedDeclaration},
        {label: "="},
        {label: "num"},
        {label: ";"},
        {label: "let"},
        {label: "name", identifierRole: IdentifierRole.BlockScopedDeclaration},
        {label: "="},
        {label: "num"},
        {label: ";"},
        {label: "var"},
        {label: "name", identifierRole: IdentifierRole.FunctionScopedDeclaration},
        {label: "="},
        {label: "num"},
        {label: ";"},
        {label: "eof"},
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
        {label: "function"},
        {label: "name"},
        {label: "("},
        {label: "name", identifierRole: IdentifierRole.FunctionScopedDeclaration},
        {label: ","},
        {label: "name", identifierRole: IdentifierRole.FunctionScopedDeclaration},
        {label: ")"},
        {label: "{"},
        {label: "}"},
        {label: "eof"},
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
        {label: "try"},
        {label: "{"},
        {label: "}"},
        {label: "catch"},
        {label: "("},
        {label: "name", identifierRole: IdentifierRole.BlockScopedDeclaration},
        {label: ")"},
        {label: "{"},
        {label: "}"},
        {label: "eof"},
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
        {label: "function"},
        {label: "name", identifierRole: IdentifierRole.FunctionScopedDeclaration},
        {label: "("},
        {label: ")"},
        {label: "{"},
        {label: "}"},
        {label: "class"},
        {label: "name", identifierRole: IdentifierRole.BlockScopedDeclaration},
        {label: "{"},
        {label: "}"},
        {label: "eof"},
      ],
    );
  });

  it("does not get confused by a regex-like sequence of divisions", () => {
    assertTokens(
      `
      5/3/1
    `,
      [{label: "num"}, {label: "/"}, {label: "num"}, {label: "/"}, {label: "num"}, {label: "eof"}],
    );
  });

  it("properly recognizes regexes that look like divisions", () => {
    assertTokens(
      `
      5 + /3/
    `,
      [{label: "num"}, {label: "+/-"}, {label: "regexp"}, {label: "eof"}],
    );
  });

  it("properly recognizes less than and greater than that look like JSX", () => {
    assertTokens(
      `
      x<Hello>2
    `,
      [
        {label: "name"},
        {label: "<"},
        {label: "name"},
        {label: ">"},
        {label: "num"},
        {label: "eof"},
      ],
    );
  });

  it("properly recognizes JSX in a normal expression context", () => {
    assertTokens(
      `
      x + < Hello / >
    `,
      [
        {label: "name"},
        {label: "+/-"},
        {label: "jsxTagStart"},
        {label: "jsxName"},
        {label: "/"},
        {label: "jsxTagEnd"},
        {label: "eof"},
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
        {label: "jsxTagStart"},
        {label: "jsxName"},
        {label: "jsxName"},
        {label: "="},
        {label: "string"},
        {label: "jsxTagEnd"},
        {label: "jsxText"},
        {label: "jsxTagStart"},
        {label: "jsxName"},
        {label: "jsxName"},
        {label: "="},
        {label: "{"},
        {label: "name"},
        {label: "}"},
        {label: "/"},
        {label: "jsxTagEnd"},
        {label: "jsxText"},
        {label: "jsxTagStart"},
        {label: "/"},
        {label: "jsxName"},
        {label: "jsxTagEnd"},
        {label: "eof"},
      ],
    );
  });

  it("properly recognizes template strings", () => {
    assertTokens(
      `
      \`Hello, \${name} \${surname}\`
    `,
      [
        {label: "`"},
        {label: "template"},
        {label: "${"},
        {label: "name"},
        {label: "}"},
        {label: "template"},
        {label: "${"},
        {label: "name"},
        {label: "}"},
        {label: "template"},
        {label: "`"},
        {label: "eof"},
      ],
    );
  });
});
