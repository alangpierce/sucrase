import { NameManager } from './NameManager';
import TokenProcessor from './tokens';

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
  private importInfoByPath: {[path: string]: ImportInfo} = {};
  private importsToReplace: {[path: string]: string} = {};
  private identifierReplacements: {[identifier: string]: string} = {};

  constructor(readonly nameManager: NameManager, readonly tokens: TokenProcessor) {
  }

  preprocessTokens(interopRequireWildcardName: string, interopRequireDefaultName: string) {
    for (let i = 0; i < this.tokens.tokens.length; i++) {
      if (this.tokens.tokens[i].type.label === 'import') {
        this.preprocessImportAtIndex(i);
      }
    }

    for (const path of Object.keys(this.importInfoByPath)) {
      const {defaultNames, wildcardNames, namedImports} = this.importInfoByPath[path];

      if (defaultNames.length === 0 && wildcardNames.length === 0 && namedImports.length === 0) {
        this.importsToReplace[path] = `require('${path}');`;
      } else {
        const primaryImportName = this.getFreeIdentifierForPath(path);
        const secondaryImportName = wildcardNames.length > 0
          ? wildcardNames[0]
          : this.getFreeIdentifierForPath(path);
        let requireCode = `var ${primaryImportName} = require('${path}');`;
        if (wildcardNames.length > 0) {
          for (const wildcardName of wildcardNames) {
            requireCode += ` var ${wildcardName} = ${interopRequireWildcardName}(${primaryImportName});`;
          }
        } else if (defaultNames.length > 0) {
          requireCode += ` var ${secondaryImportName} = ${interopRequireDefaultName}(${primaryImportName});`;
        }
        this.importsToReplace[path] = requireCode;

        for (const defaultName of defaultNames) {
          this.identifierReplacements[defaultName] = `${secondaryImportName}.default`;
        }
        for (const {importedName, localName} of namedImports) {
          this.identifierReplacements[localName] = `${primaryImportName}.${importedName}`;
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
        if (this.tokens.matchesAtIndex(index, [','])) {
          index++;
        } else if (this.tokens.matchesAtIndex(index, ['}'])) {
          index++;
          break;
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
    if (!this.importInfoByPath[path]) {
      this.importInfoByPath[path] = {
        defaultNames: [],
        wildcardNames: [],
        namedImports: [],
      };
    }
    this.importInfoByPath[path].defaultNames.push(...defaultNames);
    this.importInfoByPath[path].wildcardNames.push(...wildcardNames);
    this.importInfoByPath[path].namedImports.push(...namedImports);
  }

  /**
   * Return the code to use for the import for this path, or the empty string if
   * the code has already been "claimed" by a previous import.
   */
  claimImportCode(importPath: string): string {
    const result = this.importsToReplace[importPath];
    this.importsToReplace[importPath] = '';
    return result;
  }

  getIdentifierReplacement(identifierName: string): string | null {
    return this.identifierReplacements[identifierName] || null;
  }
}
