import {InputOptions} from "./options";
import Parser, {ParserClass, plugins} from "./parser";

import "./tokenizer/context";

import flowPlugin from "./plugins/flow";
import jsxPlugin from "./plugins/jsx";
import typescriptPlugin from "./plugins/typescript";
import {Token} from "./tokenizer";
import {Scope} from "./tokenizer/state";

plugins.flow = flowPlugin;
plugins.jsx = jsxPlugin;
plugins.typescript = typescriptPlugin;

export type File = {
  tokens: Array<Token>;
  scopes: Array<Scope>;
};

export function parse(input: string, options?: InputOptions): File {
  return getParser(options, input).parse();
}

function getParser(options: InputOptions | null | undefined, input: string): Parser {
  const Cls = options && options.plugins ? getParserClass(options.plugins) : Parser;
  return new Cls(options || null, input);
}

const parserClassCache: {[key: string]: ParserClass} = {};

/** Get a Parser class with plugins applied. */
function getParserClass(pluginsFromOptions: ReadonlyArray<string>): ParserClass {
  // Filter out just the plugins that have an actual mixin associated with them.
  let pluginList = pluginsFromOptions.filter(
    (p) => p === "flow" || p === "jsx" || p === "typescript",
  );

  if (pluginList.indexOf("flow") >= 0) {
    // ensure flow plugin loads last
    pluginList = pluginList.filter((plugin) => plugin !== "flow");
    pluginList.push("flow");
  }

  if (pluginList.indexOf("flow") >= 0 && pluginList.indexOf("typescript") >= 0) {
    throw new Error("Cannot combine flow and typescript plugins.");
  }

  if (pluginList.indexOf("typescript") >= 0) {
    // ensure typescript plugin loads last
    pluginList = pluginList.filter((plugin) => plugin !== "typescript");
    pluginList.push("typescript");
  }

  const key = pluginList.join("/");
  let cls = parserClassCache[key];
  if (!cls) {
    cls = Parser;
    for (const plugin of pluginList) {
      cls = plugins[plugin](cls);
    }
    parserClassCache[key] = cls;
  }
  return cls;
}
