import File2 from './file2.cjs';
import File3 = require("./file3.cjs");
if (File2 !== 2) {
  throw new Error();
}
if (File3 !== 3) {
  throw new Error();
}
