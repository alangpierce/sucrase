/* eslint max-len: 0 */

import {IdentifierRole} from "../tokenizer";
import {TokenType, types as tt} from "../tokenizer/types";
import * as N from "../types";
import {lineBreak} from "../util/whitespace";
import ExpressionParser from "./expression";

// Reused empty array added for node fields that are always empty.

// tslint:disable-next-line no-any
const empty: Array<any> = [];

export default class StatementParser extends ExpressionParser {
  // ### Statement parsing

  parseTopLevel(): N.File {
    this.parseBlockBody(true, tt.eof);

    this.state.scopes.push({
      startTokenIndex: 0,
      endTokenIndex: this.state.tokens.length,
      isFunctionScope: true,
    });

    return {
      tokens: this.state.tokens,
      scopes: this.state.scopes,
    };
  }

  // Parse a single statement.
  //
  // If expecting a statement and finding a slash operator, parse a
  // regular expression literal. This is to handle cases like
  // `if (foo) /blah/.exec(foo)`, where looking at the previous token
  // does not help.

  parseStatement(declaration: boolean, topLevel: boolean = false): void {
    if (this.match(tt.at)) {
      this.parseDecorators(true);
    }
    this.parseStatementContent(declaration, topLevel);
  }

  parseStatementContent(declaration: boolean, topLevel: boolean): void {
    const starttype = this.state.type;
    const node = this.startNode();

    // Most types of statements are recognized by the keyword they
    // start with. Many are trivial to parse, some require a bit of
    // complexity.

    switch (starttype) {
      case tt._break:
      case tt._continue:
        this.parseBreakContinueStatement();
        return;
      case tt._debugger:
        this.parseDebuggerStatement();
        return;
      case tt._do:
        this.parseDoStatement();
        return;
      case tt._for:
        this.parseForStatement();
        return;
      case tt._function:
        if (this.lookahead().type === tt.dot) break;
        if (!declaration) this.unexpected();
        this.parseFunctionStatement();
        return;

      case tt._class:
        if (!declaration) this.unexpected();
        this.parseClass(node as N.Class, true);
        return;

      case tt._if:
        this.parseIfStatement(node as N.IfStatement);
        return;
      case tt._return:
        this.parseReturnStatement(node as N.ReturnStatement);
        return;
      case tt._switch:
        this.parseSwitchStatement(node as N.SwitchStatement);
        return;
      case tt._throw:
        this.parseThrowStatement(node as N.ThrowStatement);
        return;
      case tt._try:
        this.parseTryStatement(node as N.TryStatement);
        return;

      case tt._let:
      case tt._const:
        if (!declaration) this.unexpected(); // NOTE: falls through to _var

      case tt._var:
        this.parseVarStatement(node as N.VariableDeclaration, starttype);
        return;

      case tt._while:
        this.parseWhileStatement(node as N.WhileStatement);
        return;
      case tt.braceL:
        this.parseBlock();
        return;
      case tt.semi:
        this.parseEmptyStatement(node as N.EmptyStatement);
        return;
      case tt._export:
      case tt._import: {
        const nextToken = this.lookahead();
        if (nextToken.type === tt.parenL || nextToken.type === tt.dot) {
          break;
        }

        if (!this.options.allowImportExportEverywhere && !topLevel) {
          this.raise(this.state.start, "'import' and 'export' may only appear at the top level");
        }

        this.next();

        let result;
        if (starttype === tt._import) {
          result = this.parseImport(node);
        } else {
          result = this.parseExport(node);
        }

        return;
      }
      case tt.name:
        if (this.state.value === "async") {
          const functionStart = this.state.start;
          // peek ahead and see if next token is a function
          const state = this.state.clone();
          this.next();
          if (this.match(tt._function) && !this.canInsertSemicolon()) {
            this.expect(tt._function);
            this.parseFunction(functionStart, true, false, true);
            return;
          } else {
            this.state = state;
          }
        }
      default:
        // Do nothing.
        break;
    }

    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
    const maybeName = this.state.value;
    const expr = this.parseExpression();

    if (starttype === tt.name && expr.type === "Identifier" && this.eat(tt.colon)) {
      this.parseLabeledStatement(node as N.LabeledStatement, maybeName, expr as N.Identifier);
    } else {
      this.parseExpressionStatement(node as N.ExpressionStatement, expr);
    }
  }

  parseDecorators(allowExport?: boolean): void {
    if (this.hasPlugin("decorators2")) {
      allowExport = false;
    }

    while (this.match(tt.at)) {
      this.parseDecorator();
    }

    if (this.match(tt._export)) {
      if (allowExport) {
        return;
      } else {
        this.raise(
          this.state.start,
          "Using the export keyword between a decorator and a class is not allowed. Please use `export @dec class` instead",
        );
      }
    }

    if (!this.match(tt._class)) {
      this.raise(this.state.start, "Leading decorators must be attached to a class declaration");
    }
  }

