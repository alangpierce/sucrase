import {IdentifierRole} from "../tokenizer";
import {TokenType, types as tt} from "../tokenizer/types";
import {
  ArrayPattern,
  AssignmentPattern,
  Expression,
  Identifier,
  Node,
  ObjectExpression,
  ObjectPattern,
  Pattern,
  RestElement,
  SpreadElement,
  TSParameterProperty,
} from "../types";
import {Pos, Position} from "../util/location";
import {NodeUtils} from "./node";

export default abstract class LValParser extends NodeUtils {
  // Forward-declaration: defined in expression.js
  abstract parseIdentifier(liberal?: boolean): Identifier;
  abstract parseMaybeAssign(
    noIn?: boolean | null,
    refShorthandDefaultPos?: Pos | null,
    afterLeftParse?: Function,
    refNeedsArrowPos?: Pos | null,
  ): Expression;
  abstract parseObj<T extends ObjectPattern | ObjectExpression>(
    isPattern: boolean,
    isBlockScope: boolean,
    refShorthandDefaultPos?: Pos | null,
  ): T;
  // Forward-declaration: defined in statement.js
  abstract parseDecorator(): void;

  // Parses spread element.

  parseSpread<T extends RestElement | SpreadElement>(refShorthandDefaultPos: Pos | null): T {
    const node = this.startNode();
    this.next();
    node.argument = this.parseMaybeAssign(false, refShorthandDefaultPos);
    return this.finishNode(node as T, "SpreadElement");
  }

  parseRest(isBlockScope: boolean): RestElement {
    const node = this.startNode();
    this.next();
    node.argument = this.parseBindingAtom(isBlockScope);
    return this.finishNode(node as RestElement, "RestElement");
  }

  parseBindingIdentifier(): Identifier {
    return this.parseIdentifier();
  }

  // Parses lvalue (assignable) atom.
  parseBindingAtom(isBlockScope: boolean): Pattern {
    switch (this.state.type) {
      case tt._yield:
      case tt.name: {
        this.state.type = tt.name;
        const result = this.parseBindingIdentifier();
        this.state.tokens[this.state.tokens.length - 1].identifierRole = isBlockScope
          ? IdentifierRole.BlockScopedDeclaration
          : IdentifierRole.FunctionScopedDeclaration;
        return result;
      }

      case tt.bracketL: {
        const node = this.startNode();
        this.next();
        node.elements = this.parseBindingList(tt.bracketR, isBlockScope, true /* allowEmpty */);
        return this.finishNode(node as ArrayPattern, "ArrayPattern");
      }

      case tt.braceL:
        return this.parseObj<ObjectPattern>(true, isBlockScope);

      default:
        throw this.unexpected();
    }
  }

  parseBindingList(
    close: TokenType,
    isBlockScope: boolean,
    allowEmpty?: boolean,
    allowModifiers: boolean | null = null,
  ): ReadonlyArray<Pattern | TSParameterProperty> {
    const elts: Array<Pattern | TSParameterProperty> = [];
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
        // $FlowFixMe This method returns `ReadonlyArray<?Pattern>` if `allowEmpty` is set.
        // @ts-ignore
        elts.push(null);
      } else if (this.eat(close)) {
        break;
      } else if (this.match(tt.ellipsis)) {
        elts.push(this.parseAssignableListItemTypes(this.parseRest(isBlockScope)));
        this.expect(close);
        break;
      } else {
        if (this.match(tt.at) && this.hasPlugin("decorators2")) {
          this.raise(this.state.start, "Stage 2 decorators cannot be used to decorate parameters");
        }
        while (this.match(tt.at)) {
          this.parseDecorator();
        }
        elts.push(this.parseAssignableListItem(allowModifiers, isBlockScope));
      }
    }
    return elts;
  }

  parseAssignableListItem(
    allowModifiers: boolean | null,
    isBlockScope: boolean,
  ): Pattern | TSParameterProperty {
    const left = this.parseMaybeDefault(isBlockScope);
    this.parseAssignableListItemTypes(left);
    return this.parseMaybeDefault(isBlockScope, left.start, left.loc.start, left);
  }

  parseAssignableListItemTypes(param: Pattern): Pattern {
    return param;
  }

  // Parses assignment pattern around given atom if possible.

  parseMaybeDefault(
    isBlockScope: boolean,
    startPos?: number | null,
    startLoc?: Position | null,
    left?: Pattern | null,
  ): Pattern {
    startLoc = startLoc || this.state.startLoc;
    startPos = startPos || this.state.start;
    left = left || this.parseBindingAtom(isBlockScope);
    if (!this.eat(tt.eq)) return left;

    const node = this.startNodeAt(startPos, startLoc);
    node.left = left;
    node.right = this.parseMaybeAssign();
    return this.finishNode(node as AssignmentPattern, "AssignmentPattern");
  }
}
