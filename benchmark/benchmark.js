#!/usr/bin/env node
require('ts-node/register');
const babel = require('babel-core');
const fs = require('fs');
const transform = require('../src/transform').default;

console.log('Processing file ' + process.argv[process.argv.length - 1]);
const code = fs.readFileSync(process.argv[process.argv.length - 1]).toString();

transform(code);
transform(code);
console.time('Hyperbole');
for (let i = 0; i < 100; i++) {
  transform(code);
}
console.timeEnd('Hyperbole');

babel.transform(code, {presets: ['react']});
babel.transform(code, {presets: ['react']});
console.time('Babel');
for (let i = 0; i < 100; i++) {
  babel.transform(code, {presets: ['react']});
}
console.timeEnd('Babel');
