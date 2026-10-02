const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=JSON.parse(fs.readFileSync(path.join(__dirname,'qa/preview-server.json'),'utf8')).url;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const report=[];
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>{x.loading='eager';return x.decode();})));console.log('loaded '+width);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
  await page.getByRole('button',{name:'오른쪽 소품',exact:true}).click();assert.match(await page.locator('#feedback').innerText(),/^맞아요/);
  await page.getByRole('button',{name:'수정 후',exact:true}).click();assert.match(await page.locator('#crop-image').getAttribute('src'),/after/);assert.equal(await page.getByRole('button',{name:'수정 후',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'수정 전',exact:true}).click();assert.match(await page.locator('#crop-image').getAttribute('src'),/before/);
  await page.locator('#wipe').focus();await page.keyboard.press('End');assert.equal(await page.locator('#wipe').inputValue(),'100');await page.keyboard.press('Home');assert.equal(await page.locator('#wipe').inputValue(),'0');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#wipe').inputValue(),'1');
  const wipe=page.locator('.wipe');await wipe.scrollIntoViewIfNeeded();const r=await wipe.boundingBox();await page.mouse.move(r.x+r.width*.2,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.8,r.y+r.height*.5);await page.mouse.up();assert.ok(Number(await page.locator('#wipe').inputValue())>=79,'pointer wipe');
  await page.locator('#wipe').fill('50');await page.locator('#wipe').dispatchEvent('input');
  for(const c of await page.locator('.check input').all())await c.check();assert.match(await page.locator('#progress').innerText(),/3 \/ 3/);
  await page.getByRole('button',{name:'반복 업무',exact:true}).click();assert.match(await page.locator('#request').inputValue(),/매주 사내/);const draft='우리 팀의 작성 내용\n보존 확인';await page.locator('#request').fill(draft);await page.getByRole('button',{name:'브랜딩',exact:true}).click();await page.getByRole('button',{name:'반복 업무',exact:true}).click();assert.equal(await page.locator('#request').inputValue(),draft);
  await page.getByRole('button',{name:'문의 예문 복사',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#copy-status').textContent.includes('복사했어요'));assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'),draft);
  const bad=[];for(const link of await page.locator('a[download]').all()){const href=await link.getAttribute('href');if(href.endsWith('.zip')&&!fs.existsSync(path.join(__dirname,href)))continue;const res=await page.request.get(new URL(href,base).href);if(res.status()!==200)bad.push(href);}assert.deepEqual(bad,[]);
  await page.locator('#channel-0>summary').click();assert.equal(await page.locator('#channel-0').getAttribute('open'),'');await page.locator('#channel-0>summary').click();
  const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'h1'});const used=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});assert.ok(used.fonts.some(x=>x.familyName.includes('SUIT')));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,`qa/preview-${width}.png`),fullPage:true});await page.locator('#background').screenshot({path:path.join(__dirname,`qa/background-${width}.png`)});
  assert.deepEqual(errors,[]);report.push({width,errors,brokenDownloads:bad,fonts:used.fonts,verified:['correct-answer feedback','before-after toggle','keyboard range','pointer wipe','checklist completion','inquiry draft preservation','clipboard exact match','local downloads','channel disclosure','no horizontal overflow']});await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(__dirname,'qa/interaction.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
