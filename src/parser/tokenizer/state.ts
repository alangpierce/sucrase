import {ContextualKeyword, Token} from "./index";
import {TokenType, TokenType as tt} from "./types";

export class Scope {
  startTokenIndex: number;
  endTokenIndex: number;
  isFunctionScope: boolean;

  constructor(startTokenIndex: number, endTokenIndex: number, isFunctionScope: boolean) {
    this.startTokenIndex = startTokenIndex;
    this.endTokenIndex = endTokenIndex;
    this.isFunctionScope = isFunctionScope;
  }
}

export class StateSnapshot {
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

  constructor(
    potentialArrowAt: number,
    noAnonFunctionType: boolean,
    tokensLength: number,
    scopesLength: number,
    pos: number,
    type: TokenType,
    contextualKeyword: ContextualKeyword,
    start: number,
    end: number,
    isType: boolean,
  ) {
    this.potentialArrowAt = potentialArrowAt;
    this.noAnonFunctionType = noAnonFunctionType;
    this.tokensLength = tokensLength;
    this.scopesLength = scopesLength;
    this.pos = pos;
    this.type = type;
    this.contextualKeyword = contextualKeyword;
    this.start = start;
    this.end = end;
    this.isType = isType;
  }
}

export default class State {
  constructor() {
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
  }
}
