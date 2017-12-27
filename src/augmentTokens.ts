import TokenProcessor, {Token, TokenContext} from "./TokenProcessor";
import {isTypeBinop, isTypeExpressionAtom, isTypeExpressionPrefix} from "./util/TokenUtil";

export default function augmentTokens(code: string, tokens: Array<Token>): void {
  new TokenPreprocessor(new TokenProcessor(code, tokens)).preprocess();
}

type ContextInfo = {
  context: TokenContext;
  startIndex: number;
};

/**
 * Class that does a scan through the tokens to establish the "context" for each
 * token (like whether it's in a block or an object literal) and some other
 * useful information. This is needed, for example, to distinguish an array
 * element from an object shorthand.
 */
class TokenPreprocessor {
  private contextStack: Array<ContextInfo> = [];

  constructor(readonly tokens: TokenProcessor) {}

  preprocess(): void {
    this.processRegion([], ["eof"], "block");
  }

  private processToToken(
    openingTokenLabel: string,
    closingTokenLabel: string,
    context: TokenContext,
  ): void {
    this.processRegion([openingTokenLabel], [closingTokenLabel], context);
  }

  private processRegion(
    openingTokenLabels: Array<string>,
    closingTokenLabels: Array<string>,
    context: TokenContext,
    {followingLabels = []}: {followingLabels?: Array<string>} = {},
  ): void {
    this.contextStack.push({context, startIndex: this.tokens.currentIndex()});

    for (const label of openingTokenLabels) {
      this.tokens.expectToken(label);
      this.advance();
    }

    let pendingClass = false;
    let ternaryDepth = 0;

    while (true) {
      if (this.tokens.matches([...closingTokenLabels, ...followingLabels])) {
        for (let i = 0; i < closingTokenLabels.length; i++) {
          this.advance();
        }
        break;
      }

      if (this.tokens.isAtEnd()) {
        throw new Error("Unexpected end of program when preprocessing tokens.");
      }

      // A question mark operator can be one of multiple things:
      // - The first operator in a ternary.
      // - The first part of the compound operator "?:" for an optional type
      //   annotation.
      // - An optional type, like "?number".
      // We only want to count ternaries, so we ignore ?: and rely on skipping
      // all types in order to know that it's not an optional type.
      if (this.tokens.matches(["?"]) && !this.tokens.matches(["?", ":"])) {
        ternaryDepth++;
      }

      // A colon can be one of multiple things:
      // - The second operator in a ternary.
      // - A type annotation.
      // - A type cast.
      // - An object key/value separator.
      // - The end of a label.
      // - The end of a case or default statement.
      // We want to know if we're followed by a type, so we
      if (this.tokens.matches([":"]) && !this.matchesObjectColon() && !this.matchesLabelColon()) {
        if (ternaryDepth > 0) {
          ternaryDepth--;
          this.advance();
        } else {
          this.advance();
          this.processTypeExpression({disallowArrow: true});
        }
      } else if (
        this.tokens.matches(["export"]) &&
        this.tokens.matchesNameAtRelativeIndex(1, "type")
      ) {
        this.processTypeAlias();
      } else if (
        this.tokens.matchesName("type") &&
        this.tokens.matchesAtRelativeIndex(1, ["name"]) &&
        (this.tokens.matchesAtRelativeIndex(2, ["="]) ||
          this.tokens.matchesAtRelativeIndex(2, ["</>"]))
      ) {
        this.processTypeAlias();
      } else if (this.startsWithKeyword(["if", "for", "while", "catch"])) {
        // Code of the form TOKEN (...) BLOCK
        if (this.tokens.matches(["("])) {
          this.tokens.expectToken("(");
          this.advance();
          this.processToToken("(", ")", "parens");
          if (this.tokens.matches(["{"])) {
            this.processToToken("{", "}", "block");
          }
        } else {
          this.advance();
        }
      } else if (this.startsWithKeyword(["function"])) {
        this.advance();
        if (this.tokens.matches(["name"])) {
          this.advance();
        }
        if (this.tokens.matches(["</>"]) && this.tokens.currentToken().value === "<") {
          this.processTypeParameter();
        }
        this.processToToken("(", ")", "parens");
        if (this.tokens.matches([":"])) {
          this.advance();
          this.processTypeExpression();
        }
        if (this.tokens.matches(["{"])) {
          this.processToToken("{", "}", "block");
        }
      } else if (
        this.startsWithKeyword(["=>", "else", "try", "finally", "do"]) ||
        (this.tokens.matches([";"]) && context === "block")
      ) {
        this.advance();
        if (this.tokens.matches(["{"])) {
          this.processToToken("{", "}", "block");
        }
      } else if (this.startsWithKeyword(["class"])) {
        this.advance();
        pendingClass = true;
      } else if (this.startsWithKeyword(["default"])) {
        this.advance();
        if (this.tokens.matches([":", "{"])) {
          this.advance();
          this.processToToken("{", "}", "block");
        }
      } else if (this.tokens.matches(["name"])) {
        this.advance();
        if (context === "class" && (this.tokens.matches(["("]) || this.tokens.matches(["</>"]))) {
          // Process class method.
          if (this.tokens.matches(["</>"]) && this.tokens.currentToken().value === "<") {
            this.processTypeParameter();
          }
          this.processToToken("(", ")", "parens");
          if (this.tokens.matches([":"])) {
            this.advance();
            this.processTypeExpression();
          }
          if (this.tokens.matches(["{"])) {
            this.processToToken("{", "}", "block");
          }
        } else if (context === "class" && this.tokens.matches([":"]) && ternaryDepth === 0) {
          // Process typed class field.
          const identifierTokenIndex = this.tokens.currentIndex() - 1;
          this.advance();
          this.processTypeExpression();
          if (!this.tokens.matches(["="])) {
            const identifierToken = this.tokens.tokens[identifierTokenIndex];
            identifierToken.contextName = "type";
            identifierToken.contextStartIndex = identifierTokenIndex;
            identifierToken.parentContextStartIndex = this.getContextInfo().startIndex;
          }
        } else if (
          context === "object" &&
          (this.tokens.matches(["("]) || this.tokens.matches(["</>"])) &&
          (this.tokens.matchesAtRelativeIndex(-2, [","]) ||
            this.tokens.matchesAtRelativeIndex(-2, ["{"]))
        ) {
          // Process object method.
          if (this.tokens.matches(["</>"]) && this.tokens.currentToken().value === "<") {
            this.processTypeParameter();
          }
          this.processToToken("(", ")", "parens");
          if (this.tokens.matches([":"])) {
            this.advance();
            this.processTypeExpression();
          }
          if (this.tokens.matches(["{"])) {
            this.processToToken("{", "}", "block");
          }
        }
      } else if (this.tokens.matches(["case"])) {
        this.processToToken("case", ":", "switchCaseCondition");
        if (this.tokens.matches(["{"])) {
          this.processToToken("{", "}", "block");
        }
      } else if (this.tokens.matches(["jsxTagStart"])) {
        this.processToToken("jsxTagStart", "jsxTagEnd", "jsxTag");
        // Non-self-closing tag, so use jsxChild context for the body.
        if (!this.tokens.matchesAtRelativeIndex(-2, ["/"])) {
          // All / tokens will be in JSX tags.
          this.processRegion([], [], "jsxChild", {followingLabels: ["jsxTagStart", "/"]});
          this.processToToken("jsxTagStart", "jsxTagEnd", "jsxTag");
        }
      } else if (this.tokens.matches(["{"])) {
        if (
          this.tokens.matchesAtRelativeIndex(-1, [")"]) ||
          this.tokens.matchesAtRelativeIndex(-1, ["}"])
        ) {
          this.processToToken("{", "}", "block");
        } else if (pendingClass && !this.tokens.matchesAtRelativeIndex(-1, ["extends"])) {
          this.processToToken("{", "}", "class");
          pendingClass = false;
        } else if (context === "jsxTag" || context === "jsxChild") {
          this.processToToken("{", "}", "jsxExpression");
        } else {
          this.processToToken("{", "}", "object");
        }
      } else if (this.tokens.matches(["["])) {
        this.processToToken("[", "]", "brackets");
      } else if (this.tokens.matches(["("])) {
        this.processToToken("(", ")", "parens");
      } else if (this.tokens.matches(["${"])) {
        this.processToToken("${", "}", "templateExpr");
      } else {
        this.advance();
      }
    }

    this.contextStack.pop();
  }

