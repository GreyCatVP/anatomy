const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {execFileSync} = require('node:child_process');

const destination = path.resolve(process.argv[2] || path.join(process.cwd(),'shots','reading-annotations'));
const builder = path.resolve(process.argv[3] || 'assets/reading-annotations/build-demo.mjs');
fs.mkdirSync(destination,{recursive:true});
for(const theme of ['light','dark']) execFileSync(process.execPath,[builder,'--'+theme,path.join(destination,'source-'+theme+'.html')]);
const results = [];
const screenshots = [];
const note = '中文批注 🧠 — </script><img src="https://invalid.example/note" onerror="globalThis.__noteExecuted=1"> — 保持为纯文字';
const passage = 'some words and try underline, red text, or highlight';
const paragraph = 'main [data-reader-content] > p:not(.eyebrow)';
let browser;

async function check(theme, name, callback) {
  await callback();
  results.push({theme, name, status:'passed'});
  console.log('PASS ' + theme + ': ' + name);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('anatomy-reader:v1:'));
    const entries = keys.map(key => JSON.parse(localStorage.getItem(key)));
    return entries.sort((a,b) => b.updatedAt-a.updatedAt)[0] || {records:[], notes:[]};
  });
}

async function selectWithMouse(page, selector, quote) {
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded();
  const points = await element.evaluate((element, quote) => {
    const start = element.textContent.indexOf(quote);
    if (start < 0) throw new Error('Passage missing: ' + quote);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let node; (node=walker.nextNode());) nodes.push(node);
    const locate = offset => {
      for (const node of nodes) {
        if (offset < node.data.length) return [node, offset];
        offset -= node.data.length;
      }
      throw new Error('Text offset is outside element');
    };
    const first = locate(start), last = locate(start+quote.length-1);
    const a = document.createRange(); a.setStart(...first); a.setEnd(first[0], first[1]+1);
    const b = document.createRange(); b.setStart(...last); b.setEnd(last[0], last[1]+1);
    const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
    return {from:{x:ar.left+.15,y:ar.top+ar.height/2},to:{x:br.right-.15,y:br.top+br.height/2}};
  }, quote);
  await page.mouse.move(points.from.x,points.from.y);
  await page.mouse.down();
  await page.mouse.move(points.to.x,points.to.y,{steps:25});
  await page.mouse.up();
  await page.waitForFunction(() => !document.getElementById('reader-tools').hidden);
  assert.equal(await page.evaluate(() => getSelection().toString()),quote);
}

async function style(page, action) {
  await selectWithMouse(page,paragraph,passage);
  await page.locator('[data-annotation-action="'+action+'"]').click();
}

async function openMark(page) {
  await page.locator(paragraph).first().locator('[data-reader-mark]').first().click();
  await page.locator('#reader-note-editor').waitFor({state:'visible'});
}

async function exportCopy(page, filename) {
  if (await page.locator('#reader-notes-panel').isHidden()) await page.locator('#reader-notes-toggle').click();
  const downloading = page.waitForEvent('download');
  await page.locator('#reader-export-html').click();
  const download = await downloading;
  const output = path.join(destination,filename);
  await download.saveAs(output);
  assert.equal(await download.failure(),null);
  return output;
}

async function contextFor(theme, scale=1) {
  const context = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:scale,offline:true,acceptDownloads:true,reducedMotion:'reduce'});
  const requests = [],errors = [];
  context.on('request',request => {if (/^https?:/.test(request.url())) requests.push(request.url());});
  context.on('page',page => page.on('pageerror',error => errors.push(error.message)));
  return {context,requests,errors};
}

