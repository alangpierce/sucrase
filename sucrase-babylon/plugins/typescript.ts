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

    tsTryParseIndexSignature(node: N.TsIndexSignature): N.TsIndexSignature | null {
      if (
        !(
          this.match(tt.bracketL) &&
          this.tsLookAhead(this.tsIsUnambiguouslyIndexSignature.bind(this))
        )
      ) {
        return null;
      }

      this.expect(tt.bracketL);
      const id = this.parseIdentifier();
      this.expect(tt.colon);
      id.typeAnnotation = this.tsParseTypeAnnotation(/* eatColon */ false);
      this.expect(tt.bracketR);
      node.parameters = [id];

      const type = this.tsTryParseTypeAnnotation();
      if (type) node.typeAnnotation = type;
      this.tsParseTypeMemberSemicolon();
      return this.finishNode(node, "TSIndexSignature");
    }

    tsParsePropertyOrMethodSignature(
      node: N.TsPropertySignature | N.TsMethodSignature,
      readonly: boolean,
    ): N.TsPropertySignature | N.TsMethodSignature {
      this.parsePropertyName(node, -1 /* Types don't need context IDs. */);
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

      const idx = this.tsTryParseIndexSignature(node as N.TsIndexSignature);
      if (idx) {
        if (readonly) node.readonly = true;
        return idx;
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

    tsParseTypeAssertion(): N.TsTypeAssertion {
      const node: N.TsTypeAssertion = this.startNode();
      node.typeAnnotation = this.tsParseType();
      this.expectRelational(">");
      node.expression = this.parseMaybeUnary();
      return this.finishNode(node, "TSTypeAssertion");
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
      const node: N.TsEnumMember = this.startNode();
      // Computed property names are grammar errors in an enum, so accept just string literal or identifier.
      node.id = this.match(tt.string)
        ? this.parseLiteral<N.StringLiteral>(this.state.value, "StringLiteral")
        : this.parseIdentifier(/* liberal */ true);
      if (this.eat(tt.eq)) {
        const eqIndex = this.state.tokens.length - 1;
        node.initializer = this.parseMaybeAssign();
        this.state.tokens[eqIndex].rhsEndIndex = this.state.tokens.length;
      }
      return this.finishNode(node, "TSEnumMember");
    }

    tsParseEnumDeclaration(node: N.TsEnumDeclaration, isConst: boolean): N.TsEnumDeclaration {
      if (isConst) node.const = true;
      node.id = this.parseIdentifier();
      this.expect(tt.braceL);
      node.members = this.tsParseDelimitedList("EnumMembers", this.tsParseEnumMember.bind(this));
      this.expect(tt.braceR);
      return this.finishNode(node, "TSEnumDeclaration");
    }

    tsParseModuleBlock(): N.TsModuleBlock {
      const node: N.TsModuleBlock = this.startNode();
      this.expect(tt.braceL);
      // Inside of a module block is considered "top-level", meaning it can have imports and exports.
      this.parseBlockOrModuleBlockBody(
        (node.body = []),
        /* directives */ null,
        /* topLevel */ true,
        /* end */ tt.braceR,
      );
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

    tsParseAmbientExternalModuleDeclaration(node: N.TsModuleDeclaration): N.TsModuleDeclaration {
      if (this.isContextual("global")) {
        node.global = true;
        node.id = this.parseIdentifier();
      } else if (this.match(tt.string)) {
        node.id = this.parseExprAtom() as N.StringLiteral;
      } else {
        this.unexpected();
      }

      if (this.match(tt.braceL)) {
        node.body = this.tsParseModuleBlock();
      } else {
        this.semicolon();
      }

      return this.finishNode(node, "TSModuleDeclaration");
    }

    tsParseImportEqualsDeclaration(
      node: N.TsImportEqualsDeclaration,
      isExport?: boolean,
    ): N.TsImportEqualsDeclaration {
      node.isExport = isExport || false;
      node.id = this.parseIdentifier();
      this.expect(tt.eq);
      node.moduleReference = this.tsParseModuleReference();
      this.semicolon();
      return this.finishNode(node, "TSImportEqualsDeclaration");
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

    nodeWithSamePosition<T extends N.Node>(original: N.Node, type: string): T {
      const node = this.startNodeAtNode<T>(original);
      node.type = type;
      node.end = original.end;
      node.loc.end = original.loc.end;

      if (original.leadingComments) {
        node.leadingComments = original.leadingComments;
      }
      if (original.trailingComments) {
        node.trailingComments = original.trailingComments;
      }
      if (original.innerComments) node.innerComments = original.innerComments;

      return node;
    }

    tsTryParseDeclare(nany: N.Node): N.Declaration | null {
      switch (this.state.type) {
        case tt._function:
          return this.runInTypeContext(1, () => {
            this.next();
            return this.parseFunction(
              nany as N.NormalFunction,
              /* isStatement */ true,
            ) as N.Declaration;
          });
        case tt._class:
          return this.runInTypeContext(
            1,
            () =>
              this.parseClass(
                nany as N.Class,
                /* isStatement */ true,
                /* optionalId */ false,
              ) as N.Declaration,
          );
        case tt._const:
          if (this.match(tt._const) && this.isLookaheadContextual("enum")) {
            return this.runInTypeContext(1, () => {
              // `const enum = 0;` not allowed because "enum" is a strict mode reserved word.
              this.expect(tt._const);
              this.expectContextual("enum");
              this.state.tokens[this.state.tokens.length - 1].type = tt._enum;
              return this.tsParseEnumDeclaration(nany as N.TsEnumDeclaration, /* isConst */ true);
            });
          }
        // falls through
        case tt._var:
        case tt._let:
          return this.runInTypeContext(1, () =>
            this.parseVarStatement(nany as N.VariableDeclaration, this.state.type),
          );
        case tt.name: {
          return this.runInTypeContext(1, () => {
            const value = this.state.value;
            if (value === "global") {
              return this.tsParseAmbientExternalModuleDeclaration(nany as N.TsModuleDeclaration);
            } else {
              return this.tsParseDeclaration(nany, value, /* next */ true);
            }
          });
        }
        default:
          return null;
      }
    }

    // Note: this won't be called unless the keyword is allowed in `shouldParseExportDeclaration`.
    tsTryParseExportDeclaration(): N.Declaration | null {
      return this.tsParseDeclaration(this.startNode(), this.state.value, /* next */ true);
    }

    tsParseExpressionStatement(node: N.Node, expr: N.Identifier): N.Declaration | null {
      switch (expr.name) {
        case "declare": {
          const declareTokenIndex = this.state.tokens.length - 1;
          const declaration = this.tsTryParseDeclare(node);
          if (declaration) {
            this.state.tokens[declareTokenIndex].type = tt._declare;
            declaration.declare = true;
            return declaration;
          }
          break;
        }
        case "global":
          // `global { }` (with no `declare`) may appear inside an ambient module declaration.
          // Would like to use tsParseAmbientExternalModuleDeclaration here, but already ran past "global".
          if (this.match(tt.braceL)) {
            const mod: N.TsModuleDeclaration = node as N.TsModuleDeclaration;
            mod.global = true;
            mod.id = expr;
            mod.body = this.tsParseModuleBlock();
            return this.finishNode(mod, "TSModuleDeclaration");
          }
          break;

        default:
          return this.tsParseDeclaration(node, expr.name, /* next */ false);
      }
      return null;
    }

    // Common to tsTryParseDeclare, tsTryParseExportDeclaration, and tsParseExpressionStatement.
    tsParseDeclaration(node: N.Node, value: string, next: boolean): N.Declaration | null {
      switch (value) {
        case "abstract":
          if (next || this.match(tt._class)) {
            this.state.type = tt._abstract;
            const cls: N.ClassDeclaration = node as N.ClassDeclaration;
            cls.abstract = true;
            if (next) this.next();
            return this.parseClass(cls, /* isStatement */ true, /* optionalId */ false);
          }
          break;

        case "enum":
          if (next || this.match(tt.name)) {
            if (next) this.next();
            this.state.tokens[this.state.tokens.length - 1].type = tt._enum;
            return this.tsParseEnumDeclaration(node as N.TsEnumDeclaration, /* isConst */ false);
          }
          break;

        case "interface":
          if (next || this.match(tt.name)) {
            // `next` is true in "export" and "declare" contexts, so we want to remove that token
            // as well.
            return this.runInTypeContext(1, () => {
              if (next) this.next();
              return this.tsParseInterfaceDeclaration(node as N.TsInterfaceDeclaration);
            });
          }
          break;

        case "module":
          if (next) this.next();
          if (this.match(tt.string)) {
            return this.runInTypeContext(next ? 2 : 1, () =>
              this.tsParseAmbientExternalModuleDeclaration(node as N.TsModuleDeclaration),
            );
          } else if (next || this.match(tt.name)) {
            return this.runInTypeContext(next ? 2 : 1, () =>
              this.tsParseModuleOrNamespaceDeclaration(node as N.TsModuleDeclaration),
            );
          }
          break;

        case "namespace":
          if (next || this.match(tt.name)) {
            return this.runInTypeContext(1, () => {
              if (next) this.next();
              return this.tsParseModuleOrNamespaceDeclaration(node as N.TsModuleDeclaration);
            });
          }
          break;

        case "type":
          if (next || this.match(tt.name)) {
            return this.runInTypeContext(1, () => {
              if (next) this.next();
              return this.tsParseTypeAliasDeclaration(node as N.TsTypeAliasDeclaration);
            });
          }
          break;

        default:
          break;
      }
      return null;
    }

    tsTryParseGenericAsyncArrowFunction(
      startPos: number,
      startLoc: Position,
    ): N.ArrowFunctionExpression | null {
      const res: N.ArrowFunctionExpression | null = this.tsTryParseAndCatch(() => {
        const node: N.ArrowFunctionExpression = this.startNodeAt(startPos, startLoc);
        node.typeParameters = this.tsParseTypeParameters();
        // Don't use overloaded parseFunctionParams which would look for "<" again.
        super.parseFunctionParams(node);
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
      this.parseFunctionBody(res, true);
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

    parseAssignableListItem(
      allowModifiers: boolean | null,
      decorators: Array<N.Decorator>,
      isBlockScope: boolean,
    ): N.Pattern | N.TSParameterProperty {
      let accessibility: N.Accessibility | null = null;
      let isReadonly = false;
      if (allowModifiers) {
        accessibility = this.parseAccessModifier();
        isReadonly = !!this.tsParseModifier(["readonly"]);
      }

      const left = this.parseMaybeDefault(isBlockScope);
      this.parseAssignableListItemTypes(left);
      const elt = this.parseMaybeDefault(isBlockScope, left.start, left.loc.start, left);
      if (accessibility || isReadonly) {
        const pp: N.TSParameterProperty = this.startNodeAtNode(elt);
        if (decorators.length) {
          pp.decorators = decorators;
        }
        if (accessibility) pp.accessibility = accessibility;
        if (isReadonly) pp.readonly = isReadonly;
        if (elt.type !== "Identifier" && elt.type !== "AssignmentPattern") {
          throw this.raise(
            pp.start,
            "A parameter property may not be declared using a binding pattern.",
          );
        }
        pp.parameter = elt as N.AssignmentPattern;
        return this.finishNode(pp, "TSParameterProperty");
      } else {
        if (decorators.length) {
          left.decorators = decorators;
        }
        return elt;
      }
    }

    parseFunctionBodyAndFinish(
      node: N.BodilessFunctionOrMethodBase,
      type: string,
      allowExpressionBody?: boolean,
      funcContextId?: number,
    ): void {
      // For arrow functions, `parseArrow` handles the return type itself.
      if (!allowExpressionBody && this.match(tt.colon)) {
        node.returnType = this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
      }

      let bodilessType;
      if (type === "FunctionDeclaration") {
        bodilessType = "TSDeclareFunction";
      } else {
        bodilessType = type === "ClassMethod" ? "TSDeclareMethod" : undefined;
      }
      if (bodilessType && !this.match(tt.braceL) && this.isLineTerminator()) {
        // Retroactively mark the function declaration as a type.
        let i = this.state.tokens.length - 1;
        while (
          i >= 0 &&
          (this.state.tokens[i].start >= node.start ||
            this.state.tokens[i].type === tt._default ||
            this.state.tokens[i].type === tt._export)
        ) {
          this.state.tokens[i].isType = true;
          i--;
        }
        this.finishNode(node, bodilessType);
        return;
      }

      super.parseFunctionBodyAndFinish(node, type, allowExpressionBody, funcContextId);
    }

    parseSubscript(
      base: N.Expression,
      startPos: number,
      startLoc: Position,
      noCalls: boolean | null,
      state: {stop: boolean},
    ): N.Expression {
      if (!this.hasPrecedingLineBreak() && this.eat(tt.bang)) {
        const nonNullExpression: N.TsNonNullExpression = this.startNodeAt(startPos, startLoc);
        nonNullExpression.expression = base;
        return this.finishNode(nonNullExpression, "TSNonNullExpression");
      }

      if (!noCalls && this.isRelational("<")) {
        if (this.atPossibleAsync(base)) {
          // Almost certainly this is a generic async function `async <T>() => ...
          // But it might be a call with a type argument `async<T>();`
          const asyncArrowFn = this.tsTryParseGenericAsyncArrowFunction(startPos, startLoc);
          if (asyncArrowFn) {
            return asyncArrowFn;
          }
        }

        const node: N.CallExpression = this.startNodeAt(startPos, startLoc);
        node.callee = base;

        // May be passing type arguments. But may just be the `<` operator.
        const typeArguments = this.tsTryParseTypeArgumentsInExpression(); // Also eats the "("
        if (typeArguments) {
          // possibleAsync always false here, because we would have handled it above.
          // $FlowIgnore (won't be any undefined arguments)
          node.arguments = this.parseCallExpressionArguments(
            tt.parenR,
            /* possibleAsync */ false,
          ) as Array<N.Node>;
          node.typeParameters = typeArguments;
          return this.finishCallExpression(node);
        }
      }

      return super.parseSubscript(base, startPos, startLoc, noCalls, state);
    }

    parseNewArguments(node: N.NewExpression): void {
      if (this.isRelational("<")) {
        // tsTryParseAndCatch is expensive, so avoid if not necessary.
        // 99% certain this is `new C<T>();`. But may be `new C < T;`, which is also legal.
        const typeParameters = this.tsTryParseAndCatch(() => {
          this.state.type = tt.typeParameterStart;
          const args = this.tsParseTypeArguments();
          if (!this.match(tt.parenL)) this.unexpected();
          return args;
        });
        if (typeParameters) {
          node.typeParameters = typeParameters;
        }
      }

      super.parseNewArguments(node);
    }

    parseExprOp(
      left: N.Expression,
      leftStartPos: number,
      leftStartLoc: Position,
      minPrec: number,
      noIn: boolean | null,
    ): N.Expression {
      if (
        nonNull(tt._in.binop) > minPrec &&
        !this.hasPrecedingLineBreak() &&
        this.eatContextual("as")
      ) {
        this.state.tokens[this.state.tokens.length - 1].type = tt._as;
        const node: N.TsAsExpression = this.startNodeAt(leftStartPos, leftStartLoc);
        node.expression = left;
        node.typeAnnotation = this.runInTypeContext(1, () => this.tsParseType());
        this.finishNode(node, "TSAsExpression");
        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
      }

      return super.parseExprOp(left, leftStartPos, leftStartLoc, minPrec, noIn);
    }

    checkReservedWord(
      word: string,
      startLoc: number,
      checkKeywords: boolean,
      // eslint-disable-next-line no-unused-vars
      isBinding: boolean,
    ): void {
      // Don't bother checking for TypeScript code.
      // Strict mode words may be allowed as in `declare namespace N { const static: number; }`.
      // And we have a type checker anyway, so don't bother having the parser do it.
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

    parseImport(node: N.Node): N.ImportDeclaration | N.TsImportEqualsDeclaration {
      if (this.match(tt.name) && this.lookahead().type === tt.eq) {
        return this.tsParseImportEqualsDeclaration(node as N.TsImportEqualsDeclaration);
      }
      return super.parseImport(node);
    }

    parseExport(node: N.Node): N.Node {
      if (this.match(tt._import)) {
        // `export import A = B;`
        this.expect(tt._import);
        return this.tsParseImportEqualsDeclaration(
          node as N.TsImportEqualsDeclaration,
          /* isExport */ true,
        );
      } else if (this.eat(tt.eq)) {
        // `export = x;`
        const assign: N.TsExportAssignment = node as N.TsExportAssignment;
        assign.expression = this.parseExpression();
        this.semicolon();
        return this.finishNode(assign, "TSExportAssignment");
      } else if (this.eatContextual("as")) {
        // `export as namespace A;`
        const decl: N.TsNamespaceExportDeclaration = node as N.TsNamespaceExportDeclaration;
        // See `parseNamespaceExportDeclaration` in TypeScript's own parser
        this.expectContextual("namespace");
        decl.id = this.parseIdentifier();
        this.semicolon();
        return this.finishNode(decl, "TSNamespaceExportDeclaration");
      } else {
        return super.parseExport(node);
      }
    }

    parseExportDefaultExpression(): N.Expression | N.Declaration {
      if (this.isContextual("abstract") && this.lookahead().type === tt._class) {
        const cls = this.startNode();
        this.state.type = tt._abstract;
        this.next(); // Skip "abstract"
        this.parseClass(cls as N.Class, true, true);
        cls.abstract = true;
        return cls;
      }
      return super.parseExportDefaultExpression();
    }

    parseStatementContent(declaration: boolean, topLevel: boolean = false): N.Statement {
      if (this.state.type === tt._const) {
        const ahead = this.lookahead();
        if (ahead.type === tt.name && ahead.value === "enum") {
          const node: N.TsEnumDeclaration = this.startNode();
          this.expect(tt._const);
          this.expectContextual("enum");
          this.state.tokens[this.state.tokens.length - 1].type = tt._enum;
          return this.tsParseEnumDeclaration(node, /* isConst */ true);
        }
      }
      return super.parseStatementContent(declaration, topLevel);
    }

    parseAccessModifier(): N.Accessibility | null {
      return this.tsParseModifier(["public", "protected", "private"]);
    }

    parseClassMember(
      classBody: N.ClassBody,
      member: N.Node,
      state: {hadConstructor: boolean},
      classContextId: number,
    ): void {
      const accessibility = this.parseAccessModifier();
      if (accessibility) member.accessibility = accessibility;

      super.parseClassMember(classBody, member as N.ClassMember, state, classContextId);
    }

    parseClassMemberWithIsStatic(
      classBody: N.ClassBody,
      member: N.Node,
      state: {hadConstructor: boolean},
      isStatic: boolean,
      classContextId: number,
    ): void {
      // @ts-ignore
      const methodOrProp: N.ClassMethod | N.ClassProperty = member;
      // @ts-ignore
      const prop: N.ClassProperty = member;
      // @ts-ignore
      const propOrIdx: N.ClassProperty | N.TsIndexSignature = member;

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

      if (isAbstract) methodOrProp.abstract = true;
      if (isReadonly) propOrIdx.readonly = true;

      if (!isAbstract && !isStatic && !methodOrProp.accessibility) {
        const idx = this.tsTryParseIndexSignature(member as N.TsIndexSignature);
        if (idx) {
          classBody.body.push(idx);
          return;
        }
      }

      if (isReadonly) {
        // Must be a property (if not an index signature).
        methodOrProp.static = isStatic;
        this.parseClassPropertyName(prop, classContextId);
        this.parsePostMemberNameModifiers(methodOrProp);
        this.pushClassProperty(classBody, prop);
        return;
      }

      super.parseClassMemberWithIsStatic(
        classBody,
        member as N.ClassMember,
        state,
        isStatic,
        classContextId,
      );
    }

    parsePostMemberNameModifiers(methodOrProp: N.ClassMethod | N.ClassProperty): void {
      const optional = this.eat(tt.question);
      if (optional) methodOrProp.optional = true;
    }

    // Note: The reason we do this in `parseExpressionStatement` and not `parseStatement`
    // is that e.g. `type()` is valid JS, so we must try parsing that first.
    // If it's really a type, we will parse `type` as the statement, and can correct it here
    // by parsing the rest.
    parseExpressionStatement(
      node: N.ExpressionStatement,
      expr: N.Expression,
    ): N.ExpressionStatement {
      const decl =
        expr.type === "Identifier"
          ? ((this.tsParseExpressionStatement(
              node,
              expr as N.Identifier,
            ) as {}) as N.ExpressionStatement)
          : null;
      return decl || super.parseExpressionStatement(node, expr);
    }

    // export type
    // Should be true for anything parsed by `tsTryParseExportDeclaration`.
    shouldParseExportDeclaration(): boolean {
      if (this.tsIsDeclarationStart()) return true;
      return super.shouldParseExportDeclaration();
    }

    // An apparent conditional expression could actually be an optional parameter in an arrow function.
    parseConditional(
      expr: N.Expression,
      noIn: boolean | null,
      startPos: number,
      startLoc: Position,
      refNeedsArrowPos?: Pos | null,
    ): N.Expression {
      // only do the expensive clone if there is a question mark
      // and if we come from inside parens
      if (!refNeedsArrowPos || !this.match(tt.question)) {
        return super.parseConditional(expr, noIn, startPos, startLoc, refNeedsArrowPos);
      }

      const state = this.state.clone();
      try {
        return super.parseConditional(expr, noIn, startPos, startLoc);
      } catch (err) {
        if (!(err instanceof SyntaxError)) {
          // istanbul ignore next: no such error is expected
          throw err;
        }

        this.state = state;
        // @ts-ignore
        refNeedsArrowPos.start = err.pos || this.state.start;
        return expr;
      }
    }

    // Note: These "type casts" are *not* valid TS expressions.
    // But we parse them here and change them when completing the arrow function.
    parseParenItem(node: N.Expression, startPos: number, startLoc: Position): N.Expression {
      node = super.parseParenItem(node, startPos, startLoc);
      if (this.eat(tt.question)) {
        node.optional = true;
      }

      if (this.match(tt.colon)) {
        const typeCastNode: N.TsTypeCastExpression = this.startNodeAt(startPos, startLoc);
        typeCastNode.expression = node;
        typeCastNode.typeAnnotation = this.tsParseTypeAnnotation();

        return this.finishNode(typeCastNode, "TSTypeCastExpression");
      }

      return node;
    }

    parseExportDeclaration(node: N.ExportNamedDeclaration): N.Declaration | null {
      // "export declare" is equivalent to just "export".
      const isDeclare = this.eatContextual("declare");
      if (isDeclare) {
        this.state.tokens[this.state.tokens.length - 1].type = tt._declare;
      }

      let declaration: N.Declaration | null = null;
      if (this.match(tt.name)) {
        if (isDeclare) {
          declaration = this.runInTypeContext(2, () => this.tsTryParseExportDeclaration());
        } else {
          declaration = this.tsTryParseExportDeclaration();
        }
      }
      if (!declaration) {
        if (isDeclare) {
          declaration = this.runInTypeContext(2, () => super.parseExportDeclaration(node));
        } else {
          declaration = super.parseExportDeclaration(node);
        }
      }

      if (declaration && isDeclare) {
        declaration.declare = true;
      }

      return declaration;
    }

    parseClassId(node: N.Class, isStatement: boolean, optionalId: boolean = false): void {
      if ((!isStatement || optionalId) && this.isContextual("implements")) {
        return;
      }

      super.parseClassId(node, isStatement, optionalId);
      const typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) node.typeParameters = typeParameters;
    }

    parseClassProperty(node: N.ClassProperty): N.ClassProperty {
      const type = this.tsTryParseTypeAnnotation();
      if (type) node.typeAnnotation = type;
      return super.parseClassProperty(node);
    }

    pushClassMethod(
      classBody: N.ClassBody,
      method: N.ClassMethod,
      isGenerator: boolean,
      isAsync: boolean,
      isConstructor: boolean,
    ): void {
      const typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) method.typeParameters = typeParameters;
      super.pushClassMethod(classBody, method, isGenerator, isAsync, isConstructor);
    }

    pushClassPrivateMethod(
      classBody: N.ClassBody,
      method: N.ClassPrivateMethod,
      isGenerator: boolean,
      isAsync: boolean,
    ): void {
      const typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) method.typeParameters = typeParameters;
      super.pushClassPrivateMethod(classBody, method, isGenerator, isAsync);
    }

    parseClassSuper(node: N.Class): void {
      super.parseClassSuper(node);
      if (node.superClass && this.isRelational("<")) {
        node.superTypeParameters = this.tsParseTypeArguments();
      }
      if (this.eatContextual("implements")) {
        node.implements = this.tsParseHeritageClause();
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

    parseFunctionParams(node: N.Function, allowModifiers?: boolean, contextId?: number): void {
      const typeParameters = this.tsTryParseTypeParameters();
      if (typeParameters) node.typeParameters = typeParameters;
      super.parseFunctionParams(node, allowModifiers, contextId);
    }

    // `let x: number;`
    parseVarHead(decl: N.VariableDeclarator, isBlockScope: boolean): void {
      super.parseVarHead(decl, isBlockScope);
      const type = this.tsTryParseTypeAnnotation();
      if (type) {
        decl.id.typeAnnotation = type;
        this.finishNode(decl.id, decl.id.type); // set end position to end of type
      }
    }

    // parse the return type of an async arrow function - let foo = (async (): number => {});
    parseAsyncArrowFromCallExpression(
      node: N.ArrowFunctionExpression,
      call: N.CallExpression,
      startTokenIndex: number,
    ): N.ArrowFunctionExpression {
      if (this.match(tt.colon)) {
        node.returnType = this.tsParseTypeAnnotation();
      }
      return super.parseAsyncArrowFromCallExpression(node, call, startTokenIndex);
    }

    parseMaybeAssign(
      noIn: boolean | null = null,
      refShorthandDefaultPos?: Pos | null,
      afterLeftParse?: Function,
      refNeedsArrowPos?: Pos | null,
    ): N.Expression {
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

      let arrowExpression;
      let typeParameters: N.TsTypeParameterDeclaration;
      const state = this.state.clone();
      try {
        // This is similar to TypeScript's `tryParseParenthesizedArrowFunctionExpression`.
        typeParameters = this.runInTypeContext(0, () => this.tsParseTypeParameters());
        arrowExpression = super.parseMaybeAssign(
          noIn,
          refShorthandDefaultPos,
          afterLeftParse,
          refNeedsArrowPos,
        );
        if (arrowExpression.type !== "ArrowFunctionExpression") {
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

      // Correct TypeScript code should have at least 1 type parameter, but don't crash on bad code.
      if (typeParameters && typeParameters.params.length !== 0) {
        this.resetStartLocationFromNode(arrowExpression, typeParameters.params[0]);
      }
      arrowExpression.typeParameters = typeParameters;
      return arrowExpression;
    }

    // Handle type assertions
    parseMaybeUnary(refShorthandDefaultPos?: Pos | null): N.Expression {
      if (!this.hasPlugin("jsx") && this.eatRelational("<")) {
        return this.tsParseTypeAssertion();
      } else {
        return super.parseMaybeUnary(refShorthandDefaultPos);
      }
    }

    parseArrow(node: N.ArrowFunctionExpression): N.ArrowFunctionExpression | null {
      if (this.match(tt.colon)) {
        // This is different from how the TS parser does it.
        // TS uses lookahead. Babylon parses it as a parenthesized expression and converts.
        const state = this.state.clone();
        try {
          const returnType = this.tsParseTypeOrTypePredicateAnnotation(tt.colon);
          if (this.canInsertSemicolon()) this.unexpected();
          if (!this.match(tt.arrow)) this.unexpected();
          node.returnType = returnType;
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state = state;
          } else {
            // istanbul ignore next: no such error is expected
            throw err;
          }
        }
      }

      return super.parseArrow(node);
    }

    // Allow type annotations inside of a parameter list.
    parseAssignableListItemTypes(param: N.Pattern): N.Pattern {
      return this.runInTypeContext(0, () => {
        if (this.eat(tt.question)) {
          if (param.type !== "Identifier") {
            throw this.raise(
              param.start,
              "A binding pattern parameter cannot be optional in an implementation signature.",
            );
          }

          (param as N.Identifier).optional = true;
        }
        const type = this.tsTryParseTypeAnnotation();
        if (type) param.typeAnnotation = type;
        return this.finishNode(param, param.type);
      });
    }

    toAssignable(node: N.Node, isBinding: boolean | null, contextDescription: string): N.Node {
      switch (node.type) {
        case "TSTypeCastExpression":
          return super.toAssignable(
            this.typeCastToParameter(node as N.TsTypeCastExpression),
            isBinding,
            contextDescription,
          );
        case "TSParameterProperty":
          return super.toAssignable(node, isBinding, contextDescription);
        default:
          return super.toAssignable(node, isBinding, contextDescription);
      }
    }

    checkLVal(
      expr: N.Expression,
      isBinding: boolean | null,
      checkClashes: {[key: string]: boolean} | null,
      contextDescription: string,
    ): void {
      switch (expr.type) {
        case "TSTypeCastExpression":
          // Allow "typecasts" to appear on the left of assignment expressions,
          // because it may be in an arrow function.
          // e.g. `const f = (foo: number = 0) => foo;`
          return;
        case "TSParameterProperty":
          this.checkLVal(expr.parameter, isBinding, checkClashes, "parameter property");
          return;
        default:
          super.checkLVal(expr, isBinding, checkClashes, contextDescription);
      }
    }

    parseBindingAtom(isBlockScope: boolean): N.Pattern {
      switch (this.state.type) {
        case tt._this:
          // "this" may be the name of a parameter, so allow it.
          return this.parseIdentifier(/* liberal */ true);
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

    parseMaybeDefault(
      isBlockScope: boolean,
      startPos?: number | null,
      startLoc?: Position | null,
      left?: N.Pattern | null,
    ): N.Pattern {
      const node = super.parseMaybeDefault(isBlockScope, startPos, startLoc, left);

      if (
        node.type === "AssignmentPattern" &&
        node.typeAnnotation &&
        (node as N.AssignmentPattern).right.start < node.typeAnnotation.start
      ) {
        this.raise(
          node.typeAnnotation.start,
          "Type annotations must come before default assignments, " +
            "e.g. instead of `age = 25: number` use `age: number = 25`",
        );
      }

      return node;
    }

    // ensure that inside types, we bypass the jsx parser plugin
    readToken(code: number): void {
      if (this.state.inType && (code === 62 || code === 60)) {
        this.finishOp(tt.relational, 1);
      } else {
        super.readToken(code);
      }
    }

    toAssignableList(
      exprList: Array<N.Expression>,
      isBinding: boolean | null,
      contextDescription: string,
    ): ReadonlyArray<N.Pattern> {
      for (let i = 0; i < exprList.length; i++) {
        const expr = exprList[i];
        if (expr && expr.type === "TSTypeCastExpression") {
          exprList[i] = this.typeCastToParameter(expr as N.TsTypeCastExpression);
        }
      }
      return super.toAssignableList(exprList, isBinding, contextDescription);
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

    toReferencedList(
      exprList: ReadonlyArray<N.Expression | null>,
    ): ReadonlyArray<N.Expression | null> {
      for (let i = 0; i < exprList.length; i++) {
        const expr = exprList[i];
        if (expr && expr._exprListItem && expr.type === "TsTypeCastExpression") {
          this.raise(expr.start, "Did not expect a type annotation here.");
        }
      }

      return exprList;
    }

    shouldParseArrow(): boolean {
      return this.match(tt.colon) || super.shouldParseArrow();
    }

    shouldParseAsyncArrow(): boolean {
      return this.match(tt.colon) || super.shouldParseAsyncArrow();
    }
  } as ParserClass;
