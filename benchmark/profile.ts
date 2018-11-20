#!/usr/bin/env node
/* eslint-disable no-console */
import * as fs from "fs";

import * as sucrase from "../src/index";

function main(): void {
  const sampleFile = process.argv[2] || "sample.tsx";
  console.log(
    `Profiling Sucrase on ${sampleFile}. Make sure you have Chrome DevTools for Node open.`,
  );
  const code = fs.readFileSync(`./benchmark/sample/${sampleFile}`).toString();
  // tslint:disable-next-line no-any
  (console as any).profile("Sucrase");
  for (let i = 0; i < 3000; i++) {
    sucrase.transform(code, {
      transforms: ["jsx", "imports", "typescript"],
    });
  }
  // tslint:disable-next-line no-any
  (console as any).profileEnd("Sucrase");
}

main();
