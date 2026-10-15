import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execute = promisify(execFile);

for (const name of ["capture", "drive", "turn-check"]) {
  test(`${name} removes its profile when Chrome exits before startup`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "anatomy-chrome-startup-"));
    let profile;
    try {
      const binary = join(directory, "mock-chrome.mjs");
      const receipt = join(directory, "profile.txt");
      await writeFile(binary, 'import { writeFileSync } from "node:fs";\nfor (const arg of process.argv.slice(2)) {\n  if (arg.startsWith("--user-data-dir=")) writeFileSync(process.env.ANATOMY_PROFILE_RECEIPT, arg.slice(16));\n}\nprocess.exit(7);\n');
      const started = performance.now();
      let result;
      try {
        await execute(process.execPath, [fileURLToPath(new URL(`${name}.mjs`, import.meta.url)), join(directory, "figure.html"), ...(name === "drive" ? ["[]"] : name === "turn-check" ? ["--lines"] : [])], { timeout: 30000, env: { ...process.env, CHROME_PATH: binary, ANATOMY_PROFILE_RECEIPT: receipt } });
      } catch (error) {
        result = error;
      }
      profile = await readFile(receipt, "utf8");
      assert.equal(result?.code, 1);
      await assert.rejects(access(profile), { code: "ENOENT" });
      assert.ok(performance.now() - started < 10000);
      assert.match(result.stderr, /Chrome exited before startup.*7/);
    } finally {
      if (profile) await rm(profile, { recursive: true, force: true });
      await rm(directory, { recursive: true, force: true });
    }
  });
}
