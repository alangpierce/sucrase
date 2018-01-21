import LinesAndColumns from "lines-and-columns";

import {Options} from "../options";
import State from "../tokenizer/state";

export default class BaseParser {
  // Properties set by constructor in index.js
  options: Options;
  inModule: boolean;
  plugins: {[key: string]: boolean};
  filename: string | null | undefined;

  // Initialized by Tokenizer
  state: State;
  input: string;

  hasPlugin(name: string): boolean {
    return Boolean(this.plugins[name]);
  }

  // This function is used to raise exceptions on parse errors. It
  // takes an offset integer (into the current `input`) to indicate
  // the location of the error, attaches the position to the end
  // of the error message, and then raises a `SyntaxError` with that
  // message.
  raise(pos: number, message: string, missingPluginNames?: Array<string>): never {
    let loc = new LinesAndColumns(this.input).locationForIndex(pos);
    if (!loc) {
      loc = {line: 0, column: 0};
    }
    message += ` (${loc.line}:${loc.column})`;
    // tslint:disable no-any
    const err: any = new SyntaxError(message);
    err.pos = pos;
    err.loc = loc;
    if (missingPluginNames) {
      // @ts-ignore
      err.missingPlugin = missingPluginNames;
    }
    throw err;
  }
}
