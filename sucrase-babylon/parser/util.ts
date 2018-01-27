import Tokenizer from "../tokenizer";
import {TokenType, types as tt} from "../tokenizer/types";
import {lineBreak} from "../util/whitespace";

// ## Parser utilities

export default class UtilParser extends Tokenizer {
  // Tests whether parsed token is a contextual keyword.
  isContextual(name: string): boolean {
    return this.match(tt.name) && this.state.value === name;
  }

  isLookaheadContextual(name: string): boolean {
    const l = this.lookaheadTypeAndValue();
    return l.type === tt.name && l.value === name;
  }

  // Consumes contextual keyword if possible.
  eatContextual(name: string): boolean {
    return this.state.value === name && this.eat(tt.name);
  }

  // Asserts that following token is given contextual keyword.
  expectContextual(name: string, message?: string): void {
    if (!this.eatContextual(name)) this.unexpected(null, message);
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
      messageOrType = `Unexpected token, expected "${messageOrType.label}"`;
    }
    throw this.raise(pos != null ? pos : this.state.start, messageOrType);
  }
}
