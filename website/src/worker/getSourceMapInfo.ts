import {eachMapping, TraceMap, type EncodedSourceMap} from "@jridgewell/trace-mapping";
import {transform, type Options} from "sucrase";

/**
 * Create a helpful string for debugging source map info.
 *
 * Currently, this consists of:
 * - A list of all mappings, organized by generated line.
 * - The JSON value of the source map.
 * - A hint to use https://evanw.github.io/source-map-visualization/ for better
 *   visualization.
 */
export default function getSourceMapInfo(code: string, options: Options, filePath: string): string {
  try {
    const {sourceMap} = transform(code, {
      filePath,
      ...options,
      sourceMapOptions: {compiledFilename: "sample.js"},
    });
    const traceMap = new TraceMap(sourceMap as EncodedSourceMap);
    let currentLine = 1;
    let resultText = "";
    eachMapping(traceMap, ({generatedLine, generatedColumn, originalLine, originalColumn}) => {
      if (generatedLine === currentLine && currentLine > 1) {
        resultText += ", ";
      }
      while (generatedLine > currentLine) {
        resultText += "\n";
        currentLine++;
      }
      resultText += `${generatedColumn} -> (${originalLine}, ${originalColumn})`;
    });
    resultText += `\n\n${JSON.stringify(sourceMap, null, 2)}`;
    resultText += `\n\nBetter visualization by pasting transformed code here:\nhttps://evanw.github.io/source-map-visualization/`;
    return resultText;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return e.message;
  }
}
