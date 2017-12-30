export type TokenContext =
  | "block"
  | "parens"
  | "brackets"
  | "object"
  | "class"
  | "classFieldExpression"
  | "jsxTag"
  | "jsxChild"
  | "jsxExpression"
  | "templateExpr"
  | "switchCaseCondition"
  | "type"
  | "typeParameter"
  | "import"
  | "namedExport";

export type TokenType = {
  label: string;
};

export type Token = {
  type: TokenType;
  start: number;
  end: number;
  // tslint:disable-next-line no-any
  value: any;
  contextName?: TokenContext;
  contextStartIndex?: number;
  parentContextStartIndex?: number | null;
};

export default class TokenProcessor {
  private resultCode: string = "";
  private tokenIndex = 0;

  constructor(readonly code: string, readonly tokens: Array<Token>) {}

  /**
   * Make a new TokenProcessor for things like lookahead.
   */
  clone(): TokenProcessor {
    const result = new TokenProcessor(this.code, this.tokens);
    result.tokenIndex = this.tokenIndex;
    return result;
  }

  reset(): void {
    this.resultCode = "";
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
    return this.matchesAtIndex(index, ["name"]) && this.tokens[index].value === name;
  }

  matchesNameAtRelativeIndex(relativeIndex: number, name: string): boolean {
    const index = this.currentIndex() + relativeIndex;
    return this.matchesAtIndex(index, ["name"]) && this.tokens[index].value === name;
  }

  matchesAtRelativeIndex(relativeIndex: number, tagLabels: Array<string>): boolean {
    return this.matchesAtIndex(this.currentIndex() + relativeIndex, tagLabels);
  }

  matches(tagLabels: Array<string>): boolean {
    return this.matchesAtIndex(this.tokenIndex, tagLabels);
  }

  matchesName(name: string): boolean {
    return this.matchesNameAtIndex(this.tokenIndex, name);
  }

  /**
   * Check if this is a "real" instance of the keyword rather than an object key or property access.
   */
  matchesKeyword(name: string): boolean {
    const token = this.currentToken();
    if (this.matchesAtRelativeIndex(-1, ["."])) {
      return false;
    }
    if (token.contextName === "object" && this.matchesAtRelativeIndex(1, [":"])) {
      return false;
    }
    return token.type.label === name || (token.type.label === "name" && token.value === name);
  }

  matchesContextEnd(label: string, contextStartIndex: number): boolean {
    return this.matches([label]) && this.currentToken().contextStartIndex === contextStartIndex;
  }

  previousWhitespace(): string {
    return this.code.slice(
      this.tokenIndex > 0 ? this.tokens[this.tokenIndex - 1].end : 0,
      this.tokens[this.tokenIndex].start,
    );
  }

  replaceToken(newCode: string): void {
    this.resultCode += this.previousWhitespace();
    this.resultCode += newCode;
    this.tokenIndex++;
  }

  replaceTokenTrimmingLeftWhitespace(newCode: string): void {
    this.resultCode += this.previousWhitespace().replace(/[\t ]/g, "");
    this.resultCode += newCode;
    this.tokenIndex++;
  }

  removeInitialToken(): void {
    this.replaceToken("");
  }

  removeToken(): void {
    this.replaceTokenTrimmingLeftWhitespace("");
  }

  copyExpectedToken(label: string): void {
    if (this.tokens[this.tokenIndex].type.label !== label) {
      throw new Error(`Expected token ${label}`);
    }
    this.copyToken();
  }

  copyToken(): void {
    this.resultCode += this.code.slice(
      this.tokenIndex > 0 ? this.tokens[this.tokenIndex - 1].end : 0,
      this.tokens[this.tokenIndex].end,
    );
    this.tokenIndex++;
  }

  appendCode(code: string): void {
    this.resultCode += code;
  }

  currentToken(): Token {
    return this.tokens[this.tokenIndex];
  }

  tokenAtRelativeIndex(relativeIndex: number): Token {
    return this.tokens[this.tokenIndex + relativeIndex];
  }

  currentIndex(): number {
    return this.tokenIndex;
  }

  /**
   * Move to the next token. Only suitable in preprocessing steps. When
   * generating new code, you should use copyToken or removeToken.
   */
  nextToken(): void {
    if (this.tokenIndex === this.tokens.length) {
      throw new Error("Unexpectedly reached end of input.");
    }
    this.tokenIndex++;
  }

  expectToken(label: string): void {
    if (this.tokens[this.tokenIndex].type.label !== label) {
      throw new Error(`Expected token ${label}`);
    }
  }

  finish(): string {
    if (this.tokenIndex !== this.tokens.length) {
      throw new Error("Tried to finish processing tokens before reaching the end.");
    }
    this.resultCode += this.code.slice(this.tokens[this.tokens.length - 1].end);
    return this.resultCode;
  }

  isAtEnd(): boolean {
    return this.tokenIndex === this.tokens.length;
  }
}
