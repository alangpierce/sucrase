import NameManager from "../NameManager";
import {TokenType as tt} from "../parser/tokenizer/types";
import TokenProcessor from "../TokenProcessor";
import Transformer from "./Transformer";

/**
 * Transformer supporting the optional chaining and nullish coalescing operators.
 *
 * Tech plan here:
 * https://github.com/alangpierce/sucrase/wiki/Sucrase-Optional-Chaining-and-Nullish-Coalescing-Technical-Plan
 *
 * The prefix and suffix code snippets are handled by TokenProcessor, and this transformer handles
 * the operators themselves.
 */
export default class OptionalChainingNullishTransformer extends Transformer {
  constructor(readonly tokens: TokenProcessor, readonly nameManager: NameManager) {
    super();
  }

  process(): boolean {
    if (this.tokens.matches1(tt.nullishCoalescing)) {
      this.tokens.replaceTokenTrimmingLeftWhitespace(", () =>");
      return true;
    }
    const token = this.tokens.currentToken();
    if (
      token.subscriptStartIndex != null &&
      this.tokens.tokens[token.subscriptStartIndex].isOptionalChainStart
    ) {
      const param = this.nameManager.claimFreeName("_");
      if (this.tokens.matches2(tt.questionDot, tt.parenL)) {
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'optionalCall', ${param} => ${param}`);
      } else if (this.tokens.matches2(tt.questionDot, tt.bracketL)) {
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'optionalAccess', ${param} => ${param}`);
      } else if (this.tokens.matches1(tt.questionDot)) {
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'optionalAccess', ${param} => ${param}.`);
      } else if (this.tokens.matches1(tt.dot)) {
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'access', ${param} => ${param}.`);
      } else if (this.tokens.matches1(tt.bracketL)) {
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'access', ${param} => ${param}[`);
      } else if (this.tokens.matches1(tt.parenL)) {
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'call', ${param} => ${param}(`);
      } else {
        throw new Error("Unexpected subscript operator in optional chain.");
      }
      return true;
    }
    return false;
  }
}
