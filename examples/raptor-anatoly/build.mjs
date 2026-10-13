import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg, crossingsOf } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { glCamera } from "../../kit/gl.mjs";
import { glScript } from "../../scripts/inline-kit.mjs";
import * as AN from "../../kit/anatoly.mjs";
import { anatolyScript, anatolyCss } from "../../scripts/inline-anatoly.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const HONEST = process.argv.includes("--honest");
const BROKEN = (process.argv.find((arg) => arg.startsWith("--broken=")) ?? "").slice(9) || null;

// Anatoly's install. Every defect is written down here first, with his reason;
// the geometry asks the ledger before it draws anything crooked.
const B = AN.ledger(
  [
    {
      id: "nozzle-tape",
      kind: "improvised",
      hero: true,
      where: "nozzle to chamber, the throat joint",
      why: "the 40 bolts were in the other van",
      fails: "falls-apart",
      // Once the chamber and the methane pump are on the deck, the lines that
      // ran to them hang where they were, ends loose; at rest they met at the
      // same pads, so the audit excused them as joined. Down, they are not.
      audit: {
        crowd: [
          ["plumbing.jacket-to-frpb", "controller.harness-pickup"],
          ["plumbing.jacket-to-orpb", "controller.harness-pickup"],
          ["plumbing.lox-to-frpb", "plumbing.sense3"],
          ["plumbing.press-ch4", "controller.harness-frpb"],
          ["plumbing.sense6", "plumbing.jacket-to-orpb"],
        ],
      },
    },
    { id: "crack-tape", kind: "improvised", where: "nozzle bell, a third of the way up", why: "cracked it on the way in, taped it", fails: "falls-apart" },
    { id: "tape-everywhere", kind: "improvised", where: "every small line, at each clamp", why: "ran out of clamps on the second line" },
    { id: "feed-tape", kind: "improvised", where: "methane feed, halfway up", why: "two short lengths and no coupling that fit" },
    { id: "cork", kind: "wrong-part", where: "cooling manifold, the port at 132°", why: "lost the blind flange, had a cork" },
    { id: "adapter", kind: "wrong-part", where: "methane pump inlet", why: "the van had 120 pipe, the pump wants 144" },
    { id: "garden-hose", kind: "wrong-part", where: "deluge ring feed", why: "the hose reached, the pipe didn't" },
    { id: "fence-posts", kind: "wrong-part", where: "both columns", why: "steel was dear; the fence out back was free" },
    { id: "splint", kind: "improvised", where: "both posts, two thirds up", why: "the logs were short: two end to end, a stick tied along the join" },
    { id: "rope", kind: "improvised", where: "beam to posts", why: "the bolts didn't reach through timber" },
    { id: "sticks", kind: "improvised", where: "post braces", why: "it swayed, there were sticks in the skip" },
    { id: "blocks", kind: "wrong-part", where: "under both posts", why: "breeze blocks were holding the van door open anyway" },
    { id: "planks", kind: "wrong-part", where: "the deck", why: "scaffold boards, borrowed" },
    { id: "brick-feet", kind: "missing", where: "deck, all eight feet", why: "the feet are on another job" },
    { id: "shim-foot", kind: "missing", where: "deck, right-hand middle foot", why: "that brick was short, so the invoice" },
    { id: "bolts-gone", kind: "missing", where: "downcomer port flange, 6 of 8 bolts", why: "two will hold it" },
    { id: "sealant", kind: "improvised", where: "hot-gas duct, flange at the methane pump", why: "it wept a bit, so he gooped it" },
    { id: "washers", kind: "improvised", where: "under the load cell", why: "the cell was 2 mm short" },
    { id: "temp-tape", kind: "temporary", where: "engine controller lid", why: "temporary since March" },
  ],
  { honest: HONEST, size: "epic", failures: ["falls-apart"] },
).assert();
console.log(B.report());

// What the bodges do to the machine. Every number the page shows comes from here.
// The tape at the throat is rated for a few kilos and the engine pulls 230
// tonnes: it holds for as long as the tape's stretch takes up, then lets go.
const MODEL = {
  pc: (B.on("adapter") ? 0.91 : 1) * (B.on("sealant") ? 0.98 : 1),
  loadCell: B.on("washers") ? 0.97 : 1,
  deluge: B.on("garden-hose") ? 0.45 : 1,
  hum: 1 + (B.on("fence-posts") ? 1.4 : 0) + (B.on("brick-feet") ? 0.5 : 0) + (B.on("shim-foot") ? 0.4 : 0),
  chillVent: B.on("bolts-gone") ? 1.8 : 1,
  tapeKgf: 40,
  holds: 1.1,
};

const DEG = Math.PI / 180;

const W = 932;
const H = 900;
const AZIMUTH = 38;
const ELEVATION = 27;
const Z_EXIT = 172;
const TOP = 310;
const BEAM_Z = Z_EXIT + TOP + 23;
const BEAM_H = 28;
const DECK = { x: -150, y: -150, w: 300, d: 300, r: 10 };
const DECK_H = 15;
const FOOT_H = 8;
const COLUMN = 24;
const COLUMN_AT = [
  [-124, 124],
  [124, -124],
];
const CONE_TIP = 32;
const CHAMBER_BAR = 300;
const SEA_LEVEL_TF = 230;
const EXIT_M = 1.3;
const BACK_TF = (101325 * Math.PI * (EXIT_M / 2) ** 2) / 9806.65;

const P = k.fitProjection(
  [
    ...k.boxCorners(DECK, -DECK_H - FOOT_H, 0),
    [COLUMN_AT[0][0] - COLUMN, COLUMN_AT[0][1] + COLUMN, BEAM_Z + BEAM_H],
    [COLUMN_AT[1][0] + COLUMN, COLUMN_AT[1][1] - COLUMN, BEAM_Z + BEAM_H],
    [-190 / Math.SQRT2, 190 / Math.SQRT2, BEAM_Z + BEAM_H],
    [190 / Math.SQRT2, -190 / Math.SQRT2, BEAM_Z + BEAM_H],
  ],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const FADE = [0.04, 0.42];
const Faded = (list, style) => k.fadedSvg(list, style);

const polar = (deg, r, s, centre = [0, 0]) => [centre[0] + r * Math.cos(deg * DEG), centre[1] + r * Math.sin(deg * DEG), Z_EXIT + s];
const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];
const ENGINE = G.frameOf([0, 0, Z_EXIT], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const FTP_DEG = -20;
const FTP_AT = [72 * Math.cos(FTP_DEG * DEG), 72 * Math.sin(FTP_DEG * DEG)];
const FTP = G.frameOf([FTP_AT[0], FTP_AT[1], Z_EXIT], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ftp = (deg, r, s) => G.pointOf(FTP, s, r, deg * DEG);
const DECKF = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const out = (deg, r, z) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG), z];
const LUGS = [
  [135, 185],
  [-45, -45],
];

// Nothing comes apart for show any more: a piece moves only when it falls.
// Its move is where it lands, filled in once its shapes are known (below).
const FALL = B.on("nozzle-tape") ? ["nozzle", "chamber", "ftp", "downcomer"] : [];
const still = () => [0, 0, 0];
const PIECES = {
  gimbal: { name: "Gimbal and thrust puck", say: "gimbal · hung off a wooden beam", move: still() },
  otp: { name: "Oxygen turbopump", say: "oxygen turbopump · spun by oxygen-rich gas", move: still() },
  orpb: { name: "Oxygen-rich preburner", say: "oxygen-rich preburner · all the oxygen", move: still() },
  lox: { name: "Oxygen duct and main valve", say: "oxygen duct · pump to preburner", move: still() },
  chamber: { name: "Injector and main chamber", say: "main chamber · 300 bar · the nozzle taped to it", move: still() },
  nozzle: { name: "Nozzle", say: "nozzle · 1.3 m exit · held on with tape", move: still() },
  ftp: { name: "Methane turbopump and fuel-rich preburner", say: "methane turbopump · on three reducers", move: still() },
  hotgas: { name: "Hot-gas manifold", say: "hot-gas manifold · gooped", move: null },
  downcomer: { name: "Downcomer and main fuel valve", say: "downcomer · two bolts of eight", move: still() },
  plumbing: { name: "Plumbing", say: "plumbing", move: still() },
  controller: { name: "Engine controller and harness", say: "engine controller · lid taped", move: still() },
  stand: { name: "Stand", say: "", move: still() },
};
// The hot-gas duct is bolted to the pump, so it goes where the pump goes.
PIECES.hotgas.move = PIECES.ftp.move;
const STAGGER = FALL.length ? FALL : ["stand"];
const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };
const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const { items, nameFor } = R;
const record = R.solid;
const rideOf = (piece, move) => (move ? Object.keys(PIECES).find((id) => PIECES[id].move === move) ?? piece : piece);
function put(piece, ref, svg, { bias = 0, move, ride, shapes = [], name, route, chunk, tag } = {}) {
  R.put({ piece, ride: ride ?? rideOf(piece, move), at: ref, bias, svg, move: move ?? PIECES[piece].move, shapes, name: name ?? nameFor(`${piece}.item`), route, chunk, tag });
}
function tubeItems(piece, route, r, { name, tone = "hi", bias = 0, move, maxLength, spacing, closed = false, owner, touch, bundle, limp = false, breaks = [], gaps = [], caps = true, ends = [true, true], rims, free = [false, false] } = {}) {
  const id = nameFor(name ?? `${piece}.tube`);
  R.route(id, route, r, { owner: owner ?? id, touch, bundle, limp, gaps, closed, ends, rims, free, piece, move: move ?? PIECES[piece].move, ride: rideOf(piece, move) });
  tubePieces(route, r, P, { maxLength, spacing, closed, breaks, gaps, caps }).forEach((part, index) =>
    put(piece, part.mid, tubeSvg(part, { tone }), { bias, move, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}

const ex = (F, s) => [F.o[0], F.o[1], F.o[2] + s];

function turned(piece, F, profile, style = {}, { extra = "", inner = "", bias = 0, move, rims, bevel = 0, steps, name, owner, smooth = profile.some((point) => point[2]) } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel, smooth: smooth === true ? { rows: Math.max(...profile.map(([, r]) => r)) < 20 ? 3 : 5 } : smooth, ...(rims ? { rims } : {}), ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const id = nameFor(name ?? `${piece}.turned${Math.round(profile[0][0])}`);
  const shape = record(A.solid(F, profile, { name: id, owner, curve: smooth && !smooth.slope ? profile : undefined }));
  put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, move, name: id, shapes: [shape] });
  return shape;
}

function band(piece, F, s0, s1, r, style = {}, options = {}) {
  return turned(piece, F, [
    [s0, r],
    [s1, r],
  ], style, options);
}

function flangeAt(piece, centre, axis, r, thick, { bolts = 8, tone = "hi", move, bias = 0, boltR, name, owner, className } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name ?? `${piece}.flange`);
  const paths = G.disc(-thick / 2, thick / 2, r, F, P);
  const faces = [];
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  if (Math.abs(G.dot3(F.a, V)) > 0.12 && bolts) faces.push(Dots(G.dotsOf(F, towards, boltR ?? r * 0.74, bolts, P, { all: true }), { size: 0.42, tone: "mid" }));
  put(piece, centre, S(paths, { tone, className }) + faces.join(""), { bias, move, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
}

function pipe(piece, control, r, { bend = 2.6, tone = "hi", flanges = [true, true], flangeR = 1.55, coupling = false, bands = [], bellows = null, valve = null, move, bias = 0, maxLength = 26, spacing, name, touch, breaks = [], gaps: extra = [], free } = {}) {
  const flangeRs = [flangeR].flat().length > 1 ? [flangeR].flat() : [flangeR, flangeR].flat();
  if (coupling) flanges = [flanges[0], false];
  const line = G.fillet(control, Math.max(r * bend, 3), r > 3 ? 24 : 12, { P, tube: r });
  const total = G.pathLength(line);
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign], index) => {
    if (!flanges[index]) return;
    const thick = Math.max(0.9, r * 0.55);
    const tangent = G.tangentAlong(line, along);
    collars.push({ kind: "flange", centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * flangeRs[index], thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
  });
  if (coupling) {
    const thick = Math.max(1.6, r * 1.4);
    collars.push({ kind: "coupling", centre: G.pointAlong(line, total - thick / 2), tangent: G.tangentAlong(line, total), radius: r * 1.5, thick, gap: [total - thick, total] });
  }
  const ring = (along, radius, thick, kind) => collars.push({ kind, centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius, thick, gap: [along - thick / 2, along + thick / 2] });
  // Anatoly's lines: where a clamp band should be, a few turns of tape.
  const taped = piece === "plumbing" && B.on("tape-everywhere");
  for (const share of bands) ring(total * share, r * (taped ? 1.26 : 1.18), Math.max(0.8, r * 0.7) * (taped ? 1.6 : 1), "band");
  if (bellows) {
    const [from, to, count] = bellows;
    for (let index = 0; index < count; index++) ring(total * (from + ((to - from) * index) / (count - 1)), r * 1.26, Math.max(0.6, r * 0.3), "bellows");
  }
  const gaps = [...collars.map(({ gap }) => gap), ...extra];
  if (valve) {
    const along = valve[0] > 1 ? valve[0] : total * valve[0];
    gaps.push([along - valve[1] * 2.4, along + valve[1] * 2.4]);
  }
  const owner = tubeItems(piece, line, r, { name: name ?? `${piece}.pipe`, tone, bias, move, maxLength, spacing: spacing ?? Math.max(0.8, Math.min(2.4, r * 0.18)), touch, gaps, breaks, free, rims: flanges.map((flanged, index) => (flanged ? r * flangeRs[index] : index && coupling ? r * 1.5 : r)) });
  for (const { kind, centre, tangent, radius, thick } of collars) {
    const tape = taped && kind === "band";
    flangeAt(piece, centre, tangent, radius, thick, { bolts: kind === "flange" && r > 3 ? 8 : 0, tone: tape ? "hi" : kind === "flange" || kind === "coupling" ? tone : "mid", move, bias, name: tape ? B.name("tape-everywhere", "band") : `${owner}.${kind}`, owner, className: tape ? "an-repair" : undefined });
  }
  line.owner = owner;
  return line;
}

function boxAt(piece, plan, z, h, style = {}, { extra = "", bias = 0, move, bevel = 0.5, steps = 3, name, owner } = {}) {
  const centre = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
  const id = nameFor(name ?? `${piece}.box`);
  put(piece, centre, S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style }) + extra, { bias, move, name: id, shapes: [record(A.box([plan.x, plan.y, z], [plan.x + plan.w, plan.y + plan.d, z + h], { name: id, owner }))] });
}

function valveOn(piece, line, share, r, { move, tone = "hi", name, side = [0, 0, 1] } = {}) {
  const total = G.pathLength(line);
  const along = share > 1 ? share : total * share;
  const centre = G.pointAlong(line, along);
  const tangent = G.tangentAlong(line, along);
  const F = G.frameAlong(centre, tangent);
  const body = r * 1.85;
  const id = nameFor(name ?? `${line.owner}.valve`);
  const owner = line.owner;
  const crown = body * 1.08;
  const bulge = (x) => r * 1.45 + (crown - r * 1.45) * Math.sqrt(Math.max(0, 1 - (x / (r * 1.6)) ** 2));
  const bulgeSlope = (x) => {
    if (Math.abs(x) >= r * 1.6 - 1e-9) return 0;
    const t = Math.max(-0.995, Math.min(0.995, x / (r * 1.6)));
    return (-(crown - r * 1.45) * t) / (r * 1.6 * Math.sqrt(1 - t * t));
  };
  const meridian = [
    [-r * 2.4, 0],
    [-r * 2.4, r * 1.45],
    ...Array.from({ length: 17 }, (_, index) => {
      const x = r * 1.6 * Math.sin(((index - 8) / 8) * (Math.PI / 2));
      return [x, bulge(x), index && index < 16 ? 1 : 0];
    }),
    [r * 2.4, r * 1.45],
    [r * 2.4, 0],
  ];
  put(
    piece,
    centre,
    S(G.lathe(meridian, F, P, { steps: 36, smooth: { slope: bulgeSlope, rows: 3 } }), { tone }) + Dots([...G.dotsOf(F, -r * 2.4, r * 1.2, 8, P, { all: true }), ...G.dotsOf(F, r * 2.4, r * 1.2, 8, P, { all: true })].filter((_, index) => index % 2 === 0), { size: 0.4, tone: "mid" }),
    { move, name: id, shapes: [record(A.body(F, meridian, { name: id, owner }))] },
  );
  const up = G.unit3(side);
  const NF = G.frameAlong(centre, up);
  const s0 = body * 1.08 - 0.25;
  const s1 = body * 1.08 + body * 0.45;
  put(piece, G.add3(centre, G.mul3(up, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 0.5, NF, P), { tone }), { move, bias: 0.2, name: `${id}.neck`, shapes: [record(A.disc(NF, s0, s1, r * 0.5, { name: `${id}.neck`, owner }))] });
  if (up[2] > 0.99) {
    const top = G.add3(centre, [0, 0, s1]);
    const plan = { x: top[0] - r * 1.5, y: top[1] - r * 1.5, w: r * 3, d: r * 3, r: 0.8 };
    const lid = top[2] + r * 2.2;
    boxAt(piece, plan, top[2], r * 2.2, { tone }, {
      move,
      bias: 0.3,
      name: `${id}.actuator`,
      owner,
      extra: Ln(k.planOutline(k.insetPlan(plan, 0.8), lid, P, 2), { tone: "faint" }) + Dots([at([plan.x + 1.2, plan.y + 1.2, lid]), at([plan.x + plan.w - 1.2, plan.y + plan.d - 1.2, lid])], { size: 0.4 }),
    });
    const port = [top[0], top[1], lid];
    return { port, approach: G.add3(port, [0, 0, 5]), lid };
  }
  const can = [[s1, 0], [s1, r * 1.5], [s1 + r * 2.2, r * 1.5], [s1 + r * 2.2, 0]];
  const end = s1 + r * 2.2;
  put(piece, G.add3(centre, G.mul3(up, (s1 + end) / 2)), S(G.lathe(can, NF, P, { steps: 32, bevel: 0.6 }), { tone }) + Ln(G.circleOf(NF, end, r * 1.1, P, 24), { tone: "faint" }) + Dots(G.dotsOf(NF, end, r * 1.25, 4, P, { all: true, phase: Math.PI / 4 }), { size: 0.4 }), { move, bias: 0.3, name: `${id}.actuator`, shapes: [record(A.body(NF, can, { name: `${id}.actuator`, owner }))] });
  const port = G.add3(centre, G.mul3(up, end));
  return { port, approach: G.add3(port, G.mul3(up, 5)) };
}

