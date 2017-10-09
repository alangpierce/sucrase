export interface Transformer {
  // Return true if anything was processed, false otherwise.
  process(): boolean;
  getPrefixCode(): string;
}
