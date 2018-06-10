import {ContextualKeyword, Token} from "../parser/tokenizer";
import {TokenType as tt} from "../parser/tokenizer/types";
import TokenProcessor from "../TokenProcessor";
import RootTransformer from "../transformers/RootTransformer";

export type ClassHeaderInfo = {
  isExpression: boolean;
  className: string | null;
  hasSuperclass: boolean;
};

export type ClassInfo = {
  headerInfo: ClassHeaderInfo;
  // Array of non-semicolon-delimited code strings to go in the constructor, after super if
  // necessary.
  initializerStatements: Array<string>;
  // Array of static initializer statements, with the class name omitted. For example, if we need to
  // run `C.x = 3;`, an element of this array will be `.x = 3`.
  staticInitializerSuffixes: Array<string>;
  // Token index after which we should insert initializer statements (either the start of the
  // constructor, or after the super call), or null if there was no constructor.
  constructorInsertPos: number | null;
  fieldRanges: Array<{start: number; end: number}>;
};

/**
 * Get information about the class fields for this class, given a token processor pointing to the
 * open-brace at the start of the class.
 */
export default function getClassInfo(
  rootTransformer: RootTransformer,
  tokens: TokenProcessor,
): ClassInfo {
  const snapshot = tokens.snapshot();

  const headerInfo = processClassHeader(tokens);

  let constructorInitializers: Array<string> = [];
  const classInitializers: Array<string> = [];
  const staticInitializerSuffixes: Array<string> = [];
  let constructorInsertPos = null;
  const fieldRanges = [];

  const classContextId = tokens.currentToken().contextId;
  if (classContextId == null) {
    throw new Error("Expected non-null class context ID on class open-brace.");
  }

  tokens.nextToken();
  while (!tokens.matchesContextIdAndLabel(tt.braceR, classContextId)) {
    if (tokens.matchesContextual(ContextualKeyword._constructor)) {
      ({constructorInitializers, constructorInsertPos} = processConstructor(tokens));
    } else if (tokens.matches1(tt.semi)) {
      tokens.nextToken();
    } else {
      // Either a method or a field. Skip to the identifier part.
      const statementStartIndex = tokens.currentIndex();
      let isStatic = false;
      while (isAccessModifier(tokens.currentToken())) {
        if (tokens.matches1(tt._static)) {
          isStatic = true;
        }
        tokens.nextToken();
      }
      if (tokens.matchesContextual(ContextualKeyword._constructor)) {
        ({constructorInitializers, constructorInsertPos} = processConstructor(tokens));
        continue;
      }
      const nameCode = getNameCode(tokens);
      if (tokens.matches1(tt.lessThan) || tokens.matches1(tt.parenL)) {
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
      if (tokens.matches1(tt.eq)) {
        const valueEnd = tokens.currentToken().rhsEndIndex;
        if (valueEnd == null) {
          throw new Error("Expected rhsEndIndex on class field assignment.");
        }
        tokens.nextToken();
        const resultCodeStart = tokens.getResultCodeIndex();
        // We can't just take this code directly; we need to transform it as well, so delegate to
        // the root transformer, which has the same backing token stream. This will append to the
        // code, but the snapshot restore later will restore that.
        while (tokens.currentIndex() < valueEnd) {
          rootTransformer.processToken();
        }
        // Note that this can adjust line numbers in the case of multiline expressions.
        const expressionCode = tokens.getCodeInsertedSinceIndex(resultCodeStart);
        if (isStatic) {
          staticInitializerSuffixes.push(`${nameCode} =${expressionCode}`);
        } else {
          classInitializers.push(`this${nameCode} =${expressionCode}`);
        }
      }
      tokens.nextToken();
      fieldRanges.push({start: statementStartIndex, end: tokens.currentIndex()});
    }
  }

  tokens.restoreToSnapshot(snapshot);
  return {
    headerInfo,
    initializerStatements: [...constructorInitializers, ...classInitializers],
    staticInitializerSuffixes,
    constructorInsertPos,
    fieldRanges,
  };
}

function processClassHeader(tokens: TokenProcessor): ClassHeaderInfo {
  const classToken = tokens.currentToken();
  const contextId = classToken.contextId;
  if (contextId == null) {
    throw new Error("Expected context ID on class token.");
  }
  const isExpression = classToken.isExpression;
  if (isExpression == null) {
    throw new Error("Expected isExpression on class token.");
  }
  let className = null;
  let hasSuperclass = false;
  tokens.nextToken();
  if (tokens.matches1(tt.name)) {
    className = tokens.identifierName();
  }
  while (!tokens.matchesContextIdAndLabel(tt.braceL, contextId)) {
    if (tokens.matches1(tt._extends)) {
      hasSuperclass = true;
    }
    tokens.nextToken();
  }
  return {isExpression, className, hasSuperclass};
}

/**
 * Extract useful information out of a constructor, starting at the "constructor" name.
 */
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
  while (!tokens.matchesContextIdAndLabel(tt.parenR, constructorContextId)) {
    if (isAccessModifier(tokens.currentToken())) {
      tokens.nextToken();
      while (isAccessModifier(tokens.currentToken())) {
        tokens.nextToken();
      }
      const token = tokens.currentToken();
      if (token.type !== tt.name) {
        throw new Error("Expected identifier after access modifiers in constructor arg.");
      }
      const name = tokens.identifierNameForToken(token);
      constructorInitializers.push(`this.${name} = ${name}`);
    }
    tokens.nextToken();
  }
  // )
  tokens.nextToken();
  let constructorInsertPos = tokens.currentIndex();

  // Advance through body looking for a super call.
  while (!tokens.matchesContextIdAndLabel(tt.braceR, constructorContextId)) {
    if (tokens.matches1(tt._super)) {
      tokens.nextToken();
      const superCallContextId = tokens.currentToken().contextId;
      if (superCallContextId == null) {
        throw new Error("Expected a context ID on the super call");
      }
      while (!tokens.matchesContextIdAndLabel(tt.parenR, superCallContextId)) {
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
    tt._async,
    tt._get,
    tt._set,
    tt.plus,
    tt.minus,
    tt._readonly,
    tt._static,
    tt._public,
    tt._private,
    tt._protected,
    tt._abstract,
  ].includes(token.type);
}

/**
 * The next token or set of tokens is either an identifier or an expression in square brackets, for
 * a method or field name. Get the code that would follow `this` to access this value. Note that a
 * more correct implementation would precompute computed field and method names, but that's harder,
 * and TypeScript doesn't do it, so we won't either.
 */
function getNameCode(tokens: TokenProcessor): string {
  if (tokens.matches1(tt.bracketL)) {
    const startToken = tokens.currentToken();
    const classContextId = startToken.contextId;
    if (classContextId == null) {
      throw new Error("Expected class context ID on computed name open bracket.");
    }
    while (!tokens.matchesContextIdAndLabel(tt.bracketR, classContextId)) {
      tokens.nextToken();
    }
    const endToken = tokens.currentToken();
    tokens.nextToken();
    return tokens.code.slice(startToken.start, endToken.end);
  } else {
    const nameToken = tokens.currentToken();
    tokens.nextToken();
    if (nameToken.type === tt.string || nameToken.type === tt.num) {
      return `[${tokens.code.slice(nameToken.start, nameToken.end)}]`;
    } else {
      return `.${tokens.identifierNameForToken(nameToken)}`;
    }
  }
}
