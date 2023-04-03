/**
 * Single file expressing all Babel dependencies and applying all plugins so that they will be
 * in a single webpack chunk.
 */
// @ts-ignore
import {registerPlugin, transform} from "@babel/standalone";
// @ts-ignore
import DynamicImportPlugin from "babel-plugin-dynamic-import-node";
// @ts-ignore
import JestHoistPlugin from "babel-plugin-jest-hoist";
// @ts-ignore
import TransformFlowEnumsPlugin from "babel-plugin-transform-flow-enums";
// @ts-ignore
import ReactHotLoaderPlugin from "react-hot-loader/dist/babel.development";

registerPlugin("dynamic-import-node", DynamicImportPlugin);
registerPlugin("react-hot-loader", ReactHotLoaderPlugin);
registerPlugin("jest-hoist", JestHoistPlugin);
registerPlugin("transform-flow-enums", TransformFlowEnumsPlugin);

export {transform};
