/* eslint max-len: 0 */

import {hasPlugin, input, raise, state} from "../parser/base";
import {unexpected} from "../parser/util";
import {charCodes} from "../util/charcodes";
import {isIdentifierChar, isIdentifierStart} from "../util/identifier";
import {nonASCIIwhitespace} from "../util/whitespace";
import readWord from "./readWord";
import {TokenType, TokenType as tt} from "./types";

export enum IdentifierRole {
  Access,
  ExportAccess,
  FunctionScopedDeclaration,
  BlockScopedDeclaration,
  ObjectShorthand,
  ObjectKey,
}

export const enum ContextualKeyword {
  NONE,
  _abstract,
  _as,
  _async,
  _await,
  _checks,
  _constructor,
  _declare,
  _enum,
  _exports,
  _from,
  _get,
  _global,
  _implements,
  _infer,
  _interface,
  _is,
  _keyof,
  _mixins,
  _module,
  _namespace,
  _of,
  _opaque,
  _private,
  _protected,
  _public,
  _readonly,
  _require,
  _set,
  _static,
  _type,
  _unique,
  // Also throw in some identifiers we know we'll need to match on.
  _React,
  _createClass,
  _createReactClass,
  _displayName,
}

// Object type used to represent tokens. Note that normally, tokens
// simply exist as properties on the parser object. This is only
// used for the onToken callback and the external tokenizer.
export class Token {
  constructor() {
    this.type = state.type;
    this.contextualKeyword = state.contextualKeyword;
    this.start = state.start;
    this.end = state.end;
    this.isType = state.isType;
    this.identifierRole = null;
    this.shadowsGlobal = null;
    this.contextId = null;
    this.rhsEndIndex = null;
    this.isExpression = null;
  }

  type: TokenType;
  contextualKeyword: ContextualKeyword;
  start: number;
  end: number;
  isType: boolean;
  identifierRole: IdentifierRole | null;
  shadowsGlobal: boolean | null;
  contextId: number | null;
  rhsEndIndex: number | null;
  isExpression: boolean | null;
}

// ## Tokenizer

// Move to the next token
export function next(): void {
  state.tokens.push(new Token());
  nextToken();
}

// Call instead of next when inside a template, since that needs to be handled differently.
export function nextTemplateToken(): void {
  state.tokens.push(new Token());
  state.start = state.pos;
  readTmplToken();
}

// The tokenizer never parses regexes by default. Instead, the parser is responsible for
// instructing it to parse a regex when we see a slash at the start of an expression.
export function retokenizeSlashAsRegex(): void {
  if (state.type === tt.assign) {
    --state.pos;
  }
  readRegexp();
}

export function runInTypeContext<T>(existingTokensInType: number, func: () => T): T {
  for (let i = state.tokens.length - existingTokensInType; i < state.tokens.length; i++) {
    state.tokens[i].isType = true;
  }
  const oldIsType = state.isType;
  state.isType = true;
  const result = func();
  state.isType = oldIsType;
  return result;
}

export function eat(type: TokenType): boolean {
  if (match(type)) {
    next();
    return true;
  } else {
    return false;
  }
}

export function match(type: TokenType): boolean {
  return state.type === type;
}

export function lookaheadType(): TokenType {
  const snapshot = state.snapshot();
  next();
  const type = state.type;
  state.restoreFromSnapshot(snapshot);
  return type;
}

export function lookaheadTypeAndKeyword(): {type: TokenType; contextualKeyword: ContextualKeyword} {
  const snapshot = state.snapshot();
  next();
  const type = state.type;
  const contextualKeyword = state.contextualKeyword;
  state.restoreFromSnapshot(snapshot);
  return {type, contextualKeyword};
}

// Read a single token, updating the parser object's token-related
// properties.
export function nextToken(): void {
  skipSpace();
  state.start = state.pos;
  if (state.pos >= input.length) {
    const tokens = state.tokens;
    // We normally run past the end a bit, but if we're way past the end, avoid an infinite loop.
    // Also check the token positions rather than the types since sometimes we rewrite the token
    // type to something else.
    if (
      tokens.length >= 2 &&
      tokens[tokens.length - 1].start >= input.length &&
      tokens[tokens.length - 2].start >= input.length
    ) {
      unexpected(null, "Unexpectedly reached the end of input.");
    }
    finishToken(tt.eof);
    return;
  }
  readToken(input.charCodeAt(state.pos));
}

