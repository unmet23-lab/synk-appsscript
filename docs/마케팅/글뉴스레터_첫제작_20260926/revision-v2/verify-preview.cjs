const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=__dirname;
(async()=>{
 const server=http.createServer((req,res)=>{const uri=decodeURIComponent(req.url.split('?')[0]);const file=path.resolve(root,'.'+(uri==='/'?'/index.html':uri));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const body=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'text/plain; charset=utf-8');res.end(body);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  try{browser=await chromium.launch({headless:true});}catch{browser=await chromium.launch({headless:true,channel:'msedge'});}
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const origin='http://127.0.0.1:'+server.address().port;
  const result={layouts:[],clipboard:false,keyboard:false,errors};
  fs.mkdirSync(path.join(root,'검토화면'),{recursive:true});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});await page.goto(origin,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   for(const id of ['threads','x','naver','tistory','substack']){
    await page.locator('#tab-'+id).click();
    const data=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,font:document.fonts.check('16px "SUIT Variable"'),brokenImages:[...document.querySelectorAll('.panel:not([hidden]) img')].filter(x=>!x.complete||!x.naturalWidth).length,overflow:[...document.querySelectorAll('.panel:not([hidden]) *')].filter(x=>x.getBoundingClientRect().right>innerWidth+1).slice(0,5).map(x=>x.tagName)}));
    result.layouts.push({width,id,...data});
    if(data.document>width||!data.font||data.brokenImages||data.overflow.length)throw Error('Layout failed '+JSON.stringify(data));
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:path.join(root,'검토화면',id+'-'+width+'.png'),fullPage:id==='threads'||id==='x'});
    if(width===390&&['naver','tistory','substack'].includes(id)){
      const headings=page.locator('.panel:not([hidden]) article h2');
      for(let j=0;j<await headings.count();j++){await headings.nth(j).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'검토화면',id+'-390-section-'+(j+1)+'.png')});}
    }
   }
  }
  await page.locator('#tab-threads').click();await page.locator('[data-copy]').first().click();
  await page.waitForFunction(()=>document.getElementById('toast').textContent==='본문을 복사했습니다.');
  const copied=await page.evaluate(()=>navigator.clipboard.readText());const expected=await page.locator('.panel:not([hidden]) article').first().innerText();
  result.clipboard=copied.replace(/\r/g,'')===expected.replace(/\r/g,'')&&!copied.includes('편집 메모');if(!result.clipboard)throw Error('Clipboard failed '+JSON.stringify({copiedLength:copied.length,expectedLength:expected.length}));
  await page.locator('#tab-threads').focus();await page.keyboard.press('ArrowRight');result.keyboard=await page.locator('#tab-x').getAttribute('aria-selected')==='true';if(!result.keyboard)throw Error('Keyboard failed');
  if(errors.length)throw Error(errors.join('\n'));
  const prior=JSON.parse(fs.readFileSync(path.join(root,'검수결과.json'),'utf8'));prior.preview=result;fs.writeFileSync(path.join(root,'검수결과.json'),JSON.stringify(prior,null,2));
  console.log(JSON.stringify(result,null,2));
 } finally {if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
