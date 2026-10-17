import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnnotations, applyAnnotations } from './annotation-model.mjs';

const blocks = new Map([['a', 'abcdefghij'], ['b', '第二段文字']]);
const record = (block, start, end, styles, map = blocks) => ({
  block, start, end, styles, quote: map.get(block).slice(start, end)
});

test('overlapping annotations form disjoint intervals with unioned styles', () => {
  const saved = [record('a', 1, 6, 1), record('a', 4, 8, 2), record('a', 8, 9, 2)];
  assert.deepEqual(normalizeAnnotations(saved, blocks), [
    record('a', 1, 4, 1), record('a', 4, 6, 3), record('a', 6, 9, 2)
  ]);
});

test('nested clear removes selected flags and preserves surrounding fragments', () => {
  const saved = [record('a', 0, 10, 3), record('a', 2, 8, 4)];
  assert.deepEqual(applyAnnotations(saved, [{block:'a', start:4, end:6}], 0, blocks), [
    record('a', 0, 2, 3), record('a', 2, 4, 7),
    record('a', 6, 8, 7), record('a', 8, 10, 3)
  ]);
});

test('cross-block selection adds a style independently in document block order', () => {
  const saved = [record('b', 0, 2, 2), record('a', 1, 3, 1)];
  const selections = [{block:'b', start:0, end:4}, {block:'a', start:2, end:5}];
  const expected = [record('a', 1, 2, 1), record('a', 2, 3, 5),
    record('a', 3, 5, 4), record('b', 0, 2, 6), record('b', 2, 4, 4)];
  assert.deepEqual(applyAnnotations(saved, selections, 4, blocks), expected);
  assert.deepEqual(applyAnnotations(expected, selections, 4, blocks), expected);
});

test('Chinese text and emoji use DOM-compatible UTF-16 offsets', () => {
  const chinese = new Map([['zh', '注意力😀机制']]);
  assert.equal(chinese.get('zh').length, 7);
  assert.deepEqual(applyAnnotations([], [{block:'zh', start:3, end:7}], 2, chinese), [
    {block:'zh', start:3, end:7, styles:2, quote:'😀机制'}
  ]);
});

test('corrupted saved records and stale quotes are discarded without moving anchors', () => {
  const valid = record('a', 2, 4, 1);
  const bad = [null, false, 'bad', {}, [], {...valid, block:'missing'},
    {...valid, start:-1}, {...valid, start:2.1}, {...valid, start:'2'},
    {...valid, end:100}, {...valid, end:2}, {...valid, styles:0},
    {...valid, styles:8}, {...valid, styles:'1'}, {...valid, quote:'cd changed'},
    {...valid, quote:undefined}, {...valid, start:NaN}, {...valid, end:Infinity}];
  assert.deepEqual(normalizeAnnotations([...bad, valid], blocks), [valid]);
  assert.deepEqual(normalizeAnnotations({records:[valid]}, blocks), []);
  assert.deepEqual(normalizeAnnotations([valid], {}), []);
});

test('malformed selections cannot change valid annotations', () => {
  const saved = [record('a', 0, 2, 1)];
  const invalid = [{block:'a', start:0, end:20}, {block:'a', start:1, end:1},
    {block:'missing', start:0, end:1}, {block:'a', start:0.5, end:1}, null];
  assert.deepEqual(applyAnnotations(saved, invalid, 2, blocks), saved);
  assert.deepEqual(applyAnnotations(saved, [{block:'a', start:0, end:1}], 3, blocks), saved);
  assert.deepEqual(applyAnnotations(saved, null, 2, blocks), saved);
});

test('normalization and edits leave caller records and selections unchanged', () => {
  const saved = Object.freeze([Object.freeze(record('a', 0, 5, 1))]);
  const selected = Object.freeze([Object.freeze({block:'a', start:2, end:8})]);
  assert.deepEqual(applyAnnotations(saved, selected, 2, blocks), [
    record('a', 0, 2, 1), record('a', 2, 5, 3), record('a', 5, 8, 2)
  ]);
  assert.deepEqual(saved, [record('a', 0, 5, 1)]);
});

test('bounded input inspection prevents an unbounded saved payload', () => {
  const bad = new Array(10000).fill(null);
  assert.deepEqual(normalizeAnnotations([...bad, record('a', 0, 1, 1)], blocks), []);
  const selections = new Array(1000).fill(null);
  assert.deepEqual(applyAnnotations([], [...selections, {block:'a', start:0, end:1}], 1, blocks), []);
});

test('deterministic mixed edits agree with independent per-character style bookkeeping', () => {
  let seed = 512;
  const random = maximum => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed % maximum;
  };
  const oracle = new Map([...blocks].map(([block, text]) => [block, Array(text.length).fill(0)]));
  let saved = [];
  for (let step = 0; step < 120; step++) {
    const style = [0, 1, 2, 4][random(4)];
    const selections = Array.from({length:1 + random(4)}, () => {
      const block = random(2) ? 'a' : 'b';
      const start = random(blocks.get(block).length);
      return {block, start, end:start + 1 + random(blocks.get(block).length - start)};
    });
    for (const selection of selections) {
      const flags = oracle.get(selection.block);
      for (let i = selection.start; i < selection.end; i++) flags[i] = style ? flags[i] | style : 0;
    }
    saved = applyAnnotations(saved, selections, style, blocks);
    const expected = [];
    for (const [block, flags] of oracle) {
      for (let start = 0; start < flags.length;) {
        let end = start + 1;
        while (end < flags.length && flags[end] === flags[start]) end++;
        if (flags[start]) expected.push(record(block, start, end, flags[start]));
        start = end;
      }
    }
    assert.deepEqual(saved, expected, `style state after edit ${step}`);
    assert.deepEqual(normalizeAnnotations(saved, blocks), expected, `normal form after edit ${step}`);
  }
});
