"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _A = require('../A'); var _A2 = _interopRequireDefault(_A);

async function foo() {
  const B = (await import("../B")).default;
  console.log(_A2.default + B);
}
