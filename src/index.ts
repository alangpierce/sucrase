import {getTokens} from "../sucrase-babylon";
import augmentTokens from "./augmentTokens";
import TokenProcessor, {Token} from "./TokenProcessor";
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

  let tokens = getTokens(
    code,
    {
      tokens: true,
      sourceType: "module",
      plugins: babylonPlugins,
    } as any /* tslint:disable-line no-any */,
  );
  tokens = tokens.filter((token) => token.type !== "CommentLine" && token.type !== "CommentBlock");
  augmentTokens(code, tokens);
  return tokens;
}
