async function foo() {
  // Dynamic import is expected to be preserved so that it's possible to import
  // mjs files.
  const result = await import('./file.mjs');
  if (result.x !== 3) {
    throw new Error();
  }
}
foo();
