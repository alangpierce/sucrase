#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
import {next} from "../src/parser/tokenizer";
import {initParser} from "../src/parser/traverser/base";
import {hasPrecedingLineBreak} from "../src/parser/traverser/util";
import runBenchmark from "./runBenchmark";

function main(): void {
  const benchmark = process.argv[2] || "all";
  console.log(`Running microbenchmark ${benchmark}`);
  if (benchmark === "all" || benchmark === "hasPredecingLineBreak") {
    initParser("let x\nx++;", false, false, false);
    next();
    next();
    next();
    runBenchmark(
      "hasPredecingLineBreak",
      () => {
        hasPrecedingLineBreak();
        hasPrecedingLineBreak();
        hasPrecedingLineBreak();
        hasPrecedingLineBreak();
        hasPrecedingLineBreak();
      },
      1000000,
    );
  }
}

main();
