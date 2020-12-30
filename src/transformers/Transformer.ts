export default abstract class Transformer {
  // @ts-ignore
  #foo;

  // Return true if anything was processed, false otherwise.
  abstract process(): boolean;

  getPrefixCode(): string {
    return "";
  }

  getSuffixCode(): string {
    return "";
  }
}
