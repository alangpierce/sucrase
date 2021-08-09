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
    return transform(src, {transforms, filePath: filename}).code;
  } else {
    return src;
  }
}

export default {process};
