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

  const classBlockStartIndex = tokens.currentToken().contextStartIndex!;
  tokens.nextToken();
  while (!tokens.matchesContextEnd("}", classBlockStartIndex)) {
    if (tokens.matchesName("constructor")) {
      ({constructorInitializers, constructorInsertPos} = processConstructor(tokens));
    } else if (tokens.matches([";"])) {
      tokens.nextToken();
    } else {
      // Either a regular method or a field. Skip to the identifier part.
      const statementStartIndex = tokens.currentIndex();
      while (isAccessModifier(tokens)) {
        tokens.nextToken();
      }
      const nameCode = getNameCode(tokens);
      if (tokens.matches(["</>"]) || tokens.matches(["("])) {
        // This is a method, so just skip to the close-brace at the end.
        while (
          !(
            tokens.matches(["}"]) &&
            tokens.currentToken().contextName === "block" &&
            tokens.currentToken().parentContextStartIndex === classBlockStartIndex
          )
        ) {
          tokens.nextToken();
        }
        tokens.nextToken();
        continue;
      }
      // This is a field, so skip to either an equals sign or a semicolon.
      while (
        !tokens.matchesContextEnd("=", classBlockStartIndex) &&
        !tokens.matchesContextEnd(";", classBlockStartIndex)
      ) {
        tokens.nextToken();
      }
      if (tokens.matches(["="])) {
        tokens.nextToken();
        const assignExpressionStart = tokens.currentToken().start;
        while (!tokens.matchesContextEnd(";", classBlockStartIndex)) {
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
  const parenStartIndex = tokens.currentToken().contextStartIndex!;
  tokens.nextToken();
  // Advance through parameters looking for access modifiers.
  while (!tokens.matchesContextEnd(")", parenStartIndex)) {
    if (isAccessModifier(tokens)) {
      tokens.nextToken();
      while (isAccessModifier(tokens)) {
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
  const constructorBodyStartIndex = tokens.currentToken().contextStartIndex!;

  // Advance through body looking for a super call.
  while (!tokens.matchesContextEnd("}", constructorBodyStartIndex)) {
    if (tokens.matches(["super"])) {
      tokens.nextToken();
      const superArgsStartIndex = tokens.currentToken().contextStartIndex!;
      while (!tokens.matchesContextEnd(")", superArgsStartIndex)) {
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
function isAccessModifier(tokens: TokenProcessor): boolean {
  return (
    tokens.matches(["async"]) ||
    tokens.matches(["get"]) ||
    tokens.matches(["set"]) ||
    tokens.matches(["+/-"]) ||
    tokens.matches(["readonly"]) ||
    tokens.matches(["static"]) ||
    tokens.matches(["public"]) ||
    tokens.matches(["private"]) ||
    tokens.matches(["protected"])
  );
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
    while (!tokens.matchesContextEnd("]", startToken.contextStartIndex!)) {
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
