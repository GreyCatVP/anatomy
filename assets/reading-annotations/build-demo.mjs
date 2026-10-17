import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(join(ROOT, name), 'utf8');

function parseArguments(arguments_) {
  let theme = 'light';
  let selectedTheme = null;
  let output = null;
  let positionalOnly = false;
  for (const argument of arguments_) {
    if (!positionalOnly && argument === '--') {
      positionalOnly = true;
    } else if (!positionalOnly && (argument === '--light' || argument === '--dark')) {
      const candidate = argument.slice(2);
      if (selectedTheme && selectedTheme !== candidate) throw new Error('Choose either --light or --dark.');
      selectedTheme = candidate;
      theme = candidate;
    } else {
      if (!positionalOnly && argument.startsWith('-')) throw new Error('Unknown option: ' + argument);
      if (output !== null) throw new Error('Provide one output HTML path.');
      output = argument;
    }
  }
  return {theme, output:output === null ? join(tmpdir(), 'anatomy-reading-annotations-demo.html') : resolve(output)};
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message + ' Usage: node build-demo.mjs [--light | --dark] [output.html]');
  process.exit(1);
}

const configuration = {
  roots:'main [data-reader-content]',
  documentPrefix:'anatomy-reading-demo',
  storagePrefix:'anatomy-reader:v1',
  exportName:'Anatomy-reading-annotations',
};
const models = read('annotation-model.mjs').replace(/^export /gm, '') + '\n' +
  read('annotation-notes-model.mjs').replace(/^import .*\n/gm, '').replace(/^export /gm, '');
const script = 'globalThis.ANATOMY_READER_CONFIG=' + JSON.stringify(configuration) + ';\n' +
  '(() => {\n' + models + '\n' + read('annotations.js') + '\n})();\n' +
  `(() => {
    const slider=document.getElementById('demo-value');
    const render=()=>document.getElementById('demo-readout').textContent='Current value: '+slider.value;
    slider.addEventListener('input',render); render();
  })();`;
const baseCSS = `:root {
    --sans:system-ui,sans-serif;--serif:Georgia,serif;--mono:ui-monospace,monospace;
    --demo-bg:#f8f7f2;--demo-text:#333b43;--demo-title:#2a342f;--demo-link:#735c3b;
    --demo-muted:#716043;--demo-border:#ded6c7;--demo-code-bg:#eeece4;--demo-lab-bg:#fffdf7;--demo-accent:#806200;
    color-scheme:light
  }
  [data-theme="dark"] {
    --demo-bg:#1c201e;--demo-text:#e5e8df;--demo-title:#f2f1e8;--demo-link:#e5c794;
    --demo-muted:#cdb88f;--demo-border:#515a4f;--demo-code-bg:#2a3029;--demo-lab-bg:#272e27;--demo-accent:#efcf7b;
    color-scheme:dark
  }
  *{box-sizing:border-box}body{margin:0;background:var(--demo-bg);color:var(--demo-text);font:16px/1.95 var(--sans)}
  main{max-width:780px;padding:56px 28px 140px;margin:auto}h1{font:36px/1.4 var(--serif);color:var(--demo-title)}
  h2{font:24px/1.5 var(--serif);margin-top:44px}p{margin:20px 0}a{color:var(--demo-link)}
  .eyebrow{font:10px var(--mono);letter-spacing:.15em;color:var(--demo-muted)}table{border-collapse:collapse;width:100%;font-size:14px}
  th,td{border-bottom:1px solid var(--demo-border);text-align:left;padding:10px}pre{background:var(--demo-code-bg);padding:16px;white-space:pre-wrap}
  .lab{padding:18px;border:1px solid var(--demo-border);margin:30px 0;background:var(--demo-lab-bg)}input[type=range]{width:100%;accent-color:var(--demo-accent)}
  details{border-top:1px solid var(--demo-border);padding:14px 0}summary{cursor:pointer}button,textarea,select{font:inherit}
  @media(max-width:600px){main{padding:30px 20px 120px}h1{font-size:29px}}`;
const ui = read('annotations-ui.html');
const license = read('../../LICENSE');
const html = `<!doctype html><html lang="en" data-theme="${options.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anatomy · Reading annotations</title><style>${baseCSS}\n${read('annotations.css')}</style></head><body><main><section id="reading-demo" data-reader-content><p class="eyebrow">ANATOMY / OFFLINE READING ADDON</p><h1>Keep your thoughts beside the text.</h1><p>Select some words and try <strong>underline, red text, or highlight</strong>. You can combine all three styles, including across bold text, without changing the surrounding layout.</p><p>Click marked text to add a note. Click it again to read or edit the note. The Reading annotations button lists every mark and saved note.</p><p>Unicode sample: 中文标点、空格 and emoji 🧠 keep their original positions.</p><h2 id="persistence">How do marks and notes travel?</h2><table><thead><tr><th>Method</th><th>Purpose</th></tr></thead><tbody><tr><td>Browser storage</td><td>Continue reading in the same browser.</td></tr><tr><td>Annotated HTML export</td><td>Keep a standalone offline copy with marks, notes, and page interactions.</td></tr></tbody></table><p>Clear affects only the selected range. A note remains while some of its text is still marked. Removing all of its marks also removes the note; Undo restores both.</p><details><summary>Open this extra paragraph and add a note</summary><p>After saving a note, collapse this section. Open the annotation list and select its mark: the page opens the section before scrolling to this paragraph.</p></details><pre><code>Mark = stable text positions + styles\nNote = stable text positions + plain text</code></pre><p>Existing links keep their behavior, such as <a href="#persistence">returning to the storage table</a>. To add a note to linked text, use its entry in the annotation list.</p><div class="lab"><h3>Page interactions stay usable</h3><label for="demo-value">Change this value</label><input id="demo-value" type="range" min="0" max="10" value="4"><output id="demo-readout"></output><p>This dynamic area is excluded from persistent text anchors. Exported copies reopen it at its initial value.</p></div></section></main>${ui}<script type="text/plain" id="anatomy-toolkit-license">${license.replace(/<\/script/gi, '<\\/script')}</script><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
mkdirSync(dirname(options.output), {recursive:true});
writeFileSync(options.output, html);
console.log('Built standalone annotation demo (' + options.theme + '): ' + options.output);
