import {tokenize} from 'babylon';

export default function transform(code: string): string {
  let resultCode = '';

  let tokens = tokenize(code, {sourceType: 'module', plugins: ['jsx']});
  tokens = tokens.filter((token) =>
    token.type !== 'CommentLine' && token.type !== 'CommentBlock');
  let tokenIndex = 0;

  function matchesAtIndex(index: number, tagLabels: Array<string>): boolean {
    for (let i = 0; i < tagLabels.length; i++) {
      if (index + i >= tokens.length) {
        return false;
      }
      if (tokens[index + i].type.label !== tagLabels[i]) {
        return false;
      }
    }
    return true;
  }

  function matches(tagLabels: Array<string>): boolean {
    return matchesAtIndex(tokenIndex, tagLabels);
  }

  /**
   * Produce the props arg to createElement, starting at the first token of the
   * props, if any.
   */
  function processProps() {
    if (!matches(['jsxName']) && !matches(['{'])) {
      resultCode += ', null';
      return;
    }
    resultCode += ', {';
    while (true) {
      if (matches(['jsxName', '='])) {
        copyToken();
        replaceToken(': ');
        if (matches(['{'])) {
          replaceToken('');
          processBalancedCode();
          replaceToken('');
        } else {
          copyToken();
        }
      } else if (matches(['jsxName'])) {
        copyToken();
        resultCode += ': true';
      } else if (matches(['{'])) {
        replaceToken('');
        processBalancedCode();
        replaceToken('');
      } else {
        break;
      }
      resultCode += ',';
    }
    resultCode += '}';
  }

  /**
   * Process the first part of a tag, before any props.
   */
  function processTagIntro() {
    // Walk forward until we see one of these patterns:
    // [jsxIdentifer, equals] to start the first prop.
    // [open brace] to start the first prop.
    // [jsxTagEnd] to end the open-tag.
    // [slash, jsxTagEnd] to end the self-closing tag.
    let introEnd = tokenIndex + 1;
    while (
      !matchesAtIndex(introEnd, ['jsxName', '=']) &&
      !matchesAtIndex(introEnd, ['{']) &&
      !matchesAtIndex(introEnd, ['jsxTagEnd']) &&
      !matchesAtIndex(introEnd, ['/', 'jsxTagEnd'])
    ) {
      introEnd++;
    }
    if (introEnd === tokenIndex + 1 && startsWithLowerCase(tokens[tokenIndex].value)) {
      replaceToken(`'${tokens[tokenIndex].value}'`);
    }
    while (tokenIndex < introEnd) {
      copyToken();
    }
  }

  function processChildren() {
    while (true) {
      if (matches(['jsxTagStart', '/'])) {
        // Closing tag, so no more children.
        return;
      }
      if (matches(['{'])) {
        // Interpolated expression.
        replaceToken(', ');
        processBalancedCode();
        replaceToken('');
      } else if (matches(['jsxTagStart'])) {
        // Child JSX element
        resultCode += ', ';
        processJSXTag();
      } else if (matches(['jsxText'])) {
        const value = tokens[tokenIndex].value;
        const replacementCode = formatJSXTextReplacement(value);
        const literalCode = formatJSXTextLiteral(value);
        if (literalCode === '""') {
          replaceToken(replacementCode);
        } else {
          replaceToken(', ' + literalCode + replacementCode);
        }
      } else {
        throw new Error('Unexpected token when processing JSX children.');
      }
    }
  }

  function processJSXTag() {
    // First tag is always jsxTagStart.
    replaceToken('React.createElement(');
    processTagIntro();
    processProps();

    if (matches(['/', 'jsxTagEnd'])) {
      // Self-closing tag.
      replaceToken('');
      replaceToken(')')
    } else if (matches(['jsxTagEnd'])) {
      replaceToken('');
      // Tag with children.
      processChildren();
      while (!matches(['jsxTagEnd'])) {
        replaceToken('');
      }
      replaceToken(')');
    } else {
      throw new Error('Expected either /> or > at the end of the tag.');
    }
  }

  function processBalancedCode() {
    let braceDepth = 0;
    while (tokenIndex < tokens.length) {
      if (matches(['jsxTagStart'])) {
        processJSXTag();
      } else {
        if (matches(['{']) || matches(['${'])) {
          braceDepth++;
        } else if (matches(['}'])) {
          if (braceDepth === 0) {
            return;
          }
          braceDepth--;
        }
        copyToken();
      }
    }
  }

  function replaceToken(newCode: string) {
    resultCode += code.slice(
      tokenIndex > 0 ? tokens[tokenIndex - 1].end : 0, tokens[tokenIndex].start);
    resultCode += newCode;
    tokenIndex++;
  }

  function copyToken() {
    resultCode += code.slice(
      tokenIndex > 0 ? tokens[tokenIndex - 1].end : 0, tokens[tokenIndex].start);
    resultCode += code.slice(tokens[tokenIndex].start, tokens[tokenIndex].end);
    tokenIndex++;
  }

  processBalancedCode();
  resultCode += code.slice(tokens[tokens.length - 1].end);
  return resultCode;
}

function startsWithLowerCase(s: string): boolean {
  return s[0] == s[0].toLowerCase();
}

/**
 * Turn the given jsxText string into a JS string literal.
 *
 * We use JSON.stringify to introduce escape characters as necessary, and trim
 * the start and end of each line and remove blank lines.
 */
function formatJSXTextLiteral(text: string): string {
  // Introduce fake characters at the start and end to avoid trimming the start
  // of the first line or the end of the last line.
  let lines = `!${text}!`.split('\n');
  lines = lines.map((line) => line.trim());
  lines[0] = lines[0].slice(1);
  lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);
  lines = lines.filter((line) => line);
  return JSON.stringify(lines.join(' '));
}

/**
 * Produce the code that should be printed after the JSX text string literal,
 * with most content removed, but all newlines preserved and all spacing at the
 * end preserved.
 */
function formatJSXTextReplacement(text: string): string {
  let lines = text.split('\n');
  lines = lines.map((line: string, i: number) =>
    i < lines.length - 1
      ? ''
      : Array.from(line).filter((char) => char === ' ').join('')
  );
  return lines.join('\n');
}
