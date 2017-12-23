import {getTokens} from "../sucrase-babylon";
import augmentTokenContext from "./augmentTokenContext";
import ImportProcessor from "./ImportProcessor";
import NameManager from "./NameManager";
import TokenProcessor from "./TokenProcessor";
import ImportTransformer from "./transformers/ImportTransformer";
import JSXTransformer from "./transformers/JSXTransformer";
import ReactDisplayNameTransformer from "./transformers/ReactDisplayNameTransformer";
import Transformer from "./transformers/Transformer";

const DEFAULT_BABYLON_PLUGINS = ["jsx", "flow", "objectRestSpread"];

export type Transform = "jsx" | "imports" | "flow" | "add-module-exports" | "react-display-name";

export type Options = {
  transforms?: Array<Transform>;
  babylonPlugins?: Array<string>;
};

export function getVersion(): string {
  // eslint-disable-next-line
  return require('../../package.json').version;
}

export function transform(code: string, options: Options = {}): string {
  const babylonPlugins = options.babylonPlugins || DEFAULT_BABYLON_PLUGINS;
  const transforms = options.transforms || ["jsx"];

  let tokens = getTokens(
    code,
    {
      tokens: true,
      sourceType: "module",
      plugins: babylonPlugins,
    } as any /* tslint:disable-line no-any */,
  );
  tokens = tokens.filter((token) => token.type !== "CommentLine" && token.type !== "CommentBlock");
  augmentTokenContext(tokens);
  const tokenProcessor = new TokenProcessor(code, tokens);
  return new RootTransformer(tokenProcessor, transforms).transform();
}

export class RootTransformer {
  private transformers: Array<Transformer> = [];

  constructor(readonly tokens: TokenProcessor, transforms: Array<Transform>) {
    const nameManager = new NameManager(tokens);
    const importProcessor = transforms.includes("imports")
      ? new ImportProcessor(nameManager, tokens)
      : null;
    const identifierReplacer = importProcessor || {getIdentifierReplacement: () => null};

    if (transforms.includes("jsx")) {
      this.transformers.push(new JSXTransformer(this, tokens, identifierReplacer));
    }

    // react-display-name must come before imports since otherwise imports will
    // claim a normal `React` name token.
    if (transforms.includes("react-display-name")) {
      this.transformers.push(new ReactDisplayNameTransformer(this, tokens, identifierReplacer));
    }

    if (transforms.includes("imports")) {
      const shouldAddModuleExports = transforms.includes("add-module-exports");
      this.transformers.push(
        new ImportTransformer(this, tokens, nameManager, importProcessor!, shouldAddModuleExports),
      );
    }
  }

  transform(): string {
    this.tokens.reset();
    for (const transformer of this.transformers) {
      transformer.preprocess();
    }
    this.processBalancedCode();
    let prefix = "";
    for (const transformer of this.transformers) {
      prefix += transformer.getPrefixCode();
    }
    let suffix = "";
    for (const transformer of this.transformers) {
      suffix += transformer.getSuffixCode();
    }
    return prefix + this.tokens.finish() + suffix;
  }

  processBalancedCode(): void {
    let braceDepth = 0;
    let parenDepth = 0;
    while (!this.tokens.isAtEnd()) {
      let wasProcessed = false;
      for (const transformer of this.transformers) {
        wasProcessed = transformer.process();
        if (wasProcessed) {
          break;
        }
      }
      if (!wasProcessed) {
        if (this.tokens.matches(["{"]) || this.tokens.matches(["${"])) {
          braceDepth++;
        } else if (this.tokens.matches(["}"])) {
          if (braceDepth === 0) {
            return;
          }
          braceDepth--;
        }
        if (this.tokens.matches(["("])) {
          parenDepth++;
        } else if (this.tokens.matches([")"])) {
          if (parenDepth === 0) {
            return;
          }
          parenDepth--;
        }
        this.tokens.copyToken();
      }
    }
  }

  processToken(): void {
    for (const transformer of this.transformers) {
      const wasProcessed = transformer.process();
      if (wasProcessed) {
        return;
      }
    }
    this.tokens.copyToken();
  }
}
