import { Transformer } from './transformer';
import { RootTransformer } from './index';
import TokenProcessor, { Token } from './tokens';
import { ImportProcessor } from './ImportProcessor';
import { NameManager } from './NameManager';

export default class ImportTransformer implements Transformer {
  private hadExport: boolean = false;

  private readonly nameManager: NameManager;
  private readonly importProcessor: ImportProcessor;
  private interopRequireWildcardName: string;
  private interopRequireDefaultName: string;

  constructor(readonly rootTransformer: RootTransformer, readonly tokens: TokenProcessor) {
    this.nameManager = new NameManager(this.tokens);
    this.importProcessor = new ImportProcessor(this.nameManager, tokens);
  }

  preprocess(): void {
    this.nameManager.preprocessNames(this.tokens.tokens);
    this.interopRequireWildcardName = this.nameManager.claimFreeName('_interopRequireWildcard');
    this.interopRequireDefaultName = this.nameManager.claimFreeName('_interopRequireDefault');
    this.importProcessor.preprocessTokens(
      this.interopRequireWildcardName, this.interopRequireDefaultName
    );
  }

  getPrefixCode(): string {
    let prefix = "'use strict';";
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
    if (this.hadExport) {
      prefix += 'Object.defineProperty(exports, "__esModule", {value: true});';
    }
    return prefix;
  }

  process(): boolean {
    if (this.tokens.matches(['import'])) {
      this.processImport();
      return true;
    }
    if (this.tokens.matches(['export'])) {
      this.hadExport = true;
      this.processExport();
      return true;
    }
    return false;
  }

  /**
   * Transform this:
   * import foo, {bar} from 'baz';
   * into
   * var _baz = require('baz'); var _baz2 = _interopRequireDefault(_baz);
   *
   * and capture the renevant
   */
  processImport() {
    this.tokens.removeInitialToken();
    while (!this.tokens.matches(['string'])) {
      this.tokens.removeToken();
    }
    const path = this.tokens.currentToken().value;
    this.tokens.replaceTokenTrimmingLeftWhitespace(
      this.importProcessor.claimImportCode(path)
    );
    if (this.tokens.matches([';'])) {
      this.tokens.removeToken();
    }
  }

  processExport() {
    if (this.tokens.matches(['export', 'default'])) {
      this.processExportDefault();
    } else if (
      this.tokens.matches(['export', 'var']) ||
      this.tokens.matches(['export', 'let']) ||
      this.tokens.matches(['export', 'const'])
    ) {
      this.processExportVar();
    } else if (
      this.tokens.matches(['export', 'function']) ||
      this.tokens.matches(['export', 'name', 'function'])
    ) {
      this.processExportFunction();
    } else if (this.tokens.matches(['export', 'class'])) {
      this.processExportClass();
    } else {
      throw new Error('Unrecognized export syntax.');
    }
  }

  processExportDefault() {
    this.tokens.replaceToken('exports.');
    this.tokens.copyToken();
    this.tokens.appendCode(' =');
  }

  /**
   * Transform this:
   * export const x = 1;
   * into this:
   * const x = exports.x = 1;
   */
  processExportVar() {
    this.tokens.replaceToken('');
    this.tokens.copyToken();
    if (!this.tokens.matches(['name'])) {
      throw new Error('Expected a regular identifier after export var/let/const.');
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
  processExportFunction() {
    this.tokens.replaceToken('');
    if (this.tokens.matches(['function'])) {
      this.tokens.copyToken();
    } else if (this.tokens.matches(['name', 'function'])) {
      if (this.tokens.currentToken().value !== 'async') {
        throw new Error('Expected async keyword in function export.');
      }
      this.tokens.copyToken();
      this.tokens.copyToken();
    }
    if (!this.tokens.matches(['name'])) {
      throw new Error('Expected identifier for exported function name.');
    }
    const name = this.tokens.currentToken().value;
    this.tokens.copyToken();
    this.tokens.copyExpectedToken('(');
    this.rootTransformer.processBalancedCode();
    this.tokens.copyExpectedToken(')');
    this.tokens.copyExpectedToken('{');
    this.rootTransformer.processBalancedCode();
    this.tokens.copyExpectedToken('}');
    this.tokens.appendCode(` exports.${name} = ${name};`);
  }

  /**
   * Transform this:
   * export class A {}
   * into this:
   * class A {} exports.A = A;
   */
  processExportClass() {
    this.tokens.replaceToken('');
    this.tokens.copyExpectedToken('class');
    if (!this.tokens.matches(['name'])) {
      throw new Error('Expected identifier for exported function name.');
    }
    const name = this.tokens.currentToken().value;
    this.tokens.copyToken();
    // Don't support "extends" for now. That requires smarter expression parsing
    // to handle cases like `export class A extends b(<Foo />) {}`.
    this.tokens.copyExpectedToken('{');
    this.rootTransformer.processBalancedCode();
    this.tokens.copyExpectedToken('}');
    this.tokens.appendCode(` exports.${name} = ${name};`);
  }
}
