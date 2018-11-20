#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
// @ts-ignore: new babel-core package missing types.
import * as babel from "@babel/core";
import * as fs from "fs";
import * as TypeScript from "typescript";
import * as sucrase from "../src/index";
import runBenchmark from "./runBenchmark";

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
      filename: "sample.tsx",
      presets: ["@babel/preset-react", "@babel/preset-typescript"],
      plugins: ["@babel/plugin-transform-modules-commonjs"],
    }),
  );
}

main();
