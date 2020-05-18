import type {Token} from "../parser/tokenizer";
import {TokenType as tt} from "../parser/tokenizer/types";

/**
 * Get all identifier names in the code, in order, including duplicates.
 */
export default function getIdentifierNames(code: string, tokens: Array<Token>): Array<string> {
  const names = [];
  for (const token of tokens) {
    if (token.type === tt.name) {
      names.push(code.slice(token.start, token.end));
    }
  }
  return names;
}