function ballAt(piece, centre, r, { move, tone = "mid", bias = 0, name, owner } = {}) {
  const F = G.frameAlong(centre, [0, 0, 1]);
  const id = nameFor(name ?? `${piece}.ball`);
  put(piece, centre, S(G.sphereOf(centre, r, P, { steps: G.stepsFor(r, 32) }), { tone }), { move, bias, name: id, shapes: [record(A.ball(centre, r, { name: id, owner }))] });
}

function elbow(piece, face, normal, faceR, toward, ball, rim, { name, owner } = {}) {
  const centre = G.add3(face, G.mul3(normal, Math.sqrt(ball ** 2 - faceR ** 2)));
  ballAt(piece, centre, ball, { tone: "hi", name, owner });
  const axis = G.unit3(G.sub3(toward, centre));
  return G.add3(centre, G.mul3(axis, Math.sqrt(ball ** 2 - rim ** 2)));
}

const sideOn = (d) => G.unit3(G.cross3(G.unit3(G.sub3(V, G.mul3(d, G.dot3(V, d)))), d));

function boss(piece, centre, outward, r, length, { move, tone = "hi", bias = 0.1, name, host, ring = true, owner } = {}) {
  if (host) return padOn(piece, host, centre, outward, r, length, { move, tone, bias, name: name ?? `${piece}.boss`, ring, owner });
  const F = G.frameAlong(centre, outward);
  const id = nameFor(name ?? `${piece}.boss`);
  put(piece, G.add3(centre, G.mul3(F.a, length / 2)), S(G.disc(0, length, r, F, P), { tone }) + (ring && G.dot3(F.a, V) > 0.15 ? Ln(G.circleOf(F, length, r * 0.55, P, 16), { tone: "faint" }) : ""), { bias, move, name: id, shapes: [record(A.disc(F, 0, length, r, { name: id, owner }))] });
  return G.add3(centre, G.mul3(F.a, length));
}

function padOn(piece, host, point, outward, a, h, { move, name, tone = "hi", bias = 0.1, owner, ring = false } = {}) {
  const hosts = [host].flat();
  const inside = (p) => hosts.some((shape) => A.sdf(shape, p) < 0);
  const axis = G.unit3(outward);
  const F = G.frameAlong(point, axis);
  const start = (angle) => {
    let lo = -2.5 * a;
    let hi = h;
    if (!inside(G.pointOf(F, lo, a, angle))) return 0;
    for (let step = 0; step < 40; step++) {
      const mid = (lo + hi) / 2;
      if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const low = Math.min(...Array.from({ length: 48 }, (_, index) => start((index / 48) * Math.PI * 2)));
  const id = nameFor(name ?? `${piece}.pad`);
  const face = ring && G.dot3(axis, V) > 0.15 ? Ln(G.circleOf(F, h, a * 0.55, P, 16), { tone: "faint" }) : "";
  put(piece, G.add3(point, G.mul3(axis, h / 2)), S(G.saddleOf(F, a, start, h, P), { tone }) + face, { bias, move, name: id, shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: hosts }))] });
  return G.add3(point, G.mul3(axis, h));
}

const CABLES = [];
function cable(piece, points, { move, bias = 0.2, r = 0.62, bend = 6, name, bundle, touch, clamps = [], shells = [false, false], free } = {}) {
  const route = G.fillet(points, bend, 12, { P, tube: r });
  CABLES.push({ piece, route });
  const total = G.pathLength(route);
  const SHELL = 2.2;
  const gaps = [...clamps.flatMap(({ centre, axis, radius }) => crossingsOf(route, centre, axis, radius).map((at) => [at - CLAMP_HALF - 0.05, at + CLAMP_HALF + 0.05])), ...(shells[0] ? [[0, SHELL]] : []), ...(shells[1] ? [[total - SHELL, total]] : [])];
  const id = tubeItems(piece, route, r, { name: name ?? `${piece}.cable`, tone: "mid", bias, move, maxLength: 14, spacing: 1, bundle, touch, gaps, free, limp: true, rims: shells.map((on) => (on ? r * 2 : r)) });
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    if (!shells[index]) {
      put(piece, end, Dots([at(end)], { size: 0.5, tone: "hi" }), { bias: bias + 0.15, move, name: `${id}.end`, shapes: [A.ball(end, 0.5 / KS)] });
      return;
    }
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
    const outer = index ? s0 : s1;
    put(piece, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 2, F, P, { bevel: 0.25 }), { tone: "mid" }) + (G.dot3(G.mul3(F.a, index ? -1 : 1), V) > 0.2 ? Ln(G.circleOf(F, outer, r * 1.1, P, 12), { tone: "faint" }) : ""), { bias: bias + 0.1, move, name: `${id}.shell`, shapes: [record(A.disc(F, s0, s1, r * 2, { name: `${id}.shell`, owner: id }))] });
  });
  return route;
}

const CLAMP_HALF = 0.9;
function clampAt(piece, centre, axis, r, { move, bias = 0.3, name = `${piece}.clamp`, bundle } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name);
  put(piece, centre, S(G.disc(-CLAMP_HALF, CLAMP_HALF, r, F, P), { tone: "mid" }), { bias, move, name: id, shapes: [record(A.disc(F, -CLAMP_HALF, CLAMP_HALF, r, { name: id, anchor: false, bundle, fitting: true }))] });
}


