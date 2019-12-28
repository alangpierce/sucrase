export const JSX_PREFIX = 'const _jsxFileName = "";';
export const IMPORT_DEFAULT_PREFIX = ` function _interopRequireDefault(obj) { \
return obj && obj.__esModule ? obj : { default: obj }; }`;
export const IMPORT_WILDCARD_PREFIX = ` function _interopRequireWildcard(obj) { \
if (obj && obj.__esModule) { return obj; } else { var newObj = {}; \
if (obj != null) { for (var key in obj) { \
if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } \
newObj.default = obj; return newObj; } }`;
export const CREATE_NAMED_EXPORT_FROM_PREFIX = ` function _createNamedExportFrom(obj, \
localName, importedName) { Object.defineProperty(exports, localName, \
{enumerable: true, get: () => obj[importedName]}); }`;
export const CREATE_STAR_EXPORT_PREFIX = ` function _createStarExport(obj) { \
Object.keys(obj) .filter((key) => key !== "default" && key !== "__esModule") \
.forEach((key) => { if (exports.hasOwnProperty(key)) { return; } \
Object.defineProperty(exports, key, {enumerable: true, get: () => obj[key]}); }); }`;
export const ESMODULE_PREFIX = 'Object.defineProperty(exports, "__esModule", {value: true});';
export const RHL_PREFIX = `(function () { \
var enterModule = require('react-hot-loader').enterModule; enterModule && enterModule(module); \
})();`;
export const NULLISH_COALESCE_PREFIX = ` function _nullishCoalesce(lhs, rhsFn) { \
if (lhs != null) { return lhs; } else { return rhsFn(); } }`;
export const OPTIONAL_CHAIN_PREFIX = ` function _optionalChain(ops) { \
let lastAccessLHS = undefined; let value = ops[0]; let i = 1; \
while (i < ops.length) { \
const op = ops[i]; const fn = ops[i + 1]; i += 2; \
if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } \
if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } \
else if (op === 'call' || op === 'optionalCall') { \
value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; \
} } return value; }`;
