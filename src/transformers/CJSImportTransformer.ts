import CJSImportProcessor from "../CJSImportProcessor";
import {ContextualKeyword, IdentifierRole, isDeclaration} from "../parser/tokenizer";
import {TokenType as tt} from "../parser/tokenizer/types";
import TokenProcessor from "../TokenProcessor";
import RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

/**
 * Class for editing import statements when we are transforming to commonjs.
 */
export default class CJSImportTransformer extends Transformer {
  private hadExport: boolean = false;
  private hadNamedExport: boolean = false;
  private hadDefaultExport: boolean = false;

  constructor(
    readonly rootTransformer: RootTransformer,
    readonly tokens: TokenProcessor,
    readonly importProcessor: CJSImportProcessor,
    readonly enableLegacyBabel5ModuleInterop: boolean,
  ) {
    super();
  }

  getPrefixCode(): string {
    let prefix = this.importProcessor.getPrefixCode();
    if (this.hadExport) {
      prefix += 'Object.defineProperty(exports, "__esModule", {value: true});';
    }
    return prefix;
  }

  getSuffixCode(): string {
    if (this.enableLegacyBabel5ModuleInterop && this.hadDefaultExport && !this.hadNamedExport) {
      return "\nmodule.exports = exports.default;\n";
    }
    return "";
  }

  process(): boolean {
    // TypeScript `import foo = require('foo');` should always just be translated to plain require.
    if (this.tokens.matches3(tt._import, tt.name, tt.eq)) {
      this.tokens.replaceToken("const");
      return true;
    }
    if (this.tokens.matches1(tt._import)) {
      this.processImport();
      return true;
    }
    if (this.tokens.matches2(tt._export, tt.eq)) {
      this.tokens.replaceToken("module.exports");
      return true;
    }
    if (this.tokens.matches1(tt._export) && !this.tokens.currentToken().isType) {
      this.hadExport = true;
      return this.processExport();
    }
    if (this.tokens.matches1(tt.name) || this.tokens.matches1(tt.jsxName)) {
      return this.processIdentifier();
    }
    if (this.tokens.matches1(tt.eq)) {
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
    if (this.tokens.matches2(tt._import, tt.parenL)) {
      this.tokens.replaceToken("Promise.resolve().then(() => require");
      const contextId = this.tokens.currentToken().contextId;
      if (contextId == null) {
        throw new Error("Expected context ID on dynamic import invocation.");
      }
      this.tokens.copyToken();
      while (!this.tokens.matchesContextIdAndLabel(tt.parenR, contextId)) {
        this.rootTransformer.processToken();
      }
      this.tokens.replaceToken("))");
      return;
    }

    const wasOnlyTypes = this.removeImportAndDetectIfType();

    if (wasOnlyTypes) {
      this.tokens.removeToken();
    } else {
      const path = this.tokens.stringValue();
      this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(path));
      this.tokens.appendCode(this.importProcessor.claimImportCode(path));
    }
    if (this.tokens.matches1(tt.semi)) {
      this.tokens.removeToken();
    }
  }

  /**
   * Erase this import, and return true if it was either of the form "import type" or contained only
   * "type" named imports. Such imports should not even do a side-effect import.
   *
   * The position should end at the import string.
   */
  private removeImportAndDetectIfType(): boolean {
    this.tokens.removeInitialToken();
    if (
      this.tokens.matchesContextual(ContextualKeyword._type) &&
      !this.tokens.matchesAtIndex(this.tokens.currentIndex() + 1, [tt.comma]) &&
      !this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, ContextualKeyword._from)
    ) {
      // This is an "import type" statement, so exit early.
      this.removeRemainingImport();
      return true;
    }

    if (this.tokens.matches1(tt.name) || this.tokens.matches1(tt.star)) {
      // We have a default import or namespace import, so there must be some
      // non-type import.
      this.removeRemainingImport();
      return false;
    }

    if (this.tokens.matches1(tt.string)) {
      // This is a bare import, so we should proceed with the import.
      return false;
    }

