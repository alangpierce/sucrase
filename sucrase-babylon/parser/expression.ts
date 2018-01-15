/* eslint max-len: 0 */

// A recursive descent parser operates by defining functions for all
// syntactic elements, and recursively calling those, each function
// advancing the input stream and returning an AST node. Precedence
// of constructs (for example, the fact that `!x[1]` means `!(x[1])`
// instead of `(!x)[1]` is handled by the fact that the parser
// function that parses unary prefix operators is called first, and
// in turn calls the function that parses `[]` subscripts — that
// way, it'll receive the node for `x[1]` already parsed, and wraps
// *that* in the unary operator node.
//
// Acorn uses an [operator precedence parser][opp] to handle binary
// operator precedence, because it is much more compact than using
// the technique outlined above, which uses different, nesting
// functions to specify precedence, for all of the ten binary
// precedence levels that JavaScript defines.
//
// [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

import {IdentifierRole} from "../tokenizer";
import {TokenType, types as tt} from "../tokenizer/types";
import * as N from "../types";
import {reservedWords} from "../util/identifier";
import {Pos, Position} from "../util/location";
import LValParser from "./lval";

export default abstract class ExpressionParser extends LValParser {
  // Forward-declaration: defined in statement.js
  abstract parseBlock(allowDirectives?: boolean, isFunctionScope?: boolean): N.BlockStatement;
  abstract parseClass(node: N.Class, isStatement: boolean, optionalId?: boolean): N.Class;
  abstract parseDecorators(allowExport?: boolean): void;
  abstract parseFunction<T extends N.NormalFunction>(
    node: T,
    isStatement: boolean,
    allowExpressionBody?: boolean,
    isAsync?: boolean,
    optionalId?: boolean,
  ): T;
  abstract parseFunctionParams(node: N.Function, allowModifiers?: boolean): void;
  abstract takeDecorators(node: N.HasDecorators): void;

  // Check if property name clashes with already added.
  // Object/class getters and setters are not allowed to clash —
  // either with each other or with an init property — and in
  // strict mode, init properties are also not allowed to be repeated.

  checkPropClash(prop: N.ObjectMember, propHash: {[key: string]: boolean}): void {
    if (prop.computed || prop.kind) return;

    const key = prop.key;
    // It is either an Identifier or a String/NumericLiteral
    const name = key.type === "Identifier" ? key.name : String(key.value);

    if (name === "__proto__") {
      if (propHash.proto) {
        this.raise(key.start, "Redefinition of __proto__ property");
      }
      propHash.proto = true;
    }
  }

  // Convenience method to parse an Expression only
  getExpression(): N.Expression {
    this.nextToken();
    const expr = this.parseExpression();
    if (!this.match(tt.eof)) {
      this.unexpected();
    }
    return expr;
  }

  // ### Expression parsing

  // These nest, from the most general expression type at the top to
  // 'atomic', nondivisible expression types at the bottom. Most of
  // the functions will simply let the function (s) below them parse,
  // and, *if* the syntactic construct they handle is present, wrap
  // the AST node that the inner parser gave them in another node.

  // Parse a full expression. The optional arguments are used to
  // forbid the `in` operator (in for loops initialization expressions)
  // and provide reference for storing '=' operator inside shorthand
  // property assignment in contexts where both object expression
  // and object pattern might appear (so it's possible to raise
  // delayed syntax error at correct position).