  parseDecorator(): void {
    this.expectOnePlugin(["decorators", "decorators2"]);

    this.next();

    if (this.hasPlugin("decorators2")) {
      const startPos = this.state.start;
      const startLoc = this.state.startLoc;
      let expr: N.Node = this.parseIdentifier(false);

      while (this.eat(tt.dot)) {
        const memberExprNode = this.startNodeAt<N.MemberExpression>(startPos, startLoc);
        memberExprNode.object = expr;
        memberExprNode.property = this.parseIdentifier(true);
        memberExprNode.computed = false;
        expr = this.finishNode(memberExprNode, "MemberExpression");
      }

      if (this.eat(tt.parenL)) {
        const callNode = this.startNodeAt<N.CallExpression>(startPos, startLoc);
        callNode.callee = expr;
        // @ts-ignore: Should filter out all nulls.
        callNode.arguments = this.parseCallExpressionArguments(tt.parenR, false);
        expr = this.finishNode(callNode, "CallExpression");
        this.toReferencedList(expr.arguments);
      }
    } else {
      this.parseMaybeAssign();
    }
  }

  parseBreakContinueStatement(): void {
    this.next();
    if (!this.isLineTerminator()) {
      this.parseIdentifier();
      this.semicolon();
    }
  }

  parseDebuggerStatement(): void {
    this.next();
    this.semicolon();
  }

  parseDoStatement(): void {
    this.next();
    this.parseStatement(false);
    this.expect(tt._while);
    this.parseParenExpression();
    this.eat(tt.semi);
  }

