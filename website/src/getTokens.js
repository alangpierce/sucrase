import {getFormattedTokens} from 'sucrase';

export default function getTokens(code) {
  try {
    return getFormattedTokens(code)
  } catch (e) {
    console.error(e);
    return e.message;
  }
}
