import {getFormattedTokens, Transform} from "sucrase";

export default function getTokens(code: string, transforms: Array<Transform>): string {
  try {
    return getFormattedTokens(code, {transforms});
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return e.message;
  }
}
