#!./node_modules/.bin/sucrase-node
/* eslint-disable no-console */
// @ts-ignore: new babel-core package missing types.
import * as babel from "@babel/core";

import * as sucrase from "../src/index";
import {loadProjectFiles} from "./loadProjectFiles";

async function main(): Promise<void> {
  console.log(`Compiling React codebase:`);
  const reactFiles = await loadProjectFiles("./example-runner/example-repos/react/packages");
  console.time("Sucrase");
  for (const {code, path} of reactFiles) {
    if (path.endsWith(".ts")) {
      continue;
    }
    sucrase.transform(code, {
      transforms: ["jsx", "imports", "flow"],
      filePath: path,
    });
  }
  console.timeEnd("Sucrase");

  console.time("Babel");
  for (const {code, path} of reactFiles) {
    if (path.endsWith(".ts")) {
      continue;
    }
    babel.transform(code, {
      presets: ["@babel/preset-react", "@babel/preset-flow"],
      plugins: [
        "@babel/plugin-transform-modules-commonjs",
        "@babel/plugin-proposal-class-properties",
        "@babel/plugin-proposal-object-rest-spread",
      ],
    });
  }
  console.timeEnd("Babel");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
