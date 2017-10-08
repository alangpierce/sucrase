import {parse} from 'babylon';
import JSXTransformer from './jsx';
import TokenProcessor from './tokens';

const DEFAULT_PLUGINS = ['jsx', 'objectRestSpread'];

export type Options = {
  transforms?: Array<'jsx' | 'imports'>,
  babylonPlugins?: Array<string>,
};

export function transform(code: string, options: Options = {}): string {
  const babylonPlugins = options.babylonPlugins || DEFAULT_PLUGINS;
  const transforms = options.transforms || ['jsx'];

  if (transforms.includes('imports')) {
    throw new Error('Import transform is not supported yet.');
  }
  if (!transforms.includes('jsx')) {
    return code;
  }
  const ast = parse(
    code,
    {tokens: true, sourceType: 'module', plugins: babylonPlugins} as any
  );
  let tokens = ast.tokens;
  tokens = tokens.filter((token) =>
    token.type !== 'CommentLine' && token.type !== 'CommentBlock');
  const tokenProcessor = new TokenProcessor(code, tokens);
  return new RootTransformer(tokenProcessor).transform();
}

export class RootTransformer {
  private jsxTransformer: JSXTransformer;

  constructor(readonly tokens: TokenProcessor) {
    this.jsxTransformer = new JSXTransformer(this, tokens);
  }

  transform() {
    this.tokens.reset();
    this.processBalancedCode();
    return this.tokens.finish();
  }

  processBalancedCode() {
    let braceDepth = 0;
    while (!this.tokens.isAtEnd()) {
      if (this.tokens.matches(['jsxTagStart'])) {
        this.jsxTransformer.processJSXTag();
      } else {
        if (this.tokens.matches(['{']) || this.tokens.matches(['${'])) {
          braceDepth++;
        } else if (this.tokens.matches(['}'])) {
          if (braceDepth === 0) {
            return;
          }
          braceDepth--;
        }
        this.tokens.copyToken();
      }
    }
  }
}
