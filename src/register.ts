import * as pirates from "pirates";

import {Options, transform} from "./index";

export interface HookOptions {
  matcher?: (code: string) => boolean;
  ignoreNodeModules?: boolean;
}

export function addHook(extension: string, options: Options, hookOptions?: HookOptions): void {
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
    {...hookOptions, exts: [extension]},
  );
}

export function registerJS(options?: Options, hookOptions?: HookOptions): void {
  addHook(".js", {transforms: ["imports", "flow", "jsx"], ...options}, hookOptions);
}

export function registerJSX(options?: Options, hookOptions?: HookOptions): void {
  addHook(".jsx", {transforms: ["imports", "flow", "jsx"], ...options}, hookOptions);
}

export function registerTS(options?: Options, hookOptions?: HookOptions): void {
  addHook(".ts", {transforms: ["imports", "typescript"], ...options}, hookOptions);
}

export function registerTSX(options?: Options, hookOptions?: HookOptions): void {
  addHook(".tsx", {transforms: ["imports", "typescript", "jsx"], ...options}, hookOptions);
}

export function registerTSLegacyModuleInterop(options?: Options, hookOptions?: HookOptions): void {
  addHook(
    ".ts",
    {
      transforms: ["imports", "typescript"],
      enableLegacyTypeScriptModuleInterop: true,
      ...options,
    },
    hookOptions,
  );
}

export function registerTSXLegacyModuleInterop(options?: Options, hookOptions?: HookOptions): void {
  addHook(
    ".tsx",
    {
      transforms: ["imports", "typescript", "jsx"],
      enableLegacyTypeScriptModuleInterop: true,
      ...options,
    },
    hookOptions,
  );
}

export function registerAll(options?: Options, hookOptions?: HookOptions): void {
  registerJS(options, hookOptions);
  registerJSX(options, hookOptions);
  registerTS(options, hookOptions);
  registerTSX(options, hookOptions);
}
