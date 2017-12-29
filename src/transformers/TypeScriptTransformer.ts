import TokenProcessor from "../TokenProcessor";
import RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

export default class TypeScriptTransformer extends Transformer {
  constructor(readonly rootTransformer: RootTransformer, readonly tokens: TokenProcessor) {
    super();
  }

  process(): boolean {
    // We need to handle all classes specially in order to remove `implements`.
    if (this.tokens.matchesKeyword("class")) {
      this.rootTransformer.processClass();
      return true;
    }
    const processedTypeAnnotation = this.rootTransformer.processPossibleTypeAnnotation();
    if (processedTypeAnnotation) {
      return true;
    }
    if (this.tokens.currentToken().contextName === "type") {
      this.tokens.removeInitialToken();
      while (this.tokens.currentToken().contextName === "type") {
        this.tokens.removeToken();
      }
      return true;
    }
    if (this.tokens.currentToken().contextName === "typeParameter") {
      this.tokens.removeInitialToken();
      while (this.tokens.currentToken().contextName === "typeParameter") {
        this.tokens.removeToken();
      }
      return true;
    }
    if (
      this.tokens.matchesName("public") ||
      this.tokens.matchesName("protected") ||
      this.tokens.matchesName("private") ||
      this.tokens.matchesName("abstract") ||
      this.tokens.matchesName("readonly")
    ) {
      this.tokens.removeInitialToken();
      return true;
    }
    if (this.isNonNullAssertion()) {
      this.tokens.removeInitialToken();
      return true;
    }
    return false;
  }

  /**
   * This is either a negation operator or a non-null assertion operator. If it's a non-null
   * assertion, get rid of it.
   */
  isNonNullAssertion(): boolean {
    if (!this.tokens.matches(["!"])) {
      return false;
    }
    let index = this.tokens.currentIndex() - 1;
    // Walk left past all operators that might be either prefix or postfix operators.
    while (
      this.tokens.matchesAtIndex(index, ["!"]) ||
      this.tokens.matchesAtIndex(index, ["++"]) ||
      this.tokens.matchesAtIndex(index, ["--"])
    ) {
      index--;
    }
    if (index < 0) {
      return false;
    }
    const prevToken = this.tokens.tokens[index];
    // Bias toward keeping the token; if we remove it incorrectly, the code will have a subtle bug,
    // while if we don't remove it and we need to, the code will have a syntax error.
    if (
      [
        "name",
        "num",
        "string",
        "false",
        "true",
        "null",
        "void",
        "this",
        ")",
        "]",
        "}",
        "`",
      ].includes(prevToken.type.label)
    ) {
      return true;
    }
    return false;
  }
}
