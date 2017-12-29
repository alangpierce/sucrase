import {PREFIX} from "./prefixes";
import {assertResult} from "./util";

function assertTypeScriptResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, ["jsx", "imports", "typescript"]);
}

describe("typescript transform", () => {
  it("removes type assertions using `as`", () => {
    assertTypeScriptResult(
      `
      const x = 0;
      console.log(x as string);
    `,
      `${PREFIX}
      const x = 0;
      console.log(x );
    `,
    );
  });

  it.skip("properly handles variables named 'as'", () => {
    assertTypeScriptResult(
      `
      const as = "Hello";
      console.log(as);
    `,
      `${PREFIX}
      const as = "Hello";
      console.log(as);
    `,
    );
  });

  it("removes access modifiers from class methods and fields", () => {
    assertTypeScriptResult(
      `
      class A {
        private b: number;
        public c(): string {
          return "hi";
        }
      }
    `,
      `${PREFIX}
      class A {
         ;
         c() {
          return "hi";
        }
      }
    `,
    );
  });
});
