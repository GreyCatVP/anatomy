# Stage navigation (default for framework-free pages)

Every framework-free page ships with the navigation below from its first version; nobody should have to ask for it. It came from a review of a six-stage process figure, where the reader reported, in order:

1. The machine is too small to read: **wheel zoom, drag pan and a wider page**.
2. Everything is grey, so hover focus barely shows: **a colour per stage**.
3. The 10.5px corner readout was missed entirely: **a large explanation bar under the drawing**.
4. During the tour you can't tell which stage is running: **a follow camera**.
5. The camera alone is not enough: **auto-highlight of the running step**, toggled like the camera.

## What applies when

| Figure | Gets |
|---|---|
| Any figure | Wheel zoom around the cursor (up to 8×), drag pan (left button, with a 4px threshold so clicks on parts still work), reset (double-click, `0`, button), `Esc` eases back to the full view, `nav.flyTo` and `nav.home`, the explanation bar, `pageHtml({ width: 1800 })` |
| A process with two or more stages | All of the above, plus stage colours, legend chips (hover = focus), hover focus on the drawing, auto-highlight (`H`, on) and the follow camera (`F`, on) |

A single-mechanism figure such as a dial gauge or a neuron has one stage, or none: keep zoom, pan, the bar and `flyTo`. `stageNavHtml` drops the chips and toggles by itself when there is only one zone. A part you want to zoom to only needs a `data-asm` name; `zoneGroup(null, asm, svg)` writes the group without a zone, so it gets no colour and no chip.

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

- `nav.flyTo(names | { x, y, w, h })` eases the view to the merged box of those assemblies (with the follow camera's 40-unit margin, at most 3.2×), or to a box in `viewBox` units (at most 8×). It turns the follow camera off, and a wheel, a drag, `F` or `0` takes over from it. An unknown name throws.
- `nav.home()` eases back to the full view; `Esc` calls it. `nav.reset()` jumps there.
- `zoomOnClick: true` makes a click or tap on an assembly fly to it, and a second click on it, or a click on empty space, fly home. It is off by default, because many figures already use clicks. On a phone, where the wheel and drag do nothing, this or your own `flyTo` is the only zoom, so turn it on or wire one.
- `nav.say(text)` writes the bar and skips the write when the text has not changed, so a screen reader is not interrupted every frame.

- `zoneText` maps each zone to the sentence for the bar on hover; `onHover(zone, text)` lets the figure decide what the bar shows, usually through `nav.say`. On touch, a tap keeps the focus until the next tap instead of losing it when the finger lifts.
- `shot()` returns the assemblies of the step running now, or `null` when idle (the camera eases back to the full view and the highlight clears). Use the same time thresholds as the readout text, so the bar, the glow and the camera change together.
- A name in `shot()` with no `data-asm` group throws. A typo fails loudly instead of aiming at nothing.
- `kick` restarts the figure's frame loop after a toggle or a hover.

**Build.**

```js
import { zonePalette, zoneGroup, stageNavCss, stageNavHtml, stageNavBar, stageNavScript } from "../../kit/stage-nav.mjs";
const zones = zonePalette([{ id: "intake", name: "Intake", text: "…" }, { id: "sort", name: "Sort", text: "…" }]);
const body = `<style>${stageNavCss(zones)}</style>` + k.plateHtml({ …, body: `<div class="iso-stage">${svg}</div>` + stageNavBar() }) + stageNavHtml(zones);
writeFileSync(out, k.pageHtml({ title, theme, body, script: kitScript() + stageNavScript() + live, width: 1800 }));
```

Once `plateHtml` takes `below` ([#132](https://github.com/wheresryan22/anatomy/pull/132)), pass `below: stageNavBar()` instead of appending it to `body`; the output is the same.

Stage colours are tokens (`--anatomy-stage-1` … `--anatomy-stage-8`) with dark values and light overrides. Pass `color` on a zone only to use another token. `stageNavHtml(zones, { labels })` and `installStageNav({ labels })` take the button text for other languages.

## Rules

- **Colour by stage, not as decoration.** Tops take 30% of the stage colour, sides 14% and edges 75%, mixed over the kit tones. Lit parts, status lamps and moving tokens keep their own colours: the highlight rules skip `[data-lit]`, `.lit` and their descendants. Pick token colours that don't collide with the stage they travel through.
- **Hover wins over auto.** While the pointer is on a stage or a legend chip, hover focus shows; auto-highlight returns when it leaves.
- **The user takes over.** Any wheel or drag turns the follow camera off; `F` or the button turns it back on. Never fight the user's zoom.
- **The bar is the explanation; the corner readout is the value.** The bar (`stageNavBar()`) is 22px (16px on phones), full width under the drawing, tinted with the active stage's colour and `aria-live="polite"`. Write full sentences there. The corner `[data-readout]` stays the kit's short value (`h = relu(…) = 1.34`); it sits in `aria-hidden` corners, so never put the explanation there.
- **Dim by tone, not opacity.** Unfocused stages pull every kit tone 82% (78% under auto-highlight) towards the card colour, so their fills stay opaque and overlapping parts do not show through each other. Colours written as literals in a part, not as kit tokens, are not dimmed.
- **A zoomed drawing is clipped.** While the view is smaller than the `viewBox`, the SVG gets `data-zoomed` and `overflow:hidden`, so it never paints over the title, legend or caption. At the full view it stays `overflow:visible` as the kit sets it.
- **Verify in code too.** `grep -c NaN` on both themes prints 0, the console stays clean through every action, and a drive exercises `H`, `F`, `0`, the wheel, a drag and each chip. A hidden browser pane reports a 0×0 stage and never fires `requestAnimationFrame`: test in a visible window, or call `nav.step(1 / 60)` by hand.
