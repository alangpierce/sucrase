const KEYWORDS = [
  "break",
  "case",
  "catch",
  "continue",
  "debugger",
  "default",
  "do",
  "else",
  "finally",
  "for",
  "function",
  "if",
  "return",
  "switch",
  "throw",
  "try",
  "var",
  "while",
  "with",
  "null",
  "true",
  "false",
  "instanceof",
  "typeof",
  "void",
  "delete",
  "new",
  "in",
  "this",
  "let",
  "const",
  "class",
  "extends",
  "export",
  "import",
  "yield",
  "super",
];

const CONTEXTUAL_KEYWORDS = [
  "abstract",
  "as",
  "async",
  "await",
  "checks",
  "constructor",
  "declare",
  "enum",
  "exports",
  "from",
  "get",
  "global",
  "implements",
  "infer",
  "interface",
  "is",
  "keyof",
  "mixins",
  "module",
  "namespace",
  "of",
  "opaque",
  "private",
  "protected",
  "public",
  "readonly",
  "require",
  "set",
  "static",
  "type",
  "unique",
  // Custom identifiers we want to match.
  "React",
  "createClass",
  "createReactClass",
  "displayName",
];

const CODE = `\
// Generated file, do not edit! Run "yarn generate" to re-generate this file.
/* eslint-disable default-case */
import {input, state} from "../parser/base";
import {charCodes} from "../util/charcodes";
import {isIdentifierChar} from "../util/identifier";
import {ContextualKeyword, finishToken} from "./index";
import {TokenType as tt} from "./types";

/**
 * Read an identifier, producing either a name token or matching on one of the existing keywords.
 * For performance, we generate a big nested switch statement that can recognize all language
 * keywords, so that we don't need to do any string allocations or hash table lookups to tell when
 * a name token is a keyword.
 */
export default function readWord(): void {
  SWITCH_POSITION
  state.pos--;
  while (state.pos < input.length) {
    const ch = input.charCodeAt(state.pos);
    if (isIdentifierChar(ch)) {
      state.pos++;
    } else if (ch === charCodes.backslash) {
      // \\u
      state.pos += 2;
      if (input.charCodeAt(state.pos) === charCodes.leftCurlyBrace) {
        while (input.charCodeAt(state.pos) !== charCodes.leftCurlyBrace) {
          state.pos++;
        }
        state.pos++;
      }
    } else if (ch === charCodes.atSign && input.charCodeAt(state.pos + 1) === charCodes.atSign) {
      state.pos += 2;
    } else {
      break;
    }
  }
  finishToken(tt.name);
}
`;

type Keyword = {
  name: string;
  remainingName: string;
  isContextual: boolean;
};

const ALL_KEYWORDS: Array<Keyword> = [
  ...KEYWORDS.map((name) => ({name, remainingName: name, isContextual: false})),
  ...CONTEXTUAL_KEYWORDS.map((name) => ({name, remainingName: name, isContextual: true})),
];

const AT_END_CODE = `\
!isIdentifierChar(input.charCodeAt(state.pos)) &&
input.charCodeAt(state.pos) !== charCodes.backslash`;

export default function generateReadWord(): string {
  return CODE.replace("SWITCH_POSITION", generateMatcher(ALL_KEYWORDS));
}

/**
 * Generate a matcher, usually a switch, that distinguishes all of the
 */
function generateMatcher(keywords: Array<Keyword>): string {
  const initialLetters: Set<string> = new Set();
  let emptyNameKeyword: Keyword | null = null;
  for (const keyword of keywords) {
    if (keyword.remainingName.length === 0) {
      emptyNameKeyword = keyword;
    } else {
      initialLetters.add(keyword.remainingName[0]);
    }
  }

  let code = "";
  if (emptyNameKeyword) {
    code += `if (${AT_END_CODE}) { ${returnKeywordCode(emptyNameKeyword)} }\n`;
    keywords = keywords.filter((keyword) => keyword !== emptyNameKeyword);
  }

  if (initialLetters.size > 1) {
    code += "switch (input.charCodeAt(state.pos++)) {\n";
    for (const letter of Array.from(initialLetters).sort()) {
      code += `case ${formatLetterCode(letter)}:\n`;
      const remainingKeywords = keywords
        .filter(({remainingName}) => remainingName.startsWith(letter))
        .map((keyword) => ({...keyword, remainingName: keyword.remainingName.slice(1)}));
      code += generateMatcher(remainingKeywords);
      code += `break\n`;
    }
    code += "}\n";
  } else if (initialLetters.size === 1) {
    if (keywords.length === 1) {
      const keyword = keywords[0];
      const conditions = keyword.remainingName
        .split("")
        .map((letter) => `input.charCodeAt(state.pos++) === ${formatLetterCode(letter)} && `);
      code += `if (${conditions.join("")} ${AT_END_CODE}) { ${returnKeywordCode(keyword)} }`;
    } else {
      const letter = Array.from(initialLetters)[0];
      const remainingKeywords = keywords.map((keyword) => ({
        ...keyword,
        remainingName: keyword.remainingName.slice(1),
      }));
      code += `\
if (input.charCodeAt(state.pos++) === ${formatLetterCode(letter)}) {
  ${generateMatcher(remainingKeywords)}
}
`;
    }
  }

  return code;
}

function formatLetterCode(letter: string): string {
  if (letter === letter.toLowerCase()) {
    return `charCodes.lowercase${letter.toUpperCase()}`;
  } else {
    return `charCodes.uppercase${letter}`;
  }
}

function returnKeywordCode(keyword: Keyword): string {
  if (keyword.isContextual) {
    return `finishToken(tt.name, ContextualKeyword._${keyword.name}); return;`;
  } else {
    return `finishToken(tt._${keyword.name}); return;`;
  }
}
