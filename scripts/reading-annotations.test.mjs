import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {JSDOM, VirtualConsole} = require('jsdom');
const builder = fileURLToPath(new URL('../assets/reading-annotations/build-demo.mjs', import.meta.url));

function openPage(html, stored = []) {
  const errors = [];
  const exports = [];
  const scrolls = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, {
    url:'https://anatomy.test/reading-annotations.html',
    runScripts:'dangerously',
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = query => ({matches:false, media:query,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
      window.Range.prototype.getBoundingClientRect = () => ({left:100, right:300, top:100,
        bottom:125, width:200, height:25});
      window.HTMLElement.prototype.scrollIntoView = function () { scrolls.push(this); };
      window.Blob = globalThis.Blob;
      window.URL.createObjectURL = blob => { exports.push(blob); return 'blob:anatomy-export'; };
      window.URL.revokeObjectURL = () => {};
      const click = window.HTMLAnchorElement.prototype.click;
      window.HTMLAnchorElement.prototype.click = function () {
        if (!this.download) click.call(this);
      };
      for (const [key, value] of stored) window.localStorage.setItem(key, value);
    },
  });
  assert.deepEqual(errors, [], 'the complete inline app executes without errors');
  return {window:dom.window, document:dom.window.document, exports, scrolls, errors,
    close:() => dom.window.close()};
}

function firstParagraph(page) {
  return page.document.querySelector('main [data-reader-content] > p:not(.eyebrow)');
}

function selectText(page, element, start, end) {
  const {window} = page;
  const walker = page.document.createTreeWalker(element, window.NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let node; (node = walker.nextNode());) nodes.push(node);
  const point = offset => {
    let previous = 0;
    for (const node of nodes) {
      if (offset <= previous + node.data.length) return [node, offset - previous];
      previous += node.data.length;
    }
    throw new Error('Selection offset is outside the paragraph: ' + offset);
  };
  const range = page.document.createRange();
  range.setStart(...point(start));
  range.setEnd(...point(end));
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  page.document.dispatchEvent(new window.Event('selectionchange'));
  return range;
}

function click(page, selector) {
  const element = page.document.querySelector(selector);
  assert.ok(element, 'element exists: ' + selector);
  element.click();
  return element;
}

function action(page, kind) {
  assert.equal(page.document.getElementById('reader-tools').hidden, false);
  click(page, '[data-annotation-action="' + kind + '"]');
}

function storedEntry(page) {
  const storage = page.window.localStorage;
  const key = Array.from({length:storage.length}, (_, i) => storage.key(i))
    .find(value => value.startsWith('anatomy-reader:v1:'));
  return key ? [key, storage.getItem(key)] : null;
}

function snapshot(page) {
  const entry = storedEntry(page);
  return entry ? JSON.parse(entry[1]) : {records:[], notes:[]};
}

function markParagraph(page, start = 0, end = 24, kind = 'highlight') {
  const paragraph = firstParagraph(page);
  selectText(page, paragraph, start, end);
  action(page, kind);
  return paragraph;
}

function saveNote(page, text) {
  click(page, '[data-reader-mark][role="button"]');
  page.document.getElementById('reader-note-text').value = text;
  click(page, '#reader-note-save');
}

function withSeed(html, seed) {
  return html.replace(/(<script type="application\/json" id="reader-annotation-data">)[\s\S]*?(<\/script>)/,
    (_, before, after) => before + JSON.stringify(seed).replace(/</g, '\\u003c') + after);
}

function keyboard(page, element, key, options = {}) {
  element.dispatchEvent(new page.window.KeyboardEvent('keydown', {key, bubbles:true,
    cancelable:true, ...options}));
}

