import {Transform, transform} from "sucrase";

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

export function process(src: string, filename: string): string {
  const transforms = getTransforms(filename);
  if (transforms !== null) {
    const {code, sourceMap} = transform(src, {
      transforms,
      sourceMapOptions: {compiledFilename: filename},
      filePath: filename,
    });
    const mapBase64 = Buffer.from(JSON.stringify(sourceMap)).toString("base64");
    const suffix = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${mapBase64}`;
    return `${code}\n${suffix}`;
  } else {
    return src;
  }
}

export default {process};
