import type {SourceMapOptions} from "./index";
import {charCodes} from "./parser/util/charcodes";

export interface RawSourceMap {
  version: number;
  file: string;
  sources: Array<string>;
  sourceRoot?: string;
  sourcesContent?: Array<string>;
  mappings: string;
  names: Array<string>;
}

/**
 * Generate a simple source map indicating that each line maps directly to the original line.
 */
export default function computeSourceMap(
  code: string,
  filePath: string,
  {compiledFilename}: SourceMapOptions,
): RawSourceMap {
  let mappings = "AAAA";
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === charCodes.lineFeed) {
      mappings += ";AACA";
    }
  }
  return {
    version: 3,
    file: compiledFilename || "",
    sources: [filePath],
    mappings,
    names: [],
  };
}
