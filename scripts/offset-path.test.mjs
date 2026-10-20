import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { offsetPath } from "../kit/iso-kit.mjs";

const require = createRequire(import.meta.url);
const near = (actual, expected) => actual.forEach((point, index) => point.forEach((value, axis) => assert.ok(Math.abs(value - expected[index][axis]) < 1e-9, `${actual} is not ${expected}`)));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test("a straight path moves sideways by exactly by, toward +y for a path along +x", () => {
  near(offsetPath([[0, 0], [10, 0]], 2), [[0, 2], [10, 2]]);
  near(offsetPath([[0, 0], [10, 0]], -2), [[0, -2], [10, -2]]);
  near(offsetPath([[0, 0], [0, 10]], 2), [[-2, 0], [-2, 10]]);
});

test("a square corner is mitred so both legs stay by away", () => {
  near(offsetPath([[0, 0], [10, 0], [10, 10]], 2), [[0, 2], [8, 2], [8, 10]]);
  near(offsetPath([[0, 0], [10, 0], [10, 10]], -2), [[0, -2], [12, -2], [12, 10]]);
});

test("every point of a gentle curve stays by away from both of its segments", () => {
  const points = Array.from({ length: 9 }, (_, index) => [index * 10, 20 * Math.sin(index / 3)]);
  const moved = offsetPath(points, 3);
  for (let index = 1; index < points.length - 1; index++) {
    for (const [a, b] of [[points[index - 1], points[index]], [points[index], points[index + 1]]]) {
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const across = ((moved[index][0] - a[0]) * -dy + (moved[index][1] - a[1]) * dx) / Math.hypot(dx, dy);
      assert.ok(Math.abs(across - 3) < 1e-9, `point ${index} is ${across} from a segment`);
    }
  }
});

test("a hairpin is held to limit times by", () => {
  const points = [[0, 0], [10, 0], [0, 0.5]];
  assert.ok(distance(offsetPath(points, 2)[1], points[1]) <= 8 + 1e-9);
  assert.ok(distance(offsetPath(points, 2, 2)[1], points[1]) <= 4 + 1e-9);
});

test("repeated points move with their neighbours and single points stay", () => {
  near(offsetPath([[0, 0], [0, 0], [10, 0], [10, 0]], 2), [[0, 2], [0, 2], [10, 2], [10, 2]]);
  near(offsetPath([[5, 5]], 2), [[5, 5]]);
  near(offsetPath([[5, 5], [5, 5]], 2), [[5, 5], [5, 5]]);
  assert.deepEqual(offsetPath([], 2), []);
});

test("the TypeScript kit offsets the same", () => {
  const ts = require("typescript");
  const directory = mkdtempSync(join(tmpdir(), "anatomy-offset-path-"));
  try {
    const output = join(directory, "iso-kit.cjs");
    writeFileSync(output, ts.transpileModule(readFileSync(resolve("kit/iso-kit.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
    const typed = require(output);
    const points = [[0, 0], [10, 0], [14, 6], [14, 6], [30, 9]];
    for (const by of [2, -3]) assert.deepEqual(typed.offsetPath(points, by), offsetPath(points, by));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
