import {Options} from "../options";

import {TokContext, types as ct} from "./context";
import {Token} from "./index";
import {TokenType, types as tt} from "./types";

export type Scope = {
  isFunctionScope: boolean;
  startTokenIndex: number;
  endTokenIndex: number;
};

export default class State {
  init(options: Options, input: string): void {
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

  clone(skipArrays?: boolean): State {
    const state = new State();
    Object.keys(this).forEach((key) => {
      // $FlowIgnore
      let val = this[key];

      if ((!skipArrays || key === "context") && Array.isArray(val)) {
        val = val.slice();
      }

      // $FlowIgnore
      state[key] = val;
    });
    return state;
  }
}
