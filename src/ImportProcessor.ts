import NameManager from "./NameManager";
import TokenProcessor from "./TokenProcessor";
import isMaybePropertyName from "./util/isMaybePropertyName";

type NamedImport = {
  importedName: string;
  localName: string;
};

type ImportInfo = {
  defaultNames: Array<string>;
  wildcardNames: Array<string>;
  namedImports: Array<NamedImport>;
  namedExports: Array<NamedImport>;
  hasBareImport: boolean;
  exportStarNames: Array<string>;
  hasStarExport: boolean;
};

/**
 * Class responsible for preprocessing and bookkeeping import and export declarations within the
 * file.
 *
 * TypeScript uses a simpler mechanism that does not use functions like interopRequireDefault and
 * interopRequireWildcard, so we also allow that mode for compatibility.
 */
export default class ImportProcessor {
  private importInfoByPath: Map<string, ImportInfo> = new Map();
  private importsToReplace: Map<string, string> = new Map();
  private identifierReplacements: Map<string, string> = new Map();
  private exportBindingsByLocalName: Map<string, string> = new Map();

  private interopRequireWildcardName: string;
  private interopRequireDefaultName: string;

  constructor(
    readonly nameManager: NameManager,
    readonly tokens: TokenProcessor,
    readonly isTypeScript: boolean,
  ) {}

  getPrefixCode(): string {
    if (this.isTypeScript) {
      return "";
    }
    let prefix = "";
    prefix += `
      function ${this.interopRequireWildcardName}(obj) {
        if (obj && obj.__esModule) {
          return obj;
        } else {
          var newObj = {};
          if (obj != null) {
            for (var key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key))
                newObj[key] = obj[key];
              }
            }
          newObj.default = obj;
          return newObj;
        }
      }`.replace(/\s+/g, " ");
    prefix += `
      function ${this.interopRequireDefaultName}(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }`.replace(/\s+/g, " ");
    return prefix;
  }

