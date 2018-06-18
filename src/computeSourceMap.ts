import {SourceMapOptions} from "./index";

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
    if (code[i] === "\n") {
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
