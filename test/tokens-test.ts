import * as assert from "assert";

import {parse} from "../src/parser";
import {IdentifierRole, JSXRole, Token} from "../src/parser/tokenizer";
import {ContextualKeyword} from "../src/parser/tokenizer/keywords";
import {TokenType, TokenType as tt} from "../src/parser/tokenizer/types";

type SimpleToken = Token & {label?: string};
type TokenExpectation = {[K in keyof SimpleToken]?: SimpleToken[K]};

function assertTokens(
  code: string,
  expectedTokens: Array<TokenExpectation>,
  {isFlow = false}: {isFlow?: boolean} = {},
): void {
  const tokens: Array<SimpleToken> = parse(code, true, !isFlow, isFlow).tokens;
  const helpMessage = `Tokens did not match. Starting point with just token types: [${tokens
    .map((t) => {
      let tokenCode = "{";
      tokenCode += `type: tt.${tt[t.type]}`;
      if (t.contextualKeyword) {
        tokenCode += `, contextualKeyword: ContextualKeyword.${
          ContextualKeyword[t.contextualKeyword]
        }`;
      }
      tokenCode += "}";
      return tokenCode;
    })
    .join(", ")}]`;
  assert.strictEqual(tokens.length, expectedTokens.length, helpMessage);
  const projectedTokens = tokens.map((token, i) => {
    const result = {};
    for (const key of Object.keys(expectedTokens[i])) {
      // @ts-ignore: Intentional dynamic access by key.
      result[key] = token[key];
    }
    return result;
  });
  assert.deepStrictEqual(projectedTokens, expectedTokens, helpMessage);
}

