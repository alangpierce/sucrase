import {Transform} from "sucrase";

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

interface TransformInfo {
  name: Transform;
  presetName?: unknown;
  babelName?: string;
}

export const TRANSFORMS: Array<TransformInfo> = [
  {name: "jsx", presetName: ["react", {development: true}]},
  {name: "typescript", presetName: ["typescript", {allowDeclareFields: true}]},
  {name: "flow", presetName: "flow"},
  {name: "imports", babelName: "transform-modules-commonjs"},
  {name: "react-hot-loader", babelName: "react-hot-loader"},
];

export const DEFAULT_TRANSFORMS = ["jsx", "typescript", "imports"];
export const DEFAULT_COMPARE_WITH_BABEL = true;
export const DEFAULT_COMPARE_WITH_TYPESCRIPT = false;
export const DEFAULT_SHOW_TOKENS = false;
