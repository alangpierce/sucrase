import {ContextualKeyword} from "../parser/tokenizer";
import {TokenType as tt} from "../parser/tokenizer/types";
import TokenProcessor from "../TokenProcessor";
import {getNonTypeIdentifiers} from "../util/getNonTypeIdentifiers";
import Transformer from "./Transformer";

/**
 * Class for editing import statements when we are keeping the code as ESM. We still need to remove
 * type-only imports in TypeScript and Flow.
 */
export default class ESMImportTransformer extends Transformer {
  private nonTypeIdentifiers: Set<string>;

  constructor(readonly tokens: TokenProcessor, readonly isTypeScriptTransformEnabled: boolean) {
    super();
    this.nonTypeIdentifiers = isTypeScriptTransformEnabled
      ? getNonTypeIdentifiers(tokens)
      : new Set();
  }

  process(): boolean {
    // TypeScript `import foo = require('foo');` should always just be translated to plain require.
    if (this.tokens.matches3(tt._import, tt.name, tt.eq)) {
      this.tokens.replaceToken("const");
      return true;
    }
    if (this.tokens.matches2(tt._export, tt.eq)) {
      this.tokens.replaceToken("module.exports");
      return true;
    }
    if (this.tokens.matches1(tt._import)) {
      return this.processImport();
    }
    return false;
  }

  private processImport(): boolean {
    if (this.tokens.matches2(tt._import, tt.parenL)) {
      // Dynamic imports don't need to be transformed.
      return false;
    }

    const snapshot = this.tokens.snapshot();
    const allImportsRemoved = this.removeTypeBindings();
    if (allImportsRemoved) {
      this.tokens.restoreToSnapshot(snapshot);
      while (!this.tokens.matches1(tt.string)) {
        this.tokens.removeToken();
      }
      this.tokens.removeToken();
      if (this.tokens.matches1(tt.semi)) {
        this.tokens.removeToken();
      }
    }
    return true;
  }

  /**
   * Remove type bindings from this import, leaving the rest of the import intact.
   *
   * Return true if this import was ONLY types, and thus is eligible for removal. This will bail out
   * of the replacement operation, so we can return early here.
   */
  private removeTypeBindings(): boolean {
    this.tokens.copyExpectedToken(tt._import);
    if (
      this.tokens.matchesContextual(ContextualKeyword._type) &&
      !this.tokens.matchesAtIndex(this.tokens.currentIndex() + 1, [tt.comma]) &&
      !this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, ContextualKeyword._from)
    ) {
      // This is an "import type" statement, so exit early.
      return true;
    }

    if (this.tokens.matches1(tt.string)) {
      // This is a bare import, so we should proceed with the import.
      this.tokens.copyToken();
      return false;
    }

    let foundNonTypeImport = false;

    if (this.tokens.matches1(tt.name)) {
      if (this.isTypeName(this.tokens.identifierName())) {
        this.tokens.removeToken();
        if (this.tokens.matches1(tt.comma)) {
          this.tokens.removeToken();
        }
      } else {
        foundNonTypeImport = true;
        this.tokens.copyToken();
        if (this.tokens.matches1(tt.comma)) {
          this.tokens.copyToken();
        }
      }
    }

    if (this.tokens.matches1(tt.star)) {
      if (this.isTypeName(this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 2))) {
        this.tokens.removeToken();
        this.tokens.removeToken();
        this.tokens.removeToken();
      } else {
        foundNonTypeImport = true;
        this.tokens.copyExpectedToken(tt.star);
        this.tokens.copyExpectedToken(tt.name);
        this.tokens.copyExpectedToken(tt.name);
      }
    } else if (this.tokens.matches1(tt.braceL)) {
      this.tokens.copyToken();
      while (!this.tokens.matches1(tt.braceR)) {
        if (
          this.tokens.matches3(tt.name, tt.name, tt.comma) ||
          this.tokens.matches3(tt.name, tt.name, tt.braceR)
        ) {
          // type foo
          this.tokens.removeToken();
          this.tokens.removeToken();
          if (this.tokens.matches1(tt.comma)) {
            this.tokens.removeToken();
          }
        } else if (
          this.tokens.matches5(tt.name, tt.name, tt.name, tt.name, tt.comma) ||
          this.tokens.matches5(tt.name, tt.name, tt.name, tt.name, tt.braceR)
        ) {
          // type foo as bar
          this.tokens.removeToken();
          this.tokens.removeToken();
          this.tokens.removeToken();
          this.tokens.removeToken();
          if (this.tokens.matches1(tt.comma)) {
            this.tokens.removeToken();
          }
        } else if (
          this.tokens.matches2(tt.name, tt.comma) ||
          this.tokens.matches2(tt.name, tt.braceR)
        ) {
          // foo
          if (this.isTypeName(this.tokens.identifierName())) {
            this.tokens.removeToken();
            if (this.tokens.matches1(tt.comma)) {
              this.tokens.removeToken();
            }
          } else {
            foundNonTypeImport = true;
            this.tokens.copyToken();
            if (this.tokens.matches1(tt.comma)) {
              this.tokens.copyToken();
            }
          }
        } else if (
          this.tokens.matches4(tt.name, tt.name, tt.name, tt.comma) ||
          this.tokens.matches4(tt.name, tt.name, tt.name, tt.braceR)
        ) {
          // foo as bar
          if (this.isTypeName(this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 2))) {
            this.tokens.removeToken();
            this.tokens.removeToken();
            this.tokens.removeToken();
            if (this.tokens.matches1(tt.comma)) {
              this.tokens.removeToken();
            }
          } else {
            foundNonTypeImport = true;
            this.tokens.copyToken();
            this.tokens.copyToken();
            this.tokens.copyToken();
            if (this.tokens.matches1(tt.comma)) {
              this.tokens.copyToken();
            }
          }
        } else {
          throw new Error("Unexpected import form.");
        }
      }
      this.tokens.copyExpectedToken(tt.braceR);
    }

    return !foundNonTypeImport;
  }

  private isTypeName(name: string): boolean {
    return this.isTypeScriptTransformEnabled && !this.nonTypeIdentifiers.has(name);
  }
}
