// 서울행(새 학생 첫 실행) 시험: 판별 표 · 학생 칸 읽기 · 시범판 끝 읽기 · 화면 글 · 공개 빌드 규칙. 브라우저 흐름은 experiences/seoul-arrival/qa/흐름.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const stub=(name,value)=>{if(!(name in globalThis))Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});};
stub('location',{search:'',hostname:'synk.im'});
const {readArrival}=await import('../experiences/synk-world-app/seoul-record.mjs');
const {createLifeProgress}=await import('../experiences/synk-world-app/life-progress.mjs');
const {spokenOf,stepsDone,STEP_TAGS,EPISODE}=await import('../experiences/synk-world-app/seoul-watch.mjs');
const {L,sub,TEXT_TABLES}=await import('../experiences/seoul-arrival/strings.mjs');
const entrySource=read('experiences/synk-world-app/seoul-entry.mjs');

test('스위치 상수는 값 하나로 남아 있다', () => {
 assert.match(entrySource,/export const SEOUL_AUTO=(true|false);/);
});

// seoul-entry.mjs는 world-lang(브라우저 전역)을 불러서, 순수 함수만 글에서 꺼내 시험한다.
const pure=(()=>{
 const body=entrySource.slice(entrySource.indexOf('export function seoulMode'),entrySource.indexOf('export function createSeoulEntry')).replace(/export function /g,'function ');
 return new Function(`${body};return {seoulMode,seoulDecision};`)();
})();

test('주소의 바로가기는 서울행을 띄우지 않는다', () => {
 const {seoulMode}=pure;
 assert.equal(seoulMode({search:'',feature:true}),'auto');
 assert.equal(seoulMode({search:'',feature:false}),null);
 assert.equal(seoulMode({search:'?seoul=1',feature:false}),'force');
 for(const search of ['?drama=1','?me2=1','?cafe=1','?wardrobe=1','?exam=topik1','?tutor=choose','?opening=off'])assert.equal(seoulMode({search,feature:false}),'bypass',search);
 assert.equal(seoulMode({search:'',feature:true,dramaPending:true}),'bypass','로그인을 거쳐 돌아오는 드라마 바로가기');
});

test('판별 표', () => {
 const {seoulDecision:d}=pure;
 // 처음 온 학생
 assert.deepEqual(d({mode:'auto'}),{run:true,at:'title',fresh:true});
 assert.deepEqual(d({mode:null}),{run:false});
 // 돌아온 학생
 assert.deepEqual(d({mode:'auto',tutor:true}),{run:false});
 assert.deepEqual(d({mode:'auto',owner:'a',tutor:true}),{run:false});
 // 막힘 · PC 앱
 assert.deepEqual(d({mode:'force',blocked:true}),{run:false});
 assert.deepEqual(d({mode:'force',native:true}),{run:false});
 // 이어 오기: 스위치와 상관없다
 assert.deepEqual(d({mode:null,guest:{stage:'card'}}),{run:true,at:'road'});
 assert.deepEqual(d({mode:null,guest:{stage:'dream'}}),{run:true,at:'title'});
 assert.deepEqual(d({mode:null,owner:'a',arrival:{stage:'card'}}),{run:true,at:'road'});
 assert.deepEqual(d({mode:'auto',guest:{stage:'left'}}),{run:false});
 // 바로가기는 그 길 그대로: 손님 사본 · 계정 기록이 있어도 서울행 · 저장 묻기로 가로채지 않는다
 assert.deepEqual(d({mode:'bypass',guest:{stage:'card'}}),{run:false});
 assert.deepEqual(d({mode:'bypass',owner:'a',guest:{stage:'card'}}),{run:false});
 assert.deepEqual(d({mode:'bypass',owner:'a',arrival:{stage:'card'}}),{run:false});
 // 다시 보기: ?seoul=1이 처음부터 보여 주는 것은 끝낸 기록뿐이고, 기록을 덮지 않는다
 assert.deepEqual(d({mode:'force',owner:'a',arrival:{stage:'left'}}),{run:true,at:'title',replay:true});
 assert.deepEqual(d({mode:'force',guest:{stage:'left'}}),{run:true,at:'title',replay:true});
 assert.deepEqual(d({mode:'force'}),{run:true,at:'title',fresh:true});
 // ?seoul=1이어도 가는 중이면 이어 간다 — 1화 앞 로그인으로 다시 불리거나 손님 사본을 옮긴 뒤 내 길로
 assert.deepEqual(d({mode:'force',owner:'a',arrival:{stage:'card'}}),{run:true,at:'road'});
 assert.deepEqual(d({mode:'force',guest:{stage:'card'}}),{run:true,at:'road'});
 assert.deepEqual(d({mode:'force',guest:{stage:'dream'}}),{run:true,at:'title'});
 // 손님 사본 + 계정에 없음 = 묻는다(저절로 안 옮긴다). 계정에 있으면 안 묻는다
 assert.deepEqual(d({mode:null,owner:'a',guest:{stage:'card'}}),{run:true,ask:true});
 assert.deepEqual(d({mode:null,owner:'a',arrival:{stage:'left'},guest:{stage:'card'}}),{run:false});
});

