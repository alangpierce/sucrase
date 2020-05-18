import type {HelperManager} from "./HelperManager";
import type {Options} from "./index";
import type NameManager from "./NameManager";
import {isDeclaration} from "./parser/tokenizer";
import {ContextualKeyword} from "./parser/tokenizer/keywords";
import {TokenType as tt} from "./parser/tokenizer/types";
import type TokenProcessor from "./TokenProcessor";
import {getNonTypeIdentifiers} from "./util/getNonTypeIdentifiers";

interface NamedImport {
  importedName: string;
  localName: string;
}

interface ImportInfo {
  defaultNames: Array<string>;
  wildcardNames: Array<string>;
  namedImports: Array<NamedImport>;
  namedExports: Array<NamedImport>;
  hasBareImport: boolean;
  exportStarNames: Array<string>;
  hasStarExport: boolean;
}

/**
 * Class responsible for preprocessing and bookkeeping import and export declarations within the
 * file.
 *
 * TypeScript uses a simpler mechanism that does not use functions like interopRequireDefault and
 * interopRequireWildcard, so we also allow that mode for compatibility.
 */
export default class CJSImportProcessor {
  private nonTypeIdentifiers: Set<string> = new Set();
  private importInfoByPath: Map<string, ImportInfo> = new Map();
  private importsToReplace: Map<string, string> = new Map();
  private identifierReplacements: Map<string, string> = new Map();
  private exportBindingsByLocalName: Map<string, Array<string>> = new Map();

  constructor(
    readonly nameManager: NameManager,
    readonly tokens: TokenProcessor,
    readonly enableLegacyTypeScriptModuleInterop: boolean,
    readonly options: Options,
    readonly isTypeScriptTransformEnabled: boolean,
    readonly helperManager: HelperManager,
  ) {}

  preprocessTokens(): void {
    for (let i = 0; i < this.tokens.tokens.length; i++) {
      if (
        this.tokens.matches1AtIndex(i, tt._import) &&
        !this.tokens.matches3AtIndex(i, tt._import, tt.name, tt.eq)
      ) {
        this.preprocessImportAtIndex(i);
      }
      if (
        this.tokens.matches1AtIndex(i, tt._export) &&
        !this.tokens.matches2AtIndex(i, tt._export, tt.eq)
      ) {
        this.preprocessExportAtIndex(i);
      }
    }
    this.generateImportReplacements();
  }

  /**
   * In TypeScript, import statements that only import types should be removed. This does not count
   * bare imports.
   */
  pruneTypeOnlyImports(): void {
    this.nonTypeIdentifiers = getNonTypeIdentifiers(this.tokens, this.options);
    for (const [path, importInfo] of this.importInfoByPath.entries()) {
      if (
        importInfo.hasBareImport ||
        importInfo.hasStarExport ||
        importInfo.exportStarNames.length > 0 ||
        importInfo.namedExports.length > 0
      ) {
        continue;
      }
      const names = [
        ...importInfo.defaultNames,
        ...importInfo.wildcardNames,
        ...importInfo.namedImports.map(({localName}) => localName),
      ];
      if (names.every((name) => this.isTypeName(name))) {
        this.importsToReplace.set(path, "");
      }
    }
  }

  isTypeName(name: string): boolean {
    return this.isTypeScriptTransformEnabled && !this.nonTypeIdentifiers.has(name);
  }

