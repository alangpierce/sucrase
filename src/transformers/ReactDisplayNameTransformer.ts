import TokenProcessor from "../TokenProcessor";
import IdentifierReplacer from "./IdentifierReplacer";
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
    readonly identifierReplacer: IdentifierReplacer,
  ) {
    super();
  }

  process(): boolean {
    const startIndex = this.tokens.currentIndex();
    if (this.tokens.matchesName("createReactClass")) {
      const newName = this.identifierReplacer.getIdentifierReplacement("createReactClass");
      if (newName) {
        this.tokens.replaceToken(`(0, ${newName})`);
      } else {
        this.tokens.copyToken();
      }
      this.tryProcessCreateClassCall(startIndex);
      return true;
    }
    if (
      this.tokens.matches(["name", ".", "name"]) &&
      this.tokens.matchesName("React") &&
      this.tokens.matchesNameAtIndex(this.tokens.currentIndex() + 2, "createClass")
    ) {
      const newName = this.identifierReplacer.getIdentifierReplacement("React");
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
      this.tokens.copyExpectedToken("(");
      this.tokens.copyExpectedToken("{");
      this.tokens.appendCode(`displayName: '${displayName}',`);
      this.rootTransformer.processBalancedCode();
      this.tokens.copyExpectedToken("}");
      this.tokens.copyExpectedToken(")");
    }
  }

  private findDisplayName(startIndex: number): string | null {
    if (
      this.tokens.matchesAtIndex(startIndex - 2, ["name", "="]) &&
      !this.tokens.matchesAtIndex(startIndex - 3, ["."])
    ) {
      // This is an assignment (or declaration) with an identifier LHS, so use
      // that identifier name.
      return this.tokens.tokens[startIndex - 2].value;
    }
    if (
      this.tokens.matchesAtIndex(startIndex - 2, ["name", ":"]) &&
      this.tokens.tokens[startIndex - 2].contextName === "object" &&
      (this.tokens.tokens[startIndex - 3].type.label === "," ||
        this.tokens.tokens[startIndex - 3].type.label === "{")
    ) {
      // This is an object literal value.
      return this.tokens.tokens[startIndex - 2].value;
    }
    return null;
  }

  /**
   * We only want to add a display name when this is a function call containing
   * one argument, which is an object literal without `displayName` as an
   * existing key.
   */
  private classNeedsDisplayName(): boolean {
    let index = this.tokens.currentIndex();
    if (!this.tokens.matches(["(", "{"])) {
      return false;
    }
    // Currently augmentTokenContext starts the block at one after the {, so we
    // expect any displayName key to be in that context. We need to ignore other
    // other contexts to avoid matching nested displayName keys.
    const objectStartIndex = index + 2;

    for (; index < this.tokens.tokens.length; index++) {
      const token = this.tokens.tokens[index];
      if (
        token.type.label === "}" &&
        token.contextName === "object" &&
        token.contextStartIndex === objectStartIndex
      ) {
        index++;
        break;
      }

      if (
        this.tokens.matchesNameAtIndex(index, "displayName") &&
        this.tokens.matchesAtIndex(index + 1, [":"]) &&
        (this.tokens.matchesAtIndex(index - 1, [","]) ||
          this.tokens.matchesAtIndex(index - 1, ["{"])) &&
        token.contextName === "object" &&
        token.contextStartIndex === objectStartIndex
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
      this.tokens.matchesAtIndex(index, [")"]) || this.tokens.matchesAtIndex(index, [",", ")"])
    );
  }
}
