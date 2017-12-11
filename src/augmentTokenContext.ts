import { Token, TokenContext } from './tokens';

/**
 * Scan the tokens and assign a "context" to each one. For example, we need to
 * know when a comma separates object literal fields vs array elements so that
 * we can properly handle object shorthand inline.
 */
export default function augmentTokenContext(tokens: Array<Token>): void {
  let index = 0;

  function processRegion(closingTokenLabel: string, context: TokenContext) {
    function advance() {
      if (index < tokens.length) {
        tokens[index].contextName = context;
      }
      index++;
    }

    let pendingClass = false;
    while (index < tokens.length && tokens[index].type.label !== closingTokenLabel) {
      const lastToken = tokens[index - 1];
      const token = tokens[index];
      advance();

      // Keywords can be property values, so bail out if we're after a dot.
      if (!lastToken || lastToken.type.label !== '.') {
        if (
          token.type.label === 'if' ||
          token.type.label === 'for' ||
          token.type.label === 'while' ||
          token.type.label === 'catch' ||
          token.type.label === 'function'
        ) {
          // Code of the form TOKEN (...) BLOCK
          if (token.type.label === 'function' && tokens[index].type.label === 'name') {
            advance();
          }
          if (tokens[index].type.label === '(') {
            advance();
            processRegion(')', 'parens');
            if (tokens[index].type.label === '{') {
              advance();
              processRegion('}', 'block');
            }
          }
        } else if (
          token.type.label === '=>' ||
          token.type.label === 'else' ||
          token.type.label === 'try' ||
          token.type.label === 'finally' ||
          token.type.label === 'do' ||
          token.type.label === '}' ||
          token.type.label === ')' ||
          (token.type.label === ';' && context === 'block')
        ) {
          if (tokens[index].type.label === '{') {
            advance();
            processRegion('}', 'block');
          }
        } else if (token.type.label === 'class') {
          pendingClass = true;
        }
      }

      if (token.type.label === '{') {
        if (pendingClass && lastToken.type.label !== 'extends') {
          processRegion('}', 'class');
          pendingClass = false;
        } else {
          processRegion('}', 'object');
        }
      } else if (token.type.label === '[') {
        processRegion(']', 'brackets');
      } else if (token.type.label === '(') {
        processRegion(')', 'parens');
      }
    }
    advance();
  }
  processRegion('NONE', 'block');
}
