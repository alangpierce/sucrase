import {TokenType} from "../TokenProcessor";

/**
 * An "atom" in this context is a token that is an expression all by itself,
 * like an identifier or a literal.
 */
export function isTypeExpressionAtom(tokenType: TokenType): boolean {
  return ["name", "num", "string", "false", "true", "null", "void", "this"].includes(
    tokenType.label,
  );
}

export function isTypeExpressionPrefix(tokenType: TokenType): boolean {
  // typeof isn't considered a prefix operator because its operand is an
  // identifier, not a type.
  return ["?"].includes(tokenType.label);
}

export function isTypeBinop(tokenType: TokenType): boolean {
  return ["|", "&"].includes(tokenType.label);
}
