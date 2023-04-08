import {eachMapping, TraceMap, SourceMapInput, EachMapping} from "@jridgewell/trace-mapping";
import * as assert from "assert";

import {transform} from "../src";

describe("source maps", () => {
  it("generates a detailed line-based source map", () => {
    const source = `\
      import a from "./a";
      const x: number = a;
      console.log(x + 1);
    `;
    const result = transform(source, {
      transforms: ["imports", "typescript"],
      sourceMapOptions: {compiledFilename: "test.js"},
      filePath: "test.ts",
    });
    assert.equal(
      result.code,
      `"use strict"; function _interopRequireDefault(obj) { \
return obj && obj.__esModule ? obj : { default: obj }; }      \
var _a = require('./a'); var _a2 = _interopRequireDefault(_a);
      const x = _a2.default;
      console.log(x + 1);
    `,
    );
    assert.deepEqual(result.sourceMap, {
      version: 3,
      sources: ["test.ts"],
      names: [],
      mappings: `AAAA,mHAAM,8DAAmB;AACzB,MAAM,MAAM,CAAC,CAAS,EAAE,WAAC;AACzB,\
MAAM,OAAO,CAAC,GAAG,CAAC,EAAE,EAAE,CAAC,CAAC;AACxB`,
      file: "test.js",
    });
    const traceMap = new TraceMap(result.sourceMap as SourceMapInput);
    const mappings: Array<
      Pick<EachMapping, "generatedLine" | "generatedColumn" | "originalLine" | "originalColumn">
    > = [];
    eachMapping(traceMap, ({generatedLine, generatedColumn, originalLine, originalColumn}) => {
      mappings.push({generatedLine, generatedColumn, originalLine, originalColumn});
    });
    assert.deepEqual(
      mappings,
      [
        {generatedLine: 1, generatedColumn: 0, originalLine: 1, originalColumn: 0},
        {generatedLine: 1, generatedColumn: 115, originalLine: 1, originalColumn: 6},
        {generatedLine: 1, generatedColumn: 177, originalLine: 1, originalColumn: 25},
        {generatedLine: 2, generatedColumn: 0, originalLine: 2, originalColumn: 0},
        {generatedLine: 2, generatedColumn: 6, originalLine: 2, originalColumn: 6},
        {generatedLine: 2, generatedColumn: 12, originalLine: 2, originalColumn: 12},
        {generatedLine: 2, generatedColumn: 13, originalLine: 2, originalColumn: 13},
        {generatedLine: 2, generatedColumn: 14, originalLine: 2, originalColumn: 22},
        {generatedLine: 2, generatedColumn: 16, originalLine: 2, originalColumn: 24},
        {generatedLine: 2, generatedColumn: 27, originalLine: 2, originalColumn: 25},
        {generatedLine: 3, generatedColumn: 0, originalLine: 3, originalColumn: 0},
        {generatedLine: 3, generatedColumn: 6, originalLine: 3, originalColumn: 6},
        {generatedLine: 3, generatedColumn: 13, originalLine: 3, originalColumn: 13},
        {generatedLine: 3, generatedColumn: 14, originalLine: 3, originalColumn: 14},
        {generatedLine: 3, generatedColumn: 17, originalLine: 3, originalColumn: 17},
        {generatedLine: 3, generatedColumn: 18, originalLine: 3, originalColumn: 18},
        {generatedLine: 3, generatedColumn: 20, originalLine: 3, originalColumn: 20},
        {generatedLine: 3, generatedColumn: 22, originalLine: 3, originalColumn: 22},
        {generatedLine: 3, generatedColumn: 23, originalLine: 3, originalColumn: 23},
        {generatedLine: 3, generatedColumn: 24, originalLine: 3, originalColumn: 24},
        {generatedLine: 4, generatedColumn: 0, originalLine: 4, originalColumn: 0},
      ],
      `Expected:\n${mappings.map((m) => `${JSON.stringify(m)},`).join("\n")}`,
    );
  });
});
