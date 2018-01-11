import * as assert from "assert";
import {parse} from "../sucrase-babylon";
import {Scope} from "../sucrase-babylon/tokenizer/state";

function assertScopes(code: string, expectedScopes: Array<Scope>): void {
  assert.deepEqual(parse(code, {tokens: true, sourceType: "module"}).scopes, expectedScopes);
}

describe("scopes", () => {
  it("properly provides function and program scopes", () => {
    assertScopes(
      `
      const x = 1;
      function foo(x) {
        console.log(x);
      }
    `,
      [
        {startTokenIndex: 7, endTokenIndex: 19, isFunctionScope: true},
        {startTokenIndex: 0, endTokenIndex: 20, isFunctionScope: true},
      ],
    );
  });
});
