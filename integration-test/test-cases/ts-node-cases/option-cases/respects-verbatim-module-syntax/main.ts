// This import should be preserved.
import A from './set-global-to-3.js'

if (global.testValue !== 3) {
  throw new Error();
}
