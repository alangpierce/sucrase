/* eslint-disable no-restricted-globals */
import * as Babel from "@babel/standalone";
import * as Sucrase from "sucrase";
import * as TypeScript from "typescript";

import {TRANSFORMS} from "./Constants";
import {compressCode} from "./URLHashState";
import getTokens from "./getTokens";
Babel.registerPlugin(
  "proposal-numeric-separator",
  require("@babel/plugin-proposal-numeric-separator"),
);
Babel.registerPlugin("dynamic-import-node", require("babel-plugin-dynamic-import-node"));

let config = null;

/**
 * The worker architecture intentionally bypasses the browser event loop in
 * favor of.
 */
self.addEventListener("message", ({data}) => {
  self.postMessage(processEvent(data));
});

function processEvent(data) {
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
}

function getSelectedTransforms() {
  return TRANSFORMS.map(({name}) => name).filter((name) => config.selectedTransforms[name]);
}

function getFilePath() {
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

function runSucrase() {
  return runAndProfile(
    () =>
      Sucrase.transform(config.code, {transforms: getSelectedTransforms(), filePath: getFilePath()})
        .code,
  );
}

function runBabel() {
  let babelPlugins = TRANSFORMS.filter(({name}) => config.selectedTransforms[name])
    .map(({babelName}) => babelName)
    .filter((name) => name);
  const babelPresets = TRANSFORMS.filter(({name}) => config.selectedTransforms[name])
    .map(({presetName}) => presetName)
    .filter((name) => name);
  return runAndProfile(
    () =>
      Babel.transform(config.code, {
        filename: getFilePath(),
        presets: babelPresets,
        plugins: [
          ...babelPlugins,
          "proposal-export-namespace-from",
          "proposal-numeric-separator",
          "proposal-optional-catch-binding",
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

function runTypeScript() {
  for (const {name} of TRANSFORMS) {
    if (["typescript", "imports", "jsx"].includes(name)) {
      continue;
    }
    if (config.selectedTransforms[name]) {
      return {code: `Transform "${name}" is not valid in TypeScript.`};
    }
  }
  return runAndProfile(
    () =>
      TypeScript.transpileModule(config.code, {
        compilerOptions: {
          module: config.selectedTransforms.imports
            ? TypeScript.ModuleKind.CommonJS
            : TypeScript.ModuleKind.ESNext,
          jsx: config.selectedTransforms.jsx
            ? TypeScript.JsxEmit.React
            : TypeScript.JsxEmit.Preserve,
          target: TypeScript.ScriptTarget.ESNext,
        },
      }).outputText,
  );
}

function runAndProfile(runOperation) {
  try {
    const start = performance.now();
    const code = runOperation();
    const time = performance.now() - start;
    return {code, time};
  } catch (e) {
    console.error(e);
    return {code: e.message, time: null};
  }
}
