import {readFile} from "fs/promises";

export async function readFileContents(path: string): Promise<string> {
  return (await readFile(path)).toString();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJSONFileContents(path: string): Promise<any> {
  return JSON.parse(await readFileContents(path));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJSONFileContentsIfExists(path: string): Promise<any> {
  try {
    return JSON.parse(await readFileContents(path));
  } catch (e) {
    if ((e as {code: string}).code === "ENOENT") {
      return null;
    } else {
      throw e;
    }
  }
}
