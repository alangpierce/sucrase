import Parser, {ParserClass} from "../../parser";
import {IdentifierRole} from "../../tokenizer";
import {TokContext, types as tc} from "../../tokenizer/context";
import {TokenType, types as tt} from "../../tokenizer/types";
import * as charCodes from "../../util/charcodes";
import {isIdentifierChar, isIdentifierStart} from "../../util/identifier";
import {Pos} from "../../util/location";
import {isNewLine} from "../../util/whitespace";
import XHTMLEntities from "./xhtml";

const HEX_NUMBER = /^[\da-fA-F]+$/;
const DECIMAL_NUMBER = /^\d+$/;

tc.j_oTag = new TokContext("<tag", false);
tc.j_cTag = new TokContext("</tag", false);
tc.j_expr = new TokContext("<tag>...</tag>", true, true);

tt.jsxName = new TokenType("jsxName");
tt.jsxText = new TokenType("jsxText", {beforeExpr: true});
tt.jsxTagStart = new TokenType("jsxTagStart", {startsExpr: true});
tt.jsxTagEnd = new TokenType("jsxTagEnd");

tt.jsxTagStart.updateContext = function(): void {
  this.state.context.push(tc.j_expr); // treat as beginning of JSX expression
  this.state.context.push(tc.j_oTag); // start opening tag context
  this.state.exprAllowed = false;
};

tt.jsxTagEnd.updateContext = function(prevType: TokenType): void {
  const out = this.state.context.pop();
  if ((out === tc.j_oTag && prevType === tt.slash) || out === tc.j_cTag) {
    this.state.context.pop();
    this.state.exprAllowed = this.curContext() === tc.j_expr;
  } else {
    this.state.exprAllowed = true;
  }
};

