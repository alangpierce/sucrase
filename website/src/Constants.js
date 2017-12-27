export const INITIAL_CODE = `\
// Try typing or pasting some code into the left editor!
import React, { Component } from 'react';

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
  {name: 'imports', babelName: 'transform-es2015-modules-commonjs'},
  {name: 'flow', babelName: 'transform-flow-strip-types'},
  {name: 'react-display-name', babelName: 'transform-react-display-name'},
  {name: 'add-module-exports', babelName: 'add-module-exports'},
];

export const DEFAULT_TRANSFORMS = ['jsx', 'imports'];
export const DEFAULT_COMPARE_WITH_BABEL = true;
export const DEFAULT_SHOW_TOKENS = false;
