import {types as tt} from "../tokenizer/types";
import * as charCodes from "../util/charcodes";
import JSXParser from "./jsx";

/**
 * Common parser code for TypeScript and Flow.
 */
export default abstract class TypeParser extends JSXParser {
  abstract parseTypeAnnotation(): void;

  // An apparent conditional expression could actually be an optional parameter in an arrow function.
  parseConditional(noIn: boolean | null, startPos: number): void {
    // only do the expensive clone if there is a question mark
    // and if we come from inside parens
    if (!this.match(tt.question)) {
      super.parseConditional(noIn, startPos);
      return;
    }

    const snapshot = this.state.snapshot();
    try {
      super.parseConditional(noIn, startPos);
      return;
    } catch (err) {
      if (!(err instanceof SyntaxError)) {
        // istanbul ignore next: no such error is expected
        throw err;
      }
      this.state.restoreFromSnapshot(snapshot);
    }
  }

  // Note: These "type casts" are *not* valid TS expressions.
  // But we parse them here and change them when completing the arrow function.
  parseParenItem(): void {
    super.parseParenItem();
    if (this.eat(tt.question)) {
      this.state.tokens[this.state.tokens.length - 1].isType = true;
    }
    if (this.match(tt.colon)) {
      this.parseTypeAnnotation();
    }
  }

  // ensure that inside types, we bypass the jsx parser plugin
  readToken(code: number): void {
    if (this.state.inType && (code === charCodes.lessThan || code === charCodes.greaterThan)) {
      this.finishOp(code === charCodes.lessThan ? tt.lessThan : tt.greaterThan, 1);
    } else {
      super.readToken(code);
    }
  }

  isClassMethod(): boolean {
    return this.match(tt.lessThan) || super.isClassMethod();
  }

  isClassProperty(): boolean {
    return this.match(tt.colon) || super.isClassProperty();
  }

  shouldParseArrow(): boolean {
    return this.match(tt.colon) || super.shouldParseArrow();
  }

  shouldParseAsyncArrow(): boolean {
    return this.match(tt.colon) || super.shouldParseAsyncArrow();
  }
}
