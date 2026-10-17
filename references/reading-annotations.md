# Optional reading annotations

Use this mode when a reader wants to mark or comment on the prose of a
standalone learning HTML. Keep the lesson and its existing figure controls
intact. Do not add an annotation interface to every Anatomy figure.

## Reusable starter

`assets/reading-annotations/` contains an adaptable, framework-free starter:

| File | Role |
|---|---|
| `annotation-model.mjs` | Pure interval model for underline, red text and highlight. |
| `annotation-notes-model.mjs` | Plain-text notes, independent anchors and saved-state validation. |
| `annotations.js` | Text selection, DOM wrapping, editor, persistence and export runtime. |
| `annotations.css` | Reading toolbar, mark styles, note editor and list. |
| `annotations-ui.html` | Accessible controls and embedded-data slot. |
| `build-demo.mjs` | Local example that inlines the starter into one offline HTML. |

Run `node assets/reading-annotations/build-demo.mjs /tmp/reading-demo.html`
from the skill folder to inspect the integration pattern. The two bundled
`*.test.mjs` files run with Node's built-in test runner and need no packages.
Set optional
`globalThis.ANATOMY_READER_CONFIG` before the runtime: `roots` selects reading
containers, `excluded` overrides the full exclusion selector, `blockSelector`
selects eligible blocks, and `documentPrefix`, `storagePrefix` and `exportName`
identify this guide and its export. Adapt control IDs or names if needed. Keep
these choices together so a second guide does not share the first one's
notebook. During an existing reader upgrade, preserve its prefixes, document
fingerprint algorithm and storage key identity so saved marks remain visible.
Use skill-relative inputs; the delivered HTML must not depend on absolute paths
from the machine that generated it.

Inline the model code, runtime, CSS, UI and initial data into the final HTML.
There must be no fetch, module import, font download or server requirement at
reading time. Retain the toolkit's license notice in the portable document.

## Reader behavior

- Selecting eligible prose offers underline, red text and highlight. Styles
  combine on overlapping ranges instead of silently replacing each other.
- Clearing a selection removes styles only within that subrange. Unselected
  portions retain their marks. A note keeps its original quote and offsets
  while any marked coverage remains; removing all its marked coverage removes
  the note too, and undo restores it. Explain this in the clear-mark controls.
- Undo and redo cover marks and saved note changes. A completed note edit is
  one history operation; typing inside its textarea uses ordinary text editing.
- After marking a passage, it can receive a plain-text note.
  Clicking or activating a noted passage opens its note for viewing and editing.
- The editor shows the quoted passage, a labeled textarea and explicit save,
  cancel, delete and close controls. Deleting a note preserves the passage's
  styles. Save commits the draft; Cancel discards it. Closing with X, switching
  passages, export and page exit flush the draft to avoid losing typed notes.
- A notes list shows quotes and note previews, supports opening/editing and
  deleting entries, and jumps to the anchored passage.
- When several notes overlap a clicked segment, make each reachable rather
  than opening an arbitrary note with no way to reach the others.
- Export includes current marks and notes in a new standalone HTML, after
  committing the open editor draft. Keep status text truthful about that save.

Keep the toolbar from consuming or clearing the user's saved selection before
an action runs. Position it within the viewport without covering the selected
text whenever practical. The contextual toolbar applies styles; an explicit
reading-tools button provides stable access to the list, note editing,
history and export. Do not describe that panel as an alternate styling toolbar
unless marking actions are actually exposed there.

## Anchors and the data model

Represent an anchor with a stable block ID, half-open `start`/`end` offsets and
the exact selected quote. DOM Range offsets and JavaScript `String.slice` use
UTF-16 code units; keep the same unit throughout selection, storage and paint.
Do not change to Unicode code-point counts halfway through the pipeline.

Build each block's text from precisely the eligible text nodes, in document
order, without trimming or collapsing whitespace inside that text. A newline,
an inline code span and an emoji must have identical offsets before and after
painting. Assign blocks from stable authored IDs or a deterministic structure
within a stable section. Avoid random IDs or IDs derived from transient lab
output. Include the eligible text in the document fingerprint so edited prose
does not silently inherit offsets from an older guide.

Validate every restored anchor: known block, safe integer bounds, nonempty
range within the block, and `quote === text.slice(start, end)`. Reject or report
unmatched records; do not search for the same words elsewhere and guess a new
position. Duplicate phrases are common in a technical lesson.

Store style intervals and notes separately. Styles are normalized into ordered,
nonoverlapping intervals with flags for underline, red and highlight. Notes
have persistent IDs, plain-text content and their own anchor or anchors. A
style interval may split, merge or disappear as its appearance changes; this
must not alter note identity, detach its text or duplicate it. On partial
clearing, retain the note's full original anchors while any style coverage
remains; only remove it when every anchor has no marked coverage left.
Split paint runs at style and note boundaries, associating each rendered run
with the note IDs that overlap it. Do not use ephemeral span IDs as storage
anchors. A cross-block selection needs a separate valid anchor in each block.

