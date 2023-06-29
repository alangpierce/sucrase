import {getFormattedTokens, type Options} from "sucrase";

export default function getTokens(code: string, options: Options): string {
  try {
    return getFormattedTokens(code, options);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return e.message;
  }
}
