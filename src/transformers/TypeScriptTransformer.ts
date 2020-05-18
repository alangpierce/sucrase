import {TokenType as tt} from "../parser/tokenizer/types";
import type TokenProcessor from "../TokenProcessor";
import isIdentifier from "../util/isIdentifier";
import type RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

export default class TypeScriptTransformer extends Transformer {
  constructor(
    readonly rootTransformer: RootTransformer,
    readonly tokens: TokenProcessor,
    readonly isImportsTransformEnabled: boolean,
  ) {
    super();
  }

  process(): boolean {
    if (
      this.rootTransformer.processPossibleArrowParamEnd() ||
      this.rootTransformer.processPossibleAsyncArrowWithTypeParams() ||
      this.rootTransformer.processPossibleTypeRange()
    ) {
      return true;
    }
    if (
      this.tokens.matches1(tt._public) ||
      this.tokens.matches1(tt._protected) ||
      this.tokens.matches1(tt._private) ||
      this.tokens.matches1(tt._abstract) ||
      this.tokens.matches1(tt._readonly) ||
      this.tokens.matches1(tt.nonNullAssertion)
    ) {
      this.tokens.removeInitialToken();
      return true;
    }
    if (this.tokens.matches1(tt._enum) || this.tokens.matches2(tt._const, tt._enum)) {
      this.processEnum();
      return true;
    }
    if (
      this.tokens.matches2(tt._export, tt._enum) ||
      this.tokens.matches3(tt._export, tt._const, tt._enum)
    ) {
      this.processEnum(true);
      return true;
    }
    return false;
  }

  processEnum(isExport: boolean = false): void {
    // We might have "export const enum", so just remove all relevant tokens.
    this.tokens.removeInitialToken();
    while (this.tokens.matches1(tt._const) || this.tokens.matches1(tt._enum)) {
      this.tokens.removeToken();
    }
    const enumName = this.tokens.identifierName();
    this.tokens.removeToken();
    if (isExport && !this.isImportsTransformEnabled) {
      this.tokens.appendCode("export ");
    }
    this.tokens.appendCode(`var ${enumName}; (function (${enumName})`);
    this.tokens.copyExpectedToken(tt.braceL);
    this.processEnumBody(enumName);
    this.tokens.copyExpectedToken(tt.braceR);
    if (isExport && this.isImportsTransformEnabled) {
      this.tokens.appendCode(`)(${enumName} || (exports.${enumName} = ${enumName} = {}));`);
    } else {
      this.tokens.appendCode(`)(${enumName} || (${enumName} = {}));`);
    }
  }

  /**
   * Rather than try to compute the actual enum values at compile time, we just create variables for
   * each one and let everything evaluate at runtime. There's some additional complexity due to
   * handling string literal names, including ones that happen to be valid identifiers.
   */
  processEnumBody(enumName: string): void {
    let isPreviousValidIdentifier = false;
    let lastValueReference = null;
    while (true) {
      if (this.tokens.matches1(tt.braceR)) {
        break;
      }
      const nameToken = this.tokens.currentToken();
      let name;
      let nameStringCode;
      if (nameToken.type === tt.name) {
        name = this.tokens.identifierNameForToken(nameToken);
        nameStringCode = `"${name}"`;
      } else if (nameToken.type === tt.string) {
        name = this.tokens.stringValueForToken(nameToken);
        nameStringCode = this.tokens.code.slice(nameToken.start, nameToken.end);
      } else {
        throw new Error("Expected name or string at beginning of enum element.");
      }
      const isValidIdentifier = isIdentifier(name);
      this.tokens.removeInitialToken();

      let valueIsString;
      let valueCode;

      if (this.tokens.matches1(tt.eq)) {
        const rhsEndIndex = this.tokens.currentToken().rhsEndIndex!;
        if (rhsEndIndex == null) {
          throw new Error("Expected rhsEndIndex on enum assign.");
        }
        this.tokens.removeToken();
        if (
          this.tokens.matches2(tt.string, tt.comma) ||
          this.tokens.matches2(tt.string, tt.braceR)
        ) {
          valueIsString = true;
        }
        const startToken = this.tokens.currentToken();
        while (this.tokens.currentIndex() < rhsEndIndex) {
          this.tokens.removeToken();
        }
        valueCode = this.tokens.code.slice(
          startToken.start,
          this.tokens.tokenAtRelativeIndex(-1).end,
        );
      } else {
        valueIsString = false;
        if (lastValueReference != null) {
          if (isPreviousValidIdentifier) {
            valueCode = `${lastValueReference} + 1`;
          } else {
            valueCode = `(${lastValueReference}) + 1`;
          }
        } else {
          valueCode = "0";
        }
      }
      if (this.tokens.matches1(tt.comma)) {
        this.tokens.removeToken();
      }

      let valueReference;
      if (isValidIdentifier) {
        this.tokens.appendCode(`const ${name} = ${valueCode}; `);
        valueReference = name;
      } else {
        valueReference = valueCode;
      }

      if (valueIsString) {
        this.tokens.appendCode(`${enumName}[${nameStringCode}] = ${valueReference};`);
      } else {
        this.tokens.appendCode(
          `${enumName}[${enumName}[${nameStringCode}] = ${valueReference}] = ${nameStringCode};`,
        );
      }
      lastValueReference = valueReference;
      isPreviousValidIdentifier = isValidIdentifier;
    }
  }
}
