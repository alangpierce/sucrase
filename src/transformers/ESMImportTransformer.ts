import type {Options} from "../index";
import type NameManager from "../NameManager";
import {ContextualKeyword} from "../parser/tokenizer/keywords";
import {TokenType as tt} from "../parser/tokenizer/types";
import type TokenProcessor from "../TokenProcessor";
import elideImportEquals from "../util/elideImportEquals";
import getDeclarationInfo, {
  DeclarationInfo,
  EMPTY_DECLARATION_INFO,
} from "../util/getDeclarationInfo";
import {getNonTypeIdentifiers} from "../util/getNonTypeIdentifiers";
import shouldElideDefaultExport from "../util/shouldElideDefaultExport";
import type ReactHotLoaderTransformer from "./ReactHotLoaderTransformer";
import Transformer from "./Transformer";

/**
 * Class for editing import statements when we are keeping the code as ESM. We still need to remove
 * type-only imports in TypeScript and Flow.
 */
export default class ESMImportTransformer extends Transformer {
  private nonTypeIdentifiers: Set<string>;
  private declarationInfo: DeclarationInfo;

  constructor(
    readonly tokens: TokenProcessor,
    readonly nameManager: NameManager,
    readonly reactHotLoaderTransformer: ReactHotLoaderTransformer | null,
    readonly isTypeScriptTransformEnabled: boolean,
    options: Options,
  ) {
    super();
    this.nonTypeIdentifiers = isTypeScriptTransformEnabled
      ? getNonTypeIdentifiers(tokens, options)
      : new Set();
    this.declarationInfo = isTypeScriptTransformEnabled
      ? getDeclarationInfo(tokens)
      : EMPTY_DECLARATION_INFO;
  }

  process(): boolean {
    // TypeScript `import foo = require('foo');` should always just be translated to plain require.
    if (this.tokens.matches3(tt._import, tt.name, tt.eq)) {
      return this.processImportEquals();
    }
    if (this.tokens.matches2(tt._export, tt.eq)) {
      this.tokens.replaceToken("module.exports");
      return true;
    }
    if (this.tokens.matches1(tt._import)) {
      return this.processImport();
    }
    if (this.tokens.matches2(tt._export, tt._default)) {
      return this.processExportDefault();
    }
    if (this.tokens.matches2(tt._export, tt.braceL)) {
      return this.processNamedExports();
    }
    if (
      this.tokens.matches3(tt._export, tt.name, tt.braceL) &&
      this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, ContextualKeyword._type)
    ) {
      // TS `export type {` case: just remove the export entirely.
      this.tokens.removeInitialToken();
      while (!this.tokens.matches1(tt.braceR)) {
        this.tokens.removeToken();
      }
      this.tokens.removeToken();

      // Remove type re-export `... } from './T'`
      if (
        this.tokens.matchesContextual(ContextualKeyword._from) &&
        this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, tt.string)
      ) {
        this.tokens.removeToken();
        this.tokens.removeToken();
      }
      return true;
    }
    return false;
  }

  private processImportEquals(): boolean {
    const importName = this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 1);
    if (this.isTypeName(importName)) {
      // If this name is only used as a type, elide the whole import.
      elideImportEquals(this.tokens);
    } else {
      // Otherwise, switch `import` to `const`.
      this.tokens.replaceToken("const");
    }
    return true;
  }

  private processImport(): boolean {
    if (this.tokens.matches2(tt._import, tt.parenL)) {
      // Dynamic imports don't need to be transformed.
      return false;
    }

    const snapshot = this.tokens.snapshot();
    const allImportsRemoved = this.removeImportTypeBindings();
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
  private removeImportTypeBindings(): boolean {
    this.tokens.copyExpectedToken(tt._import);
    if (
      this.tokens.matchesContextual(ContextualKeyword._type) &&
      !this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, tt.comma) &&
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

  private processExportDefault(): boolean {
    if (
      shouldElideDefaultExport(this.isTypeScriptTransformEnabled, this.tokens, this.declarationInfo)
    ) {
      // If the exported value is just an identifier and should be elided by TypeScript
      // rules, then remove it entirely. It will always have the form `export default e`,
      // where `e` is an identifier.
      this.tokens.removeInitialToken();
      this.tokens.removeToken();
      this.tokens.removeToken();
      return true;
    }

    const alreadyHasName =
      this.tokens.matches4(tt._export, tt._default, tt._function, tt.name) ||
      // export default async function
      this.tokens.matches5(tt._export, tt._default, tt.name, tt._function, tt.name) ||
      this.tokens.matches4(tt._export, tt._default, tt._class, tt.name) ||
      this.tokens.matches5(tt._export, tt._default, tt._abstract, tt._class, tt.name);

    if (!alreadyHasName && this.reactHotLoaderTransformer) {
      // This is a plain "export default E" statement and we need to assign E to a variable.
      // Change "export default E" to "let _default; export default _default = E"
      const defaultVarName = this.nameManager.claimFreeName("_default");
      this.tokens.replaceToken(`let ${defaultVarName}; export`);
      this.tokens.copyToken();
      this.tokens.appendCode(` ${defaultVarName} =`);
      this.reactHotLoaderTransformer.setExtractedDefaultExportName(defaultVarName);
      return true;
    }
    return false;
  }

  /**
   * In TypeScript, we need to remove named exports that were never declared or only declared as a
   * type.
   */
  private processNamedExports(): boolean {
    if (!this.isTypeScriptTransformEnabled) {
      return false;
    }
    this.tokens.copyExpectedToken(tt._export);
    this.tokens.copyExpectedToken(tt.braceL);

    while (!this.tokens.matches1(tt.braceR)) {
      if (!this.tokens.matches1(tt.name)) {
        throw new Error("Expected identifier at the start of named export.");
      }
      if (this.shouldElideExportedName(this.tokens.identifierName())) {
        while (
          !this.tokens.matches1(tt.comma) &&
          !this.tokens.matches1(tt.braceR) &&
          !this.tokens.isAtEnd()
        ) {
          this.tokens.removeToken();
        }
        if (this.tokens.matches1(tt.comma)) {
          this.tokens.removeToken();
        }
      } else {
        while (
          !this.tokens.matches1(tt.comma) &&
          !this.tokens.matches1(tt.braceR) &&
          !this.tokens.isAtEnd()
        ) {
          this.tokens.copyToken();
        }
        if (this.tokens.matches1(tt.comma)) {
          this.tokens.copyToken();
        }
      }
    }
    this.tokens.copyExpectedToken(tt.braceR);
    return true;
  }

  /**
   * ESM elides all imports with the rule that we only elide if we see that it's
   * a type and never see it as a value. This is in contract to CJS, which
   * elides imports that are completely unknown.
   */
  private shouldElideExportedName(name: string): boolean {
    return (
      this.isTypeScriptTransformEnabled &&
      this.declarationInfo.typeDeclarations.has(name) &&
      !this.declarationInfo.valueDeclarations.has(name)
    );
  }
}
