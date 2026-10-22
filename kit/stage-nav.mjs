const STAGE_DARK = ["#2dd4bf", "#a78bfa", "#38bdf8", "#f472b6", "#fbbf24", "#a3e635", "#fb923c", "#e879f9"];
const STAGE_LIGHT = ["#0f9488", "#7c3aed", "#0284c7", "#db2777", "#d97706", "#65a30d", "#ea580c", "#c026d3"];
const stageTokens = (pal) => pal.map((c, i) => `--anatomy-stage-${i + 1}:${c}`).join(";");

export function zonePalette(zones) {
  return zones.map((z, i) => ({ ...z, color: z.color || `var(--anatomy-stage-${(i % STAGE_DARK.length) + 1})` }));
}

export const zoneGroup = (zone, asm, svg) => `<g${zone ? ` class="z z-${zone}"` : ""} data-asm="${asm}">${svg}</g>`;

const TONES = ["paper", "face", "top", "shade-0", "shade-1", "shade-2", "shade-3", "lit-top", "lit-shade", "hi", "mid", "lo", "faint", "lit", "halo", "dot", "red", "green", "blue", "strong"];
const dimTones = (amount) => `--nav-dim:${amount};` + TONES.map((t) => `--anatomy-${t}:color-mix(in srgb,var(--nav-${t}),var(--nav-card) var(--nav-dim))`).join(";");

export function stageNavCss(zones) {
  const vars = zones.map((z) => `.z-${z.id},.zl [data-z="${z.id}"],.iso-plate:has(.iso-stage[data-focus="${z.id}"]) [data-nav-bar],.iso-plate:has(.iso-stage[data-auto-zone="${z.id}"]) [data-nav-bar]{--zc:${z.color}}`).join("\n");
  const focus = zones.map((z) => `.iso-stage[data-focus="${z.id}"] .z-${z.id}`).join(",");
  const dimFocus = zones.map((z) => `.iso-stage[data-focus]:not([data-focus="${z.id}"]) .z-${z.id}`);
  const dimAuto = zones.map((z) => `.iso-stage[data-auto]:not([data-focus]) .z-${z.id}:not(.on)`);
  const dimZc = zones.map((z, i) => `${dimFocus[i]},${dimAuto[i]}{--zc:color-mix(in srgb,${z.color},var(--nav-card) var(--nav-dim))}`).join("\n");
  return `
.iso{${stageTokens(STAGE_DARK)}}
.iso[data-theme="light"]{${stageTokens(STAGE_LIGHT)}}
${vars}
:where(.z .iso-solid:not([data-lit]))>.iso-top{fill:color-mix(in srgb,var(--zc) 30%,var(--anatomy-top))}
:where(.z .iso-solid:not([data-lit]))>.iso-fill{fill:color-mix(in srgb,var(--zc) 8%,var(--anatomy-paper))}
${[0, 1, 2, 3].map((n) => `:where(.z .iso-solid:not([data-lit]))>.iso-shade[data-shade="${n}"]{fill:color-mix(in srgb,var(--zc) 14%,var(--anatomy-shade-${n}))}`).join("\n")}
:where(.z) .iso-line.iso-edge{stroke:color-mix(in srgb,var(--zc) 75%,var(--anatomy-mid))}
:where(.z) .iso-face-text{fill:color-mix(in srgb,var(--zc) 70%,var(--anatomy-strong))}
.iso-stage{--nav-card:var(--anatomy-card);${TONES.map((t) => `--nav-${t}:var(--anatomy-${t})`).join(";")}}
${dimFocus.join(",")}{${dimTones("82%")}}
${dimAuto.join(",")}{${dimTones("78%")}}
${dimZc}
${focus}{filter:drop-shadow(0 0 5px var(--zc))}
.iso-stage[data-auto]:not([data-focus]) .z.on{filter:drop-shadow(0 0 2px var(--zc)) drop-shadow(0 0 10px var(--zc))}
.iso-stage[data-auto]:not([data-focus]) .z.on .iso-line.iso-edge:not(.lit *):not(.iso-solid[data-lit]>*){stroke:var(--zc)}
.iso-stage[data-auto]:not([data-focus]) .z.on .iso-solid:not([data-lit]):not(.lit *):not(.lit)>.iso-top{fill:color-mix(in srgb,var(--zc) 55%,var(--anatomy-top))}
.iso-stage{cursor:grab;touch-action:pan-y;outline:none}
.iso-stage.dragging{cursor:grabbing}
.iso-stage svg[data-zoomed]{overflow:hidden}
.iso-stage [data-asm][tabindex]:focus-visible{outline:2px solid var(--anatomy-hi);outline-offset:3px}
.nav-bar{margin-top:18px;min-height:76px;display:flex;align-items:center;padding:14px 22px;box-sizing:border-box;font-size:22px;line-height:1.45;letter-spacing:.01em;color:var(--anatomy-strong);background:color-mix(in srgb,var(--zc,var(--anatomy-muted)) 10%,var(--anatomy-card));border-left:5px solid var(--zc,var(--anatomy-lo));transition:background .3s,border-color .3s}
@media (max-width:560px){.nav-bar{font-size:16px;min-height:60px;padding:10px 14px}}
.zl{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0;font-size:13px}
.zl span{display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border:1px solid color-mix(in srgb,var(--zc) 55%,transparent);color:var(--anatomy-strong);cursor:default}
.zl span::before{content:"";width:10px;height:10px;background:var(--zc)}
.zl span:hover{background:color-mix(in srgb,var(--zc) 18%,transparent)}
.nav-btn{font:inherit;font-size:13px;color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-lo);padding:4px 10px;cursor:pointer}
.nav-btn:first-of-type{margin-left:auto}
.nav-btn[aria-pressed="true"]{border-color:var(--anatomy-hi)}
.nav-btn kbd{font:11px var(--anatomy-mono);color:var(--anatomy-muted)}
`;
}

