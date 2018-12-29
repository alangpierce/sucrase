import "mz/fs";

declare module "mz/fs" {
  // copyFile isn't in the typedefs yet, so add it manually.
  export function copyFile(oldPath: string, newPath: string): Promise<void>;
}
