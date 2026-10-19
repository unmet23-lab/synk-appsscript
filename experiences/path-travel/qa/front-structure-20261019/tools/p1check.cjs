// 결과 뒤 「조건 고치기」를 열고 자세한 묶음을 모두 펼쳐 만들기 단추에 닿는지 잰다
const path=require('path');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});
for(const [w,h,mob] of [[1440,900,false],[1024,768,false],[768,1024,true],[390,844,true],[320,640,true]]){
 const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:mob,hasTouch:mob,deviceScaleFactor:mob?2:1,locale:'ko-KR',timezoneId:'Asia/Seoul'});const p=await ctx.newPage();
 await p.goto(process.argv[2],{waitUntil:'networkidle'});await p.waitForTimeout(1200);
 await p.locator('[data-preset="culture"]').click();await p.locator('#generate').click();await p.waitForSelector('#result:not([hidden])');await p.waitForTimeout(600);
 await p.evaluate(()=>scrollTo(0,0));await p.locator('#conditions-panel>summary').click();
 await p.evaluate(()=>{for(const d of document.querySelectorAll('#trip-form details'))d.open=true;});await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{const f=document.querySelector('#trip-form'),c=document.querySelector('#conditions-panel'),g=document.querySelector('#generate');c.scrollTop=0;const g0=g.getBoundingClientRect();c.scrollTop=c.scrollHeight;const g1=g.getBoundingClientRect();return {formSW:f.scrollWidth,formCW:f.clientWidth,docW:document.documentElement.scrollWidth,innerW:innerWidth,condScroll:c.scrollHeight>c.clientHeight,genTopStart:Math.round(g0.top),genBottomStart:Math.round(g0.bottom),genLeftEnd:Math.round(g1.left),genBottomEnd:Math.round(g1.bottom),vh:innerHeight};});
 await p.screenshot({path:require('path').join(process.argv[3]||'.',`p1-${w}.png`)});
 console.log(w+'x'+h,JSON.stringify(r));await ctx.close();}
await b.close();})();
