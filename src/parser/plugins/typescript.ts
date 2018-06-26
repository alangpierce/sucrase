import {
  ContextualKeyword,
  eat,
  lookaheadType,
  lookaheadTypeAndKeyword,
  match,
  next,
  popTypeContext,
  pushTypeContext,
} from "../tokenizer/index";
import {TokenType, TokenType as tt} from "../tokenizer/types";
import {isJSXEnabled, state} from "../traverser/base";
import {
  atPossibleAsync,
  baseParseMaybeAssign,
  baseParseSubscript,
  parseCallExpressionArguments,
  parseExprAtom,
  parseExpression,
  parseFunctionBody,
  parseIdentifier,
  parseLiteral,
  parseMaybeAssign,
  parseMaybeUnary,
  parsePropertyName,
  StopState,
} from "../traverser/expression";
import {parseBindingList} from "../traverser/lval";
import {
  parseBlockBody,
  parseClass,
  parseClassProperty,
  parseClassPropertyName,
  parseFunction,
  parseFunctionParams,
  parsePostMemberNameModifiers,
  parseStatement,
  parseVarStatement,
} from "../traverser/statement";
import {
  canInsertSemicolon,
  eatContextual,
  expect,
  expectContextual,
  hasPrecedingLineBreak,
  isContextual,
  isLineTerminator,
  isLookaheadContextual,
  semicolon,
  unexpected,
} from "../traverser/util";

function assert(x: boolean): void {
  if (!x) {
    throw new Error("Assert fail");
  }
}

export enum ParsingContext {
  EnumMembers,
  HeritageClauseElement,
  TupleElementTypes,
  TypeMembers,
  TypeParametersOrArguments,
}

function tsIsIdentifier(): boolean {
  // TODO: actually a bit more complex in TypeScript, but shouldn't matter.
  // See https://github.com/Microsoft/TypeScript/issues/15008
  return match(tt.name);
}

function tsNextTokenCanFollowModifier(): boolean {
  // Note: TypeScript's implementation is much more complicated because
  // more things are considered modifiers there.
  // This implementation only handles modifiers not handled by babylon itself. And "static".
  // TODO: Would be nice to avoid lookahead. Want a hasLineBreakUpNext() method...
  next();
  return (
    !hasPrecedingLineBreak() &&
    !match(tt.parenL) &&
    !match(tt.colon) &&
    !match(tt.eq) &&
    !match(tt.question)
  );
}

/** Parses a modifier matching one the given modifier names. */
export function tsParseModifier(
  allowedModifiers: Array<ContextualKeyword>,
): ContextualKeyword | null {
  if (!match(tt.name)) {
    return null;
  }

  const modifier = state.contextualKeyword;
  if (
    allowedModifiers.indexOf(modifier) !== -1 &&
    tsTryParse(() => tsNextTokenCanFollowModifier())
  ) {
    switch (modifier) {
      case ContextualKeyword._readonly:
        state.tokens[state.tokens.length - 1].type = tt._readonly;
        break;
      case ContextualKeyword._abstract:
        state.tokens[state.tokens.length - 1].type = tt._abstract;
        break;
      case ContextualKeyword._static:
        state.tokens[state.tokens.length - 1].type = tt._static;
        break;
      case ContextualKeyword._public:
        state.tokens[state.tokens.length - 1].type = tt._public;
        break;
      case ContextualKeyword._private:
        state.tokens[state.tokens.length - 1].type = tt._private;
        break;
      case ContextualKeyword._protected:
        state.tokens[state.tokens.length - 1].type = tt._protected;
        break;
      default:
        break;
    }
    return modifier;
  }
  return null;
}

function tsIsListTerminator(kind: ParsingContext): boolean {
  switch (kind) {
    case ParsingContext.EnumMembers:
    case ParsingContext.TypeMembers:
      return match(tt.braceR);
    case ParsingContext.HeritageClauseElement:
      return match(tt.braceL);
    case ParsingContext.TupleElementTypes:
      return match(tt.bracketR);
    case ParsingContext.TypeParametersOrArguments:
      return match(tt.greaterThan);
    default:
      break;
  }

  throw new Error("Unreachable");
}

function tsParseList(kind: ParsingContext, parseElement: () => void): void {
  while (!tsIsListTerminator(kind)) {
    // Skipping "parseListElement" from the TS source since that's just for error handling.
    parseElement();
  }
}

function tsParseDelimitedList(kind: ParsingContext, parseElement: () => void): void {
  tsParseDelimitedListWorker(kind, parseElement);
}

/**
 * If !expectSuccess, returns undefined instead of failing to parse.
 * If expectSuccess, parseElement should always return a defined value.
 */
function tsParseDelimitedListWorker(kind: ParsingContext, parseElement: () => void): void {
  while (true) {
    if (tsIsListTerminator(kind)) {
      break;
    }

    parseElement();
    if (eat(tt.comma)) {
      continue;
    }

    if (tsIsListTerminator(kind)) {
      break;
    }
  }
}

