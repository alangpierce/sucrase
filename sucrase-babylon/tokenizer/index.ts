/* eslint max-len: 0 */

import BaseParser from "../parser/base";
import {charCodes, isDigit} from "../util/charcodes";
import {isIdentifierChar, isIdentifierStart, isKeyword} from "../util/identifier";
import {isNewLine, lineBreak, nonASCIIwhitespace} from "../util/whitespace";
import State from "./state";
import {keywords as keywordTypes, TokenType, TokenType as tt} from "./types";

export enum IdentifierRole {
  Access,
  ExportAccess,
  FunctionScopedDeclaration,
  BlockScopedDeclaration,
  ObjectShorthand,
  ObjectKey,
}

export enum ContextualKeyword {
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
  _static,
  _type,
  _set,
  // Also throw in some identifiers we know we'll need to match on.
  _React,
  _createClass,
  _createReactClass,
  _displayName,
}

const contextualKeywordByName = {
  abstract: ContextualKeyword._abstract,
  as: ContextualKeyword._as,
  async: ContextualKeyword._async,
  await: ContextualKeyword._await,
  checks: ContextualKeyword._checks,
  constructor: ContextualKeyword._constructor,
  declare: ContextualKeyword._declare,
  enum: ContextualKeyword._enum,
  exports: ContextualKeyword._exports,
  from: ContextualKeyword._from,
  get: ContextualKeyword._get,
  global: ContextualKeyword._global,
  implements: ContextualKeyword._implements,
  interface: ContextualKeyword._interface,
  is: ContextualKeyword._is,
  keyof: ContextualKeyword._keyof,
  mixins: ContextualKeyword._mixins,
  module: ContextualKeyword._module,
  namespace: ContextualKeyword._namespace,
  of: ContextualKeyword._of,
  opaque: ContextualKeyword._opaque,
  private: ContextualKeyword._private,
  protected: ContextualKeyword._protected,
  public: ContextualKeyword._public,
  readonly: ContextualKeyword._readonly,
  require: ContextualKeyword._require,
  static: ContextualKeyword._static,
  type: ContextualKeyword._type,
  set: ContextualKeyword._set,
  // Custom identifiers we want to match.
  React: ContextualKeyword._React,
  createClass: ContextualKeyword._createClass,
  createReactClass: ContextualKeyword._createReactClass,
  displayName: ContextualKeyword._displayName,
};

// Object type used to represent tokens. Note that normally, tokens
// simply exist as properties on the parser object. This is only
// used for the onToken callback and the external tokenizer.

