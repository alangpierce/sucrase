import * as assert from "assert";
import {parse} from "../sucrase-babylon";
import {IdentifierRole, Token} from "../sucrase-babylon/tokenizer";

type SimpleToken = Token & {label?: string};
type TokenExpectation = {[K in keyof SimpleToken]?: SimpleToken[K]};

function assertTokens(code: string, expectedTokens: Array<TokenExpectation>): void {
  const tokens: Array<SimpleToken> = parse(code, {tokens: true, sourceType: "module"}).tokens;
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
});
