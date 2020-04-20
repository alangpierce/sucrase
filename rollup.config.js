/* eslint-disable import/no-extraneous-dependencies */
import nodeResolvePlugin from "@rollup/plugin-node-resolve";
import commonjsPlugin from "@rollup/plugin-commonjs";
import {terser as terserPlugin} from "rollup-plugin-terser";

export default {
  input: "dist/index",
  output: {
    file: "dist/sucrase.browser.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [nodeResolvePlugin(), commonjsPlugin(), terserPlugin()],
};