export class Token {
  constructor(state: State) {
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

export default abstract class Tokenizer extends BaseParser {
  // Forward-declarations
  // parser/util.js
  abstract unexpected(pos?: number | null, messageOrType?: string | TokenType): never;

  state: State;
  input: string;
  nextContextId: number;

  constructor(input: string) {
    super();
    this.state = new State();
    this.state.init(input);
    this.nextContextId = 1;
  }

  // Move to the next token

  next(): void {
    this.state.tokens.push(new Token(this.state));
    this.nextToken();
  }

  // Call instead of next when inside a template, since that needs to be handled differently.
  nextTemplateToken(): void {
    this.state.tokens.push(new Token(this.state));
    this.state.start = this.state.pos;
    this.readTmplToken();
  }

  // The tokenizer never parses regexes by default. Instead, the parser is responsible for
  // instructing it to parse a regex when we see a slash at the start of an expression.
  retokenizeSlashAsRegex(): void {
    if (this.state.type === tt.assign) {
      --this.state.pos;
    }
    this.readRegexp();
  }

  runInTypeContext<T>(existingTokensInType: number, func: () => T): T {
    for (
      let i = this.state.tokens.length - existingTokensInType;
      i < this.state.tokens.length;
      i++
    ) {
      this.state.tokens[i].isType = true;
    }
    const oldIsType = this.state.isType;
    this.state.isType = true;
    const result = func();
    this.state.isType = oldIsType;
    return result;
  }

  eat(type: TokenType): boolean {
    if (this.match(type)) {
      this.next();
      return true;
    } else {
      return false;
    }
  }

  match(type: TokenType): boolean {
    return this.state.type === type;
  }

  lookaheadType(): TokenType {
    const snapshot = this.state.snapshot();
    this.next();
    const type = this.state.type;
    this.state.restoreFromSnapshot(snapshot);
    return type;
  }

  lookaheadTypeAndKeyword(): {type: TokenType; contextualKeyword: ContextualKeyword} {
    const snapshot = this.state.snapshot();
    this.next();
    const type = this.state.type;
    const contextualKeyword = this.state.contextualKeyword;
    this.state.restoreFromSnapshot(snapshot);
    return {type, contextualKeyword};
  }

  // Read a single token, updating the parser object's token-related
  // properties.
  nextToken(): void {
    this.skipSpace();
    this.state.start = this.state.pos;
    if (this.state.pos >= this.input.length) {
      const tokens = this.state.tokens;
      // We normally run past the end a bit, but if we're way past the end, avoid an infinite loop.
      // Also check the token positions rather than the types since sometimes we rewrite the token
      // type to something else.
      if (
        tokens.length >= 2 &&
        tokens[tokens.length - 1].start >= this.input.length &&
        tokens[tokens.length - 2].start >= this.input.length
      ) {
        this.unexpected(null, "Unexpectedly reached the end of input.");
      }
      this.finishToken(tt.eof);
      return;
    }
    this.readToken(this.input.charCodeAt(this.state.pos));
  }

  readToken(code: number): void {
    // Identifier or keyword. '\uXXXX' sequences are allowed in
    // identifiers, so '\' also dispatches to that.
    if (isIdentifierStart(code) || code === charCodes.backslash) {
      this.readWord();
    } else {
      this.getTokenFromCode(code);
    }
  }

  skipBlockComment(): void {
    const end = this.input.indexOf("*/", (this.state.pos += 2));
    if (end === -1) this.raise(this.state.pos - 2, "Unterminated comment");

    this.state.pos = end + 2;
  }

  skipLineComment(startSkip: number): void {
    let ch = this.input.charCodeAt((this.state.pos += startSkip));
    if (this.state.pos < this.input.length) {
      while (
        ch !== charCodes.lineFeed &&
        ch !== charCodes.carriageReturn &&
        ch !== charCodes.lineSeparator &&
        ch !== charCodes.paragraphSeparator &&
        ++this.state.pos < this.input.length
      ) {
        ch = this.input.charCodeAt(this.state.pos);
      }
    }
  }

  // Called at the start of the parse and after every token. Skips
  // whitespace and comments.
  skipSpace(): void {
    loop: while (this.state.pos < this.input.length) {
      const ch = this.input.charCodeAt(this.state.pos);
      switch (ch) {
        case charCodes.space:
        case charCodes.nonBreakingSpace:
          ++this.state.pos;
          break;

        case charCodes.carriageReturn:
          if (this.input.charCodeAt(this.state.pos + 1) === charCodes.lineFeed) {
            ++this.state.pos;
          }

        case charCodes.lineFeed:
        case charCodes.lineSeparator:
        case charCodes.paragraphSeparator:
          ++this.state.pos;
          break;

        case charCodes.slash:
          switch (this.input.charCodeAt(this.state.pos + 1)) {
            case charCodes.asterisk:
              this.skipBlockComment();
              break;

            case charCodes.slash:
              this.skipLineComment(2);
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
            ++this.state.pos;
          } else {
            break loop;
          }
      }
    }
  }

  // Called at the end of every token. Sets `end`, `val`, and
  // maintains `context` and `exprAllowed`, and skips the space after
  // the token, so that the next one's `start` will point at the
  // right position.

  finishToken(
    type: TokenType,
    contextualKeyword: ContextualKeyword = ContextualKeyword.NONE,
  ): void {
    this.state.end = this.state.pos;
    this.state.type = type;
    this.state.contextualKeyword = contextualKeyword;
  }

  // ### Token reading

  // This is the function that is called to fetch the next token. It
  // is somewhat obscure, because it works in character codes rather
  // than characters, and because operator parsing has been inlined
  // into it.
  //
  // All in the name of speed.
  readToken_dot(): void {
    const next = this.input.charCodeAt(this.state.pos + 1);
    if (next >= charCodes.digit0 && next <= charCodes.digit9) {
      this.readNumber(true);
      return;
    }

    const next2 = this.input.charCodeAt(this.state.pos + 2);
    if (next === charCodes.dot && next2 === charCodes.dot) {
      this.state.pos += 3;
      this.finishToken(tt.ellipsis);
    } else {
      ++this.state.pos;
      this.finishToken(tt.dot);
    }
  }

  readToken_slash(): void {
    const next = this.input.charCodeAt(this.state.pos + 1);
    if (next === charCodes.equalsTo) {
      this.finishOp(tt.assign, 2);
    } else {
      this.finishOp(tt.slash, 1);
    }
  }

  readToken_mult_modulo(code: number): void {
    // '%*'
    let type = code === charCodes.asterisk ? tt.star : tt.modulo;
    let width = 1;
    let next = this.input.charCodeAt(this.state.pos + 1);

    // Exponentiation operator **
    if (code === charCodes.asterisk && next === charCodes.asterisk) {
      width++;
      next = this.input.charCodeAt(this.state.pos + 2);
      type = tt.exponent;
    }

    // Match *= or %=, disallowing *=> which can be valid in flow.
    if (
      next === charCodes.equalsTo &&
      this.input.charCodeAt(this.state.pos + 2) !== charCodes.greaterThan
    ) {
      width++;
      type = tt.assign;
    }

    this.finishOp(type, width);
  }

  readToken_pipe_amp(code: number): void {
    // '|&'
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      this.finishOp(code === charCodes.verticalBar ? tt.logicalOR : tt.logicalAND, 2);
      return;
    }

    if (code === charCodes.verticalBar) {
      // '|>'
      if (next === charCodes.greaterThan) {
        this.finishOp(tt.pipeline, 2);
        return;
      } else if (next === charCodes.rightCurlyBrace && this.hasPlugin("flow")) {
        // '|}'
        this.finishOp(tt.braceBarR, 2);
        return;
      }
    }

    if (next === charCodes.equalsTo) {
      this.finishOp(tt.assign, 2);
      return;
    }

    this.finishOp(code === charCodes.verticalBar ? tt.bitwiseOR : tt.bitwiseAND, 1);
  }

  readToken_caret(): void {
    // '^'
    const next = this.input.charCodeAt(this.state.pos + 1);
    if (next === charCodes.equalsTo) {
      this.finishOp(tt.assign, 2);
    } else {
      this.finishOp(tt.bitwiseXOR, 1);
    }
  }

  readToken_plus_min(code: number): void {
    // '+-'
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      this.finishOp(tt.incDec, 2);
      return;
    }

    if (next === charCodes.equalsTo) {
      this.finishOp(tt.assign, 2);
    } else if (code === charCodes.plusSign) {
      this.finishOp(tt.plus, 1);
    } else {
      this.finishOp(tt.minus, 1);
    }
  }