  private generateImportReplacements(): void {
    for (const [path, importInfo] of this.importInfoByPath.entries()) {
      const {
        defaultNames,
        wildcardNames,
        namedImports,
        namedExports,
        exportStarNames,
        hasStarExport,
      } = importInfo;

      if (
        defaultNames.length === 0 &&
        wildcardNames.length === 0 &&
        namedImports.length === 0 &&
        namedExports.length === 0 &&
        exportStarNames.length === 0 &&
        !hasStarExport
      ) {
        // Import is never used, so don't even assign a name.
        this.importsToReplace.set(path, `require('${path}');`);
        continue;
      }

      const primaryImportName = this.getFreeIdentifierForPath(path);
      let secondaryImportName;
      if (this.enableLegacyTypeScriptModuleInterop) {
        secondaryImportName = primaryImportName;
      } else {
        secondaryImportName =
          wildcardNames.length > 0 ? wildcardNames[0] : this.getFreeIdentifierForPath(path);
      }
      let requireCode = `var ${primaryImportName} = require('${path}');`;
      if (wildcardNames.length > 0) {
        for (const wildcardName of wildcardNames) {
          const moduleExpr = this.enableLegacyTypeScriptModuleInterop
            ? primaryImportName
            : `${this.helperManager.getHelperName("interopRequireWildcard")}(${primaryImportName})`;
          requireCode += ` var ${wildcardName} = ${moduleExpr};`;
        }
      } else if (exportStarNames.length > 0 && secondaryImportName !== primaryImportName) {
        requireCode += ` var ${secondaryImportName} = ${this.helperManager.getHelperName(
          "interopRequireWildcard",
        )}(${primaryImportName});`;
      } else if (defaultNames.length > 0 && secondaryImportName !== primaryImportName) {
        requireCode += ` var ${secondaryImportName} = ${this.helperManager.getHelperName(
          "interopRequireDefault",
        )}(${primaryImportName});`;
      }

      for (const {importedName, localName} of namedExports) {
        requireCode += ` ${this.helperManager.getHelperName(
          "createNamedExportFrom",
        )}(${primaryImportName}, '${localName}', '${importedName}');`;
      }
      for (const exportStarName of exportStarNames) {
        requireCode += ` exports.${exportStarName} = ${secondaryImportName};`;
      }
      if (hasStarExport) {
        requireCode += ` ${this.helperManager.getHelperName(
          "createStarExport",
        )}(${primaryImportName});`;
      }

      this.importsToReplace.set(path, requireCode);

      for (const defaultName of defaultNames) {
        this.identifierReplacements.set(defaultName, `${secondaryImportName}.default`);
      }
      for (const {importedName, localName} of namedImports) {
        this.identifierReplacements.set(localName, `${primaryImportName}.${importedName}`);
      }
    }
  }

  private getFreeIdentifierForPath(path: string): string {
    const components = path.split("/");
    const lastComponent = components[components.length - 1];
    const baseName = lastComponent.replace(/\W/g, "");
    return this.nameManager.claimFreeName(`_${baseName}`);
  }

  private preprocessImportAtIndex(index: number): void {
    const defaultNames: Array<string> = [];
    const wildcardNames: Array<string> = [];
    let namedImports: Array<NamedImport> = [];

    index++;
    if (
      (this.tokens.matchesContextualAtIndex(index, ContextualKeyword._type) ||
        this.tokens.matches1AtIndex(index, tt._typeof)) &&
      !this.tokens.matches1AtIndex(index + 1, tt.comma) &&
      !this.tokens.matchesContextualAtIndex(index + 1, ContextualKeyword._from)
    ) {
      // import type declaration, so no need to process anything.
      return;
    }

    if (this.tokens.matches1AtIndex(index, tt.parenL)) {
      // Dynamic import, so nothing to do
      return;
    }

    if (this.tokens.matches1AtIndex(index, tt.name)) {
      defaultNames.push(this.tokens.identifierNameAtIndex(index));
      index++;
      if (this.tokens.matches1AtIndex(index, tt.comma)) {
        index++;
      }
    }

    if (this.tokens.matches1AtIndex(index, tt.star)) {
      // * as
      index += 2;
      wildcardNames.push(this.tokens.identifierNameAtIndex(index));
      index++;
    }

    if (this.tokens.matches1AtIndex(index, tt.braceL)) {
      index++;
      ({newIndex: index, namedImports} = this.getNamedImports(index));
    }

    if (this.tokens.matchesContextualAtIndex(index, ContextualKeyword._from)) {
      index++;
    }

    if (!this.tokens.matches1AtIndex(index, tt.string)) {
      throw new Error("Expected string token at the end of import statement.");
    }
    const path = this.tokens.stringValueAtIndex(index);
    const importInfo = this.getImportInfo(path);
    importInfo.defaultNames.push(...defaultNames);
    importInfo.wildcardNames.push(...wildcardNames);
    importInfo.namedImports.push(...namedImports);
    if (defaultNames.length === 0 && wildcardNames.length === 0 && namedImports.length === 0) {
      importInfo.hasBareImport = true;
    }
  }

