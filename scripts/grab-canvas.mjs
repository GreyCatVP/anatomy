#!/usr/bin/env node
// Save what a WebGL canvas actually drew, which a page screenshot does not show.
//
//   node scripts/grab-canvas.mjs <file.html | url> [options]
//
//   --out <png>          output path (default canvas.png)
//   --selector <css>     which canvas (default: the largest one on the page)
//   --box x,y,w,h        crop in canvas device pixels (default: all)
//   --scale <n>          output scale; keep w*h under ~350k or the driver
//                        truncates the line and the PNG comes back broken
//   --bg <colour|none>   what to lay the effect over (default #12141a)
//   --actions '<json>'   drive.mjs actions run before the grab, e.g.
//                        '[["key","End"],["wait",900]]'
//   --probe              print the numbers instead of a picture
//
// Prints the saved path or the probe table, then console errors, exceptions and
// whether the page scrolls sideways. Use this whenever the effect has to be
// *seen*: shape, colour ramp, seams, a cut at the canvas edge. Use --probe for
// "is it on at all" and for the numbers the checklist in webgl.md asks for.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));

const USAGE = `node scripts/grab-canvas.mjs <file.html | url> [--out shot.png] [--selector css] [--box x,y,w,h]
                          [--scale n] [--bg colour|none] [--actions json] [--probe]`;

export function parse(argv) {
  const options = { out: "canvas.png", scale: 0, bg: "#12141a", probe: false, actions: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--out") options.out = next();
    else if (arg === "--selector") options.selector = next();
    else if (arg === "--box") options.box = next().split(",").map(Number);
    else if (arg === "--scale") options.scale = Number(next());
    else if (arg === "--bg") options.bg = next();
    else if (arg === "--actions") options.actions = next();
    else if (arg === "--probe") options.probe = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else rest.push(arg);
  }
  return { options, rest };
}

const SCALE_CAP = 350000; // pixels in the saved PNG; above this the line gets cut

function fallbackScale(box, scale, canvasGuess) {
  if (scale > 0) return scale;
  const w = box ? box[2] : canvasGuess || 672;
  const h = box ? box[3] : canvasGuess || 896;
  return Math.min(1, Math.sqrt(SCALE_CAP / Math.max(1, w * h)));
}

/** A truncated data URL still decodes to bytes that look like a PNG. Check it.
 *  IDAT chunks are one zlib stream split across chunks, so join them first. */
export function pngIsWhole(bytes) {
  const chunks = [];
  let at = 8, seen = false;
  while (at + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString("ascii", at + 4, at + 8);
    if (type === "IDAT") chunks.push(bytes.subarray(at + 8, at + 8 + length));
    if (type === "IEND") seen = true;
    at += 12 + length;
  }
  if (!seen || !chunks.length) return false;
  try {
    inflateSync(Buffer.concat(chunks));
    return true;
  } catch {
    return false;
  }
}

/** Pull one `eval: "..."` result out of the driver's stdout. */
export function extract(stdout, marker) {
  for (const line of stdout.split("\n")) {
    const at = line.indexOf(marker);
    if (at < 0) continue;
    let value = line.slice(at + marker.length).trim();
    if (value.endsWith('"')) value = value.slice(0, -1);
    try {
      return JSON.parse(value);
    } catch {
      try {
        return JSON.parse(`${value}"`);
      } catch {
        return value.replace(/^"|"$/g, "");
      }
    }
  }
  return null;
}

export function main(argv) {
  const { options, rest } = parse(argv);
  if (options.help || !rest.length) {
    console.log(USAGE);
    return options.help ? 0 : 1;
  }
  const page = rest[0];
  const scale = fallbackScale(options.box, options.scale, 0);
  const call = options.probe
    ? `__probe(${JSON.stringify({ selector: options.selector })})`
    : `__grab(${JSON.stringify({ selector: options.selector, box: options.box, scale, bg: options.bg })})`;
  const actions = JSON.stringify([...(options.actions ? JSON.parse(options.actions) : []), ["eval", call]]);
  const run = spawnSync(
    process.execPath,
    [join(HERE, "drive.mjs"), page, actions, "--preload", join(HERE, "grab-preload.js")],
    { encoding: "utf8", maxBuffer: 1 << 28 },
  );
  const stdout = run.stdout ?? "";
  process.stdout.write(stdout.split("\n").filter((l) => !l.startsWith("eval: \"data:image")).join("\n"));
  if (run.stderr) process.stderr.write(run.stderr);
  if (options.probe) {
    const probe = extract(stdout, "eval: ");
    if (!probe) return 1;
    for (const [key, value] of Object.entries(probe)) console.log(`  ${key}: ${Array.isArray(value) ? value.join(" ") : value}`);
    return 0;
  }
  const url = extract(stdout, 'eval: "data:image/png;base64,');
  if (!url) {
    console.error("grab failed: the page returned no PNG (is the shader running, or is the canvas name right?)");
    return 1;
  }
  const bytes = Buffer.from(url, "base64");
  if (!pngIsWhole(bytes)) {
    console.error("the PNG came back truncated: the driver cut the line. Retry with a smaller --scale or a smaller --box.");
    return 1;
  }
  const out = resolve(options.out);
  writeFileSync(out, bytes);
  console.log(`saved ${out} ${(bytes.length / 1024).toFixed(0)} KB${scale ? ` scale ${scale.toFixed(2)}` : ""}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith("grab-canvas.mjs")) process.exit(main(process.argv.slice(2)));
