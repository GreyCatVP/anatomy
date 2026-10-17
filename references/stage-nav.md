# Stage navigation (default for framework-free pages)

Every framework-free page ships with the navigation below from its first version; nobody should have to ask for it. It came from a review of a six-stage process figure, where the reader reported, in order:

1. The machine is too small to read: **wheel zoom, drag pan and a wider page**.
2. Everything is grey, so hover focus barely shows: **a colour per stage**.
3. The 10.5px corner readout was missed entirely: **a large explanation bar across the bottom of the card**.
4. During the tour you can't tell which stage is running: **a follow camera**.
5. The camera alone is not enough: **auto-highlight of the running step**, toggled like the camera.

## What applies when

| Figure | Gets |
|---|---|
| Any figure | Wheel zoom around the cursor (up to 8×), drag pan (left button, with a 4px threshold so clicks on parts still work), reset (double-click, `0`, button), the large readout bar, `pageHtml({ width: 1800 })` |
| A process with two or more stages | All of the above, plus stage colours, legend chips (hover = focus), hover focus on the drawing, auto-highlight (`H`, on) and the follow camera (`F`, on) |

A single-mechanism figure such as a dial gauge has one stage: keep zoom, pan and the readout bar. `stageNavHtml` drops the chips and toggles by itself when there is only one zone.

## Contract

**Markup.** Wrap every assembly, in painter's order, with `zoneGroup(zone, asm, svg)`, which writes `<g class="z z-<zone>" data-asm="<asm>">`. `zone` is the stage (colour, hover, legend). `asm` names the part group the camera and the highlight aim at. Several groups may share a name (three decks are all `"deck"`), and their boxes are merged.

**Runtime.** After the SVG is in the DOM:

```js
const nav = installStageNav({
  stage, svg,
  zoneText,
  onHover: (zone, text) => { hoverText = text; },
  shot: () => runs.pour ? (runs.pour.t < 2 ? ["hopper"] : ["hopper", "belt"]) : runs.weigh ? ["scale"] : null,
  kick,
});
```

In the frame loop call `nav.step(dt)` after drawing, and keep looping while `nav.busy()`.

- `zoneText` maps each zone to the sentence the readout bar shows on hover; `onHover` lets the figure decide what the bar shows.
- `shot()` returns the assemblies of the step running now, or `null` when idle (the camera eases back to the full view and the highlight clears). Use the same time thresholds as the readout text, so the bar, the glow and the camera change together.
- A name in `shot()` with no `data-asm` group throws. A typo fails loudly instead of aiming at nothing.
- `kick` restarts the figure's frame loop after a toggle or a hover.

**Build.**

```js
import { zonePalette, zoneGroup, stageNavCss, stageNavHtml, stageNavScript } from "../../kit/stage-nav.mjs";
const zones = zonePalette([{ id: "intake", name: "Intake", text: "…" }, { id: "sort", name: "Sort", text: "…" }]);
const body = `<style>${stageNavCss(zones)}</style>` + k.plateHtml({ … }) + stageNavHtml(zones);
writeFileSync(out, k.pageHtml({ title, theme, body, script: kitScript() + stageNavScript() + live, width: 1800 }));
```

Stage colours are tokens (`--anatomy-stage-1` … `--anatomy-stage-8`) with dark values and light overrides. Pass `color` on a zone only to use another token. `stageNavHtml(zones, { labels })` and `installStageNav({ labels })` take the button text for other languages.

## Rules

- **Colour by stage, not as decoration.** Tops take 30% of the stage colour, sides 14% and edges 75%, mixed over the kit tones. Lit parts, status lamps and moving tokens keep their own colours: the highlight rules skip `[data-lit]`, `.lit` and their descendants. Pick token colours that don't collide with the stage they travel through.
- **Hover wins over auto.** While the pointer is on a stage or a legend chip, hover focus shows; auto-highlight returns when it leaves.
- **The user takes over.** Any wheel or drag turns the follow camera off; `F` or the button turns it back on. Never fight the user's zoom.
- **The readout bar is the explanation.** 22px (16px on phones), full width at the bottom of the card, tinted with the active stage's colour. Write full sentences there, not labels.
- **Verify in code too.** `grep -c NaN` on both themes prints 0, the console stays clean through every action, and a drive exercises `H`, `F`, `0`, the wheel, a drag and each chip. A hidden browser pane reports a 0×0 stage and never fires `requestAnimationFrame`: test in a visible window, or call `nav.step(1 / 60)` by hand.
