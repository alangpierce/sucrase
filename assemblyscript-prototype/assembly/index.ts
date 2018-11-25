import "allocator/arena";
import {parse} from "../../src/parser";

export {memory};

export function snapshotMemory(): usize {
  return __memory_snapshot();
}

export function restoreMemoryToSnapshot(ptr: usize): void {
  __memory_resetToSnapshot(ptr);
}

export function countTokens(code: string): i32 {
  return parse(code, true, true, false).tokens.length;
}
