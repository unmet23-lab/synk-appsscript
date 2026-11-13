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

// 11-02 첫 화면 언어 단추(opening.mjs onLanguage → app-shell selectLanguage → choice 상자): 회사 화면 동안 고른 언어가 늦게 올라온 계정 기록에 덮이지 않는다.
// 아래 두 시험의 상자는 owner가 없는 꼴이다 — 손님 때 고른 상자이자, 공개 직후 캐시에 남은 옛 app-shell이 넘기는 상자({language})와 같다.
test('이번 페이지에서 고른 언어가 계정 복원을 한 번 이기고 계정 칸에 쓰인 뒤 상자를 비운다',async t=>{
 const f=await fixture({display:{version:1,language:'mn'}});t.after(()=>f.port.dispose());
 lang.setLang('en');const choice={language:'en'};
 assert.equal(restoreDisplayLanguage({progress:f.progress,choice}),'en');
 assert.equal(lang.currentLang(),'en');assert.equal(f.progress.displayLanguage(),'en');assert.equal(choice.language,null);
 await f.progress.flush();
 assert.deepEqual(f.server().display,{version:1,language:'en'});
});

test('고른 언어가 계정 언어와 같으면 다시 쓰지 않는다',async t=>{
 const f=await fixture({display:{version:1,language:'mn'}});t.after(()=>f.port.dispose());
 assert.equal(restoreDisplayLanguage({progress:f.progress,choice:{language:'mn'}}),'mn');
 await f.progress.flush();
 assert.equal(f.calls.length,0);
});

test('손님일 때 고른 언어는 첫 계정 복원에만 한 번 쓰이고, 다음 계정은 자기 언어로 돌아온다',async t=>{
 const choice={language:'en',owner:null};
 const guest=createLifeProgress({owner:'guest',storage:memory()});
 assert.equal(restoreDisplayLanguage({progress:guest,choice,owner:'guest'}),null,'손님 생활 기록(범위 밖)은 꺼내지 않는다');
 assert.equal(choice.language,'en');
 const a=await fixture({display:{version:1,language:'mn'}});t.after(()=>a.port.dispose());
 assert.equal(restoreDisplayLanguage({progress:a.progress,choice,owner:OWNER}),'en','첫 계정은 방금 고른 언어');
 assert.equal(choice.language,null,'한 번 쓰면 비운다');
 const b=await fixture({display:{version:1,language:'mn'}});t.after(()=>b.port.dispose());
 assert.equal(restoreDisplayLanguage({progress:b.progress,choice,owner:'33333333-3333-4333-8333-333333333333'}),'mn','다음 계정은 자기 저장 언어');
 assert.equal(b.progress.displayLanguage(),'mn');
});

// 검수 FA1(11-02): 상자에 고른 때의 주인을 두어, 기록이 범위 밖일 때 고른 언어를 잃지 않고 다른 계정에 쓰지도 않는다.
// 세대는 보지 않는다 — 재확인 · 다시 로그인에서도 올라(검수 world-concert-next-20261102 Fable F2) 같은 계정의 선택을 잃게 하므로.
test('계정 기록이 범위 밖일 때 고른 언어는 상자에 남아, 같은 주인의 기록이 다시 서면 그 복원이 쓴다',async t=>{
 const choice={language:'en',owner:OWNER};
 // 생활 포트를 못 열어 기기 기록으로 이어 간 판(world-session fallback → mode 'local', scoped 아님)
 const local=createLifeProgress({owner:OWNER,storage:memory()});
 assert.equal(restoreDisplayLanguage({progress:local,choice,owner:OWNER}),null);
 assert.deepEqual(choice,{language:'en',owner:OWNER},'범위 밖에서는 꺼내지도 버리지도 않는다');
 const f=await fixture({display:{version:1,language:'mn'}});t.after(()=>f.port.dispose());
 assert.equal(restoreDisplayLanguage({progress:f.progress,choice,owner:OWNER}),'en','다시 선 기록은 방금 고른 언어');
 assert.equal(f.progress.displayLanguage(),'en');assert.deepEqual(choice,{language:null,owner:null});
 await f.progress.flush();
 assert.deepEqual(f.server().display,{version:1,language:'en'});
});

