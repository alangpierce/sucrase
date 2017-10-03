#!/usr/bin/env node
import * as fs from 'fs';

import * as babel from 'babel-core';
// Use require rather than import to hack around missing type info.
const buble = require('buble');
import * as sucrase from '../src/index';

function main(): void {
  console.log('Simulating transpilation of 100,000 lines of code:');
  const code = fs.readFileSync('./benchmark/sample.js').toString();
  runBenchmark('Sucrase', () => sucrase.transform(code));
  runBenchmark('Buble', () => buble.transform(code, {transforms: {modules: false}}));
  runBenchmark('Babel', () => babel.transform(code, {presets: ['react']}));
}

function runBenchmark(name: string, runTrial: () => void): void {
  // Run twice before starting the clock to warm up the JIT, caches, etc.
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
