import {input, raise, state} from "../../parser/base";
import {parseExpression, parseMaybeAssign} from "../../parser/expression";
import {expect, unexpected} from "../../parser/util";
import {
  eat,
  finishToken,
  getTokenFromCode,
  IdentifierRole,
  lookaheadType,
  match,
  next,
  skipSpace,
  Token,
} from "../../tokenizer";
import {TokenType as tt} from "../../tokenizer/types";
import {charCodes} from "../../util/charcodes";
import {isIdentifierChar, isIdentifierStart} from "../../util/identifier";

// Reads inline JSX contents token.
function jsxReadToken(): void {
  for (;;) {
    if (state.pos >= input.length) {
      raise(state.start, "Unterminated JSX contents");
    }

    const ch = input.charCodeAt(state.pos);

    switch (ch) {
      case charCodes.lessThan:
      case charCodes.leftCurlyBrace:
        if (state.pos === state.start) {
          if (ch === charCodes.lessThan) {
            state.pos++;
            finishToken(tt.jsxTagStart);
            return;
          }
          getTokenFromCode(ch);
          return;
        }
        finishToken(tt.jsxText);
        return;

      default:
        state.pos++;
    }
  }
}

function jsxReadString(quote: number): void {
  state.pos++;
  for (;;) {
    if (state.pos >= input.length) {
      raise(state.start, "Unterminated string constant");
    }

    const ch = input.charCodeAt(state.pos);
    if (ch === quote) {
      state.pos++;
      break;
    }
    state.pos++;
  }
  finishToken(tt.string);
}

// Read a JSX identifier (valid tag or attribute name).
//
// Optimized version since JSX identifiers can't contain
// escape characters and so can be read as single slice.
// Also assumes that first character was already checked
// by isIdentifierStart in readToken.

function jsxReadWord(): void {
  let ch;
  do {
    ch = input.charCodeAt(++state.pos);
  } while (isIdentifierChar(ch) || ch === charCodes.dash);
  finishToken(tt.jsxName);
}

// Parse next token as JSX identifier
function jsxParseIdentifier(): void {
  nextJSXTagToken();
}

// Parse namespaced identifier.
function jsxParseNamespacedName(identifierRole: IdentifierRole): void {
  jsxParseIdentifier();
  if (!eat(tt.colon)) {
    // Plain identifier, so this is an access.
    state.tokens[state.tokens.length - 1].identifierRole = identifierRole;
    return;
  }
  // Process the second half of the namespaced name.
  jsxParseIdentifier();
}

// Parses element name in any form - namespaced, member
// or single identifier.
function jsxParseElementName(): void {
  jsxParseNamespacedName(IdentifierRole.Access);
  while (match(tt.dot)) {
    nextJSXTagToken();
    jsxParseIdentifier();
  }
}

// Parses any type of JSX attribute value.
function jsxParseAttributeValue(): void {
  switch (state.type) {
    case tt.braceL:
      jsxParseExpressionContainer();
      nextJSXTagToken();
      return;

    case tt.jsxTagStart:
      jsxParseElement();
      nextJSXTagToken();
      return;

    case tt.string:
      nextJSXTagToken();
      return;

    default:
      throw raise(state.start, "JSX value should be either an expression or a quoted JSX text");
  }
}

function jsxParseEmptyExpression(): void {
  // Do nothing.
}

// Parse JSX spread child
function jsxParseSpreadChild(): void {
  expect(tt.braceL);
  expect(tt.ellipsis);
  parseExpression();
  expect(tt.braceR);
}

// Parses JSX expression enclosed into curly brackets.
// Does not parse the last token.
function jsxParseExpressionContainer(): void {
  next();
  if (match(tt.braceR)) {
    jsxParseEmptyExpression();
  } else {
    parseExpression();
  }
}

// Parses following JSX attribute name-value pair.
function jsxParseAttribute(): void {
  if (eat(tt.braceL)) {
    expect(tt.ellipsis);
    parseMaybeAssign();
    // }
    nextJSXTagToken();
    return;
  }
  jsxParseNamespacedName(IdentifierRole.ObjectKey);
  if (match(tt.eq)) {
    nextJSXTagToken();
    jsxParseAttributeValue();
  }
}

// Parses JSX opening tag starting after "<".
// Returns true if the tag was self-closing.
// Does not parse the last token.
function jsxParseOpeningElement(): boolean {
  if (match(tt.jsxTagEnd)) {
    nextJSXExprToken();
    // This is an open-fragment.
    return false;
  }
  jsxParseElementName();
  while (!match(tt.slash) && !match(tt.jsxTagEnd)) {
    jsxParseAttribute();
  }
  const isSelfClosing = match(tt.slash);
  if (isSelfClosing) {
    // /
    nextJSXTagToken();
  }
  return isSelfClosing;
}

// Parses JSX closing tag starting after "</".
// Does not parse the last token.
function jsxParseClosingElement(): void {
  if (match(tt.jsxTagEnd)) {
    // Fragment syntax, so we immediately have a tag end.
    return;
  }
  jsxParseElementName();
}

// Parses entire JSX element, including its opening tag
// (starting after "<"), attributes, contents and closing tag.
// Does not parse the last token.
function jsxParseElementAt(): void {
  const isSelfClosing = jsxParseOpeningElement();
  if (!isSelfClosing) {
    nextJSXExprToken();
    contents: while (true) {
      switch (state.type) {
        case tt.jsxTagStart:
          nextJSXTagToken();
          if (match(tt.slash)) {
            nextJSXTagToken();
            jsxParseClosingElement();
            break contents;
          }
          jsxParseElementAt();
          nextJSXExprToken();
          break;

        case tt.jsxText:
          nextJSXExprToken();
          break;

        case tt.braceL:
          if (lookaheadType() === tt.ellipsis) {
            jsxParseSpreadChild();
          } else {
            jsxParseExpressionContainer();
            nextJSXExprToken();
          }

          break;

        // istanbul ignore next - should never happen
        default:
          throw unexpected();
      }
    }
  }
}

// Parses entire JSX element from current position.
// Does not parse the last token.
export function jsxParseElement(): void {
  nextJSXTagToken();
  jsxParseElementAt();
}

// ==================================
// Overrides
// ==================================

function nextJSXTagToken(): void {
  state.tokens.push(new Token());
  skipSpace();
  state.start = state.pos;
  const code = input.charCodeAt(state.pos);

  if (isIdentifierStart(code)) {
    jsxReadWord();
  } else if (code === charCodes.quotationMark || code === charCodes.apostrophe) {
    jsxReadString(code);
  } else {
    // The following tokens are just one character each.
    ++state.pos;
    switch (code) {
      case charCodes.greaterThan:
        finishToken(tt.jsxTagEnd);
        break;
      case charCodes.slash:
        finishToken(tt.slash);
        break;
      case charCodes.equalsTo:
        finishToken(tt.eq);
        break;
      case charCodes.leftCurlyBrace:
        finishToken(tt.braceL);
        break;
      case charCodes.dot:
        finishToken(tt.dot);
        break;
      case charCodes.colon:
        finishToken(tt.colon);
        break;
      default:
        unexpected();
    }
  }
}

function nextJSXExprToken(): void {
  state.tokens.push(new Token());
  state.start = state.pos;
  jsxReadToken();
}
