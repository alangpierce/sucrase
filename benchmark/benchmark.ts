#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
// @ts-ignore: babel-core package missing types.
import * as babel from "@babel/core";
import * as swc from "@swc/core";
import * as esbuild from "esbuild";
import {fs} from "mz";
import {exists} from "mz/fs";
import * as TypeScript from "typescript";

import run from "../script/run";
import * as sucrase from "../src/index";
import {FileInfo, loadProjectFiles} from "./loadProjectFiles";

async function main(): Promise<void> {
  process.chdir(__dirname);

  const benchmark = process.argv[2] || "jest";
  if (benchmark === "jest") {
    await benchmarkJest();
  } else if (benchmark === "jest-diff") {
    await benchmarkJestForDiff();
  } else if (benchmark === "jest-dev") {
    await benchmarkJestForDev();
  } else if (benchmark === "project") {
    await benchmarkProject();
  } else if (benchmark === "sample") {
    await benchmarkSample();
  } else if (benchmark === "test") {
    await benchmarkTest();
  } else {
    console.error(`Unrecognized benchmark: ${benchmark}`);
    process.exitCode = 1;
  }
}

/**
 * Run a benchmark against similar tools for publishing in the README. This can
 * be run by running "yarn benchmark" from the root Sucrase directory.
 *
 * The benchmark clones the Jest codebase at a fixed hash, mucks with the code
 * to fix some compatibility issues, then runs it through Sucrase, swc, esbuild,
 * tsc, and Babel.
 *
 * There are a few caveats that make it hard to come up with a completely fair
 * comparison between tools:
 *
 * 1.) JIT warm-up
 * Like all JavaScript code run in V8, Sucrase runs more slowly at first, then
 * gets faster as the just-in-time compiler applies more optimizations. From a
 * rough measurement, Sucrase is about 2x faster after running for 3 seconds
 * than after running for 1 second. swc (written in Rust) and esbuild (written
 * in Go) don't have this effect because they're pre-compiled, so comparing them
 * with Sucrase gets significantly different results depending on how large of a
 * codebase is being tested and whether each compiler is allowed a "warm up"
 * period before the benchmark is run.
 *
 * For the benchmark shown in the README, we do NOT allow a warmup period, and
 * we test on a fairly large codebase of ~360k lines of code. This is meant to
 * showcase Sucrase's performance in a realistic scenario rather than focusing
 * on best-case performance, but a downside is that a small change in benchmark
 * details will give a different result. You can try out the behavior with
 * warm-up by changing the options to have `warmUp: true`.
 *
 * 2.) Multi-threading
 * This benchmark focuses on measuring the single-threaded performance of the
 * each tool, even though esbuild and swc both have built-in mechanisms for
 * running compilation in parallel. Transpiling a codebase is fundamentally easy
 * to parallelize since you can split up the files among different workers in a
 * worker pool, so even a tool without built-in parallelization support (like
 * Sucrase) can be run optimally in parallel using a wrapper tool like Webpack's
 * thread-loader. So when comparing tools, it seems fair and simpler to measure
 * how much a single CPU core can compile, with the understanding that any tool
 * can be run in parallel. That said, for many use cases it may certainly be
 * more convenient to use a tool with built-in parallelization.
 *
 * 3.) Behavior equivalence
 * Each tool has been configured to remove TS types, transpile JSX, and convert
 * imports to CommonJS, and ideally not transform anything else. However, each
 * tool has its own configuration and there are small differences in exactly
 * which JS features are transformed. The "test" benchmark can be used to
 * spot-check the output for various simple cases.
 */
async function benchmarkJest(): Promise<void> {
  await benchmarkFiles({files: await getJestFiles(), numIterations: 3});
}

async function getJestFiles(): Promise<Array<FileInfo>> {
  if (!(await exists("./sample/jest"))) {
    await run("git clone https://github.com/facebook/jest.git ./sample/jest");
    process.chdir("./sample/jest");
    await run("git checkout 7430a7824421c122cd07035d800d22e1007408fa");
    process.chdir("../..");
  }

  let files = await loadProjectFiles("./sample/jest");
  // Babel doesn't support "import =" or "export =" syntax at all, but jest
  // uses it, so hack the code to not use that syntax.
  files = files.map(({path, code}) => ({
    path,
    code: code.replace(/import([^\n]*require)/g, "const$1").replace(/export =/g, "exports ="),
  }));
  // esbuild doesn't allow top-level await when outputting to CJS, so skip the
  // one file in the Jest codebase that uses that syntax.
  files = files.filter(
    ({path}) => !path.includes("jest/e2e/native-esm/__tests__/native-esm-tla.test.js"),
  );
  return files;
}

