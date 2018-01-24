import {File} from "../index";
import StatementParser from "./statement";

export type Pos = {
  start: number;
};

export default class Parser extends StatementParser {
  constructor(input: string, plugins: Array<string>) {
    super(input);

    this.input = input;
    this.plugins = plugins.reduce((obj, p) => ({...obj, [p]: true}), {});

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
