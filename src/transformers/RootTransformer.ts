import ImportProcessor from "../ImportProcessor";
import {Transform} from "../index";
import NameManager from "../NameManager";
import TokenProcessor from "../TokenProcessor";
import FlowTransformer from "./FlowTransformer";
import ImportTransformer from "./ImportTransformer";
import JSXTransformer from "./JSXTransformer";
import ReactDisplayNameTransformer from "./ReactDisplayNameTransformer";
import Transformer from "./Transformer";

export default class RootTransformer {
  private transformers: Array<Transformer> = [];

  constructor(readonly tokens: TokenProcessor, transforms: Array<Transform>) {
    const nameManager = new NameManager(tokens);
    const importProcessor = transforms.includes("imports")
      ? new ImportProcessor(nameManager, tokens)
      : null;
    const identifierReplacer = importProcessor || {getIdentifierReplacement: () => null};

    if (transforms.includes("jsx")) {
      this.transformers.push(new JSXTransformer(this, tokens, identifierReplacer));
    }

    // react-display-name must come before imports since otherwise imports will
    // claim a normal `React` name token.
    if (transforms.includes("react-display-name")) {
      this.transformers.push(new ReactDisplayNameTransformer(this, tokens, identifierReplacer));
    }

    if (transforms.includes("imports")) {
      const shouldAddModuleExports = transforms.includes("add-module-exports");
      this.transformers.push(
        new ImportTransformer(this, tokens, nameManager, importProcessor!, shouldAddModuleExports),
      );
    }

    if (transforms.includes("flow")) {
      this.transformers.push(new FlowTransformer(this, tokens));
    }
  }

  transform(): string {
    this.tokens.reset();
    for (const transformer of this.transformers) {
      transformer.preprocess();
    }
    this.processBalancedCode();
    let prefix = "";
    for (const transformer of this.transformers) {
      prefix += transformer.getPrefixCode();
    }
    let suffix = "";
    for (const transformer of this.transformers) {
      suffix += transformer.getSuffixCode();
    }
    return prefix + this.tokens.finish() + suffix;
  }

  processBalancedCode(): void {
    let braceDepth = 0;
    let parenDepth = 0;
    while (!this.tokens.isAtEnd()) {
      let wasProcessed = false;
      for (const transformer of this.transformers) {
        wasProcessed = transformer.process();
        if (wasProcessed) {
          break;
        }
      }
      if (!wasProcessed) {
        if (this.tokens.matches(["{"]) || this.tokens.matches(["${"])) {
          braceDepth++;
        } else if (this.tokens.matches(["}"])) {
          if (braceDepth === 0) {
            return;
          }
          braceDepth--;
        }
        if (this.tokens.matches(["("])) {
          parenDepth++;
        } else if (this.tokens.matches([")"])) {
          if (parenDepth === 0) {
            return;
          }
          parenDepth--;
        }
        this.tokens.copyToken();
      }
    }
  }

  processToken(): void {
    for (const transformer of this.transformers) {
      const wasProcessed = transformer.process();
      if (wasProcessed) {
        return;
      }
    }
    this.tokens.copyToken();
  }

  /**
   * Skip past a class with a name and return that name.
   */
  processNamedClass(): string {
    if (!this.tokens.matches(["class", "name"])) {
      throw new Error("Expected identifier for exported class name.");
    }
    const name = this.tokens.tokens[this.tokens.currentIndex() + 1].value;
    this.processClass();
    return name;
  }

  processClass(): void {
    const classToken = this.tokens.currentToken();
    this.tokens.copyExpectedToken("class");
    if (this.tokens.matches(["name"]) && !this.tokens.matchesName("implements")) {
      this.tokens.copyToken();
    }
    if (this.tokens.matches(["extends"])) {
      // There are only some limited expressions that are allowed within the
      // `extends` expression, e.g. no top-level binary operators, so we can
      // skip past even fairly complex expressions by being a bit careful.
      this.tokens.copyToken();
      if (this.tokens.matches(["{"])) {
        // Extending an object literal.
        this.tokens.copyExpectedToken("{");
        this.processBalancedCode();
        this.tokens.copyExpectedToken("}");
      }
      while (
        !this.tokens.matchesName("implements") &&
        !(
          this.tokens.matches(["{"]) &&
          this.tokens.currentToken().parentContextStartIndex === classToken.contextStartIndex
        )
      ) {
        this.processToken();
      }
    }

    if (this.tokens.matchesName("implements")) {
      while (!this.tokens.matches(["{"])) {
        this.tokens.removeToken();
      }
    }

    this.tokens.copyExpectedToken("{");
    this.processBalancedCode();
    this.tokens.copyExpectedToken("}");
  }

  processPossibleTypeAnnotation(): boolean {
    if (
      this.tokens.matches(["?", ":"]) &&
      this.tokens.tokenAtRelativeIndex(2).contextName === "type"
    ) {
      this.tokens.removeInitialToken();
      this.tokens.removeInitialToken();
      while (this.tokens.currentToken().contextName === "type") {
        this.tokens.removeToken();
      }
      return true;
    }
    if (this.tokens.matches([":"]) && this.tokens.tokenAtRelativeIndex(1).contextName === "type") {
      this.tokens.removeInitialToken();
      while (this.tokens.currentToken().contextName === "type") {
        this.tokens.removeToken();
      }
      return true;
    }
    return false;
  }
}
