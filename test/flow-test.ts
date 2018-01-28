import {IMPORT_PREFIX} from "./prefixes";
import {assertResult} from "./util";

function assertFlowResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, ["jsx", "imports", "flow"]);
}

describe("transform flow", () => {
  it("removes `import type` statements", () => {
    assertFlowResult(
      `
      import type {a} from 'b';
      import c from 'd';
      import type from 'e';
      import {f, type g} from 'h';
      import {type i, type j} from 'k';
      import type L from 'L';
    `,
      `"use strict";${IMPORT_PREFIX}
      
      var _d = require('d'); var _d2 = _interopRequireDefault(_d);
      var _e = require('e'); var _e2 = _interopRequireDefault(_e);
      var _h = require('h');
      
      
    `,
    );
  });

  it("does not mistake ? in types for a ternary operator", () => {
    assertFlowResult(
      `
      type A<T> = ?number;
      const f = (): number => 3;
    `,
      `"use strict";${IMPORT_PREFIX}
      
      const f = () => 3;
    `,
    );
  });

  it("properly removes class property variance markers", () => {
    assertFlowResult(
      `
      class C {
        +foo: number;
        -bar: number;
      }
    `,
      `"use strict";${IMPORT_PREFIX}
      class C {
        
        
      }
    `,
    );
  });

  it("recognizes arrow function types in variable declarations", () => {
    assertFlowResult(
      `
      const x: a => b = 2;
    `,
      `"use strict";${IMPORT_PREFIX}
      const x = 2;
    `,
    );
  });

  it("recognizes arrow function types within parameters", () => {
    assertFlowResult(
      `
      function partition<T>(
        list: T[],
        test: (T, number, T[]) => ?boolean,
      ): [T[], T[]] {
        return [];
      }
    `,
      `"use strict";${IMPORT_PREFIX}
      function partition(
        list,
        test,
      ) {
        return [];
      }
    `,
    );
  });

  it("recognizes exact object types", () => {
    assertFlowResult(
      `
      function foo(): {| x: number |} {
        return 3;
      }
    `,
      `"use strict";${IMPORT_PREFIX}
      function foo() {
        return 3;
      }
    `,
    );
  });

  it("handles `export type * from`", () => {
    assertFlowResult(
      `
      export type * from "a";
    `,
      `"use strict";${IMPORT_PREFIX}
      
    `,
    );
  });

  it("handles `import ... typeof`", () => {
    assertFlowResult(
      `
      import {typeof a as b} from 'c';
      import typeof d from 'e';
    `,
      `"use strict";${IMPORT_PREFIX}
      
      
    `,
    );
  });

  it("handles export type for individual types", () => {
    assertFlowResult(
      `
      export type {foo};
    `,
      `"use strict";${IMPORT_PREFIX}
      
    `,
    );
  });

  it("properly parses import aliases with the flow parser", () => {
    assertFlowResult(
      `
      import { a as b } from "c";
    `,
      `"use strict";${IMPORT_PREFIX}
      var _c = require('c');
    `,
    );
  });

  it("properly parses bounded type parameters", () => {
    assertFlowResult(
      `
      function makeWeakCache<A: B>(): void {
      }
    `,
      `"use strict";${IMPORT_PREFIX}
      function makeWeakCache() {
      }
    `,
    );
  });

  it("properly handles star as an arrow type param", () => {
    assertFlowResult(
      `
      const x: *=>3 = null;
    `,
      `"use strict";${IMPORT_PREFIX}
      const x = null;
    `,
    );
  });
});
