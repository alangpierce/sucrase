import {eat, finishToken, lookaheadTypeAndKeyword, match} from "../tokenizer/index";
import type {ContextualKeyword} from "../tokenizer/keywords";
import {formatTokenType, TokenType, TokenType as tt} from "../tokenizer/types";
import {charCodes} from "../util/charcodes";
import {input, state} from "./base";

// ## Parser utilities

// Tests whether parsed token is a contextual keyword.
export function isContextual(contextualKeyword: ContextualKeyword): boolean {
  return state.contextualKeyword === contextualKeyword;
}

export function isLookaheadContextual(contextualKeyword: ContextualKeyword): boolean {
  const l = lookaheadTypeAndKeyword();
  return l.type === tt.name && l.contextualKeyword === contextualKeyword;
}

// Consumes contextual keyword if possible.
export function eatContextual(contextualKeyword: ContextualKeyword): boolean {
  return state.contextualKeyword === contextualKeyword && eat(tt.name);
}

// Asserts that following token is given contextual keyword.
export function expectContextual(contextualKeyword: ContextualKeyword): void {
  if (!eatContextual(contextualKeyword)) {
    unexpected();
  }
}

// Test whether a semicolon can be inserted at the current position.
export function canInsertSemicolon(): boolean {
  return match(tt.eof) || match(tt.braceR) || hasPrecedingLineBreak();
}

export function hasPrecedingLineBreak(): boolean {
  const prevToken = state.tokens[state.tokens.length - 1];
  const lastTokEnd = prevToken ? prevToken.end : 0;
  for (let i = lastTokEnd; i < state.start; i++) {
    const code = input.charCodeAt(i);
    if (
      code === charCodes.lineFeed ||
      code === charCodes.carriageReturn ||
      code === 0x2028 ||
      code === 0x2029
    ) {
      return true;
    }
  }
  return false;
}

export function isLineTerminator(): boolean {
  return eat(tt.semi) || canInsertSemicolon();
}

// Consume a semicolon, or, failing that, see if we are allowed to
// pretend that there is a semicolon at this position.
export function semicolon(): void {
  if (!isLineTerminator()) {
    unexpected('Unexpected token, expected ";"');
  }
}

// Expect a token of a given type. If found, consume it, otherwise,
// raise an unexpected token error at given pos.
export function expect(type: TokenType): void {
  const matched = eat(type);
  if (!matched) {
    unexpected(`Unexpected token, expected "${formatTokenType(type)}"`);
  }
}

/**
 * Transition the parser to an error state. All code needs to be written to naturally unwind in this
 * state, which allows us to backtrack without exceptions and without error plumbing everywhere.
 */
export function unexpected(message: string = "Unexpected token", pos: number = state.start): void {
  if (state.error) {
    return;
  }
  // tslint:disable-next-line no-any
  const err: any = new SyntaxError(message);
  err.pos = pos;
  state.error = err;
  state.pos = input.length;
  finishToken(tt.eof);
}
