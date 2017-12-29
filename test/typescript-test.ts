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
        
         c() {
          return "hi";
        }
      }
    `,
    );
  });

  it("handles class field assignment with an existing constructor", () => {
    assertTypeScriptResult(
      `
      class A {
        x = 1;
        constructor() {
          this.y = 2;
        }
      }
    `,
      `${PREFIX}
      class A {
        
        constructor() {;this.x = 1;
          this.y = 2;
        }
      }
    `,
    );
  });

  it("handles class field assignment after a constructor with super", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
        constructor(a) {
          super(a);
        }
      }
    `,
      `${PREFIX}
      class A extends B {
        
        constructor(a) {
          super(a);this.x = 1;;
        }
      }
    `,
    );
  });

  it("handles class field assignment with no constructor", () => {
    assertTypeScriptResult(
      `
      class A {
        x = 1;
      }
    `,
      `${PREFIX}
      class A {constructor() { this.x = 1; }
        
      }
    `,
    );
  });

  it("handles class field assignment with no constructor in a subclass", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        x = 1;
      }
    `,
      `${PREFIX}
      class A extends B {constructor(...args) { super(...args); this.x = 1; }
        
      }
    `,
    );
  });

  it("does not generate a conflicting name in a generated constructor", () => {
    assertTypeScriptResult(
      `
      class A extends B {
        args = 1;
      }
    `,
      `${PREFIX}
      class A extends B {constructor(...args2) { super(...args2); this.args = 1; }
        
      }
    `,
    );
  });

  it("handles readonly constructor initializers", () => {
    assertTypeScriptResult(
      `
      class A {
        constructor(readonly x: number) {
        }
      }
    `,
      `${PREFIX}
      class A {
        constructor( x) {;this.x = x;
        }
      }
    `,
    );
  });
});
