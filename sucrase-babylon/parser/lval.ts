import {IdentifierRole} from "../tokenizer";
import {TokenType, types as tt} from "../tokenizer/types";
import {
  ArrayPattern,
  AssignmentPattern,
  Decorator,
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
  abstract parseDecorator(): Decorator;

  // Convert existing expression atom to assignable pattern
  // if possible.

  toAssignable(node: Node, isBinding: boolean | null, contextDescription: string): Node {
    if (node) {
      switch (node.type) {
        case "Identifier":
        case "ObjectPattern":
        case "ArrayPattern":
        case "AssignmentPattern":
          break;

        case "ObjectExpression":
          node.type = "ObjectPattern";
          for (let index = 0; index < node.properties.length; index++) {
            const prop = node.properties[index];
            const isLast = index === node.properties.length - 1;
            this.toAssignableObjectExpressionProp(prop, isBinding, isLast);
          }
          break;

        case "ObjectProperty":
          this.toAssignable(node.value, isBinding, contextDescription);
          break;

        case "SpreadElement": {
          this.checkToRestConversion(node as SpreadElement);

          node.type = "RestElement";
          const arg = node.argument;
          this.toAssignable(arg, isBinding, contextDescription);
          break;
        }

        case "ArrayExpression":
          node.type = "ArrayPattern";
          this.toAssignableList(node.elements, isBinding, contextDescription);
          break;

        case "AssignmentExpression":
          if (node.operator === "=") {
            node.type = "AssignmentPattern";
            delete node.operator;
          } else {
            this.raise(
              node.left.end,
              "Only '=' operator can be used for specifying default value.",
            );
          }
          break;

        case "MemberExpression":
          if (!isBinding) break;

        default: {
          const message = `Invalid left-hand side${
            contextDescription
              ? ` in ${contextDescription}`
              : /* istanbul ignore next */ "expression"
          }`;
          this.raise(node.start, message);
        }
      }
    }
    return node;
  }

  toAssignableObjectExpressionProp(prop: Node, isBinding: boolean | null, isLast: boolean): void {
    if (prop.type === "ObjectMethod") {
      const error =
        prop.kind === "get" || prop.kind === "set"
          ? "Object pattern can't contain getter or setter"
          : "Object pattern can't contain methods";

      this.raise(prop.key.start, error);
    } else if (prop.type === "SpreadElement" && !isLast) {
      this.raise(prop.start, "The rest element has to be the last element when destructuring");
    } else {
      this.toAssignable(prop, isBinding, "object destructuring pattern");
    }
  }

  // Convert list of expression atoms to binding list.

  toAssignableList(
    exprList: Array<Expression>,
    isBinding: boolean | null,
    contextDescription: string,
  ): ReadonlyArray<Pattern> {
    let end = exprList.length;
    if (end) {
      const last = exprList[end - 1];
      if (last && last.type === "RestElement") {
        --end;
      } else if (last && last.type === "SpreadElement") {
        last.type = "RestElement";
        const arg = last.argument;
        this.toAssignable(arg, isBinding, contextDescription);
        if (
          ["Identifier", "MemberExpression", "ArrayPattern", "ObjectPattern"].indexOf(arg.type) ===
          -1
        ) {
          this.unexpected(arg.start);
        }
        --end;
      }
    }
    for (let i = 0; i < end; i++) {
      const elt = exprList[i];
      if (elt && elt.type === "SpreadElement") {
        this.raise(elt.start, "The rest element has to be the last element when destructuring");
      }
      if (elt) this.toAssignable(elt, isBinding, contextDescription);
    }
    // @ts-ignore
    return exprList;
  }

  // Convert list of expression atoms to a list of

  toReferencedList(exprList: ReadonlyArray<Expression | null>): ReadonlyArray<Expression | null> {
    return exprList;
  }

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

  shouldAllowYieldIdentifier(): boolean {
    return this.match(tt._yield) && !this.state.strict && !this.state.inGenerator;
  }

  parseBindingIdentifier(): Identifier {
    return this.parseIdentifier(this.shouldAllowYieldIdentifier());
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
        const decorators = [];
        if (this.match(tt.at) && this.hasPlugin("decorators2")) {
          this.raise(this.state.start, "Stage 2 decorators cannot be used to decorate parameters");
        }
        while (this.match(tt.at)) {
          decorators.push(this.parseDecorator());
        }
        elts.push(this.parseAssignableListItem(allowModifiers, decorators, isBlockScope));
      }
    }
    return elts;
  }

  parseAssignableListItem(
    allowModifiers: boolean | null,
    decorators: Array<Decorator>,
    isBlockScope: boolean,
  ): Pattern | TSParameterProperty {
    const left = this.parseMaybeDefault(isBlockScope);
    this.parseAssignableListItemTypes(left);
    const elt = this.parseMaybeDefault(isBlockScope, left.start, left.loc.start, left);
    if (decorators.length) {
      left.decorators = decorators;
    }
    return elt;
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

  // Verify that a node is an lval — something that can be assigned
  // to.

  checkLVal(
    expr: Expression,
    isBinding: boolean | null,
    checkClashes: {[key: string]: boolean} | null,
    contextDescription: string,
  ): void {
    switch (expr.type) {
      case "Identifier":
        if (checkClashes) {
          // we need to prefix this with an underscore for the cases where we have a key of
          // `__proto__`. there's a bug in old V8 where the following wouldn't work:
          //
          //   > var obj = Object.create(null);
          //   undefined
          //   > obj.__proto__
          //   null
          //   > obj.__proto__ = true;
          //   true
          //   > obj.__proto__
          //   null
          const key = `_${expr.name}`;

          if (checkClashes[key]) {
            this.raise(expr.start, "Argument name clash in strict mode");
          } else {
            checkClashes[key] = true;
          }
        }
        break;

      case "MemberExpression":
        if (isBinding) this.raise(expr.start, "Binding member expression");
        break;

      case "ObjectPattern":
        for (let prop of expr.properties) {
          if (prop.type === "ObjectProperty") prop = prop.value;
          this.checkLVal(prop, isBinding, checkClashes, "object destructuring pattern");
        }
        break;

      case "ArrayPattern":
        for (const elem of expr.elements) {
          if (elem) {
            this.checkLVal(elem, isBinding, checkClashes, "array destructuring pattern");
          }
        }
        break;

      case "AssignmentPattern":
        this.checkLVal(expr.left, isBinding, checkClashes, "assignment pattern");
        break;

      case "RestElement":
        this.checkLVal(expr.argument, isBinding, checkClashes, "rest element");
        break;

      default: {
        const message = `${
          isBinding ? /* istanbul ignore next */ "Binding invalid" : "Invalid"
        } left-hand side${
          contextDescription ? ` in ${contextDescription}` : /* istanbul ignore next */ "expression"
        }`;
        this.raise(expr.start, message);
      }
    }
  }

  checkToRestConversion(node: SpreadElement): void {
    const validArgumentTypes = ["Identifier", "MemberExpression"];

    if (validArgumentTypes.indexOf(node.argument.type) !== -1) {
      return;
    }

    this.raise(node.argument.start, "Invalid rest operator's argument");
  }
}
