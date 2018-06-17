import {RawSourceMap} from "source-map";
import CJSImportProcessor from "./CJSImportProcessor";
import computeSourceMap from "./computeSourceMap";
import identifyShadowedGlobals from "./identifyShadowedGlobals";
import NameManager from "./NameManager";
import {parse} from "./parser";
import {Scope} from "./parser/tokenizer/state";
import TokenProcessor from "./TokenProcessor";
import RootTransformer from "./transformers/RootTransformer";
import formatTokens from "./util/formatTokens";

export type Transform = "jsx" | "typescript" | "flow" | "imports";

export interface Options {
  transforms: Array<Transform>;
  /**
   * If specified, function name to use in place of React.createClass when compiling JSX.
   */
  jsxPragma?: string;
  /**
   * If specified, function name to use in place of React.Fragment when compiling JSX.
   */
  jsxFragmentPragma?: string;
  /**
   * If true, replicate the import behavior of TypeScript's esModuleInterop: false.
   */
  enableLegacyTypeScriptModuleInterop?: boolean;
  /**
   * If true, replicate the import behavior Babel 5 and babel-plugin-add-module-exports.
   */
  enableLegacyBabel5ModuleInterop?: boolean;
  /**
   * If true, we also return a RawSourceMap object alongside the code. Currently, source maps simply
   * map each line to the original line without any mappings within lines, since Sucrase preserves
   * line numbers. filePath must be specified if this option is enabled.
   */
  computeSourceMap?: boolean;
  /**
   * File path to use in error messages, React display names, and source maps.
   */
  filePath?: string;
}

export interface TransformResult {
  code: string;
  sourceMap?: RawSourceMap;
}

export interface SucraseContext {
  tokenProcessor: TokenProcessor;
  scopes: Array<Scope>;
  nameManager: NameManager;
  importProcessor: CJSImportProcessor | null;
}

export function getVersion(): string {
  // eslint-disable-next-line
  return require("../package.json").version;
}

export function transform(code: string, options: Options): TransformResult {
  try {
    const sucraseContext = getSucraseContext(code, options);
    const transformer = new RootTransformer(
      sucraseContext,
      options.transforms,
      Boolean(options.enableLegacyBabel5ModuleInterop),
      options,
    );
    let result: TransformResult = {code: transformer.transform()};
    if (options.computeSourceMap) {
      if (!options.filePath) {
        throw new Error("filePath must be specified when generating a source map.");
      }
      result = {...result, sourceMap: computeSourceMap(result.code, options.filePath)};
    }
    return result;
  } catch (e) {
    if (options.filePath) {
      e.message = `Error transforming ${options.filePath}: ${e.message}`;
    }
    throw e;
  }
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
  const isJSXEnabled = options.transforms.includes("jsx");
  const isTypeScriptEnabled = options.transforms.includes("typescript");
  const isFlowEnabled = options.transforms.includes("flow");
  const file = parse(code, isJSXEnabled, isTypeScriptEnabled, isFlowEnabled);
  const tokens = file.tokens;
  const scopes = file.scopes;

  const tokenProcessor = new TokenProcessor(code, tokens);
  const nameManager = new NameManager(tokenProcessor);
  nameManager.preprocessNames();
  const enableLegacyTypeScriptModuleInterop = Boolean(options.enableLegacyTypeScriptModuleInterop);

  let importProcessor = null;
  if (options.transforms.includes("imports")) {
    importProcessor = new CJSImportProcessor(
      nameManager,
      tokenProcessor,
      enableLegacyTypeScriptModuleInterop,
    );
    importProcessor.preprocessTokens();
    if (options.transforms.includes("typescript")) {
      importProcessor.pruneTypeOnlyImports();
    }
    identifyShadowedGlobals(tokenProcessor, scopes, importProcessor.getGlobalNames());
  }
  return {tokenProcessor, scopes, nameManager, importProcessor};
}
