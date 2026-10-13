import test from "node:test";
import assert from "node:assert/strict";
import * as AN from "../kit/anatoly.mjs";
import { anatolyScript, anatolyCss } from "./inline-anatoly.mjs";

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const ENTRIES = [
  { id: "tape-joint", kind: "improvised", where: "drain line, second joint", why: "the right washer was in the other van", hero: true, fails: "leak", audit: { allow: [["bodge.tape-joint.*", "drain.*"]] } },
  { id: "shim-foot", kind: "missing", where: "front left foot", why: "foot lost, folded the invoice", fails: "rock" },
  { id: "lean-post", kind: "misaligned", where: "gauge post", why: "drilled the hole by eye", audit: { crowd: [["bodge.lean-post", "drain"]] } },
  { id: "adapter", kind: "wrong-part", where: "inlet", why: "had a 15, needed a 10", audit: { cover: ["bodge.adapter.stack"] } },
  { id: "screw-gone", kind: "missing", where: "base plate, back right", why: "it rolled under the sink" },
];

test("seeds are deterministic and in range", () => {
  const a = AN.bodgeRng("deck");
  const b = AN.bodgeRng("deck");
  const c = AN.bodgeRng("other");
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => b()));
  assert.notEqual(xs[0], c());
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(mean > 0.45 && mean < 0.55, `mean ${mean}`);
  assert.equal(AN.bodgeRng(7)(), AN.bodgeRng(7)());
});

test("yawRing turns about the centroid and keeps extra coordinates", () => {
  const square = [[0, 0], [2, 0], [2, 2], [0, 2]];
  const turned = AN.yawRing(square, 90);
  assert.ok(close(turned[0][0], 2) && close(turned[0][1], 0));
  assert.ok(close(turned[1][0], 2) && close(turned[1][1], 2));
  const about = AN.yawRing([[1, 0, 5, 0.4]], 180, [0, 0]);
  assert.ok(close(about[0][0], -1) && close(about[0][1], 0));
  assert.deepEqual(about[0].slice(2), [5, 0.4]);
});

test("leanAxis is a unit vector at the right angle", () => {
  const a = AN.leanAxis(4, [3, 4]);
  assert.ok(close(Math.hypot(...a), 1));
  assert.ok(close(Math.acos(a[2]) * 180 / Math.PI, 4, 1e-9));
  assert.ok(close(a[0] / a[1], 3 / 4));
  assert.deepEqual(AN.leanAxis(0, [1, 0]).map((v) => Math.round(v * 1e9) / 1e9), [0, 0, 1]);
  assert.throws(() => AN.leanAxis(3, [0, 0]));
  const tip = AN.leanTip([10, 0, 2], 50, 90, [0, 1]);
  assert.ok(close(tip[0], 10) && close(tip[1], 50) && close(tip[2], 2, 1e-9));
});

test("sagRoute keeps its ends and sags by depth at the middle", () => {
  const route = AN.sagRoute([0, 0, 10], [20, 0, 10], 6, { steps: 10 });
  assert.equal(route.length, 11);
  assert.deepEqual(route[0], [0, 0, 10]);
  assert.deepEqual(route[10], [20, 0, 10]);
  assert.ok(close(route[5][2], 4));
  assert.ok(route.every((p) => p[2] <= 10 + 1e-12));
  assert.throws(() => AN.sagRoute([0, 0, 0], [1, 0, 0], 1, { steps: 1 }));
});

test("handBent moves only interior points, within amount, repeatably", () => {
  const pts = [[0, 0, 0], [10, 0, 0], [20, 0, 0], [30, 0, 0]];
  const bent = AN.handBent(pts, 1.5, "coat-hanger");
  assert.deepEqual(bent[0], pts[0]);
  assert.deepEqual(bent[3], pts[3]);
  for (let i = 1; i < 3; i++) for (let k = 0; k < 3; k++) assert.ok(Math.abs(bent[i][k] - pts[i][k]) <= 1.5);
  assert.deepEqual(AN.handBent(pts, 1.5, "coat-hanger"), bent);
  assert.notDeepEqual(AN.handBent(pts, 1.5, "other"), bent);
});

test("adapterProfile rises strictly and lands on every size", () => {
  const profile = AN.adapterProfile([6, 4.5, 3.2, 2.4]);
  for (let i = 1; i < profile.length; i++) assert.ok(profile[i][0] > profile[i - 1][0], `s falls at ${i}`);
  for (const r of [6, 4.5, 3.2, 2.4]) assert.ok(profile.some(([, pr]) => close(pr, r)));
  assert.ok(profile.some(([, pr]) => close(pr, 6.8)));
  assert.equal(profile[profile.length - 1][1], 2.4);
  assert.throws(() => AN.adapterProfile([5]));
  assert.throws(() => AN.adapterProfile([5, 3], { body: 0.5, chamfer: 0.3 }));
});

