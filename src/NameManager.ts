import {TokenType as tt} from "./parser/tokenizer/types";
import TokenProcessor from "./TokenProcessor";

export default class NameManager {
  private readonly usedNames: Set<string> = new Set();
  private symbolNames: Array<string> = [];

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

  /**
   * Get an identifier such that the identifier will be a valid reference to a symbol after codegen.
   */
  claimSymbol(name: string): string {
    const newName = this.claimFreeName(name);
    this.symbolNames.push(newName);
    return newName;
  }

  getInjectedSymbolCode(): string {
    return this.symbolNames.map((name) => `const ${name} = Symbol();`).join("");
  }
}