test('다른 주인이 고른 상자는 쓰지 않고 버린다',async t=>{
 const f=await fixture({display:{version:1,language:'mn'}});t.after(()=>f.port.dispose());
 const choice={language:'en',owner:'22222222-2222-4222-8222-222222222222'};
 lang.setLang('en');
 assert.equal(restoreDisplayLanguage({progress:f.progress,choice,owner:OWNER}),'mn');
 assert.equal(lang.currentLang(),'mn','지금 계정의 저장 언어');
 assert.deepEqual(choice,{language:null,owner:null},'버린다');
 await f.progress.flush();
 assert.equal(f.calls.length,0,'계정 칸을 다시 쓰지 않는다');
});

// 검수 world-concert-next-20261102 Fable F1: 다른 기기가 먼저 써서 계정 쓰기가 거절되면 commitDisplayLanguage는 saved:false를 돌려준다 —
// app-shell은 saved일 때만 상자를 비우므로, 이 선택은 상자에 남아 저장 확인 창 뒤 다시 선 기록의 복원이 쓴다.
test('다른 기기가 먼저 써서 계정 쓰기가 거절되면 saved:false로 돌려준다',async t=>{
 const f=await fixture({display:{version:1,language:'mn'}});t.after(()=>f.port.dispose());
 f.state.records[LIFE_PROGRESS_KEY]=JSON.stringify(record({display:{version:1,language:'mn'},tutor:{version:1,selected:'marin'}}));// 다른 기기의 쓰기
 const result=await commitDisplayLanguage({progress:f.progress,language:'en'});
 assert.equal(result.mode,'account');assert.equal(result.saved,false);assert.equal(result.pending,true);
 assert.deepEqual(f.server().display,{version:1,language:'mn'},'서버 값은 다른 기기 것 그대로');
});