test('학생 칸: 이상한 값은 그 칸만 없는 것으로 읽는다', () => {
 assert.equal(readArrival(null),null);
 assert.equal(readArrival({version:2}),null);
 const a=readArrival({version:1,stage:'x',dream:'model',name:'  볼로르  ',nameEn:'B'.repeat(99),from:7,call:'형',look:'../x',lights:-1,best:{s1e01:{n:3,t2:true,tr:'y'},'../':{n:1},s2:{n:999}},scenes:[{id:'s1e01.wrap',at:5,lines:3},{id:'<x>',at:5},{id:'a',at:-1}],momAnswer:'z',momAt:'y',extra:1});
 assert.equal(a.stage,'prologue');assert.equal(a.dream,null);assert.equal(a.name,'볼로르');assert.equal(a.nameEn.length,40);assert.equal(a.from,null);assert.equal(a.call,null);assert.equal(a.look,null);assert.equal(a.lights,0);
 assert.deepEqual(a.best,{s1e01:{n:3,t2:true,tr:false}});
 assert.deepEqual(a.scenes,[{id:'s1e01.wrap',at:5,lines:3}]);
 assert.equal(a.momAnswer,null);assert.equal(a.extra,undefined);
 assert.equal(readArrival({version:1,scenes:Array.from({length:300},(_,i)=>({id:'a'+i,at:i}))}).scenes.length,200);
});

function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size;}};}
test('생활 기록의 칸: 쓰고 읽고, 옛 칸은 지키고, 옛 판 기록을 거절하지 않는다', () => {
 const storage=memoryStorage();
 const life=createLifeProgress({storage,owner:'guest',now:()=>1000});
 assert.equal(life.arrival(),null);
 life.setArrival({stage:'dream',dream:'idol',name:'민'});
 life.setArrival({from:'베트남'});
 const a=life.arrival();
 assert.equal(a.dream,'idol');assert.equal(a.name,'민');assert.equal(a.from,'베트남');assert.equal(a.updatedAt,1000);
 life.selectTutor('mongle');
 assert.equal(life.selectedTutor(),'mongle');
 assert.equal(life.arrival().dream,'idol');
 const again=createLifeProgress({storage,owner:'guest',now:()=>2000});
 assert.equal(again.arrival().from,'베트남');
 assert.equal(again.selectedTutor(),'mongle');
 // 모양이 망가진 칸이 있어도 기록 전체는 살아 있다
 const key=[...Array(storage.length).keys()].map(i=>storage.key(i)).find(k=>k.startsWith('synk.life-korean.progress.v1'));
 const raw=JSON.parse(storage.getItem(key));raw.arrival={version:9};storage.setItem(key,JSON.stringify(raw));
 const third=createLifeProgress({storage,owner:'guest',now:()=>3000});
 assert.equal(third.arrival(),null);
 assert.equal(third.selectedTutor(),'mongle');
});

