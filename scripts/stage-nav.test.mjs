import assert from "node:assert/strict";
import test from "node:test";
import { zonePalette, zoneGroup, stageNavCss, stageNavHtml, stageNavBar, stageNavScript } from "../kit/stage-nav.mjs";

const zones = zonePalette([{ id: "a", name: "A", text: "first" }, { id: "b", name: "B", text: "second", color: "var(--anatomy-stage-5)" }]);

test("zonePalette assigns stage tokens in order and keeps an explicit colour", () => {
  assert.equal(zones[0].color, "var(--anatomy-stage-1)");
  assert.equal(zones[1].color, "var(--anatomy-stage-5)");
});

test("zoneGroup writes the zone class and the assembly name", () => {
  assert.equal(zoneGroup("a", "hopper", "<path/>"), '<g class="z z-a" data-asm="hopper"><path/></g>');
  assert.equal(zoneGroup(null, "neuron", "<path/>"), '<g data-asm="neuron"><path/></g>');
});

test("stageNavCss dims by pulling tones towards the card, not by opacity", () => {
  const css = stageNavCss(zones);
  assert.doesNotMatch(css, /opacity/);
  assert.match(css, /\.iso-stage\[data-focus\]:not\(\[data-focus="a"\]\) \.z-a[^{]*\{--nav-dim:82%;--anatomy-paper:color-mix\(in srgb,var\(--nav-paper\),var\(--nav-card\) var\(--nav-dim\)\)/);
});

test("stageNavCss clips a zoomed drawing and leaves the corner readout alone", () => {
  const css = stageNavCss(zones);
  assert.match(css, /\.iso-stage svg\[data-zoomed\]\{overflow:hidden\}/);
  assert.doesNotMatch(css, /data-corner="readout"/);
  assert.match(css, /\[data-nav-bar\]\{--zc:var\(--anatomy-stage-1\)\}/);
});

test("stageNavBar is a live region outside the hidden corners", () => {
  assert.equal(stageNavBar(), '<div class="nav-bar" data-nav-bar aria-live="polite"></div>');
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

test("stage-nav jumps under reduced motion and makes parts keyboard targets with zoomOnClick", () => {
  const src = stageNavScript();
  assert.match(src, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(src, /setAttribute\("tabindex", "0"\)/);
  assert.match(src, /e\.key !== "Enter" && e\.key !== " "/);
  assert.match(stageNavCss(zones), /\[data-asm\]\[tabindex\]:focus-visible\{outline:/);
});
