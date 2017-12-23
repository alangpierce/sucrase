export default abstract class Transformer {
  preprocess(): void {}

  // Return true if anything was processed, false otherwise.
  abstract process(): boolean;

  getPrefixCode(): string {
    return "";
  }

  getSuffixCode(): string {
    return "";
  }
}
