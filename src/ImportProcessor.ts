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
      if (this.tokens.matchesAtIndex(i, ['import']) &&
          !isMaybePropertyName(this.tokens, i)) {
        this.preprocessImportAtIndex(i);
      }
    }

    for (const [path, {defaultNames, wildcardNames, namedImports}] of this.importInfoByPath.entries()) {
      if (defaultNames.length === 0 && wildcardNames.length === 0 && namedImports.length === 0) {
        this.importsToReplace.set(path, `require('${path}');`);
      } else {
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
        this.importsToReplace.set(path, requireCode);

        for (const defaultName of defaultNames) {
          this.identifierReplacements.set(defaultName, `${secondaryImportName}.default`);
        }
        for (const {importedName, localName} of namedImports) {
          this.identifierReplacements.set(localName, `${primaryImportName}.${importedName}`);
        }
      }
    }
  }

  getFreeIdentifierForPath(path: string): string {
    const components = path.split('/');
    const lastComponent = components[components.length - 1];
    const baseName = lastComponent.replace(/\W/g, '');
    return this.nameManager.claimFreeName(`_${baseName}`);
  }

  preprocessImportAtIndex(index: number) {
    let defaultNames = [];
    let wildcardNames = [];
    let namedImports = [];

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
    }

    if (this.tokens.matchesNameAtIndex(index, 'from')) {
      index++;
    }

    if (!this.tokens.matchesAtIndex(index, ['string'])) {
      throw new Error('Expected string token at the end of import statement.');
    }
    const path = this.tokens.tokens[index].value;
    let importInfo = this.importInfoByPath.get(path);
    if (!importInfo) {
      importInfo = {
        defaultNames: [],
        wildcardNames: [],
        namedImports: [],
      };
      this.importInfoByPath.set(path, importInfo);
    }
    importInfo.defaultNames.push(...defaultNames);
    importInfo.wildcardNames.push(...wildcardNames);
    importInfo.namedImports.push(...namedImports);
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