/**
 * Run the Jest benchmark with JSON stdout so that external tools can read it.
 */
async function benchmarkJestForDiff(): Promise<void> {
  await benchmarkFiles({
    files: await getJestFiles(),
    numIterations: 15,
    warmUp: true,
    sucraseOnly: true,
    jsonOutput: true,
  });
}

/**
 * Run the Jest benchmark many times with warm-up to test Sucrase's performance
 * in response to code changes.
 */
async function benchmarkJestForDev(): Promise<void> {
  await benchmarkFiles({
    files: await getJestFiles(),
    numIterations: 15,
    warmUp: true,
    sucraseOnly: true,
  });
}

/**
 * Given a path to a project directory, discover all JS/TS files and determine
 * the time needed to transpile them.
 */
async function benchmarkProject(): Promise<void> {
  const projectPath = process.argv[3];
  const files = await loadProjectFiles(projectPath);
  await benchmarkFiles({files, numIterations: 1});
}

/**
 * Benchmark 100 iterations of a 1000-line file that tries to be fairly
 * representative of typical code.
 */
async function benchmarkSample(): Promise<void> {
  const code = fs.readFileSync(`./sample/sample.tsx`).toString();
  await benchmarkFiles({files: [{code, path: "sample.tsx"}], numIterations: 100, warmUp: true});
}

/**
 * Run a small code snippet through all compilers and print the output so they
 * can be spot-checked.
 */
async function benchmarkTest(): Promise<void> {
  const code = `
// Imports should be transpiled to CJS.
import React from 'react';

// async/await should NOT be transpiled.
async function foo(): Promise<void> {
  await bar();
}

// Classes should NOT be transpiled.
export default class App {
  // Return types should be removed.
  render(): JSX.Element {
    // JSX should be transpiled.
    return <div>This is a test</div>;
  } 
}
`;
  await benchmarkFiles({files: [{code, path: "sample.tsx"}], numIterations: 1, printOutput: true});
}

interface BenchmarkOptions {
  // File contents to process in each iteration.
  files: Array<FileInfo>;
  // Number of times to compile the entire list of files.
  numIterations: number;
  // If true, run each benchmark for a few seconds untimed before starting the
  // timed portion. This leads to a more stable benchmark result, but is not
  // necessarily representative of the speed that would be seen in a typical
  // build system (where warm-up cost often matters).
  warmUp?: boolean;
  // If true, print the resulting source code whenever a file is compiled. This
  // is useful to spot check the output to ensure that each compiler is
  // configured similarly.
  printOutput?: boolean;
  // If true, stop after benchmarking Sucrase. This is useful when comparing
  // Sucrase to itself in different scenarios rather than when comparing it with
  // other tools.
  sucraseOnly?: boolean;
  // If true, rather than printing human-readable text to stdout, print JSON
  // (one JSON line per benchmark, though currently this is only used with
  // sucraseOnly, so in that case stdout as a whole is valid JSON), so that the
  // timing results can be read by other tools.
  jsonOutput?: boolean;
}

/**
 * Run the specified benchmark on all transpiler tools. In most cases, we can
 * parse as TSX, but .ts files might use `<type>value` cast syntax, so we need
 * to disable JSX parsing in that case.
 */
