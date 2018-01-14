import TokenProcessor from "../TokenProcessor";
import RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

export default class FlowTransformer extends Transformer {
  constructor(readonly rootTransformer: RootTransformer, readonly tokens: TokenProcessor) {
    super();
  }

  process(): boolean {
    // We need to handle all classes specially in order to remove `implements`.
    if (this.tokens.matchesKeyword("class")) {
      this.rootTransformer.processClass();
      return true;
    }
    return this.rootTransformer.processPossibleTypeRange();
  }
}
