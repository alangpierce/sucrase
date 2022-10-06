async function foo() {
  let calledFakeRequire = false;
  const require = () => {
    calledFakeRequire = true;
  }
  // Import should become require, which will end up calling our shadowed
  // declaration of require. This is different behavior from nodenext, where
  // import should be a true ESM import.
  const OtherFile = await import('./file');
  if (!calledFakeRequire) {
    throw new Error();
  }
}
foo();
