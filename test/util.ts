import * as assert from "assert";

import {transform, Transform} from "../src";

export function assertResult(
  code: string,
  expectedResult: string,
  transforms: Array<Transform> = ["jsx", "imports"],
  filePath?: string,
): void {
  assert.equal(transform(code, {transforms, filePath}), expectedResult);
}

export function devProps(lineNumber: number): string {
  return `__self: this, __source: {fileName: _jsxFileName, lineNumber: ${lineNumber}}`;
}
