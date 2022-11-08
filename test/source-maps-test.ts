import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

import {transform} from "../src";

describe("source maps", () => {
  const testCase = (simple: boolean): void => {
    const source = `\
      import a from "./a";
      const x: number = 1;
      console.log(x + 1);
    `;
    const result = transform(source, {
      transforms: ["imports", "typescript"],
      sourceMapOptions: {compiledFilename: "test.js", simple},
      filePath: "test.ts",
    });
    const simpleMappings = "AAAA;AACA;AACA;AACA";
    assert.deepEqual(result.sourceMap, {
      version: 3,
      sources: ["test.ts"],
      names: [],
      mappings: simple ? simpleMappings : result.sourceMap!.mappings,
      file: "test.js",
    });
    if (!simple) {
      if (process.env.WRITE_SOURCE_MAPS) {
        const outDir = path.join(__dirname, "output");
        fs.mkdirSync(outDir, {recursive: true});
        result.sourceMap!.sourcesContent = [source];
        let suffix = "//# sourceMapping";
        suffix += `URL=test.js.map`;
        fs.writeFileSync(path.join(outDir, "test.js"), `${result.code}\n${suffix}`);
        fs.writeFileSync(path.join(outDir, "test.js.map"), JSON.stringify(result.sourceMap));
      }
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
