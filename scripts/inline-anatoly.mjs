import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = join(HERE, "..", "kit");

// The helper kit as page source: one `ANATOLY` object, so nothing collides
// with Anatomy's kitScript() or glScript() in the same module script.
// Use it as `script: kitScript() + anatolyScript() + live`, and call
// ANATOLY.shakeAt(...), ANATOLY.outcomeOf(...), ANATOLY.yawRing(...) in live code.
export function anatolyScript() {
  const source = readFileSync(join(KIT, "anatoly.mjs"), "utf8");
  const names = [...source.matchAll(/^export\s+(?:function|const|let)\s+([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
  const body = source.replace(/^export\s+(?=function|const|let)/gm, "");
  return `const ANATOLY = (() => {\n${body}\nreturn { ${names.join(", ")} };\n})();\n`;
}

// The repair and tag colours, for a <style> in the page body:
// body: `<style>${anatolyCss()}</style>` + plateHtml({ ... }).
export function anatolyCss() {
  return readFileSync(join(KIT, "anatoly.css"), "utf8").trim();
}