test('app-shell: 첫 화면 언어 단추를 selectLanguage로 잇고, 고른 언어를 주인과 함께 choice 상자로 복원에 넘기며, 계정에 저장이 확인됐거나 계정이 바뀌었을 때만 비운다',async()=>{
 const fs=await import('node:fs');
 const shell=fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
 assert.match(shell,/mountBrandOpening\(\{[^}]*onLanguage:language=>\{void selectLanguage\(language\)/);
 assert.match(shell,/const languageChoice=\{language:null,owner:null\};/);
 assert.match(shell,/restoreDisplayLanguage\(\{progress:life\.progress,choice:languageChoice,owner:life\.owner\}\)/);
 assert.match(shell,/const pick=\{language,owner:owner==='guest'\?null:owner\};\r?\n Object\.assign\(languageChoice,pick\);/);
 assert.match(shell,/if\(result\.mode==='account'&&result\.saved===true\)settle\(\);/);
 assert.match(shell,/catch\(error\)\{if\(error\.code==='ACCOUNT_CHANGED'\)settle\(\);throw error;\}/);
 assert.doesNotMatch(shell,/finally\{if\(languageChoice\.language===language\)/,'범위 밖 · 쓰기가 막힌 길에서 고른 언어를 비우지 않는다(검수 FA1)');
 assert.doesNotMatch(shell,/createLanguageChoice/,'캐시에 남은 옛 display-language-sync.mjs에 없는 이름을 부르지 않는다');
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

// Atlas 새 길의 옮기기 물음(world-atlas-next.mjs guestMove)은 생활 경험(world-life)의 답 · 사건을 life로 따로 준다 — 물음은 그것을 생활 줄에 세고
// 「짧은 진단·연습」 줄에는 짧은 진단 · 연습만 센다(생활 레슨만 한 손님에게 같은 답이 그 이름으로 또 서던 것 — Fable 5.2 합친 끝 판 넘친 #8).
test('옮기기 물음: 새 길에서 생활 레슨만 한 손님은 생활 줄만 서고, 「짧은 진단·연습」 줄은 짧은 진단 · 연습의 답만 센다(세 언어 — Fable 5.2 합친 끝 판 넘친 #8)',async()=>{
 const {DEVICE_RECORDS_TEXT,GUEST_LIFE_KEY,createDeviceRecordsOffer}=await import('../device-records.mjs');
 const keys=Object.keys(DEVICE_RECORDS_TEXT);
 const textFor=code=>()=>Object.fromEntries(keys.map(key=>[key,typeof DEVICE_RECORDS_TEXT[key]==='function'?(n,m)=>lang.t(`records.${key}`,{n,m},code):lang.t(`records.${key}`,null,code)]));
 const AT=Date.parse('2026-11-12T01:00:00.000Z');
 // 손님 생활 진도 — 레슨 하나(답 셋) · 복습 셋(새 길 생활 코치로 푼 그 레슨)
 const lessonLife=()=>JSON.stringify({version:1,owner:'guest',revision:1,activeLessonId:null,activeReview:null,
  lessons:{'greetings-expressions':{startedAt:AT,completedAt:AT+40_000,answers:{q1:{at:AT+8_000},q2:{at:AT+16_000},q3:{at:AT+24_000}}}},
  reviews:{'q1-transfer':{lessonId:'greetings-expressions',lastAt:AT+8_000},'q2-transfer':{lessonId:'greetings-expressions',lastAt:AT+16_000},'q3-transfer':{lessonId:'greetings-expressions',lastAt:AT+24_000}}});
 const plain=text=>text.replace(/&(amp|lt|gt|quot|#39);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[name]);
 // 물음을 띄워 요약 칸(굵은 글)의 줄을 읽고 닫는다 — atlas는 guestMove가 돌려주는 꼴
 const ask=async(code,{life,found})=>{
  const storage=memory();if(life)storage.setItem(GUEST_LIFE_KEY,life);
  const shown=[];
  const offer=createDeviceRecordsOffer({storage,learningStatus:()=>null,accountAnswer:()=>null,setAccountAnswer:async()=>{},present:view=>shown.push(view),close(){},
   text:textFor(code),importLife:async()=>({}),defer:fn=>fn(),atlasWait:1000});
  const asked=offer.offer({owner:OWNER,generation:1},{atlas:async()=>({...found,move:async()=>({ok:true}),keep:async()=>1,note:async()=>true,close(){}})});
  for(let turn=0;!shown.length;turn+=1){if(turn>500)throw Error('물음이 뜨지 않았다');await new Promise(resolve=>setTimeout(resolve,0));}
  shown[0].onClose();await asked;
  return shown[0].html.match(/<strong>(.*?)<\/strong>/s)[1].split('<br>').map(plain);
 };
 for(const code of ['ko','en','mn']){
  const life=lang.t('records.lifeRow',null,code),learning=lang.t('records.learningRow',null,code);
  // ① 생활 레슨만 — 새 길 사건 아홉(제시 · 첫 답 · 도움 셋씩)은 모두 생활 몫
  const only=await ask(code,{life:lessonLife(),found:{attempts:0,events:9,life:{attempts:3,events:9}}});
  assert.deepEqual(only,[`${life} · ${lang.t('records.lessons',{n:1},code)} · ${lang.t('records.reviews',{n:3},code)}`],`${code}: 생활 줄 하나 — 「${learning}」 줄이 서지 않는다`);
  // ② 생활 문항을 답 없이 보기만 했다(생활 진도에는 옮길 레슨이 없다) — 생활 줄이 「연습을 시작했어요」로 선다(빈 요약이 아니다)
  const seen=await ask(code,{found:{attempts:0,events:3,life:{attempts:0,events:3}}});
  assert.deepEqual(seen,[`${life} · ${lang.t('records.started',null,code)}`],`${code}: 생활 줄로`);
  // ③ 생활 레슨 + 짧은 연습 둘 — 짧은 진단 · 연습 줄은 그 답만
  const both=await ask(code,{life:lessonLife(),found:{attempts:2,events:15,life:{attempts:3,events:9}}});
  assert.deepEqual(both,[`${life} · ${lang.t('records.lessons',{n:1},code)} · ${lang.t('records.reviews',{n:3},code)}`,`${learning} · ${lang.t('records.answers',{n:2},code)}`]);
  if(code!=='ko')for(const rows of [only,seen,both])assert.doesNotMatch(rows.join(' '),/[가-힣]/,`${code}: 한국어가 남지 않는다`);
 }
});

// 지금 판(입구 없는 문서)의 옮기기 물음도 새 길 #8과 같은 세 갈래다 — 옛 학습 기록의 생활 거울 몫은 생활 진도 줄이 있으면 또 세지 않고,
// 없으면 생활 줄에 그 수로, 「짧은 진단·연습」 줄은 생활 경험이 아닌 첫 답만 — 그 답이 0이어도 생활 몫 밖의 사건(보기만)이 있으면 새 길처럼
// 「연습을 시작했어요」(결정 6 ② 끝 판 Fable 5.2 F1). 옮기는 사건 목록은 그대로(설계 주인 결정 6 ②).
test('옮기기 물음(지금 판): 옛 학습 기록의 생활 거울 답은 생활 줄이 세고 「짧은 진단·연습」 줄은 그 밖의 첫 답만 센다 · 보기만이면 「연습을 시작했어요」 — 옮기는 사건은 그대로(세 언어 · 설계 주인 결정 6 ②)',async()=>{
 const {DEVICE_RECORDS_TEXT,GUEST_LIFE_KEY,GUEST_LEARNING_KEY,createDeviceRecordsOffer,planDeviceRecords}=await import('../device-records.mjs');
 const keys=Object.keys(DEVICE_RECORDS_TEXT);
 const textFor=code=>()=>Object.fromEntries(keys.map(key=>[key,typeof DEVICE_RECORDS_TEXT[key]==='function'?(n,m)=>lang.t(`records.${key}`,{n,m},code):lang.t(`records.${key}`,null,code)]));
 const AT=Date.parse('2026-11-12T01:00:00.000Z');
 const iso=ms=>new Date(AT+ms).toISOString();
 const lessonLife=()=>JSON.stringify({version:1,owner:'guest',revision:1,activeLessonId:null,activeReview:null,
  lessons:{'greetings-expressions':{startedAt:AT,completedAt:AT+40_000,answers:{q1:{at:AT+8_000},q2:{at:AT+16_000},q3:{at:AT+24_000}}}},
  reviews:{'q1-transfer':{lessonId:'greetings-expressions',lastAt:AT+8_000},'q2-transfer':{lessonId:'greetings-expressions',lastAt:AT+16_000},'q3-transfer':{lessonId:'greetings-expressions',lastAt:AT+24_000}}});
 // 옛 생활 거울 — 결정(경험 world-life) 하나에 문항 셋 · 첫 답 셋, 첫 답이 아닌 두 번째 시도 하나, 한 판 마침 결정(world-life.set)과 그 마침
 const mirror=[{id:'dl',type:'decision.made',at:iso(1_000),experienceId:'world-life'},
  ...[1,2,3].flatMap(i=>[{id:`pl${i}`,type:'practice.presented',at:iso(1_000+i*10),decisionId:'dl'},{id:`al${i}`,type:'practice.attempted',at:iso(1_005+i*10),presentationId:`pl${i}`,attemptNo:1}]),
  {id:'al1b',type:'practice.attempted',at:iso(1_100),presentationId:'pl1',attemptNo:2},
  {id:'sl',type:'decision.made',at:iso(1_500),experienceId:'world-life.set'},{id:'cl',type:'experience.completed',at:iso(1_600),decisionId:'sl'}];
 // 짧은 진단 · 연습 — 결정(다른 경험) 하나에 문항 둘 · 첫 답 둘
 const practice=[{id:'dp',type:'decision.made',at:iso(2_000),experienceId:'world-practice'},
  ...[1,2].flatMap(i=>[{id:`pp${i}`,type:'practice.presented',at:iso(2_000+i*10),decisionId:'dp'},{id:`ap${i}`,type:'practice.attempted',at:iso(2_005+i*10),presentationId:`pp${i}`,attemptNo:1}])];
 // 짧은 진단 · 연습을 보기만 — 결정(다른 경험) 하나에 문항 하나 · 답 없음
 const shownOnly=[{id:'dq',type:'decision.made',at:iso(4_000),experienceId:'world-practice'},{id:'pq1',type:'practice.presented',at:iso(4_010),decisionId:'dq'}];
 const plain=text=>text.replace(/&(amp|lt|gt|quot|#39);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[name]);
 const storeOf=({life,events})=>{const storage=memory();if(life)storage.setItem(GUEST_LIFE_KEY,life);if(events)storage.setItem(GUEST_LEARNING_KEY,JSON.stringify({version:1,events}));return storage;};
 // 물음을 띄워 요약 칸(굵은 글)의 줄을 읽고 닫는다 — 입구 없는 문서(atlas 없음 · 옛 학습 기록 옮기기)
 const ask=async(code,found)=>{
  const storage=storeOf(found);
  const shown=[];
  const offer=createDeviceRecordsOffer({storage,learningStatus:()=>null,accountAnswer:()=>null,setAccountAnswer:async()=>{},present:view=>shown.push(view),close(){},
   text:textFor(code),importLife:async()=>({}),importLearning:async()=>({}),defer:fn=>fn()});
  const asked=offer.offer({owner:OWNER,generation:1});
  for(let turn=0;!shown.length;turn+=1){if(turn>500)throw Error('물음이 뜨지 않았다');await new Promise(resolve=>setTimeout(resolve,0));}
  shown[0].onClose();await asked;
  return shown[0].html.match(/<strong>(.*?)<\/strong>/s)[1].split('<br>').map(plain);
 };
 for(const code of ['ko','en','mn']){
  const life=lang.t('records.lifeRow',null,code),learning=lang.t('records.learningRow',null,code);
  const lifeLine=`${life} · ${lang.t('records.lessons',{n:1},code)} · ${lang.t('records.reviews',{n:3},code)}`;
  // ① 생활 레슨만 — 거울의 답 셋은 생활 줄이 센다(「짧은 진단·연습」 줄이 서지 않는다)
  assert.deepEqual(await ask(code,{life:lessonLife(),events:mirror}),[lifeLine],`${code}: 생활 줄 하나`);
  // ② 둘 다 — 「짧은 진단·연습」 줄은 그 답 둘만
  assert.deepEqual(await ask(code,{life:lessonLife(),events:[...mirror,...practice]}),[lifeLine,`${learning} · ${lang.t('records.answers',{n:2},code)}`],`${code}: 둘 다`);
  // ③ 짧은 진단 · 연습만 — 앞과 같다
  assert.deepEqual(await ask(code,{events:practice}),[`${learning} · ${lang.t('records.answers',{n:2},code)}`],`${code}: 연습만`);
  // ④ 생활 진도 없이 거울 사건만 — 생활 줄에 첫 답 수로
  assert.deepEqual(await ask(code,{events:mirror}),[`${life} · ${lang.t('records.answers',{n:3},code)}`],`${code}: 거울만`);
  // ⑤ 짧은 연습을 보기만(첫 답 0) — 「짧은 진단·연습」 줄이 「연습을 시작했어요」로 선다(요약 칸이 비던 것 — 바탕 판부터, 결정 6 ② 끝 판 Fable 5.2 F1)
  const started=lang.t('records.started',null,code);
  assert.deepEqual(await ask(code,{events:shownOnly}),[`${learning} · ${started}`],`${code}: 보기만`);
  // ⑥ 거울 답 + 연습 보기만 — 생활 줄은 거울의 첫 답, 「짧은 진단·연습」 줄은 「연습을 시작했어요」
  assert.deepEqual(await ask(code,{events:[...mirror,...shownOnly]}),[`${life} · ${lang.t('records.answers',{n:3},code)}`,`${learning} · ${started}`],`${code}: 거울 + 보기만`);
  // ⑦ 생활 진도 + 거울 + 연습 보기만 — 생활 줄은 진도로, 「짧은 진단·연습」 줄은 「연습을 시작했어요」(거울 몫은 또 세지 않는다)
  assert.deepEqual(await ask(code,{life:lessonLife(),events:[...mirror,...shownOnly]}),[lifeLine,`${learning} · ${started}`],`${code}: 진도 + 거울 + 보기만`);
 }
 // 옮기는 사건 목록은 그대로 — 거울 · 연습 사건 모두(요약 줄만 바뀐다)
 const plan=planDeviceRecords({storage:storeOf({life:lessonLife(),events:[...mirror,...practice]}),accountId:OWNER,life:true,learningLog:true});
 assert.deepEqual(plan.learning.events.map(event=>event.id).sort(),[...mirror,...practice].map(event=>event.id).sort());
 assert.equal(plan.learning.attempts,5,'첫 답 수(옮기는 몫)는 그대로');
 assert.deepEqual(plan.learning.life,{attempts:3,events:10});
 // 새 길 lifeShare와 같은 규칙 — 판 번호(set.world-life.…)만 든 2판 사건도 생활 몫으로 가린다
 const {pickGuestLearning}=await import('../device-records.mjs');
 const set='set.world-life.1.t.1';
 assert.deepEqual(pickGuestLearning([{id:'d2',type:'decision.made',at:iso(3_000),experienceId:'world-life.set',setId:set},{id:'p2',type:'practice.presented',at:iso(3_010),setId:set},
  {id:'a2',type:'practice.attempted',at:iso(3_020),presentationId:'p2',attemptNo:1}]).life,{attempts:1,events:3});
});
