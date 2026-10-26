import assert from "node:assert/strict";
import test from "node:test";
import * as A from "../kit/audit.mjs";

const P = { origin: [0, 0], scale: 1, azimuth: 0, elevation: 0 };
const plate = (x0, x1) => ({ name: "plate", key: 0, shapes: [A.box([x0, -10, -10], [x1, 10, 10], { name: "plate" })] });
const wire = (x, radius) => ({ name: "wire", key: 0, shapes: [A.tube([[x, -8, -6], [x, 8, 6]], radius, { name: "wire" })] });
const solve = (items) => {
  const overlaps = A.overlapsOf(items, P);
  return { overlaps, keys: A.orderKeys(items, overlaps).keys };
};

test("a tube thinner than a grid cell is ordered behind the plate that hides it", () => {
  const { overlaps, keys } = solve([plate(0, 1), wire(-5, 0.05)]);
  assert.equal(overlaps.pairs.length, 1);
  assert.ok(keys[0] > keys[1]);
});

test("a tube thinner than a grid cell is ordered in front of the plate it lies over", () => {
  const { overlaps, keys } = solve([plate(0, 1), wire(5, 0.05)]);
  assert.equal(overlaps.pairs.length, 1);
  assert.ok(keys[1] > keys[0]);
});

test("a thin tube is measured at its true depth, not at the depth of the widened footprint", () => {
  const { overlaps, keys } = solve([plate(0.9, 1), wire(0.45, 0.05)]);
  assert.equal(overlaps.pairs.length, 1);
  assert.ok(keys[0] > keys[1]);
});

test("an oblique thin tube stays behind a plate separated from its entire surface", () => {
  const along = [Math.sqrt(0.99), 0.1, 0];
  const normal = [0.1, -Math.sqrt(0.99), 0];
  const items = [
    { name: "plate", key: 0, shapes: [A.orientedBox(normal.map((v) => v * 0.09), [normal, along, [0, 0, 1]], [0.01, 20, 1])] },
    { name: "wire", key: 0, shapes: [A.tube([along.map((v) => -20 * v), along.map((v) => 20 * v)], 0.05)] },
  ];
  const { overlaps, keys } = solve(items);
  assert.equal(overlaps.pairs.length, 1);
  assert.ok(keys[0] > keys[1]);
});
