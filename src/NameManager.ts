import { Token, default as TokenProcessor } from './tokens';

export class NameManager {
  private readonly usedNames: Set<string> = new Set();

  constructor(readonly tokens: TokenProcessor) {
  }

  preprocessNames(tokens: Array<Token>): void {
    for (const token of this.tokens.tokens) {
      if (token.type.label === 'name') {
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