const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(DECK, -DECK_H - FOOT_H, DECK_H, P)}"/>`);
const FEET = [
  [-132, -132],
  [132, -132],
  [-132, 132],
  [132, 132],
  [0, -132],
  [0, 132],
  [-132, 0],
  [132, 0],
].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const SHIM_AT = [132, 0];
const FRAME = { owner: "stand.frame" };
const FLOOR = -DECK_H - FOOT_H;
// Drawing timber: a line through world points, grain that wanders a little
// along a face, and a knot as a small ellipse on one.
const pathOf = (points, closed = false) => `M${points.map((p) => at(p)).map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("L")}${closed ? "Z" : ""}`;
const wavy = (from, to, side, amp, phase, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return G.add3(G.add3(from, G.mul3(G.sub3(to, from), t)), G.mul3(side, amp * Math.sin(t * 7.3 + phase) * Math.sin(t * Math.PI))); });
const knot = (c, u, v, a, b) => Array.from({ length: 18 }, (_, i) => { const t = (i / 18) * 2 * Math.PI; return G.add3(c, G.add3(G.mul3(u, a * Math.cos(t)), G.mul3(v, b * Math.sin(t)))); });
if (B.on("brick-feet")) {
  // No feet: a brick under each place a foot was, laid by eye.
  const YAW = [-4, 3, -2, 5, -6, 2, 4, -3];
  FEET.forEach(([x, y], index) => {
    const shim = B.on("shim-foot") && x === SHIM_AT[0] && y === SHIM_AT[1];
    const brickH = shim ? FOOT_H - 1.5 : FOOT_H;
    const brick = AN.yawRing(k.ringOf({ x: x - 10.5, y: y - 5, w: 21, d: 10, r: 0.6 }, 2), shim ? 0 : YAW[index]);
    back.push(S(k.extrude(brick, FLOOR, brickH, P, { convex: true, bevel: 0.5 }), { tone: "mid" }));
    record(A.extruded(brick, FLOOR, brickH, { name: B.name("brick-feet", "brick") }));
    if (!shim) return;
    // That one came up short: the invoice, folded three times, on top of it.
    let z = FLOOR + brickH;
    [-7, 4, -2].forEach((deg, card) => {
      const ring = AN.yawRing(k.ringOf({ x: x - 7, y: y - 4.5, w: 14, d: 9, r: 0.3 }, 2), deg);
      back.push(S(k.extrude(ring, z, 0.5, P), { tone: card === 1 ? "hi" : "mid" }));
      record(A.extruded(ring, z, 0.5, { name: B.name("shim-foot", `card${card}`) }));
      z += 0.5;
    });
  });
} else {
  for (const [x, y] of FEET) {
    if (B.on("shim-foot") && x === SHIM_AT[0] && y === SHIM_AT[1]) {
      // A brick on the floor, and the invoice folded three times on top of it to
      // make up the last 1.5: the deck sits on the cards, not on a foot.
      const floor = -DECK_H - FOOT_H;
      const BRICK = { x: x - 1, y: y - 5.5, w: 21, d: 11, r: 0.6 };
      const brickH = FOOT_H - 1.5;
      back.push(S(k.slabOf(BRICK, floor, brickH, P, 2, 0.5), { tone: "mid", inner: Ln(k.sideSeam(BRICK, floor + brickH / 2, P, 2), { tone: "faint" }) }));
      record(A.box([BRICK.x, BRICK.y, floor], [BRICK.x + BRICK.w, BRICK.y + BRICK.d, floor + brickH], { name: B.name("shim-foot", "brick") }));
      let z = floor + brickH;
      [-7, 4, -2].forEach((deg, index) => {
        const card = AN.yawRing(k.ringOf({ x: x - 7, y: y - 4.5, w: 14, d: 9, r: 0.3 }, 2), deg);
        back.push(S(k.extrude(card, z, 0.5, P), { tone: index === 1 ? "hi" : "mid" }));
        record(A.extruded(card, z, 0.5, { name: B.name("shim-foot", `card${index}`) }));
        z += 0.5;
      });
      continue;
    }
    back.push(S(k.cylinder(x, y, 10, -DECK_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    back.push(S(k.cylinder(x, y, 7.5, -DECK_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
  }
}
back.push(S(k.slabOf(DECK, -DECK_H, DECK_H, P, 8, B.on("planks") ? 0.6 : 1.6), { tone: "mid" }));
record(A.box([DECK.x, DECK.y, -DECK_H], [DECK.x + DECK.w, DECK.y + DECK.d, 0], { name: B.on("planks") ? B.name("planks", "deck") : "stand.deck", ...FRAME }));
if (B.on("planks")) {
  // Scaffold boards, twelve of them side by side, nailed down at the ends.
  const BOARD = 25;
  const seams = [];
  const grain = [];
  const nails = [];
  for (let i = 1; i < DECK.d / BOARD; i++) {
    const y = DECK.y + i * BOARD;
    seams.push(k.lineOnTop([DECK.x, y], [DECK.x + DECK.w, y], 0, P), k.segment([DECK.x + DECK.w, y, -DECK_H], [DECK.x + DECK.w, y, 0], P));
  }
  for (let i = 0; i < DECK.d / BOARD; i++) {
    const yc = DECK.y + (i + 0.5) * BOARD;
    grain.push(pathOf(wavy([DECK.x + 6, yc + ((i * 7) % 9) - 4, 0], [DECK.x + DECK.w - 6, yc + ((i * 5) % 7) - 3, 0], [0, 1, 0], 1.6, i * 1.7)));
    for (const x of [DECK.x + 9, DECK.x + DECK.w - 9]) nails.push(at([x, yc - 6, 0]), at([x, yc + 6, 0]));
  }
  back.push(Ln(seams.join(""), { tone: "lo" }), Ln(grain.join(""), { tone: "faint", free: true }), Dots(nails, { size: 0.5 }));
  back.push(Ln(pathOf(wavy([DECK.x + 8, DECK.y + DECK.d, -DECK_H / 2], [DECK.x + DECK.w - 8, DECK.y + DECK.d, -DECK_H / 2], [0, 0, 1], 2.2, 0.6)), { tone: "faint", free: true }));
} else {
  back.push(Ln(k.planOutline(k.insetPlan(DECK, 7), 0, P), { tone: "lo" }));
  const DECK_SCREWS = k.corners(DECK, 15);
  back.push(Ln(DECK_SCREWS.map(([x, y]) => k.ring(x, y, 3, 0, P, 18)).join(""), { tone: "lo" }));
  back.push(Dots(DECK_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  back.push(Ln(k.sideTicks(DECK.x + 20, DECK.x + DECK.w - 20, 10, 5, DECK.x + DECK.w, 0, [2.4, 4.6], P, "y").minor, { tone: "lo" }));
  back.push(Ln(k.sideTicks(DECK.x + 20, DECK.x + DECK.w - 20, 10, 5, DECK.x + DECK.w, 0, [2.4, 4.6], P, "y").major, { tone: "mid" }));

  const GRATE = { x: -98, y: -98, w: 196, d: 196, r: 6 };
  back.push(Ln(k.planOutline(GRATE, 0, P), { tone: "lo" }));
  for (let x = GRATE.x + 14; x < GRATE.x + GRATE.w - 4; x += 14) back.push(Ln(k.lineOnTop([x, GRATE.y], [x, GRATE.y + GRATE.d], 0, P), { tone: "faint" }));

  const STRIP = { x: -128, y: DECK.y + DECK.d - 15, w: 196, d: 8, r: 1 };
  back.push(S(k.slabOf(STRIP, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  const TICKS = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y + 1, 0.8, [2.2, 4.4], P);
  back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
  back.push(Dots([at([STRIP.x + 2.2, STRIP.y + 4, 0.8]), at([STRIP.x + STRIP.w - 2.2, STRIP.y + 4, 0.8])], { size: 0.45 }));

  const LABEL = { x: DECK.x + DECK.w - 21, y: -94, w: 12, d: 60, r: 1.5 };
  back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
  back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.8), 1, P), { tone: "faint" }));
  back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 7.4, LABEL.y + LABEL.d - 5], 1, P, "y"), "RAPTOR 2", { size: 4.2, tone: "lo" }));
  back.push(Ln([0, 1].map((row) => k.onTop([[LABEL.x + 3 + row * 2.2, LABEL.y + 5], [LABEL.x + 3 + row * 2.2, LABEL.y + (row ? 16 : 21)]], 1, P)).join(""), { tone: "lo", free: true }));
  back.push(Dots([at([LABEL.x + LABEL.w / 2, LABEL.y + 2.6, 1]), at([LABEL.x + LABEL.w / 2, LABEL.y + LABEL.d - 2.6, 1])], { size: 0.45 }));
}

const deckTop = k.slabOf(k.insetPlan(DECK, 1), 0, 0.01, P, 8).fill;
const deckCentre = at([0, 0, 0]);
back.push(`<defs><radialGradient id="rp-deck" gradientUnits="userSpaceOnUse" cx="${deckCentre[0].toFixed(1)}" cy="${deckCentre[1].toFixed(1)}" r="${(150 * KS).toFixed(1)}" gradientTransform="translate(${deckCentre[0].toFixed(1)} ${deckCentre[1].toFixed(1)}) scale(1 ${k.cameraOf(P).sinE.toFixed(3)}) translate(${(-deckCentre[0]).toFixed(1)} ${(-deckCentre[1]).toFixed(1)})"><stop offset="0" class="rp-stop-0"/><stop offset=".28" class="rp-stop-1"/><stop offset=".7" class="rp-stop-2"/><stop offset="1" class="rp-stop-3"/></radialGradient></defs><path class="rp-deckglow" fill="url(#rp-deck)" d="${deckTop}"/>`);
back.push(`<path class="iso-halo rp-shadow" d="${k.haloOf({ x: -56, y: -56, w: 112, d: 112, r: 56 }, 0, 0.1, P)}"/>`);
back.push(S(G.disc(0, 4, 56, DECKF, P, { bevel: 1.2 }), { tone: "mid" }));
record(A.disc(DECKF, 0, 4, 56, { name: "stand.cone-plate", ...FRAME }));
back.push(Dots(G.dotsOf(DECKF, 4, 52, 28, P, { all: true }), { size: 0.45, tone: "mid" }));
const CONE_Q = 0.8;
const coneShare = (s) => Math.max(1e-4, 1 - (s - 4) / (CONE_TIP - 4));
const cone = (s) => 48 * coneShare(s) ** CONE_Q;
const coneSlope = (s) => ((-48 * CONE_Q) / (CONE_TIP - 4)) * coneShare(s) ** (CONE_Q - 1);
const CONE = Array.from({ length: 33 }, (_, index) => {
  const s = 4 + (CONE_TIP - 4) * (1 - (1 - index / 32) ** 2);
  return index === 32 ? [CONE_TIP, 0] : [s, cone(s), index ? 1 : 0];
});
back.push(S(G.solidOf(CONE, DECKF, P, { smooth: { slope: coneSlope, rows: 5 } }), { tone: "hi", inner: Ln([13, 22].map((s) => G.arcOf(DECKF, s, cone(s), P, { slope: coneSlope(s) })).join(""), { tone: "faint" }) }));
record(A.solid(DECKF, CONE, { name: "stand.cone", ...FRAME }));

const DELUGE = G.arcPoints(DECKF, 6.4, 68, 0, Math.PI * 2, 72);
// The deluge ring is drawn as items, not background: when the nozzle comes
// down round the cone, the near side of the ring has to stay in front of it.
// It is gapped at the tee, and each length carries its own spray holes.
const TEE_DEG = -12;
const TEE_R = 2.9;
const TEE_AT = 68 * (2 * Math.PI + TEE_DEG * DEG);
const DELUGE_GAP = [TEE_AT - 2.4, TEE_AT + 2.4];
R.route("stand.deluge", DELUGE, 2.1, { owner: FRAME.owner, closed: true, gaps: [DELUGE_GAP], piece: "stand", move: PIECES.stand.move, ride: "stand" });
const HOLES = Array.from({ length: 36 }, (_, i) => [i * 10, G.pointOf(DECKF, 8.6, 68, i * 10 * DEG)]);
tubePieces(DELUGE, 2.1, P, { maxLength: 30, spacing: 2, closed: true, gaps: [DELUGE_GAP] }).forEach((part, index) => {
  const angles = part.points.map((p) => (Math.atan2(p[1], p[0]) / DEG + 360) % 360);
  const span = (angles[angles.length - 1] - angles[0] + 360) % 360;
  const holes = HOLES.filter(([deg]) => { const d = (deg - angles[0] + 360) % 360; return d > 0.6 && d < span - 0.6; }).map(([, p]) => at(p));
  put("stand", part.mid, tubeSvg(part, { tone: "mid" }) + (holes.length ? Dots(holes, { size: 0.5, tone: "hi" }) : ""), { name: `stand.deluge:${index}`, route: "stand.deluge", chunk: index, shapes: [A.tube(part.points, part.radii)] });
});
const TEE_F = G.frameAlong(G.pointOf(DECKF, 6.4, 68, TEE_DEG * DEG), G.tangentOf(DECKF, TEE_DEG * DEG));
put("stand", TEE_F.o, S(G.disc(-2.4, 2.4, TEE_R, TEE_F, P, { bevel: 0.3 }), { tone: "mid" }), { name: "stand.deluge-tee", shapes: [record(A.disc(TEE_F, -2.4, 2.4, TEE_R, { name: "stand.deluge-tee", ...FRAME }))] });
const FEED_FROM = G.pointOf(DECKF, 6.4, 68 + TEE_R - 0.2, TEE_DEG * DEG);
const VALVE_BOX = { x: 132, y: -22, w: 13, d: 16, r: 2 };
if (B.on("garden-hose")) {
  // The tee keeps a short stub of real pipe; a garden hose is pushed over its
  // end and clamped there (the clamp is drawn as the clamped length, hose and
  // stub inside it), then lies on the deck to the valve box and drops into it
  // through a second clamp.
  const HOSE_R = 2.5;
  const CLAMP_R = HOSE_R + 0.45;
  const Y = -14.4;
  // The tee's branch: a short spigot out of its side, the stub on its face.
  const RADIAL = dir(TEE_DEG);
  const SPIGOT_F = G.frameAlong(G.pointOf(DECKF, 6.4, 68 + 1, TEE_DEG * DEG), RADIAL);
  const SPIGOT_TO = TEE_R + 0.2;
  put("stand", G.pointOf(SPIGOT_F, SPIGOT_TO / 2 + 0.5, 0, 0), S(G.disc(0, SPIGOT_TO, 2.3, SPIGOT_F, P, { bevel: 0.2 }), { tone: "mid" }), { bias: -0.1, name: "stand.deluge-spigot", shapes: [record(A.disc(SPIGOT_F, 0, SPIGOT_TO, 2.3, { name: "stand.deluge-spigot", ...FRAME, seated: true, cut: R.solids.filter((shape) => shape.name === "stand.deluge-tee") }))] });
  const SPIGOT_FACE = G.pointOf(SPIGOT_F, SPIGOT_TO, 0, 0);
  const STUB_END = [SPIGOT_FACE[0] + 5.6, Y, 6.4];
  const STUB = G.fillet([SPIGOT_FACE, G.add3(SPIGOT_FACE, G.mul3(RADIAL, 1.4)), G.add3(STUB_END, [-2.2, 0, 0]), STUB_END], 0.8);
  R.route("stand.deluge-feed", STUB, 2.1, { owner: "stand.deluge-feed", piece: "stand", move: PIECES.stand.move, ride: "stand" });
  for (const part of tubePieces(STUB, 2.1, P, { maxLength: 400, caps: [false, false] })) put("stand", part.mid, tubeSvg(part, { tone: "mid" }), { name: "stand.deluge-feed", route: "stand.deluge-feed", shapes: [A.tube(part.points, part.radii)] });
  const clampAt = (from, axis, length, index) => {
    const F = G.frameAlong(from, axis);
    const name = B.name("garden-hose", `clamp${index}`);
    put("stand", G.pointOf(F, length / 2, 0, 0), S(G.disc(0, length, CLAMP_R, F, P, { bevel: 0.2 }), { tone: "hi" }) + Ln(G.circleOf(F, length / 2, CLAMP_R, P), { tone: "faint" }), { bias: 0.2, name, shapes: [record(A.disc(F, 0, length, CLAMP_R, { name }))] });
    return G.pointOf(F, length, 0, 0);
  };
  const HOSE_FROM = clampAt(STUB_END, [1, 0, 0], 2.2, 0);
  const IN_BOX = [139, -14, 4];
  const CLAMP_TOP = [IN_BOX[0], -14, IN_BOX[2] + 2.2];
  const LANDS = [IN_BOX[0] - 7, -14, 10];
  let depth = 0;
  // Out of the clamp straight, then it slumps onto the planks.
  const LEAD = G.add3(HOSE_FROM, [3, 0, 0]);
  while (Math.min(...AN.sagRoute(LEAD, LANDS, depth + 0.05, { steps: 24 }).map((p) => p[2])) >= HOSE_R) depth += 0.05;
  const HOSE = G.fillet([HOSE_FROM, ...AN.sagRoute(LEAD, LANDS, depth, { steps: 24 }), [IN_BOX[0], -14, 10], CLAMP_TOP], 3.5, 8);
  const hose = B.name("garden-hose", "hose");
  R.route(hose, HOSE, HOSE_R, { owner: hose, touch: [B.name("planks", "deck"), "stand.deck"], piece: "stand", move: PIECES.stand.move, ride: "stand" });
  tubePieces(HOSE, HOSE_R, P, { maxLength: 30, rings: { pitch: 1.1 }, caps: [false, false] }).forEach((part, index) => put("stand", part.mid, tubeSvg(part, { tone: "mid" }), { name: `${hose}:${index}`, route: hose, chunk: index, shapes: [A.tube(part.points, part.radii)] }));
  clampAt(CLAMP_TOP, [0, 0, -1], 2.2, 1);
  put("stand", [VALVE_BOX.x + VALVE_BOX.w / 2, VALVE_BOX.y + VALVE_BOX.d / 2, 2], S(k.slabOf(VALVE_BOX, 0, 4, P, 3, 0.6), { tone: "mid" }) + Dots([at([135, -19, 4]), at([142, -9, 4])], { size: 0.45 }), { name: "stand.deluge-valve", shapes: [record(A.box([VALVE_BOX.x, VALVE_BOX.y, 0], [VALVE_BOX.x + VALVE_BOX.w, VALVE_BOX.y + VALVE_BOX.d, 4], { name: "stand.deluge-valve", ...FRAME }))] });
} else {
  const FEED = G.fillet([FEED_FROM, [100, -14, 6.4], [139, -14, 6.4], [139, -14, 1.5]], 6);
  for (const part of tubePieces(FEED, 2.1, P, { maxLength: 400, caps: [false, true] })) back.push(tubeSvg(part, { tone: "mid" }));
  record(A.tube(FEED, 2.1, { name: "stand.deluge-feed", ...FRAME }));
  back.push(S(k.slabOf(VALVE_BOX, 0, 4, P, 3, 0.6), { tone: "mid" }));
  back.push(Dots([at([135, -19, 4]), at([142, -9, 4])], { size: 0.45 }));
}

const POSTS = [];
const POST_R = 13;
if (B.on("fence-posts")) {
  const BLOCK_H = B.on("blocks") ? 20 : 5;
  // A stick from the deck to the post's inner face, bent as it grew: it stands
  // on the deck on a short upright end and goes into the post square on.
  const stickTo = (cx, cy, toward) => {
    const out = [toward[0], toward[1], 0];
    const face = [cx + out[0] * POST_R, cy + out[1] * POST_R, 118];
    const foot = [cx + out[0] * 66, cy + out[1] * 66, 0];
    const side = [-out[1], out[0], 0];
    const route = G.fillet([foot, G.add3(foot, [0, 0, 6]), G.add3(G.add3(G.mul3(G.add3(foot, face), 0.5), G.mul3(side, 3.2)), [0, 0, 4]), G.add3(face, G.mul3(out, 7)), face], 9, 6);
    return route;
  };
  const sticks = (cx, cy, toward, name) => {
    if (!B.on("sticks")) return;
    const route = stickTo(cx, cy, toward);
    for (const part of tubePieces(route, 2.4, P, { maxLength: 400 })) back.push(tubeSvg(part, { tone: "mid" }));
    back.push(Ln(pathOf(route.map((p, i) => G.add3(p, [0, 0, i % 2 ? 0.9 : -0.9]))), { tone: "faint", free: true }));
    record(A.tube(route, 2.4, { name: B.name("sticks", name), ...FRAME }));
  };
  for (const [cx, cy] of COLUMN_AT) {
    // Which way the brace leans in: toward the middle of the deck along x.
    const toward = [cx < 0 ? 1 : -1, 0];
    const behind = cx > 0;
    if (behind) sticks(cx, cy, toward, "stick");
    if (B.on("blocks")) {
      for (const side of [-1, 1]) {
        const block = { x: cx - 22, y: side < 0 ? cy - 21.25 : cy + 0.25, w: 44, d: 21, r: 0.6 };
        back.push(S(k.slabOf(block, 0, BLOCK_H, P, 2, 0.4), { tone: "lo" }));
        record(A.box([block.x, block.y, 0], [block.x + block.w, block.y + block.d, BLOCK_H], { name: B.name("blocks", "block"), ...FRAME }));
        back.push(Ln([cx - 19, cx + 13].map((hx) => k.planOutline({ x: hx, y: block.y + 4, w: 6, d: 13, r: 1 }, BLOCK_H, P, 2)).join(""), { tone: "lo" }));
      }
    }
    // The post is a log, bark on, two of them end to end: a stick tied along
    // the join to keep them in line.
    const SPLICE = B.on("splint") ? 300 : null;
    const ROPE = B.on("rope") ? BEAM_Z - 15 : BEAM_Z;
    const facing = AZIMUTH * DEG;
    const onLog = (theta, z, r = POST_R) => [cx + r * Math.cos(theta), cy + r * Math.sin(theta), z];
    const splint = SPLICE ? onLog(facing - 0.35, 0, POST_R + 3.1) : null;
    const hull = (points) => {
      const pts = points.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
      const lower = [];
      for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
      const upper = [];
      for (const p of pts.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
      return [...lower.slice(0, -1), ...upper.slice(0, -1)];
    };
    const circle = (x, y, r, n = 28) => Array.from({ length: n }, (_, i) => [x + r * Math.cos((i / n) * 2 * Math.PI), y + r * Math.sin((i / n) * 2 * Math.PI)]);
    const postShape = record(A.cylinder(cx, cy, POST_R, BLOCK_H, BEAM_Z - BLOCK_H, { name: B.name("fence-posts", "post"), ...FRAME }));
    POSTS.push(postShape);
    const splintShape = SPLICE ? record(A.cylinder(splint[0], splint[1], 3, SPLICE - 42, 84, { name: B.name("splint", "stick"), ...FRAME })) : null;
    // Rope round the log (and round the stick, at the join). Painted bottom to
    // top: log, stick, a turn of rope, the log again above it, so each turn
    // shows as a ring and the log carries on through it.
    const bands = [];
    if (B.on("rope")) {
      const binding = SPLICE ? hull([...circle(cx, cy, POST_R + 0.9), ...circle(splint[0], splint[1], 3.9, 14)]) : null;
      if (SPLICE) for (const z0 of [SPLICE - 36, SPLICE + 27]) for (let turn = 0; turn < 4; turn++) bands.push({ z: z0 + turn * 2.3, ring: binding, name: B.name("rope", "binding"), cut: [postShape, splintShape] });
      for (let turn = 0; turn < 6; turn++) bands.push({ z: ROPE + turn * 2.3, ring: circle(cx, cy, POST_R + 1), name: B.name("rope", "turn"), cut: [postShape] });
    }
    let from = BLOCK_H;
    const upTo = (z) => {
      if (z - from > 0.01) {
        back.push(S(k.cylinder(cx, cy, POST_R, from, z - from, P, 36), { tone: "mid" }));
        if (SPLICE && from < SPLICE && SPLICE < z) back.push(Ln(k.sideArc(cx, cy, POST_R, SPLICE, P, 28), { tone: "lo" }));
        const s0 = Math.max(from, SPLICE ? SPLICE - 42 : Infinity);
        const s1 = Math.min(z, SPLICE ? SPLICE + 42 : -Infinity);
        if (s1 - s0 > 0.01) back.push(S(k.cylinder(splint[0], splint[1], 3, s0, s1 - s0, P, 16), { tone: "hi" }));
      }
      from = z;
    };
    for (const band of bands.sort((p, q) => p.z - q.z)) {
      upTo(band.z);
      back.push(S(k.extrude(band.ring, band.z, 2, P, { convex: true, bevel: 0.5 }), { tone: "hi" }));
      record(A.extruded(band.ring, band.z, 2, { name: band.name, ...FRAME, seated: true, cut: band.cut }));
      from = band.z + 2;
    }
    upTo(BEAM_Z);
    // Bark: ridges up the side you see, wandering, broken where rope or the
    // stick covers them; a knot or two.
    const runs = SPLICE ? [[BLOCK_H + 3, SPLICE - 44], [SPLICE + 44, ROPE - 3]] : [[BLOCK_H + 3, ROPE - 3]];
    const bark = [];
    for (const [z0, z1] of runs)
      [-1.2, -0.75, -0.3, 0.1, 0.55, 1.0].forEach((d, i) => {
        const theta = facing + d;
        bark.push(pathOf(wavy(onLog(theta, z0), onLog(theta, z1), [-Math.sin(theta), Math.cos(theta), 0], 0.9, i * 1.9 + cx)));
      });
    back.push(Ln(bark.join(""), { tone: "lo", free: true }));
    const knotAt = (theta, z, a, b) => pathOf(knot(onLog(theta, z, POST_R + 0.05), [-Math.sin(theta), Math.cos(theta), 0], [0, 0, 1], a, b), true);
    back.push(Ln(knotAt(facing + 0.3, 150, 2.2, 3.4) + knotAt(facing - 0.6, 214, 1.7, 2.6) + knotAt(facing + 0.8, 380, 1.9, 3), { tone: "mid" }));
    if (!behind) sticks(cx, cy, toward, "stick");
  }
} else {
  for (const [cx, cy] of COLUMN_AT) {
    const base = { x: cx - 23, y: cy - 23, w: 46, d: 46, r: 3 };
    back.push(S(k.slabOf(base, 0, 5, P, 3, 0.8), { tone: "mid" }));
    record(A.box([base.x, base.y, 0], [base.x + base.w, base.y + base.d, 5], { name: "stand.column-base", ...FRAME }));
    back.push(Dots(k.corners(base, 6).map(([x, y]) => at([x, y, 5])), { size: 0.55 }));
    back.push(Ln(k.corners(base, 6).map(([x, y]) => k.ring(x, y, 2.4, 5, P, 14)).join(""), { tone: "lo" }));
    const column = { x: cx - COLUMN / 2, y: cy - COLUMN / 2, w: COLUMN, d: COLUMN, r: 1.5 };
    back.push(S(k.slabOf(column, 5, BEAM_Z - 5, P, 3, 0.8), { tone: "mid" }));
    record(A.box([column.x, column.y, 5], [column.x + column.w, column.y + column.d, BEAM_Z], { name: "stand.column", ...FRAME }));
    const edge = [cx + COLUMN / 2 - 1.5 + 1.5 * Math.SQRT1_2, cy + COLUMN / 2 - 1.5 + 1.5 * Math.SQRT1_2];
    back.push(Ln(k.segment([...edge, 5], [...edge, BEAM_Z], P), { tone: "faint" }));
    for (const z of [124, 248, 372]) {
      const splice = k.insetPlan(column, -2.2);
      back.push(S(k.slabOf(splice, z, 13, P, 3, 0.5), { tone: "mid" }));
      record(A.box([splice.x, splice.y, z], [splice.x + splice.w, splice.y + splice.d, z + 13], { name: "stand.splice", ...FRAME }));
      back.push(Dots([at([splice.x + splice.w, cy - 6, z + 4]), at([splice.x + splice.w, cy + 6, z + 4]), at([splice.x + splice.w, cy - 6, z + 9]), at([splice.x + splice.w, cy + 6, z + 9]), at([cx - 6, splice.y + splice.d, z + 4]), at([cx + 6, splice.y + splice.d, z + 4]), at([cx - 6, splice.y + splice.d, z + 9]), at([cx + 6, splice.y + splice.d, z + 9])], { size: 0.42 }));
    }
  }
  const TRAY_X = COLUMN_AT[1][0] - COLUMN / 2 - 6;
  back.push(S(k.slabOf({ x: TRAY_X, y: COLUMN_AT[1][1] + 2, w: 6, d: 9, r: 0.6 }, 28, BEAM_Z - 36, P, 2), { tone: "mid" }));
  for (let z = 52; z < BEAM_Z - 20; z += 40) back.push(S(k.slabOf({ x: TRAY_X - 0.8, y: COLUMN_AT[1][1] + 1, w: 7.6, d: 11, r: 0.6 }, z, 3, P, 2), { tone: "mid" }));
  const LADDER_Y = COLUMN_AT[0][1] + COLUMN / 2;
  for (const x of [COLUMN_AT[0][0] - 9, COLUMN_AT[0][0] + 9]) back.push(S(k.slabOf({ x: x - 1.3, y: LADDER_Y + 8, w: 2.6, d: 2.6, r: 0.6 }, 18, BEAM_Z - 52, P, 2), { tone: "mid", crease: "none" }));
  for (let z = 40; z < BEAM_Z - 38; z += 28) back.push(Ln(k.segment([COLUMN_AT[0][0] - 9, LADDER_Y + 10.6, z], [COLUMN_AT[0][0] + 9, LADDER_Y + 10.6, z], P), { tone: "mid" }));
  for (const z of [52, BEAM_Z - 56]) for (const x of [COLUMN_AT[0][0] - 9, COLUMN_AT[0][0] + 9]) back.push(S(k.slabOf({ x: x - 1, y: LADDER_Y, w: 2, d: 9, r: 0.4 }, z, 2, P, 2), { tone: "mid", crease: "none" }));
}


const bell = (s) => 36 + 29 * (1 - Math.pow(s / 120, 1.6));
const bellSlope = (s) => (-29 * 1.6 * Math.pow(s / 120, 0.6)) / 120;
// The crack in the bell is taped over between 51 and 57: the bell is cut
// there and the tape is that length of it, a little fatter.
const CRACK = [51, 57];
const BELL_AT = B.on("crack-tape") ? [3.2, 14, 28, 44, CRACK[0], CRACK[1], 60, 76, 92, 106, 116] : [3.2, 14, 28, 44, 60, 76, 92, 106, 116];
const BELL_STEPS = 96;
const BELL_SKIRT = BELL_AT.length - 2;
// When it falls, the bell lands over the flame cone: record it as the thin
// shell it is, so the cone inside it is no clash.
const SHELL = FALL.includes("nozzle");
const WALL = 1.6;
const shellOf = (s0, s1, name) => {
  const ss = Array.from({ length: 9 }, (_, index) => s0 + ((s1 - s0) * index) / 8);
  return A.body(ENGINE, [...ss.map((s) => [s, bell(s)]), ...ss.reverse().map((s) => [s, bell(s) - WALL])], { name });
};
if (SHELL) {
  const id = nameFor("nozzle.exit-lip");
  put("nozzle", ex(ENGINE, 1.6), S(G.solidOf([[0, 66.4], [3.2, 66.4]], ENGINE, P, { bevel: 0.6, steps: BELL_STEPS }), { tone: "hi" }), { name: id, shapes: [record(A.ring(ENGINE, 0, 3.2, 66.4 - WALL - 0.4, 66.4, { name: id }))] });
} else turned("nozzle", ENGINE, [[0, 66.4], [3.2, 66.4]], {}, { bevel: 0.6, steps: BELL_STEPS });
const BELL = G.bandsOf([[BELL_AT[0], bell(BELL_AT[0])], [BELL_AT[BELL_AT.length - 1], bell(BELL_AT[BELL_AT.length - 1])]], BELL_AT.slice(1, -1), ENGINE, P, { radius: bell, slope: bellSlope, steps: BELL_STEPS, rows: 8 });
BELL.bands.forEach((band, index) => {
  if (B.on("crack-tape") && band.s0 === CRACK[0]) return;
  const seam = (B.on("crack-tape") ? index === 2 || index === 7 : index === 2 || index === 5) ? Ln(band.seam, { tone: "faint" }) : "";
  put("nozzle", ex(ENGINE, (band.s0 + band.s1) / 2), S(index < BELL_SKIRT ? band.paths : { ...band.paths, outline: band.outline }, { tone: "hi", inner: seam }), { name: `nozzle.bell${index}`, shapes: [record(SHELL ? shellOf(band.s0, band.s1, `nozzle.bell${index}`) : A.solid(ENGINE, band.profile, { radius: bell, name: `nozzle.bell${index}` }))] });
});
for (const [from, to] of B.on("crack-tape") ? [[BELL_AT[0], CRACK[0]], [CRACK[1], BELL_AT[BELL_SKIRT]]] : [[BELL_AT[0], BELL_AT[BELL_SKIRT]]]) {
  const sides = BELL.sidesOf(from, to, { ends: from === BELL_AT[0] ? "first" : "none", count: 72 });
  put("nozzle", ex(ENGINE, (from + to) / 2), Ln(sides.d, { tone: "hi" }), { bias: 0.2, name: "nozzle.sides", shapes: sides.points.map((points) => A.tube(points, 0.4 / KS)) });
}
// The hero: no bolts on the throat joint, just tape round the two flanges,
// pass over pass. It tears along the joint when it goes: the lower half falls
// with the nozzle, the upper half stays on the chamber. Each call-out adds a
// pass, so each flange carries every wrap it will ever have and the page
// shows the one for the fixes so far. The tape is drawn round the flange and
// then the flange's top face again over it, so the face stays metal.
const HERO = { levels: 4 };
const tapeR = (level) => 38.5 + 0.42 * level;
const topFace = (s, r, inner = "") => `<g class="iso-solid"><path class="iso-fill" fill-rule="evenodd" d="${G.circleOf(ENGINE, s, r, P)}${inner}"/><path class="iso-top" fill-rule="evenodd" d="${G.circleOf(ENGINE, s, r, P)}${inner}"/><path class="iso-line iso-edge" data-tone="hi" d="${G.circleOf(ENGINE, s, r, P)}"/></g>`;
const levels = (draw) => Array.from({ length: HERO.levels }, (_, level) => `<g class="an-lvl" data-l="${level}">${draw(tapeR(level), level)}</g>`).join("");
const LIP_TOP = `<path class="rp-void" d="${G.circleOf(ENGINE, 120, 30.5, P)}"/>` + Ln(G.arcOf(ENGINE, 120, 30.5, P, { inward: true, least: -1 }), { tone: "lo" });
if (B.on("nozzle-tape")) {
  const name = B.name("nozzle-tape", "low");
  put("nozzle", ex(ENGINE, 118), S(G.ringBand(116, 120, 30.5, 38, ENGINE, P), { tone: "hi" }) + levels((r) => S(G.ringBand(116, 120, 30.5, r, ENGINE, P), { tone: "hi", className: "an-repair" }) + topFace(120, 38, G.circleOf(ENGINE, 120, 30.5, P)) + LIP_TOP), {
    name: "nozzle.lip",
    shapes: [record(A.ring(ENGINE, 116, 120, 30.5, 38, { name: "nozzle.lip" })), record(A.ring(ENGINE, 116, 120, 38, tapeR(HERO.levels - 1), { name, owner: "nozzle.lip" }))],
  });
} else
put(
  "nozzle",
  ex(ENGINE, 118),
  S(G.ringBand(116, 120, 30.5, 38, ENGINE, P), { tone: "hi" }) +
    `<path class="rp-void" d="${G.circleOf(ENGINE, 120, 30.5, P)}"/>` +
    Ln(G.arcOf(ENGINE, 120, 30.5, P, { inward: true, least: -1 }), { tone: "lo" }) +
    (B.on("nozzle-tape") ? "" : Dots(G.dotsOf(ENGINE, 120, 36.4, 40, P, { all: true }), { size: 0.38, tone: "mid" })),
  { name: "nozzle.lip", shapes: [record(A.ring(ENGINE, 116, 120, 30.5, 38, { name: "nozzle.lip" }))] },
);
const MANIFOLD_S = 109;
const MANIFOLD_TUBE = 4.6;
const TEE = 6.6;
const DOWN_R = 4.6;
const bellGap = (r) => Math.min(...Array.from({ length: 241 }, (_, index) => Math.hypot(index / 2 - MANIFOLD_S, bell(index / 2) - r)));
let MANIFOLD_R = 40;
while (bellGap(MANIFOLD_R) < TEE + 0.3) MANIFOLD_R += 0.05;
const PORTS = [12, 132, 252];
const MANIFOLD = G.arcPoints(ENGINE, MANIFOLD_S, MANIFOLD_R, PORTS[0] * DEG, (PORTS[0] + 360) * DEG, 120);
const MANIFOLD_LENGTH = G.pathLength(MANIFOLD);
const teeGap = Math.sqrt(TEE ** 2 - MANIFOLD_TUBE ** 2);
const portAt = (deg) => ((deg - PORTS[0]) / 360) * MANIFOLD_LENGTH;
tubeItems("nozzle", MANIFOLD, MANIFOLD_TUBE, { name: "nozzle.manifold", maxLength: 22, spacing: 1.2, closed: true, touch: ["nozzle.bell*"], gaps: [[0, teeGap], [MANIFOLD_LENGTH - teeGap, MANIFOLD_LENGTH], ...PORTS.slice(1).map((deg) => [portAt(deg) - teeGap, portAt(deg) + teeGap])] });
for (const deg of PORTS) ballAt("nozzle", polar(deg, MANIFOLD_R, MANIFOLD_S), TEE, { tone: "hi", name: "nozzle.tee", owner: "nozzle.manifold" });
const CORK_DEG = 132;
const CORK = { seat: null };
for (const deg of PORTS.slice(1)) {
  const F = G.frameAlong(polar(deg, MANIFOLD_R, MANIFOLD_S), dir(deg));
  const s0 = Math.sqrt(TEE ** 2 - 2.6 ** 2);
  if (deg === CORK_DEG && B.on("cork")) {
    // No blind flange: the stub is open, with a wine cork pushed into its bore.
    const BORE = 1.8;
    put("nozzle", G.pointOf(F, 7, 0, 0), S(G.ringBand(s0, 7.6, BORE, 2.6, F, P), { tone: "hi" }), { name: "nozzle.stub", shapes: [record(A.ring(F, s0, 7.6, BORE, 2.6, { name: "nozzle.stub", owner: "nozzle.manifold" }))] });
    const meridian = [[6.5, 0], [6.5, 1.72], [7.6, BORE], [10.8, 2.25], [10.8, 0]];
    const corkSvg = (frame) => S(G.lathe(meridian, frame, P, { steps: 28, bevel: 0.2 }), { tone: "mid" }) + Ln(G.circleOf(frame, 10.8, 1.1, P, 14), { tone: "faint" });
    CORK.seat = G.pointOf(F, 8.65, 0, 0);
    put("nozzle", CORK.seat, corkSvg(F), { bias: 0.2, name: B.name("cork", "cork"), shapes: [record(A.body(F, meridian, { name: B.name("cork", "cork"), owner: "nozzle.manifold" }))] });
    continue;
  }
  put("nozzle", G.pointOf(F, 7, 0, 0), S(G.disc(s0, 7.6, 2.6, F, P), { tone: "hi" }), { name: "nozzle.stub", shapes: [record(A.disc(F, s0, 7.6, 2.6, { name: "nozzle.stub", owner: "nozzle.manifold" }))] });
  put("nozzle", G.pointOf(F, 8.5, 0, 0), S(G.disc(7.6, 9.4, 4.4, F, P), { tone: "hi" }) + Dots(G.dotsOf(F, 9.4, 3.4, 6, P, { all: true }), { size: 0.38, tone: "mid" }), { name: "nozzle.blind", shapes: [record(A.disc(F, 7.6, 9.4, 4.4, { name: "nozzle.blind" }))] });
}
for (const deg of [72, 192, 312]) {
  const base = polar(deg, bell(MANIFOLD_S) - 0.1, MANIFOLD_S);
  const F = G.frameAlong(base, dir(deg));
  const reach = MANIFOLD_R - MANIFOLD_TUBE + 0.12 - (bell(MANIFOLD_S) - 0.1);
  put("nozzle", G.pointOf(F, reach / 2, 0, 0), S(G.disc(0, reach, 0.9, F, P), { tone: "mid" }), { name: "nozzle.pad", shapes: [record(A.disc(F, 0, reach, 0.9, { name: "nozzle.pad", owner: "nozzle.manifold" }))] });
}
for (const deg of [60, 200]) boss("nozzle", polar(deg, bell(40), 40), dir(deg), 1.8, 2.6);
boss("nozzle", polar(30, bell(70), 70), dir(30), 1.6, 2.2);
const LIP = G.arcOf(ENGINE, 0, 66.4, P, { least: -0.05 });
for (const deg of [96, 156]) boss("nozzle", polar(deg, bell(88) - 0.15, 88), G.unit3(G.sub3(dir(deg), [0, 0, bellSlope(88)])), 2.4, 3.2, { name: "nozzle.pad" });


const OTP_REACH = 7;
const OTP_FLANGE_R = 9.4;
const FTP_REACH = 7.5;
const FTP_FLANGE_R = 8.6;
const radiusOn = (profile, s) => {
  let index = 1;
  while (index < profile.length - 1 && profile[index][0] < s) index++;
  const [s0, r0] = profile[index - 1];
  const [s1, r1] = profile[index];
  return r0 + ((r1 - r0) * (s - s0)) / (s1 - s0 || 1);
};
const slopeOn = (profile, s) => (radiusOn(profile, s + 0.01) - radiusOn(profile, s - 0.01)) / 0.02;
const onBody = (F, profile, deg, s) => ({ at: G.pointOf(F, s, radiusOn(profile, s), deg * DEG), normal: G.unit3(G.sub3(G.radialOf(F, deg * DEG), G.mul3(F.a, slopeOn(profile, s)))) });

// Taped, the joint has no bolts at all: forty empty holes round the flange.
const BOLT_HOLES = Ln(Array.from({ length: 40 }, (_, index) => { const p = G.pointOf(ENGINE, 123.5, 36.4, ((index + 0.5) / 40) * 2 * Math.PI); return k.ring(p[0], p[1], 0.55, p[2], P, 10); }).join(""), { tone: "lo" });
if (B.on("nozzle-tape")) {
  const name = B.name("nozzle-tape", "high");
  put("chamber", ex(ENGINE, 121.75), S(G.disc(120, 123.5, 38, ENGINE, P, { bevel: 0.5 }), { tone: "hi" }) + levels((r) => S(G.ringBand(120, 123.5, 37.6, r, ENGINE, P), { tone: "hi", className: "an-repair" }) + topFace(123.5, 38) + BOLT_HOLES), {
    name: "chamber.throat-flange",
    shapes: [record(A.solid(ENGINE, [[120, 38], [123.5, 38]], { name: "chamber.throat-flange" })), record(A.ring(ENGINE, 120, 123.5, 38, tapeR(HERO.levels - 1), { name, owner: "chamber.throat-flange" }))],
  });
} else turned("chamber", ENGINE, [[120, 38], [123.5, 38]], {}, { extra: Dots(G.dotsOf(ENGINE, 123.5, 36.4, 40, P, { all: true }), { size: 0.38, tone: "mid" }), bevel: 0.5 });
const throat = (s) => Math.sqrt(24.2 ** 2 + ((s < 146 ? 0.997 : 0.95) * (s - 146)) ** 2);
const throatSlope = (s) => ((s < 146 ? 0.994 : 0.9025) * (s - 146)) / throat(s);
const THROAT = [...Array.from({ length: 15 }, (_, index) => 123.5 + (22.5 * index) / 15), ...Array.from({ length: 11 }, (_, index) => 146 + (16 * index) / 10)].map((s, index, all) => [s, throat(s), index && index < all.length - 1 ? 1 : 0]);
turned("chamber", ENGINE, THROAT, {}, { smooth: { slope: throatSlope, rows: 5 }, inner: G.arcOf(ENGINE, 146, throat(146), P) });

// A crack in the bell, taped over: the crack shows above and below the band.
if (B.on("crack-tape")) {
  const [C0, C1] = CRACK;
  const profile = Array.from({ length: 7 }, (_, index) => { const s = C0 + ((C1 - C0) * index) / 6; return [s, bell(s) + 0.45, index && index < 6 ? 1 : 0]; });
  const name = B.name("crack-tape", "band");
  const inner = [...profile].reverse().map(([s]) => [s, bell(s) - WALL]);
  put("nozzle", ex(ENGINE, (C0 + C1) / 2), S(G.solidOf(profile, ENGINE, P, { smooth: { slope: bellSlope, rows: 3 } }), { tone: "hi", className: "an-repair" }), { bias: 0.3, name, shapes: [record(SHELL ? A.body(ENGINE, [...profile.map(([s, r]) => [s, r]), ...inner], { name, owner: "nozzle.bell" }) : A.solid(ENGINE, profile, { name, owner: "nozzle.bell" }))] });
  const CRACK_DEG = 44;
  const crack = (from, to, zig) => Array.from({ length: 7 }, (_, index) => { const s = from + ((to - from) * index) / 6; return polar(CRACK_DEG + (index % 2 ? zig : -zig) * (index / 6), bell(s) + 0.05, s); });
  const d = (points) => `M${points.map((p) => at(p)).map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("L")}`;
  const runs = [crack(C1, C1 + 7, 1.4), crack(C0, C0 - 6, 1.2)];
  put("nozzle", ex(ENGINE, C1 + 3), Ln(runs.map(d).join(""), { tone: "mid", free: true }), { bias: 0.35, name: B.name("crack-tape", "crack"), shapes: runs.map((points) => A.tube(points, 0.4 / KS)) });
}
const JACKETS = [[162, 171, 167], [174.2, 186, 180], [189.2, 194, 191.6]].map(([s0, s1, seam]) => band("chamber", ENGINE, s0, s1, 29.4, {}, { name: "chamber.jacket", inner: G.arcOf(ENGINE, seam, 29.4, P) }));
const RINGS = [171, 186].map((s) => band("chamber", ENGINE, s, s + 3.2, 31.6, {}, { name: "chamber.ring", extra: Dots(G.dotsOf(ENGINE, s + 3.2, 30.4, 24, P, { all: true, least: 0 }), { size: 0.34, tone: "lo" }) }));
const HEAD = band("chamber", ENGINE, 194, 205, 33.4, {}, { bias: 0.4, extra: Dots(G.dotsOf(ENGINE, 200.5, 33.4, 30, P, { fade: FADE }), { size: 0.4, tone: "mid" }) });
const INJECTOR = turned("chamber", ENGINE, [[205, 37.5], [210, 37.5]], {}, { bevel: 0.6, extra: Dots(G.dotsOf(ENGINE, 210, 35.6, 36, P, { all: true }), { size: 0.42, tone: "mid" }) });
const DOME_PROFILE = [[210, 34.4], [214, 34, 1], [218, 32, 1], [222, 27.5]];
const DOME = turned("chamber", ENGINE, DOME_PROFILE, {}, { extra: Ln(G.circleOf(ENGINE, 222, 23.5, P), { tone: "faint" }) });
const domeAt = (deg, s) => onBody(ENGINE, DOME_PROFILE, deg, s);
const JACKET_BOSS = Object.fromEntries([70, 110, 250].map((deg) => [deg, boss("chamber", polar(deg, 29.4, 180), dir(deg), 1.7, 3, { host: JACKETS[1] })]));
boss("chamber", polar(-150, 33.4, 200), dir(-150), 2.4, 3.6, { host: HEAD });
const DOME_BOSS = Object.fromEntries([-100, 175].map((deg) => {
  const { at: point, normal } = domeAt(deg, 216);
  return [deg, { face: boss("chamber", point, normal, 1.5, 2.6, { host: DOME }), normal }];
}));
boss("chamber", domeAt(28, 219).at, domeAt(28, 219).normal, 1.5, 2.4, { host: DOME });


turned("orpb", ENGINE, [[222, 25.5], [225.5, 25.5]], {}, { extra: Dots(G.dotsOf(ENGINE, 225.5, 24, 24, P, { all: true }), { size: 0.4, tone: "mid" }) });
const ORPB_BODY = band("orpb", ENGINE, 225.5, 242, 22.2, {}, { inner: [230, 236].map((s) => G.arcOf(ENGINE, s, 22.2, P)).join("") });
turned("orpb", ENGINE, [[242, 25.5], [246, 25.5]], {}, { extra: Dots(G.dotsOf(ENGINE, 246, 24, 24, P, { all: true }), { size: 0.4, tone: "mid" }) });
const IGNITER_DEG = 200;
const ORPB_IGNITER = boss("orpb", polar(IGNITER_DEG, 22.2, 233), dir(IGNITER_DEG), 2.6, 4.4, { host: ORPB_BODY, ring: false });
const ORPB_PLUG = boss("orpb", ORPB_IGNITER, dir(IGNITER_DEG), 2, 4);
const ORPB_EXCITER = boss("orpb", polar(100, 22.2, 228.5), dir(100), 1.3, 2.4, { host: ORPB_BODY, name: "orpb.exciter" });
const ORPB_SENSE = boss("orpb", polar(20, 22.2, 236), dir(20), 2, 3.2, { host: ORPB_BODY, name: "orpb.sense-boss" });
boss("orpb", polar(70, 22.2, 238), dir(70), 1.5, 2.6, { host: ORPB_BODY });


const OTP_RING = turned("otp", ENGINE, [[246, 25], [248, 27.4], [257, 27.4], [259, 24.5]], {}, {
  extra: Dots(G.dotsOf(ENGINE, 257, 27.4, 36, P, { fade: FADE }), { size: 0.4, tone: "mid" }),
  inner: G.arcOf(ENGINE, 252.5, 27.4, P),
});
band("otp", ENGINE, 259, 283, 20.6, {}, { name: "otp.housing", inner: [263, 279].map((s) => G.arcOf(ENGINE, s, 20.6, P)).join("") });
const VOLUTE = G.spiral(ENGINE, 271, 20.6 + 2.4 + 0.3, 20.6 + 6.6 + 0.3, -160 * DEG, 112 * DEG, 64);
const VOLUTE_END = VOLUTE[VOLUTE.length - 1];
const voluteTan = G.unit3(G.sub3(VOLUTE_END, VOLUTE[VOLUTE.length - 2]));
const OTP_OUTLET = G.add3(VOLUTE_END, G.mul3(voluteTan, OTP_REACH));
tubeItems("otp", [...VOLUTE, OTP_OUTLET], (t) => 2.4 + 4.2 * t, { name: "otp.volute", maxLength: 18, spacing: 1, bias: 0.3, touch: ["otp.housing"], ends: [false, true] });
const OTP_FLANGE_T = 2.6;
flangeAt("otp", G.add3(OTP_OUTLET, G.mul3(voluteTan, OTP_FLANGE_T / 2)), voluteTan, OTP_FLANGE_R, OTP_FLANGE_T, { bolts: 8, bias: 0.4, name: "otp.outlet" });
const LOX_START = G.add3(OTP_OUTLET, G.mul3(voluteTan, OTP_FLANGE_T));
turned("otp", ENGINE, [[283, 16.5], [286, 16.5]], {}, { extra: Dots(G.dotsOf(ENGINE, 286, 15, 16, P, { all: true }), { size: 0.38, tone: "mid" }) });
band("otp", ENGINE, 286, 292, 12.6);
const LUG_BALL = 3.6;
const lugBall = (foot) => polar(foot, 29.6 + LUG_BALL, 252.5);
for (const [, deg] of LUGS) {
  const F = G.frameAlong(polar(deg, 0, 252.5), dir(deg));
  const start = Math.sqrt(27.4 ** 2 - 2 ** 2);
  put("otp", polar(deg, 28.5, 252.5), S(G.disc(start, 29.6, 2, F, P), { tone: "mid" }), { bias: 0.1, name: "otp.lug", shapes: [record(A.disc(F, start, 29.6, 2, { name: "otp.lug", seated: true, cut: OTP_RING }))] });
}
const OTP_SENSE = boss("otp", polar(80, 27.4, 252.5), dir(80), 1.7, 2.4, { host: OTP_RING });
const PURGE_C = boss("otp", polar(-120, 27.4, 252.5), dir(-120), 2.2, 3, { host: OTP_RING });
const PRESS_LOX = boss("otp", polar(200, 27.4, 252.5), dir(200), 2.7, 2, { host: OTP_RING });
const PURGE_F = boss("otp", polar(-100, 27.4, 252.5), dir(-100), 2, 2.4, { host: OTP_RING });


const puck = (s) => 18.4 - (s < 297.5 ? 5 : 3.4) * (Math.abs(s - 297.5) / 5.5) ** 4;
const puckSlope = (s) => ((s < 297.5 ? 5 : -3.4) * 4 * Math.abs(s - 297.5) ** 3) / 5.5 ** 4;
const PUCK = Array.from({ length: 23 }, (_, index) => {
  const s = 292 + (11 * index) / 22;
  return [s, puck(s), index && index < 22 ? 1 : 0];
});
const GIMBAL = turned("gimbal", ENGINE, PUCK, {}, { smooth: { slope: puckSlope, rows: 3 }, inner: G.arcOf(ENGINE, 297.5, 18.4, P) });
for (const deg of [AZIMUTH - 45, AZIMUTH + 45, AZIMUTH + 135, AZIMUTH - 135]) boss("gimbal", polar(deg, 18.4, 297.5), dir(deg), 1.9, 2.8, { bias: 0.3, host: GIMBAL });
turned("gimbal", ENGINE, [[303, 24], [310, 24]], {}, { bevel: 0.8, extra: Dots(G.dotsOf(ENGINE, 310, 21.2, 18, P, { all: true }), { size: 0.45, tone: "mid" }) + Ln(G.circleOf(ENGINE, 310, 15, P), { tone: "faint" }) });


const FTP_LOW_PROFILE = [[166, 3.5], [168, 8, 1], [171, 10.6, 1], [175, 11.6], [194, 11.6]];
const FTP_LOW = turned("ftp", FTP, FTP_LOW_PROFILE, {}, { inner: [180, 188].map((s) => G.arcOf(FTP, s, 11.6, P)).join("") });
const FTP_RING = turned("ftp", FTP, [[194, 15], [198, 15]], {}, { extra: Dots(G.dotsOf(FTP, 198, 13.6, 18, P, { all: true }), { size: 0.4, tone: "mid" }) });
const FTP_TURBINE = turned("ftp", FTP, [[198, 16], [200, 18.4], [214, 18.4], [216, 16]], {}, { extra: Dots(G.dotsOf(FTP, 200, 18.4, 28, P, { fade: FADE }), { size: 0.4, tone: "mid" }), inner: G.arcOf(FTP, 207, 18.4, P) });
const FTP_NECK = band("ftp", FTP, 216, 226, 11.6, {}, { extra: Faded(G.ribsOf(FTP, 216, 226, 11.6, 18, P, { fade: [0.1, 0.55] }), { tone: "faint" }) });
const FTP_HOUSING = band("ftp", FTP, 226, 250, 15.2, {}, { name: "ftp.housing", inner: [230, 246].map((s) => G.arcOf(FTP, s, 15.2, P)).join("") });
const FVOLUTE = G.spiral(FTP, 238, 15.2 + 2 + 0.3, 15.2 + 5.6 + 0.3, -140 * DEG, 36 * DEG, 48);
const FVOLUTE_END = FVOLUTE[FVOLUTE.length - 1];
const fvTan = G.unit3(G.sub3(FVOLUTE_END, FVOLUTE[FVOLUTE.length - 2]));
const FTP_OUTLET = G.add3(FVOLUTE_END, G.mul3(fvTan, FTP_REACH));
tubeItems("ftp", [...FVOLUTE, FTP_OUTLET], (t) => 2 + 3.6 * t, { name: "ftp.volute", maxLength: 16, spacing: 1, bias: 0.3, touch: ["ftp.housing"], ends: [false, true] });
const FTP_FLANGE_T = 2.4;
flangeAt("ftp", G.add3(FTP_OUTLET, G.mul3(fvTan, FTP_FLANGE_T / 2)), fvTan, FTP_FLANGE_R, FTP_FLANGE_T, { bolts: 8, bias: 0.4, name: "ftp.outlet" });
const FUEL_START = G.add3(FTP_OUTLET, G.mul3(fvTan, FTP_FLANGE_T));
band("ftp", FTP, 250, 262, 10.2, {}, { inner: G.arcOf(FTP, 256, 10.2, P) });
turned("ftp", FTP, [[262, 13.6], [265, 13.6]], {}, { bevel: 0.5, extra: Dots(G.dotsOf(FTP, 265, 12, 12, P, { all: true }), { size: 0.4, tone: "mid" }) });
const FRPB_IGNITER = boss("ftp", ftp(70, 11.6, 182), dir(70), 2.4, 4, { host: FTP_LOW, ring: false });
const FRPB_PLUG = boss("ftp", FRPB_IGNITER, dir(70), 1.9, 3.6, { name: "ftp.igniter-plug" });
const FRPB_EXCITER_AT = onBody(FTP, FTP_LOW_PROFILE, 40, 173);
const FRPB_EXCITER = boss("ftp", FRPB_EXCITER_AT.at, FRPB_EXCITER_AT.normal, 1.3, 2.4, { host: FTP_LOW, name: "ftp.exciter" });
const FTP_SENSE = boss("ftp", ftp(100, 18.4, 207), dir(100), 1.7, 2.6, { host: FTP_TURBINE });
const FTP_PUMP_SENSE = boss("ftp", ftp(110, 15.2, 233), dir(110), 1.7, 2.4, { host: FTP_HOUSING });
const PICKUP_DEG = 60;
const FTP_PICKUP = boss("ftp", ftp(PICKUP_DEG, 11.6, 221), dir(PICKUP_DEG), 1.4, 2.4, { name: "ftp.pickup", host: FTP_NECK });
const balance = [ftp(250, 15.2, 229), ftp(250, 19, 229), ftp(250, 21, 221), ftp(250, 22, 212), ftp(250, 18.4, 212)];
pipe("ftp", balance, 1.2, { flangeR: 1.6, bend: 3, name: "ftp.balance" });

function strut(piece, [hostA, a, na], [hostB, b, nb], { move, r = 1.1, ball = 2.2, stem = 1.3, lift = 1.2 } = {}) {
  const id = nameFor(`${piece}.strut`);
  const reach = Math.sqrt(ball ** 2 - stem ** 2);
  const [ca, cb] = [[hostA, a, na], [hostB, b, nb]].map(([host, point, normal]) => {
    const own = host.piece ?? piece;
    const face = boss(own, point, normal, stem, lift, { host, move: own === piece ? move : undefined, name: `${own}.ball-stud`, owner: `${id}.stud`, ring: false });
    const centre = G.add3(face, G.mul3(normal, reach));
    ballAt(own, centre, ball, { move: own === piece ? move : undefined, tone: "hi", name: `${own}.ball-stud`, owner: `${id}.stud` });
    return centre;
  });
  const axis = G.unit3(G.sub3(cb, ca));
  const length = G.len3(G.sub3(cb, ca));
  const F = G.frameAlong(ca, axis);
  const end = Math.sqrt(ball ** 2 - r ** 2);
  put(piece, G.lerp3(ca, cb, 0.5), S(G.disc(end, length - end, r, F, P), { tone: "hi", inner: Ln(G.arcOf(F, length * 0.5, r, P), { tone: "faint" }) }), { move, name: id, shapes: [record(A.disc(F, end, length - end, r, { name: id, owner: id }))] });
}
const STRUT_LOW = onBody(FTP, FTP_LOW_PROFILE, 214, 172.4);
strut("ftp", [FTP_HOUSING, ftp(196, 15.2, 244), dir(196)], [OTP_RING, polar(-24, 27.4, 250.6), dir(-24)]);
strut("ftp", [FTP_TURBINE, ftp(116, 18.4, 205), dir(116)], [INJECTOR, polar(8, 37.5, 207.5), dir(8)]);
strut("ftp", [FTP_LOW, STRUT_LOW.at, STRUT_LOW.normal], [RINGS[0], polar(-56, 31.6, 172.6), dir(-56)]);


const HOT_S = 199.4;
const HOT_R = 3.6;
const HOT_PAD = 5.2;
const HOT_A = boss("ftp", ftp(160, 18.4, HOT_S), dir(160), HOT_PAD, 1, { host: [FTP_TURBINE, FTP_RING], ring: false, name: "ftp.hot-pad" });
const HOT_B = boss("chamber", polar(FTP_DEG, 33.4, HOT_S), dir(FTP_DEG), HOT_PAD, 1, { host: HEAD, ring: false, name: "chamber.hot-pad" });
const HOT = pipe("hotgas", [HOT_A, HOT_B], HOT_R, { flangeR: 1.3, bands: [0.5], maxLength: 12, name: "hotgas.duct", free: [true, true] });
if (B.on("sealant")) {
  // A ring of goop where the duct meets its chamber flange, on the side he could reach.
  const Fh = G.frameAlong(HOT_A, G.mul3(G.tangentAlong(HOT, 0), -1));
  const thick = Math.max(0.9, HOT_R * 0.55);
  const flanges = R.solids.filter((shape) => shape.name && shape.name.startsWith(`${HOT.owner}.flange`));
  const facing = G.angleToward(Fh, V);
  [[-58, 1.25, 0.1], [-24, 1.6, 0.35], [8, 1.15, 0.0], [38, 1.45, 0.25], [70, 1.05, 0.1]].forEach(([deg, r, lift], index) => {
    const centre = G.pointOf(Fh, -thick - 0.35 - lift, HOT_R + 0.25, facing + deg * DEG);
    const name = B.name("sealant", `blob${index}`);
    put("hotgas", centre, S(G.sphereOf(centre, r, P, { steps: G.stepsFor(r, 24) }), { tone: "mid" }), { bias: 0.3, name, shapes: [record(A.ball(centre, r, { name, owner: HOT.owner, seated: true, cut: flanges }))] });
  });
}


const DOWN_ELBOW = G.add3(FUEL_START, G.mul3(fvTan, 30));
const DOWN_STUB = [MANIFOLD_S + Math.sqrt(TEE ** 2 - DOWN_R ** 2), MANIFOLD_S + 7.6, MANIFOLD_S + 8.8];
{
  const F = G.frameAlong(polar(PORTS[0], MANIFOLD_R, 0), [0, 0, 1]);
  put("nozzle", polar(PORTS[0], MANIFOLD_R, (DOWN_STUB[0] + DOWN_STUB[1]) / 2), S(G.disc(DOWN_STUB[0], DOWN_STUB[1], DOWN_R, F, P), { tone: "hi" }), { name: "nozzle.stub", shapes: [record(A.disc(F, DOWN_STUB[0], DOWN_STUB[1], DOWN_R, { name: "nozzle.stub", owner: "nozzle.manifold" }))] });
  // Two bolts of eight, opposite each other; the other six holes are empty.
  const KEPT = B.on("bolts-gone") ? [1, 5] : [0, 1, 2, 3, 4, 5, 6, 7];
  const boltAt = (index) => G.pointOf(F, DOWN_STUB[2], DOWN_R * 1.2, (index / 8) * Math.PI * 2);
  const holes = [0, 1, 2, 3, 4, 5, 6, 7].filter((index) => !KEPT.includes(index)).map((index) => G.circleOf(G.frameAlong(boltAt(index), F.a), 0, 0.42, P, 12)).join("");
  put("nozzle", polar(PORTS[0], MANIFOLD_R, (DOWN_STUB[1] + DOWN_STUB[2]) / 2), S(G.disc(DOWN_STUB[1], DOWN_STUB[2], DOWN_R * 1.4, F, P), { tone: "hi" }) + Dots(KEPT.map((index) => at(boltAt(index))), { size: KEPT.length < 8 ? 0.5 : 0.38, tone: "mid" }) + (holes ? Ln(holes, { tone: "mid" }) : ""), { name: "nozzle.port-flange", shapes: [record(A.disc(F, DOWN_STUB[1], DOWN_STUB[2], DOWN_R * 1.4, { name: "nozzle.port-flange", owner: "nozzle.manifold" }))] });
}
const DOWN_ROUTE = [FUEL_START, DOWN_ELBOW, [DOWN_ELBOW[0], DOWN_ELBOW[1], Z_EXIT + 196], polar(12, 60, 152), polar(12, MANIFOLD_R, 130), polar(12, MANIFOLD_R, DOWN_STUB[2])];
const DOWN = pipe("downcomer", DOWN_ROUTE, DOWN_R, { bend: 1.6, flangeR: [FTP_FLANGE_R / DOWN_R, 1.4], bands: [0.5, 0.58, 0.66], bellows: [0.24, 0.3, 5], valve: [12.4, 3.6], maxLength: 18, name: "downcomer.duct", free: [true, true] });
const MFV = valveOn("downcomer", DOWN, 12.4, 3.6);


const LOX_S = 233.75;
const LOX_DEG = 150;
const LOX_FACE = boss("orpb", polar(LOX_DEG, 22.2, LOX_S), dir(LOX_DEG), 7, 1.2, { host: ORPB_BODY, ring: false, name: "orpb.lox-pad" });
const LOX = pipe("lox", [LOX_START, G.add3(LOX_START, G.mul3(voluteTan, 6)), polar(140, 52, 270), polar(140, 52, LOX_S), polar(LOX_DEG, 40, LOX_S), LOX_FACE], 5.6, {
  bend: 1.5,
  flangeR: [OTP_FLANGE_R / 5.6, 1.2],
  valve: [0.5, 4.2],
  maxLength: 14,
  name: "lox.duct",
  free: [true, true],
});
const LOX_RUN = R.tubes.filter((tube) => tube.owner === LOX.owner);
const MOV = valveOn("lox", LOX, 0.5, 4.2, { side: dir(110) });


const LINES = [];
function line(points, r, move, options = {}) {
  LINES.push(points);
  return pipe("plumbing", points, r, { move, flangeR: 1.7, maxLength: 16, name: "plumbing.line", ...options });
}
const ringAt = (s, r, from, to, steps = 0) => {
  const count = steps || Math.max(2, Math.ceil(Math.abs(to - from) / 12));
  return Array.from({ length: count + 1 }, (_, index) => polar(from + ((to - from) * index) / count, r, s));
};
const tubeAt = (runs, point) => runs.reduce((best, run) => {
  const d = A.sdf(run, point);
  return Math.abs(d) < Math.abs(best.d) ? { run, d } : best;
}, { run: null, d: Infinity }).run;

const JACKET_MOVE = still();
const JACKET_S = 199;
const JACKET_FROM = boss("chamber", polar(-48, 33.4, JACKET_S), dir(-48), 4.4, 1, { host: HEAD, ring: false, name: "chamber.jacket-pad" });
const JACKET_TO = boss("ftp", ftp(168, 11.6, 181), dir(168), 4.4, 1, { host: FTP_LOW, ring: false, name: "ftp.jacket-pad" });
const JACKET_TEE = polar(-48, 41, JACKET_S);
const JACKET_BALL = 4.2;
const jacketLine = line([JACKET_FROM, polar(-48, 50, JACKET_S), G.add3(JACKET_TO, G.mul3(dir(168), 13)), JACKET_TO], 3, JACKET_MOVE, { name: "plumbing.jacket-to-frpb", bands: [0.55], flangeR: [1.3, 1.4], free: [true, true], gaps: [[G.len3(G.sub3(JACKET_TEE, JACKET_FROM)) - Math.sqrt(JACKET_BALL ** 2 - 9), G.len3(G.sub3(JACKET_TEE, JACKET_FROM)) + Math.sqrt(JACKET_BALL ** 2 - 9)]] });
ballAt("plumbing", JACKET_TEE, JACKET_BALL, { move: JACKET_MOVE, tone: "hi", name: "plumbing.jacket-tee", owner: jacketLine.owner });
const ORPB_FEED = boss("orpb", polar(-96, 22.2, 236), dir(-96), 3.2, 0.8, { host: ORPB_BODY, ring: false, name: "orpb.jacket-pad" });
line([G.add3(JACKET_TEE, [0, 0, Math.sqrt(JACKET_BALL ** 2 - 2.1 ** 2)]), G.add3(JACKET_TEE, [0, 0, 6]), polar(-52, 41, 209), polar(-70, 42, 216), polar(-92, 36, 230), polar(-96, 31, 236), ORPB_FEED], 2.1, JACKET_MOVE, { name: "plumbing.jacket-to-orpb", bands: [0.5], flanges: [false, true], flangeR: 1.4, free: [false, true] });

const TAP_S = 199.5;
const TAP_R = 41.5;
const TAP_AT = polar(LOX_DEG, 34, LOX_S - 5.6);
const LOX_FRPB_MOVE = still();
const LOX_TAP = boss("lox", TAP_AT, [0, 0, -1], 3.1, 1, { host: tubeAt(LOX_RUN, TAP_AT), ring: false, name: "lox.tap-pad" });
const FRPB_FEED_AT = onBody(FTP, FTP_LOW_PROFILE, 112, 172.6);
const FRPB_FEED = boss("ftp", FRPB_FEED_AT.at, FRPB_FEED_AT.normal, 3.1, 0.8, { host: FTP_LOW, ring: false, name: "ftp.feed-pad" });
line([LOX_TAP, polar(LOX_DEG, 34, 222), polar(LOX_DEG - 4, TAP_R, 210.5), ...ringAt(TAP_S, TAP_R, LOX_DEG - 8, 2), polar(-6, 50, 192), G.add3(FRPB_FEED, G.mul3(FRPB_FEED_AT.normal, 11)), FRPB_FEED], 2.1, LOX_FRPB_MOVE, { name: "plumbing.lox-to-frpb", bands: [0.18, 0.4, 0.62, 0.84], flangeR: 1.4, free: [true, true] });

const PRESS_LOX_MOVE = still();
line([PRESS_LOX, polar(200, 33, 252.5), polar(198, 36, 262), polar(188, 37, 285), polar(150, 46, 310), polar(135, 50, TOP + 13), polar(135, 50, TOP + 21)], 1.5, PRESS_LOX_MOVE, { name: "plumbing.press-lox", bands: [0.25, 0.5, 0.75], coupling: true, free: [true, true] });
line([polar(-62, 29.4, 182.5), polar(-62, 49.5, 182.5), polar(-58, 49.5, 222), polar(-52, 50, 270), polar(-46, 49, 300), polar(-45, 46, TOP + 13), polar(-45, 46, TOP + 21)], 1.5, still(), { name: "plumbing.press-ch4", bands: [0.3, 0.6], coupling: true, flangeR: [1.5, 1.7], free: [true, true] });
line([PURGE_C, polar(-120, 34, 252.5), polar(-120, 38, 250), polar(-140, 40, 228), G.add3(domeAt(-150, 212).at, G.mul3(domeAt(-150, 212).normal, 4)), domeAt(-150, 212).at], 1.1, still(), { name: "plumbing.purge-chamber", bands: [0.5], free: [true, true] });
line([PURGE_F, polar(-100, 40, 252.5), polar(-72, 44, 238), polar(-52, 44.5, 229), polar(-40, 52, 222), G.add3(ftp(200, 18.4, 210), G.mul3(dir(200), 8)), ftp(200, 18.4, 210)], 1.1, still(), { name: "plumbing.purge-ftp", bands: [0.35, 0.7], free: [true, true] });
const INLET_AT = G.add3(polar(LOX_DEG, 30, LOX_S), G.mul3(dir(LOX_DEG + 90), 5.6));
const LOX_INLET = boss("lox", INLET_AT, dir(LOX_DEG + 90), 2, 0.8, { host: tubeAt(LOX_RUN, INLET_AT), ring: false, name: "lox.inlet-pad" });
line([ORPB_PLUG, G.add3(ORPB_PLUG, G.mul3(dir(IGNITER_DEG), 3)), G.add3(LOX_INLET, G.mul3(dir(LOX_DEG + 90), 3)), LOX_INLET], 0.9, still(), { name: "plumbing.igniter-orpb", flangeR: 2, bend: 3, free: [true, true] });
const IGNITER_FRPB_TURN = ftp(62, 26.5, 189);
const IGNITER_FRPB_TIP = elbow("ftp", FRPB_PLUG, dir(70), 1.9, IGNITER_FRPB_TURN, 2.3, 0.9 * 1.3, { name: "ftp.igniter-elbow", owner: "ftp.igniter-plug" });
line([IGNITER_FRPB_TIP, IGNITER_FRPB_TURN, ftp(52, 24, 196), ftp(52, 15, 196)], 0.9, PIECES.ftp.move, { name: "plumbing.igniter-frpb", flangeR: [1.3, 2], bend: 4 });

const BLOCK_C = polar(52, 45, 228);
const BLOCK = { x: BLOCK_C[0] - 6, y: BLOCK_C[1] - 4, w: 12, d: 8, r: 1 };
const BLOCK_MOVE = PIECES.controller.move;
boxAt("plumbing", BLOCK, BLOCK_C[2] - 6, 12, {}, {
  name: "plumbing.block",
  move: BLOCK_MOVE,
  bias: 0.5,
  extra: Ln(k.planOutline(k.insetPlan(BLOCK, 1.2), BLOCK_C[2] + 6, P, 2), { tone: "faint" }) + Dots([0, 1, 2, 3].map((index) => at([BLOCK.x + 2 + index * 2.6, BLOCK.y + BLOCK.d, BLOCK_C[2] + 2])), { size: 0.5, tone: "hi" }),
});
const BLOCK_LOW = BLOCK_C[2] - 6;
const BLOCK_TOP = BLOCK_C[2] + 6;
const below = (x) => [[x, BLOCK.y + 10.5, BLOCK_LOW - 15], [x, BLOCK.y + 6, BLOCK_LOW - 7], [x, BLOCK.y + 6, BLOCK_LOW]];
const above = (x) => [[x, BLOCK.y + 4, BLOCK_TOP + 6], [x, BLOCK.y + 4, BLOCK_TOP]];
const SENSE_DEG = 40;
const SENSE_BOSS = boss("chamber", domeAt(SENSE_DEG, 219).at, domeAt(SENSE_DEG, 219).normal, 1.7, 1.2, { name: "chamber.sense-boss", host: DOME });
const MANIFOLD_RUNS = R.tubes.filter((tube) => tube.owner === "nozzle.manifold");
const MANIFOLD_TOP = polar(64, MANIFOLD_R, MANIFOLD_S + MANIFOLD_TUBE);
const MANIFOLD_SENSE = boss("nozzle", MANIFOLD_TOP, [0, 0, 1], 1.8, 0.8, { host: tubeAt(MANIFOLD_RUNS, MANIFOLD_TOP), ring: false, name: "nozzle.sense-pad" });
const SENSE0_FACE = boss("chamber", polar(56, 29.4, 180), dir(56), 1.3, 1.4, { host: JACKETS[1], name: "chamber.sense-port" });
const SENSE0_TEE = G.add3(SENSE0_FACE, G.mul3(dir(56), Math.sqrt(1.7 ** 2 - 1.3 ** 2)));
ballAt("chamber", SENSE0_TEE, 1.7, { tone: "hi", name: "chamber.sense-tee", owner: "chamber.sense-port" });
const SENSE0_OUT = G.unit3(G.add3(dir(56), [0, 0, 1]));
const SENSE0_TIP = G.add3(SENSE0_TEE, G.mul3(SENSE0_OUT, Math.sqrt(1.7 ** 2 - (0.75 * 1.3) ** 2)));
const senses = [
  [SENSE0_TIP, G.add3(SENSE0_TIP, G.mul3(SENSE0_OUT, 20)), ...below(BLOCK.x + 4)],
  [MANIFOLD_SENSE, polar(64, MANIFOLD_R, 124), polar(64, 50, 150), polar(62, 50, 190), ...below(BLOCK.x + 1.5)],
  [elbow("chamber", SENSE_BOSS, domeAt(SENSE_DEG, 219).normal, 1.7, [BLOCK.x + 6, BLOCK.y - 6, BLOCK_LOW + 5], 2.1, 0.75 * 1.3, { name: "chamber.sense-elbow", owner: "chamber.sense-boss" }), [BLOCK.x + 6, BLOCK.y - 6, BLOCK_LOW + 5], [BLOCK.x + 6, BLOCK.y, BLOCK_LOW + 5]],
  [FTP_SENSE, G.add3(FTP_SENSE, G.mul3(dir(100), 6)), polar(20, 62, 205), ...below(BLOCK.x + 9)],
  [OTP_SENSE, G.add3(OTP_SENSE, G.mul3(dir(80), 3)), polar(78, 44, 258), ...above(BLOCK.x + 2.5)],
  [elbow("orpb", ORPB_SENSE, dir(20), 2, polar(34, 36, 239), 2.4, 0.75 * 1.3, { name: "orpb.sense-elbow", owner: "orpb.sense-boss" }), polar(34, 36, 239), ...above(BLOCK.x + 6)],
  [FTP_PUMP_SENSE, G.add3(FTP_PUMP_SENSE, G.mul3(dir(110), 4)), polar(-5, 58, 258), polar(40, 44, 256), ...above(BLOCK.x + 9.5)],
];
senses.forEach((points, index) => {
  line(points, 0.75, BLOCK_MOVE, { name: `plumbing.sense${index}`, flangeR: [0, 2, 5].includes(index) ? [1.3, 2.2] : 2.2, bend: 4, flanges: [true, false], free: [true, false] });
  const end = points[points.length - 1];
  if (end[2] > BLOCK_C[2]) put("plumbing", end, Dots([at(end)], { size: 0.5, tone: "hi" }), { move: BLOCK_MOVE, bias: 0.4, name: `plumbing.port${index}`, shapes: [A.ball(end, 0.5 / KS)] });
});

const TRANSDUCERS = [
  { face: JACKET_BOSS[110], axis: dir(110), to: { host: RINGS[0], deg: 110, s: 172.6, r: 31.6 } },
  { face: JACKET_BOSS[250], axis: dir(250), to: { host: RINGS[0], deg: 250, s: 172.6, r: 31.6 } },
  { face: DOME_BOSS[-100].face, axis: DOME_BOSS[-100].normal, to: { host: INJECTOR, deg: -100, s: 207.5, r: 37.5 } },
];
TRANSDUCERS.forEach(({ face, axis, to }) => {
  const F = G.frameAlong(face, axis);
  const meridian = [[0, 0], [0, 1.9], [1.2, 2.2], [5.2, 2.2], [6, 1.5], [6, 0]];
  const id = nameFor("plumbing.transducer");
  put("plumbing", G.add3(face, G.mul3(axis, 3)), S(G.lathe(meridian, F, P, { steps: 20, smooth: { rows: 3 } }), { tone: "hi" }), { move: PIECES.chamber.move, bias: 0.3, name: id, shapes: [record(A.body(F, meridian, { name: id }))] });
  const tip = G.add3(face, G.mul3(axis, 6));
  const socket = boss("plumbing", polar(to.deg, to.r, to.s), dir(to.deg), 1.2, 2, { host: to.host, move: PIECES.chamber.move, name: "plumbing.socket" });
  const out1 = G.add3(tip, G.mul3(axis, 3));
  const near = G.add3(socket, G.mul3(dir(to.deg), 3));
  const reach = Math.max(Math.hypot(out1[0], out1[1]), Math.hypot(near[0], near[1])) + 2;
  cable("plumbing", [tip, out1, polar(to.deg, reach, out1[2] - Z_EXIT), polar(to.deg, reach, to.s), near, socket], { move: PIECES.chamber.move, r: 0.5, bend: 1.6, name: `plumbing.pigtail`, shells: [true, false] });
});


const BOX = { x: -24, y: 46, w: 26, d: 12, r: 1.6 };
const BOX_Z = Z_EXIT + 230;
const BOX_H = 28;
const CTRL = PIECES.controller.move;
boxAt("controller", BOX, BOX_Z, BOX_H, { inner: Ln(k.sideSeam(BOX, BOX_Z + BOX_H - 6, P, 3), { tone: "faint" }) }, {
  name: "controller.box",
  bevel: 0.8,
  extra:
    Ln(k.planOutline(k.insetPlan(BOX, 2), BOX_Z + BOX_H, P, 3), { tone: "faint" }) +
    Ln([0, 1, 2].map((row) => k.onTop([[BOX.x + 4, BOX.y + 3.4 + row * 2.4], [BOX.x + (row === 1 ? 14 : 19), BOX.y + 3.4 + row * 2.4]], BOX_Z + BOX_H, P)).join(""), { tone: "lo", free: true }) +
    Dots(k.corners(BOX, 2.2).map(([x, y]) => at([x, y, BOX_Z + BOX_H])), { size: 0.45 }),
});
if (B.on("temp-tape")) {
  // A strip of the blue tape across the lid, with the one word he wrote on it.
  const LID = BOX_Z + BOX_H;
  const STRIP = { x: BOX.x + 9.5, y: BOX.y - 0.6, w: 6.2, d: BOX.d + 1.2, r: 0.3 };
  const name = B.name("temp-tape", "strip");
  put("controller", [STRIP.x + STRIP.w / 2, STRIP.y + STRIP.d / 2, LID + 0.15], S(k.slabOf(STRIP, LID, 0.3, P, 2, 0.1), { tone: "hi", className: "an-repair" }) + `<g class="an-hand">${k.faceTextSvg(k.topMatrix([STRIP.x + STRIP.w / 2 + 1.2, STRIP.y + STRIP.d / 2], LID + 0.3, P, "y"), "TEMP", { size: 3.4, tone: "hi", anchor: "middle" })}</g>`, { move: CTRL, bias: 0.6, name, shapes: [record(A.box([STRIP.x, STRIP.y, LID], [STRIP.x + STRIP.w, STRIP.y + STRIP.d, LID + 0.3], { name }))] });
}
const ARM = { x: -2, w: 4, z: Z_EXIT + 242.5, h: 3 };
const ARM_Y = Math.sqrt(25.5 ** 2 - (ARM.w / 2) ** 2);
boxAt("controller", { x: ARM.x, y: ARM_Y, w: ARM.w, d: BOX.y - ARM_Y, r: 0.4 }, ARM.z, ARM.h, {}, { bias: -1, bevel: 0.3, name: "controller.bracket" });
const JBOX = { x: -38, y: 46, w: 10, d: 10, r: 1.2 };
boxAt("controller", JBOX, Z_EXIT + 244, 12, {}, { name: "controller.jbox", extra: Ln(k.planOutline(k.insetPlan(JBOX, 1.4), Z_EXIT + 256, P, 2), { tone: "faint" }) + Dots(k.corners(JBOX, 1.8).map(([x, y]) => at([x, y, Z_EXIT + 256])), { size: 0.4 }) });
boxAt("controller", { x: JBOX.x + JBOX.w, y: JBOX.y + 3, w: BOX.x - JBOX.x - JBOX.w, d: 4, r: 0.3 }, Z_EXIT + 248, 4, {}, { bias: -0.5, bevel: 0.2, name: "controller.jbox-bracket" });
const CONNECTORS = [
  [BOX.x + 4, BOX_Z + 6],
  [BOX.x + 10, BOX_Z + 6],
  [BOX.x + 16, BOX_Z + 6],
  [BOX.x + 22, BOX_Z + 6],
  [BOX.x + 8, BOX_Z + 17],
  [BOX.x + 18, BOX_Z + 17],
];
const CONNECT_Y = BOX.y + BOX.d;
for (const [x, z] of CONNECTORS) {
  const F = G.frameOf([x, CONNECT_Y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const id = nameFor("controller.connector");
  put("controller", [x, CONNECT_Y + 2, z], S(G.disc(0, 4, 2.4, F, P), { tone: "hi" }) + Ln(G.circleOf(F, 4, 1.2, P, 14), { tone: "faint" }), { bias: 0.4, name: id, shapes: [record(A.disc(F, 0, 4, 2.4, { name: id }))] });
}
const plug = (index) => [CONNECTORS[index][0], CONNECT_Y + 4, CONNECTORS[index][1]];
const HARNESS_S = 214.6;
const UNDER = Z_EXIT + 222;
const DROP_Y = CONNECT_Y + 8.5;
const laneR = (lane) => 37.6 + lane * 1.4;
const laneS = (lane) => HARNESS_S + lane * 0.2;
const harnessRoute = (index, lane, to) => {
  const start = plug(index);
  const x = start[0];
  const entry = Math.acos(x / laneR(lane)) / DEG;
  const ring = ringAt(laneS(lane), laneR(lane), entry - 5, to.end, Math.max(2, Math.round((entry - 5 - to.end) / 10)));
  return [start, [x, DROP_Y, start[2]], [x, DROP_Y, UNDER], [x, Math.sqrt(laneR(lane) ** 2 - x * x), UNDER], ...ring, ...to.points];
};
const DROP_IN = G.unit3([-DOWN_ELBOW[0], -DOWN_ELBOW[1], 0]);
const besideDrop = (s) => [DOWN_ELBOW[0] + DROP_IN[0] * (DOWN_R * 1.26 + 1.1), DOWN_ELBOW[1] + DROP_IN[1] * (DOWN_R * 1.26 + 1.1), Z_EXIT + s];
const PICKUP_ROUTE = [polar(0, 58, 228), G.add3(FTP_PICKUP, G.add3(G.mul3(dir(PICKUP_DEG), 8), G.mul3(sideOn(dir(PICKUP_DEG)), 9))), G.add3(FTP_PICKUP, G.mul3(dir(PICKUP_DEG), 8)), FTP_PICKUP];
const HARNESS = [
  { name: "harness-frpb", index: 3, lane: 0, to: { end: 8, points: [polar(5, 50, 212), polar(2, 66, 196), ftp(96, 28, 186), ftp(56, 22, 174), G.add3(FRPB_EXCITER, G.mul3(FRPB_EXCITER_AT.normal, 7)), FRPB_EXCITER] } },
  { name: "harness-pickup", index: 2, lane: 1, to: { end: 12, points: PICKUP_ROUTE } },
  { name: "harness-mfv", index: 1, lane: 2, to: { end: 16, points: [polar(16, laneR(2), 268), [MFV.approach[0], MFV.approach[1], Z_EXIT + 268], MFV.approach, MFV.port] } },
  { name: "cable-block", index: 0, lane: 3, to: { end: 55, points: [[BLOCK.x + 2, BLOCK.y + 2.5, BLOCK_LOW]] } },
];
const CLAMPS = [88, 70, 34, 24].map((deg) => {
  const lanes = deg > 55 ? 4 : 3;
  return { deg, centre: polar(deg, (laneR(0) + laneR(lanes - 1)) / 2, (laneS(0) + laneS(lanes - 1)) / 2), axis: G.unit3(G.cross3(dir(deg), [0, 0, 1])), radius: (laneR(lanes - 1) - laneR(0)) / 2 + 1.25 };
});
for (const { name, index, lane, to } of HARNESS) cable("controller", harnessRoute(index, lane, to), { move: CTRL, bend: 4, name: `controller.${name}`, bundle: "harness", touch: ["controller.clamp*"], clamps: CLAMPS, shells: [false, true], free: [false, name !== "cable-block"] });
for (const { deg, centre, axis, radius } of CLAMPS) {
  clampAt("controller", centre, axis, radius, { move: CTRL, bundle: "harness" });
  const s = centre[2] - Z_EXIT;
  const inner = Math.hypot(centre[0], centre[1]) - radius;
  const root = polar(deg, radiusOn(DOME_PROFILE, s), s);
  boss("chamber", root, dir(deg), 0.9, inner - radiusOn(DOME_PROFILE, s), { host: DOME, ring: false, name: "chamber.clamp-stud" });
}
const OVER = BOX_Z + BOX_H + 4;
cable("controller", [plug(5), [plug(5)[0], DROP_Y, plug(5)[2]], [plug(5)[0], DROP_Y, OVER], [plug(5)[0], BOX.y - 4, OVER], polar(104, 36, 240), polar(100, 30, 228.5), ORPB_EXCITER], { move: CTRL, name: "controller.cable-orpb", shells: [false, true], free: [false, true] });
const MOV_IN = G.add3(MOV.port, G.mul3(dir(110), 9));
cable("controller", [plug(4), [plug(4)[0], DROP_Y, plug(4)[2]], [MOV_IN[0], DROP_Y, MOV_IN[2]], MOV_IN, MOV.port], { move: CTRL, name: "controller.cable-mov", shells: [false, true], free: [false, true] });
cable("controller", [[JBOX.x + JBOX.w / 2, JBOX.y + JBOX.d / 2, Z_EXIT + 256], [JBOX.x + JBOX.w / 2, JBOX.y + JBOX.d / 2, Z_EXIT + 265], [BOX.x + 3, BOX.y + BOX.d / 2, Z_EXIT + 265], [BOX.x + 3, BOX.y + BOX.d / 2, BOX_Z + BOX_H]], { move: CTRL, name: "controller.cable-jbox", bend: 3 });
cable("stand", [[JBOX.x + 3, JBOX.y + 3, Z_EXIT + 256], [JBOX.x + 3, JBOX.y + 3, BEAM_Z]], { name: "stand.cable-press", shells: [true, true], free: [true, false] });


const FEED_TOP = BEAM_Z - 6;
if (!B.on("feed-tape") && !B.on("adapter")) {
  pipe("stand", [ex(FTP, 265), ex(FTP, 290), [FTP_AT[0], FTP_AT[1], FEED_TOP]], 7.2, { bend: 2, bellows: [0.12, 0.32, 7], bands: [0.62], maxLength: 14, name: "stand.feed", free: [true, false] });
} else {
  // The pump wants a 144 line; the van had 120. Three reducers on the inlet...
  let feedFrom = ex(FTP, 265);
  if (B.on("adapter")) {
    const AF = G.frameAlong(ex(FTP, 265), [0, 0, 1]);
    const STACK = AN.adapterProfile([7.2, 6.6, 6.0], { body: 4.6, taper: 1.5, lip: 0.8, chamfer: 0.3 });
    const length = STACK[STACK.length - 1][0];
    const name = B.name("adapter", "stack");
    put("ftp", G.pointOf(AF, length / 2, 0, 0), S(G.solidOf(STACK, AF, P), { tone: "hi" }), { name, shapes: [record(A.solid(AF, STACK, { name, owner: name }))] });
    feedFrom = G.pointOf(AF, length, 0, 0);
  }
  const FEED_R = B.on("adapter") ? 6 : 7.2;
  const top = [FTP_AT[0], FTP_AT[1], FEED_TOP];
  const total = FEED_TOP - feedFrom[2];
  // ...and two short lengths butted together halfway up, held by tape. When it
  // lets go it slides all the way down onto the top reducer.
  const W = 12;
  const restBottom = 14;
  const restTop = restBottom + W;
  const butt = restBottom + W / 2;
  const bandAt = restTop + 0.4 + Math.max(0.8, FEED_R * 0.7) / 2;
  const tape = B.on("feed-tape");
  const line = pipe("stand", [feedFrom, top], FEED_R, {
    bend: 2,
    flanges: [!B.on("adapter"), true],
    bellows: [(bandAt + 5) / total, (total - 6.5) / total, 3],
    bands: [bandAt / total],
    maxLength: 14,
    name: "stand.feed",
    free: [true, false],
    // Under each place the tape can be, the line is gapped and filled with a
    // separate length (below), so the wrap can be a solid plug round it.
    gaps: tape ? [[restBottom, restTop]] : [],
  });
  if (tape) {
    const F = G.frameAlong([FTP_AT[0], FTP_AT[1], feedFrom[2] + restBottom], [0, 0, 1]);
    // Three passes, each a little shorter, lying on the one under it: one turned
    // solid, stepped. Each call-out adds a pass lumped over the split; the page
    // shows the wrap for the number of fixes so far.
    const PASSES = [[0, W, 0.34], [1.1, W - 1.4, 0.32], [2.4, W - 3.2, 0.3], [2.9, W - 3.6, 0.45], [3.3, W - 4.2, 0.45], [3.7, W - 4.8, 0.45]];
    const wrapOf = (count) => {
      const passes = PASSES.slice(0, count);
      let r = FEED_R;
      const steps = passes.map(([s0, s1, t]) => [s0, s1, (r += t)]);
      const up = [[0, FEED_R]];
      const down = [];
      steps.forEach(([s0, s1, rOut], index) => {
        up.push([s0, rOut]);
        down.unshift([s1, rOut]);
        if (index < steps.length - 1) {
          up.push([steps[index + 1][0], rOut]);
          down.unshift([steps[index + 1][1], rOut]);
        }
      });
      return [...up, ...down, [W, FEED_R]].filter((point, index, all) => !index || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1]);
    };
    const meridian = [[0, 0], ...wrapOf(3).slice(1, -1), [W, 0]];
    const name = B.name("feed-tape", "wrap");
    const WRAP = record(A.body(F, meridian, { name, owner: line.owner }));
    put("stand", G.pointOf(F, W / 2, 0, 0), S(G.lathe(meridian, F, P, { steps: 64 }), { tone: "hi", className: "an-repair" }), { bias: 0.2, name, shapes: [WRAP] });
    // The pipe under the tape: two lengths with the split between them.
    const PF = G.frameAlong(feedFrom, [0, 0, 1]);
    [[restBottom, butt - 1, "split-low"], [butt + 1, restTop, "split-high"]].forEach(([s0, s1, part]) => {
      const name = B.name("feed-tape", `pipe-${part}`);
      const svg = tubePieces([G.pointOf(PF, s0, 0, 0), G.pointOf(PF, s1, 0, 0)], FEED_R, P, { maxLength: 40 }).map((piece) => tubeSvg(piece, { tone: "hi" })).join("");
      put("stand", G.pointOf(PF, (s0 + s1) / 2, 0, 0), svg, { bias: -0.1, name, shapes: [record(A.disc(PF, s0, s1, FEED_R, { name, owner: line.owner, seated: true, cut: [WRAP] }))] });
    });
  }
}
const BRACKET = { x: FTP_AT[0] - 13, y: FTP_AT[1] - 13, w: 26, d: 26, r: 2 };
boxAt("stand", BRACKET, FEED_TOP, 6, {}, { bias: 2, name: "stand.feed-bracket", extra: Dots(k.corners(BRACKET, 3).map(([x, y]) => at([x, y, FEED_TOP + 6])), { size: 0.45 }) });
for (const [deg, reach] of [[135, 50], [-45, 46]]) {
  const quick = polar(deg, reach, TOP + 21);
  boxAt("stand", { x: quick[0] - 4, y: quick[1] - 4, w: 8, d: 8, r: 1 }, quick[2], BEAM_Z - quick[2], {}, { bias: 1, name: "stand.quick-disconnect" });
}

const CLEVIS_BALL = 4.6;
for (const [deg, foot] of LUGS) {
  const lug = lugBall(foot);
  const top = [Math.cos(deg * DEG) * 92, Math.sin(deg * DEG) * 92, BEAM_Z];
  const id = nameFor("stand.actuator");
  boxAt("stand", { x: top[0] - 5, y: top[1] - 5, w: 10, d: 10, r: 1 }, BEAM_Z - 3, 3, {}, { name: `${id}.mount`, bevel: 0.4 });
  const pivot = G.add3(top, [0, 0, -3 - CLEVIS_BALL]);
  ballAt("stand", pivot, CLEVIS_BALL, { tone: "hi", name: `${id}.pivot`, owner: id });
  const axis = G.unit3(G.sub3(lug, pivot));
  const span = G.len3(G.sub3(lug, pivot));
  const F = G.frameAlong(pivot, axis);
  const clevisFrom = Math.sqrt(CLEVIS_BALL ** 2 - 3 ** 2);
  put("stand", G.add3(pivot, G.mul3(axis, 5)), S(G.disc(clevisFrom, 9, 3, F, P), { tone: "mid" }), { name: `${id}.clevis`, shapes: [record(A.disc(F, clevisFrom, 9, 3, { name: `${id}.clevis`, owner: id }))] });
  const side = G.unit3(G.cross3(axis, [0, 0, 1]));
  const SF = { o: pivot, a: axis, u: side, v: G.cross3(axis, side) };
  const head = [[9, 0], [9, 6.2], [11, 6.6], [13, 6.6], [13, 0]];
  const barrel = [[15, 0], [15, 6.6], [35, 6.6], [37, 6.2], [39, 4], [39, 0]];
  put("stand", G.add3(pivot, G.mul3(axis, 11)), S(G.lathe(head, F, P, { steps: 40 }), { tone: "hi" }), { name: `${id}.head`, shapes: [record(A.body(F, head, { name: `${id}.head`, owner: id }))] });
  put("stand", G.add3(pivot, G.mul3(axis, 14)), S(G.prismOf(SF, G.stadium(7.4, 5, 10.9), 13, 15, P), { tone: "mid" }) + Dots([G.pointOf(SF, 15, 0, 0), G.add3(G.pointOf(SF, 15, 0, 0), G.mul3(side, 10.9))].map((p) => at(p)), { size: 0.42 }), { name: `${id}.gearbox`, shapes: [record(A.disc(F, 13, 15, 7.4, { name: `${id}.gearbox`, owner: id })), record(A.disc(G.frameAlong(G.add3(pivot, G.mul3(side, 10.9)), axis), 13, 15, 5, { name: `${id}.gearbox`, owner: id })), record(A.orientedBox(G.add3(G.add3(pivot, G.mul3(axis, 14)), G.mul3(side, 5.45)), [side, SF.v, axis], [5.45, 5, 1], { name: `${id}.gearbox`, owner: id }))] });
  put("stand", G.add3(pivot, G.mul3(axis, 25)), S(G.lathe(barrel, F, P, { steps: 40 }), { tone: "hi", inner: Ln([21, 27, 32].map((s) => G.arcOf(F, s, 6.6, P)).join(""), { tone: "faint" }) }), { name: `${id}.barrel`, shapes: [record(A.body(F, barrel, { name: `${id}.barrel`, owner: id }))] });
  const MF = G.frameAlong(G.add3(pivot, G.mul3(side, 10.9)), axis);
  put("stand", G.pointOf(MF, 22, 0, 0), S(G.disc(15, 29, 4.2, MF, P), { tone: "mid" }) + Faded(G.ribsOf(MF, 15, 29, 4.2, 14, P, { fade: [0.1, 0.55] }), { tone: "lo" }), { bias: -0.5, name: `${id}.motor`, shapes: [record(A.disc(MF, 15, 29, 4.2, { name: `${id}.motor`, owner: id }))] });
  const rodEnd = span - Math.sqrt(LUG_BALL ** 2 - 2.1 ** 2);
  put("stand", G.add3(pivot, G.mul3(axis, (39 + rodEnd) / 2)), S(G.disc(39, rodEnd, 2.1, F, P), { tone: "hi" }), { name: `${id}.rod`, shapes: [record(A.disc(F, 39, rodEnd, 2.1, { name: `${id}.rod`, owner: id }))] });
  ballAt("stand", lug, LUG_BALL, { name: `${id}.eye`, owner: id });
}

const BEAM_HALF = 14;
const along = G.unit3([1, -1, 0]);
const across = G.unit3([1, 1, 0]);
const beamEnd = 196;
const beamRing = [
  G.add3(G.mul3(along, -beamEnd), G.mul3(across, -BEAM_HALF)),
  G.add3(G.mul3(along, beamEnd), G.mul3(across, -BEAM_HALF)),
  G.add3(G.mul3(along, beamEnd), G.mul3(across, BEAM_HALF)),
  G.add3(G.mul3(along, -beamEnd), G.mul3(across, BEAM_HALF)),
].map(([x, y]) => [x, y]);
const beamTop = BEAM_Z + BEAM_H;
const beamLine = (offset, z) => k.onTop([G.add3(G.mul3(along, -beamEnd), G.mul3(across, offset)), G.add3(G.mul3(along, beamEnd), G.mul3(across, offset))].map(([x, y]) => [x, y]), z, P);
const beamBolts = [];
for (let t = -176; t <= 176; t += 32) for (const side of [-1, 1]) beamBolts.push(at([...G.add3(G.mul3(along, t), G.mul3(across, side * 8.5)).slice(0, 2), beamTop]));
const beamFace = [];
for (let t = -168; t <= 168; t += 56) {
  const p = G.add3(G.mul3(along, t), G.mul3(across, BEAM_HALF));
  beamFace.push(k.segment([p[0], p[1], BEAM_Z], [p[0], p[1], beamTop], P));
}
// The cell came 1.8 short, so it stands on three washers that were near enough.
const CELL = Z_EXIT + TOP + (B.on("washers") ? 1.8 : 0);
if (B.on("washers")) {
  [[1.3, -0.9, "lo"], [-1.1, 0.8, "mid"], [0.4, 1.4, "lo"]].forEach(([dx, dy, tone], index) => {
    const z = Z_EXIT + TOP + index * 0.6;
    const name = B.name("washers", `washer${index}`);
    put("stand", [dx, dy, z + 0.3], S(k.cylinder(dx, dy, 14, z, 0.6, P, 48), { tone }), { bias: 50, name, shapes: [record(A.cylinder(dx, dy, 14, z, 0.6, { name }))] });
  });
}
put("stand", [0, 0, BEAM_Z - 13], S(k.cylinder(0, 0, 12.6, CELL, BEAM_Z - 8 - CELL, P, 40), { tone: "mid" }) + Ln(k.knurl(0, 0, 12.6, CELL + 4, CELL + 10, 40, P), { tone: "lo" }) + Ln(k.sideArc(0, 0, 12.6, CELL + 11.5, P, 24), { tone: "faint" }), { bias: 50, name: "stand.loadcell", shapes: [record(A.disc(DECKF, CELL, BEAM_Z - 8, 12.6, { name: "stand.loadcell" }))] });
put("stand", [0, 0, BEAM_Z - 4], S(k.cylinder(0, 0, 34, BEAM_Z - 8, 8, P, 72, 0.8), { tone: "mid" }) + Dots(G.dotsOf(DECKF, BEAM_Z, 29.5, 16, P, { fade: FADE }), { size: 0.4 }), { bias: 60, name: "stand.crosshead", shapes: [record(A.disc(DECKF, BEAM_Z - 8, BEAM_Z, 34, { name: "stand.crosshead" }))] });
const GLAND_DEG = AZIMUTH - 90;
const gland = [Math.cos(GLAND_DEG * DEG) * 12.6, Math.sin(GLAND_DEG * DEG) * 12.6, CELL + 7];
put("stand", gland, S(G.disc(0, 4, 2, G.frameAlong(gland, dir(GLAND_DEG)), P), { tone: "mid" }), { bias: 61, name: "stand.gland", shapes: [record(A.disc(G.frameAlong(gland, dir(GLAND_DEG)), 0, 4, 2, { name: "stand.gland" }))] });
tubeItems("stand", G.fillet([G.add3(gland, G.mul3(dir(GLAND_DEG), 4)), G.add3(gland, G.mul3(dir(GLAND_DEG), 11)), [...G.add3(gland, G.mul3(dir(GLAND_DEG), 11)).slice(0, 2), BEAM_Z - 8]], 4), 0.62, { name: "stand.loadcell-cable", tone: "mid", bias: 61, maxLength: 60, spacing: 1 });
if (B.on("fence-posts")) {
  // A timber beam, and a log on top of it because the beam sagged under the
  // engine. Rope lashes the two together over each post. Each lashing is a
  // slot of its own between lengths of beam (and of log): the rope there is
  // drawn as one solid round both, so nothing wraps round anything else.
  const LOG_R = 9;
  const LOG_END = beamEnd - 1.5;
  const reach = Math.hypot(COLUMN_AT[0][0], COLUMN_AT[0][1]);
  const ROPES = B.on("rope") ? [-1, 1].flatMap((sign) => [reach - 17.5, reach - 14, reach + 14, reach + 17.5].map((t) => sign * t)).sort((p, q) => p - q) : [];
  const HALF = 1.15;
  const cuts = (from, to) => {
    const out = [];
    let at = from;
    for (const t of ROPES) {
      if (t - HALF > at && t + HALF < to) {
        out.push([at, t - HALF]);
        at = t + HALF;
      }
    }
    out.push([at, to]);
    return out;
  };
  const BF = { o: [0, 0, BEAM_Z + BEAM_H / 2], a: along, u: across, v: [0, 0, 1] };
  const box = [[-BEAM_HALF, -BEAM_H / 2], [BEAM_HALF, -BEAM_H / 2], [BEAM_HALF, BEAM_H / 2], [-BEAM_HALF, BEAM_H / 2]];
  const grainAlong = (t0, t1, offset, z, amp, phase) => pathOf(wavy([...G.add3(G.mul3(along, t0), G.mul3(across, offset)).slice(0, 2), z], [...G.add3(G.mul3(along, t1), G.mul3(across, offset)).slice(0, 2), z], across, amp * Math.min(1, (t1 - t0) / 80), phase, Math.max(2, Math.round((t1 - t0) / 14))));
  const faceAlong = (t0, t1, z, amp, phase) => pathOf(wavy([...G.add3(G.mul3(along, t0), G.mul3(across, BEAM_HALF)).slice(0, 2), z], [...G.add3(G.mul3(along, t1), G.mul3(across, BEAM_HALF)).slice(0, 2), z], [0, 0, 1], amp * Math.min(1, (t1 - t0) / 80), phase, Math.max(2, Math.round((t1 - t0) / 14))));
  const beamShapes = [];
  for (const [t0, t1] of cuts(-beamEnd, beamEnd)) {
    const name = B.name("fence-posts", "beam");
    const shape = record(A.prism(BF, box, t0, t1, { name, owner: "stand.beam" }));
    beamShapes.push(shape);
    const nails = [];
    for (const t of [-40, -20, 20, 40].filter((t) => t > t0 + 2 && t < t1 - 2)) for (const side of [-1, 1]) nails.push(at([...G.add3(G.mul3(along, t), G.mul3(across, side * 8)).slice(0, 2), beamTop]));
    const knotHere = 92 > t0 + 6 && 92 < t1 - 6 ? Ln(pathOf(knot([...G.add3(G.mul3(along, 92), G.mul3(across, BEAM_HALF)).slice(0, 2), BEAM_Z + 14], along, [0, 0, 1], 3.6, 2.2), true), { tone: "lo" }) : "";
    const lines = t1 - t0 > 8 ? Ln(grainAlong(t0 + 2, t1 - 2, -11, beamTop, 1.2, t0) + faceAlong(t0 + 2, t1 - 2, BEAM_Z + 9, 1.4, t0 * 0.3) + faceAlong(t0 + 2, t1 - 2, BEAM_Z + 19, 1.2, t1 * 0.2), { tone: "faint", free: true }) : "";
    put("stand", G.add3(BF.o, G.mul3(along, (t0 + t1) / 2)), S(G.prismOf(BF, box, t0, t1, P), { tone: "mid" }) + lines + knotHere + Dots(nails, { size: 0.5 }), { bias: 200, name, shapes: [shape] });
  }
  const LF = { o: [0, 0, beamTop + LOG_R], a: along, u: across, v: [0, 0, 1] };
  const logShapes = [];
  if (B.on("sticks")) {
    const ridge = (t0, t1, phi, phase) => pathOf(wavy(G.add3(LF.o, G.add3(G.mul3(along, t0), G.add3(G.mul3(across, LOG_R * Math.sin(phi)), [0, 0, LOG_R * Math.cos(phi)]))), G.add3(LF.o, G.add3(G.mul3(along, t1), G.add3(G.mul3(across, LOG_R * Math.sin(phi)), [0, 0, LOG_R * Math.cos(phi)]))), along, 0, phase, 2));
    const endRings = (t, r) => pathOf(Array.from({ length: 25 }, (_, i) => G.add3(LF.o, G.add3(G.mul3(along, t), G.add3(G.mul3(across, r * Math.cos((i / 24) * 2 * Math.PI)), [0, 0, r * Math.sin((i / 24) * 2 * Math.PI)])))));
    const LFF = G.frameAlong(LF.o, along);
    const sign = G.dot3(LFF.a, along) > 0 ? 1 : -1;
    for (const [t0, t1] of cuts(-LOG_END, LOG_END)) {
      const name = B.name("sticks", "beam-log");
      const shape = record(A.disc(LF, t0, t1, LOG_R, { name, owner: "stand.beam" }));
      logShapes.push(shape);
      const ends = t1 === LOG_END ? Ln(endRings(LOG_END, 3) + endRings(LOG_END, 6), { tone: "faint" }) : "";
      put("stand", G.add3(LF.o, G.mul3(along, (t0 + t1) / 2)), S(G.disc(Math.min(sign * t0, sign * t1), Math.max(sign * t0, sign * t1), LOG_R, LFF, P, { bevel: t1 === LOG_END || t0 === -LOG_END ? 0.6 : 0 }), { tone: "mid" }) + (t1 - t0 > 8 ? Ln([0.2, 0.9, 1.5].map((phi, i) => ridge(t0 + 1, t1 - 1, phi, i)).join(""), { tone: "lo", free: true }) : "") + ends, { bias: 202, name, shapes: [shape] });
    }
  }
  for (const t of ROPES) {
    const lash = logShapes.length ? [[-BEAM_HALF - 0.9, -BEAM_H / 2 - 0.9], [BEAM_HALF + 0.9, -BEAM_H / 2 - 0.9], [BEAM_HALF + 0.9, BEAM_H / 2 + 0.9], ...Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI; return [(LOG_R + 0.9) * Math.cos(a), BEAM_H / 2 + LOG_R + (LOG_R + 0.9) * Math.sin(a)]; }), [-BEAM_HALF - 0.9, BEAM_H / 2 + 0.9]] : box.map(([u, v]) => [u + Math.sign(u) * 0.9, v + Math.sign(v) * 0.9]);
    const name = B.name("rope", "lashing");
    put("stand", G.add3(BF.o, G.mul3(along, t)), S(G.prismOf(BF, lash, t - HALF, t + HALF, P), { tone: "hi" }), { bias: 203, name, shapes: [record(A.prism(BF, lash, t - HALF, t + HALF, { name, owner: "stand.beam" }))] });
  }
} else put("stand", [0, 0, BEAM_Z + BEAM_H / 2], S(k.extrude(beamRing, BEAM_Z, BEAM_H, P, { bevel: 0.9 }), { tone: "mid" }) + Ln(beamLine(-BEAM_HALF + 5, beamTop) + beamLine(BEAM_HALF - 5, beamTop), { tone: "lo" }) + Ln(beamFace.join(""), { tone: "faint" }) + Dots(beamBolts, { size: 0.45 }), { bias: 200, name: "stand.beam", shapes: [record(A.orientedBox([0, 0, BEAM_Z + BEAM_H / 2], [along, across, [0, 0, 1]], [beamEnd, BEAM_HALF, BEAM_H / 2], { name: "stand.beam" }))] });


PIECES.plumbing.say = `plumbing · ${senses.length} sense lines into a block · ${LINES.length - senses.length} feed, purge and igniter lines`;
PIECES.controller.say = `engine controller · ${CABLES.filter((entry) => entry.piece === "controller").length} cables`;

const CROWD_OK = [["plumbing.lox-to-frpb", "controller.cable-block"], ["plumbing.lox-to-frpb", "controller.harness-frpb"]];
// Where each piece lands when the tape lets go, as an offset from where it
// hangs. It lands upright on its lowest point; the page then tips it over,
// toward the front where there is room: the chamber onto the front boards, the
// pump onto the chamber, the downcomer along the left behind the bell. The
// audit sees each piece where it lands, before it tips.
const LAND = { nozzle: [0, 0], chamber: [-17, 109], ftp: [43, -35], downcomer: [-153.5, -48] };
const TIP = { nozzle: null, chamber: { dir: [1, 0], frac: 1 }, ftp: { dir: [0, 1], frac: 0.55 }, downcomer: { dir: [0, 1], frac: 0.8 } };
const ridersOf = (id) => [...R.solids, ...R.tubes].filter((shape) => shape.move === PIECES[id].move && (shape.ride ?? shape.piece));
for (const id of FALL) {
  const low = Math.min(...ridersOf(id).map((shape) => A.boundsOf(shape).min[2]));
  const move = PIECES[id].move;
  [move[0], move[1], move[2]] = [LAND[id][0], LAND[id][1], 0.06 - low];
}
// Each falling body's box where it hangs, so the page can find its middle, its
// foot and the rim it tips over.
const BODIES = Object.fromEntries(FALL.map((id) => {
  const boxes = ridersOf(id).map((shape) => A.boundsOf(shape));
  return [id, { min: [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.min[i]))), max: [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i]))), tip: TIP[id] }];
}));
// The page moves a piece only between home and landed, so the depth order has
// to hold at rest, all down, and each moment in between when the first few
// are down and the rest still hang.
const COLLAPSE_STATES = [0, 1, ...FALL.slice(0, -1).map((_, index) => ({ label: `${FALL.slice(0, index + 1).join(", ")} down`, shares: Object.fromEntries(FALL.map((id, j) => [id, j <= index ? 1 : 0])) }))];
if (process.argv.includes("--bounds")) {
  const by = {};
  for (const sh of [...R.solids, ...R.tubes]) { const b0 = A.boundsOf(sh); const m = sh.move ?? [0, 0, 0]; const b = { min: b0.min.map((v, i) => v + m[i]), max: b0.max.map((v, i) => v + m[i]) }; const id = (sh.ride ?? sh.piece) || "?"; const e = (by[id] ??= { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }); for (let i = 0; i < 3; i++) { e.min[i] = Math.min(e.min[i], b.min[i]); e.max[i] = Math.max(e.max[i], b.max[i]); } }
  for (const [id, e] of Object.entries(by)) console.log(id.padEnd(11), e.min.map((v) => v.toFixed(0).padStart(5)).join(" "), " ..", e.max.map((v) => v.toFixed(0).padStart(5)).join(" "));
  console.log("V", V.map((v) => v.toFixed(3)).join(" "));
  process.exit(0);
}
A.settle(R, P, { states: COLLAPSE_STATES });
items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}"${item.ride !== item.piece ? ` data-ride="${item.ride}"` : ""}${item.tag ? ` data-b="${item.tag}"` : ""} data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL_TEXT = HONEST
  ? "SpaceX Raptor 2 hanging from a steel vertical test stand: a deck on feet with a flame cone and a deluge ring, two columns and a crosshead with a load cell. Below the gimbal sit the oxygen turbopump, the oxygen-rich preburner, the injector and main chamber and the bell nozzle; the methane turbopump hangs on the right."
  : "SpaceX Raptor 2 hung from a test stand built by Anatoly out of junk: two fence posts on breeze blocks, scabbed together halfway up with offcuts and braced with sticks, a timber beam lashed on with rope, a deck of scaffold boards on bricks, one shimmed with a folded invoice. The nozzle has no bolts and is held to the chamber with blue tape; the bell has a crack taped over; a cork stops one manifold port; the methane feed is two short lengths taped together on three reducers; the deluge ring is fed by a garden hose.";

