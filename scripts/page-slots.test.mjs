import assert from "node:assert/strict";
import test from "node:test";
import { pageHtml, plateHtml } from "../kit/iso-kit.mjs";

const card = { fig: "Fig 1", body: "<svg></svg>" };

test("plateHtml puts below inside the card, right after body", () => {
  const html = plateHtml({ ...card, below: "<p>bar</p>", caption: "text" });
  assert.ok(html.includes('<svg></svg><p>bar</p></div><figcaption class="iso-legend">'));
});

test("plateHtml without below ends the card at body", () => {
  assert.ok(plateHtml(card).endsWith("<svg></svg></div></figure>"));
});

test("pageHtml adds css after the kit's rules", () => {
  const html = pageHtml({ title: "t", body: "", css: ".iso-svg{overflow:hidden}" });
  assert.ok(html.includes("margin:64px auto 96px}\n.iso-svg{overflow:hidden}</style>"));
});

test("pageHtml without css closes the style with the page rules", () => {
  assert.ok(pageHtml({ title: "t", body: "" }).includes("margin:64px auto 96px}\n</style>"));
});