  parseExpression(noIn?: boolean, refShorthandDefaultPos?: Pos): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const expr = this.parseMaybeAssign(noIn, refShorthandDefaultPos);
    if (this.match(tt.comma)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.expressions = [expr];
      while (this.eat(tt.comma)) {
        node.expressions.push(this.parseMaybeAssign(noIn, refShorthandDefaultPos));
      }
      this.toReferencedList(node.expressions);
      return this.finishNode(node, "SequenceExpression");
    }
    return expr;
  }

  // Parse an assignment expression. This includes applications of
  // operators like `+=`.

  parseMaybeAssign(
    noIn: boolean | null = null,
    refShorthandDefaultPos?: Pos | null,
    afterLeftParse?: Function,
    refNeedsArrowPos?: Pos | null,
  ): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    if (this.match(tt._yield) && this.state.inGenerator) {
      let left = this.parseYield();
      if (afterLeftParse) {
        left = afterLeftParse.call(this, left, startPos, startLoc);
      }
      return left;
    }

    let failOnShorthandAssign;
    if (refShorthandDefaultPos) {
      failOnShorthandAssign = false;
    } else {
      refShorthandDefaultPos = {start: 0};
      failOnShorthandAssign = true;
    }

    if (this.match(tt.parenL) || this.match(tt.name) || this.match(tt._yield)) {
      this.state.potentialArrowAt = this.state.start;
    }

    let left = this.parseMaybeConditional(noIn, refShorthandDefaultPos, refNeedsArrowPos);
    if (afterLeftParse) {
      left = afterLeftParse.call(this, left, startPos, startLoc);
    }
    if (this.state.type.isAssign) {
      const node = this.startNodeAt(startPos, startLoc);
      node.operator = this.state.value;
      node.left = this.match(tt.eq) ? this.toAssignable(left, null, "assignment expression") : left;
      refShorthandDefaultPos.start = 0; // reset because shorthand default was used correctly

      this.checkLVal(left, null, null, "assignment expression");

      if (left.extra && left.extra.parenthesized) {
        let errorMsg;
        if (left.type === "ObjectPattern") {
          errorMsg = "`({a}) = 0` use `({a} = 0)`";
        } else if (left.type === "ArrayPattern") {
          errorMsg = "`([a]) = 0` use `([a] = 0)`";
        }
        if (errorMsg) {
          this.raise(
            left.start,
            `You're trying to assign to a parenthesized expression, eg. instead of ${errorMsg}`,
          );
        }
      }

      this.next();
      node.right = this.parseMaybeAssign(noIn);
      return this.finishNode(node, "AssignmentExpression");
    } else if (failOnShorthandAssign && refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }

    return left;
  }

  // Parse a ternary conditional (`?:`) operator.

  parseMaybeConditional(
    noIn: boolean | null,
    refShorthandDefaultPos: Pos,
    refNeedsArrowPos?: Pos | null,
  ): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseExprOps(noIn, refShorthandDefaultPos);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;

    return this.parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos);
  }

  parseConditional(
    expr: N.Expression,
    noIn: boolean | null,
    startPos: number,
    startLoc: Position,
    // FIXME: Disabling this for now since can't seem to get it to play nicely
    // eslint-disable-next-line no-unused-vars
    refNeedsArrowPos?: Pos | null,
  ): N.Expression {
    if (this.eat(tt.question)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.test = expr;
      node.consequent = this.parseMaybeAssign();
      this.expect(tt.colon);
      node.alternate = this.parseMaybeAssign(noIn);
      return this.finishNode(node, "ConditionalExpression");
    }
    return expr;
  }

  // Start the precedence parser.

  parseExprOps(noIn: boolean | null, refShorthandDefaultPos: Pos): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseMaybeUnary(refShorthandDefaultPos);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return expr;
    }

    return this.parseExprOp(expr, startPos, startLoc, -1, noIn);
  }

  // Parse binary operators with the operator precedence parsing
  // algorithm. `left` is the left-hand side of the operator.
  // `minPrec` provides context that allows the function to stop and
  // defer further parser to one of its callers when it encounters an
  // operator that has a lower precedence than the set it is parsing.

  parseExprOp(
    left: N.Expression,
    leftStartPos: number,
    leftStartLoc: Position,
    minPrec: number,
    noIn: boolean | null,
  ): N.Expression {
    const prec = this.state.type.binop;
    if (prec != null && (!noIn || !this.match(tt._in))) {
      if (prec > minPrec) {
        const node = this.startNodeAt(leftStartPos, leftStartLoc);
        node.left = left;
        node.operator = this.state.value;

        if (
          node.operator === "**" &&
          left.type === "UnaryExpression" &&
          left.extra &&
          !left.extra.parenthesizedArgument &&
          !left.extra.parenthesized
        ) {
          this.raise(
            left.argument.start,
            "Illegal expression. Wrap left hand side or entire exponentiation in parentheses.",
          );
        }

        const op = this.state.type;
        this.next();

        const startPos = this.state.start;
        const startLoc = this.state.startLoc;

        if (node.operator === "|>") {
          this.expectPlugin("pipelineOperator");
          // Support syntax such as 10 |> x => x + 1
          this.state.potentialArrowAt = startPos;
        }

        if (node.operator === "??") {
          this.expectPlugin("nullishCoalescingOperator");
        }

        node.right = this.parseExprOp(
          this.parseMaybeUnary(),
          startPos,
          startLoc,
          op.rightAssociative ? prec - 1 : prec,
          noIn,
        );

        this.finishNode(
          node,
          op === tt.logicalOR || op === tt.logicalAND || op === tt.nullishCoalescing
            ? "LogicalExpression"
            : "BinaryExpression",
        );
        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
      }
    }
    return left;
  }

  // Parse unary operators, both prefix and postfix.

  parseMaybeUnary(refShorthandDefaultPos: Pos | null = null): N.Expression {
    if (this.state.type.prefix) {
      const node = this.startNode();
      const update = this.match(tt.incDec);
      node.operator = this.state.value;
      node.prefix = true;

      if (node.operator === "throw") {
        this.expectPlugin("throwExpressions");
      }
      this.next();

      const argType = this.state.type;
      node.argument = this.parseMaybeUnary();

      this.addExtra(
        node,
        "parenthesizedArgument",
        argType === tt.parenL && (!node.argument.extra || !node.argument.extra.parenthesized),
      );

      if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
        this.unexpected(refShorthandDefaultPos.start);
      }

      if (update) {
        this.checkLVal(node.argument, null, null, "prefix operation");
      } else if (this.state.strict && node.operator === "delete") {
        const arg = node.argument;

        if (arg.type === "Identifier") {
          this.raise(node.start, "Deleting local variable in strict mode");
        } else if (arg.type === "MemberExpression" && arg.property.type === "PrivateName") {
          this.raise(node.start, "Deleting a private field is not allowed");
        }
      }

      return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
    }

    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let expr = this.parseExprSubscripts(refShorthandDefaultPos);
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
    while (this.state.type.postfix && !this.canInsertSemicolon()) {
      const node = this.startNodeAt(startPos, startLoc);
      node.operator = this.state.value;
      node.prefix = false;
      node.argument = expr;
      this.checkLVal(expr, null, null, "postfix operation");
      this.next();
      expr = this.finishNode(node, "UpdateExpression");
    }
    return expr;
  }

  // Parse call, dot, and `[]`-subscript expressions.

  parseExprSubscripts(refShorthandDefaultPos: Pos | null = null): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseExprAtom(refShorthandDefaultPos);

    if (expr.type === "ArrowFunctionExpression" && expr.start === potentialArrowAt) {
      return expr;
    }

    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return expr;
    }

    return this.parseSubscripts(expr, startPos, startLoc);
  }

  parseSubscripts(
    base: N.Expression,
    startPos: number,
    startLoc: Position,
    noCalls: boolean | null = null,
  ): N.Expression {
    const state = {stop: false};
    do {
      base = this.parseSubscript(base, startPos, startLoc, noCalls, state);
    } while (!state.stop);
    return base;
  }

  /** Set 'state.stop = true' to indicate that we should stop parsing subscripts. */
  parseSubscript(
    base: N.Expression,
    startPos: number,
    startLoc: Position,
    noCalls: boolean | null,
    state: {stop: boolean},
  ): N.Expression {
    if (!noCalls && this.eat(tt.doubleColon)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.callee = this.parseNoCallExpr();
      state.stop = true;
      return this.parseSubscripts(
        this.finishNode(node, "BindExpression"),
        startPos,
        startLoc,
        noCalls,
      );
    } else if (this.match(tt.questionDot)) {
      this.expectPlugin("optionalChaining");

      if (noCalls && this.lookahead().type === tt.parenL) {
        state.stop = true;
        return base;
      }
      this.next();

      const node = this.startNodeAt(startPos, startLoc);

      if (this.eat(tt.bracketL)) {
        node.object = base;
        node.property = this.parseExpression();
        node.computed = true;
        node.optional = true;
        this.expect(tt.bracketR);
        return this.finishNode(node, "MemberExpression");
      } else if (this.eat(tt.parenL)) {
        const possibleAsync = this.atPossibleAsync(base);

        node.callee = base;
        node.arguments = this.parseCallExpressionArguments(tt.parenR, possibleAsync);
        node.optional = true;

        return this.finishNode(node, "CallExpression");
      } else {
        node.object = base;
        node.property = this.parseIdentifier(true);
        node.computed = false;
        node.optional = true;
        return this.finishNode(node, "MemberExpression");
      }
    } else if (this.eat(tt.dot)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.property = this.parseMaybePrivateName();
      node.computed = false;
      return this.finishNode(node, "MemberExpression");
    } else if (this.eat(tt.bracketL)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.property = this.parseExpression();
      node.computed = true;
      this.expect(tt.bracketR);
      return this.finishNode(node, "MemberExpression");
    } else if (!noCalls && this.match(tt.parenL)) {
      const possibleAsync = this.atPossibleAsync(base);
      const startTokenIndex = this.state.tokens.length;
      this.next();

      const node = this.startNodeAt<N.CallExpression>(startPos, startLoc);
      node.callee = base;

      // TODO: Clean up/merge this into `this.state` or a class like acorn's
      // `DestructuringErrors` alongside refShorthandDefaultPos and
      // refNeedsArrowPos.
      const refTrailingCommaPos: Pos = {start: -1};

      node.arguments = this.parseCallExpressionArguments(
        tt.parenR,
        possibleAsync,
        refTrailingCommaPos,
      ) as Array<N.Node>;
      this.finishCallExpression(node);

      if (possibleAsync && this.shouldParseAsyncArrow()) {
        state.stop = true;

        if (refTrailingCommaPos.start > -1) {
          this.raise(
            refTrailingCommaPos.start,
            "A trailing comma is not permitted after the rest element",
          );
        }

        return this.parseAsyncArrowFromCallExpression(
          this.startNodeAt(startPos, startLoc),
          node,
          startTokenIndex,
        );
      } else {
        this.toReferencedList(node.arguments);
      }
      return node;
    } else if (this.match(tt.backQuote)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.tag = base;
      node.quasi = this.parseTemplate(true);
      return this.finishNode(node, "TaggedTemplateExpression");
    } else {
      state.stop = true;
      return base;
    }
  }

  atPossibleAsync(base: N.Expression): boolean {
    return (
      this.state.potentialArrowAt === base.start &&
      base.type === "Identifier" &&
      base.name === "async" &&
      !this.canInsertSemicolon()
    );
  }

  finishCallExpression(node: N.CallExpression): N.CallExpression {
    if (node.callee.type === "Import") {
      if (node.arguments.length !== 1) {
        this.raise(node.start, "import() requires exactly one argument");
      }

      const importArg = node.arguments[0];
      if (importArg && importArg.type === "SpreadElement") {
        this.raise(importArg.start, "... is not allowed in import()");
      }
    }
    return this.finishNode(node, "CallExpression");
  }

  parseCallExpressionArguments(
    close: TokenType,
    possibleAsyncArrow: boolean,
    refTrailingCommaPos?: Pos,
  ): Array<N.Expression | null> {
    const elts = [];
    let innerParenStart;
    let first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(close)) break;
      }

      // we need to make sure that if this is an async arrow functions, that we don't allow inner parens inside the params
      if (this.match(tt.parenL) && !innerParenStart) {
        innerParenStart = this.state.start;
      }

      elts.push(
        this.parseExprListItem(
          false,
          possibleAsyncArrow ? {start: 0} : null,
          possibleAsyncArrow ? {start: 0} : null,
          possibleAsyncArrow ? refTrailingCommaPos : null,
        ),
      );
    }

    // we found an async arrow function so let's not allow any inner parens
    if (possibleAsyncArrow && innerParenStart && this.shouldParseAsyncArrow()) {
      this.unexpected();
    }

    return elts;
  }

  shouldParseAsyncArrow(): boolean {
    return this.match(tt.arrow);
  }

  parseAsyncArrowFromCallExpression(
    node: N.ArrowFunctionExpression,
    call: N.CallExpression,
    startTokenIndex: number,
  ): N.ArrowFunctionExpression {
    const oldYield = this.state.yieldInPossibleArrowParameters;
    this.state.yieldInPossibleArrowParameters = null;
    this.expect(tt.arrow);
    this.parseArrowExpression(node, startTokenIndex, call.arguments, true);
    this.state.yieldInPossibleArrowParameters = oldYield;
    return node;
  }

  // Parse a no-call expression (like argument of `new` or `::` operators).

  parseNoCallExpr(): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    return this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
  }

  // Parse an atomic expression — either a single token that is an
  // expression, an expression started by a keyword like `function` or
  // `new`, or an expression wrapped in punctuation like `()`, `[]`,
  // or `{}`.

  parseExprAtom(refShorthandDefaultPos?: Pos | null): N.Expression {
    const canBeArrow = this.state.potentialArrowAt === this.state.start;
    let node: N.Expression;

    switch (this.state.type) {
      case tt._super:
        if (
          !this.state.inMethod &&
          !this.state.inClassProperty &&
          !this.options.allowSuperOutsideMethod
        ) {
          this.raise(this.state.start, "super is only allowed in object methods and classes");
        }

        node = this.startNode();
        this.next();
        if (!this.match(tt.parenL) && !this.match(tt.bracketL) && !this.match(tt.dot)) {
          this.unexpected();
        }
        if (
          this.match(tt.parenL) &&
          this.state.inMethod !== "constructor" &&
          !this.options.allowSuperOutsideMethod
        ) {
          this.raise(
            node.start,
            "super() is only valid inside a class constructor. Make sure the method name is spelled exactly as 'constructor'.",
          );
        }
        return this.finishNode(node, "Super");

      case tt._import:
        if (this.lookahead().type === tt.dot) {
          return this.parseImportMetaProperty();
        }

        this.expectPlugin("dynamicImport");

        node = this.startNode();
        this.next();
        if (!this.match(tt.parenL)) {
          this.unexpected(null, tt.parenL);
        }
        return this.finishNode(node, "Import");

      case tt._this:
        node = this.startNode();
        this.next();
        return this.finishNode(node, "ThisExpression");

      case tt._yield:
        if (this.state.inGenerator) this.unexpected();

      case tt.name: {
        const startTokenIndex = this.state.tokens.length;
        node = this.startNode();
        const allowAwait = this.state.value === "await" && this.state.inAsync;
        const allowYield = this.shouldAllowYieldIdentifier();
        const id = this.parseIdentifier(allowAwait || allowYield);

        if (id.name === "await") {
          if (this.state.inAsync || this.inModule) {
            return this.parseAwait(node as N.AwaitExpression);
          }
        } else if (id.name === "async" && this.match(tt._function) && !this.canInsertSemicolon()) {
          this.next();
          return this.parseFunction(node as N.NormalFunction, false, false, true);
        } else if (canBeArrow && id.name === "async" && this.match(tt.name)) {
          const oldYield = this.state.yieldInPossibleArrowParameters;
          this.state.yieldInPossibleArrowParameters = null;
          const params = [this.parseIdentifier()];
          this.expect(tt.arrow);
          // let foo = bar => {};
          this.parseArrowExpression(
            node as N.ArrowFunctionExpression,
            startTokenIndex,
            params,
            true,
          );
          this.state.yieldInPossibleArrowParameters = oldYield;
          return node;
        }

        if (canBeArrow && !this.canInsertSemicolon() && this.eat(tt.arrow)) {
          const oldYield = this.state.yieldInPossibleArrowParameters;
          this.state.yieldInPossibleArrowParameters = null;
          this.parseArrowExpression(node as N.ArrowFunctionExpression, startTokenIndex, [id]);
          this.state.yieldInPossibleArrowParameters = oldYield;
          return node;
        }

        this.state.tokens[this.state.tokens.length - 1].identifierRole = IdentifierRole.Access;
        return id;
      }

      case tt._do: {
        this.expectPlugin("doExpressions");
        const innerNode = this.startNode();
        this.next();
        const oldInFunction = this.state.inFunction;
        const oldLabels = this.state.labels;
        this.state.labels = [];
        this.state.inFunction = false;
        innerNode.body = this.parseBlock(false);
        this.state.inFunction = oldInFunction;
        this.state.labels = oldLabels;
        return this.finishNode(innerNode, "DoExpression");
      }

      case tt.regexp: {
        const value = this.state.value;
        node = this.parseLiteral(value.value, "RegExpLiteral");
        node.pattern = value.pattern;
        node.flags = value.flags;
        return node;
      }

      case tt.num:
        return this.parseLiteral(this.state.value, "NumericLiteral");

      case tt.bigint:
        return this.parseLiteral(this.state.value, "BigIntLiteral");

      case tt.string:
        return this.parseLiteral(this.state.value, "StringLiteral");

      case tt._null:
        node = this.startNode();
        this.next();
        return this.finishNode(node, "NullLiteral");

      case tt._true:
      case tt._false:
        return this.parseBooleanLiteral();

      case tt.parenL:
        return this.parseParenAndDistinguishExpression(canBeArrow);

      case tt.bracketL:
        node = this.startNode();
        this.next();
        node.elements = this.parseExprList(tt.bracketR, true, refShorthandDefaultPos);
        this.toReferencedList(node.elements);
        return this.finishNode(node, "ArrayExpression");

      case tt.braceL:
        return this.parseObj(false, false, refShorthandDefaultPos);

      case tt._function:
        return this.parseFunctionExpression();

      case tt.at:
        this.parseDecorators();

      case tt._class:
        node = this.startNode();
        this.takeDecorators(node);
        return this.parseClass(node as N.Class, false);

      case tt._new:
        return this.parseNew();

      case tt.backQuote:
        return this.parseTemplate(false);

      case tt.doubleColon: {
        node = this.startNode();
        this.next();
        node.object = null;
        const callee = this.parseNoCallExpr();
        node.callee = callee;
        if (callee.type === "MemberExpression") {
          return this.finishNode(node, "BindExpression");
        } else {
          throw this.raise(callee.start, "Binding should be performed on object property.");
        }
      }

      default:
        throw this.unexpected();
    }
  }

  parseBooleanLiteral(): N.BooleanLiteral {
    const node = this.startNode();
    node.value = this.match(tt._true);
    this.next();
    return this.finishNode(node as N.BooleanLiteral, "BooleanLiteral");
  }

  parseMaybePrivateName(): N.PrivateName | N.Identifier {
    const isPrivate = this.match(tt.hash);

    if (isPrivate) {
      this.expectOnePlugin(["classPrivateProperties", "classPrivateMethods"]);
      const node = this.startNode();
      this.next();
      node.id = this.parseIdentifier(true);
      return this.finishNode(node as N.PrivateName, "PrivateName");
    } else {
      return this.parseIdentifier(true);
    }
  }

  parseFunctionExpression(): N.FunctionExpression | N.MetaProperty {
    const node = this.startNode();
    const meta = this.parseIdentifier(true);
    if (this.state.inGenerator && this.eat(tt.dot)) {
      return this.parseMetaProperty(node as N.MetaProperty, meta, "sent");
    }
    return this.parseFunction(node as N.FunctionExpression, false);
  }

  parseMetaProperty(
    node: N.MetaProperty,
    meta: N.Identifier,
    propertyName: string,
  ): N.MetaProperty {
    node.meta = meta;

    if (meta.name === "function" && propertyName === "sent") {
      if (this.isContextual(propertyName)) {
        this.expectPlugin("functionSent");
      } else if (!this.hasPlugin("functionSent")) {
        // They didn't actually say `function.sent`, just `function.`, so a simple error would be less confusing.
        this.unexpected();
      }
    }

    node.property = this.parseIdentifier(true);

    if (node.property.name !== propertyName) {
      this.raise(
        node.property.start,
        `The only valid meta property for ${meta.name} is ${meta.name}.${propertyName}`,
      );
    }

    return this.finishNode(node, "MetaProperty");
  }

  parseImportMetaProperty(): N.MetaProperty {
    const node = this.startNode();
    const id = this.parseIdentifier(true);
    this.expect(tt.dot);

    if (id.name === "import") {
      if (this.isContextual("meta")) {
        this.expectPlugin("importMeta");
      } else if (!this.hasPlugin("importMeta")) {
        this.raise(id.start, `Dynamic imports require a parameter: import('a.js').then`);
      }
    }

    if (!this.inModule) {
      this.raise(id.start, `import.meta may appear only with 'sourceType: "module"'`);
    }
    return this.parseMetaProperty(node as N.MetaProperty, id, "meta");
  }

  parseLiteral<T extends N.Literal>(
    value: {},
    type: /* T["kind"] */ string,
    startPos?: number,
    startLoc?: Position,
  ): T {
    startPos = startPos || this.state.start;
    startLoc = startLoc || this.state.startLoc;

    const node = this.startNodeAt(startPos, startLoc);
    this.addExtra(node, "rawValue", value);
    this.addExtra(node, "raw", this.input.slice(startPos, this.state.end));
    node.value = value;
    this.next();
    return this.finishNode(node as T, type);
  }

  parseParenExpression(): N.Expression {
    this.expect(tt.parenL);
    const val = this.parseExpression();
    this.expect(tt.parenR);
    return val;
  }

  parseParenAndDistinguishExpression(canBeArrow: boolean): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;

    let val: N.Expression;
    const startTokenIndex = this.state.tokens.length;
    this.expect(tt.parenL);

    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    const oldYield = this.state.yieldInPossibleArrowParameters;
    this.state.maybeInArrowParameters = true;
    this.state.yieldInPossibleArrowParameters = null;

    const innerStartPos = this.state.start;
    const innerStartLoc = this.state.startLoc;
    const exprList = [];
    const refShorthandDefaultPos = {start: 0};
    const refNeedsArrowPos = {start: 0};
    let first = true;
    let spreadStart;
    let optionalCommaStart;

    while (!this.match(tt.parenR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma, refNeedsArrowPos.start || null);
        if (this.match(tt.parenR)) {
          optionalCommaStart = this.state.start;
          break;
        }
      }

      if (this.match(tt.ellipsis)) {
        const spreadNodeStartPos = this.state.start;
        const spreadNodeStartLoc = this.state.startLoc;
        spreadStart = this.state.start;
        exprList.push(
          this.parseParenItem(
            this.parseRest(false /* isBlockScope */),
            spreadNodeStartPos,
            spreadNodeStartLoc,
          ),
        );

        if (this.match(tt.comma) && this.lookahead().type === tt.parenR) {
          this.raise(this.state.start, "A trailing comma is not permitted after the rest element");
        }

        break;
      } else {
        exprList.push(
          this.parseMaybeAssign(
            false,
            refShorthandDefaultPos,
            this.parseParenItem,
            refNeedsArrowPos,
          ),
        );
      }
    }

    const innerEndPos = this.state.start;
    const innerEndLoc = this.state.startLoc;
    this.expect(tt.parenR);

    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;

    const arrowNode = this.startNodeAt<N.ArrowFunctionExpression>(startPos, startLoc);
    if (canBeArrow && this.shouldParseArrow()) {
      const parsedArrowNode = this.parseArrow(arrowNode);
      if (parsedArrowNode) {
        for (const param of exprList) {
          if (param.extra && param.extra.parenthesized) {
            this.unexpected(param.extra.parenStart);
          }
        }

        this.parseArrowExpression(parsedArrowNode, startTokenIndex, exprList);
        this.state.yieldInPossibleArrowParameters = oldYield;
        return parsedArrowNode;
      }
    }

    this.state.yieldInPossibleArrowParameters = oldYield;

    if (!exprList.length) {
      this.unexpected(this.state.lastTokStart);
    }
    if (optionalCommaStart) this.unexpected(optionalCommaStart);
    if (spreadStart) this.unexpected(spreadStart);
    if (refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }
    if (refNeedsArrowPos.start) this.unexpected(refNeedsArrowPos.start);

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.toReferencedList(val.expressions);
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }

    this.addExtra(val, "parenthesized", true);
    this.addExtra(val, "parenStart", startPos);

    return val;
  }

  shouldParseArrow(): boolean {
    return !this.canInsertSemicolon();
  }

  parseArrow(node: N.ArrowFunctionExpression): N.ArrowFunctionExpression | null {
    if (this.eat(tt.arrow)) {
      return node;
    }
    return null;
  }

  parseParenItem(
    node: N.Expression,
    startPos: number,
    // eslint-disable-next-line no-unused-vars
    startLoc: Position,
  ): N.Expression {
    return node;
  }

  // New's precedence is slightly tricky. It must allow its argument to
  // be a `[]` or dot subscript expression, but not a call — at least,
  // not without wrapping it in parentheses. Thus, it uses the noCalls
  // argument to parseSubscripts to prevent it from consuming the
  // argument list.

  parseNew(): N.NewExpression | N.MetaProperty {
    const node = this.startNode();
    const meta = this.parseIdentifier(true);

    if (this.eat(tt.dot)) {
      const metaProp = this.parseMetaProperty(node as N.MetaProperty, meta, "target");

      if (!this.state.inFunction && !this.state.inClassProperty) {
        let error = "new.target can only be used in functions";

        if (this.hasPlugin("classProperties")) {
          error += " or class properties";
        }

        this.raise(metaProp.start, error);
      }

      return metaProp;
    }

    node.callee = this.parseNoCallExpr();
    if (this.eat(tt.questionDot)) node.optional = true;
    this.parseNewArguments(node as N.NewExpression);
    return this.finishNode(node as N.NewExpression, "NewExpression");
  }

  parseNewArguments(node: N.NewExpression): void {
    if (this.eat(tt.parenL)) {
      const args = this.parseExprList(tt.parenR);
      this.toReferencedList(args);
      // $FlowFixMe (parseExprList should be all non-null in this case)
      node.arguments = args as Array<N.Node>;
    } else {
      node.arguments = [];
    }
  }

  // Parse template expression.

  parseTemplateElement(isTagged: boolean): N.TemplateElement {
    const elem = this.startNode();
    if (this.state.value === null) {
      if (!isTagged) {
        // TODO: fix this
        this.raise(
          this.state.invalidTemplateEscapePosition || 0,
          "Invalid escape sequence in template",
        );
      } else {
        this.state.invalidTemplateEscapePosition = null;
      }
    }
    elem.value = {
      raw: this.input.slice(this.state.start, this.state.end).replace(/\r\n?/g, "\n"),
      cooked: this.state.value,
    };
    this.next();
    elem.tail = this.match(tt.backQuote);
    return this.finishNode(elem as N.TemplateElement, "TemplateElement");
  }

  parseTemplate(isTagged: boolean): N.TemplateLiteral {
    const node = this.startNode();
    this.next();
    node.expressions = [];
    let curElt = this.parseTemplateElement(isTagged);
    node.quasis = [curElt];
    while (!curElt.tail) {
      this.expect(tt.dollarBraceL);
      node.expressions.push(this.parseExpression());
      this.expect(tt.braceR);
      node.quasis.push((curElt = this.parseTemplateElement(isTagged)));
    }
    this.next();
    return this.finishNode(node as N.TemplateLiteral, "TemplateLiteral");
  }

  // Parse an object literal or binding pattern.

  parseObj<T extends N.ObjectPattern | N.ObjectExpression>(
    isPattern: boolean,
    isBlockScope: boolean,
    refShorthandDefaultPos: Pos | null = null,
  ): T {
    let decorators = [];
    const propHash: {} = Object.create(null);
    let first = true;
    const node = this.startNode();

    node.properties = [];
    this.next();

    let firstRestLocation = null;

    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(tt.braceR)) break;
      }

      if (this.match(tt.at)) {
        if (this.hasPlugin("decorators2")) {
          this.raise(
            this.state.start,
            "Stage 2 decorators disallow object literal property decorators",
          );
        } else {
          // we needn't check if decorators (stage 0) plugin is enabled since it's checked by
          // the call to this.parseDecorator
          while (this.match(tt.at)) {
            decorators.push(this.parseDecorator());
          }
        }
      }

      let prop = this.startNode();
      let isGenerator = false;
      let isAsync = false;
      let startPos = null;
      let startLoc = null;
      if (decorators.length) {
        prop.decorators = decorators;
        decorators = [];
      }

      if (this.match(tt.ellipsis)) {
        this.expectPlugin("objectRestSpread");
        prop = this.parseSpread(isPattern ? {start: 0} : null);
        if (isPattern) {
          this.toAssignable(prop, true, "object pattern");
        }
        node.properties.push(prop);
        if (isPattern) {
          const position = this.state.start;
          if (firstRestLocation !== null) {
            this.unexpected(
              firstRestLocation,
              "Cannot have multiple rest elements when destructuring",
            );
          } else if (this.eat(tt.braceR)) {
            break;
          } else if (this.match(tt.comma) && this.lookahead().type === tt.braceR) {
            this.unexpected(position, "A trailing comma is not permitted after the rest element");
          } else {
            firstRestLocation = position;
            continue;
          }
        } else {
          continue;
        }
      }

      prop.method = false;

      if (isPattern || refShorthandDefaultPos) {
        startPos = this.state.start;
        startLoc = this.state.startLoc;
      }

      if (!isPattern) {
        isGenerator = this.eat(tt.star);
      }

      if (!isPattern && this.isContextual("async")) {
        if (isGenerator) this.unexpected();

        const asyncId = this.parseIdentifier();
        if (
          this.match(tt.colon) ||
          this.match(tt.parenL) ||
          this.match(tt.braceR) ||
          this.match(tt.eq) ||
          this.match(tt.comma)
        ) {
          prop.key = asyncId;
          prop.computed = false;
        } else {
          isAsync = true;
          if (this.match(tt.star)) {
            this.expectPlugin("asyncGenerators");
            this.next();
            isGenerator = true;
          }
          this.parsePropertyName(prop as N.ObjectOrClassMember);
        }
      } else {
        this.parsePropertyName(prop as N.ObjectOrClassMember);
      }

      this.parseObjPropValue(
        prop,
        startPos,
        startLoc,
        isGenerator,
        isAsync,
        isPattern,
        isBlockScope,
        refShorthandDefaultPos,
      );
      this.checkPropClash(prop as N.ObjectMember, propHash);

      if (prop.shorthand) {
        this.addExtra(prop, "shorthand", true);
      }

      node.properties.push(prop);
    }

    if (firstRestLocation !== null) {
      this.unexpected(
        firstRestLocation,
        "The rest element has to be the last element when destructuring",
      );
    }

    if (decorators.length) {
      this.raise(this.state.start, "You have trailing decorators with no property");
    }

    return this.finishNode(node as T, isPattern ? "ObjectPattern" : "ObjectExpression");
  }

  isGetterOrSetterMethod(prop: N.ObjectMethod, isPattern: boolean): boolean {
    return (
      !isPattern &&
      !prop.computed &&
      prop.key.type === "Identifier" &&
      (prop.key.name === "get" || prop.key.name === "set") &&
      (this.match(tt.string) || // get "string"() {}
      this.match(tt.num) || // get 1() {}
      this.match(tt.bracketL) || // get ["string"]() {}
      this.match(tt.name) || // get foo() {}
        !!this.state.type.keyword) // get debugger() {}
    );
  }

  // get methods aren't allowed to have any parameters
  // set methods must have exactly 1 parameter
  checkGetterSetterParamCount(method: N.ObjectMethod | N.ClassMethod): void {
    const paramCount = method.kind === "get" ? 0 : 1;
    if (method.params.length !== paramCount) {
      const start = method.start;
      if (method.kind === "get") {
        this.raise(start, "getter should have no params");
      } else {
        this.raise(start, "setter should have exactly one param");
      }
    }
  }

  parseObjectMethod(
    prop: N.ObjectMethod,
    isGenerator: boolean,
    isAsync: boolean,
    isPattern: boolean,
  ): N.ObjectMethod | null {
    if (isAsync || isGenerator || this.match(tt.parenL)) {
      if (isPattern) this.unexpected();
      prop.kind = "method";
      prop.method = true;
      return this.parseMethod(
        prop,
        isGenerator,
        isAsync,
        /* isConstructor */ false,
        "ObjectMethod",
      );
    }

    if (this.isGetterOrSetterMethod(prop, isPattern)) {
      if (isGenerator || isAsync) this.unexpected();
      prop.kind = prop.key.name;
      this.parsePropertyName(prop);
      this.parseMethod(
        prop,
        /* isGenerator */ false,
        /* isAsync */ false,
        /* isConstructor */ false,
        "ObjectMethod",
      );
      this.checkGetterSetterParamCount(prop);
      return prop;
    }

    return null;
  }

  parseObjectProperty(
    prop: N.ObjectProperty,
    startPos: number | null,
    startLoc: Position | null,
    isPattern: boolean,
    isBlockScope: boolean,
    refShorthandDefaultPos: Pos | null,
  ): N.ObjectProperty | null {
    prop.shorthand = false;

    if (this.eat(tt.colon)) {
      prop.value = isPattern
        ? this.parseMaybeDefault(isBlockScope, this.state.start, this.state.startLoc)
        : this.parseMaybeAssign(false, refShorthandDefaultPos);

      return this.finishNode(prop, "ObjectProperty");
    }

    if (!prop.computed && prop.key.type === "Identifier") {
      this.checkReservedWord(prop.key.name, prop.key.start, true, true);

      if (isPattern) {
        prop.value = this.parseMaybeDefault(isBlockScope, startPos, startLoc, prop.key.__clone());
      } else if (this.match(tt.eq) && refShorthandDefaultPos) {
        if (!refShorthandDefaultPos.start) {
          refShorthandDefaultPos.start = this.state.start;
        }
        prop.value = this.parseMaybeDefault(isBlockScope, startPos, startLoc, prop.key.__clone());
      } else {
        prop.value = prop.key.__clone();
      }
      this.state.tokens[this.state.tokens.length - 1].identifierRole =
        IdentifierRole.ObjectShorthand;
      prop.shorthand = true;

      return this.finishNode(prop, "ObjectProperty");
    }

    return null;
  }

  parseObjPropValue(
    prop: N.Node,
    startPos: number | null,
    startLoc: Position | null,
    isGenerator: boolean,
    isAsync: boolean,
    isPattern: boolean,
    isBlockScope: boolean,
    refShorthandDefaultPos: Pos | null,
  ): void {
    const node =
      this.parseObjectMethod(prop as N.ObjectMethod, isGenerator, isAsync, isPattern) ||
      this.parseObjectProperty(
        prop as N.ObjectProperty,
        startPos,
        startLoc,
        isPattern,
        isBlockScope,
        refShorthandDefaultPos,
      );

    if (!node) this.unexpected();
  }

  parsePropertyName(
    prop: N.ObjectOrClassMember | N.ClassMember | N.TsNamedTypeElementBase,
  ): N.Expression | N.Identifier {
    if (this.eat(tt.bracketL)) {
      (prop as N.ObjectOrClassMember).computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(tt.bracketR);
    } else {
      const oldInPropertyName = this.state.inPropertyName;
      this.state.inPropertyName = true;
      // We check if it's valid for it to be a private name when we push it.
      (prop as N.ObjectOrClassMember).key =
        this.match(tt.num) || this.match(tt.string)
          ? this.parseExprAtom()
          : this.parseMaybePrivateName();

      this.state.tokens[this.state.tokens.length - 1].identifierRole = IdentifierRole.ObjectKey;
      if (prop.key.type !== "PrivateName") {
        // ClassPrivateProperty is never computed, so we don't assign in that case.
        prop.computed = false;
      }

      this.state.inPropertyName = oldInPropertyName;
    }

    return prop.key;
  }

  // Initialize empty function node.

  initFunction(node: N.BodilessFunctionOrMethodBase, isAsync: boolean): void {
    node.id = null;
    node.generator = false;
    node.async = isAsync;
  }

  // Parse object or class method.

  parseMethod<T extends N.MethodLike>(
    node: T,
    isGenerator: boolean,
    isAsync: boolean,
    isConstructor: boolean,
    type: string,
  ): T {
    const oldInFunc = this.state.inFunction;
    const oldInMethod = this.state.inMethod;
    const oldInGenerator = this.state.inGenerator;
    this.state.inFunction = true;
    this.state.inMethod = node.kind || true;
    this.state.inGenerator = isGenerator;

    const startTokenIndex = this.state.tokens.length;
    this.initFunction(node, isAsync);
    node.generator = !!isGenerator;
    const allowModifiers = isConstructor; // For TypeScript parameter properties
    this.parseFunctionParams(node as N.Function, allowModifiers);
    this.parseFunctionBodyAndFinish(node, type);
    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: true});

    this.state.inFunction = oldInFunc;
    this.state.inMethod = oldInMethod;
    this.state.inGenerator = oldInGenerator;

    return node;
  }

  // Parse arrow function expression.
  // If the parameters are provided, they will be converted to an
  // assignable list.
  parseArrowExpression(
    node: N.ArrowFunctionExpression,
    startTokenIndex: number,
    params?: Array<N.Expression> | null,
    isAsync: boolean = false,
  ): N.ArrowFunctionExpression {
    // if we got there, it's no more "yield in possible arrow parameters";
    // it's just "yield in arrow parameters"
    if (this.state.yieldInPossibleArrowParameters) {
      this.raise(
        this.state.yieldInPossibleArrowParameters.start,
        "yield is not allowed in the parameters of an arrow function inside a generator",
      );
    }

    const oldInFunc = this.state.inFunction;
    this.state.inFunction = true;
    this.initFunction(node, isAsync);
    if (params) this.setArrowFunctionParameters(node, params);

    const oldInGenerator = this.state.inGenerator;
    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    this.state.inGenerator = false;
    this.state.maybeInArrowParameters = false;
    this.parseFunctionBody(node, true);
    this.state.inGenerator = oldInGenerator;
    this.state.inFunction = oldInFunc;
    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;

    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: true});

    return this.finishNode(node, "ArrowFunctionExpression");
  }

  setArrowFunctionParameters(node: N.ArrowFunctionExpression, params: Array<N.Expression>): void {
    node.params = this.toAssignableList(params, true, "arrow function parameters");
  }

  isStrictBody(node: {body: N.BlockStatement}): boolean {
    const isBlockStatement = node.body.type === "BlockStatement";

    if (isBlockStatement && node.body.directives.length) {
      for (const directive of node.body.directives) {
        if (directive.value.value === "use strict") {
          return true;
        }
      }
    }

    return false;
  }

  parseFunctionBodyAndFinish(
    node: N.BodilessFunctionOrMethodBase,
    type: string,
    allowExpressionBody: boolean | null = null,
  ): void {
    // $FlowIgnore (node is not bodiless if we get here)
    this.parseFunctionBody(node as N.Function, allowExpressionBody);
    this.finishNode(node, type);
  }

  // Parse function body and check parameters.
  parseFunctionBody(node: N.Function, allowExpression: boolean | null): void {
    const isExpression = allowExpression && !this.match(tt.braceL);

    const oldInParameters = this.state.inParameters;
    const oldInAsync = this.state.inAsync;
    this.state.inParameters = false;
    this.state.inAsync = node.async;

    if (isExpression) {
      // @ts-ignore
      node.body = this.parseMaybeAssign();
    } else {
      // Start a new scope with regard to labels and the `inGenerator`
      // flag (restore them to their old value afterwards).
      const oldInGen = this.state.inGenerator;
      const oldInFunc = this.state.inFunction;
      const oldLabels = this.state.labels;
      this.state.inGenerator = node.generator;
      this.state.inFunction = true;
      this.state.labels = [];
      node.body = this.parseBlock(true /* allowDirectives */, true /* isFunctionScope */);
      this.state.inFunction = oldInFunc;
      this.state.inGenerator = oldInGen;
      this.state.labels = oldLabels;
    }
    this.state.inAsync = oldInAsync;

    this.checkFunctionNameAndParams(node, allowExpression);
    this.state.inParameters = oldInParameters;
  }

  checkFunctionNameAndParams(node: N.Function, isArrowFunction: boolean | null): void {
    // If this is a strict mode function, verify that argument names
    // are not repeated, and it does not try to bind the words `eval`
    // or `arguments`.
    const isStrict = this.isStrictBody(node);
    // Also check for arrow functions
    const checkLVal = this.state.strict || isStrict || isArrowFunction;

    const oldStrict = this.state.strict;
    if (isStrict) this.state.strict = isStrict;
    if (node.id) {
      this.checkReservedWord(node.id.name, node.start, true, true);
    }
    if (checkLVal) {
      const nameHash: {} = Object.create(null);
      if (node.id) {
        this.checkLVal(node.id, true, null, "function name");
      }
      for (const param of node.params) {
        if (isStrict && param.type !== "Identifier") {
          this.raise(param.start, "Non-simple parameter in strict mode");
        }
        this.checkLVal(param, true, nameHash, "function parameter list");
      }
    }
    this.state.strict = oldStrict;
  }

  // Parses a comma-separated list of expressions, and returns them as
  // an array. `close` is the token type that ends the list, and
  // `allowEmpty` can be turned on to allow subsequent commas with
  // nothing in between them to be parsed as `null` (which is needed
  // for array literals).

  parseExprList(
    close: TokenType,
    allowEmpty: boolean | null = null,
    refShorthandDefaultPos: Pos | null = null,
  ): ReadonlyArray<N.Expression | null> {
    const elts = [];
    let first = true;

    while (!this.eat(close)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(close)) break;
      }

      elts.push(this.parseExprListItem(allowEmpty, refShorthandDefaultPos));
    }
    return elts;
  }

  parseExprListItem(
    allowEmpty: boolean | null,
    refShorthandDefaultPos: Pos | null,
    refNeedsArrowPos: Pos | null = null,
    refTrailingCommaPos: Pos | null = null,
  ): N.Expression | null {
    let elt;
    if (allowEmpty && this.match(tt.comma)) {
      elt = null;
    } else if (this.match(tt.ellipsis)) {
      elt = this.parseSpread(refShorthandDefaultPos);

      if (refTrailingCommaPos && this.match(tt.comma)) {
        refTrailingCommaPos.start = this.state.start;
      }
    } else {
      elt = this.parseMaybeAssign(
        false,
        refShorthandDefaultPos,
        this.parseParenItem,
        refNeedsArrowPos,
      );
    }
    return elt;
  }

  // Parse the next token as an identifier. If `liberal` is true (used
  // when parsing properties), it will also convert keywords into
  // identifiers.

  parseIdentifier(liberal?: boolean): N.Identifier {
    const node = this.startNode();
    const name = this.parseIdentifierName(node.start, liberal);
    node.name = name;
    node.loc.identifierName = name;
    return this.finishNode(node as N.Identifier, "Identifier");
  }

  parseIdentifierName(pos: number, liberal?: boolean): string {
    if (!liberal) {
      this.checkReservedWord(this.state.value, this.state.start, !!this.state.type.keyword, false);
    }

    let name: string;

    if (this.match(tt.name)) {
      name = this.state.value;
    } else if (this.state.type.keyword) {
      name = this.state.type.keyword;
    } else {
      throw this.unexpected();
    }

    if (!liberal && name === "await" && this.state.inAsync) {
      this.raise(pos, "invalid use of await inside of an async function");
    }

    this.next();
    return name;
  }

  checkReservedWord(
    word: string,
    startLoc: number,
    checkKeywords: boolean,
    isBinding: boolean,
  ): void {
    if (
      this.state.strict &&
      (reservedWords.strict(word) || (isBinding && reservedWords.strictBind(word)))
    ) {
      this.raise(startLoc, `${word} is a reserved word in strict mode`);
    }

    if (this.state.inGenerator && word === "yield") {
      this.raise(startLoc, "yield is a reserved word inside generator functions");
    }

    if (this.isReservedWord(word) || (checkKeywords && this.isKeyword(word))) {
      this.raise(startLoc, `${word} is a reserved word`);
    }
  }

  // Parses await expression inside async function.

  parseAwait(node: N.AwaitExpression): N.AwaitExpression {
    // istanbul ignore next: this condition is checked at the call site so won't be hit here
    if (!this.state.inAsync) {
      this.unexpected();
    }
    if (this.match(tt.star)) {
      this.raise(
        node.start,
        "await* has been removed from the async functions proposal. Use Promise.all() instead.",
      );
    }
    node.argument = this.parseMaybeUnary();
    return this.finishNode(node, "AwaitExpression");
  }

  // Parses yield expression inside generator.

  parseYield(): N.YieldExpression {
    const node = this.startNode();

    if (this.state.inParameters) {
      this.raise(node.start, "yield is not allowed in generator parameters");
    }
    if (
      this.state.maybeInArrowParameters &&
      // We only set yieldInPossibleArrowParameters if we haven't already
      // found a possible invalid YieldExpression.
      !this.state.yieldInPossibleArrowParameters
    ) {
      this.state.yieldInPossibleArrowParameters = node as N.YieldExpression;
    }

    this.next();
    if (
      this.match(tt.semi) ||
      this.canInsertSemicolon() ||
      (!this.match(tt.star) && !this.state.type.startsExpr)
    ) {
      node.delegate = false;
      node.argument = null;
    } else {
      node.delegate = this.eat(tt.star);
      node.argument = this.parseMaybeAssign();
    }
    return this.finishNode(node as N.YieldExpression, "YieldExpression");
  }
}
