import Parser, {ParserClass} from "../parser";
import {types as ct} from "../tokenizer/context";
import {TokenType, types as tt} from "../tokenizer/types";
import * as N from "../types";
import {Pos, Position} from "../util/location";

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
function keywordTypeFromName(value: string): N.TsKeywordTypeType | typeof undefined {
  switch (value) {
    case "any":
      return "TSAnyKeyword";
    case "boolean":
      return "TSBooleanKeyword";
    case "never":
      return "TSNeverKeyword";
    case "number":
      return "TSNumberKeyword";
    case "object":
      return "TSObjectKeyword";
    case "string":
      return "TSStringKeyword";
    case "symbol":
      return "TSSymbolKeyword";
    case "undefined":
      return "TSUndefinedKeyword";
    default:
      return undefined;
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
        this.tsTryParse(this.tsNextTokenCanFollowModifier.bind(this))
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

    tsParseList<T extends N.Node>(kind: ParsingContext, parseElement: () => T): Array<T> {
      const result: Array<T> = [];
      while (!this.tsIsListTerminator(kind)) {
        // Skipping "parseListElement" from the TS source since that's just for error handling.
        result.push(parseElement());
      }
      return result;
    }

    tsParseDelimitedList<T extends N.Node>(kind: ParsingContext, parseElement: () => T): Array<T> {
      return nonNull(this.tsParseDelimitedListWorker(kind, parseElement, /* expectSuccess */ true));
    }

    tsTryParseDelimitedList<T extends N.Node>(
      kind: ParsingContext,
      parseElement: () => T | null,
    ): Array<T> | null {
      return this.tsParseDelimitedListWorker(kind, parseElement, /* expectSuccess */ false);
    }

    /**
     * If !expectSuccess, returns undefined instead of failing to parse.
     * If expectSuccess, parseElement should always return a defined value.
     */
    tsParseDelimitedListWorker<T extends N.Node>(
      kind: ParsingContext,
      parseElement: () => T | null,
      expectSuccess: boolean,
    ): Array<T> | null {
      const result = [];

      while (true) {
        if (this.tsIsListTerminator(kind)) {
          break;
        }

        const element = parseElement();
        if (element == null) {
          return null;
        }
        result.push(element);

        if (this.eat(tt.comma)) {
          continue;
        }

        if (this.tsIsListTerminator(kind)) {
          break;
        }

        if (expectSuccess) {
          // This will fail with an error about a missing comma
          this.expect(tt.comma);
        }
        return null;
      }

      return result;
    }

    tsParseBracketedList<T extends N.Node>(
      kind: ParsingContext,
      parseElement: () => T,
      bracket: boolean,
      skipFirstToken: boolean,
    ): Array<T> {
      if (!skipFirstToken) {
        if (bracket) {
          this.expect(tt.bracketL);
        } else {
          this.expectRelational("<");
        }
      }

      const result = this.tsParseDelimitedList(kind, parseElement);

      if (bracket) {
        this.expect(tt.bracketR);
      } else {
        this.expectRelational(">");
      }

      return result;
    }

    tsParseEntityName(allowReservedWords: boolean): N.TsEntityName {
      let entity: N.TsEntityName = this.parseIdentifier();
      while (this.eat(tt.dot)) {
        const node: N.TsQualifiedName = this.startNodeAtNode(entity);
        node.left = entity;
        node.right = this.parseIdentifier(allowReservedWords);
        entity = this.finishNode(node, "TSQualifiedName");
      }
      return entity;
    }

    tsParseTypeReference(): N.TsTypeReference {
      const node: N.TsTypeReference = this.startNode();
      node.typeName = this.tsParseEntityName(/* allowReservedWords */ false);
      if (!this.hasPrecedingLineBreak() && this.isRelational("<")) {
        node.typeParameters = this.tsParseTypeArguments();
      }
      return this.finishNode(node, "TSTypeReference");
    }

    tsParseThisTypePredicate(lhs: N.TsThisType): N.TsTypePredicate {
      this.next();
      const node: N.TsTypePredicate = this.startNode();
      node.parameterName = lhs;
      node.typeAnnotation = this.tsParseTypeAnnotation(/* eatColon */ false);
      return this.finishNode(node, "TSTypePredicate");
    }

    tsParseThisTypeNode(): N.TsThisType {
      const node: N.TsThisType = this.startNode();
      this.next();
      return this.finishNode(node, "TSThisType");
    }

    tsParseTypeQuery(): N.TsTypeQuery {
      const node: N.TsTypeQuery = this.startNode();
      this.expect(tt._typeof);
      node.exprName = this.tsParseEntityName(/* allowReservedWords */ true);
      return this.finishNode(node, "TSTypeQuery");
    }

    tsParseTypeParameter(): N.TsTypeParameter {
      const node: N.TsTypeParameter = this.startNode();
      node.name = this.parseIdentifierName(node.start);
      if (this.eat(tt._extends)) {
        node.constraint = this.tsParseType();
      }

      if (this.eat(tt.eq)) {
        node.default = this.tsParseType();
      }

      return this.finishNode(node, "TSTypeParameter");
    }

    tsTryParseTypeParameters(): N.TsTypeParameterDeclaration | null {
      if (this.isRelational("<")) {
        return this.tsParseTypeParameters();
      }
      return null;
    }

    tsParseTypeParameters(): N.TsTypeParameterDeclaration {
      return this.runInTypeContext(0, () => {
        const node: N.TsTypeParameterDeclaration = this.startNode();

        if (this.isRelational("<") || this.match(tt.typeParameterStart)) {
          this.next();
        } else {
          this.unexpected();
        }

        node.params = this.tsParseBracketedList(
          "TypeParametersOrArguments",
          this.tsParseTypeParameter.bind(this),
          /* bracket */ false,
          /* skipFirstToken */ true,
        );
        return this.finishNode(node, "TSTypeParameterDeclaration");
      });
    }

    // Note: In TypeScript implementation we must provide `yieldContext` and `awaitContext`,
    // but here it's always false, because this is only used for types.
    tsFillSignature(returnToken: TokenType, signature: N.TsSignatureDeclaration): void {
      // Arrow fns *must* have return token (`=>`). Normal functions can omit it.
      const returnTokenRequired = returnToken === tt.arrow;
      signature.typeParameters = this.tsTryParseTypeParameters();
      this.expect(tt.parenL);
      signature.parameters = this.tsParseBindingListForSignature(false /* isBlockScope */);
      if (returnTokenRequired) {
        signature.typeAnnotation = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
      } else if (this.match(returnToken)) {
        signature.typeAnnotation = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
      }
    }

    tsParseBindingListForSignature(
      isBlockScope: boolean,
    ): ReadonlyArray<N.Identifier | N.RestElement> {
      return this.parseBindingList(tt.parenR, isBlockScope).map(
        (pattern: N.Identifier | N.RestElement) => {
          if (pattern.type !== "Identifier" && pattern.type !== "RestElement") {
            throw this.unexpected(pattern.start, "Name in a signature must be an Identifier.");
          }
          return pattern;
        },
      );
    }

    tsParseTypeMemberSemicolon(): void {
      if (!this.eat(tt.comma)) {
        this.semicolon();
      }
    }

    tsParseSignatureMember(
      kind: "TSCallSignatureDeclaration" | "TSConstructSignatureDeclaration",
    ): N.TsCallSignatureDeclaration | N.TsConstructSignatureDeclaration {
      const node:
        | N.TsCallSignatureDeclaration
        | N.TsConstructSignatureDeclaration = this.startNode();
      if (kind === "TSConstructSignatureDeclaration") {
        this.expect(tt._new);
      }
      this.tsFillSignature(tt.colon, node);
      this.tsParseTypeMemberSemicolon();
      return this.finishNode(node, kind);
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
      const id = this.parseIdentifier();
      this.expect(tt.colon);
      id.typeAnnotation = this.tsParseTypeAnnotation(/* eatColon */ false);
      this.expect(tt.bracketR);

      this.tsTryParseTypeAnnotation();
      this.tsParseTypeMemberSemicolon();
      return true;
    }

    tsParsePropertyOrMethodSignature(
      node: N.TsPropertySignature | N.TsMethodSignature,
      readonly: boolean,
    ): N.TsPropertySignature | N.TsMethodSignature {
      this.parsePropertyName(-1 /* Types don't need context IDs. */);
      if (this.eat(tt.question)) node.optional = true;
      const nodeAny: N.Node = node;

      if (!readonly && (this.match(tt.parenL) || this.isRelational("<"))) {
        const method: N.TsMethodSignature = nodeAny as N.TsMethodSignature;
        this.tsFillSignature(tt.colon, method);
        this.tsParseTypeMemberSemicolon();
        return this.finishNode(method, "TSMethodSignature");
      } else {
        const property: N.TsPropertySignature = nodeAny as N.TsPropertySignature;
        if (readonly) property.readonly = true;
        const type = this.tsTryParseTypeAnnotation();
        if (type) property.typeAnnotation = type;
        this.tsParseTypeMemberSemicolon();
        return this.finishNode(property, "TSPropertySignature");
      }
    }

    tsParseTypeMember(): N.TsTypeElement {
      if (this.match(tt.parenL) || this.isRelational("<")) {
        return this.tsParseSignatureMember("TSCallSignatureDeclaration");
      }
      if (this.match(tt._new) && this.tsLookAhead(this.tsIsStartOfConstructSignature.bind(this))) {
        return this.tsParseSignatureMember("TSConstructSignatureDeclaration");
      }
      // Instead of fullStart, we create a node here.
      const node = this.startNode();
      const readonly = !!this.tsParseModifier(["readonly"]);

      const found = this.tsTryParseIndexSignature();
      if (found) {
        return this.startNode();
      }
      return this.tsParsePropertyOrMethodSignature(node as N.TsMethodSignature, readonly);
    }

    tsIsStartOfConstructSignature(): boolean {
      this.next();
      return this.match(tt.parenL) || this.isRelational("<");
    }

    tsParseTypeLiteral(): N.TsTypeLiteral {
      const node: N.TsTypeLiteral = this.startNode();
      node.members = this.tsParseObjectTypeMembers();
      return this.finishNode(node, "TSTypeLiteral");
    }

    tsParseObjectTypeMembers(): ReadonlyArray<N.TsTypeElement> {
      this.expect(tt.braceL);
      const members = this.tsParseList<N.TsTypeElement>(
        "TypeMembers",
        this.tsParseTypeMember.bind(this),
      );
      this.expect(tt.braceR);
      return members;
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

    tsParseMappedTypeParameter(): N.TsTypeParameter {
      const node: N.TsTypeParameter = this.startNode();
      node.name = this.parseIdentifierName(node.start);
      this.expect(tt._in);
      node.constraint = this.tsParseType();
      return this.finishNode(node, "TSTypeParameter");
    }

    tsParseMappedType(): N.TsMappedType {
      const node: N.TsMappedType = this.startNode();

      this.expect(tt.braceL);
      if (this.eatContextual("readonly")) {
        node.readonly = true;
      }
      this.expect(tt.bracketL);
      node.typeParameter = this.tsParseMappedTypeParameter();
      this.expect(tt.bracketR);
      if (this.eat(tt.question)) {
        node.optional = true;
      }
      node.typeAnnotation = this.tsTryParseType();
      this.semicolon();
      this.expect(tt.braceR);

      return this.finishNode(node, "TSMappedType");
    }

    tsParseTupleType(): N.TsTupleType {
      const node: N.TsTupleType = this.startNode();
      node.elementTypes = this.tsParseBracketedList(
        "TupleElementTypes",
        this.tsParseType.bind(this),
        /* bracket */ true,
        /* skipFirstToken */ false,
      );
      return this.finishNode(node, "TSTupleType");
    }

    tsParseParenthesizedType(): N.TsParenthesizedType {
      const node = this.startNode<N.TsParenthesizedType>();
      this.expect(tt.parenL);
      node.typeAnnotation = this.tsParseType();
      this.expect(tt.parenR);
      return this.finishNode(node, "TSParenthesizedType");
    }

    tsParseFunctionOrConstructorType(
      type: "TSFunctionType" | "TSConstructorType",
    ): N.TsFunctionOrConstructorType {
      const node: N.TsFunctionOrConstructorType = this.startNode();
      if (type === "TSConstructorType") {
        this.expect(tt._new);
      }
      this.tsFillSignature(tt.arrow, node);
      return this.finishNode(node, type);
    }

    tsParseLiteralTypeNode(): N.TsLiteralType {
      const node: N.TsLiteralType = this.startNode();
      node.literal = (() => {
        switch (this.state.type) {
          case tt.num:
            return this.parseLiteral<N.NumericLiteral>(this.state.value, "NumericLiteral");
          case tt.string:
            return this.parseLiteral<N.StringLiteral>(this.state.value, "StringLiteral");
          case tt._true:
          case tt._false:
            return this.parseBooleanLiteral();
          default:
            throw this.unexpected();
        }
      })();
      return this.finishNode(node, "TSLiteralType");
    }

    tsParseNonArrayType(): N.TsType {
      switch (this.state.type) {
        case tt.name:
        case tt._void:
        case tt._null: {
          let type;
          if (this.match(tt._void)) {
            type = "TSVoidKeyword";
          } else {
            type = this.match(tt._null) ? "TSNullKeyword" : keywordTypeFromName(this.state.value);
          }
          if (type !== undefined && this.lookahead().type !== tt.dot) {
            const node: N.TsKeywordType = this.startNode();
            this.next();
            return this.finishNode(node, type);
          }
          return this.tsParseTypeReference();
        }
        case tt.string:
        case tt.num:
        case tt._true:
        case tt._false:
          return this.tsParseLiteralTypeNode();
        case tt.plusMin:
          if (this.state.value === "-") {
            const node: N.TsLiteralType = this.startNode();
            this.next();
            if (!this.match(tt.num)) {
              throw this.unexpected();
            }
            node.literal = this.parseLiteral(
              -this.state.value,
              "NumericLiteral",
              node.start,
              node.loc.start,
            );
            return this.finishNode(node, "TSLiteralType");
          }
          break;
        case tt._this: {
          const thisKeyword = this.tsParseThisTypeNode();
          if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
            return this.tsParseThisTypePredicate(thisKeyword);
          } else {
            return thisKeyword;
          }
        }
        case tt._typeof:
          return this.tsParseTypeQuery();
        case tt.braceL:
          return this.tsLookAhead(this.tsIsStartOfMappedType.bind(this))
            ? this.tsParseMappedType()
            : this.tsParseTypeLiteral();
        case tt.bracketL:
          return this.tsParseTupleType();
        case tt.parenL:
          return this.tsParseParenthesizedType();
        default:
          break;
      }

      throw this.unexpected();
    }

    tsParseArrayTypeOrHigher(): N.TsType {
      let type = this.tsParseNonArrayType();
      while (!this.hasPrecedingLineBreak() && this.eat(tt.bracketL)) {
        if (this.match(tt.bracketR)) {
          const node: N.TsArrayType = this.startNodeAtNode(type);
          node.elementType = type;
          this.expect(tt.bracketR);
          type = this.finishNode(node, "TSArrayType");
        } else {
          const node: N.TsIndexedAccessType = this.startNodeAtNode(type);
          node.objectType = type;
          node.indexType = this.tsParseType();
          this.expect(tt.bracketR);
          type = this.finishNode(node, "TSIndexedAccessType");
        }
      }
      return type;
    }

    tsParseTypeOperator(operator: "keyof"): N.TsTypeOperator {
      const node = this.startNode();
      this.expectContextual(operator);
      node.operator = operator;
      node.typeAnnotation = this.tsParseTypeOperatorOrHigher();
      return this.finishNode(node as N.TsTypeOperator, "TSTypeOperator");
    }

    tsParseTypeOperatorOrHigher(): N.TsType {
      if (this.isContextual("keyof")) {
        return this.tsParseTypeOperator("keyof");
      }
      return this.tsParseArrayTypeOrHigher();
    }

    tsParseUnionOrIntersectionType(
      kind: "TSUnionType" | "TSIntersectionType",
      parseConstituentType: () => N.TsType,
      operator: TokenType,
    ): N.TsType {
      this.eat(operator);
      let type = parseConstituentType();
      if (this.match(operator)) {
        const types = [type];
        while (this.eat(operator)) {
          types.push(parseConstituentType());
        }
        const node: N.TsUnionType | N.TsIntersectionType = this.startNodeAtNode(type);
        node.types = types;
        type = this.finishNode(node, kind);
      }
      return type;
    }

    tsParseIntersectionTypeOrHigher(): N.TsType {
      return this.tsParseUnionOrIntersectionType(
        "TSIntersectionType",
        this.tsParseTypeOperatorOrHigher.bind(this),
        tt.bitwiseAND,
      );
    }

    tsParseUnionTypeOrHigher(): N.TsType {
      return this.tsParseUnionOrIntersectionType(
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

    tsParseTypeOrTypePredicateAnnotation(returnToken: TokenType): N.TsTypeAnnotation {
      return this.runInTypeContext(0, () => {
        const t: N.TsTypeAnnotation = this.startNode();
        this.expect(returnToken);

        const typePredicateVariable =
          this.tsIsIdentifier() && this.tsTryParse(this.tsParseTypePredicatePrefix.bind(this));

        if (!typePredicateVariable) {
          return this.tsParseTypeAnnotation(/* eatColon */ false, t);
        }

        const type = this.tsParseTypeAnnotation(/* eatColon */ false);

        const node: N.TsTypePredicate = this.startNodeAtNode(
          typePredicateVariable as N.TsTypePredicate,
        );
        node.parameterName = typePredicateVariable as N.Identifier;
        node.typeAnnotation = type;
        t.typeAnnotation = this.finishNode(node, "TSTypePredicate");
        return this.finishNode(t, "TSTypeAnnotation");
      });
    }

    tsTryParseTypeOrTypePredicateAnnotation(): N.TsTypeAnnotation | null {
      return this.match(tt.colon) ? this.tsParseTypeOrTypePredicateAnnotation(tt.colon) : null;
    }

    tsTryParseTypeAnnotation(): N.TsTypeAnnotation | null {
      return this.match(tt.colon) ? this.tsParseTypeAnnotation() : null;
    }

    tsTryParseType(): N.TsType | null {
      return this.eat(tt.colon) ? this.tsParseType() : null;
    }

    tsParseTypePredicatePrefix(): N.Identifier | null {
      const id = this.parseIdentifier();
      if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
        this.next();
        return id;
      }
      return null;
    }

    tsParseTypeAnnotation(
      eatColon: boolean = true,
      t: N.TsTypeAnnotation = this.startNode(),
    ): N.TsTypeAnnotation {
      return this.runInTypeContext(0, () => {
        if (eatColon) this.expect(tt.colon);
        t.typeAnnotation = this.tsParseType();
        return this.finishNode(t, "TSTypeAnnotation");
      });
    }

    tsParseType(): N.TsType {
      // Need to set `state.inType` so that we don't parse JSX in a type context.
      const oldInType = this.state.inType;
      this.state.inType = true;
      try {
        if (this.tsIsStartOfFunctionType()) {
          return this.tsParseFunctionOrConstructorType("TSFunctionType");
        }
        if (this.match(tt._new)) {
          // As in `new () => Date`
          return this.tsParseFunctionOrConstructorType("TSConstructorType");
        }
        return this.tsParseUnionTypeOrHigher();
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

    tsTryParseTypeArgumentsInExpression(): N.TsTypeParameterInstantiation | null {
      return this.tsTryParseAndCatch(() => {
        const node = this.runInTypeContext(0, () => {
          const res: N.TsTypeParameterInstantiation = this.startNode();
          this.expectRelational("<");
          this.state.tokens[this.state.tokens.length - 1].type = tt.typeParameterStart;
          const typeArguments = this.tsParseDelimitedList<N.TsType>(
            "TypeParametersOrArguments",
            this.tsParseType.bind(this),
          );
          this.expectRelational(">");
          res.params = typeArguments;
          this.finishNode(res, "TSTypeParameterInstantiation");
          return res;
        });
        this.expect(tt.parenL);
        return node;
      });
    }

    tsParseHeritageClause(): ReadonlyArray<N.TsExpressionWithTypeArguments> {
      return this.tsParseDelimitedList(
        "HeritageClauseElement",
        this.tsParseExpressionWithTypeArguments.bind(this),
      );
    }

    tsParseExpressionWithTypeArguments(): N.TsExpressionWithTypeArguments {
      const node: N.TsExpressionWithTypeArguments = this.startNode();
      // Note: TS uses parseLeftHandSideExpressionOrHigher,
      // then has grammar errors later if it's not an EntityName.
      node.expression = this.tsParseEntityName(/* allowReservedWords */ false);
      if (this.isRelational("<")) {
        node.typeParameters = this.tsParseTypeArguments();
      }

      return this.finishNode(node, "TSExpressionWithTypeArguments");
    }

    tsParseInterfaceDeclaration(node: N.TsInterfaceDeclaration): N.TsInterfaceDeclaration {
      node.id = this.parseIdentifier();
      node.typeParameters = this.tsTryParseTypeParameters();
      if (this.eat(tt._extends)) {
        node.extends = this.tsParseHeritageClause();
      }
      const body: N.TSInterfaceBody = this.startNode();
      body.body = this.tsParseObjectTypeMembers();
      node.body = this.finishNode(body, "TSInterfaceBody");
      return this.finishNode(node, "TSInterfaceDeclaration");
    }

    tsParseTypeAliasDeclaration(node: N.TsTypeAliasDeclaration): N.TsTypeAliasDeclaration {
      node.id = this.parseIdentifier();
      node.typeParameters = this.tsTryParseTypeParameters();
      this.expect(tt.eq);
      node.typeAnnotation = this.tsParseType();
      this.semicolon();
      return this.finishNode(node, "TSTypeAliasDeclaration");
    }

    tsParseEnumMember(): N.TsEnumMember {
      // Computed property names are grammar errors in an enum, so accept just string literal or identifier.
      if (this.match(tt.string)) {
        this.parseLiteral<N.StringLiteral>(this.state.value, "StringLiteral");
      } else {
        this.parseIdentifier(/* liberal */ true);
      }
      if (this.eat(tt.eq)) {
        const eqIndex = this.state.tokens.length - 1;
        this.parseMaybeAssign();
        this.state.tokens[eqIndex].rhsEndIndex = this.state.tokens.length;
      }
      return this.startNode();
    }

    tsParseEnumDeclaration(): void {
      this.parseIdentifier();
      this.expect(tt.braceL);
      this.tsParseDelimitedList("EnumMembers", this.tsParseEnumMember.bind(this));
      this.expect(tt.braceR);
    }

    tsParseModuleBlock(): N.TsModuleBlock {
      const node: N.TsModuleBlock = this.startNode();
      this.expect(tt.braceL);
      // Inside of a module block is considered "top-level", meaning it can have imports and exports.
      this.parseBlockBody(/* topLevel */ true, /* end */ tt.braceR);
      return this.finishNode(node, "TSModuleBlock");
    }

    tsParseModuleOrNamespaceDeclaration(node: N.TsModuleDeclaration): N.TsModuleDeclaration {
      node.id = this.parseIdentifier();
      if (this.eat(tt.dot)) {
        const inner = this.startNode();
        this.tsParseModuleOrNamespaceDeclaration(inner as N.TsModuleDeclaration);
        node.body = inner as N.TsNamespaceBody;
      } else {
        node.body = this.tsParseModuleBlock();
      }
      return this.finishNode(node, "TSModuleDeclaration");
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
      return this.isContextual("require") && this.lookahead().type === tt.parenL;
    }

    tsParseModuleReference(): N.TsModuleReference {
      return this.tsIsExternalModuleReference()
        ? this.tsParseExternalModuleReference()
        : this.tsParseEntityName(/* allowReservedWords */ false);
    }

    tsParseExternalModuleReference(): N.TsExternalModuleReference {
      const node: N.TsExternalModuleReference = this.startNode();
      this.expectContextual("require");
      this.expect(tt.parenL);
      if (!this.match(tt.string)) {
        throw this.unexpected();
      }
      node.expression = this.parseLiteral(this.state.value, "StringLiteral");
      this.expect(tt.parenR);
      return this.finishNode(node, "TSExternalModuleReference");
    }

    // Utilities

    tsLookAhead<T>(f: () => T): T {
      const state = this.state.clone();
      const res = f();
      this.state = state;
      return res;
    }

    tsTryParseAndCatch<T>(f: () => T): T | null {
      const state = this.state.clone();
      try {
        return f();
      } catch (e) {
        if (e instanceof SyntaxError) {
          this.state = state;
          return null;
        }
        throw e;
      }
    }

    tsTryParse<T>(f: () => T | null): T | null {
      const state = this.state.clone();
      const result = f();
      // @ts-ignore
      if (result !== null && result !== false) {
        return result;
      } else {
        this.state = state;
        return null;
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
              this.tsParseInterfaceDeclaration(this.startNode());
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
            this.runInTypeContext(next ? 2 : 1, () =>
              this.tsParseModuleOrNamespaceDeclaration(this.startNode()),
            );
            return true;
          }
          break;

        case "namespace":
          if (next || this.match(tt.name)) {
            this.runInTypeContext(1, () => {
              if (next) this.next();
              return this.tsParseModuleOrNamespaceDeclaration(this.startNode());
            });
            return true;
          }
          break;

        case "type":
          if (next || this.match(tt.name)) {
            this.runInTypeContext(1, () => {
              if (next) this.next();
              return this.tsParseTypeAliasDeclaration(this.startNode());
            });
            return true;
          }
          break;

        default:
          break;
      }
      return false;
    }

    tsTryParseGenericAsyncArrowFunction(
      startPos: number,
      startLoc: Position,
    ): N.ArrowFunctionExpression | null {
      const res: N.ArrowFunctionExpression | null = this.tsTryParseAndCatch(() => {
        const node: N.ArrowFunctionExpression = this.startNodeAt(startPos, startLoc);
        node.typeParameters = this.tsParseTypeParameters();
        // Don't use overloaded parseFunctionParams which would look for "<" again.
        super.parseFunctionParams();
        node.returnType = this.tsTryParseTypeOrTypePredicateAnnotation();
        this.expect(tt.arrow);
        return node;
      });

      if (!res) {
        return null;
      }

      res.id = null;
      res.generator = false;
      res.expression = true; // May be set again by parseFunctionBody.
      res.async = true;
      this.parseFunctionBody(res.start, true /* isAsync */, false /* isGenerator */, true);
      return this.finishNode(res, "ArrowFunctionExpression");
    }

    tsParseTypeArguments(): N.TsTypeParameterInstantiation {
      return this.runInTypeContext(0, () => {
        const node = this.startNode();
        this.expectRelational("<");
        node.params = this.tsParseDelimitedList(
          "TypeParametersOrArguments",
          this.tsParseType.bind(this),
        );
        this.expectRelational(">");
        return this.finishNode(
          node as N.TsTypeParameterInstantiation,
          "TSTypeParameterInstantiation",
        );
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
      isAsync: boolean,
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
        isAsync,
        isGenerator,
        allowExpressionBody,
        funcContextId,
      );
    }

    parseSubscript(
      startPos: number,
      startLoc: Position,
      noCalls: boolean | null,
      state: {stop: boolean},
    ): void {
      if (!this.hasPrecedingLineBreak() && this.eat(tt.bang)) {
        return;
      }

      if (!noCalls && this.isRelational("<")) {
        if (this.atPossibleAsync()) {
          // Almost certainly this is a generic async function `async <T>() => ...
          // But it might be a call with a type argument `async<T>();`
          const asyncArrowFn = this.tsTryParseGenericAsyncArrowFunction(startPos, startLoc);
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
      super.parseSubscript(startPos, startLoc, noCalls, state);
    }

    parseNewArguments(): void {
      if (this.isRelational("<")) {
        // tsTryParseAndCatch is expensive, so avoid if not necessary.
        // 99% certain this is `new C<T>();`. But may be `new C < T;`, which is also legal.
        this.tsTryParseAndCatch(() => {
          this.state.type = tt.typeParameterStart;
          const args = this.tsParseTypeArguments();
          if (!this.match(tt.parenL)) this.unexpected();
          return args;
        });
      }

      super.parseNewArguments();
    }

    parseExprOp(
      leftStartPos: number,
      leftStartLoc: Position,
      minPrec: number,
      noIn: boolean | null,
    ): void {
      if (
        nonNull(tt._in.binop) > minPrec &&
        !this.hasPrecedingLineBreak() &&
        this.eatContextual("as")
      ) {
        this.state.tokens[this.state.tokens.length - 1].type = tt._as;
        this.runInTypeContext(1, () => this.tsParseType());
        this.parseExprOp(leftStartPos, leftStartLoc, minPrec, noIn);
        return;
      }

      super.parseExprOp(leftStartPos, leftStartLoc, minPrec, noIn);
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
      if (this.match(tt.name) && this.lookahead().type === tt.eq) {
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
      if (this.isContextual("abstract") && this.lookahead().type === tt._class) {
        this.state.type = tt._abstract;
        this.next(); // Skip "abstract"
        this.parseClass(true, true);
        return;
      }
      super.parseExportDefaultExpression();
    }

    parseStatementContent(declaration: boolean, topLevel: boolean = false): void {
      if (this.state.type === tt._const) {
        const ahead = this.lookahead();
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

    parseAccessModifier(): N.Accessibility | null {
      return this.tsParseModifier(["public", "protected", "private"]);
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
    parseConditional(
      noIn: boolean | null,
      startPos: number,
      startLoc: Position,
      refNeedsArrowPos?: Pos | null,
    ): void {
      // only do the expensive clone if there is a question mark
      // and if we come from inside parens
      if (!refNeedsArrowPos || !this.match(tt.question)) {
        super.parseConditional(noIn, startPos, startLoc, refNeedsArrowPos);
        return;
      }

      const state = this.state.clone();
      try {
        super.parseConditional(noIn, startPos, startLoc);
        return;
      } catch (err) {
        if (!(err instanceof SyntaxError)) {
          // istanbul ignore next: no such error is expected
          throw err;
        }

        this.state = state;
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
        this.runInTypeContext(1, () => this.tsParseHeritageClause());
      }
      return hasSuper;
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
      if (this.isRelational("<")) {
        throw new Error("TODO");
      }

      super.parseObjPropValue(
        prop,
        startPos,
        startLoc,
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
        const state = this.state.clone();
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

          this.state = state;
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
      const state = this.state.clone();
      try {
        // This is similar to TypeScript's `tryParseParenthesizedArrowFunctionExpression`.
        this.runInTypeContext(0, () => this.tsParseTypeParameters());
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
        this.state = state;
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
        const state = this.state.clone();
        try {
          const returnType = this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
          if (this.canInsertSemicolon()) this.unexpected();
          if (!this.match(tt.arrow)) this.unexpected();
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state = state;
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

    parseBindingAtom(isBlockScope: boolean): N.Pattern {
      switch (this.state.type) {
        case tt._this:
          // "this" may be the name of a parameter, so allow it.
          return this.runInTypeContext(0, () => this.parseIdentifier(/* liberal */ true));
        default:
          return super.parseBindingAtom(isBlockScope);
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

    typeCastToParameter(node: N.TsTypeCastExpression): N.Node {
      node.expression.typeAnnotation = node.typeAnnotation;

      return this.finishNodeAt(
        node.expression,
        node.expression.type,
        node.typeAnnotation.end,
        node.typeAnnotation.loc.end,
      );
    }

    shouldParseArrow(): boolean {
      return this.match(tt.colon) || super.shouldParseArrow();
    }

    shouldParseAsyncArrow(): boolean {
      return this.match(tt.colon) || super.shouldParseAsyncArrow();
    }
  } as ParserClass;
