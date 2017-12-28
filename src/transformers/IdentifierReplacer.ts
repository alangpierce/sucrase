export interface IdentifierReplacer {
  getIdentifierReplacement(identifierName: string): string | null;
}
