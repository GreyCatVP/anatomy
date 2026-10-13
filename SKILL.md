---
name: anatoly
description: Build Anatomy-style interactive isometric machines as installed by Anatoly, a plumber who has had a few. The drawing is precise; the machine is built from junk (fence posts, sticks, rope, bricks, planks, blue tape, fittings that are almost the right size) and it falls apart the first time you use it. A fork of the Anatomy skill (wheresryan22/anatomy), with its kit built in. Use this whenever someone asks to build, draw or animate any machine, mechanism, engine, device, gadget, contraption or interactive isometric figure, even if they never say broken or Anatoly. Broken is the default and nobody has to ask for it. Also use it for anything janky, wonky, bodged, jury-rigged or duct-taped, or a machine that leaks, breaks or falls apart when you use it. Only when the user explicitly asks for a clean, correct, working figure, build it as plain Anatomy.
license: MIT
compatibility: Written for Claude Code; Anatomy's kit is built in, so it also runs wherever Anatomy does (OpenCode, Codex, Antigravity). Needs Node.js 20.10+, and Chrome or Chromium for the checks.
metadata:
  opencode/slash: "true"
---

# Anatoly

Anatoly is the plumber who installs Anatomy's machines. He has had a few. He carries one roll of blue tape, a bag of fittings that are almost the right size and a pocket of zip ties, and he has somewhere else to be. Everything he builds stands up, just. Switch it on and it works for about a second. Then it falls apart.

Anatomy draws; Anatoly installs. You build with Anatomy's kit, workflow and checks (`ANATOMY.md`), and this file changes what you build.

## The one idea

**A precise drawing of an imprecise machine.** The joke lives in the object, never in the drawing. Every bodge is drawn with full Anatomy craft: solid, shaded, in true depth order, every line ending on something. A sloppy drawing reads as a bad drawing. A sloppy machine drawn precisely reads as Anatoly.

Two ways it fails:

- **Too clean.** A perfect Anatomy figure with one crack added. Nobody notices and nobody laughs.
- **Too random.** Everything jittered, tilted and noisy. It reads as a broken renderer, not a broken machine.

The fix for both: every defect is a specific thing a tired tradesman would really do, for a reason you can say in one line. Write the reason down (the ledger, below).

## Broken by default

Nobody has to ask for broken. A plain request ("build a coffee grinder", "a steam engine I can start", "an isometric printing press") gets Anatoly's install, at full strength:

- **Don't ask** whether it should be broken, don't offer a working version first, and don't tone it down on your own. Say in one line, when you size the job, that this is Anatoly's install and that it falls apart when used.
- **Built from junk.** Everything that holds the machine up or together is scrap from the yard: log or fence-post columns on breeze blocks, a plank beam with a branch lashed on, crooked sticks for braces, rope lashings and blue tape at every joint, bricks for feet, scaffold boards for a base. The machine's own parts are real, joined with the wrong things. It reads as junk at 1×, from across the room.
- **The hero bodge is structural.** The joint that carries the main load (the nozzle, the drum, the arm, the boiler) is held by tape or rope alone. Draw the proper fixings that are missing as empty holes.
- **Tape everywhere else:** over cracks, round pipe joints, holding lids, as clamps.
- **The first real use breaks it.** Works, strains, gives, falls apart: the main part tears off and the pieces fall, tumble, tip over and come to rest on the floor. Not a drip, not "works mostly". After every fix it falls apart again; the extra tape changes nothing.

Turn it down only when the user asks ("subtle", "mostly works", "a bit wonky", "realistic"). Then build **subtle**: a few bodges from the van, a first use that works, and failures that are a leak or a slip rather than a collapse. Everything else in this file applies to both.

## Setup: Anatomy is built in

