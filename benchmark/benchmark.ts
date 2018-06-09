#!./script/sucrase-node
/* eslint-disable no-console */
// @ts-ignore: new babel-core package missing types.
import * as babel from "@babel/core";
import * as fs from "fs";
import * as TypeScript from "typescript";
// @ts-ignore: May not be built, just ignore for now.
import * as sucrase from "../dist/index"; // eslint-disable-line import/no-unresolved

function main(): void {
  const sampleFile = process.argv[2] || "sample.tsx";
  console.log(`Simulating 100 compilations of ${sampleFile}:`);
  const code = fs.readFileSync(`./benchmark/sample/${sampleFile}`).toString();
  runBenchmark("Sucrase", () =>
    sucrase.transform(code, {
      transforms: ["jsx", "imports", "typescript"],
    }),
  );
  runBenchmark("TypeScript", () =>
    TypeScript.transpileModule(code, {
      compilerOptions: {
        module: TypeScript.ModuleKind.CommonJS,
        jsx: TypeScript.JsxEmit.React,
        target: TypeScript.ScriptTarget.ESNext,
      },
    }),
  );
  runBenchmark("Babel", () =>
    babel.transform(code, {
      presets: ["@babel/preset-react", "@babel/preset-typescript"],
      plugins: ["@babel/plugin-transform-modules-commonjs"],
    }),
  );
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

main();
