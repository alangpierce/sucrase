import * as pirates from "pirates";

import {type Options, transform} from "./index";

export interface HookOptions {
  matcher?: (code: string) => boolean;
  ignoreNodeModules?: boolean;
}

export type RevertFunction = () => void;

export function addHook(
  extension: string,
  sucraseOptions: Options,
  hookOptions?: HookOptions,
): RevertFunction {
  let mergedSucraseOptions = sucraseOptions;
  const sucraseOptionsEnvJSON = process.env.SUCRASE_OPTIONS;
  if (sucraseOptionsEnvJSON) {
    mergedSucraseOptions = {...mergedSucraseOptions, ...JSON.parse(sucraseOptionsEnvJSON)};
  }
  return pirates.addHook(
    (code: string, filePath: string): string => {
      const {code: transformedCode, sourceMap} = transform(code, {
        ...mergedSucraseOptions,
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

export function registerJS(hookOptions?: HookOptions): RevertFunction {
  return addHook(".js", {transforms: ["imports", "flow", "jsx"]}, hookOptions);
}

export function registerJSX(hookOptions?: HookOptions): RevertFunction {
  return addHook(".jsx", {transforms: ["imports", "flow", "jsx"]}, hookOptions);
}

export function registerTS(hookOptions?: HookOptions): RevertFunction {
  return addHook(".ts", {transforms: ["imports", "typescript"]}, hookOptions);
}

export function registerTSX(hookOptions?: HookOptions): RevertFunction {
  return addHook(".tsx", {transforms: ["imports", "typescript", "jsx"]}, hookOptions);
}

export function registerTSLegacyModuleInterop(hookOptions?: HookOptions): RevertFunction {
  return addHook(
    ".ts",
    {
      transforms: ["imports", "typescript"],
      enableLegacyTypeScriptModuleInterop: true,
    },
    hookOptions,
  );
}

export function registerTSXLegacyModuleInterop(hookOptions?: HookOptions): RevertFunction {
  return addHook(
    ".tsx",
    {
      transforms: ["imports", "typescript", "jsx"],
      enableLegacyTypeScriptModuleInterop: true,
    },
    hookOptions,
  );
}

export function registerAll(hookOptions?: HookOptions): RevertFunction {
  const reverts = [
    registerJS(hookOptions),
    registerJSX(hookOptions),
    registerTS(hookOptions),
    registerTSX(hookOptions),
  ];

  return () => {
    for (const fn of reverts) {
      fn();
    }
  };
}
