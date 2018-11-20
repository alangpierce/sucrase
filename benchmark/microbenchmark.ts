#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import * as fs from "fs";
import {isWhitespace} from "../src/parser/util/whitespace";
import runBenchmark from "./runBenchmark";

function main(): void {
  const benchmark = process.argv[2] || "all";
  console.log(`Running microbenchmark ${benchmark}`);
  const code = fs.readFileSync(`./benchmark/sample/sample.tsx`).toString();
  if (benchmark === "all" || benchmark === "isWhitespace") {
    runBenchmark(
      "isWhitespace",
      () => {
        for (let i = 0; i < code.length; i++) {
          const char = code.charCodeAt(i);
          isWhitespace(char);
          isWhitespace(char);
          isWhitespace(char);
          isWhitespace(char);
          isWhitespace(char);
          isWhitespace(char);
          isWhitespace(char);
          isWhitespace(char);
          isWhitespace(char);
          isWhitespace(char);
        }
      },
      1000,
    );
  }
}

main();
