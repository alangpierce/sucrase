import {getLineInfo, Position} from "../util/location";
import BaseParser from "./base";

// This function is used to raise exceptions on parse errors. It
// takes an offset integer (into the current `input`) to indicate
// the location of the error, attaches the position to the end
// of the error message, and then raises a `SyntaxError` with that
// message.

export default class LocationParser extends BaseParser {
  raise(pos: number, message: string, missingPluginNames?: Array<string>): never {
    const loc = getLineInfo(this.input, pos);
    message += ` (${loc.line}:${loc.column})`;
    // @ts-ignore
    const err: SyntaxError & {pos: number; loc: Position} = new SyntaxError(message);
    err.pos = pos;
    err.loc = loc;
    if (missingPluginNames) {
      // @ts-ignore
      err.missingPlugin = missingPluginNames;
    }
    throw err;
  }
}
