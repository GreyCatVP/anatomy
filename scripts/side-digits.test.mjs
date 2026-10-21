import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import * as k from "../kit/iso-kit.mjs";

const require = createRequire(import.meta.url);
const P = k.fitProjection(k.boxCorners({ x: -40, y: -30, w: 80, d: 60, r: 4 }, 0, 50), 400, 300);
const box = [-20, 5, 40, 12];

test("there is one stroke glyph per digit", () => {
  assert.equal(k.DIGIT_STROKES.length, 10);
  for (const glyph of k.DIGIT_STROKES) for (const line of glyph) for (const [u, z] of line) {
    assert.ok(u >= 0 && u <= 1 && z >= 0 && z <= 2, `${u}, ${z} is outside the glyph box`);
  }
});

test("sideDigit on a face of constant y draws the glyph along x inside its box", () => {
  const d = k.sideDigit(7, [0, 0, 10, 20], 12, "y", P);
  assert.equal(d, k.pathOf([[2.4, 12, 16.8], [7.6, 12, 16.8], [4.168, 12, 3.2]].map((point) => k.iso(point, P))));
});

test("sideDigit on a face of constant x reads from high y to low y", () => {
  const d = k.sideDigit(7, [0, 0, 10, 20], 12, "x", P);
  assert.equal(d, k.pathOf([[12, 7.6, 16.8], [12, 2.4, 16.8], [12, 5.832, 3.2]].map((point) => k.iso(point, P))));
});

test("sideDigits lays the wheels out in reading order and rolls over like an odometer", () => {
  for (const axis of ["x", "y"]) {
    const wheel = (40 - 3) / 4;
    const at = (index) => (axis === "x" ? -20 + 40 - wheel - index * (wheel + 1) : -20 + index * (wheel + 1));
    const expected = [2, 0, 4, 7].map((digit, index) => k.sideDigit(digit, [at(index), 5, wheel, 12], 20, axis, P)).join("");
    assert.equal(k.sideDigits(2047, 4, box, 1, 20, axis, P), expected);
    assert.equal(k.sideDigits(12047, 4, box, 1, 20, axis, P), expected);
  }
  assert.equal(k.sideDigits(-1, 2, box, 1, 20, "y", P), k.sideDigits(99, 2, box, 1, 20, "y", P));
});

test("the TypeScript kit draws the same digits", () => {
  const ts = require("typescript");
  const directory = mkdtempSync(join(tmpdir(), "anatomy-side-digits-"));
  try {
    const output = join(directory, "iso-kit.cjs");
    const source = readFileSync(resolve("kit/iso-kit.ts"), "utf8");
    writeFileSync(output, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
    const typed = require(output);
    for (const axis of ["x", "y"]) {
      for (let digit = 0; digit < 10; digit++) assert.equal(typed.sideDigit(digit, box, 20, axis, P), k.sideDigit(digit, box, 20, axis, P));
      assert.equal(typed.sideDigits(9045, 4, box, 1.2, -7, axis, P), k.sideDigits(9045, 4, box, 1.2, -7, axis, P));
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
