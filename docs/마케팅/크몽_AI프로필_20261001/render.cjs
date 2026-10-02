const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const here=__dirname;
const dependencies=process.env.SYNK_RUNTIME_NODE_MODULES||'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(dependencies,'playwright'));
let browser;
(async()=>{
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1304,height:1280},deviceScaleFactor:1});
  const evidence={cards:[],preview:[],interactions:[]};
  for(const name of ['01_main','02_before_after','03_concepts','04_process','05_ppt']){
    const isMain=name==='01_main';await page.setViewportSize(isMain?{width:652,height:488}:{width:1304,height:1280});
    await page.goto(pathToFileURL(path.join(here,'images',name+'.html')).href);await page.evaluate(()=>document.fonts.ready);
    const state=await page.evaluate(()=>({font:document.fonts.check('16px "SUIT Variable"'),brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,safe:[...document.querySelectorAll('[data-safe],.logo')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}})}));
    if(state.brokenImages||!state.font)throw new Error(name+': broken asset');
    if(state.scrollWidth>(isMain?652:1304)||state.scrollHeight>(isMain?488:1280))throw new Error(name+': clipped sheet');
    if(isMain&&state.safe.some(r=>r.x<50||r.y<50||r.right>602||r.bottom>438))throw new Error('Main 50px safe area failed');
    if(!isMain){
      const overlap=await page.evaluate(()=>{const foot=document.querySelector('.foot').getBoundingClientRect();return[...document.querySelector('.detail').children].filter(e=>!e.classList.contains('foot')).some(e=>e.getBoundingClientRect().bottom>foot.top-18)});
      if(overlap)throw new Error(name+': content overlaps footer');
    }
    await page.screenshot({path:path.join(here,'images',name+'.png')});evidence.cards.push({name,...state});
  }
  // 이미지 보기 접힘은 실제 생성한 카드 PNG를 데이터로 삽입해 오프라인에서도 열린다.
  const preview=path.join(here,'미리보기.html');let html=fs.readFileSync(preview,'utf8');
  const cards=['01_main','02_before_after','03_concepts','04_process','05_ppt'].map((n,i)=>'<img src="data:image/png;base64,'+fs.readFileSync(path.join(here,'images',n+'.png')).toString('base64')+'" alt="등록용 '+(i+1)+'번 이미지">').join('');
  html=html.replace('<div id="registration-cards"></div>','<div id="registration-cards">'+cards+'</div>');fs.writeFileSync(preview,html);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});await page.goto(pathToFileURL(preview).href);await page.evaluate(()=>document.fonts.ready);
    const state=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,font:document.fonts.check('16px "SUIT Variable"'),brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length}));
    if(state.scrollWidth>width||state.brokenImages||!state.font)throw new Error('Preview failure '+width+': '+JSON.stringify(state));
    await page.screenshot({path:path.join(here,'review','preview-'+width+'.png'),fullPage:true});evidence.preview.push(state);
  }
  await page.getByRole('button',{name:'비즈니스',exact:true}).click();
  evidence.interactions.push({action:'switch business',label:await page.locator('#result-label').textContent(),pressed:await page.getByRole('button',{name:'비즈니스',exact:true}).getAttribute('aria-pressed')});
  await page.getByRole('button',{name:'크리에이터',exact:true}).click();
  evidence.interactions.push({action:'switch creator',label:await page.locator('#result-label').textContent(),pressed:await page.getByRole('button',{name:'크리에이터',exact:true}).getAttribute('aria-pressed')});
  await page.getByRole('button',{name:'고객 준비 안내 복사',exact:true}).click();
  evidence.interactions.push({action:'copy intake',status:await page.locator('#copy-status').textContent()});
  await page.locator('.draft').first().locator('summary').click();
  evidence.interactions.push({action:'open registration copy',characters:(await page.locator('#draft-copy').inputValue()).length});
  evidence.pageErrors=errors;
  fs.writeFileSync(path.join(here,'review','browser-check.json'),JSON.stringify(evidence,null,2));await browser.close();
  console.log('5 cards rendered; file:// preview checked at 1440/768/390/320; comparison and copy exercised');
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
