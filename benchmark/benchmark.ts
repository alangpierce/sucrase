#!/usr/bin/env node
import * as fs from 'fs';

import * as babel from 'babel-core';
import * as hyperbole from '../src/index';

function main(): void {
  const code = fs.readFileSync('./benchmark/sample.js').toString();
  runBenchmark('Hyperbole', () => hyperbole.transform(code));
  runBenchmark('Babel', () => babel.transform(code, {presets: ['react']}));
}

function runBenchmark(name: string, runTrial: () => void): void {
  // Run twice to warm up the JIT, caches, etc.
  runTrial();
  runTrial();
  console.time(name);
  for (let i = 0; i < 100; i++) {
    runTrial();
  }
  console.timeEnd(name);
}

if (require.main === module) {
  main();
}