    let foundNonType = false;
    while (!this.tokens.matches1(tt.string)) {
      // Check if any named imports are of the form "foo" or "foo as bar", with
      // no leading "type".
      if ((!foundNonType && this.tokens.matches1(tt.braceL)) || this.tokens.matches1(tt.comma)) {
        this.tokens.removeToken();
        if (
          this.tokens.matches2(tt.name, tt.comma) ||
          this.tokens.matches2(tt.name, tt.braceR) ||
          this.tokens.matches4(tt.name, tt.name, tt.name, tt.comma) ||
          this.tokens.matches4(tt.name, tt.name, tt.name, tt.braceR)
        ) {
          foundNonType = true;
        }
      }
      this.tokens.removeToken();
    }
    return !foundNonType;
  }

  private removeRemainingImport(): void {
    while (!this.tokens.matches1(tt.string)) {
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
    const replacement = this.importProcessor.getIdentifierReplacement(
      this.tokens.identifierNameForToken(token),
    );
    if (!replacement) {
      return false;
    }
    // Tolerate any number of closing parens while looking for an opening paren
    // that indicates a function call.
    let possibleOpenParenIndex = this.tokens.currentIndex() + 1;
    while (
      possibleOpenParenIndex < this.tokens.tokens.length &&
      this.tokens.tokens[possibleOpenParenIndex].type === tt.parenR
    ) {
      possibleOpenParenIndex++;
    }
    // Avoid treating imported functions as methods of their `exports` object
    // by using `(0, f)` when the identifier is in a paren expression. Else
    // use `Function.prototype.call` when the identifier is a guaranteed
    // function call. When using `call`, pass undefined as the context.
    if (this.tokens.tokens[possibleOpenParenIndex].type === tt.parenL) {
      if (this.tokens.tokenAtRelativeIndex(1).type == tt.parenL) {
        this.tokens.replaceToken(`${replacement}.call(void 0, `);
        // Remove the old paren.
        this.tokens.removeToken();
        // Balance out the new paren.
        this.rootTransformer.processBalancedCode();
        this.tokens.copyExpectedToken(tt.parenR);
        return true;
      }
      // See here: http://2ality.com/2015/12/references.html
      this.tokens.replaceToken(`(0, ${replacement})`);
      return true;
    }
    this.tokens.replaceToken(replacement);
    return true;
  }

  processObjectShorthand(): boolean {
    const identifier = this.tokens.identifierName();
    const replacement = this.importProcessor.getIdentifierReplacement(identifier);
    if (!replacement) {
      return false;
    }
    this.tokens.replaceToken(`${identifier}: ${replacement}`);
    return true;
  }

  processExport(): boolean {
    if (
      this.tokens.matches2(tt._export, tt._enum) ||
      this.tokens.matches3(tt._export, tt._const, tt._enum)
    ) {
      // Let the TypeScript transform handle it.
      return false;
    }
    if (this.tokens.matches2(tt._export, tt._default)) {
      this.processExportDefault();
      this.hadDefaultExport = true;
      return true;
    }
    this.hadNamedExport = true;
    if (
      this.tokens.matches2(tt._export, tt._var) ||
      this.tokens.matches2(tt._export, tt._let) ||
      this.tokens.matches2(tt._export, tt._const)
    ) {
      this.processExportVar();
      return true;
    } else if (
      this.tokens.matches2(tt._export, tt._function) ||
      // export async function
      this.tokens.matches3(tt._export, tt.name, tt._function)
    ) {
      this.processExportFunction();
      return true;
    } else if (
      this.tokens.matches2(tt._export, tt._class) ||
      this.tokens.matches3(tt._export, tt._abstract, tt._class)
    ) {
      this.processExportClass();
      return true;
    } else if (this.tokens.matches2(tt._export, tt.braceL)) {
      this.processExportBindings();
      return true;
    } else if (this.tokens.matches2(tt._export, tt.star)) {
      this.processExportStar();
      return true;
    } else {
      throw new Error("Unrecognized export syntax.");
    }
  }

  private processAssignment(): boolean {
    const index = this.tokens.currentIndex();
    const identifierToken = this.tokens.tokens[index - 1];
    if (identifierToken.type !== tt.name) {
      return false;
    }
    if (this.tokens.matchesAtIndex(index - 2, [tt.dot])) {
      return false;
    }
    if (
      index - 2 >= 0 &&
      [tt._var, tt._let, tt._const].includes(this.tokens.tokens[index - 2].type)
    ) {
      // Declarations don't need an extra assignment. This doesn't avoid the
      // assignment for comma-separated declarations, but it's still correct
      // since the assignment is just redundant.
      return false;
    }
    const exportedName = this.importProcessor.resolveExportBinding(
      this.tokens.identifierNameForToken(identifierToken),
    );
    if (!exportedName) {
      return false;
    }
    this.tokens.copyToken();
    this.tokens.appendCode(` exports.${exportedName} =`);
    return true;
  }

  private processExportDefault(): void {
    if (
      this.tokens.matches4(tt._export, tt._default, tt._function, tt.name) ||
      // export default aysnc function
      this.tokens.matches5(tt._export, tt._default, tt.name, tt._function, tt.name)
    ) {
      this.tokens.removeInitialToken();
      this.tokens.removeToken();
      // Named function export case: change it to a top-level function
      // declaration followed by exports statement.
      const name = this.processNamedFunction();
      this.tokens.appendCode(` exports.default = ${name};`);
    } else if (
      this.tokens.matches4(tt._export, tt._default, tt._class, tt.name) ||
      this.tokens.matches5(tt._export, tt._default, tt._abstract, tt._class, tt.name)
    ) {
      this.tokens.removeInitialToken();
      this.tokens.removeToken();
      if (this.tokens.matches1(tt._abstract)) {
        this.tokens.removeToken();
      }
      const name = this.rootTransformer.processNamedClass();
      this.tokens.appendCode(` exports.default = ${name};`);
    } else if (this.tokens.matches3(tt._export, tt._default, tt.at)) {
      throw new Error("Export default statements with decorators are not yet supported.");
    } else {
      this.tokens.replaceToken("exports.");
      this.tokens.copyToken();
      this.tokens.appendCode(" =");
    }
  }

  /**
   * Transform a declaration like `export var`, `export let`, or `export const`.
   */
  private processExportVar(): void {
    if (this.isSimpleExportVar()) {
      this.processSimpleExportVar();
    } else {
      this.processComplexExportVar();
    }
  }

  /**
   * Determine if the export is of the form:
   * export var/let/const [varName] = [expr];
   * In other words, determine if function name inference might apply.
   */
  private isSimpleExportVar(): boolean {
    let tokenIndex = this.tokens.currentIndex();
    // export
    tokenIndex++;
    // var/let/const
    tokenIndex++;
    if (!this.tokens.matchesAtIndex(tokenIndex, [tt.name])) {
      return false;
    }
    tokenIndex++;
    while (tokenIndex < this.tokens.tokens.length && this.tokens.tokens[tokenIndex].isType) {
      tokenIndex++;
    }
    if (!this.tokens.matchesAtIndex(tokenIndex, [tt.eq])) {
      return false;
    }
    return true;
  }

  /**
   * Transform an `export var` declaration initializing a single variable.
   *
   * For example, this:
   * export const f = () => {};
   * becomes this:
   * const f = () => {}; exports.f = f;
   *
   * The variable is unused (e.g. exports.f has the true value of the export).
   * We need to produce an assignment of this form so that the function will
   * have an inferred name of "f", which wouldn't happen in the more general
   * case below.
   */
  private processSimpleExportVar(): void {
    // export
    this.tokens.removeInitialToken();
    // var/let/const
    this.tokens.copyToken();
    const varName = this.tokens.identifierName();
    // x: number  ->  x
    while (!this.tokens.matches1(tt.eq)) {
      this.rootTransformer.processToken();
    }
    const endIndex = this.tokens.currentToken().rhsEndIndex;
    if (endIndex == null) {
      throw new Error("Expected = token with an end index.");
    }
    while (this.tokens.currentIndex() < endIndex) {
      this.rootTransformer.processToken();
    }
    this.tokens.appendCode(`; exports.${varName} = ${varName}`);
  }

  /**
   * Transform normal declaration exports, including handling destructuring.
   * For example, this:
   * export const {x: [a = 2, b], c} = d;
   * becomes this:
   * ({x: [exports.a = 2, exports.b], c: exports.c} = d;)
   */
  private processComplexExportVar(): void {
    this.tokens.removeInitialToken();
    this.tokens.removeToken();
    const needsParens = this.tokens.matches1(tt.braceL);
    if (needsParens) {
      this.tokens.appendCode("(");
    }

    let depth = 0;
    while (true) {
      if (
        this.tokens.matches1(tt.braceL) ||
        this.tokens.matches1(tt.dollarBraceL) ||
        this.tokens.matches1(tt.bracketL)
      ) {
        depth++;
        this.tokens.copyToken();
      } else if (this.tokens.matches1(tt.braceR) || this.tokens.matches1(tt.bracketR)) {
        depth--;
        this.tokens.copyToken();
      } else if (
        depth === 0 &&
        !this.tokens.matches1(tt.name) &&
        !this.tokens.currentToken().isType
      ) {
        break;
      } else if (this.tokens.matches1(tt.eq)) {
        // Default values might have assignments in the RHS that we want to ignore, so skip past
        // them.
        const endIndex = this.tokens.currentToken().rhsEndIndex;
        if (endIndex == null) {
          throw new Error("Expected = token with an end index.");
        }
        while (this.tokens.currentIndex() < endIndex) {
          this.rootTransformer.processToken();
        }
      } else {
        const token = this.tokens.currentToken();
        if (isDeclaration(token)) {
          const name = this.tokens.identifierName();
          let replacement = this.importProcessor.getIdentifierReplacement(name);
          if (replacement === null) {
            throw new Error(`Expected a replacement for ${name} in \`export var\` syntax.`);
          }
          if (
            token.identifierRole === IdentifierRole.ObjectShorthandBlockScopedDeclaration ||
            token.identifierRole === IdentifierRole.ObjectShorthandFunctionScopedDeclaration
          ) {
            replacement = `${name}: ${replacement}`;
          }
          this.tokens.replaceToken(replacement);
        } else {
          this.rootTransformer.processToken();
        }
      }
    }

    if (needsParens) {
      // Seek to the end of the RHS.
      const endIndex = this.tokens.currentToken().rhsEndIndex;
      if (endIndex == null) {
        throw new Error("Expected = token with an end index.");
      }
      while (this.tokens.currentIndex() < endIndex) {
        this.rootTransformer.processToken();
      }
      this.tokens.appendCode(")");
    }
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
    if (this.tokens.matches1(tt._function)) {
      this.tokens.copyToken();
    } else if (this.tokens.matches2(tt.name, tt._function)) {
      if (!this.tokens.matchesContextual(ContextualKeyword._async)) {
        throw new Error("Expected async keyword in function export.");
      }
      this.tokens.copyToken();
      this.tokens.copyToken();
    }
    if (this.tokens.matches1(tt.star)) {
      this.tokens.copyToken();
    }
    if (!this.tokens.matches1(tt.name)) {
      throw new Error("Expected identifier for exported function name.");
    }
    const name = this.tokens.identifierName();
    this.tokens.copyToken();
    if (this.tokens.currentToken().isType) {
      this.tokens.removeInitialToken();
      while (this.tokens.currentToken().isType) {
        this.tokens.removeToken();
      }
    }
    this.tokens.copyExpectedToken(tt.parenL);
    this.rootTransformer.processBalancedCode();
    this.tokens.copyExpectedToken(tt.parenR);
    this.rootTransformer.processPossibleTypeRange();
    this.tokens.copyExpectedToken(tt.braceL);
    this.rootTransformer.processBalancedCode();
    this.tokens.copyExpectedToken(tt.braceR);
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
    if (this.tokens.matches1(tt._abstract)) {
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
      const localName = this.tokens.identifierName();
      let exportedName;
      this.tokens.removeToken();
      if (this.tokens.matchesContextual(ContextualKeyword._as)) {
        this.tokens.removeToken();
        exportedName = this.tokens.identifierName();
        this.tokens.removeToken();
      } else {
        exportedName = localName;
      }
      const newLocalName = this.importProcessor.getIdentifierReplacement(localName);
      exportStatements.push(`exports.${exportedName} = ${newLocalName || localName};`);

      if (this.tokens.matches1(tt.braceR)) {
        this.tokens.removeToken();
        break;
      }
      if (this.tokens.matches2(tt.comma, tt.braceR)) {
        this.tokens.removeToken();
        this.tokens.removeToken();
        break;
      } else if (this.tokens.matches1(tt.comma)) {
        this.tokens.removeToken();
      } else {
        throw new Error(`Unexpected token: ${JSON.stringify(this.tokens.currentToken())}`);
      }
    }

    if (this.tokens.matchesContextual(ContextualKeyword._from)) {
      // This is an export...from, so throw away the normal named export code
      // and use the Object.defineProperty code from ImportProcessor.
      this.tokens.removeToken();
      const path = this.tokens.stringValue();
      this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(path));
    } else {
      // This is a normal named export, so use that.
      this.tokens.appendCode(exportStatements.join(" "));
    }

    if (this.tokens.matches1(tt.semi)) {
      this.tokens.removeToken();
    }
  }

  private processExportStar(): void {
    this.tokens.removeInitialToken();
    while (!this.tokens.matches1(tt.string)) {
      this.tokens.removeToken();
    }
    const path = this.tokens.stringValue();
    this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(path));
    if (this.tokens.matches1(tt.semi)) {
      this.tokens.removeToken();
    }
  }
}
