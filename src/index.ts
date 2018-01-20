import {parse} from "../sucrase-babylon";
import {Scope} from "../sucrase-babylon/tokenizer/state";
import identifyShadowedGlobals from "./identifyShadowedGlobals";
import ImportProcessor from "./ImportProcessor";
import NameManager from "./NameManager";
import TokenProcessor from "./TokenProcessor";
import RootTransformer from "./transformers/RootTransformer";
import formatTokens from "./util/formatTokens";

const DEFAULT_BABYLON_PLUGINS = [
  "objectRestSpread",
  "classProperties",
  "exportNamespaceFrom",
  "numericSeparator",
  "dynamicImport",
];

export type Transform =
  | "jsx"
  | "imports"
  | "flow"
  | "typescript"
  | "add-module-exports"
  | "react-display-name";

export type Options = {
  transforms: Array<Transform>;
  babylonPlugins?: Array<string>;
};

export type SucraseContext = {
  tokenProcessor: TokenProcessor;
  scopes: Array<Scope>;
  nameManager: NameManager;
  importProcessor: ImportProcessor;
};

export function getVersion(): string {
  // eslint-disable-next-line
  return require("../../package.json").version;
}

export function transform(code: string, options: Options): string {
  const sucraseContext = getSucraseContext(code, options);
  return new RootTransformer(sucraseContext, options.transforms).transform();
}

/**
 * Return a string representation of the sucrase tokens, mostly useful for
 * diagnostic purposes.
 */
export function getFormattedTokens(code: string, options: Options): string {
  const tokens = getSucraseContext(code, options).tokenProcessor.tokens;
  return formatTokens(code, tokens);
}

/**
 * Call into the parser/tokenizer and do some further preprocessing:
 * - Come up with a set of used names so that we can assign new names.
 * - Preprocess all import/export statements so we know which globals we are interested in.
 * - Compute situations where any of those globals are shadowed.
 *
 * In the future, some of these preprocessing steps can be skipped based on what actual work is
 * being done.
 */
function getSucraseContext(code: string, options: Options): SucraseContext {
  let babylonPlugins = options.babylonPlugins || DEFAULT_BABYLON_PLUGINS;
  if (options.transforms.includes("jsx")) {
    babylonPlugins = [...babylonPlugins, "jsx"];
  }
  if (options.transforms.includes("flow")) {
    babylonPlugins = [...babylonPlugins, "flow"];
  }
  if (options.transforms.includes("typescript")) {
    babylonPlugins = [...babylonPlugins, "typescript"];
  }
  const file = parse(code, {
    tokens: true,
    sourceType: "module",
    plugins: babylonPlugins,
  });
  const tokens = file.tokens;
  const scopes = file.scopes;

  const tokenProcessor = new TokenProcessor(code, tokens);
  const nameManager = new NameManager(tokenProcessor);
  nameManager.preprocessNames();
  const isTypeScript = options.transforms.includes("typescript");
  const importProcessor = new ImportProcessor(nameManager, tokenProcessor, isTypeScript);
  importProcessor.preprocessTokens();
  if (isTypeScript) {
    importProcessor.pruneTypeOnlyImports();
  }
  identifyShadowedGlobals(tokens, scopes, importProcessor.getGlobalNames());
  return {tokenProcessor, scopes, nameManager, importProcessor};
}
