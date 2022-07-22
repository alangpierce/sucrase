const {transform} = require("../dist");

const ModuleKindCommonJS = 1;

/**
 * ts-node transpiler plugin
 */
function create(createOptions) {
  const {nodeModuleEmitKind} = createOptions;
  const {module} = createOptions.service.config.options;
  return {
    transpile(input, transpileOptions) {
      const {fileName} = transpileOptions;
      const transforms = ["typescript"];
      if (module === ModuleKindCommonJS || nodeModuleEmitKind === "nodecjs") {
        transforms.push("imports");
      }
      if (fileName.endsWith(".tsx") || fileName.endsWith(".jsx")) {
        transforms.push("jsx");
      }

      const {code, sourceMap} = transform(input, {
        transforms,
        sourceMapOptions: {compiledFilename: fileName},
        filePath: fileName,
        preserveDynamicImport: nodeModuleEmitKind === "nodecjs",
        injectCreateRequireForImportRequire: nodeModuleEmitKind === "nodeesm",
        disableESTransforms: true,
      });
      return {
        outputText: code,
        sourceMapText: JSON.stringify(sourceMap),
      };
    },
  };
}

exports.create = create;
