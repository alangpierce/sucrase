import { Token, TokenContext } from './tokens';

/**
 * Scan the tokens and assign a "context" to each one. For example, we need to
 * know when a comma separates object literal fields vs array elements so that
 * we can properly handle object shorthand inline.
 */
export default function augmentTokenContext(tokens: Array<Token>): void {
  let index = 0;

  function processToToken(closingTokenLabel: string, context: TokenContext) {
    processRegion([closingTokenLabel], context);
  }

  function matchesTokens(labels: Array<string>) {
    for (let i = 0; i < labels.length; i++) {
      let newIndex = index + i;
      if (newIndex >= tokens.length || tokens[newIndex].type.label !== labels[i]) {
        return false;
      }
    }
    return true;
  }

  function processRegion(closingTokenLabels: Array<string>, context: TokenContext) {
    function advance() {
      if (index < tokens.length) {
        tokens[index].contextName = context;
      }
      index++;
    }

    let pendingClass = false;
    while (index < tokens.length) {
      if (matchesTokens(closingTokenLabels)) {
        for (let i = 0; i < closingTokenLabels.length; i++) {
          advance();
        }
        break;
      }
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
            processToToken(')', 'parens');
            if (tokens[index].type.label === '{') {
              advance();
              processToToken('}', 'block');
            }
            continue;
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
            processToToken('}', 'block');
            continue;
          }
        } else if (token.type.label === 'class') {
          pendingClass = true;
          continue;
        }
      }

      if (token.type.label === 'name') {
        if (context === 'class' && tokens[index].type.label === '(') {
          // Process class method.
          advance();
          processToToken(')', 'parens');
          if (tokens[index].type.label === '{') {
            advance();
            processToToken('}', 'block');
          }
        } else if (
          context === 'object' && tokens[index].type.label === '(' &&
          (tokens[index - 2].type.label === ',' || tokens[index - 2].type.label === '{')
        ) {
          // Process object method.
          advance();
          processToToken(')', 'parens');
          if (tokens[index].type.label === '{') {
            advance();
            processToToken('}', 'block');
          }
        }
      } else if (token.type.label === 'jsxTagStart') {
        processToToken('jsxTagEnd', 'jsxTag');
        // Non-self-closing tag, so use jsxChild context for the body.
        if (tokens[index - 2].type.label !== '/') {
          // All / tokens will be in JSX tags.
          processRegion(['jsxTagStart', '/'], 'jsxChild');
          processToToken('jsxTagEnd', 'jsxTag');
        }
      } else if (token.type.label === '{') {
        if (pendingClass && lastToken.type.label !== 'extends') {
          processToToken('}', 'class');
          pendingClass = false;
        } else if (context === 'jsxTag' || context === 'jsxChild') {
          processToToken('}', 'jsxExpression');
        } else {
          processToToken('}', 'object');
        }
      } else if (token.type.label === '[') {
        processToToken(']', 'brackets');
      } else if (token.type.label === '(') {
        processToToken(')', 'parens');
      } else if (token.type.label === '${') {
        processToToken('}', 'interpolatedExpression');
      }
    }
  }
  processToToken('NONE', 'block');
}