const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: back, className: "rp-back" });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg rp-front" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="rp-engine">${groups.join("")}</g></svg>`;

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};

// The failure script. One control, Ignite, and one way it goes: it lights,
// it runs for as long as the tape's stretch takes up, the tape lets go and the
// engine comes down in pieces. The honest machine just runs.
const TITLE = "Raptor 2 · test stand";
const SEED = AN.hashSeed(`${TITLE}:ignite:5`);
const TABLE = HONEST ? [{ id: "works" }] : [{ id: "falls-apart" }];
const PHASES = {
  works: [{ name: "works", dur: 5.2 }, { name: "settles", dur: 1.4 }],
  "falls-apart": [{ name: "works", dur: 1.25 + MODEL.holds }, { name: "strains", dur: 0.8 }, { name: "beat", dur: 0.3 }, { name: "gives", dur: 1.6 }, { name: "settles", dur: 1.0 }],
};
console.log("ignite outcomes:", AN.outcomesOf(SEED, 12, TABLE).join(" "));
const JOB = String(AN.hashSeed(TITLE) % 10000).padStart(4, "0");

const DATA = {
  W,
  H,
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  camera: glCamera(P),
  exit: at([0, 0, Z_EXIT]),
  zExit: Z_EXIT,
  exitR: 64.6,
  coneTip: CONE_TIP,
  plumeLength: Z_EXIT - CONE_TIP,
  chamberBar: CHAMBER_BAR,
  vacuumTf: SEA_LEVEL_TF + BACK_TF,
  backTf: BACK_TF,
  columns: COLUMN_AT,
  columnHalf: COLUMN / 2 + 0.4,
  columnTop: BEAM_Z + BEAM_H,
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say }])),
  order: ["gimbal", "otp", "orpb", "lox", "controller", "chamber", "hotgas", "ftp", "downcomer", "plumbing", "nozzle"],
  honest: HONEST,
  model: MODEL,
  seed: SEED,
  table: TABLE,
  phases: PHASES,
  // The fall: which pieces, in what order after the give, and how hard the
  // floor pulls (cm/s², a little more than real so it reads at this size).
  fall: { order: FALL, delay: [0, 0.16, 0.27, 0.38], g: 1500, sag: 2.6, bodies: BODIES },
  joint: [0, 0, Z_EXIT + 120],
  fixSeconds: 1.2,
  maxRepairs: HERO.levels - 1,
};

