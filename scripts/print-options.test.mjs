import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execute = promisify(execFile);
const print = fileURLToPath(new URL("print.mjs", import.meta.url));

test("print rejects option values it cannot use before it reads the spec", async () => {
  const cases = [
    [["--format"], /--format needs a value/],
    [["--out"], /--out needs a value/],
    [["--format", "sepia"], /unknown format "sepia"/],
  ];
  for (const [flags, message] of cases) {
    const error = await execute(process.execPath, [print, "no-such-sheet.mjs", ...flags], { timeout: 30000 }).then(() => null, (failure) => failure);
    assert.equal(error?.code, 1, flags.join(" "));
    assert.match(error.stderr, message, flags.join(" "));
  }
});
