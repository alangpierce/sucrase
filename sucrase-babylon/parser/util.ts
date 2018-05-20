import {ContextualKeyword, eat, lookaheadTypeAndKeyword, match} from "../tokenizer";
import {formatTokenType, TokenType, TokenType as tt} from "../tokenizer/types";
import {lineBreak} from "../util/whitespace";
import {input, raise, state} from "./base";

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
    unexpected(null);
  }
}

// Test whether a semicolon can be inserted at the current position.
export function canInsertSemicolon(): boolean {
  return match(tt.eof) || match(tt.braceR) || hasPrecedingLineBreak();
}

export function hasPrecedingLineBreak(): boolean {
  const prevToken = state.tokens[state.tokens.length - 1];
  const lastTokEnd = prevToken ? prevToken.end : 0;
  return lineBreak.test(input.slice(lastTokEnd, state.start));
}

export function isLineTerminator(): boolean {
  return eat(tt.semi) || canInsertSemicolon();
}

// Consume a semicolon, or, failing that, see if we are allowed to
// pretend that there is a semicolon at this position.
export function semicolon(): void {
  if (!isLineTerminator()) unexpected(null, 'Unexpected token, expected";"');
}

// Expect a token of a given type. If found, consume it, otherwise,
// raise an unexpected token error at given pos.
export function expect(type: TokenType, pos?: number | null): void {
  const matched = eat(type);
  if (!matched) {
    unexpected(pos, `Unexpected token, expected "${formatTokenType(type)}"`);
  }
}

// Raise an unexpected token error. Can take the expected token type
// instead of a message string.
export function unexpected(pos: number | null = null, message: string = "Unexpected token"): never {
  throw raise(pos != null ? pos : state.start, message);
}
