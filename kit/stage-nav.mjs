const STAGE_DARK = ["#2dd4bf", "#a78bfa", "#38bdf8", "#f472b6", "#fbbf24", "#a3e635", "#fb923c", "#e879f9"];
const STAGE_LIGHT = ["#0f9488", "#7c3aed", "#0284c7", "#db2777", "#d97706", "#65a30d", "#ea580c", "#c026d3"];
const stageTokens = (pal) => pal.map((c, i) => `--anatomy-stage-${i + 1}:${c}`).join(";");

export function zonePalette(zones) {
  return zones.map((z, i) => ({ ...z, color: z.color || `var(--anatomy-stage-${(i % STAGE_DARK.length) + 1})` }));
}

export const zoneGroup = (zone, asm, svg) => `<g class="z z-${zone}" data-asm="${asm}">${svg}</g>`;

export function stageNavCss(zones) {
  const vars = zones.map((z) => `.z-${z.id},.zl [data-z="${z.id}"],.iso-plate:has(.iso-stage[data-focus="${z.id}"]) [data-readout],.iso-plate:has(.iso-stage[data-auto-zone="${z.id}"]) [data-readout]{--zc:${z.color}}`).join("\n");
  const focus = zones.map((z) => `.iso-stage[data-focus="${z.id}"] .z-${z.id}`).join(",");
  return `
.iso{${stageTokens(STAGE_DARK)}}
.iso[data-theme="light"]{${stageTokens(STAGE_LIGHT)}}
${vars}
:where(.z .iso-solid:not([data-lit]))>.iso-top{fill:color-mix(in srgb,var(--zc) 30%,var(--anatomy-top))}
:where(.z .iso-solid:not([data-lit]))>.iso-fill{fill:color-mix(in srgb,var(--zc) 8%,var(--anatomy-paper))}
${[0, 1, 2, 3].map((n) => `:where(.z .iso-solid:not([data-lit]))>.iso-shade[data-shade="${n}"]{fill:color-mix(in srgb,var(--zc) 14%,var(--anatomy-shade-${n}))}`).join("\n")}
:where(.z) .iso-line.iso-edge{stroke:color-mix(in srgb,var(--zc) 75%,var(--anatomy-mid))}
:where(.z) .iso-face-text{fill:color-mix(in srgb,var(--zc) 70%,var(--anatomy-strong))}
.z{transition:opacity .35s var(--anatomy-ease)}
.iso-stage[data-focus] .z{opacity:.12}
${focus}{opacity:1;filter:drop-shadow(0 0 5px var(--zc))}
.iso-stage[data-auto]:not([data-focus]) .z{opacity:.16}
.iso-stage[data-auto]:not([data-focus]) .z.on{opacity:1;filter:drop-shadow(0 0 2px var(--zc)) drop-shadow(0 0 10px var(--zc))}
.iso-stage[data-auto]:not([data-focus]) .z.on .iso-line.iso-edge:not(.lit *):not(.iso-solid[data-lit]>*){stroke:var(--zc)}
.iso-stage[data-auto]:not([data-focus]) .z.on .iso-solid:not([data-lit]):not(.lit *):not(.lit)>.iso-top{fill:color-mix(in srgb,var(--zc) 55%,var(--anatomy-top))}
.iso-stage{cursor:grab;touch-action:pan-y;outline:none}
.iso-stage.dragging{cursor:grabbing}
.iso-plate{padding-bottom:120px}
.iso-plate-corner[data-corner="hint"]{top:22px;bottom:auto}
.iso-plate-corner[data-corner="readout"]{left:0;right:0;bottom:0;min-height:76px;display:flex;align-items:center;padding:14px 22px;box-sizing:border-box;white-space:normal;font-family:inherit;font-size:22px;line-height:1.45;letter-spacing:.01em;color:var(--anatomy-strong);background:color-mix(in srgb,var(--zc,var(--anatomy-muted)) 10%,var(--anatomy-card));border-left:5px solid var(--zc,var(--anatomy-lo));transition:background .3s,border-color .3s}
@media (max-width:560px){.iso-plate-corner[data-corner="readout"]{font-size:16px}}
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

export function installStageNav({ stage, svg, shot = () => null, onHover = () => {}, zoneText = {}, kick = () => {}, labels = {} }) {
  const L = { on: "on", off: "off", ...labels };
  const doc = stage.ownerDocument;
  const VB0 = svg.viewBox.baseVal;
  const home = { x: VB0.x, y: VB0.y, w: VB0.width, h: VB0.height };
  const vb = { ...home };
  const ar = home.w / home.h;
  const apply = () => {
    vb.w = Math.min(Math.max(vb.w, home.w / 8), home.w);
    vb.h = vb.w / ar;
    vb.x = Math.min(Math.max(vb.x, home.x), home.x + home.w - vb.w);
    vb.y = Math.min(Math.max(vb.y, home.y), home.y + home.h - vb.h);
    svg.setAttribute("viewBox", [vb.x, vb.y, vb.w, vb.h].join(" "));
  };
  const reset = () => { Object.assign(vb, home); apply(); };

  const btn = (sel) => doc.querySelector(sel);
  const state = { follow: !!btn("[data-follow]"), auto: !!btn("[data-autohi]") };
  const setToggle = (key, sel, v) => {
    state[key] = v;
    const b = btn(sel);
    if (b) { b.setAttribute("aria-pressed", String(v)); b.querySelector("b").textContent = v ? L.on : L.off; }
    kick();
  };
  const setFollow = (v) => setToggle("follow", "[data-follow]", v);
  const setAuto = (v) => { setToggle("auto", "[data-autohi]", v); autoStep(); };
  btn("[data-follow]")?.addEventListener("click", () => setFollow(!state.follow));
  btn("[data-autohi]")?.addEventListener("click", () => setAuto(!state.auto));
  btn("[data-view-reset]")?.addEventListener("click", reset);

  stage.addEventListener("wheel", (e) => {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    e.preventDefault();
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
    if (!dragged) { dragged = true; stage.setPointerCapture(drag.id); stage.classList.add("dragging"); if (state.follow) setFollow(false); }
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
    else if ((e.key === "f" || e.key === "F") && btn("[data-follow]")) { e.preventDefault(); setFollow(!state.follow); }
    else if ((e.key === "h" || e.key === "H") && btn("[data-autohi]")) { e.preventDefault(); setAuto(!state.auto); }
  });

  const hover = (zone) => {
    if (zone) stage.dataset.focus = zone; else delete stage.dataset.focus;
    onHover(zone, zone ? zoneText[zone] || "" : "");
    kick();
  };
  stage.addEventListener("pointerover", (e) => { const z = e.target.closest(".z"); const m = z && [...z.classList].find((c) => c.startsWith("z-")); hover(m ? m.slice(2) : null); });
  stage.addEventListener("pointerleave", () => hover(null));
  doc.querySelectorAll(".zl [data-z]").forEach((t) => {
    t.addEventListener("pointerenter", () => hover(t.dataset.z));
    t.addEventListener("pointerleave", () => hover(null));
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
      stage.dataset.autoZone = z.slice(2);
    } else { delete stage.dataset.auto; delete stage.dataset.autoZone; }
  }

  let moving = false;
  function camStep(dt) {
    if (!state.follow) { moving = false; return; }
    const s = current();
    let goal = home;
    if (s) {
      const bs = s.map((n) => box[n]);
      const x0 = Math.min(...bs.map((b) => b.x0)) - 40, y0 = Math.min(...bs.map((b) => b.y0)) - 40;
      const x1 = Math.max(...bs.map((b) => b.x1)) + 40, y1 = Math.max(...bs.map((b) => b.y1)) + 40;
      const w = Math.min(home.w, Math.max(x1 - x0, (y1 - y0) * ar, home.w / 3.2));
      goal = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - w / ar / 2, w };
    }
    const a = dt > 0 ? 1 - Math.exp(-dt * 2.6) : 0;
    vb.x += (goal.x - vb.x) * a; vb.y += (goal.y - vb.y) * a; vb.w += (goal.w - vb.w) * a;
    apply();
    moving = Math.abs(goal.x - vb.x) + Math.abs(goal.y - vb.y) + Math.abs(goal.w - vb.w) > 0.5;
  }

  return {
    step(dt) { camStep(dt); autoStep(); },
    busy: () => moving || !!stage.dataset.focus,
    reset, setFollow, setAuto, hover,
  };
}

export const stageNavScript = () => installStageNav.toString() + "\n";
