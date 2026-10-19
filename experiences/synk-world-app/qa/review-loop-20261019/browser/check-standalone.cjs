// 호스트 없는 단독 홈(brand-opening/home.html, 생활 단독 묶음): 첫 실행 한글 질문 → 튜터 → 홈 추천이 한글 만나기인지 본다.
const path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const out={};
 try{const page=await (await browser.newContext({viewport:{width:390,height:844}})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4637/brand-opening/home.html?opening=off',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__synkHome,null,{timeout:30000});
  out.connected=await page.evaluate(()=>document.documentElement.dataset.connected||null);
  // 단독 홈은 첫 시작을 사람이 누를 때 연다(입장 관문이 없다): 홈 튜터의 「AI 튜터 고르기」

  await page.waitForSelector('dialog[open] [data-first-hangul]',{timeout:20000});out.firstStep='hangul';
  await page.click('[data-first-hangul="new"]');await page.waitForSelector('dialog[open] .tutor-option',{timeout:20000});
  await page.click('.tutor-option[data-tutor-id="mongle"]');await page.click('.tutor-primary');await page.click('.tutor-primary[data-tutor-action="finish"]');
  await page.waitForFunction(()=>window.__synkEducation?.metrics()?.plan?.selected,null,{timeout:20000});
  out.plan=await page.evaluate(()=>({selected:window.__synkEducation.metrics().plan.selected.id,reasons:window.__synkEducation.metrics().plan.reasons,hangul:window.__synkLife.metrics().progress.hangul}));
  out.errors=errors;
 }catch(e){out.error=e.message;process.exitCode=1;}finally{console.log(JSON.stringify(out));fs.writeFileSync(path.join(__dirname,'check-standalone.json'),JSON.stringify(out,null,1));await browser.close();}})();
