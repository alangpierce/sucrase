import {File} from "../index";
import {nextToken, skipLineComment} from "../tokenizer";
import {input, state} from "./base";
import {parseTopLevel} from "./statement";

export function parseFile(): File {
  // If enabled, skip leading hashbang line.
  if (state.pos === 0 && input[0] === "#" && input[1] === "!") {
    skipLineComment(2);
  }
  nextToken();
  return parseTopLevel();
}