test('시범판 끝 읽기: 실제 글(한 · 영 · 몽)에서 말한 줄을 고른다', async () => {
 const strings=read('experiences/drama/pilot/strings.mjs');
 const forms=[...strings.matchAll(/wrapLines: \(n, m\) => `([^`]+)`/g)].map(m=>m[1]);
 assert.equal(forms.length,3,'한 · 영 · 몽 세 줄');
 for(const form of forms){
  const text=(n,m)=>form.replace('${n}',n).replace('${m}',m);
  assert.equal(spokenOf(text(2,3)),2,form);
  assert.equal(spokenOf(text(3,3)),3,form);
  assert.equal(spokenOf(text(0,3)),0,form);
 }
 assert.equal(spokenOf(''),0);
});

test('시범판 꼬리표 · 표시가 그대로다(바뀌면 끝 읽기를 함께 고친다)', () => {
 const pilot=read('experiences/drama/pilot/pilot.mjs');
 for(const tag of Object.values(STEP_TAGS))assert.ok(pilot.includes(`'${tag}'`),`시범판에 없는 꼬리표: ${tag}`);
 assert.match(read('experiences/drama/pilot/index.html'),/id="epTag"/);
 assert.match(pilot,/h\('ul', \{ class: 'log' \}/);
 assert.match(pilot,/h\('div', \{ class: 'wrap' \}/);
 assert.match(pilot,/class: `tick \$\{on \? 'on' : ''\}`/);
 assert.match(pilot,/class: 'intro'/);
});

test('단계 꼬리표 차례 → 장면 끝 기록', () => {
 const run=(tags)=>{const seen=new Set(['started']);const out=[];let prev=STEP_TAGS.scene;for(const t of tags){out.push(...stepsDone(prev,t,seen));prev=t;}return out;};
 assert.deepEqual(run([STEP_TAGS.take2,STEP_TAGS.transfer,STEP_TAGS.wrap]),[`${EPISODE}.scene`,`${EPISODE}.take2`,`${EPISODE}.transfer`]);
 assert.deepEqual(run([STEP_TAGS.transfer,STEP_TAGS.wrap]),[`${EPISODE}.scene`,`${EPISODE}.transfer`]);
 assert.deepEqual(run([STEP_TAGS.wrap]),[`${EPISODE}.scene`]);
 // 첫 화면 카드에서 바로 새 상황으로 간 길은 장면 끝이 아니다
 const seen=new Set();assert.deepEqual(stepsDone(STEP_TAGS.scene,STEP_TAGS.transfer,seen),[]);
});

test('화면 글: 쓰는 글이 모두 영어 · 몽골어 표에 있다', () => {
 const app=['app.mjs','name-trace.mjs'].map(f=>read('experiences/seoul-arrival/'+f)).join(String.fromCharCode(10)),html=read('experiences/seoul-arrival/index.html');
 const code=app.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
 const keys=new Set();
 for(const m of code.matchAll(/\bL\('((?:[^'\\]|\\.)+)'/g))keys.add(m[1]);
 for(const m of html.matchAll(/data-l(?:-aria|-html)?="([^"]+)"/g))keys.add(m[1]);
 // 표로 쓰는 글(ROAD · DREAM · 박자 · 힌트)
 for(const m of code.matchAll(/\b(?:t|b|goal|chip|title|goalSub|story|line|goal):'([^']*[가-힣][^']*)'/g))keys.add(m[1]);
 const dropStoryOnly=new Set(['']);
 const missing={en:[],mn:[]};
 for(const lang of ['en','mn'])for(const k of keys){if(dropStoryOnly.has(k))continue;if(!(k in TEXT_TABLES.UI[lang])&&!(k in TEXT_TABLES.STORY[lang]))missing[lang].push(k);}
 assert.deepEqual(missing,{en:[],mn:[]});
 for(const lang of ['en','mn'])assert.deepEqual(Object.keys(TEXT_TABLES.UI.en).filter(k=>!(k in TEXT_TABLES.UI[lang])),[],lang);
 assert.deepEqual(Object.keys(TEXT_TABLES.STORY.en).filter(k=>!(k in TEXT_TABLES.STORY.mn)),[]);
});

test('이야기 줄: 해설 · 대사마다 번역이 있고 이름 든 줄도 맞는다', () => {
 const app=read('experiences/seoul-arrival/app.mjs');
 const lines=new Set();
 for(const m of app.matchAll(/(?:narrate\(r,|say\(r,'[a-z]+',|me\(r,|beatLine\()'([^']+)'/g))lines.add(m[1]);
 assert.ok(lines.size>30,String(lines.size));
 for(const lang of ['en','mn'])for(const line of lines)assert.ok(sub(line,lang),`${lang}: ${line}`);
 for(const lang of ['en','mn']){
  for(const line of ['볼로르 씨! 반가워요.','제 이름은 볼로르예요.','제 이름은 민이에요.','볼로르 씨는 어디서 왔어요?','그럼 어디서 왔어요?','몽골에서 왔어요.','케냐에서 왔어요.','케냐! 멀리서 왔네요.','서하 선배! 잘 부탁해요.','Bolor… 한글로는 어떻게 써요?','Bolor 씨! 반가워요. 한글로 쓰는 건 다음에 같이 해 봐요.','와, 몽골! 여기 봄은 몽골보다 따뜻하죠? 나중에 몽골 이야기 많이 들려줘요.'])assert.ok(sub(line,lang),`${lang}: ${line}`);
 }
 assert.equal(sub('몽골에서 왔어요.','ko'),'');
 assert.equal(L('받침있음',{ch:'민'},'ko'),'‘민’에 받침이 있어서 ‘이에요’를 붙여요.');
});

test('공개 파일에 도구 · 검수자 이름이 없다', () => {
 const dir=path.join(ROOT,'experiences/seoul-arrival');
 const texts=['app.mjs','data.mjs','strings.mjs','style.css','index.html','hangul-strokes.mjs','name-hand.mjs','name-hangul.mjs','name-trace.mjs'].map(f=>[f,fs.readFileSync(path.join(dir,f),'utf8')]);
 texts.push(['seoul-entry.mjs',entrySource],['seoul-watch.mjs',read('experiences/synk-world-app/seoul-watch.mjs')]);
 const NAMES=/suno|higgsfield|힉스필드|nano banana|나노바나나|midjourney|gpt[- ]?image|gpt[- ]?이미지|elevenlabs|일레븐|typecast|타입캐스트|mmaudio|seedance|시댄스|kling|gemini|아르곤|fable|페이블|\bsam\b/i;
 for(const [name,text] of texts)assert.equal(NAMES.exec(text)?.[0],undefined,name);
});

test('앱이 부르는 소리 · 그림 파일이 모두 폴더에 있고, 소리마다 출처가 적혀 있다', () => {
 const app=read('experiences/seoul-arrival/app.mjs');
 const names=JSON.parse(app.match(/const AUD=Object\.fromEntries\((\[[^\]]+\])/)[1].replace(/'/g,'"'));
 const dir=path.join(ROOT,'experiences/seoul-arrival/assets/snd');
 for(const name of names)assert.ok(fs.existsSync(path.join(dir,`${name}.mp3`)),name);
 const made=JSON.parse(read('experiences/seoul-arrival/qa/소리출처.json'));
 for(const name of names.filter(n=>/^(amb|sfx)_/.test(n)&&n!=='sfx_imo'))assert.ok(made[name]?.출처,`출처: ${name}`);
});

test('배경 고리 파일의 앞뒤 덧댐을 앱이 같은 값으로 건너 돈다', () => {
 const app=read('experiences/seoul-arrival/app.mjs');
 const pad=Number(app.match(/const AMB_PAD=([\d.]+);/)?.[1]);
 assert.ok(pad>0,'AMB_PAD');
 assert.match(app,/s\.loopStart=AMB_PAD;s\.loopEnd=s\.buffer\.duration-AMB_PAD;/);
 assert.match(app,/s\.start\(0,AMB_PAD\)/);
 const trim=read('experiences/seoul-arrival/qa/소리다듬기.py');
 assert.equal(Number(trim.match(/^PAD = ([\d.]+)$/m)?.[1]),pad,'소리다듬기 PAD');
 const made=JSON.parse(read('experiences/seoul-arrival/qa/소리출처.json'));
 for(const [name,row] of Object.entries(made))if(name.startsWith('amb_'))assert.equal(row.덧댐,pad,name);
});

test('비상업 조건 소리가 앱 폴더에 없다', () => {
 const list=path.join(ROOT,'experiences/seoul-arrival/qa/비상업소리지문.json');
 const banned=new Set(JSON.parse(fs.readFileSync(list,'utf8')).sha256);
 const dir=path.join(ROOT,'experiences/seoul-arrival/assets/snd');
 for(const name of fs.readdirSync(dir)){
  const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex');
  assert.ok(!banned.has(sha),name);
 }
});

test('공개 빌드가 서울행을 싣고 시험 · 설계는 뺀다', () => {
 const build=read('tools/build-world-app-public.mjs');
 assert.match(build,/copyTree\(path\.join\(root,'experiences','seoul-arrival'\),'seoul-arrival',/);
 assert.match(build,/qa\\\/\|/);
 assert.match(build,/'seoul-entry\.mjs','seoul-watch\.mjs','seoul-record\.mjs'/);
});

test('시범판 파일을 고치지 않았다: 서울행은 부모 쪽에서만 읽는다', () => {
 const pilot=read('experiences/drama/pilot/pilot.mjs');
 assert.ok(!/seoul|서울행/i.test(pilot));
 assert.ok(!/SYNKSeoulHost/.test(read('experiences/drama/pilot/index.html')));
});
