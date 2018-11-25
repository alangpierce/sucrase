import {ContextualKeyword, Token} from "./index";
import {TokenType, TokenType as tt} from "./types";

export class Scope {
  startTokenIndex: i32;
  endTokenIndex: i32;
  isFunctionScope: boolean;

  constructor(startTokenIndex: i32, endTokenIndex: i32, isFunctionScope: boolean) {
    this.startTokenIndex = startTokenIndex;
    this.endTokenIndex = endTokenIndex;
    this.isFunctionScope = isFunctionScope;
  }
}

export class StateSnapshot {
  constructor(
    readonly potentialArrowAt: i32,
    readonly noAnonFunctionType: boolean,
    readonly tokensLength: i32,
    readonly scopesLength: i32,
    readonly pos: i32,
    readonly type: TokenType,
    readonly contextualKeyword: ContextualKeyword,
    readonly start: i32,
    readonly end: i32,
    readonly isType: boolean,
    readonly error: Error | null,
  ) {}
}

export class State {
  // Used to signify the start of a potential arrow function
  potentialArrowAt: i32 = -1;

  // Used by Flow to handle an edge case involving function type parsing.
  noAnonFunctionType: boolean = false;

  // Token store.
  tokens: Array<Token> = new Array<Token>();

  // Array of all observed scopes, ordered by their ending position.
  scopes: Array<Scope> = new Array<Scope>();

  // The current position of the tokenizer in the input.
  pos: i32 = 0;

  // Information about the current token.
  type: TokenType = tt.eof;
  contextualKeyword: ContextualKeyword = ContextualKeyword.NONE;
  start: i32 = 0;
  end: i32 = 0;

  isType: boolean = false;

  /**
   * If the parser is in an error state, then the token is always tt.eof and all functions can
   * keep executing but should be written so they don't get into an infinite loop in this situation.
   *
   * This approach, combined with the ability to snapshot and restore state, allows us to implement
   * backtracking without exceptions and without needing to explicitly propagate error states
   * everywhere.
   */
  error: Error | null = null;

  snapshot(): StateSnapshot {
    return new StateSnapshot(
      this.potentialArrowAt,
      this.noAnonFunctionType,
      this.tokens.length,
      this.scopes.length,
      this.pos,
      this.type,
      this.contextualKeyword,
      this.start,
      this.end,
      this.isType,
      this.error,
    );
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
    this.error = snapshot.error;
  }
}
