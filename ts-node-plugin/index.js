const {transform} = require("../dist");

const ModuleKindCommonJS = 1;

/**
 * ts-node transpiler plugin
 */
function create(createOptions) {
  const {nodeModuleEmitKind} = createOptions;
  const {module, jsx, jsxFactory, jsxFragmentFactory, esModuleInterop} =
    createOptions.service.config.options;

  return {
    transpile(input, transpileOptions) {
      const {fileName} = transpileOptions;
      const transforms = [];
      const isJS =
        fileName.endsWith(".js") ||
        fileName.endsWith(".jsx") ||
        fileName.endsWith(".mjs") ||
        fileName.endsWith(".cjs");
      // Detect JS rather than TS so we bias toward including the typescript
      // transform, since almost always it doesn't hurt to include.
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
