#!/usr/bin/env node

import {writeFile} from "mz/fs";
import run from "../example-runner/run";
import generateReadWord from "./generateReadWord";
import generateTokenTypes from "./generateTokenTypes";

/**
 * Use code generation.
 */
async function generate(): Promise<void> {
  await writeFile("./sucrase-babylon/tokenizer/types.ts", generateTokenTypes());
  await run("./node_modules/.bin/prettier --write ./sucrase-babylon/tokenizer/types.ts");
  await writeFile("./sucrase-babylon/tokenizer/readWord.ts", generateReadWord());
  await run("./node_modules/.bin/prettier --write ./sucrase-babylon/tokenizer/readWord.ts");
  console.log("Done with code generation.");
}

generate().catch((e) => {
  console.error("Error during code generation!");
  console.error(e);
  process.exitCode = 1;
});
