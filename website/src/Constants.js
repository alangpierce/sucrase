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

export const TRANSFORMS = [
  {name: 'jsx', babelName: 'transform-react-jsx'},
  {name: 'typescript', presetName: 'typescript'},
  {name: 'flow', presetName: 'flow'},
  {name: 'imports', babelName: 'transform-modules-commonjs'},
  {name: 'react-display-name', babelName: 'transform-react-display-name'},
  {name: 'add-module-exports', babelName: 'add-module-exports'},
];

export const DEFAULT_TRANSFORMS = ['jsx', 'typescript', 'imports'];
export const DEFAULT_COMPARE_WITH_BABEL = true;
export const DEFAULT_SHOW_TOKENS = false;