const PARTS = DATA.order.map((id, index) => `<button type="button" class="rp-part" data-part="${id}"><span class="rp-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Job ${JOB}</span><span class="iso-plate-corner" data-corner="title">${TITLE}</span><span class="iso-plate-corner" data-corner="readout" data-readout>1,630 kg · cold</span></div>`;
const controls = `<div class="rp-controls"><button type="button" class="rp-fire" data-fire><span class="rp-lamp" aria-hidden="true"></span><span data-fire-label>Ignite</span></button><button type="button" class="rp-fix" data-fix>call Anatoly to fix it</button><span class="rp-hint">press ignite. stand back.</span><span class="rp-live" aria-live="polite" data-live></span></div>`;
const glowSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg rp-glow" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="rp-glow-g"><path class="rp-rim rp-rim-soft" d="${LIP}"/><path class="rp-rim" d="${LIP}"/></g></svg>`;
const stage = `<div class="rp-stage" tabindex="0" role="slider" aria-label="${HONEST ? "Raptor 2 on a steel test stand." : "Raptor 2 on a test stand built from fence posts, rope and sticks, its nozzle taped on."} Press I, Enter or Space to ignite it, R to call Anatoly when it falls apart, the arrow keys or hover to name the parts, Escape to stop." aria-valuemin="0" aria-valuemax="${DATA.order.length}" aria-valuenow="0" aria-valuetext="Assembled, cold">${backSvg}<canvas class="rp-plume" aria-hidden="true"></canvas>${frontSvg}${glowSvg}<canvas class="rp-veil" aria-hidden="true"></canvas><div class="rp-flash" aria-hidden="true"></div></div>`;
const caption = HONEST
  ? "Raptor 2 as designed: every flange bolted, every port blanked, a steel stand on proper feet."
  : "Hung it off the fence posts, ran the lines. No bolts for the nozzle, so tape, lots. Bell had a crack, taped. Cork's temporary. Stand back when you light it. — A.";
const body = `<figure class="iso-figure rp"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="rp-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "raptor.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Raptor 2, installed by Anatoly", theme: THEME, body: `<style>${CSS}${anatolyCss()}</style>${body}`, script: glScript() + anatolyScript() + LIVE, width: 980 });
const name = `raptor-anatoly${HONEST ? "-honest" : ""}${BROKEN ? `-broken-${BROKEN}` : ""}${THEME === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`);

// Mid-air is filmed, not audited (the fall is a curve, not a straight move):
// the audit checks every pose a piece rests in, at home or on the planks.
A.auditOrExit(R, P, { ...(HONEST ? { crowd: CROWD_OK } : B.auditOptions({ crowd: CROWD_OK })), frames: COLLAPSE_STATES.slice(1) });
