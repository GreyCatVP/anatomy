import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import * as k from "../kit/iso-kit.mjs";

const require = createRequire(import.meta.url);
const P = k.fitProjection(k.boxCorners({ x: -40, y: -30, w: 80, d: 60, r: 4 }, 0, 50), 400, 300);
const plan = { x: -12, y: 6, w: 24, d: 10, r: 2 };

test("onSide on a face of constant y runs along x and up z", () => {
  const points = [[-12, 6], [12, 6], [12, 16]];
  assert.equal(k.onSide(points, 20, "y", P), k.pathOf(points.map(([u, z]) => k.iso([u, 20, z], P))));
});

test("onSide on a face of constant x runs along y and up z", () => {
  const points = [[-12, 6], [12, 6], [12, 16]];
  assert.equal(k.onSide(points, 30, "x", P, true), k.pathOf(points.map(([u, z]) => k.iso([30, u, z], P)), true));
});

test("sideOutline is the closed rounded ring of the plan laid on the face", () => {
  for (const axis of ["x", "y"]) {
    assert.equal(k.sideOutline(plan, 20, axis, P), k.onSide(k.ringOf(plan, 8), 20, axis, P, true));
    assert.equal(k.sideOutline(plan, 20, axis, P, 3), k.onSide(k.ringOf(plan, 3), 20, axis, P, true));
  }
  assert.match(k.sideOutline(plan, 20, "y", P), /Z$/);
});

test("square sideOutline has its four corners where the face rectangle is", () => {
  const square = { x: -12, y: 6, w: 24, d: 10, r: 0 };
  const d = k.sideOutline(square, 20, "y", P, 1);
  for (const corner of [[-12, 20, 6], [12, 20, 6], [12, 20, 16], [-12, 20, 16]]) {
    const [x, y] = k.iso(corner, P).map((value) => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, ""));
    assert.ok(d.includes(`${x} ${y}`), `${corner} is missing from ${d}`);
  }
});

test("the TypeScript kit draws the same side outlines", () => {
  const ts = require("typescript");
  const directory = mkdtempSync(join(tmpdir(), "anatomy-side-outline-"));
  try {
    const output = join(directory, "iso-kit.cjs");
    const source = readFileSync(resolve("kit/iso-kit.ts"), "utf8");
    writeFileSync(output, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
    const typed = require(output);
    for (const axis of ["x", "y"]) {
      assert.equal(typed.sideOutline(plan, 20, axis, P), k.sideOutline(plan, 20, axis, P));
      assert.equal(typed.onSide([[0, 0], [5, 9]], -7, axis, P), k.onSide([[0, 0], [5, 9]], -7, axis, P));
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
