import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 660;
const HEIGHT = 420;

// Base plate and feet
const PLATE = { x: -136, y: -72, w: 272, d: 144, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// Rails across the plate
const RAIL_Y1 = -24;
const RAIL_Y2 = 8;
const RAIL_FROM = -104;
const RAIL_TO = 104;
const RAIL_Z = 3;
const RAIL_H = 4;

// 5 Channel stations along the front
const CHANNELS = [
  { id: "whatsapp", name: "WhatsApp", driver: "Baileys", x: -64, latency: 38 },
  { id: "telegram", name: "Telegram", driver: "grammY", x: -32, latency: 24 },
  { id: "discord", name: "Discord", driver: "discord.js", x: 0, latency: 31 },
  { id: "slack", name: "Slack", driver: "Bolt", x: 32, latency: 45 },
  { id: "imessage", name: "iMessage", driver: "AppleScript", x: 64, latency: 58 },
];
const STOPS = CHANNELS.map((c) => c.x);
const STATION_Y = 38;

// Carriage dimensions
const CARRIAGE = { x: -22, y: -30, w: 44, d: 46, r: 4 };
const CARRIAGE_Z = 6;
const CARRIAGE_H = 8;
const CARRIAGE_TOP = CARRIAGE_Z + CARRIAGE_H;

// Gantry tower and dial on the carriage
const TOWER = { x: -14, y: -26, w: 28, d: 18, r: 2.5 };
const TOWER_H = 34;
const TOWER_TOP = CARRIAGE_TOP + TOWER_H;

const DIAL = [0, -17];
const DIAL_R = 17;
const DIAL_Z = CARRIAGE_TOP + 14;
const DIAL_H = 8;
const DIAL_TOP = DIAL_Z + DIAL_H;
const MAX_LATENCY = 80;

// Solenoid probe on the front of carriage
const PROBE_X = 0;
const PROBE_Y = 22;
const PROBE_REST_Z = CARRIAGE_TOP + 2;
const PROBE_STROKE = 10;

// Camera projection
const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [-100, -50, TOWER_TOP + 8],
    [100, 50, TOWER_TOP + 8],
    [0, STATION_Y + 16, 24],
  ],
  WIDTH,
  HEIGHT,
  { pad: 32, azimuth: 44, elevation: 32 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const W = (from, to, opts) => k.wireSvg(from, to, opts);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// --- 1. Base Plate & Feet ---
function basePlate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  // 4 corner feet
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7.5, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.8, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
  }
  // Main granite/cast slab
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  // Inset contour groove
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  // Corner socket screws
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 18)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));

  // Front engraved nameplate: "OPENCLAW GATEWAY · PORT 18789"
  const tag = { x: -52, y: PLATE.y + PLATE.d - 11, w: 104, d: 7.5, r: 1.2 };
  out.push(S(k.slabOf(tag, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(tag, 1), 0.8, P), { tone: "faint" }));
  out.push(D([at([tag.x + 3, tag.y + tag.d / 2, 0.8]), at([tag.x + tag.w - 3, tag.y + tag.d / 2, 0.8])], { size: 0.4 }));

  // Laser ruler tick strip along front edge of plate
  const ruler = { x: -110, y: -48, w: 220, d: 6, r: 1 };
  out.push(S(k.slabOf(ruler, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(ruler.x + 4, ruler.x + ruler.w - 4, 4, 5, ruler.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "faint" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

// --- 2. Dual Guide Rails & End Pillows ---
function rails() {
  const out = [];
  // Twin precision stainless steel rails
  for (const y of [RAIL_Y1, RAIL_Y2]) {
    out.push(S(k.slabOf({ x: RAIL_FROM, y: y - 2, w: RAIL_TO - RAIL_FROM, d: 4, r: 1 }, 0, RAIL_H, P, 3, 0.4), { tone: "mid" }));
    out.push(S(k.cylinder(RAIL_FROM + 8, y, 1.8, RAIL_H, 2.2, P, 16), { tone: "hi" }));
    out.push(S(k.cylinder(RAIL_TO - 8, y, 1.8, RAIL_H, 2.2, P, 16), { tone: "hi" }));
    out.push(D([at([RAIL_FROM + 14, y, RAIL_H]), at([RAIL_TO - 14, y, RAIL_H])], { size: 0.38 }));
  }
  // Heavy end pillow stops
  for (const x of [RAIL_FROM - 7, RAIL_TO]) {
    const pillow = { x, y: RAIL_Y1 - 6, w: 7, d: RAIL_Y2 - RAIL_Y1 + 12, r: 1.5 };
    out.push(S(k.slabOf(pillow, 0, RAIL_H + 4, P, 3, 0.6), { tone: "mid" }));
    out.push(D([at([x + 3.5, RAIL_Y1 - 2, RAIL_H + 4]), at([x + 3.5, RAIL_Y2 + 2, RAIL_H + 4])], { size: 0.45 }));
  }
  return out.join("");
}

// --- 3. Five Channel Relay Terminals ---
function channelStations() {
  const out = [];
  for (let i = 0; i < CHANNELS.length; i++) {
    const ch = CHANNELS[i];
    const ped = { x: ch.x - 11, y: STATION_Y - 10, w: 22, d: 20, r: 2.5 };
    // Pedestal base
    out.push(S(k.slabOf(ped, 0, 7, P, 4, 0.6), { tone: "mid" }));
    out.push(D([at([ped.x + 3, ped.y + 3, 7]), at([ped.x + ped.w - 3, ped.y + 3, 7])], { size: 0.35 }));
    // Inset gold contact block
    const contact = { x: ch.x - 6, y: STATION_Y - 6, w: 12, d: 12, r: 1.2 };
    out.push(S(k.slabOf(contact, 7, 2, P, 3, 0.4), { tone: "hi" }));
    // Contact socket hole in center
    out.push(L(k.ring(ch.x, STATION_Y, 2.2, 9, P, 16), { tone: "lo" }));
    out.push(D([at([ch.x, STATION_Y, 9])], { size: 0.55 }));

    // Rear binding post
    const postX = ch.x;
    const postY = STATION_Y - 6.5;
    out.push(S(k.cylinder(postX, postY, 2.2, 7, 7, P, 20), { tone: "mid" }));
    out.push(L(k.knurl(postX, postY, 2.2, 11, 14, 16, P), { tone: "lo" }));
    out.push(D([at([postX, postY, 14])], { size: 0.35 }));

    // Signal lead wire running down off the station to the bus bar
    const pFrom = at([postX, postY, 12]);
    const pVia1 = at([postX, postY + 10, 8]);
    const pVia2 = at([postX, STATION_Y + 16, 2]);
    const pTo = at([postX, STATION_Y + 22, 0.2]);
    out.push(W(pFrom, pTo, { via: [pVia1, pVia2], tone: "lo", size: 0.8 }));
  }
  return out.join("");
}

// --- 4. The Gateway Carriage & Gantry Tower ---
function carriageBody() {
  const out = [];
  // Carriage shadow/halo
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CARRIAGE, 2), CARRIAGE_Z, 0.1, P)}" style="filter:blur(3px)"/>`);
  // Main sliding carriage bed
  out.push(S(k.slabOf(CARRIAGE, CARRIAGE_Z, CARRIAGE_H, P, 5, 0.8), { tone: "mid" }));
  // 4 linear bronze bushings under carriage
  for (const y of [RAIL_Y1, RAIL_Y2]) {
    for (const x of [-16, 12]) {
      out.push(S(k.slabOf({ x, y: y - 2.5, w: 4, d: 5, r: 0.8 }, CARRIAGE_Z - 2, 2, P, 2), { tone: "hi" }));
    }
  }
  // Gantry vertical tower
  out.push(S(k.slabOf(TOWER, CARRIAGE_TOP, TOWER_H, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(TOWER, 2), TOWER_TOP, P), { tone: "faint" }));
  // Tower top adjustment thumbscrew
  out.push(S(k.cylinder(0, -17, 4.5, TOWER_TOP, 4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(0, -17, 4.5, TOWER_TOP + 1, TOWER_TOP + 4, 20, P), { tone: "lo" }));
  out.push(D([at([0, -17, TOWER_TOP + 4])], { size: 0.45 }));

  // Galvanometer Dial Indicator (measures response latency 0-80 ms)
  // Bezel casing
  out.push(S(k.cylinder(DIAL[0], DIAL[1], DIAL_R, DIAL_Z, DIAL_H, P, 36), { tone: "mid" }));
  out.push(L(k.knurl(DIAL[0], DIAL[1], DIAL_R, DIAL_Z, DIAL_Z + DIAL_H, 36, P), { tone: "lo" }));
  // Dial face (sunken disk)
  out.push(S(k.cylinder(DIAL[0], DIAL[1], DIAL_R - 2.2, DIAL_TOP - 0.4, 0.4, P, 36), { tone: "lo", crease: "none" }));
  // Radial dial ticks (from 0 to 80 ms)
  const dticks = k.radialTicks(DIAL[0], DIAL[1], DIAL_R - 3.2, 20, 4, DIAL_TOP, [1.6, 3.2], P, Math.PI * 0.25, Math.PI * 1.5);
  out.push(L(dticks.minor, { tone: "faint" }));
  out.push(L(dticks.major, { tone: "mid" }));
  // Zero & full scale dots
  out.push(D([at([DIAL[0] - 10, DIAL[1] + 6, DIAL_TOP]), at([DIAL[0] + 10, DIAL[1] + 6, DIAL_TOP])], { size: 0.4 }));
  out.push(D([at([DIAL[0], DIAL[1], DIAL_TOP])], { size: 0.6 })); // Pivot jewel

  // Solenoid actuator frame on front of carriage
  const sole = { x: -8, y: 12, w: 16, d: 14, r: 2 };
  out.push(S(k.slabOf(sole, CARRIAGE_Z + 2, 10, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(0, 19, 5, CARRIAGE_Z + 4, 6, P, 24), { tone: "mid" }));
  out.push(L([CARRIAGE_Z + 5, CARRIAGE_Z + 7, CARRIAGE_Z + 9].map((z) => k.sideArc(0, 19, 5, z, P, 16)).join(""), { tone: "faint" }));
  return out.join("");
}

// --- 5. Moving Plunger / Solenoid Contactor ---
function plungerHead() {
  const out = [];
  // Plunger shaft extending down to contact the channel block
  out.push(S(k.cylinder(0, 19, 2.4, 0, 14, P, 20), { tone: "mid" }));
  // Brass knurled collar
  out.push(S(k.cylinder(0, 19, 3.6, 8, 3, P, 20), { tone: "hi" }));
  out.push(L(k.knurl(0, 19, 3.6, 8, 11, 16, P), { tone: "lo" }));
  // Ground contact tip (tungsten/gold)
  out.push(S(k.cylinder(0, 19, 1.8, -3, 3, P, 18), { tone: "lit" }));
  out.push(D([at([0, 19, -3])], { size: 0.45 }));
  return out.join("");
}

// Needle angle formula: sweeps from angle 0 (left) to max angle across the dial
const needleAt = (latency) => {
  const norm = Math.min(1, Math.max(0, latency / MAX_LATENCY));
  const angle = Math.PI * 0.75 - norm * (Math.PI * 1.5);
  const [cx, cy] = DIAL;
  const len = DIAL_R - 5;
  const tail = 3.5;
  const p0 = [cx - Math.cos(angle) * tail, cy - Math.sin(angle) * tail];
  const p1 = [cx + Math.cos(angle) * len, cy + Math.sin(angle) * len];
  return k.lineOnTop(p0, p1, DIAL_TOP + 0.3, P);
};

const startChannel = CHANNELS[1]; // Telegram by default
const startX = startChannel.x;
const startLatency = startChannel.latency;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "An electromechanical dispatch router explaining OpenClaw. Incoming chat messages from WhatsApp, Telegram, Discord, Slack and iMessage arrive at peripheral contact terminals; the central gateway gantry indexes along precision rails to the active channel, locks the contactor, and dispatches the payload to the agent runtime.",
  body: [
    basePlate(),
    rails(),
    channelStations(),
    // Moving carriage group
    `<g data-part="carriage" transform="${k.translateAlong(P, [startX, 0, 0])}">
      ${carriageBody()}
      <g data-part="plunger" transform="${k.translateAlong(P, [0, 0, 0])}">
        ${plungerHead()}
      </g>
      <path data-part="needle" class="iso-line" data-tone="lit" data-free="both" d="${needleAt(startLatency)}" style="stroke-width:1.2"/>
    </g>`,
  ],
});

// Interactive JavaScript runtime for live motion, keyboard control, and readout
const live = `
const P = ${JSON.stringify(P)};
const CHANNELS = ${JSON.stringify(CHANNELS)};
const STOPS = ${JSON.stringify(STOPS)};
const MAX_LATENCY = ${MAX_LATENCY};
const DIAL = ${JSON.stringify(DIAL)};
const DIAL_R = ${DIAL_R};
const DIAL_TOP = ${DIAL_TOP};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const carriage = svg.querySelector('[data-part="carriage"]');
const plunger = svg.querySelector('[data-part="plunger"]');
const needle = svg.querySelector('[data-part="needle"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};

let currentIndex = 1;
let currentX = STOPS[currentIndex];
let targetX = currentX;
let plungerZ = -3.2; // Contact engaged
let targetPlungerZ = -3.2;
let currentLatency = CHANNELS[currentIndex].latency;
let targetLatency = currentLatency;

let frame = 0, lastTime = 0, tourClock = 0, touring = true, visible = false, idleTimer = 0;

function updateReadout() {
  const ch = CHANNELS[currentIndex];
  const text = "Channel: " + ch.name + " (" + ch.driver + ") · Port: 18789 · Latency: " + currentLatency.toFixed(1) + " ms";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(currentIndex));
  stage.setAttribute("aria-valuetext", text);
}

function render() {
  carriage.setAttribute("transform", translateAlong(P, [currentX, 0, 0]));
  plunger.setAttribute("transform", translateAlong(P, [0, 0, plungerZ]));
  needle.setAttribute("d", needleAt(currentLatency));
  updateReadout();
}

function tick(now) {
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 1 / 30) : 1 / 60;
  lastTime = now;
  const calm = still.matches;

  if (touring) {
    tourClock += dt;
    const tourIndex = Math.floor(tourClock / 2.6) % CHANNELS.length;
    if (tourIndex !== currentIndex) {
      currentIndex = tourIndex;
      targetX = STOPS[currentIndex];
      targetLatency = CHANNELS[currentIndex].latency;
    }
  }

  // Smooth exponential follow for carriage motion along rails
  const prevX = currentX;
  currentX = calm ? targetX : currentX + (targetX - currentX) * (1 - Math.exp(-dt / 0.22));
  if (Math.abs(targetX - currentX) < 0.05) currentX = targetX;

  // Plunger contact animation: lifts while in transit, drops into socket when arrived
  const moving = Math.abs(currentX - targetX) > 0.8;
  targetPlungerZ = moving ? 4.5 : -3.2;
  plungerZ = calm ? targetPlungerZ : plungerZ + (targetPlungerZ - plungerZ) * (1 - Math.exp(-dt / 0.12));

  // Galvanometer needle responds with slight spring
  currentLatency = calm ? targetLatency : currentLatency + (targetLatency - currentLatency) * (1 - Math.exp(-dt / 0.18));

  render();

  const settled = !touring && Math.abs(currentX - targetX) < 0.01 && Math.abs(plungerZ - targetPlungerZ) < 0.01;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

function startLoop() {
  if (!frame && visible) {
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }
}

function selectChannel(index) {
  touring = false;
  currentIndex = clamp(index, 0, CHANNELS.length - 1);
  targetX = STOPS[currentIndex];
  targetLatency = CHANNELS[currentIndex].latency;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !still.matches;
    tourClock = 0;
    startLoop();
  }, 4500);
  startLoop();
}

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) startLoop();
}, { rootMargin: "120px 0px" }).observe(stage);

if (still.matches) touring = false;

// Mouse & pointer interaction: hover steers carriage across the 5 channels
stage.addEventListener("pointermove", (e) => {
  const rect = svg.getBoundingClientRect();
  const relX = (e.clientX - rect.left) / rect.width;
  const closestIndex = Math.round(clamp(relX * (CHANNELS.length - 1), 0, CHANNELS.length - 1));
  if (closestIndex !== currentIndex) {
    selectChannel(closestIndex);
  }
});

// Keyboard accessibility: Left / Right arrows, Home, End
stage.addEventListener("keydown", (e) => {
  let next = currentIndex;
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = currentIndex - 1;
  else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = currentIndex + 1;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = CHANNELS.length - 1;
  else return;

  e.preventDefault();
  selectChannel(next);
});

render();
`;

// Assemble the framed plate with Fig number, title, hint, readout, legend keys, and caption
const body = k.plateHtml({
  fig: "Fig 1",
  title: "OpenClaw Gateway Router",
  hint: "Hover or use arrow keys to route to a channel",
  readout: `Channel: ${startChannel.name} (${startChannel.driver}) · Port: 18789 · Latency: ${startLatency.toFixed(1)} ms`,
  keys: [
    { mark: "lit", label: "Solenoid contactor & galvanometer needle: dispatch routing and latency" },
    { mark: "raised", label: "Five peripheral channels: WhatsApp, Telegram, Discord, Slack, iMessage" },
  ],
  caption:
    "An electromechanical crossbar router explaining OpenClaw. Incoming chat messages from WhatsApp (Baileys), Telegram (grammY), Discord (discord.js), Slack (Bolt), and iMessage (AppleScript) arrive at peripheral contact terminals. The central Gateway gantry on port 18789 indexes along precision rails to the active channel, locks the contactor, and dispatches the payload to the agent runtime.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="OpenClaw Gateway Router: arrow keys select chat channel" aria-valuemin="0" aria-valuemax="4" aria-valuenow="1">${svg}</div>`,
});

const outName = theme === "light" ? "openclaw-router-light.html" : "openclaw-router.html";
writeFileSync(
  join(HERE, outName),
  k.pageHtml({
    title: "OpenClaw Gateway Router",
    theme,
    body,
    script: kitScript() + live,
  }),
);
console.log("wrote", outName);
