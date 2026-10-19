// 화면 언어의 저장(10-19 1판): 손님은 이 기기, 계정은 생활 기록(synk.life-korean.progress.v1)의 display 칸.
// 실제 계정 포트(life-progress-port)와 Play 값 검사를 거친다. 옛 판·다음 판과 기록을 함께 써도 진도를 못 읽게 되지 않는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';

const memory=()=>{const data=new Map();return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
globalThis.localStorage=memory();
globalThis.document={documentElement:{lang:'ko'}};
globalThis.location={search:''};
const {createLifeProgress,LIFE_PROGRESS_KEY}=await import('../life-progress.mjs');
const {createLifeProgressPort}=await import('../life-progress-port.mjs');
const {emptyPlayState}=await import('../../play-common/play-data.mjs');
const {restoreDisplayLanguage,commitDisplayLanguage}=await import('../display-language-sync.mjs');
const lang=await import('../../brand-opening/world-lang.mjs');

const OWNER='11111111-1111-4111-8111-111111111111';
const failure=code=>Object.assign(Error(code),{code});
const record=extra=>({version:1,owner:OWNER,revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{},...extra});
async function fixture(extra=null){
 const cache=memory(),state=emptyPlayState(),calls=[];let revision=0;
 if(extra)state.records[LIFE_PROGRESS_KEY]=JSON.stringify(record(extra));
 const envelope=()=>({ok:true,scope:'synk-play',accountId:OWNER,revision,state:structuredClone(state)});
 const client={load:async()=>envelope(),mutate:async body=>{
  calls.push(structuredClone(body));
  for(const change of body.changes){if((state.records[change.key]??null)!==change.previous)throw failure('REVISION_CONFLICT');state.records[change.key]=change.value;}
  revision++;return envelope();
 }};
 const port=await createLifeProgressPort({accountId:OWNER,client,guard:()=>{},storage:cache,target:{}});
 const progress=createLifeProgress({owner:OWNER,storage:port.storage,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status});
 return {cache,progress,port,calls,state,server:()=>JSON.parse(state.records[LIFE_PROGRESS_KEY]||'null')};
}

test('손님 기기 기록: 고른 언어를 display 칸에 두고, 튜터 선택 같은 다른 저장이 그대로 보존한다',()=>{
 const storage=memory(),progress=createLifeProgress({owner:'guest',storage,now:()=>Date.UTC(2026,9,19)});
 assert.equal(progress.displayLanguage(),null);
 progress.setDisplayLanguage('mn');
 assert.equal(progress.displayLanguage(),'mn');
 progress.selectTutor('mongle');
 const raw=JSON.parse(storage.getItem(`${LIFE_PROGRESS_KEY}:guest`));
 assert.deepEqual(raw.display,{version:1,language:'mn'});assert.deepEqual(raw.tutor,{version:1,selected:'mongle'});
 assert.equal(progress.setDisplayLanguage('mn').duplicate,true);
 assert.throws(()=>progress.setDisplayLanguage('es'),TypeError);
});

test('다음 판이 모르는 언어나 다른 모양을 써 두어도 기록 전체를 거절하지 않는다',()=>{
 for(const display of [{version:1,language:'es'},{version:2,language:'mn'},'garbage',{version:1,language:'mn',extra:true}]){
  const storage=memory();storage.setItem(`${LIFE_PROGRESS_KEY}:guest`,JSON.stringify(record({owner:'guest',display})));
  const progress=createLifeProgress({owner:'guest',storage});
  assert.notEqual(progress.status().phase,'unreadable',JSON.stringify(display));
  assert.equal(progress.displayLanguage(),display?.version===1&&display?.language==='mn'?'mn':null);
  progress.selectTutor('marin');
  assert.deepEqual(JSON.parse(storage.getItem(`${LIFE_PROGRESS_KEY}:guest`)).display,display,'모르는 칸은 그대로 보존');
 }
});

test('계정: 다른 기기에서 고른 계정 언어가 이 기기 언어를 이기고, 서버에 다시 쓰지 않는다',async t=>{
 const f=await fixture({display:{version:1,language:'mn'}});t.after(()=>f.port.dispose());
 localStorage.setItem(lang.LANG_KEY,'en');lang.setLang('en');
 assert.equal(restoreDisplayLanguage({progress:f.progress}),'mn');
 assert.equal(lang.currentLang(),'mn');assert.equal(localStorage.getItem(lang.LANG_KEY),'mn');
 assert.equal(f.calls.length,0);
});

test('계정에 아직 언어가 없으면 이 기기에서 고른 언어로 채워 보낸다',async t=>{
 const f=await fixture({});t.after(()=>f.port.dispose());
 lang.setLang('en');
 assert.equal(restoreDisplayLanguage({progress:f.progress}),'en');
 await f.progress.flush();
 assert.deepEqual(f.server().display,{version:1,language:'en'});
});

test('설정에서 바꾸면 계정 기록에 저장되고 Play 값 검사를 통과한다',async t=>{
 const f=await fixture({tutor:{version:1,selected:'kkamong'}});t.after(()=>f.port.dispose());
 const result=await commitDisplayLanguage({progress:f.progress,language:'mn'});
 assert.deepEqual(result,{saved:true,mode:'account',pending:false});
 assert.deepEqual(f.server().display,{version:1,language:'mn'});
 assert.deepEqual(f.server().tutor,{version:1,selected:'kkamong'},'튜터 선택 보존');
});

test('손님(계정 연결 전)은 기기에만 둔다',async()=>{
 const progress=createLifeProgress({owner:'guest',storage:memory()});
 assert.deepEqual(await commitDisplayLanguage({progress,language:'en'}),{saved:true,mode:'device'});
 assert.equal(progress.displayLanguage(),null);
});

// 로그인 뒤 「한글 기록 이어 가기」 판(device-records.mjs, origin 703eab740)도 고른 화면 언어로 보인다.
// 판의 한국어 기본 글과 표의 records.* 한국어가 같아야 하고, app-shell이 넘기는 text()가 모든 키를 덮어야 한다.
test('「한글 기록 이어 가기」 판: 표의 records.*가 판의 모든 글을 덮고, 영어·몽골어 판에 한국어가 남지 않는다',async()=>{
 const fs=await import('node:fs');
 const {DEVICE_RECORDS_TEXT,HANGUL_DEVICE_KEY,createDeviceRecordsOffer}=await import('../device-records.mjs');
 const {emptyProgress,meet,answer:answerLetter}=await import('../../hangul-stage/core.mjs');
 const {default:STRINGS}=await import('../../brand-opening/world-strings.mjs');
 const keys=Object.keys(DEVICE_RECORDS_TEXT);
 const shell=fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
 const passed=new Set([...shell.matchAll(/t\('records\.(\w+)'/g)].map(m=>m[1]));
 assert.deepEqual([...passed].sort(),[...keys].sort(),'app-shell의 deviceRecordsText가 판의 모든 키를 넘긴다');
 for(const key of keys){
  const entry=STRINGS[`records.${key}`];assert.ok(entry?.ko&&entry.en&&entry.mn,`records.${key} ko·en·mn`);
  const ko=DEVICE_RECORDS_TEXT[key];
  if(typeof ko==='function')assert.equal(lang.t(`records.${key}`,{n:3,m:2},'ko'),ko(3,2),`records.${key} 한국어 = 판 기본 글`);
  else assert.equal(entry.ko,ko,`records.${key} 한국어 = 판 기본 글`);
 }
 const AT='2026-10-19T03:00:00.000Z',learning={accountKey:OWNER,revision:2};
 const textFor=code=>()=>Object.fromEntries(keys.map(key=>[key,typeof DEVICE_RECORDS_TEXT[key]==='function'?(n,m)=>lang.t(`records.${key}`,{n,m},code):lang.t(`records.${key}`,null,code)]));
 for(const code of ['ko','en','mn']){
  const storage=memory();let p=meet(emptyProgress(),['g-giyeok','v-a','v-o'],AT);p=answerLetter(p,{focus:['v-a'],correct:true,at:AT,sessionId:'s1'});
  storage.setItem(HANGUL_DEVICE_KEY,JSON.stringify(p));
  const shown=[];const offer=createDeviceRecordsOffer({storage,learningStatus:()=>learning,accountAnswer:()=>null,setAccountAnswer:async()=>{},present:view=>shown.push(view),close(){},text:textFor(code)});
  void offer.offer({owner:OWNER});
  assert.equal(shown.length,1,`${code}: 판을 띄운다`);
  const visible=(shown[0].title+' '+shown[0].html.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ');
  assert.ok(visible.includes(lang.t('records.lead',null,code)),`${code}: 머리 글`);
  assert.ok(visible.includes(lang.t('records.met',{n:3},code)),`${code}: 만난 글자 수`);
  if(code==='ko')assert.ok(visible.includes('글자 3개를 만났어요'),'한국어는 지금 그대로');
  else assert.doesNotMatch(visible,/[가-힣]/,`${code}: 판에 한국어가 남지 않는다`);
 }
});
