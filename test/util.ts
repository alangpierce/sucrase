import * as assert from "assert";
import vm from "vm";

import {Options, transform} from "../src";

export interface Expectations {
  expectedResult?: string;
  expectedOutput?: unknown;
}

export function assertExpectations(
  code: string,
  expectations: Expectations,
  options: Options,
): void {
  const resultCode = transform(code, options).code;
  if ("expectedResult" in expectations) {
    assert.strictEqual(resultCode, expectations.expectedResult);
  }
  if ("expectedOutput" in expectations) {
    const outputs: Array<unknown> = [];
    vm.runInNewContext(resultCode, {setOutput: (value: unknown) => outputs.push(value)});
    assert.strictEqual(outputs.length, 1, "setOutput should be called exactly once");
    assert.deepStrictEqual(outputs[0], expectations.expectedOutput);
  }
}

export function assertResult(
  code: string,
  expectedResult: string,
  options: Options = {transforms: ["jsx", "imports"]},
): void {
  assertExpectations(code, {expectedResult}, options);
}

export function devProps(lineNumber: number): string {
  return `__self: this, __source: {fileName: _jsxFileName, lineNumber: ${lineNumber}}`;
}
