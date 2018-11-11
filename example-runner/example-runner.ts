#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import {exists, readFile} from "mz/fs";
import run from "../script/run";

const EXAMPLES = {
  decaffeinate: "https://github.com/decaffeinate/decaffeinate.git",
  "decaffeinate-parser": "https://github.com/decaffeinate/decaffeinate-parser.git",
  "coffee-lex": "https://github.com/decaffeinate/coffee-lex.git",
  babel: "https://github.com/babel/babel.git",
  react: "https://github.com/facebook/react.git",
  tslint: "https://github.com/palantir/tslint.git",
  "apollo-client": "https://github.com/apollographql/apollo-client.git",
};

const INTEGRATIONS = [
  "gulp-plugin",
  "jest-plugin",
  "webpack-loader",
  "webpack-object-rest-spread-plugin",
];

async function main(): Promise<void> {
  let projects: Array<string> = [];
  let shouldSave = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--save") {
      shouldSave = true;
    } else if (Object.keys(EXAMPLES).includes(arg)) {
      projects.push(arg);
    } else {
      throw new Error(`Unexpected arg: ${arg}`);
    }
  }
  if (projects.length === 0) {
    projects = Object.keys(EXAMPLES);
  }
  const originalCwd = process.cwd();
  await run("yarn link");
  for (const integration of INTEGRATIONS) {
    process.chdir(`./integrations/${integration}`);
    await run("yarn");
    await run("yarn link sucrase");
    await run("yarn link");
    process.chdir(originalCwd);
  }

  const results: Array<string> = [];
  for (const projectName of projects) {
    if (await runProject(projectName, shouldSave)) {
      results.push(`PASSED: ${projectName}`);
    } else {
      results.push(`FAILED: ${projectName}`);
    }
  }
  console.log();
  console.log("Results:");
  console.log(results.join("\n"));
}

async function runProject(project: string, shouldSave: boolean): Promise<boolean> {
  const repoURL = EXAMPLES[project];
  const originalCwd = process.cwd();
  const repoDir = `./example-runner/example-repos/${project}`;

  if (!(await exists(repoDir))) {
    console.log(`Directory ${repoDir} not found, cloning a new one.`);
    await run(`git clone ${repoURL} ${repoDir}`);
  }
  process.chdir(repoDir);

  const revPath = `../../example-configs/${project}.revision`;
  const patchPath = `../../example-configs/${project}.patch`;
  if (!(await exists(revPath)) || !(await exists(patchPath)) || shouldSave) {
    console.log(`Generating metadata for ${project}`);
    await run(`git rev-parse HEAD > ${revPath}`);
    await run(`git diff HEAD > ${patchPath}`);
  }

  try {
    await run(`cat ${revPath} | xargs git reset --hard`);
    await run(`git clean -f`);
  } catch (e) {
    await run("git fetch");
    await run(`cat ${revPath} | xargs git reset --hard`);
    await run(`git clean -f`);
  }
  if ((await readFile(patchPath)).length) {
    await run(`cat ${patchPath} | git apply`);
    await run(`git add -A`);
  }

  await run("yarn");
  await run("yarn link sucrase");
  for (const integration of INTEGRATIONS) {
    await run(`yarn link @sucrase/${integration}`);
  }

  let passed = true;
  try {
    await run("yarn test");
  } catch (e) {
    passed = false;
    console.error(`Project ${project} failed tests.`);
    console.error(e);
    process.exitCode = 1;
  }
  process.chdir(originalCwd);
  return passed;
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
