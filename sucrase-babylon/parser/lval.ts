import {IdentifierRole} from "../tokenizer";
import {TokenType, types as tt} from "../tokenizer/types";
import {Pos} from "./index";
import UtilParser from "./util";

export default abstract class LValParser extends UtilParser {
  // Forward-declaration: defined in expression.js
  abstract parseIdentifier(): void;
  abstract parseMaybeAssign(noIn?: boolean | null, afterLeftParse?: Function): void;
  abstract parseObj(isPattern: boolean, isBlockScope: boolean): void;
  // Forward-declaration: defined in statement.js
  abstract parseDecorator(): void;

  // Parses spread element.

  parseSpread(): void {
    this.next();
    this.parseMaybeAssign(false);
  }

  parseRest(isBlockScope: boolean): void {
    this.next();
    this.parseBindingAtom(isBlockScope);
  }

  parseBindingIdentifier(): void {
    this.parseIdentifier();
  }

  // Parses lvalue (assignable) atom.
  parseBindingAtom(isBlockScope: boolean): void {
    switch (this.state.type) {
      case tt._yield:
      case tt.name: {
        this.state.type = tt.name;
        this.parseBindingIdentifier();
        this.state.tokens[this.state.tokens.length - 1].identifierRole = isBlockScope
          ? IdentifierRole.BlockScopedDeclaration
          : IdentifierRole.FunctionScopedDeclaration;
        return;
      }

      case tt.bracketL: {
        this.next();
        this.parseBindingList(tt.bracketR, isBlockScope, true /* allowEmpty */);
        return;
      }

      case tt.braceL:
        this.parseObj(true, isBlockScope);
        return;

      default:
        throw this.unexpected();
    }
  }

  parseBindingList(
    close: TokenType,
    isBlockScope: boolean,
    allowEmpty?: boolean,
    allowModifiers: boolean | null = null,
  ): void {
    let first = true;

    let hasRemovedComma = false;
    const firstItemTokenIndex = this.state.tokens.length;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        // After a "this" type in TypeScript, we need to set the following comma (if any) to also be
        // a type token so that it will be removed.
        if (!hasRemovedComma && this.state.tokens[firstItemTokenIndex].isType) {
          this.state.tokens[this.state.tokens.length - 1].isType = true;
          hasRemovedComma = true;
        }
      }
      if (allowEmpty && this.match(tt.comma)) {
        // Empty item; nothing further to parse for this item.
      } else if (this.eat(close)) {
        break;
      } else if (this.match(tt.ellipsis)) {
        this.parseRest(isBlockScope);
        this.parseAssignableListItemTypes();
        this.expect(close);
        break;
      } else {
        this.parseAssignableListItem(allowModifiers, isBlockScope);
      }
    }
  }

  parseAssignableListItem(allowModifiers: boolean | null, isBlockScope: boolean): void {
    this.parseMaybeDefault(isBlockScope);
    this.parseAssignableListItemTypes();
    this.parseMaybeDefault(isBlockScope, true /* leftAlreadyParsed */);
  }

  parseAssignableListItemTypes(): void {}

  // Parses assignment pattern around given atom if possible.
  parseMaybeDefault(isBlockScope: boolean, leftAlreadyParsed: boolean = false): void {
    if (!leftAlreadyParsed) {
      this.parseBindingAtom(isBlockScope);
    }
    if (!this.eat(tt.eq)) {
      return;
    }
    this.parseMaybeAssign();
  }
}
