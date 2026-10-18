import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execute = promisify(execFile);
const drive = fileURLToPath(new URL("drive.mjs", import.meta.url));
// Validation must finish before Chrome starts, so a binary that is not Chrome is enough.
const env = { ...process.env, CHROME_PATH: process.execPath };

async function run(action) {
  const directory = await mkdtemp(join(tmpdir(), "anatomy-drive-shot-turn-"));
  try {
    const file = join(directory, "actions.json");
    await writeFile(file, JSON.stringify([action]));
    return await execute(process.execPath, ["--experimental-websocket", drive, "figure.html", "--actions", file], { env, timeout: 30000 }).then(() => ({ code: 0, stderr: "" }), (failure) => failure);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("drive rejects shot and turn arguments it cannot use before it starts Chrome", async () => {
  const cases = [
    [["shot"], /shot needs the name of a PNG file/],
    [["shot", 7], /shot needs the name of a PNG file/],
    [["shot", "a.png", 5], /shot needs a selector string/],
    [["shot", "a.png", null, 0], /shot needs a scale above 0/],
    [["shot", "a.png", null, "big"], /shot needs a scale above 0/],
    [["shot", "a.png", null, 1, [1, 2]], /shot needs a region of x, y, width and height/],
    [["shot", "a.png", null, 1, [0, 0, 0, 10]], /shot needs a region of x, y, width and height/],
    [["turn"], /turn needs an angle/],
    [["turn", "x"], /turn needs an angle/],
    [["turn", 30, 5], /turn needs a group name/],
    [["turn", "x", "pan"], /turn needs an angle/],
  ];
  for (const [action, message] of cases) {
    const result = await run(action);
    assert.equal(result.code, 1, JSON.stringify(action));
    assert.match(result.stderr, message, JSON.stringify(action));
  }
});

test("drive still accepts the documented shot and turn forms", async () => {
  const forms = [
    ["shot", "a.png"],
    ["shot", "a.png", ".iso-plate", 2, [0, 0, 100, 80]],
    ["shot", "a.png", null, null, null],
    ["turn", 30],
    ["turn", 30, "pan"],
    ["turn", { pan: 30, tilt: 10 }],
  ];
  for (const action of forms) {
    const result = await run(action);
    assert.doesNotMatch(result.stderr, /(shot|turn) needs/, JSON.stringify(action));
  }
});
