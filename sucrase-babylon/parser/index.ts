import {File} from "../index";
import {getOptions, InputOptions} from "../options";
import StatementParser from "./statement";

export type ParserClass = {
  new (inputOptions: InputOptions | null, input: string): Parser;
};

export const plugins: {
  [name: string]: (superClass: ParserClass) => ParserClass;
} = {};

export type Pos = {
  start: number;
};

export default class Parser extends StatementParser {
  constructor(inputOptions: InputOptions | null, input: string) {
    const options = getOptions(inputOptions);
    super(options, input);

    this.options = options;
    this.input = input;
    this.plugins = pluginsMap(this.options.plugins);
    this.filename = options.sourceFilename;

    // If enabled, skip leading hashbang line.
    if (this.state.pos === 0 && this.input[0] === "#" && this.input[1] === "!") {
      this.skipLineComment(2);
    }
  }

  parse(): File {
    this.nextToken();
    return this.parseTopLevel();
  }
}

function pluginsMap(pluginList: ReadonlyArray<string>): {[key: string]: boolean} {
  const pluginMap = {};
  for (const name of pluginList) {
    pluginMap[name] = true;
  }
  return pluginMap;
}
