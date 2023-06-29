/* eslint-disable import/first */
import PluginError = require("plugin-error");
import replaceExt = require("replace-ext");
// TODO: ESLint now rightfully complains about ESM syntax in a CJS file.
//  Keeping as-is to avoid unintended issues, but this could be resolved
//  when revisiting this plugin.
// eslint-disable-next-line import/no-import-module-exports
import {type Transform} from "stream";
// eslint-disable-next-line import/no-import-module-exports
import {type Options, transform} from "sucrase";
import through = require("through2");

const PLUGIN_NAME = "@sucrase/gulp-plugin";

function gulpSucrase(options: Options): Transform {
  return through.obj(function (
    this: Transform,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    file: any,
    enc: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cb: (err?: any, data?: any) => void,
  ): void {
    if (file.isNull()) {
      cb(null, file);
      return;
    }
    if (file.isStream()) {
      cb(new PluginError(PLUGIN_NAME, "Streaming is not supported."));
      return;
    }

    try {
      const resultCode = transform(file.contents.toString(), {
        filePath: file.path,
        ...options,
      }).code;
      file.contents = Buffer.from(resultCode);
      file.path = replaceExt(file.path, ".js");
      this.push(file);
    } catch (e) {
      e.message = `Error when processing file ${file.path}: ${e.message}`;
      this.emit("error", new PluginError(PLUGIN_NAME, e));
    }

    cb();
  });
}

module.exports = gulpSucrase;
