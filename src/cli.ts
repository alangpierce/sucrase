/* eslint-disable no-console */
import * as commander from "commander";
import {exists, mkdir, readdir, readFile, stat, writeFile} from "mz/fs";
import {join} from "path";

import {Transform, transform} from "./index";

export default function run(): void {
  commander
    .description(`Sucrase: super-fast Babel alternative.`)
    .usage("[options] <srcDir>")
    .option(
      "-d, --out-dir <out>",
      "Compile an input directory of modules into an output directory.",
    )
    .option("-t, --transforms <transforms>", "Comma-separated list of transforms to run.")
    .parse(process.argv);

  if (!commander.outDir) {
    console.error("Out directory is required");
    process.exit(1);
  }

  if (!commander.transforms) {
    console.error("Transforms option is required.");
    process.exit(1);
  }

  if (!commander.args[0]) {
    console.error("Source directory is required.");
    process.exit(1);
  }

  const outDir = commander.outDir;
  const transforms = commander.transforms.split(",");
  const srcDir = commander.args[0];

  buildDirectory(srcDir, outDir, transforms).catch((e) => {
    process.exitCode = 1;
    console.error(e);
  });
}

async function buildDirectory(
  srcDirPath: string,
  outDirPath: string,
  transforms: Array<Transform>,
): Promise<void> {
  if (!await exists(outDirPath)) {
    await mkdir(outDirPath);
  }
  for (const child of await readdir(srcDirPath)) {
    if (["node_modules", ".git"].includes(child)) {
      continue;
    }
    const srcChildPath = join(srcDirPath, child);
    const outChildPath = join(outDirPath, child);
    if ((await stat(srcChildPath)).isDirectory()) {
      await buildDirectory(srcChildPath, outChildPath, transforms);
    } else if (srcChildPath.endsWith(".js")) {
      await buildFile(srcChildPath, outChildPath, transforms);
    }
  }
}

async function buildFile(
  srcPath: string,
  outPath: string,
  transforms: Array<Transform>,
): Promise<void> {
  console.log(`${srcPath} -> ${outPath}`);
  const code = (await readFile(srcPath)).toString();
  const transformedCode = transform(code, {transforms});
  await writeFile(outPath, transformedCode);
}
