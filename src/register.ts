// @ts-ignore: no types available.
import * as pirates from "pirates";

import {Options, transform} from "./index";

export function addHook(extension: string, options: Options): void {
  pirates.addHook(
    (code: string, filePath: string): string => {
      const {code: transformedCode, sourceMap} = transform(code, {
        ...options,
        sourceMapOptions: {compiledFilename: filePath},
        filePath,
      });
      const mapBase64 = Buffer.from(JSON.stringify(sourceMap)).toString("base64");
      const suffix = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${mapBase64}`;
      return `${transformedCode}\n${suffix}`;
    },
    {exts: [extension]},
  );
}

export function registerJS(): void {
  addHook(".js", {transforms: ["imports", "flow", "jsx"]});
}

export function registerJSX(): void {
  addHook(".jsx", {transforms: ["imports", "flow", "jsx"]});
}

export function registerTS(): void {
  addHook(".ts", {transforms: ["imports", "typescript"]});
}

export function registerTSX(): void {
  addHook(".tsx", {transforms: ["imports", "typescript", "jsx"]});
}

export function registerTSLegacyModuleInterop(): void {
  addHook(".ts", {
    transforms: ["imports", "typescript"],
    enableLegacyTypeScriptModuleInterop: true,
  });
}

export function registerTSXLegacyModuleInterop(): void {
  addHook(".tsx", {
    transforms: ["imports", "typescript", "jsx"],
    enableLegacyTypeScriptModuleInterop: true,
  });
}

export function registerAll(): void {
  registerJS();
  registerJSX();
  registerTS();
  registerTSX();
}
