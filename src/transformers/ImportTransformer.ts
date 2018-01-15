import {IdentifierRole} from "../../sucrase-babylon/tokenizer";
import ImportProcessor from "../ImportProcessor";
import TokenProcessor from "../TokenProcessor";
import isMaybePropertyName from "../util/isMaybePropertyName";
import RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

export default class ImportTransformer extends Transformer {
  private hadExport: boolean = false;
  private hadNamedExport: boolean = false;
  private hadDefaultExport: boolean = false;

  constructor(
    readonly rootTransformer: RootTransformer,
    readonly tokens: TokenProcessor,
    readonly importProcessor: ImportProcessor,
    readonly shouldAddModuleExports: boolean,
  ) {
    super();
  }

  getPrefixCode(): string {
    let prefix = '"use strict";';
    prefix += this.importProcessor.getPrefixCode();
    if (this.hadExport) {
      prefix += 'Object.defineProperty(exports, "__esModule", {value: true});';
    }
    return prefix;
  }

  getSuffixCode(): string {
    if (this.shouldAddModuleExports && this.hadDefaultExport && !this.hadNamedExport) {
      return "\nmodule.exports = exports.default;\n";
    }
    return "";
  }

  process(): boolean {
    if (
      this.tokens.matches(["import"]) &&
      !isMaybePropertyName(this.tokens, this.tokens.currentIndex())
    ) {
      this.processImport();
      return true;
    }
    if (
      this.tokens.matches(["export"]) &&
      !isMaybePropertyName(this.tokens, this.tokens.currentIndex()) &&
      !this.tokens.currentToken().isType
    ) {
      this.hadExport = true;
      return this.processExport();
    }
    if (this.tokens.matches(["name"]) || this.tokens.matches(["jsxName"])) {
      return this.processIdentifier();
    }
    if (this.tokens.matches(["="])) {
      return this.processAssignment();
    }
    return false;
  }

