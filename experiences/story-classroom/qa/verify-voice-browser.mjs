import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import path from 'node:path';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {EPISODE} from '../story.mjs';
const require=createRequire(import.meta.url),{chromium}=require(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const folder=path.dirname(fileURLToPath(import.meta.url)),results={date:new Date().toISOString(),checks:[],errors:[],expectedFailures:[],pass:false};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const url='http://127.0.0.1:5213/';
async function page(options={}){const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options}),p=await ctx.newPage();p.on('pageerror',e=>results.errors.push(String(e)));await p.goto(url+(options.reading?'?reading=1':''));await p.locator('#start').click();return {p,ctx};}
const state=p=>p.evaluate(()=>window.__storyState);
async function play(p,id){await p.waitForFunction(id=>window.__storyVoice.state==='playing'&&(!id||window.__storyVoice.id===id),id,{timeout:15000});}
async function ready(p){await p.waitForFunction(()=>window.__storyVoice.state==='ready',null,{timeout:35000});}
async function dialogue(p,target='play'){for(let i=0;i<35;i++){const s=await state(p);if(s.phase===target)return;assert(!['play','review','complete'].includes(s.phase));await p.locator('#dialogue-next').click();}throw Error('Story barrier');}
async function move(p,m){await p.locator(`[data-actor="${m.actor}"]`).click();await p.locator(`[data-object="${m.object}"]`).click();await p.locator(`[data-destination="${m.destination}"]`).click();await p.waitForFunction(()=>!window.__storyState.busy);}
try{
 const {p,ctx}=await page();
 await play(p,'dialogue-opening-01');await ready(p);results.checks.push({name:'native-speed opening recording completed in actual Chrome Web Audio',pass:true});
 await p.locator('#dialogue-next').click();await play(p,'dialogue-opening-02');await ready(p);
 await p.locator('#dialogue-next').click();await play(p,'dialogue-opening-03');await p.locator('#dialogue-next').click();await play(p,'dialogue-opening-04');await ready(p);
 results.checks.push({name:'next text cancels old character voice and starts teacher recording',pass:true});
 await dialogue(p);await play(p,'mission-cleanup-snacks');await ready(p);
 let s=await state(p);for(const id of ['cleanup-snacks','cleanup-paper'])assert.equal(s.records.find(r=>r.id===id).audioBeforeFirst,true);
 await p.locator('[data-voice="mission-cleanup-paper"]').click();await play(p,'mission-cleanup-paper');await ready(p);
 await move(p,EPISODE.acts[0].missions[0]);s=await state(p);assert.equal(s.records.find(r=>r.id==='cleanup-snacks').firstAudioHelpUsed,true);
 const profile=await p.evaluate(()=>window.__storyLearning.summary);assert(profile.counts.attempts>=1);assert.equal(profile.skills.find(s=>s.id==='ko.reading.detail').levels[1].formats.action.n,0);
 results.checks.push({name:'mission auto speech, per-text replay, and assisted reading evidence',pass:true});
 await p.locator('#voice-auto').click();await p.locator('#voice-replay').click();await play(p,'feedback-cleanup-snacks-success');await p.locator('#sound').click();assert.equal((await p.evaluate(()=>window.__storyVoice)).state,'muted');
 await p.locator('#sound').click();await p.locator('#reading-mode').click();assert.equal((await p.evaluate(()=>window.__storyVoice)).readingOnly,true);assert.equal(await p.locator('#voice-replay').isDisabled(),true);
 results.checks.push({name:'manual replay with automatic-off, mute and reading-only cancel current playback',pass:true});
 await ctx.close();

 const reading=await page({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reading:true});
 const q=reading.p;await dialogue(q);assert.equal((await q.evaluate(()=>window.__storyVoice)).state,'reading');
 for(const act of EPISODE.acts){for(const mission of act.missions)await move(q,mission);await dialogue(q,act===EPISODE.acts.at(-1)?'review':'play');}
 for(const mission of EPISODE.review)await move(q,mission);
 s=await state(q);assert.equal(s.phase,'complete');assert.equal(s.records.filter(r=>r.firstCorrect&&!r.firstHelpUsed&&!r.firstAudioHelpUsed).length,9);
 const readingSummary=await q.evaluate(()=>window.__storyLearning.summary);assert.equal(readingSummary.counts.attempts,9);
 assert.equal(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.match(await q.locator('#ending-content').textContent(),/음성 도움을 받은 부탁 0개/);
 await q.screenshot({path:path.join(folder,'voice-390-reading-ending.png'),fullPage:true});
 results.checks.push({name:'390px all nine reading-only tasks completed, independent first responses and Atlas records',pass:true,summary:readingSummary});await reading.ctx.close();

 const failCtx=await browser.newContext({viewport:{width:1440,height:1000}}),f=await failCtx.newPage();
 await f.route('**/assets/voice/dialogue-opening-01.mp3',route=>route.fulfill({status:404,body:'missing'}));
 await f.goto(url);await f.locator('#start').click();await f.waitForFunction(()=>window.__storyVoice.state==='error');assert.equal((await state(f)).records.length,0);assert.match(await f.locator('#voice-status').textContent(),/불러오지 못/);
 await f.unroute('**/assets/voice/dialogue-opening-01.mp3');await f.locator('#voice-replay').click();await play(f,'dialogue-opening-01');await ready(f);results.expectedFailures.push('One intentionally blocked MP3; retry succeeded without marking a failed load as help');
 await failCtx.close();

 const checkCtx=await browser.newContext(),check=await checkCtx.newPage();await check.goto(url);
 const files=await check.evaluate(async()=>{const m=await(await fetch('./assets/voice/manifest.json')).json(),ctx=new AudioContext(),out=[];for(const line of m.lines){const response=await fetch('./'+line.file);if(!response.ok)throw Error(line.id);const bytes=await response.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);if([...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')!==line.sha256)throw Error('Hash mismatch '+line.id);const b=await ctx.decodeAudioData(bytes);out.push({id:line.id,seconds:b.duration,channels:b.numberOfChannels});}await ctx.close();return out;});
 assert.equal(files.length,90);results.checks.push({name:'all ninety local recordings fetched, SHA-256 verified and decoded in Chrome',pass:true,files});await checkCtx.close();
 assert.deepEqual(results.errors,[]);results.pass=true;
}catch(e){results.failure=String(e.stack||e);process.exitCode=1;}finally{
 results.sourceHashes=Object.fromEntries(await Promise.all(['app.mjs','story.mjs','core.mjs','voice.mjs','voice-lines.mjs','learning.mjs','audio.mjs','index.html','style.css'].map(async name=>[name,createHash('sha256').update(await readFile(path.join(folder,'..',name))).digest('hex')])));
 await writeFile(path.join(folder,'voice-browser-results.json'),JSON.stringify(results,null,2)+'\n');await browser.close();console.log(JSON.stringify({...results,checks:results.checks.map(c=>({name:c.name,pass:c.pass}))},null,2));
}
