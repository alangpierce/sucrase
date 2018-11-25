require("sucrase/register");
const fs = require("fs");

const {loadProjectFiles} = require("../benchmark/loadProjectFiles");
const {parse} = require("../src/parser");

let wasmModule;
try {
  wasmModule = new WebAssembly.Module(fs.readFileSync(__dirname + "/build/optimized.wasm"));
} catch (e) {
  console.error(e);
  throw e;
}
const {instantiate} = require("@assemblyscript/loader");
const instance = instantiate(wasmModule, {
  env: {
    abort: () => {
      throw new Error();
    },
    trace: (s, n) => {
      try {
        console.log(instance.getString(s), n);
      } catch {
        console.log(n);
      }
    },
  },
});

async function run() {
  const files = await loadProjectFiles("./src");

  let sum = 0;
  console.time("wasm");
  for (const file of files) {
    instance.resetMemory();
    const strPtr = instance.newString(file.code);
    sum += instance.countTokens(strPtr);
  }
  console.timeEnd("wasm");
  console.log(`Result: ${sum}`);

  sum = 0;
  console.time("js");
  for (const file of files) {
    sum += parse(file.code, true, true, false).tokens.length;
  }
  console.timeEnd("js");
  console.log(`Result: ${sum}`);
}

run();