function readToken(code: number): void {
  // Identifier or keyword. '\uXXXX' sequences are allowed in
  // identifiers, so '\' also dispatches to that.
  if (
    isIdentifierStart(code) ||
    code === charCodes.backslash ||
    (code === charCodes.atSign && input.charCodeAt(state.pos + 1) === charCodes.atSign)
  ) {
    readWord();
  } else {
    getTokenFromCode(code);
  }
}

function skipBlockComment(): void {
  const end = input.indexOf("*/", (state.pos += 2));
  if (end === -1) raise(state.pos - 2, "Unterminated comment");

  state.pos = end + 2;
}

export function skipLineComment(startSkip: number): void {
  let ch = input.charCodeAt((state.pos += startSkip));
  if (state.pos < input.length) {
    while (
      ch !== charCodes.lineFeed &&
      ch !== charCodes.carriageReturn &&
      ch !== charCodes.lineSeparator &&
      ch !== charCodes.paragraphSeparator &&
      ++state.pos < input.length
    ) {
      ch = input.charCodeAt(state.pos);
    }
  }
}

// Called at the start of the parse and after every token. Skips
// whitespace and comments.
export function skipSpace(): void {
  loop: while (state.pos < input.length) {
    const ch = input.charCodeAt(state.pos);
    switch (ch) {
      case charCodes.space:
      case charCodes.nonBreakingSpace:
        ++state.pos;
        break;

      case charCodes.carriageReturn:
        if (input.charCodeAt(state.pos + 1) === charCodes.lineFeed) {
          ++state.pos;
        }

      case charCodes.lineFeed:
      case charCodes.lineSeparator:
      case charCodes.paragraphSeparator:
        ++state.pos;
        break;

      case charCodes.slash:
        switch (input.charCodeAt(state.pos + 1)) {
          case charCodes.asterisk:
            skipBlockComment();
            break;

          case charCodes.slash:
            skipLineComment(2);
            break;

          default:
            break loop;
        }
        break;

      default:
        if (
          (ch > charCodes.backSpace && ch < charCodes.shiftOut) ||
          (ch >= charCodes.oghamSpaceMark && nonASCIIwhitespace.test(String.fromCharCode(ch)))
        ) {
          ++state.pos;
        } else {
          break loop;
        }
    }
  }
}

// Called at the end of every token. Sets various fields, and skips the space after the token, so
// that the next one's `start` will point at the right position.
export function finishToken(
  type: TokenType,
  contextualKeyword: ContextualKeyword = ContextualKeyword.NONE,
): void {
  state.end = state.pos;
  state.type = type;
  state.contextualKeyword = contextualKeyword;
}

// ### Token reading

// This is the function that is called to fetch the next token. It
// is somewhat obscure, because it works in character codes rather
// than characters, and because operator parsing has been inlined
// into it.
//
// All in the name of speed.
function readToken_dot(): void {
  const nextChar = input.charCodeAt(state.pos + 1);
  if (nextChar >= charCodes.digit0 && nextChar <= charCodes.digit9) {
    readNumber(true);
    return;
  }

  const next2 = input.charCodeAt(state.pos + 2);
  if (nextChar === charCodes.dot && next2 === charCodes.dot) {
    state.pos += 3;
    finishToken(tt.ellipsis);
  } else {
    ++state.pos;
    finishToken(tt.dot);
  }
}

function readToken_slash(): void {
  const nextChar = input.charCodeAt(state.pos + 1);
  if (nextChar === charCodes.equalsTo) {
    finishOp(tt.assign, 2);
  } else {
    finishOp(tt.slash, 1);
  }
}

function readToken_mult_modulo(code: number): void {
  // '%*'
  let type = code === charCodes.asterisk ? tt.star : tt.modulo;
  let width = 1;
  let nextChar = input.charCodeAt(state.pos + 1);

  // Exponentiation operator **
  if (code === charCodes.asterisk && nextChar === charCodes.asterisk) {
    width++;
    nextChar = input.charCodeAt(state.pos + 2);
    type = tt.exponent;
  }

  // Match *= or %=, disallowing *=> which can be valid in flow.
  if (
    nextChar === charCodes.equalsTo &&
    input.charCodeAt(state.pos + 2) !== charCodes.greaterThan
  ) {
    width++;
    type = tt.assign;
  }

  finishOp(type, width);
}

