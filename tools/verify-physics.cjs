#!/usr/bin/env node
/**
 * Builds and runs the Node smoke test for the Ammo.js layer.
 *
 * The test entry uses ES modules, while this package is not declared as
 * `"type": "module"`. Parcel (already a dependency) is used as the ESM
 * bundler for the Node target, which also verifies that the module graph the
 * browser uses is resolvable.
 *
 * Usage: npm run test:physics
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".tmp-physics");
const bundle = path.join(outDir, "physics-smoke-entry.js");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

const build = run(npx, [
  "parcel",
  "build",
  "tools/physics-smoke-entry.js",
  "--target",
  "node",
  "--no-minify",
  "--out-dir",
  ".tmp-physics",
  "--no-cache",
]);

if (build.status !== 0) {
  console.error("Could not build the physics smoke test.");
  process.exit(build.status || 1);
}

const test = run(process.execPath, [bundle]);
const status = test.status === null ? 1 : test.status;

try {
  fs.rmSync(outDir, { recursive: true, force: true });
} catch (error) {
  console.warn(`Could not remove ${outDir}: ${error.message}`);
}

process.exit(status);