Version the payload. When upgrading an older notes-less `version: 1` payload,
retain its valid style records and initialize an empty notes collection. Keep
the same document and notebook identity so existing browser annotations remain
discoverable. Validate both embedded data and browser data before choosing or
migrating them. Bound record counts and text sizes to keep malformed imports
from making the page unusable. Migration should be deterministic and should
not rewrite unrelated lesson content.

## Paint without breaking the lesson

Limit the scope to static reading prose: headings, paragraphs, lists, table
cells and explanatory captions as appropriate for this page. Exclude dynamic
labs, SVG, MathML, canvas, script/style content, form controls, editable content
and the annotation UI. A live numerical readout must not become an anchor.

Use a text-node walker and wrap only the selected text slices. Preserve the
original inline DOM nodes, links, emphasis, code spans and attached listeners.
Do not replace a whole paragraph's `innerHTML`, flatten its `textContent` or use
`Range.surroundContents` across arbitrary nested elements. On repaint, unwrap
only wrappers owned by the annotation layer, then rebuild from the stable
text offsets. The page's prose and node ordering must remain unchanged.

Use text nodes or `textContent` for quotes, previews and note content. Treat a
note containing `<img>`, `<script>` or `</script>` as literal reader text, never
as HTML. Inline payload JSON must escape `<`, for example with
`JSON.stringify(data).replace(/</g, '\\u003c')`, before insertion into an inert
`<script type="application/json">` slot. This prevents the HTML parser from
ending that slot at a note's `</script>` sequence.

Keep native links as links instead of nesting another focusable button in
them. Offer note editing for marked link text through the reading list.

## Persistence and a portable export

Browser storage is a convenience, not the portable artifact. Key localStorage
by the document fingerprint and notebook identity; compare validated revision
timestamps only within that identity. Preserve reading state in memory if a
storage read or write fails. Show a truthful status such as “local save is
unavailable; export to retain your notes”, rather than reporting autosave.
Distinguish invalid/stale data from a storage-access error.

Capture a pristine document template before the teaching application mounts,
adds runtime DOM, renders figures or registers its live state. The capture
must already contain the complete inline scripts, styles, annotation UI, data
slot and required toolkit license notice. Serialize from that template with
the saved annotation payload substituted into its data slot. Capturing after
initialization can export duplicate mounted controls or SVGs and cause them
to initialize a second time when reopened.

Give each exported notebook copy a fresh notebook identity, with its saved
state embedded in the HTML. Reopening it in a browser that holds older notes
must show the exported notes first, not override them with unrelated or stale
localStorage. Subsequent edits of that copy can autosave under its own key.
Do not make portability depend on a neighboring JSON file or the generator.

## Keyboard, touch and navigation

Use actual buttons and labeled inputs. A noted passage must be keyboard
focusable, with Enter or Space opening the editor and an accessible name that
indicates a note exists. Escape closes overlays and restores focus to a useful
origin; Escape cancels the current unsaved note draft. Explicit Save and Close
should return focus to a visible mark; switching/export should not steal focus.
Visible focus must survive mark styling. Do not intercept undo/redo or
other editing shortcuts while a textarea, input or editable field is focused.

Avoid forcing pointer selection on touch devices. Leave the native selection
handles usable and keep the contextual toolbar reachable after text selection.
Existing marks must remain selectable with a mouse so styles can be combined.
Restore their keyboard access when a mouse gesture ends or is cancelled.
Keep editor and list controls usable at a narrow viewport. Before jumping to a
note, open any containing collapsed `details`, then scroll the passage into
view and announce or focus the target without changing its content.

## Verify the integrated result

Test the pure models and a real DOM/parser integration; a screenshot cannot
prove anchor correctness, preservation of listeners or an executable export.

- Cover nested inline elements, punctuation, whitespace, repeated quotes,
  Chinese and emoji; verify exact offsets and unchanged block text.
- Cover overlapping style combinations, subrange clearing and repeated paint.
  Check notes retain full anchors through splits/merges and partial removal;
  full coverage removal and undo/redo must apply the documented note policy.
- Add, edit, delete and reopen notes through marks and the list. Verify
  overlapping notes and notes inside collapsed sections remain reachable.
- Load an older version-1 notes-less payload and confirm marks survive.
  Exercise malformed/stale anchors and disabled or failing localStorage.
- Export notes containing HTML-like text and `</script>`; parse the whole HTML
  and execute its inline scripts in a fresh DOM. Reopen and re-export it with
  conflicting browser storage. Verify notes, marks and source text round-trip.
- Confirm there is one initialized instance of each lesson control and that
  original event listeners and 2D/3D interactions still work after painting.
- Inspect desktop and narrow-screen appearance and exercise keyboard/touch
  paths in a browser where available. Describe model/DOM checks as such;
  claim visual or browser interaction verification only when actually run.
