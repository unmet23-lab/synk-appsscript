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
 return new Function(`${body};return {seoulMode,seoulDecision,photoView};`)();
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
 // 학생증 발급일(11-23): 시각 숫자만 남고, 이상한 값은 없는 것으로 읽는다
 assert.equal(readArrival({version:1,issuedAt:1795400000000}).issuedAt,1795400000000);
 assert.equal(readArrival({version:1,issuedAt:'2026-11-23'}).issuedAt,null);
 assert.equal(readArrival({version:1}).issuedAt,null);
});

test('내 사진 칸: 초대받은 학생에게만 켜고, 주소는 고른 기준 사진만 받는다', () => {
 const {photoView}=pure,url='https://abc.supabase.co/storage/v1/object/sign/me2-media/u/base.jpg?token=t.k-n_1';
 assert.equal(photoView(null),null);   // 답을 못 받음 = 모름(틀은 보이던 사진을 둔다)
 assert.equal(photoView({status:'error'}),null);
 assert.deepEqual(photoView({status:'not_invited'}),{on:false});
 assert.deepEqual(photoView({status:'ok',consent:{given:false},me:{state:'none'}}),{on:true,state:'none',url:null,paused:false});
 assert.deepEqual(photoView({status:'ok',consent:{given:true},me:{state:'developing'}}),{on:true,state:'developing',url:null,paused:false});
 assert.deepEqual(photoView({status:'ok',consent:{given:true},me:{state:'ready',chosen_url:url}}),{on:true,state:'ready',url,paused:false});
 assert.equal(photoView({status:'ok',me:{state:'ready',chosen_url:'javascript:alert(1)'}}).url,null);
 // 새 사진을 고를 차례여도 앞서 고른 사진은 계속 보인다
 assert.deepEqual(photoView({status:'ok',consent:{given:true},me:{state:'choose',chosen_url:url}}),{on:true,state:'choose',url,paused:false});
 assert.deepEqual(photoView({status:'ok',consent:{given:true},me:{state:'choose'}}),{on:true,state:'choose',url:null,paused:false});
 assert.equal(photoView({status:'ok',me:{state:'이상한 값'}}).state,'none');
 // 사진관이 쉬면 동의했고 만든(만드는) 사진이 있을 때만 칸을 둔다 — 새로 맡길 수 없어서다
 assert.deepEqual(photoView({status:'off',consent:{given:false},me:{state:'ready',chosen_url:url}}),{on:false});
 assert.deepEqual(photoView({status:'off',consent:{given:true},me:{state:'none'}}),{on:false});
 assert.deepEqual(photoView({status:'off',consent:{given:true},me:{state:'ready',chosen_url:url}}),{on:true,state:'ready',url,paused:true});
 // 기록에는 「내 사진」 표시만 남는다(사진 · 주소는 넣지 않는다)
 assert.equal(readArrival({version:1,photo:'me',look:'mn_f'}).photo,'me');
 assert.equal(readArrival({version:1,photo:url}).photo,null);
 assert.equal(readArrival({version:1,look:'me'}).look,null);
});

