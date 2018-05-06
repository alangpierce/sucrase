import LinesAndColumns from "lines-and-columns";

import State from "../tokenizer/state";

export let isJSXEnabled: boolean;
export let isTypeScriptEnabled: boolean;
export let isFlowEnabled: boolean;
export let state: State;
export let input: string;
export let nextContextId: number;

export function getNextContextId(): number {
  return nextContextId++;
}

// This function is used to raise exceptions on parse errors. It
// takes an offset integer (into the current `input`) to indicate
// the location of the error, attaches the position to the end
// of the error message, and then raises a `SyntaxError` with that
// message.
export function raise(pos: number, message: string): never {
  let loc = new LinesAndColumns(input).locationForIndex(pos);
  if (!loc) {
    loc = {line: 0, column: 0};
  }
  message += ` (${loc.line}:${loc.column})`;
  // tslint:disable-next-line no-any
  const err: any = new SyntaxError(message);
  err.pos = pos;
  err.loc = loc;
  throw err;
}

export function initParser(
  inputCode: string,
  isJSXEnabledArg: boolean,
  isTypeScriptEnabledArg: boolean,
  isFlowEnabledArg: boolean,
): void {
  input = inputCode;
  state = new State();
  state.init();
  nextContextId = 1;
  isJSXEnabled = isJSXEnabledArg;
  isTypeScriptEnabled = isTypeScriptEnabledArg;
  isFlowEnabled = isFlowEnabledArg;
}
