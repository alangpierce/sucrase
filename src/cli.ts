/* eslint-disable no-console */
import commander from "commander";
import {exists, mkdir, readdir, readFile, stat, writeFile} from "mz/fs";
import {join} from "path";

import {Options, Transform, transform} from "./index";

export default function run(): void {
  commander
    .description(`Sucrase: super-fast Babel alternative.`)
    .usage("[options] <srcDir>")
    .option(
      "-d, --out-dir <out>",
      "Compile an input directory of modules into an output directory.",
    )
    .option("--exclude-dirs <paths>", "Names of directories that should not be traversed.")
    .option("-t, --transforms <transforms>", "Comma-separated list of transforms to run.")
    .option(
      "--enable-legacy-typescript-module-interop",
      "Use default TypeScript ESM/CJS interop strategy.",
    )
    .option("--enable-legacy-babel5-module-interop", "Use Babel 5 ESM/CJS interop strategy.")
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
  const srcDir = commander.args[0];
  const excludeDirs = commander.excludeDirs ? commander.excludeDirs.split(",") : [];

  const options: Options = {
    transforms: commander.transforms.split(","),
    enableLegacyTypeScriptModuleInterop: commander.enableLegacyTypescriptModuleInterop,
    enableLegacyBabel5ModuleInterop: commander.enableLegacyBabel5ModuleInterop,
  };

  buildDirectory(srcDir, outDir, excludeDirs, options).catch((e) => {
    process.exitCode = 1;
    console.error(e);
  });
}

async function buildDirectory(
  srcDirPath: string,
  outDirPath: string,
  excludeDirs: Array<string>,
  options: Options,
): Promise<void> {
  const extension = options.transforms.includes("typescript") ? ".ts" : ".js";
  if (!(await exists(outDirPath))) {
    await mkdir(outDirPath);
  }
  for (const child of await readdir(srcDirPath)) {
    if (["node_modules", ".git"].includes(child) || excludeDirs.includes(child)) {
      continue;
    }
    const srcChildPath = join(srcDirPath, child);
    const outChildPath = join(outDirPath, child);
    if ((await stat(srcChildPath)).isDirectory()) {
      await buildDirectory(srcChildPath, outChildPath, excludeDirs, options);
    } else if (srcChildPath.endsWith(extension)) {
      const outPath = `${outChildPath.substr(0, outChildPath.length - 3)}.js`;
      await buildFile(srcChildPath, outPath, options);
    }
  }
}

async function buildFile(srcPath: string, outPath: string, options: Options): Promise<void> {
  console.log(`${srcPath} -> ${outPath}`);
  const code = (await readFile(srcPath)).toString();
  const transformedCode = transform(code, {...options, filePath: srcPath});
  await writeFile(outPath, transformedCode);
}
