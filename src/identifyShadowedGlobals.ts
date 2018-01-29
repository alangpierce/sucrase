import {IdentifierRole, Token} from "../sucrase-babylon/tokenizer";
import {Scope} from "../sucrase-babylon/tokenizer/state";

/**
 * Traverse the given tokens and modify them if necessary to indicate that some names shadow global
 * variables.
 */
export default function identifyShadowedGlobals(
  tokens: Array<Token>,
  scopes: Array<Scope>,
  globalNames: Set<string>,
): void {
  if (!hasShadowedGlobals(tokens, globalNames)) {
    return;
  }
  markShadowedGlobals(tokens, scopes, globalNames);
}

/**
 * We can do a fast up-front check to see if there are any declarations to global names. If not,
 * then there's no point in computing scope assignments.
 */
function hasShadowedGlobals(tokens: Array<Token>, globalNames: Set<string>): boolean {
  for (const token of tokens) {
    if (
      token.type.label === "name" &&
      (token.identifierRole === IdentifierRole.FunctionScopedDeclaration ||
        token.identifierRole === IdentifierRole.BlockScopedDeclaration) &&
      globalNames.has(token.value)
    ) {
      return true;
    }
  }
  return false;
}

function markShadowedGlobals(
  tokens: Array<Token>,
  scopes: Array<Scope>,
  globalNames: Set<string>,
): void {
  const scopeStack = [];
  let scopeIndex = scopes.length - 1;
  // Scopes were generated at completion time, so they're sorted by end index, so we can maintain a
  // good stack by going backwards through them.
  for (let i = tokens.length - 1; ; i--) {
    while (scopeStack.length > 0 && scopeStack[scopeStack.length - 1].startTokenIndex === i + 1) {
      scopeStack.pop();
    }
    while (scopeIndex >= 0 && scopes[scopeIndex].endTokenIndex === i + 1) {
      scopeStack.push(scopes[scopeIndex]);
      scopeIndex--;
    }
    // Process scopes after the last iteration so we can make sure we pop all of them.
    if (i < 0) {
      break;
    }

    const token = tokens[i];
    if (scopeStack.length > 1 && token.type.label === "name" && globalNames.has(token.value)) {
      if (token.identifierRole === IdentifierRole.BlockScopedDeclaration) {
        markShadowedForScope(scopeStack[scopeStack.length - 1], tokens, token.value);
      } else if (token.identifierRole === IdentifierRole.FunctionScopedDeclaration) {
        let stackIndex = scopeStack.length - 1;
        while (stackIndex > 0 && !scopeStack[stackIndex].isFunctionScope) {
          stackIndex--;
        }
        if (stackIndex < 0) {
          throw new Error("Did not find parent function scope.");
        }
        markShadowedForScope(scopeStack[stackIndex], tokens, token.value);
      }
    }
  }
  if (scopeStack.length > 0) {
    throw new Error("Expected empty scope stack after processing file.");
  }
}

function markShadowedForScope(scope: Scope, tokens: Array<Token>, name: string): void {
  for (let i = scope.startTokenIndex; i < scope.endTokenIndex; i++) {
    const token = tokens[i];
    if (token.type.label === "name" && token.value === name) {
      token.shadowsGlobal = true;
    }
  }
}
