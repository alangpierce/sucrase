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
    if (this.tokens.currentToken().contextName === "type") {
      this.tokens.removeInitialToken();
      return true;
    }
    return false;
  }

  processColon(): boolean {
    if (this.tokens.tokenAtRelativeIndex(1).contextName === "type") {
      this.tokens.removeInitialToken();
      while (this.tokens.currentToken().contextName === "type") {
        this.tokens.removeToken();
      }
    }
    return false;
  }
}
