import TokenProcessor, {Token, TokenContext} from "./TokenProcessor";

export default function augmentTokens(code: string, tokens: Array<Token>): void {
  new TokenPreprocessor(new TokenProcessor(code, tokens)).preprocess();
}

/**
 * Class that does a scan through the tokens to establish the "context" for each
 * token (like whether it's in a block or an object literal) and some other
 * useful information. This is needed, for example, to distinguish an array
 * element from an object shorthand.
 */
class TokenPreprocessor {
  constructor(readonly tokens: TokenProcessor) {}

  preprocess(): void {
    this.processToToken("eof", "block");
  }

  private processToToken(closingTokenLabel: string, context: TokenContext): void {
    this.processRegion([closingTokenLabel], context);
  }

  private processRegion(closingTokenLabels: Array<string>, context: TokenContext): void {
    const contextStartIndex = this.tokens.currentIndex();

    const advance = () => {
      const token = this.tokens.currentToken();
      token.contextName = context;
      token.contextStartIndex = contextStartIndex;
      this.tokens.nextToken();
    };

    let pendingClass = false;
    while (true) {
      if (this.tokens.isAtEnd()) {
        throw new Error("Unexpected end of program when preprocessing tokens.");
      }

      if (this.tokens.matches(closingTokenLabels)) {
        for (let i = 0; i < closingTokenLabels.length; i++) {
          advance();
        }
        break;
      }
      const lastToken = this.tokens.tokens[this.tokens.currentIndex() - 1];
      const token = this.tokens.currentToken();
      advance();

      // Keywords can be property values, so bail out if we're after a dot.
      if (!lastToken || lastToken.type.label !== ".") {
        if (
          token.type.label === "if" ||
          token.type.label === "for" ||
          token.type.label === "while" ||
          token.type.label === "catch" ||
          token.type.label === "function"
        ) {
          // Code of the form TOKEN (...) BLOCK
          if (token.type.label === "function" && this.tokens.matches(["name"])) {
            advance();
          }
          if (this.tokens.matches(["("])) {
            advance();
            this.processToToken(")", "parens");
            if (this.tokens.matches(["{"])) {
              advance();
              this.processToToken("}", "block");
            }
            continue;
          }
        } else if (
          token.type.label === "=>" ||
          token.type.label === "else" ||
          token.type.label === "try" ||
          token.type.label === "finally" ||
          token.type.label === "do" ||
          token.type.label === "}" ||
          token.type.label === ")" ||
          (token.type.label === ";" && context === "block")
        ) {
          if (this.tokens.matches(["{"])) {
            advance();
            this.processToToken("}", "block");
            continue;
          }
        } else if (token.type.label === "class") {
          pendingClass = true;
          continue;
        } else if (token.type.label === "default") {
          if (this.tokens.matches([":", "{"])) {
            advance();
            advance();
            this.processToToken("}", "block");
            continue;
          }
        }
      }

      if (token.type.label === "name") {
        if (context === "class" && this.tokens.matches(["("])) {
          // Process class method.
          advance();
          this.processToToken(")", "parens");
          if (this.tokens.matches(["{"])) {
            advance();
            this.processToToken("}", "block");
          }
        } else if (
          context === "object" &&
          this.tokens.matches(["("]) &&
          (this.tokens.matchesAtRelativeIndex(-2, [","]) ||
            this.tokens.matchesAtRelativeIndex(-2, ["{"]))
        ) {
          // Process object method.
          advance();
          this.processToToken(")", "parens");
          if (this.tokens.matches(["{"])) {
            advance();
            this.processToToken("}", "block");
          }
        }
      } else if (token.type.label === "case") {
        this.processToToken(":", "switchCaseCondition");
        if (this.tokens.matches(["{"])) {
          advance();
          this.processToToken("}", "block");
        }
      } else if (token.type.label === "jsxTagStart") {
        this.processToToken("jsxTagEnd", "jsxTag");
        // Non-self-closing tag, so use jsxChild context for the body.
        if (!this.tokens.matchesAtRelativeIndex(-2, ["/"])) {
          // All / tokens will be in JSX tags.
          this.processRegion(["jsxTagStart", "/"], "jsxChild");
          this.processToToken("jsxTagEnd", "jsxTag");
        }
      } else if (token.type.label === "{") {
        if (pendingClass && lastToken.type.label !== "extends") {
          this.processToToken("}", "class");
          pendingClass = false;
        } else if (context === "jsxTag" || context === "jsxChild") {
          this.processToToken("}", "jsxExpression");
        } else {
          this.processToToken("}", "object");
        }
      } else if (token.type.label === "[") {
        this.processToToken("]", "brackets");
      } else if (token.type.label === "(") {
        this.processToToken(")", "parens");
      } else if (token.type.label === "${") {
        this.processToToken("}", "templateExpr");
      }
    }
  }
}
