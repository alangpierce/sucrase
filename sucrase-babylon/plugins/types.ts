import {hasPlugin, state} from "../parser/base";
import {baseParseConditional} from "../parser/expression";
import {eat, match} from "../tokenizer";
import {TokenType as tt} from "../tokenizer/types";
import {flowParseTypeAnnotation} from "./flow";
import {tsParseTypeAnnotation} from "./typescript";

/**
 * Common parser code for TypeScript and Flow.
 */

// An apparent conditional expression could actually be an optional parameter in an arrow function.
export function typedParseConditional(noIn: boolean | null, startPos: number): void {
  // only do the expensive clone if there is a question mark
  // and if we come from inside parens
  if (!match(tt.question)) {
    baseParseConditional(noIn, startPos);
    return;
  }

  const snapshot = state.snapshot();
  try {
    baseParseConditional(noIn, startPos);
    return;
  } catch (err) {
    if (!(err instanceof SyntaxError)) {
      // istanbul ignore next: no such error is expected
      throw err;
    }
    state.restoreFromSnapshot(snapshot);
  }
}

// Note: These "type casts" are *not* valid TS expressions.
// But we parse them here and change them when completing the arrow function.
export function typedParseParenItem(): void {
  if (eat(tt.question)) {
    state.tokens[state.tokens.length - 1].isType = true;
  }
  if (match(tt.colon)) {
    if (hasPlugin("typescript")) {
      tsParseTypeAnnotation();
    } else if (hasPlugin("flow")) {
      flowParseTypeAnnotation();
    }
  }
}
