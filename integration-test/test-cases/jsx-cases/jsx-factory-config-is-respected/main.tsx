let hWasCalledWithDiv = false;
let hWasCalledWithFragment = false;
const Fragment = {};

function h(tag) {
  if (tag === 'div') {
    hWasCalledWithDiv = true;
  } else if (tag === Fragment) {
    hWasCalledWithFragment = true;
  }
}
const elem1 = <div />;
if (!hWasCalledWithDiv) {
  throw new Error();
}

const elem2 = <>hello</>;
if (!hWasCalledWithFragment) {
  throw new Error();
}
