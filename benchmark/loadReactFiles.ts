import {readdir, readFile, stat} from "mz/fs";
import {join} from "path";

export interface FileInfo {
  path: string;
  code: string;
}

export async function loadReactFiles(): Promise<Array<FileInfo>> {
  const results: Array<FileInfo> = [];
  async function visit(path: string): Promise<void> {
    for (const child of await readdir(path)) {
      if (["node_modules", ".git"].includes(child)) {
        continue;
      }
      const childPath = join(path, child);
      if ((await stat(childPath)).isDirectory()) {
        await visit(childPath);
      } else if (childPath.endsWith(".js")) {
        const code = (await readFile(childPath)).toString();
        results.push({code, path: childPath});
      }
    }
  }
  await visit("./example-runner/example-repos/react/packages");
  return results;
}
