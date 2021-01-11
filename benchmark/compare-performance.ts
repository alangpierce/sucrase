#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import {exec} from "mz/child_process";
import {writeFile} from "mz/fs";

import run from "../script/run";

interface BenchmarkResult {
  name: string;
  totalTime: number;
  linesPerSecond: number;
  totalLines: number;
}

interface Comparison {
  // Both of these values are speed in lines of code per second.
  before: number;
  after: number;
}

// Handle SIGINT, which makes it so the child benchmark process is stopped with
// an exception and we hit the finally block to switch back to the original
// branch.
process.on("SIGINT", () => {
  console.log("Detected SIGINT, letting main process clean up...");
});

async function main(): Promise<void> {
  console.log(`\
WARNING: This script performs \`git checkout\` to test changes on the current
branch compared with the default branch. It attempts to clean up the branch
state at the end, but prefer using it while in a clean git state and
double-check the git state after running.
`);
  const branchRef = await getBranchRef();
  let baseRef = "origin/master";
  if (branchRef === "master") {
    // If this is a default branch build, compare with the previous commit.
    baseRef = "origin/master~1";
  }
  console.log(`Branch ref: ${branchRef}, base ref: ${baseRef}`);
  try {
    await runBenchmarkComparison(baseRef, branchRef);
  } finally {
    if ((await getBranchRef()) !== branchRef) {
      console.log("Restoring to original branch...");
      await run(`git -c advice.detachedHead=false checkout ${branchRef}`);
    }
  }
}

async function getBranchRef(): Promise<string> {
  let branchRef = (await exec("git rev-parse --abbrev-ref HEAD"))[0].toString().trim();
  if (branchRef === "HEAD") {
    branchRef = (await exec("git rev-parse HEAD"))[0].toString().trim();
  }
  return branchRef;
}

async function runBenchmarkComparison(baseRef: string, branchRef: string): Promise<void> {
  const baseResults: Array<BenchmarkResult> = [];
  const branchResults: Array<BenchmarkResult> = [];
  for (let i = 0; i < 5; i++) {
    await run(`git -c advice.detachedHead=false checkout ${baseRef}`);
    const baseResult = await runBenchmark();
    console.log(baseResult);
    baseResults.push(baseResult);
    await run(`git -c advice.detachedHead=false checkout ${branchRef}`);
    const branchResult = await runBenchmark();
    console.log(branchResult);
    branchResults.push(branchResult);
  }
  const baseSpeeds = baseResults.map((r) => r.linesPerSecond).sort((a, b) => a - b);
  const branchSpeeds = branchResults.map((r) => r.linesPerSecond).sort((a, b) => a - b);

  console.log(`Base speeds  : ${baseSpeeds.join(", ")}`);
  console.log(`Branch speeds: ${branchSpeeds.join(", ")}`);

  const fairComparison: Comparison = {before: baseSpeeds[2], after: branchSpeeds[2]};
  const pessimisticComparison: Comparison = {before: baseSpeeds[3], after: branchSpeeds[1]};
  const optimisticComparison: Comparison = {before: baseSpeeds[1], after: branchSpeeds[3]};

  // For now, express uncertainty via actual measurements taken fairly, pessimistically, and
  // optimistically.
  const summary = `\
## Benchmark results
**Before this PR:** ${formatSpeed(fairComparison.before)}
**After this PR:**  ${formatSpeed(fairComparison.after)}

**Measured change:** ${describeDifference(fairComparison)} (${describeDifference(
    pessimisticComparison,
  )} to ${describeDifference(optimisticComparison)})
**Summary:** ${summarizeChange(pessimisticComparison, optimisticComparison)}`;
  console.log(summary);
  await exec("mkdir -p ./.perf-comparison");
  await writeFile("./.perf-comparison/summary.txt", summary);
}

function formatSpeed(speed: number): string {
  const thousandLinesPerSecond = speed / 1000;
  return `${Math.round(thousandLinesPerSecond * 10) / 10} thousand lines per second`;
}

function describeDifference({before, after}: Comparison): string {
  if (after > before) {
    const percentFaster = (after / before - 1) * 100;
    return `${Math.round(percentFaster * 100) / 100}% faster`;
  } else if (after < before) {
    const percentSlower = (1 - after / before) * 100;
    return `${Math.round(percentSlower * 100) / 100}% slower`;
  } else {
    return "same speed";
  }
}

function summarizeChange(
  pessimisticComparison: Comparison,
  optimisticComparison: Comparison,
): string {
  if (pessimisticComparison.after > pessimisticComparison.before) {
    return "Probably faster";
  } else if (optimisticComparison.after < optimisticComparison.before) {
    return "Probably slower";
  } else {
    return "Likely no significant difference";
  }
}

async function runBenchmark(): Promise<BenchmarkResult> {
  return JSON.parse(
    (await exec("node -r sucrase/register benchmark/benchmark.ts jest-diff"))[0].toString(),
  );
}

main().catch((e) => {
  if (e.signal !== "SIGINT") {
    console.error("Unhandled error:");
    console.error(e);
    process.exitCode = 1;
  }
});
