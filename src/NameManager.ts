import {TokenType as tt} from "./parser/tokenizer/types";
import TokenProcessor from "./TokenProcessor";

export default class NameManager {
  private readonly usedNames: Set<string> = new Set();

  constructor(readonly tokens: TokenProcessor) {}

  preprocessNames(): void {
    for (let i = 0; i < this.tokens.tokens.length; i++) {
      if (this.tokens.matches1AtIndex(i, tt.name)) {
        this.usedNames.add(this.tokens.identifierNameAtIndex(i));
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
