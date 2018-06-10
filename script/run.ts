/* eslint-disable no-console */
import {spawn} from "child_process";

/**
 * Variant of exec that connects stdout, stderr, and stdin, mostly so console
 * output is shown continuously. As with the mz version of exec, this returns a
 * promise that resolves when the shell command finishes.
 *
 * Taken directly from run in decaffeinate-examples.
 */
export default function run(command: string): Promise<void> {
  console.log(`> ${command}`);
  return new Promise((resolve, reject) => {
    const childProcess = spawn("/bin/bash", ["-c", command], {stdio: "inherit"});
    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${command}`));
      }
    });
  });
}
