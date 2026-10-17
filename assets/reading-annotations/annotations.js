(() => {
  'use strict';
  const exportTemplate = document.documentElement.outerHTML;
  const $ = id => document.getElementById(id);
  const toolbar = $('reader-tools');
  if (!toolbar) return;
  const configuration = globalThis.ANATOMY_READER_CONFIG || {};
  const panel = $('reader-notes-panel');
  const toggle = $('reader-notes-toggle');
  const excluded = configuration.excluded || '.lab,svg,math,script,style,noscript,button,input,select,textarea,summary,[contenteditable],.reader-ui';
  const blockSelector = configuration.blockSelector || 'h1,h2,h3,h4,h5,h6,p,li,td,th,caption,pre,.equation,figcaption,.legend-item,.cover-facts>span,.core-idea>span';
  const blockElements = new Map();
  const blockTexts = new Map();
  const textNodes = element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const result = [];
    for (let node; (node = walker.nextNode());) result.push(node);
    return result;
  };
  let containerIndex = 0;
  for (const container of document.querySelectorAll(configuration.roots || 'main [data-reader-content]')) {
    const containerId = container.dataset.readerId || container.id || (container.classList.contains('book-cover') ? 'cover' : 'reading-' + containerIndex);
    containerIndex++;
    let index = 0;
    for (const element of container.querySelectorAll(blockSelector)) {
      if (element.closest(excluded)) continue;
      const parentBlock = element.parentElement.closest(blockSelector);
      if (parentBlock && container.contains(parentBlock)) continue;
      const text = textNodes(element).map(node => node.data).join('');
      if (!text.trim()) continue;
      const id = containerId + ':' + String(index++).padStart(3, '0');
      element.dataset.readerBlock = id;
      blockElements.set(id, element);
      blockTexts.set(id, text);
    }
  }
  let hash = 2166136261;
  for (const [id, text] of blockTexts) {
    const value = id + '\n' + text;
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
  }
  const documentId = (configuration.documentPrefix || 'anatomy') + '-' + hash.toString(16);
  let seed = {};
  try { seed = JSON.parse($('reader-annotation-data').textContent); } catch {}
  const validSeed = seed && seed.version === 1 && (!seed.documentId || seed.documentId === documentId);
  const notebookId = validSeed && typeof seed.notebookId === 'string' ? seed.notebookId.slice(0, 120) : 'main';
  const storageKey = (configuration.storagePrefix || 'anatomy-reader:v1') + ':' + documentId + ':' + notebookId;
  function preparedSnapshot(candidate, embedded = false) {
    if (!candidate || candidate.version !== 1 || !Array.isArray(candidate.records) ||
        (candidate.notes !== undefined && !Array.isArray(candidate.notes)) ||
        (candidate.documentId !== documentId && !(embedded && !candidate.documentId)) ||
        (!embedded && (candidate.notebookId !== notebookId || !Number.isFinite(candidate.updatedAt)))) return null;
    const cleanRecords = normalizeAnnotations(candidate.records, blockTexts);
    const cleanNotes = retainAnnotationNotes(candidate.notes, cleanRecords, blockTexts);
    const usable = !(candidate.records.length && !cleanRecords.length) &&
      !(candidate.notes?.length && !cleanNotes.length);
    return {usable, data:{records:cleanRecords, notes:cleanNotes,
      updatedAt:Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : 0}};
  }
  const embeddedSnapshot = validSeed ? preparedSnapshot(seed, true) : null;
  let state = embeddedSnapshot?.data || {records:[], notes:[], updatedAt:0};
  let storageAvailable = true;
  let invalidData = Boolean((validSeed && !embeddedSnapshot) || (embeddedSnapshot && !embeddedSnapshot.usable));
  let savedRaw = null;
  try { savedRaw = localStorage.getItem(storageKey); }
  catch { storageAvailable = false; }
  try {
    if (savedRaw) {
      const stored = JSON.parse(savedRaw);
      const snapshot = preparedSnapshot(stored);
      if (!snapshot?.usable) invalidData = true;
      else if (snapshot.data.updatedAt >= state.updatedAt) state = snapshot.data;
    }
  } catch { invalidData = true; }
  let records = normalizeAnnotations(state.records, blockTexts);
  let notes = retainAnnotationNotes(state.notes, records, blockTexts);
  if (Array.isArray(state.records) && state.records.length && !records.length) invalidData = true;
  let updatedAt = Number.isFinite(state.updatedAt) ? state.updatedAt : 0;
  const undo = [], redo = [];
  let selectedRanges = [];
  let toastTimer = 0;
  let selecting = false;
  let editorAnchor = null;
  let editorClickAnchor = null;
  let editingNoteId = null;
  let mouseSelectionFocus = null;

  function restoreMouseSelectionFocus() {
    if (!mouseSelectionFocus) return;
    const {mark, tabIndex} = mouseSelectionFocus;
    mouseSelectionFocus = null;
    if (mark.isConnected) mark.setAttribute('tabindex', tabIndex);
    selecting = false;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $('reader-toast').textContent = message;
    $('reader-toast').hidden = false;
    toastTimer = setTimeout(() => { $('reader-toast').hidden = true; }, 3500);
  }
  function payload(id = notebookId) {
    return {version:1, documentId, notebookId:id, updatedAt, records, notes};
  }
  function setSaveStatus() {
    const status = $('reader-status');
    status.dataset.error = String(!storageAvailable || invalidData);
    status.textContent = !storageAvailable ? 'Local storage is unavailable. Export an annotated HTML copy to keep your work.' :
      invalidData ? 'Some older annotations no longer match this document. Recoverable marks were kept.' :
      records.length ? 'Marks and notes are saved automatically in this browser' : 'Browser autosave is ready';
  }
  function save() {
    updatedAt = Math.max(Date.now(), updatedAt + 1);
    try { localStorage.setItem(storageKey, JSON.stringify(payload())); storageAvailable = true; }
    catch { storageAvailable = false; }
    invalidData = false;
    setSaveStatus();
  }
  function resetSelection() {
    selectedRanges = [];
    toolbar.hidden = true;
    window.getSelection()?.removeAllRanges();
  }
  function paint() {
    for (const [id, element] of blockElements) {
      for (const mark of element.querySelectorAll('[data-reader-mark]')) mark.replaceWith(...mark.childNodes);
      element.normalize();
      const own = records.filter(record => record.block === id);
      if (!own.length) continue;
      let offset = 0;
      for (const node of textNodes(element)) {
        const start = offset, end = offset + node.data.length;
        offset = end;
        const spans = own.filter(record => record.start < end && record.end > start);
        if (!spans.length) continue;
        const fragment = document.createDocumentFragment();
        let cursor = start;
        for (const record of spans) {
          const from = Math.max(start, record.start), to = Math.min(end, record.end);
          if (from > cursor) fragment.append(document.createTextNode(node.data.slice(cursor - start, from - start)));
          const attached = notes.filter(note => note.block === id && note.start < record.end && note.end > record.start);
          const semanticCuts = [...new Set([record.start, record.end, ...attached.flatMap(note => [Math.max(record.start, note.start), Math.min(record.end, note.end)])])].sort((a,b) => a-b);
          const cuts = [from, ...semanticCuts.filter(point => point > from && point < to), to];
          for (let i = 0; i < cuts.length - 1; i++) {
            const a = cuts[i], b = cuts[i + 1];
            const noteIds = attached.filter(note => note.start < b && note.end > a).map(note => note.id);
            const mark = document.createElement('span');
            mark.dataset.readerMark = '';
            mark.dataset.styles = String(record.styles);
            mark.dataset.readerStart = String(semanticCuts.filter(point => point <= a).at(-1));
            mark.dataset.readerEnd = String(semanticCuts.find(point => point >= b));
            mark.dataset.readerNoteIds = noteIds.join(' ');
            mark.className = [record.styles & 1 ? 'reader-underline' : '', record.styles & 2 ? 'reader-red' : '', record.styles & 4 ? 'reader-highlight' : '', noteIds.length ? 'reader-has-note' : ''].filter(Boolean).join(' ');
            mark.textContent = node.data.slice(a - start, b - start);
            if (!node.parentElement.closest('a')) {
              mark.tabIndex = 0;
              mark.setAttribute('role', 'button');
              mark.setAttribute('aria-haspopup', 'dialog');
              mark.setAttribute('aria-label', (noteIds.length ? 'View or edit notes: ' : 'Add a note: ') + mark.textContent.slice(0, 80));
              mark.title = noteIds.length ? 'Click to view or edit notes' : 'Click to add a note';
            }
            fragment.append(mark);
          }
          cursor = to;
        }
        if (cursor < end) fragment.append(document.createTextNode(node.data.slice(cursor - start)));
        node.replaceWith(fragment);
      }
    }
    renderList();
  }
  function renderList() {
    $('reader-note-count').textContent = String(records.length);
    $('reader-list-count').textContent = records.length + (records.length === 1 ? ' span' : ' spans');
    $('reader-comment-count').textContent = ' · ' + notes.length + (notes.length === 1 ? ' note' : ' notes');
    $('reader-empty').hidden = records.length > 0;
    $('reader-undo').disabled = undo.length === 0;
    $('reader-redo').disabled = redo.length === 0;
    $('reader-clear-all').disabled = records.length === 0;
    const list = $('reader-note-list');
    list.replaceChildren();
    for (const record of records) {
      const item = document.createElement('li');
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'reader-jump';
      const kind = document.createElement('span');
      kind.className = 'reader-note-kind';
      kind.textContent = [record.styles & 1 ? 'Underline' : '', record.styles & 2 ? 'Red text' : '', record.styles & 4 ? 'Highlight' : ''].filter(Boolean).join(' · ');
      const quote = document.createElement('span');
      quote.textContent = record.quote.length > 120 ? record.quote.slice(0, 120) + '…' : record.quote;
      jump.append(kind, quote);
      jump.title = 'Jump to this mark in the document';
      jump.addEventListener('click', () => {
        const target = blockElements.get(record.block);
        setPanel(false);
        for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (ancestor.tagName === 'DETAILS') ancestor.open = true;
        }
        target.scrollIntoView({block:'center', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
        focusNoteAnchor(record);
        target.classList.add('reader-jump-flash');
        setTimeout(() => target.classList.remove('reader-jump-flash'), 1800);
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'reader-delete';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Delete this mark');
      remove.addEventListener('click', () => {
        saveNoteEditor();
        commit(applyAnnotations(records, [record], 0, blockTexts), 'Mark deleted. You can undo this change.');
      });
      const attached = notes.filter(note => note.block === record.block && note.start < record.end && note.end > record.start);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'reader-edit-note';
      edit.textContent = attached.length ? '✎ ' + attached.map(note => note.text.length > 90 ? note.text.slice(0,90) + '…' : note.text).join('\n') : '+ Add a note';
      edit.setAttribute('aria-label', attached.length ? 'View or edit notes' : 'Add a note');
      edit.addEventListener('click', () => openNoteEditor(record, attached[0]?.id));
      item.append(jump, remove, edit);
      list.append(item);
    }
  }
  function commit(next, message, nextNotes = retainAnnotationNotes(notes, next, blockTexts)) {
    nextNotes = retainAnnotationNotes(nextNotes, next, blockTexts);
    if (JSON.stringify([next,nextNotes]) === JSON.stringify([records,notes])) { resetSelection(); return; }
    undo.push({records, notes});
    if (undo.length > 100) undo.shift();
    redo.length = 0;
    records = next;
    notes = nextNotes;
    hideNoteEditor();
    resetSelection();
    paint(); save();
    toast(storageAvailable ? message : 'Changes were made, but browser autosave is unavailable. Export an HTML copy to keep them.');
  }
  function focusNoteAnchor(anchor) {
    const element = anchor && blockElements.get(anchor.block);
    const mark = element && [...element.querySelectorAll('[data-reader-mark]')].find(node => Number(node.dataset.readerStart) < anchor.end && Number(node.dataset.readerEnd) > anchor.start);
    const destination = mark?.getAttribute('role') === 'button' ? mark : mark?.closest('a');
    (destination || toggle).focus({preventScroll:true});
  }
  function hideNoteEditor(restoreFocus = false) {
    const anchor = editorAnchor;
    $('reader-note-editor').hidden = true;
    editorAnchor = null;
    editorClickAnchor = null;
    editingNoteId = null;
    $('reader-note-text').value = '';
    if (restoreFocus) focusNoteAnchor(anchor);
  }
  function saveNoteEditor(restoreFocus = false) {
    if (!editorAnchor) return;
    const anchor = {...editorAnchor};
    const text = $('reader-note-text').value.slice(0, 10000);
    const id = editingNoteId || 'note-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    let next = notes.filter(note => note.id !== editingNoteId);
    if (text.trim()) {
      const changed = {...anchor, id, text};
      next = editingNoteId ? notes.map(note => note.id === editingNoteId ? changed : note) : [...notes, changed];
    }
    commit(records, text.trim() ? 'Note saved. You can undo this change.' : 'Note removed. Its marks are still kept.', normalizeAnnotationNotes(next, blockTexts));
    hideNoteEditor();
    if (restoreFocus === true) focusNoteAnchor(anchor);
  }
  function openNoteEditor(anchor, preferredId, forceNew = false) {
    saveNoteEditor();
    const clicked = {block:anchor.block, start:anchor.start, end:anchor.end,
      quote:blockTexts.get(anchor.block).slice(anchor.start, anchor.end)};
    const attached = notes.filter(note => note.block === clicked.block && note.start < clicked.end && note.end > clicked.start);
    const note = forceNew ? null : attached.find(note => note.id === preferredId) || attached[0];
    editorClickAnchor = clicked;
    editorAnchor = note ? {block:note.block, start:note.start, end:note.end, quote:note.quote} : clicked;
    editingNoteId = note?.id || null;
    resetSelection();
    setPanel(false);
    $('reader-note-quote').textContent = editorAnchor.quote;
    $('reader-note-text').value = note?.text || '';
    $('reader-note-delete').disabled = !note;
    const choice = $('reader-note-choice');
    choice.replaceChildren();
    for (const item of attached) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.text.length > 42 ? item.text.slice(0,42) + '…' : item.text;
      choice.append(option);
    }
    const add = document.createElement('option');
    add.value = '__new__'; add.textContent = '+ Add another note for this text'; choice.append(add);
    choice.value = note?.id || '__new__';
    choice.hidden = attached.length === 0;
    $('reader-note-choice-label').hidden = choice.hidden;
    $('reader-note-source').hidden = true;
    $('reader-note-editor').hidden = false;
    $('reader-note-text').focus({preventScroll:true});
  }
  function openMarkedText(mark) {
    const block = mark.closest('[data-reader-block]')?.dataset.readerBlock;
    if (!block || !blockTexts.has(block)) return;
    const anchor = {block, start:Number(mark.dataset.readerStart), end:Number(mark.dataset.readerEnd)};
    const preferredId = mark.dataset.readerNoteIds.split(' ').find(Boolean);
    openNoteEditor(anchor, preferredId);
  }
  function readSelection() {
    if (selecting) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !selection.toString().trim()) {
      if (!document.activeElement?.closest('.reader-ui')) { selectedRanges = []; toolbar.hidden = true; }
      return;
    }
    const range = selection.getRangeAt(0);
    const selected = [];
    for (const [id, element] of blockElements) {
      if (!range.intersectsNode(element)) continue;
      let offset = 0, from = Infinity, to = -1;
      for (const node of textNodes(element)) {
        if (range.intersectsNode(node)) {
          const a = node === range.startContainer ? range.startOffset : 0;
          const b = node === range.endContainer ? range.endOffset : node.data.length;
          if (a < b) { from = Math.min(from, offset + a); to = Math.max(to, offset + b); }
        }
        offset += node.data.length;
      }
      if (from < to && blockTexts.get(id).slice(from, to).trim()) selected.push({block:id, start:from, end:to});
    }
    selectedRanges = selected;
    toolbar.hidden = !selected.length;
    if (!selected.length) return;
    const count = selected.reduce((total, part) => total + part.end - part.start, 0);
    $('reader-selection-count').textContent = count + ' characters selected';
    const rect = range.getBoundingClientRect();
    const width = toolbar.offsetWidth || 390, height = toolbar.offsetHeight || 52;
    toolbar.style.left = Math.max(10, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - 10)) + 'px';
    let top = rect.bottom + 10;
    if (top + height > innerHeight - 12) top = rect.top - height - 10;
    toolbar.style.top = Math.max(10, Math.min(top, innerHeight - height - 10)) + 'px';
  }
  function setPanel(open) {
    if (open) saveNoteEditor();
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) { toolbar.hidden = true; $('reader-close').focus({preventScroll:true}); }
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => setPanel(panel.hidden));
  $('reader-close').addEventListener('click', () => { setPanel(false); toggle.focus({preventScroll:true}); });
  $('reader-note-save').addEventListener('click', () => saveNoteEditor(true));
  $('reader-note-close').addEventListener('click', () => saveNoteEditor(true));
  $('reader-note-cancel').addEventListener('click', () => hideNoteEditor(true));
  $('reader-note-delete').addEventListener('click', () => {
    if (!editingNoteId) return;
    const anchor = {...editorAnchor};
    commit(records, 'Note deleted. Its marks are still kept.', notes.filter(note => note.id !== editingNoteId));
    hideNoteEditor();
    focusNoteAnchor(anchor);
  });
  $('reader-note-choice').addEventListener('change', () => {
    const anchor = editorClickAnchor, id = $('reader-note-choice').value;
    if (anchor) openNoteEditor(anchor, id, id === '__new__');
  });
  document.addEventListener('click', event => {
    const mark = event.target.closest('[data-reader-mark][role="button"]');
    if (!mark || mark.closest('a') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (window.getSelection()?.toString().trim()) return;
    event.preventDefault();
    openMarkedText(mark);
  });
  toolbar.addEventListener('mousedown', event => event.preventDefault());
  toolbar.addEventListener('pointerdown', () => { selecting = true; });
  toolbar.addEventListener('click', event => {
    const action = event.target.closest('[data-annotation-action]')?.dataset.annotationAction;
    if (!action || !selectedRanges.length) return;
    const style = {underline:1, red:2, highlight:4, clear:0}[action];
    const ranges = selectedRanges.map(range => ({...range}));
    saveNoteEditor();
    commit(applyAnnotations(records, ranges, style, blockTexts), action === 'clear' ? 'Marks cleared from the selected text.' : 'Mark added. You can undo this change.');
  });
  $('reader-undo').addEventListener('click', () => {
    if (!undo.length) return;
    redo.push({records,notes}); ({records,notes} = undo.pop()); hideNoteEditor(); resetSelection(); paint(); save();
    toast('Last annotation undone.');
  });
  $('reader-redo').addEventListener('click', () => {
    if (!redo.length) return;
    undo.push({records,notes}); ({records,notes} = redo.pop()); hideNoteEditor(); resetSelection(); paint(); save();
    toast('Annotation redone.');
  });
  $('reader-clear-all').addEventListener('click', () => { saveNoteEditor(); commit([], 'All marks cleared. You can undo this change.'); });
  $('reader-export-html').addEventListener('click', () => {
    try {
      saveNoteEditor();
      const exported = new DOMParser().parseFromString(exportTemplate, 'text/html');
      const freshId = globalThis.crypto?.randomUUID?.() || 'copy-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      exported.getElementById('reader-annotation-data').textContent = JSON.stringify(payload(freshId)).replace(/</g, '\\u003c');
      const html = '<!doctype html>\n' + exported.documentElement.outerHTML;
      const blob = new Blob([html], {type:'text/html;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = (configuration.exportName || 'Anatomy-annotated-copy') + '-' + new Date().toISOString().slice(0, 10) + '.html';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast('Annotated HTML is ready. Keep the downloaded file.');
    } catch { toast('Export failed. Please try again. Your annotations are still on this page.'); }
  });
  document.addEventListener('selectionchange', readSelection);
  document.addEventListener('pointerdown', event => {
    restoreMouseSelectionFocus();
    if (event.pointerType === 'mouse' && event.button === 0) {
      const mark = event.target.closest('[data-reader-mark][role="button"][tabindex]');
      if (mark) {
        mouseSelectionFocus = {mark, tabIndex:mark.getAttribute('tabindex')};
        mark.removeAttribute('tabindex');
      }
    }
    if (!event.target.closest('.reader-ui')) { selecting = true; toolbar.hidden = true; selectedRanges = []; }
  });
  document.addEventListener('pointerup', () => { restoreMouseSelectionFocus(); selecting = false; setTimeout(readSelection, 0); });
  document.addEventListener('pointercancel', () => { restoreMouseSelectionFocus(); selecting = false; });
  window.addEventListener('blur', () => { restoreMouseSelectionFocus(); selecting = false; });
  document.addEventListener('keydown', event => {
    restoreMouseSelectionFocus();
    if (!event.defaultPrevented && event.target?.matches?.('[data-reader-mark][role="button"]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); openMarkedText(event.target); return;
    }
    if (!$('reader-note-editor').hidden) {
      if (event.key === 'Escape') { event.preventDefault(); hideNoteEditor(true); return; }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); saveNoteEditor(true); return; }
    }
    if (event.key === 'Escape') { toolbar.hidden = true; if (!panel.hidden) { setPanel(false); toggle.focus({preventScroll:true}); } }
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'm' && selectedRanges.length) {
      event.preventDefault(); toolbar.querySelector('button').focus({preventScroll:true});
    }
  });
  window.addEventListener('resize', () => { if (!toolbar.hidden) readSelection(); });
  window.addEventListener('scroll', () => { if (!toolbar.hidden) readSelection(); }, {passive:true});
  window.addEventListener('beforeunload', saveNoteEditor);
  paint(); setSaveStatus();
})();
