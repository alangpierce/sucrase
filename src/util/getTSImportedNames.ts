import {ContextualKeyword} from "../parser/tokenizer";
import {TokenType as tt} from "../parser/tokenizer/types";
import TokenProcessor from "../TokenProcessor";

/**
 * Special case code to scan for imported names in ESM TypeScript. We need to do this so we can
 * properly get globals so we can compute shadowed globals.
 *
 * This is similar to logic in CJSImportProcessor, but trimmed down to avoid logic with CJS
 * replacement and flow type imports.
 */
export default function getTSImportedNames(tokens: TokenProcessor): Set<string> {
  const importedNames = new Set();
  for (let i = 0; i < tokens.tokens.length; i++) {
    if (
      tokens.matchesAtIndex(i, [tt._import]) &&
      !tokens.matchesAtIndex(i, [tt._import, tt.name, tt.eq])
    ) {
      collectNamesForImport(tokens, i, importedNames);
    }
  }
  return importedNames;
}

function collectNamesForImport(
  tokens: TokenProcessor,
  index: number,
  importedNames: Set<string>,
): void {
  index++;

  if (tokens.matchesAtIndex(index, [tt.parenL])) {
    // Dynamic import, so nothing to do
    return;
  }

  if (tokens.matchesAtIndex(index, [tt.name])) {
    importedNames.add(tokens.identifierNameAtIndex(index));
    index++;
    if (tokens.matchesAtIndex(index, [tt.comma])) {
      index++;
    }
  }

  if (tokens.matchesAtIndex(index, [tt.star])) {
    // * as
    index += 2;
    importedNames.add(tokens.identifierNameAtIndex(index));
    index++;
  }

  if (tokens.matchesAtIndex(index, [tt.braceL])) {
    index++;
    collectNamesForNamedImport(tokens, index, importedNames);
  }
}

function collectNamesForNamedImport(
  tokens: TokenProcessor,
  index: number,
  importedNames: Set<string>,
): void {
  while (true) {
    if (tokens.matchesAtIndex(index, [tt.braceR])) {
      return;
    }

    // We care about the local name, which might be the first token, or if there's an "as", is the
    // one after that.
    let name = tokens.identifierNameAtIndex(index);
    index++;
    if (tokens.matchesContextualAtIndex(index, ContextualKeyword._as)) {
      index++;
      name = tokens.identifierNameAtIndex(index);
      index++;
    }
    importedNames.add(name);
    if (tokens.matchesAtIndex(index, [tt.comma, tt.braceR])) {
      return;
    } else if (tokens.matchesAtIndex(index, [tt.braceR])) {
      return;
    } else if (tokens.matchesAtIndex(index, [tt.comma])) {
      index++;
    } else {
      throw new Error(`Unexpected token: ${JSON.stringify(tokens.tokens[index])}`);
    }
  }
}
