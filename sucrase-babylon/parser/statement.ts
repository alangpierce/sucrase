/* eslint max-len: 0 */

import {File} from "../index";
import {IdentifierRole} from "../tokenizer";
import {TokenType, TokenType as tt} from "../tokenizer/types";
import ExpressionParser from "./expression";

export default class StatementParser extends ExpressionParser {
  // ### Statement parsing

  parseTopLevel(): File {
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
      this.parseDecorators();
    }
    this.parseStatementContent(declaration, topLevel);
  }

  parseStatementContent(declaration: boolean, topLevel: boolean): void {
    const starttype = this.state.type;

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
        if (this.lookaheadType() === tt.dot) break;
        if (!declaration) this.unexpected();
        this.parseFunctionStatement();
        return;

      case tt._class:
        if (!declaration) this.unexpected();
        this.parseClass(true);
        return;

      case tt._if:
        this.parseIfStatement();
        return;
      case tt._return:
        this.parseReturnStatement();
        return;
      case tt._switch:
        this.parseSwitchStatement();
        return;
      case tt._throw:
        this.parseThrowStatement();
        return;
      case tt._try:
        this.parseTryStatement();
        return;

      case tt._let:
      case tt._const:
        if (!declaration) this.unexpected(); // NOTE: falls through to _var

      case tt._var:
        this.parseVarStatement(starttype);
        return;

      case tt._while:
        this.parseWhileStatement();
        return;
      case tt.braceL:
        this.parseBlock();
        return;
      case tt.semi:
        this.parseEmptyStatement();
        return;
      case tt._export:
      case tt._import: {
        const nextType = this.lookaheadType();
        if (nextType === tt.parenL || nextType === tt.dot) {
          break;
        }
        this.next();
        if (starttype === tt._import) {
          this.parseImport();
        } else {
          this.parseExport();
        }
        return;
      }
      case tt.name:
        if (this.state.value === "async") {
          const functionStart = this.state.start;
          // peek ahead and see if next token is a function
          const snapshot = this.state.snapshot();
          this.next();
          if (this.match(tt._function) && !this.canInsertSemicolon()) {
            this.expect(tt._function);
            this.parseFunction(functionStart, true, false);
            return;
          } else {
            this.state.restoreFromSnapshot(snapshot);
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
    const initialTokensLength = this.state.tokens.length;
    this.parseExpression();
    let simpleName = null;
    if (this.state.tokens.length === initialTokensLength + 1) {
      const token = this.state.tokens[this.state.tokens.length - 1];
      if (token.type === tt.name) {
        simpleName = token.value;
      }
    }
    if (simpleName == null) {
      this.semicolon();
      return;
    }
    if (this.eat(tt.colon)) {
      this.parseLabeledStatement();
    } else {
      // This was an identifier, so we might want to handle flow/typescript-specific cases.
      this.parseIdentifierStatement(simpleName);
    }
  }

  parseDecorators(): void {
    while (this.match(tt.at)) {
      this.parseDecorator();
    }
  }

  parseDecorator(): void {
    this.next();
    this.parseIdentifier();
    while (this.eat(tt.dot)) {
      this.parseIdentifier();
    }
    if (this.eat(tt.parenL)) {
      this.parseCallExpressionArguments(tt.parenR);
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
    if (this.isContextual("await")) {
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
      const varKind = this.state.type;
      this.next();
      this.parseVar(true, varKind);
      if (this.match(tt._in) || this.isContextual("of")) {
        this.parseForIn(forAwait);
        return;
      }
      this.parseFor();
      return;
    }

    this.parseExpression(true);
    if (this.match(tt._in) || this.isContextual("of")) {
      this.parseForIn(forAwait);
      return;
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

  parseIfStatement(): void {
    this.next();
    this.parseParenExpression();
    this.parseStatement(false);
    if (this.eat(tt._else)) {
      this.parseStatement(false);
    }
  }

  parseReturnStatement(): void {
    this.next();

    // In `return` (and `break`/`continue`), the keywords with
    // optional arguments, we eagerly look for a semicolon or the
    // possibility to insert one.

    if (!this.isLineTerminator()) {
      this.parseExpression();
      this.semicolon();
    }
  }

  parseSwitchStatement(): void {
    this.next();
    this.parseParenExpression();
    const startTokenIndex = this.state.tokens.length;
    this.expect(tt.braceL);

    // Don't bother validation; just go through any sequence of cases, defaults, and statements.
    while (!this.match(tt.braceR)) {
      if (this.match(tt._case) || this.match(tt._default)) {
        const isCase = this.match(tt._case);
        this.next();
        if (isCase) {
          this.parseExpression();
        }
        this.expect(tt.colon);
      } else {
        this.parseStatement(true);
      }
    }
    this.next(); // Closing brace
    const endTokenIndex = this.state.tokens.length;
    this.state.scopes.push({startTokenIndex, endTokenIndex, isFunctionScope: false});
  }

  parseThrowStatement(): void {
    this.next();
    this.parseExpression();
    this.semicolon();
  }

  parseTryStatement(): void {
    this.next();

    this.parseBlock();

    if (this.match(tt._catch)) {
      this.next();
      let catchBindingStartTokenIndex = null;
      if (this.match(tt.parenL)) {
        catchBindingStartTokenIndex = this.state.tokens.length;
        this.expect(tt.parenL);
        this.parseBindingAtom(true /* isBlockScope */);
        this.expect(tt.parenR);
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
    }
    if (this.eat(tt._finally)) {
      this.parseBlock();
    }
  }

  parseVarStatement(kind: TokenType): void {
    this.next();
    this.parseVar(false, kind);
    this.semicolon();
  }

  parseWhileStatement(): void {
    this.next();
    this.parseParenExpression();
    this.parseStatement(false);
  }

  parseEmptyStatement(): void {
    this.next();
  }

  parseLabeledStatement(): void {
    this.parseStatement(true);
  }

  /**
   * Parse a statement starting with an identifier of the given name. Subclasses match on the name
   * to handle statements like "declare".
   */
  parseIdentifierStatement(name: string): void {
    this.semicolon();
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
    if (contextId) {
      this.state.tokens[this.state.tokens.length - 1].contextId = contextId;
    }
    this.parseBlockBody(false, tt.braceR);
    if (contextId) {
      this.state.tokens[this.state.tokens.length - 1].contextId = contextId;
    }
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

  parseVar(isFor: boolean, kind: TokenType): void {
    while (true) {
      const isBlockScope = kind === tt._const || kind === tt._let;
      this.parseVarHead(isBlockScope);
      if (this.eat(tt.eq)) {
        this.parseMaybeAssign(isFor);
      }
      if (!this.eat(tt.comma)) break;
    }
  }

  parseVarHead(isBlockScope: boolean): void {
    this.parseBindingAtom(isBlockScope);
  }

  // Parse a function declaration or literal (depending on the
  // `isStatement` parameter).

  parseFunction(
    functionStart: number,
    isStatement: boolean,
    allowExpressionBody?: boolean,
    optionalId?: boolean,
  ): void {
    let isGenerator = false;
    if (this.match(tt.star)) {
      isGenerator = true;
      this.next();
    }

    if (isStatement && !optionalId && !this.match(tt.name) && !this.match(tt._yield)) {
      this.unexpected();
    }

    let nameScopeStartTokenIndex = null;

    if (this.match(tt.name)) {
      // Expression-style functions should limit their name's scope to the function body, so we make
      // a new function scope to enforce that.
      if (!isStatement) {
        nameScopeStartTokenIndex = this.state.tokens.length;
      }
      this.parseBindingIdentifier();
      this.state.tokens[this.state.tokens.length - 1].identifierRole =
        IdentifierRole.FunctionScopedDeclaration;
    }

    const startTokenIndex = this.state.tokens.length;
    this.parseFunctionParams();
    this.parseFunctionBodyAndFinish(functionStart, isGenerator, allowExpressionBody);
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
  }

  parseFunctionParams(allowModifiers?: boolean, funcContextId?: number): void {
    this.expect(tt.parenL);
    if (funcContextId) {
      this.state.tokens[this.state.tokens.length - 1].contextId = funcContextId;
    }
    this.parseBindingList(
      tt.parenR,
      false /* isBlockScope */,
      false /* allowEmpty */,
      allowModifiers,
    );
    if (funcContextId) {
      this.state.tokens[this.state.tokens.length - 1].contextId = funcContextId;
    }
  }

  // Parse a class declaration or literal (depending on the
  // `isStatement` parameter).

  parseClass(isStatement: boolean, optionalId: boolean = false): void {
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
    this.parseClassId(isStatement, optionalId);
    this.parseClassSuper();
    const openBraceIndex = this.state.tokens.length;
    this.parseClassBody(contextId);
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
  }

  isClassProperty(): boolean {
    return this.match(tt.eq) || this.match(tt.semi) || this.match(tt.braceR);
  }

  isClassMethod(): boolean {
    return this.match(tt.parenL);
  }

  parseClassBody(classContextId: number): void {
    this.expect(tt.braceL);

    while (!this.eat(tt.braceR)) {
      if (this.eat(tt.semi)) {
        continue;
      }

      if (this.match(tt.at)) {
        this.parseDecorator();
        continue;
      }
      const memberStart = this.state.start;
      this.parseClassMember(memberStart, classContextId);
    }
  }

  parseClassMember(memberStart: number, classContextId: number): void {
    let isStatic = false;
    if (this.match(tt.name) && this.state.value === "static") {
      this.parseIdentifier(); // eats 'static'
      if (this.isClassMethod()) {
        this.parseClassMethod(memberStart, false, /* isConstructor */ false);
        return;
      } else if (this.isClassProperty()) {
        this.parseClassProperty();
        return;
      }
      // otherwise something static
      this.state.tokens[this.state.tokens.length - 1].type = tt._static;
      isStatic = true;
    }

    this.parseClassMemberWithIsStatic(memberStart, isStatic, classContextId);
  }

  parseClassMemberWithIsStatic(
    memberStart: number,
    isStatic: boolean,
    classContextId: number,
  ): void {
    if (this.eat(tt.star)) {
      // a generator
      this.parseClassPropertyName(classContextId);
      this.parseClassMethod(memberStart, true, /* isConstructor */ false);
      return;
    }

    // Get the identifier name so we can tell if it's actually a keyword like "async", "get", or
    // "set".
    this.parseClassPropertyName(classContextId);
    let simpleName = null;
    let isConstructor = false;
    const token = this.state.tokens[this.state.tokens.length - 1];
    if (token.type === tt.name) {
      simpleName = token.value;
    }
    // We allow "constructor" as either an identifier or a string.
    if (token.value === "constructor") {
      isConstructor = true;
    }
    this.parsePostMemberNameModifiers();

    if (this.isClassMethod()) {
      this.parseClassMethod(memberStart, false, isConstructor);
    } else if (this.isClassProperty()) {
      this.parseClassProperty();
    } else if (simpleName === "async" && !this.isLineTerminator()) {
      this.state.tokens[this.state.tokens.length - 1].type = tt._async;
      // an async method
      const isGenerator = this.match(tt.star);
      if (isGenerator) {
        this.next();
      }

      // The so-called parsed name would have been "async": get the real name.
      this.parseClassPropertyName(classContextId);
      this.parseClassMethod(memberStart, isGenerator, false /* isConstructor */);
    } else if (
      (simpleName === "get" || simpleName === "set") &&
      !(this.isLineTerminator() && this.match(tt.star))
    ) {
      if (simpleName === "get") {
        this.state.tokens[this.state.tokens.length - 1].type = tt._get;
      } else {
        this.state.tokens[this.state.tokens.length - 1].type = tt._set;
      }
      // `get\n*` is an uninitialized property named 'get' followed by a generator.
      // a getter or setter
      // The so-called parsed name would have been "get/set": get the real name.
      this.parseClassPropertyName(classContextId);
      this.parseClassMethod(memberStart, false, /* isConstructor */ false);
    } else if (this.isLineTerminator()) {
      // an uninitialized class property (due to ASI, since we don't otherwise recognize the next token)
      this.parseClassProperty();
    } else {
      this.unexpected();
    }
  }

  parseClassMethod(functionStart: number, isGenerator: boolean, isConstructor: boolean): void {
    this.parseMethod(functionStart, isGenerator, isConstructor);
  }

  // Return the name of the class property, if it is a simple identifier.
  parseClassPropertyName(classContextId: number): void {
    this.parsePropertyName(classContextId);
  }

  // Overridden in typescript.js
  parsePostMemberNameModifiers(): void {}

  parseClassProperty(): void {
    if (this.match(tt.eq)) {
      const equalsTokenIndex = this.state.tokens.length;
      this.next();
      this.parseMaybeAssign();
      this.state.tokens[equalsTokenIndex].rhsEndIndex = this.state.tokens.length;
    }
    this.semicolon();
  }

  parseClassId(isStatement: boolean, optionalId: boolean = false): void {
    if (this.match(tt.name)) {
      this.parseIdentifier();
      this.state.tokens[this.state.tokens.length - 1].identifierRole =
        IdentifierRole.BlockScopedDeclaration;
    }
  }

  // Returns true if there was a superclass.
  parseClassSuper(): boolean {
    if (this.eat(tt._extends)) {
      this.parseExprSubscripts();
      return true;
    }
    return false;
  }

  // Parses module export declaration.

  parseExport(): void {
    // export * from '...'
    if (this.shouldParseExportStar()) {
      this.parseExportStar();
    } else if (this.isExportDefaultSpecifier()) {
      // export default from
      this.parseIdentifier();
      if (this.match(tt.comma) && this.lookaheadType() === tt.star) {
        this.expect(tt.comma);
        this.expect(tt.star);
        this.expectContextual("as");
        this.parseIdentifier();
      } else {
        this.parseExportSpecifiersMaybe();
      }
      this.parseExportFrom();
    } else if (this.eat(tt._default)) {
      // export default ...
      this.parseExportDefaultExpression();
    } else if (this.shouldParseExportDeclaration()) {
      this.parseExportDeclaration();
    } else {
      // export { x, y as z } [from '...']
      this.parseExportSpecifiers();
      this.parseExportFrom();
    }
  }

  parseExportDefaultExpression(): void {
    const functionStart = this.state.start;
    if (this.eat(tt._function)) {
      this.parseFunction(functionStart, true, false, true);
    } else if (this.isContextual("async") && this.lookaheadType() === tt._function) {
      // async function declaration
      this.eatContextual("async");
      this.eat(tt._function);
      this.parseFunction(functionStart, true, false, true);
    } else if (this.match(tt._class)) {
      this.parseClass(true, true);
    } else {
      this.parseMaybeAssign();
      this.semicolon();
    }
  }

  // eslint-disable-next-line no-unused-vars
  parseExportDeclaration(): void {
    this.parseStatement(true);
  }

  isExportDefaultSpecifier(): boolean {
    if (this.match(tt.name)) {
      return this.state.value !== "async";
    }

    if (!this.match(tt._default)) {
      return false;
    }

    const lookahead = this.lookaheadTypeAndValue();
    return (
      lookahead.type === tt.comma || (lookahead.type === tt.name && lookahead.value === "from")
    );
  }

  parseExportSpecifiersMaybe(): void {
    if (this.eat(tt.comma)) {
      this.parseExportSpecifiers();
    }
  }

  parseExportFrom(): void {
    if (this.eatContextual("from")) {
      this.parseExprAtom();
    }
    this.semicolon();
  }

  shouldParseExportStar(): boolean {
    return this.match(tt.star);
  }

  parseExportStar(): void {
    this.expect(tt.star);

    if (this.isContextual("as")) {
      this.parseExportNamespace();
    } else {
      this.parseExportFrom();
    }
  }

  parseExportNamespace(): void {
    this.next();
    this.state.tokens[this.state.tokens.length - 1].type = tt._as;
    this.parseIdentifier();
    this.parseExportSpecifiersMaybe();
    this.parseExportFrom();
  }

  shouldParseExportDeclaration(): boolean {
    return (
      this.state.type === tt._var ||
      this.state.type === tt._const ||
      this.state.type === tt._let ||
      this.state.type === tt._function ||
      this.state.type === tt._class ||
      this.isContextual("async") ||
      this.match(tt.at)
    );
  }

  // Parses a comma-separated list of module exports.
  parseExportSpecifiers(): void {
    let first = true;

    // export { x, y as z } [from '...']
    this.expect(tt.braceL);

    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.eat(tt.braceR)) break;
      }

      this.parseIdentifier();
      this.state.tokens[this.state.tokens.length - 1].identifierRole = IdentifierRole.ExportAccess;
      if (this.eatContextual("as")) {
        this.parseIdentifier();
      }
    }
  }

  // Parses import declaration.

  parseImport(): void {
    // import '...'
    if (this.match(tt.string)) {
      this.parseExprAtom();
    } else {
      this.parseImportSpecifiers();
      this.expectContextual("from");
      this.parseExprAtom();
    }
    this.semicolon();
  }

  // eslint-disable-next-line no-unused-vars
  shouldParseDefaultImport(): boolean {
    return this.match(tt.name);
  }

  parseImportSpecifierLocal(): void {
    this.parseIdentifier();
  }

  // Parses a comma-separated list of module imports.
  parseImportSpecifiers(): void {
    let first = true;
    if (this.shouldParseDefaultImport()) {
      // import defaultObj, { x, y as z } from '...'
      this.parseImportSpecifierLocal();

      if (!this.eat(tt.comma)) return;
    }

    if (this.match(tt.star)) {
      this.next();
      this.expectContextual("as");

      this.parseImportSpecifierLocal();

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

      this.parseImportSpecifier();
    }
  }

  parseImportSpecifier(): void {
    this.parseIdentifier();
    if (this.eatContextual("as")) {
      this.parseIdentifier();
    }
  }
}
