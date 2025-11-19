import type {HelperManager} from "./HelperManager";
import type {Token} from "./parser/tokenizer";
import type {ContextualKeyword} from "./parser/tokenizer/keywords";
import {type TokenType, TokenType as tt} from "./parser/tokenizer/types";
import isAsyncOperation from "./util/isAsyncOperation";

export interface TokenProcessorSnapshot {
  resultCode: string;
  tokenIndex: number;
}

export interface TokenProcessorResult {
  code: string;
  mappings: Array<number | undefined>;
}

export default class TokenProcessor {
  private resultCode: string = "";
  // Array mapping input token index to optional string index position in the
  // output code.
  private resultMappings: Array<number | undefined> = new Array(this.tokens.length);
  private tokenIndex = 0;

  constructor(
    readonly code: string,
    readonly tokens: Array<Token>,
    readonly isFlowEnabled: boolean,
    readonly disableESTransforms: boolean,
    readonly helperManager: HelperManager,
  ) {}

  /**
   * Snapshot the token state in a way that can be restored later, useful for
   * things like lookahead.
   *
   * resultMappings do not need to be copied since in all use cases, they will
   * be overwritten anyway after restore.
   */
  snapshot(): TokenProcessorSnapshot {
    return {
      resultCode: this.resultCode,
      tokenIndex: this.tokenIndex,
    };
  }

  restoreToSnapshot(snapshot: TokenProcessorSnapshot): void {
    this.resultCode = snapshot.resultCode;
    this.tokenIndex = snapshot.tokenIndex;
  }

  /**
   * Remove and return the code generated since the snapshot, leaving the
   * current token position in-place. Unlike most TokenProcessor operations,
   * this operation can result in input/output line number mismatches because
   * the removed code may contain newlines, so this operation should be used
   * sparingly.
   */
  dangerouslyGetAndRemoveCodeSinceSnapshot(snapshot: TokenProcessorSnapshot): string {
    const result = this.resultCode.slice(snapshot.resultCode.length);
    this.resultCode = snapshot.resultCode;
    return result;
  }

  reset(): void {
    this.resultCode = "";
    this.resultMappings = new Array(this.tokens.length);
    this.tokenIndex = 0;
  }

  matchesContextualAtIndex(index: number, contextualKeyword: ContextualKeyword): boolean {
    return (
      this.matches1AtIndex(index, tt.name) &&
      this.tokens[index].contextualKeyword === contextualKeyword
    );
  }

  identifierNameAtIndex(index: number): string {
    // TODO: We need to process escapes since technically you can have unicode escapes in variable
    // names.
    return this.identifierNameForToken(this.tokens[index]);
  }

