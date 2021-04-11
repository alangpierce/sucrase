import type CJSImportProcessor from "../CJSImportProcessor";
import {TokenType as tt} from "../parser/tokenizer/types";
import type TokenProcessor from "../TokenProcessor";
import type RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

const JEST_GLOBAL_NAME = "jest";
const HOISTED_METHODS = ["mock", "unmock", "enableAutomock", "disableAutomock"];

/**
 * Implementation of babel-plugin-jest-hoist, which hoists up some jest method
 * calls above the imports to allow them to override other imports.
 */
export default class JestHoistTransformer extends Transformer {
  private readonly hoistedCalls: Array<string> = [];

  constructor(
    readonly rootTransformer: RootTransformer,
    readonly tokens: TokenProcessor,
    readonly importProcessor: CJSImportProcessor | null,
  ) {
    super();
  }

  process(): boolean {
    if (
      this.tokens.currentToken().scopeDepth === 0 &&
      this.tokens.matches4(tt.name, tt.dot, tt.name, tt.parenL) &&
      this.tokens.identifierName() === JEST_GLOBAL_NAME
    ) {
      // TODO: This only works if imports transform is active, which it will be for jest.
      //       But if jest adds module support and we no longer need the import transform, this needs fixing.
      if (this.importProcessor?.getGlobalNames()?.has(JEST_GLOBAL_NAME)) {
        return false;
      }
      return this.extractHoistedCalls();
    }

    return false;
  }

  getHoistedCode(): string {
    if (this.hoistedCalls.length > 0) {
      // This will be placed before module interop code, but that's fine since
      // imports aren't allowed in module mock factories.
      return `\n${JEST_GLOBAL_NAME}${this.hoistedCalls.join("")};`;
    }
    return "";
  }

  /**
   * Extracts any methods calls on the jest-object that should be hoisted.
   *
   * According to the jest docs, https://jestjs.io/docs/en/jest-object#jestmockmodulename-factory-options,
   * mock, unmock, enableAutomock, disableAutomock, are the methods that should be hoisted.
   *
   * We do not apply the same checks of the arguments as babel-plugin-jest-hoist does.
   */
  private extractHoistedCalls(): boolean {
    // We remove the `jest` expression, then add it back later if we find a non-hoisted call
    this.tokens.removeToken();
    let restoredJest = false;

    // Iterate through all chained calls on the jest object
    while (this.tokens.matches3(tt.dot, tt.name, tt.parenL)) {
      const methodName = this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 1);
      const shouldHoist = HOISTED_METHODS.includes(methodName);
      if (shouldHoist) {
        // We've matched e.g. `.mock(...)` or similar call
        // Start by applying transforms to the entire call, including parameters
        const snapshotBefore = this.tokens.snapshot();
        this.tokens.copyToken();
        this.tokens.copyToken();
        this.tokens.copyToken();
        this.rootTransformer.processBalancedCode();
        this.tokens.copyExpectedToken(tt.parenR);
        const snapshotAfter = this.tokens.snapshot();

        // Then grab the transformed code and store it for hoisting
        const processedCall = snapshotAfter.resultCode.slice(snapshotBefore.resultCode.length);
        this.hoistedCalls.push(processedCall);

        // Now go back and remove the entire method call
        const endIndex = this.tokens.currentIndex();
        this.tokens.restoreToSnapshot(snapshotBefore);
        while (this.tokens.currentIndex() < endIndex) {
          this.tokens.removeToken();
        }
      } else {
        if (!restoredJest) {
          restoredJest = true;
          this.tokens.appendCode(JEST_GLOBAL_NAME);
        }
        // When not hoisting we just transform the method call as usual
        this.tokens.copyToken();
        this.tokens.copyToken();
        this.tokens.copyToken();
        this.rootTransformer.processBalancedCode();
        this.tokens.copyExpectedToken(tt.parenR);
      }
    }

    return true;
  }
}
