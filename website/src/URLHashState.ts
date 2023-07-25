import * as Base64 from "base64-js";
import GZip from "gzip-js";
import {produce} from "immer";
import type {Transform} from "sucrase";

import {
  type DebugOptions,
  DEFAULT_DEBUG_OPTIONS,
  DEFAULT_COMPARE_OPTIONS,
  DEFAULT_OPTIONS,
  type CompareOptions,
  type HydratedOptions,
  INITIAL_CODE,
} from "./Constants";
import {entriesExact, hasKeyExact} from "./Util";

export interface BaseHashState {
  code: string;
  sucraseOptions: HydratedOptions;
  compareOptions: CompareOptions;
  debugOptions: DebugOptions;
}

type HashState = BaseHashState & {compressedCode: string};

export function saveHashState({
  code,
  compressedCode,
  sucraseOptions,
  compareOptions,
  debugOptions,
}: HashState): void {
  const components = [];

  for (const [key, defaultValue] of entriesExact(DEFAULT_OPTIONS)) {
    const value = sucraseOptions[key];
    if (JSON.stringify(value) !== JSON.stringify(defaultValue)) {
      // Booleans, strings, and string arrays can all be formatted in a
      // URL-friendly way by simply converting to string.
      const formattedValue = String(value);
      components.push(`${key}=${encodeURIComponent(formattedValue)}`);
    }
  }
  for (const [key, defaultValue] of entriesExact(DEFAULT_COMPARE_OPTIONS)) {
    const value = compareOptions[key];
    if (value !== defaultValue) {
      components.push(`${key}=${value}`);
    }
  }
  for (const [key, defaultValue] of entriesExact(DEFAULT_DEBUG_OPTIONS)) {
    const value = debugOptions[key];
    if (value !== defaultValue) {
      components.push(`${key}=${value}`);
    }
  }

  if (code !== INITIAL_CODE) {
    if (code.length > 150) {
      components.push(`compressedCode=${encodeURIComponent(compressedCode)}`);
    } else {
      components.push(`code=${encodeURIComponent(code)}`);
    }
  }

  if (components.length > 0) {
    window.location.hash = components.join("&");
  } else {
    window.history.replaceState(
      "",
      document.title,
      window.location.pathname + window.location.search,
    );
  }
}

export function loadHashState(): BaseHashState | null {
  try {
    const hashContents = window.location.hash;
    if (!hashContents.startsWith("#")) {
      return null;
    }
    const components = hashContents.slice(1).split("&");
    let result: BaseHashState = {
      code: INITIAL_CODE,
      sucraseOptions: DEFAULT_OPTIONS,
      compareOptions: DEFAULT_COMPARE_OPTIONS,
      debugOptions: DEFAULT_DEBUG_OPTIONS,
    };
    for (const component of components) {
      const [key, value] = component.split("=");
      if (key === "selectedTransforms") {
        // Old URLs may have the old name selectedTransforms rather than transforms.
        result = produce(result, (draft) => {
          draft.sucraseOptions.transforms = value.split(",") as Array<Transform>;
        });
      } else if (hasKeyExact(DEFAULT_OPTIONS, key)) {
        result = produce(result, (draft) => {
          // TS gets the key type wrong here, so just use any.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (draft.sucraseOptions as any)[key] = parseOptionValue(key, decodeURIComponent(value));
        });
      } else if (key === "code") {
        result = produce(result, (draft) => {
          draft.code = decodeURIComponent(value);
        });
      } else if (key === "compressedCode") {
        result = produce(result, (draft) => {
          draft.code = decompressCode(decodeURIComponent(value));
        });
      } else if (hasKeyExact(DEFAULT_COMPARE_OPTIONS, key)) {
        result = produce(result, (draft) => {
          draft.compareOptions[key] = value === "true";
        });
      } else if (hasKeyExact(DEFAULT_DEBUG_OPTIONS, key)) {
        result = produce(result, (draft) => {
          draft.debugOptions[key] = value === "true";
        });
      }
    }
    // Deleting code and refreshing should give the default state again.
    if (result.code === "") {
      return null;
    }
    return result;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Error when loading hash fragment.`);
    // eslint-disable-next-line no-console
    console.error(e);
    return null;
  }
}

/**
 * Parse a raw value from URL by looking at the type of the default value.
 */
function parseOptionValue(
  key: keyof HydratedOptions,
  rawValue: string,
): string | boolean | Array<string> {
  const defaultValue = DEFAULT_OPTIONS[key];
  if (typeof defaultValue === "boolean") {
    return rawValue === "true";
  } else if (typeof defaultValue === "string") {
    return rawValue;
  } else if (Array.isArray(defaultValue)) {
    return rawValue.split(",");
  } else {
    throw new Error(`Unexpected type when reading option ${key}`);
  }
}

export function compressCode(code: string): string {
  return Base64.fromByteArray(Uint8Array.from(GZip.zip(code)));
}

function decompressCode(compressedCode: string): string {
  return String.fromCharCode(...GZip.unzip(Base64.toByteArray(compressedCode)));
}
