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
  for (const result of harnessOutput) {
    if (!result.result.pass) {
      numFailed++;
      console.error(`${chalk.bold(chalk.bgRed("FAIL"))} ${chalk.bold(result.file)}`);
      console.error(result.result.message);
      console.error(`stdout:\n${result.rawResult.stdout}`);
      console.error(`stderr:\n${result.rawResult.stderr}`);
      console.error();
    } else {
      numPassed++;
    }
  }
  console.log(`${numPassed} passed, ${numFailed} failed`);
  if (numFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
