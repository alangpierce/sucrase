// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.
import {charCodes} from "./charcodes";

export const lineBreak = /\r\n?|\n|\u2028|\u2029/;

const WHITESPACE = new Uint8Array(128);
WHITESPACE[0x0009] = 1;
WHITESPACE[0x000b] = 1;
WHITESPACE[0x000c] = 1;
WHITESPACE[charCodes.space] = 1;

// https://tc39.github.io/ecma262/#sec-white-space
export function isWhitespace(code: number): number {
  // Fast path for ASCII using a pre-computed table.
  if (!(code >>> 7)) {
    return WHITESPACE[code];
  }
  switch (code) {
    case 0x0009: // CHARACTER TABULATION
    case 0x000b: // LINE TABULATION
    case 0x000c: // FORM FEED
    case charCodes.space:
    case charCodes.nonBreakingSpace:
    case charCodes.oghamSpaceMark:
    case 0x2000: // EN QUAD
    case 0x2001: // EM QUAD
    case 0x2002: // EN SPACE
    case 0x2003: // EM SPACE
    case 0x2004: // THREE-PER-EM SPACE
    case 0x2005: // FOUR-PER-EM SPACE
    case 0x2006: // SIX-PER-EM SPACE
    case 0x2007: // FIGURE SPACE
    case 0x2008: // PUNCTUATION SPACE
    case 0x2009: // THIN SPACE
    case 0x200a: // HAIR SPACE
    case 0x202f: // NARROW NO-BREAK SPACE
    case 0x205f: // MEDIUM MATHEMATICAL SPACE
    case 0x3000: // IDEOGRAPHIC SPACE
    case 0xfeff: // ZERO WIDTH NO-BREAK SPACE
      return 1;

    default:
      return 0;
  }
}