function readToken_pipe_amp(code: number): void {
  // '|&'
  const nextChar = input.charCodeAt(state.pos + 1);

  if (nextChar === code) {
    if (input.charCodeAt(state.pos + 2) === charCodes.equalsTo) {
      // ||= or &&=
      finishOp(tt.assign, 3);
    } else {
      // || or &&
      finishOp(code === charCodes.verticalBar ? tt.logicalOR : tt.logicalAND, 2);
    }
    return;
  }

  if (code === charCodes.verticalBar) {
    // '|>'
    if (nextChar === charCodes.greaterThan) {
      finishOp(tt.pipeline, 2);
      return;
    } else if (nextChar === charCodes.rightCurlyBrace && hasPlugin("flow")) {
      // '|}'
      finishOp(tt.braceBarR, 2);
      return;
    }
  }

  if (nextChar === charCodes.equalsTo) {
    finishOp(tt.assign, 2);
    return;
  }

  finishOp(code === charCodes.verticalBar ? tt.bitwiseOR : tt.bitwiseAND, 1);
}

function readToken_caret(): void {
  // '^'
  const nextChar = input.charCodeAt(state.pos + 1);
  if (nextChar === charCodes.equalsTo) {
    finishOp(tt.assign, 2);
  } else {
    finishOp(tt.bitwiseXOR, 1);
  }
}

function readToken_plus_min(code: number): void {
  // '+-'
  const nextChar = input.charCodeAt(state.pos + 1);

  if (nextChar === code) {
    finishOp(tt.incDec, 2);
    return;
  }

  if (nextChar === charCodes.equalsTo) {
    finishOp(tt.assign, 2);
  } else if (code === charCodes.plusSign) {
    finishOp(tt.plus, 1);
  } else {
    finishOp(tt.minus, 1);
  }
}

// '<>'
function readToken_lt_gt(code: number): void {
  // Avoid right-shift for things like Array<Array<string>>.
  if (code === charCodes.greaterThan && state.isType) {
    finishOp(tt.greaterThan, 1);
    return;
  }
  const nextChar = input.charCodeAt(state.pos + 1);

  if (nextChar === code) {
    const size =
      code === charCodes.greaterThan && input.charCodeAt(state.pos + 2) === charCodes.greaterThan
        ? 3
        : 2;
    if (input.charCodeAt(state.pos + size) === charCodes.equalsTo) {
      finishOp(tt.assign, size + 1);
      return;
    }
    finishOp(tt.bitShift, size);
    return;
  }

  if (nextChar === charCodes.equalsTo) {
    // <= | >=
    finishOp(tt.relationalOrEqual, 2);
  } else if (code === charCodes.lessThan) {
    finishOp(tt.lessThan, 1);
  } else {
    finishOp(tt.greaterThan, 1);
  }
}

function readToken_eq_excl(code: number): void {
  // '=!'
  const nextChar = input.charCodeAt(state.pos + 1);
  if (nextChar === charCodes.equalsTo) {
    finishOp(tt.equality, input.charCodeAt(state.pos + 2) === charCodes.equalsTo ? 3 : 2);
    return;
  }
  if (code === charCodes.equalsTo && nextChar === charCodes.greaterThan) {
    // '=>'
    state.pos += 2;
    finishToken(tt.arrow);
    return;
  }
  finishOp(code === charCodes.equalsTo ? tt.eq : tt.bang, 1);
}

function readToken_question(): void {
  // '?'
  const nextChar = input.charCodeAt(state.pos + 1);
  const nextChar2 = input.charCodeAt(state.pos + 2);
  if (nextChar === charCodes.questionMark) {
    if (nextChar2 === charCodes.equalsTo) {
      // '??='
      finishOp(tt.assign, 3);
    } else {
      // '??'
      finishOp(tt.nullishCoalescing, 2);
    }
  } else if (
    nextChar === charCodes.dot &&
    !(nextChar2 >= charCodes.digit0 && nextChar2 <= charCodes.digit9)
  ) {
    // '.' not followed by a number
    state.pos += 2;
    finishToken(tt.questionDot);
  } else {
    ++state.pos;
    finishToken(tt.question);
  }
}

