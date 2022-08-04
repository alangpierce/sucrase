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

export type HydratedOptions = Omit<Required<Options>, "filePath" | "sourceMapOptions">;

/**
 * Default value for each option to show for the website.
 *
 * This is not required to match the default values from Sucrase itself (e.g.
 * it's useful to have a few transforms enabled for the demo), but it's most
 * clear to match Sucrase defaults as much as possible.
 *
 * This object also doubles as a way of list of options and their types for the
 * purpose of URL parsing and formatting.
 */
export const DEFAULT_OPTIONS: HydratedOptions = {
  transforms: ["jsx", "typescript", "imports"],
  jsxRuntime: "classic",
  jsxPragma: "React.createElement",
  jsxFragmentPragma: "React.Fragment",
  jsxImportSource: "react",
  enableLegacyTypeScriptModuleInterop: false,
  enableLegacyBabel5ModuleInterop: false,
  production: false,
  disableESTransforms: false,
  preserveDynamicImport: false,
  injectCreateRequireForImportRequire: false,
};

export interface DisplayOptions {
  compareWithBabel: boolean;
  compareWithTypeScript: boolean;
  showTokens: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  compareWithBabel: true,
  compareWithTypeScript: false,
  showTokens: false,
};