function tsParseBracketedList(
  kind: ParsingContext,
  parseElement: () => void,
  bracket: boolean,
  skipFirstToken: boolean,
): void {
  if (!skipFirstToken) {
    if (bracket) {
      expect(tt.bracketL);
    } else {
      expect(tt.lessThan);
    }
  }
  tsParseDelimitedList(kind, parseElement);
  if (bracket) {
    expect(tt.bracketR);
  } else {
    expect(tt.greaterThan);
  }
}

function tsParseEntityName(): void {
  parseIdentifier();
  while (eat(tt.dot)) {
    parseIdentifier();
  }
}

function tsParseTypeReference(): void {
  tsParseEntityName();
  if (!hasPrecedingLineBreak() && match(tt.lessThan)) {
    tsParseTypeArguments();
  }
}

function tsParseThisTypePredicate(): void {
  next();
  tsParseTypeAnnotation();
}

function tsParseThisTypeNode(): void {
  next();
}

function tsParseTypeQuery(): void {
  expect(tt._typeof);
  tsParseEntityName();
}

function tsParseTypeParameter(): void {
  parseIdentifier();
  if (eat(tt._extends)) {
    tsParseType();
  }
  if (eat(tt.eq)) {
    tsParseType();
  }
}

export function tsTryParseTypeParameters(): void {
  if (match(tt.lessThan)) {
    tsParseTypeParameters();
  }
}

function tsParseTypeParameters(): void {
  const oldIsType = pushTypeContext(0);
  if (match(tt.lessThan) || match(tt.typeParameterStart)) {
    next();
  } else {
    unexpected();
  }

  tsParseBracketedList(
    ParsingContext.TypeParametersOrArguments,
    tsParseTypeParameter,
    /* bracket */ false,
    /* skipFirstToken */ true,
  );
  popTypeContext(oldIsType);
}

// Note: In TypeScript implementation we must provide `yieldContext` and `awaitContext`,
// but here it's always false, because this is only used for types.
function tsFillSignature(returnToken: TokenType): void {
  // Arrow fns *must* have return token (`=>`). Normal functions can omit it.
  const returnTokenRequired = returnToken === tt.arrow;
  tsTryParseTypeParameters();
  expect(tt.parenL);
  tsParseBindingListForSignature(false /* isBlockScope */);
  if (returnTokenRequired) {
    tsParseTypeOrTypePredicateAnnotation(returnToken);
  } else if (match(returnToken)) {
    tsParseTypeOrTypePredicateAnnotation(returnToken);
  }
}

function tsParseBindingListForSignature(isBlockScope: boolean): void {
  parseBindingList(tt.parenR, isBlockScope);
}

function tsParseTypeMemberSemicolon(): void {
  if (!eat(tt.comma)) {
    semicolon();
  }
}

enum SignatureMemberKind {
  TSCallSignatureDeclaration,
  TSConstructSignatureDeclaration,
}

function tsParseSignatureMember(kind: SignatureMemberKind): void {
  if (kind === SignatureMemberKind.TSConstructSignatureDeclaration) {
    expect(tt._new);
  }
  tsFillSignature(tt.colon);
  tsParseTypeMemberSemicolon();
}

function tsIsUnambiguouslyIndexSignature(): boolean {
  next(); // Skip '{'
  return eat(tt.name) && match(tt.colon);
}

function tsTryParseIndexSignature(): boolean {
  if (!(match(tt.bracketL) && tsLookAhead(tsIsUnambiguouslyIndexSignature))) {
    return false;
  }

  const oldIsType = pushTypeContext(0);

  expect(tt.bracketL);
  parseIdentifier();
  tsParseTypeAnnotation();
  expect(tt.bracketR);

  tsTryParseTypeAnnotation();
  tsParseTypeMemberSemicolon();

  popTypeContext(oldIsType);
  return true;
}

function tsParsePropertyOrMethodSignature(isReadonly: boolean): void {
  parsePropertyName(-1 /* Types don't need context IDs. */);
  eat(tt.question);

  if (!isReadonly && (match(tt.parenL) || match(tt.lessThan))) {
    tsFillSignature(tt.colon);
    tsParseTypeMemberSemicolon();
  } else {
    tsTryParseTypeAnnotation();
    tsParseTypeMemberSemicolon();
  }
}

function tsParseTypeMember(): void {
  if (match(tt.parenL) || match(tt.lessThan)) {
    tsParseSignatureMember(SignatureMemberKind.TSCallSignatureDeclaration);
    return;
  }
  if (match(tt._new) && tsLookAhead(tsIsStartOfConstructSignature)) {
    tsParseSignatureMember(SignatureMemberKind.TSConstructSignatureDeclaration);
    return;
  }
  const readonly = !!tsParseModifier([ContextualKeyword._readonly]);

  const found = tsTryParseIndexSignature();
  if (found) {
    return;
  }
  tsParsePropertyOrMethodSignature(readonly);
}

