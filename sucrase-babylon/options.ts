// A second optional argument can be given to further configure
// the parser process. These options are recognized:

export type Options = {
  sourceFilename?: string;
  startLine: number;
  allowReturnOutsideFunction: boolean;
  allowSuperOutsideMethod: boolean;
  plugins: ReadonlyArray<string>;
  ranges: boolean;
  tokens: boolean;
};

export type InputOptions = {[O in keyof Options]?: Options[O]};

export const defaultOptions: Options = {
  // Note that sourceType is missing because assume we're always in a module.
  // Source filename.
  sourceFilename: undefined,
  // Line from which to start counting source. Useful for
  // integration with other tools.
  startLine: 1,
  // When enabled, a return at the top level is not considered an
  // error.
  allowReturnOutsideFunction: false,
  // TODO
  allowSuperOutsideMethod: false,
  // An array of plugins to enable
  plugins: [],
  // Nodes have their start and end characters offsets recorded in
  // `start` and `end` properties (directly on the node, rather than
  // the `loc` object, which holds line/column data. To also add a
  // [semi-standardized][range] `range` property holding a `[start,
  // end]` array with the same numbers, set the `ranges` option to
  // `true`.
  //
  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
  ranges: false,
  // Adds all parsed tokens to a `tokens` property on the `File` node
  tokens: false,
};

// Interpret and default an options object

export function getOptions(opts: InputOptions | null): Options {
  // tslint:disable-next-line no-any
  const options: any = {};
  for (const key of Object.keys(defaultOptions)) {
    options[key] = opts && opts[key] != null ? opts[key] : defaultOptions[key];
  }
  return options;
}