test('내 사진 칸: 손님 · 다른 주인은 서버에 묻지 않고, 사진 판은 서울행 틀 위 맨 윗겹에 연다', () => {
 assert.match(entrySource,/const photoOwner=\(\)=>\{const s=session,who=owner\(\);return s&&who!=='guest'&&who===s\.owner&&me2\?who:null;\};/);
 assert.match(entrySource,/if\(panel\?\.open\)\{close\(\);if\(panel\.open\)panel\.close\(\);\}\r?\n  try\{await me2\.open\(\);\}catch\{\}/);
 assert.match(entrySource,/photo,openPhoto,\r?\n  leave\(\)\{finish\(\);\},/);
 const shell=read('experiences/synk-world-app/app-shell.mjs');
 assert.match(shell,/async function me2Status\(\)\{if\(!me2Allowed\(\)\)return \{status:'not_invited'\};const owner=client\.snapshot\?\.accountId,out=await account\.me2Request\(\{action:'status'\}\);/);
 assert.match(shell,/me2:\{status:\(\)=>me2Status\(\),open:\(\)=>openMe2\(\)\}/);
 const app=read('experiences/seoul-arrival/app.mjs').replace(/\r\n/g,'\n');
 assert.match(app,/function meTile\(\)\{\n  if\(!PHOTO\.on\)return '';/);
 assert.match(app,/rail\.innerHTML=meTile\(\)\+order\.map/);
 assert.match(app,/function saveLook\(lk\)\{save\(lk\?\.mine\?\{look:null,photo:'me'\}:\{look:lk\?lk\.id:null,photo:null\}\);schedulePhoto\(\);\}/);
 assert.match(app,/const lookOf=a=>a\?\.photo==='me'\?ME:a\?\.look\?lookById\(a\.look\):null;/);
 // 틀의 CSP는 사진 저장소 한 곳만 더 연다(와일드카드 · https: 전체를 열지 않는다)
 const csp=read('experiences/seoul-arrival/index.html').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
 assert.match(csp,/img-src 'self' data: blob: https:\/\/qiwxeddwwnzkwalpsuty\.supabase\.co;/);
 assert.doesNotMatch(csp,/\*|https:(?!\/\/)/);
 assert.match(csp,/connect-src 'self';/);
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

test('손님 1화(11-23): 로그인 판 없이 열고, 끝 띠에 체험 끝 안내와 사전예약 단추를 둔다', () => {
 // 1화 앞에서 로그인을 부르지 않는다
 assert.match(entrySource,/function prepareEpisode\(\)\{return \{status:'ok'\};\}/);
 assert.doesNotMatch(entrySource,/signIn\(/);
 // 사전예약 주소: from과 화면 언어(ko · en · mn 밖이면 en)
 const reserveUrl=new Function(`${entrySource.match(/export (function reserveUrl\(lang\)\{[^\n]+\})/)[1]};return reserveUrl;`)();
 for(const lang of ['ko','en','mn'])assert.equal(reserveUrl(lang),`https://synk.im/reserve/?from=world-ep1&lang=${lang}`);
 assert.equal(reserveUrl('vi'),'https://synk.im/reserve/?from=world-ep1&lang=en');
 // 세 언어 글이 다 있다
 for(const key of ['trialEnd','trialMore','reserve','toCrowd'])for(const lang of ['ko','en','mn'])assert.match(entrySource,new RegExp(`\\n ${key}:\\{ko:'[^']+',en:'[^']+',mn:'[^']+'\\}`),`${key} ${lang}`);
 // 손님 띠만 사전예약을 싣고, 새 탭으로 연다(이야기는 이 탭에서 이어진다). 계정 띠는 예전 그대로 단추 하나다.
 const band=entrySource.slice(entrySource.indexOf(' function showBand('),entrySource.indexOf(' let finish='));
 assert.match(band,/guest=!client\(\)\.snapshot/);
 assert.match(band,/<a class="felt-button" href="\$\{escape\(reserveUrl\(lang\)\)\}" target="_blank" rel="noopener">/);
 assert.match(band,/:`<button type="button" class="felt-button">\$\{say\('toCrowd'\)\}<\/button>`/);
 assert.match(read('experiences/synk-world-app/app-shell.css'),/#panel-content:has\(>\.seoul-cta\.is-trial\)>\.game-frame\{flex:1 1 auto;height:auto;min-height:0\}/);
});

test('화면 글: 쓰는 글이 모두 영어 · 몽골어 표에 있다', () => {
 const app=['app.mjs','name-trace.mjs','name-coach.mjs'].map(f=>read('experiences/seoul-arrival/'+f)).join(String.fromCharCode(10)),html=read('experiences/seoul-arrival/index.html');
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
 const texts=['app.mjs','data.mjs','strings.mjs','style.css','index.html','hangul-strokes.mjs','name-hand.mjs','name-hangul.mjs','name-trace.mjs','name-ink.mjs','name-coach.mjs','fans.mjs','fan-lines.mjs'].map(f=>[f,fs.readFileSync(path.join(dir,f),'utf8')]);
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

// 내 팬 한마디(팬설계.md §12-3): 문장 원천은 Vellum이고, 공개 묶음에는 도구가 구운 fan-lines.mjs만 실린다. 원천을 고치고 다시 굽지 않으면 여기서 걸린다.
test('내 팬 한마디: 생성 파일이 Vellum 원천에서 다시 구운 것과 같고, 칸 밖이면 null이다', async () => {
 const {buildFanLines,serialize,fanRows,DESTINATION,MAX_LINES,HOLD}=await import('../tools/build-seoul-fan-lines.mjs');
 assert.equal(fs.readFileSync(DESTINATION,'utf8').replace(/\r\n/g,'\n'),serialize(buildFanLines()),'낡음 — node tools/build-seoul-fan-lines.mjs');
 const {spawnSync}=await import('node:child_process');
 const check=spawnSync(process.execPath,['tools/build-seoul-fan-lines.mjs','--check'],{cwd:ROOT,encoding:'utf8'});
 assert.equal(check.status,0,check.stdout+check.stderr);
 const text=read('experiences/seoul-arrival/fan-lines.mjs');
 assert.ok(text.startsWith('// Generated from packages/atlas/src/vellum (scene.lines · scene.step, 말하는 사람 fan). Change the source; run node tools/build-seoul-fan-lines.mjs.'));
 assert.ok(!/^\s*import\b|\bimport\(/m.test(text),'import가 없는 파일');
 const {FAN_LINES,fanLine}=await import('../experiences/seoul-arrival/fan-lines.mjs');
 const {render}=await import('../packages/atlas/src/vellum/index.mjs');
 assert.deepEqual(Object.keys(FAN_LINES),['ko','en','mn']);
 assert.equal(MAX_LINES,10);
 for(const [lang,table] of Object.entries(FAN_LINES)){
  assert.ok(Object.isFrozen(table),lang);
  assert.deepEqual(Object.keys(table),fanRows().map(([key])=>key),lang);
  for(const [key,why] of fanRows()){
   assert.equal(fanLine(lang,why),table[key],`${lang} ${key}`);
   assert.equal(fanLine(lang,why),HOLD[lang]?.[why.code]??render(why,{lang,speaker:'fan'}),`${lang} ${key}: Vellum과 같다`);
  }
 }
 assert.equal(fanLine('ko',{code:'scene.step',slots:{step:'take2',state:'wait'}}),'「한 번 더」는 기다릴게요. 하면 자리 하나가 켜져요.');
 // n은 소리가 들린 대사 줄의 수다(같은 줄을 다시 녹음해도 늘지 않는다). 몽골어가 횟수(удаа) · 낱말(үг N) · 문장(өгүүлбэр)으로 세면 사실과 다르다
 assert.deepEqual(Object.keys(HOLD),[],'따로 두는 글이 없다 — Vellum 원천이 같은 글이다');
 for(let n=1;n<=MAX_LINES;n+=1)assert.doesNotMatch(fanLine('mn',{code:'scene.lines',slots:{n}}),/\d|удаа|өгүүлбэр/,`mn scene.lines ${n}`);
 const mnUi=TEXT_TABLES.UI.mn;
 for(const k of ['말한 줄마다 내 팬이 한 사람씩 자리에 앉아요.','말한 줄마다 내 팬의 불빛이 하나씩 켜져요.','대사 한 줄마다 한 명, 「한 번 더」와 「처음 보는 말」에 한 명씩 와요.'])
  assert.match(mnUi[k],/шинэ хэсгийг хэлэх бүрд/,`${k}: 다시 말한 줄은 세지 않는다`);
 // 객석의 수는 켜진 자리(사람 + 친구) 수라 팬 수로 부른다
 const crowd=/async function crowdScene[\s\S]*?\n\}\n/.exec(read('experiences/seoul-arrival/app.mjs').replace(/\r\n/g,'\n'))?.[0]??'';
 assert.equal((crowd.match(/count\.textContent=[^;]*L\('팬 \{n\}명'/g)||[]).length,2);assert.doesNotMatch(crowd,/말한 줄 \{n\}개/);
 const bad=[
  {code:'scene.lines',slots:{n:0}},{code:'scene.lines',slots:{n:11}},{code:'scene.lines',slots:{n:-1}},{code:'scene.lines',slots:{n:1.5}},
  {code:'scene.lines',slots:{n:'2'}},{code:'scene.lines',slots:{n:[2]}},{code:'scene.lines',slots:{n:2,extra:1}},{code:'scene.lines',slots:{}},{code:'scene.lines'},
  {code:'scene.step',slots:{step:'take3',state:'done'}},{code:'scene.step',slots:{step:'take2',state:'skipped'}},{code:'scene.step',slots:{step:['take2'],state:['done']}},
  {code:'scene.step',slots:{step:'take2',state:'done',extra:1}},{code:'scene.step',slots:{step:'take2'}},{code:'scene.step',slots:{step:'toString',state:'done'}},
  {code:'scene.nope',slots:{n:1}},{code:'toString',slots:{n:1}},{code:'scene.step',slots:Object.assign(Object.create(null),{step:'take2',state:'done'})},null,undefined,
 ];
 for(const lang of ['ko','en','mn'])for(const why of bad){
  assert.equal(fanLine(lang,why),null,`${lang} ${JSON.stringify(why)}`);
  // 1~10 안에서는 Vellum의 칸 검사와 같은 뜻이다(n 11 이상만 생성 범위 밖이라 Vellum은 짓는다)
  if(!(why?.code==='scene.lines'&&why.slots?.n===11))assert.equal(render(why,{lang,speaker:'fan'}),null,`Vellum ${lang} ${JSON.stringify(why)}`);
 }
 const ok={code:'scene.lines',slots:{n:3}};
 for(const lang of ['fr','',null,undefined,'constructor','__proto__','toString'])assert.equal(fanLine(lang,ok),null,`언어 ${lang}`);
 // 공개 파일이다 — 도구 · 검수자 이름이 없다(위 「공개 파일에 도구 · 검수자 이름이 없다」와 같은 잣대)
 assert.equal(/suno|higgsfield|힉스필드|nano banana|나노바나나|midjourney|gpt[- ]?image|gpt[- ]?이미지|elevenlabs|일레븐|typecast|타입캐스트|mmaudio|seedance|시댄스|kling|gemini|아르곤|fable|페이블|opus|카본|\bsam\b/i.exec(text)?.[0],undefined);
});
// 「내 팬」 1차: 누가 무엇을 말하나(팬설계.md 12-2). 모든 조합을 표로 본다 — 첫 판, 다시 한 판, 내 팬 화면(best).
test('내 팬: 말하는 팬과 이유가 설계 12-2 표와 같다',async()=>{
 const {curtainSay,bestSay,faceCount,FANS}=await import('../experiences/seoul-arrival/fans.mjs');
 const {fanLine}=await import('../experiences/seoul-arrival/fan-lines.mjs');
 const tag=list=>list.map(x=>`${x.fan}:${x.why.code==='scene.lines'?'L'+x.why.slots.n:(x.why.slots.step==='take2'?'T':'R')+(x.why.slots.state==='done'?'+':'-')}`).join(' ');
 const B=[false,true];
 // 첫 판: 이번 판 줄 수(1~3)만큼 사람 자리가 말한다. 줄 수 → 단계(한 것 먼저, 같으면 한 번 더 → 처음 보는 말). 0줄이면 아무도
 for(let n=0;n<=3;n++)for(const t2 of B)for(const tr of B){
  const run={n,t2,tr},got=tag(curtainSay({was:null,run,next:run}));
  const steps=[['T',t2],['R',tr]],order=[...steps.filter(s=>s[1]),...steps.filter(s=>!s[1])].map(([k,d])=>k+(d?'+':'-'));
  const want=n?['L'+n,...order].slice(0,n).map((x,i)=>`${i}:${x}`).join(' '):'';
  assert.equal(got,want,`첫 판 ${JSON.stringify(run)}`);
 }
 // 다시 한 판
 const R=(was,run)=>{const next={n:Math.max(was.n,run.n),t2:was.t2||run.t2,tr:was.tr||run.tr};return tag(curtainSay({was,run,next}));};
 assert.equal(R({n:3,t2:true,tr:true},{n:3,t2:true,tr:true}),'','늘어난 것 없음');
 assert.equal(R({n:0,t2:false,tr:false},{n:3,t2:true,tr:true}),'0:L3 1:T+ 2:R+','첫 판이 0줄이면 다음 판도 다시 한 판 — 새 자리 셋');
 assert.equal(R({n:2,t2:false,tr:false},{n:2,t2:true,tr:false}),'0:T+','한 번 더만 새로');
 assert.equal(R({n:1,t2:false,tr:false},{n:2,t2:false,tr:true}),'0:R+ 1:L2','새 자리(1번)가 줄 수, 나머지 자리(0번)가 새 단계');
 assert.equal(R({n:1,t2:false,tr:false},{n:1,t2:true,tr:true}),'0:T+','자리가 모자라면 남은 사실은 말하지 않는다');
 assert.equal(R({n:2,t2:true,tr:true},{n:0,t2:false,tr:false}),'','이번 판 0줄');
 assert.equal(R({n:3,t2:false,tr:false},{n:1,t2:false,tr:false}),'','줄 수가 줄면 말하지 않는다');
 // 내 팬 화면(best)은 첫 판과 같은 차례
 assert.equal(tag(bestSay({n:2,t2:false,tr:true})),'0:L2 1:R+');
 assert.equal(tag(bestSay({n:0,t2:true,tr:true})),'');
 assert.equal(tag(bestSay(null)),'');
 for(const n of [0,1,2,3,5])assert.equal(faceCount({n}),Math.min(3,n));
 // 꿈마다 팬 셋, 이름과 얼굴 네모가 있고 모든 이유에 세 언어 문장이 있다
 for(const d of ['idol','actor']){assert.equal(FANS[d].length,3);for(const f of FANS[d]){assert.ok(f.name&&f.role);assert.equal(f.face.length,3);}}
 for(let n=1;n<=3;n++)for(const t2 of B)for(const tr of B)for(const x of [...curtainSay({was:null,run:{n,t2,tr},next:{n,t2,tr}}),...bestSay({n,t2,tr})])
  for(const lang of ['ko','en','mn'])assert.equal(typeof fanLine(lang,x.why),'string',`${lang} ${JSON.stringify(x.why)}`);
});

test('내 팬: 커튼콜에서 팬이 한 명이면 넘기지 않고 안내 단추를 숨기며, 자판 초점은 「내 길로」로 넘긴다',()=>{
 const app=read('experiences/seoul-arrival/app.mjs').replace(/\r\n/g,'\n');
 const go=/function ccGo\(i,quiet\)\{\n[\s\S]*?\n\}\n/.exec(app)?.[0],next=/function ccNext\(\)\{.*\}\n/.exec(app)?.[0];
 assert.ok(go&&next,'ccGo · ccNext를 앱에서 찾는다');
 const run=(says,{focus=false}={})=>{
  const doc={activeElement:null},els={},el=id=>els[id]??={id,hidden:false,textContent:'',children:[],classList:{add(){},remove(){}},focus(){doc.activeElement=this;}};
  const CC={on:true,says:says.map(x=>({fan:x})),i:-1,run:0,tick:0};
  const api=new Function('$','CC','crowdRun','L','ccSpot','sayLine','SND','crowdLater','reduce','state','document',go+next+'return {ccGo,ccNext};')(el,CC,0,x=>x,()=>{},()=>{},{sfx(){}},()=>{},true,{dream:'idol'},doc);
  if(focus)doc.activeElement=el('#ccHint');
  return {CC,doc,hint:el('#ccHint'),...api};
 };
 const one=run([0],{focus:true});one.ccNext();   // 표지에서 누르면 첫 팬
 assert.equal(one.CC.i,0);assert.equal(one.hint.hidden,true);assert.equal(one.doc.activeElement.id,'#backPath','사라지는 단추의 초점을 넘긴다');
 const tick=one.CC.tick;one.ccNext();assert.equal(one.CC.tick,tick,'한 명이면 다시 그리지 않는다');
 const many=run([0,1,2],{focus:true});
 for(const [i,text] of [[0,'화면을 누르면 다음 팬'],[1,'화면을 누르면 다음 팬'],[2,'화면을 누르면 처음부터'],[0,'화면을 누르면 다음 팬']]){many.ccNext();assert.equal(many.CC.i,i);assert.equal(many.hint.textContent,text);assert.equal(many.hint.hidden,false);}
 assert.equal(many.doc.activeElement.id,'#ccHint','여럿이면 초점을 그대로 둔다');
 const pointer=run([0]);pointer.ccNext();assert.equal(pointer.doc.activeElement,null,'단추에 초점이 없었으면 옮기지 않는다');
});

test('내 팬 화면: 1화를 끝내기 전에는 「1화 시작」, 끝낸 뒤에는 「1화 다시 하기」이고 머리줄이 본문보다 먼저 온다',()=>{
 const app=read('experiences/seoul-arrival/app.mjs').replace(/\r\n/g,'\n');
 const body=/function renderFans\([^)]*\)\{\n[\s\S]*?\n\}\n/.exec(app)?.[0],label=/\{const r=\$\('#fansReplay'\).*?\}\n/.exec(body??'')?.[0];
 assert.ok(label,'단추 글을 정하는 줄을 앱에서 찾는다');
 const set=done=>{const r={dataset:{},textContent:''};new Function('$','episodeDone','L',label)(()=>r,()=>done,x=>x);return r;};
 for(const [done,text] of [[false,'1화 시작'],[true,'1화 다시 하기']]){const r=set(done);assert.equal(r.textContent,text);assert.equal(r.dataset.l,text,'언어를 바꿔도 같은 열쇠로 다시 그린다');}
 const html=read('experiences/seoul-arrival/index.html'),fans=html.slice(html.indexOf('id="s-fans"'));
 assert.ok(fans.indexOf('class="fans-top"')>0&&fans.indexOf('class="fans-top"')<fans.indexOf('id="fansScroll"'),'Tab은 뒤로 단추에서 본문으로 간다');
});
