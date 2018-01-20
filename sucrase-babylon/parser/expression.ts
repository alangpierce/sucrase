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
import {Pos, Position} from "../util/location";
import LValParser from "./lval";

export default abstract class ExpressionParser extends LValParser {
  // Forward-declaration: defined in statement.js
  abstract parseBlock(
    allowDirectives?: boolean,
    isFunctionScope?: boolean,
    contextId?: number,
  ): void;
  abstract parseClass(node: N.Class, isStatement: boolean, optionalId?: boolean): N.Class;
  abstract parseDecorators(allowExport?: boolean): void;
  abstract parseFunction(
    functionStart: number,
    isStatement: boolean,
    allowExpressionBody?: boolean,
    isAsync?: boolean,
    optionalId?: boolean,
  ): void;
  abstract parseFunctionParams(allowModifiers?: boolean, funcContextId?: number): void;

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
      // Note that we keep the LHS tokens as accesses for now.
      refShorthandDefaultPos.start = 0; // reset because shorthand default was used correctly

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
      // We see "async", but it's possible it's a usage of the name "async". Parse as if it's a
      // function call, and if we see an arrow later, backtrack and re-parse as a parameter list.
      const initialStateForAsyncArrow = possibleAsync ? this.state.clone() : null;
      const startTokenIndex = this.state.tokens.length;
      this.next();

      const callContextId = this.nextContextId++;

      const node = this.startNodeAt<N.CallExpression>(startPos, startLoc);
      node.callee = base;

      // TODO: Clean up/merge this into `this.state` or a class like acorn's
      // `DestructuringErrors` alongside refShorthandDefaultPos and
      // refNeedsArrowPos.
      const refTrailingCommaPos: Pos = {start: -1};

      this.state.tokens[this.state.tokens.length - 1].contextId = callContextId;
      node.arguments = this.parseCallExpressionArguments(
        tt.parenR,
        possibleAsync,
        refTrailingCommaPos,
      ) as Array<N.Node>;
      this.state.tokens[this.state.tokens.length - 1].contextId = callContextId;
      this.finishNode(node, "CallExpression");

