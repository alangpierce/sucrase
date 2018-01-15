import {Token, TokenContext} from "../sucrase-babylon/tokenizer";
import TokenProcessor from "./TokenProcessor";
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

      if (this.startsWithKeyword(["import"])) {
        this.forceContextUntilToken("string", "import");
      } else if (this.tokens.matches(["export", "{"])) {
        this.forceContextUntilToken("}", "namedExport");
      } else if (this.tokens.matches(["="]) && context === "class") {
        this.advance();
        this.processRegion([], [], "classFieldExpression", {followingLabels: [";"]});
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
      } else if (this.startsWithKeyword(["function"]) && context !== "class") {
        let startIndex = this.tokens.currentIndex();
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
        } else if (this.tokens.matches([";"])) {
          this.tokens.nextToken();
          // This is a function overload, so mark the whole function as a type.
          while (
            this.tokens.matchesAtIndex(startIndex - 1, ["export"]) ||
            this.tokens.matchesAtIndex(startIndex - 1, ["default"])
          ) {
            startIndex--;
          }
          for (let i = startIndex; i <= this.tokens.currentIndex(); i++) {
            const token = this.tokens.tokens[i];
            token.contextName = "type";
            token.contextStartIndex = startIndex;
            token.parentContextStartIndex = this.getContextInfo().startIndex;
          }
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
        } else if (context === "class" && this.tokens.matches([":"])) {
          // Process typed class field.
          const identifierTokenIndex = this.tokens.currentIndex() - 1;
          const previousTokenIndex = identifierTokenIndex - 1;

          if (this.tokens.matchesAtIndex(previousTokenIndex, ["+/-"])) {
            const varianceMarkerToken = this.tokens.tokens[previousTokenIndex];
            varianceMarkerToken.contextName = "type";
            varianceMarkerToken.contextStartIndex = previousTokenIndex;
            varianceMarkerToken.parentContextStartIndex = this.getContextInfo().startIndex;
          }

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
      } else if (this.startsWithKeyword(["case"])) {
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
      } else if (this.tokens.matches(["typeParameterStart"])) {
        this.processTypeParameter();
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

  private forceContextUntilToken(endToken: string, context: TokenContext): void {
    this.contextStack.push({context, startIndex: this.tokens.currentIndex()});
    while (!this.tokens.matches([endToken])) {
      this.advance();
    }
    this.advance();
    this.contextStack.pop();
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
    this.skipTypeExpression(disallowArrow);
    this.contextStack.pop();
  }

  /**
   * disallowArrow says that we should NOT traverse arrow types. This is
   * specifically when trying to parse a return type on an arrow function, which
   * can lead to an ambiguity like this:
   *
   * f = (): number => number => 4;
   *
   * The proper parsing here is just `number` for the return type.
   */
  skipTypeExpression(disallowArrow: boolean = false): void {
    while (isTypeExpressionPrefix(this.tokens.currentToken().type)) {
      this.advance();
    }

    if (isTypeExpressionAtom(this.tokens.currentToken().type)) {
      // Identifier, number, etc, or function type with that as the param.
      this.advance();
      if (!disallowArrow && this.tokens.matches(["=>"])) {
        this.advance();
        this.skipTypeExpression();
      }
    } else if (this.tokens.matches(["+/-", "num"]) && this.tokens.currentToken().value === "-") {
      // Negative number literals are their own special atom, so handle them as well.
      this.advance();
      this.advance();
      if (!disallowArrow && this.tokens.matches(["=>"])) {
        this.advance();
        this.skipTypeExpression();
      }
    } else if (this.tokens.matches(["{"])) {
      this.skipBalancedCode("{", "}");
    } else if (this.tokens.matches(["{|"])) {
      this.skipBalancedCode("{|", "|}");
    } else if (this.tokens.matches(["["])) {
      this.skipBalancedCode("[", "]");
    } else if (this.tokens.matches(["</>"]) && this.tokens.currentToken().value === "<") {
      this.skipBalancedAngleBrackets();
      this.skipBalancedCode("(", ")");
      this.advance("=>");
      this.skipTypeExpression();
    } else if (this.tokens.matches(["("])) {
      // Either a parenthesized expression or an arrow function.
      this.skipBalancedCode("(", ")");
      if (!disallowArrow && this.tokens.matches(["=>"])) {
        this.advance();
        this.skipTypeExpression();
      }
    } else if (this.tokens.matches(["typeof"])) {
      this.advance();
      this.advance();
    } else {
      throw new Error(
        `Unrecognized token at the start of a type: ${JSON.stringify(this.tokens.currentToken())}`,
      );
    }

    // We're already one past the end of a valid expression, so see if it's
    // possible to expand to the right.
    while (true) {
      // Check if there's any indication that we can expand forward, and do so.
      if (isTypeBinop(this.tokens.currentToken())) {
        this.advance();
        this.skipTypeExpression(disallowArrow);
      } else if (this.tokens.matches(["."])) {
        // Normal member access, so process the dot and the identifier.
        this.advance();
        this.advance();
      } else if (this.tokens.matches(["[", "]"])) {
        this.advance();
        this.advance();
      } else if (this.tokens.matches(["</>"]) && this.tokens.currentToken().value === "<") {
        this.skipBalancedAngleBrackets();
      } else {
        break;
      }
    }
  }

  skipBalancedCode(openTokenLabel: string, closeTokenLabel: string): void {
    this.advance(openTokenLabel);
    let depth = 0;
    while (!this.tokens.isAtEnd()) {
      if (this.tokens.matches([openTokenLabel])) {
        depth++;
      } else if (this.tokens.matches([closeTokenLabel])) {
        if (depth === 0) {
          break;
        }
        depth--;
      }
      this.advance();
    }
    if (this.tokens.isAtEnd()) {
      throw new Error("Did not find end of balanced code.");
    }
    this.advance(closeTokenLabel);
  }

  private processTypeParameter(): void {
    this.contextStack.push({context: "typeParameter", startIndex: this.tokens.currentIndex()});
    this.skipBalancedAngleBrackets();
    this.contextStack.pop();
  }

  private skipBalancedAngleBrackets(): void {
    let depth = 0;
    while (true) {
      if (this.tokens.matches(["typeParameterStart"])) {
        depth++;
      } else if (this.tokens.matches(["</>"]) && this.tokens.currentToken().value === "<") {
        depth++;
      } else if (this.tokens.matches(["</>"]) && this.tokens.currentToken().value === ">") {
        depth--;
      } else if (this.tokens.matches(["<</>>"]) && this.tokens.currentToken().value === ">>") {
        // Babylon normally uses parse information to inform the lexer to produce individual > tokens,
        // but hopefully we won't need that and can just act on the more naive tokenization.
        depth -= 2;
      } else if (this.tokens.matches(["<</>>"]) && this.tokens.currentToken().value === ">>>") {
        depth -= 3;
      }
      this.advance();
      if (depth < 0) {
        throw new Error("Unexpected negative depth when processing angle brackets.");
      }
      if (depth === 0) {
        break;
      }
    }
  }

  // tslint:disable-next-line no-any
  private advance(expectedLabel: string | null = null, expectedValue: any = null): void {
    const token = this.tokens.currentToken();
    if (!token) {
      throw new Error("Unexpectedly reached the end of the input.");
    }
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
   * Keywords can be property values, so don't consider them if we're after a dot or in an object
   * key.
   */
  private startsWithKeyword(keywords: Array<string>): boolean {
    if (this.tokens.matchesAtRelativeIndex(-1, ["."])) {
      return false;
    }
    if (
      this.getContextInfo().context === "object" &&
      (this.tokens.matchesAtRelativeIndex(1, [":"]) || this.tokens.matchesAtRelativeIndex(1, ["("]))
    ) {
      return false;
    }
    if (this.getContextInfo().context === "class" && this.tokens.matchesAtRelativeIndex(1, ["("])) {
      return false;
    }
    return keywords.some(
      (keyword) => this.tokens.matches([keyword]) || this.tokens.matchesName(keyword),
    );
  }
}
