/* eslint-disable no-console */
// @ts-ignore: Babel package missing types.
import * as babel from "@babel/core";
import {exists, readdir, readFile, stat} from "mz/fs";
import {join, relative, resolve} from "path";

import run from "../../script/run";
import {readFileContents, readJSONFileContents} from "../../script/util/readFileContents";
import {transform, type Transform} from "../../src";

const BABEL_TESTS_DIR = "./spec-compliance-tests/babel-tests/babel-tests-checkout";
const FIXTURES_DIR = `${BABEL_TESTS_DIR}/packages/babel-parser/test/fixtures`;
const BABEL_REPO_URL = "https://github.com/babel/babel.git";
const BABEL_REVISION = "bcf8b2273b8cba44c9b93c8977f05d508bfc1b91";

/*
 * TODO: Work through these failures to better understand and characterize them.
 *
 * There seem to be a few categories of test failures:
 * - Real errors that should be fixed when possible.
 * - Cases that are so obscure and hard to implement that Sucrase intentionally
 *   skips them. These should ideally have an inline explanation here.
 * - Cases that are unsupported in Sucrase but are flagged as failures, e.g.
 *   syntax not part of the spec that is supported by Babel. Many of these may
 *   be possible to fix automatically by improving the step where we run Babel
 *   to see if it also fails.
 */
const KNOWN_FAILURES = `
es2015/let/let-declaration-in-escape-id
es2015/yield/accessor-name-inst-computed-yield-expr
es2015/yield/basic-without-argument
es2015/yield/without-argument
es2018/async-generators/for-await-async-of
es2020/bigint/decimal-as-property-name
estree/class-private-property/flow
experimental/decorators/parenthesized  // Uses obsolete syntax @(a)()
experimental/decorators/parenthesized-createParenthesizedExpressions  // Uses obsolete syntax @(a)()
flow/anonymous-function-no-parens-types/good_15
flow/arrows-in-ternaries/issue-13644
flow/arrows-in-ternaries/issue-58
flow/arrows-in-ternaries/param-type-and-return-type-like
flow/class-private-property/declare-field
flow/class-properties/declare-after-decorators
flow/class-properties/declare-field
flow/class-properties/declare-field-computed
flow/class-properties/declare-field-named-static
flow/class-properties/declare-field-with-type
flow/class-properties/declare-static-field
flow/classes/good_01
flow/declare-export/export-class
flow/declare-export/export-default-union
flow/declare-export/export-from
flow/declare-export/export-function
flow/declare-export/export-interface
flow/declare-export/export-interface-and-var
flow/declare-export/export-interface-commonjs
flow/declare-export/export-named-pattern
flow/declare-export/export-star
flow/declare-export/export-type
flow/declare-export/export-type-and-var
flow/declare-export/export-type-commonjs
flow/declare-export/export-type-star-from
flow/declare-export/export-var
flow/declare-module/3
flow/declare-module/4
flow/declare-module/5
flow/declare-module/6
flow/declare-module/9
flow/multiple-declarations/declare-class
flow/object-types/getter-key-is-keyword
flow/opaque-type-alias/opaque_subtype_allow_export
flow/opaque-type-alias/opaque_type_allow_export
flow/regression/issue-166
flow/scope/declare-module
flow/this-annotation/function-type
flow/typecasts/yield
jsx/basic/3
typescript/export/as-namespace
typescript/import/export-import
typescript/import/export-import-require
typescript/import/export-import-type-as-identifier
typescript/import/export-import-type-require
typescript/import/type-asi
typescript/import/type-equals-require
`
  .split("\n")
  .filter((s) => s)
  .map((s) => s.split(" ")[0]);

interface ResultSummary {
  numPassed: number;
  numFailed: number;
  numSkipped: number;
  failures: Array<string>;
}

/**
 * Script that clones the Babel repo, walks its parser tests, and tries them in
 * Sucrase. If they fail in Sucrase but pass with Babel in a Sucrase-like
 * configuration, this likely indicates a syntax edge case that Sucrase isn't
 * handling correctly. With any fixes, new tests should be added to the core
 * Sucrase test suite, but this suite helps provide confidence that Sucrase is
 * handling the important language edge cases.
 */
async function main(): Promise<void> {
  if (!(await exists(BABEL_TESTS_DIR))) {
    console.log(`Directory ${BABEL_TESTS_DIR} not found, cloning a new one.`);
    await run(`git clone ${BABEL_REPO_URL} ${BABEL_TESTS_DIR}`);
  }

  // Force a specific revision so we don't get a breakage from changes to the main branch.
  const originalCwd = process.cwd();
  try {
    process.chdir(BABEL_TESTS_DIR);
    await run(`git reset --hard ${BABEL_REVISION}`);
    await run(`git clean -f`);
  } catch (e) {
    await run("git fetch");
    await run(`git reset --hard ${BABEL_REVISION}`);
    await run(`git clean -f`);
  } finally {
    process.chdir(originalCwd);
  }

  console.log("Checking babel tests...");
  const resultSummary: ResultSummary = {
    numPassed: 0,
    numFailed: 0,
    numSkipped: 0,
    failures: [],
  };

  await checkTests(FIXTURES_DIR, resultSummary);
  reportSummary(resultSummary);
}

