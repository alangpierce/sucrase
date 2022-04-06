/* eslint-disable no-console */
import {readFile} from "mz/fs";

import run from "./run";
import sleep from "./sleep";

/**
 * This script releases the core sucrase package (NOT any integrations). To use:
 * 1.) Update package.json to the new version without committing.
 * 2.) Add changelog notes for the new version without committing.
 * 3.) Update getVersion in index.ts without committing.
 * 4.) Run this script with "yarn release" from the root directory.
 * 5.) Verify that everything in the commit looks right and push.
 *
 * To release an integration, take the equivalent manual steps:
 * 1.) Update the version in the integration's package.json.
 * 2.) Add changelog notes in the integration's CHANGELOG.md.
 * 3.) Run "yarn build" at the top level to make sure the integration is fully
 *     built.
 * 4.) Run "yarn publish" in the integration directory.
 * 5.) Commit and push the change.
 */
async function main(): Promise<void> {
  const packageJSON = JSON.parse((await readFile("./package.json")).toString());
  const version = packageJSON.version;
  const changelogText = await readFile("./CHANGELOG.md");
  if (!changelogText.includes(version)) {
    throw new Error("Release notes must be already added to changelog.");
  }
  const indexTSText = await readFile("./src/index.ts");
  if (!indexTSText.includes(version)) {
    throw new Error("getVersion must be updated to the new version.");
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