  private preprocessExportAtIndex(index: number): void {
    if (
      this.tokens.matches2AtIndex(index, tt._export, tt._var) ||
      this.tokens.matches2AtIndex(index, tt._export, tt._let) ||
      this.tokens.matches2AtIndex(index, tt._export, tt._const)
    ) {
      this.preprocessVarExportAtIndex(index);
    } else if (
      this.tokens.matches2AtIndex(index, tt._export, tt._function) ||
      this.tokens.matches2AtIndex(index, tt._export, tt._class)
    ) {
      const exportName = this.tokens.identifierNameAtIndex(index + 2);
      this.addExportBinding(exportName, exportName);
    } else if (this.tokens.matches3AtIndex(index, tt._export, tt.name, tt._function)) {
      const exportName = this.tokens.identifierNameAtIndex(index + 3);
      this.addExportBinding(exportName, exportName);
    } else if (this.tokens.matches2AtIndex(index, tt._export, tt.braceL)) {
      this.preprocessNamedExportAtIndex(index);
    } else if (this.tokens.matches2AtIndex(index, tt._export, tt.star)) {
      this.preprocessExportStarAtIndex(index);
    }
  }

  private preprocessVarExportAtIndex(index: number): void {
    let depth = 0;
    // Handle cases like `export let {x} = y;`, starting at the open-brace in that case.
    for (let i = index + 2; ; i++) {
      if (
        this.tokens.matches1AtIndex(i, tt.braceL) ||
        this.tokens.matches1AtIndex(i, tt.dollarBraceL) ||
        this.tokens.matches1AtIndex(i, tt.bracketL)
      ) {
        depth++;
      } else if (
        this.tokens.matches1AtIndex(i, tt.braceR) ||
        this.tokens.matches1AtIndex(i, tt.bracketR)
      ) {
        depth--;
      } else if (depth === 0 && !this.tokens.matches1AtIndex(i, tt.name)) {
        break;
      } else if (this.tokens.matches1AtIndex(1, tt.eq)) {
        const endIndex = this.tokens.currentToken().rhsEndIndex;
        if (endIndex == null) {
          throw new Error("Expected = token with an end index.");
        }
        i = endIndex - 1;
      } else {
        const token = this.tokens.tokens[i];
        if (isDeclaration(token)) {
          const exportName = this.tokens.identifierNameAtIndex(i);
          this.identifierReplacements.set(exportName, `exports.${exportName}`);
        }
      }
    }
  }

  /**
   * Walk this export statement just in case it's an export...from statement.
   * If it is, combine it into the import info for that path. Otherwise, just
   * bail out; it'll be handled later.
   */
  private preprocessNamedExportAtIndex(index: number): void {
    // export {
    index += 2;
    const {newIndex, namedImports} = this.getNamedImports(index);
    index = newIndex;

    if (this.tokens.matchesContextualAtIndex(index, ContextualKeyword._from)) {
      index++;
    } else {
      // Reinterpret "a as b" to be local/exported rather than imported/local.
      for (const {importedName: localName, localName: exportedName} of namedImports) {
        this.addExportBinding(localName, exportedName);
      }
      return;
    }

    if (!this.tokens.matches1AtIndex(index, tt.string)) {
      throw new Error("Expected string token at the end of import statement.");
    }
    const path = this.tokens.stringValueAtIndex(index);
    const importInfo = this.getImportInfo(path);
    importInfo.namedExports.push(...namedImports);
  }

