import {Options} from "./options";
import Parser, {ParserClass, plugins} from "./parser";

import "./tokenizer/context";
import {types as tokTypes} from "./tokenizer/types";

import {Expression, File} from "./types";

import estreePlugin from "./plugins/estree";
import flowPlugin from "./plugins/flow";
import jsxPlugin from "./plugins/jsx";
import typescriptPlugin from "./plugins/typescript";
import {Token} from "./tokenizer";

plugins.estree = estreePlugin;
plugins.flow = flowPlugin;
plugins.jsx = jsxPlugin;
plugins.typescript = typescriptPlugin;

export function getTokens(input: string, options?: Options): Array<Token> {
  options = Object.assign({}, options, {tokens: true});
  return getParser(options, input).parse().tokens;
}

export function parse(input: string, options?: Options): File {
  return getParser(options, input).parse();
}

export function parseExpression(input: string, options?: Options): Expression {
  const parser = getParser(options, input);
  if (parser.options.strictMode) {
    parser.state.strict = true;
  }
  return parser.getExpression();
}

export {tokTypes};

function getParser(options: Options | null | undefined, input: string): Parser {
  const Cls = options && options.plugins ? getParserClass(options.plugins) : Parser;
  return new Cls(options || null, input);
}

const parserClassCache: {[key: string]: ParserClass} = {};

/** Get a Parser class with plugins applied. */
function getParserClass(pluginsFromOptions: ReadonlyArray<string>): ParserClass {
  if (
    pluginsFromOptions.indexOf("decorators") >= 0 &&
    pluginsFromOptions.indexOf("decorators2") >= 0
  ) {
    throw new Error("Cannot use decorators and decorators2 plugin together");
  }

  // Filter out just the plugins that have an actual mixin associated with them.
  let pluginList = pluginsFromOptions.filter(
    (p) => p === "estree" || p === "flow" || p === "jsx" || p === "typescript",
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

  if (pluginList.indexOf("estree") >= 0) {
    // ensure estree plugin loads first
    pluginList = pluginList.filter((plugin) => plugin !== "estree");
    pluginList.unshift("estree");
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
