import {join} from "path";
import {readdir, stat} from "fs/promises";
import {exec} from "child_process";
import {promisify} from "util";
const execPromise = promisify(exec);

describe("ts-node tests", async () => {
  /**
   * Find all integration tests in the test-cases directory.
   *
   * Each test has a file starting with "main" (e.g. main.ts, main.tsx,
   * main.mts, etc) that's used as the entry point. The test should be written
   * in such a way that the execution throws an exception if the test fails.
   */
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
      // To help confirm that the behavior is in sync with the default ts-node
      // behavior, first run ts-node without the plugin to make sure it works,
      // then run it with the plugin.
      await execPromise(`npx ts-node --esm --transpile-only ${testPath}`);
      await execPromise(
        `npx ts-node --esm --transpiler ${__dirname}/../ts-node-plugin ${testPath}`,
      );
    });
  }

  // Currently, mocha needs to be run with --delay to allow async test
  // generation like this, and that also requires explicitly invoking this run
  // callback.
  run();
});