      if (possibleAsync && this.shouldParseAsyncArrow()) {
        // We hit an arrow, so backtrack and start again parsing function parameters.
        this.state = initialStateForAsyncArrow!;
        state.stop = true;

        this.parseFunctionParams();
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
    this.expect(tt.arrow);
    this.parseArrowExpression(node, startTokenIndex, call.arguments, true);
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
          this.parseImportMetaProperty();
          return this.startNode();
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
        const id = this.parseIdentifier(allowAwait);

        if (id.name === "await") {
          if (this.state.inAsync || this.inModule) {
            return this.parseAwait(node as N.AwaitExpression);
          }
        } else if (id.name === "async" && this.match(tt._function) && !this.canInsertSemicolon()) {
          this.next();
          this.parseFunction(node.start, false, false, true);
          return node;
        } else if (canBeArrow && id.name === "async" && this.match(tt.name)) {
          const params = [this.parseIdentifier()];
          this.expect(tt.arrow);
          // let foo = bar => {};
          this.parseArrowExpression(
            node as N.ArrowFunctionExpression,
            startTokenIndex,
            params,
            true,
          );
          return node;
        }

        if (canBeArrow && !this.canInsertSemicolon() && this.eat(tt.arrow)) {
          this.parseArrowExpression(node as N.ArrowFunctionExpression, startTokenIndex, [id]);
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
        this.state.inFunction = false;
        this.parseBlock(false);
        this.state.inFunction = oldInFunction;
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
        this.parseFunctionExpression();
        return this.startNode();

      case tt.at:
        this.parseDecorators();

      case tt._class:
        node = this.startNode();
        return this.parseClass(node as N.Class, false);

      case tt._new:
        this.parseNew();
        return this.startNode();

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

  parseFunctionExpression(): void {
    const functionStart = this.state.start;
    const meta = this.parseIdentifier(true);
    if (this.state.inGenerator && this.eat(tt.dot)) {
      this.parseMetaProperty(meta, "sent");
    }
    this.parseFunction(functionStart, false);
  }

  parseMetaProperty(meta: N.Identifier, propertyName: string): void {
    if (meta.name === "function" && propertyName === "sent") {
      if (this.isContextual(propertyName)) {
        this.expectPlugin("functionSent");
      } else if (!this.hasPlugin("functionSent")) {
        // They didn't actually say `function.sent`, just `function.`, so a simple error would be less confusing.
        this.unexpected();
      }
    }

    this.parseIdentifier(true);
  }

  parseImportMetaProperty(): void {
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
    this.parseMetaProperty(id, "meta");
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

    // Assume this is a normal parenthesized expression, but if we see an arrow, we'll bail and
    // start over as a parameter list.
    const initialState = this.state.clone();

    let val: N.Expression;
    const startTokenIndex = this.state.tokens.length;
    this.expect(tt.parenL);

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

    const arrowNode = this.startNodeAt<N.ArrowFunctionExpression>(startPos, startLoc);
    if (canBeArrow && this.shouldParseArrow()) {
      const parsedArrowNode = this.parseArrow(arrowNode);
      if (parsedArrowNode) {
        // It was an arrow function this whole time, so start over and parse it as params so that we
        // get proper token annotations.
        this.state = initialState;
        // Don't specify a context ID because arrow function don't need a context ID.
        this.parseFunctionParams();
        this.parseArrow(this.startNode());
        this.parseArrowExpression(parsedArrowNode, startTokenIndex, exprList);
        return parsedArrowNode;
      }
    }

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

  parseNew(): void {
    const meta = this.parseIdentifier(true);

    if (this.eat(tt.dot)) {
      this.parseMetaProperty(meta, "target");

      if (!this.state.inFunction && !this.state.inClassProperty) {
        let error = "new.target can only be used in functions";

        if (this.hasPlugin("classProperties")) {
          error += " or class properties";
        }

        this.raise(this.state.pos, error);
      }
    }

    this.parseNoCallExpr();
    this.eat(tt.questionDot);
    this.parseNewArguments();
  }

  parseNewArguments(): void {
    if (this.eat(tt.parenL)) {
      this.parseExprList(tt.parenR);
    }
  }

  // Parse template expression.

  parseTemplateElement(isTagged: boolean): N.TemplateElement {
    const elem = this.startNode();
    if (this.state.value === null) {
      if (!isTagged) {
        // TODO: fix this
        this.raise(this.state.pos, "Invalid escape sequence in template");
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
    // Attach a context ID to the object open and close brace and each object key.
    const contextId = this.nextContextId++;
    const propHash: {} = Object.create(null);
    let first = true;
    const node = this.startNode();

    node.properties = [];
    this.next();
    this.state.tokens[this.state.tokens.length - 1].contextId = contextId;

    let firstRestLocation = null;

    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(tt.braceR)) break;
      }

      let prop = this.startNode();
      let isGenerator = false;
      let isAsync = false;
      let startPos = null;
      let startLoc = null;

      if (this.match(tt.ellipsis)) {
        this.expectPlugin("objectRestSpread");
        // Note that this is labeled as an access on the token even though it might be an
        // assignment.
        prop = this.parseSpread(isPattern ? {start: 0} : null);
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
          this.parsePropertyName(prop as N.ObjectOrClassMember, contextId);
        }
      } else {
        this.parsePropertyName(prop as N.ObjectOrClassMember, contextId);
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
        contextId,
      );
      if (prop.shorthand) {
        this.addExtra(prop, "shorthand", true);
      }

      node.properties.push(prop);
    }

    this.state.tokens[this.state.tokens.length - 1].contextId = contextId;

    if (firstRestLocation !== null) {
      this.unexpected(
        firstRestLocation,
        "The rest element has to be the last element when destructuring",
      );
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

  parseObjectMethod(
    prop: N.ObjectMethod,
    isGenerator: boolean,
    isAsync: boolean,
    isPattern: boolean,
    objectContextId: number,
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
      this.parsePropertyName(prop, objectContextId);
      this.parseMethod(
        prop,
        /* isGenerator */ false,
        /* isAsync */ false,
        /* isConstructor */ false,
        "ObjectMethod",
      );
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
      // If we're in a destructuring, we've now discovered that the key was actually an assignee, so
      // we need to tag it as a declaration with the appropriate scope. Otherwise, we might need to
      // transform it on access, so mark it as an object shorthand.
      if (isPattern) {
        this.state.tokens[this.state.tokens.length - 1].identifierRole = isBlockScope
          ? IdentifierRole.BlockScopedDeclaration
          : IdentifierRole.FunctionScopedDeclaration;
      } else {
        this.state.tokens[this.state.tokens.length - 1].identifierRole =
          IdentifierRole.ObjectShorthand;
      }

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
    objectContextId: number,
  ): void {
    const node =
      this.parseObjectMethod(
        prop as N.ObjectMethod,
        isGenerator,
        isAsync,
        isPattern,
        objectContextId,
      ) ||
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
    objectContextId: number,
  ): N.Expression | N.Identifier {
    if (this.eat(tt.bracketL)) {
      this.state.tokens[this.state.tokens.length - 1].contextId = objectContextId;
      (prop as N.ObjectOrClassMember).computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(tt.bracketR);
      this.state.tokens[this.state.tokens.length - 1].contextId = objectContextId;
    } else {
      const oldInPropertyName = this.state.inPropertyName;
      this.state.inPropertyName = true;
      // We check if it's valid for it to be a private name when we push it.
      (prop as N.ObjectOrClassMember).key =
        this.match(tt.num) || this.match(tt.string)
          ? this.parseExprAtom()
          : this.parseMaybePrivateName();

      this.state.tokens[this.state.tokens.length - 1].identifierRole = IdentifierRole.ObjectKey;
      this.state.tokens[this.state.tokens.length - 1].contextId = objectContextId;
      if (prop.key.type !== "PrivateName") {
        // ClassPrivateProperty is never computed, so we don't assign in that case.
        prop.computed = false;
      }

      this.state.inPropertyName = oldInPropertyName;
    }

    return prop.key;
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

    const funcContextId = this.nextContextId++;

    const functionStart = node.start;
    const startTokenIndex = this.state.tokens.length;
    const allowModifiers = isConstructor; // For TypeScript parameter properties
    this.parseFunctionParams(allowModifiers, funcContextId);
    this.parseFunctionBodyAndFinish(
      functionStart,
      isAsync,
      isGenerator,
      type,
      null /* allowExpressionBody */,
      funcContextId,
    );
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
    const oldInFunc = this.state.inFunction;
    this.state.inFunction = true;

    const functionStart = node.start;
    const oldInGenerator = this.state.inGenerator;
    this.state.inGenerator = false;
    this.parseFunctionBody(functionStart, isAsync, false /* isGenerator */, true);
    this.state.inGenerator = oldInGenerator;
    this.state.inFunction = oldInFunc;

    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: true});

    return this.finishNode(node, "ArrowFunctionExpression");
  }

  parseFunctionBodyAndFinish(
    functionStart: number,
    isAsync: boolean,
    isGenerator: boolean,
    type: string,
    allowExpressionBody: boolean | null = null,
    funcContextId?: number,
  ): void {
    this.parseFunctionBody(functionStart, isAsync, isGenerator, allowExpressionBody, funcContextId);
  }

  // Parse function body and check parameters.
  parseFunctionBody(
    functionStart: number,
    isAsync: boolean,
    isGenerator: boolean,
    allowExpression: boolean | null,
    funcContextId?: number,
  ): void {
    const isExpression = allowExpression && !this.match(tt.braceL);

    const oldInParameters = this.state.inParameters;
    const oldInAsync = this.state.inAsync;
    this.state.inParameters = false;
    this.state.inAsync = isAsync;

    if (isExpression) {
      this.parseMaybeAssign();
    } else {
      // Start a new scope with regard to labels and the `inGenerator`
      // flag (restore them to their old value afterwards).
      const oldInGen = this.state.inGenerator;
      const oldInFunc = this.state.inFunction;
      this.state.inGenerator = isGenerator;
      this.state.inFunction = true;
      this.parseBlock(true /* allowDirectives */, true /* isFunctionScope */, funcContextId);
      this.state.inFunction = oldInFunc;
      this.state.inGenerator = oldInGen;
    }
    this.state.inAsync = oldInAsync;

    this.state.inParameters = oldInParameters;
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
    this.state.tokens[this.state.tokens.length - 1].type = tt.name;
    node.name = name;
    node.loc.identifierName = name;
    return this.finishNode(node as N.Identifier, "Identifier");
  }

  parseIdentifierName(pos: number, liberal?: boolean): string {
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