  parseForStatement(): void {
    const startTokenIndex = this.state.tokens.length;
    this.parseAmbiguousForStatement();
    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: false});
  }

  // Disambiguating between a `for` and a `for`/`in` or `for`/`of`
  // loop is non-trivial. Basically, we have to parse the init `var`
  // statement or expression, disallowing the `in` operator (see
  // the second parameter to `parseExpression`), and then check
  // whether the next token is `in` or `of`. When there is no init
  // part (semicolon immediately after the opening parenthesis), it
  // is a regular `for` loop.
  parseAmbiguousForStatement(): void {
    this.next();

    let forAwait = false;
    if (this.state.inAsync && this.isContextual("await")) {
      this.expectPlugin("asyncGenerators");
      forAwait = true;
      this.next();
    }
    this.expect(tt.parenL);

    if (this.match(tt.semi)) {
      if (forAwait) {
        this.unexpected();
      }
      this.parseFor();
      return;
    }

    if (this.match(tt._var) || this.match(tt._let) || this.match(tt._const)) {
      const init = this.startNode();
      const varKind = this.state.type;
      this.next();
      this.parseVar(init as N.VariableDeclaration, true, varKind);
      this.finishNode(init, "VariableDeclaration");

      if (this.match(tt._in) || this.isContextual("of")) {
        if (init.declarations.length === 1 && !init.declarations[0].init) {
          this.parseForIn(forAwait);
          return;
        }
      }
      if (forAwait) {
        this.unexpected();
      }
      this.parseFor();
      return;
    }

    const refShorthandDefaultPos = {start: 0};
    this.parseExpression(true, refShorthandDefaultPos);
    if (this.match(tt._in) || this.isContextual("of")) {
      this.parseForIn(forAwait);
      return;
    } else if (refShorthandDefaultPos.start) {
      this.unexpected(refShorthandDefaultPos.start);
    }
    if (forAwait) {
      this.unexpected();
    }
    this.parseFor();
  }

  parseFunctionStatement(): void {
    const functionStart = this.state.start;
    this.next();
    this.parseFunction(functionStart, true);
  }

  parseIfStatement(node: N.IfStatement): N.IfStatement {
    this.next();
    node.test = this.parseParenExpression();
    this.parseStatement(false);
    if (this.eat(tt._else)) {
      this.parseStatement(false);
    }
    return this.finishNode(node, "IfStatement");
  }

  parseReturnStatement(node: N.ReturnStatement): N.ReturnStatement {
    if (!this.state.inFunction && !this.options.allowReturnOutsideFunction) {
      this.raise(this.state.start, "'return' outside of function");
    }

    this.next();

    // In `return` (and `break`/`continue`), the keywords with
    // optional arguments, we eagerly look for a semicolon or the
    // possibility to insert one.

    if (this.isLineTerminator()) {
      node.argument = null;
    } else {
      node.argument = this.parseExpression();
      this.semicolon();
    }

    return this.finishNode(node, "ReturnStatement");
  }

  parseSwitchStatement(node: N.SwitchStatement): N.SwitchStatement {
    this.next();
    node.discriminant = this.parseParenExpression();
    const cases: Array<N.SwitchCase> = [];
    node.cases = cases;
    const startTokenIndex = this.state.tokens.length;
    this.expect(tt.braceL);

    // Statements under must be grouped (by label) in SwitchCase
    // nodes. `cur` is used to keep the node that we are currently
    // adding statements to.

    let cur: N.Node | null = null;
    for (let sawDefault; !this.match(tt.braceR); ) {
      if (this.match(tt._case) || this.match(tt._default)) {
        const isCase = this.match(tt._case);
        if (cur) this.finishNode(cur, "SwitchCase");
        cur = this.startNode();
        cases.push(cur as N.SwitchCase);
        cur.consequent = [];
        this.next();
        if (isCase) {
          cur.test = this.parseExpression();
        } else {
          if (sawDefault) {
            this.raise(this.state.lastTokStart, "Multiple default clauses");
          }
          sawDefault = true;
          cur.test = null;
        }
        this.expect(tt.colon);
      } else if (cur) {
        this.parseStatement(true);
      } else {
        this.unexpected();
      }
    }
    if (cur) this.finishNode(cur, "SwitchCase");
    this.next(); // Closing brace
    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: false});
    return this.finishNode(node, "SwitchStatement");
  }

  parseThrowStatement(node: N.ThrowStatement): N.ThrowStatement {
    this.next();
    if (lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start))) {
      this.raise(this.state.lastTokEnd, "Illegal newline after throw");
    }
    node.argument = this.parseExpression();
    this.semicolon();
    return this.finishNode(node, "ThrowStatement");
  }

  parseTryStatement(node: N.TryStatement): N.TryStatement {
    this.next();

    this.parseBlock();
    node.handler = null;

    if (this.match(tt._catch)) {
      const clause = this.startNode();
      this.next();
      let catchBindingStartTokenIndex = null;
      if (this.match(tt.parenL)) {
        catchBindingStartTokenIndex = this.state.tokens.length;
        this.expect(tt.parenL);
        clause.param = this.parseBindingAtom(true /* isBlockScope */);
        this.expect(tt.parenR);
      } else {
        this.expectPlugin("optionalCatchBinding");
        clause.param = null;
      }
      this.parseBlock();
      if (catchBindingStartTokenIndex != null) {
        // We need a special scope for the catch binding which includes the binding itself and the
        // catch block.
        const endTokenIndex = this.state.tokens.length;
        this.state.scopes.push({
          startTokenIndex: catchBindingStartTokenIndex,
          endTokenIndex,
          isFunctionScope: false,
        });
      }
      node.handler = this.finishNode(clause as N.CatchClause, "CatchClause");
    }

    // @ts-ignore
    node.guardedHandlers = empty;
    if (this.eat(tt._finally)) {
      this.parseBlock();
    }

    return this.finishNode(node, "TryStatement");
  }

  parseVarStatement(node: N.VariableDeclaration, kind: TokenType): N.VariableDeclaration {
    this.next();
    this.parseVar(node, false, kind);
    this.semicolon();
    return this.finishNode(node, "VariableDeclaration");
  }

  parseWhileStatement(node: N.WhileStatement): N.WhileStatement {
    this.next();
    node.test = this.parseParenExpression();
    this.parseStatement(false);
    return this.finishNode(node, "WhileStatement");
  }

  parseEmptyStatement(node: N.EmptyStatement): N.EmptyStatement {
    this.next();
    return this.finishNode(node, "EmptyStatement");
  }

  parseLabeledStatement(
    node: N.LabeledStatement,
    maybeName: string,
    expr: N.Identifier,
  ): N.LabeledStatement {
    this.parseStatement(true);
    return this.finishNode(node, "LabeledStatement");
  }

  parseExpressionStatement(node: N.ExpressionStatement, expr: N.Expression): N.ExpressionStatement {
    node.expression = expr;
    this.semicolon();
    return this.finishNode(node, "ExpressionStatement");
  }

  // Parse a semicolon-enclosed block of statements, handling `"use
  // strict"` declarations when `allowStrict` is true (used for
  // function bodies).

  parseBlock(
    allowDirectives: boolean = false,
    isFunctionScope: boolean = false,
    contextId?: number,
  ): void {
    const startTokenIndex = this.state.tokens.length;
    this.expect(tt.braceL);
    this.state.tokens[this.state.tokens.length - 1].contextId = contextId;
    this.parseBlockBody(false, tt.braceR);
    this.state.tokens[this.state.tokens.length - 1].contextId = contextId;
    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope});
  }

  parseBlockBody(topLevel: boolean, end: TokenType): void {
    while (!this.eat(end)) {
      this.parseStatement(true, topLevel);
    }
  }

  // Parse a regular `for` loop. The disambiguation code in
  // `parseStatement` will already have parsed the init statement or
  // expression.

  parseFor(): void {
    this.expect(tt.semi);
    if (!this.match(tt.semi)) {
      this.parseExpression();
    }
    this.expect(tt.semi);
    if (!this.match(tt.parenR)) {
      this.parseExpression();
    }
    this.expect(tt.parenR);
    this.parseStatement(false);
  }

  // Parse a `for`/`in` and `for`/`of` loop, which are almost
  // same from parser's perspective.

  parseForIn(forAwait: boolean): void {
    if (forAwait) {
      this.eatContextual("of");
    } else {
      this.next();
    }
    this.parseExpression();
    this.expect(tt.parenR);
    this.parseStatement(false);
  }

  // Parse a list of variable declarations.

  parseVar(node: N.VariableDeclaration, isFor: boolean, kind: TokenType): N.VariableDeclaration {
    const declarations: Array<N.VariableDeclarator> = [];
    node.declarations = declarations;
    // @ts-ignore
    node.kind = kind.keyword;
    for (;;) {
      const decl = this.startNode();
      const isBlockScope = kind === tt._const || kind === tt._let;
      this.parseVarHead(decl as N.VariableDeclarator, isBlockScope);
      if (this.eat(tt.eq)) {
        decl.init = this.parseMaybeAssign(isFor);
      } else {
        if (kind === tt._const && !(this.match(tt._in) || this.isContextual("of"))) {
          // `const` with no initializer is allowed in TypeScript. It could be a declaration `const x: number;`.
          if (!this.hasPlugin("typescript")) {
            this.unexpected();
          }
        } else if (
          decl.id.type !== "Identifier" &&
          !(isFor && (this.match(tt._in) || this.isContextual("of")))
        ) {
          this.raise(
            this.state.lastTokEnd,
            "Complex binding patterns require an initialization value",
          );
        }
        decl.init = null;
      }
      declarations.push(this.finishNode(decl as N.VariableDeclarator, "VariableDeclarator"));
      if (!this.eat(tt.comma)) break;
    }
    return node;
  }

  parseVarHead(decl: N.VariableDeclarator, isBlockScope: boolean): void {
    decl.id = this.parseBindingAtom(isBlockScope);
  }

  // Parse a function declaration or literal (depending on the
  // `isStatement` parameter).

  parseFunction(
    functionStart: number,
    isStatement: boolean,
    allowExpressionBody?: boolean,
    isAsync: boolean = false,
    optionalId?: boolean,
  ): void {
    const oldInFunc = this.state.inFunction;
    const oldInMethod = this.state.inMethod;
    const oldInGenerator = this.state.inGenerator;
    this.state.inFunction = true;
    this.state.inMethod = false;

    let isGenerator = false;
    if (this.match(tt.star)) {
      if (isAsync) {
        this.expectPlugin("asyncGenerators");
      }
      isGenerator = true;
      this.next();
    }

    if (isStatement && !optionalId && !this.match(tt.name) && !this.match(tt._yield)) {
      this.unexpected();
    }

    let nameScopeStartTokenIndex = null;

    // When parsing function expression, the binding identifier is parsed
    // according to the rules inside the function.
    // e.g. (function* yield() {}) is invalid because "yield" is disallowed in
    // generators.
    // This isn't the case with function declarations: function* yield() {} is
    // valid because yield is parsed as if it was outside the generator.
    // Therefore, this.state.inGenerator is set before or after parsing the
    // function id according to the "isStatement" parameter.
    if (!isStatement) this.state.inGenerator = isGenerator;
    if (this.match(tt.name) || this.match(tt._yield)) {
      // Expression-style functions should limit their name's scope to the function body, so we make
      // a new function scope to enforce that.
      if (!isStatement) {
        nameScopeStartTokenIndex = this.state.tokens.length;
      }
      this.parseBindingIdentifier();
      this.state.tokens[this.state.tokens.length - 1].identifierRole =
        IdentifierRole.FunctionScopedDeclaration;
    }
    if (isStatement) this.state.inGenerator = isGenerator;

    const startTokenIndex = this.state.tokens.length;
    this.parseFunctionParams();
    this.parseFunctionBodyAndFinish(
      functionStart,
      isAsync,
      isGenerator,
      isStatement ? "FunctionDeclaration" : "FunctionExpression",
      allowExpressionBody,
    );
    const endTokenIndex = this.state.tokens.length;
    // In addition to the block scope of the function body, we need a separate function-style scope
    // that includes the params.
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: true});
    if (nameScopeStartTokenIndex !== null) {
      this.state.scopes.push({
        startTokenIndex: nameScopeStartTokenIndex,
        endTokenIndex,
        isFunctionScope: true,
      });
    }

    this.state.inFunction = oldInFunc;
    this.state.inMethod = oldInMethod;
    this.state.inGenerator = oldInGenerator;
  }

  parseFunctionParams(allowModifiers?: boolean, funcContextId?: number): void {
    const oldInParameters = this.state.inParameters;
    this.state.inParameters = true;

    this.expect(tt.parenL);
    this.state.tokens[this.state.tokens.length - 1].contextId = funcContextId;
    this.parseBindingList(
      tt.parenR,
      false /* isBlockScope */,
      false /* allowEmpty */,
      allowModifiers,
    );
    this.state.tokens[this.state.tokens.length - 1].contextId = funcContextId;

    this.state.inParameters = oldInParameters;
  }

  // Parse a class declaration or literal (depending on the
  // `isStatement` parameter).

  parseClass<T extends N.Class>(
    node: T,
    isStatement: /* T === ClassDeclaration */ boolean,
    optionalId: boolean = false,
  ): T {
    // Put a context ID on the class keyword, the open-brace, and the close-brace, so that later
    // code can easily navigate to meaningful points on the class.
    const contextId = this.nextContextId++;

    this.next();
    this.state.tokens[this.state.tokens.length - 1].contextId = contextId;
    this.state.tokens[this.state.tokens.length - 1].isExpression = !isStatement;
    // Like with functions, we declare a special "name scope" from the start of the name to the end
    // of the class, but only with expression-style classes, to represent the fact that the name is
    // available to the body of the class but not an outer declaration.
    let nameScopeStartTokenIndex = null;
    if (!isStatement) {
      nameScopeStartTokenIndex = this.state.tokens.length;
    }
    this.parseClassId(node, isStatement, optionalId);
    this.parseClassSuper(node);
    const openBraceIndex = this.state.tokens.length;
    this.parseClassBody(node, contextId);
    this.state.tokens[openBraceIndex].contextId = contextId;
    this.state.tokens[this.state.tokens.length - 1].contextId = contextId;
    if (nameScopeStartTokenIndex !== null) {
      const endTokenIndex = this.state.tokens.length;
      this.state.scopes.push({
        startTokenIndex: nameScopeStartTokenIndex,
        endTokenIndex,
        isFunctionScope: false,
      });
    }
    return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
  }

  isClassProperty(): boolean {
    return this.match(tt.eq) || this.match(tt.semi) || this.match(tt.braceR);
  }

  isClassMethod(): boolean {
    return this.match(tt.parenL);
  }

  isNonstaticConstructor(method: N.ClassMethod | N.ClassProperty): boolean {
    return (
      !method.computed &&
      !method.static &&
      (method.key.name === "constructor" || // Identifier
        method.key.value === "constructor") // String literal
    );
  }

  parseClassBody(node: N.Class, classContextId: number): void {
    const state = {hadConstructor: false};
    const classBody: N.ClassBody = this.startNode();

    classBody.body = [];

    this.expect(tt.braceL);

    while (!this.eat(tt.braceR)) {
      if (this.eat(tt.semi)) {
        continue;
      }

      if (this.match(tt.at)) {
        this.parseDecorator();
        continue;
      }

      const member = this.startNode();

      this.parseClassMember(classBody, member as N.ClassMember, state, classContextId);

      if (
        this.hasPlugin("decorators2") &&
        ["method", "get", "set"].indexOf(member.kind) === -1 &&
        member.decorators &&
        member.decorators.length > 0
      ) {
        this.raise(
          member.start,
          "Stage 2 decorators may only be used with a class or a class method",
        );
      }
    }

    node.body = this.finishNode(classBody, "ClassBody");
  }

  parseClassMember(
    classBody: N.ClassBody,
    member: N.ClassMember,
    state: {hadConstructor: boolean},
    classContextId: number,
  ): void {
    let isStatic = false;
    if (this.match(tt.name) && this.state.value === "static") {
      const key = this.parseIdentifier(true); // eats 'static'
      if (this.isClassMethod()) {
        // @ts-ignore
        const method: N.ClassMethod = member as {};

        // a method named 'static'
        method.kind = "method";
        method.computed = false;
        method.key = key;
        method.static = false;
        this.pushClassMethod(classBody, method, false, false, /* isConstructor */ false);
        return;
      } else if (this.isClassProperty()) {
        // @ts-ignore
        const prop: N.ClassProperty = member as {};

        // a property named 'static'
        prop.computed = false;
        prop.key = key;
        prop.static = false;
        classBody.body.push(this.parseClassProperty(prop));
        return;
      }
      // otherwise something static
      this.state.tokens[this.state.tokens.length - 1].type = tt._static;
      isStatic = true;
    }

    this.parseClassMemberWithIsStatic(classBody, member, state, isStatic, classContextId);
  }

  parseClassMemberWithIsStatic(
    classBody: N.ClassBody,
    member: N.ClassMember,
    state: {hadConstructor: boolean},
    isStatic: boolean,
    classContextId: number,
  ): void {
    const publicMethod: N.ClassMethod = member as N.ClassMethod;
    const privateMethod: N.ClassPrivateMethod = member as N.ClassPrivateMethod;
    const publicProp: N.ClassProperty = member as N.ClassProperty;
    const privateProp: N.ClassPrivateProperty = member as N.ClassPrivateProperty;

    const method: typeof publicMethod | typeof privateMethod = publicMethod;
    const publicMember: typeof publicMethod | typeof publicProp = publicMethod;

    member.static = isStatic;

    if (this.eat(tt.star)) {
      // a generator
      method.kind = "method";
      this.parseClassPropertyName(method, classContextId);

      if (method.key.type === "PrivateName") {
        // Private generator method
        this.pushClassPrivateMethod(classBody, privateMethod, true, false);
        return;
      }

      if (this.isNonstaticConstructor(publicMethod)) {
        this.raise(publicMethod.key.start, "Constructor can't be a generator");
      }

      this.pushClassMethod(classBody, publicMethod, true, false, /* isConstructor */ false);

      return;
    }

    const key = this.parseClassPropertyName(member, classContextId);
    const isPrivate = key.type === "PrivateName";
    // Check the key is not a computed expression or string literal.
    const isSimple = key.type === "Identifier";

    this.parsePostMemberNameModifiers(publicMember);

    if (this.isClassMethod()) {
      method.kind = "method";

      if (isPrivate) {
        this.pushClassPrivateMethod(classBody, privateMethod, false, false);
        return;
      }

      // a normal method
      const isConstructor = this.isNonstaticConstructor(publicMethod);

      if (isConstructor) {
        publicMethod.kind = "constructor";

        if (publicMethod.decorators) {
          this.raise(publicMethod.start, "You can't attach decorators to a class constructor");
        }

        // TypeScript allows multiple overloaded constructor declarations.
        if (state.hadConstructor && !this.hasPlugin("typescript")) {
          this.raise(key.start, "Duplicate constructor in the same class");
        }
        state.hadConstructor = true;
      }

      this.pushClassMethod(classBody, publicMethod, false, false, isConstructor);
    } else if (this.isClassProperty()) {
      if (isPrivate) {
        this.pushClassPrivateProperty(classBody, privateProp);
      } else {
        this.pushClassProperty(classBody, publicProp);
      }
    } else if (isSimple && (key as N.Identifier).name === "async" && !this.isLineTerminator()) {
      this.state.tokens[this.state.tokens.length - 1].type = tt._async;
      // an async method
      const isGenerator = this.match(tt.star);
      if (isGenerator) {
        this.expectPlugin("asyncGenerators");
        this.next();
      }

      method.kind = "method";
      // The so-called parsed name would have been "async": get the real name.
      this.parseClassPropertyName(method, classContextId);

      if (method.key.type === "PrivateName") {
        // private async method
        this.pushClassPrivateMethod(classBody, privateMethod, isGenerator, true);
      } else {
        if (this.isNonstaticConstructor(publicMethod)) {
          this.raise(publicMethod.key.start, "Constructor can't be an async function");
        }

        this.pushClassMethod(classBody, publicMethod, isGenerator, true, /* isConstructor */ false);
      }
    } else if (
      isSimple &&
      ((key as N.Identifier).name === "get" || (key as N.Identifier).name === "set") &&
      !(this.isLineTerminator() && this.match(tt.star))
    ) {
      if ((key as N.Identifier).name === "get") {
        this.state.tokens[this.state.tokens.length - 1].type = tt._get;
      } else {
        this.state.tokens[this.state.tokens.length - 1].type = tt._set;
      }
      // `get\n*` is an uninitialized property named 'get' followed by a generator.
      // a getter or setter
      // @ts-ignore
      method.kind = (key as N.Identifier).name;
      // The so-called parsed name would have been "get/set": get the real name.
      this.parseClassPropertyName(publicMethod, classContextId);

      if (method.key.type === "PrivateName") {
        // private getter/setter
        this.pushClassPrivateMethod(classBody, privateMethod, false, false);
      } else {
        if (this.isNonstaticConstructor(publicMethod)) {
          this.raise(publicMethod.key.start, "Constructor can't have get/set modifier");
        }
        this.pushClassMethod(classBody, publicMethod, false, false, /* isConstructor */ false);
      }
    } else if (this.isLineTerminator()) {
      // an uninitialized class property (due to ASI, since we don't otherwise recognize the next token)
      if (isPrivate) {
        this.pushClassPrivateProperty(classBody, privateProp);
      } else {
        this.pushClassProperty(classBody, publicProp);
      }
    } else {
      this.unexpected();
    }
  }

  parseClassPropertyName(
    member: N.ClassMember,
    classContextId: number,
  ): N.Expression | N.Identifier {
    const key = this.parsePropertyName(member, classContextId);

    if (
      !member.computed &&
      member.static &&
      ((key as N.Identifier).name === "prototype" || (key as N.StringLiteral).value === "prototype")
    ) {
      this.raise(key.start, "Classes may not have static property named prototype");
    }

    if (key.type === "PrivateName" && (key as N.PrivateName).id.name === "constructor") {
      this.raise(key.start, "Classes may not have a private field named '#constructor'");
    }

    return key;
  }

  pushClassProperty(classBody: N.ClassBody, prop: N.ClassProperty): void {
    // This only affects properties, not methods.
    if (this.isNonstaticConstructor(prop)) {
      this.raise(prop.key.start, "Classes may not have a non-static field named 'constructor'");
    }
    classBody.body.push(this.parseClassProperty(prop));
  }

  pushClassPrivateProperty(classBody: N.ClassBody, prop: N.ClassPrivateProperty): void {
    this.expectPlugin("classPrivateProperties", prop.key.start);
    classBody.body.push(this.parseClassPrivateProperty(prop));
  }

  pushClassMethod(
    classBody: N.ClassBody,
    method: N.ClassMethod,
    isGenerator: boolean,
    isAsync: boolean,
    isConstructor: boolean,
  ): void {
    classBody.body.push(
      this.parseMethod(method, isGenerator, isAsync, isConstructor, "ClassMethod"),
    );
  }

  pushClassPrivateMethod(
    classBody: N.ClassBody,
    method: N.ClassPrivateMethod,
    isGenerator: boolean,
    isAsync: boolean,
  ): void {
    this.expectPlugin("classPrivateMethods", method.key.start);
    classBody.body.push(
      this.parseMethod(
        method,
        isGenerator,
        isAsync,
        /* isConstructor */ false,
        "ClassPrivateMethod",
      ),
    );
  }

  // Overridden in typescript.js
  parsePostMemberNameModifiers(
    // eslint-disable-next-line no-unused-vars
    methodOrProp: N.ClassMethod | N.ClassProperty,
  ): void {}

  // Overridden in typescript.js
  parseAccessModifier(): N.Accessibility | null {
    return null;
  }

  parseClassPrivateProperty(node: N.ClassPrivateProperty): N.ClassPrivateProperty {
    this.state.inClassProperty = true;
    node.value = this.eat(tt.eq) ? this.parseMaybeAssign() : null;
    this.semicolon();
    this.state.inClassProperty = false;
    return this.finishNode(node, "ClassPrivateProperty");
  }

  parseClassProperty(node: N.ClassProperty): N.ClassProperty {
    if (!node.typeAnnotation) {
      this.expectPlugin("classProperties");
    }

    this.state.inClassProperty = true;

    if (this.match(tt.eq)) {
      this.expectPlugin("classProperties");
      const equalsTokenIndex = this.state.tokens.length;
      this.next();
      node.value = this.parseMaybeAssign();
      this.state.tokens[equalsTokenIndex].rhsEndIndex = this.state.tokens.length;
    } else {
      node.value = null;
    }
    this.semicolon();
    this.state.inClassProperty = false;

    return this.finishNode(node, "ClassProperty");
  }

  parseClassId(node: N.Class, isStatement: boolean, optionalId: boolean = false): void {
    if (this.match(tt.name)) {
      node.id = this.parseIdentifier();
      this.state.tokens[this.state.tokens.length - 1].identifierRole =
        IdentifierRole.BlockScopedDeclaration;
    } else if (optionalId || !isStatement) {
      node.id = null;
    } else {
      this.unexpected(null, "A class name is required");
    }
  }

  parseClassSuper(node: N.Class): void {
    node.superClass = this.eat(tt._extends) ? this.parseExprSubscripts() : null;
  }

  // Parses module export declaration.

  // TODO: better type. Node is an N.AnyExport.
  parseExport(node: N.Node): N.Node {
    // export * from '...'
    if (this.shouldParseExportStar()) {
      this.parseExportStar(node as N.ExportNamedDeclaration);
      if (node.type === "ExportAllDeclaration") return node;
    } else if (this.isExportDefaultSpecifier()) {
      this.expectPlugin("exportDefaultFrom");
      const specifier = this.startNode();
      specifier.exported = this.parseIdentifier(true);
      const specifiers = [this.finishNode(specifier, "ExportDefaultSpecifier")];
      node.specifiers = specifiers;
      if (this.match(tt.comma) && this.lookahead().type === tt.star) {
        this.expect(tt.comma);
        const innerSpecifier = this.startNode();
        this.expect(tt.star);
        this.expectContextual("as");
        innerSpecifier.exported = this.parseIdentifier();
        specifiers.push(this.finishNode(innerSpecifier, "ExportNamespaceSpecifier"));
      } else {
        this.parseExportSpecifiersMaybe(node as N.ExportNamedDeclaration);
      }
      this.parseExportFrom(node as N.ExportNamedDeclaration, true);
    } else if (this.eat(tt._default)) {
      // export default ...
      node.declaration = this.parseExportDefaultExpression();
      return this.finishNode(node, "ExportDefaultDeclaration");
    } else if (this.shouldParseExportDeclaration()) {
      if (this.isContextual("async")) {
        const next = this.lookahead();

        // export async;
        if (next.type !== tt._function) {
          this.unexpected(next.start, `Unexpected token, expected "function"`);
        }
      }

      node.specifiers = [];
      node.source = null;
      this.parseExportDeclaration(node as N.ExportNamedDeclaration);
    } else {
      // export { x, y as z } [from '...']
      node.declaration = null;
      node.specifiers = this.parseExportSpecifiers();
      this.parseExportFrom(node as N.ExportNamedDeclaration);
    }
    return this.finishNode(node, "ExportNamedDeclaration");
  }

  parseExportDefaultExpression(): N.Expression | N.Declaration {
    const expr = this.startNode();
    const functionStart = this.state.start;
    if (this.eat(tt._function)) {
      this.parseFunction(functionStart, true, false, false, true);
      return expr;
    } else if (this.isContextual("async") && this.lookahead().type === tt._function) {
      // async function declaration
      this.eatContextual("async");
      this.eat(tt._function);
      this.parseFunction(functionStart, true, false, true, true);
      return expr;
    } else if (this.match(tt._class)) {
      return this.parseClass(expr as N.Class, true, true);
    } else {
      const res = this.parseMaybeAssign();
      this.semicolon();
      return res;
    }
  }

  // eslint-disable-next-line no-unused-vars
  parseExportDeclaration(node: N.ExportNamedDeclaration): void {
    this.parseStatement(true);
  }

  isExportDefaultSpecifier(): boolean {
    if (this.match(tt.name)) {
      return this.state.value !== "async";
    }

    if (!this.match(tt._default)) {
      return false;
    }

    const lookahead = this.lookahead();
    return (
      lookahead.type === tt.comma || (lookahead.type === tt.name && lookahead.value === "from")
    );
  }

  parseExportSpecifiersMaybe(node: N.ExportNamedDeclaration): void {
    if (this.eat(tt.comma)) {
      node.specifiers = node.specifiers.concat(this.parseExportSpecifiers());
    }
  }

  parseExportFrom(node: N.ExportNamedDeclaration, expect?: boolean): void {
    if (this.eatContextual("from")) {
      node.source = this.match(tt.string) ? (this.parseExprAtom() as N.Literal) : this.unexpected();
    } else if (expect) {
      this.unexpected();
    } else {
      node.source = null;
    }

    this.semicolon();
  }

  shouldParseExportStar(): boolean {
    return this.match(tt.star);
  }

  parseExportStar(node: N.ExportNamedDeclaration): void {
    this.expect(tt.star);

    if (this.isContextual("as")) {
      this.parseExportNamespace(node);
    } else {
      this.parseExportFrom(node, true);
      this.finishNode(node, "ExportAllDeclaration");
    }
  }

  parseExportNamespace(node: N.ExportNamedDeclaration): void {
    this.expectPlugin("exportNamespaceFrom");

    const specifier = this.startNodeAt<N.ExportSpecifier>(
      this.state.lastTokStart,
      this.state.lastTokStartLoc,
    );

    this.next();
    this.state.tokens[this.state.tokens.length - 1].type = tt._as;

    specifier.exported = this.parseIdentifier(true);

    node.specifiers = [this.finishNode(specifier, "ExportNamespaceSpecifier")];

    this.parseExportSpecifiersMaybe(node);
    this.parseExportFrom(node, true);
  }

  shouldParseExportDeclaration(): boolean {
    return (
      this.state.type.keyword === "var" ||
      this.state.type.keyword === "const" ||
      this.state.type.keyword === "let" ||
      this.state.type.keyword === "function" ||
      this.state.type.keyword === "class" ||
      this.isContextual("async") ||
      (this.match(tt.at) && this.expectPlugin("decorators2"))
    );
  }

  // Parses a comma-separated list of module exports.

  parseExportSpecifiers(): Array<N.ExportSpecifier> {
    const nodes: Array<N.ExportSpecifier> = [];
    let first = true;
    let needsFrom;

    // export { x, y as z } [from '...']
    this.expect(tt.braceL);

    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(tt.braceR)) break;
      }

      const isDefault = this.match(tt._default);
      if (isDefault && !needsFrom) needsFrom = true;

      const node = this.startNode<N.ExportSpecifier>();
      node.local = this.parseIdentifier(isDefault);
      this.state.tokens[this.state.tokens.length - 1].identifierRole = IdentifierRole.ExportAccess;
      node.exported = this.eatContextual("as") ? this.parseIdentifier(true) : node.local.__clone();
      nodes.push(this.finishNode(node, "ExportSpecifier"));
    }

    // https://github.com/ember-cli/ember-cli/pull/3739
    if (needsFrom && !this.isContextual("from")) {
      this.unexpected();
    }

    return nodes;
  }

  // Parses import declaration.

  parseImport(node: N.Node): N.ImportDeclaration | N.TsImportEqualsDeclaration {
    // import '...'
    if (this.match(tt.string)) {
      node.specifiers = [];
      node.source = this.parseExprAtom();
    } else {
      node.specifiers = [];
      this.parseImportSpecifiers(node as N.ImportDeclaration);
      this.expectContextual("from");
      node.source = this.match(tt.string) ? this.parseExprAtom() : this.unexpected();
    }
    this.semicolon();
    return this.finishNode(node as N.ImportDeclaration, "ImportDeclaration");
  }

  // eslint-disable-next-line no-unused-vars
  shouldParseDefaultImport(node: N.ImportDeclaration): boolean {
    return this.match(tt.name);
  }

  parseImportSpecifierLocal(node: N.ImportDeclaration, specifier: N.Node, type: string): void {
    specifier.local = this.parseIdentifier();
    node.specifiers.push(this.finishNode(specifier as N.ImportDefaultSpecifier, type));
  }

  // Parses a comma-separated list of module imports.
  parseImportSpecifiers(node: N.ImportDeclaration): void {
    let first = true;
    if (this.shouldParseDefaultImport(node)) {
      // import defaultObj, { x, y as z } from '...'
      this.parseImportSpecifierLocal(node, this.startNode(), "ImportDefaultSpecifier");

      if (!this.eat(tt.comma)) return;
    }

    if (this.match(tt.star)) {
      const specifier = this.startNode();
      this.next();
      this.expectContextual("as");

      this.parseImportSpecifierLocal(node, specifier, "ImportNamespaceSpecifier");

      return;
    }

    this.expect(tt.braceL);
    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        // Detect an attempt to deep destructure
        if (this.eat(tt.colon)) {
          this.unexpected(
            null,
            "ES2015 named imports do not destructure. Use another statement for destructuring after the import.",
          );
        }

        this.expect(tt.comma);
        if (this.eat(tt.braceR)) break;
      }

      this.parseImportSpecifier(node);
    }
  }

  parseImportSpecifier(node: N.ImportDeclaration): void {
    const specifier = this.startNode();
    specifier.imported = this.parseIdentifier(true);
    if (this.eatContextual("as")) {
      specifier.local = this.parseIdentifier();
    } else {
      specifier.local = specifier.imported.__clone();
    }
    node.specifiers.push(this.finishNode(specifier as N.ImportSpecifier, "ImportSpecifier"));
  }
}
