import assert from "assert";
import {exec} from "child_process";
import {readdirSync, statSync} from "fs";
import {rm, writeFile} from "fs/promises";
import {join, dirname, resolve, basename} from "path";
import {promisify} from "util";

import {
  readFileContents,
  readJSONFileContents,
  readJSONFileContentsIfExists,
} from "../script/util/readFileContents";
import assertDirectoriesEqual from "./util/assertDirectoriesEqual";

const execPromise = promisify(exec);

describe("integration tests", () => {
  const originalCwd = process.cwd();
  afterEach(() => {
    process.chdir(originalCwd);
  });

  /**
   * Traverse the given directory for all subdirectories containing any file
   * matching a prefix. We use sync methods here to avoid complexity around
   * Mocha's --delay option.
   */
  function* discoverTests(dir: string, filePrefix: string): Iterable<string> {
    for (const child of readdirSync(dir)) {
      const childPath = join(dir, child);
      if (statSync(childPath).isDirectory()) {
        yield* discoverTests(childPath, filePrefix);
      } else if (child.startsWith(filePrefix)) {
        yield childPath;
      }
    }
  }

  /**
   * Find sucrase/register integration tests.
   *
   * Each test has a file starting with "main" (e.g. main.ts, main.tsx,
   * main.mts, etc) that's used as the entry point. The test should be written
   * in such a way that the execution throws an exception if the test fails.
   */
  for (const testFile of discoverTests("test-cases/register-cases", "main")) {
    const testDir = dirname(testFile);
    it(testDir, async () => {
      process.chdir(testDir);
      const testConfig = await readJSONFileContentsIfExists("./test.json");
      let envPrefix = "";
      if (testConfig?.sucraseOptions) {
        envPrefix = `SUCRASE_OPTIONS='${JSON.stringify(testConfig.sucraseOptions)}' `;
      }
      await execPromise(`${envPrefix}node -r ${__dirname}/../register ${basename(testFile)}`);
    });
  }

  /**
   * Find Jest integration tests.
   *
   * Each test directory has a jest.config.js and a test that should pass when
   * run.
   */
  for (const testFile of discoverTests("test-cases/jest-cases", "jest.config.js")) {
    const testDir = dirname(testFile);
    it(testDir, async () => {
      process.chdir(testDir);
      const testConfig = await readJSONFileContentsIfExists("./test.json");
      if (testConfig?.expectedError) {
        try {
          await execPromise(`NODE_OPTIONS=--experimental-vm-modules npx jest --no-cache`);
          assert.fail("Expected Jest to fail");
        } catch (e) {
          assert((e as {stderr: string}).stderr.includes(testConfig.expectedError));
        }
      } else {
        // Should not crash.
        await execPromise(`NODE_OPTIONS=--experimental-vm-modules npx jest --no-cache`);
      }
    });
  }

  it("allows Jest inline snapshots", async () => {
    process.chdir("./test-cases/other-cases/allows-inline-snapshots");
    const originalContents = await readFileContents("./main.test.ts");
    assert(originalContents.includes("toMatchInlineSnapshot()"));
    try {
      await execPromise(`npx jest --no-cache --updateSnapshot`);
      // Running the test should have worked and updated the inline snapshot.
      const newContents = await readFileContents("./main.test.ts");
      assert(newContents.includes("toMatchInlineSnapshot(`3`)"));
    } finally {
      await writeFile("./main.test.ts", originalContents);
    }
  });

  /**
   * Find ts-node integration tests.
   *
   * Each test has a file starting with "main" (e.g. main.ts, main.tsx,
   * main.mts, etc) that's used as the entry point. The test should be written
   * in such a way that the execution throws an exception if the test fails.
   */
  for (const testFile of discoverTests("test-cases/ts-node-cases", "main")) {
    it(testFile, async () => {
      // To help confirm that the behavior is in sync with the default ts-node
      // behavior, first run ts-node without the plugin to make sure it works,
      // then run it with the plugin.
      await execPromise(`npx ts-node --esm --transpile-only ${testFile}`);
      await execPromise(
        `npx ts-node --esm --transpiler ${__dirname}/../ts-node-plugin ${testFile}`,
      );
    });
  }

  /**
   * Find CLI integration tests.
   *
   * Each test must have a test.json file and directories "src" and
   * "dist-expected". The Sucrase CLI is invoked with cliOptions and the result
   * is expected to exactly match dist-expected.
   */
  for (const testFile of discoverTests("test-cases/cli-cases", "test.json")) {
    const testDir = dirname(testFile);
    it(testDir, async () => {
      process.chdir(testDir);
      const testConfig = await readJSONFileContents("./test.json");
      await rm("./dist-actual", {recursive: true, force: true});
      await execPromise(
        `${__dirname}/../bin/sucrase ./src --out-dir ./dist-actual ${testConfig.cliOptions}`,
      );
      await assertDirectoriesEqual(resolve("./dist-actual"), resolve("./dist-expected"));
    });
  }
});
