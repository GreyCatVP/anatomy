import assert from "node:assert/strict";
import test from "node:test";
import { zonePalette, zoneGroup, stageNavCss, stageNavHtml, stageNavScript } from "../kit/stage-nav.mjs";

const zones = zonePalette([{ id: "a", name: "A", text: "first" }, { id: "b", name: "B", text: "second", color: "var(--anatomy-stage-5)" }]);

test("zonePalette assigns stage tokens in order and keeps an explicit colour", () => {
  assert.equal(zones[0].color, "var(--anatomy-stage-1)");
  assert.equal(zones[1].color, "var(--anatomy-stage-5)");
});

test("zoneGroup writes the zone class and the assembly name", () => {
  assert.equal(zoneGroup("a", "hopper", "<path/>"), '<g class="z z-a" data-asm="hopper"><path/></g>');
});

test("stageNavCss defines dark tokens with light overrides and no literal colour per zone", () => {
  const css = stageNavCss(zones);
  assert.match(css, /\.iso\{--anatomy-stage-1:#[0-9a-f]{6}/);
  assert.match(css, /\.iso\[data-theme="light"\]\{--anatomy-stage-1:#[0-9a-f]{6}/);
  assert.match(css, /\.z-a,[^{]*\{--zc:var\(--anatomy-stage-1\)\}/);
  assert.doesNotMatch(css, /NaN|undefined/);
});

test("stageNavHtml shows chips and toggles only for more than one zone", () => {
  const many = stageNavHtml(zones);
  assert.match(many, /data-z="a"/);
  assert.match(many, /data-autohi/);
  assert.match(many, /data-follow/);
  const one = stageNavHtml(zones.slice(0, 1));
  assert.doesNotMatch(one, /data-z=|data-autohi|data-follow/);
  assert.match(one, /data-view-reset/);
  assert.match(stageNavHtml(zones, { labels: { reset: "Home" } }), />Home </);
});

test("stageNavScript inlines a parseable runtime", () => {
  const src = stageNavScript();
  assert.match(src, /^function installStageNav\(/);
  assert.doesNotThrow(() => new Function(src));
});
