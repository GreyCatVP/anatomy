// Preload for scripts/grab-canvas.mjs. Adds two page hooks and nothing else.
//
//   __grab({ selector, box, scale, bg })  -> data:image/png of a WebGL canvas,
//       read back in the same task as the draw, cropped and scaled in the page
//       so the returned URL stays short. A screenshot of a canvas created with
//       preserveDrawingBuffer:false does not contain the canvas; this does.
//   __probe({ selector })                 -> numbers: lit pixels, mean and peak
//       alpha, peak channel, the ink on white, and the outer 10px ring, which
//       must read 0 or the effect is being cut by the canvas edge.
//
// Under premultiplied alpha the colour channels are NOT how dark something
// looks. On the light build, judge alpha; on the dark build, judge the colour.
(() => {
  const target = (selector) => document.querySelector(selector) || [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];

  const readback = (canvas) =>
    new Promise((resolve) => {
      const gl = canvas.getContext("webgl") || canvas.getContext("webgl2");
      if (!gl) return resolve(null);
      // Same task as the page's draw: preserveDrawingBuffer is off, so a
      // readback from any other task comes back empty.
      requestAnimationFrame(() => {
        const w = canvas.width, h = canvas.height;
        const px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        resolve({ w, h, px, gl });
      });
    });

  window.__grab = async ({ selector, box, scale, bg = "#12141a" } = {}) => {
    const canvas = target(selector);
    if (!canvas) throw new Error("no canvas on the page");
    const shot = await readback(canvas);
    if (!shot) throw new Error("no webgl context (is the shader running?)");
    const { w, h, px } = shot;
    const src = document.createElement("canvas");
    src.width = w;
    src.height = h;
    const sctx = src.getContext("2d");
    const img = sctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const from = (h - 1 - y) * w * 4, to = y * w * 4;
      img.data.set(px.subarray(from, from + w * 4), to);
    }
    sctx.putImageData(img, 0, 0);
    const [x = 0, y = 0, cw = w, ch = h] = box || [];
    const bw = Math.min(cw, w - x), bh = Math.min(ch, h - y);
    // The driver prints one line and truncates long ones, so shrink until the
    // encoded PNG fits. A noisy effect encodes far worse than a flat one.
    let at = scale || 1, url = "";
    for (const step of [1, 0.75, 0.6, 0.45, 0.34, 0.25]) {
      at = (scale || 1) * step;
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(bw * at));
      out.height = Math.max(1, Math.round(bh * at));
      const octx = out.getContext("2d");
      if (bg !== "none") {
        octx.fillStyle = bg;
        octx.fillRect(0, 0, out.width, out.height);
      }
      octx.imageSmoothingQuality = "high";
      octx.drawImage(src, x, y, bw, bh, 0, 0, out.width, out.height);
      url = out.toDataURL("image/png");
      if (url.length <= 48000) break;
    }
    return url;
  };

  window.__probe = async ({ selector } = {}) => {
    const canvas = target(selector);
    if (!canvas) throw new Error("no canvas on the page");
    const shot = await readback(canvas);
    if (!shot) throw new Error("no webgl context");
    const { w, h, px } = shot;
    let lit = 0, colour = 0, alpha = 0, edge = 0, maxA = 0, maxC = 0;
    const hist = new Uint32Array(256);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, a = px[i + 3];
        if (a > maxA) maxA = a;
        const c = px[i] + px[i + 1] + px[i + 2];
        if (c > maxC) maxC = c;
        hist[Math.min(255, a)]++;
        if (a > 2) {
          lit++;
          colour += c;
          alpha += a;
          if (y < 10 || y > h - 11 || x < 10 || x > w - 11) edge++;
        }
      }
    }
    let run = 0, p95 = 0;
    for (let a = 255; a >= 0; a--) {
      run += hist[a];
      if (run >= lit * 0.95) {
        p95 = a;
        break;
      }
    }
    return {
      size: `${w}x${h}`,
      lit,
      edge,                                            // must be 0
      meanColour: lit ? +(colour / lit / 3).toFixed(1) : 0, // dark build: brightness added
      meanAlpha: lit ? +(alpha / lit).toFixed(1) : 0,        // light build: ink on paper
      p95,
      maxAlpha: maxA,
      maxColour: maxC,
    };
  };
})();
