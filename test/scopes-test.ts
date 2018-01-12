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

  it("handles functions in different contexts", () => {
    assertScopes(
      `
      const f = () => { console.log("An arrow function!"); }
      const g = a => b;
      class C {
        m(a) {
          console.log("A class method!");
        }
      }
      const o = {
        m(a) {
          console.log("An object method!");
        }
      }
    `,
      [
        // Arrow function body
        {startTokenIndex: 6, endTokenIndex: 15, isFunctionScope: true},
        // Arrow function
        {startTokenIndex: 3, endTokenIndex: 15, isFunctionScope: true},
        // Shorthand arg arrow function
        {startTokenIndex: 18, endTokenIndex: 21, isFunctionScope: true},
        // Class method body
        {startTokenIndex: 29, endTokenIndex: 38, isFunctionScope: true},
        // Class method
        {startTokenIndex: 26, endTokenIndex: 38, isFunctionScope: true},
        // Object method body
        {startTokenIndex: 47, endTokenIndex: 56, isFunctionScope: true},
        // Object method
        {startTokenIndex: 44, endTokenIndex: 56, isFunctionScope: true},
        // Program
        {startTokenIndex: 0, endTokenIndex: 58, isFunctionScope: true},
      ],
    );
  });

  it("creates a special name scope for function expressions but not statements", () => {
    // We make an extra scope for expression functions so that the name is limited to the function
    // body. For statement functions, it should be a declaration in the outer scope.
    assertScopes(
      `
      function f() {
      }
      const value = function g() {
      }
    `,
      [
        // Body for f
        {startTokenIndex: 4, endTokenIndex: 6, isFunctionScope: true},
        // Params and body for f
        {startTokenIndex: 2, endTokenIndex: 6, isFunctionScope: true},
        // Body for g
        {startTokenIndex: 13, endTokenIndex: 15, isFunctionScope: true},
        // Params and body for g
        {startTokenIndex: 11, endTokenIndex: 15, isFunctionScope: true},
        // Name, params and body for g
        {startTokenIndex: 10, endTokenIndex: 15, isFunctionScope: true},
        // Program
        {startTokenIndex: 0, endTokenIndex: 16, isFunctionScope: true},
      ],
    );
  });

  it("creates a special name scope for class expressions but not statements", () => {
    // We make an extra scope for expression classes so that the name is limited to the class body.
    // For statement classes, it should be a declaration in the outer scope.
    assertScopes(
      `
      class C {
      }
      const value = class D {
      }
    `,
      [
        // Class expression scope
        {startTokenIndex: 8, endTokenIndex: 11, isFunctionScope: false},
        // Program
        {startTokenIndex: 0, endTokenIndex: 12, isFunctionScope: true},
      ],
    );
  });
});
