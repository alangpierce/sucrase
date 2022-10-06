let wasCalled: boolean = false;
function require(path) {
  if (path !== "react/jsx-dev-runtime") {
    throw new Error();
  }
  return {
    jsxDEV: () => {
      wasCalled = true;
    }
  };
}

const elem = <div />;
if (!wasCalled) {
  throw new Error();
}
