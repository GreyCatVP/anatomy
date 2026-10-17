const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const out=path.resolve(process.argv[2]||'shots/reading-annotations');
const {execFileSync}=require('node:child_process');
const builder=path.resolve(process.argv[3]||'assets/reading-annotations/build-demo.mjs');
const demoPath=theme=>path.join(out,'source-'+theme+'.html');
const results=[];
const mainParagraph='#reading-demo > p:nth-of-type(2)';
const note='Touch note: 中文与 emoji 🧠. Literal </script><img src=x onerror=alert(1)> stays plain text.';
function check(condition,message){assert.ok(condition,message);results.push(message);}
async function visible(page,selector){await page.locator(selector).waitFor({state:'visible'});}
async function hidden(page,selector){await page.locator(selector).waitFor({state:'hidden'});}
async function longPressWord(page,context,word,selector=mainParagraph){
  await page.locator(selector).scrollIntoViewIfNeeded();
  const point=await page.locator(selector).evaluate((element,word)=>{
    const text=element.textContent,index=text.indexOf(word);
    if(index<0)throw new Error('Missing word '+word);
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let offset=0,start,end;
    for(let node;node=walker.nextNode();){
      if(start===undefined&&index>=offset&&index<offset+node.length)start={node,offset:index-offset};
      if(index+word.length>offset&&index+word.length<=offset+node.length){end={node,offset:index+word.length-offset};break;}
      offset+=node.length;
    }
    const range=document.createRange();range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset);
    const rect=range.getClientRects()[0];return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  },word);
  const session=await context.newCDPSession(page);
  try{await session.send('Input.synthesizeTapGesture',{...point,duration:1100,gestureSourceType:'touch',tapCount:1});}
  finally{await session.detach();}
  await page.waitForFunction(word=>getSelection().toString()===word,word);
  await visible(page,'#reader-tools');
}
async function tap(page,selector){await page.locator(selector).tap();}
async function layout(page,selector){
  const box=await page.locator(selector).boundingBox();const view=page.viewportSize();
  check(box&&box.x>=-1&&box.x+box.width<=view.width+1,selector+' fits viewport '+view.width+'x'+view.height);
}
async function state(page){return page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('anatomy-reader:v1:')).map(k=>JSON.parse(localStorage.getItem(k))).sort((a,b)=>b.updatedAt-a.updatedAt)[0]);}
async function noToast(page){await hidden(page,'#reader-toast');}
async function screenshot(page,name){await noToast(page);await page.screenshot({path:path.join(out,name)});}
async function exportFile(page,name){
  const pending=page.waitForEvent('download');await tap(page,'#reader-export-html');
  const download=await pending;const filename=path.join(out,name);await download.saveAs(filename);
  check((await download.failure())===null,'HTML download completed: '+name);return filename;
}
(async()=>{
fs.mkdirSync(out,{recursive:true});
for(const theme of ['light','dark'])execFileSync(process.execPath,[builder,'--'+theme,demoPath(theme)],{stdio:'pipe'});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];const network=[];const themes=[];
try{
  for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',offline:true,acceptDownloads:true});
    await context.addInitScript(()=>{window.qaTouches=[];for(const type of ['pointerdown','pointerup','touchstart','touchend','contextmenu'])document.addEventListener(type,e=>window.qaTouches.push({type:e.type,trusted:e.isTrusted,pointerType:e.pointerType}),{passive:true});});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(theme+': '+e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
    await page.goto(require('node:url').pathToFileURL(demoPath(theme)).href);await visible(page,'#reader-notes-toggle');
    const baseline=await page.locator('[data-reader-block]').allTextContents();
    check(await page.evaluate(()=>navigator.maxTouchPoints>0),'Touch emulation enabled: '+theme);
    await longPressWord(page,context,'Select');
    await layout(page,'#reader-tools');
    await tap(page,'[data-annotation-action="underline"]');
    check(await page.locator('[data-reader-mark].reader-underline').textContent()==='Select','Native long-press selection + touch underline: '+theme);
    await tap(page,'[data-reader-mark]');await visible(page,'#reader-note-editor');
    await layout(page,'#reader-note-editor');
    await page.locator('#reader-note-text').fill(note);await tap(page,'#reader-note-save');await hidden(page,'#reader-note-editor');
    check((await state(page)).notes[0].text===note,'Touch note saved as plain text: '+theme);
    for(const action of ['red','highlight']){
      await longPressWord(page,context,'Select');await tap(page,'[data-annotation-action="'+action+'"]');
    }
    check(await page.locator('[data-reader-mark]').getAttribute('data-styles')==='7','Touch overlapping underline/red/highlight: '+theme);
    await longPressWord(page,context,'Select');
    await screenshot(page,'mobile-toolbar-'+theme+'.png');
    await tap(page,'[data-annotation-action="clear"]');
    check(await page.locator('[data-reader-mark]').count()===0,'Touch clear removes mark: '+theme);
    check((await state(page)).notes.length===0,'Touch clear removes attached note: '+theme);
    await tap(page,'#reader-notes-toggle');await tap(page,'#reader-undo');
    check((await state(page)).notes[0].text===note,'Touch undo restores mark and note: '+theme);
    await tap(page,'#reader-redo');check((await state(page)).records.length===0,'Touch redo clears again: '+theme);
    await tap(page,'#reader-undo');await tap(page,'#reader-close');
    await tap(page,'[data-reader-mark]');await page.locator('#reader-note-text').fill(note+' Unsaved edit.');
    await tap(page,'#reader-note-cancel');await tap(page,'[data-reader-mark]');
    check(await page.locator('#reader-note-text').inputValue()===note,'Touch cancel discards current draft: '+theme);
    await page.locator('#reader-note-text').fill('Keep notes beside the important ideas.\n补充：标记与备注随离线 HTML 一起保存。');
    await tap(page,'#reader-note-save');
    await tap(page,'[data-reader-mark]');
    await screenshot(page,'mobile-editor-'+theme+'.png');
    await page.locator('#reader-note-text').fill(note);
    await page.setViewportSize({width:320,height:420});await layout(page,'#reader-note-editor');
    await page.locator('#reader-note-text').fill(note+' Edited on a narrow keyboard-sized viewport.');
    await tap(page,'#reader-note-save');await hidden(page,'#reader-note-editor');
    check((await state(page)).notes[0].text.endsWith('viewport.'),'Touch save reachable at 320x420: '+theme);
    await page.setViewportSize({width:844,height:390});await tap(page,'#reader-notes-toggle');await layout(page,'#reader-notes-panel');
    await tap(page,'.reader-edit-note');await layout(page,'#reader-note-editor');await tap(page,'#reader-note-close');
    check(await page.locator('#reader-note-editor').isHidden(),'Landscape touch editor and close: '+theme);
    await page.setViewportSize({width:390,height:844});
    await page.locator('#demo-value').scrollIntoViewIfNeeded();
    const slider=await page.locator('#demo-value').boundingBox();await page.touchscreen.tap(slider.x+slider.width*.8,slider.y+slider.height/2);
    check(await page.locator('#demo-value').inputValue()!=='4','Original slider responds to touch: '+theme);
    await tap(page,'#reader-notes-toggle');await layout(page,'#reader-notes-panel');
    await tap(page,'.reader-edit-note');await page.locator('#reader-note-text').fill(note+' Latest draft travels with this offline copy.');
    await tap(page,'#reader-notes-toggle');
    const exported=await exportFile(page,'mobile-export-'+theme+'.html');
    const originalState=await state(page);
    check((await page.locator('[data-reader-block]').allTextContents()).join('\n')===baseline.join('\n'),'Source text preserved after touch edits: '+theme);
    const trusted=await page.evaluate(()=>window.qaTouches);
    check(trusted.some(e=>e.type==='contextmenu'&&e.trusted)&&trusted.some(e=>e.type==='pointerdown'&&e.pointerType==='touch'&&e.trusted),'Trusted native touch/long-press events recorded: '+theme);
    const fresh=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,offline:true,acceptDownloads:true});
    const reopened=await fresh.newPage();reopened.on('pageerror',e=>errors.push('reopen '+theme+': '+e.message));
    await reopened.goto(require('node:url').pathToFileURL(exported).href);await visible(reopened,'#reader-notes-toggle');
    check(await reopened.locator('[data-reader-mark]').getAttribute('data-styles')==='7','Exported styles reopen offline: '+theme);
    check(await reopened.locator('#demo-value').inputValue()==='4','Exported slider initializes once at default: '+theme);
    check(await reopened.locator('#demo-value').count()===1&&await reopened.locator('#reader-notes-toggle').count()===1,'No duplicated controls after offline export: '+theme);
    check(await reopened.locator('img').count()===0,'HTML-like note creates no injected element: '+theme);
    await tap(reopened,'[data-reader-mark]');
    check((await reopened.locator('#reader-note-text').inputValue())===note+' Latest draft travels with this offline copy.','Latest touch draft survives offline reopen: '+theme);
    await tap(reopened,'#reader-note-close');await tap(reopened,'#reader-notes-toggle');
    const exportedAgain=await exportFile(reopened,'mobile-export-again-'+theme+'.html');
    const firstSeed=await reopened.locator('#reader-annotation-data').textContent();
    const secondHTML=fs.readFileSync(exportedAgain,'utf8');
    const secondSeed=JSON.parse(secondHTML.match(/<script type="application\/json" id="reader-annotation-data">([\s\S]*?)<\/script>/)[1]);
    check(JSON.parse(firstSeed).notebookId!==secondSeed.notebookId,'Re-export gets an independent notebook identity: '+theme);
    await page.reload();check((await state(page)).notes[0].text===originalState.notes[0].text,'Browser autosave survives reload: '+theme);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at mobile width: '+theme);
    themes.push({theme,trustedTouchEvents:trusted.length,nativeLongPressCount:trusted.filter(e=>e.type==='contextmenu'&&e.trusted).length,exported,exportedAgain});
    await context.close();await fresh.close();
  }
  check(errors.length===0,'No browser page errors');check(network.length===0,'No HTTP or HTTPS requests from offline source pages');
  fs.writeFileSync(path.join(out,'mobile-result.json'),JSON.stringify({passed:true,assertions:results.length,checks:results,themes,errors,network,browser:browser.version(),playwright:require('playwright/package.json').version,limits:'Chromium Android touch emulation; no physical iOS/Android hardware or OS keyboard used.'},null,2));
  console.log(JSON.stringify({passed:true,assertions:results.length,themes,errors,network,browser:browser.version()},null,2));
}catch(error){fs.writeFileSync(path.join(out,'mobile-failure.json'),JSON.stringify({error:error.stack,completed:results},null,2));throw error;}
finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
