import { NameManager } from './NameManager';
import TokenProcessor from './tokens';
import isMaybePropertyName from './util/isMaybePropertyName';

type NamedImport = {
  importedName: string;
  localName: string;
}

type ImportInfo = {
  defaultNames: Array<string>;
  wildcardNames: Array<string>;
  namedImports: Array<NamedImport>;
  namedExports: Array<NamedImport>;
  hasStarExport: boolean;
}

export class ImportProcessor {
  private importInfoByPath: Map<string, ImportInfo> = new Map();
  private importsToReplace: Map<string, string> = new Map();
  private identifierReplacements: Map<string, string> = new Map();

  private interopRequireWildcardName: string;
  private interopRequireDefaultName: string;

  constructor(readonly nameManager: NameManager, readonly tokens: TokenProcessor) {
  }

  getPrefixCode() {
    let prefix = '';
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
      }`.replace(/\s+/g, ' ');
    prefix += `
      function ${this.interopRequireDefaultName}(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }`.replace(/\s+/g, ' ');
    return prefix;
  }

  preprocessTokens() {
    this.interopRequireWildcardName = this.nameManager.claimFreeName('_interopRequireWildcard');
    this.interopRequireDefaultName = this.nameManager.claimFreeName('_interopRequireDefault');

    for (let i = 0; i < this.tokens.tokens.length; i++) {
      if (isMaybePropertyName(this.tokens, i)) {
        continue;
      }

      if (this.tokens.matchesAtIndex(i, ['import'])) {
        this.preprocessImportAtIndex(i);
      }
      // export...from syntax is basically import syntax, so we handle it here as well.
      if (this.tokens.matchesAtIndex(i, ['export', '{'])) {
        this.preprocessNamedExportAtIndex(i);
      }
      if (this.tokens.matchesAtIndex(i, ['export', '*'])) {
        this.preprocessStarExportAtIndex(i);
      }
    }
    this.generateImportReplacements();
  }

  private generateImportReplacements() {
    for (const [path, importInfo] of this.importInfoByPath.entries()) {
      const {defaultNames, wildcardNames, namedImports, namedExports, hasStarExport} = importInfo;

      if (defaultNames.length === 0 && wildcardNames.length === 0 && namedImports.length === 0 && namedExports.length === 0 && !hasStarExport) {
        // Import is never used, so don't even assign a name.
        this.importsToReplace.set(path, `require('${path}');`);
        continue;
      }

      const primaryImportName = this.getFreeIdentifierForPath(path);
      const secondaryImportName = wildcardNames.length > 0
        ? wildcardNames[0]
        : this.getFreeIdentifierForPath(path);
      let requireCode = `var ${primaryImportName} = require('${path}');`;
      if (wildcardNames.length > 0) {
        for (const wildcardName of wildcardNames) {
          requireCode += ` var ${wildcardName} = ${this.interopRequireWildcardName}(${primaryImportName});`;
        }
      } else if (defaultNames.length > 0) {
        requireCode += ` var ${secondaryImportName} = ${this.interopRequireDefaultName}(${primaryImportName});`;
      }

      for (const {importedName, localName} of namedExports) {
        requireCode += ` Object.defineProperty(exports, '${localName}', {enumerable: true, get: () => ${primaryImportName}.${importedName}});`;
      }
      if (hasStarExport) {
        requireCode += ` Object.keys(${primaryImportName}).filter(key => key !== 'default' && key !== '__esModule').forEach(key => { Object.defineProperty(exports, key, {enumerable: true, get: () => ${primaryImportName}[key]}); });`;
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
    const components = path.split('/');
    const lastComponent = components[components.length - 1];
    const baseName = lastComponent.replace(/\W/g, '');
    return this.nameManager.claimFreeName(`_${baseName}`);
  }

  private preprocessImportAtIndex(index: number) {
    let defaultNames: Array<string> = [];
    let wildcardNames: Array<string> = [];
    let namedImports: Array<NamedImport> = [];

    index++;
    if (this.tokens.matchesAtIndex(index, ['name'])) {
      defaultNames.push(this.tokens.tokens[index].value);
      index++;
      if (this.tokens.matchesAtIndex(index, [','])) {
        index++;
      }
    }

    if (this.tokens.matchesAtIndex(index, ['*'])) {
      // * as
      index += 2;
      wildcardNames.push(this.tokens.tokens[index].value);
      index++;
    }

    if (this.tokens.matchesAtIndex(index, ['{'])) {
      index++;
      ({newIndex: index, namedImports} = this.getNamedImports(index));
    }

    if (this.tokens.matchesNameAtIndex(index, 'from')) {
      index++;
    }

    if (!this.tokens.matchesAtIndex(index, ['string'])) {
      throw new Error('Expected string token at the end of import statement.');
    }
    const path = this.tokens.tokens[index].value;
    const importInfo = this.getImportInfo(path);
    importInfo.defaultNames.push(...defaultNames);
    importInfo.wildcardNames.push(...wildcardNames);
    importInfo.namedImports.push(...namedImports);
  }

  /**
   * Walk this export statement just in case it's an export...from statement.
   * If it is, combine it into the import info for that path. Otherwise, just
   * bail out; it'll be handled later.
   */
  private preprocessNamedExportAtIndex(index: number) {
    // export {
    index += 2;
    const {newIndex, namedImports} = this.getNamedImports(index);
    index = newIndex;

    if (this.tokens.matchesNameAtIndex(index, 'from')) {
      index++;
    } else {
      // Not actually an export...from, so bail out.
      return;
    }

    if (!this.tokens.matchesAtIndex(index, ['string'])) {
      throw new Error('Expected string token at the end of import statement.');
    }
    const path = this.tokens.tokens[index].value;
    const importInfo = this.getImportInfo(path);
    importInfo.namedExports.push(...namedImports);
  }

  private preprocessStarExportAtIndex(index: number) {
    // export * from
    index += 3;
    if (!this.tokens.matchesAtIndex(index, ['string'])) {
      throw new Error('Expected string token at the end of star export statement.');
    }
    const path = this.tokens.tokens[index].value;
    let importInfo = this.getImportInfo(path)
    importInfo.hasStarExport = true;
  }

  private getNamedImports(index: number): {newIndex: number, namedImports: Array<NamedImport>} {
    const namedImports = [];
    while (true) {
      const importedName = this.tokens.tokens[index].value;
      let localName;
      index++;
      if (this.tokens.matchesNameAtIndex(index, 'as')) {
        index++;
        localName = this.tokens.tokens[index].value;
        index++;
      } else {
        localName = importedName;
      }
      namedImports.push({ importedName, localName });
      if (this.tokens.matchesAtIndex(index, [',', '}'])) {
        index += 2;
        break;
      } else if (this.tokens.matchesAtIndex(index, ['}'])) {
        index++;
        break;
      } else if (this.tokens.matchesAtIndex(index, [','])) {
        index++;
      } else {
        throw new Error('Unexpected token.');
      }
    }
    return {newIndex: index, namedImports};
  }

  /**
   * Get a mutable import info object for this path, creating one if it doesn't
   * exist yet.
   */
  private getImportInfo(path: string) {
    const existingInfo = this.importInfoByPath.get(path);
    if (existingInfo) {
      return existingInfo;
    } else {
      const newInfo = {
        defaultNames: [],
        wildcardNames: [],
        namedImports: [],
        namedExports: [],
        hasStarExport: false,
      };
      this.importInfoByPath.set(path, newInfo);
      return newInfo;
    }
  }

  /**
   * Return the code to use for the import for this path, or the empty string if
   * the code has already been "claimed" by a previous import.
   */
  claimImportCode(importPath: string): string {
    const result = this.importsToReplace.get(importPath);
    this.importsToReplace.set(importPath, '');
    return result || '';
  }

  getIdentifierReplacement(identifierName: string): string | null {
    return this.identifierReplacements.get(identifierName) || null;
  }
}
