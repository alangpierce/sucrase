import {join} from "path";
import {readdir, stat} from "fs/promises";
import {exec} from "child_process";
import {promisify} from "util";
const execPromise = promisify(exec);

describe("ts-node tests", async () => {
  async function* discoverTests(dir: string): AsyncIterable<string> {
    for (const child of await readdir(dir)) {
      const childPath = join(dir, child);
      if ((await stat(childPath)).isDirectory()) {
        yield* discoverTests(childPath);
      } else if (child.startsWith("main")) {
        yield childPath;
      }
    }
  }

  for await (const testPath of discoverTests("test-cases")) {
    it(testPath, async () => {
      await execPromise(`npx ts-node --esm --transpile-only ${testPath}`);
      await execPromise(`npx ts-node --esm --transpiler ../../../ts-node-plugin ${testPath}`);
    });
  }

  // Currently, mocha needs to be run with --delay to allow async test
  // generation like this, and that also requires explicitly invoking this run
  // callback.
  run();
});
