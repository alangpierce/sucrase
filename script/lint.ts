#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import {exists} from "mz/fs";

import run from "./run";

const TSC = "./node_modules/.bin/tsc";
const TSLINT = "./node_modules/.bin/tslint";
const ESLINT = "./node_modules/.bin/eslint";

async function main(): Promise<void> {
  // Linting sub-projects requires the latest Sucrase types, so require a build first.
  if (!(await exists("./dist"))) {
    console.log("Must run build before lint, running build...");
    await run("yarn build");
  }
  await Promise.all([
    checkSucrase(),
    checkProject("./integrations/gulp-plugin"),
    checkProject("./integrations/jest-plugin"),
    checkProject("./integrations/webpack-loader"),
    checkProject("./integrations/webpack-object-rest-spread-plugin"),
    checkProject("./website"),
  ]);
}

async function checkSucrase(): Promise<void> {
  await Promise.all([
    run(`${TSC} --project . --noEmit`),
    run(`${TSLINT} --project .`),
    run(
      `${ESLINT} ${["benchmark", "example-runner", "generator", "script", "src", "test", "test262"]
        .map((dir) => `'${dir}/**/*.ts'`)
        .join(" ")}`,
    ),
  ]);
}

async function checkProject(path: string): Promise<void> {
  await Promise.all([
    run(`${TSC} --project ${path} --noEmit`),
    run(`${TSLINT} --project ${path}`),
    run(`${ESLINT} '${path}/src/**/*.{ts,tsx}'`),
  ]);
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
