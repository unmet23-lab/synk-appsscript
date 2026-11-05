// 1화 자막 규칙을 실제 브라우저에서 재고(결정 11-05 · docs/디자인/드라마_장면/README.md), 원하면 소리를 입힌 녹화를 만든다.
//   node experiences/drama/qa/자막시험.mjs [--폭 390x780] [--언어 en|ko|mn] [--찍기] [--녹화] [--출력 <폴더>] [--후보 <공개 후보 폴더>]
// · 앱과 같은 틀(같은 출처 부모 창 + 판정 통로 흉내)로 시범판 파일을 그대로 띄워 장면 끝까지 지나간다. 운영 계정 · talk를 건드리지 않는다.
// · 재는 것: 화면이 시각표 차례로 넘어가는가 · 한국어 두 줄 이내 · 글자가 영상(사람) 위로 올라오지 않는가 · 가로 넘침 · 콘솔 오류.
// · 재생 사본(media/)은 git 밖이라 공용 작업본의 것을 읽는다. 녹화의 소리는 틀에서 실제로 재생된 구간을 적어 뒤에 입힌다(학생 말은 없다).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {judgeLine,nextTake} from '../../../tools/lib/드라마판정.mjs';
import {dramaLines,readEpisodes} from '../../../tools/build-world-speaking-talk.mjs';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const MAIN=path.join(os.homedir(),'Documents','SYNK-appsscript');
const require=createRequire(path.join(fs.existsSync(path.join(ROOT,'node_modules'))?ROOT:MAIN,'x.js'));
const {chromium}=require('playwright');
const args=process.argv.slice(2),opt=(n,d=null)=>{const i=args.indexOf(n);return i<0?d:args[i+1];},has=n=>args.includes(n);
const [W,H]=opt('--폭','390x780').split('x').map(Number),LANG=opt('--언어','en'),SHOTS=has('--찍기'),RECORD=has('--녹화');
const CAND=opt('--후보');
const OUT=path.resolve(opt('--출력',path.join(ROOT,'.tmp','drama-cues',`${W}-${LANG}`)));fs.mkdirSync(OUT,{recursive:true});
const PILOT=path.join(ROOT,'experiences/drama/pilot'),MEDIA=path.join(MAIN,'experiences/drama/pilot');
const lesson=JSON.parse(fs.readFileSync(path.join(PILOT,'world-lesson.json'),'utf8'));
const lines=dramaLines(await readEpisodes()),byId=new Map(lines.map(l=>[l.id,l]));
const TRANSCRIPTS={'s1e01-6':['네, 맞아요. 길을 잃어서 한참 헤맸어','네, 맞아요. 길을 잃어서 한참 헤맸어요'],'s1e01-7':['네 선배님 그런데 혹시 도서관이 어디에 있는지 아세요'],'s1e01-8':['정말요? 선배님 덕분에 살았어요'],'s1e01-t9':['선배님 혹시 편의점이 어디에 있는지 아세요']};
const used=new Map();
function fakeTake(body){
 const line=byId.get(body.line_id);if(!line)return {ok:true,status:'unavailable'};
 // 녹화는 대사 흐름을 보이는 몫이라 학생 차례를 바로 통과시킨다(되묻기 길은 녹화 없이 도는 시험이 지난다).
 const list=RECORD?[line.line]:TRANSCRIPTS[line.id]||[line.line],n=used.get(line.id)||0;used.set(line.id,n+1);
 const transcript=list[Math.min(n,list.length-1)],seconds=Math.max(body.seconds,4);
 const result=judgeLine(line.spec,{transcript,seconds,speechSeconds:seconds,language:''}),gated=result.status!=='ok';
 const next=nextTake({result,attempt:body.take.judged+(gated?0:1),unheard:gated?body.take.unheard+1:0});
 return {ok:true,accountId:'synthetic',status:'ok',take:{lineId:line.id,lineKind:line.kind,status:result.status,verdict:result.verdict,note:result.note,sure:result.sure,next,heard:transcript}};
}
const TYPES={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.mp3':'audio/mpeg','.mp4':'video/mp4','.webp':'image/webp','.woff2':'font/woff2'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fail=[];const check=(ok,what,detail='')=>{console.log(`${ok?'통과':'실패'} ${what}${detail?` — ${detail}`:''}`);if(!ok)fail.push(what);};

const browser=await chromium.launch({channel:'msedge',args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',...(RECORD?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:[])]});
const context=await browser.newContext({viewport:RECORD?{width:W*2,height:H*2}:{width:W,height:H},deviceScaleFactor:RECORD?1:2,hasTouch:W<700,locale:LANG==='ko'?'ko-KR':LANG==='mn'?'mn-MN':'en-US',permissions:['microphone']});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('페이지 '+String(e).slice(0,300)));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('콘솔 '+m.text().slice(0,300));});
await page.exposeFunction('__fakeTake',fakeTake);
// 어느 소리가 언제 재생됐는지(녹화에 입힌다), 자막이 언제 바뀌었는지 적는다.
await page.addInitScript(({linesVersion})=>{
 if(window===window.top){window.__media=[];window.__cues=[];window.SYNKDramaHost=Object.freeze({status:async()=>({ok:true,dramaEnabled:true,dramaLimit:30,dramaRemaining:30,linesVersion}),take:p=>window.__fakeTake(p)});return;}
 const play=HTMLMediaElement.prototype.play;
 HTMLMediaElement.prototype.play=function(){
  const el=this,row={src:el.src||el.currentSrc,from:el.currentTime,at:Date.now(),muted:el.muted,to:null,end:null};
  try{top.__media.push(row);}catch{}
  el.addEventListener('playing',()=>{if(row.end==null){row.at=Date.now();row.from=el.currentTime;}},{once:true});
  const stop=()=>{if(row.end==null){row.end=Date.now();row.to=el.currentTime;}el.removeEventListener('pause',stop);el.removeEventListener('ended',stop);};
  el.addEventListener('pause',stop);el.addEventListener('ended',stop);
  return play.call(el);
 };
 addEventListener('DOMContentLoaded',()=>{
  const subs=document.querySelector('#subs');if(!subs)return;
  new MutationObserver(()=>{
   const ko=subs.querySelector('.ko');if(!ko)return;
   const stage=document.querySelector('.stage').getBoundingClientRect(),box=ko.getBoundingClientRect(),lh=parseFloat(getComputedStyle(ko).lineHeight);
   const media=[document.querySelector('#reply'),document.querySelector('#voice')].find(m=>m&&!m.paused);
   const pos=parseFloat(getComputedStyle(document.querySelector('.layer')).objectPosition.split(' ')[1])/100,videoH=stage.width*16/9,chin=stage.top+videoH*.38-Math.max(0,videoH-stage.height)*pos;
   top.__cues.push({at:Date.now(),text:ko.textContent,mean:subs.querySelector('.mean')?.textContent||'',who:subs.querySelector('.who')?.textContent||'',rows:Math.round(box.height/lh),crowded:document.querySelector('.app').classList.contains('crowded'),top:Math.round(subs.getBoundingClientRect().top),chin:Math.round(chin),stageBottom:Math.round(stage.bottom),time:media?+media.currentTime.toFixed(2):null,over:document.documentElement.scrollWidth-innerWidth});
  }).observe(subs,{childList:true});
 });
},{linesVersion:lesson.linesVersion});
await page.route('https://drama.test/**',route=>{
 const u=new URL(route.request().url());let rel=decodeURIComponent(u.pathname.replace(/^\//,''));
 if(rel==='parent.html')return route.fulfill({status:200,headers:{'content-type':'text/html; charset=utf-8'},body:'<!doctype html><html><body style="margin:0;background:#000"></body></html>'});
 rel=rel.replace(/^drama\//,'');if(!rel)rel='index.html';
 const inCand=CAND&&path.join(path.resolve(CAND),'world/drama',rel);
 const file=rel.startsWith('media/')?path.join(MEDIA,rel):inCand&&fs.existsSync(inCand)?inCand:path.join(PILOT,rel);
 if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
 let body=fs.readFileSync(file);
 if(rel==='index.html')body=Buffer.from(body.toString('utf8').replace('<html lang="ko">','<html lang="ko" data-drama="world">'));
 return route.fulfill({status:200,headers:{'content-type':TYPES[path.extname(file)]||'application/octet-stream','accept-ranges':'bytes'},body});
});
await page.goto('https://drama.test/parent.html',{waitUntil:'load'});
// 녹화: 브라우저 화면 프레임을 받아 둔다(시각은 벽시계 초 — 재생 기록과 바로 맞는다).
const frames=[],FRAMES=path.join(OUT,'frames');let cdp=null;
if(RECORD){
 fs.rmSync(FRAMES,{recursive:true,force:true});fs.mkdirSync(FRAMES,{recursive:true});
 cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',({data,metadata,sessionId})=>{const name=`${String(frames.length).padStart(6,'0')}.jpg`;frames.push({name,t:metadata.timestamp});fs.writeFileSync(path.join(FRAMES,name),Buffer.from(data,'base64'));cdp.send('Page.screencastFrameAck',{sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:82,maxWidth:W*2,maxHeight:H*2,everyNthFrame:1});
}
await page.evaluate(({lang,big,w,h})=>{const f=document.createElement('iframe');f.id='f';f.allow='autoplay; fullscreen; microphone';f.style.cssText=big?`border:0;width:${w}px;height:${h}px;display:block;transform:scale(2);transform-origin:0 0`:'border:0;width:100vw;height:100vh;display:block';f.src=`/drama/index.html?lang=${lang}`;document.body.append(f);},{lang:LANG,big:RECORD,w:W,h:H});
let frame=null;for(let i=0;i<60&&!frame;i++){frame=page.frames().find(x=>x.url().includes('/drama/index.html'));if(!frame)await sleep(150);}
await frame.waitForLoadState('load');
await sleep(1500);
if(SHOTS)await page.screenshot({path:path.join(OUT,'00-처음.png')});
const start=Date.now();let n=0,lastSt='';
for(;;){
 if(Date.now()-start>240000){check(false,'장면 끝까지','시간 초과');console.log(await frame.evaluate(()=>document.body.innerText.slice(0,400)));break;}
 const st=await frame.evaluate(()=>{
  const vis=el=>!!el&&el.getClientRects().length>0&&!el.disabled;
  if(document.querySelector('.wrap .log'))return 'wrap';
  const dlg=document.querySelector('dialog[open]');if(dlg){const b=[...dlg.querySelectorAll('button')].filter(vis).pop();if(b){b.click();return 'dialog:'+b.textContent.slice(0,20);}}
  const end=[...document.querySelectorAll('button')].filter(vis).find(b=>/^(마치기|Finish|Дуусгах)/.test(b.textContent.trim()));if(end){end.click();return 'finish';}
  const orb=document.querySelector('#orbBtn');if(vis(orb)&&!document.querySelector('#mic')?.hidden){orb.click();return 'orb';}
  const pill=[...document.querySelectorAll('button.pill,button.big')].filter(vis)[0];if(pill){pill.click();return 'pill:'+pill.textContent.slice(0,24);}
  return 'wait';
 }).catch(()=>null);
 if(st==='wrap')break;
 if(st&&st!==lastSt){
  console.log('  ',Math.round((Date.now()-start)/1000)+'초',st);lastSt=st;
  if(SHOTS&&st!=='wait'){await sleep(700);await page.screenshot({path:path.join(OUT,`${String(++n).padStart(2,'0')}-${st.replace(/[^\w가-힣]+/g,'_').slice(0,24)}.png`)}).catch(()=>{});}
 }
 await sleep(RECORD&&st==='orb'?2600:500);
}
await sleep(RECORD?5000:1200);
if(SHOTS)await page.screenshot({path:path.join(OUT,'99-wrap.png')});
const log=await page.evaluate(()=>({cues:window.__cues,media:window.__media}));
fs.writeFileSync(path.join(OUT,'자막기록.json'),JSON.stringify(log,null,1));

// 대사마다: 시각표 차례대로 넘어갔나
const flat=s=>s.replace(/\s+/g,'');
const seen=log.cues.filter(c=>c.who==='Taeo');
for(const item of lesson.lesson.scene.filter(x=>x.type==='actor')){
 const wants=(item.cues||[]).map(c=>flat(c.text));
 check(wants.length>=2,`${item.id}: 나눈 화면이 있다`,`${wants.length}개`);
 let at=-1,inOrder=true;
 for(const w of wants){const i=seen.findIndex((c,k)=>k>at&&flat(c.text)===flat(w));if(i<0){inOrder=false;break;}at=i;}
 check(inOrder,`${item.id}: 화면이 차례대로 나옴`);
}
const whole=lesson.lesson.scene.filter(x=>x.type==='actor').map(x=>flat(x.text));
check(!seen.some(c=>whole.includes(flat(c.text))),'선배 대사가 통째로 나온 적 없음');
const cueRows=seen.filter(c=>c.rows>0);
check(cueRows.every(c=>c.rows<=2),'한국어 두 줄 이내',`가장 많은 줄 ${Math.max(0,...cueRows.map(c=>c.rows))}`);
// 선배 대사 화면은 영상 아래에 앉는다(44px은 영상 끝이 바탕으로 녹는 자리). 되묻기처럼 대사 카드가 떠 있는 때는 카드 위로 올라가도 되지만 얼굴(턱 선)은 덮지 않는다.
const cueTexts=new Set(lesson.lesson.scene.filter(x=>x.type==='actor').flatMap(x=>(x.cues||[]).map(c=>flat(c.text))));
const actorRows=seen.filter(c=>cueTexts.has(flat(c.text)));
const overlap=actorRows.filter(c=>c.top<c.stageBottom-44);
check(actorRows.length>0&&!overlap.length,'선배 대사가 영상 아래에 앉음',overlap.length?JSON.stringify(overlap[0]):`가장 높은 글 ${Math.min(...actorRows.map(c=>c.top))} · 영상 끝 ${actorRows[0]?.stageBottom}`);
const onFace=log.cues.filter(c=>!c.crowded&&c.top<c.chin);
check(!onFace.length,'어떤 자막도 얼굴을 덮지 않음',onFace.length?JSON.stringify(onFace[0]):`가장 높은 글 ${Math.min(...log.cues.filter(c=>!c.crowded).map(c=>c.top))} · 턱 선 ${log.cues[0]?.chin}`);
check(log.cues.every(c=>c.over<=0),'가로 넘침 없음');
if(!RECORD){
 check(log.media.some(m=>/c3-reask/.test(m.src)),'되묻기 영상 길을 지남');
 check(log.cues.some(c=>c.who==='Coach'),'코치 자막 길을 지남');
 const coach=log.cues.filter(c=>c.who==='Coach'&&!c.crowded);
 check(coach.every(c=>c.top>=c.chin),'코치 자막도 얼굴을 덮지 않음',coach[0]?`가장 높은 글 ${Math.min(...coach.map(c=>c.top))} · 턱 선 ${coach[0].chin}`:'숨김');
}
check(!errors.length,'콘솔 · 페이지 오류 없음',errors.slice(0,3).join(' / '));

if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});
await context.close();
if(RECORD&&frames.length){
 // 현장노트 시험_화면확인 「스크린캐스트는…」: 프레임 시각이 도착 순서대로 늘지 않으니 정렬하고, 화면이 소리보다 0.13~0.17초 늦게 잡히니 소리를 그만큼 늦춘다.
 frames.sort((a,b)=>a.t-b.t);
 const first=frames[0].t,list=frames.map((f,i)=>`file '${f.name}'\nduration ${Math.max(.001,(frames[i+1]?.t??f.t+1)-f.t).toFixed(4)}`).join('\n')+`\nfile '${frames.at(-1).name}'\n`;
 fs.writeFileSync(path.join(FRAMES,'list.txt'),list);
 const audible=log.media.filter(m=>!m.muted&&m.src&&(m.end==null||m.end>m.at));
 const inputs=[],filters=[];
 for(const m of audible){
  const rel=decodeURIComponent(new URL(m.src).pathname).replace(/^\/drama\//,'');
  const file=path.join(MEDIA,rel);if(!fs.existsSync(file))continue;
  const delay=Math.max(0,Math.round(m.at-first*1000)+150),dur=m.end==null?60:(m.end-m.at)/1000;
  inputs.push('-i',file);
  const k=inputs.length/2;
  filters.push(`[${k}:a]atrim=start=${m.from.toFixed(3)}:duration=${dur.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delay}|${delay}[a${k}]`);
 }
 const count=inputs.length/2,labels=Array.from({length:count},(_,i)=>`[a${i+1}]`).join('');
 const mp4=path.join(OUT,`drama-cues-${W}-${LANG}.mp4`);
 const r=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i','list.txt',...inputs,'-filter_complex',`${filters.join(';')};${labels}amix=inputs=${count}:normalize=0[a]`,'-map','0:v','-map','[a]','-r','30','-fps_mode','cfr','-c:v','libx264','-crf','23','-preset','medium','-pix_fmt','yuv420p','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:a','aac','-b:a','160k',mp4],{cwd:FRAMES,encoding:'utf8',maxBuffer:1<<26});
 console.log(r.status===0?`녹화 ${mp4} · 프레임 ${frames.length} · 소리 구간 ${count}개`:`녹화 합치기 실패 ${String(r.stderr).slice(-500)}`);
 if(r.status===0)fs.rmSync(FRAMES,{recursive:true,force:true});
}
await browser.close();
console.log(fail.length?`실패 ${fail.length}건: ${fail.join(' / ')}`:'모두 통과');
process.exit(fail.length?1:0);