This repo is a fork of [Anatomy](https://github.com/wheresryan22/anatomy), so its drawing kit, scripts and references are here too. Nothing else to install.

1. Read `ANATOMY.md` (Anatomy's own skill file) in full, then follow its workflow with the changes below. Read its references (`references/*.md`) when it tells you to, exactly as it says.
2. **Precedence.** Where this file and `ANATOMY.md` disagree, this file wins. Where this file is silent, Anatomy's rule stands.
3. Skip Anatomy's offer to publish to the Anatomy community gallery: that gallery is for Anatomy's figures.

The kit sits in `kit/`: Anatomy's (`iso-kit.mjs`, `lathe.mjs`, `tube.mjs`, `audit.mjs`, `gl.mjs` …) and Anatoly's (`anatoly.mjs`, helpers; `anatoly.css`, the repair colours). `scripts/inline-anatoly.mjs` inlines Anatoly's for the page, next to Anatomy's `scripts/inline-kit.mjs`. Import them by path, the way `examples/` do; `examples/raptor-anatoly` is a full Anatoly build to copy from.

## What stays from Anatomy: the drawing

Keep all of it. These are what make the bodges read as real:

- Solids, never wireframes. Four-tone shading, lighter tops, halos.
- Painter's order from the geometry, `A.settle` and the audit, never keys tuned by eye.
- Every line ends on a face, a line or a dot. A crack, a tape edge and a cable that came off its port all end on something too.
- Textures end on an edge or fade. Curved bodies shade smoothly.
- Nothing passes through anything. Even Anatoly drills a hole first, and you draw the hole.
- Time-based motion, the stop-when-offscreen loop, keyboard, aria, reduced motion.
- The verification habit: capture, zoom in, read every PNG, run every check to zero.
- The sizes (Figure, Hero, Epic) and the rule to say the size and time before starting.

## What Anatoly changes: the machine

| Anatomy says | Anatoly says |
|---|---|
| Every part aligns to its neighbours. | Most do. The ledger's parts don't, each on purpose and by a stated amount. |
| Every part has a job. | Every part has a job, had one, or is doing another part's job. |
| One `lit` accent: the part the reader should watch. | One `lit` accent: **the part that is about to fail.** The eye goes to the weak point before it goes. |
| Monochrome unless colour is the subject. | Monochrome plus one repair colour (blue tape, zip ties) and one tag colour (a red tag), only on Anatoly's materials. `kit/anatoly.css`. |
| At most one tiny engraved label. | At most one note in Anatoly's hand: a tag on a string, a strip of tape with `TEMP`, a sticky note saying `FIXED`. Plus the engraved maker's label if the machine had one. |
| Card: `Fig n`, title, hint, readout. | **A job ticket:** `Job 0417` at top left, the title, a deadpan hint (`press play. gently.`) and the status as the readout. |
| Truth: every number comes from the model. | **Truth about the bodge.** The model is the machine as installed: the tape's hold, the drip rate, the sag, the reel at 63% speed. Numbers stay true and short. |
| Calm, eased motion. | Calm until it gives. The give is fast but physical: gravity, a spring, a peel off the last bit of tape, a pivot on the last screw, pieces that spin, land on a rim and tip over. Never a pop, never a teleport. |
| An idle tour shows the point. | The tour shows it falling apart once, then Anatoly's fix. |

## Workflow

Anatomy's ten steps, with three added. Do the ledger and the failure script before any geometry: most of the joke is decided there.

1. **Size it** (Anatomy step 1). Add about a quarter for the bodge pass and the failures, and say so.
2. **Truth first** (step 2), for the honest machine and for how it breaks: what tape holds, how fast a taped joint drips, how far a slack cable sags, how a stretched belt slows a reel.
3. **Invent the object** (step 3). When the request names a machine or the figure is a toy or game, the machine is the subject and needs no concept behind it. It is broken by default (above); don't ask.
4. **Parts list for the honest machine** (step 4), as Anatomy would build it.
5. **Anatoly's install: the bodge ledger.** Choose the bodges and write them as data in the build with `ledger()` from `kit/anatoly.mjs`:
   - **Budget:** Figure 5–9, Hero 10–18, Epic 16–40. `ledger(...).assert()` checks it. By default the junk structure takes about half of them: the columns, the lashings, the braces, the feet, the base.
   - **Exactly one hero bodge**, readable at 1× in two seconds: the thing anyone would point at. The rest reward zooming to 4×, which is Anatomy's "two looks" again.
   - **Each entry:** `id`, `kind` (`wrong-part`, `missing`, `improvised`, `misaligned`, `worn`, `overkill`, `temporary`), `where`, `why` (one line, Anatoly's reason), `fails` (the failure it causes, if any) and `audit` (the exemptions it needs, below).
   - Pick them from `references/anatoly/bodges.md`, which has the catalogue, the recipes in kit calls and the plausibility test.
6. **The failure script.** For each thing the hint invites (a press, a drag, a key), write the chain: **works → strains → gives → settles broken**, the outcome table (which use gets which failure), and the way back (Anatoly's fix). By default the main control's table is one row, `falls-apart`, on every use. `references/anatoly/failures.md`.
7. **Plan the world and build the geometry** (steps 5–7) with every bodge switchable: `B.on(id)` picks the bodged part or the honest one, and `--honest` builds the machine as designed. Name every bodge's shapes `B.name(id, part)`.
8. **Frame it as a job ticket** (step 8, changed above). The caption under the card is Anatoly's work note, one line, signed `— A.` When the user wants no card (a game screen, a hero image), drop it: the hint and the status go wherever their own UI puts them, and the drawing still carries its one note.
9. **Make it live** (step 9) with the failure script. `references/anatoly/failures.md` has the loop.
10. **Verify** (step 10) with Anatoly's checks added: `references/anatoly/verify.md`.

## Bodge rules (short form)

- **Plausible.** Materials from Anatoly's van or the yard behind it (`references/anatoly/bodges.md`), used the way a tired tradesman really would. Physically possible: a part rests on something, a joint is held by something you can see.
- **Specific, never random.** A lean is one part at 2–5°. A wrong size is one adapter stack. Never jitter the whole figure; `handBent` is for hand-bent wire only.
- **Reasoned.** Each bodge has a why, and the model knows its effect: the drip exists because the joint is taped, the reel is slow because the belt is a rubber band.
- **Readable.** The hero at 1×, every other one in a 4× close-up. A bodge nobody can see is wasted work.
- **Drawn as well as the parts it replaces.** Tape is a real band with thickness and shading, a shim is a stack of solids, a crack runs edge to edge or fades out.
- **One drink at most, and only as a part:** a bottle cap shimming a foot, a cork in an open port. Never a prop for its own sake.
- **Anatoly lives in the work.** His voice is the ticket, the hint, the readout's phase words, the tag and the caption. Never an accent, never jokes about where he is from, and never in your replies to the user: you talk normally.

## Failure rules (short form)

- **The hint invites it; the failure answers it.** Whatever the reader is told to do is what breaks the machine.
- **It works first, briefly.** Within each use, hold long enough for the reader to believe it, strain visibly (the `lit` part shudders and sags), then give. By default every use ends in the collapse; in subtle mode the first use is the setup and works.
- **Physical, never a pop.** Gives are translations, turns about z, swaps between precomputed frames fine enough that one step moves ≤ 0.25 px, or a falling body turned on screen about a rim or a hinge (`tipAt`, `rockAt`, `turnAbout`, `layFlat`). Attacks are 40 ms or more.
- **Falls apart like junk, not like an exploded view.** Pieces let go one after another with a seeded stagger, peel off whatever held last, spin a little as they drop, land on a rim, bounce, tip over or rock flat, and end at rest in different poses. Never all at once, never straight down and upright. `references/anatoly/failures.md`, section 2.
- **Deterministic.** Outcomes come from `outcomeOf(seed, n, table)`, so the build and the checks can list every outcome a reader can reach.
- **It ends still.** A broken machine stops moving; the readout says what happened (`tape let go · 0.4 ml/s`).
- **There is always a way back.** `R` and a button labelled **call Anatoly to fix it**, shown only while something is broken, call Anatoly: the failure plays back on the same clock with no jump, and each fix adds one more band of tape (`repairsAfter`), capped.
- **Reduced motion** jumps to the end state of each outcome and still says what happened. Focus, keys and aria follow Anatomy; the live region announces phase words only.

## The audit: declare, don't silence

Anatomy's audit is there to catch drawing bugs, and a bodge is not a drawing bug. Keep every check on and declare each bodge to it:

- **The honest build passes clean**: `node build.mjs --honest --audit` ends `audit passed` with no exemptions at all.
- **The bodged build passes with only the ledger's exemptions**: `A.auditOrExit(R, P, B.auditOptions())`. An exemption that isn't in a ledger entry is a bug, so don't pass `allow`, `crowd` or `cover` by hand.
- **Each broken end state passes too**: build `--broken=<outcome>` in the pose the failure ends in and audit it. For a collapse, give every falling piece its landing `move` and audit rest, all landed, and each in-between state where the first few are down (depth states with `shares`). The audit sees pieces where they land, upright; the tip-over after is checked on the slowed contact sheet.
- **Use the audit's own words for the bodge:** a cable that came off its port is a route with that end in `free` and `limp: true`; a bracket hammered into its neighbour is `seated` with that neighbour in its `cut`; a cable zip-tied to a pipe names the tie in `touch` and shares a `bundle`; a leaning or crooked part records its true tilted shape (`A.prism`, `A.disc` or `A.extruded` with the tilted frame or turned ring), never an upright stand-in.

`references/anatoly/verify.md` has the full list and the extra checks.

## Kit additions

`kit/anatoly.mjs` is pure ESM with no imports. The same functions run in the page through `anatolyScript()`, as `ANATOLY.<name>`.

| Function | Use it for |
|---|---|
| `ledger(entries, { honest, size, failures })` | The bodge ledger: `.assert()`, `.on(id)`, `.name(id, part)`, `.auditOptions(extra)`, `.report()`, `.hero`. |
| `yawRing(points, deg, about?)` | A crooked plate, bracket or label: turn its floor ring, then `k.extrude` it. Turn its rule lines with it. |
| `leanAxis(deg, toward)`, `leanTip(base, length, deg, toward)` | A leaning post or box: `G.frameAlong(base, leanAxis(...))`, then `G.disc` or `G.prismOf`. `leanTip` is where the next part mounts. |
| `sagRoute(a, b, depth, { steps })` | A slack cable or hose between two mounts. |
| `handBent(points, amount, seed)` | Wire bent by hand. Fillet it after. |
| `adapterProfile(radii, { body, taper, lip, chamfer })` | A stack of reducers from one size to another, for `G.solidOf`. |
| `failureClock(phases)` | The phases of a failure on one clock: `.at(t)` gives `{ phase, u, done }`. |
| `shakeAt(age, { amp, hz, rise, fall })` | The shudder before the give. |
| `fallAt(age, drop, { g, bounce })` | A part that let go, falling to the floor, one small bounce. |
| `tipAt(age, from, to, { dur, bounce })` | A fallen piece tipping over about the rim it landed on, then a small bounce back. |
| `rockAt(age, amp, { hz, decay })` | A piece that landed tilted, slapping flat and rocking rim to rim. |
| `layFlat(ex, ey, dir)` | The screen turn that lays an upright body of revolution along a floor direction. |
| `turnAbout(centre, deg, pivot)` | The shift that turns a rotation about a piece's middle into one about a rim or hinge. |
| `outcomeOf(seed, n, table)`, `outcomesOf(seed, count, table)` | Which failure the n-th use gets, and every reachable sequence. |
| `repairsAfter(resets, max)` | How many extra tape bands Anatoly has added. |
| `bodgeRng(seed)`, `hashSeed(value)` | Seeded randomness for anything else. |

`scripts/inline-anatoly.mjs` exports `anatolyScript()` (the helpers as one `ANATOLY` object, safe to inline after `kitScript()` and `glScript()`) and `anatolyCss()` (the repair colours: put it in a `<style>` in the page body). Give repair solids `className: "an-repair"` and tag solids `"an-tag"` in `solidSvg`; wrap a taped tube's `tubeSvg` output in `<g class="an-repair">` to colour its rings.

## References

- `references/anatoly/bodges.md`: Anatoly's van, the catalogue of bodges by kind with kit recipes, the hero bodge, the plausibility test and a ledger example. Read it at step 5.
- `references/anatoly/failures.md`: the failure chain, kinds of give and how to draw each, timing, outcome tables, the fix and escalation, the idle tour, the readout's words, and the live loop. Read it at step 6.
- `references/anatoly/verify.md`: Anatoly's checks on top of Anatomy's. Read it at step 10.
