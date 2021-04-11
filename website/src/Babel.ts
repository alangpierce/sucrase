/**
 * Single file expressing all Babel dependencies and applying all plugins so that they will be
 * in a single webpack chunk.
 */
// @ts-ignore
import NumericSeparatorPlugin from "@babel/plugin-proposal-numeric-separator";
// @ts-ignore
import {registerPlugin, transform} from "@babel/standalone";
// @ts-ignore
import DynamicImportPlugin from "babel-plugin-dynamic-import-node";
// @ts-ignore
import JestHoistPlugin from "babel-plugin-jest-hoist";
// @ts-ignore
import ReactHotLoaderPlugin from "react-hot-loader/dist/babel.development";

registerPlugin("proposal-numeric-separator", NumericSeparatorPlugin);
registerPlugin("dynamic-import-node", DynamicImportPlugin);
registerPlugin("react-hot-loader", ReactHotLoaderPlugin);
registerPlugin("jest-hoist", JestHoistPlugin);

export {transform};
