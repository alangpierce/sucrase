import { Transformer } from './transformer';
import { RootTransformer } from './index';
import TokenProcessor, { Token } from './tokens';

export default class ImportTransformer implements Transformer {
  private hadExport: boolean = false;
  private readonly usedNames: Set<string> = new Set();
  private interopRequireWildcardName: string;
  private interopRequireDefaultName: string;

  constructor(readonly rootTransformer: RootTransformer, readonly tokens: TokenProcessor) {
  }

  preprocess(tokens: Array<Token>): void {
    for (const token of tokens) {
      if (token.type.label === 'name') {
        this.usedNames.add(token.value);
      }
    }
    this.interopRequireWildcardName = this.claimFreeName('_interopRequireWildcard');
    this.interopRequireDefaultName = this.claimFreeName('_interopRequireDefault');
  }

  claimFreeName(name: string): string {
    const newName = this.findFreeName(name);
    this.usedNames.add(newName);
    return newName;
  }

  findFreeName(name: string): string {
    if (!this.usedNames.has(name)) {
      return name;
    }
    let suffixNum = 2;
    while (this.usedNames.has(name + suffixNum)) {
      suffixNum++;
    }
    return name + suffixNum;
  }

  process(): boolean {
    if (this.tokens.matches(['export'])) {
      this.hadExport = true;
      this.processExport();
      return true;
    }
    return false;
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
