export type TokenContext =
  'block' | 'parens' | 'brackets' | 'object' | 'class' |
  'jsxTag' | 'jsxChild' | 'jsxExpression' | 'interpolatedExpression';

export type TokenType = {
  label: string;
};

export type Token = {
  type: TokenType;
  start: number;
  end: number;
  value: any;
  contextName?: TokenContext;
  contextStartIndex?: number;
};

export default class TokenProcessor {
  private resultCode: string = '';
  private tokenIndex = 0;

  constructor(readonly code: string, readonly tokens: Array<Token>) {
  }

  reset() {
    this.resultCode = '';
    this.tokenIndex = 0;
  }

  matchesAtIndex(index: number, tagLabels: Array<string>): boolean {
    if (index < 0) {
      return false;
    }
    for (let i = 0; i < tagLabels.length; i++) {
      if (index + i >= this.tokens.length) {
        return false;
      }
      if (this.tokens[index + i].type.label !== tagLabels[i]) {
        return false;
      }
    }
    return true;
  }

  matchesNameAtIndex(index: number, name: string): boolean {
    return this.matchesAtIndex(index, ['name']) && this.tokens[index].value === name;
  }

  matches(tagLabels: Array<string>): boolean {
    return this.matchesAtIndex(this.tokenIndex, tagLabels);
  }

  matchesName(name: string): boolean {
    return this.matchesNameAtIndex(this.tokenIndex, name);
  }

  previousWhitespace() {
    return this.code.slice(
      this.tokenIndex > 0
        ? this.tokens[this.tokenIndex - 1].end
        : 0,
      this.tokens[this.tokenIndex].start
    );
  }

  replaceToken(newCode: string) {
    this.resultCode += this.previousWhitespace();
    this.resultCode += newCode;
    this.tokenIndex++;
  }

  replaceTokenTrimmingLeftWhitespace(newCode: string) {
    this.resultCode += this.previousWhitespace().replace(/[\t ]/g, '');
    this.resultCode += newCode;
    this.tokenIndex++;
  }

  removeInitialToken() {
    this.replaceToken('');
  }

  removeToken() {
    this.replaceTokenTrimmingLeftWhitespace('');
  }

  copyExpectedToken(label: string) {
    if (this.tokens[this.tokenIndex].type.label !== label) {
      throw new Error(`Expected token ${label}`);
    }
    this.copyToken();
  }

  copyToken() {
    this.resultCode += this.code.slice(
      this.tokenIndex > 0
        ? this.tokens[this.tokenIndex - 1].end
        : 0,
      this.tokens[this.tokenIndex].end);
    this.tokenIndex++;
  }

  appendCode(code: string) {
    this.resultCode += code;
  }

  currentToken(): Token {
    return this.tokens[this.tokenIndex];
  }

  currentIndex(): number {
    return this.tokenIndex;
  }

  finish() {
    if (this.tokenIndex !== this.tokens.length) {
      throw new Error('Tried to finish processing tokens before reaching the end.');
    }
    this.resultCode += this.code.slice(this.tokens[this.tokens.length - 1].end);
    return this.resultCode;
  }

  isAtEnd() {
    return this.tokenIndex === this.tokens.length;
  }
}
