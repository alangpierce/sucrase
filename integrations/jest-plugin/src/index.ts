import type {TransformOptions} from "@jest/transform";
import {Transform, transform} from "sucrase";

import type {Options} from "../../../src/Options";

function getTransforms(filename: string): Array<Transform> | null {
  if (filename.endsWith(".js") || filename.endsWith(".jsx")) {
    return ["flow", "jsx", "imports", "jest"];
  } else if (filename.endsWith(".ts")) {
    return ["typescript", "imports", "jest"];
  } else if (filename.endsWith(".tsx")) {
    return ["typescript", "jsx", "imports", "jest"];
  }
  return null;
}

// this is compatible to the one that is required by Jest, using the type from here:
// https://github.com/mozilla/source-map/blob/0.6.1/source-map.d.ts#L6-L12
type RawSourceMap = ReturnType<typeof transform>["sourceMap"];

export function process(
  src: string,
  filename: string,
  options: TransformOptions<Partial<Options>>,
): {code: string; map?: RawSourceMap | string | null} {
  const transforms = getTransforms(filename);
  if (transforms !== null) {
    const {code, sourceMap} = transform(src, {
      transforms,
      ...options.transformerConfig,
      sourceMapOptions: {compiledFilename: filename},
      filePath: filename,
    });
    const mapBase64 = Buffer.from(JSON.stringify(sourceMap)).toString("base64");
    const suffix = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${mapBase64}`;
    // sourceMappingURL is necessary for breakpoints to work in WebStorm, so
    // include it in addition to specifying the source map normally.
    return {code: `${code}\n${suffix}`, map: sourceMap};
  } else {
    return {code: src};
  }
}

export default {process};
