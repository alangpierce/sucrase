/* eslint max-len: 0 */

import {ContextualKeyword} from "../tokenizer";
import {TokenType, TokenType as tt} from "../tokenizer/types";
import TypeParser from "./types";

// tslint:disable-next-line no-any
function isMaybeDefaultImport(lookahead: {
  type: TokenType;
  contextualKeyword: ContextualKeyword;
}): boolean {
  return (
    (lookahead.type === tt.name || !!(lookahead.type & TokenType.IS_KEYWORD)) &&
    lookahead.contextualKeyword !== ContextualKeyword._from
  );
}

export default class FlowParser extends TypeParser {
  flowParseTypeInitialiser(tok?: TokenType): void {
    this.runInTypeContext(0, () => {
      this.expect(tok || tt.colon);
      this.flowParseType();
    });
  }

  flowParsePredicate(): void {
    this.expect(tt.modulo);
    this.expectContextual(ContextualKeyword._checks);
    if (this.eat(tt.parenL)) {
      this.parseExpression();
      this.expect(tt.parenR);
    }
  }

  flowParseTypeAndPredicateInitialiser(): void {
    this.runInTypeContext(0, () => {
      this.expect(tt.colon);
      if (this.match(tt.modulo)) {
        this.flowParsePredicate();
      } else {
        this.flowParseType();
        if (this.match(tt.modulo)) {
          this.flowParsePredicate();
        }
      }
    });
  }

  flowParseDeclareClass(): void {
    this.next();
    this.flowParseInterfaceish(/* isClass */ true);
  }

  flowParseDeclareFunction(): void {
    this.next();
    this.parseIdentifier();

    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterDeclaration();
    }

    this.expect(tt.parenL);
    this.flowParseFunctionTypeParams();
    this.expect(tt.parenR);

    this.flowParseTypeAndPredicateInitialiser();

