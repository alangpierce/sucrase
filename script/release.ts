/* eslint-disable no-console */
import {readFile} from "mz/fs";
import run from "./run";
import sleep from "./sleep";

/**
 * To use:
 * 1.) Update package.json to the new version without committing.
 * 2.) Add changelog notes for the new version without committing.
 * 3.) Run this script with "yarn release" from the root directory.
 * 4.) Verify that everything in the commit looks right and push.
 */
async function main(): Promise<void> {
  const packageJSON = JSON.parse((await readFile("./package.json")).toString());
  const version = packageJSON.version;
  const changelogText = await readFile("./CHANGELOG.md");
  if (!changelogText.includes(version)) {
    throw new Error("Release notes must be already added to changelog.");
  }
  console.log(`Version ${version} is valid and found in changelog.`);
  try {
    await run("npm whoami");
  } catch (e) {
    await run("npm login");
  }
  await run("npm publish");
  console.log("Taking a quick nap to make sure we update with the right version.");
  await sleep(30000);
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
  process.exitCode = 1;
});
