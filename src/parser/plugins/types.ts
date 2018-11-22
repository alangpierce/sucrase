import {eat, lookaheadType, match} from "../tokenizer/index";
import {TokenType as tt} from "../tokenizer/types";
import {isFlowEnabled, isTypeScriptEnabled, state} from "../traverser/base";
import {baseParseConditional} from "../traverser/expression";
import {flowParseTypeAnnotation} from "./flow";
import {tsParseTypeAnnotation} from "./typescript";

/**
 * Common parser code for TypeScript and Flow.
 */

// An apparent conditional expression could actually be an optional parameter in an arrow function.
export function typedParseConditional(noIn: boolean, startPos: number): void {
  // If we see ?:, this can't possibly be a valid conditional. typedParseParenItem will be called
  // later to finish off the arrow parameter.
  if (match(tt.question) && lookaheadType() === tt.colon) {
    return;
  }
  baseParseConditional(noIn, startPos);
}

// Note: These "type casts" are *not* valid TS expressions.
// But we parse them here and change them when completing the arrow function.
export function typedParseParenItem(): void {
  if (eat(tt.question)) {
    state.tokens[state.tokens.length - 1].isType = true;
  }
  if (match(tt.colon)) {
    if (isTypeScriptEnabled) {
      tsParseTypeAnnotation();
    } else if (isFlowEnabled) {
      flowParseTypeAnnotation();
    }
  }
}
