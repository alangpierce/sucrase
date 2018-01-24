import {TokContext, types as ct} from "./context";
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
  inType: boolean;
  noAnonFunctionType: boolean;
  inPropertyName: boolean;
  tokensLength: number;
  scopesLength: number;
  pos: number;
  type: TokenType;
  // tslint:disable-next-line: no-any
  value: any;
  start: number;
  end: number;
  isType: boolean;
  lastTokEnd: number;
  context: Array<TokContext>;
  exprAllowed: boolean;
};

export default class State {
  init(input: string): void {
    this.input = input;

    this.potentialArrowAt = -1;

    this.inGenerator = false;
    this.inPropertyName = false;
    this.inType = false;
    this.noAnonFunctionType = false;

    this.tokens = [];
    this.scopes = [];

    this.pos = 0;

    this.type = tt.eof;
    this.value = null;
    this.start = this.pos;
    this.end = this.pos;

    this.isType = false;

    this.lastTokEnd = this.pos;

    this.context = [ct.braceStatement];
    this.exprAllowed = true;
  }

  // TODO
  input: string;

  // Used to signify the start of a potential arrow function
  potentialArrowAt: number;

  // yield is treated differently in a generator, and can be a variable name outside a generator.
  inGenerator: boolean;
  // We need to skip JSX within a type context.
  inType: boolean;
  // Used by Flow to handle an edge case involving funtion type parsing.
  noAnonFunctionType: boolean;
  // Used by JSX to skip JSX parsing in property names.
  inPropertyName: boolean;

  // Token store.
  tokens: Array<Token>;

  // Array of all observed scopes, ordered by their ending position.
  scopes: Array<Scope>;

  // The current position of the tokenizer in the input.
  pos: number;

  // Properties of the current token:
  // Its type
  type: TokenType;

  // For tokens that include more information than their type, the value
  // tslint:disable-next-line no-any
  value: any;

  // Its start and end offset
  start: number;
  end: number;

  isType: boolean;

  // Position information for the previous token
  lastTokEnd: number;

  // The context stack is used to superficially track syntactic
  // context to predict whether a regular expression is allowed in a
  // given position.
  context: Array<TokContext>;
  exprAllowed: boolean;

  snapshot(): StateSnapshot {
    return {
      potentialArrowAt: this.potentialArrowAt,
      inGenerator: this.inGenerator,
      inType: this.inType,
      noAnonFunctionType: this.noAnonFunctionType,
      inPropertyName: this.inPropertyName,
      tokensLength: this.tokens.length,
      scopesLength: this.scopes.length,
      pos: this.pos,
      type: this.type,
      // tslint:disable-next-line: no-any
      value: this.value,
      start: this.start,
      end: this.end,
      isType: this.isType,
      lastTokEnd: this.lastTokEnd,
      context: this.context.slice(),
      exprAllowed: this.exprAllowed,
    };
  }

  restoreFromSnapshot(snapshot: StateSnapshot): void {
    this.potentialArrowAt = snapshot.potentialArrowAt;
    this.inGenerator = snapshot.inGenerator;
    this.inType = snapshot.inType;
    this.noAnonFunctionType = snapshot.noAnonFunctionType;
    this.inPropertyName = snapshot.inPropertyName;
    this.tokens.length = snapshot.tokensLength;
    this.scopes.length = snapshot.scopesLength;
    this.pos = snapshot.pos;
    this.type = snapshot.type;
    this.value = snapshot.value;
    this.start = snapshot.start;
    this.end = snapshot.end;
    this.isType = snapshot.isType;
    this.lastTokEnd = snapshot.lastTokEnd;
    this.context = snapshot.context;
    this.exprAllowed = snapshot.exprAllowed;
  }
}
