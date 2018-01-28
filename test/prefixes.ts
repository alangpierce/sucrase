export const JSX_PREFIX = 'const _jsxFileName = "";';
export const IMPORT_PREFIX = ` function _interopRequireWildcard(obj) { \
if (obj && obj.__esModule) { return obj; } else { var newObj = {}; \
if (obj != null) { for (var key in obj) { \
if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } \
newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { \
return obj && obj.__esModule ? obj : { default: obj }; }`;
export const ESMODULE_PREFIX = 'Object.defineProperty(exports, "__esModule", {value: true});';
