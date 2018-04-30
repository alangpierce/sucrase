import {ContextualKeyword, IdentifierRole} from "../../sucrase-babylon/tokenizer";
import {TokenType as tt} from "../../sucrase-babylon/tokenizer/types";
import CJSImportProcessor from "../CJSImportProcessor";
import TokenProcessor from "../TokenProcessor";
import RootTransformer from "./RootTransformer";
import Transformer from "./Transformer";

/**
 * Implementation of babel-plugin-transform-react-display-name, which adds a
 * display name to usages of React.createClass and createReactClass.
 *
 * This implementation has the following limitations compared with the
 * - It does not handle `export default React.createClass`, using the filename,
 *   since Sucrase currently does not know the name of the current file.
 */
export default class ReactDisplayNameTransformer extends Transformer {
  constructor(
    readonly rootTransformer: RootTransformer,
    readonly tokens: TokenProcessor,
    readonly importProcessor: CJSImportProcessor | null,
    readonly filePath: string | null,
  ) {
    super();
  }

  process(): boolean {
    const startIndex = this.tokens.currentIndex();
    if (this.tokens.matchesContextual(ContextualKeyword._createReactClass)) {
      const newName =
        this.importProcessor && this.importProcessor.getIdentifierReplacement("createReactClass");
      if (newName) {
        this.tokens.replaceToken(`(0, ${newName})`);
      } else {
        this.tokens.copyToken();
      }
      this.tryProcessCreateClassCall(startIndex);
      return true;
    }
    if (
      this.tokens.matches3(tt.name, tt.dot, tt.name) &&
      this.tokens.matchesContextual(ContextualKeyword._React) &&
      this.tokens.matchesContextualAtIndex(
        this.tokens.currentIndex() + 2,
        ContextualKeyword._createClass,
      )
    ) {
      const newName = this.importProcessor
        ? this.importProcessor.getIdentifierReplacement("React") || "React"
        : "React";
      if (newName) {
        this.tokens.replaceToken(newName);
        this.tokens.copyToken();
        this.tokens.copyToken();
      } else {
        this.tokens.copyToken();
        this.tokens.copyToken();
        this.tokens.copyToken();
      }
      this.tryProcessCreateClassCall(startIndex);
      return true;
    }
    return false;
  }

  /**
   * This is called with the token position at the open-paren.
   */
  private tryProcessCreateClassCall(startIndex: number): void {
    const displayName = this.findDisplayName(startIndex);
    if (!displayName) {
      return;
    }

    if (this.classNeedsDisplayName()) {
      this.tokens.copyExpectedToken(tt.parenL);
      this.tokens.copyExpectedToken(tt.braceL);
      this.tokens.appendCode(`displayName: '${displayName}',`);
      this.rootTransformer.processBalancedCode();
      this.tokens.copyExpectedToken(tt.braceR);
      this.tokens.copyExpectedToken(tt.parenR);
    }
  }

  private findDisplayName(startIndex: number): string | null {
    if (
      this.tokens.matchesAtIndex(startIndex - 2, [tt.name, tt.eq]) &&
      !this.tokens.matchesAtIndex(startIndex - 3, [tt.dot])
    ) {
      // This is an assignment (or declaration) with an identifier LHS, so use
      // that identifier name.
      return this.tokens.identifierNameAtIndex(startIndex - 2);
    }
    if (
      startIndex >= 2 &&
      this.tokens.tokens[startIndex - 2].identifierRole === IdentifierRole.ObjectKey
    ) {
      // This is an object literal value.
      return this.tokens.identifierNameAtIndex(startIndex - 2);
    }
    if (this.tokens.matchesAtIndex(startIndex - 2, [tt._export, tt._default])) {
      return this.getDisplayNameFromFilename();
    }
    return null;
  }

  private getDisplayNameFromFilename(): string {
    const filePath = this.filePath || "unknown";
    const pathSegments = filePath.split("/");
    const filename = pathSegments[pathSegments.length - 1];
    const dotIndex = filename.lastIndexOf(".");
    const baseFilename = dotIndex === -1 ? filename : filename.slice(0, dotIndex);
    if (baseFilename === "index" && pathSegments[pathSegments.length - 2]) {
      return pathSegments[pathSegments.length - 2];
    } else {
      return baseFilename;
    }
  }

  /**
   * We only want to add a display name when this is a function call containing
   * one argument, which is an object literal without `displayName` as an
   * existing key.
   */
  private classNeedsDisplayName(): boolean {
    let index = this.tokens.currentIndex();
    if (!this.tokens.matches2(tt.parenL, tt.braceL)) {
      return false;
    }
    // The block starts on the {, and we expect any displayName key to be in
    // that context. We need to ignore other other contexts to avoid matching
    // nested displayName keys.
    const objectStartIndex = index + 1;
    const objectContextId = this.tokens.tokens[objectStartIndex].contextId;
    if (objectContextId == null) {
      throw new Error("Expected non-null context ID on object open-brace.");
    }

    for (; index < this.tokens.tokens.length; index++) {
      const token = this.tokens.tokens[index];
      if (token.type === tt.braceR && token.contextId === objectContextId) {
        index++;
        break;
      }

      if (
        this.tokens.matchesContextualAtIndex(index, ContextualKeyword._displayName) &&
        this.tokens.tokens[index].identifierRole === IdentifierRole.ObjectKey &&
        token.contextId === objectContextId
      ) {
        // We found a displayName key, so bail out.
        return false;
      }
    }

    if (index === this.tokens.tokens.length) {
      throw new Error("Unexpected end of input when processing React class.");
    }

    // If we got this far, we know we have createClass with an object with no
    // display name, so we want to proceed as long as that was the only argument.
    return (
      this.tokens.matchesAtIndex(index, [tt.parenR]) ||
      this.tokens.matchesAtIndex(index, [tt.comma, tt.parenR])
    );
  }
}
