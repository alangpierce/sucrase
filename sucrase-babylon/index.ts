import Parser from "./parser";
import FlowParser from "./plugins/flow";
import JSXParser from "./plugins/jsx";
import TypeScriptParser from "./plugins/typescript";
import {Token} from "./tokenizer";
import {Scope} from "./tokenizer/state";

export type File = {
  tokens: Array<Token>;
  scopes: Array<Scope>;
};

export function parse(input: string, plugins: Array<string>): File {
  return getParser(plugins, input).parse();
}

function getParser(plugins: Array<string>, input: string): Parser {
  if (plugins.includes("flow") && plugins.includes("typescript")) {
    throw new Error("Cannot combine flow and typescript plugins.");
  }

  if (plugins.includes("typescript")) {
    return new TypeScriptParser(input, plugins);
  } else if (plugins.includes("flow")) {
    return new FlowParser(input, plugins);
  } else if (plugins.includes("jsx")) {
    return new JSXParser(input, plugins);
  } else {
    return new Parser(input, plugins);
  }
}
