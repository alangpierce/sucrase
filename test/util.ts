import * as assert from "assert";

import {Options, transform} from "../src";

export function assertResult(
  code: string,
  expectedResult: string,
  options: Options = {transforms: ["jsx", "imports"]},
): void {
  assert.equal(transform(code, options), expectedResult);
}

export function devProps(lineNumber: number): string {
  return `__self: this, __source: {fileName: _jsxFileName, lineNumber: ${lineNumber}}`;
}
