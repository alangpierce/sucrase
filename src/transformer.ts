import { Token } from './tokens';

export interface Transformer {
  preprocess(): void;
  // Return true if anything was processed, false otherwise.
  process(): boolean;
  getPrefixCode(): string;
  getSuffixCode(): string;
}