  private matchesObjectColon(): boolean {
    if (!this.tokens.matches([":"])) {
      throw new Error("Expected to be called while on a colon token.");
    }
    if (this.getContextInfo().context !== "object") {
      return false;
    }
    let keyStart;
    if (this.tokens.matchesAtRelativeIndex(-1, ["]"])) {
      keyStart = this.tokens.tokenAtRelativeIndex(-1).contextStartIndex!;
    } else {
      keyStart = this.tokens.currentIndex() - 1;
    }
    return (
      this.tokens.matchesAtIndex(keyStart - 1, [","]) ||
      this.tokens.matchesAtIndex(keyStart - 1, ["{"])
    );
  }

  private matchesLabelColon(): boolean {
    if (!this.tokens.matches([":"])) {
      throw new Error("Expected to be called while on a colon token.");
    }
    return (
      this.getContextInfo().context === "switchCaseCondition" ||
      (this.tokens.matchesAtRelativeIndex(-1, ["default"]) &&
        !this.tokens.matchesAtRelativeIndex(-2, ["."])) ||
      this.tokens.matchesAtRelativeIndex(1, ["for"]) ||
      this.tokens.matchesAtRelativeIndex(1, ["while"]) ||
      this.tokens.matchesAtRelativeIndex(1, ["do"])
    );
  }