for (const theme of ['light', 'dark']) {
  test('standalone reading annotations: ' + theme, async t => {
    const directory = mkdtempSync(join(tmpdir(), 'anatomy-reading-tests-'));
    const output = join(directory, theme + '.html');
    const arguments_ = theme === 'dark' ? [builder, '--dark', output] : [builder, output];
    execFileSync(process.execPath, arguments_, {encoding:'utf8'});
    const html = readFileSync(output, 'utf8');
    t.after(() => rmSync(directory, {recursive:true, force:true}));
    const pageFor = (subtest, source = html, stored = []) => {
      const page = openPage(source, stored);
      subtest.after(() => {
        const errors = [...page.errors];
        page.close();
        assert.deepEqual(errors, [], 'no script or navigation errors occurred');
      });
      return page;
    };

    await t.test('build is offline, has unique IDs, and carries its license before the app', subtest => {
      const page = pageFor(subtest);
      const {document} = page;
      assert.equal(document.documentElement.dataset.theme, theme);
      const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(document.querySelectorAll('script[src],link[rel="stylesheet"]').length, 0);
      assert.doesNotMatch([...document.querySelectorAll('style')].map(style => style.textContent).join('\n'), /@import\b|url\(\s*["']?https?:/i);
      const license = document.getElementById('anatomy-toolkit-license');
      assert.match(license.textContent, /MIT License[\s\S]*Copyright[\s\S]*Permission is hereby granted/);
      assert.equal(license.type, 'text/plain');
      const app = [...document.scripts].find(script => script.textContent.includes('globalThis.ANATOMY_READER_CONFIG='));
      assert.ok(license.compareDocumentPosition(app) & page.window.Node.DOCUMENT_POSITION_FOLLOWING);
      assert.match(document.getElementById('reader-status').textContent, /autosave is ready/i);
      assert.equal(document.getElementById('reader-notes-toggle').hidden, false);
    });

    await t.test('real cross-bold selections combine styles and preserve inline nodes and listeners', subtest => {
      const page = pageFor(subtest);
      const paragraph = firstParagraph(page);
      const text = paragraph.textContent;
      const strong = paragraph.querySelector('strong');
      let originalClicks = 0;
      strong.addEventListener('click', () => originalClicks++);
      const start = text.indexOf('words');
      const end = text.indexOf('red text') + 'red text'.length;
      const range = selectText(page, paragraph, start, end);
      assert.notEqual(range.startContainer, range.endContainer);
      assert.equal(range.endContainer.parentElement, strong);
      assert.equal(page.document.getElementById('reader-selection-count').textContent, (end - start) + ' characters selected');
      for (const [kind, styles] of [['underline', 1], ['red', 3], ['highlight', 7]]) {
        selectText(page, paragraph, start, end);
        action(page, kind);
        assert.deepEqual(snapshot(page).records.map(record => ({start:record.start, end:record.end,
          quote:record.quote, styles:record.styles})), [{start, end, quote:text.slice(start, end), styles}]);
      }
      assert.equal(paragraph.textContent, text);
      assert.equal(paragraph.querySelector('strong'), strong);
      strong.click();
      assert.equal(originalClicks, 1);
      assert.ok([...paragraph.querySelectorAll('[data-reader-mark]')]
        .every(mark => mark.classList.contains('reader-underline') && mark.classList.contains('reader-red') && mark.classList.contains('reader-highlight')));
      const unicode = [...page.document.querySelectorAll('[data-reader-block]')]
        .find(element => element.textContent.startsWith('Unicode sample:'));
      const unicodeStart = unicode.textContent.indexOf('🧠');
      const unicodeEnd = unicodeStart + '🧠 keep'.length;
      selectText(page, unicode, unicodeStart, unicodeEnd);
      action(page, 'red');
      const saved = snapshot(page).records.find(record => record.block === unicode.dataset.readerBlock);
      assert.equal(saved.quote, '🧠 keep');
      assert.equal(saved.end - saved.start, 7);
      assert.match(page.document.getElementById('reader-status').textContent, /saved automatically/i);
    });

    await t.test('notes add, edit, delete, undo, and redo without removing their marks', subtest => {
      const page = pageFor(subtest);
      markParagraph(page);
      saveNote(page, 'An initial explanation');
      const original = snapshot(page).notes[0];
      assert.equal(original.text, 'An initial explanation');
      assert.equal(page.document.getElementById('reader-note-editor').hidden, true);
      saveNote(page, 'An edited explanation');
      assert.equal(snapshot(page).notes[0].id, original.id);
      assert.equal(snapshot(page).notes[0].text, 'An edited explanation');
      click(page, '#reader-undo');
      assert.equal(snapshot(page).notes[0].text, original.text);
      click(page, '#reader-redo');
      assert.equal(snapshot(page).notes[0].text, 'An edited explanation');
      click(page, '[data-reader-mark][role="button"]');
      page.document.getElementById('reader-note-delete').focus();
      click(page, '#reader-note-delete');
      assert.equal(snapshot(page).notes.length, 0);
      assert.equal(snapshot(page).records.length, 1);
      const focusedMark = page.document.activeElement;
      assert.ok(focusedMark.matches('[data-reader-mark][role="button"]'), 'deleting a note returns focus to marked text');
      assert.equal(focusedMark.closest('[hidden]'), null, 'focus does not remain inside the hidden editor');
      click(page, '#reader-undo');
      assert.equal(snapshot(page).notes[0].text, 'An edited explanation');
      click(page, '#reader-redo');
      assert.equal(snapshot(page).notes.length, 0);
      assert.equal(snapshot(page).records.length, 1);
    });

    await t.test('partial clear retains the full note anchor and full clear can be undone', subtest => {
      const page = pageFor(subtest);
      const paragraph = markParagraph(page, 0, 30);
      saveNote(page, 'Keep the entire context');
      const original = snapshot(page).notes[0];
      selectText(page, paragraph, 8, 20);
      action(page, 'clear');
      assert.equal(snapshot(page).records.length, 2);
      assert.deepEqual(snapshot(page).notes, [original]);
      selectText(page, paragraph, 0, 30);
      action(page, 'clear');
      assert.equal(snapshot(page).records.length, 0);
      assert.equal(snapshot(page).notes.length, 0);
      click(page, '#reader-undo');
      assert.equal(snapshot(page).records.length, 2);
      assert.deepEqual(snapshot(page).notes, [original]);
    });

    await t.test('overlapping notes stay independently editable when style spans split and merge', subtest => {
      const page = pageFor(subtest);
      const paragraph = markParagraph(page, 0, 30);
      saveNote(page, 'First explanation');
      click(page, '[data-reader-mark][role="button"]');
      const choice = page.document.getElementById('reader-note-choice');
      choice.value = '__new__';
      choice.dispatchEvent(new page.window.Event('change', {bubbles:true}));
      page.document.getElementById('reader-note-text').value = 'Second explanation';
      click(page, '#reader-note-save');
      const original = snapshot(page).notes;
      assert.equal(original.length, 2);
      assert.notEqual(original[0].id, original[1].id);
      assert.equal(original[0].quote, original[1].quote);
      selectText(page, paragraph, 10, 20);
      action(page, 'red');
      assert.equal(snapshot(page).records.length, 3);
      selectText(page, paragraph, 0, 30);
      action(page, 'red');
      assert.equal(snapshot(page).records.length, 1);
      assert.deepEqual(snapshot(page).notes, original);
      click(page, '[data-reader-mark][role="button"]');
      assert.equal(choice.hidden, false);
      choice.value = original[1].id;
      choice.dispatchEvent(new page.window.Event('change', {bubbles:true}));
      assert.equal(page.document.getElementById('reader-note-text').value, 'Second explanation');
      page.document.getElementById('reader-note-text').value = 'Only the second explanation changes';
      click(page, '#reader-note-save');
      assert.deepEqual(snapshot(page).notes[0], original[0]);
      assert.deepEqual(snapshot(page).notes[1], {...original[1], text:'Only the second explanation changes'});
    });

    await t.test('export saves the active draft and reopens annotations with fresh storage and live controls', async subtest => {
      const page = pageFor(subtest);
      markParagraph(page);
      const slider = page.document.getElementById('demo-value');
      slider.value = '9';
      slider.dispatchEvent(new page.window.Event('input', {bubbles:true}));
      assert.match(page.document.getElementById('demo-readout').textContent, /9$/);
      click(page, '[data-reader-mark][role="button"]');
      page.document.getElementById('reader-note-text').value = 'A draft kept by export';
      click(page, '#reader-export-html');
      assert.equal(page.exports.length, 1);
      assert.equal(snapshot(page).notes[0].text, 'A draft kept by export');
      const exported = await page.exports[0].text();
      const reopened = pageFor(subtest, exported);
      assert.equal(reopened.window.localStorage.length, 0);
      assert.equal(reopened.document.querySelectorAll('[data-reader-mark]').length > 0, true);
      click(reopened, '[data-reader-mark][role="button"]');
      assert.equal(reopened.document.getElementById('reader-note-text').value, 'A draft kept by export');
      const portable = JSON.parse(reopened.document.getElementById('reader-annotation-data').textContent);
      assert.notEqual(portable.notebookId, snapshot(page).notebookId);
      const originalSlider = reopened.document.getElementById('demo-value');
      assert.equal(originalSlider.value, '4');
      assert.match(reopened.document.getElementById('demo-readout').textContent, /4$/);
      originalSlider.value = '7';
      originalSlider.dispatchEvent(new reopened.window.Event('input', {bubbles:true}));
      assert.match(reopened.document.getElementById('demo-readout').textContent, /7$/);
      assert.match(reopened.document.getElementById('reader-status').textContent, /saved automatically/i);
    });

    await t.test('version 1 seeds without notes still load', subtest => {
      const original = pageFor(subtest);
      markParagraph(original);
      const seed = snapshot(original);
      delete seed.notes;
      const page = pageFor(subtest, withSeed(html, seed));
      assert.ok(page.document.querySelector('[data-reader-mark]'));
      assert.match(page.document.getElementById('reader-comment-count').textContent, /0 notes/);
      click(page, '[data-reader-mark][role="button"]');
      assert.equal(page.document.getElementById('reader-note-text').value, '');
      assert.match(page.document.getElementById('reader-status').textContent, /saved automatically/i);
    });

    await t.test('corrupt newer storage preserves a valid portable seed but a newer empty clear wins', subtest => {
      const original = pageFor(subtest);
      markParagraph(original);
      saveNote(original, 'Portable explanation');
      const seed = snapshot(original);
      const [key] = storedEntry(original);
      const seededHTML = withSeed(html, seed);
      const corrupt = {...seed, updatedAt:seed.updatedAt + 100,
        records:seed.records.map(record => ({...record, quote:'A stale quote'}))};
      const page = pageFor(subtest, seededHTML, [[key, JSON.stringify(corrupt)]]);
      assert.ok(page.document.querySelector('[data-reader-mark]'));
      click(page, '[data-reader-mark][role="button"]');
      assert.equal(page.document.getElementById('reader-note-text').value, 'Portable explanation');
      assert.match(page.document.getElementById('reader-status').textContent, /older annotations.*no longer match/i);
      const cleared = {...seed, updatedAt:seed.updatedAt + 100, records:[], notes:[]};
      const empty = pageFor(subtest, seededHTML, [[key, JSON.stringify(cleared)]]);
      assert.equal(empty.document.querySelectorAll('[data-reader-mark]').length, 0);
      assert.equal(empty.document.getElementById('reader-empty').hidden, false);
      assert.match(empty.document.getElementById('reader-status').textContent, /autosave is ready/i);
    });

    await t.test('literal script endings and markup in notes remain inert through export', async subtest => {
      const page = pageFor(subtest);
      markParagraph(page);
      const literal = '</script><img src=x onerror="globalThis.annotationInjected = true"> & <b>plain text</b>';
      saveNote(page, literal);
      assert.equal(snapshot(page).notes[0].text, literal);
      assert.equal(page.document.querySelectorAll('img').length, 0);
      click(page, '#reader-export-html');
      const exported = await page.exports[0].text();
      assert.ok(exported.includes('\\u003c/script>'));
      const reopened = pageFor(subtest, exported);
      assert.equal(reopened.document.querySelectorAll('img').length, 0);
      assert.equal(reopened.window.annotationInjected, undefined);
      assert.equal(reopened.document.scripts.length, page.document.scripts.length);
      assert.ok(reopened.document.querySelector('.reader-edit-note').textContent.includes(literal));
      click(reopened, '[data-reader-mark][role="button"]');
      assert.equal(reopened.document.getElementById('reader-note-text').value, literal);
    });

    await t.test('excluded labs stay unmarked and existing links retain their node and behavior', subtest => {
      const page = pageFor(subtest);
      const labText = page.document.querySelector('.lab p');
      selectText(page, labText, 0, 20);
      assert.equal(page.document.getElementById('reader-tools').hidden, true);
      assert.equal(snapshot(page).records.length, 0);
      assert.equal(page.document.querySelector('.lab [data-reader-block],.lab [data-reader-mark]'), null);
      const link = page.document.querySelector('main a[href="#persistence"]');
      const paragraph = link.closest('p');
      const start = paragraph.textContent.indexOf(link.textContent);
      const end = start + link.textContent.length;
      let clicks = 0;
      link.addEventListener('click', event => { clicks++; event.preventDefault(); });
      selectText(page, paragraph, start, end);
      action(page, 'underline');
      assert.equal(paragraph.querySelector('a'), link);
      assert.equal(link.getAttribute('href'), '#persistence');
      const markedLink = link.querySelector('[data-reader-mark]');
      assert.ok(markedLink);
      assert.equal(markedLink.hasAttribute('role'), false);
      markedLink.click();
      assert.equal(clicks, 1);
      assert.equal(page.document.getElementById('reader-note-editor').hidden, true);
      click(page, '.reader-edit-note');
      assert.equal(page.document.getElementById('reader-note-editor').hidden, false);
    });

    await t.test('jumping to a mark opens collapsed details before scrolling', subtest => {
      const page = pageFor(subtest);
      const details = page.document.querySelector('main details');
      const paragraph = details.querySelector('p');
      details.open = true;
      selectText(page, paragraph, 0, 28);
      action(page, 'highlight');
      details.open = false;
      click(page, '#reader-notes-toggle');
      assert.equal(page.document.getElementById('reader-notes-panel').hidden, false);
      page.document.querySelector('.reader-jump').focus();
      click(page, '.reader-jump');
      assert.equal(details.open, true);
      assert.equal(page.document.getElementById('reader-notes-panel').hidden, true);
      assert.deepEqual(page.scrolls, [paragraph]);
      assert.ok(paragraph.contains(page.document.activeElement), 'jumping returns focus to the marked paragraph');
      assert.equal(page.document.activeElement.closest('[hidden]'), null, 'focus does not remain inside the hidden panel');
    });

    await t.test('mouse selection releases mark focus temporarily and restores keyboard access', subtest => {
      const page = pageFor(subtest);
      markParagraph(page);
      const mark = page.document.querySelector('[data-reader-mark][role="button"]');
      const pointer = (type, pointerType = 'mouse', button = 0) => {
        const event = new page.window.Event(type, {bubbles:true});
        Object.defineProperties(event, {pointerType:{value:pointerType}, button:{value:button}});
        mark.dispatchEvent(event);
      };
      for (const ending of ['pointerup', 'pointercancel', 'blur', 'keydown']) {
        assert.equal(mark.getAttribute('tabindex'), '0');
        pointer('pointerdown');
        assert.equal(mark.hasAttribute('tabindex'), false, 'native mouse selection must start on nonfocusable text');
        if (ending === 'blur') page.window.dispatchEvent(new page.window.Event('blur'));
        else if (ending === 'keydown') keyboard(page, page.document.body, 'Tab');
        else pointer(ending);
        assert.equal(mark.getAttribute('tabindex'), '0', 'keyboard access returns after ' + ending);
        mark.focus();
        assert.equal(page.document.activeElement, mark);
      }
      pointer('pointerdown', 'touch');
      assert.equal(mark.getAttribute('tabindex'), '0', 'touch selection retains native mark semantics');
      pointer('pointerup', 'touch');
      pointer('pointerdown', 'mouse', 2);
      assert.equal(mark.getAttribute('tabindex'), '0', 'context-menu clicks retain keyboard access');
    });

    await t.test('keyboard opens marked text, Escape cancels drafts, and the save shortcut commits', subtest => {
      const page = pageFor(subtest);
      markParagraph(page);
      let mark = page.document.querySelector('[data-reader-mark][role="button"]');
      mark.focus();
      keyboard(page, mark, 'Enter');
      const editor = page.document.getElementById('reader-note-editor');
      const textarea = page.document.getElementById('reader-note-text');
      assert.equal(editor.hidden, false);
      textarea.value = 'Discard this draft';
      keyboard(page, textarea, 'Escape');
      assert.equal(editor.hidden, true);
      assert.equal(snapshot(page).notes.length, 0);
      assert.equal(page.document.activeElement, mark);
      keyboard(page, mark, 'Enter');
      textarea.value = 'Keep the keyboard draft';
      keyboard(page, textarea, 'Enter', {ctrlKey:true});
      assert.equal(editor.hidden, true);
      assert.equal(snapshot(page).notes[0].text, 'Keep the keyboard draft');
      mark = page.document.querySelector('[data-reader-mark][role="button"]');
      keyboard(page, mark, ' ');
      assert.equal(editor.hidden, false);
      textarea.value = 'Discard this edit';
      click(page, '#reader-note-cancel');
      assert.equal(snapshot(page).notes[0].text, 'Keep the keyboard draft');
    });
  });
}