export function stageNavHtml(zones, { labels = {} } = {}) {
  const L = { auto: "Auto highlight", follow: "Follow camera", reset: "Reset view", on: "on", ...labels };
  const chips = zones.length > 1 ? zones.map((z) => `<span data-z="${z.id}">${z.name}</span>`).join("") : "";
  const toggles = zones.length > 1
    ? `<button class="nav-btn" data-autohi aria-pressed="true" type="button">${L.auto}: <b>${L.on}</b> <kbd>H</kbd></button><button class="nav-btn" data-follow aria-pressed="true" type="button">${L.follow}: <b>${L.on}</b> <kbd>F</kbd></button>`
    : "";
  return `<div class="zl">${chips}${toggles}<button class="nav-btn" data-view-reset type="button">${L.reset} <kbd>0</kbd></button></div>`;
}

export const stageNavBar = () => `<div class="nav-bar" data-nav-bar aria-live="polite"></div>`;

export function installStageNav({ stage, svg, shot = () => null, onHover = () => {}, zoneText = {}, kick = () => {}, labels = {}, zoomOnClick = false }) {
  const L = { on: "on", off: "off", ...labels };
  const doc = stage.ownerDocument;
  const still = doc.defaultView.matchMedia("(prefers-reduced-motion: reduce)");
  const VB0 = svg.viewBox.baseVal;
  const full = { x: VB0.x, y: VB0.y, w: VB0.width, h: VB0.height };
  const vb = { ...full };
  const ar = full.w / full.h;
  const clamp = (b) => {
    b.w = Math.min(Math.max(b.w, full.w / 8), full.w);
    b.h = b.w / ar;
    b.x = Math.min(Math.max(b.x, full.x), full.x + full.w - b.w);
    b.y = Math.min(Math.max(b.y, full.y), full.y + full.h - b.h);
    return b;
  };
  const apply = () => {
    clamp(vb);
    svg.setAttribute("viewBox", [vb.x, vb.y, vb.w, vb.h].join(" "));
    svg.toggleAttribute("data-zoomed", vb.w < full.w);
  };
  let target = null;
  const reset = () => { target = null; Object.assign(vb, full); apply(); };

  const btn = (sel) => doc.querySelector(sel);
  const state = { follow: !!btn("[data-follow]"), auto: !!btn("[data-autohi]") };
  const setToggle = (key, sel, v) => {
    state[key] = v;
    const b = btn(sel);
    if (b) { b.setAttribute("aria-pressed", String(v)); b.querySelector("b").textContent = v ? L.on : L.off; }
    kick();
  };
  const setFollow = (v) => { if (v) target = null; setToggle("follow", "[data-follow]", v); };
  const setAuto = (v) => { setToggle("auto", "[data-autohi]", v); autoStep(); };
  btn("[data-follow]")?.addEventListener("click", () => setFollow(!state.follow));
  btn("[data-autohi]")?.addEventListener("click", () => setAuto(!state.auto));
  btn("[data-view-reset]")?.addEventListener("click", reset);

  stage.addEventListener("wheel", (e) => {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    e.preventDefault();
    target = null;
    if (state.follow) setFollow(false);
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const px = vb.x + fx * vb.w, py = vb.y + fy * vb.h;
    vb.w *= Math.exp(e.deltaY * 0.0015);
    vb.h = vb.w / ar;
    vb.x = px - fx * vb.w; vb.y = py - fy * vb.h;
    apply();
  }, { passive: false });
  let drag = null, dragged = false;
  stage.addEventListener("pointerdown", (e) => { if (e.button !== 0 || e.pointerType === "touch") return; drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y, id: e.pointerId }; dragged = false; });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    if (!dragged) { dragged = true; target = null; stage.setPointerCapture(drag.id); stage.classList.add("dragging"); if (state.follow) setFollow(false); }
    const s = vb.w / svg.getBoundingClientRect().width;
    vb.x = drag.vx - dx * s; vb.y = drag.vy - dy * s;
    apply();
  });
  const endDrag = () => { drag = null; stage.classList.remove("dragging"); };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("click", (e) => { if (dragged) { e.stopImmediatePropagation(); dragged = false; } }, true);
  stage.addEventListener("dblclick", reset);
  addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,textarea,select")) return;
    if (e.key === "0") { e.preventDefault(); reset(); }
    else if (e.key === "Escape") home();
    else if ((e.key === "f" || e.key === "F") && btn("[data-follow]")) { e.preventDefault(); setFollow(!state.follow); }
    else if ((e.key === "h" || e.key === "H") && btn("[data-autohi]")) { e.preventDefault(); setAuto(!state.auto); }
  });

  const hover = (zone) => {
    if (zone) stage.dataset.focus = zone; else delete stage.dataset.focus;
    onHover(zone, zone ? zoneText[zone] || "" : "");
    kick();
  };
  stage.addEventListener("pointerover", (e) => { const z = e.target.closest(".z"); const m = z && [...z.classList].find((c) => c.startsWith("z-")); hover(m ? m.slice(2) : null); });
  stage.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hover(null); });
  doc.querySelectorAll(".zl [data-z]").forEach((t) => {
    t.addEventListener("pointerenter", () => hover(t.dataset.z));
    t.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hover(null); });
  });

  const groups = [...svg.querySelectorAll("[data-asm]")].filter((g) => g.dataset.asm);
  const box = {};
  groups.forEach((g) => {
    const b = g.getBBox(), n = g.dataset.asm, o = box[n];
    box[n] = o ? { x0: Math.min(o.x0, b.x), y0: Math.min(o.y0, b.y), x1: Math.max(o.x1, b.x + b.width), y1: Math.max(o.y1, b.y + b.height) } : { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height };
  });
  const current = () => {
    const s = shot();
    if (!s) return null;
    s.forEach((n) => { if (!box[n]) throw new Error(`stage-nav: shot() names an assembly with no data-asm group: ${n}`); });
    return s;
  };
  const union = (names) => {
    const bs = names.map((n) => { if (!box[n]) throw new Error(`stage-nav: no data-asm group named ${n}`); return box[n]; });
    return { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) };
  };
  const frame = ({ x0, y0, x1, y1 }, pad, min) => {
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const w = Math.min(full.w, Math.max(x1 - x0, (y1 - y0) * ar, min));
    return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - w / ar / 2, w };
  };
  function flyTo(to) {
    if (typeof to === "string" || Array.isArray(to)) target = frame(union([].concat(to)), 40, full.w / 3.2);
    else if (to && [to.x, to.y, to.w, to.h].every(Number.isFinite)) target = frame({ x0: to.x, y0: to.y, x1: to.x + to.w, y1: to.y + to.h }, 0, full.w / 8);
    else throw new Error("stage-nav: flyTo takes assembly names or { x, y, w, h } in viewBox units");
    if (state.follow) setFollow(false);
    kick();
  }
  function home() {
    target = { x: full.x, y: full.y, w: full.w };
    picked = null;
    if (state.follow) setFollow(false);
    kick();
  }
  let picked = null;
  const pick = (n) => { if (n && !(n === picked && target)) { flyTo([n]); picked = n; } else home(); };
  if (zoomOnClick) {
    const named = new Set();
    groups.forEach((g) => {
      if (named.has(g.dataset.asm)) return;
      named.add(g.dataset.asm);
      g.setAttribute("tabindex", "0");
      if (!g.hasAttribute("role")) g.setAttribute("role", "button");
      if (!g.hasAttribute("aria-label")) g.setAttribute("aria-label", g.dataset.asm);
    });
    stage.addEventListener("click", (e) => { const g = e.target.closest("[data-asm]"); pick(g && g.dataset.asm); });
    stage.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const g = e.target.closest && e.target.closest("[data-asm][tabindex]");
      if (!g) return;
      e.preventDefault();
      pick(g.dataset.asm);
    });
  }
  const bar = doc.querySelector("[data-nav-bar]");
  const say = (text) => { if (bar && bar.textContent !== text) bar.textContent = text; };

  let autoKey = "";
  function autoStep() {
    const s = state.auto ? current() : null;
    const key = s ? s.join(",") : "";
    if (key === autoKey) return;
    autoKey = key;
    groups.forEach((g) => g.classList.toggle("on", !!s && s.includes(g.dataset.asm)));
    if (s) {
      stage.dataset.auto = "";
      const z = [...groups.find((g) => g.classList.contains("on")).classList].find((c) => c.startsWith("z-"));
      if (z) stage.dataset.autoZone = z.slice(2); else delete stage.dataset.autoZone;
    } else { delete stage.dataset.auto; delete stage.dataset.autoZone; }
  }

  let moving = false;
  function camStep(dt) {
    let goal;
    if (target) goal = target;
    else if (state.follow) { const s = current(); goal = s ? frame(union(s), 40, full.w / 3.2) : full; }
    else { moving = false; return; }
    goal = clamp({ ...goal });
    if (still.matches) { Object.assign(vb, goal); apply(); moving = false; return; }
    const a = dt > 0 ? 1 - Math.exp(-dt * 2.6) : 0;
    vb.x += (goal.x - vb.x) * a; vb.y += (goal.y - vb.y) * a; vb.w += (goal.w - vb.w) * a;
    apply();
    moving = Math.abs(goal.x - vb.x) + Math.abs(goal.y - vb.y) + Math.abs(goal.w - vb.w) > 0.5;
    if (!moving) { Object.assign(vb, goal); apply(); }
  }

  return {
    step(dt) { camStep(dt); autoStep(); },
    busy: () => moving || !!stage.dataset.focus,
    reset, home, flyTo, say, setFollow, setAuto, hover,
  };
}

export const stageNavScript = () => installStageNav.toString() + "\n";
