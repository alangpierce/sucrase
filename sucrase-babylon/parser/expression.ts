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
  abstract parseClass(isStatement: boolean, optionalId?: boolean): void;
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

  parseExpression(noIn?: boolean, refShorthandDefaultPos?: Pos): void {
    this.parseMaybeAssign(noIn, refShorthandDefaultPos);
    if (this.match(tt.comma)) {
      while (this.eat(tt.comma)) {
        this.parseMaybeAssign(noIn, refShorthandDefaultPos);
      }
    }
  }

  // Parse an assignment expression. This includes applications of
  // operators like `+=`.
  // Returns true if the expression was an arrow function.
  parseMaybeAssign(
    noIn: boolean | null = null,
    refShorthandDefaultPos?: Pos | null,
    afterLeftParse?: Function,
    refNeedsArrowPos?: Pos | null,
  ): boolean {
    if (this.match(tt._yield) && this.state.inGenerator) {
      this.parseYield();
      if (afterLeftParse) {
        afterLeftParse.call(this);
      }
      return false;
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

    const wasArrow = this.parseMaybeConditional(noIn, refShorthandDefaultPos, refNeedsArrowPos);
    if (afterLeftParse) {
      afterLeftParse.call(this);
    }
    if (this.state.type.isAssign) {
      // Note that we keep the LHS tokens as accesses for now.
      refShorthandDefaultPos.start = 0; // reset because shorthand default was used correctly

      this.next();
      this.parseMaybeAssign(noIn);
      return false;
    } else if (failOnShorthandAssign && refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }
    return wasArrow;
  }

  // Parse a ternary conditional (`?:`) operator.
  // Returns true if the expression was an arrow function.
  parseMaybeConditional(
    noIn: boolean | null,
    refShorthandDefaultPos: Pos,
    refNeedsArrowPos?: Pos | null,
  ): boolean {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const wasArrow = this.parseExprOps(noIn, refShorthandDefaultPos);
    if (wasArrow) {
      return true;
    }
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return false;
    }
    this.parseConditional(noIn, startPos, startLoc, refNeedsArrowPos);
    return false;
  }

  parseConditional(
    noIn: boolean | null,
    startPos: number,
    startLoc: Position,
    // FIXME: Disabling this for now since can't seem to get it to play nicely
    // eslint-disable-next-line no-unused-vars
    refNeedsArrowPos?: Pos | null,
  ): void {
    if (this.eat(tt.question)) {
      this.parseMaybeAssign();
      this.expect(tt.colon);
      this.parseMaybeAssign(noIn);
    }
  }

  // Start the precedence parser.
  // Returns true if this was an arrow function
  parseExprOps(noIn: boolean | null, refShorthandDefaultPos: Pos): boolean {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const wasArrow = this.parseMaybeUnary(refShorthandDefaultPos);
    if (wasArrow) {
      return true;
    }
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return false;
    }
    this.parseExprOp(startPos, startLoc, -1, noIn);
    return false;
  }

  // Parse binary operators with the operator precedence parsing
  // algorithm. `left` is the left-hand side of the operator.
  // `minPrec` provides context that allows the function to stop and
  // defer further parser to one of its callers when it encounters an
  // operator that has a lower precedence than the set it is parsing.

  parseExprOp(
    leftStartPos: number,
    leftStartLoc: Position,
    minPrec: number,
    noIn: boolean | null,
  ): void {
    const prec = this.state.type.binop;
    if (prec != null && (!noIn || !this.match(tt._in))) {
      if (prec > minPrec) {
        const node = this.startNodeAt(leftStartPos, leftStartLoc);
        node.operator = this.state.value;

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

        this.parseMaybeUnary();
        this.parseExprOp(startPos, startLoc, op.rightAssociative ? prec - 1 : prec, noIn);
        this.parseExprOp(leftStartPos, leftStartLoc, minPrec, noIn);
      }
    }
  }

  // Parse unary operators, both prefix and postfix.
  // Returns true if this was an arrow function.
  parseMaybeUnary(refShorthandDefaultPos: Pos | null = null): boolean {
    if (this.state.type.prefix) {
      const node = this.startNode();
      node.operator = this.state.value;
      node.prefix = true;

      if (node.operator === "throw") {
        this.expectPlugin("throwExpressions");
      }
      this.next();
      this.parseMaybeUnary();
      if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
        this.unexpected(refShorthandDefaultPos.start);
      }
      return false;
    }

    const wasArrow = this.parseExprSubscripts(refShorthandDefaultPos);
    if (wasArrow) {
      return true;
    }
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return false;
    }
    while (this.state.type.postfix && !this.canInsertSemicolon()) {
      this.next();
    }
    return false;
  }

  // Parse call, dot, and `[]`-subscript expressions.
  // Returns true if this was an arrow function.
  parseExprSubscripts(refShorthandDefaultPos: Pos | null = null): boolean {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const wasArrow = this.parseExprAtom(refShorthandDefaultPos);
    if (wasArrow) {
      return true;
    }

    if (refShorthandDefaultPos && refShorthandDefaultPos.start) {
      return false;
    }

    this.parseSubscripts(startPos, startLoc);
    return false;
  }

  parseSubscripts(startPos: number, startLoc: Position, noCalls: boolean | null = null): void {
    const state = {stop: false};
    do {
      this.parseSubscript(startPos, startLoc, noCalls, state);
    } while (!state.stop);
  }

  /** Set 'state.stop = true' to indicate that we should stop parsing subscripts. */
  parseSubscript(
    startPos: number,
    startLoc: Position,
    noCalls: boolean | null,
    state: {stop: boolean},
  ): void {
    if (!noCalls && this.eat(tt.doubleColon)) {
      this.parseNoCallExpr();
      state.stop = true;
      this.parseSubscripts(startPos, startLoc, noCalls);
    } else if (this.match(tt.questionDot)) {
      this.expectPlugin("optionalChaining");

      if (noCalls && this.lookahead().type === tt.parenL) {
        state.stop = true;
        return;
      }
      this.next();

      if (this.eat(tt.bracketL)) {
        this.parseExpression();
        this.expect(tt.bracketR);
      } else if (this.eat(tt.parenL)) {
        const possibleAsync = this.atPossibleAsync();
        this.parseCallExpressionArguments(tt.parenR, possibleAsync);
      } else {
        this.parseIdentifier(true);
      }
    } else if (this.eat(tt.dot)) {
      this.parseMaybePrivateName();
    } else if (this.eat(tt.bracketL)) {
      this.parseExpression();
      this.expect(tt.bracketR);
    } else if (!noCalls && this.match(tt.parenL)) {
      const possibleAsync = this.atPossibleAsync();
      // We see "async", but it's possible it's a usage of the name "async". Parse as if it's a
      // function call, and if we see an arrow later, backtrack and re-parse as a parameter list.
      const initialStateForAsyncArrow = possibleAsync ? this.state.clone() : null;
      const startTokenIndex = this.state.tokens.length;
      this.next();

      const callContextId = this.nextContextId++;

      // TODO: Clean up/merge this into `this.state` or a class like acorn's
      // `DestructuringErrors` alongside refShorthandDefaultPos and
      // refNeedsArrowPos.
      const refTrailingCommaPos: Pos = {start: -1};

      this.state.tokens[this.state.tokens.length - 1].contextId = callContextId;
      this.parseCallExpressionArguments(tt.parenR, possibleAsync, refTrailingCommaPos);
      this.state.tokens[this.state.tokens.length - 1].contextId = callContextId;

      if (possibleAsync && this.shouldParseAsyncArrow()) {
        // We hit an arrow, so backtrack and start again parsing function parameters.
        this.state = initialStateForAsyncArrow!;
        state.stop = true;

        this.parseFunctionParams();
        this.parseAsyncArrowFromCallExpression(startPos, startTokenIndex);
      }
    } else if (this.match(tt.backQuote)) {
      // Tagged template expression.
      this.parseTemplate(true);
    } else {
      state.stop = true;
    }
  }

  atPossibleAsync(): boolean {
    // This was made less strict than the original version to avoid passing around nodes, but it
    // should be safe to have rare false positives here.
    return (
      this.state.tokens[this.state.tokens.length - 1].value === "async" &&
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

  parseAsyncArrowFromCallExpression(functionStart: number, startTokenIndex: number): void {
    this.expect(tt.arrow);
    this.parseArrowExpression(functionStart, startTokenIndex, true);
  }

  // Parse a no-call expression (like argument of `new` or `::` operators).

  parseNoCallExpr(): void {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    this.parseExprAtom();
    this.parseSubscripts(startPos, startLoc, true);
  }

  // Parse an atomic expression — either a single token that is an
  // expression, an expression started by a keyword like `function` or
  // `new`, or an expression wrapped in punctuation like `()`, `[]`,
  // or `{}`.
  // Returns true if the parsed expression was an arrow function.
  parseExprAtom(refShorthandDefaultPos?: Pos | null): boolean {
    const canBeArrow = this.state.potentialArrowAt === this.state.start;
    let node: N.Expression;

    switch (this.state.type) {
      case tt._super:
        this.next();
        return false;

      case tt._import:
        if (this.lookahead().type === tt.dot) {
          this.parseImportMetaProperty();
          return false;
        }
        this.next();
        return false;

      case tt._this:
        this.next();
        return false;

      case tt._yield:
        if (this.state.inGenerator) this.unexpected();

      case tt.name: {
        const startTokenIndex = this.state.tokens.length;
        const functionStart = this.state.start;
        const name = this.state.value;
        const allowAwait = name === "await" && this.state.inAsync;
        this.parseIdentifier(allowAwait);
        if (name === "await") {
          if (this.state.inAsync || this.inModule) {
            this.parseAwait();
            return false;
          }
        } else if (name === "async" && this.match(tt._function) && !this.canInsertSemicolon()) {
          this.next();
          this.parseFunction(functionStart, false, false, true);
          return false;
        } else if (canBeArrow && name === "async" && this.match(tt.name)) {
          this.parseIdentifier();
          this.expect(tt.arrow);
          // let foo = bar => {};
          this.parseArrowExpression(functionStart, startTokenIndex, true);
          return true;
        }

        if (canBeArrow && !this.canInsertSemicolon() && this.eat(tt.arrow)) {
          this.parseArrowExpression(functionStart, startTokenIndex);
          return true;
        }

        this.state.tokens[this.state.tokens.length - 1].identifierRole = IdentifierRole.Access;
        return false;
      }

      case tt._do: {
        this.expectPlugin("doExpressions");
        const innerNode = this.startNode();
        this.next();
        const oldInFunction = this.state.inFunction;
        this.state.inFunction = false;
        this.parseBlock(false);
        this.state.inFunction = oldInFunction;
        return false;
      }

      case tt.regexp: {
        const value = this.state.value;
        this.parseLiteral(value.value, "RegExpLiteral");
        return false;
      }

      case tt.num:
        this.parseLiteral(this.state.value, "NumericLiteral");
        return false;

      case tt.bigint:
        this.parseLiteral(this.state.value, "BigIntLiteral");
        return false;

      case tt.string:
        this.parseLiteral(this.state.value, "StringLiteral");
        return false;

      case tt._null:
        this.next();
        return false;

      case tt._true:
      case tt._false:
        this.parseBooleanLiteral();
        return false;

      case tt.parenL: {
        const wasArrow = this.parseParenAndDistinguishExpression(canBeArrow);
        return wasArrow;
      }

      case tt.bracketL:
        this.next();
        this.parseExprList(tt.bracketR, true, refShorthandDefaultPos);
        return false;

      case tt.braceL:
        this.parseObj(false, false, refShorthandDefaultPos);
        return false;

      case tt._function:
        this.parseFunctionExpression();
        return false;

      case tt.at:
        this.parseDecorators();
      // Fall through.

      case tt._class:
        node = this.startNode();
        this.parseClass(false);
        return false;

      case tt._new:
        this.parseNew();
        return false;

      case tt.backQuote:
        this.parseTemplate(false);
        return false;

      case tt.doubleColon: {
        this.next();
        this.parseNoCallExpr();
        return false;
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

  parseParenExpression(): void {
    this.expect(tt.parenL);
    this.parseExpression();
    this.expect(tt.parenR);
  }

  // Returns true if this was an arrow expression.
  parseParenAndDistinguishExpression(canBeArrow: boolean): boolean {
    // Assume this is a normal parenthesized expression, but if we see an arrow, we'll bail and
    // start over as a parameter list.
    const initialState = this.state.clone();

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
        spreadStart = this.state.start;
        this.parseRest(false /* isBlockScope */);
        this.parseParenItem();

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

    if (canBeArrow && this.shouldParseArrow()) {
      const wasArrow = this.parseArrow();
      if (wasArrow) {
        // It was an arrow function this whole time, so start over and parse it as params so that we
        // get proper token annotations.
        this.state = initialState;
        // We don't need to worry about functionStart for arrow functions, so just use something.
        const functionStart = this.state.start;
        // Don't specify a context ID because arrow function don't need a context ID.
        this.parseFunctionParams();
        this.parseArrow();
        this.parseArrowExpression(functionStart, startTokenIndex);
        return true;
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
    if (refNeedsArrowPos.start) {
      this.unexpected(refNeedsArrowPos.start);
    }

    return false;
  }

  shouldParseArrow(): boolean {
    return !this.canInsertSemicolon();
  }

  // Returns whether there was an arrow token.
  parseArrow(): boolean {
    if (this.eat(tt.arrow)) {
      return true;
    }
    return false;
  }

  parseParenItem(): void {}

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
      this.parseExpression();
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
          this.parsePropertyName(contextId);
        }
      } else {
        this.parsePropertyName(contextId);
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

  isGetterOrSetterMethod(isPattern: boolean): boolean {
    // We go off of the next and don't bother checking if the node key is actually "get" or "set".
    // This lets us avoid generating a node, and should only make the validation worse.
    return (
      !isPattern &&
      (this.match(tt.string) || // get "string"() {}
      this.match(tt.num) || // get 1() {}
      this.match(tt.bracketL) || // get ["string"]() {}
      this.match(tt.name) || // get foo() {}
        !!this.state.type.keyword) // get debugger() {}
    );
  }

  // Returns true if this was a method.
  parseObjectMethod(
    isGenerator: boolean,
    isAsync: boolean,
    isPattern: boolean,
    objectContextId: number,
  ): boolean {
    // We don't need to worry about modifiers because object methods can't have optional bodies, so
    // the start will never be used.
    const functionStart = this.state.start;
    if (isAsync || isGenerator || this.match(tt.parenL)) {
      if (isPattern) this.unexpected();
      this.parseMethod(functionStart, isGenerator, isAsync, /* isConstructor */ false);
      return true;
    }

    if (this.isGetterOrSetterMethod(isPattern)) {
      if (isGenerator || isAsync) this.unexpected();
      this.parsePropertyName(objectContextId);
      this.parseMethod(
        functionStart,
        /* isGenerator */ false,
        /* isAsync */ false,
        /* isConstructor */ false,
      );
      return true;
    }
    return false;
  }

  parseObjectProperty(
    startPos: number | null,
    startLoc: Position | null,
    isPattern: boolean,
    isBlockScope: boolean,
    refShorthandDefaultPos: Pos | null,
  ): void {
    if (this.eat(tt.colon)) {
      if (isPattern) {
        this.parseMaybeDefault(isBlockScope);
      } else {
        this.parseMaybeAssign(false, refShorthandDefaultPos);
      }
      return;
    }

    // Since there's no colon, we assume this is an object shorthand.

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
      this.parseMaybeDefault(isBlockScope, true);
    } else if (this.match(tt.eq) && refShorthandDefaultPos) {
      if (!refShorthandDefaultPos.start) {
        refShorthandDefaultPos.start = this.state.start;
      }
      this.parseMaybeDefault(isBlockScope, true);
    }
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
    const wasMethod = this.parseObjectMethod(isGenerator, isAsync, isPattern, objectContextId);
    if (!wasMethod) {
      this.parseObjectProperty(startPos, startLoc, isPattern, isBlockScope, refShorthandDefaultPos);
    }
  }

  parsePropertyName(objectContextId: number): void {
    if (this.eat(tt.bracketL)) {
      this.state.tokens[this.state.tokens.length - 1].contextId = objectContextId;
      this.parseMaybeAssign();
      this.expect(tt.bracketR);
      this.state.tokens[this.state.tokens.length - 1].contextId = objectContextId;
    } else {
      const oldInPropertyName = this.state.inPropertyName;
      this.state.inPropertyName = true;
      if (this.match(tt.num) || this.match(tt.string)) {
        this.parseExprAtom();
      } else {
        this.parseMaybePrivateName();
      }

      this.state.tokens[this.state.tokens.length - 1].identifierRole = IdentifierRole.ObjectKey;
      this.state.tokens[this.state.tokens.length - 1].contextId = objectContextId;

      this.state.inPropertyName = oldInPropertyName;
    }
  }

  // Parse object or class method.

  parseMethod(
    functionStart: number,
    isGenerator: boolean,
    isAsync: boolean,
    isConstructor: boolean,
  ): void {
    const oldInFunc = this.state.inFunction;
    const oldInGenerator = this.state.inGenerator;
    this.state.inFunction = true;
    this.state.inGenerator = isGenerator;

    const funcContextId = this.nextContextId++;

    const startTokenIndex = this.state.tokens.length;
    const allowModifiers = isConstructor; // For TypeScript parameter properties
    this.parseFunctionParams(allowModifiers, funcContextId);
    this.parseFunctionBodyAndFinish(
      functionStart,
      isAsync,
      isGenerator,
      null /* allowExpressionBody */,
      funcContextId,
    );
    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: true});

    this.state.inFunction = oldInFunc;
    this.state.inGenerator = oldInGenerator;
  }

  // Parse arrow function expression.
  // If the parameters are provided, they will be converted to an
  // assignable list.
  parseArrowExpression(
    functionStart: number,
    startTokenIndex: number,
    isAsync: boolean = false,
  ): void {
    const oldInFunc = this.state.inFunction;
    this.state.inFunction = true;

    const oldInGenerator = this.state.inGenerator;
    this.state.inGenerator = false;
    this.parseFunctionBody(functionStart, isAsync, false /* isGenerator */, true);
    this.state.inGenerator = oldInGenerator;
    this.state.inFunction = oldInFunc;

    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: true});
  }

  parseFunctionBodyAndFinish(
    functionStart: number,
    isAsync: boolean,
    isGenerator: boolean,
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

  parseAwait(): void {
    this.parseMaybeUnary();
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
