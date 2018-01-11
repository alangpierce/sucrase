import {parse} from "../sucrase-babylon";
import {Token} from "../sucrase-babylon/tokenizer/index";
import augmentTokens from "./augmentTokens";
import TokenProcessor from "./TokenProcessor";
import RootTransformer from "./transformers/RootTransformer";
import formatTokens from "./util/formatTokens";

const DEFAULT_BABYLON_PLUGINS = ["jsx", "objectRestSpread", "classProperties"];

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

export function getVersion(): string {
  // eslint-disable-next-line
  return require("../../package.json").version;
}

export function transform(code: string, options: Options): string {
  const tokens = getSucraseTokens(code, options);
  const tokenProcessor = new TokenProcessor(code, tokens);
  return new RootTransformer(tokenProcessor, options.transforms).transform();
}

/**
 * Return a string representation of the sucrase tokens, mostly useful for
 * diagnostic purposes.
 */
export function getFormattedTokens(code: string, options: Options): string {
  const tokens = getSucraseTokens(code, options);
  return formatTokens(code, tokens);
}

function getSucraseTokens(code: string, options: Options): Array<Token> {
  let babylonPlugins = options.babylonPlugins || DEFAULT_BABYLON_PLUGINS;
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
  augmentTokens(code, tokens);
  return tokens;
}
