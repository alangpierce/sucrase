import {getOptions, InputOptions} from "../options";
import {File, Program} from "../types";
import StatementParser from "./statement";

export type ParserClass = {
  new (inputOptions: InputOptions | null, input: string): Parser;
};

export const plugins: {
  [name: string]: (superClass: ParserClass) => ParserClass;
} = {};

export default class Parser extends StatementParser {
  constructor(inputOptions: InputOptions | null, input: string) {
    const options = getOptions(inputOptions);
    super(options, input);

    this.options = options;
    this.inModule = this.options.sourceType === "module";
    this.input = input;
    this.plugins = pluginsMap(this.options.plugins);
    this.filename = options.sourceFilename;

    // If enabled, skip leading hashbang line.
    if (this.state.pos === 0 && this.input[0] === "#" && this.input[1] === "!") {
      this.skipLineComment(2);
    }
  }

  parse(): File {
    const file = this.startNode<File>();
    const program = this.startNode<Program>();
    this.nextToken();
    return this.parseTopLevel(file, program);
  }
}

function pluginsMap(pluginList: ReadonlyArray<string>): {[key: string]: boolean} {
  const pluginMap = {};
  for (const name of pluginList) {
    pluginMap[name] = true;
  }
  return pluginMap;
}
