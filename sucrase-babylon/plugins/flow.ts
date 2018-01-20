/* eslint max-len: 0 */

import {ParserClass} from "../parser";
import State from "../tokenizer/state";
import {TokenType, types as tt} from "../tokenizer/types";
import * as N from "../types";
import {Pos, Position} from "../util/location";

const primitiveTypes = [
  "any",
  "bool",
  "boolean",
  "empty",
  "false",
  "mixed",
  "null",
  "number",
  "static",
  "string",
  "true",
  "typeof",
  "void",
];

function isEsModuleType(bodyElement: N.Node): boolean {
  return (
    bodyElement.type === "DeclareExportAllDeclaration" ||
    (bodyElement.type === "DeclareExportDeclaration" &&
      (!bodyElement.declaration ||
        (bodyElement.declaration.type !== "TypeAlias" &&
          bodyElement.declaration.type !== "InterfaceDeclaration")))
  );
}

function hasTypeImportKind(node: N.Node): boolean {
  return node.importKind === "type" || node.importKind === "typeof";
}

function isMaybeDefaultImport(state: State): boolean {
  return (state.type === tt.name || !!state.type.keyword) && state.value !== "from";
}

const exportSuggestions = {
  const: "declare export var",
  let: "declare export var",
  type: "export type",
  interface: "export interface",
};

