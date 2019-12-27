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
    vm.runInNewContext(resultCode, {
      // Convert to JSON and back so that nested objects have the right prototypes. Unfortunately,
      // this limits us to using JSON-like values (particularly, never using undefined).
      setOutput: (value: unknown) => outputs.push(JSON.parse(JSON.stringify(value))),
    });
    assert.strictEqual(outputs.length, 1, "setOutput should be called exactly once");
    assert.deepStrictEqual([1, 2], [1, 2]);
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

export function assertOutput(
  code: string,
  expectedOutput: unknown,
  options: Options = {transforms: ["jsx", "imports"]},
): void {
  assertExpectations(code, {expectedOutput}, options);
}

export function devProps(lineNumber: number): string {
  return `__self: this, __source: {fileName: _jsxFileName, lineNumber: ${lineNumber}}`;
}

/**
 * Given a mapping from filename to code, compiles each file and runs the file called "main"
 * under normal CJS semantics (require and exports). The main module should export a value
 * called `output`, and we assert that it's equal to expectedOutput.
 */
export function assertMultiFileOutput(
  codeByFilename: {[filename: string]: string},
  expectedOutput: unknown,
): void {
  const mainResult = new FakeModuleResolver(codeByFilename).evaluateModule("main");
  // tslint:disable-next-line no-any
  const output = (mainResult as any).output;
  assert.deepStrictEqual(output, expectedOutput);
}

class FakeModuleResolver {
  moduleExportsCache: {[filename: string]: unknown} = {};

  constructor(readonly codeByFilename: {[filename: string]: string}) {}

  evaluateModule(filename: string): unknown {
    if (filename in this.moduleExportsCache) {
      return this.moduleExportsCache[filename];
    }
    const exports = {};
    this.moduleExportsCache[filename] = exports;
    const code = this.codeByFilename[filename];
    if (!code) {
      throw new Error(`Did not find file ${filename}`);
    }
    const compiledCode = transform(code, {transforms: ["imports"]}).code;
    vm.runInNewContext(compiledCode, {require: this.evaluateModule.bind(this), exports});
    return exports;
  }
}
