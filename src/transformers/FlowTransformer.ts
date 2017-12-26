import TokenProcessor from "../TokenProcessor";
import RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

export default class FlowTransformer extends Transformer {
  constructor(readonly rootTransformer: RootTransformer, readonly tokens: TokenProcessor) {
    super();
  }

  process(): boolean {
    // We need to handle all classes specially in order to remove `implements`.
    if (this.tokens.matches(["class"])) {
      this.rootTransformer.processClass();
      return true;
    }
    if (this.tokens.matches([":"])) {
      return this.processColon();
    }
    return false;
  }

  processColon(): boolean {
    const colonToken = this.tokens.currentToken();
    const colonIndex = this.tokens.currentIndex();
    const prevToken = this.tokens.tokens[colonIndex - 1];
    if (prevToken.type.label === ")") {
      // Possibly the end of an argument list.
      const startParenIndex = prevToken.contextStartIndex!;
      if (
        this.tokens.matchesAtIndex(startParenIndex - 2, ["function"]) ||
        this.tokens.matchesAtIndex(startParenIndex - 1, ["function"])
      ) {
        this.tokens.removeInitialToken();
        this.rootTransformer.removeTypeExpression();
        return true;
      }
      const endIndex = this.rootTransformer.skipTypeExpression(colonIndex + 1);
      if (endIndex !== null) {
        const nextToken = this.tokens.tokens[endIndex];
        if (
          nextToken.type.label === "{" &&
          (colonToken.contextName === "object" || colonToken.contextName === "class")
        ) {
          this.rootTransformer.removeToTokenIndex(endIndex);
          return true;
        }
      }

      const eagerArrowEndIndex = this.rootTransformer.skipTypeExpression(colonIndex + 1, true);
      if (eagerArrowEndIndex !== null) {
        const eagerArrowNextToken = this.tokens.tokens[eagerArrowEndIndex];
        if (eagerArrowNextToken.type.label === "=>") {
          this.rootTransformer.removeToTokenIndex(eagerArrowEndIndex);
          return true;
        }
      }
    }

    return false;
  }
}
