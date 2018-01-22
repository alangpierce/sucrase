import {ParserClass, Pos} from "../parser";
import {types as ct} from "../tokenizer/context";
import {TokenType, types as tt} from "../tokenizer/types";

type TsModifier = "readonly" | "abstract" | "static" | "public" | "private" | "protected";

function nonNull<T>(x: T | null): T {
  if (x == null) {
    // $FlowIgnore
    throw new Error(`Unexpected ${x} value.`);
  }
  return x;
}

function assert(x: boolean): void {
  if (!x) {
    throw new Error("Assert fail");
  }
}

type ParsingContext =
  | "EnumMembers"
  | "HeritageClauseElement"
  | "TupleElementTypes"
  | "TypeMembers"
  | "TypeParametersOrArguments";

// Doesn't handle "void" or "null" because those are keywords, not identifiers.
function isTypeKeyword(value: string): boolean {
  switch (value) {
    case "any":
    case "boolean":
    case "never":
    case "number":
    case "object":
    case "string":
    case "symbol":
    case "undefined":
      return true;
    default:
      return false;
  }
}

export default (superClass: ParserClass): ParserClass =>
  class extends superClass {
    tsIsIdentifier(): boolean {
      // TODO: actually a bit more complex in TypeScript, but shouldn't matter.
      // See https://github.com/Microsoft/TypeScript/issues/15008
      return this.match(tt.name);
    }

    tsNextTokenCanFollowModifier(): boolean {
      // Note: TypeScript's implementation is much more complicated because
      // more things are considered modifiers there.
      // This implementation only handles modifiers not handled by babylon itself. And "static".
      // TODO: Would be nice to avoid lookahead. Want a hasLineBreakUpNext() method...
      this.next();
      return (
        !this.hasPrecedingLineBreak() &&
        !this.match(tt.parenL) &&
        !this.match(tt.colon) &&
        !this.match(tt.eq) &&
        !this.match(tt.question)
      );
    }

    /** Parses a modifier matching one the given modifier names. */
    tsParseModifier<T extends TsModifier>(allowedModifiers: Array<T>): T | null {
      if (!this.match(tt.name)) {
        return null;
      }

      const modifier = this.state.value;
      if (
        allowedModifiers.indexOf(modifier) !== -1 &&
        this.tsTryParse(() => this.tsNextTokenCanFollowModifier())
      ) {
        switch (modifier) {
          case "readonly":
            this.state.tokens[this.state.tokens.length - 1].type = tt._readonly;
            break;
          case "abstract":
            this.state.tokens[this.state.tokens.length - 1].type = tt._abstract;
            break;
          case "static":
            this.state.tokens[this.state.tokens.length - 1].type = tt._static;
            break;
          case "public":
            this.state.tokens[this.state.tokens.length - 1].type = tt._public;
            break;
          case "private":
            this.state.tokens[this.state.tokens.length - 1].type = tt._private;
            break;
          case "protected":
            this.state.tokens[this.state.tokens.length - 1].type = tt._protected;
            break;
          default:
            break;
        }
        return modifier;
      }
      return null;
    }

    tsIsListTerminator(kind: ParsingContext): boolean {
      switch (kind) {
        case "EnumMembers":
        case "TypeMembers":
          return this.match(tt.braceR);
        case "HeritageClauseElement":
          return this.match(tt.braceL);
        case "TupleElementTypes":
          return this.match(tt.bracketR);
        case "TypeParametersOrArguments":
          return this.isRelational(">");
        default:
          break;
      }

      throw new Error("Unreachable");
    }

    tsParseList(kind: ParsingContext, parseElement: () => void): void {
      while (!this.tsIsListTerminator(kind)) {
        // Skipping "parseListElement" from the TS source since that's just for error handling.
        parseElement();
      }
    }

    tsParseDelimitedList(kind: ParsingContext, parseElement: () => void): void {
      this.tsParseDelimitedListWorker(kind, parseElement);
    }

    /**
     * If !expectSuccess, returns undefined instead of failing to parse.
     * If expectSuccess, parseElement should always return a defined value.
     */
    tsParseDelimitedListWorker(kind: ParsingContext, parseElement: () => void): void {
      while (true) {
        if (this.tsIsListTerminator(kind)) {
          break;
        }

        parseElement();
        if (this.eat(tt.comma)) {
          continue;
        }

        if (this.tsIsListTerminator(kind)) {
          break;
        }
      }
    }

    tsParseBracketedList(
      kind: ParsingContext,
      parseElement: () => void,
      bracket: boolean,
      skipFirstToken: boolean,
    ): void {
      if (!skipFirstToken) {
        if (bracket) {
          this.expect(tt.bracketL);
        } else {
          this.expectRelational("<");
        }
      }
      this.tsParseDelimitedList(kind, parseElement);
      if (bracket) {
        this.expect(tt.bracketR);
      } else {
        this.expectRelational(">");
      }
    }

    tsParseEntityName(): void {
      this.parseIdentifier();
      while (this.eat(tt.dot)) {
        this.parseIdentifier();
      }
    }

    tsParseTypeReference(): void {
      this.tsParseEntityName();
      if (!this.hasPrecedingLineBreak() && this.isRelational("<")) {
        this.tsParseTypeArguments();
      }
    }

    tsParseThisTypePredicate(): void {
      this.next();
      this.tsParseTypeAnnotation(/* eatColon */ false);
    }

    tsParseThisTypeNode(): void {
      this.next();
    }

    tsParseTypeQuery(): void {
      this.expect(tt._typeof);
      this.tsParseEntityName();
    }

    tsParseTypeParameter(): void {
      this.parseIdentifier();
      if (this.eat(tt._extends)) {
        this.tsParseType();
      }
      if (this.eat(tt.eq)) {
        this.tsParseType();
      }
    }

    tsTryParseTypeParameters(): void {
      if (this.isRelational("<")) {
        this.tsParseTypeParameters();
      }
    }

    tsParseTypeParameters(): void {
      this.runInTypeContext(0, () => {
        if (this.isRelational("<") || this.match(tt.typeParameterStart)) {
          this.next();
        } else {
          this.unexpected();
        }

        this.tsParseBracketedList(
          "TypeParametersOrArguments",
          this.tsParseTypeParameter.bind(this),
          /* bracket */ false,
          /* skipFirstToken */ true,
        );
      });
    }

    // Note: In TypeScript implementation we must provide `yieldContext` and `awaitContext`,
    // but here it's always false, because this is only used for types.
    tsFillSignature(returnToken: TokenType): void {
      // Arrow fns *must* have return token (`=>`). Normal functions can omit it.
      const returnTokenRequired = returnToken === tt.arrow;
      this.tsTryParseTypeParameters();
      this.expect(tt.parenL);
      this.tsParseBindingListForSignature(false /* isBlockScope */);
      if (returnTokenRequired) {
        this.tsParseTypeOrTypePredicateAnnotation(returnToken);
      } else if (this.match(returnToken)) {
        this.tsParseTypeOrTypePredicateAnnotation(returnToken);
      }
    }

    tsParseBindingListForSignature(isBlockScope: boolean): void {
      this.parseBindingList(tt.parenR, isBlockScope);
    }

    tsParseTypeMemberSemicolon(): void {
      if (!this.eat(tt.comma)) {
        this.semicolon();
      }
    }

    tsParseSignatureMember(
      kind: "TSCallSignatureDeclaration" | "TSConstructSignatureDeclaration",
    ): void {
      if (kind === "TSConstructSignatureDeclaration") {
        this.expect(tt._new);
      }
      this.tsFillSignature(tt.colon);
      this.tsParseTypeMemberSemicolon();
    }

    tsIsUnambiguouslyIndexSignature(): boolean {
      this.next(); // Skip '{'
      return this.eat(tt.name) && this.match(tt.colon);
    }

    tsTryParseIndexSignature(): boolean {
      if (
        !(
          this.match(tt.bracketL) &&
          this.tsLookAhead(this.tsIsUnambiguouslyIndexSignature.bind(this))
        )
      ) {
        return false;
      }

      this.expect(tt.bracketL);
      this.parseIdentifier();
      this.expect(tt.colon);
      this.tsParseTypeAnnotation(/* eatColon */ false);
      this.expect(tt.bracketR);

      this.tsTryParseTypeAnnotation();
      this.tsParseTypeMemberSemicolon();
      return true;
    }

    tsParsePropertyOrMethodSignature(readonly: boolean): void {
      this.parsePropertyName(-1 /* Types don't need context IDs. */);
      this.eat(tt.question);

      if (!readonly && (this.match(tt.parenL) || this.isRelational("<"))) {
        this.tsFillSignature(tt.colon);
        this.tsParseTypeMemberSemicolon();
      } else {
        this.tsTryParseTypeAnnotation();
        this.tsParseTypeMemberSemicolon();
      }
    }

    tsParseTypeMember(): void {
      if (this.match(tt.parenL) || this.isRelational("<")) {
        this.tsParseSignatureMember("TSCallSignatureDeclaration");
        return;
      }
      if (this.match(tt._new) && this.tsLookAhead(this.tsIsStartOfConstructSignature.bind(this))) {
        this.tsParseSignatureMember("TSConstructSignatureDeclaration");
        return;
      }
      const readonly = !!this.tsParseModifier(["readonly"]);

      const found = this.tsTryParseIndexSignature();
      if (found) {
        return;
      }
      this.tsParsePropertyOrMethodSignature(readonly);
    }

    tsIsStartOfConstructSignature(): boolean {
      this.next();
      return this.match(tt.parenL) || this.isRelational("<");
    }

    tsParseTypeLiteral(): void {
      this.tsParseObjectTypeMembers();
    }

    tsParseObjectTypeMembers(): void {
      this.expect(tt.braceL);
      this.tsParseList("TypeMembers", this.tsParseTypeMember.bind(this));
      this.expect(tt.braceR);
    }

    tsIsStartOfMappedType(): boolean {
      this.next();
      if (this.isContextual("readonly")) {
        this.next();
      }
      if (!this.match(tt.bracketL)) {
        return false;
      }
      this.next();
      if (!this.tsIsIdentifier()) {
        return false;
      }
      this.next();
      return this.match(tt._in);
    }

    tsParseMappedTypeParameter(): void {
      this.parseIdentifier();
      this.expect(tt._in);
      this.tsParseType();
    }

    tsParseMappedType(): void {
      this.expect(tt.braceL);
      this.eatContextual("readonly");
      this.expect(tt.bracketL);
      this.tsParseMappedTypeParameter();
      this.expect(tt.bracketR);
      this.eat(tt.question);
      this.tsTryParseType();
      this.semicolon();
      this.expect(tt.braceR);
    }

    tsParseTupleType(): void {
      this.tsParseBracketedList(
        "TupleElementTypes",
        this.tsParseType.bind(this),
        /* bracket */ true,
        /* skipFirstToken */ false,
      );
    }

    tsParseParenthesizedType(): void {
      this.expect(tt.parenL);
      this.tsParseType();
      this.expect(tt.parenR);
    }

    tsParseFunctionOrConstructorType(type: "TSFunctionType" | "TSConstructorType"): void {
      if (type === "TSConstructorType") {
        this.expect(tt._new);
      }
      this.tsFillSignature(tt.arrow);
    }

    tsParseNonArrayType(): void {
      switch (this.state.type) {
        case tt.name:
        case tt._void:
        case tt._null: {
          if (this.match(tt._void) || this.match(tt._null) || isTypeKeyword(this.state.value)) {
            this.next();
            return;
          }
          this.tsParseTypeReference();
          return;
        }
        case tt.string:
        case tt.num:
        case tt._true:
        case tt._false:
          this.parseLiteral();
          return;
        case tt.plusMin:
          // Allow negative signs but not plus signs before numbers.
          if (this.state.value === "-") {
            this.next();
            this.parseLiteral();
            return;
          }
          break;
        case tt._this: {
          this.tsParseThisTypeNode();
          if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
            this.tsParseThisTypePredicate();
          }
          return;
        }
        case tt._typeof:
          this.tsParseTypeQuery();
          return;
        case tt.braceL:
          if (this.tsLookAhead(this.tsIsStartOfMappedType.bind(this))) {
            this.tsParseMappedType();
          } else {
            this.tsParseTypeLiteral();
          }
          return;
        case tt.bracketL:
          this.tsParseTupleType();
          return;
        case tt.parenL:
          this.tsParseParenthesizedType();
          return;
        default:
          break;
      }

      throw this.unexpected();
    }

    tsParseArrayTypeOrHigher(): void {
      this.tsParseNonArrayType();
      while (!this.hasPrecedingLineBreak() && this.eat(tt.bracketL)) {
        if (!this.eat(tt.bracketR)) {
          // If we hit ] immediately, this is an array type, otherwise it's an indexed access type.
          this.tsParseType();
          this.expect(tt.bracketR);
        }
      }
    }

    tsParseTypeOperator(operator: "keyof"): void {
      this.expectContextual(operator);
      this.tsParseTypeOperatorOrHigher();
    }

    tsParseTypeOperatorOrHigher(): void {
      if (this.isContextual("keyof")) {
        this.tsParseTypeOperator("keyof");
      } else {
        this.tsParseArrayTypeOrHigher();
      }
    }

    tsParseUnionOrIntersectionType(
      kind: "TSUnionType" | "TSIntersectionType",
      parseConstituentType: () => void,
      operator: TokenType,
    ): void {
      this.eat(operator);
      parseConstituentType();
      if (this.match(operator)) {
        while (this.eat(operator)) {
          parseConstituentType();
        }
      }
    }

    tsParseIntersectionTypeOrHigher(): void {
      this.tsParseUnionOrIntersectionType(
        "TSIntersectionType",
        this.tsParseTypeOperatorOrHigher.bind(this),
        tt.bitwiseAND,
      );
    }

    tsParseUnionTypeOrHigher(): void {
      this.tsParseUnionOrIntersectionType(
        "TSUnionType",
        this.tsParseIntersectionTypeOrHigher.bind(this),
        tt.bitwiseOR,
      );
    }

    tsIsStartOfFunctionType(): boolean {
      if (this.isRelational("<")) {
        return true;
      }
      return (
        this.match(tt.parenL) &&
        this.tsLookAhead(this.tsIsUnambiguouslyStartOfFunctionType.bind(this))
      );
    }

    tsSkipParameterStart(): boolean {
      if (this.match(tt.name) || this.match(tt._this)) {
        this.next();
        return true;
      }
      return false;
    }

    tsIsUnambiguouslyStartOfFunctionType(): boolean {
      this.next();
      if (this.match(tt.parenR) || this.match(tt.ellipsis)) {
        // ( )
        // ( ...
        return true;
      }
      if (this.tsSkipParameterStart()) {
        if (
          this.match(tt.colon) ||
          this.match(tt.comma) ||
          this.match(tt.question) ||
          this.match(tt.eq)
        ) {
          // ( xxx :
          // ( xxx ,
          // ( xxx ?
          // ( xxx =
          return true;
        }
        if (this.match(tt.parenR)) {
          this.next();
          if (this.match(tt.arrow)) {
            // ( xxx ) =>
            return true;
          }
        }
      }
      return false;
    }

    tsParseTypeOrTypePredicateAnnotation(returnToken: TokenType): void {
      this.runInTypeContext(0, () => {
        this.expect(returnToken);
        this.tsTryParse(() => this.tsParseTypePredicatePrefix());
        // Regardless of whether we found an "is" token, there's now just a regular type in front of
        // us.
        this.tsParseTypeAnnotation(/* eatColon */ false);
      });
    }

    tsTryParseTypeOrTypePredicateAnnotation(): void {
      if (this.match(tt.colon)) {
        this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
      }
    }

    tsTryParseTypeAnnotation(): void {
      if (this.match(tt.colon)) {
        this.tsParseTypeAnnotation();
      }
    }

    tsTryParseType(): void {
      if (this.eat(tt.colon)) {
        this.tsParseType();
      }
    }

    tsParseTypePredicatePrefix(): boolean {
      this.parseIdentifier();
      if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
        this.next();
        return true;
      }
      return false;
    }

    tsParseTypeAnnotation(eatColon: boolean = true): void {
      this.runInTypeContext(0, () => {
        if (eatColon) {
          this.expect(tt.colon);
        }
        this.tsParseType();
      });
    }

    tsParseType(): void {
      // Need to set `state.inType` so that we don't parse JSX in a type context.
      const oldInType = this.state.inType;
      this.state.inType = true;
      try {
        if (this.tsIsStartOfFunctionType()) {
          this.tsParseFunctionOrConstructorType("TSFunctionType");
          return;
        }
        if (this.match(tt._new)) {
          // As in `new () => Date`
          this.tsParseFunctionOrConstructorType("TSConstructorType");
          return;
        }
        this.tsParseUnionTypeOrHigher();
      } finally {
        this.state.inType = oldInType;
      }
    }

    tsParseTypeAssertion(): void {
      this.runInTypeContext(1, () => {
        this.tsParseType();
        this.expectRelational(">");
      });
      this.parseMaybeUnary();
    }

    // Returns true if parsing was successful.
    tsTryParseTypeArgumentsInExpression(): boolean {
      return this.tsTryParseAndCatch(() => {
        this.runInTypeContext(0, () => {
          this.expectRelational("<");
          this.state.tokens[this.state.tokens.length - 1].type = tt.typeParameterStart;
          this.tsParseDelimitedList("TypeParametersOrArguments", this.tsParseType.bind(this));
          this.expectRelational(">");
        });
        this.expect(tt.parenL);
      });
    }

    tsParseHeritageClause(): void {
      this.tsParseDelimitedList(
        "HeritageClauseElement",
        this.tsParseExpressionWithTypeArguments.bind(this),
      );
    }

    tsParseExpressionWithTypeArguments(): void {
      // Note: TS uses parseLeftHandSideExpressionOrHigher,
      // then has grammar errors later if it's not an EntityName.
      this.tsParseEntityName();
      if (this.isRelational("<")) {
        this.tsParseTypeArguments();
      }
    }

    tsParseInterfaceDeclaration(): void {
      this.parseIdentifier();
      this.tsTryParseTypeParameters();
      if (this.eat(tt._extends)) {
        this.tsParseHeritageClause();
      }
      this.tsParseObjectTypeMembers();
    }

    tsParseTypeAliasDeclaration(): void {
      this.parseIdentifier();
      this.tsTryParseTypeParameters();
      this.expect(tt.eq);
      this.tsParseType();
      this.semicolon();
    }

    tsParseEnumMember(): void {
      // Computed property names are grammar errors in an enum, so accept just string literal or identifier.
      if (this.match(tt.string)) {
        this.parseLiteral();
      } else {
        this.parseIdentifier();
      }
      if (this.eat(tt.eq)) {
        const eqIndex = this.state.tokens.length - 1;
        this.parseMaybeAssign();
        this.state.tokens[eqIndex].rhsEndIndex = this.state.tokens.length;
      }
    }

    tsParseEnumDeclaration(): void {
      this.parseIdentifier();
      this.expect(tt.braceL);
      this.tsParseDelimitedList("EnumMembers", this.tsParseEnumMember.bind(this));
      this.expect(tt.braceR);
    }

    tsParseModuleBlock(): void {
      this.expect(tt.braceL);
      // Inside of a module block is considered "top-level", meaning it can have imports and exports.
      this.parseBlockBody(/* topLevel */ true, /* end */ tt.braceR);
    }

    tsParseModuleOrNamespaceDeclaration(): void {
      this.parseIdentifier();
      if (this.eat(tt.dot)) {
        this.tsParseModuleOrNamespaceDeclaration();
      } else {
        this.tsParseModuleBlock();
      }
    }

    tsParseAmbientExternalModuleDeclaration(): void {
      if (this.isContextual("global")) {
        this.parseIdentifier();
      } else if (this.match(tt.string)) {
        this.parseExprAtom();
      } else {
        this.unexpected();
      }

      if (this.match(tt.braceL)) {
        this.tsParseModuleBlock();
      } else {
        this.semicolon();
      }
    }

    tsParseImportEqualsDeclaration(): void {
      this.parseIdentifier();
      this.expect(tt.eq);
      this.tsParseModuleReference();
      this.semicolon();
    }

    tsIsExternalModuleReference(): boolean {
      return this.isContextual("require") && this.lookaheadType() === tt.parenL;
    }

    tsParseModuleReference(): void {
      if (this.tsIsExternalModuleReference()) {
        this.tsParseExternalModuleReference();
      } else {
        this.tsParseEntityName();
      }
    }

    tsParseExternalModuleReference(): void {
      this.expectContextual("require");
      this.expect(tt.parenL);
      if (!this.match(tt.string)) {
        throw this.unexpected();
      }
      this.parseLiteral();
      this.expect(tt.parenR);
    }

    // Utilities

    tsLookAhead<T>(f: () => T): T {
      const snapshot = this.state.snapshot();
      const res = f();
      this.state.restoreFromSnapshot(snapshot);
      return res;
    }

    // Returns true if parsing was successful.
    tsTryParseAndCatch<T>(f: () => void): boolean {
      const snapshot = this.state.snapshot();
      try {
        f();
        return true;
      } catch (e) {
        if (e instanceof SyntaxError) {
          this.state.restoreFromSnapshot(snapshot);
          return false;
        }
        throw e;
      }
    }

    // The function should return true if the parse was successful. If not, we revert the state to
    // before we started parsing.
    tsTryParse<T>(f: () => boolean): boolean {
      const snapshot = this.state.snapshot();
      const wasSuccessful = f();
      if (wasSuccessful) {
        return true;
      } else {
        this.state.restoreFromSnapshot(snapshot);
        return false;
      }
    }

    // Returns true if a statement matched.
    tsTryParseDeclare(): boolean {
      switch (this.state.type) {
        case tt._function:
          this.runInTypeContext(1, () => {
            this.next();
            // We don't need to precisely get the function start here, since it's only used to mark
            // the function as a type if it's bodiless, and it's already a type here.
            const functionStart = this.state.start;
            this.parseFunction(functionStart, /* isStatement */ true);
          });
          return true;
        case tt._class:
          this.runInTypeContext(1, () => {
            this.parseClass(/* isStatement */ true, /* optionalId */ false);
          });
          return true;
        case tt._const:
          if (this.match(tt._const) && this.isLookaheadContextual("enum")) {
            this.runInTypeContext(1, () => {
              // `const enum = 0;` not allowed because "enum" is a strict mode reserved word.
              this.expect(tt._const);
              this.expectContextual("enum");
              this.state.tokens[this.state.tokens.length - 1].type = tt._enum;
              this.tsParseEnumDeclaration();
            });
            return true;
          }
        // falls through
        case tt._var:
        case tt._let:
          this.runInTypeContext(1, () => {
            this.parseVarStatement(this.state.type);
          });
          return true;
        case tt.name: {
          return this.runInTypeContext(1, () => {
            const value = this.state.value;
            if (value === "global") {
              this.tsParseAmbientExternalModuleDeclaration();
              return true;
            } else {
              return this.tsParseDeclaration(value, /* next */ true);
            }
          });
        }
        default:
          return false;
      }
    }

    // Note: this won't be called unless the keyword is allowed in `shouldParseExportDeclaration`.
    // Returns true if it matched a declaration.
    tsTryParseExportDeclaration(): boolean {
      return this.tsParseDeclaration(this.state.value, /* next */ true);
    }

    // Returns true if it matched a statement.
    tsParseExpressionStatement(name: string): boolean {
      switch (name) {
        case "declare": {
          const declareTokenIndex = this.state.tokens.length - 1;
          const matched = this.tsTryParseDeclare();
          if (matched) {
            this.state.tokens[declareTokenIndex].type = tt._declare;
            return true;
          }
          break;
        }
        case "global":
          // `global { }` (with no `declare`) may appear inside an ambient module declaration.
          // Would like to use tsParseAmbientExternalModuleDeclaration here, but already ran past "global".
          if (this.match(tt.braceL)) {
            this.tsParseModuleBlock();
            return true;
          }
          break;

        default:
          return this.tsParseDeclaration(name, /* next */ false);
      }
      return false;
    }

    // Common to tsTryParseDeclare, tsTryParseExportDeclaration, and tsParseExpressionStatement.
    // Returns true if it matched a declaration.
    tsParseDeclaration(name: string, next: boolean): boolean {
      switch (name) {
        case "abstract":
          if (next || this.match(tt._class)) {
            if (next) this.next();
            this.state.tokens[this.state.tokens.length - 1].type = tt._abstract;
            this.parseClass(/* isStatement */ true, /* optionalId */ false);
            return true;
          }
          break;

        case "enum":
          if (next || this.match(tt.name)) {
            if (next) this.next();
            this.state.tokens[this.state.tokens.length - 1].type = tt._enum;
            this.tsParseEnumDeclaration();
            return true;
          }
          break;

        case "interface":
          if (next || this.match(tt.name)) {
            // `next` is true in "export" and "declare" contexts, so we want to remove that token
            // as well.
            this.runInTypeContext(1, () => {
              if (next) this.next();
              this.tsParseInterfaceDeclaration();
            });
            return true;
          }
          break;

        case "module":
          if (next) this.next();
          if (this.match(tt.string)) {
            this.runInTypeContext(next ? 2 : 1, () => {
              this.tsParseAmbientExternalModuleDeclaration();
            });
            return true;
          } else if (next || this.match(tt.name)) {
            this.runInTypeContext(next ? 2 : 1, () => {
              this.tsParseModuleOrNamespaceDeclaration();
            });
            return true;
          }
          break;

        case "namespace":
          if (next || this.match(tt.name)) {
            this.runInTypeContext(1, () => {
              if (next) this.next();
              this.tsParseModuleOrNamespaceDeclaration();
            });
            return true;
          }
          break;

        case "type":
          if (next || this.match(tt.name)) {
            this.runInTypeContext(1, () => {
              if (next) this.next();
              this.tsParseTypeAliasDeclaration();
            });
            return true;
          }
          break;

        default:
          break;
      }
      return false;
    }

    // Returns true if there was a generic async arrow function.
    tsTryParseGenericAsyncArrowFunction(): boolean {
      const matched = this.tsTryParseAndCatch(() => {
        this.tsParseTypeParameters();
        // Don't use overloaded parseFunctionParams which would look for "<" again.
        super.parseFunctionParams();
        this.tsTryParseTypeOrTypePredicateAnnotation();
        this.expect(tt.arrow);
      });

      if (!matched) {
        return false;
      }

      // We don't need to be precise about the function start since it's only used if this is a
      // bodiless function, which isn't valid here.
      const functionStart = this.state.start;
      this.parseFunctionBody(functionStart, false /* isGenerator */, true);
      return true;
    }

    tsParseTypeArguments(): void {
      this.runInTypeContext(0, () => {
        this.expectRelational("<");
        this.tsParseDelimitedList("TypeParametersOrArguments", this.tsParseType.bind(this));
        this.expectRelational(">");
      });
    }

    tsIsDeclarationStart(): boolean {
      if (this.match(tt.name)) {
        switch (this.state.value) {
          case "abstract":
          case "declare":
          case "enum":
          case "interface":
          case "module":
          case "namespace":
          case "type":
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

    isExportDefaultSpecifier(): boolean {
      if (this.tsIsDeclarationStart()) return false;
      return super.isExportDefaultSpecifier();
    }

    parseAssignableListItem(allowModifiers: boolean | null, isBlockScope: boolean): void {
      if (allowModifiers) {
        this.parseAccessModifier();
        this.tsParseModifier(["readonly"]);
      }

      this.parseMaybeDefault(isBlockScope);
      this.parseAssignableListItemTypes();
      this.parseMaybeDefault(isBlockScope, true);
    }

    parseFunctionBodyAndFinish(
      functionStart: number,
      isGenerator: boolean,
      allowExpressionBody?: boolean,
      funcContextId?: number,
    ): void {
      // For arrow functions, `parseArrow` handles the return type itself.
      if (!allowExpressionBody && this.match(tt.colon)) {
        this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
      }

      // The original code checked the node type to make sure this function type allows a missing
      // body, but we skip that to avoid sending around the node type. We instead just use the
      // allowExpressionBody boolean to make sure it's not an arrow function.
      if (!allowExpressionBody && !this.match(tt.braceL) && this.isLineTerminator()) {
        // Retroactively mark the function declaration as a type.
        let i = this.state.tokens.length - 1;
        while (
          i >= 0 &&
          (this.state.tokens[i].start >= functionStart ||
            this.state.tokens[i].type === tt._default ||
            this.state.tokens[i].type === tt._export)
        ) {
          this.state.tokens[i].isType = true;
          i--;
        }
        return;
      }

      super.parseFunctionBodyAndFinish(
        functionStart,
        isGenerator,
        allowExpressionBody,
        funcContextId,
      );
    }

    parseSubscript(startPos: number, noCalls: boolean | null, state: {stop: boolean}): void {
      if (!this.hasPrecedingLineBreak() && this.eat(tt.bang)) {
        return;
      }

      if (!noCalls && this.isRelational("<")) {
        if (this.atPossibleAsync()) {
          // Almost certainly this is a generic async function `async <T>() => ...
          // But it might be a call with a type argument `async<T>();`
          const asyncArrowFn = this.tsTryParseGenericAsyncArrowFunction();
          if (asyncArrowFn) {
            return;
          }
        }

        // May be passing type arguments. But may just be the `<` operator.
        const typeArguments = this.tsTryParseTypeArgumentsInExpression(); // Also eats the "("
        if (typeArguments) {
          // possibleAsync always false here, because we would have handled it above.
          this.parseCallExpressionArguments(tt.parenR, /* possibleAsync */ false);
        }
      }
      super.parseSubscript(startPos, noCalls, state);
    }

    parseNewArguments(): void {
      if (this.isRelational("<")) {
        // tsTryParseAndCatch is expensive, so avoid if not necessary.
        // 99% certain this is `new C<T>();`. But may be `new C < T;`, which is also legal.
        this.tsTryParseAndCatch(() => {
          this.state.type = tt.typeParameterStart;
          this.tsParseTypeArguments();
          if (!this.match(tt.parenL)) {
            this.unexpected();
          }
        });
      }

      super.parseNewArguments();
    }

    parseExprOp(minPrec: number, noIn: boolean | null): void {
      if (
        nonNull(tt._in.binop) > minPrec &&
        !this.hasPrecedingLineBreak() &&
        this.eatContextual("as")
      ) {
        this.state.tokens[this.state.tokens.length - 1].type = tt._as;
        this.runInTypeContext(1, () => {
          this.tsParseType();
        });
        this.parseExprOp(minPrec, noIn);
        return;
      }

      super.parseExprOp(minPrec, noIn);
    }

    /*
    Don't bother doing this check in TypeScript code because:
    1. We may have a nested export statement with the same name:
      export const x = 0;
      export namespace N {
        export const x = 1;
      }
    2. We have a type checker to warn us about this sort of thing.
    */
    checkDuplicateExports(): void {}

    parseImport(): void {
      if (this.match(tt.name) && this.lookaheadType() === tt.eq) {
        this.tsParseImportEqualsDeclaration();
        return;
      }
      super.parseImport();
    }

    parseExport(): void {
      if (this.match(tt._import)) {
        // `export import A = B;`
        this.expect(tt._import);
        this.tsParseImportEqualsDeclaration();
      } else if (this.eat(tt.eq)) {
        // `export = x;`
        this.parseExpression();
        this.semicolon();
      } else if (this.eatContextual("as")) {
        // `export as namespace A;`
        // See `parseNamespaceExportDeclaration` in TypeScript's own parser
        this.expectContextual("namespace");
        this.parseIdentifier();
        this.semicolon();
      } else {
        super.parseExport();
      }
    }

    parseExportDefaultExpression(): void {
      if (this.isContextual("abstract") && this.lookaheadType() === tt._class) {
        this.state.type = tt._abstract;
        this.next(); // Skip "abstract"
        this.parseClass(true, true);
        return;
      }
      super.parseExportDefaultExpression();
    }

    parseStatementContent(declaration: boolean, topLevel: boolean = false): void {
      if (this.state.type === tt._const) {
        const ahead = this.lookaheadTypeAndValue();
        if (ahead.type === tt.name && ahead.value === "enum") {
          this.expect(tt._const);
          this.expectContextual("enum");
          this.state.tokens[this.state.tokens.length - 1].type = tt._enum;
          this.tsParseEnumDeclaration();
          return;
        }
      }
      super.parseStatementContent(declaration, topLevel);
    }

    parseAccessModifier(): void {
      this.tsParseModifier(["public", "protected", "private"]);
    }

    parseClassMember(memberStart: number, classContextId: number): void {
      this.parseAccessModifier();
      super.parseClassMember(memberStart, classContextId);
    }

    parseClassMemberWithIsStatic(
      memberStart: number,
      isStatic: boolean,
      classContextId: number,
    ): void {
      let isAbstract = false;
      let isReadonly = false;

      const mod = this.tsParseModifier(["abstract", "readonly"]);
      switch (mod) {
        case "readonly":
          isReadonly = true;
          isAbstract = !!this.tsParseModifier(["abstract"]);
          break;
        case "abstract":
          isAbstract = true;
          isReadonly = !!this.tsParseModifier(["readonly"]);
          break;
        default:
          break;
      }

      // We no longer check for public/private/etc, but tsTryParseIndexSignature should just return
      // false in that case for valid code.
      if (!isAbstract && !isStatic) {
        const found = this.tsTryParseIndexSignature();
        if (found) {
          return;
        }
      }

      if (isReadonly) {
        // Must be a property (if not an index signature).
        this.parseClassPropertyName(classContextId);
        this.parsePostMemberNameModifiers();
        this.parseClassProperty();
        return;
      }

      super.parseClassMemberWithIsStatic(memberStart, isStatic, classContextId);
    }

    parsePostMemberNameModifiers(): void {
      this.eat(tt.question);
    }

    // Note: The reason we do this in `parseIdentifierStatement` and not `parseStatement`
    // is that e.g. `type()` is valid JS, so we must try parsing that first.
    // If it's really a type, we will parse `type` as the statement, and can correct it here
    // by parsing the rest.
    parseIdentifierStatement(name: string): void {
      const matched = this.tsParseExpressionStatement(name);
      if (!matched) {
        super.parseIdentifierStatement(name);
      }
    }

    // export type
    // Should be true for anything parsed by `tsTryParseExportDeclaration`.
    shouldParseExportDeclaration(): boolean {
      if (this.tsIsDeclarationStart()) return true;
      return super.shouldParseExportDeclaration();
    }

    // An apparent conditional expression could actually be an optional parameter in an arrow function.
    parseConditional(noIn: boolean | null, startPos: number, refNeedsArrowPos?: Pos | null): void {
      // only do the expensive clone if there is a question mark
      // and if we come from inside parens
      if (!refNeedsArrowPos || !this.match(tt.question)) {
        super.parseConditional(noIn, startPos, refNeedsArrowPos);
        return;
      }

      const snapshot = this.state.snapshot();
      try {
        super.parseConditional(noIn, startPos);
        return;
      } catch (err) {
        if (!(err instanceof SyntaxError)) {
          // istanbul ignore next: no such error is expected
          throw err;
        }

        this.state.restoreFromSnapshot(snapshot);
        // @ts-ignore
        refNeedsArrowPos.start = err.pos || this.state.start;
      }
    }

    // Note: These "type casts" are *not* valid TS expressions.
    // But we parse them here and change them when completing the arrow function.
    parseParenItem(): void {
      super.parseParenItem();
      if (this.eat(tt.question)) {
        this.state.tokens[this.state.tokens.length - 1].isType = true;
      }
      if (this.match(tt.colon)) {
        this.tsParseTypeAnnotation();
      }
    }

    parseExportDeclaration(): void {
      // "export declare" is equivalent to just "export".
      const isDeclare = this.eatContextual("declare");
      if (isDeclare) {
        this.state.tokens[this.state.tokens.length - 1].type = tt._declare;
      }

      let matchedDeclaration = false;
      if (this.match(tt.name)) {
        if (isDeclare) {
          matchedDeclaration = this.runInTypeContext(2, () => this.tsTryParseExportDeclaration());
        } else {
          matchedDeclaration = this.tsTryParseExportDeclaration();
        }
      }
      if (!matchedDeclaration) {
        if (isDeclare) {
          this.runInTypeContext(2, () => {
            super.parseExportDeclaration();
          });
        } else {
          super.parseExportDeclaration();
        }
      }
    }

    parseClassId(isStatement: boolean, optionalId: boolean = false): void {
      if ((!isStatement || optionalId) && this.isContextual("implements")) {
        return;
      }

      super.parseClassId(isStatement, optionalId);
      this.tsTryParseTypeParameters();
    }

    parseClassProperty(): void {
      this.tsTryParseTypeAnnotation();
      super.parseClassProperty();
    }

    parseClassMethod(
      functionStart: number,
      isGenerator: boolean,
      isAsync: boolean,
      isConstructor: boolean,
    ): void {
      this.tsTryParseTypeParameters();
      super.parseClassMethod(functionStart, isGenerator, isAsync, isConstructor);
    }

    parseClassSuper(): boolean {
      const hasSuper = super.parseClassSuper();
      if (hasSuper && this.isRelational("<")) {
        this.tsParseTypeArguments();
      }
      if (this.eatContextual("implements")) {
        this.state.tokens[this.state.tokens.length - 1].type = tt._implements;
        this.runInTypeContext(1, () => {
          this.tsParseHeritageClause();
        });
      }
      return hasSuper;
    }

    parseObjPropValue(
      isGenerator: boolean,
      isAsync: boolean,
      isPattern: boolean,
      isBlockScope: boolean,
      refShorthandDefaultPos: Pos | null,
      objectContextId: number,
    ): void {
      if (this.isRelational("<")) {
        throw new Error("TODO");
      }
      super.parseObjPropValue(
        isGenerator,
        isAsync,
        isPattern,
        isBlockScope,
        refShorthandDefaultPos,
        objectContextId,
      );
    }

    parseFunctionParams(allowModifiers?: boolean, contextId?: number): void {
      this.tsTryParseTypeParameters();
      super.parseFunctionParams(allowModifiers, contextId);
    }

    // `let x: number;`
    parseVarHead(isBlockScope: boolean): void {
      super.parseVarHead(isBlockScope);
      this.tsTryParseTypeAnnotation();
    }

    // parse the return type of an async arrow function - let foo = (async (): number => {});
    parseAsyncArrowFromCallExpression(functionStart: number, startTokenIndex: number): void {
      if (this.match(tt.colon)) {
        this.tsParseTypeAnnotation();
      }
      super.parseAsyncArrowFromCallExpression(functionStart, startTokenIndex);
    }

    // Returns true if the expression was an arrow function.
    parseMaybeAssign(
      noIn: boolean | null = null,
      refShorthandDefaultPos?: Pos | null,
      afterLeftParse?: Function,
      refNeedsArrowPos?: Pos | null,
    ): boolean {
      // Note: When the JSX plugin is on, type assertions (`<T> x`) aren't valid syntax.

      let jsxError: SyntaxError | null = null;

      if (this.match(tt.jsxTagStart)) {
        const context = this.curContext();
        assert(context === ct.j_oTag);
        // Only time j_oTag is pushed is right after j_expr.
        assert(this.state.context[this.state.context.length - 2] === ct.j_expr);

        // Prefer to parse JSX if possible. But may be an arrow fn.
        const snapshot = this.state.snapshot();
        try {
          return super.parseMaybeAssign(
            noIn,
            refShorthandDefaultPos,
            afterLeftParse,
            refNeedsArrowPos,
          );
        } catch (err) {
          if (!(err instanceof SyntaxError)) {
            // istanbul ignore next: no such error is expected
            throw err;
          }

          this.state.restoreFromSnapshot(snapshot);
          this.state.type = tt.typeParameterStart;
          // Pop the context added by the jsxTagStart.
          assert(this.curContext() === ct.j_oTag);
          this.state.context.pop();
          assert(this.curContext() === ct.j_expr);
          this.state.context.pop();
          jsxError = err;
        }
      }

      if (jsxError === null && !this.isRelational("<")) {
        return super.parseMaybeAssign(
          noIn,
          refShorthandDefaultPos,
          afterLeftParse,
          refNeedsArrowPos,
        );
      }

      // Either way, we're looking at a '<': tt.typeParameterStart or relational.

      let wasArrow = false;
      const snapshot = this.state.snapshot();
      try {
        // This is similar to TypeScript's `tryParseParenthesizedArrowFunctionExpression`.
        this.runInTypeContext(0, () => {
          this.tsParseTypeParameters();
        });
        wasArrow = super.parseMaybeAssign(
          noIn,
          refShorthandDefaultPos,
          afterLeftParse,
          refNeedsArrowPos,
        );
        if (!wasArrow) {
          this.unexpected(); // Go to the catch block (needs a SyntaxError).
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
        assert(!this.hasPlugin("jsx"));
        // Parsing an arrow function failed, so try a type cast.
        this.state.restoreFromSnapshot(snapshot);
        // This will start with a type assertion (via parseMaybeUnary).
        // But don't directly call `this.tsParseTypeAssertion` because we want to handle any binary after it.
        return super.parseMaybeAssign(
          noIn,
          refShorthandDefaultPos,
          afterLeftParse,
          refNeedsArrowPos,
        );
      }
      return wasArrow;
    }

    // Handle type assertions
    parseMaybeUnary(refShorthandDefaultPos?: Pos | null): boolean {
      if (!this.hasPlugin("jsx") && this.eatRelational("<")) {
        this.tsParseTypeAssertion();
        return false;
      } else {
        return super.parseMaybeUnary(refShorthandDefaultPos);
      }
    }

    parseArrow(): boolean {
      if (this.match(tt.colon)) {
        // This is different from how the TS parser does it.
        // TS uses lookahead. Babylon parses it as a parenthesized expression and converts.
        const snapshot = this.state.snapshot();
        try {
          this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
          if (this.canInsertSemicolon()) this.unexpected();
          if (!this.match(tt.arrow)) this.unexpected();
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state.restoreFromSnapshot(snapshot);
          } else {
            // istanbul ignore next: no such error is expected
            throw err;
          }
        }
      }
      return super.parseArrow();
    }

    // Allow type annotations inside of a parameter list.
    parseAssignableListItemTypes(): void {
      this.runInTypeContext(0, () => {
        this.eat(tt.question);
        this.tsTryParseTypeAnnotation();
      });
    }

    parseBindingAtom(isBlockScope: boolean): void {
      switch (this.state.type) {
        case tt._this:
          // "this" may be the name of a parameter, so allow it.
          this.runInTypeContext(0, () => {
            this.parseIdentifier();
          });
          return;
        default:
          super.parseBindingAtom(isBlockScope);
      }
    }

    // === === === === === === === === === === === === === === === ===
    // Note: All below methods are duplicates of something in flow.js.
    // Not sure what the best way to combine these is.
    // === === === === === === === === === === === === === === === ===

    isClassMethod(): boolean {
      return this.isRelational("<") || super.isClassMethod();
    }

    isClassProperty(): boolean {
      return this.match(tt.colon) || super.isClassProperty();
    }

    // ensure that inside types, we bypass the jsx parser plugin
    readToken(code: number): void {
      if (this.state.inType && (code === 62 || code === 60)) {
        this.finishOp(tt.relational, 1);
      } else {
        super.readToken(code);
      }
    }

    shouldParseArrow(): boolean {
      return this.match(tt.colon) || super.shouldParseArrow();
    }

    shouldParseAsyncArrow(): boolean {
      return this.match(tt.colon) || super.shouldParseAsyncArrow();
    }
  } as ParserClass;
