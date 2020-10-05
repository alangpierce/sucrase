/* eslint max-len: 0 */

import {File} from "../index";
import {
  flowAfterParseClassSuper,
  flowAfterParseVarHead,
  flowParseExportDeclaration,
  flowParseExportStar,
  flowParseIdentifierStatement,
  flowParseImportSpecifier,
  flowParseTypeAnnotation,
  flowParseTypeParameterDeclaration,
  flowShouldDisallowExportDefaultSpecifier,
  flowShouldParseExportDeclaration,
  flowShouldParseExportStar,
  flowStartParseFunctionParams,
  flowStartParseImportSpecifiers,
  flowTryParseStatement,
} from "../plugins/flow";
import {
  tsAfterParseClassSuper,
  tsAfterParseVarHead,
  tsIsDeclarationStart,
  tsParseAccessModifier,
  tsParseExportDeclaration,
  tsParseIdentifierStatement,
  tsParseImportEqualsDeclaration,
  tsParseMaybeDecoratorArguments,
  tsStartParseFunctionParams,
  tsTryParseClassMemberWithIsStatic,
  tsTryParseExport,
  tsTryParseExportDefaultExpression,
  tsTryParseStatementContent,
  tsTryParseTypeAnnotation,
  tsTryParseTypeParameters,
} from "../plugins/typescript";
import {
  eat,
  IdentifierRole,
  lookaheadType,
  lookaheadTypeAndKeyword,
  match,
  next,
  nextTokenStart,
  nextTokenStartSince,
  popTypeContext,
  pushTypeContext,
} from "../tokenizer";
import {ContextualKeyword} from "../tokenizer/keywords";
import {Scope} from "../tokenizer/state";
import {TokenType, TokenType as tt} from "../tokenizer/types";
import {charCodes} from "../util/charcodes";
import {getNextContextId, input, isFlowEnabled, isTypeScriptEnabled, state} from "./base";
import {
  parseCallExpressionArguments,
  parseExprAtom,
  parseExpression,
  parseExprSubscripts,
  parseFunctionBodyAndFinish,
  parseIdentifier,
  parseMaybeAssign,
  parseMethod,
  parseParenExpression,
  parsePropertyName,
} from "./expression";
import {
  parseBindingAtom,
  parseBindingIdentifier,
  parseBindingList,
  parseImportedIdentifier,
} from "./lval";
import {
  canInsertSemicolon,
  eatContextual,
  expect,
  expectContextual,
  isContextual,
  isLineTerminator,
  semicolon,
  unexpected,
} from "./util";

export function parseTopLevel(): File {
  parseBlockBody(tt.eof);
  state.scopes.push(new Scope(0, state.tokens.length, true));
  if (state.scopeDepth !== 0) {
    throw new Error(`Invalid scope depth at end of file: ${state.scopeDepth}`);
  }
  return new File(state.tokens, state.scopes);
}

// Parse a single statement.
//
// If expecting a statement and finding a slash operator, parse a
// regular expression literal. This is to handle cases like
// `if (foo) /blah/.exec(foo)`, where looking at the previous token
// does not help.

export function parseStatement(declaration: boolean): void {
  if (isFlowEnabled) {
    if (flowTryParseStatement()) {
      return;
    }
  }
  if (match(tt.at)) {
    parseDecorators();
  }
  parseStatementContent(declaration);
}

