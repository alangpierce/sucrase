#!/usr/bin/env node

import {writeFile} from "mz/fs";
import generateTokenTypes from "./generateTokenTypes";

/**
 * Use code generation.
 */
async function generate(): Promise<void> {
  await writeFile("./sucrase-babylon/tokenizer/types.ts", generateTokenTypes());
  console.log("Done with code generation.");
}

generate().catch((e) => {
  console.error("Error during code generation!");
  console.error(e);
  process.exitCode = 1;
});
