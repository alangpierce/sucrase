import sourceMap, {RawSourceMap} from "source-map";

/**
 * Generate a simple source map indicating that each line maps directly to the original line.
 */
export default function computeSourceMap(code: string, filePath: string): RawSourceMap {
  const mapGenerator = new sourceMap.SourceMapGenerator({file: filePath});
  let numLines = 1;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "\n") {
      numLines++;
    }
  }
  for (let line = 1; line <= numLines; line++) {
    mapGenerator.addMapping({
      source: filePath,
      generated: {line, column: 0},
      original: {line, column: 0},
    });
  }
  return mapGenerator.toJSON();
}
