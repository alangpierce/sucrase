import {parse} from 'babylon';
import JSXTransformer from './jsx';
import TokenProcessor from './tokens';
import { Transformer } from './transformer';
import ImportTransformer from './imports';

const DEFAULT_BABYLON_PLUGINS = ['jsx', 'objectRestSpread'];

export type Transform = 'jsx' | 'imports';

export type Options = {
  transforms?: Array<Transform>,
  babylonPlugins?: Array<string>,
};

export function transform(code: string, options: Options = {}): string {
  const babylonPlugins = options.babylonPlugins || DEFAULT_BABYLON_PLUGINS;
  const transforms = options.transforms || ['jsx'];

  const ast = parse(
    code,
    {tokens: true, sourceType: 'module', plugins: babylonPlugins} as any
  );
  let tokens = ast.tokens;
  tokens = tokens.filter((token) =>
    token.type !== 'CommentLine' && token.type !== 'CommentBlock');
  const tokenProcessor = new TokenProcessor(code, tokens);
  return new RootTransformer(tokenProcessor, transforms).transform();
}

export class RootTransformer {
  private transformers: Array<Transformer> = [];

  constructor(readonly tokens: TokenProcessor, transforms: Array<Transform>) {
    if (transforms.includes('jsx')) {
      this.transformers.push(new JSXTransformer(this, tokens));
    }
    if (transforms.includes('imports')) {
      this.transformers.push(new ImportTransformer(this, tokens));
    }
  }

  transform() {
    this.tokens.reset();
    this.processBalancedCode();
    return this.tokens.finish();
  }

  processBalancedCode() {
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
        if (this.tokens.matches(['{']) || this.tokens.matches(['${'])) {
          braceDepth++;
        } else if (this.tokens.matches(['}'])) {
          if (braceDepth === 0) {
            return;
          }
          braceDepth--;
        }
        if (this.tokens.matches(['('])) {
          parenDepth++;
        } else if (this.tokens.matches([')'])) {
          if (parenDepth === 0) {
            return;
          }
          parenDepth--;
        }
        this.tokens.copyToken();
      }
    }
  }
}
