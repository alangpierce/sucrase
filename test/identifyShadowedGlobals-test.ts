import * as assert from "assert";
import CJSImportProcessor from "../src/CJSImportProcessor";
import {hasShadowedGlobals} from "../src/identifyShadowedGlobals";
import NameManager from "../src/NameManager";
import {parse} from "../src/parser";
import TokenProcessor from "../src/TokenProcessor";

function assertHasShadowedGlobals(code: string, expected: boolean): void {
  const file = parse(code, false, false, false);
  const tokenProcessor = new TokenProcessor(code, file.tokens, false);
  const nameManager = new NameManager(tokenProcessor);
  nameManager.preprocessNames();
  const importProcessor = new CJSImportProcessor(nameManager, tokenProcessor, false, {
    transforms: [],
  });
  importProcessor.preprocessTokens();
  assert.strictEqual(
    hasShadowedGlobals(tokenProcessor, importProcessor.getGlobalNames()),
    expected,
  );
}

describe("identifyShadowedGlobals", () => {
  it("properly does an up-front that there are any shadowed globals", () => {
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
});
