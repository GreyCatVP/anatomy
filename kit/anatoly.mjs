// Anatoly's additions to the Anatomy kit. Pure functions, no imports, so the
// same file runs in a Node build script and, through scripts/inline-anatoly.mjs,
// inside the page. Names are chosen not to collide with Anatomy's kit
// (smooth, burst, settle, follow, spring).

export const KINDS = ["wrong-part", "missing", "improvised", "misaligned", "worn", "overkill", "temporary"];

export const BUDGET = { figure: [5, 9], hero: [10, 18], epic: [16, 40] };

// ---------------------------------------------------------------------------
// Determinism. Every bodge and every outcome comes from a seed, so the same
// build always makes the same mess and the audit can enumerate it.

export function hashSeed(value) {
  const text = String(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function bodgeRng(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Geometry. World units as in Anatomy: x, y on the floor, z up.

const DEG = Math.PI / 180;

function centroid(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}

// Turn floor points about z by `deg` (counter-clockwise seen from above) round
// `about` (default: their centroid). Feed the result to k.extrude for a crooked
// plate or bracket, or to k.onTop for rule lines that follow it. Extra
// coordinates (a z, an opacity) are carried through unchanged.
export function yawRing(points, deg, about) {
  const [cx, cy] = about ?? centroid(points);
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return points.map((p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c, ...p.slice(2)];
  });
}

// A unit axis tilted `deg` from straight up, leaning toward the floor direction
// `toward`. Pass it to G.frameAlong(base, axis) for a leaning post (G.disc) or
// a leaning box (G.prismOf), and record the same frame for the audit.
export function leanAxis(deg, toward = [1, 0]) {
  const len = Math.hypot(toward[0], toward[1]);
  if (!len) throw new Error("leanAxis: toward must be a floor direction, not [0, 0]");
  const ux = toward[0] / len;
  const uy = toward[1] / len;
  const s = Math.sin(deg * DEG);
  return [ux * s, uy * s, Math.cos(deg * DEG)];
}

// The top of a part of `length` that stands on `base` and leans `deg` toward
// `toward`: where the next thing mounts on it.
export function leanTip(base, length, deg, toward = [1, 0]) {
  const a = leanAxis(deg, toward);
  return [base[0] + a[0] * length, base[1] + a[1] * length, base[2] + a[2] * length];
}

// A cable or hose hung between two mounts that sags `depth` units at its
// middle (a parabola, close enough to a catenary for a slack line). Both ends
// stay exactly on `a` and `b`. Record it with R.route(..., { limp: true }).
export function sagRoute(a, b, depth, { steps = 12 } = {}) {
  if (steps < 2) throw new Error("sagRoute: steps must be at least 2");
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t - depth * 4 * t * (1 - t),
    ]);
  }
  return out;
}

// Wire bent by hand: the interior waypoints of a route move up to `amount`
// units, deterministically from `seed`; the two ends stay on their mounts.
// Fillet the result (G.fillet) before drawing. This is the only place a
// random offset belongs: never jitter solids.
export function handBent(points, amount, seed = "wire") {
  const rand = bodgeRng(seed);
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return [...p];
    return p.map((v) => v + (rand() * 2 - 1) * amount);
  });
}

