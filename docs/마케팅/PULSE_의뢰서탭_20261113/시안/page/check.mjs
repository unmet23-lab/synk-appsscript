// 시안 쪽 확인 — PC 밝은 화면 · 휴대폰 어두운 화면에서 가로 넘침 · 그림 로딩 · 「지금 / 바꾼 뒤」 단추를 본다.
import {chromium} from 'playwright';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({channel:'msedge'});
for(const [name,viewport,colorScheme,scale] of [['pc-light',{width:1280,height:900},'light',1],['phone-dark',{width:390,height:844},'dark',2],['pc-dark',{width:1280,height:900},'dark',1]]){
  const ctx=await browser.newContext({viewport,colorScheme,deviceScaleFactor:scale,locale:'ko-KR'});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,120)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,120));});
  await page.goto('http://127.0.0.1:4871/page',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  const info=await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,imgs:[...document.images].filter(i=>i.naturalWidth>0).length+'/'+document.images.length,h:document.documentElement.scrollHeight,h1:getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0],bg:getComputedStyle(document.body).backgroundColor,ink:getComputedStyle(document.body).color}));
  // 단추: 「지금」을 누르면 앞 그림이 보이고 뒤 그림이 숨는다.
  await page.click('#feel button[data-show="before"]');
  const swap=await page.evaluate(()=>[...document.querySelectorAll('#feel img[data-side]')].map(i=>`${i.dataset.side}:${i.hidden?'숨김':'보임'}`).join(' '));
  await page.click('#feel button[data-show="after"]');
  await page.screenshot({path:path.join(here,`check-${name}-top.png`)});
  await page.evaluate(()=>document.querySelector('#notice').scrollIntoView());
  await page.screenshot({path:path.join(here,`check-${name}-notice.png`)});
  console.log(name,JSON.stringify(info),'· 단추',swap,errors.length?'· 오류 '+errors.join(' | '):'· 오류 0');
  await ctx.close();
}
await browser.close();
