import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnnotationNotes, retainAnnotationNotes } from './annotation-notes-model.mjs';
import { applyAnnotations } from './annotation-model.mjs';

const blocks = new Map([['a', 'abcdefghij'], ['zh', '注意力😀机制']]);
const note = (id, block = 'a', start = 1, end = 6, text = '解释这一段') => ({
  id, block, start, end, quote:blocks.get(block).slice(start, end), text
});
const marked = (block, start, end, styles = 1) => ({
  block, start, end, styles, quote:blocks.get(block).slice(start, end)
});

test('saved and edited notes normalize as independent plain-text anchors', () => {
  const original = note('note-1');
  const edited = {...original, text:'  新解释\n第二行 <em>纯文本</em>  ', extra:'discard'};
  assert.deepEqual(normalizeAnnotationNotes([edited], blocks), [
    {...original, text:'  新解释\n第二行 <em>纯文本</em>  '}
  ]);
  assert.deepEqual(normalizeAnnotationNotes([{...original, text:''}], blocks), []);
  assert.deepEqual(normalizeAnnotationNotes([{...original, text:' \n\t　'}], blocks), []);
  assert.deepEqual(normalizeAnnotationNotes([{...original, text:'x'.repeat(10000)}], blocks), [
    {...original, text:'x'.repeat(10000)}
  ]);
});

test('malformed payloads and stale anchors are discarded without throwing or relocation', () => {
  const good = note('safe-id_1');
  const invalid = [null, false, 3, 'bad', [], {},
    {...good, id:''}, {...good, id:'<script>'}, {...good, id:'note id'},
    {...good, id:'x'.repeat(129)}, {...good, id:4},
    {...good, block:'missing'}, {...good, start:-1}, {...good, start:'1'},
    {...good, start:1.5}, {...good, start:NaN}, {...good, end:Infinity},
    {...good, end:1}, {...good, end:11}, {...good, quote:'moved'},
    {...good, quote:undefined}, {...good, text:4}, {...good, text:null},
    {...good, text:'x'.repeat(10001)}];
  assert.deepEqual(normalizeAnnotationNotes([...invalid, good], blocks), [good]);
  assert.deepEqual(normalizeAnnotationNotes({notes:[good]}, blocks), []);
  assert.deepEqual(normalizeAnnotationNotes([good], {}), []);
  assert.deepEqual(retainAnnotationNotes([good], null, blocks), []);
  assert.deepEqual(retainAnnotationNotes([good], [marked('a', 1, 6)], {}), []);
});

test('IDs are unique among valid notes; duplicate quotes may have separate notes', () => {
  const first = note('same');
  const second = {...first, text:'second'};
  const another = {...first, id:'another'};
  assert.deepEqual(normalizeAnnotationNotes([first, second, another], blocks), [first, another]);
  assert.deepEqual(normalizeAnnotationNotes([{...first, text:''}, second], blocks), [second]);
});

test('style flags, overlaps, splitting and merging never replace a note anchor', () => {
  const original = note('head-meaning', 'a', 1, 8);
  let records = [marked('a', 1, 8, 1)];
  records = applyAnnotations(records, [{block:'a', start:3, end:6}], 2, blocks);
  assert.equal(records.length, 3);
  assert.deepEqual(retainAnnotationNotes([original], records, blocks), [original]);
  records = applyAnnotations(records, [{block:'a', start:1, end:8}], 2, blocks);
  assert.equal(records.length, 1);
  assert.deepEqual(retainAnnotationNotes([original], records, blocks), [original]);
  assert.deepEqual(retainAnnotationNotes([original], [marked('a', 2, 3, 7)], blocks), [original]);
});

test('partial clear retains the entire exact note anchor; full clear removes it', () => {
  const original = note('full-context', 'a', 1, 8);
  let records = [marked('a', 1, 8, 3)];
  records = applyAnnotations(records, [{block:'a', start:2, end:7}], 0, blocks);
  assert.deepEqual(records, [marked('a', 1, 2, 3), marked('a', 7, 8, 3)]);
  assert.deepEqual(retainAnnotationNotes([original], records, blocks), [original]);
  records = applyAnnotations(records, [{block:'a', start:0, end:10}], 0, blocks);
  assert.deepEqual(retainAnnotationNotes([original], records, blocks), []);
  assert.deepEqual(retainAnnotationNotes([original], [
    marked('a', 0, 1), marked('a', 8, 10), marked('zh', 0, 7)
  ], blocks), []);
});

test('invalid or zero style records cannot keep an otherwise unmarked note', () => {
  const original = note('only-valid-coverage');
  const record = marked('a', 1, 6);
  assert.deepEqual(retainAnnotationNotes([original], [
    {...record, styles:0}, {...record, styles:8}, {...record, styles:'1'},
    {...record, quote:'stale'}, {...record, start:-1}, null
  ], blocks), []);
});

test('Chinese and emoji anchors use UTF-16 code units without changing quoted context', () => {
  const original = note('zh-note', 'zh', 3, 7, '😀 后面是机制');
  assert.equal(blocks.get('zh').length, 7);
  assert.equal(original.quote, '😀机制');
  assert.deepEqual(retainAnnotationNotes([original], [marked('zh', 5, 7, 2)], blocks), [original]);
});

test('normalization and retention copy their output and leave frozen inputs untouched', () => {
  const original = Object.freeze(note('immutable'));
  const saved = Object.freeze([original]);
  const records = Object.freeze([Object.freeze(marked('a', 1, 3, 2))]);
  const normalized = normalizeAnnotationNotes(saved, blocks);
  const retained = retainAnnotationNotes(saved, records, blocks);
  assert.deepEqual(normalized, saved);
  assert.deepEqual(retained, saved);
  assert.notEqual(normalized, saved);
  assert.notEqual(normalized[0], original);
  assert.notEqual(retained[0], original);
  retained[0].text = 'changed copy';
  assert.equal(original.text, '解释这一段');
});

test('note inspection is bounded before filtering malformed records', () => {
  const invalid = new Array(10000).fill(null);
  assert.deepEqual(normalizeAnnotationNotes([...invalid, note('over-limit')], blocks), []);
  const many = Array.from({length:10001}, (_, i) => note(`note-${i}`));
  const output = normalizeAnnotationNotes(many, blocks);
  assert.equal(output.length, 10000);
  assert.equal(output.at(-1).id, 'note-9999');
});
