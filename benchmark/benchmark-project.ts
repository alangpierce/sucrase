#!/usr/bin/env node
/* eslint-disable no-console */
import parseArgs from "yargs-parser";

import * as sucrase from "../src/index";
import {FileInfo, loadProjectFiles} from "./loadProjectFiles";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), {boolean: ["profile"]});
  const projectPath = String(args._[0]);
  const shouldProfile = args.profile;
  const numTimes = args.times || 1;

  const projectFiles = await loadProjectFiles(projectPath);
  if (numTimes === 1) {
    console.log(`Running Sucrase on ${projectPath}`);
  } else {
    console.log(`Running Sucrase ${numTimes} times on ${projectPath}`);
  }
  const totalLines = projectFiles
    .map(({code}) => code.split("\n").length)
    .reduce((a, b) => a + b, 0);
  console.log(`Found ${projectFiles.length} files with ${totalLines} lines`);

  if (shouldProfile) {
    console.log(`Make sure you have Chrome DevTools for Node open.`);
    // tslint:disable-next-line no-any
    (console as any).profile(`Sucrase ${projectPath}`);
    for (let i = 0; i < numTimes; i++) {
      for (const fileInfo of projectFiles) {
        runTransform(fileInfo);
      }
    }
    // tslint:disable-next-line no-any
    (console as any).profileEnd(`Sucrase ${projectPath}`);
  } else {
    const startTime = process.hrtime();
    for (let i = 0; i < numTimes; i++) {
      for (const fileInfo of projectFiles) {
        runTransform(fileInfo);
      }
    }
    const totalTime = process.hrtime(startTime);
    const timeSeconds = totalTime[0] + totalTime[1] / 1e9;
    console.log(`Time taken: ${Math.round(timeSeconds * 1000) / 1000}s`);
    console.log(`Speed: ${Math.round((totalLines * numTimes) / timeSeconds)} lines per second`);
  }
}

function runTransform({code, path}: FileInfo): void {
  if (path.endsWith(".js") || path.endsWith(".jsx")) {
    sucrase.transform(code, {transforms: ["jsx", "imports", "flow"], filePath: path});
  } else if (path.endsWith(".ts")) {
    sucrase.transform(code, {transforms: ["imports", "typescript"], filePath: path});
  } else if (path.endsWith(".tsx")) {
    sucrase.transform(code, {transforms: ["jsx", "imports", "typescript"], filePath: path});
  } else {
    throw new Error(`Unrecognized file type: ${path}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