function tsIsStartOfConstructSignature(): boolean {
  next();
  return match(tt.parenL) || match(tt.lessThan);
}

function tsParseTypeLiteral(): void {
  tsParseObjectTypeMembers();
}

function tsParseObjectTypeMembers(): void {
  expect(tt.braceL);
  tsParseList(ParsingContext.TypeMembers, tsParseTypeMember);
  expect(tt.braceR);
}

function tsIsStartOfMappedType(): boolean {
  next();
  if (eat(tt.plus) || eat(tt.minus)) {
    return isContextual(ContextualKeyword._readonly);
  }
  if (isContextual(ContextualKeyword._readonly)) {
    next();
  }
  if (!match(tt.bracketL)) {
    return false;
  }
  next();
  if (!tsIsIdentifier()) {
    return false;
  }
  next();
  return match(tt._in);
}

function tsParseMappedTypeParameter(): void {
  parseIdentifier();
  expect(tt._in);
  tsParseType();
}

function tsParseMappedType(): void {
  expect(tt.braceL);
  if (match(tt.plus) || match(tt.minus)) {
    next();
    expectContextual(ContextualKeyword._readonly);
  } else {
    eatContextual(ContextualKeyword._readonly);
  }
  expect(tt.bracketL);
  tsParseMappedTypeParameter();
  expect(tt.bracketR);
  if (match(tt.plus) || match(tt.minus)) {
    next();
    expect(tt.question);
  } else {
    eat(tt.question);
  }
  tsTryParseType();
  semicolon();
  expect(tt.braceR);
}

function tsParseTupleType(): void {
  tsParseBracketedList(
    ParsingContext.TupleElementTypes,
    tsParseType,
    /* bracket */ true,
    /* skipFirstToken */ false,
  );
}

function tsParseParenthesizedType(): void {
  expect(tt.parenL);
  tsParseType();
  expect(tt.parenR);
}

enum FunctionType {
  TSFunctionType,
  TSConstructorType,
}

function tsParseFunctionOrConstructorType(type: FunctionType): void {
  if (type === FunctionType.TSConstructorType) {
    expect(tt._new);
  }
  tsFillSignature(tt.arrow);
}

function tsParseNonArrayType(): void {
  switch (state.type) {
    case tt.name:
      tsParseTypeReference();
      return;
    case tt._void:
    case tt._null:
      next();
      return;
    case tt.string:
    case tt.num:
    case tt._true:
    case tt._false:
      parseLiteral();
      return;
    case tt.minus:
      next();
      parseLiteral();
      return;
    case tt._this: {
      tsParseThisTypeNode();
      if (isContextual(ContextualKeyword._is) && !hasPrecedingLineBreak()) {
        tsParseThisTypePredicate();
      }
      return;
    }
    case tt._typeof:
      tsParseTypeQuery();
      return;
    case tt.braceL:
      if (tsLookAhead(tsIsStartOfMappedType)) {
        tsParseMappedType();
      } else {
        tsParseTypeLiteral();
      }
      return;
    case tt.bracketL:
      tsParseTupleType();
      return;
    case tt.parenL:
      tsParseParenthesizedType();
      return;
    default:
      break;
  }

  throw unexpected();
}

function tsParseArrayTypeOrHigher(): void {
  tsParseNonArrayType();
  while (!hasPrecedingLineBreak() && eat(tt.bracketL)) {
    if (!eat(tt.bracketR)) {
      // If we hit ] immediately, this is an array type, otherwise it's an indexed access type.
      tsParseType();
      expect(tt.bracketR);
    }
  }
}

function tsParseInferType(): void {
  expectContextual(ContextualKeyword._infer);
  parseIdentifier();
}

function tsParseTypeOperatorOrHigher(): void {
  if (isContextual(ContextualKeyword._keyof) || isContextual(ContextualKeyword._unique)) {
    next();
    tsParseTypeOperatorOrHigher();
  } else if (isContextual(ContextualKeyword._infer)) {
    tsParseInferType();
  } else {
    tsParseArrayTypeOrHigher();
  }
}

function tsParseUnionOrIntersectionType(
  parseConstituentType: () => void,
  operator: TokenType,
): void {
  eat(operator);
  parseConstituentType();
  if (match(operator)) {
    while (eat(operator)) {
      parseConstituentType();
    }
  }
}

function tsParseIntersectionTypeOrHigher(): void {
  tsParseUnionOrIntersectionType(tsParseTypeOperatorOrHigher, tt.bitwiseAND);
}

function tsParseUnionTypeOrHigher(): void {
  tsParseUnionOrIntersectionType(tsParseIntersectionTypeOrHigher, tt.bitwiseOR);
}

function tsIsStartOfFunctionType(): boolean {
  if (match(tt.lessThan)) {
    return true;
  }
  return match(tt.parenL) && tsLookAhead(tsIsUnambiguouslyStartOfFunctionType);
}

