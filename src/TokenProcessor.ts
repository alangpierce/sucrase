import {ContextualKeyword, Token} from "../sucrase-babylon/tokenizer";
import {TokenType, TokenType as tt} from "../sucrase-babylon/tokenizer/types";

export type TokenProcessorSnapshot = {
  resultCode: string;
  tokenIndex: number;
};

export default class TokenProcessor {
  private resultCode: string = "";
  private tokenIndex = 0;

  constructor(readonly code: string, readonly tokens: Array<Token>) {}

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

  getCodeInsertedSinceIndex(initialResultCodeIndex: number): string {
    return this.resultCode.slice(initialResultCodeIndex);
  }

  reset(): void {
    this.resultCode = "";
    this.tokenIndex = 0;
  }

  matchesAtIndex(index: number, types: Array<TokenType>): boolean {
    if (index < 0) {
      return false;
    }
    for (let i = 0; i < types.length; i++) {
      if (index + i >= this.tokens.length) {
        return false;
      }
      if (this.tokens[index + i].type !== types[i]) {
        return false;
      }
    }
    return true;
  }

  matchesContextualAtIndex(index: number, contextualKeyword: ContextualKeyword): boolean {
    return (
      this.matchesAtIndex(index, [tt.name]) &&
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

  matches1(t1: TokenType): boolean {
    return this.tokens[this.tokenIndex].type === t1;
  }

  matches2(t1: TokenType, t2: TokenType): boolean {
    return this.tokens[this.tokenIndex].type === t1 && this.tokens[this.tokenIndex + 1].type === t2;
  }

  matches3(t1: TokenType, t2: TokenType, t3: TokenType): boolean {
    return (
      this.tokens[this.tokenIndex].type === t1 &&
      this.tokens[this.tokenIndex + 1].type === t2 &&
      this.tokens[this.tokenIndex + 2].type === t3
    );
  }

  matches4(t1: TokenType, t2: TokenType, t3: TokenType, t4: TokenType): boolean {
    return (
      this.tokens[this.tokenIndex].type === t1 &&
      this.tokens[this.tokenIndex + 1].type === t2 &&
      this.tokens[this.tokenIndex + 2].type === t3 &&
      this.tokens[this.tokenIndex + 3].type === t4
    );
  }

  matches5(t1: TokenType, t2: TokenType, t3: TokenType, t4: TokenType, t5: TokenType): boolean {
    return (
      this.tokens[this.tokenIndex].type === t1 &&
      this.tokens[this.tokenIndex + 1].type === t2 &&
      this.tokens[this.tokenIndex + 2].type === t3 &&
      this.tokens[this.tokenIndex + 3].type === t4 &&
      this.tokens[this.tokenIndex + 4].type === t5
    );
  }

  matchesContextual(contextualKeyword: ContextualKeyword): boolean {
    return this.matchesContextualAtIndex(this.tokenIndex, contextualKeyword);
  }

  matchesContextIdAndLabel(type: TokenType, contextId: number): boolean {
    return this.matches1(type) && this.currentToken().contextId === contextId;
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

  copyExpectedToken(tokenType: TokenType): void {
    if (this.tokens[this.tokenIndex].type !== tokenType) {
      throw new Error(`Expected token ${tokenType}`);
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
    this.resultCode += this.code.slice(this.tokens[this.tokens.length - 1].end);
    return this.resultCode;
  }

  isAtEnd(): boolean {
    return this.tokenIndex === this.tokens.length;
  }
}
