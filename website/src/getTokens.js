import {getFormattedTokens} from 'sucrase';

export default function getTokens(code, transforms) {
  try {
    return getFormattedTokens(code, {transforms})
  } catch (e) {
    console.error(e);
    return e.message;
  }
}
