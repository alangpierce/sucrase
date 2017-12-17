export default interface IdentifierReplacer {
  getIdentifierReplacement(identifierName: string): string | null;
}