export default (superClass: ParserClass): ParserClass =>
  class extends superClass {
    flowParseTypeInitialiser(tok?: TokenType): N.FlowType {
      return this.runInTypeContext(0, () => {
        const oldInType = this.state.inType;
        this.state.inType = true;
        this.expect(tok || tt.colon);

        const type = this.flowParseType();
        this.state.inType = oldInType;
        return type;
      });
    }

    flowParsePredicate(): N.FlowType {
      const node = this.startNode();
      const moduloLoc = this.state.startLoc;
      const moduloPos = this.state.start;
      this.expect(tt.modulo);
      const checksLoc = this.state.startLoc;
      this.expectContextual("checks");
      // Force '%' and 'checks' to be adjacent
      if (moduloLoc.line !== checksLoc.line || moduloLoc.column !== checksLoc.column - 1) {
        this.raise(moduloPos, "Spaces between ´%´ and ´checks´ are not allowed here.");
      }
      if (this.eat(tt.parenL)) {
        this.parseExpression();
        this.expect(tt.parenR);
        return this.finishNode(node, "DeclaredPredicate");
      } else {
        return this.finishNode(node, "InferredPredicate");
      }
    }

    flowParseTypeAndPredicateInitialiser(): [N.FlowType | null, N.FlowPredicate | null] {
      return this.runInTypeContext<[N.FlowType | null, N.FlowPredicate | null]>(0, () => {
        const oldInType = this.state.inType;
        this.state.inType = true;
        this.expect(tt.colon);
        let type = null;
        let predicate = null;
        if (this.match(tt.modulo)) {
          this.state.inType = oldInType;
          predicate = this.flowParsePredicate();
        } else {
          type = this.flowParseType();
          this.state.inType = oldInType;
          if (this.match(tt.modulo)) {
            predicate = this.flowParsePredicate();
          }
        }
        return [type, predicate];
      });
    }

    flowParseDeclareClass(node: N.FlowDeclareClass): N.FlowDeclareClass {
      this.next();
      this.flowParseInterfaceish(node, /* isClass */ true);
      return this.finishNode(node, "DeclareClass");
    }

    flowParseDeclareFunction(node: N.FlowDeclareFunction): N.FlowDeclareFunction {
      this.next();

      const id = this.parseIdentifier();
      node.id = id;

      const typeNode = this.startNode();
      const typeContainer = this.startNode<N.TypeAnnotation>();

      if (this.isRelational("<")) {
        typeNode.typeParameters = this.flowParseTypeParameterDeclaration();
      } else {
        typeNode.typeParameters = null;
      }

      this.expect(tt.parenL);
      const tmp = this.flowParseFunctionTypeParams();
      typeNode.params = tmp.params;
      typeNode.rest = tmp.rest;
      this.expect(tt.parenR);

      [
        // $FlowFixMe (destructuring not supported yet)
        typeNode.returnType,
        // $FlowFixMe (destructuring not supported yet)
        node.predicate,
      ] = this.flowParseTypeAndPredicateInitialiser();

      typeContainer.typeAnnotation = this.finishNode(typeNode, "FunctionTypeAnnotation");

      id.typeAnnotation = this.finishNode(typeContainer, "TypeAnnotation");

      this.finishNode(id, id.type);

      this.semicolon();

      return this.finishNode(node, "DeclareFunction");
    }

    flowParseDeclare(node: N.FlowDeclare, insideModule: boolean = false): N.FlowDeclare {
      if (this.match(tt._class)) {
        return this.flowParseDeclareClass(node);
      } else if (this.match(tt._function)) {
        return this.flowParseDeclareFunction(node);
      } else if (this.match(tt._var)) {
        return this.flowParseDeclareVariable(node);
      } else if (this.isContextual("module")) {
        if (this.lookahead().type === tt.dot) {
          return this.flowParseDeclareModuleExports(node);
        } else {
          if (insideModule) {
            this.unexpected(
              null,
              "`declare module` cannot be used inside another `declare module`",
            );
          }
          return this.flowParseDeclareModule(node);
        }
      } else if (this.isContextual("type")) {
        return this.flowParseDeclareTypeAlias(node);
      } else if (this.isContextual("opaque")) {
        return this.flowParseDeclareOpaqueType(node);
      } else if (this.isContextual("interface")) {
        return this.flowParseDeclareInterface(node);
      } else if (this.match(tt._export)) {
        return this.flowParseDeclareExportDeclaration(node, insideModule);
      } else {
        throw this.unexpected();
      }
    }

    flowParseDeclareVariable(node: N.FlowDeclareVariable): N.FlowDeclareVariable {
      this.next();
      node.id = this.flowParseTypeAnnotatableIdentifier(/* allowPrimitiveOverride */ true);
      this.semicolon();
      return this.finishNode(node, "DeclareVariable");
    }

    flowParseDeclareModule(node: N.FlowDeclareModule): N.FlowDeclareModule {
      this.next();

      if (this.match(tt.string)) {
        node.id = this.parseExprAtom();
      } else {
        node.id = this.parseIdentifier();
      }

      const bodyNode = this.startNode();
      node.body = bodyNode;
      const body: Array<N.FlowDeclare> = [];
      bodyNode.body = body;
      this.expect(tt.braceL);
      while (!this.match(tt.braceR)) {
        let innerBodyNode = this.startNode<N.FlowDeclare>();

        if (this.match(tt._import)) {
          const lookahead = this.lookahead();
          if (lookahead.value !== "type" && lookahead.value !== "typeof") {
            this.unexpected(
              null,
              "Imports within a `declare module` body must always be `import type` or `import typeof`",
            );
          }
          this.next();
          this.parseImport();
        } else {
          this.expectContextual(
            "declare",
            "Only declares and type imports are allowed inside declare module",
          );

          innerBodyNode = this.flowParseDeclare(innerBodyNode, true);
        }

        body.push(innerBodyNode);
      }
      this.expect(tt.braceR);

      this.finishNode(bodyNode, "BlockStatement");

      let kind: string | null = null;
      let hasModuleExport = false;
      const errorMessage =
        "Found both `declare module.exports` and `declare export` in the same module. Modules can only have 1 since they are either an ES module or they are a CommonJS module";
      body.forEach((bodyElement) => {
        if (isEsModuleType(bodyElement)) {
          if (kind === "CommonJS") {
            this.unexpected(bodyElement.start, errorMessage);
          }
          kind = "ES";
        } else if (bodyElement.type === "DeclareModuleExports") {
          if (hasModuleExport) {
            this.unexpected(bodyElement.start, "Duplicate `declare module.exports` statement");
          }
          if (kind === "ES") this.unexpected(bodyElement.start, errorMessage);
          kind = "CommonJS";
          hasModuleExport = true;
        }
      });

      node.kind = kind || "CommonJS";
      return this.finishNode(node, "DeclareModule");
    }

    flowParseDeclareExportDeclaration(
      node: N.FlowDeclareExportDeclaration,
      insideModule: boolean,
    ): N.FlowDeclareExportDeclaration {
      this.expect(tt._export);

      if (this.eat(tt._default)) {
        if (this.match(tt._function) || this.match(tt._class)) {
          // declare export default class ...
          // declare export default function ...
          node.declaration = this.flowParseDeclare(this.startNode());
        } else {
          // declare export default [type];
          node.declaration = this.flowParseType();
          this.semicolon();
        }
        node.default = true;

        return this.finishNode(node, "DeclareExportDeclaration");
      } else {
        if (
          this.match(tt._const) ||
          this.match(tt._let) ||
          ((this.isContextual("type") || this.isContextual("interface")) && !insideModule)
        ) {
          const label = this.state.value;
          const suggestion = exportSuggestions[label];
          this.unexpected(
            this.state.start,
            `\`declare export ${label}\` is not supported. Use \`${suggestion}\` instead`,
          );
        }

        if (
          this.match(tt._var) || // declare export var ...
          this.match(tt._function) || // declare export function ...
          this.match(tt._class) || // declare export class ...
          this.isContextual("opaque") // declare export opaque ..
        ) {
          node.declaration = this.flowParseDeclare(this.startNode());
          node.default = false;

          return this.finishNode(node, "DeclareExportDeclaration");
        } else if (
          this.match(tt.star) || // declare export * from ''
          this.match(tt.braceL) || // declare export {} ...
          this.isContextual("interface") || // declare export interface ...
          this.isContextual("type") || // declare export type ...
          this.isContextual("opaque") // declare export opaque type ...
        ) {
          this.parseExport();
          return node;
        }
      }

      throw this.unexpected();
    }

    flowParseDeclareModuleExports(node: N.FlowDeclareModuleExports): N.FlowDeclareModuleExports {
      this.expectContextual("module");
      this.expect(tt.dot);
      this.expectContextual("exports");
      node.typeAnnotation = this.flowParseTypeAnnotation();
      this.semicolon();

      return this.finishNode(node, "DeclareModuleExports");
    }

    flowParseDeclareTypeAlias(node: N.FlowDeclareTypeAlias): N.FlowDeclareTypeAlias {
      this.next();
      this.flowParseTypeAlias(node);
      return this.finishNode(node, "DeclareTypeAlias");
    }

    flowParseDeclareOpaqueType(node: N.FlowDeclareOpaqueType): N.FlowDeclareOpaqueType {
      this.next();
      this.flowParseOpaqueType(node, true);
      return this.finishNode(node, "DeclareOpaqueType");
    }

    flowParseDeclareInterface(node: N.FlowDeclareInterface): N.FlowDeclareInterface {
      this.next();
      this.flowParseInterfaceish(node);
      return this.finishNode(node, "DeclareInterface");
    }

    // Interfaces

    flowParseInterfaceish(node: N.FlowDeclare, isClass?: boolean): void {
      node.id = this.flowParseRestrictedIdentifier(/* liberal */ !isClass);

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration();
      } else {
        node.typeParameters = null;
      }

      node.extends = [];
      node.mixins = [];

      if (this.eat(tt._extends)) {
        do {
          node.extends.push(this.flowParseInterfaceExtends());
        } while (!isClass && this.eat(tt.comma));
      }

      if (this.isContextual("mixins")) {
        this.next();
        do {
          node.mixins.push(this.flowParseInterfaceExtends());
        } while (this.eat(tt.comma));
      }

      node.body = this.flowParseObjectType(true, false, false);
    }

    flowParseInterfaceExtends(): N.FlowInterfaceExtends {
      const node = this.startNode();

      node.id = this.flowParseQualifiedTypeIdentifier();
      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterInstantiation();
      } else {
        node.typeParameters = null;
      }

      return this.finishNode(node, "InterfaceExtends");
    }

    flowParseInterface(node: N.FlowInterface): N.FlowInterface {
      this.flowParseInterfaceish(node);
      return this.finishNode(node, "InterfaceDeclaration");
    }

    checkReservedType(word: string, startLoc: number): void {
      if (primitiveTypes.indexOf(word) > -1) {
        this.raise(startLoc, `Cannot overwrite primitive type ${word}`);
      }
    }

    flowParseRestrictedIdentifier(liberal?: boolean): N.Identifier {
      this.checkReservedType(this.state.value, this.state.start);
      return this.parseIdentifier(liberal);
    }

    // Type aliases

    flowParseTypeAlias(node: N.FlowTypeAlias): N.FlowTypeAlias {
      node.id = this.flowParseRestrictedIdentifier();

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration();
      } else {
        node.typeParameters = null;
      }

      node.right = this.flowParseTypeInitialiser(tt.eq);
      this.semicolon();

      return this.finishNode(node, "TypeAlias");
    }

    flowParseOpaqueType(node: N.FlowOpaqueType, declare: boolean): N.FlowOpaqueType {
      this.expectContextual("type");
      node.id = this.flowParseRestrictedIdentifier(/* liberal */ true);

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration();
      } else {
        node.typeParameters = null;
      }

      // Parse the supertype
      node.supertype = null;
      if (this.match(tt.colon)) {
        node.supertype = this.flowParseTypeInitialiser(tt.colon);
      }

      node.impltype = null;
      if (!declare) {
        node.impltype = this.flowParseTypeInitialiser(tt.eq);
      }
      this.semicolon();

      return this.finishNode(node, "OpaqueType");
    }

    // Type annotations

    flowParseTypeParameter(): N.TypeParameter {
      const node = this.startNode();

      const variance = this.flowParseVariance();

      const ident = this.flowParseTypeAnnotatableIdentifier();
      node.name = ident.name;
      node.variance = variance;
      node.bound = ident.typeAnnotation;

      if (this.match(tt.eq)) {
        this.eat(tt.eq);
        node.default = this.flowParseType();
      }

      return this.finishNode(node as N.TypeParameter, "TypeParameter");
    }

    flowParseTypeParameterDeclaration(): N.TypeParameterDeclaration {
      return this.runInTypeContext(0, () => {
        const oldInType = this.state.inType;
        const node = this.startNode();
        node.params = [];

        this.state.inType = true;

        // istanbul ignore else: this condition is already checked at all call sites
        if (this.isRelational("<") || this.match(tt.typeParameterStart)) {
          this.next();
        } else {
          this.unexpected();
        }

        do {
          node.params.push(this.flowParseTypeParameter());
          if (!this.isRelational(">")) {
            this.expect(tt.comma);
          }
        } while (!this.isRelational(">"));
        this.expectRelational(">");

        this.state.inType = oldInType;

        return this.finishNode(node as N.TypeParameterDeclaration, "TypeParameterDeclaration");
      });
    }

    flowParseTypeParameterInstantiation(): N.TypeParameterInstantiation {
      const node = this.startNode();
      const oldInType = this.state.inType;
      node.params = [];

      this.state.inType = true;

      this.expectRelational("<");
      while (!this.isRelational(">")) {
        node.params.push(this.flowParseType());
        if (!this.isRelational(">")) {
          this.expect(tt.comma);
        }
      }
      this.expectRelational(">");

      this.state.inType = oldInType;

      return this.finishNode(node as N.TypeParameterInstantiation, "TypeParameterInstantiation");
    }

    flowParseObjectPropertyKey(): void {
      if (this.match(tt.num) || this.match(tt.string)) {
        this.parseExprAtom();
      } else {
        this.parseIdentifier(true);
      }
    }

    flowParseObjectTypeIndexer(
      node: N.FlowObjectTypeIndexer,
      isStatic: boolean,
      variance: N.FlowVariance | null,
    ): N.FlowObjectTypeIndexer {
      node.static = isStatic;

      this.expect(tt.bracketL);
      if (this.lookahead().type === tt.colon) {
        this.flowParseObjectPropertyKey();
        node.key = this.flowParseTypeInitialiser();
      } else {
        node.id = null;
        node.key = this.flowParseType();
      }
      this.expect(tt.bracketR);
      node.value = this.flowParseTypeInitialiser();
      node.variance = variance;

      return this.finishNode(node, "ObjectTypeIndexer");
    }

    flowParseObjectTypeMethodish(node: N.FlowFunctionTypeAnnotation): N.FlowFunctionTypeAnnotation {
      node.params = [];
      node.rest = null;
      node.typeParameters = null;

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterDeclaration();
      }

      this.expect(tt.parenL);
      while (!this.match(tt.parenR) && !this.match(tt.ellipsis)) {
        node.params.push(this.flowParseFunctionTypeParam());
        if (!this.match(tt.parenR)) {
          this.expect(tt.comma);
        }
      }

      if (this.eat(tt.ellipsis)) {
        node.rest = this.flowParseFunctionTypeParam();
      }
      this.expect(tt.parenR);
      node.returnType = this.flowParseTypeInitialiser();

      return this.finishNode(node, "FunctionTypeAnnotation");
    }

    flowParseObjectTypeCallProperty(
      node: N.FlowObjectTypeCallProperty,
      isStatic: boolean,
    ): N.FlowObjectTypeCallProperty {
      const valueNode = this.startNode();
      node.static = isStatic;
      node.value = this.flowParseObjectTypeMethodish(valueNode);
      return this.finishNode(node, "ObjectTypeCallProperty");
    }

    flowParseObjectType(
      allowStatic: boolean,
      allowExact: boolean,
      allowSpread: boolean,
    ): N.FlowObjectTypeAnnotation {
      const oldInType = this.state.inType;
      this.state.inType = true;

      const nodeStart = this.startNode();

      nodeStart.callProperties = [];
      nodeStart.properties = [];
      nodeStart.indexers = [];

      let endDelim;
      let exact;
      if (allowExact && this.match(tt.braceBarL)) {
        this.expect(tt.braceBarL);
        endDelim = tt.braceBarR;
        exact = true;
      } else {
        this.expect(tt.braceL);
        endDelim = tt.braceR;
        exact = false;
      }

      nodeStart.exact = exact;

      while (!this.match(endDelim)) {
        let isStatic = false;
        const node = this.startNode();
        if (allowStatic && this.isContextual("static") && this.lookahead().type !== tt.colon) {
          this.next();
          isStatic = true;
        }

        const variance = this.flowParseVariance();

        if (this.match(tt.bracketL)) {
          nodeStart.indexers.push(this.flowParseObjectTypeIndexer(node, isStatic, variance));
        } else if (this.match(tt.parenL) || this.isRelational("<")) {
          if (variance) {
            this.unexpected(variance.start);
          }
          nodeStart.callProperties.push(this.flowParseObjectTypeCallProperty(node, isStatic));
        } else {
          let kind = "init";

          if (this.isContextual("get") || this.isContextual("set")) {
            const lookahead = this.lookahead();
            if (
              lookahead.type === tt.name ||
              lookahead.type === tt.string ||
              lookahead.type === tt.num
            ) {
              kind = this.state.value;
              this.next();
            }
          }

          nodeStart.properties.push(
            this.flowParseObjectTypeProperty(node, isStatic, variance, kind, allowSpread),
          );
        }

        this.flowObjectTypeSemicolon();
      }

      this.expect(endDelim);

      const out = this.finishNode(nodeStart, "ObjectTypeAnnotation");

      this.state.inType = oldInType;

      return out;
    }

    flowParseObjectTypeProperty(
      node: N.FlowObjectTypeProperty | N.FlowObjectTypeSpreadProperty,
      isStatic: boolean,
      variance: N.FlowVariance | null,
      kind: string,
      allowSpread: boolean,
    ): N.FlowObjectTypeProperty | N.FlowObjectTypeSpreadProperty {
      if (this.match(tt.ellipsis)) {
        if (!allowSpread) {
          this.unexpected(null, "Spread operator cannot appear in class or interface definitions");
        }
        if (variance) {
          this.unexpected(variance.start, "Spread properties cannot have variance");
        }
        this.expect(tt.ellipsis);
        node.argument = this.flowParseType();

        return this.finishNode(node, "ObjectTypeSpreadProperty");
      } else {
        this.flowParseObjectPropertyKey();
        node.static = isStatic;
        node.kind = kind;

        let optional = false;
        if (this.isRelational("<") || this.match(tt.parenL)) {
          // This is a method property
          node.method = true;

          if (variance) {
            this.unexpected(variance.start);
          }

          node.value = this.flowParseObjectTypeMethodish(
            this.startNodeAt(node.start, node.loc.start),
          );
          if (kind === "get" || kind === "set") {
            this.flowCheckGetterSetterParamCount(node);
          }
        } else {
          if (kind !== "init") this.unexpected();

          node.method = false;

          if (this.eat(tt.question)) {
            optional = true;
          }
          node.value = this.flowParseTypeInitialiser();
          node.variance = variance;
        }

        node.optional = optional;

        return this.finishNode(node, "ObjectTypeProperty");
      }
    }

    // This is similar to checkGetterSetterParamCount, but as
    // babylon uses non estree properties we cannot reuse it here
    flowCheckGetterSetterParamCount(
      property: N.FlowObjectTypeProperty | N.FlowObjectTypeSpreadProperty,
    ): void {
      const paramCount = property.kind === "get" ? 0 : 1;
      if (property.value.params.length !== paramCount) {
        const start = property.start;
        if (property.kind === "get") {
          this.raise(start, "getter should have no params");
        } else {
          this.raise(start, "setter should have exactly one param");
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

    flowParseQualifiedTypeIdentifier(
      startPos?: number,
      startLoc?: Position,
      id?: N.Identifier,
    ): N.FlowQualifiedTypeIdentifier {
      startPos = startPos || this.state.start;
      startLoc = startLoc || this.state.startLoc;
      let node = id || this.parseIdentifier();

      while (this.eat(tt.dot)) {
        const node2 = this.startNodeAt(startPos, startLoc);
        node2.qualification = node;
        node2.id = this.parseIdentifier();
        node = this.finishNode(node2, "QualifiedTypeIdentifier") as N.Identifier;
      }

      return node;
    }

    flowParseGenericType(
      startPos: number,
      startLoc: Position,
      id: N.Identifier,
    ): N.FlowGenericTypeAnnotation {
      const node = this.startNodeAt(startPos, startLoc);

      node.typeParameters = null;
      node.id = this.flowParseQualifiedTypeIdentifier(startPos, startLoc, id);

      if (this.isRelational("<")) {
        node.typeParameters = this.flowParseTypeParameterInstantiation();
      }

      return this.finishNode(node, "GenericTypeAnnotation");
    }

    flowParseTypeofType(): N.FlowTypeofTypeAnnotation {
      const node = this.startNode();
      this.expect(tt._typeof);
      node.argument = this.flowParsePrimaryType();
      return this.finishNode(node, "TypeofTypeAnnotation");
    }

    flowParseTupleType(): N.FlowTupleTypeAnnotation {
      const node = this.startNode();
      node.types = [];
      this.expect(tt.bracketL);
      // We allow trailing commas
      while (this.state.pos < this.input.length && !this.match(tt.bracketR)) {
        node.types.push(this.flowParseType());
        if (this.match(tt.bracketR)) break;
        this.expect(tt.comma);
      }
      this.expect(tt.bracketR);
      return this.finishNode(node, "TupleTypeAnnotation");
    }

    flowParseFunctionTypeParam(): N.FlowFunctionTypeParam {
      let name = null;
      let optional = false;
      let typeAnnotation = null;
      const node = this.startNode();
      const lh = this.lookahead();
      if (lh.type === tt.colon || lh.type === tt.question) {
        name = this.parseIdentifier();
        if (this.eat(tt.question)) {
          optional = true;
        }
        typeAnnotation = this.flowParseTypeInitialiser();
      } else {
        typeAnnotation = this.flowParseType();
      }
      node.name = name;
      node.optional = optional;
      node.typeAnnotation = typeAnnotation;
      return this.finishNode(node, "FunctionTypeParam");
    }

    reinterpretTypeAsFunctionTypeParam(type: N.FlowType): N.FlowFunctionTypeParam {
      const node = this.startNodeAt(type.start, type.loc.start);
      node.name = null;
      node.optional = false;
      node.typeAnnotation = type;
      return this.finishNode(node, "FunctionTypeParam");
    }

    flowParseFunctionTypeParams(
      params: Array<N.FlowFunctionTypeParam> = [],
    ): {params: Array<N.FlowFunctionTypeParam>; rest: N.FlowFunctionTypeParam | null} {
      let rest: N.FlowFunctionTypeParam | null = null;
      while (!this.match(tt.parenR) && !this.match(tt.ellipsis)) {
        params.push(this.flowParseFunctionTypeParam());
        if (!this.match(tt.parenR)) {
          this.expect(tt.comma);
        }
      }
      if (this.eat(tt.ellipsis)) {
        rest = this.flowParseFunctionTypeParam();
      }
      return {params, rest};
    }

    flowIdentToTypeAnnotation(
      startPos: number,
      startLoc: Position,
      node: N.FlowTypeAnnotation,
      id: N.Identifier,
    ): N.FlowTypeAnnotation {
      switch (id.name) {
        case "any":
          return this.finishNode(node, "AnyTypeAnnotation");

        case "void":
          return this.finishNode(node, "VoidTypeAnnotation");

        case "bool":
        case "boolean":
          return this.finishNode(node, "BooleanTypeAnnotation");

        case "mixed":
          return this.finishNode(node, "MixedTypeAnnotation");

        case "empty":
          return this.finishNode(node, "EmptyTypeAnnotation");

        case "number":
          return this.finishNode(node, "NumberTypeAnnotation");

        case "string":
          return this.finishNode(node, "StringTypeAnnotation");

        default:
          return this.flowParseGenericType(startPos, startLoc, id);
      }
    }

    // The parsing of types roughly parallels the parsing of expressions, and
    // primary types are kind of like primary expressions...they're the
    // primitives with which other types are constructed.
    flowParsePrimaryType(): N.FlowTypeAnnotation {
      const startPos = this.state.start;
      const startLoc = this.state.startLoc;
      const node = this.startNode();
      let tmp;
      let type;
      let isGroupedType = false;
      const oldNoAnonFunctionType = this.state.noAnonFunctionType;

      switch (this.state.type) {
        case tt.name:
          return this.flowIdentToTypeAnnotation(startPos, startLoc, node, this.parseIdentifier());

        case tt.braceL:
          return this.flowParseObjectType(false, false, true);

        case tt.braceBarL:
          return this.flowParseObjectType(false, true, true);

        case tt.bracketL:
          return this.flowParseTupleType();

        case tt.relational:
          if (this.state.value === "<") {
            node.typeParameters = this.flowParseTypeParameterDeclaration();
            this.expect(tt.parenL);
            tmp = this.flowParseFunctionTypeParams();
            node.params = tmp.params;
            node.rest = tmp.rest;
            this.expect(tt.parenR);

            this.expect(tt.arrow);

            node.returnType = this.flowParseType();

            return this.finishNode(node, "FunctionTypeAnnotation");
          }
          break;

        case tt.parenL:
          this.next();

          // Check to see if this is actually a grouped type
          if (!this.match(tt.parenR) && !this.match(tt.ellipsis)) {
            if (this.match(tt.name)) {
              const token = this.lookahead().type;
              isGroupedType = token !== tt.question && token !== tt.colon;
            } else {
              isGroupedType = true;
            }
          }

          if (isGroupedType) {
            this.state.noAnonFunctionType = false;
            type = this.flowParseType();
            this.state.noAnonFunctionType = oldNoAnonFunctionType;

            // A `,` or a `) =>` means this is an anonymous function type
            if (
              this.state.noAnonFunctionType ||
              !(
                this.match(tt.comma) ||
                (this.match(tt.parenR) && this.lookahead().type === tt.arrow)
              )
            ) {
              this.expect(tt.parenR);
              return type;
            } else {
              // Eat a comma if there is one
              this.eat(tt.comma);
            }
          }

          if (type) {
            tmp = this.flowParseFunctionTypeParams([this.reinterpretTypeAsFunctionTypeParam(type)]);
          } else {
            tmp = this.flowParseFunctionTypeParams();
          }

          node.params = tmp.params;
          node.rest = tmp.rest;

          this.expect(tt.parenR);

          this.expect(tt.arrow);

          node.returnType = this.flowParseType();

          node.typeParameters = null;

          return this.finishNode(node, "FunctionTypeAnnotation");

        case tt.string:
          return this.parseLiteral(this.state.value, "StringLiteralTypeAnnotation");

        case tt._true:
        case tt._false:
          node.value = this.match(tt._true);
          this.next();
          return this.finishNode(node, "BooleanLiteralTypeAnnotation");

        case tt.plusMin:
          if (this.state.value === "-") {
            this.next();
            if (!this.match(tt.num)) {
              this.unexpected(null, `Unexpected token, expected "number"`);
            }

            return this.parseLiteral(
              -this.state.value,
              "NumberLiteralTypeAnnotation",
              node.start,
              node.loc.start,
            );
          }

          this.unexpected();
        case tt.num:
          return this.parseLiteral(this.state.value, "NumberLiteralTypeAnnotation");

        case tt._null:
          this.next();
          return this.finishNode(node, "NullLiteralTypeAnnotation");

        case tt._this:
          this.next();
          return this.finishNode(node, "ThisTypeAnnotation");

        case tt.star:
          this.next();
          return this.finishNode(node, "ExistsTypeAnnotation");

        default:
          if (this.state.type.keyword === "typeof") {
            return this.flowParseTypeofType();
          }
      }

      throw this.unexpected();
    }

    flowParsePostfixType(): N.FlowTypeAnnotation {
      const startPos = this.state.start;
      const startLoc = this.state.startLoc;
      let type = this.flowParsePrimaryType();
      while (!this.canInsertSemicolon() && this.match(tt.bracketL)) {
        const node = this.startNodeAt(startPos, startLoc);
        node.elementType = type;
        this.expect(tt.bracketL);
        this.expect(tt.bracketR);
        type = this.finishNode(node, "ArrayTypeAnnotation");
      }
      return type;
    }

    flowParsePrefixType(): N.FlowTypeAnnotation {
      const node = this.startNode();
      if (this.eat(tt.question)) {
        node.typeAnnotation = this.flowParsePrefixType();
        return this.finishNode(node, "NullableTypeAnnotation");
      } else {
        return this.flowParsePostfixType();
      }
    }

    flowParseAnonFunctionWithoutParens(): N.FlowTypeAnnotation {
      const param = this.flowParsePrefixType();
      if (!this.state.noAnonFunctionType && this.eat(tt.arrow)) {
        // TODO: This should be a type error. Passing in a SourceLocation, and it expects a Position.
        const node = this.startNodeAt(param.start, param.loc.start);
        node.params = [this.reinterpretTypeAsFunctionTypeParam(param)];
        node.rest = null;
        node.returnType = this.flowParseType();
        node.typeParameters = null;
        return this.finishNode(node, "FunctionTypeAnnotation");
      }
      return param;
    }

    flowParseIntersectionType(): N.FlowTypeAnnotation {
      const node = this.startNode();
      this.eat(tt.bitwiseAND);
      const type = this.flowParseAnonFunctionWithoutParens();
      node.types = [type];
      while (this.eat(tt.bitwiseAND)) {
        node.types.push(this.flowParseAnonFunctionWithoutParens());
      }
      return node.types.length === 1 ? type : this.finishNode(node, "IntersectionTypeAnnotation");
    }

    flowParseUnionType(): N.FlowTypeAnnotation {
      const node = this.startNode();
      this.eat(tt.bitwiseOR);
      const type = this.flowParseIntersectionType();
      node.types = [type];
      while (this.eat(tt.bitwiseOR)) {
        node.types.push(this.flowParseIntersectionType());
      }
      return node.types.length === 1 ? type : this.finishNode(node, "UnionTypeAnnotation");
    }

    flowParseType(): N.FlowTypeAnnotation {
      const oldInType = this.state.inType;
      this.state.inType = true;
      const type = this.flowParseUnionType();
      this.state.inType = oldInType;
      // Ensure that a brace after a function generic type annotation is a
      // statement, except in arrow functions (noAnonFunctionType)
      this.state.exprAllowed = this.state.exprAllowed || this.state.noAnonFunctionType;
      return type;
    }

    flowParseTypeAnnotation(): N.FlowTypeAnnotation {
      const node = this.startNode();
      node.typeAnnotation = this.flowParseTypeInitialiser();
      return this.finishNode(node, "TypeAnnotation");
    }

    flowParseTypeAnnotatableIdentifier(allowPrimitiveOverride?: boolean): N.Identifier {
      const ident = allowPrimitiveOverride
        ? this.parseIdentifier()
        : this.flowParseRestrictedIdentifier();
      if (this.match(tt.colon)) {
        ident.typeAnnotation = this.flowParseTypeAnnotation() as N.TypeAnnotationBase;
        this.finishNode(ident, ident.type);
      }
      return ident;
    }

    typeCastToParameter(node: N.Node): N.Node {
      node.expression.typeAnnotation = node.typeAnnotation;

      return this.finishNodeAt(
        node.expression,
        node.expression.type,
        node.typeAnnotation.end,
        node.typeAnnotation.loc.end,
      );
    }

    flowParseVariance(): N.FlowVariance | null {
      let variance: N.FlowVariance | null = null;
      if (this.match(tt.plusMin)) {
        variance = this.startNode<N.FlowVariance>();
        if (this.state.value === "+") {
          variance.kind = "plus";
        } else {
          variance.kind = "minus";
        }
        this.next();
        this.finishNode(variance, "Variance");
      }
      return variance;
    }

    // ==================================
    // Overrides
    // ==================================

    parseFunctionBodyAndFinish(
      functionStart: number,
      isAsync: boolean,
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
        isAsync,
        isGenerator,
        allowExpressionBody,
        funcContextId,
      );
    }

    // interfaces
    parseStatement(declaration: boolean, topLevel?: boolean): void {
      if (this.match(tt.name) && this.state.value === "interface") {
        const node = this.startNode();
        this.runInTypeContext(0, () => {
          this.next();
          this.flowParseInterface(node);
        });
      } else {
        super.parseStatement(declaration, topLevel);
      }
    }

    // declares, interfaces and type aliases
    parseIdentifierStatement(name: string): void {
      if (name === "declare") {
        if (
          this.match(tt._class) ||
          this.match(tt.name) ||
          this.match(tt._function) ||
          this.match(tt._var) ||
          this.match(tt._export)
        ) {
          this.runInTypeContext(1, () => {
            this.flowParseDeclare(this.startNode());
          });
        }
      } else if (this.match(tt.name)) {
        if (name === "interface") {
          this.runInTypeContext(1, () => {
            this.flowParseInterface(this.startNode());
          });
        } else if (name === "type") {
          this.runInTypeContext(1, () => this.flowParseTypeAlias(this.startNode()));
        } else if (name === "opaque") {
          this.runInTypeContext(1, () => this.flowParseOpaqueType(this.startNode(), false));
        }
      }
      super.parseIdentifierStatement(name);
    }

    // export type
    shouldParseExportDeclaration(): boolean {
      return (
        this.isContextual("type") ||
        this.isContextual("interface") ||
        this.isContextual("opaque") ||
        super.shouldParseExportDeclaration()
      );
    }

    isExportDefaultSpecifier(): boolean {
      if (
        this.match(tt.name) &&
        (this.state.value === "type" ||
          this.state.value === "interface" ||
          this.state.value === "opaque")
      ) {
        return false;
      }

      return super.isExportDefaultSpecifier();
    }

    parseConditional(
      noIn: boolean | null,
      startPos: number,
      startLoc: Position,
      refNeedsArrowPos?: Pos | null,
    ): void {
      // only do the expensive clone if there is a question mark
      // and if we come from inside parens
      if (refNeedsArrowPos && this.match(tt.question)) {
        const state = this.state.clone();
        try {
          super.parseConditional(noIn, startPos, startLoc);
          return;
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state = state;
            // @ts-ignore
            refNeedsArrowPos.start = err.pos || this.state.start;
            return;
          } else {
            // istanbul ignore next: no such error is expected
            throw err;
          }
        }
      }
      super.parseConditional(noIn, startPos, startLoc, refNeedsArrowPos);
    }

    parseParenItem(): void {
      super.parseParenItem();
      if (this.eat(tt.question)) {
        this.state.tokens[this.state.tokens.length - 1].isType = true;
      }
      if (this.match(tt.colon)) {
        this.flowParseTypeAnnotation();
      }
    }

    parseExportDeclaration(): void {
      if (this.isContextual("type")) {
        this.runInTypeContext(1, () => {
          const declarationNode = this.startNode();
          this.next();

          if (this.match(tt.braceL)) {
            // export type { foo, bar };
            this.parseExportSpecifiers();
            this.parseExportFrom();
          } else {
            // export type Foo = Bar;
            this.flowParseTypeAlias(declarationNode);
          }
        });
      } else if (this.isContextual("opaque")) {
        this.runInTypeContext(1, () => {
          const declarationNode = this.startNode();
          this.next();
          // export opaque type Foo = Bar;
          this.flowParseOpaqueType(declarationNode, false);
        });
      } else if (this.isContextual("interface")) {
        this.runInTypeContext(1, () => {
          const declarationNode = this.startNode();
          this.next();
          this.flowParseInterface(declarationNode);
        });
      } else {
        super.parseExportDeclaration();
      }
    }

    shouldParseExportStar(): boolean {
      return (
        super.shouldParseExportStar() ||
        (this.isContextual("type") && this.lookahead().type === tt.star)
      );
    }

    parseExportStar(): void {
      if (this.eatContextual("type")) {
        this.runInTypeContext(2, () => {
          super.parseExportStar();
        });
      } else {
        super.parseExportStar();
      }
    }

    parseClassId(isStatement: boolean, optionalId: boolean = false): void {
      super.parseClassId(isStatement, optionalId);
      if (this.isRelational("<")) {
        this.flowParseTypeParameterDeclaration();
      }
    }

    // don't consider `void` to be a keyword as then it'll use the void token type
    // and set startExpr
    isKeyword(name: string): boolean {
      if (this.state.inType && name === "void") {
        return false;
      } else {
        return super.isKeyword(name);
      }
    }

    // ensure that inside flow types, we bypass the jsx parser plugin
    readToken(code: number): void {
      if (this.state.inType && (code === 62 || code === 60)) {
        this.finishOp(tt.relational, 1);
      } else {
        super.readToken(code);
      }
    }

    // parse an item inside a expression list eg. `(NODE, NODE)` where NODE represents
    // the position where this function is called
    parseExprListItem(
      allowEmpty: boolean | null,
      refShorthandDefaultPos: Pos | null,
      refNeedsArrowPos: Pos | null,
    ): N.Expression | null {
      const container = this.startNode();
      const node = super.parseExprListItem(allowEmpty, refShorthandDefaultPos, refNeedsArrowPos);
      if (this.match(tt.colon)) {
        container._exprListItem = true;
        container.expression = node;
        container.typeAnnotation = this.flowParseTypeAnnotation();
        return this.finishNode(container, "TypeCastExpression");
      } else {
        return node;
      }
    }

    // parse class property type annotations
    parseClassProperty(): void {
      if (this.match(tt.colon)) {
        this.flowParseTypeAnnotation();
      }
      super.parseClassProperty();
    }

    // determine whether or not we're currently in the position where a class method would appear
    isClassMethod(): boolean {
      return this.isRelational("<") || super.isClassMethod();
    }

    // determine whether or not we're currently in the position where a class property would appear
    isClassProperty(): boolean {
      return this.match(tt.colon) || super.isClassProperty();
    }

    isNonstaticConstructor(method: N.ClassMethod | N.ClassProperty): boolean {
      return !this.match(tt.colon) && super.isNonstaticConstructor(method);
    }

    // parse type parameters for class methods
    parseClassMethod(
      functionStart: number,
      isGenerator: boolean,
      isAsync: boolean,
      isConstructor: boolean,
    ): void {
      if (this.isRelational("<")) {
        this.flowParseTypeParameterDeclaration();
      }
      super.parseClassMethod(functionStart, isGenerator, isAsync, isConstructor);
    }

    // parse a the super class type parameters and implements
    parseClassSuper(): boolean {
      const hadSuper = super.parseClassSuper();
      if (hadSuper && this.isRelational("<")) {
        this.flowParseTypeParameterInstantiation();
      }
      if (this.isContextual("implements")) {
        this.state.tokens[this.state.tokens.length - 1].type = tt._implements;
        this.runInTypeContext(0, () => {
          this.next();
          do {
            this.flowParseRestrictedIdentifier(/* liberal */ true);
            if (this.isRelational("<")) {
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
      prop: N.ObjectMember,
      startPos: number | null,
      startLoc: Position | null,
      isGenerator: boolean,
      isAsync: boolean,
      isPattern: boolean,
      isBlockScope: boolean,
      refShorthandDefaultPos: Pos | null,
      objectContextId: number,
    ): void {
      if (prop.variance) {
        this.unexpected(prop.variance.start);
      }
      delete prop.variance;

      let typeParameters;

      // method shorthand
      if (this.isRelational("<")) {
        typeParameters = this.flowParseTypeParameterDeclaration();
        if (!this.match(tt.parenL)) this.unexpected();
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

      // add typeParameters if we found them
      if (typeParameters) {
        // $FlowFixMe (trying to set '.typeParameters' on an expression)
        (prop.value || prop).typeParameters = typeParameters;
      }
    }

    parseAssignableListItemTypes(): void {
      this.runInTypeContext(0, () => {
        this.eat(tt.question);
        if (this.match(tt.colon)) {
          this.flowParseTypeAnnotation();
        }
      });
    }

    // parse typeof and type imports
    parseImportSpecifiers(): void {
      let kind = null;
      if (this.match(tt._typeof)) {
        kind = "typeof";
      } else if (this.isContextual("type")) {
        kind = "type";
      }
      if (kind) {
        const lh = this.lookahead();

        // import type * is not allowed
        if (kind === "type" && lh.type === tt.star) {
          this.unexpected(lh.start);
        }

        if (isMaybeDefaultImport(lh) || lh.type === tt.braceL || lh.type === tt.star) {
          this.next();
        }
      }

      super.parseImportSpecifiers();
    }

    // parse import-type/typeof shorthand
    parseImportSpecifier(): void {
      const specifier = this.startNode();
      const firstIdent = this.parseIdentifier(true);

      let specifierTypeKind = null;
      if (firstIdent.name === "type") {
        this.state.tokens[this.state.tokens.length - 1].type = tt._type;
        specifierTypeKind = "type";
      } else if (firstIdent.name === "typeof") {
        specifierTypeKind = "typeof";
        this.state.tokens[this.state.tokens.length - 1].type = tt._typeof;
      }

      if (this.isContextual("as") && !this.isLookaheadContextual("as")) {
        const as_ident = this.parseIdentifier(true);
        if (specifierTypeKind !== null && !this.match(tt.name) && !this.state.type.keyword) {
          // `import {type as ,` or `import {type as }`
          specifier.imported = as_ident;
          specifier.importKind = specifierTypeKind;
          specifier.local = as_ident.__clone();
        } else {
          // `import {type as foo`
          specifier.imported = firstIdent;
          specifier.importKind = null;
          specifier.local = this.parseIdentifier();
        }
      } else if (specifierTypeKind !== null && (this.match(tt.name) || this.state.type.keyword)) {
        // `import {type foo`
        specifier.imported = this.parseIdentifier(true);
        specifier.importKind = specifierTypeKind;
        if (this.eatContextual("as")) {
          specifier.local = this.parseIdentifier();
        } else {
          specifier.local = specifier.imported.__clone();
        }
      } else {
        specifier.imported = firstIdent;
        specifier.importKind = null;
        specifier.local = specifier.imported.__clone();
      }
    }

    // parse function type parameters - function foo<T>() {}
    parseFunctionParams(allowModifiers?: boolean, contextId?: number): void {
      // Originally this checked if the method is a getter/setter, but if it was, we'd crash soon
      // anyway, so don't try to propagate that information.
      if (this.isRelational("<")) {
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
        this.flowParseTypeAnnotation();
      }
    }

    // parse the return type of an async arrow function - let foo = (async (): number => {});
    parseAsyncArrowFromCallExpression(functionStart: number, startTokenIndex: number): void {
      if (this.match(tt.colon)) {
        const oldNoAnonFunctionType = this.state.noAnonFunctionType;
        this.state.noAnonFunctionType = true;
        this.flowParseTypeAnnotation();
        this.state.noAnonFunctionType = oldNoAnonFunctionType;
      }
      super.parseAsyncArrowFromCallExpression(functionStart, startTokenIndex);
    }

    // todo description
    shouldParseAsyncArrow(): boolean {
      return this.match(tt.colon) || super.shouldParseAsyncArrow();
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
    parseMaybeAssign(
      noIn?: boolean | null,
      refShorthandDefaultPos?: Pos | null,
      afterLeftParse?: Function,
      refNeedsArrowPos?: Pos | null,
    ): boolean {
      let jsxError = null;
      if (tt.jsxTagStart && this.match(tt.jsxTagStart)) {
        const state = this.state.clone();
        try {
          return super.parseMaybeAssign(
            noIn,
            refShorthandDefaultPos,
            afterLeftParse,
            refNeedsArrowPos,
          );
        } catch (err) {
          if (err instanceof SyntaxError) {
            this.state = state;

            // Remove `tc.j_expr` and `tc.j_oTag` from context added
            // by parsing `jsxTagStart` to stop the JSX plugin from
            // messing with the tokens
            this.state.context.length -= 2;
            this.state.type = tt.typeParameterStart;

            jsxError = err;
          } else {
            // istanbul ignore next: no such error is expected
            throw err;
          }
        }
      }

      if (jsxError != null || this.isRelational("<")) {
        let wasArrow = false;
        let typeParameters;
        try {
          typeParameters = this.runInTypeContext(0, () => this.flowParseTypeParameterDeclaration());
          wasArrow = super.parseMaybeAssign(
            noIn,
            refShorthandDefaultPos,
            afterLeftParse,
            refNeedsArrowPos,
          );
        } catch (err) {
          throw jsxError || err;
        }

        if (wasArrow) {
          return true;
        } else if (jsxError != null) {
          throw jsxError;
        } else {
          this.raise(
            typeParameters.start,
            "Expected an arrow function after this type parameter declaration",
          );
        }
      }

      return super.parseMaybeAssign(noIn, refShorthandDefaultPos, afterLeftParse, refNeedsArrowPos);
    }

    // handle return types for arrow functions
    parseArrow(): boolean {
      if (this.match(tt.colon)) {
        this.runInTypeContext(0, () => {
          const state = this.state.clone();
          try {
            const oldNoAnonFunctionType = this.state.noAnonFunctionType;
            this.state.noAnonFunctionType = true;
            this.flowParseTypeAndPredicateInitialiser();
            this.state.noAnonFunctionType = oldNoAnonFunctionType;

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
        });
      }

      return super.parseArrow();
    }

    shouldParseArrow(): boolean {
      return this.match(tt.colon) || super.shouldParseArrow();
    }

    parseSubscripts(startPos: number, startLoc: Position, noCalls?: boolean | null): void {
      if (
        this.state.tokens[this.state.tokens.length - 1].value === "async" &&
        this.isRelational("<")
      ) {
        const state = this.state.clone();
        let error;
        try {
          const wasArrow = this.parseAsyncArrowWithTypeParameters(startPos, startLoc);
          if (wasArrow) {
            return;
          }
        } catch (e) {
          error = e;
        }

        this.state = state;
        try {
          super.parseSubscripts(startPos, startLoc, noCalls);
          return;
        } catch (e) {
          throw error || e;
        }
      }

      super.parseSubscripts(startPos, startLoc, noCalls);
    }

    // Returns true if there was an arrow function here.
    parseAsyncArrowWithTypeParameters(startPos: number, startLoc: Position): boolean {
      const startTokenIndex = this.state.tokens.length;
      this.parseFunctionParams();
      if (!this.parseArrow()) {
        return false;
      }
      this.parseArrowExpression(startPos, startTokenIndex, /* isAsync */ true);
      return true;
    }
  } as ParserClass;