function tsSkipParameterStart(): boolean {
  if (match(tt.name) || match(tt._this)) {
    next();
    return true;
  }
  return false;
}

function tsIsUnambiguouslyStartOfFunctionType(): boolean {
  next();
  if (match(tt.parenR) || match(tt.ellipsis)) {
    // ( )
    // ( ...
    return true;
  }
  if (tsSkipParameterStart()) {
    if (match(tt.colon) || match(tt.comma) || match(tt.question) || match(tt.eq)) {
      // ( xxx :
      // ( xxx ,
      // ( xxx ?
      // ( xxx =
      return true;
    }
    if (match(tt.parenR)) {
      next();
      if (match(tt.arrow)) {
        // ( xxx ) =>
        return true;
      }
    }
  }
  return false;
}

function tsParseTypeOrTypePredicateAnnotation(returnToken: TokenType): void {
  const oldIsType = pushTypeContext(0);
  expect(returnToken);
  tsTryParse(() => tsParseTypePredicatePrefix());
  // Regardless of whether we found an "is" token, there's now just a regular type in front of
  // us.
  tsParseType();
  popTypeContext(oldIsType);
}

function tsTryParseTypeOrTypePredicateAnnotation(): void {
  if (match(tt.colon)) {
    tsParseTypeOrTypePredicateAnnotation(tt.colon);
  }
}

export function tsTryParseTypeAnnotation(): void {
  if (match(tt.colon)) {
    tsParseTypeAnnotation();
  }
}

function tsTryParseType(): void {
  if (eat(tt.colon)) {
    tsParseType();
  }
}

function tsParseTypePredicatePrefix(): boolean {
  parseIdentifier();
  if (isContextual(ContextualKeyword._is) && !hasPrecedingLineBreak()) {
    next();
    return true;
  }
  return false;
}

export function tsParseTypeAnnotation(): void {
  const oldIsType = pushTypeContext(0);
  expect(tt.colon);
  tsParseType();
  popTypeContext(oldIsType);
}

export function tsParseType(): void {
  tsParseNonConditionalType();
  if (hasPrecedingLineBreak() || !eat(tt._extends)) {
    return;
  }
  // extends type
  tsParseNonConditionalType();
  expect(tt.question);
  // true type
  tsParseType();
  expect(tt.colon);
  // false type
  tsParseType();
}

export function tsParseNonConditionalType(): void {
  if (tsIsStartOfFunctionType()) {
    tsParseFunctionOrConstructorType(FunctionType.TSFunctionType);
    return;
  }
  if (match(tt._new)) {
    // As in `new () => Date`
    tsParseFunctionOrConstructorType(FunctionType.TSConstructorType);
    return;
  }
  tsParseUnionTypeOrHigher();
}

export function tsParseTypeAssertion(): void {
  const oldIsType = pushTypeContext(1);
  tsParseType();
  expect(tt.greaterThan);
  popTypeContext(oldIsType);
  parseMaybeUnary();
}

// Returns true if parsing was successful.
function tsTryParseTypeArgumentsInExpression(): boolean {
  return tsTryParseAndCatch(() => {
    const oldIsType = pushTypeContext(0);
    expect(tt.lessThan);
    state.tokens[state.tokens.length - 1].type = tt.typeParameterStart;
    tsParseDelimitedList(ParsingContext.TypeParametersOrArguments, tsParseType);
    expect(tt.greaterThan);
    popTypeContext(oldIsType);
    expect(tt.parenL);
  });
}

function tsParseHeritageClause(): void {
  tsParseDelimitedList(ParsingContext.HeritageClauseElement, tsParseExpressionWithTypeArguments);
}

function tsParseExpressionWithTypeArguments(): void {
  // Note: TS uses parseLeftHandSideExpressionOrHigher,
  // then has grammar errors later if it's not an EntityName.
  tsParseEntityName();
  if (match(tt.lessThan)) {
    tsParseTypeArguments();
  }
}

function tsParseInterfaceDeclaration(): void {
  parseIdentifier();
  tsTryParseTypeParameters();
  if (eat(tt._extends)) {
    tsParseHeritageClause();
  }
  tsParseObjectTypeMembers();
}

function tsParseTypeAliasDeclaration(): void {
  parseIdentifier();
  tsTryParseTypeParameters();
  expect(tt.eq);
  tsParseType();
  semicolon();
}

function tsParseEnumMember(): void {
  // Computed property names are grammar errors in an enum, so accept just string literal or identifier.
  if (match(tt.string)) {
    parseLiteral();
  } else {
    parseIdentifier();
  }
  if (eat(tt.eq)) {
    const eqIndex = state.tokens.length - 1;
    parseMaybeAssign();
    state.tokens[eqIndex].rhsEndIndex = state.tokens.length;
  }
}

function tsParseEnumDeclaration(): void {
  parseIdentifier();
  expect(tt.braceL);
  tsParseDelimitedList(ParsingContext.EnumMembers, tsParseEnumMember);
  expect(tt.braceR);
}

