import NameManager from "../NameManager";
import TokenProcessor from "../TokenProcessor";
import Transformer from "./Transformer";

export default class OptionalCatchBindingTransformer extends Transformer {
  constructor(readonly tokens: TokenProcessor, readonly nameManager: NameManager) {
    super();
  }

  process(): boolean {
    if (this.tokens.matches(["catch", "{"])) {
      this.tokens.copyToken();
      this.tokens.appendCode(` (${this.nameManager.claimFreeName("e")})`);
    }
    return false;
  }
}