  /**
   * Transform this:
   * import foo, {bar} from 'baz';
   * into
   * var _baz = require('baz'); var _baz2 = _interopRequireDefault(_baz);
   *
   * The import code was already generated in the import preprocessing step, so
   * we just need to look it up.
   */
  private processImport(): void {
    const wasOnlyTypes = this.removeImportAndDetectIfType();

    if (wasOnlyTypes) {
      this.tokens.removeToken();
    } else {
      const path = this.tokens.currentToken().value;
      this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(path));
      this.tokens.appendCode(this.importProcessor.claimImportCode(path));
    }
    if (this.tokens.matches([";"])) {
      this.tokens.removeToken();
    }
  }

  /**
   * Erase this import, and if it was either of the form "import type" or
   * contained only "type". Such imports should not even do a side-effect
   * import.
   *
   * The position should end at the import string.
   */
  private removeImportAndDetectIfType(): boolean {
    this.tokens.removeInitialToken();
    if (
      this.tokens.matchesName("type") &&
      !this.tokens.matchesAtIndex(this.tokens.currentIndex() + 1, [","]) &&
      !this.tokens.matchesNameAtIndex(this.tokens.currentIndex() + 1, "from")
    ) {
      // This is an "import type" statement, so exit early.
      this.removeRemainingImport();
      return true;
    }

    if (this.tokens.matches(["name"]) || this.tokens.matches(["*"])) {
      // We have a default import or namespace import, so there must be some
      // non-type import.
      this.removeRemainingImport();
      return false;
    }

    if (this.tokens.matches(["string"])) {
      // This is a bare import, so we should proceed with the import.
      return false;
    }

    let foundNonType = false;
    while (!this.tokens.matches(["string"])) {
      // Check if any named imports are of the form "foo" or "foo as bar", with
      // no leading "type".
      if ((!foundNonType && this.tokens.matches(["{"])) || this.tokens.matches([","])) {
        this.tokens.removeToken();
        if (
          this.tokens.matches(["name", ","]) ||
          this.tokens.matches(["name", "}"]) ||
          this.tokens.matches(["name", "name", "name", ","]) ||
          this.tokens.matches(["name", "name", "name", "}"])
        ) {
          foundNonType = true;
        }
      }
      this.tokens.removeToken();
    }
    return !foundNonType;
  }

  private removeRemainingImport(): void {
    while (!this.tokens.matches(["string"])) {
      this.tokens.removeToken();
    }
  }

  private processIdentifier(): boolean {
    const token = this.tokens.currentToken();
    if (token.shadowsGlobal) {
      return false;
    }

    if (token.identifierRole === IdentifierRole.ObjectShorthand) {
      return this.processObjectShorthand();
    }

    if (token.identifierRole !== IdentifierRole.Access) {
      return false;
    }
    const replacement = this.importProcessor.getIdentifierReplacement(token.value);
    if (!replacement) {
      return false;
    }
    // For now, always use the (0, a) syntax so that non-expression replacements
    // are more likely to become syntax errors.
    this.tokens.replaceToken(`(0, ${replacement})`);
    return true;
  }

  processObjectShorthand(): boolean {
    const identifier = this.tokens.currentToken().value;
    const replacement = this.importProcessor.getIdentifierReplacement(identifier);
    if (!replacement) {
      return false;
    }
    this.tokens.replaceToken(`${identifier}: ${replacement}`);
    return true;
  }

  processExport(): boolean {
    if (
      this.tokens.matches(["export", "enum"]) ||
      this.tokens.matches(["export", "const", "enum"])
    ) {
      // Let the TypeScript transform handle it.
      return false;
    }
    if (this.tokens.matches(["export", "default"])) {
      this.processExportDefault();
      this.hadDefaultExport = true;
      return true;
    }
    this.hadNamedExport = true;
    if (
      this.tokens.matches(["export", "var"]) ||
      this.tokens.matches(["export", "let"]) ||
      this.tokens.matches(["export", "const"])
    ) {
      this.processExportVar();
      return true;
    } else if (
      this.tokens.matches(["export", "function"]) ||
      this.tokens.matches(["export", "name", "function"])
    ) {
      this.processExportFunction();
      return true;
    } else if (
      this.tokens.matches(["export", "class"]) ||
      this.tokens.matches(["export", "abstract", "class"])
    ) {
      this.processExportClass();
      return true;
    } else if (this.tokens.matches(["export", "{"])) {
      this.processExportBindings();
      return true;
    } else if (this.tokens.matches(["export", "*"])) {
      this.processExportStar();
      return true;
    } else {
      throw new Error("Unrecognized export syntax.");
    }
  }

  private processAssignment(): boolean {
    const index = this.tokens.currentIndex();
    const identifierToken = this.tokens.tokens[index - 1];
    if (identifierToken.type.label !== "name") {
      return false;
    }
    if (this.tokens.matchesAtIndex(index - 2, ["."])) {
      return false;
    }
    if (
      index - 2 >= 0 &&
      ["var", "let", "const"].includes(this.tokens.tokens[index - 2].type.label)
    ) {
      // Declarations don't need an extra assignment. This doesn't avoid the
      // assignment for comma-separated declarations, but it's still correct
      // since the assignment is just redundant.
      return false;
    }
    const exportedName = this.importProcessor.resolveExportBinding(identifierToken.value);
    if (!exportedName) {
      return false;
    }
    this.tokens.copyToken();
    this.tokens.appendCode(` exports.${exportedName} =`);
    return true;
  }

  private processExportDefault(): void {
    if (
      this.tokens.matches(["export", "default", "function", "name"]) ||
      // export default aysnc function
      this.tokens.matches(["export", "default", "name", "function", "name"])
    ) {
      this.tokens.removeInitialToken();
      this.tokens.removeToken();
      // Named function export case: change it to a top-level function
      // declaration followed by exports statement.
      const name = this.processNamedFunction();
      this.tokens.appendCode(` exports.default = ${name};`);
    } else if (
      this.tokens.matches(["export", "default", "class", "name"]) ||
      this.tokens.matches(["export", "default", "abstract", "class", "name"])
    ) {
      this.tokens.removeInitialToken();
      this.tokens.removeToken();
      if (this.tokens.matches(["abstract"])) {
        this.tokens.removeToken();
      }
      const name = this.rootTransformer.processNamedClass();
      this.tokens.appendCode(` exports.default = ${name};`);
    } else {
      this.tokens.replaceToken("exports.");
      this.tokens.copyToken();
      this.tokens.appendCode(" =");
    }
  }

  /**
   * Transform this:
   * export const x = 1;
   * into this:
   * const x = exports.x = 1;
   */
  private processExportVar(): void {
    this.tokens.replaceToken("");
    this.tokens.copyToken();
    if (!this.tokens.matches(["name"])) {
      throw new Error("Expected a regular identifier after export var/let/const.");
    }
    const name = this.tokens.currentToken().value;
    this.tokens.copyToken();
    this.tokens.appendCode(` = exports.${name}`);
  }

  /**
   * Transform this:
   * export function foo() {}
   * into this:
   * function foo() {} exports.foo = foo;
   */
  private processExportFunction(): void {
    this.tokens.replaceToken("");
    const name = this.processNamedFunction();
    this.tokens.appendCode(` exports.${name} = ${name};`);
  }

  /**
   * Skip past a function with a name and return that name.
   */
  private processNamedFunction(): string {
    if (this.tokens.matches(["function"])) {
      this.tokens.copyToken();
    } else if (this.tokens.matches(["name", "function"])) {
      if (this.tokens.currentToken().value !== "async") {
        throw new Error("Expected async keyword in function export.");
      }
      this.tokens.copyToken();
      this.tokens.copyToken();
    }
    if (!this.tokens.matches(["name"])) {
      throw new Error("Expected identifier for exported function name.");
    }
    const name = this.tokens.currentToken().value;
    this.tokens.copyToken();
    if (this.tokens.currentToken().isType) {
      this.tokens.removeInitialToken();
      while (this.tokens.currentToken().isType) {
        this.tokens.removeToken();
      }
    }
    this.tokens.copyExpectedToken("(");
    this.rootTransformer.processBalancedCode();
    this.tokens.copyExpectedToken(")");
    this.rootTransformer.processPossibleTypeRange();
    this.tokens.copyExpectedToken("{");
    this.rootTransformer.processBalancedCode();
    this.tokens.copyExpectedToken("}");
    return name;
  }

  /**
   * Transform this:
   * export class A {}
   * into this:
   * class A {} exports.A = A;
   */
  private processExportClass(): void {
    this.tokens.removeInitialToken();
    if (this.tokens.matches(["abstract"])) {
      this.tokens.removeToken();
    }
    const name = this.rootTransformer.processNamedClass();
    this.tokens.appendCode(` exports.${name} = ${name};`);
  }

  /**
   * Transform this:
   * export {a, b as c};
   * into this:
   * exports.a = a; exports.c = b;
   *
   * OR
   *
   * Transform this:
   * export {a, b as c} from './foo';
   * into the pre-generated Object.defineProperty code from the ImportProcessor.
   */
  private processExportBindings(): void {
    this.tokens.removeInitialToken();
    this.tokens.removeToken();

    const exportStatements = [];
    while (true) {
      const localName = this.tokens.currentToken().value;
      let exportedName;
      this.tokens.removeToken();
      if (this.tokens.matchesName("as")) {
        this.tokens.removeToken();
        exportedName = this.tokens.currentToken().value;
        this.tokens.removeToken();
      } else {
        exportedName = localName;
      }
      const newLocalName = this.importProcessor.getIdentifierReplacement(localName);
      exportStatements.push(`exports.${exportedName} = ${newLocalName || localName};`);

      if (this.tokens.matches(["}"])) {
        this.tokens.removeToken();
        break;
      }
      if (this.tokens.matches([",", "}"])) {
        this.tokens.removeToken();
        this.tokens.removeToken();
        break;
      } else if (this.tokens.matches([","])) {
        this.tokens.removeToken();
      } else {
        throw new Error(`Unexpected token: ${JSON.stringify(this.tokens.currentToken())}`);
      }
    }

    if (this.tokens.matchesName("from")) {
      // This is an export...from, so throw away the normal named export code
      // and use the Object.defineProperty code from ImportProcessor.
      this.tokens.removeToken();
      const path = this.tokens.currentToken().value;
      this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(path));
    } else {
      // This is a normal named export, so use that.
      this.tokens.appendCode(exportStatements.join(" "));
    }

    if (this.tokens.matches([";"])) {
      this.tokens.removeToken();
    }
  }

  private processExportStar(): void {
    this.tokens.removeInitialToken();
    while (!this.tokens.matches(["string"])) {
      this.tokens.removeToken();
    }
    const path = this.tokens.currentToken().value;
    this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(path));
    if (this.tokens.matches([";"])) {
      this.tokens.removeToken();
    }
  }
}
