import "allocator/arena";
import {parse} from "../../src/parser";

export {memory};

export function resetMemory(): void {
  memory.reset();
}

export function countTokens(code: string): i32 {
  return parse(code, true, true, false).tokens.length;
}
