/**
 * Single file expressing all Babel dependencies and applying all plugins so that they will be
 * in a single webpack chunk.
 */
// @ts-ignore
import {registerPlugin, transform} from "@babel/standalone";

// @ts-ignore
import NumericSeparatorPlugin from "@babel/plugin-proposal-numeric-separator";
// @ts-ignore
import DynamicImportPlugin from "babel-plugin-dynamic-import-node";
// @ts-ignore
import ReactHotLoaderPlugin from "react-hot-loader/dist/babel.development";

registerPlugin("proposal-numeric-separator", NumericSeparatorPlugin);
registerPlugin("dynamic-import-node", DynamicImportPlugin);
registerPlugin("react-hot-loader", ReactHotLoaderPlugin);

export {transform};
