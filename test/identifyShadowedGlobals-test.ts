import * as assert from "assert";

import CJSImportProcessor from "../src/CJSImportProcessor";
import {HelperManager} from "../src/HelperManager";
import {hasShadowedGlobals} from "../src/identifyShadowedGlobals";
import NameManager from "../src/NameManager";
import {parse} from "../src/parser";
import TokenProcessor from "../src/TokenProcessor";

function assertHasShadowedGlobals(code: string, expected: boolean): void {
  const file = parse(code, false, true, false);
  const nameManager = new NameManager(code, file.tokens);
  const helperManager = new HelperManager(nameManager);
  const tokenProcessor = new TokenProcessor(code, file.tokens, false, false, helperManager);
  const importProcessor = new CJSImportProcessor(
    nameManager,
    tokenProcessor,
    false,
    {
      transforms: [],
    },
    false,
    false,
    helperManager,
  );
  importProcessor.preprocessTokens();
  assert.strictEqual(
    hasShadowedGlobals(tokenProcessor, importProcessor.getGlobalNames()),
    expected,
  );
}

describe("identifyShadowedGlobals", () => {
  it("properly does an up-front check that there are any shadowed globals", () => {
    assertHasShadowedGlobals(
      `
      import a from 'a';
      function foo() {
        const a = 3;
        console.log(a);
      }
    `,
      true,
    );
  });

  it("properly detects when there are no shadowed globals", () => {
    assertHasShadowedGlobals(
      `
      import a from 'a';
      
      export const b = 3;
    `,
      false,
    );
  });

  it("does not treat parameters within types as real declarations", () => {
    assertHasShadowedGlobals(
      `
      import a from 'a';
      
      function foo(f: (a: number) => void) {
        console.log(a);
      }
    `,
      false,
    );
  });
});
