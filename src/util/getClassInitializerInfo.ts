import {Token} from "../../sucrase-babylon/tokenizer";
import TokenProcessor from "../TokenProcessor";

export type ClassInitializerInfo = {
  // Array of non-semicolon-delimited code strings.
  initializerStatements: Array<string>;
  // Token index after which we should insert initializer statements (either the start of the
  // constructor, or after the super call), or null if there was no constructor.
  constructorInsertPos: number | null;
  fieldRanges: Array<{start: number; end: number}>;
};

/**
 * Get information about the class fields for this class, given a token processor pointing to the
 * open-brace at the start of the class.
 */
export default function getClassInitializerInfo(tokens: TokenProcessor): ClassInitializerInfo {
  tokens = tokens.clone();

  let constructorInitializers: Array<string> = [];
  const classInitializers: Array<string> = [];
  let constructorInsertPos = null;
  const fieldRanges = [];

  const classContextId = tokens.currentToken().contextId;
  if (classContextId == null) {
    throw new Error("Expected non-null class context ID on class open-brace.");
  }

  tokens.nextToken();
  while (!tokens.matchesContextIdAndLabel("}", classContextId)) {
    if (tokens.matchesName("constructor")) {
      ({constructorInitializers, constructorInsertPos} = processConstructor(tokens));
    } else if (tokens.matches([";"])) {
      tokens.nextToken();
    } else {
      // Either a regular method or a field. Skip to the identifier part.
      const statementStartIndex = tokens.currentIndex();
      while (isAccessModifier(tokens.currentToken())) {
        tokens.nextToken();
      }
      const nameCode = getNameCode(tokens);
      if (tokens.matches(["</>"]) || tokens.matches(["("])) {
        // This is a method, so just skip to the next method/field. To do that, we seek forward to
        // the next start of a class name (either an open bracket or an identifier, or the closing
        // curly brace), then seek backward to include any access modifiers.
        while (tokens.currentToken().contextId !== classContextId) {
          tokens.nextToken();
        }
        while (isAccessModifier(tokens.tokenAtRelativeIndex(-1))) {
          tokens.previousToken();
        }
        continue;
      }
      // There might be a type annotation that we need to skip.
      while (tokens.currentToken().isType) {
        tokens.nextToken();
      }
      if (tokens.matches(["="])) {
        const valueEnd = tokens.currentToken().rhsEndIndex;
        if (valueEnd == null) {
          throw new Error("Expected rhsEndIndex on class field assignment.");
        }
        tokens.nextToken();
        const assignExpressionStart = tokens.currentToken().start;
        while (tokens.currentIndex() < valueEnd) {
          tokens.nextToken();
        }
        // Note that this can adjust line numbers in the case of multiline string literals.
        const expressionCode = tokens.code.slice(
          assignExpressionStart,
          tokens.currentToken().start,
        );
        classInitializers.push(`this${nameCode} = ${expressionCode}`);
      }
      tokens.nextToken();
      fieldRanges.push({start: statementStartIndex, end: tokens.currentIndex()});
    }
  }

  return {
    initializerStatements: [...constructorInitializers, ...classInitializers],
    constructorInsertPos,
    fieldRanges,
  };
}

function processConstructor(
  tokens: TokenProcessor,
): {constructorInitializers: Array<string>; constructorInsertPos: number} {
  const constructorInitializers = [];

  tokens.nextToken();
  const constructorContextId = tokens.currentToken().contextId;
  if (constructorContextId == null) {
    throw new Error("Expected context ID on open-paren starting constructor params.");
  }
  tokens.nextToken();
  // Advance through parameters looking for access modifiers.
  while (!tokens.matchesContextIdAndLabel(")", constructorContextId)) {
    if (isAccessModifier(tokens.currentToken())) {
      tokens.nextToken();
      while (isAccessModifier(tokens.currentToken())) {
        tokens.nextToken();
      }
      const token = tokens.currentToken();
      if (token.type.label !== "name") {
        throw new Error("Expected identifier after access modifiers in constructor arg.");
      }
      const name = token.value;
      constructorInitializers.push(`this.${name} = ${name}`);
    }
    tokens.nextToken();
  }
  // )
  tokens.nextToken();
  let constructorInsertPos = tokens.currentIndex();

  // Advance through body looking for a super call.
  while (!tokens.matchesContextIdAndLabel("}", constructorContextId)) {
    if (tokens.matches(["super"])) {
      tokens.nextToken();
      const superCallContextId = tokens.currentToken().contextId;
      if (superCallContextId == null) {
        throw new Error("Expected a context ID on the super call");
      }
      while (!tokens.matchesContextIdAndLabel(")", superCallContextId)) {
        tokens.nextToken();
      }
      constructorInsertPos = tokens.currentIndex();
    }
    tokens.nextToken();
  }
  // }
  tokens.nextToken();

  return {constructorInitializers, constructorInsertPos};
}

/**
 * Determine if this is any token that can go before the name in a method/field.
 */
function isAccessModifier(token: Token): boolean {
  return [
    "async",
    "get",
    "set",
    "+/-",
    "readonly",
    "static",
    "public",
    "private",
    "protected",
  ].includes(token.type.label);
}

/**
 * The next token or set of tokens is either an identifier or an expression in square brackets, for
 * a method or field name. Get the code that would follow `this` to access this value. Note that a
 * more correct implementation would precompute computed field and method names, but that's harder,
 * and TypeScript doesn't do it, so we won't either.
 */
function getNameCode(tokens: TokenProcessor): string {
  if (tokens.matches(["["])) {
    const startToken = tokens.currentToken();
    const classContextId = startToken.contextId;
    if (classContextId == null) {
      throw new Error("Expected class context ID on computed name open bracket.");
    }
    while (!tokens.matchesContextIdAndLabel("]", classContextId)) {
      tokens.nextToken();
    }
    const endToken = tokens.currentToken();
    tokens.nextToken();
    return tokens.code.slice(startToken.start, endToken.end);
  } else {
    const nameToken = tokens.currentToken();
    tokens.nextToken();
    if (nameToken.type.label === "string" || nameToken.type.label === "num") {
      return `[${tokens.code.slice(nameToken.start, nameToken.end)}]`;
    } else {
      return `.${nameToken.value}`;
    }
  }
}