  private getContextInfo(): ContextInfo {
    return this.contextStack[this.contextStack.length - 1];
  }

  /**
   * Starting at a colon type, walk forward a full type expression, marking all
   * tokens as being type tokens.
   */
  private processTypeExpression({disallowArrow = false}: {disallowArrow?: boolean} = {}): void {
    this.contextStack.push({context: "type", startIndex: this.tokens.currentIndex()});

    const expressionEnd = this.skipTypeExpression(this.tokens.currentIndex(), disallowArrow);
    if (expressionEnd === null) {
      throw new Error("Expected to find a type expression.");
    }
    while (this.tokens.currentIndex() < expressionEnd) {
      this.advance();
    }
    this.contextStack.pop();
  }

  private processTypeAlias(): void {
    this.contextStack.push({context: "type", startIndex: this.tokens.currentIndex()});
    if (this.tokens.matches(["export"])) {
      this.advance("export");
    }
    this.advance("name", "type");
    this.advance("name");
    if (this.tokens.matches(["</>"]) && this.tokens.currentToken().value === "<") {
      this.skipBalancedAngleBrackets();
    }
    this.advance("=");
    const expressionEnd = this.skipTypeExpression(this.tokens.currentIndex());
    if (expressionEnd === null) {
      throw new Error("Expected to find a type expression.");
    }
    while (this.tokens.currentIndex() < expressionEnd) {
      this.advance();
    }
    this.contextStack.pop();
  }