function reportSummary({numPassed, numFailed, numSkipped, failures}: ResultSummary): void {
  const unexpectedFailures = failures.filter((dir) => !KNOWN_FAILURES.includes(dir));
  const unexpectedPassed = KNOWN_FAILURES.filter((dir) => !failures.includes(dir));

  console.log();
  console.log("Failures, including expected failures:");
  console.log(failures.join("\n"));
  console.log();
  console.log(
    `Summary: ${numFailed} failed (${KNOWN_FAILURES.length} expected), ${numPassed} passed, ${numSkipped} skipped`,
  );
  console.log();

  if (unexpectedPassed.length > 0) {
    console.log("The following tests passed even though they are marked as failing:");
    console.log(unexpectedPassed.join("\n"));
    console.log();
    process.exitCode = 1;
  }

  if (unexpectedFailures.length > 0) {
    console.log("The following tests failed unexpectedly:");
    console.log(unexpectedFailures.join("\n"));
    console.log();
    process.exitCode = 1;
  }
}

async function checkTests(dir: string, resultSummary: ResultSummary): Promise<void> {
  for (const child of await readdir(dir)) {
    const childPath = join(dir, child);
    if ((await stat(childPath)).isDirectory()) {
      await checkTests(childPath, resultSummary);
    }
  }
  await checkTestForDir(dir, resultSummary);
}

async function checkTestForDir(dir: string, resultSummary: ResultSummary): Promise<void> {
  const displayDir = relative(FIXTURES_DIR, dir);
  const outputJSONPath = join(dir, "output.json");
  if (!(await exists(outputJSONPath))) {
    return;
  }

  const outputJSON = JSON.parse((await readFile(outputJSONPath)).toString());
  if (outputJSON.throws || outputJSON.errors) {
    console.log(`SKIPPED: ${displayDir} (expects error)`);
    resultSummary.numSkipped++;
  } else {
    const code = await getTestCode(dir);
    const babelPlugins = await getBabelPlugins(dir);

    const sucraseTransforms = [];
    if (babelPlugins.includes("typescript")) {
      sucraseTransforms.push("typescript");
    }

    try {
      runSucrase(code, babelPlugins);
      console.log(`PASSED: ${displayDir}`);
      resultSummary.numPassed++;
    } catch (e) {
      // If Babel fails on this case as well, don't consider it an error.
      try {
        runBabel(code, babelPlugins);
        console.log(`FAILED: ${displayDir}`);
        console.log(e);
        resultSummary.numFailed++;
        resultSummary.failures.push(displayDir);
      } catch (e2) {
        console.log(`SKIPPED: ${displayDir} (Babel had parsing error)`);
        console.log(e2);
        resultSummary.numSkipped++;
      }
    }
  }
}

async function getTestCode(dir: string): Promise<string> {
  for (const extension of [".js", ".ts", ".tsx", ".mjs", ".cjs"]) {
    const filePath = join(dir, `input${extension}`);
    if (await exists(filePath)) {
      return readFileContents(filePath);
    }
  }
  throw new Error(`Unable to find code file in ${dir}`);
}

/**
 * Get the configured babel plugins for the given test, which requires
 * traversing parent directories for options.json files.
 */
async function getBabelPlugins(testDir: string): Promise<Array<string>> {
  const plugins: Array<string> = [];
  let dir = testDir;
  while (resolve(dir) !== resolve(FIXTURES_DIR)) {
    const optionsJSONPath = join(dir, "options.json");
    if (await exists(optionsJSONPath)) {
      const options = await readJSONFileContents(optionsJSONPath);
      if (options.plugins) {
        plugins.push(
          ...options.plugins.map((option: string | [string, ...Array<unknown>]) =>
            typeof option === "string" ? option : option[0],
          ),
        );
      }
    }
    dir = resolve(dir, "..");
  }
  return plugins;
}

function runSucrase(code: string, babelPlugins: Array<string>): void {
  const transforms: Array<Transform> = (["jsx", "flow", "typescript"] as const).filter((t) =>
    babelPlugins.includes(t),
  );
  transform(code, {transforms});
  transform(code, {transforms: [...transforms, "imports"]});
}

function runBabel(code: string, babelPlugins: Array<string>): void {
  const plugins: Array<unknown> = ["jsx", "flow", "typescript"].filter((t) =>
    babelPlugins.includes(t),
  );
  plugins.push(["decorators", {version: "2021-12", decoratorsBeforeExport: false}]);
  babel.parse(code, {sourceType: "module", parserOpts: {plugins}});
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
