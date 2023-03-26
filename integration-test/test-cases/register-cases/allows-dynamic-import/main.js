async function main() {
  const plainCJSFile = await import("./plain-cjs-file");
  const transpiledESMFile = await import("./transpiled-esm-file");
  if (plainCJSFile.default !== 15) {
    throw new Error();
  }
  if (transpiledESMFile.a !== 1) {
    throw new Error();
  }
  if (transpiledESMFile.default !== 3) {
    throw new Error();
  }
}
main();
