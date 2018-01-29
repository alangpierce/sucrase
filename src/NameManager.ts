import {TokenType as tt} from "../sucrase-babylon/tokenizer/types";
import TokenProcessor from "./TokenProcessor";

export default class NameManager {
  private readonly usedNames: Set<string> = new Set();

  constructor(readonly tokens: TokenProcessor) {}

  preprocessNames(): void {
    for (const token of this.tokens.tokens) {
      if (token.type === tt.name) {
        this.usedNames.add(token.value);
      }
    }
  }

  claimFreeName(name: string): string {
    const newName = this.findFreeName(name);
    this.usedNames.add(newName);
    return newName;
  }

  findFreeName(name: string): string {
    if (!this.usedNames.has(name)) {
      return name;
    }
    let suffixNum = 2;
    while (this.usedNames.has(name + suffixNum)) {
      suffixNum++;
    }
    return name + suffixNum;
  }
}
