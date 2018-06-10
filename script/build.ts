#!./script/sucrase-node
/* eslint-disable no-console */
import run from "./run";

const SUCRASE = "./node_modules/.bin/sucrase";
const TSC = "./node_modules/.bin/tsc";

// Fast mode is useful for development. It runs all builds in parallel and does not generate types
// or update dependencies.
const fast = process.argv.includes("--fast");

async function main(): Promise<void> {
  const promiseFactories = [
    () => buildSucrase(),
    () => buildIntegration("./integrations/gulp-plugin"),
    () => buildIntegration("./integrations/jest-plugin"),
    () => buildIntegration("./integrations/webpack-loader"),
    () => buildIntegration("./integrations/webpack-object-rest-spread-plugin"),
  ];
  if (fast) {
    await Promise.all(promiseFactories.map((f) => f()));
  } else {
    for (const f of promiseFactories) {
      await f();
    }
  }
}

async function buildSucrase(): Promise<void> {
  console.log("Building Sucrase");
  await run(`rm -rf ./dist`);
  await run(`${SUCRASE} ./src -d ./dist --transforms imports,typescript`);
  if (!fast) {
    await run(`${TSC} --emitDeclarationOnly --project ./src --outDir ./dist`);
    // Link all integrations to Sucrase so that all building/linting/testing is up to date.
    await run("yarn link");
  }
}

async function buildIntegration(path: string): Promise<void> {
  console.log(`Building ${path}`);
  if (!fast) {
    const originalDir = process.cwd();
    process.chdir(path);
    await run("yarn");
    await run("yarn link sucrase");
    process.chdir(originalDir);
  }

  await run(`rm -rf ${path}/dist`);
  await run(`${SUCRASE} ${path}/src -d ${path}/dist --transforms imports,typescript`);

  if (!fast) {
    await run(`${TSC} --emitDeclarationOnly --project ${path} --outDir ${path}/dist`);
  }
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
});
