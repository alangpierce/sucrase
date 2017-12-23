import {getFormatedTokens} from 'sucrase';

export default function getTokens(code) {
  try {
    return getFormatedTokens(code)
  } catch (e) {
    return e.message;
  }
}