function assertFirstJSXRole(code: string, expectedJSXRole: JSXRole): void {
  const tokens = parse(code, true, true, false).tokens;
  const jsxTagStartTokens = tokens.filter((t) => t.type === TokenType.jsxTagStart);
  assert.ok(jsxTagStartTokens.length > 0);
  assert.strictEqual(jsxTagStartTokens[0].jsxRole, expectedJSXRole);
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
        {type: tt.jsxEmptyText},
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

  it("parses simple flow enums", () => {
    assertTokens(
      `
      enum E {
        A,
        B,
        ...
      }
    `,
      [
        {type: tt._enum},
        {type: tt.name},
        {type: tt.braceL},
        {type: tt.name},
        {type: tt.comma},
        {type: tt.name},
        {type: tt.comma},
        {type: tt.ellipsis},
        {type: tt.braceR},
        {type: tt.eof},
      ],
      {isFlow: true},
    );
  });

  it("parses flow enums with assignments", () => {
    assertTokens(
      `
      enum E {
        A = 1,
        B = 2,
      }
    `,
      [
        {type: tt._enum},
        {type: tt.name},
        {type: tt.braceL},
        {type: tt.name},
        {type: tt.eq},
        {type: tt.num},
        {type: tt.comma},
        {type: tt.name},
        {type: tt.eq},
        {type: tt.num},
        {type: tt.comma},
        {type: tt.braceR},
        {type: tt.eof},
      ],
      {isFlow: true},
    );
  });

  it("parses flow symbol enums", () => {
    assertTokens(
      `
      enum E of symbol {
        A,
        B
      }
    `,
      [
        {type: tt._enum},
        {type: tt.name},
        {type: tt.name, contextualKeyword: ContextualKeyword._of},
        {type: tt.name, contextualKeyword: ContextualKeyword._symbol},
        {type: tt.braceL},
        {type: tt.name},
        {type: tt.comma},
        {type: tt.name},
        {type: tt.braceR},
        {type: tt.eof},
      ],
      {isFlow: true},
    );
  });

  it("parses flow named export enums", () => {
    assertTokens(
      `
      export enum E {
        A,
        B
      }
    `,
      [
        {type: tt._export},
        {type: tt._enum},
        {type: tt.name},
        {type: tt.braceL},
        {type: tt.name},
        {type: tt.comma},
        {type: tt.name},
        {type: tt.braceR},
        {type: tt.eof},
      ],
      {isFlow: true},
    );
  });

  it("parses flow default export enums", () => {
    assertTokens(
      `
      export default enum E {
        A,
        B
      }
    `,
      [
        {type: tt._export},
        {type: tt._default},
        {type: tt._enum},
        {type: tt.name},
        {type: tt.braceL},
        {type: tt.name},
        {type: tt.comma},
        {type: tt.name},
        {type: tt.braceR},
        {type: tt.eof},
      ],
      {isFlow: true},
    );
  });

  it("parses import attributes", () => {
    assertTokens(
      `
      import foo from "./foo.json" with {type: "json"};
      export {val} from './foo.js' with {type: "javascript"};
    `,
      [
        {type: tt._import},
        {type: tt.name},
        {type: tt.name, contextualKeyword: ContextualKeyword._from},
        {type: tt.string},
        {type: tt._with},
        {type: tt.braceL},
        {type: tt.name, contextualKeyword: ContextualKeyword._type},
        {type: tt.colon},
        {type: tt.string},
        {type: tt.braceR},
        {type: tt.semi},
        {type: tt._export},
        {type: tt.braceL},
        {type: tt.name},
        {type: tt.braceR},
        {type: tt.name, contextualKeyword: ContextualKeyword._from},
        {type: tt.string},
        {type: tt._with},
        {type: tt.braceL},
        {type: tt.name, contextualKeyword: ContextualKeyword._type},
        {type: tt.colon},
        {type: tt.string},
        {type: tt.braceR},
        {type: tt.semi},
        {type: tt.eof},
      ],
    );
  });

  it("treats single-child JSX as non-static", () => {
    assertFirstJSXRole("const elem = <div>Hello</div>;", JSXRole.OneChild);
  });

  it("treats self-closing JSX as non-static", () => {
    assertFirstJSXRole("const elem = <div />;", JSXRole.NoChildren);
  });

  it("treats JSX with two element children as static", () => {
    assertFirstJSXRole("const elem = <div><span /><span /></div>;", JSXRole.StaticChildren);
  });

  it("treats JSX with two expression children as static", () => {
    assertFirstJSXRole("const elem = <div>{a}{b}</div>;", JSXRole.StaticChildren);
  });

  it("treats JSX with two whitespace-only children as static", () => {
    assertFirstJSXRole("const elem = <div> {} </div>;", JSXRole.StaticChildren);
  });

  it("treats JSX with non-spread children as non-static", () => {
    assertFirstJSXRole("const elem = <div>{elements}</div>;", JSXRole.OneChild);
  });

  it("treats JSX with spread children as static", () => {
    assertFirstJSXRole("const elem = <div>{...elements}</div>;", JSXRole.StaticChildren);
  });

  it("treats JSX with one empty and one space-only text as non-static", () => {
    assertFirstJSXRole(
      `
      const elem = <div> {} 
      </div>;
    `,
      JSXRole.OneChild,
    );
  });

  it("treats JSX with two empty text tokens as non-static", () => {
    assertFirstJSXRole(
      `
      const elem = (
        <div>
          {} 
        </div>
      );
    `,
      JSXRole.NoChildren,
    );
  });

  it("treats JSX with one space-only text and one text with contents as static", () => {
    assertFirstJSXRole(
      `
      const elem = (
        <div>    {}
          
          a
          
        </div>
      );
    `,
      JSXRole.StaticChildren,
    );
  });

  it("detects key after prop spread", () => {
    assertFirstJSXRole("const elem = <div {...props} key={1} />;", JSXRole.KeyAfterPropSpread);
  });

  it("does not mark as key-after-prop-spread if there is just a key", () => {
    assertFirstJSXRole("const elem = <div key={1} />;", JSXRole.NoChildren);
  });

  it("does not mark as key-after-prop-spread the key is after regular props", () => {
    assertFirstJSXRole("const elem = <div foo='a' bar='b' key={1} />;", JSXRole.NoChildren);
  });

  it("does not mark as key-after-prop-spread if the prop spread is afterward", () => {
    assertFirstJSXRole("const elem = <div key={1} {...props} />;", JSXRole.NoChildren);
  });

  it("marks as key-after-prop-spread if there is a prop spread before and after", () => {
    assertFirstJSXRole(
      "const elem = <div {...props} key={1} {...props2} />;",
      JSXRole.KeyAfterPropSpread,
    );
  });

  it("marks as key-after-prop-spread if there are two keys", () => {
    assertFirstJSXRole(
      "const elem = <div key={1} {...props} key={2} />;",
      JSXRole.KeyAfterPropSpread,
    );
  });

  it("does not mark as key-after-prop-spread for camelCase props starting with key", () => {
    assertFirstJSXRole("const elem = <div {...props} keyLimePie={1} />;", JSXRole.NoChildren);
  });

  it("does not mark as key-after-prop-spread for hyphenated props starting with key", () => {
    assertFirstJSXRole("const elem = <div {...props} key-lime-pie={1} />;", JSXRole.NoChildren);
  });

  it("marks key-after-prop-spread with higher precedence than static children", () => {
    assertFirstJSXRole(
      "const elem = <div {...props} key={1}>{a}{b}</div>;",
      JSXRole.KeyAfterPropSpread,
    );
  });
});
