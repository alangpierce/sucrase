import {Token} from "./parser/tokenizer";
import {ContextualKeyword} from "./parser/tokenizer/keywords";
import {TokenType, TokenType as tt} from "./parser/tokenizer/types";

export interface TokenProcessorSnapshot {
  resultCode: string;
  tokenIndex: number;
}

export default class TokenProcessor {
  private resultCode: string = "";
  private tokenIndex = 0;

  constructor(
    readonly code: string,
    readonly tokens: Array<Token>,
    readonly isFlowEnabled: boolean,
  ) {}

  /**
   * Make a new TokenProcessor for things like lookahead.
   */
  snapshot(): TokenProcessorSnapshot {
    return {resultCode: this.resultCode, tokenIndex: this.tokenIndex};
  }

  restoreToSnapshot(snapshot: TokenProcessorSnapshot): void {
    this.resultCode = snapshot.resultCode;
    this.tokenIndex = snapshot.tokenIndex;
  }

  getResultCodeIndex(): number {
    return this.resultCode.length;
  }

  reset(): void {
    this.resultCode = "";
    this.tokenIndex = 0;
  }

  matchesContextualAtIndex(index: number, contextualKeyword: ContextualKeyword): boolean {
    return (
      this.matchesAtIndex(index, tt.name) &&
      this.tokens[index].contextualKeyword === contextualKeyword
    );
  }

  identifierNameAtIndex(index: number): string {
    // TODO: We need to process escapes since technically you can have unicode escapes in variable
    // names.
    return this.identifierNameForToken(this.tokens[index]);
  }

  identifierName(): string {
    return this.identifierNameForToken(this.currentToken());
  }

  identifierNameForToken(token: Token): string {
    return this.code.slice(token.start, token.end);
  }

  rawCodeForToken(token: Token): string {
    return this.code.slice(token.start, token.end);
  }

  stringValueAtIndex(index: number): string {
    return this.stringValueForToken(this.tokens[index]);
  }

  stringValue(): string {
    return this.stringValueForToken(this.currentToken());
  }

  stringValueForToken(token: Token): string {
    // This is used to identify when two imports are the same and to resolve TypeScript enum keys.
    // Ideally we'd process escapes within the strings, but for now we pretty much take the raw
    // code.
    return this.code.slice(token.start + 1, token.end - 1);
  }

  matchesAtIndex(index: number, ...ts: Array<TokenType>): boolean {
    for (let i = 0; i < ts.length; i++) {
      if (ts[i] !== this.tokens[index + i].type) return false;
    }
    return true;
  }

  matches(...ts: Array<TokenType>): boolean {
    return this.matchesAtIndex(this.tokenIndex, ...ts);
  }

  matchesContextual(contextualKeyword: ContextualKeyword): boolean {
    return this.matchesContextualAtIndex(this.tokenIndex, contextualKeyword);
  }

  matchesContextIdAndLabel(type: TokenType, contextId: number): boolean {
    return this.matches(type) && this.currentToken().contextId === contextId;
  }

  previousWhitespaceAndComments(): string {
    let whitespaceAndComments = this.code.slice(
      this.tokenIndex > 0 ? this.tokens[this.tokenIndex - 1].end : 0,
      this.tokenIndex < this.tokens.length ? this.tokens[this.tokenIndex].start : this.code.length,
    );
    if (this.isFlowEnabled) {
      whitespaceAndComments = whitespaceAndComments.replace(/@flow/g, "");
    }
    return whitespaceAndComments;
  }

  replaceToken(newCode: string): void {
    this.resultCode += this.previousWhitespaceAndComments();
    this.resultCode += newCode;
    this.tokenIndex++;
  }

  replaceTokenTrimmingLeftWhitespace(newCode: string): void {
    this.resultCode += this.previousWhitespaceAndComments().replace(/[^\r\n]/g, "");
    this.resultCode += newCode;
    this.tokenIndex++;
  }

  removeInitialToken(): void {
    this.replaceToken("");
  }

  removeToken(): void {
    this.replaceTokenTrimmingLeftWhitespace("");
  }

  copyExpectedToken(tokenType: TokenType): void {
    if (this.tokens[this.tokenIndex].type !== tokenType) {
      throw new Error(`Expected token ${tokenType}`);
    }
    this.copyToken();
  }

  copyToken(): void {
    this.resultCode += this.previousWhitespaceAndComments();
    this.resultCode += this.code.slice(
      this.tokens[this.tokenIndex].start,
      this.tokens[this.tokenIndex].end,
    );
    this.tokenIndex++;
  }

  copyTokenWithPrefix(prefix: string): void {
    this.resultCode += this.previousWhitespaceAndComments();
    this.resultCode += prefix;
    this.resultCode += this.code.slice(
      this.tokens[this.tokenIndex].start,
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

  currentTokenCode(): string {
    const token = this.currentToken();
    return this.code.slice(token.start, token.end);
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

  previousToken(): void {
    this.tokenIndex--;
  }

  finish(): string {
    if (this.tokenIndex !== this.tokens.length) {
      throw new Error("Tried to finish processing tokens before reaching the end.");
    }
    this.resultCode += this.previousWhitespaceAndComments();
    return this.resultCode;
  }

  isAtEnd(): boolean {
    return this.tokenIndex === this.tokens.length;
  }
}
