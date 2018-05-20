import {parseFile} from "./parser";
import {initParser} from "./parser/base";
import {Token} from "./tokenizer";
import {Scope} from "./tokenizer/state";

export class File {
  tokens: Array<Token>;
  scopes: Array<Scope>;

  constructor(tokens: Array<Token>, scopes: Array<Scope>) {
    this.tokens = tokens;
    this.scopes = scopes;
  }
}

export function parse(
  input: string,
  isJSXEnabled: boolean,
  isTypeScriptEnabled: boolean,
  isFlowEnabled: boolean,
): File {
  if (isFlowEnabled && isTypeScriptEnabled) {
    throw new Error("Cannot combine flow and typescript plugins.");
  }
  initParser(input, isJSXEnabled, isTypeScriptEnabled, isFlowEnabled);
  return parseFile();
}