  /**
   * disallowError says that we should NOT traverse arrow types. This is
   * specifically when trying to parse a return type on an arrow function, which
   * can lead to an ambiguity like this:
   *
   * f = (): number => number => 4;
   *
   * The proper parsing here is just `number` for the return type.
   */
  skipTypeExpression(index: number, disallowArrow: boolean = false): number | null {
    const tokens = this.tokens.tokens;
    while (isTypeExpressionPrefix(tokens[index].type)) {
      index++;
    }

    const firstToken = tokens[index];
    if (isTypeExpressionAtom(firstToken.type)) {
      // Identifier, number, etc, or function type with that as the param.
      index++;
      if (!disallowArrow && this.tokens.matchesAtIndex(index, ["=>"])) {
        index++;
        const nextIndex = this.skipTypeExpression(index);
        if (nextIndex === null) {
          return null;
        }
        index = nextIndex;
      }
    } else if (firstToken.type.label === "{") {
      index++;
      index = this.skipBalancedCode(index, "{", "}");
      index++;
    } else if (firstToken.type.label === "[") {
      index++;
      index = this.skipBalancedCode(index, "[", "]");
      index++;
    } else if (firstToken.type.label === "(") {
      // Either a parenthesized expression or an arrow function.
      index++;
      index = this.skipBalancedCode(index, "(", ")");
      index++;
      if (!disallowArrow && this.tokens.matchesAtIndex(index, ["=>"])) {
        index++;
        const nextIndex = this.skipTypeExpression(index);
        if (nextIndex === null) {
          return null;
        }
        index = nextIndex;
      }
    } else if (firstToken.type.label === "typeof") {
      index += 2;
    } else {
      // Unrecognized token, so bail out.
      return null;
    }

    // We're already one past the end of a valid expression, so see if it's
    // possible to expand to the right.
    while (true) {
      const token = tokens[index];

      // Check if there's any indication that we can expand forward, and do so.
      if (isTypeBinop(token.type)) {
        index++;
        const nextIndex = this.skipTypeExpression(index);
        if (nextIndex === null) {
          return null;
        }
        index = nextIndex;
      } else if (token.type.label === ".") {
        // Normal member access, so process the dot and the identifier.
        index += 2;
      } else if (token.type.label === "[" && tokens[index + 1].type.label === "]") {
        index += 2;
      } else if (token.type.label === "</>" && token.value === "<") {
        index++;
        index = this.skipBalancedCode(index, "</>", "</>", "<", ">");
        index++;
      } else {
        break;
      }
    }
    return index;
  }

  skipBalancedCode(
    index: number,
    openTokenLabel: string,
    closeTokenLabel: string,
    // tslint:disable-next-line no-any
    openValue?: any,
    // tslint:disable-next-line no-any
    closeValue?: any,
  ): number {
    let depth = 0;
    while (index < this.tokens.tokens.length) {
      const token = this.tokens.tokens[index];
      if (token.type.label === openTokenLabel && (!openValue || token.value === openValue)) {
        depth++;
      } else if (
        token.type.label === closeTokenLabel &&
        (!closeValue || token.value === closeValue)
      ) {
        if (depth === 0) {
          break;
        }
        depth--;
      }
      index++;
    }
    if (index === this.tokens.tokens.length) {
      throw new Error("Did not find end of balanced code.");
    }
    return index;
  }

  private processTypeParameter(): void {
    this.contextStack.push({context: "typeParameter", startIndex: this.tokens.currentIndex()});
    this.skipBalancedAngleBrackets();
    this.contextStack.pop();
  }

  private skipBalancedAngleBrackets(): void {
    this.advance("</>", "<");
    while (!this.tokens.matches(["</>"]) || this.tokens.currentToken().value !== ">") {
      this.advance();
    }
    this.advance("</>", ">");
  }

  // tslint:disable-next-line no-any
  private advance(expectedLabel: string | null = null, expectedValue: any = null): void {
    const token = this.tokens.currentToken();
    if (expectedLabel && token.type.label !== expectedLabel) {
      throw new Error(`Expected token ${expectedLabel}.`);
    }
    if (expectedValue && token.value !== expectedValue) {
      throw new Error(`Expected value ${expectedValue}.`);
    }
    const contextInfo = this.contextStack[this.contextStack.length - 1];
    const parentContextInfo = this.contextStack[this.contextStack.length - 2];
    token.contextName = contextInfo.context;
    token.contextStartIndex = contextInfo.startIndex;
    token.parentContextStartIndex = parentContextInfo ? parentContextInfo.startIndex : null;
    this.tokens.nextToken();
  }

  /**
   * Keywords can be property values, so don't consider them if we're after a
   * dot.
   */
  private startsWithKeyword(keywords: Array<string>): boolean {
    return (
      !this.tokens.matchesAtRelativeIndex(-1, ["."]) &&
      keywords.some((keyword) => this.tokens.matches([keyword]))
    );
  }
}