function tsParseModuleBlock(): void {
  expect(tt.braceL);
  // Inside of a module block is considered "top-level", meaning it can have imports and exports.
  parseBlockBody(/* topLevel */ true, /* end */ tt.braceR);
}

function tsParseModuleOrNamespaceDeclaration(): void {
  parseIdentifier();
  if (eat(tt.dot)) {
    tsParseModuleOrNamespaceDeclaration();
  } else {
    tsParseModuleBlock();
  }
}

function tsParseAmbientExternalModuleDeclaration(): void {
  if (isContextual(ContextualKeyword._global)) {
    parseIdentifier();
  } else if (match(tt.string)) {
    parseExprAtom();
  } else {
    unexpected();
  }

  if (match(tt.braceL)) {
    tsParseModuleBlock();
  } else {
    semicolon();
  }
}

export function tsParseImportEqualsDeclaration(): void {
  parseIdentifier();
  expect(tt.eq);
  tsParseModuleReference();
  semicolon();
}

function tsIsExternalModuleReference(): boolean {
  return isContextual(ContextualKeyword._require) && lookaheadType() === tt.parenL;
}

function tsParseModuleReference(): void {
  if (tsIsExternalModuleReference()) {
    tsParseExternalModuleReference();
  } else {
    tsParseEntityName();
  }
}

function tsParseExternalModuleReference(): void {
  expectContextual(ContextualKeyword._require);
  expect(tt.parenL);
  if (!match(tt.string)) {
    throw unexpected();
  }
  parseLiteral();
  expect(tt.parenR);
}

// Utilities

function tsLookAhead<T>(f: () => T): T {
  const snapshot = state.snapshot();
  const res = f();
  state.restoreFromSnapshot(snapshot);
  return res;
}

// Returns true if parsing was successful.
function tsTryParseAndCatch<T>(f: () => void): boolean {
  const snapshot = state.snapshot();
  try {
    f();
    return true;
  } catch (e) {
    if (e instanceof SyntaxError) {
      state.restoreFromSnapshot(snapshot);
      return false;
    }
    throw e;
  }
}

// The function should return true if the parse was successful. If not, we revert the state to
// before we started parsing.
function tsTryParse<T>(f: () => boolean): boolean {
  const snapshot = state.snapshot();
  const wasSuccessful = f();
  if (wasSuccessful) {
    return true;
  } else {
    state.restoreFromSnapshot(snapshot);
    return false;
  }
}

// Returns true if a statement matched.
function tsTryParseDeclare(): boolean {
  switch (state.type) {
    case tt._function: {
      const oldIsType = pushTypeContext(1);
      next();
      // We don't need to precisely get the function start here, since it's only used to mark
      // the function as a type if it's bodiless, and it's already a type here.
      const functionStart = state.start;
      parseFunction(functionStart, /* isStatement */ true);
      popTypeContext(oldIsType);
      return true;
    }
    case tt._class: {
      const oldIsType = pushTypeContext(1);
      parseClass(/* isStatement */ true, /* optionalId */ false);
      popTypeContext(oldIsType);
      return true;
    }
    case tt._const: {
      if (match(tt._const) && isLookaheadContextual(ContextualKeyword._enum)) {
        const oldIsType = pushTypeContext(1);
        // `const enum = 0;` not allowed because "enum" is a strict mode reserved word.
        expect(tt._const);
        expectContextual(ContextualKeyword._enum);
        state.tokens[state.tokens.length - 1].type = tt._enum;
        tsParseEnumDeclaration();
        popTypeContext(oldIsType);
        return true;
      }
    }
    // falls through
    case tt._var:
    case tt._let: {
      const oldIsType = pushTypeContext(1);
      parseVarStatement(state.type);
      popTypeContext(oldIsType);
      return true;
    }
    case tt.name: {
      const oldIsType = pushTypeContext(1);
      const contextualKeyword = state.contextualKeyword;
      let matched = false;
      if (contextualKeyword === ContextualKeyword._global) {
        tsParseAmbientExternalModuleDeclaration();
        matched = true;
        return true;
      } else {
        matched = tsParseDeclaration(contextualKeyword, /* isBeforeToken */ true);
      }
      popTypeContext(oldIsType);
      return matched;
    }
    default:
      return false;
  }
}

// Note: this won't be called unless the keyword is allowed in `shouldParseExportDeclaration`.
// Returns true if it matched a declaration.
function tsTryParseExportDeclaration(): boolean {
  return tsParseDeclaration(state.contextualKeyword, /* isBeforeToken */ true);
}

// Returns true if it matched a statement.
function tsParseExpressionStatement(contextualKeyword: ContextualKeyword): boolean {
  switch (contextualKeyword) {
    case ContextualKeyword._declare: {
      const declareTokenIndex = state.tokens.length - 1;
      const matched = tsTryParseDeclare();
      if (matched) {
        state.tokens[declareTokenIndex].type = tt._declare;
        return true;
      }
      break;
    }
    case ContextualKeyword._global:
      // `global { }` (with no `declare`) may appear inside an ambient module declaration.
      // Would like to use tsParseAmbientExternalModuleDeclaration here, but already ran past "global".
      if (match(tt.braceL)) {
        tsParseModuleBlock();
        return true;
      }
      break;

    default:
      return tsParseDeclaration(contextualKeyword, /* isBeforeToken */ false);
  }
  return false;
}

