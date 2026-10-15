import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTarget } from "./safe-target.mjs";

test("a path or file URL is a local file", () => {
  assert.equal(resolveTarget("page.html").isFile, true);
  assert.match(resolveTarget("page.html").url, /^file:\/\/.*page\.html$/);
  assert.deepEqual(resolveTarget("file:///tmp/page.html"), { url: "file:///tmp/page.html", isFile: true });
});

test("localhost servers are allowed and are not treated as files", () => {
  for (const url of ["http://localhost:8000/a.html", "http://127.0.0.1:3000/", "http://[::1]:5173/"]) {
    assert.deepEqual(resolveTarget(url), { url, isFile: false });
  }
});

test("other hosts are refused unless allowed", () => {
  const exit = process.exit;
  const error = console.error;
  let code = null;
  process.exit = (value) => { code = value; throw new Error("exit"); };
  console.error = () => {};
  try {
    assert.throws(() => resolveTarget("https://example.com/"), /exit/);
    assert.equal(code, 2);
  } finally {
    process.exit = exit;
    console.error = error;
  }
  assert.deepEqual(resolveTarget("https://example.com/", true), { url: "https://example.com/", isFile: false });
});