// The meridian of a stack of reducers that gets from one pipe size to another
// through whatever Anatoly had in the van: `radii` is the pipe radius at each
// step, largest or smallest first. Each fitting is a collar (`lip` proud of its
// pipe, `body` long) followed by a chamfered taper (`taper` long) to the next
// size. `s` rises strictly, so G.solidOf and A.solid take it as it is.
export function adapterProfile(radii, { body = 4, taper = 1.5, lip = 0.8, chamfer = 0.3 } = {}) {
  if (!Array.isArray(radii) || radii.length < 2) throw new Error("adapterProfile: give at least two radii");
  if (chamfer * 2 >= body) throw new Error("adapterProfile: chamfer must be less than half the body");
  const out = [];
  let s = 0;
  radii.forEach((r, i) => {
    const R = r + lip;
    out.push([s, r]);
    out.push([s + chamfer, R]);
    out.push([s + body - chamfer, R]);
    out.push([s + body, r]);
    s += body;
    if (i < radii.length - 1) {
      s += taper;
      out.push([s, radii[i + 1]]);
      s += chamfer;
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// The bodge ledger. Every defect is an entry with a reason. The build asks the
// ledger whether a bodge is on (`--honest` turns them all off), names its audit
// shapes after it, and takes the audit's exemptions from it, so an exemption
// that is not in the ledger cannot exist.

export function ledger(entries, { honest = false, size = "figure", failures = null } = {}) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const active = honest ? [] : entries.slice();

  function problems() {
    const out = [];
    const seen = new Set();
    for (const entry of entries) {
      if (!entry.id || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) out.push(`bad id ${JSON.stringify(entry.id)}: use kebab-case`);
      if (seen.has(entry.id)) out.push(`duplicate id ${entry.id}`);
      seen.add(entry.id);
      if (!KINDS.includes(entry.kind)) out.push(`${entry.id}: unknown kind ${JSON.stringify(entry.kind)} (one of ${KINDS.join(", ")})`);
      if (!entry.where || !String(entry.where).trim()) out.push(`${entry.id}: say where it is`);
      if (!entry.why || !String(entry.why).trim()) out.push(`${entry.id}: give Anatoly's reason (why)`);
      if (failures && entry.fails && !failures.includes(entry.fails)) out.push(`${entry.id}: fails ${JSON.stringify(entry.fails)} is not a failure in the script`);
    }
    const heroes = entries.filter((entry) => entry.hero);
    if (heroes.length !== 1) out.push(`exactly one hero bodge, found ${heroes.length}`);
    const range = BUDGET[size];
    if (!range) out.push(`unknown size ${JSON.stringify(size)} (one of ${Object.keys(BUDGET).join(", ")})`);
    else if (entries.length < range[0] || entries.length > range[1]) out.push(`a ${size} carries ${range[0]}–${range[1]} bodges, found ${entries.length}`);
    if (failures) {
      for (const failure of failures) {
        if (!entries.some((entry) => entry.fails === failure)) out.push(`failure ${failure} is not caused by any bodge`);
      }
    }
    return out;
  }

  function collect(key) {
    return active.flatMap((entry) => (entry.audit && entry.audit[key]) || []);
  }

  return {
    entries,
    active,
    honest,
    hero: entries.find((entry) => entry.hero) ?? null,
    on(id) {
      if (!byId.has(id)) throw new Error(`ledger: no bodge called ${id}`);
      return !honest;
    },
    name(id, part = "") {
      if (!byId.has(id)) throw new Error(`ledger: no bodge called ${id}`);
      return part ? `bodge.${id}.${part}` : `bodge.${id}`;
    },
    problems,
    assert() {
      const list = problems();
      if (list.length) throw new Error(`bodge ledger:\n  ${list.join("\n  ")}`);
      return this;
    },
    // Spread into A.auditOrExit(R, P, { ...B.auditOptions() }). Each entry
    // declares its own pairs and names: audit: { allow, crowd, cover }.
    auditOptions(extra = {}) {
      return {
        ...extra,
        allow: [...(extra.allow ?? []), ...collect("allow")],
        crowd: [...(extra.crowd ?? []), ...collect("crowd")],
        cover: [...(extra.cover ?? []), ...collect("cover")],
      };
    },
    report() {
      if (honest) return "honest build: no bodges";
      const width = Math.max(...entries.map((entry) => entry.id.length));
      return entries
        .map((entry) => `${entry.hero ? "*" : " "} ${entry.id.padEnd(width)}  ${entry.kind.padEnd(10)}  ${entry.where} — ${entry.why}`)
        .join("\n");
    },
  };
}

// ---------------------------------------------------------------------------
// Failure timing. A failure is a chain of phases with durations, played from
// one clock: works, strains, gives, settles. Everything that moves reads its
// phase and progress from here, so the build can sample it, the page can play
// it and the reset can play it backwards with no jump.

export function failureClock(phases) {
  if (!phases.length) throw new Error("failureClock: give at least one phase");
  const starts = [];
  let total = 0;
  for (const phase of phases) {
    if (!(phase.dur > 0)) throw new Error(`failureClock: phase ${phase.name} needs a positive dur`);
    starts.push(total);
    total += phase.dur;
  }
  return {
    phases,
    total,
    startOf(name) {
      const i = phases.findIndex((phase) => phase.name === name);
      if (i < 0) throw new Error(`failureClock: no phase ${name}`);
      return starts[i];
    },
    at(t) {
      if (t <= 0) return { phase: phases[0].name, index: 0, u: 0, done: false, t: 0 };
      if (t >= total) return { phase: phases[phases.length - 1].name, index: phases.length - 1, u: 1, done: true, t: total };
      let i = phases.length - 1;
      while (starts[i] > t) i--;
      return { phase: phases[i].name, index: i, u: (t - starts[i]) / phases[i].dur, done: false, t };
    },
  };
}

function rampUp(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// The shudder before something gives: a smoothstep attack over `rise`, an
// exponential decay with time constant `fall`, times a sine at `hz`. Zero
// before the event, never a pop. Use it as an offset in world units or degrees.
export function shakeAt(age, { amp = 1, hz = 9, rise = 0.06, fall = 0.35 } = {}) {
  if (age <= 0) return 0;
  const envelope = age < rise ? rampUp(0, rise, age) : Math.exp(-(age - rise) / fall);
  return amp * envelope * Math.sin(2 * Math.PI * hz * age);
}

// Gravity for a part that has let go: distance fallen after `age` seconds,
// stopped by a floor `drop` units below (with one small bounce of `bounce` of
// the impact height, 0 for none). `g` is in world units per s².
export function fallAt(age, drop, { g = 2400, bounce = 0.12 } = {}) {
  if (age <= 0) return 0;
  const tHit = Math.sqrt((2 * drop) / g);
  if (age <= tHit) return 0.5 * g * age * age;
  if (!bounce) return drop;
  const up = drop * bounce;
  const tUp = Math.sqrt((2 * up) / g);
  const after = age - tHit;
  if (after >= 2 * tUp) return drop;
  const v = g * tUp;
  const height = v * after - 0.5 * g * after * after;
  return drop - Math.max(0, height);
}

// A body that landed tilted on one rim and slaps flat, rocking rim to rim:
// its turn in degrees `age` seconds after it landed at `amp`, dying away.
// Pivot it on the rim on the side the turn leans it (`turnAbout`): the turn is
// zero when it changes sides, so the pivot can swap without a jump.
export function rockAt(age, amp, { hz = 2.5, decay = 5 } = {}) {
  if (age <= 0) return amp;
  return amp * Math.exp(-decay * age) * Math.cos(2 * Math.PI * hz * age);
}

// A body tipping over about a rim of its foot: from the turn it landed at to
// the turn it comes to rest at, faster and faster over `dur` like a falling
// post, then a small bounce back (`bounce` of the swing) that dies away.
export function tipAt(age, from, to, { dur = 0.3, bounce = 0.09, hz = 2.4, decay = 6 } = {}) {
  if (age <= 0) return from;
  if (age < dur) return from + (to - from) * (age / dur) ** 2;
  const after = age - dur;
  return to - (to - from) * bounce * Math.exp(-decay * after) * Math.abs(Math.sin(2 * Math.PI * hz * after));
}

// The turn on screen, in degrees, that lays an upright body along the floor
// direction `dir` ([x, y]), given the screen vectors of world x and y (`ex`,
// `ey`, screen y down, world z drawn straight up). A body of revolution drawn
// upright and turned this way is very nearly the drawing of it lying along
// `dir`, as long as `dir` points toward the viewer, so its near end shows.
export function layFlat(ex, ey, dir) {
  const d = [ex[0] * dir[0] + ey[0] * dir[1], ex[1] * dir[0] + ey[1] * dir[1]];
  return (Math.atan2(d[0], -d[1]) * 180) / Math.PI;
}

// The screen shift that makes a turn of `deg` about `centre` into the same
// turn about `pivot` (a rim on the floor, a hinge that hasn't torn yet). Draw
// with `translate(fall + shift) rotate(deg centre)`, centre in rest coordinates.
export function turnAbout(centre, deg, pivot) {
  const r = (deg * Math.PI) / 180;
  const vx = pivot[0] - centre[0];
  const vy = pivot[1] - centre[1];
  return [vx - (vx * Math.cos(r) - vy * Math.sin(r)), vy - (vx * Math.sin(r) + vy * Math.cos(r))];
}

// Which outcome the n-th use of a control gets, from a weighted table:
// [{ id, weight = 1, from = 0, until = Infinity }]. `from` keeps an outcome
// back until the n-th use (the first press works, mostly), `until` retires it.
// Deterministic in (seed, n), so the build and the audit can list every
// outcome a viewer can reach.
export function outcomeOf(seed, n, table) {
  const open = table.filter((row) => n >= (row.from ?? 0) && n <= (row.until ?? Infinity) && (row.weight ?? 1) > 0);
  if (!open.length) throw new Error(`outcomeOf: no outcome open at use ${n}`);
  const total = open.reduce((sum, row) => sum + (row.weight ?? 1), 0);
  let pick = bodgeRng(`${seed}:${n}`)() * total;
  for (const row of open) {
    pick -= row.weight ?? 1;
    if (pick < 0) return row;
  }
  return open[open.length - 1];
}

export function outcomesOf(seed, count, table) {
  return Array.from({ length: count }, (_, n) => outcomeOf(seed, n, table).id);
}

// How many extra repair layers Anatoly has added after `resets` resets, capped
// at `max`: each fix adds one more band of tape (prebuilt, revealed in order).
export function repairsAfter(resets, max) {
  return Math.max(0, Math.min(resets, max));
}
