#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import chalk from "chalk";
import {exec} from "mz/child_process";
import {exists} from "mz/fs";

import run from "../script/run";

const TEST262_HARNESS = "./node_modules/.bin/test262-harness";
const TEST262_DIR = "./test262/test262-checkout";
const TEST262_REPO_URL = "https://github.com/tc39/test262.git";
const TEST262_REVISION = "157b18d16b5d52501c4d75ac422d3a80bfad1c17";

const SKIPPED_TESTS = [
  // This test fails due to an unhandled promise rejection that seems to be unrelated to the use of
  // optional chaining.
  "language/expressions/optional-chaining/member-expression-async-identifier.js",
  // This file tests a number of cases like (a?.b)(), which are currently considered out of scope.
  // See tech plan at:
  // https://github.com/alangpierce/sucrase/wiki/Sucrase-Optional-Chaining-and-Nullish-Coalescing-Technical-Plan
  "language/expressions/optional-chaining/optional-call-preserves-this.js",
];

/**
 * Run the test262 suite on some tests that we know are useful.
 */
async function main(): Promise<void> {
  if (!(await exists(TEST262_DIR))) {
    console.log(`Directory ${TEST262_DIR} not found, cloning a new one.`);
    await run(`git clone ${TEST262_REPO_URL} ${TEST262_DIR}`);
  }

  // Force a specific revision so we don't get a breakage from changes to the master branch.
  const originalCwd = process.cwd();
  try {
    process.chdir(TEST262_DIR);
    await run(`git reset --hard ${TEST262_REVISION}`);
    await run(`git clean -f`);
  } catch (e) {
    await run("git fetch");
    await run(`git reset --hard ${TEST262_REVISION}`);
    await run(`git clean -f`);
  } finally {
    process.chdir(originalCwd);
  }

  console.log("Running test262...");
  const harnessStdout = (
    await exec(`${TEST262_HARNESS} \
    --preprocessor "./test262/test262Preprocessor.js" \
    --reporter "json" \
    "${TEST262_DIR}/test/language/expressions/coalesce/**/*.js" \
    "${TEST262_DIR}/test/language/expressions/optional-chaining/**/*.js"`)
  )[0].toString();

  const harnessOutput = JSON.parse(harnessStdout);
  let numPassed = 0;
  let numFailed = 0;
  let numSkipped = 0;
  for (const result of harnessOutput) {
    if (!result.result.pass) {
      if (SKIPPED_TESTS.includes(result.relative)) {
        numSkipped++;
        console.error(`${chalk.bold(chalk.bgYellow("SKIP"))} ${chalk.bold(result.file)}`);
        console.error();
      } else {
        numFailed++;
        console.error(`${chalk.bold(chalk.bgRed("FAIL"))} ${chalk.bold(result.file)}`);
        console.error(result.result.message);
        console.error(`stdout:\n${result.rawResult.stdout}`);
        console.error(`stderr:\n${result.rawResult.stderr}`);
        console.error();
      }
    } else {
      numPassed++;
    }
  }
  console.log(`${numPassed} passed, ${numFailed} failed, ${numSkipped} skipped`);
  if (numFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