export default (superClass: ParserClass): ParserClass =>
  class extends superClass {
    // Reads inline JSX contents token.

    jsxReadToken(): void {
      let out = "";
      let chunkStart = this.state.pos;
      for (;;) {
        if (this.state.pos >= this.input.length) {
          this.raise(this.state.start, "Unterminated JSX contents");
        }

        const ch = this.input.charCodeAt(this.state.pos);

        switch (ch) {
          case charCodes.lessThan:
          case charCodes.leftCurlyBrace:
            if (this.state.pos === this.state.start) {
              if (ch === charCodes.lessThan && this.state.exprAllowed) {
                ++this.state.pos;
                this.finishToken(tt.jsxTagStart);
                return;
              }
              this.getTokenFromCode(ch);
              return;
            }
            out += this.input.slice(chunkStart, this.state.pos);
            this.finishToken(tt.jsxText, out);
            return;

          case charCodes.ampersand:
            out += this.input.slice(chunkStart, this.state.pos);
            out += this.jsxReadEntity();
            chunkStart = this.state.pos;
            break;

          default:
            if (isNewLine(ch)) {
              out += this.input.slice(chunkStart, this.state.pos);
              out += this.jsxReadNewLine(true);
              chunkStart = this.state.pos;
            } else {
              ++this.state.pos;
            }
        }
      }
    }

    jsxReadNewLine(normalizeCRLF: boolean): string {
      const ch = this.input.charCodeAt(this.state.pos);
      let out;
      ++this.state.pos;
      if (
        ch === charCodes.carriageReturn &&
        this.input.charCodeAt(this.state.pos) === charCodes.lineFeed
      ) {
        ++this.state.pos;
        out = normalizeCRLF ? "\n" : "\r\n";
      } else {
        out = String.fromCharCode(ch);
      }

      return out;
    }

    jsxReadString(quote: number): void {
      let out = "";
      let chunkStart = ++this.state.pos;
      for (;;) {
        if (this.state.pos >= this.input.length) {
          this.raise(this.state.start, "Unterminated string constant");
        }

        const ch = this.input.charCodeAt(this.state.pos);
        if (ch === quote) break;
        if (ch === charCodes.ampersand) {
          out += this.input.slice(chunkStart, this.state.pos);
          out += this.jsxReadEntity();
          chunkStart = this.state.pos;
        } else if (isNewLine(ch)) {
          out += this.input.slice(chunkStart, this.state.pos);
          out += this.jsxReadNewLine(false);
          chunkStart = this.state.pos;
        } else {
          ++this.state.pos;
        }
      }
      out += this.input.slice(chunkStart, this.state.pos++);
      this.finishToken(tt.string, out);
    }

    jsxReadEntity(): string {
      let str = "";
      let count = 0;
      let entity;
      let ch = this.input[this.state.pos];

      const startPos = ++this.state.pos;
      while (this.state.pos < this.input.length && count++ < 10) {
        ch = this.input[this.state.pos++];
        if (ch === ";") {
          if (str[0] === "#") {
            if (str[1] === "x") {
              str = str.substr(2);
              if (HEX_NUMBER.test(str)) {
                entity = String.fromCodePoint(parseInt(str, 16));
              }
            } else {
              str = str.substr(1);
              if (DECIMAL_NUMBER.test(str)) {
                entity = String.fromCodePoint(parseInt(str, 10));
              }
            }
          } else {
            entity = XHTMLEntities[str];
          }
          break;
        }
        str += ch;
      }
      if (!entity) {
        this.state.pos = startPos;
        return "&";
      }
      return entity;
    }

    // Read a JSX identifier (valid tag or attribute name).
    //
    // Optimized version since JSX identifiers can"t contain
    // escape characters and so can be read as single slice.
    // Also assumes that first character was already checked
    // by isIdentifierStart in readToken.

    jsxReadWord(): void {
      let ch;
      const start = this.state.pos;
      do {
        ch = this.input.charCodeAt(++this.state.pos);
      } while (isIdentifierChar(ch) || ch === charCodes.dash);
      this.finishToken(tt.jsxName, this.input.slice(start, this.state.pos));
    }

    // Parse next token as JSX identifier
    jsxParseIdentifier(): void {
      this.next();
    }

    // Parse namespaced identifier.
    jsxParseNamespacedName(): void {
      this.jsxParseIdentifier();
      if (!this.eat(tt.colon)) {
        // Plain identifier, so this is an access.
        this.state.tokens[this.state.tokens.length - 1].identifierRole = IdentifierRole.Access;
        return;
      }
      // Process the second half of the namespaced name.
      this.jsxParseIdentifier();
    }

    // Parses element name in any form - namespaced, member
    // or single identifier.
    jsxParseElementName(): void {
      this.jsxParseNamespacedName();
      while (this.eat(tt.dot)) {
        this.jsxParseIdentifier();
      }
    }

    // Parses any type of JSX attribute value.
    jsxParseAttributeValue(): void {
      switch (this.state.type) {
        case tt.braceL:
          this.jsxParseExpressionContainer();
          return;

        case tt.jsxTagStart:
        case tt.string:
          this.parseExprAtom();
          return;

        default:
          throw this.raise(
            this.state.start,
            "JSX value should be either an expression or a quoted JSX text",
          );
      }
    }

    jsxParseEmptyExpression(): void {
      // Do nothing.
    }

    // Parse JSX spread child
    jsxParseSpreadChild(): void {
      this.expect(tt.braceL);
      this.expect(tt.ellipsis);
      this.parseExpression();
      this.expect(tt.braceR);
    }

    // Parses JSX expression enclosed into curly brackets.
    jsxParseExpressionContainer(): void {
      this.next();
      if (this.match(tt.braceR)) {
        this.jsxParseEmptyExpression();
      } else {
        this.parseExpression();
      }
      this.expect(tt.braceR);
    }

    // Parses following JSX attribute name-value pair.
    jsxParseAttribute(): void {
      if (this.eat(tt.braceL)) {
        this.expect(tt.ellipsis);
        this.parseMaybeAssign();
        this.expect(tt.braceR);
        return;
      }
      this.jsxParseNamespacedName();
      if (this.eat(tt.eq)) {
        this.jsxParseAttributeValue();
      }
    }

    // Parses JSX opening tag starting after "<".
    // Returns true if the tag was self-closing.
    jsxParseOpeningElement(): boolean {
      if (this.eat(tt.jsxTagEnd)) {
        // This is an open-fragment.
        return false;
      }
      this.jsxParseElementName();
      while (!this.match(tt.slash) && !this.match(tt.jsxTagEnd)) {
        this.jsxParseAttribute();
      }
      const isSelfClosing = this.eat(tt.slash);
      this.expect(tt.jsxTagEnd);
      return isSelfClosing;
    }

    // Parses JSX closing tag starting after "</".
    jsxParseClosingElement(): void {
      if (this.eat(tt.jsxTagEnd)) {
        return;
      }
      this.jsxParseElementName();
      this.expect(tt.jsxTagEnd);
    }

    // Parses entire JSX element, including its opening tag
    // (starting after "<"), attributes, contents and closing tag.
    jsxParseElementAt(): void {
      const isSelfClosing = this.jsxParseOpeningElement();
      if (!isSelfClosing) {
        contents: while (true) {
          switch (this.state.type) {
            case tt.jsxTagStart:
              this.next();
              if (this.eat(tt.slash)) {
                this.jsxParseClosingElement();
                break contents;
              }
              this.jsxParseElementAt();
              break;

            case tt.jsxText:
              this.parseExprAtom();
              break;

            case tt.braceL:
              if (this.lookahead().type === tt.ellipsis) {
                this.jsxParseSpreadChild();
              } else {
                this.jsxParseExpressionContainer();
              }

              break;

            // istanbul ignore next - should never happen
            default:
              throw this.unexpected();
          }
        }
      }
    }

    // Parses entire JSX element from current position.
    jsxParseElement(): void {
      this.next();
      this.jsxParseElementAt();
    }

    // ==================================
    // Overrides
    // ==================================

    // Returns true if this was an arrow function.
    parseExprAtom(refShortHandDefaultPos: Pos | null = null): boolean {
      if (this.match(tt.jsxText)) {
        this.parseLiteral();
        return false;
      } else if (this.match(tt.jsxTagStart)) {
        this.jsxParseElement();
        return false;
      } else {
        return super.parseExprAtom(refShortHandDefaultPos);
      }
    }

    readToken(code: number): void {
      if (this.state.inPropertyName) {
        super.readToken(code);
        return;
      }

      const context = this.curContext();

      if (context === tc.j_expr) {
        this.jsxReadToken();
        return;
      }

      if (context === tc.j_oTag || context === tc.j_cTag) {
        if (isIdentifierStart(code)) {
          this.jsxReadWord();
          return;
        }

        if (code === charCodes.greaterThan) {
          ++this.state.pos;
          this.finishToken(tt.jsxTagEnd);
          return;
        }

        if (
          (code === charCodes.quotationMark || code === charCodes.apostrophe) &&
          context === tc.j_oTag
        ) {
          this.jsxReadString(code);
          return;
        }
      }

      if (code === charCodes.lessThan && this.state.exprAllowed) {
        ++this.state.pos;
        this.finishToken(tt.jsxTagStart);
        return;
      }

      super.readToken(code);
    }

    updateContext(prevType: TokenType): void {
      if (this.match(tt.braceL)) {
        const curContext = this.curContext();
        if (curContext === tc.j_oTag) {
          this.state.context.push(tc.braceExpression);
        } else if (curContext === tc.j_expr) {
          this.state.context.push(tc.templateQuasi);
        } else {
          super.updateContext(prevType);
        }
        this.state.exprAllowed = true;
      } else if (this.match(tt.slash) && prevType === tt.jsxTagStart) {
        this.state.context.length -= 2; // do not consider JSX expr -> JSX open tag -> ... anymore
        this.state.context.push(tc.j_cTag); // reconsider as closing tag context
        this.state.exprAllowed = false;
      } else {
        super.updateContext(prevType);
      }
    }
  };
