import type {HelperManager} from "../HelperManager";
import type {Token} from "../parser/tokenizer";
import {TokenType as tt} from "../parser/tokenizer/types";
import type TokenProcessor from "../TokenProcessor";
import type RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

const LOGICAL_OPERATORS = ["&&=", "||=", "??="];

interface ComputedAccess {
  // A snapshot of the result just before the `[` of the computed access
  snapshot: {
    resultCode: string;
    tokenIndex: number;
  };
  // The result code position at the start of the computed property access
  start: number;
}

export default class LogicalAssignmentTransformer extends Transformer {
  // This stack stores the state needed to transform computed property access
  private readonly computedAccessStack: Array<ComputedAccess> = [];

  constructor(
    readonly rootTransformer: RootTransformer,
    readonly tokens: TokenProcessor,
    readonly helperManager: HelperManager,
  ) {
    super();
  }

  process(): boolean {
    if (this.tokens.currentToken().contextId !== null) {
      return false;
    }

    // This searches for the start of computed property access e.g. `x[y]`, or `_.x[y = z + f()]`
    if (this.tokens.matches1(tt.bracketL)) {
      // This access may end put using a logical assignment operator, but
      // we don't know yet. We save a snapshot on our stack and then wait
      // until we reach the `]` that ends the computed access.
      const snapshot = this.tokens.snapshot(); // A snapshot that we use to extract the code within `[]`

      this.tokens.copyExpectedToken(tt.bracketL);

      const start = this.tokens.getResultCodeIndex();
      this.tokens.restoreToSnapshot(snapshot);

      this.computedAccessStack.push({snapshot, start});

      return false;
    }

    // This finds the end of the computed property access
    if (this.tokens.matches1(tt.bracketR)) {
      const stackItem = this.computedAccessStack.pop();
      if (!stackItem) {
        throw new Error(`Unexpected ']' at ${this.tokens.getResultCodeIndex()}`);
      }

      // Check if the token after `]` as a logical assignment, if not, we exit
      if (!this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, tt.assign)) {
        return false;
      }
      const op = this.findOpToken(1);
      if (!op) {
        return false;
      }

      // Save the result code position just before `]`, so that we can extract the
      // contents of the `[]` pair
      const end = this.tokens.getResultCodeIndex();

      this.tokens.copyExpectedToken(tt.bracketR);

      const {snapshot, start} = stackItem;

      // This is the fully transformed contents of `[]`. For `obj[x + 1]` this would be `x + 1`
      const propAccess = this.tokens.snapshot().resultCode.slice(start, end);

      // Skip forward to after the assignment operator and complete the `_logicalAssign()` helper call
      snapshot.tokenIndex = this.tokens.currentIndex() + 1;
      this.tokens.restoreToSnapshot(snapshot);
      this.tokens.appendCode(`, ${propAccess}, '${op.code}', () => `);
      this.processRhs(op.token);
      this.tokens.appendCode(")");

      return true;
    }

    // This searches for dot property access e.g. `_.key &&=`
    if (this.tokens.matches3(tt.dot, tt.name, tt.assign)) {
      const op = this.findOpToken(2);
      if (!op) {
        return false;
      }

      // As opposed to the computed prop case, this is a lot simpler, because
      // we know upfront what tokens can be part of the access on the lhs.

      // Skip over the tokens and complete the `_logicalAssign()` helper call
      this.tokens.nextToken(); // Skip the tt.dot
      const propName = this.tokens.identifierName();
      this.tokens.nextToken(); // Skip the tt.name
      this.tokens.nextToken(); // Skip the tt.assign
      this.tokens.appendCode(`, '${propName}', '${op.code}', () => `);
      this.processRhs(op.token);
      this.tokens.appendCode(")");

      return true;
    }

    // This searches for plain variable assignment, e.g. `a &&= b`
    if (this.tokens.matches2(tt.name, tt.assign)) {
      const op = this.findOpToken(1);
      if (!op) {
        return false;
      }

      // At this point we know that this is a simple `a &&= b` to assignment, and we can
      // use a simple transform to e.g. `a && (a = b)` without using the helper function.

      const plainName = this.tokens.identifierName();

      this.tokens.copyToken(); // Copy the identifier
      this.tokens.nextToken(); // Skip the original assignment operator

      if (op.code === "??=") {
        // We transform null coalesce ourselves here, e.g. `a != null ? a : (a = b)`
        this.tokens.appendCode(` != null ? ${plainName} : (${plainName} =`);
      } else {
        this.tokens.appendCode(` ${op.code.slice(0, 2)} (${plainName} =`);
      }
      this.processRhs(op.token);
      this.tokens.appendCode(")");

      return true;
    }

    return false;
  }

  // Checks whether there's a matching logical assignment operator token at provided relative token index
  private findOpToken(relativeIndex: number = 0): {token: Token; code: string} | undefined {
    const token = this.tokens.tokenAtRelativeIndex(relativeIndex);
    const code = this.tokens.rawCodeForToken(token);
    if (!LOGICAL_OPERATORS.includes(code)) {
      return undefined;
    }
    return {token, code};
  }

  // This processes the right hand side of a logical assignment expression. We process
  // until the hit the rhsEndIndex as specified by the logical assignment operator token.
  private processRhs(token: Token): void {
    if (token.rhsEndIndex === null) {
      throw new Error("Unknown end of logical assignment, this is a bug in Sucrase");
    }

    while (this.tokens.currentIndex() < token.rhsEndIndex) {
      this.rootTransformer.processToken();
    }
  }
}
