#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import mergeDirectoryContents from "./mergeDirectoryContents";
import run from "./run";

const SUCRASE = "./node_modules/.bin/sucrase";
const SUCRASE_SELF = "./bin/sucrase";
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
    () => buildWebsite(),
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
  await run(`${SUCRASE} ./src -d ./dist --transforms imports,typescript -q`);
  if (!fast) {
    await run(`rm -rf ./dist-self-build`);
    await run(`rm -rf ./dist-types`);
    // The installed Sucrase version is always the previous version, but released versions of
    // Sucrase should be self-compiled, so we do a multi-phase compilation. We compile Sucrase with
    // the previous version, then use it to compile the current code, then use that to compile the
    // code again. The second and third outputs should be exactly identical; otherwise we may have a
    // problem where it miscompiled itself.
    await run(`${SUCRASE_SELF} ./src -d ./dist-self-build --transforms imports,typescript -q`);
    await run(
      `${SUCRASE_SELF} ./src -d ./dist-self-build --transforms typescript --out-extension mjs -q`,
    );
    await run("rm -rf ./dist");
    await run("mv ./dist-self-build ./dist");
    await run(`${SUCRASE_SELF} ./src -d ./dist-self-build --transforms imports,typescript -q`);
    await run(
      `${SUCRASE_SELF} ./src -d ./dist-self-build --transforms typescript --out-extension mjs -q`,
    );
    await run("diff -r ./dist ./dist-self-build");
    // Also add in .d.ts files from tsc, which only need to be compiled once.
    await run(
      `${TSC} --emitDeclarationOnly --declaration --isolatedModules false --project ./src --outDir ./dist-types`,
    );
    await mergeDirectoryContents("./dist-types/src", "./dist");
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
  await run(`${SUCRASE} ${path}/src -d ${path}/dist --transforms imports,typescript -q`);

  if (!fast) {
    await run(
      `${TSC} --emitDeclarationOnly --declaration --isolatedModules false --project ${path} --outDir ${path}/dist`,
    );
  }
}

/**
 * Just runs yarn for the website to prepare it for lint.
 */
async function buildWebsite(): Promise<void> {
  if (!fast) {
    console.log("Installing website dependencies");
    const originalDir = process.cwd();
    process.chdir("./website");
    await run("yarn");
    await run("yarn link sucrase");
    process.chdir(originalDir);
  }
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
