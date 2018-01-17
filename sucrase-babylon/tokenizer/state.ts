import {Options} from "../options";
import * as N from "../types";
import {Position} from "../util/location";

import {TokContext, types as ct} from "./context";
import {Token} from "./index";
import {TokenType, types as tt} from "./types";

export type Label = {
  // eslint-disable-next-line no-restricted-globals
  name?: string;
  kind: "loop" | "switch" | null;
  statementStart?: number;
};

export type Scope = {
  isFunctionScope: boolean;
  startTokenIndex: number;
  endTokenIndex: number;
};

export default class State {
  init(options: Options, input: string): void {
    this.input = input;

    this.potentialArrowAt = -1;

    this.noArrowAt = [];
    this.noArrowParamsConversionAt = [];

    this.inMethod = false;
    this.inFunction = false;
    this.inParameters = false;
    this.maybeInArrowParameters = false;
    this.inGenerator = false;
    this.inAsync = false;
    this.inPropertyName = false;
    this.inType = false;
    this.inClassProperty = false;
    this.noAnonFunctionType = false;

    this.classLevel = 0;

    this.labels = [];

    this.yieldInPossibleArrowParameters = null;

    this.tokens = [];
    this.scopes = [];

    this.pos = 0;
    this.lineStart = 0;
    this.curLine = options.startLine;

    this.type = tt.eof;
    this.value = null;
    this.start = this.pos;
    this.end = this.pos;
    this.startLoc = this.curPosition();
    this.endLoc = this.startLoc;

    this.isType = false;

    // @ts-ignore
    this.lastTokEndLoc = null;
    // @ts-ignore
    this.lastTokStartLoc = null;
    this.lastTokStart = this.pos;
    this.lastTokEnd = this.pos;

    this.context = [ct.braceStatement];
    this.exprAllowed = true;

    this.containsEsc = false;
  }

  // TODO
  input: string;

  // Used to signify the start of a potential arrow function
  potentialArrowAt: number;

  // Used to signify the start of an expression which looks like a
  // typed arrow function, but it isn't
  // e.g. a ? (b) : c => d
  //          ^
  noArrowAt: Array<number>;

  // Used to signify the start of an expression whose params, if it looks like
  // an arrow function, shouldn't be converted to assignable nodes.
  // This is used to defer the validation of typed arrow functions inside
  // conditional expressions.
  // e.g. a ? (b) : c => d
  //          ^
  noArrowParamsConversionAt: Array<number>;

  // Flags to track whether we are in a function, a generator.
  inFunction: boolean;
  inParameters: boolean;
  maybeInArrowParameters: boolean;
  inGenerator: boolean;
  inMethod: boolean | N.MethodKind;
  inAsync: boolean;
  inType: boolean;
  noAnonFunctionType: boolean;
  inPropertyName: boolean;
  inClassProperty: boolean;

  // Check whether we are in a (nested) class or not.
  classLevel: number;

  // Labels in scope.
  labels: Array<Label>;

  // The first yield expression inside parenthesized expressions and arrow
  // function parameters. It is used to disallow yield in arrow function
  // parameters.
  yieldInPossibleArrowParameters: N.YieldExpression | null;

  // Token store.
  tokens: Array<Token>;

  // Array of all observed scopes, ordered by their ending position.
  scopes: Array<Scope>;

  // The current position of the tokenizer in the input.
  pos: number;
  lineStart: number;
  curLine: number;

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

  // And, if locations are used, the {line, column} object
  // corresponding to those offsets
  startLoc: Position;
  endLoc: Position;

  // Position information for the previous token
  lastTokEndLoc: Position;
  lastTokStartLoc: Position;
  lastTokStart: number;
  lastTokEnd: number;

  // The context stack is used to superficially track syntactic
  // context to predict whether a regular expression is allowed in a
  // given position.
  context: Array<TokContext>;
  exprAllowed: boolean;

  // Used to signal to callers of `readWord1` whether the word
  // contained any escape sequences. This is needed because words with
  // escape sequences must not be interpreted as keywords.
  containsEsc: boolean;

  curPosition(): Position {
    return new Position(this.curLine, this.pos - this.lineStart);
  }

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
