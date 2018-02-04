import {ContextualKeyword, Token} from "./index";
import {TokenType, TokenType as tt} from "./types";

export type Scope = {
  isFunctionScope: boolean;
  startTokenIndex: number;
  endTokenIndex: number;
};

export type StateSnapshot = {
  potentialArrowAt: number;
  noAnonFunctionType: boolean;
  tokensLength: number;
  scopesLength: number;
  pos: number;
  type: TokenType;
  contextualKeyword: ContextualKeyword;
  start: number;
  end: number;
  isType: boolean;
};

export default class State {
  init(input: string): void {
    this.input = input;

    this.potentialArrowAt = -1;

    this.noAnonFunctionType = false;

    this.tokens = [];
    this.scopes = [];

    this.pos = 0;

    this.type = tt.eof;
    this.start = this.pos;
    this.end = this.pos;

    this.isType = false;
  }

  input: string;

  // Used to signify the start of a potential arrow function
  potentialArrowAt: number;

  // Used by Flow to handle an edge case involving function type parsing.
  noAnonFunctionType: boolean;

  // Token store.
  tokens: Array<Token>;

  // Array of all observed scopes, ordered by their ending position.
  scopes: Array<Scope>;

  // The current position of the tokenizer in the input.
  pos: number;

  // Information about the current token.
  type: TokenType;
  contextualKeyword: ContextualKeyword;
  start: number;
  end: number;

  isType: boolean;

  snapshot(): StateSnapshot {
    return {
      potentialArrowAt: this.potentialArrowAt,
      noAnonFunctionType: this.noAnonFunctionType,
      tokensLength: this.tokens.length,
      scopesLength: this.scopes.length,
      pos: this.pos,
      type: this.type,
      contextualKeyword: this.contextualKeyword,
      start: this.start,
      end: this.end,
      isType: this.isType,
    };
  }

  restoreFromSnapshot(snapshot: StateSnapshot): void {
    this.potentialArrowAt = snapshot.potentialArrowAt;
    this.noAnonFunctionType = snapshot.noAnonFunctionType;
    this.tokens.length = snapshot.tokensLength;
    this.scopes.length = snapshot.scopesLength;
    this.pos = snapshot.pos;
    this.type = snapshot.type;
    this.contextualKeyword = snapshot.contextualKeyword;
    this.start = snapshot.start;
    this.end = snapshot.end;
    this.isType = snapshot.isType;
  }
}
