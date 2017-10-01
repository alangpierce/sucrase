#!/usr/bin/env node
require('ts-node/register');
const babel = require('babel-core');
const fs = require('fs');
const hyperbole = require('../src/index');

console.log('Processing file ' + process.argv[process.argv.length - 1]);
const code = fs.readFileSync(process.argv[process.argv.length - 1]).toString();

hyperbole.transform(code);
hyperbole.transform(code);
console.time('Hyperbole');
for (let i = 0; i < 100; i++) {
  hyperbole.transform(code);
}
console.timeEnd('Hyperbole');

babel.transform(code, {presets: ['react']});
babel.transform(code, {presets: ['react']});
console.time('Babel');
for (let i = 0; i < 100; i++) {
  babel.transform(code, {presets: ['react']});
}
console.timeEnd('Babel');
