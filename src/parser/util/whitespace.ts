// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.
export const lineBreak = /\r\n?|\n|\u2028|\u2029/;

export const nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
