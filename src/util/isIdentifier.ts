import {isIdentifierChar, isIdentifierStart} from "../parser/util/identifier";

export default function isIdentifier(name: string): boolean {
  if (name.length === 0) {
    return false;
  }
  if (!isIdentifierStart(name.charCodeAt(0))) {
    return false;
  }
  for (let i = 1; i < name.length; i++) {
    if (!isIdentifierChar(name.charCodeAt(i))) {
      return false;
    }
  }
  return true;
}
