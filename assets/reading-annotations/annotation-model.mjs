const ANNOTATION_RECORD_LIMIT = 10000;
const ANNOTATION_SELECTION_LIMIT = 1000;

function annotationRangeValid(value, blockTexts) {
  if (!value || typeof value !== 'object' || typeof value.block !== 'string') return false;
  const text = blockTexts.get(value.block);
  return typeof text === 'string' && Number.isSafeInteger(value.start) &&
    Number.isSafeInteger(value.end) && value.start >= 0 &&
    value.start < value.end && value.end <= text.length;
}

function annotationRecordsValid(records, blockTexts) {
  if (!Array.isArray(records)) return [];
  const valid = [];
  for (let i = 0; i < Math.min(records.length, ANNOTATION_RECORD_LIMIT); i++) {
    const record = records[i];
    if (annotationRangeValid(record, blockTexts) && Number.isInteger(record.styles) &&
        record.styles >= 1 && record.styles <= 7 &&
        typeof record.quote === 'string' &&
        record.quote === blockTexts.get(record.block).slice(record.start, record.end)) {
      valid.push(record);
    }
  }
  return valid;
}

function annotationSweep(records, selections, style, blockTexts) {
  const eventsByBlock = new Map();
  const addRange = (value, flags) => {
    let events = eventsByBlock.get(value.block);
    if (!events) eventsByBlock.set(value.block, events = []);
    events.push([value.start, flags, 1], [value.end, flags, -1]);
  };
  for (const record of records) addRange(record, record.styles);
  for (const selection of selections) addRange(selection, style || 8);

  const output = [];
  for (const [block, text] of blockTexts) {
    const events = eventsByBlock.get(block);
    if (!events) continue;
    events.sort((a, b) => a[0] - b[0]);
    const counts = [0, 0, 0, 0];
    let previous = events[0][0];
    let i = 0;
    while (i < events.length) {
      const point = events[i][0];
      const flags = counts[3] ? 0 :
        (counts[0] > 0 ? 1 : 0) | (counts[1] > 0 ? 2 : 0) | (counts[2] > 0 ? 4 : 0);
      if (flags && previous < point) {
        const last = output[output.length - 1];
        if (last && last.block === block && last.end === previous && last.styles === flags) {
          last.end = point;
        } else {
          output.push({block, start:previous, end:point, styles:flags});
        }
      }
      while (i < events.length && events[i][0] === point) {
        const [, flags, delta] = events[i++];
        for (let bit = 0; bit < 4; bit++) {
          if (flags & (1 << bit)) counts[bit] += delta;
        }
      }
      previous = point;
    }
  }
  return output.map(record => ({...record,
    quote:blockTexts.get(record.block).slice(record.start, record.end)}));
}


export function normalizeAnnotations(records, blockTexts) {
  if (!(blockTexts instanceof Map)) return [];
  return annotationSweep(annotationRecordsValid(records, blockTexts), [], 0, blockTexts);
}


export function applyAnnotations(records, selections, style, blockTexts) {
  if (!(blockTexts instanceof Map)) return [];
  const validRecords = annotationRecordsValid(records, blockTexts);
  const validSelections = [];
  if ([0, 1, 2, 4].includes(style) && Array.isArray(selections)) {
    for (let i = 0; i < Math.min(selections.length, ANNOTATION_SELECTION_LIMIT); i++) {
      if (annotationRangeValid(selections[i], blockTexts)) validSelections.push(selections[i]);
    }
  }
  return annotationSweep(validRecords, validSelections, style, blockTexts);
}
