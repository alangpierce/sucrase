import * as Base64 from "base64-js";
import GZip from "gzip-js";

import {
  DEFAULT_COMPARE_WITH_BABEL,
  DEFAULT_COMPARE_WITH_TYPESCRIPT,
  DEFAULT_SHOW_TOKENS,
  DEFAULT_TRANSFORMS,
  INITIAL_CODE,
  TRANSFORMS,
} from "./Constants";

interface BaseHashState {
  code: string;
  selectedTransforms: {[transformName: string]: boolean};
  compareWithBabel: boolean;
  compareWithTypeScript: boolean;
  showTokens: boolean;
}

type HashState = BaseHashState & {compressedCode: string};

export function saveHashState({
  code,
  compressedCode,
  selectedTransforms,
  compareWithBabel,
  compareWithTypeScript,
  showTokens,
}: HashState): void {
  const components = [];

  const transformsValue = TRANSFORMS.filter(({name}) => selectedTransforms[name])
    .map(({name}) => name)
    .join(",");

  if (transformsValue !== DEFAULT_TRANSFORMS.join(",")) {
    components.push(`selectedTransforms=${transformsValue}`);
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
    const components = hashContents.substr(1).split("&");
    const result: Partial<HashState> = {};
    for (const component of components) {
      const [key, value] = component.split("=");
      if (key === "selectedTransforms") {
        result.selectedTransforms = {};
        for (const transformName of value.split(",")) {
          result.selectedTransforms[transformName] = true;
        }
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
