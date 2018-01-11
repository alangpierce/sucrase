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
        // Function body
        {startTokenIndex: 10, endTokenIndex: 19, isFunctionScope: true},
        // Function including params
        {startTokenIndex: 7, endTokenIndex: 19, isFunctionScope: true},
        // Program
        {startTokenIndex: 0, endTokenIndex: 20, isFunctionScope: true},
      ],
    );
  });

  it("handles scopes for loops, conditionals, etc", () => {
    assertScopes(
      `
      const x = 1;
      function foo(x) {
        for (const x of blah) {
          console.log(x);
        }
        while (false) {
        }
        if (true) {
        }
        switch (x) {
          case 1: {
            return 5;
          }
          default:
            return 3;
        }
        try {
        } catch (e) {
        } finally {
        }
      }
    `,
      [
        // For loop block
        {startTokenIndex: 18, endTokenIndex: 27, isFunctionScope: false},
        // For loop including initializers
        {startTokenIndex: 11, endTokenIndex: 27, isFunctionScope: false},
        // While block
        {startTokenIndex: 31, endTokenIndex: 33, isFunctionScope: false},
        // If block
        {startTokenIndex: 37, endTokenIndex: 39, isFunctionScope: false},
        // Block within switch base
        {startTokenIndex: 47, endTokenIndex: 52, isFunctionScope: false},
        // Switch block
        {startTokenIndex: 43, endTokenIndex: 58, isFunctionScope: false},
        // Try block
        {startTokenIndex: 59, endTokenIndex: 61, isFunctionScope: false},
        // Catch block
        {startTokenIndex: 65, endTokenIndex: 67, isFunctionScope: false},
        // Catch binding scope
        {startTokenIndex: 62, endTokenIndex: 67, isFunctionScope: false},
        // Finally block
        {startTokenIndex: 68, endTokenIndex: 70, isFunctionScope: false},
        // Function body
        {startTokenIndex: 10, endTokenIndex: 71, isFunctionScope: true},
        // Function including params
        {startTokenIndex: 7, endTokenIndex: 71, isFunctionScope: true},
        // Program
        {startTokenIndex: 0, endTokenIndex: 72, isFunctionScope: true},
      ],
    );
  });
});
