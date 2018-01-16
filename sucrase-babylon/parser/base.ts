// @flow

import {Options} from "../options";
import {reservedWords} from "../util/identifier";

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
}
