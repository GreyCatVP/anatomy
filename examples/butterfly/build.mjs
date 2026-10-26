import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 680;
const HEIGHT = 440;

// Base Specimen Spreading Stage
const STAGE = { x: -130, y: -90, w: 260, d: 180, r: 8 };
const STAGE_H = 14;
const FOOT_H = 5;

// Camera Projection
const P = k.fitProjection(
  [
    ...k.boxCorners(STAGE, -STAGE_H - FOOT_H, 0),
    [-85, 85, 26],
    [85, -85, 26],
    [-52, -52, 44],
    [52, 52, 20],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 45, elevation: 32 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const W = (from, to, opts) => k.wireSvg(from, to, opts);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// Coordinate transformer: maps butterfly symmetry coordinates (S: lateral span, T: longitudinal body axis)
// S > 0 is right wing, S < 0 is left wing, S = 0 is body axis.
// T = -26 is head, T = 0 is thorax, T = +34 is abdomen tip.
const toWorld = (s, t, z = 16) => [t + s, t - s, z];
const atST = (s, t, z = 16) => at(toWorld(s, t, z));

// --- 1. Specimen Spreading Board & Dissection Stage ---
function stagePlate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(STAGE, -STAGE_H - FOOT_H, STAGE_H, P)}"/>`];

  // 4 corner brass leveling feet
  for (const [x, y] of byDepth(k.corners(STAGE, 22))) {
    out.push(S(k.cylinder(x, y, 7.5, -STAGE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.6, -STAGE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
  }

  // Main specimen stage slab (mahogany/slate block)
  out.push(S(k.slabOf(STAGE, -STAGE_H, STAGE_H, P, 8, 1.6), { tone: "mid" }));

  // Inset contour groove
  out.push(L(k.planOutline(k.insetPlan(STAGE, 5), 0, P), { tone: "faint" }));

  // 4 corner socket screws
  const screws = k.corners(STAGE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 18)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // Central entomological spreading groove along body axis (where insect body rests)
  const groove = { x: -8, y: -48, w: 16, d: 96, r: 2 };
  out.push(S(k.slabOf(groove, -1.8, 1.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(groove, 0, P), { tone: "faint" }));

  // Millimeter scale strip along front edge
  const ruler = { x: -108, y: STAGE.y + STAGE.d - 14, w: 216, d: 6, r: 1 };
  out.push(S(k.slabOf(ruler, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(ruler.x + 4, ruler.x + ruler.w - 4, 3, 5, ruler.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "faint" }), L(ticks.major, { tone: "mid" }));

  // Brass specimen plaque: "MORPHO PELEIDES · LEPIDOPTERA"
  const plaque = { x: -50, y: -74, w: 100, d: 8, r: 1.2 };
  out.push(S(k.slabOf(plaque, 0, 0.8, P, 3), { tone: "hi", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plaque, 1), 0.8, P), { tone: "faint" }));
  out.push(D([at([plaque.x + 3, plaque.y + plaque.d / 2, 0.8]), at([plaque.x + plaque.w - 3, plaque.y + plaque.d / 2, 0.8])], { size: 0.4 }));

  return out.join("");
}

// --- 2. The Butterfly Body (Head, Thorax, Abdomen, Pin) ---
function butterflyBody() {
  const out = [];

  // Central Entomological Pin (passes through mesothorax down into block)
  const pinPos = toWorld(0, -3, 0);
  out.push(S(k.cylinder(pinPos[0], pinPos[1], 1.2, 0, 38, P, 16), { tone: "lo" }));
  out.push(S(k.cylinder(pinPos[0], pinPos[1], 2.4, 38, 3.5, P, 20), { tone: "lit" })); // Brass pinhead
  out.push(D([at([pinPos[0], pinPos[1], 41.5])], { size: 0.5 }));

  // A. Thorax (3 segments: prothorax, mesothorax, metathorax)
  // Mesothorax (largest flight muscle segment)
  const meso = toWorld(0, -2, 12);
  out.push(S(k.cylinder(meso[0], meso[1], 5.8, 8, 8, P, 28), { tone: "mid" }));
  out.push(L(k.ring(meso[0], meso[1], 5.8, 12, P, 24), { tone: "faint" }));
  out.push(D([at([meso[0] - 2.5, meso[1] - 2.5, 16]), at([meso[0] + 2.5, meso[1] + 2.5, 16])], { size: 0.4 }));

  // Wing hinge articular sclerites (lateral brass/chitin bosses)
  for (const s of [-5.6, 5.6]) {
    const hinge = toWorld(s, -3, 14);
    out.push(S(k.cylinder(hinge[0], hinge[1], 1.8, 12, 3, P, 16), { tone: "hi" }));
    out.push(D([at([hinge[0], hinge[1], 15])], { size: 0.35 }));
  }

  // Prothorax (anterior collar)
  const pro = toWorld(0, -10, 11);
  out.push(S(k.cylinder(pro[0], pro[1], 4.4, 8, 6, P, 24), { tone: "mid" }));

  // Metathorax (posterior segment)
  const meta = toWorld(0, 5, 11);
  out.push(S(k.cylinder(meta[0], meta[1], 4.8, 7, 6, P, 24), { tone: "mid" }));
  out.push(L(k.ring(meta[0], meta[1], 4.8, 10, P, 24), { tone: "faint" }));

  // B. Head (Caput)
  const headPos = toWorld(0, -17, 12);
  out.push(S(k.cylinder(headPos[0], headPos[1], 3.8, 9, 5, P, 24), { tone: "mid" }));
  out.push(D([at([headPos[0], headPos[1], 14])], { size: 0.4 }));

  // Compound Eyes (Left & Right faceted hemispheres)
  for (const s of [-3.4, 3.4]) {
    const eye = toWorld(s, -18, 13);
    out.push(S(k.cylinder(eye[0], eye[1], 2.2, 10, 4, P, 18), { tone: "hi" }));
    out.push(L(k.ring(eye[0], eye[1], 2.2, 12, P, 16), { tone: "faint" }));
    out.push(D([at([eye[0], eye[1], 14])], { size: 0.45 }));
  }

  // Antennae (Two slender arching feelers with terminal clavate clubs)
  for (const s of [-1, 1]) {
    const antFrom = atST(s * 2, -19, 14);
    const antVia1 = atST(s * 8, -26, 17);
    const antVia2 = atST(s * 15, -34, 19);
    const antTo = atST(s * 20, -40, 20);
    out.push(W(antFrom, antTo, { via: [antVia1, antVia2], tone: "hi", size: 0.8 }));
    // Clavate club tip
    const club = toWorld(s * 20, -40, 20);
    out.push(S(k.cylinder(club[0], club[1], 1.2, 19, 2.4, P, 12), { tone: "lit" }));
  }

  // Coiled Proboscis (Haustellum spring spiral beneath head)
  const probBase = toWorld(0, -21, 11);
  out.push(S(k.cylinder(probBase[0], probBase[1], 1.4, 7, 4, P, 14), { tone: "mid" }));
  const probP1 = atST(0, -22, 10);
  const probP2 = atST(0, -24, 8);
  const probP3 = atST(0, -26, 6);
  const probP4 = atST(0, -25, 4);
  out.push(W(probP1, probP4, { via: [probP2, probP3], tone: "hi", size: 0.65 }));

  // C. Abdomen (8 distinct tapering segments)
  const segs = [
    { t: 10, r: 4.2, h: 4 },
    { t: 14, r: 3.9, h: 4 },
    { t: 18, r: 3.5, h: 4 },
    { t: 22, r: 3.1, h: 4 },
    { t: 26, r: 2.7, h: 3.8 },
    { t: 30, r: 2.2, h: 3.6 },
    { t: 34, r: 1.8, h: 3.4 },
    { t: 38, r: 1.2, h: 3.0 },
  ];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const pos = toWorld(0, seg.t, 10);
    out.push(S(k.cylinder(pos[0], pos[1], seg.r, 5, seg.h, P, 22), { tone: i % 2 === 0 ? "mid" : "lo" }));
    out.push(L(k.ring(pos[0], pos[1], seg.r, 5 + seg.h / 2, P, 20), { tone: "faint" }));
    // Lateral spiracles (breathing pores)
    for (const s of [-seg.r * 0.7, seg.r * 0.7]) {
      const spir = toWorld(s, seg.t, 7);
      out.push(D([at(spir)], { size: 0.28 }));
    }
  }

  return out.join("");
}

// --- 3. Butterfly Wings (Forewings, Hindwings, Venation & Cells) ---
function butterflyWings() {
  const out = [];

  // Wing geometry defined in (S: lateral span, T: longitudinal body axis)
  // S > 0 is right, S < 0 is left. Dihedral elevation tilt: Z increases slightly toward apex.

  // Helper to generate an SVG path from an array of [S, T] points at elevation Z
  const wingPath = (pts, sSign, zBase = 15) => {
    const flat = pts.map(([s, t]) => {
      const actualS = s * sSign;
      const actualZ = zBase + Math.abs(actualS) * 0.08;
      return atST(actualS, t, actualZ);
    });
    return flat.map(([x, y], idx) => `${idx ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + "Z";
  };

  const wingLine = (pts, sSign, zBase = 15.2) => {
    const flat = pts.map(([s, t]) => {
      const actualS = s * sSign;
      const actualZ = zBase + Math.abs(actualS) * 0.08;
      return atST(actualS, t, actualZ);
    });
    return flat.map(([x, y], idx) => `${idx ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  };

  // Wing contours (Right wing templates; Left wing is mirror inverted with sSign = -1)
  const forewingOutline = [
    [5, -8], // Hinge base
    [24, -20],
    [48, -29],
    [72, -32],
    [86, -26], // Wing Apex
    [82, -14],
    [76, -2],
    [70, 8],
    [64, 15], // Tornus
    [45, 12],
    [26, 8],
    [6, 3], // Dorsum base
  ];

  // Forewing Discal Cell (central closed cell)
  const discalCell = [
    [7, -6],
    [25, -14],
    [42, -18],
    [46, -11],
    [38, -4],
    [22, -1],
    [7, -2],
  ];

  // Hindwing Outline
  const hindwingOutline = [
    [5, 4], // Hinge base
    [28, 8],
    [52, 14],
    [62, 18], // Humeral angle
    [60, 30],
    [54, 42],
    [44, 50], // Anal angle
    [32, 48],
    [20, 42],
    [10, 32],
    [5, 18], // Inner margin
  ];

  // Hindwing Discal Cell
  const hindDiscal = [
    [6, 6],
    [24, 12],
    [36, 18],
    [34, 25],
    [22, 24],
    [6, 14],
  ];

  // Draw both Left (sSign = -1) and Right (sSign = +1) wings
  for (const sSign of [-1, 1]) {
    const side = sSign === 1 ? "right" : "left";

    // --- A. Hindwings (painted below forewings in depth order) ---
    const hwPath = wingPath(hindwingOutline, sSign, 14.5);
    out.push(`<path class="iso-solid" data-tone="mid" data-part="hindwing-${side}" d="${hwPath}"/>`);
    out.push(L(hwPath, { tone: "mid" }));

    // Hindwing Discal Cell solid
    const hwdPath = wingPath(hindDiscal, sSign, 14.7);
    out.push(`<path class="iso-solid" data-tone="hi" d="${hwdPath}"/>`);
    out.push(L(hwdPath, { tone: "hi" }));

    // Hindwing Venation Lines
    const hwVeins = [
      [[36, 18], [52, 22], [60, 30]], // Radial branch
      [[35, 22], [48, 34], [54, 42]], // Medial branch
      [[34, 25], [40, 42], [44, 50]], // Cubital branch
      [[22, 24], [28, 38], [32, 48]], // Anal vein 1A
      [[6, 14], [14, 30], [20, 42]],  // Anal vein 2A
      [[6, 6], [28, 8], [52, 14]],    // Subcostal margin vein
    ];
    for (const v of hwVeins) {
      out.push(L(wingLine(v, sSign, 14.8), { tone: "lo", free: "both" }));
    }
    // Marginal scalloped trim
    out.push(L(wingLine([[62, 18], [60, 30], [54, 42], [44, 50], [32, 48]], sSign, 14.8), { tone: "mid", free: "both" }));

    // --- B. Forewings (painted over hindwings) ---
    const fwPath = wingPath(forewingOutline, sSign, 15.2);
    out.push(`<path class="iso-solid" data-tone="mid" data-part="forewing-${side}" d="${fwPath}"/>`);
    out.push(L(fwPath, { tone: "mid" }));

    // Forewing Discal Cell solid
    const fwdPath = wingPath(discalCell, sSign, 15.4);
    out.push(`<path class="iso-solid" data-tone="hi" data-part="discal-${side}" d="${fwdPath}"/>`);
    out.push(L(fwdPath, { tone: "hi" }));
    // Forewing Venation System (Subcosta, Radius, Media, Cubitus, Anal)
    const fwVeins = [
      // Subcosta (Sc) running parallel to costal margin
      [[7, -6], [28, -17], [52, -26], [74, -28]],
      // Radial Branches (R1-R5) radiating to apex
      [[42, -18], [60, -25], [86, -26]],
      [[44, -15], [68, -20], [82, -14]],
      // Medial Branches (M1-M3) to outer termen
      [[46, -11], [66, -9], [76, -2]],
      [[42, -7], [62, 0], [70, 8]],
      // Cubital Branches (CuA1-CuA2) to tornus
      [[38, -4], [54, 7], [64, 15]],
      // Anal Vein (1A+2A) along inner margin
      [[7, -2], [24, 3], [44, 8], [64, 15]],
    ];
    for (const v of fwVeins) {
      out.push(L(wingLine(v, sSign, 15.5), { tone: "lo", free: "both" }));
    }
    // Outer margin scalloped fringe line
    const fringe = [
      [86, -26],
      [82, -14],
      [76, -2],
      [70, 8],
      [64, 15],
    ];
    out.push(L(wingLine(fringe, sSign, 15.6), { tone: "hi", free: "both" }));
    // Structural scale dots along subcostal vein
    const scaleDots = [
      atST(sSign * 24, -20, 15.5),
      atST(sSign * 48, -29, 15.5),
      atST(sSign * 72, -32, 15.5),
    ];
    out.push(D(scaleDots, { size: 0.45 }));
  }

  return out.join("");
}

// --- 4. Numbered Anatomical Specimen Callout Pins (Labels 1 to 8) ---
// Each pin has:
// - A slender pin shaft
// - A circular numbered badge
// - Interactive hover data that displays detailed anatomical functions in the readout
const LABELS = [
  {
    id: 1,
    name: "Forewing (Ala anterior)",
    pos: [52, -18, 22],
    desc: "Primary aerodynamic lift airfoil · Structural radial venation and chitinous costal margin",
  },
  {
    id: 2,
    name: "Hindwing (Ala posterior)",
    pos: [42, 32, 20],
    desc: "Secondary steering & yaw control · Anal fold and scalloped margin",
  },
  {
    id: 3,
    name: "Discal Cell (Cellula discalis)",
    pos: [25, -10, 19],
    desc: "Closed central wing chamber · Structural distributor for hemolymph fluid and tracheae",
  },
  {
    id: 4,
    name: "Mesothorax & Wing Hinge",
    pos: [0, -2, 22],
    desc: "Flight muscle motor box · Articular sclerites providing vertical flap and rotation",
  },
  {
    id: 5,
    name: "Segmented Abdomen (Abdomen)",
    pos: [0, 24, 18],
    desc: "8 articulated cylindrical segments · Lateral spiracles for respiration and visceral organs",
  },
  {
    id: 6,
    name: "Compound Eye (Oculus compositus)",
    pos: [-8, -20, 20],
    desc: "Hemispherical ommatidial array · 12,000 hexagonal optical facets for panoramic polarized vision",
  },
  {
    id: 7,
    name: "Clavate Antenna (Antenna)",
    pos: [-22, -38, 24],
    desc: "Segmented chemosensory feeler · Terminal clavate club packed with olfactory receptors",
  },
  {
    id: 8,
    name: "Coiled Proboscis (Haustellum)",
    pos: [0, -26, 14],
    desc: "Interlocking galeal suction tube · Coils tightly beneath head via hydraulic muscle tension",
  },
];

function specimenPins() {
  const out = [];

  for (const lb of LABELS) {
    const target = toWorld(lb.pos[0], lb.pos[1], lb.pos[2]);
    const pTarget = at(target);
    const pinTop = [target[0], target[1], target[2] + 12];
    const pTop = at(pinTop);

    // Slender specimen pin shaft
    out.push(S(k.cylinder(target[0], target[1], 0.7, target[2], 12, P, 12), { tone: "lo" }));

    // Circular numbered badge disc
    out.push(S(k.cylinder(target[0], target[1], 3.8, target[2] + 11.5, 1.2, P, 20), { tone: "lit" }));
    out.push(D([pTop], { size: 0.5 }));

    // Interactive callout badge group
    out.push(`
      <g class="iso-callout" data-label-id="${lb.id}" data-name="${lb.name}" data-desc="${lb.desc}" style="cursor:pointer">
        <circle cx="${pTop[0].toFixed(1)}" cy="${pTop[1].toFixed(1)}" r="6" fill="transparent"/>
        <text class="iso-face-text" data-tone="lit" x="${pTop[0].toFixed(1)}" y="${(pTop[1] + 1.8).toFixed(1)}" font-size="4.2" font-weight="bold" text-anchor="middle">${lb.id}</text>
      </g>
    `);
  }

  return out.join("");
}

// Assemble full SVG figure
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "An anatomical illustration of a butterfly (Morpho peleides) mounted as an entomological specimen on a spreading board. Detailed forewings, hindwings, discal cells, segmented thorax, abdomen, compound eyes, antennae, and coiled proboscis, with numbered specimen pins 1 to 8.",
  body: [
    stagePlate(),
    butterflyWings(),
    butterflyBody(),
    specimenPins(),
  ],
});

// Interactive JavaScript for live hover inspection and readout updates
const live = `
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const callouts = stage.querySelectorAll(".iso-callout");
const LABELS = ${JSON.stringify(LABELS)};

let activeIndex = 0;

function setReadout(label) {
  const text = label.id + ". " + label.name + " — " + label.desc;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(label.id));
  stage.setAttribute("aria-valuetext", text);
}

callouts.forEach((el, idx) => {
  el.addEventListener("pointerenter", () => {
    activeIndex = idx;
    setReadout(LABELS[idx]);
  });
});

// Keyboard navigation (Arrow keys, numbers 1-8)
stage.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= "8") {
    activeIndex = Number(e.key) - 1;
    setReadout(LABELS[activeIndex]);
    e.preventDefault();
  } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    activeIndex = (activeIndex + 1) % LABELS.length;
    setReadout(LABELS[activeIndex]);
    e.preventDefault();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    activeIndex = (activeIndex - 1 + LABELS.length) % LABELS.length;
    setReadout(LABELS[activeIndex]);
    e.preventDefault();
  }
});
`;

// Assemble the framed plate with Fig number, title, hint, readout, keys, and caption
const body = k.plateHtml({
  fig: "Fig 1",
  title: "Morpho peleides · Butterfly Anatomy",
  hint: "Hover pins 1–8 or use arrow keys to inspect anatomy",
  readout: "1. " + LABELS[0].name + " — " + LABELS[0].desc,
  keys: [
    { mark: "lit", label: "Numbered specimen pins: 1 to 8 anatomical callout markers" },
    { mark: "raised", label: "Wing venation: Subcosta, radial sectors, discal cell & cubitus" },
    { mark: "mid", label: "Segmented insect body: Head, 3-part thorax & 8-segment abdomen" },
  ],
  caption:
    "Anatomical specimen of a butterfly (Morpho peleides) mounted on an entomological spreading board. Wings display structural venation originating from the central discal cell (3); flight muscles reside within the mesothorax (4) anchored by articular wing hinges; chemosensory clavate antennae (7) and ommatidial compound eyes (6) crown the cephalic vertex; the coiled galeal proboscis (8) uncurls under hydraulic hemolymph pressure.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Butterfly Anatomy: arrow keys or 1-8 to inspect parts" aria-valuemin="1" aria-valuemax="8" aria-valuenow="1">${svg}</div>`,
});

const outName = theme === "light" ? "butterfly-light.html" : "butterfly.html";
writeFileSync(
  join(HERE, outName),
  k.pageHtml({
    title: "Butterfly Anatomy · Morpho peleides",
    theme,
    body,
    script: kitScript() + live,
  }),
);
console.log("wrote", outName);
