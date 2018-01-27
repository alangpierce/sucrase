import {Token} from "./index";
import {TokenType, types as tt} from "./types";

export type Scope = {
  isFunctionScope: boolean;
  startTokenIndex: number;
  endTokenIndex: number;
};

export type StateSnapshot = {
  potentialArrowAt: number;
  inGenerator: boolean;
  noAnonFunctionType: boolean;
  tokensLength: number;
  scopesLength: number;
  pos: number;
  type: TokenType;
  // tslint:disable-next-line: no-any
  value: any;
  start: number;
  end: number;
  isType: boolean;
};

export default class State {
  init(input: string): void {
    this.input = input;

    this.potentialArrowAt = -1;

    this.inGenerator = false;
    this.noAnonFunctionType = false;

    this.tokens = [];
    this.scopes = [];

    this.pos = 0;

    this.type = tt.eof;
    this.value = null;
    this.start = this.pos;
    this.end = this.pos;

    this.isType = false;
  }

  input: string;

  // Used to signify the start of a potential arrow function
  potentialArrowAt: number;

  // yield is treated differently in a generator, and can be a variable name outside a generator.
  inGenerator: boolean;
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
  // tslint:disable-next-line no-any
  value: any;
  start: number;
  end: number;

  isType: boolean;

  snapshot(): StateSnapshot {
    return {
      potentialArrowAt: this.potentialArrowAt,
      inGenerator: this.inGenerator,
      noAnonFunctionType: this.noAnonFunctionType,
      tokensLength: this.tokens.length,
      scopesLength: this.scopes.length,
      pos: this.pos,
      type: this.type,
      // tslint:disable-next-line: no-any
      value: this.value,
      start: this.start,
      end: this.end,
      isType: this.isType,
    };
  }

  restoreFromSnapshot(snapshot: StateSnapshot): void {
    this.potentialArrowAt = snapshot.potentialArrowAt;
    this.inGenerator = snapshot.inGenerator;
    this.noAnonFunctionType = snapshot.noAnonFunctionType;
    this.tokens.length = snapshot.tokensLength;
    this.scopes.length = snapshot.scopesLength;
    this.pos = snapshot.pos;
    this.type = snapshot.type;
    this.value = snapshot.value;
    this.start = snapshot.start;
    this.end = snapshot.end;
    this.isType = snapshot.isType;
  }
}
