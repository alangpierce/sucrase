import {GenMapping, maybeAddSegment, toEncodedMap} from "@jridgewell/gen-mapping";

import type {SourceMapOptions} from "./index";
import type {Token} from "./parser/tokenizer";
import {charCodes} from "./parser/util/charcodes";
import type {RootTransformerResult} from "./transformers/RootTransformer";

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
 * Generate a source map indicating that each line maps directly to the original line, with the tokens in their new positions.
 */
export default function computeSourceMap(
  {code, mappings: rawMappings}: RootTransformerResult,
  filePath: string,
  options: SourceMapOptions,
  source: string,
  tokens: Array<Token>,
): RawSourceMap {
  if (!source || options.simple) {
    return computeSimpleSourceMap(code, filePath, options);
  }
  const sourceColumns = computeSourceColumns(source, tokens);
  return computeDetailedSourceMap(code, filePath, options, rawMappings, sourceColumns);
}

function computeSimpleSourceMap(
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

function computeSourceColumns(code: string, tokens: Array<Token>): Array<number> {
  const sourceColumns: Array<number> = new Array(tokens.length);
  let j = 0;
  let currentMapping = tokens[j].start;
  let lineStart = 0;
  for (let i = 0; i < code.length; i++) {
    if (i === currentMapping) {
      sourceColumns[j] = currentMapping - lineStart;
      currentMapping = tokens[++j].start;
    }
    if (code.charCodeAt(i) === charCodes.lineFeed) {
      lineStart = i + 1;
    }
  }
  return sourceColumns;
}

function computeDetailedSourceMap(
  code: string,
  filePath: string,
  {compiledFilename}: SourceMapOptions,
  rawMappings: Array<number | undefined>,
  sourceColumns: Array<number>,
): RawSourceMap {
  const map = new GenMapping({file: compiledFilename});
  let j = 0;
  let currentMapping = rawMappings[j];
  for (; currentMapping === undefined; currentMapping = rawMappings[++j]);
  let line = 0;
  let lineStart = 0;
  if (currentMapping !== lineStart) {
    maybeAddSegment(map, line, 0, filePath, line, 0);
  }
  for (let i = 0; i < code.length; i++) {
    if (i === currentMapping) {
      const genColumn = currentMapping - lineStart;
      const sourceColumn = sourceColumns[j];
      maybeAddSegment(map, line, genColumn, filePath, line, sourceColumn);
      for (
        currentMapping = rawMappings[++j];
        currentMapping === i || currentMapping === undefined;
        currentMapping = rawMappings[++j]
      );
    }
    if (code.charCodeAt(i) === charCodes.lineFeed) {
      line++;
      lineStart = i + 1;
      if (currentMapping !== lineStart) {
        maybeAddSegment(map, line, 0, filePath, line, 0);
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {sourceRoot, sourcesContent, ...sourceMap} = toEncodedMap(map);
  return sourceMap as RawSourceMap;
}
