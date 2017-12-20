#!/usr/bin/env node
import * as fs from 'fs';

// @ts-ignore: new babel-core package missing types.
import * as babel from '@babel/core';
// Use require rather than import to hack around missing type info.
const buble = require('buble');
import * as sucrase from '../src/index';
import * as TypeScript from 'typescript';

function main(): void {
  console.log('Simulating transpilation of 100,000 lines of code:');
  const code = fs.readFileSync('./benchmark/sample.js').toString();
  runBenchmark('Sucrase', () => sucrase.transform(
    code,
    {transforms: ['jsx', 'imports', 'add-module-exports', 'react-display-name']})
  );
  runBenchmark('Buble (JSX, no import transform)', () =>
    buble.transform(code, {transforms: {modules: false}})
  );
  runBenchmark('TypeScript', () =>
    TypeScript.transpileModule(code, {
      compilerOptions: {
        module: TypeScript.ModuleKind.CommonJS,
        jsx: TypeScript.JsxEmit.React,
        target: TypeScript.ScriptTarget.ESNext
      }
    })
  );
  runBenchmark('Babel', () => babel.transform(
    code,
    {
      presets: ['@babel/preset-react'],
      plugins: ['@babel/plugin-transform-modules-commonjs']
    }));
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
