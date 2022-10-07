import type {TransformOptions} from "@jest/transform";
import {extname} from "path";
import {Transform, transform} from "sucrase";

import type {Options} from "../../../src/Options";

function getTransforms(filename: string, supportsStaticESM: boolean): Array<Transform> | null {
  const extension = extname(filename);
  const maybeImports: Array<Transform> = supportsStaticESM ? [] : ["imports"];
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) {
    return [...maybeImports, "flow", "jsx", "jest"];
  } else if (extension === ".ts") {
    return [...maybeImports, "typescript", "jest"];
  } else if ([".tsx", ".mts", ".cts"].includes(extension)) {
    return [...maybeImports, "typescript", "jsx", "jest"];
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
  const transforms = getTransforms(filename, options.supportsStaticESM);
  if (transforms !== null) {
    const {code, sourceMap} = transform(src, {
      transforms,
      disableESTransforms: true,
      preserveDynamicImport: options.supportsDynamicImport,
      ...options.transformerConfig,
      sourceMapOptions: {compiledFilename: filename},
      filePath: filename,
    });
    const mapBase64 = Buffer.from(JSON.stringify(sourceMap)).toString("base64");
    // Split the source map comment across two strings so that tools like
    // source-map-support don't accidentally interpret it as a source map
    // comment for this file.
    let suffix = "//# sourceMapping";
    suffix += `URL=data:application/json;charset=utf-8;base64,${mapBase64}`;
    // sourceMappingURL is necessary for breakpoints to work in WebStorm, so
    // include it in addition to specifying the source map normally.
    return {code: `${code}\n${suffix}`, map: sourceMap};
  } else {
    return {code: src};
  }
}

export default {process};