  identifierNameAtRelativeIndex(relativeIndex: number): string {
    return this.identifierNameForToken(this.tokenAtRelativeIndex(relativeIndex));
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

  matches1AtIndex(index: number, t1: TokenType): boolean {
    return this.tokens[index].type === t1;
  }

  matches2AtIndex(index: number, t1: TokenType, t2: TokenType): boolean {
    return this.tokens[index].type === t1 && this.tokens[index + 1].type === t2;
  }

  matches3AtIndex(index: number, t1: TokenType, t2: TokenType, t3: TokenType): boolean {
    return (
      this.tokens[index].type === t1 &&
      this.tokens[index + 1].type === t2 &&
      this.tokens[index + 2].type === t3
    );
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
    const space = this.previousWhitespaceAndComments()
    this.resultCode += space;
    this.appendTokenPrefix(!!space);
    this.resultMappings[this.tokenIndex] = this.resultCode.length;
    this.resultCode += newCode;
    this.appendTokenSuffix();
    this.tokenIndex++;
  }

  replaceTokenTrimmingLeftWhitespace(newCode: string): void {
    const space = this.previousWhitespaceAndComments().replace(/[^\r\n]/g, "");
    this.resultCode += space;
    this.appendTokenPrefix(!!space);
    this.resultMappings[this.tokenIndex] = this.resultCode.length;
    this.resultCode += newCode;
    this.appendTokenSuffix();
    this.tokenIndex++;
  }

  removeInitialToken(): void {
    this.replaceToken("");
  }

  removeToken(): void {
    this.replaceTokenTrimmingLeftWhitespace("");
  }

  /**
   * Remove all code until the next }, accounting for balanced braces.
   */
  removeBalancedCode(): void {
    let braceDepth = 0;
    while (!this.isAtEnd()) {
      if (this.matches1(tt.braceL)) {
        braceDepth++;
      } else if (this.matches1(tt.braceR)) {
        if (braceDepth === 0) {
          return;
        }
        braceDepth--;
      }
      this.removeToken();
    }
  }

  copyExpectedToken(tokenType: TokenType): void {
    if (this.tokens[this.tokenIndex].type !== tokenType) {
      throw new Error(`Expected token ${tokenType}`);
    }
    this.copyToken();
  }

  copyToken(): void {
    const space = this.previousWhitespaceAndComments()
    this.resultCode += space;
    this.appendTokenPrefix(!!space);
    this.resultMappings[this.tokenIndex] = this.resultCode.length;
    this.resultCode += this.code.slice(
      this.tokens[this.tokenIndex].start,
      this.tokens[this.tokenIndex].end,
    );
    this.appendTokenSuffix();
    this.tokenIndex++;
  }

  copyTokenWithPrefix(prefix: string): void {
    const space = this.previousWhitespaceAndComments()
    this.resultCode += space;
    this.appendTokenPrefix(!!space);
    this.resultCode += prefix;
    this.resultMappings[this.tokenIndex] = this.resultCode.length;
    this.resultCode += this.code.slice(
      this.tokens[this.tokenIndex].start,
      this.tokens[this.tokenIndex].end,
    );
    this.appendTokenSuffix();
    this.tokenIndex++;
  }

  private appendTokenPrefix(hasSpace: boolean): void {
    const token = this.currentToken();
    if (token.numNullishCoalesceStarts || token.isOptionalChainStart) {
      token.isAsyncOperation = isAsyncOperation(this);
    }
    if (this.disableESTransforms) {
      return;
    }
    const asyncPrefix = hasSpace ? "await " : " await "
    if (token.numNullishCoalesceStarts) {
      for (let i = 0; i < token.numNullishCoalesceStarts; i++) {
        if (token.isAsyncOperation) {
          this.resultCode += asyncPrefix;
          this.resultCode += this.helperManager.getHelperName("asyncNullishCoalesce");
        } else {
          this.resultCode += this.helperManager.getHelperName("nullishCoalesce");
        }
        this.resultCode += "(";
      }
    }
    if (token.isOptionalChainStart) {
      if (token.isAsyncOperation) {
        this.resultCode += asyncPrefix;
      }
      if (this.tokenIndex > 0 && this.tokenAtRelativeIndex(-1).type === tt._delete) {
        if (token.isAsyncOperation) {
          this.resultCode += this.helperManager.getHelperName("asyncOptionalChainDelete");
        } else {
          this.resultCode += this.helperManager.getHelperName("optionalChainDelete");
        }
      } else if (token.isAsyncOperation) {
        this.resultCode += this.helperManager.getHelperName("asyncOptionalChain");
      } else {
        this.resultCode += this.helperManager.getHelperName("optionalChain");
      }
      this.resultCode += "([";
    }
  }

  private appendTokenSuffix(): void {
    const token = this.currentToken();
    if (token.isOptionalChainEnd && !this.disableESTransforms) {
      this.resultCode += "])";
    }
    if (token.numNullishCoalesceEnds && !this.disableESTransforms) {
      for (let i = 0; i < token.numNullishCoalesceEnds; i++) {
        this.resultCode += "))";
      }
    }
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

  finish(): TokenProcessorResult {
    if (this.tokenIndex !== this.tokens.length) {
      throw new Error("Tried to finish processing tokens before reaching the end.");
    }
    this.resultCode += this.previousWhitespaceAndComments();
    return {code: this.resultCode, mappings: this.resultMappings};
  }

  isAtEnd(): boolean {
    return this.tokenIndex === this.tokens.length;
  }
}
