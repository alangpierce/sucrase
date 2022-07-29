import {x} from './file';

if (x !== 4) {
  throw new Error();
}

const a = 1;
// This snippet confirms that we're running in JS, not TS. In TS, it is parsed
// as a function call, and in JS, it is parsed as comparison operators.
const comparisonResult = a<2>(3);
if (comparisonResult !== false) {
  throw new Error();
}