  private preprocessExportStarAtIndex(index: number): void {
    let exportedName = null;
    if (this.tokens.matches3AtIndex(index, tt._export, tt.star, tt._as)) {
      // export * as
      index += 3;
      exportedName = this.tokens.identifierNameAtIndex(index);
      // foo from
      index += 2;
    } else {
      // export * from
      index += 3;
    }
    if (!this.tokens.matches1AtIndex(index, tt.string)) {
      throw new Error("Expected string token at the end of star export statement.");
    }
    const path = this.tokens.stringValueAtIndex(index);
    const importInfo = this.getImportInfo(path);
    if (exportedName !== null) {
      importInfo.exportStarNames.push(exportedName);
    } else {
      importInfo.hasStarExport = true;
    }
  }

  private getNamedImports(index: number): {newIndex: number; namedImports: Array<NamedImport>} {
    const namedImports = [];
    while (true) {
      if (this.tokens.matches1AtIndex(index, tt.braceR)) {
        index++;
        break;
      }

      // Flow type imports should just be ignored.
      let isTypeImport = false;
      if (
        (this.tokens.matchesContextualAtIndex(index, ContextualKeyword._type) ||
          this.tokens.matches1AtIndex(index, tt._typeof)) &&
        this.tokens.matches1AtIndex(index + 1, tt.name) &&
        !this.tokens.matchesContextualAtIndex(index + 1, ContextualKeyword._as)
      ) {
        isTypeImport = true;
        index++;
      }

      const importedName = this.tokens.identifierNameAtIndex(index);
      let localName;
      index++;
      if (this.tokens.matchesContextualAtIndex(index, ContextualKeyword._as)) {
        index++;
        localName = this.tokens.identifierNameAtIndex(index);
        index++;
      } else {
        localName = importedName;
      }
      if (!isTypeImport) {
        namedImports.push({importedName, localName});
      }
      if (this.tokens.matches2AtIndex(index, tt.comma, tt.braceR)) {
        index += 2;
        break;
      } else if (this.tokens.matches1AtIndex(index, tt.braceR)) {
        index++;
        break;
      } else if (this.tokens.matches1AtIndex(index, tt.comma)) {
        index++;
      } else {
        throw new Error(`Unexpected token: ${JSON.stringify(this.tokens.tokens[index])}`);
      }
    }
    return {newIndex: index, namedImports};
  }

  /**
   * Get a mutable import info object for this path, creating one if it doesn't
   * exist yet.
   */
  private getImportInfo(path: string): ImportInfo {
    const existingInfo = this.importInfoByPath.get(path);
    if (existingInfo) {
      return existingInfo;
    }
    const newInfo = {
      defaultNames: [],
      wildcardNames: [],
      namedImports: [],
      namedExports: [],
      hasBareImport: false,
      exportStarNames: [],
      hasStarExport: false,
    };
    this.importInfoByPath.set(path, newInfo);
    return newInfo;
  }

  private addExportBinding(localName: string, exportedName: string): void {
    if (!this.exportBindingsByLocalName.has(localName)) {
      this.exportBindingsByLocalName.set(localName, []);
    }
    this.exportBindingsByLocalName.get(localName)!.push(exportedName);
  }

  /**
   * Return the code to use for the import for this path, or the empty string if
   * the code has already been "claimed" by a previous import.
   */
  claimImportCode(importPath: string): string {
    const result = this.importsToReplace.get(importPath);
    this.importsToReplace.set(importPath, "");
    return result || "";
  }

  getIdentifierReplacement(identifierName: string): string | null {
    return this.identifierReplacements.get(identifierName) || null;
  }

  /**
   * Return a string like `exports.foo = exports.bar`.
   */
  resolveExportBinding(assignedName: string): string | null {
    const exportedNames = this.exportBindingsByLocalName.get(assignedName);
    if (!exportedNames || exportedNames.length === 0) {
      return null;
    }
    return exportedNames.map((exportedName) => `exports.${exportedName}`).join(" = ");
  }

  /**
   * Return all imported/exported names where we might be interested in whether usages of those
   * names are shadowed.
   */
  getGlobalNames(): Set<string> {
    return new Set([
      ...this.identifierReplacements.keys(),
      ...this.exportBindingsByLocalName.keys(),
    ]);
  }
}
