import * as assert from "assert";
import {parse} from "../src/parser";
import {Scope} from "../src/parser/tokenizer/state";

function assertScopes(code: string, expectedScopes: Array<Scope>): void {
  assert.deepEqual(parse(code, false, false, false).scopes, expectedScopes);
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
        new Scope(10, 19, true),
        // Function including params
        new Scope(7, 19, true),
        // Program
        new Scope(0, 20, true),
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
        new Scope(18, 27, false),
        // For loop including initializers
        new Scope(11, 27, false),
        // While block
        new Scope(31, 33, false),
        // If block
        new Scope(37, 39, false),
        // Block within switch base
        new Scope(47, 52, false),
        // Switch block
        new Scope(43, 58, false),
        // Try block
        new Scope(59, 61, false),
        // Catch block
        new Scope(65, 67, false),
        // Catch binding scope
        new Scope(62, 67, false),
        // Finally block
        new Scope(68, 70, false),
        // Function body
        new Scope(10, 71, true),
        // Function including params
        new Scope(7, 71, true),
        // Program
        new Scope(0, 72, true),
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
        new Scope(6, 15, true),
        // Arrow function
        new Scope(3, 15, true),
        // Shorthand arg arrow function
        new Scope(18, 21, true),
        // Class method body
        new Scope(29, 38, true),
        // Class method
        new Scope(26, 38, true),
        // Object method body
        new Scope(47, 56, true),
        // Object method
        new Scope(44, 56, true),
        // Program
        new Scope(0, 58, true),
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
        new Scope(4, 6, true),
        // Params and body for f
        new Scope(2, 6, true),
        // Body for g
        new Scope(13, 15, true),
        // Params and body for g
        new Scope(11, 15, true),
        // Name, params and body for g
        new Scope(10, 15, true),
        // Program
        new Scope(0, 16, true),
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
        new Scope(8, 11, false),
        // Program
        new Scope(0, 12, true),
      ],
    );
  });
});
