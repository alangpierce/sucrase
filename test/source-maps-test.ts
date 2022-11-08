import * as assert from "assert";

import {transform} from "../src";

describe("source maps", () => {
  const testCase = (simple: boolean): void => {
    const result = transform(
      `\
      import a from "./a";
      const x: number = 1;
      console.log(x + 1);
    `,
      {
        transforms: ["imports", "typescript"],
        sourceMapOptions: {compiledFilename: "test.js", simple},
        filePath: "test.ts",
      },
    );
    const simpleMappings = "AAAA;AACA;AACA;AACA";
    assert.deepEqual(result.sourceMap, {
      version: 3,
      sources: ["test.ts"],
      names: [],
      mappings: simple ? simpleMappings : result.sourceMap!.mappings,
      file: "test.js",
    });
    if (!simple) {
      const {mappings} = result.sourceMap!;
      assert.match(mappings, /^[^;]+(;[^;]+){3}$/); // 4 lines
      assert.notEqual(mappings, simpleMappings);
    }
  };
  it("generates a simple line-based source map", () => {
    testCase(true);
  });
  it("generates a detailed line-based source map", () => {
    testCase(false);
  });
});