// Common to tsTryParseDeclare, tsTryParseExportDeclaration, and tsParseExpressionStatement.
// Returns true if it matched a declaration.
function tsParseDeclaration(contextualKeyword: ContextualKeyword, isBeforeToken: boolean): boolean {
  switch (contextualKeyword) {
    case ContextualKeyword._abstract:
      if (isBeforeToken || match(tt._class)) {
        if (isBeforeToken) next();
        state.tokens[state.tokens.length - 1].type = tt._abstract;
        parseClass(/* isStatement */ true, /* optionalId */ false);
        return true;
      }
      break;

    case ContextualKeyword._enum:
      if (isBeforeToken || match(tt.name)) {
        if (isBeforeToken) next();
        state.tokens[state.tokens.length - 1].type = tt._enum;
        tsParseEnumDeclaration();
        return true;
      }
      break;

    case ContextualKeyword._interface:
      if (isBeforeToken || match(tt.name)) {
        // `next` is true in "export" and "declare" contexts, so we want to remove that token
        // as well.
        const oldIsType = pushTypeContext(1);
        if (isBeforeToken) next();
        tsParseInterfaceDeclaration();
        popTypeContext(oldIsType);
        return true;
      }
      break;

    case ContextualKeyword._module:
      if (isBeforeToken) next();
      if (match(tt.string)) {
        const oldIsType = pushTypeContext(isBeforeToken ? 2 : 1);
        tsParseAmbientExternalModuleDeclaration();
        popTypeContext(oldIsType);
        return true;
      } else if (next || match(tt.name)) {
        const oldIsType = pushTypeContext(isBeforeToken ? 2 : 1);
        tsParseModuleOrNamespaceDeclaration();
        popTypeContext(oldIsType);
        return true;
      }
      break;

    case ContextualKeyword._namespace:
      if (isBeforeToken || match(tt.name)) {
        const oldIsType = pushTypeContext(1);
        if (isBeforeToken) next();
        tsParseModuleOrNamespaceDeclaration();
        popTypeContext(oldIsType);
        return true;
      }
      break;

    case ContextualKeyword._type:
      if (isBeforeToken || match(tt.name)) {
        const oldIsType = pushTypeContext(1);
        if (isBeforeToken) next();
        tsParseTypeAliasDeclaration();
        popTypeContext(oldIsType);
        return true;
      }
      break;

    default:
      break;
  }
  return false;
}

// Returns true if there was a generic async arrow function.
function tsTryParseGenericAsyncArrowFunction(): boolean {
  const matched = tsTryParseAndCatch(() => {
    tsParseTypeParameters();
    parseFunctionParams();
    tsTryParseTypeOrTypePredicateAnnotation();
    expect(tt.arrow);
  });

  if (!matched) {
    return false;
  }

  // We don't need to be precise about the function start since it's only used if this is a
  // bodiless function, which isn't valid here.
  const functionStart = state.start;
  parseFunctionBody(functionStart, false /* isGenerator */, true);
  return true;
}

function tsParseTypeArguments(): void {
  const oldIsType = pushTypeContext(0);
  expect(tt.lessThan);
  tsParseDelimitedList(ParsingContext.TypeParametersOrArguments, tsParseType);
  expect(tt.greaterThan);
  popTypeContext(oldIsType);
}

export function tsIsDeclarationStart(): boolean {
  if (match(tt.name)) {
    switch (state.contextualKeyword) {
      case ContextualKeyword._abstract:
      case ContextualKeyword._declare:
      case ContextualKeyword._enum:
      case ContextualKeyword._interface:
      case ContextualKeyword._module:
      case ContextualKeyword._namespace:
      case ContextualKeyword._type:
        return true;
      default:
        break;
    }
  }

  return false;
}

// ======================================================
// OVERRIDES
// ======================================================

export function tsParseFunctionBodyAndFinish(
  functionStart: number,
  isGenerator: boolean,
  allowExpressionBody: boolean | null = null,
  funcContextId?: number,
): void {
  // For arrow functions, `parseArrow` handles the return type itself.
  if (!allowExpressionBody && match(tt.colon)) {
    tsParseTypeOrTypePredicateAnnotation(tt.colon);
  }

  // The original code checked the node type to make sure this function type allows a missing
  // body, but we skip that to avoid sending around the node type. We instead just use the
  // allowExpressionBody boolean to make sure it's not an arrow function.
  if (!allowExpressionBody && !match(tt.braceL) && isLineTerminator()) {
    // Retroactively mark the function declaration as a type.
    let i = state.tokens.length - 1;
    while (
      i >= 0 &&
      (state.tokens[i].start >= functionStart ||
        state.tokens[i].type === tt._default ||
        state.tokens[i].type === tt._export)
    ) {
      state.tokens[i].isType = true;
      i--;
    }
    return;
  }

  parseFunctionBody(functionStart, isGenerator, allowExpressionBody, funcContextId);
}

