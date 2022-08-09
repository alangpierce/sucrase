import type {Options, Transform} from "sucrase";

export const INITIAL_CODE = `\
// Try typing or pasting some code into the left editor!
import React, { Component } from "react";

type Reducer<T, U> = (u: U, t: T) => U;

function reduce<T, U>(arr: Array<T>, reducer: Reducer<T, U>, base: U): U {
  let acc = base;
  for (const value of arr) {
    acc = reducer(acc, value);
  }
  return acc;
}

class App extends Component {
  render() {
    return <span>Hello, world!</span>;
  }
}

const OtherComponent = React.createClass({
  render() {
    return null;
  }
});

export default App;

`;

export const TRANSFORMS: Array<Transform> = [
  "jsx",
  "typescript",
  "flow",
  "imports",
  "react-hot-loader",
  "jest",
];

export const DEFAULT_OPTIONS: Options = {
  transforms: ["jsx", "typescript", "imports"],
};
export const DEFAULT_COMPARE_WITH_BABEL = true;
export const DEFAULT_COMPARE_WITH_TYPESCRIPT = false;
export const DEFAULT_SHOW_TOKENS = false;