async function benchmarkFiles(benchmarkOptions: BenchmarkOptions): Promise<void> {
  if (!benchmarkOptions.jsonOutput) {
    console.log(`Testing against ${numLines(benchmarkOptions)} LOC`);
  }
  /* eslint-disable @typescript-eslint/require-await */
  await runBenchmark(
    "Sucrase",
    benchmarkOptions,
    async (code: string, path: string) =>
      sucrase.transform(code, {
        transforms: path.endsWith(".ts")
          ? ["imports", "typescript"]
          : ["jsx", "imports", "typescript"],
      }).code,
  );
  if (benchmarkOptions.sucraseOnly) {
    return;
  }
  // To run swc in single-threaded mode, we call into it repeatedly using
  // transformSync, which seems to have minimal overhead.
  await runBenchmark(
    "swc",
    benchmarkOptions,
    async (code: string, path: string) =>
      swc.transformSync(code, {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: !path.endsWith(".ts"),
            dynamicImport: true,
            decorators: true,
          },
          target: "es2019",
        },
        module: {
          type: "commonjs",
        },
      }).code,
  );
  // esbuild's transformSync has significant overhead since it spins up an
  // external process, so instead create a "service" process and communicate to
  // it. One way to force a single-threaded behavior is to sequentially call
  // transform on the service, but that seems to have some IPC overhead, so we
  // instead make transform calls in parallel and use an env variable to enforce
  // that the Go process only uses a single thread.
  process.env.GOMAXPROCS = "1";
  const esbuildService = await esbuild.startService();
  try {
    await runBenchmark(
      "esbuild",
      benchmarkOptions,
      async (code: string, path: string) =>
        (
          await esbuildService.transform(code, {
            loader: path.endsWith(".ts") ? "ts" : "tsx",
            format: "cjs",
          })
        ).code,
    );
  } finally {
    esbuildService.stop();
  }
  await runBenchmark(
    "TypeScript",
    benchmarkOptions,
    async (code: string) =>
      TypeScript.transpileModule(code, {
        compilerOptions: {
          module: TypeScript.ModuleKind.CommonJS,
          jsx: TypeScript.JsxEmit.React,
          target: TypeScript.ScriptTarget.ESNext,
        },
      }).outputText,
  );
  await runBenchmark(
    "Babel",
    benchmarkOptions,
    async (code: string, path: string) =>
      babel.transformSync(code, {
        filename: path.endsWith(".ts") ? "sample.ts" : "sample.tsx",
        presets: path.endsWith(".ts")
          ? ["@babel/preset-typescript"]
          : ["@babel/preset-react", "@babel/preset-typescript"],
        plugins: [
          "@babel/plugin-transform-modules-commonjs",
          "@babel/plugin-syntax-top-level-await",
          "@babel/plugin-proposal-export-namespace-from",
          ["@babel/plugin-proposal-decorators", {legacy: true}],
        ],
      }).code,
  );
  /* eslint-enable @typescript-eslint/require-await */
}

export default async function runBenchmark(
  name: string,
  benchmarkOptions: BenchmarkOptions,
  runTrial: (code: string, path: string) => Promise<string>,
): Promise<void> {
  if (benchmarkOptions.warmUp) {
    const warmUpTimeNanos = 3e9;
    const warmUpStart = process.hrtime.bigint();
    while (process.hrtime.bigint() - warmUpStart < warmUpTimeNanos) {
      for (const file of benchmarkOptions.files) {
        await runTrial(file.code, file.path);
        if (process.hrtime.bigint() - warmUpStart >= warmUpTimeNanos) {
          break;
        }
      }
    }
  }
  const startTime = process.hrtime.bigint();
  // Collect promises and await them all at the end rather than awaiting them
  // sequentially. For esbuild, this seems to significantly reduce IPC overhead.
  // For all other compilers, this has no effect, and the Promise overhead seems
  // to be tiny.
  const promises: Array<Promise<unknown>> = [];
  for (let i = 0; i < benchmarkOptions.numIterations; i++) {
    for (const file of benchmarkOptions.files) {
      if (benchmarkOptions.printOutput) {
        promises.push(
          (async () => {
            const code = await runTrial(file.code, file.path);
            console.log(`\n\n${name} output for ${file.path}:\n${code}\n`);
          })(),
        );
      } else {
        promises.push(runTrial(file.code, file.path));
      }
    }
  }
  await Promise.all(promises);
  const totalTime = Number(process.hrtime.bigint() - startTime) / 1e9;
  if (benchmarkOptions.jsonOutput) {
    console.log(
      JSON.stringify({
        name,
        totalTime,
        linesPerSecond: Math.round(numLines(benchmarkOptions) / totalTime),
        totalLines: numLines(benchmarkOptions),
      }),
    );
  } else {
    console.log(getSummary(name, totalTime, benchmarkOptions));
  }
}

function getSummary(name: string, totalTime: number, benchmarkOptions: BenchmarkOptions): string {
  let summary = name;
  while (summary.length < 12) {
    summary += " ";
  }
  summary += `${Math.round(totalTime * 100) / 100} seconds`;
  while (summary.length < 28) {
    summary += " ";
  }
  summary += `${Math.round(numLines(benchmarkOptions) / totalTime)} lines per second`;
  return summary;
}

function numLines(benchmarkOptions: BenchmarkOptions): number {
  let result = 0;
  for (const file of benchmarkOptions.files) {
    result += file.code.split("\n").length - 1;
  }
  return result * benchmarkOptions.numIterations;
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
  process.exitCode = 1;
});
