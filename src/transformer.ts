import { Token } from './tokens';

export interface Transformer {
  preprocess(tokens: Array<Token>): void;
  // Return true if anything was processed, false otherwise.
  process(): boolean;
  getPrefixCode(): string;
}
