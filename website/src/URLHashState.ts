import * as Base64 from "base64-js";
import GZip from "gzip-js";
import type {Options, Transform} from "sucrase";

import {
  DEFAULT_COMPARE_WITH_BABEL,
  DEFAULT_COMPARE_WITH_TYPESCRIPT,
  DEFAULT_OPTIONS,
  DEFAULT_SHOW_TOKENS,
  INITIAL_CODE,
} from "./Constants";

interface BaseHashState {
  code: string;
  sucraseOptions: Options;
  compareWithBabel: boolean;
  compareWithTypeScript: boolean;
  showTokens: boolean;
}

type HashState = BaseHashState & {compressedCode: string};

export function saveHashState({
  code,
  compressedCode,
  sucraseOptions,
  compareWithBabel,
  compareWithTypeScript,
  showTokens,
}: HashState): void {
  const components = [];

  const serializedSucraseOptions = JSON.stringify(sucraseOptions);
  if (serializedSucraseOptions !== JSON.stringify(DEFAULT_OPTIONS)) {
    components.push(`sucraseOptions=${encodeURIComponent(serializedSucraseOptions)}`);
  }
  if (compareWithBabel !== DEFAULT_COMPARE_WITH_BABEL) {
    components.push(`compareWithBabel=${compareWithBabel}`);
  }
  if (compareWithTypeScript !== DEFAULT_COMPARE_WITH_TYPESCRIPT) {
    components.push(`compareWithTypeScript=${compareWithTypeScript}`);
  }
  if (showTokens !== DEFAULT_SHOW_TOKENS) {
    components.push(`showTokens=${showTokens}`);
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

export function loadHashState(): Partial<BaseHashState> | null {
  try {
    const hashContents = window.location.hash;
    if (!hashContents.startsWith("#")) {
      return null;
    }
    const components = hashContents.slice(1).split("&");
    const result: Partial<HashState> = {};
    for (const component of components) {
      const [key, value] = component.split("=");
      if (key === "sucraseOptions") {
        result.sucraseOptions = JSON.parse(decodeURIComponent(value));
      } else if (key === "selectedTransforms") {
        // Old URLs may have selectedTransforms from before the format switched
        // to sucraseOptions.
        result.sucraseOptions = {transforms: value.split(",") as Array<Transform>};
      } else if (key === "code") {
        result.code = decodeURIComponent(value);
      } else if (key === "compressedCode") {
        result.code = decompressCode(decodeURIComponent(value));
      } else if (["compareWithBabel", "compareWithTypeScript", "showTokens"].includes(key)) {
        result[key] = value === "true";
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

export function compressCode(code: string): string {
  return Base64.fromByteArray(Uint8Array.from(GZip.zip(code)));
}

function decompressCode(compressedCode: string): string {
  return String.fromCharCode(...GZip.unzip(Base64.toByteArray(compressedCode)));
}
