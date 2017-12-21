import TokenProcessor from "../TokenProcessor";

/**
 * For an import or export statement, check if this might be actually a property
 * name like in `{import: 1}`. If not, then we can trust that it's a real import
 * or export.
 */
export default function isMaybePropertyName(tokens: TokenProcessor, index: number): boolean {
  return (
    tokens.matchesAtIndex(index - 1, ["."]) ||
    tokens.matchesAtIndex(index + 1, [":"]) ||
    tokens.matchesAtIndex(index + 1, ["("])
  );
}
