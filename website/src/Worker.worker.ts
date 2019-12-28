/* eslint-disable no-restricted-globals */
import * as Sucrase from "sucrase";
import {TRANSFORMS} from "./Constants";
import getTokens from "./getTokens";
import {compressCode} from "./URLHashState";
import {Message, WorkerConfig, WorkerMessage} from "./WorkerProtocol";

type Transform = Sucrase.Transform;

declare const self: Worker;

let Babel: typeof import("./Babel") | null = null;
let TypeScript: typeof import("typescript") | null = null;

function postMessage(message: WorkerMessage): void {
  self.postMessage(message);
}

/**
 * Hacky workaround for the fact that chunk loading in workers is normally
 * synchronous. We determine the chunk name based on how the webpack config
 * chooses names, then load that up-front in a fetch (which is actually async).
 * This makes it so the later import() will be able to pull the JS from cache,
 * and thus block the worker for a much shorter period of time.
 */
async function prefetchChunk(chunkName: string): Promise<void> {
  const path = location.pathname.replace(/\/\d+\./, `/${chunkName}.`);
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

// tslint:disable-next-line no-floating-promises
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
    return getTokens(config.code, getSelectedTransforms());
  } else if (data.type === "PROFILE_SUCRASE") {
    return runSucrase().time;
  } else if (data.type === "PROFILE_BABEL") {
    return runBabel().time;
  } else if (data.type === "PROFILE_TYPESCRIPT") {
    return runTypeScript().time;
  }
  return null;
}

function getSelectedTransforms(): Array<Transform> {
  return TRANSFORMS.map(({name}) => name).filter((name) => config.selectedTransforms[name]);
}

function getFilePath(): string {
  if (config.selectedTransforms.typescript) {
    if (config.selectedTransforms.jsx) {
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
    () =>
      Sucrase.transform(config.code, {transforms: getSelectedTransforms(), filePath: getFilePath()})
        .code,
  );
}

function runBabel(): {code: string; time: number | null} {
  if (!Babel) {
    return {code: "Loading Babel...", time: null};
  }
  const {transform} = Babel;
  const babelPlugins = TRANSFORMS.filter(({name}) => config.selectedTransforms[name])
    .map(({babelName}) => babelName)
    .filter((name) => name);
  const babelPresets = TRANSFORMS.filter(({name}) => config.selectedTransforms[name])
    .map(({presetName}) => presetName)
    .filter((name) => name);
  return runAndProfile(
    () =>
      transform(config.code, {
        filename: getFilePath(),
        presets: babelPresets,
        plugins: [
          ...babelPlugins,
          "proposal-export-namespace-from",
          "proposal-numeric-separator",
          "proposal-optional-catch-binding",
          "proposal-nullish-coalescing-operator",
          "proposal-optional-chaining",
          "dynamic-import-node",
        ],
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
  for (const {name} of TRANSFORMS) {
    if (["typescript", "imports", "jsx"].includes(name)) {
      continue;
    }
    if (config.selectedTransforms[name]) {
      return {code: `Transform "${name}" is not valid in TypeScript.`, time: null};
    }
  }
  return runAndProfile(
    () =>
      transpileModule(config.code, {
        compilerOptions: {
          module: config.selectedTransforms.imports ? ModuleKind.CommonJS : ModuleKind.ESNext,
          jsx: config.selectedTransforms.jsx ? JsxEmit.React : JsxEmit.Preserve,
          target: ScriptTarget.ES2020,
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
