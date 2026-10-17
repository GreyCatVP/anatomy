import { normalizeAnnotations } from './annotation-model.mjs';
const ANNOTATION_NOTE_LIMIT = 10000;
const ANNOTATION_NOTE_TEXT_LIMIT = 10000;
const ANNOTATION_NOTE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;


export function normalizeAnnotationNotes(notes, blockTexts) {
  if (!Array.isArray(notes) || !(blockTexts instanceof Map)) return [];
  const output = [];
  const ids = new Set();
  for (let i = 0; i < Math.min(notes.length, ANNOTATION_NOTE_LIMIT); i++) {
    const value = notes[i];
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        typeof value.id !== 'string' || !ANNOTATION_NOTE_ID.test(value.id) ||
        ids.has(value.id) || typeof value.block !== 'string' ||
        !Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end) ||
        value.start < 0 || value.start >= value.end ||
        typeof value.quote !== 'string' || typeof value.text !== 'string' ||
        value.text.length > ANNOTATION_NOTE_TEXT_LIMIT || !value.text.trim()) continue;
    const blockText = blockTexts.get(value.block);
    if (typeof blockText !== 'string' || value.end > blockText.length ||
        blockText.slice(value.start, value.end) !== value.quote) continue;
    ids.add(value.id);
    output.push({id:value.id, block:value.block, start:value.start, end:value.end,
      quote:value.quote, text:value.text});
  }
  return output;
}


export function retainAnnotationNotes(notes, records, blockTexts) {
  const validNotes = normalizeAnnotationNotes(notes, blockTexts);
  if (!validNotes.length) return [];
  const byBlock = new Map();
  for (const record of normalizeAnnotations(records, blockTexts)) {
    let spans = byBlock.get(record.block);
    if (!spans) byBlock.set(record.block, spans = []);
    spans.push(record);
  }
  return validNotes.filter(note => {
    const spans = byBlock.get(note.block);
    if (!spans) return false;
    let low = 0;
    let high = spans.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (spans[middle].end <= note.start) low = middle + 1;
      else high = middle;
    }
    return low < spans.length && spans[low].start < note.end;
  });
}