async function runTheme(theme) {
  const original = path.join(destination,'source-'+theme+'.html');
  const {context,requests,errors} = await contextFor(theme);
  const page = await context.newPage();
  try {
    await page.goto(pathToFileURL(original).href);
    await page.locator('#reader-notes-toggle').waitFor({state:'visible'});
    const originalText = await page.locator(paragraph).first().textContent();
    await check(theme,'offline initial state and single live slider',async () => {
      assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
      assert.equal(await page.locator('#demo-value').count(),1);
      assert.equal(await page.locator('#demo-readout').textContent(),'Current value: 4');
      await page.locator('#demo-value').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#demo-readout').textContent(),'Current value: 5');
      assert.equal(await page.locator('#reader-note-count').textContent(),'0');
    });
    await check(theme,'genuine mouse drag across inline strong creates underline',async () => {
      await style(page,'underline');
      const state=await snapshot(page);
      assert.equal(state.records.length,1);
      assert.equal(state.records[0].styles,1);
      assert.equal(state.records[0].quote,passage);
      assert.equal(await page.locator(paragraph).first().locator('strong [data-reader-mark]').count(),1);
    });
    await check(theme,'same mouse selection combines red text with underline',async () => {
      await style(page,'red');
      assert.equal((await snapshot(page)).records[0].styles,3);
    });
    await check(theme,'same mouse selection combines highlight with underline and red',async () => {
      await style(page,'highlight');
      assert.equal((await snapshot(page)).records[0].styles,7);
      const marks=page.locator(paragraph).first().locator('[data-reader-mark]');
      assert.equal(await marks.count(),2);
      assert.deepEqual(await marks.evaluateAll(nodes=>nodes.map(node=>node.dataset.styles)),['7','7']);
      assert.equal(await page.locator(paragraph).first().textContent(),originalText);
      assert.equal(await page.locator(paragraph).first().locator('strong').count(),1);
      assert.equal(await page.locator('[data-reader-mark] [data-reader-mark]').count(),0);
    });
    await check(theme,'mouse click opens note dialog and focuses textarea',async () => {
      await openMark(page);
      assert.equal(await page.locator('#reader-note-quote').textContent(),passage);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'reader-note-text');
      await page.locator('#reader-note-text').fill('First reading note 中文 🧠');
      await page.locator('#reader-note-save').click();
      assert.equal((await snapshot(page)).notes[0].text,'First reading note 中文 🧠');
      assert.equal(await page.evaluate(()=>document.activeElement.matches('[data-reader-mark]')) ,true);
    });
    await check(theme,'Enter reopens saved note and Escape cancels its draft with focus restored',async () => {
      await page.keyboard.press('Enter');
      await page.locator('#reader-note-editor').waitFor({state:'visible'});
      assert.equal(await page.locator('#reader-note-text').inputValue(),'First reading note 中文 🧠');
      await page.locator('#reader-note-text').fill('Discard by Escape');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#reader-note-editor').isHidden(),true);
      assert.equal((await snapshot(page)).notes[0].text,'First reading note 中文 🧠');
      assert.equal(await page.evaluate(()=>document.activeElement.matches('[data-reader-mark]')),true);
    });
    await check(theme,'Cancel button discards edit',async () => {
      await openMark(page);
      await page.locator('#reader-note-text').fill('Discard by Cancel');
      await page.locator('#reader-note-cancel').click();
      assert.equal((await snapshot(page)).notes[0].text,'First reading note 中文 🧠');
    });
    await check(theme,'Ctrl+Enter saves literal HTML, Chinese and emoji as plain text',async () => {
      await page.keyboard.press('Enter');
      await page.locator('#reader-note-text').fill(note);
      await page.keyboard.press('Control+Enter');
      assert.equal((await snapshot(page)).notes[0].text,note);
      assert.equal(await page.evaluate(()=>globalThis.__noteExecuted),undefined);
      assert.equal(await page.locator('img').count(),0);
      assert.equal(await page.locator('#reader-note-editor').isHidden(),true);
    });
    await check(theme,'annotation list contains style labels and saved plain-text note',async () => {
      await page.locator('#reader-notes-toggle').click();
      assert.equal(await page.locator('#reader-note-list > li').count(),1);
      assert.equal(await page.locator('.reader-note-kind').textContent(),'Underline · Red text · Highlight');
      assert.equal(await page.locator('.reader-edit-note').textContent(),'✎ '+note.slice(0,90)+'…');
      assert.equal(await page.locator('#reader-comment-count').textContent(),' · 1 note');
    });
    await check(theme,'clear all, Undo, Redo and Undo preserve matching notes with marks',async () => {
      await page.locator('#reader-clear-all').click();
      assert.equal((await snapshot(page)).records.length,0);
      assert.equal((await snapshot(page)).notes.length,0);
      await page.locator('#reader-undo').click();
      assert.equal((await snapshot(page)).records[0].styles,7);
      assert.equal((await snapshot(page)).notes[0].text,note);
      await page.locator('#reader-redo').click();
      assert.equal((await snapshot(page)).records.length,0);
      assert.equal((await snapshot(page)).notes.length,0);
      await page.locator('#reader-undo').click();
      assert.equal((await snapshot(page)).notes[0].text,note);
    });
    await check(theme,'list Jump returns keyboard focus to a document mark',async () => {
      await page.locator('.reader-jump').click();
      assert.equal(await page.locator('#reader-notes-panel').isHidden(),true);
      assert.equal(await page.evaluate(()=>document.activeElement.matches('[data-reader-mark]')),true);
    });
    await check(theme,'close button saves draft and editing from list works',async () => {
      await openMark(page);
      await page.locator('#reader-note-text').fill(note+' / saved on close');
      await page.locator('#reader-note-close').click();
      assert.equal((await snapshot(page)).notes[0].text,note+' / saved on close');
      await page.locator('#reader-notes-toggle').click();
      await page.locator('.reader-edit-note').click();
      assert.equal(await page.locator('#reader-note-text').inputValue(),note+' / saved on close');
      await page.locator('#reader-note-text').fill(note);
      await page.locator('#reader-note-save').click();
    });
    await check(theme,'reload restores marks and saved notes from local storage',async () => {
      await page.reload();
      await page.locator('#reader-notes-toggle').waitFor({state:'visible'});
      assert.equal((await snapshot(page)).records[0].styles,7);
      await openMark(page);
      assert.equal(await page.locator('#reader-note-text').inputValue(),note);
      await page.locator('#reader-note-cancel').click();
    });
    await check(theme,'actual HTML download includes saved annotations and unique notebook ID',async () => {
      const source=(await snapshot(page)).notebookId;
      const copy=await exportCopy(page,'desktop-export-'+theme+'.html');
      const html=fs.readFileSync(copy,'utf8');
      const match=html.match(/<script type="application\/json" id="reader-annotation-data">([\s\S]*?)<\/script>/);
      assert.ok(match);
      const seed=JSON.parse(match[1]);
      assert.notEqual(seed.notebookId,source);
      assert.equal(seed.records[0].styles,7);
      assert.equal(seed.notes[0].text,note);
      assert.equal(match[1].includes('<'),false);
      assert.equal(html.includes('data-reader-mark='),false);
    });
    await page.locator('#reader-close').click();
    await page.evaluate(()=>scrollTo(0,0));
    await openMark(page);
    await page.locator('#reader-note-text').fill('A single passage can keep underline, red text and highlight together.\n中文批注：导出 HTML 后，文字备注与交互会一起保留。🧠');
    await page.locator('#reader-note-save').click();
    await openMark(page);
    await page.locator('#reader-toast').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(destination,'desktop-'+theme+'.png'),animations:'disabled'});
    screenshots.push('desktop-'+theme+'.png');
    await check(theme,'original demo remained entirely offline and has no page errors',async () => {
      assert.deepEqual(requests,[]);
      assert.deepEqual(errors,[]);
    });
  } finally {
    await context.close();
  }

  const reopened=await contextFor(theme,4);
  const copyPage=await reopened.context.newPage();
  try {
    const copy=path.join(destination,'desktop-export-'+theme+'.html');
    await copyPage.goto(pathToFileURL(copy).href);
    await copyPage.locator('#reader-notes-toggle').waitFor({state:'visible'});
    const seed=await copyPage.locator('#reader-annotation-data').textContent().then(JSON.parse);
    await check(theme,'downloaded file reopens offline with marks and plain-text note in a fresh context',async () => {
      assert.equal(await copyPage.locator(paragraph).first().locator('[data-reader-mark][data-styles="7"]').count(),2);
      await openMark(copyPage);
      assert.equal(await copyPage.locator('#reader-note-text').inputValue(),note);
      assert.equal(await copyPage.evaluate(()=>globalThis.__noteExecuted),undefined);
      assert.equal(await copyPage.locator('img').count(),0);
      await copyPage.locator('#reader-note-cancel').click();
    });
    await check(theme,'downloaded copy initializes one control and slider starts at default then responds',async () => {
      assert.equal(await copyPage.locator('#demo-value').count(),1);
      assert.equal(await copyPage.locator('#demo-readout').count(),1);
      assert.equal(await copyPage.locator('#demo-readout').textContent(),'Current value: 4');
      await copyPage.locator('#demo-value').focus();
      await copyPage.keyboard.press('ArrowRight');
      assert.equal(await copyPage.locator('#demo-readout').textContent(),'Current value: 5');
    });
    await check(theme,'re-export produces another independent notebook and retains marks/notes',async () => {
      const output=await exportCopy(copyPage,'desktop-reexport-'+theme+'.html');
      const html=fs.readFileSync(output,'utf8');
      const match=html.match(/<script type="application\/json" id="reader-annotation-data">([\s\S]*?)<\/script>/);
      const next=JSON.parse(match[1]);
      assert.notEqual(next.notebookId,seed.notebookId);
      assert.equal(next.records[0].styles,7);
      assert.equal(next.notes[0].text,note);
    });
    await copyPage.locator('#reader-close').click();
    await copyPage.evaluate(()=>scrollTo(0,0));
    await copyPage.locator(paragraph).first().scrollIntoViewIfNeeded();
    const clip=await copyPage.locator(paragraph).first().boundingBox();
    await copyPage.screenshot({path:path.join(destination,'marks-closeup-'+theme+'.png'),clip:{x:clip.x-10,y:clip.y-10,width:clip.width+20,height:clip.height+20},animations:'disabled'});
    screenshots.push('marks-closeup-'+theme+'.png');
    await check(theme,'fresh exported and re-exported file remains safe and fully offline',async () => {
      assert.deepEqual(reopened.requests,[]);
      assert.deepEqual(reopened.errors,[]);
      assert.equal(await copyPage.evaluate(()=>globalThis.__noteExecuted),undefined);
      const again=await contextFor(theme);
      try {
        const finalPage=await again.context.newPage();
        await finalPage.goto(pathToFileURL(path.join(destination,'desktop-reexport-'+theme+'.html')).href);
        await finalPage.locator('#reader-notes-toggle').waitFor({state:'visible'});
        assert.equal(await finalPage.locator('[data-reader-mark][data-styles="7"]').count(),2);
        await openMark(finalPage);
        assert.equal(await finalPage.locator('#reader-note-text').inputValue(),note);
        await finalPage.locator('#reader-note-cancel').click();
        assert.equal(await finalPage.locator('#demo-value').count(),1);
        assert.equal(await finalPage.locator('#demo-readout').textContent(),'Current value: 4');
        await finalPage.locator('#demo-value').focus();
        await finalPage.keyboard.press('ArrowRight');
        assert.equal(await finalPage.locator('#demo-readout').textContent(),'Current value: 5');
        assert.equal(await finalPage.locator('img').count(),0);
        assert.equal(await finalPage.evaluate(()=>globalThis.__noteExecuted),undefined);
        assert.deepEqual(again.requests,[]);
        assert.deepEqual(again.errors,[]);
      } finally {await again.context.close();}
    });
  } finally {
    await reopened.context.close();
  }
}

(async () => {
  try {
    browser=await chromium.launch({channel:'chrome',headless:true});
    for (const theme of ['light','dark']) await runTheme(theme);
    fs.writeFileSync(path.join(destination,'desktop-browser-results.json'),JSON.stringify({status:'passed',passed:results.length,browser:await browser.version(),playwright:require('playwright/package.json').version,viewport:{width:1440,height:1000},offline:true,results,screenshots},null,2)+'\n');
    console.log('ALL PASSED: '+results.length+' desktop offline QA scenarios');
  } catch (error) {
    fs.writeFileSync(path.join(destination,'desktop-browser-results.json'),JSON.stringify({status:'failed',passed:results.length,results,screenshots,error:error.stack},null,2)+'\n');
    console.error(error.stack);
    process.exitCode=1;
  } finally {
    if (browser) await browser.close();
  }
})();
