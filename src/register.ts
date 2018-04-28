// @ts-ignore: no types available.
import * as pirates from "pirates";
import {Options, Transform, transform} from "./index";

export function addHook(extension: string, options: Options): void {
  pirates.addHook(
    (code: string, filePath: string): string => transform(code, {...options, filePath}),
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
