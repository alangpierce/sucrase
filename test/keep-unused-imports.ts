import {assertResult} from "./util";

function assertKeepUnusedImportsOption(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, {transforms: ["typescript"], keepUnusedImports: true});
}

describe("With keepUnusedImports", () => {
  it("keep unused imports", () => {
    assertKeepUnusedImportsOption(
      `
      import A from 'a';
      import B from 'b';
      import type C from "c";
      export function f(a: A, b: B, c: C): boolean {
        return a instanceof A;
      }`,
      `
      import A from 'a';
      import B from 'b';

      export function f(a, b, c) {
        return a instanceof A;
      }`,
    );
  });
});
