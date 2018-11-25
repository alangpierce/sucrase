import {isWhitespace} from "./whitespace";

// Test whether a given character code starts an identifier.
export function isIdentifierStart(code: i32): boolean {
  if (code < 65) return code === 36;
  if (code < 91) return true;
  if (code < 97) return code === 95;
  if (code < 123) return true;
  if (code < 128) return false;
  // Aside from whitespace and newlines, all characters outside the ASCII space are either
  // identifier characters or invalid. Since we're not performing code validation, we can just
  // treat all invalid characters as identifier characters.
  return !isWhitespace(code) && code !== 0x2028 && code !== 0x2029;
}

// Test whether a given character is part of an identifier.
export function isIdentifierChar(code: i32): boolean {
  if (code < 48) return code === 36;
  if (code < 58) return true;
  if (code < 65) return false;
  if (code < 91) return true;
  if (code < 97) return code === 95;
  if (code < 123) return true;
  if (code < 128) return false;
  // False positives are ok for the same reason as in isIdentifierStart.
  return !isWhitespace(code) && code !== 0x2028 && code !== 0x2029;
}
