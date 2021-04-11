export default abstract class Transformer {
  // Return true if anything was processed, false otherwise.
  abstract process(): boolean;

  getPrefixCode(): string {
    return "";
  }

  getHoistedCode(): string {
    return "";
  }

  getSuffixCode(): string {
    return "";
  }
}