export function tsParseSubscript(
  startPos: number,
  noCalls: boolean | null,
  stopState: StopState,
): void {
  if (!hasPrecedingLineBreak() && eat(tt.bang)) {
    state.tokens[state.tokens.length - 1].type = tt.nonNullAssertion;
    return;
  }

  if (!noCalls && match(tt.lessThan)) {
    if (atPossibleAsync()) {
      // Almost certainly this is a generic async function `async <T>() => ...
      // But it might be a call with a type argument `async<T>();`
      const asyncArrowFn = tsTryParseGenericAsyncArrowFunction();
      if (asyncArrowFn) {
        return;
      }
    }

    // May be passing type arguments. But may just be the `<` operator.
    const typeArguments = tsTryParseTypeArgumentsInExpression(); // Also eats the "("
    if (typeArguments) {
      // possibleAsync always false here, because we would have handled it above.
      parseCallExpressionArguments(tt.parenR);
    }
  }
  baseParseSubscript(startPos, noCalls, stopState);
}

export function tsStartParseNewArguments(): void {
  if (match(tt.lessThan)) {
    // tsTryParseAndCatch is expensive, so avoid if not necessary.
    // 99% certain this is `new C<T>();`. But may be `new C < T;`, which is also legal.
    tsTryParseAndCatch(() => {
      state.type = tt.typeParameterStart;
      tsParseTypeArguments();
      if (!match(tt.parenL)) {
        unexpected();
      }
    });
  }
}

export function tsTryParseExport(): boolean {
  if (match(tt._import)) {
    // `export import A = B;`
    expect(tt._import);
    tsParseImportEqualsDeclaration();
    return true;
  } else if (eat(tt.eq)) {
    // `export = x;`
    parseExpression();
    semicolon();
    return true;
  } else if (eatContextual(ContextualKeyword._as)) {
    // `export as namespace A;`
    // See `parseNamespaceExportDeclaration` in TypeScript's own parser
    expectContextual(ContextualKeyword._namespace);
    parseIdentifier();
    semicolon();
    return true;
  } else {
    return false;
  }
}

export function tsTryParseExportDefaultExpression(): boolean {
  if (isContextual(ContextualKeyword._abstract) && lookaheadType() === tt._class) {
    state.type = tt._abstract;
    next(); // Skip "abstract"
    parseClass(true, true);
    return true;
  }
  return false;
}

export function tsTryParseStatementContent(): boolean {
  if (state.type === tt._const) {
    const ahead = lookaheadTypeAndKeyword();
    if (ahead.type === tt.name && ahead.contextualKeyword === ContextualKeyword._enum) {
      expect(tt._const);
      expectContextual(ContextualKeyword._enum);
      state.tokens[state.tokens.length - 1].type = tt._enum;
      tsParseEnumDeclaration();
      return true;
    }
  }
  return false;
}

export function tsParseAccessModifier(): void {
  tsParseModifier([
    ContextualKeyword._public,
    ContextualKeyword._protected,
    ContextualKeyword._private,
  ]);
}

export function tsTryParseClassMemberWithIsStatic(
  isStatic: boolean,
  classContextId: number,
): boolean {
  let isAbstract = false;
  let isReadonly = false;

  const mod = tsParseModifier([ContextualKeyword._abstract, ContextualKeyword._readonly]);
  switch (mod) {
    case ContextualKeyword._readonly:
      isReadonly = true;
      isAbstract = !!tsParseModifier([ContextualKeyword._abstract]);
      break;
    case ContextualKeyword._abstract:
      isAbstract = true;
      isReadonly = !!tsParseModifier([ContextualKeyword._readonly]);
      break;
    default:
      break;
  }

  // We no longer check for public/private/etc, but tsTryParseIndexSignature should just return
  // false in that case for valid code.
  if (!isAbstract && !isStatic) {
    const found = tsTryParseIndexSignature();
    if (found) {
      return true;
    }
  }

  if (isReadonly) {
    // Must be a property (if not an index signature).
    parseClassPropertyName(classContextId);
    parsePostMemberNameModifiers();
    parseClassProperty();
    return true;
  }
  return false;
}

// Note: The reason we do this in `parseIdentifierStatement` and not `parseStatement`
// is that e.g. `type()` is valid JS, so we must try parsing that first.
// If it's really a type, we will parse `type` as the statement, and can correct it here
// by parsing the rest.
export function tsParseIdentifierStatement(contextualKeyword: ContextualKeyword): void {
  const matched = tsParseExpressionStatement(contextualKeyword);
  if (!matched) {
    semicolon();
  }
}

