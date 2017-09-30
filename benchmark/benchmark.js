#!/usr/bin/env node
require('ts-node/register');
const fs = require('fs');
const transform = require('../src/transform').default;

const code = fs.readFileSync(process.argv[2]).toString();
const newCode = transform(code);
console.log(newCode);
