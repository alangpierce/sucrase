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
      this.tokens.matchesName("private")
    ) {
      this.tokens.removeInitialToken();
      return true;
    }
    return false;
  }
}