test("a good ledger passes and drives the build", () => {
  const B = AN.ledger(ENTRIES, { size: "figure", failures: ["leak", "rock"] }).assert();
  assert.equal(B.hero.id, "tape-joint");
  assert.equal(B.on("shim-foot"), true);
  assert.throws(() => B.on("typo"));
  assert.equal(B.name("adapter", "stack"), "bodge.adapter.stack");
  const options = B.auditOptions({ crowd: [["x", "y"]] });
  assert.deepEqual(options.allow, [["bodge.tape-joint.*", "drain.*"]]);
  assert.deepEqual(options.crowd, [["x", "y"], ["bodge.lean-post", "drain"]]);
  assert.deepEqual(options.cover, ["bodge.adapter.stack"]);
  assert.match(B.report(), /\* tape-joint/);
});

test("--honest turns every bodge and exemption off", () => {
  const B = AN.ledger(ENTRIES, { honest: true }).assert();
  assert.equal(B.on("tape-joint"), false);
  assert.deepEqual(B.auditOptions(), { allow: [], crowd: [], cover: [] });
  assert.equal(B.report(), "honest build: no bodges");
});

test("the ledger catches the usual mistakes", () => {
  const bad = [
    { id: "Tape", kind: "improvised", where: "x", why: "y" },
    { id: "dup", kind: "magic", where: "", why: "" },
    { id: "dup", kind: "worn", where: "x", why: "y", fails: "explode" },
  ];
  const list = AN.ledger(bad, { size: "hero", failures: ["leak"] }).problems();
  const text = list.join("\n");
  assert.match(text, /bad id "Tape"/);
  assert.match(text, /duplicate id dup/);
  assert.match(text, /unknown kind "magic"/);
  assert.match(text, /say where/);
  assert.match(text, /Anatoly's reason/);
  assert.match(text, /exactly one hero/);
  assert.match(text, /hero carries 10–18/);
  assert.match(text, /"explode" is not a failure/);
  assert.match(text, /failure leak is not caused/);
  assert.throws(() => AN.ledger(bad).assert(), /bodge ledger/);
});

test("failureClock walks its phases", () => {
  const clock = AN.failureClock([{ name: "works", dur: 1 }, { name: "strains", dur: 0.5 }, { name: "gives", dur: 0.25 }, { name: "settles", dur: 0.75 }]);
  assert.equal(clock.total, 2.5);
  assert.deepEqual(clock.at(-1), { phase: "works", index: 0, u: 0, done: false, t: 0 });
  assert.equal(clock.at(0.5).phase, "works");
  assert.ok(close(clock.at(1.25).u, 0.5));
  assert.equal(clock.at(1.6).phase, "gives");
  assert.equal(clock.at(3).done, true);
  assert.equal(clock.at(3).phase, "settles");
  assert.equal(clock.startOf("gives"), 1.5);
  assert.throws(() => clock.startOf("nope"));
  assert.throws(() => AN.failureClock([{ name: "x", dur: 0 }]));
});

test("shakeAt starts at zero, never pops, and dies out", () => {
  assert.equal(AN.shakeAt(0), 0);
  assert.equal(AN.shakeAt(-1), 0);
  const dt = 1 / 600;
  let worst = 0;
  let prev = 0;
  for (let t = dt; t < 0.2; t += dt) {
    const v = AN.shakeAt(t, { amp: 2 });
    worst = Math.max(worst, Math.abs(v - prev));
    prev = v;
  }
  assert.ok(worst < 0.2, `largest step ${worst}`);
  assert.ok(Math.abs(AN.shakeAt(3, { amp: 2 })) < 0.002);
});

test("fallAt falls, lands, bounces once and stays down", () => {
  assert.equal(AN.fallAt(0, 30), 0);
  const tHit = Math.sqrt(60 / 2400);
  assert.ok(close(AN.fallAt(tHit, 30), 30, 1e-9));
  assert.ok(AN.fallAt(tHit + 0.02, 30) < 30);
  assert.equal(AN.fallAt(5, 30), 30);
  assert.equal(AN.fallAt(tHit + 0.01, 30, { bounce: 0 }), 30);
  let last = 0;
  for (let t = 0; t <= tHit; t += 0.001) {
    const d = AN.fallAt(t, 30);
    assert.ok(d >= last - 1e-12);
    last = d;
  }
});

test("rockAt starts at its landing turn and dies out", () => {
  assert.equal(AN.rockAt(0, 12), 12);
  assert.ok(Math.abs(AN.rockAt(2, 12)) < 0.01);
  assert.ok(AN.rockAt(0.2, 12) < 0, "it rocks over to the other rim");
  for (let t = 0; t < 1; t += 0.01) assert.ok(Math.abs(AN.rockAt(t + 0.01, 12) - AN.rockAt(t, 12)) < 3, "no jump");
});

test("tipAt tips over, lands at rest, bounces back a touch and settles", () => {
  assert.equal(AN.tipAt(0, 8, 120), 8);
  assert.ok(close(AN.tipAt(0.3, 8, 120), 120, 1e-9));
  let last = 8;
  for (let t = 0; t <= 0.3; t += 0.005) {
    const turn = AN.tipAt(t, 8, 120);
    assert.ok(turn >= last - 1e-9, "tips one way only");
    last = turn;
  }
  const back = Math.min(...Array.from({ length: 100 }, (_, i) => AN.tipAt(0.3 + i * 0.005, 8, 120)));
  assert.ok(back < 120 && back > 120 - 0.09 * 112 - 1e-9);
  assert.ok(close(AN.tipAt(3, 8, 120), 120, 1e-3));
  assert.ok(AN.tipAt(0.2, -5, -60) < -5, "works leaning the other way");
});

test("layFlat turns screen-up onto the floor direction", () => {
  const ex = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
  const ey = [-Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
  assert.ok(close(AN.layFlat(ex, ey, [1, 0]), 120, 1e-9));
  assert.ok(close(AN.layFlat(ex, ey, [0, 1]), -120, 1e-9));
  assert.ok(close(AN.layFlat(ex, ey, [-1, 0]), -60, 1e-9));
});

test("turnAbout keeps the pivot still", () => {
  const centre = [100, 50];
  const pivot = [130, 90];
  for (const deg of [0, 17, -60, 120]) {
    const [sx, sy] = AN.turnAbout(centre, deg, pivot);
    const r = (deg * Math.PI) / 180;
    const vx = pivot[0] - centre[0];
    const vy = pivot[1] - centre[1];
    const moved = [centre[0] + vx * Math.cos(r) - vy * Math.sin(r) + sx, centre[1] + vx * Math.sin(r) + vy * Math.cos(r) + sy];
    assert.ok(close(moved[0], pivot[0], 1e-9) && close(moved[1], pivot[1], 1e-9));
  }
  assert.deepEqual(AN.turnAbout(centre, 0, pivot).map((v) => Math.abs(v)), [0, 0]);
});

test("outcomeOf is repeatable and respects from/until", () => {
  const table = [{ id: "works-mostly", until: 0 }, { id: "tape-lets-go", weight: 3, from: 1 }, { id: "reel-jams", weight: 1, from: 1 }, { id: "everything", weight: 1, from: 4 }];
  assert.equal(AN.outcomeOf("deck", 0, table).id, "works-mostly");
  const seq = AN.outcomesOf("deck", 200, table);
  assert.deepEqual(AN.outcomesOf("deck", 200, table), seq);
  assert.ok(!seq.slice(1).includes("works-mostly"));
  assert.ok(!seq.slice(0, 4).includes("everything"));
  const counts = Object.fromEntries(["tape-lets-go", "reel-jams", "everything"].map((id) => [id, seq.filter((x) => x === id).length]));
  assert.ok(counts["tape-lets-go"] > counts["reel-jams"], JSON.stringify(counts));
  assert.ok(counts.everything > 0);
  assert.throws(() => AN.outcomeOf("deck", 0, [{ id: "late", from: 3 }]));
});

test("repairsAfter caps", () => {
  assert.equal(AN.repairsAfter(0, 4), 0);
  assert.equal(AN.repairsAfter(2, 4), 2);
  assert.equal(AN.repairsAfter(9, 4), 4);
});

test("the inlined page script exposes the same functions", () => {
  const source = anatolyScript();
  assert.doesNotMatch(source, /^export /m);
  const ANATOLY = new Function(`${source}\nreturn ANATOLY;`)();
  for (const name of ["shakeAt", "fallAt", "outcomeOf", "failureClock", "yawRing", "ledger", "KINDS"]) assert.ok(name in ANATOLY, name);
  assert.equal(ANATOLY.outcomeOf("deck", 3, [{ id: "a" }, { id: "b" }]).id, AN.outcomeOf("deck", 3, [{ id: "a" }, { id: "b" }]).id);
  const kitNames = ["smooth", "burst", "settle", "follow", "spring"];
  const page = new Function(`const smooth = 1, burst = 2, settle = 3;\n${source}\nreturn [smooth, burst, settle, typeof ANATOLY.shakeAt];`)();
  assert.deepEqual(page, [1, 2, 3, "function"]);
  for (const name of kitNames) assert.ok(!(name in ANATOLY), `ANATOLY must not export ${name}`);
});

test("the stylesheet only adds anatoly classes and variables", () => {
  const css = anatolyCss();
  assert.match(css, /--anatoly-repair/);
  for (const rule of css.split("\n")) assert.match(rule, /an-repair|an-tag|an-hand|--anatoly-/, rule);
});
