import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { extract, parse, pngIsWhole } from "./grab-canvas.mjs";

// A PNG built the way a browser builds one: IHDR, several IDAT chunks holding
// one zlib stream, IEND. A truncated transfer cuts the stream, not the header,
// so the bytes still look like a file.
function png(idatChunks) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc(type, data), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stream = deflateSync(Buffer.alloc(64, 7));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    ...idatChunks.map((at) => chunk("IDAT", stream.subarray(at))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let table = null;
function crc(type, data) {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (const byte of Buffer.concat([Buffer.from(type, "ascii"), data])) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

test("parse reads the flags grab-canvas.mjs documents and leaves the page path", () => {
  const { options, rest } = parse(["page.html", "--out", "shot.png", "--box", "1,2,3,4", "--scale", "2", "--bg", "none", "--probe", "--actions", "[]"]);
  assert.deepEqual(rest, ["page.html"]);
  assert.equal(options.out, "shot.png");
  assert.deepEqual(options.box, [1, 2, 3, 4]);
  assert.equal(options.scale, 2);
  assert.equal(options.bg, "none");
  assert.equal(options.probe, true);
});

test("extract pulls one result out of the driver's output and leaves the rest", () => {
  const stdout = ['clip 360,64 720x1000', 'eval: {"lit":42,"edge":0}', "console: clean"].join("\n");
  assert.deepEqual(extract(stdout, "eval: "), { lit: 42, edge: 0 });
});

test("extract takes a long data URL off the end of the line, quotes and all", () => {
  const payload = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const stdout = `eval: "data:image/png;base64,${payload}"\nconsole: clean`;
  assert.equal(extract(stdout, 'eval: "data:image/png;base64,'), payload);
});

test("extract returns nothing when the page printed no result", () => {
  assert.equal(extract("console: clean\n", "eval: "), null);
});

test("pngIsWhole accepts a PNG whose IDAT stream is split across chunks", () => {
  const whole = png([0]);
  assert.ok(pngIsWhole(whole));
  const split = png([0, 8]);
  assert.ok(pngIsWhole(split), "one zlib stream cut into two IDAT chunks is still whole");
});

test("pngIsWhole rejects a PNG that was cut in transit", () => {
  const stream = deflateSync(Buffer.alloc(256, 3));
  const cut = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.alloc(25),
    stream.subarray(0, Math.floor(stream.length / 2)),
  ]);
  assert.equal(pngIsWhole(cut), false);
});

test("pngIsWhole rejects bytes that never reached an IEND", () => {
  assert.equal(pngIsWhole(Buffer.alloc(64)), false);
});
