#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import run from "./run";

const TSC = "./node_modules/.bin/tsc";
const TSLINT = "./node_modules/.bin/tslint";
const ESLINT = "./node_modules/.bin/eslint";

async function main(): Promise<void> {
  await Promise.all([
    checkSucrase(),
    checkIntegration("./integrations/gulp-plugin"),
    checkIntegration("./integrations/jest-plugin"),
    checkIntegration("./integrations/webpack-loader"),
    checkIntegration("./integrations/webpack-object-rest-spread-plugin"),
  ]);
}

async function checkSucrase(): Promise<void> {
  await Promise.all([
    run(`${TSC} --project . --noEmit`),
    run(`${TSLINT} --project .`),
    run(
      `${ESLINT} ${["benchmark", "example-runner", "generator", "script", "src", "test"]
        .map((dir) => `'${dir}/**/*.ts'`)
        .join(" ")}`,
    ),
  ]);
}

async function checkIntegration(path: string): Promise<void> {
  await Promise.all([
    run(`${TSC} --project ${path} --noEmit`),
    run(`${TSLINT} --project ${path}`),
    run(`${ESLINT} '${path}/src/**/*.ts'`),
  ]);
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