function parseStatementContent(declaration: boolean): void {
  if (isTypeScriptEnabled) {
    if (tsTryParseStatementContent()) {
      return;
    }
  }

  const starttype = state.type;

  // Most types of statements are recognized by the keyword they
  // start with. Many are trivial to parse, some require a bit of
  // complexity.

  switch (starttype) {
    case tt._break:
    case tt._continue:
      parseBreakContinueStatement();
      return;
    case tt._debugger:
      parseDebuggerStatement();
      return;
    case tt._do:
      parseDoStatement();
      return;
    case tt._for:
      parseForStatement();
      return;
    case tt._function:
      if (lookaheadType() === tt.dot) break;
      if (!declaration) unexpected();
      parseFunctionStatement();
      return;

    case tt._class:
      if (!declaration) unexpected();
      parseClass(true);
      return;

    case tt._if:
      parseIfStatement();
      return;
    case tt._return:
      parseReturnStatement();
      return;
    case tt._switch:
      parseSwitchStatement();
      return;
    case tt._throw:
      parseThrowStatement();
      return;
    case tt._try:
      parseTryStatement();
      return;

    case tt._let:
    case tt._const:
      if (!declaration) unexpected(); // NOTE: falls through to _var

    case tt._var:
      parseVarStatement(starttype);
      return;

    case tt._while:
      parseWhileStatement();
      return;
    case tt.braceL:
      parseBlock();
      return;
    case tt.semi:
      parseEmptyStatement();
      return;
    case tt._export:
    case tt._import: {
      const nextType = lookaheadType();
      if (nextType === tt.parenL || nextType === tt.dot) {
        break;
      }
      next();
      if (starttype === tt._import) {
        parseImport();
      } else {
        parseExport();
      }
      return;
    }
    case tt.name:
      if (state.contextualKeyword === ContextualKeyword._async) {
        const functionStart = state.start;
        // peek ahead and see if next token is a function
        const snapshot = state.snapshot();
        next();
        if (match(tt._function) && !canInsertSemicolon()) {
          expect(tt._function);
          parseFunction(functionStart, true);
          return;
        } else {
          state.restoreFromSnapshot(snapshot);
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
  const initialTokensLength = state.tokens.length;
  parseExpression();
  let simpleName = null;
  if (state.tokens.length === initialTokensLength + 1) {
    const token = state.tokens[state.tokens.length - 1];
    if (token.type === tt.name) {
      simpleName = token.contextualKeyword;
    }
  }
  if (simpleName == null) {
    semicolon();
    return;
  }
  if (eat(tt.colon)) {
    parseLabeledStatement();
  } else {
    // This was an identifier, so we might want to handle flow/typescript-specific cases.
    parseIdentifierStatement(simpleName);
  }
}

export function parseDecorators(): void {
  while (match(tt.at)) {
    parseDecorator();
  }
}

function parseDecorator(): void {
  next();
  if (eat(tt.parenL)) {
    parseExpression();
    expect(tt.parenR);
  } else {
    parseIdentifier();
    while (eat(tt.dot)) {
      parseIdentifier();
    }
  }
  parseMaybeDecoratorArguments();
}

function parseMaybeDecoratorArguments(): void {
  if (isTypeScriptEnabled) {
    tsParseMaybeDecoratorArguments();
  } else {
    baseParseMaybeDecoratorArguments();
  }
}

export function baseParseMaybeDecoratorArguments(): void {
  if (eat(tt.parenL)) {
    parseCallExpressionArguments();
  }
}

function parseBreakContinueStatement(): void {
  next();
  if (!isLineTerminator()) {
    parseIdentifier();
    semicolon();
  }
}

function parseDebuggerStatement(): void {
  next();
  semicolon();
}

function parseDoStatement(): void {
  next();
  parseStatement(false);
  expect(tt._while);
  parseParenExpression();
  eat(tt.semi);
}

function parseForStatement(): void {
  state.scopeDepth++;
  const startTokenIndex = state.tokens.length;
  parseAmbiguousForStatement();
  const endTokenIndex = state.tokens.length;
  state.scopes.push(new Scope(startTokenIndex, endTokenIndex, false));
  state.scopeDepth--;
}

// Disambiguating between a `for` and a `for`/`in` or `for`/`of`
// loop is non-trivial. Basically, we have to parse the init `var`
// statement or expression, disallowing the `in` operator (see
// the second parameter to `parseExpression`), and then check
// whether the next token is `in` or `of`. When there is no init
// part (semicolon immediately after the opening parenthesis), it
// is a regular `for` loop.
function parseAmbiguousForStatement(): void {
  next();

  let forAwait = false;
  if (isContextual(ContextualKeyword._await)) {
    forAwait = true;
    next();
  }
  expect(tt.parenL);

  if (match(tt.semi)) {
    if (forAwait) {
      unexpected();
    }
    parseFor();
    return;
  }

  if (match(tt._var) || match(tt._let) || match(tt._const)) {
    const varKind = state.type;
    next();
    parseVar(true, varKind);
    if (match(tt._in) || isContextual(ContextualKeyword._of)) {
      parseForIn(forAwait);
      return;
    }
    parseFor();
    return;
  }

  parseExpression(true);
  if (match(tt._in) || isContextual(ContextualKeyword._of)) {
    parseForIn(forAwait);
    return;
  }
  if (forAwait) {
    unexpected();
  }
  parseFor();
}

function parseFunctionStatement(): void {
  const functionStart = state.start;
  next();
  parseFunction(functionStart, true);
}

function parseIfStatement(): void {
  next();
  parseParenExpression();
  parseStatement(false);
  if (eat(tt._else)) {
    parseStatement(false);
  }
}

function parseReturnStatement(): void {
  next();

  // In `return` (and `break`/`continue`), the keywords with
  // optional arguments, we eagerly look for a semicolon or the
  // possibility to insert one.

  if (!isLineTerminator()) {
    parseExpression();
    semicolon();
  }
}

function parseSwitchStatement(): void {
  next();
  parseParenExpression();
  state.scopeDepth++;
  const startTokenIndex = state.tokens.length;
  expect(tt.braceL);

  // Don't bother validation; just go through any sequence of cases, defaults, and statements.
  while (!match(tt.braceR) && !state.error) {
    if (match(tt._case) || match(tt._default)) {
      const isCase = match(tt._case);
      next();
      if (isCase) {
        parseExpression();
      }
      expect(tt.colon);
    } else {
      parseStatement(true);
    }
  }
  next(); // Closing brace
  const endTokenIndex = state.tokens.length;
  state.scopes.push(new Scope(startTokenIndex, endTokenIndex, false));
  state.scopeDepth--;
}

function parseThrowStatement(): void {
  next();
  parseExpression();
  semicolon();
}

function parseCatchClauseParam(): void {
  parseBindingAtom(true /* isBlockScope */);

  if (isTypeScriptEnabled) {
    tsTryParseTypeAnnotation();
  }
}

function parseTryStatement(): void {
  next();

  parseBlock();

  if (match(tt._catch)) {
    next();
    let catchBindingStartTokenIndex = null;
    if (match(tt.parenL)) {
      state.scopeDepth++;
      catchBindingStartTokenIndex = state.tokens.length;
      expect(tt.parenL);
      parseCatchClauseParam();
      expect(tt.parenR);
    }
    parseBlock();
    if (catchBindingStartTokenIndex != null) {
      // We need a special scope for the catch binding which includes the binding itself and the
      // catch block.
      const endTokenIndex = state.tokens.length;
      state.scopes.push(new Scope(catchBindingStartTokenIndex, endTokenIndex, false));
      state.scopeDepth--;
    }
  }
  if (eat(tt._finally)) {
    parseBlock();
  }
}

export function parseVarStatement(kind: TokenType): void {
  next();
  parseVar(false, kind);
  semicolon();
}

function parseWhileStatement(): void {
  next();
  parseParenExpression();
  parseStatement(false);
}

function parseEmptyStatement(): void {
  next();
}

function parseLabeledStatement(): void {
  parseStatement(true);
}

/**
 * Parse a statement starting with an identifier of the given name. Subclasses match on the name
 * to handle statements like "declare".
 */
function parseIdentifierStatement(contextualKeyword: ContextualKeyword): void {
  if (isTypeScriptEnabled) {
    tsParseIdentifierStatement(contextualKeyword);
  } else if (isFlowEnabled) {
    flowParseIdentifierStatement(contextualKeyword);
  } else {
    semicolon();
  }
}

// Parse a semicolon-enclosed block of statements, handling `"use
// strict"` declarations when `allowStrict` is true (used for
// function bodies).

export function parseBlock(
  allowDirectives: boolean = false,
  isFunctionScope: boolean = false,
  contextId: number = 0,
): void {
  const startTokenIndex = state.tokens.length;
  state.scopeDepth++;
  expect(tt.braceL);
  if (contextId) {
    state.tokens[state.tokens.length - 1].contextId = contextId;
  }
  parseBlockBody(tt.braceR);
  if (contextId) {
    state.tokens[state.tokens.length - 1].contextId = contextId;
  }
  const endTokenIndex = state.tokens.length;
  state.scopes.push(new Scope(startTokenIndex, endTokenIndex, isFunctionScope));
  state.scopeDepth--;
}

export function parseBlockBody(end: TokenType): void {
  while (!eat(end) && !state.error) {
    parseStatement(true);
  }
}

// Parse a regular `for` loop. The disambiguation code in
// `parseStatement` will already have parsed the init statement or
// expression.

function parseFor(): void {
  expect(tt.semi);
  if (!match(tt.semi)) {
    parseExpression();
  }
  expect(tt.semi);
  if (!match(tt.parenR)) {
    parseExpression();
  }
  expect(tt.parenR);
  parseStatement(false);
}

// Parse a `for`/`in` and `for`/`of` loop, which are almost
// same from parser's perspective.

function parseForIn(forAwait: boolean): void {
  if (forAwait) {
    eatContextual(ContextualKeyword._of);
  } else {
    next();
  }
  parseExpression();
  expect(tt.parenR);
  parseStatement(false);
}

// Parse a list of variable declarations.

function parseVar(isFor: boolean, kind: TokenType): void {
  while (true) {
    const isBlockScope = kind === tt._const || kind === tt._let;
    parseVarHead(isBlockScope);
    if (eat(tt.eq)) {
      const eqIndex = state.tokens.length - 1;
      parseMaybeAssign(isFor);
      state.tokens[eqIndex].rhsEndIndex = state.tokens.length;
    }
    if (!eat(tt.comma)) {
      break;
    }
  }
}

function parseVarHead(isBlockScope: boolean): void {
  parseBindingAtom(isBlockScope);
  if (isTypeScriptEnabled) {
    tsAfterParseVarHead();
  } else if (isFlowEnabled) {
    flowAfterParseVarHead();
  }
}

// Parse a function declaration or literal (depending on the
// `isStatement` parameter).

export function parseFunction(
  functionStart: number,
  isStatement: boolean,
  optionalId: boolean = false,
): void {
  if (match(tt.star)) {
    next();
  }

  if (isStatement && !optionalId && !match(tt.name) && !match(tt._yield)) {
    unexpected();
  }

  let nameScopeStartTokenIndex = null;

  if (match(tt.name)) {
    // Expression-style functions should limit their name's scope to the function body, so we make
    // a new function scope to enforce that.
    if (!isStatement) {
      nameScopeStartTokenIndex = state.tokens.length;
      state.scopeDepth++;
    }
    parseBindingIdentifier(false);
  }

  const startTokenIndex = state.tokens.length;
  state.scopeDepth++;
  parseFunctionParams();
  parseFunctionBodyAndFinish(functionStart);
  const endTokenIndex = state.tokens.length;
  // In addition to the block scope of the function body, we need a separate function-style scope
  // that includes the params.
  state.scopes.push(new Scope(startTokenIndex, endTokenIndex, true));
  state.scopeDepth--;
  if (nameScopeStartTokenIndex !== null) {
    state.scopes.push(new Scope(nameScopeStartTokenIndex, endTokenIndex, true));
    state.scopeDepth--;
  }
}

export function parseFunctionParams(
  allowModifiers: boolean = false,
  funcContextId: number = 0,
): void {
  if (isTypeScriptEnabled) {
    tsStartParseFunctionParams();
  } else if (isFlowEnabled) {
    flowStartParseFunctionParams();
  }

  expect(tt.parenL);
  if (funcContextId) {
    state.tokens[state.tokens.length - 1].contextId = funcContextId;
  }
  parseBindingList(
    tt.parenR,
    false /* isBlockScope */,
    false /* allowEmpty */,
    allowModifiers,
    funcContextId,
  );
  if (funcContextId) {
    state.tokens[state.tokens.length - 1].contextId = funcContextId;
  }
}

// Parse a class declaration or literal (depending on the
// `isStatement` parameter).

export function parseClass(isStatement: boolean, optionalId: boolean = false): void {
  // Put a context ID on the class keyword, the open-brace, and the close-brace, so that later
  // code can easily navigate to meaningful points on the class.
  const contextId = getNextContextId();

  next();
  state.tokens[state.tokens.length - 1].contextId = contextId;
  state.tokens[state.tokens.length - 1].isExpression = !isStatement;
  // Like with functions, we declare a special "name scope" from the start of the name to the end
  // of the class, but only with expression-style classes, to represent the fact that the name is
  // available to the body of the class but not an outer declaration.
  let nameScopeStartTokenIndex = null;
  if (!isStatement) {
    nameScopeStartTokenIndex = state.tokens.length;
    state.scopeDepth++;
  }
  parseClassId(isStatement, optionalId);
  parseClassSuper();
  const openBraceIndex = state.tokens.length;
  parseClassBody(contextId);
  if (state.error) {
    return;
  }
  state.tokens[openBraceIndex].contextId = contextId;
  state.tokens[state.tokens.length - 1].contextId = contextId;
  if (nameScopeStartTokenIndex !== null) {
    const endTokenIndex = state.tokens.length;
    state.scopes.push(new Scope(nameScopeStartTokenIndex, endTokenIndex, false));
    state.scopeDepth--;
  }
}

function isClassProperty(): boolean {
  return match(tt.eq) || match(tt.semi) || match(tt.braceR) || match(tt.bang) || match(tt.colon);
}

function isClassMethod(): boolean {
  return match(tt.parenL) || match(tt.lessThan);
}

function parseClassBody(classContextId: number): void {
  expect(tt.braceL);

  while (!eat(tt.braceR) && !state.error) {
    if (eat(tt.semi)) {
      continue;
    }

    if (match(tt.at)) {
      parseDecorator();
      continue;
    }
    const memberStart = state.start;
    parseClassMember(memberStart, classContextId);
  }
}

function parseClassMember(memberStart: number, classContextId: number): void {
  if (isTypeScriptEnabled) {
    eatContextual(ContextualKeyword._declare);
    tsParseAccessModifier();
    eatContextual(ContextualKeyword._declare);
  }
  let isStatic = false;
  if (match(tt.name) && state.contextualKeyword === ContextualKeyword._static) {
    parseIdentifier(); // eats 'static'
    if (isClassMethod()) {
      parseClassMethod(memberStart, /* isConstructor */ false);
      return;
    } else if (isClassProperty()) {
      parseClassProperty();
      return;
    }
    // otherwise something static
    state.tokens[state.tokens.length - 1].type = tt._static;
    isStatic = true;
  }

  parseClassMemberWithIsStatic(memberStart, isStatic, classContextId);
}

function parseClassMemberWithIsStatic(
  memberStart: number,
  isStatic: boolean,
  classContextId: number,
): void {
  if (isTypeScriptEnabled) {
    if (tsTryParseClassMemberWithIsStatic(isStatic, classContextId)) {
      return;
    }
  }
  if (eat(tt.star)) {
    // a generator
    parseClassPropertyName(classContextId);
    parseClassMethod(memberStart, /* isConstructor */ false);
    return;
  }

  // Get the identifier name so we can tell if it's actually a keyword like "async", "get", or
  // "set".
  parseClassPropertyName(classContextId);
  let isConstructor = false;
  const token = state.tokens[state.tokens.length - 1];
  // We allow "constructor" as either an identifier or a string.
  if (token.contextualKeyword === ContextualKeyword._constructor) {
    isConstructor = true;
  }
  parsePostMemberNameModifiers();

  if (isClassMethod()) {
    parseClassMethod(memberStart, isConstructor);
  } else if (isClassProperty()) {
    parseClassProperty();
  } else if (token.contextualKeyword === ContextualKeyword._async && !isLineTerminator()) {
    state.tokens[state.tokens.length - 1].type = tt._async;
    // an async method
    const isGenerator = match(tt.star);
    if (isGenerator) {
      next();
    }

    // The so-called parsed name would have been "async": get the real name.
    parseClassPropertyName(classContextId);
    parsePostMemberNameModifiers();
    parseClassMethod(memberStart, false /* isConstructor */);
  } else if (
    (token.contextualKeyword === ContextualKeyword._get ||
      token.contextualKeyword === ContextualKeyword._set) &&
    !(isLineTerminator() && match(tt.star))
  ) {
    if (token.contextualKeyword === ContextualKeyword._get) {
      state.tokens[state.tokens.length - 1].type = tt._get;
    } else {
      state.tokens[state.tokens.length - 1].type = tt._set;
    }
    // `get\n*` is an uninitialized property named 'get' followed by a generator.
    // a getter or setter
    // The so-called parsed name would have been "get/set": get the real name.
    parseClassPropertyName(classContextId);
    parseClassMethod(memberStart, /* isConstructor */ false);
  } else if (isLineTerminator()) {
    // an uninitialized class property (due to ASI, since we don't otherwise recognize the next token)
    parseClassProperty();
  } else {
    unexpected();
  }
}

function parseClassMethod(functionStart: number, isConstructor: boolean): void {
  if (isTypeScriptEnabled) {
    tsTryParseTypeParameters();
  } else if (isFlowEnabled) {
    if (match(tt.lessThan)) {
      flowParseTypeParameterDeclaration();
    }
  }
  parseMethod(functionStart, isConstructor);
}

// Return the name of the class property, if it is a simple identifier.
export function parseClassPropertyName(classContextId: number): void {
  parsePropertyName(classContextId);
}

export function parsePostMemberNameModifiers(): void {
  if (isTypeScriptEnabled) {
    const oldIsType = pushTypeContext(0);
    eat(tt.question);
    popTypeContext(oldIsType);
  }
}

export function parseClassProperty(): void {
  if (isTypeScriptEnabled) {
    eat(tt.bang);
    tsTryParseTypeAnnotation();
  } else if (isFlowEnabled) {
    if (match(tt.colon)) {
      flowParseTypeAnnotation();
    }
  }

  if (match(tt.eq)) {
    const equalsTokenIndex = state.tokens.length;
    next();
    parseMaybeAssign();
    state.tokens[equalsTokenIndex].rhsEndIndex = state.tokens.length;
  }
  semicolon();
}

function parseClassId(isStatement: boolean, optionalId: boolean = false): void {
  if (
    isTypeScriptEnabled &&
    (!isStatement || optionalId) &&
    isContextual(ContextualKeyword._implements)
  ) {
    return;
  }

  if (match(tt.name)) {
    parseBindingIdentifier(true);
  }

  if (isTypeScriptEnabled) {
    tsTryParseTypeParameters();
  } else if (isFlowEnabled) {
    if (match(tt.lessThan)) {
      flowParseTypeParameterDeclaration();
    }
  }
}

// Returns true if there was a superclass.
function parseClassSuper(): void {
  let hasSuper = false;
  if (eat(tt._extends)) {
    parseExprSubscripts();
    hasSuper = true;
  } else {
    hasSuper = false;
  }
  if (isTypeScriptEnabled) {
    tsAfterParseClassSuper(hasSuper);
  } else if (isFlowEnabled) {
    flowAfterParseClassSuper(hasSuper);
  }
}

// Parses module export declaration.

export function parseExport(): void {
  const exportIndex = state.tokens.length - 1;
  if (isTypeScriptEnabled) {
    if (tsTryParseExport()) {
      return;
    }
  }
  // export * from '...'
  if (shouldParseExportStar()) {
    parseExportStar();
  } else if (isExportDefaultSpecifier()) {
    // export default from
    parseIdentifier();
    if (match(tt.comma) && lookaheadType() === tt.star) {
      expect(tt.comma);
      expect(tt.star);
      expectContextual(ContextualKeyword._as);
      parseIdentifier();
    } else {
      parseExportSpecifiersMaybe();
    }
    parseExportFrom();
  } else if (eat(tt._default)) {
    // export default ...
    parseExportDefaultExpression();
  } else if (shouldParseExportDeclaration()) {
    parseExportDeclaration();
  } else {
    // export { x, y as z } [from '...']
    parseExportSpecifiers();
    parseExportFrom();
  }
  state.tokens[exportIndex].rhsEndIndex = state.tokens.length;
}

function parseExportDefaultExpression(): void {
  if (isTypeScriptEnabled) {
    if (tsTryParseExportDefaultExpression()) {
      return;
    }
  }
  const functionStart = state.start;
  if (eat(tt._function)) {
    parseFunction(functionStart, true, true);
  } else if (isContextual(ContextualKeyword._async) && lookaheadType() === tt._function) {
    // async function declaration
    eatContextual(ContextualKeyword._async);
    eat(tt._function);
    parseFunction(functionStart, true, true);
  } else if (match(tt._class)) {
    parseClass(true, true);
  } else if (match(tt.at)) {
    parseDecorators();
    parseClass(true, true);
  } else {
    parseMaybeAssign();
    semicolon();
  }
}

function parseExportDeclaration(): void {
  if (isTypeScriptEnabled) {
    tsParseExportDeclaration();
  } else if (isFlowEnabled) {
    flowParseExportDeclaration();
  } else {
    parseStatement(true);
  }
}

function isExportDefaultSpecifier(): boolean {
  if (isTypeScriptEnabled && tsIsDeclarationStart()) {
    return false;
  } else if (isFlowEnabled && flowShouldDisallowExportDefaultSpecifier()) {
    return false;
  }
  if (match(tt.name)) {
    return state.contextualKeyword !== ContextualKeyword._async;
  }

  if (!match(tt._default)) {
    return false;
  }

  const _next = nextTokenStart();
  const lookahead = lookaheadTypeAndKeyword();
  const hasFrom =
    lookahead.type === tt.name && lookahead.contextualKeyword === ContextualKeyword._from;
  if (lookahead.type === tt.comma) {
    return true;
  }
  // lookahead again when `export default from` is seen
  if (hasFrom) {
    const nextAfterFrom = input.charCodeAt(nextTokenStartSince(_next + 4));
    return nextAfterFrom === charCodes.quotationMark || nextAfterFrom === charCodes.apostrophe;
  }
  return false;
}

function parseExportSpecifiersMaybe(): void {
  if (eat(tt.comma)) {
    parseExportSpecifiers();
  }
}

export function parseExportFrom(): void {
  if (eatContextual(ContextualKeyword._from)) {
    parseExprAtom();
  }
  semicolon();
}

function shouldParseExportStar(): boolean {
  if (isFlowEnabled) {
    return flowShouldParseExportStar();
  } else {
    return match(tt.star);
  }
}

function parseExportStar(): void {
  if (isFlowEnabled) {
    flowParseExportStar();
  } else {
    baseParseExportStar();
  }
}

export function baseParseExportStar(): void {
  expect(tt.star);

  if (isContextual(ContextualKeyword._as)) {
    parseExportNamespace();
  } else {
    parseExportFrom();
  }
}

function parseExportNamespace(): void {
  next();
  state.tokens[state.tokens.length - 1].type = tt._as;
  parseIdentifier();
  parseExportSpecifiersMaybe();
  parseExportFrom();
}

function shouldParseExportDeclaration(): boolean {
  return (
    (isTypeScriptEnabled && tsIsDeclarationStart()) ||
    (isFlowEnabled && flowShouldParseExportDeclaration()) ||
    state.type === tt._var ||
    state.type === tt._const ||
    state.type === tt._let ||
    state.type === tt._function ||
    state.type === tt._class ||
    isContextual(ContextualKeyword._async) ||
    match(tt.at)
  );
}

// Parses a comma-separated list of module exports.
export function parseExportSpecifiers(): void {
  let first = true;

  // export { x, y as z } [from '...']
  expect(tt.braceL);

  while (!eat(tt.braceR) && !state.error) {
    if (first) {
      first = false;
    } else {
      expect(tt.comma);
      if (eat(tt.braceR)) {
        break;
      }
    }

    parseIdentifier();
    state.tokens[state.tokens.length - 1].identifierRole = IdentifierRole.ExportAccess;
    if (eatContextual(ContextualKeyword._as)) {
      parseIdentifier();
    }
  }
}

// Parses import declaration.

export function parseImport(): void {
  if (isTypeScriptEnabled && match(tt.name) && lookaheadType() === tt.eq) {
    tsParseImportEqualsDeclaration();
    return;
  }
  if (isTypeScriptEnabled) {
    eatContextual(ContextualKeyword._type);
  }

  // import '...'
  if (match(tt.string)) {
    parseExprAtom();
  } else {
    parseImportSpecifiers();
    expectContextual(ContextualKeyword._from);
    parseExprAtom();
  }
  semicolon();
}

// eslint-disable-next-line no-unused-vars
function shouldParseDefaultImport(): boolean {
  return match(tt.name);
}

function parseImportSpecifierLocal(): void {
  parseImportedIdentifier();
}

// Parses a comma-separated list of module imports.
function parseImportSpecifiers(): void {
  if (isFlowEnabled) {
    flowStartParseImportSpecifiers();
  }

  let first = true;
  if (shouldParseDefaultImport()) {
    // import defaultObj, { x, y as z } from '...'
    parseImportSpecifierLocal();

    if (!eat(tt.comma)) return;
  }

  if (match(tt.star)) {
    next();
    expectContextual(ContextualKeyword._as);

    parseImportSpecifierLocal();

    return;
  }

  expect(tt.braceL);
  while (!eat(tt.braceR) && !state.error) {
    if (first) {
      first = false;
    } else {
      // Detect an attempt to deep destructure
      if (eat(tt.colon)) {
        unexpected(
          "ES2015 named imports do not destructure. Use another statement for destructuring after the import.",
        );
      }

      expect(tt.comma);
      if (eat(tt.braceR)) {
        break;
      }
    }

    parseImportSpecifier();
  }
}

function parseImportSpecifier(): void {
  if (isFlowEnabled) {
    flowParseImportSpecifier();
    return;
  }
  parseImportedIdentifier();
  if (isContextual(ContextualKeyword._as)) {
    state.tokens[state.tokens.length - 1].identifierRole = IdentifierRole.ImportAccess;
    next();
    parseImportedIdentifier();
  }
}
