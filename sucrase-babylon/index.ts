import {parseFile} from "./parser";
import {initParser} from "./parser/base";
import {Token} from "./tokenizer";
import {Scope} from "./tokenizer/state";

export type File = {
  tokens: Array<Token>;
  scopes: Array<Scope>;
};

export function parse(input: string, plugins: Array<string>): File {
  if (plugins.includes("flow") && plugins.includes("typescript")) {
    throw new Error("Cannot combine flow and typescript plugins.");
  }
  initParser(input, plugins);
  return parseFile();
}
