import {Transform, transform} from "sucrase";

function getTransforms(filename: string): Array<Transform> | null {
  if (filename.endsWith(".js") || filename.endsWith(".jsx")) {
    return ["flow", "jsx", "imports"];
  } else if (filename.endsWith(".ts")) {
    return ["typescript", "imports"];
  } else if (filename.endsWith(".tsx")) {
    return ["typescript", "jsx", "imports"];
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
