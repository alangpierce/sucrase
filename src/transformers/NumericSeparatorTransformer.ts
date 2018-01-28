import {types as tt} from "../../sucrase-babylon/tokenizer/types";
import TokenProcessor from "../TokenProcessor";
import Transformer from "./Transformer";

export default class NumericSeparatorTransformer extends Transformer {
  constructor(readonly tokens: TokenProcessor) {
    super();
  }

  process(): boolean {
    if (this.tokens.matches1(tt.num)) {
      const code = this.tokens.currentTokenCode();
      if (code.includes("_")) {
        this.tokens.replaceToken(code.replace(/_/g, ""));
        return true;
      }
    }
    return false;
  }
}
