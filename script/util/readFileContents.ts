import {readFile} from "mz/fs";

export async function readFileContents(path: string): Promise<string> {
  return (await readFile(path)).toString();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJSONFileContents(path: string): Promise<any> {
  return JSON.parse(await readFileContents(path));
}
