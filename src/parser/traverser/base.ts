import State from "../tokenizer/state";
import {charCodes} from "../util/charcodes";

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
  // tslint:disable-next-line no-any
  const err: any = new SyntaxError(message);
  err.pos = pos;
  throw err;
}

// tslint:disable-next-line no-any
export function augmentError(error: any): any {
  if ("pos" in error) {
    const loc = locationForIndex(error.pos);
    error.message += ` (${loc.line}:${loc.column})`;
    error.loc = loc;
  }
  return error;
}

export class Loc {
  line: number;
  column: number;
  constructor(line: number, column: number) {
    this.line = line;
    this.column = column;
  }
}

export function locationForIndex(pos: number): Loc {
  let line = 1;
  let column = 1;
  for (let i = 0; i < pos; i++) {
    if (input.charCodeAt(i) === charCodes.lineFeed) {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return new Loc(line, column);
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