export function getTokenFromCode(code: number): void {
  switch (code) {
    case charCodes.numberSign:
      ++state.pos;
      finishToken(tt.hash);
      return;

    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.

    case charCodes.dot:
      readToken_dot();
      return;

    // Punctuation tokens.
    case charCodes.leftParenthesis:
      ++state.pos;
      finishToken(tt.parenL);
      return;
    case charCodes.rightParenthesis:
      ++state.pos;
      finishToken(tt.parenR);
      return;
    case charCodes.semicolon:
      ++state.pos;
      finishToken(tt.semi);
      return;
    case charCodes.comma:
      ++state.pos;
      finishToken(tt.comma);
      return;
    case charCodes.leftSquareBracket:
      ++state.pos;
      finishToken(tt.bracketL);
      return;
    case charCodes.rightSquareBracket:
      ++state.pos;
      finishToken(tt.bracketR);
      return;

    case charCodes.leftCurlyBrace:
      if (hasPlugin("flow") && input.charCodeAt(state.pos + 1) === charCodes.verticalBar) {
        finishOp(tt.braceBarL, 2);
      } else {
        ++state.pos;
        finishToken(tt.braceL);
      }
      return;

    case charCodes.rightCurlyBrace:
      ++state.pos;
      finishToken(tt.braceR);
      return;

    case charCodes.colon:
      if (input.charCodeAt(state.pos + 1) === charCodes.colon) {
        finishOp(tt.doubleColon, 2);
      } else {
        ++state.pos;
        finishToken(tt.colon);
      }
      return;

    case charCodes.questionMark:
      readToken_question();
      return;
    case charCodes.atSign:
      ++state.pos;
      finishToken(tt.at);
      return;

    case charCodes.graveAccent:
      ++state.pos;
      finishToken(tt.backQuote);
      return;

    case charCodes.digit0: {
      const nextChar = input.charCodeAt(state.pos + 1);
      // '0x', '0X', '0o', '0O', '0b', '0B'
      if (
        nextChar === charCodes.lowercaseX ||
        nextChar === charCodes.uppercaseX ||
        nextChar === charCodes.lowercaseO ||
        nextChar === charCodes.uppercaseO ||
        nextChar === charCodes.lowercaseB ||
        nextChar === charCodes.uppercaseB
      ) {
        readRadixNumber();
        return;
      }
    }
    // Anything else beginning with a digit is an integer, octal
    // number, or float.
    case charCodes.digit1:
    case charCodes.digit2:
    case charCodes.digit3:
    case charCodes.digit4:
    case charCodes.digit5:
    case charCodes.digit6:
    case charCodes.digit7:
    case charCodes.digit8:
    case charCodes.digit9:
      readNumber(false);
      return;

    // Quotes produce strings.
    case charCodes.quotationMark:
    case charCodes.apostrophe:
      readString(code);
      return;

    // Operators are parsed inline in tiny state machines. '=' (charCodes.equalsTo) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.

    case charCodes.slash:
      readToken_slash();
      return;

    case charCodes.percentSign:
    case charCodes.asterisk:
      readToken_mult_modulo(code);
      return;

    case charCodes.verticalBar:
    case charCodes.ampersand:
      readToken_pipe_amp(code);
      return;

    case charCodes.caret:
      readToken_caret();
      return;

    case charCodes.plusSign:
    case charCodes.dash:
      readToken_plus_min(code);
      return;

    case charCodes.lessThan:
    case charCodes.greaterThan:
      readToken_lt_gt(code);
      return;

    case charCodes.equalsTo:
    case charCodes.exclamationMark:
      readToken_eq_excl(code);
      return;

    case charCodes.tilde:
      finishOp(tt.tilde, 1);
      return;

    default:
      break;
  }

  raise(state.pos, `Unexpected character '${String.fromCharCode(code)}'`);
}

function finishOp(type: TokenType, size: number): void {
  state.pos += size;
  finishToken(type);
}

