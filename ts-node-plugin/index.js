const {transform} = require("../dist");

// Enum constants taken from the TypeScript codebase.
const ModuleKindCommonJS = 1;

const JsxEmitReactJSX = 4;
const JsxEmitReactJSXDev = 5;

/**
 * ts-node transpiler plugin
 *
 * This plugin hooks into ts-node so that Sucrase can handle all TS-to-JS
 * conversion while ts-node handles the ESM loader, require hook, REPL
 * integration, etc. ts-node automatically discovers the relevant tsconfig file,
 * so the main logic in this integration is translating tsconfig options to the
 * corresponding Sucrase options.
 *
 * Any tsconfig options relevant to Sucrase are translated, but some config
 * options outside the scope of Sucrase are ignored. For example, we assume the
 * isolatedModules option, and we ignore target because Sucrase doesn't provide
 * JS syntax downleveling (at least not in a way that is useful for Node).
 *
 * One notable caveat is that importsNotUsedAsValues and preserveValueImports
 * are ignored right now, and Sucrase uses TypeScript's default behavior of
 * eliding imports only used as types. This usually makes no difference when
 * running the code, so for now we ignore these options without a warning.
 */
function create(createOptions) {
  const {nodeModuleEmitKind} = createOptions;
  const {module, jsx, jsxFactory, jsxFragmentFactory, esModuleInterop} =
    createOptions.service.config.options;

  // A project with the new JSX transform configured likely has at least one
  // file with JSX where React is not imported, so fail fast and suggest the
  // old JSX transform as a workaround.
  if (jsx === JsxEmitReactJSX || jsx === JsxEmitReactJSXDev) {
    throw new Error(
      'The JSX modes "react-jsx" and "react-jsxdev" are not yet ' +
        'supported by Sucrase. Consider using "react" as a workaround.',
    );
  }

  return {
    transpile(input, transpileOptions) {
      const {fileName} = transpileOptions;
      const transforms = [];
      // Detect JS rather than TS so we bias toward including the typescript
      // transform, since almost always it doesn't hurt to include.
      const isJS =
        fileName.endsWith(".js") ||
        fileName.endsWith(".jsx") ||
        fileName.endsWith(".mjs") ||
        fileName.endsWith(".cjs");
      if (!isJS) {
        transforms.push("typescript");
      }
      if (module === ModuleKindCommonJS || nodeModuleEmitKind === "nodecjs") {
        transforms.push("imports");
      }
      if (fileName.endsWith(".tsx") || fileName.endsWith(".jsx")) {
        transforms.push("jsx");
      }

      const {code, sourceMap} = transform(input, {
        transforms,
        disableESTransforms: true,
        jsxPragma: jsxFactory,
        jsxFragmentPragma: jsxFragmentFactory,
        preserveDynamicImport: nodeModuleEmitKind === "nodecjs",
        injectCreateRequireForImportRequire: nodeModuleEmitKind === "nodeesm",
        enableLegacyTypeScriptModuleInterop: !esModuleInterop,
        sourceMapOptions: {compiledFilename: fileName},
        filePath: fileName,
      });
      return {
        outputText: code,
        sourceMapText: JSON.stringify(sourceMap),
      };
    },
  };
}

exports.create = create;
