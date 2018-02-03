import Tokenizer, {ContextualKeyword} from "../tokenizer";
import {formatTokenType, TokenType, TokenType as tt} from "../tokenizer/types";
import {lineBreak} from "../util/whitespace";

// ## Parser utilities

export default class UtilParser extends Tokenizer {
  // Tests whether parsed token is a contextual keyword.
  isContextual(contextualKeyword: ContextualKeyword): boolean {
    return this.state.contextualKeyword === contextualKeyword;
  }

  isLookaheadContextual(contextualKeyword: ContextualKeyword): boolean {
    const l = this.lookaheadTypeAndKeyword();
    return l.type === tt.name && l.contextualKeyword === contextualKeyword;
  }

  // Consumes contextual keyword if possible.
  eatContextual(contextualKeyword: ContextualKeyword): boolean {
    return this.state.contextualKeyword === contextualKeyword && this.eat(tt.name);
  }

  // Asserts that following token is given contextual keyword.
  expectContextual(contextualKeyword: ContextualKeyword): void {
    if (!this.eatContextual(contextualKeyword)) {
      this.unexpected(null);
    }
  }

  // Test whether a semicolon can be inserted at the current position.
  canInsertSemicolon(): boolean {
    return this.match(tt.eof) || this.match(tt.braceR) || this.hasPrecedingLineBreak();
  }

  hasPrecedingLineBreak(): boolean {
    const prevToken = this.state.tokens[this.state.tokens.length - 1];
    const lastTokEnd = prevToken ? prevToken.end : 0;
    return lineBreak.test(this.input.slice(lastTokEnd, this.state.start));
  }

  isLineTerminator(): boolean {
    return this.eat(tt.semi) || this.canInsertSemicolon();
  }

  // Consume a semicolon, or, failing that, see if we are allowed to
  // pretend that there is a semicolon at this position.
  semicolon(): void {
    if (!this.isLineTerminator()) this.unexpected(null, tt.semi);
  }

  // Expect a token of a given type. If found, consume it, otherwise,
  // raise an unexpected token error at given pos.
  expect(type: TokenType, pos?: number | null): void {
    const matched = this.eat(type);
    if (!matched) {
      this.unexpected(pos, type);
    }
  }

  // Raise an unexpected token error. Can take the expected token type
  // instead of a message string.
  unexpected(
    pos: number | null = null,
    messageOrType: string | TokenType = "Unexpected token",
  ): never {
    if (typeof messageOrType !== "string") {
      messageOrType = `Unexpected token, expected "${formatTokenType(messageOrType)}"`;
    }
    throw this.raise(pos != null ? pos : this.state.start, messageOrType);
  }
}
