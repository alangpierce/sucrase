import { RootTransformer } from './index';
import TokenProcessor from './tokens';
import { Transformer } from './transformer';
import { ImportProcessor } from './ImportProcessor';

export interface IdentifierReplacer {
  getIdentifierReplacement(identifierName: string): string | null;
}

export default class JSXTransformer implements Transformer {
  constructor(readonly rootTransformer: RootTransformer, readonly tokens: TokenProcessor, readonly identifierReplacer: IdentifierReplacer) {
  }

  preprocess() {
    // Do nothing.
  }

  process(): boolean {
    if (this.tokens.matches(['jsxTagStart'])) {
      this.processJSXTag();
      return true;
    }
    return false;
  }

  getPrefixCode(): string {
    return '';
  }

  /**
   * Produce the props arg to createElement, starting at the first token of the
   * props, if any.
   */
  processProps() {
    if (!this.tokens.matches(['jsxName']) && !this.tokens.matches(['{'])) {
      this.tokens.appendCode(', null');
      return;
    }
    this.tokens.appendCode(', {');
    while (true) {
      if (this.tokens.matches(['jsxName', '='])) {
        if (this.tokens.currentToken().value.includes('-')) {
          this.tokens.replaceToken(`'${this.tokens.currentToken().value}'`);
        } else {
          this.tokens.copyToken();
        }
        this.tokens.replaceToken(': ');
        if (this.tokens.matches(['{'])) {
          this.tokens.replaceToken('');
          this.rootTransformer.processBalancedCode();
          this.tokens.replaceToken('');
        } else {
          this.processStringPropValue();
        }
      } else if (this.tokens.matches(['jsxName'])) {
        this.tokens.copyToken();
        this.tokens.appendCode(': true');
      } else if (this.tokens.matches(['{'])) {
        this.tokens.replaceToken('');
        this.rootTransformer.processBalancedCode();
        this.tokens.replaceToken('');
      } else {
        break;
      }
      this.tokens.appendCode(',');
    }
    this.tokens.appendCode('}');
  }

  processStringPropValue() {
    const value = this.tokens.currentToken().value;
    const replacementCode = formatJSXTextReplacement(value);
    const literalCode = formatJSXStringValueLiteral(value);
    this.tokens.replaceToken(literalCode + replacementCode);
  }

  /**
   * Process the first part of a tag, before any props.
   */
  processTagIntro() {
    // Walk forward until we see one of these patterns:
    // [jsxIdentifer, equals] to start the first prop.
    // [open brace] to start the first prop.
    // [jsxTagEnd] to end the open-tag.
    // [slash, jsxTagEnd] to end the self-closing tag.
    let introEnd = this.tokens.currentIndex() + 1;
    while (
      !this.tokens.matchesAtIndex(introEnd, ['jsxName', '=']) &&
      !this.tokens.matchesAtIndex(introEnd, ['{']) &&
      !this.tokens.matchesAtIndex(introEnd, ['jsxTagEnd']) &&
      !this.tokens.matchesAtIndex(introEnd, ['/', 'jsxTagEnd'])
      ) {
      introEnd++;
    }
    if (introEnd === this.tokens.currentIndex() + 1 &&
        startsWithLowerCase(this.tokens.currentToken().value)) {
      this.tokens.replaceToken(`'${this.tokens.currentToken().value}'`);
    }
    while (this.tokens.currentIndex() < introEnd) {
      this.rootTransformer.processToken();
    }
  }

  processChildren() {
    while (true) {
      if (this.tokens.matches(['jsxTagStart', '/'])) {
        // Closing tag, so no more children.
        return;
      }
      if (this.tokens.matches(['{'])) {
        if (this.tokens.matches(['{', '}'])) {
          // Empty interpolations and comment-only interpolations are allowed
          // and don't create an extra child arg.
          this.tokens.replaceToken('');
          this.tokens.replaceToken('');
        } else {
          // Interpolated expression.
          this.tokens.replaceToken(', ');
          this.rootTransformer.processBalancedCode();
          this.tokens.replaceToken('');
        }
      } else if (this.tokens.matches(['jsxTagStart'])) {
        // Child JSX element
        this.tokens.appendCode(', ');
        this.processJSXTag();
      } else if (this.tokens.matches(['jsxText'])) {
        this.processChildTextElement();
      } else {
        throw new Error('Unexpected token when processing JSX children.');
      }
    }
  }

  processChildTextElement() {
    const value = this.tokens.currentToken().value;
    const replacementCode = formatJSXTextReplacement(value);
    const literalCode = formatJSXTextLiteral(value);
    if (literalCode === '""') {
      this.tokens.replaceToken(replacementCode);
    } else {
      this.tokens.replaceToken(', ' + literalCode + replacementCode);
    }
  }

  processJSXTag() {
    const resolvedReactName =
      this.identifierReplacer.getIdentifierReplacement('React') || 'React';
    // First tag is always jsxTagStart.
    this.tokens.replaceToken(`${resolvedReactName}.createElement(`);
    this.processTagIntro();
    this.processProps();

    if (this.tokens.matches(['/', 'jsxTagEnd'])) {
      // Self-closing tag.
      this.tokens.replaceToken('');
      this.tokens.replaceToken(')')
    } else if (this.tokens.matches(['jsxTagEnd'])) {
      this.tokens.replaceToken('');
      // Tag with children.
      this.processChildren();
      while (!this.tokens.matches(['jsxTagEnd'])) {
        this.tokens.replaceToken('');
      }
      this.tokens.replaceToken(')');
    } else {
      throw new Error('Expected either /> or > at the end of the tag.');
    }
  }
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
  // Trim spaces and tabs, but NOT non-breaking spaces.
  lines = lines.map((line) => line.replace(/^[ \t]*/, '').replace(/[ \t]*$/, ''));
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

/**
 * Format a string in the value position of a JSX prop.
 *
 * Use the same implementation as convertAttribute from
 * babel-helper-builder-react-jsx.
 */
function formatJSXStringValueLiteral(text: string): string {
  return JSON.stringify(text.replace(/\n\s+/g, " "));
}
