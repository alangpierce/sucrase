import {IdentifierRole} from "../parser/tokenizer";
import {TokenType, TokenType as tt} from "../parser/tokenizer/types";
import TokenProcessor from "../TokenProcessor";
import {startsWithLowerCase} from "../transformers/JSXTransformer";

export function getNonTypeIdentifiers(tokens: TokenProcessor): Set<string> {
  const nonTypeIdentifiers: Set<string> = new Set();
  for (let i = 0; i < tokens.tokens.length; i++) {
    const token = tokens.tokens[i];
    if (
      token.type === tt.name &&
      !token.isType &&
      (token.identifierRole === IdentifierRole.Access ||
        token.identifierRole === IdentifierRole.ObjectShorthand ||
        token.identifierRole === IdentifierRole.ExportAccess)
    ) {
      nonTypeIdentifiers.add(tokens.identifierNameForToken(token));
    }
    if (token.type === tt.jsxName && token.identifierRole === IdentifierRole.Access) {
      nonTypeIdentifiers.add("React");
      const identifierName = tokens.identifierNameForToken(token);
      // Lower-case single-component tag names like "div" don't count.
      if (!startsWithLowerCase(identifierName) || tokens.tokens[i + 1].type === TokenType.dot) {
        nonTypeIdentifiers.add(tokens.identifierNameForToken(token));
      }
    }
  }
  return nonTypeIdentifiers;
}
