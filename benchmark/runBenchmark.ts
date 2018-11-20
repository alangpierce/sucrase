/* eslint-disable no-console */

export default function runBenchmark(
  name: string,
  runTrial: () => void,
  times: number = 100,
): void {
  // Run twice before starting the clock to warm up the JIT, caches, etc.
  runTrial();
  runTrial();
  console.time(name);
  for (let i = 0; i < times; i++) {
    runTrial();
  }
  console.timeEnd(name);
}
