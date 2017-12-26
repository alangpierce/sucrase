import TokenProcessor, {Token, TokenContext} from "./TokenProcessor";

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

    const advance = () => {
      const token = this.tokens.currentToken();
      const contextInfo = this.contextStack[this.contextStack.length - 1];
      const parentContextInfo = this.contextStack[this.contextStack.length - 2];
      token.contextName = contextInfo.context;
      token.contextStartIndex = contextInfo.startIndex;
      token.parentContextStartIndex = parentContextInfo ? parentContextInfo.startIndex : null;
      this.tokens.nextToken();
    };

    for (const label of openingTokenLabels) {
      this.tokens.expectToken(label);
      advance();
    }

    let pendingClass = false;
    while (true) {
      if (this.tokens.matches([...closingTokenLabels, ...followingLabels])) {
        for (let i = 0; i < closingTokenLabels.length; i++) {
          advance();
        }
        break;
      }

      if (this.tokens.isAtEnd()) {
        throw new Error("Unexpected end of program when preprocessing tokens.");
      }

      if (this.startsWithKeyword(["if", "for", "while", "catch"])) {
        // Code of the form TOKEN (...) BLOCK
        if (this.tokens.matches(["("])) {
          this.tokens.expectToken("(");
          advance();
          this.processToToken("(", ")", "parens");
          if (this.tokens.matches(["{"])) {
            this.processToToken("{", "}", "block");
          }
        } else {
          advance();
        }
      } else if (this.startsWithKeyword(["function"])) {
        advance();
        if (this.tokens.matches(["name"])) {
          advance();
        }
        // TODO: Handle return type annotations.
        if (this.tokens.matches(["{"])) {
          this.processToToken("(", ")", "parens");
          if (this.tokens.matches(["{"])) {
            this.processToToken("{", "}", "block");
          }
        }
      } else if (
        this.startsWithKeyword(["=>", "else", "try", "finally", "do"]) ||
        (this.tokens.matches([";"]) && context === "block")
      ) {
        advance();
        if (this.tokens.matches(["{"])) {
          this.processToToken("{", "}", "block");
        }
      } else if (this.startsWithKeyword(["class"])) {
        advance();
        pendingClass = true;
      } else if (this.startsWithKeyword(["default"])) {
        advance();
        if (this.tokens.matches([":", "{"])) {
          advance();
          this.processToToken("{", "}", "block");
        }
      } else if (this.tokens.matches(["name"])) {
        advance();
        if (context === "class" && this.tokens.matches(["("])) {
          // Process class method.
          this.processToToken("(", ")", "parens");
          if (this.tokens.matches(["{"])) {
            this.processToToken("{", "}", "block");
          }
        } else if (
          context === "object" &&
          this.tokens.matches(["("]) &&
          (this.tokens.matchesAtRelativeIndex(-2, [","]) ||
            this.tokens.matchesAtRelativeIndex(-2, ["{"]))
        ) {
          // Process object method.
          this.processToToken("(", ")", "parens");
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
        advance();
      }
    }

    this.contextStack.pop();
  }

  /**
   * Keywords can be property values, so don't consider them if we're after a
   * dot.
   */
  startsWithKeyword(keywords: Array<string>): boolean {
    return (
      !this.tokens.matchesAtRelativeIndex(-1, ["."]) &&
      keywords.some((keyword) => this.tokens.matches([keyword]))
    );
  }
}