function readRegexp(): void {
  const start = state.pos;
  let escaped;
  let inClass;
  for (;;) {
    if (state.pos >= input.length) {
      raise(start, "Unterminated regular expression");
    }
    const ch = input.charAt(state.pos);
    if (escaped) {
      escaped = false;
    } else {
      if (ch === "[") {
        inClass = true;
      } else if (ch === "]" && inClass) {
        inClass = false;
      } else if (ch === "/" && !inClass) {
        break;
      }
      escaped = ch === "\\";
    }
    ++state.pos;
  }
  ++state.pos;
  // Need to use `skipWord` because '\uXXXX' sequences are allowed here (don't ask).
  skipWord();

  finishToken(tt.regexp);
}

// Read an integer. We allow any valid digit, including hex digits, plus numeric separators, and
// stop at any other character.
function readInt(): void {
  while (true) {
    const code = input.charCodeAt(state.pos);
    if (
      (code >= charCodes.digit0 && code <= charCodes.digit9) ||
      (code >= charCodes.lowercaseA && code <= charCodes.lowercaseF) ||
      (code >= charCodes.uppercaseA && code <= charCodes.uppercaseF) ||
      code === charCodes.underscore
    ) {
      state.pos++;
    } else {
      break;
    }
  }
}

function readRadixNumber(): void {
  let isBigInt = false;

  state.pos += 2; // 0x
  readInt();

  if (input.charCodeAt(state.pos) === charCodes.lowercaseN) {
    ++state.pos;
    isBigInt = true;
  }

  if (isBigInt) {
    finishToken(tt.bigint);
    return;
  }

  finishToken(tt.num);
}

// Read an integer, octal integer, or floating-point number.
function readNumber(startsWithDot: boolean): void {
  let isBigInt = false;

  if (!startsWithDot) {
    readInt();
  }

  let nextChar = input.charCodeAt(state.pos);
  if (nextChar === charCodes.dot) {
    ++state.pos;
    readInt();
    nextChar = input.charCodeAt(state.pos);
  }

  if (nextChar === charCodes.uppercaseE || nextChar === charCodes.lowercaseE) {
    nextChar = input.charCodeAt(++state.pos);
    if (nextChar === charCodes.plusSign || nextChar === charCodes.dash) {
      ++state.pos;
    }
    readInt();
    nextChar = input.charCodeAt(state.pos);
  }

  if (nextChar === charCodes.lowercaseN) {
    ++state.pos;
    isBigInt = true;
  }

  if (isBigInt) {
    finishToken(tt.bigint);
    return;
  }
  finishToken(tt.num);
}

function readString(quote: number): void {
  state.pos++;
  for (;;) {
    if (state.pos >= input.length) {
      raise(state.start, "Unterminated string constant");
    }
    const ch = input.charCodeAt(state.pos);
    if (ch === charCodes.backslash) {
      state.pos++;
    } else if (ch === quote) {
      break;
    }
    state.pos++;
  }
  state.pos++;
  finishToken(tt.string);
}

// Reads template string tokens.
function readTmplToken(): void {
  for (;;) {
    if (state.pos >= input.length) {
      raise(state.start, "Unterminated template");
    }
    const ch = input.charCodeAt(state.pos);
    if (
      ch === charCodes.graveAccent ||
      (ch === charCodes.dollarSign && input.charCodeAt(state.pos + 1) === charCodes.leftCurlyBrace)
    ) {
      if (state.pos === state.start && match(tt.template)) {
        if (ch === charCodes.dollarSign) {
          state.pos += 2;
          finishToken(tt.dollarBraceL);
          return;
        } else {
          ++state.pos;
          finishToken(tt.backQuote);
          return;
        }
      }
      finishToken(tt.template);
      return;
    }
    if (ch === charCodes.backslash) {
      state.pos++;
    }
    state.pos++;
  }
}

// Skip to the end of the current word. Note that this is the same as the snippet at the end of
// readWord, but calling skipWord from readWord seems to slightly hurt performance from some rough
// measurements.
export function skipWord(): void {
  while (state.pos < input.length) {
    const ch = input.charCodeAt(state.pos);
    if (isIdentifierChar(ch)) {
      state.pos++;
    } else if (ch === charCodes.backslash) {
      // \u
      state.pos += 2;
      if (input.charCodeAt(state.pos) === charCodes.leftCurlyBrace) {
        while (input.charCodeAt(state.pos) !== charCodes.leftCurlyBrace) {
          state.pos++;
        }
        state.pos++;
      }
    } else {
      break;
    }
  }
}