  preprocessTokens(): void {
    if (!this.isTypeScript) {
      this.interopRequireWildcardName = this.nameManager.claimFreeName("_interopRequireWildcard");
      this.interopRequireDefaultName = this.nameManager.claimFreeName("_interopRequireDefault");
    }

    for (let i = 0; i < this.tokens.tokens.length; i++) {
      if (isMaybePropertyName(this.tokens, i)) {
        continue;
      }

      if (this.tokens.matchesAtIndex(i, ["import"])) {
        this.preprocessImportAtIndex(i);
      }
      if (this.tokens.matchesAtIndex(i, ["export"])) {
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
    const nonTypeIdentifiers: Set<string> = new Set();
    for (const token of this.tokens.tokens) {
      if (
        token.type.label === "name" &&
        token.contextName !== "type" &&
        token.contextName !== "import"
      ) {
        nonTypeIdentifiers.add(token.value);
      }
    }
    for (const [path, importInfo] of this.importInfoByPath.entries()) {
      if (importInfo.hasBareImport) {
        continue;
      }
      const names = [
        ...importInfo.defaultNames,
        ...importInfo.wildcardNames,
        ...importInfo.namedImports.map(({localName}) => localName),
      ];
      if (names.every((name) => !nonTypeIdentifiers.has(name))) {
        this.importsToReplace.set(path, "");
      }
    }
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
      if (this.isTypeScript) {
        secondaryImportName = primaryImportName;
      } else {
        secondaryImportName =
          wildcardNames.length > 0 ? wildcardNames[0] : this.getFreeIdentifierForPath(path);
      }
      let requireCode = `var ${primaryImportName} = require('${path}');`;
      if (wildcardNames.length > 0) {
        for (const wildcardName of wildcardNames) {
          const moduleExpr = this.isTypeScript
            ? primaryImportName
            : `${this.interopRequireWildcardName}(${primaryImportName})`;
          requireCode += ` var ${wildcardName} = ${moduleExpr};`;
        }
      } else if (exportStarNames.length > 0 && secondaryImportName !== primaryImportName) {
        requireCode += ` var ${secondaryImportName} = ${
          this.interopRequireWildcardName
        }(${primaryImportName});`;
      } else if (defaultNames.length > 0 && secondaryImportName !== primaryImportName) {
        requireCode += ` var ${secondaryImportName} = ${
          this.interopRequireDefaultName
        }(${primaryImportName});`;
      }

      for (const {importedName, localName} of namedExports) {
        requireCode += ` Object.defineProperty(exports, '${localName}', \
{enumerable: true, get: () => ${primaryImportName}.${importedName}});`;
      }
      for (const exportStarName of exportStarNames) {
        requireCode += ` exports.${exportStarName} = ${secondaryImportName};`;
      }
      if (hasStarExport) {
        requireCode += ` Object.keys(${primaryImportName}).filter(key => \
key !== 'default' && key !== '__esModule').forEach(key => { \
Object.defineProperty(exports, key, {enumerable: true, \
get: () => ${primaryImportName}[key]}); });`;
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
      (this.tokens.matchesNameAtIndex(index, "type") ||
        this.tokens.matchesAtIndex(index, ["typeof"])) &&
      !this.tokens.matchesAtIndex(index + 1, [","]) &&
      !this.tokens.matchesNameAtIndex(index + 1, "from")
    ) {
      // import type declaration, so no need to process anything.
      return;
    }

    if (this.tokens.matchesAtIndex(index, ["name"])) {
      defaultNames.push(this.tokens.tokens[index].value);
      index++;
      if (this.tokens.matchesAtIndex(index, [","])) {
        index++;
      }
    }

    if (this.tokens.matchesAtIndex(index, ["*"])) {
      // * as
      index += 2;
      wildcardNames.push(this.tokens.tokens[index].value);
      index++;
    }

    if (this.tokens.matchesAtIndex(index, ["{"])) {
      index++;
      ({newIndex: index, namedImports} = this.getNamedImports(index));
    }

    if (this.tokens.matchesNameAtIndex(index, "from")) {
      index++;
    }

    if (!this.tokens.matchesAtIndex(index, ["string"])) {
      throw new Error("Expected string token at the end of import statement.");
    }
    const path = this.tokens.tokens[index].value;
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
      this.tokens.matchesAtIndex(index, ["export", "var"]) ||
      this.tokens.matchesAtIndex(index, ["export", "let"]) ||
      this.tokens.matchesAtIndex(index, ["export", "const"]) ||
      this.tokens.matchesAtIndex(index, ["export", "function"]) ||
      this.tokens.matchesAtIndex(index, ["export", "class"])
    ) {
      const exportName = this.tokens.tokens[index + 2].value;
      this.exportBindingsByLocalName.set(exportName, exportName);
    } else if (this.tokens.matchesAtIndex(index, ["export", "name", "function"])) {
      const exportName = this.tokens.tokens[index + 3].value;
      this.exportBindingsByLocalName.set(exportName, exportName);
    } else if (this.tokens.matchesAtIndex(index, ["export", "{"])) {
      this.preprocessNamedExportAtIndex(index);
    } else if (this.tokens.matchesAtIndex(index, ["export", "*"])) {
      this.preprocessExportStarAtIndex(index);
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

    if (this.tokens.matchesNameAtIndex(index, "from")) {
      index++;
    } else {
      // Reinterpret "a as b" to be local/exported rather than imported/local.
      for (const {importedName: localName, localName: exportedName} of namedImports) {
        this.exportBindingsByLocalName.set(localName, exportedName);
      }
      return;
    }

    if (!this.tokens.matchesAtIndex(index, ["string"])) {
      throw new Error("Expected string token at the end of import statement.");
    }
    const path = this.tokens.tokens[index].value;
    const importInfo = this.getImportInfo(path);
    importInfo.namedExports.push(...namedImports);
  }

  private preprocessExportStarAtIndex(index: number): void {
    let exportedName = null;
    if (this.tokens.matchesAtIndex(index, ["export", "*", "as"])) {
      // export * as
      index += 3;
      exportedName = this.tokens.tokens[index].value;
      // foo from
      index += 2;
    } else {
      // export * from
      index += 3;
    }
    if (!this.tokens.matchesAtIndex(index, ["string"])) {
      throw new Error("Expected string token at the end of star export statement.");
    }
    const path = this.tokens.tokens[index].value;
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
      // Flow type imports should just be ignored.
      let isTypeImport = false;
      if (
        (this.tokens.matchesNameAtIndex(index, "type") ||
          this.tokens.matchesAtIndex(index, ["typeof"])) &&
        this.tokens.matchesAtIndex(index + 1, ["name"]) &&
        !this.tokens.matchesNameAtIndex(index + 1, "as")
      ) {
        isTypeImport = true;
        index++;
      }

      const importedName = this.tokens.tokens[index].value;
      let localName;
      index++;
      if (this.tokens.matchesNameAtIndex(index, "as")) {
        index++;
        localName = this.tokens.tokens[index].value;
        index++;
      } else {
        localName = importedName;
      }
      if (!isTypeImport) {
        namedImports.push({importedName, localName});
      }
      if (this.tokens.matchesAtIndex(index, [",", "}"])) {
        index += 2;
        break;
      } else if (this.tokens.matchesAtIndex(index, ["}"])) {
        index++;
        break;
      } else if (this.tokens.matchesAtIndex(index, [","])) {
        index++;
      } else {
        throw new Error(`Unexpected token: ${JSON.stringify(this.tokens.currentToken())}`);
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

  resolveExportBinding(assignedName: string): string | null {
    return this.exportBindingsByLocalName.get(assignedName) || null;
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