    this.semicolon();
  }

  flowParseDeclare(): void {
    if (this.match(tt._class)) {
      this.flowParseDeclareClass();
    } else if (this.match(tt._function)) {
      this.flowParseDeclareFunction();
    } else if (this.match(tt._var)) {
      this.flowParseDeclareVariable();
    } else if (this.isContextual(ContextualKeyword._module)) {
      if (this.lookaheadType() === tt.dot) {
        this.flowParseDeclareModuleExports();
      } else {
        this.flowParseDeclareModule();
      }
    } else if (this.isContextual(ContextualKeyword._type)) {
      this.flowParseDeclareTypeAlias();
    } else if (this.isContextual(ContextualKeyword._opaque)) {
      this.flowParseDeclareOpaqueType();
    } else if (this.isContextual(ContextualKeyword._interface)) {
      this.flowParseDeclareInterface();
    } else if (this.match(tt._export)) {
      this.flowParseDeclareExportDeclaration();
    } else {
      throw this.unexpected();
    }
  }

  flowParseDeclareVariable(): void {
    this.next();
    this.flowParseTypeAnnotatableIdentifier();
    this.semicolon();
  }

  flowParseDeclareModule(): void {
    this.next();

    if (this.match(tt.string)) {
      this.parseExprAtom();
    } else {
      this.parseIdentifier();
    }

    this.expect(tt.braceL);
    while (!this.match(tt.braceR)) {
      if (this.match(tt._import)) {
        this.next();
        this.parseImport();
      }
    }
    this.expect(tt.braceR);
  }

  flowParseDeclareExportDeclaration(): void {
    this.expect(tt._export);

    if (this.eat(tt._default)) {
      if (this.match(tt._function) || this.match(tt._class)) {
        // declare export default class ...
        // declare export default function ...
        this.flowParseDeclare();
      } else {
        // declare export default [type];
        this.flowParseType();
        this.semicolon();
      }
    } else if (
      this.match(tt._var) || // declare export var ...
      this.match(tt._function) || // declare export function ...
      this.match(tt._class) || // declare export class ...
      this.isContextual(ContextualKeyword._opaque) // declare export opaque ..
    ) {
      this.flowParseDeclare();
    } else if (
      this.match(tt.star) || // declare export * from ''
      this.match(tt.braceL) || // declare export {} ...
      this.isContextual(ContextualKeyword._interface) || // declare export interface ...
      this.isContextual(ContextualKeyword._type) || // declare export type ...
      this.isContextual(ContextualKeyword._opaque) // declare export opaque type ...
    ) {
      this.parseExport();
    } else {
      throw this.unexpected();
    }
  }

  flowParseDeclareModuleExports(): void {
    this.expectContextual(ContextualKeyword._module);
    this.expect(tt.dot);
    this.expectContextual(ContextualKeyword._exports);
    this.parseTypeAnnotation();
    this.semicolon();
  }

  flowParseDeclareTypeAlias(): void {
    this.next();
    this.flowParseTypeAlias();
  }

  flowParseDeclareOpaqueType(): void {
    this.next();
    this.flowParseOpaqueType(true);
  }

  flowParseDeclareInterface(): void {
    this.next();
    this.flowParseInterfaceish();
  }

  // Interfaces

  flowParseInterfaceish(isClass?: boolean): void {
    this.flowParseRestrictedIdentifier();

    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterDeclaration();
    }

    if (this.eat(tt._extends)) {
      do {
        this.flowParseInterfaceExtends();
      } while (!isClass && this.eat(tt.comma));
    }

    if (this.isContextual(ContextualKeyword._mixins)) {
      this.next();
      do {
        this.flowParseInterfaceExtends();
      } while (this.eat(tt.comma));
    }

    this.flowParseObjectType(true, false);
  }

  flowParseInterfaceExtends(): void {
    this.flowParseQualifiedTypeIdentifier(false);
    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterInstantiation();
    }
  }

  flowParseInterface(): void {
    this.flowParseInterfaceish();
  }

  flowParseRestrictedIdentifier(): void {
    this.parseIdentifier();
  }

  // Type aliases

  flowParseTypeAlias(): void {
    this.flowParseRestrictedIdentifier();

    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterDeclaration();
    }

    this.flowParseTypeInitialiser(tt.eq);
    this.semicolon();
  }

  flowParseOpaqueType(declare: boolean): void {
    this.expectContextual(ContextualKeyword._type);
    this.flowParseRestrictedIdentifier();

    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterDeclaration();
    }

    // Parse the supertype
    if (this.match(tt.colon)) {
      this.flowParseTypeInitialiser(tt.colon);
    }

    if (!declare) {
      this.flowParseTypeInitialiser(tt.eq);
    }
    this.semicolon();
  }

  // Type annotations

  flowParseTypeParameter(): void {
    this.flowParseVariance();
    this.flowParseTypeAnnotatableIdentifier();

    if (this.eat(tt.eq)) {
      this.flowParseType();
    }
  }

  flowParseTypeParameterDeclaration(): void {
    this.runInTypeContext(0, () => {
      // istanbul ignore else: this condition is already checked at all call sites
      if (this.match(tt.lessThan) || this.match(tt.typeParameterStart)) {
        this.next();
      } else {
        this.unexpected();
      }

      do {
        this.flowParseTypeParameter();
        if (!this.match(tt.greaterThan)) {
          this.expect(tt.comma);
        }
      } while (!this.match(tt.greaterThan));
      this.expect(tt.greaterThan);
    });
  }

  flowParseTypeParameterInstantiation(): void {
    this.runInTypeContext(0, () => {
      this.expect(tt.lessThan);
      while (!this.match(tt.greaterThan)) {
        this.flowParseType();
        if (!this.match(tt.greaterThan)) {
          this.expect(tt.comma);
        }
      }
      this.expect(tt.greaterThan);
    });
  }

  flowParseObjectPropertyKey(): void {
    if (this.match(tt.num) || this.match(tt.string)) {
      this.parseExprAtom();
    } else {
      this.parseIdentifier();
    }
  }

  flowParseObjectTypeIndexer(): void {
    this.expect(tt.bracketL);
    if (this.lookaheadType() === tt.colon) {
      this.flowParseObjectPropertyKey();
      this.flowParseTypeInitialiser();
    } else {
      this.flowParseType();
    }
    this.expect(tt.bracketR);
    this.flowParseTypeInitialiser();
  }

  flowParseObjectTypeMethodish(): void {
    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterDeclaration();
    }

    this.expect(tt.parenL);
    while (!this.match(tt.parenR) && !this.match(tt.ellipsis)) {
      this.flowParseFunctionTypeParam();
      if (!this.match(tt.parenR)) {
        this.expect(tt.comma);
      }
    }

    if (this.eat(tt.ellipsis)) {
      this.flowParseFunctionTypeParam();
    }
    this.expect(tt.parenR);
    this.flowParseTypeInitialiser();
  }

  flowParseObjectTypeCallProperty(): void {
    this.flowParseObjectTypeMethodish();
  }

  flowParseObjectType(allowStatic: boolean, allowExact: boolean): void {
    let endDelim;
    if (allowExact && this.match(tt.braceBarL)) {
      this.expect(tt.braceBarL);
      endDelim = tt.braceBarR;
    } else {
      this.expect(tt.braceL);
      endDelim = tt.braceR;
    }

    while (!this.match(endDelim)) {
      let isStatic = false;
      if (
        allowStatic &&
        this.isContextual(ContextualKeyword._static) &&
        this.lookaheadType() !== tt.colon
      ) {
        this.next();
        isStatic = true;
      }

      this.flowParseVariance();

      if (this.match(tt.bracketL)) {
        this.flowParseObjectTypeIndexer();
      } else if (this.match(tt.parenL) || this.match(tt.lessThan)) {
        this.flowParseObjectTypeCallProperty();
      } else {
        if (
          this.isContextual(ContextualKeyword._get) ||
          this.isContextual(ContextualKeyword._set)
        ) {
          const lookaheadType = this.lookaheadType();
          if (
            lookaheadType === tt.name ||
            lookaheadType === tt.string ||
            lookaheadType === tt.num
          ) {
            this.next();
          }
        }

        this.flowParseObjectTypeProperty();
      }

      this.flowObjectTypeSemicolon();
    }

    this.expect(endDelim);
  }

  flowParseObjectTypeProperty(): void {
    if (this.match(tt.ellipsis)) {
      this.expect(tt.ellipsis);
      this.flowParseType();
    } else {
      this.flowParseObjectPropertyKey();
      if (this.match(tt.lessThan) || this.match(tt.parenL)) {
        // This is a method property
        this.flowParseObjectTypeMethodish();
      } else {
        this.eat(tt.question);
        this.flowParseTypeInitialiser();
      }
    }
  }

  flowObjectTypeSemicolon(): void {
    if (
      !this.eat(tt.semi) &&
      !this.eat(tt.comma) &&
      !this.match(tt.braceR) &&
      !this.match(tt.braceBarR)
    ) {
      this.unexpected();
    }
  }

  flowParseQualifiedTypeIdentifier(initialIdAlreadyParsed: boolean): void {
    if (!initialIdAlreadyParsed) {
      this.parseIdentifier();
    }
    while (this.eat(tt.dot)) {
      this.parseIdentifier();
    }
  }

  flowParseGenericType(): void {
    this.flowParseQualifiedTypeIdentifier(true);
    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterInstantiation();
    }
  }

  flowParseTypeofType(): void {
    this.expect(tt._typeof);
    this.flowParsePrimaryType();
  }

  flowParseTupleType(): void {
    this.expect(tt.bracketL);
    // We allow trailing commas
    while (this.state.pos < this.input.length && !this.match(tt.bracketR)) {
      this.flowParseType();
      if (this.match(tt.bracketR)) {
        break;
      }
      this.expect(tt.comma);
    }
    this.expect(tt.bracketR);
  }

  flowParseFunctionTypeParam(): void {
    const lookaheadType = this.lookaheadType();
    if (lookaheadType === tt.colon || lookaheadType === tt.question) {
      this.parseIdentifier();
      this.eat(tt.question);
      this.flowParseTypeInitialiser();
    } else {
      this.flowParseType();
    }
  }

  flowParseFunctionTypeParams(): void {
    while (!this.match(tt.parenR) && !this.match(tt.ellipsis)) {
      this.flowParseFunctionTypeParam();
      if (!this.match(tt.parenR)) {
        this.expect(tt.comma);
      }
    }
    if (this.eat(tt.ellipsis)) {
      this.flowParseFunctionTypeParam();
    }
  }

  // The parsing of types roughly parallels the parsing of expressions, and
  // primary types are kind of like primary expressions...they're the
  // primitives with which other types are constructed.
  flowParsePrimaryType(): void {
    let isGroupedType = false;
    const oldNoAnonFunctionType = this.state.noAnonFunctionType;

    switch (this.state.type) {
      case tt.name: {
        this.parseIdentifier();
        this.flowParseGenericType();
        return;
      }

      case tt.braceL:
        this.flowParseObjectType(false, false);
        return;

      case tt.braceBarL:
        this.flowParseObjectType(false, true);
        return;

      case tt.bracketL:
        this.flowParseTupleType();
        return;

      case tt.lessThan:
        this.flowParseTypeParameterDeclaration();
        this.expect(tt.parenL);
        this.flowParseFunctionTypeParams();
        this.expect(tt.parenR);
        this.expect(tt.arrow);
        this.flowParseType();
        return;

      case tt.parenL:
        this.next();

        // Check to see if this is actually a grouped type
        if (!this.match(tt.parenR) && !this.match(tt.ellipsis)) {
          if (this.match(tt.name)) {
            const token = this.lookaheadType();
            isGroupedType = token !== tt.question && token !== tt.colon;
          } else {
            isGroupedType = true;
          }
        }

        if (isGroupedType) {
          this.state.noAnonFunctionType = false;
          this.flowParseType();
          this.state.noAnonFunctionType = oldNoAnonFunctionType;

          // A `,` or a `) =>` means this is an anonymous function type
          if (
            this.state.noAnonFunctionType ||
            !(this.match(tt.comma) || (this.match(tt.parenR) && this.lookaheadType() === tt.arrow))
          ) {
            this.expect(tt.parenR);
            return;
          } else {
            // Eat a comma if there is one
            this.eat(tt.comma);
          }
        }

        this.flowParseFunctionTypeParams();

        this.expect(tt.parenR);
        this.expect(tt.arrow);
        this.flowParseType();
        return;

      case tt.minus:
        this.next();
        this.parseLiteral();
        return;

      case tt.string:
      case tt.num:
      case tt._true:
      case tt._false:
      case tt._null:
      case tt._this:
      case tt._void:
      case tt.star:
        this.next();
        return;

      default:
        if (this.state.type === tt._typeof) {
          this.flowParseTypeofType();
          return;
        }
    }

    throw this.unexpected();
  }

  flowParsePostfixType(): void {
    this.flowParsePrimaryType();
    while (!this.canInsertSemicolon() && this.match(tt.bracketL)) {
      this.expect(tt.bracketL);
      this.expect(tt.bracketR);
    }
  }

  flowParsePrefixType(): void {
    if (this.eat(tt.question)) {
      this.flowParsePrefixType();
    } else {
      this.flowParsePostfixType();
    }
  }

  flowParseAnonFunctionWithoutParens(): void {
    this.flowParsePrefixType();
    if (!this.state.noAnonFunctionType && this.eat(tt.arrow)) {
      this.flowParseType();
    }
  }

  flowParseIntersectionType(): void {
    this.eat(tt.bitwiseAND);
    this.flowParseAnonFunctionWithoutParens();
    while (this.eat(tt.bitwiseAND)) {
      this.flowParseAnonFunctionWithoutParens();
    }
  }

  flowParseUnionType(): void {
    this.eat(tt.bitwiseOR);
    this.flowParseIntersectionType();
    while (this.eat(tt.bitwiseOR)) {
      this.flowParseIntersectionType();
    }
  }

  flowParseType(): void {
    this.flowParseUnionType();
  }

  parseTypeAnnotation(): void {
    this.flowParseTypeInitialiser();
  }

  flowParseTypeAnnotatableIdentifier(): void {
    this.parseIdentifier();
    if (this.match(tt.colon)) {
      this.parseTypeAnnotation();
    }
  }

  flowParseVariance(): void {
    if (this.match(tt.plus) || this.match(tt.minus)) {
      this.next();
    }
  }

  // ==================================
  // Overrides
  // ==================================

  parseFunctionBodyAndFinish(
    functionStart: number,
    isGenerator: boolean,
    allowExpressionBody?: boolean,
    funcContextId?: number,
  ): void {
    // For arrow functions, `parseArrow` handles the return type itself.
    if (!allowExpressionBody && this.match(tt.colon)) {
      this.flowParseTypeAndPredicateInitialiser();
    }

    super.parseFunctionBodyAndFinish(
      functionStart,
      isGenerator,
      allowExpressionBody,
      funcContextId,
    );
  }

  // interfaces
  parseStatement(declaration: boolean, topLevel?: boolean): void {
    if (this.match(tt.name) && this.state.contextualKeyword === ContextualKeyword._interface) {
      this.runInTypeContext(0, () => {
        this.next();
        this.flowParseInterface();
      });
    } else {
      super.parseStatement(declaration, topLevel);
    }
  }

  // declares, interfaces and type aliases
  parseIdentifierStatement(contextualKeyword: ContextualKeyword): void {
    if (contextualKeyword === ContextualKeyword._declare) {
      if (
        this.match(tt._class) ||
        this.match(tt.name) ||
        this.match(tt._function) ||
        this.match(tt._var) ||
        this.match(tt._export)
      ) {
        this.runInTypeContext(1, () => {
          this.flowParseDeclare();
        });
      }
    } else if (this.match(tt.name)) {
      if (contextualKeyword === ContextualKeyword._interface) {
        this.runInTypeContext(1, () => {
          this.flowParseInterface();
        });
      } else if (contextualKeyword === ContextualKeyword._type) {
        this.runInTypeContext(1, () => {
          this.flowParseTypeAlias();
        });
      } else if (contextualKeyword === ContextualKeyword._opaque) {
        this.runInTypeContext(1, () => {
          this.flowParseOpaqueType(false);
        });
      }
    }
    super.parseIdentifierStatement(contextualKeyword);
  }

  // export type
  shouldParseExportDeclaration(): boolean {
    return (
      this.isContextual(ContextualKeyword._type) ||
      this.isContextual(ContextualKeyword._interface) ||
      this.isContextual(ContextualKeyword._opaque) ||
      super.shouldParseExportDeclaration()
    );
  }

  isExportDefaultSpecifier(): boolean {
    if (
      this.match(tt.name) &&
      (this.state.contextualKeyword === ContextualKeyword._type ||
        this.state.contextualKeyword === ContextualKeyword._interface ||
        this.state.contextualKeyword === ContextualKeyword._opaque)
    ) {
      return false;
    }

    return super.isExportDefaultSpecifier();
  }

  parseExportDeclaration(): void {
    if (this.isContextual(ContextualKeyword._type)) {
      this.runInTypeContext(1, () => {
        this.next();

        if (this.match(tt.braceL)) {
          // export type { foo, bar };
          this.parseExportSpecifiers();
          this.parseExportFrom();
        } else {
          // export type Foo = Bar;
          this.flowParseTypeAlias();
        }
      });
    } else if (this.isContextual(ContextualKeyword._opaque)) {
      this.runInTypeContext(1, () => {
        this.next();
        // export opaque type Foo = Bar;
        this.flowParseOpaqueType(false);
      });
    } else if (this.isContextual(ContextualKeyword._interface)) {
      this.runInTypeContext(1, () => {
        this.next();
        this.flowParseInterface();
      });
    } else {
      super.parseExportDeclaration();
    }
  }

  shouldParseExportStar(): boolean {
    return (
      super.shouldParseExportStar() ||
      (this.isContextual(ContextualKeyword._type) && this.lookaheadType() === tt.star)
    );
  }

  parseExportStar(): void {
    if (this.eatContextual(ContextualKeyword._type)) {
      this.runInTypeContext(2, () => {
        super.parseExportStar();
      });
    } else {
      super.parseExportStar();
    }
  }

  parseClassId(isStatement: boolean, optionalId: boolean = false): void {
    super.parseClassId(isStatement, optionalId);
    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterDeclaration();
    }
  }

  // parse an item inside a expression list eg. `(NODE, NODE)` where NODE represents
  // the position where this function is called
  parseExprListItem(allowEmpty: boolean | null): void {
    super.parseExprListItem(allowEmpty);
    if (this.match(tt.colon)) {
      this.parseTypeAnnotation();
    }
  }

  // parse class property type annotations
  parseClassProperty(): void {
    if (this.match(tt.colon)) {
      this.parseTypeAnnotation();
    }
    super.parseClassProperty();
  }

  // parse type parameters for class methods
  parseClassMethod(functionStart: number, isGenerator: boolean, isConstructor: boolean): void {
    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterDeclaration();
    }
    super.parseClassMethod(functionStart, isGenerator, isConstructor);
  }

  // parse a the super class type parameters and implements
  parseClassSuper(): boolean {
    const hadSuper = super.parseClassSuper();
    if (hadSuper && this.match(tt.lessThan)) {
      this.flowParseTypeParameterInstantiation();
    }
    if (this.isContextual(ContextualKeyword._implements)) {
      this.state.tokens[this.state.tokens.length - 1].type = tt._implements;
      this.runInTypeContext(0, () => {
        this.next();
        do {
          this.flowParseRestrictedIdentifier();
          if (this.match(tt.lessThan)) {
            this.flowParseTypeParameterInstantiation();
          }
        } while (this.eat(tt.comma));
      });
    }
    return hadSuper;
  }

  parsePropertyName(classContextId: number): void {
    this.flowParseVariance();
    super.parsePropertyName(classContextId);
  }

  // parse type parameters for object method shorthand
  parseObjPropValue(
    isGenerator: boolean,
    isPattern: boolean,
    isBlockScope: boolean,
    objectContextId: number,
  ): void {
    // method shorthand
    if (this.match(tt.lessThan)) {
      this.flowParseTypeParameterDeclaration();
      if (!this.match(tt.parenL)) this.unexpected();
    }

    super.parseObjPropValue(isGenerator, isPattern, isBlockScope, objectContextId);
  }

  parseAssignableListItemTypes(): void {
    this.runInTypeContext(0, () => {
      this.eat(tt.question);
      if (this.match(tt.colon)) {
        this.parseTypeAnnotation();
      }
    });
  }

  // parse typeof and type imports
  parseImportSpecifiers(): void {
    let kind = null;
    if (this.match(tt._typeof)) {
      kind = "typeof";
    } else if (this.isContextual(ContextualKeyword._type)) {
      kind = "type";
    }
    if (kind) {
      const lh = this.lookaheadTypeAndKeyword();
      if (isMaybeDefaultImport(lh) || lh.type === tt.braceL || lh.type === tt.star) {
        this.next();
      }
    }

    super.parseImportSpecifiers();
  }

  // parse import-type/typeof shorthand
  parseImportSpecifier(): void {
    const isTypeKeyword =
      this.state.contextualKeyword === ContextualKeyword._type || this.state.type === tt._typeof;
    if (isTypeKeyword) {
      this.next();
    } else {
      this.parseIdentifier();
    }

    if (
      this.isContextual(ContextualKeyword._as) &&
      !this.isLookaheadContextual(ContextualKeyword._as)
    ) {
      this.parseIdentifier();
      if (isTypeKeyword && !this.match(tt.name) && !(this.state.type & TokenType.IS_KEYWORD)) {
        // `import {type as ,` or `import {type as }`
      } else {
        // `import {type as foo`
        this.parseIdentifier();
      }
    } else if (
      isTypeKeyword &&
      (this.match(tt.name) || !!(this.state.type & TokenType.IS_KEYWORD))
    ) {
      // `import {type foo`
      this.parseIdentifier();
      if (this.eatContextual(ContextualKeyword._as)) {
        this.parseIdentifier();
      }
    }
  }

  // parse function type parameters - function foo<T>() {}
  parseFunctionParams(allowModifiers?: boolean, contextId?: number): void {
    // Originally this checked if the method is a getter/setter, but if it was, we'd crash soon
    // anyway, so don't try to propagate that information.
    if (this.match(tt.lessThan)) {
      this.runInTypeContext(0, () => {
        this.flowParseTypeParameterDeclaration();
      });
    }
    super.parseFunctionParams(allowModifiers, contextId);
  }

  // parse flow type annotations on variable declarator heads - let foo: string = bar
  parseVarHead(isBlockScope: boolean): void {
    super.parseVarHead(isBlockScope);
    if (this.match(tt.colon)) {
      this.parseTypeAnnotation();
    }
  }

  // parse the return type of an async arrow function - let foo = (async (): number => {});
  parseAsyncArrowFromCallExpression(functionStart: number, startTokenIndex: number): void {
    if (this.match(tt.colon)) {
      const oldNoAnonFunctionType = this.state.noAnonFunctionType;
      this.state.noAnonFunctionType = true;
      this.parseTypeAnnotation();
      this.state.noAnonFunctionType = oldNoAnonFunctionType;
    }
    super.parseAsyncArrowFromCallExpression(functionStart, startTokenIndex);
  }

  // We need to support type parameter declarations for arrow functions. This
  // is tricky. There are three situations we need to handle
  //
  // 1. This is either JSX or an arrow function. We'll try JSX first. If that
  //    fails, we'll try an arrow function. If that fails, we'll throw the JSX
  //    error.
  // 2. This is an arrow function. We'll parse the type parameter declaration,
  //    parse the rest, make sure the rest is an arrow function, and go from
  //    there
  // 3. This is neither. Just call the super method
  parseMaybeAssign(noIn?: boolean | null, afterLeftParse?: Function): boolean {
    let jsxError = null;
    if (this.match(tt.lessThan)) {
      const snapshot = this.state.snapshot();
      try {
        return super.parseMaybeAssign(noIn, afterLeftParse);
      } catch (err) {
        if (err instanceof SyntaxError) {
          this.state.restoreFromSnapshot(snapshot);
          this.state.type = tt.typeParameterStart;
          jsxError = err;
        } else {
          // istanbul ignore next: no such error is expected
          throw err;
        }
      }
    }

    if (jsxError != null || this.match(tt.lessThan)) {
      let wasArrow = false;
      try {
        this.runInTypeContext(0, () => {
          this.flowParseTypeParameterDeclaration();
        });
        wasArrow = super.parseMaybeAssign(noIn, afterLeftParse);
      } catch (err) {
        throw jsxError || err;
      }

      if (wasArrow) {
        return true;
      }
      this.unexpected();
    }

    return super.parseMaybeAssign(noIn, afterLeftParse);
  }

  // handle return types for arrow functions
  parseArrow(): boolean {
    if (this.match(tt.colon)) {
      this.runInTypeContext(0, () => {
        const snapshot = this.state.snapshot();
        try {
          const oldNoAnonFunctionType = this.state.noAnonFunctionType;
          this.state.noAnonFunctionType = true;
          this.flowParseTypeAndPredicateInitialiser();
          this.state.noAnonFunctionType = oldNoAnonFunctionType;

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
      });
    }
    return super.parseArrow();
  }

  parseSubscripts(startPos: number, noCalls?: boolean | null): void {
    if (
      this.state.tokens[this.state.tokens.length - 1].contextualKeyword ===
        ContextualKeyword._async &&
      this.match(tt.lessThan)
    ) {
      const snapshot = this.state.snapshot();
      let error;
      try {
        const wasArrow = this.parseAsyncArrowWithTypeParameters(startPos);
        if (wasArrow) {
          return;
        }
      } catch (e) {
        error = e;
      }

      this.state.restoreFromSnapshot(snapshot);
      try {
        super.parseSubscripts(startPos, noCalls);
        return;
      } catch (e) {
        throw error || e;
      }
    }

    super.parseSubscripts(startPos, noCalls);
  }

  // Returns true if there was an arrow function here.
  parseAsyncArrowWithTypeParameters(startPos: number): boolean {
    const startTokenIndex = this.state.tokens.length;
    this.parseFunctionParams();
    if (!this.parseArrow()) {
      return false;
    }
    this.parseArrowExpression(startPos, startTokenIndex);
    return true;
  }
}
