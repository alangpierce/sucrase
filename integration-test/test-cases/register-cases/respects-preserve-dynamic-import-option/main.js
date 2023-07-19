async function main() {
  const plainESMFile = await import("./esm-file.mjs");
  if (plainESMFile.foo !== 3) {
    throw new Error();
  }
}
main();
