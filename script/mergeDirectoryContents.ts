import {existsSync} from "fs";
import {copyFile, mkdir, readdir, stat} from "fs/promises";
import {join} from "path";

export default async function mergeDirectoryContents(
  srcDirPath: string,
  destDirPath: string,
): Promise<void> {
  if (!existsSync(destDirPath)) {
    await mkdir(destDirPath);
  }
  for (const child of await readdir(srcDirPath)) {
    const srcChildPath = join(srcDirPath, child);
    const destChildPath = join(destDirPath, child);
    if ((await stat(srcChildPath)).isDirectory()) {
      await mergeDirectoryContents(srcChildPath, destChildPath);
    } else {
      await copyFile(srcChildPath, destChildPath);
    }
  }
}
