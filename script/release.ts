/* eslint-disable no-console */
import {readFile} from "mz/fs";
import run from "./run";
import sleep from "./sleep";

/**
 * To use:
 * 1.) Add changelog notes for the new version without committing.
 * 2.) Run this script with the new version number, e.g. "yarn release 1.2.3".
 * 3.) Verify that everything in the commit looks right and push.
 */
async function main(): Promise<void> {
  const version = process.argv[2];
  if (version.split(".").length !== 3 || version.includes(" ")) {
    throw new Error(`Invalid version: ${version}`);
  }
  const changelogText = await readFile("./CHANGELOG.md");
  if (!changelogText.includes(version)) {
    throw new Error("Release notes must be already added to changelog.");
  }
  console.log("Version is valid and found in changelog.");
  await run(`yarn publish --new-version ${version}`);
  console.log("Taking a quick nap to make sure we update with the right version.");
  await sleep(15000);
  await run("yarn add sucrase@latest");
  process.chdir("./website");
  await run("yarn add sucrase@latest");
  await run("yarn publish-website");
  process.chdir("..");
  await run(`git commit -a -m "v${version}"`);
  console.log("Done! Please sanity-check the commit, then push.");
}

main().catch((e) => {
  console.error("Unhandled error:");
  console.error(e);
});
