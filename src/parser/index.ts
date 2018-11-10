import {Token} from "./tokenizer/index";
import {Scope} from "./tokenizer/state";
import {augmentError, initParser} from "./traverser/base";
import {parseFile} from "./traverser/index";

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
  try {
    return parseFile();
  } catch (e) {
    throw augmentError(e);
  }
}
