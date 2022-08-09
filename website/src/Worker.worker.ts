/* eslint-disable no-restricted-globals */
import * as Sucrase from "sucrase";
import type {ModuleKind} from "typescript";

import getTokens from "./getTokens";
import {compressCode} from "./URLHashState";
import type {Message, WorkerConfig, WorkerMessage} from "./WorkerProtocol";

declare const self: Worker;

let Babel: typeof import("./Babel") | null = null;
let TypeScript: typeof import("typescript") | null = null;

function postMessage(message: WorkerMessage): void {
  self.postMessage(message);
}

/**
 * Hacky workaround for the fact that chunk loading in workers is normally
 * synchronous (importScripts). We determine the chunk name based on how the
 * webpack config chooses names, then load that up-front in a fetch (which is
 * actually async). This makes it so the later import() will be able to pull
 * the JS from cache, and thus block the worker for a much shorter period of
 * time.
 *
 * TODO: Figure out how to get webpack to use true ESM imports for async loading
 * in workers, which would avoid this need.
 */
async function prefetchChunk(chunkName: string): Promise<void> {
  // Chunks have the filename "[name].[fullhash:8].chunk.js", so we can chop off
  // the first part of this chunk's name and replace it with the chunkName to
  // get the filename of the chunk to load.
  const path = location.pathname.replace(/\/[^.]+\./, `/${chunkName}.`);
  const response = await fetch(path);
  await response.text();
}

async function loadDependencies(): Promise<void> {
  await prefetchChunk("babel-compiler");
  Babel = await import(/* webpackChunkName: "babel-compiler" */ "./Babel");
  postMessage({type: "BABEL_LOADED"});
  await prefetchChunk("typescript-compiler");
  TypeScript = await import(/* webpackChunkName: "typescript-compiler" */ "typescript");
  postMessage({type: "TYPESCRIPT_LOADED"});
}

// SET_CONFIG must be the first message before anything else is called.
let config: WorkerConfig;

/**
 * The worker architecture intentionally bypasses the browser event loop in
 * favor of a more controlled model where at most one message is enqueued at
 * a time. For example, rather than each keystroke enqueueing a worker message,
 * the worker client keeps its own state and only sends a message to compute
 * for the last keystroke.
 */
self.addEventListener("message", ({data}) => {
  postMessage({type: "RESPONSE", response: processEvent(data)});
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
loadDependencies();

function processEvent(data: Message): unknown {
  if (data.type === "SET_CONFIG") {
    config = data.config;
    return null;
  } else if (data.type === "RUN_SUCRASE") {
    return runSucrase().code;
  } else if (data.type === "RUN_BABEL") {
    return runBabel().code;
  } else if (data.type === "RUN_TYPESCRIPT") {
    return runTypeScript().code;
  } else if (data.type === "COMPRESS_CODE") {
    return compressCode(config.code);
  } else if (data.type === "GET_TOKENS") {
    return getTokens(config.code, config.sucraseOptions);
  } else if (data.type === "PROFILE_SUCRASE") {
    return runSucrase().time;
  } else if (data.type === "PROFILE_BABEL") {
    return runBabel().time;
  } else if (data.type === "PROFILE_TYPESCRIPT") {
    return runTypeScript().time;
  }
  return null;
}

function getFilePath(): string {
  if (config.sucraseOptions.transforms.includes("typescript")) {
    if (config.sucraseOptions.transforms.includes("jsx")) {
      return "sample.tsx";
    } else {
      return "sample.ts";
    }
  } else {
    return "sample.js";
  }
}

function runSucrase(): {code: string; time: number | null} {
  return runAndProfile(
    () => Sucrase.transform(config.code, {filePath: getFilePath(), ...config.sucraseOptions}).code,
  );
}

function runBabel(): {code: string; time: number | null} {
  if (!Babel) {
    return {code: "Loading Babel...", time: null};
  }
  const {transform} = Babel;
  const {sucraseOptions} = config;

  const plugins: Array<string> = [];
  const presets: Array<string | [string, unknown]> = [];

  if (sucraseOptions.transforms.includes("jsx")) {
    presets.push([
      "react",
      {
        development: !sucraseOptions.production,
        pragma: sucraseOptions.jsxPragma,
        pragmaFrag: sucraseOptions.jsxFragmentPragma,
      },
    ]);
  }
  if (sucraseOptions.transforms.includes("typescript")) {
    presets.push(["typescript", {allowDeclareFields: true}]);
  }
  if (sucraseOptions.transforms.includes("flow")) {
    presets.push("flow");
    plugins.push("transform-flow-enums");
  }
  if (sucraseOptions.transforms.includes("imports")) {
    plugins.push("transform-modules-commonjs");
  }
  if (sucraseOptions.transforms.includes("react-hot-loader")) {
    plugins.push("react-hot-loader");
  }
  if (sucraseOptions.transforms.includes("jest")) {
    plugins.push("jest-hoist");
  }

  plugins.push("proposal-export-namespace-from");

  if (!sucraseOptions.disableESTransforms) {
    plugins.push(
      "proposal-numeric-separator",
      "proposal-optional-catch-binding",
      "proposal-nullish-coalescing-operator",
      "proposal-optional-chaining",
    );
  }

  if (!sucraseOptions.preserveDynamicImport) {
    plugins.push("dynamic-import-node");
  }

  return runAndProfile(
    () =>
      transform(config.code, {
        filename: sucraseOptions.filePath || getFilePath(),
        presets,
        plugins,
        parserOpts: {
          plugins: [
            "classProperties",
            ["decorators", {decoratorsBeforeExport: false}],
            "jsx",
            "logicalAssignment",
            "numericSeparator",
            "optionalChaining",
          ],
        },
      }).code,
  );
}

function runTypeScript(): {code: string; time: number | null} {
  if (!TypeScript) {
    return {code: "Loading TypeScript...", time: null};
  }
  const {transpileModule, ModuleKind, JsxEmit, ScriptTarget} = TypeScript;
  const {sucraseOptions} = config;
  const invalidTransforms = sucraseOptions.transforms.filter(
    (t) => !["typescript", "imports", "jsx"].includes(t),
  );
  if (invalidTransforms.length > 0) {
    return {code: `Transform "${invalidTransforms[0]}" is not valid in TypeScript.`, time: null};
  }
  let module: ModuleKind;
  if (sucraseOptions.transforms.includes("imports")) {
    module = sucraseOptions.preserveDynamicImport ? ModuleKind.NodeNext : ModuleKind.CommonJS;
  } else {
    module = ModuleKind.ESNext;
  }

  return runAndProfile(
    () =>
      transpileModule(config.code, {
        compilerOptions: {
          module,
          jsx: sucraseOptions.transforms.includes("jsx") ? JsxEmit.React : JsxEmit.Preserve,
          target: sucraseOptions.disableESTransforms ? ScriptTarget.ESNext : ScriptTarget.ES2019,
          esModuleInterop: !sucraseOptions.enableLegacyTypeScriptModuleInterop,
          jsxFactory: sucraseOptions.jsxPragma,
          jsxFragmentFactory: sucraseOptions.jsxFragmentPragma,
        },
      }).outputText,
  );
}

function runAndProfile(runOperation: () => string): {code: string; time: number | null} {
  try {
    const start = performance.now();
    const code = runOperation();
    const time = performance.now() - start;
    return {code, time};
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return {code: e.message, time: null};
  }
}

// Expose the right type when imported via worker-loader.
export default {} as typeof Worker & {new (): Worker};
