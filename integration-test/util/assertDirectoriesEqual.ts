import * as assert from "assert";
import {readdir, readFile, stat} from "fs/promises";
import {join} from "path";

export default async function assertDirectoriesEqual(dir1: string, dir2: string): Promise<void> {
  const dir1Files = (await readdir(dir1)).sort();
  const dir2Files = (await readdir(dir2)).sort();
  assert.strictEqual(
    dir1Files.join(", "),
    dir2Files.join(", "),
    `Unexpected different lists of files for directories:\n${dir1}\n${dir2}`,
  );
  for (const filename of dir1Files) {
    const path1 = join(dir1, filename);
    const path2 = join(dir2, filename);
    const isDir1 = (await stat(path1)).isDirectory();
    const isDir2 = (await stat(path2)).isDirectory();
    assert.strictEqual(isDir1, isDir2, `Paths are different types:\n${path1}\n${path2}`);
    if (isDir1) {
      await assertDirectoriesEqual(path1, path2);
    } else {
      const contents1 = (await readFile(path1)).toString();
      const contents2 = (await readFile(path2)).toString();
      assert.strictEqual(contents1, contents2, `File contents differed:\n${path1}\n${path2}`);
    }
  }
}