  // '<>'
  readToken_lt_gt(code: number): void {
    // Avoid right-shift for things like Array<Array<string>>.
    if (code === charCodes.greaterThan && this.state.isType) {
      this.finishOp(tt.greaterThan, 1);
      return;
    }
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      const size =
        code === charCodes.greaterThan &&
        this.input.charCodeAt(this.state.pos + 2) === charCodes.greaterThan
          ? 3
          : 2;
      if (this.input.charCodeAt(this.state.pos + size) === charCodes.equalsTo) {
        this.finishOp(tt.assign, size + 1);
        return;
      }
      this.finishOp(tt.bitShift, size);
      return;
    }

    if (next === charCodes.equalsTo) {
      // <= | >=
      this.finishOp(tt.relationalOrEqual, 2);
    } else if (code === charCodes.lessThan) {
      this.finishOp(tt.lessThan, 1);
    } else {
      this.finishOp(tt.greaterThan, 1);
    }
  }

  readToken_eq_excl(code: number): void {
    // '=!'
    const next = this.input.charCodeAt(this.state.pos + 1);
    if (next === charCodes.equalsTo) {
      this.finishOp(
        tt.equality,
        this.input.charCodeAt(this.state.pos + 2) === charCodes.equalsTo ? 3 : 2,
      );
      return;
    }
    if (code === charCodes.equalsTo && next === charCodes.greaterThan) {
      // '=>'
      this.state.pos += 2;
      this.finishToken(tt.arrow);
      return;
    }
    this.finishOp(code === charCodes.equalsTo ? tt.eq : tt.bang, 1);
  }

  readToken_question(): void {
    // '?'
    const next = this.input.charCodeAt(this.state.pos + 1);
    const next2 = this.input.charCodeAt(this.state.pos + 2);
    if (next === charCodes.questionMark) {
      // '??'
      this.finishOp(tt.nullishCoalescing, 2);
    } else if (
      next === charCodes.dot &&
      !(next2 >= charCodes.digit0 && next2 <= charCodes.digit9)
    ) {
      // '.' not followed by a number
      this.state.pos += 2;
      this.finishToken(tt.questionDot);
    } else {
      ++this.state.pos;
      this.finishToken(tt.question);
    }
  }

  getTokenFromCode(code: number): void {
    switch (code) {
      case charCodes.numberSign:
        ++this.state.pos;
        this.finishToken(tt.hash);
        return;

      // The interpretation of a dot depends on whether it is followed
      // by a digit or another two dots.

      case charCodes.dot:
        this.readToken_dot();
        return;

      // Punctuation tokens.
      case charCodes.leftParenthesis:
        ++this.state.pos;
        this.finishToken(tt.parenL);
        return;
      case charCodes.rightParenthesis:
        ++this.state.pos;
        this.finishToken(tt.parenR);
        return;
      case charCodes.semicolon:
        ++this.state.pos;
        this.finishToken(tt.semi);
        return;
      case charCodes.comma:
        ++this.state.pos;
        this.finishToken(tt.comma);
        return;
      case charCodes.leftSquareBracket:
        ++this.state.pos;
        this.finishToken(tt.bracketL);
        return;
      case charCodes.rightSquareBracket:
        ++this.state.pos;
        this.finishToken(tt.bracketR);
        return;

      case charCodes.leftCurlyBrace:
        if (
          this.hasPlugin("flow") &&
          this.input.charCodeAt(this.state.pos + 1) === charCodes.verticalBar
        ) {
          this.finishOp(tt.braceBarL, 2);
        } else {
          ++this.state.pos;
          this.finishToken(tt.braceL);
        }
        return;

      case charCodes.rightCurlyBrace:
        ++this.state.pos;
        this.finishToken(tt.braceR);
        return;

      case charCodes.colon:
        if (this.input.charCodeAt(this.state.pos + 1) === charCodes.colon) {
          this.finishOp(tt.doubleColon, 2);
        } else {
          ++this.state.pos;
          this.finishToken(tt.colon);
        }
        return;

      case charCodes.questionMark:
        this.readToken_question();
        return;
      case charCodes.atSign:
        ++this.state.pos;
        this.finishToken(tt.at);
        return;

      case charCodes.graveAccent:
        ++this.state.pos;
        this.finishToken(tt.backQuote);
        return;

      case charCodes.digit0: {
        const next = this.input.charCodeAt(this.state.pos + 1);
        // '0x', '0X', '0o', '0O', '0b', '0B'
        if (
          next === charCodes.lowercaseX ||
          next === charCodes.uppercaseX ||
          next === charCodes.lowercaseO ||
          next === charCodes.uppercaseO ||
          next === charCodes.lowercaseB ||
          next === charCodes.uppercaseB
        ) {
          this.readRadixNumber();
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
        this.readNumber(false);
        return;

      // Quotes produce strings.
      case charCodes.quotationMark:
      case charCodes.apostrophe:
        this.readString(code);
        return;

      // Operators are parsed inline in tiny state machines. '=' (charCodes.equalsTo) is
      // often referred to. `finishOp` simply skips the amount of
      // characters it is given as second argument, and returns a token
      // of the type given by its first argument.

      case charCodes.slash:
        this.readToken_slash();
        return;

      case charCodes.percentSign:
      case charCodes.asterisk:
        this.readToken_mult_modulo(code);
        return;

      case charCodes.verticalBar:
      case charCodes.ampersand:
        this.readToken_pipe_amp(code);
        return;

      case charCodes.caret:
        this.readToken_caret();
        return;

      case charCodes.plusSign:
      case charCodes.dash:
        this.readToken_plus_min(code);
        return;

      case charCodes.lessThan:
      case charCodes.greaterThan:
        this.readToken_lt_gt(code);
        return;

      case charCodes.equalsTo:
      case charCodes.exclamationMark:
        this.readToken_eq_excl(code);
        return;

      case charCodes.tilde:
        this.finishOp(tt.tilde, 1);
        return;

      default:
        break;
    }

    this.raise(this.state.pos, `Unexpected character '${String.fromCharCode(code)}'`);
  }

  finishOp(type: TokenType, size: number): void {
    this.state.pos += size;
    this.finishToken(type);
  }

  readRegexp(): void {
    const start = this.state.pos;
    let escaped;
    let inClass;
    for (;;) {
      if (this.state.pos >= this.input.length) {
        this.raise(start, "Unterminated regular expression");
      }
      const ch = this.input.charAt(this.state.pos);
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
      ++this.state.pos;
    }
    ++this.state.pos;
    // Need to use `readWord1` because '\uXXXX' sequences are allowed
    // here (don't ask).
    this.readWord1();

    this.finishToken(tt.regexp);
  }

  // Read an integer. We allow any valid digit, including hex digits, plus numeric separators, and
  // stop at any other character.
  readInt(): void {
    while (true) {
      const code = this.input.charCodeAt(this.state.pos);
      if (
        (code >= charCodes.digit0 && code <= charCodes.digit9) ||
        (code >= charCodes.lowercaseA && code <= charCodes.lowercaseF) ||
        (code >= charCodes.uppercaseA && code <= charCodes.uppercaseF) ||
        code === charCodes.underscore
      ) {
        this.state.pos++;
      } else {
        break;
      }
    }
  }

  readRadixNumber(): void {
    let isBigInt = false;

    this.state.pos += 2; // 0x
    this.readInt();

    if (this.input.charCodeAt(this.state.pos) === charCodes.lowercaseN) {
      ++this.state.pos;
      isBigInt = true;
    }

    if (isBigInt) {
      this.finishToken(tt.bigint);
      return;
    }

    this.finishToken(tt.num);
  }

  // Read an integer, octal integer, or floating-point number.
  readNumber(startsWithDot: boolean): void {
    let isBigInt = false;

    if (!startsWithDot) {
      this.readInt();
    }

    let next = this.input.charCodeAt(this.state.pos);
    if (next === charCodes.dot) {
      ++this.state.pos;
      this.readInt();
      next = this.input.charCodeAt(this.state.pos);
    }

    if (next === charCodes.uppercaseE || next === charCodes.lowercaseE) {
      next = this.input.charCodeAt(++this.state.pos);
      if (next === charCodes.plusSign || next === charCodes.dash) {
        ++this.state.pos;
      }
      this.readInt();
      next = this.input.charCodeAt(this.state.pos);
    }

    if (next === charCodes.lowercaseN) {
      ++this.state.pos;
      isBigInt = true;
    }

    if (isBigInt) {
      this.finishToken(tt.bigint);
      return;
    }
    this.finishToken(tt.num);
  }

  readString(quote: number): void {
    this.state.pos++;
    for (;;) {
      if (this.state.pos >= this.input.length) {
        this.raise(this.state.start, "Unterminated string constant");
      }
      const ch = this.input.charCodeAt(this.state.pos);
      if (ch === charCodes.backslash) {
        this.state.pos++;
      } else if (ch === quote) {
        break;
      }
      this.state.pos++;
    }
    this.state.pos++;
    this.finishToken(tt.string);
  }

  // Reads template string tokens.
  readTmplToken(): void {
    for (;;) {
      if (this.state.pos >= this.input.length) {
        this.raise(this.state.start, "Unterminated template");
      }
      const ch = this.input.charCodeAt(this.state.pos);
      if (
        ch === charCodes.graveAccent ||
        (ch === charCodes.dollarSign &&
          this.input.charCodeAt(this.state.pos + 1) === charCodes.leftCurlyBrace)
      ) {
        if (this.state.pos === this.state.start && this.match(tt.template)) {
          if (ch === charCodes.dollarSign) {
            this.state.pos += 2;
            this.finishToken(tt.dollarBraceL);
            return;
          } else {
            ++this.state.pos;
            this.finishToken(tt.backQuote);
            return;
          }
        }
        this.finishToken(tt.template);
        return;
      }
      if (ch === charCodes.backslash) {
        this.state.pos++;
      }
      this.state.pos++;
    }
  }

  readWord1(): string {
    const start = this.state.pos;
    while (this.state.pos < this.input.length) {
      const ch = this.input.charCodeAt(this.state.pos);
      if (isIdentifierChar(ch)) {
        this.state.pos++;
      } else if (ch === charCodes.backslash) {
        // \u
        this.state.pos += 2;
        if (this.state.input.charCodeAt(this.state.pos) === charCodes.leftCurlyBrace) {
          while (this.state.input.charCodeAt(this.state.pos) !== charCodes.leftCurlyBrace) {
            this.state.pos++;
          }
          this.state.pos++;
        }
      } else {
        break;
      }
    }
    return this.input.slice(start, this.state.pos);
  }

  // Read an identifier or keyword token.
  readWord(): void {
    const word = this.readWord1();
    if (isKeyword(word)) {
      this.finishToken(keywordTypes[word]);
    } else if (contextualKeywordByName[word] != null) {
      this.finishToken(tt.name, contextualKeywordByName[word]);
    } else {
      this.finishToken(tt.name);
    }
  }
}