export function tsParseExportDeclaration(): void {
  // "export declare" is equivalent to just "export".
  const isDeclare = eatContextual(ContextualKeyword._declare);
  if (isDeclare) {
    state.tokens[state.tokens.length - 1].type = tt._declare;
  }

  let matchedDeclaration = false;
  if (match(tt.name)) {
    if (isDeclare) {
      const oldIsType = pushTypeContext(2);
      matchedDeclaration = tsTryParseExportDeclaration();
      popTypeContext(oldIsType);
    } else {
      matchedDeclaration = tsTryParseExportDeclaration();
    }
  }
  if (!matchedDeclaration) {
    if (isDeclare) {
      const oldIsType = pushTypeContext(2);
      parseStatement(true);
      popTypeContext(oldIsType);
    } else {
      parseStatement(true);
    }
  }
}

export function tsAfterParseClassSuper(hasSuper: boolean): void {
  if (hasSuper && match(tt.lessThan)) {
    tsParseTypeArguments();
  }
  if (eatContextual(ContextualKeyword._implements)) {
    state.tokens[state.tokens.length - 1].type = tt._implements;
    const oldIsType = pushTypeContext(1);
    tsParseHeritageClause();
    popTypeContext(oldIsType);
  }
}

export function tsStartParseObjPropValue(): void {
  tsTryParseTypeParameters();
}

export function tsStartParseFunctionParams(): void {
  tsTryParseTypeParameters();
}

// `let x: number;`
export function tsAfterParseVarHead(): void {
  eat(tt.bang);
  tsTryParseTypeAnnotation();
}

// parse the return type of an async arrow function - let foo = (async (): number => {});
export function tsStartParseAsyncArrowFromCallExpression(): void {
  if (match(tt.colon)) {
    tsParseTypeAnnotation();
  }
}

// Returns true if the expression was an arrow function.
export function tsParseMaybeAssign(
  noIn: boolean | null = null,
  afterLeftParse?: Function,
): boolean {
  // Note: When the JSX plugin is on, type assertions (`<T> x`) aren't valid syntax.

  let jsxError: SyntaxError | null = null;

  if (match(tt.lessThan) && isJSXEnabled) {
    // Prefer to parse JSX if possible. But may be an arrow fn.
    const snapshot = state.snapshot();
    try {
      return baseParseMaybeAssign(noIn, afterLeftParse);
    } catch (err) {
      if (!(err instanceof SyntaxError)) {
        // istanbul ignore next: no such error is expected
        throw err;
      }

      state.restoreFromSnapshot(snapshot);
      state.type = tt.typeParameterStart;
      jsxError = err;
    }
  }

  if (jsxError === null && !match(tt.lessThan)) {
    return baseParseMaybeAssign(noIn, afterLeftParse);
  }

  // Either way, we're looking at a '<': tt.typeParameterStart or relational.

  let wasArrow = false;
  const snapshot = state.snapshot();
  try {
    // This is similar to TypeScript's `tryParseParenthesizedArrowFunctionExpression`.
    const oldIsType = pushTypeContext(0);
    tsParseTypeParameters();
    popTypeContext(oldIsType);
    wasArrow = baseParseMaybeAssign(noIn, afterLeftParse);
    if (!wasArrow) {
      unexpected(); // Go to the catch block (needs a SyntaxError).
    }
  } catch (err) {
    if (!(err instanceof SyntaxError)) {
      // istanbul ignore next: no such error is expected
      throw err;
    }

    if (jsxError) {
      throw jsxError;
    }

    // Try parsing a type cast instead of an arrow function.
    // This will never happen outside of JSX.
    // (Because in JSX the '<' should be a jsxTagStart and not a relational.
    assert(!isJSXEnabled);
    // Parsing an arrow function failed, so try a type cast.
    state.restoreFromSnapshot(snapshot);
    // This will start with a type assertion (via parseMaybeUnary).
    // But don't directly call `tsParseTypeAssertion` because we want to handle any binary after it.
    return baseParseMaybeAssign(noIn, afterLeftParse);
  }
  return wasArrow;
}

export function tsParseArrow(): boolean {
  if (match(tt.colon)) {
    // This is different from how the TS parser does it.
    // TS uses lookahead. Babylon parses it as a parenthesized expression and converts.
    const snapshot = state.snapshot();
    try {
      tsParseTypeOrTypePredicateAnnotation(tt.colon);
      if (canInsertSemicolon()) unexpected();
      if (!match(tt.arrow)) unexpected();
    } catch (err) {
      if (err instanceof SyntaxError) {
        state.restoreFromSnapshot(snapshot);
      } else {
        // istanbul ignore next: no such error is expected
        throw err;
      }
    }
  }
  return eat(tt.arrow);
}

// Allow type annotations inside of a parameter list.
export function tsParseAssignableListItemTypes(): void {
  const oldIsType = pushTypeContext(0);
  eat(tt.question);
  tsTryParseTypeAnnotation();
  popTypeContext(oldIsType);
}
