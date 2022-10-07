let wasCalled: boolean = false;
function require(path) {
  if (path !== "my-library/jsx-runtime") {
    throw new Error();
  }
  return {
    jsx: () => {
      wasCalled = true;
    }
  };
}

const elem = <div />;
if (!wasCalled) {
  throw new Error();
}
