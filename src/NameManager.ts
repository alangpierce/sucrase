import type {Token} from "./parser/tokenizer";
import getIdentifierNames from "./util/getIdentifierNames";

export default class NameManager {
  private readonly usedNames: Set<string> = new Set();

  constructor(code: string, tokens: Array<Token>) {
    this.usedNames = new Set(getIdentifierNames(code, tokens));
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
