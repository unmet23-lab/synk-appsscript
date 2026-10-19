// WORLD 화면 언어 1판(10-19): t()의 대체·기록, 표의 1판 범위(en·mn 모두), 원문과 표의 한국어가 같은지, 저장·기기 언어.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const memory=()=>{const data=new Map();return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
// 모듈을 부르기 전에 브라우저 전역을 흉내 낸다(언어는 고르기 전이라 한국어).
globalThis.localStorage=memory();
globalThis.document={documentElement:{lang:'ko'}};
globalThis.location={search:''};
const lang=await import('../world-lang.mjs');
const {default:STRINGS}=await import('../world-strings.mjs');
const {t,tMessage,setLang,onLang,currentLang,deviceLang,missingStrings,LANGS,LANG_KEY,LANG_NAMES}=lang;
const here=fileURLToPath(new URL('.',import.meta.url));
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const HANGUL=/[ᄀ-ᇿ㄰-㆏가-힣]/;
const forms=value=>typeof value==='string'?[value]:[value.one,value.other];
const slots=text=>[...String(text).matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');

test('고르기 전에는 한국어 원문이고, 빠진 번역은 한국어로 보이며 기록된다',()=>{
 assert.equal(currentLang(),'ko');
 assert.equal(t('home.loading'),'불러오고 있어요.');
 STRINGS['qa.onlyKorean']={ko:'한국어만 있는 줄'};
 try{
  assert.equal(t('qa.onlyKorean',undefined,'en'),'한국어만 있는 줄');
  assert.equal(t('qa.onlyKorean',undefined,'mn'),'한국어만 있는 줄');
  assert.ok(missingStrings().some(item=>item.key==='qa.onlyKorean'&&item.lang==='en'));
  assert.ok(missingStrings().some(item=>item.key==='qa.onlyKorean'&&item.lang==='mn'));
  // 한국어 화면에서는 빠진 말이 아니다.
  t('qa.onlyKorean',undefined,'ko');
  assert.ok(!missingStrings().some(item=>item.key==='qa.onlyKorean'&&item.lang==='ko'));
 }finally{delete STRINGS['qa.onlyKorean'];}
});

test('표에 없는 키는 키 그대로 보이고 * 로 기록된다',()=>{
 assert.equal(t('qa.no-such-key'),'qa.no-such-key');
 assert.ok(missingStrings().some(item=>item.key==='qa.no-such-key'&&item.lang==='*'));
});

test('값 자리와 영어 복수',()=>{
 assert.equal(t('tutor.confirm',{name:'Mongle'},'en'),'Learn with Mongle');
 assert.equal(t('life.backSub',{n:1},'en'),'1 expression you learned is back in a new situation.');
 assert.equal(t('life.backSub',{n:3},'en'),'3 expressions you learned are back in new situations.');
 assert.equal(t('life.backSub',{n:3},'mn'),'Сурсан 3 хэллэг шинэ нөхцөл байдалд дахин гарч ирлээ.');
 assert.equal(t('life.backSub',{n:3},'ko'),'배운 표현 3개가 새 장면으로 돌아왔어요.');
});

test('다른 모듈의 한국어 상태 문장은 표에 있으면 바뀌고, 없으면 그대로 두고 기록한다',()=>{
 assert.equal(tMessage('이 기기에 저장돼요.','mn'),'Энэ төхөөрөмжид хадгалагдана.');
 assert.equal(tMessage('이 기기에 저장돼요.','en'),'Saved on this device.');
 assert.equal(tMessage('이 기기에 저장돼요.','ko'),'이 기기에 저장돼요.');
 assert.equal(tMessage('표에 없는 상태 문장이에요.','en'),'표에 없는 상태 문장이에요.');
 assert.ok(missingStrings().some(item=>item.key.startsWith('msg:표에 없는')&&item.lang==='en'));
 assert.equal(tMessage('Already English','mn'),'Already English');
});

test('기기 언어는 미리 고르기에만 쓰고, 모르는 언어를 영어로 간주하지 않는다',()=>{
 assert.equal(deviceLang(['vi-VN']),null);
 assert.equal(deviceLang(['vi-VN','en-US']),'en');
 assert.equal(deviceLang(['mn-MN']),'mn');
 assert.equal(deviceLang(['mn']),'mn');
 assert.equal(deviceLang(['mn-Mong-CN']),null,'몽골 전통 문자는 키릴 몽골어로 보지 않는다');
 assert.equal(deviceLang(['mn-CN','ko-KR']),'ko');
 assert.equal(deviceLang(['ko-KR','en']),'ko');
 assert.equal(deviceLang([]),null);
});

test('언어를 고르면 이 기기에 남고 html lang이 바뀌며 알림은 바뀔 때 한 번',()=>{
 const heard=[];const stop=onLang(value=>heard.push(value));
 try{
  assert.equal(setLang('mn'),true);
  assert.equal(localStorage.getItem(LANG_KEY),'mn');
  assert.equal(document.documentElement.lang,'mn');
  assert.equal(setLang('mn'),false);
  assert.deepEqual(heard,['mn']);
  assert.equal(t('nav.learn'),'Сурах');
  assert.throws(()=>setLang('es'),TypeError);
  setLang('ko');assert.equal(t('nav.learn'),'배우기');
 }finally{stop();}
});

test('주소의 ?lang=은 저장 없이 이번 화면만 바꾼다',async()=>{
 const saved=globalThis.localStorage,place=globalThis.location;
 globalThis.localStorage=memory();globalThis.location={search:'?lang=en'};
 try{
  const fresh=await import('../world-lang.mjs?qa=url');
  assert.equal(fresh.currentLang(),'en');assert.equal(fresh.hasChosenLang(),false);assert.equal(fresh.suggestedLang(),'en');
  assert.equal(globalThis.localStorage.getItem(LANG_KEY),null);
 }finally{globalThis.localStorage=saved;globalThis.location=place;}
});

test('언어 이름은 그 언어 글자로, 순서는 English · Монгол · 한국어',()=>{
 assert.deepEqual(LANGS,['en','mn','ko']);
 assert.deepEqual(LANG_NAMES,{en:'English',mn:'Монгол',ko:'한국어'});
});

test('1판 표: 모든 줄에 ko·en·mn이 있고 값 자리가 같다',()=>{
 const problems=[];
 for(const [key,entry]of Object.entries(STRINGS)){
  for(const code of LANGS){
   const value=entry[code];
   if(value==null||forms(value).some(text=>typeof text!=='string'||!text.trim()))problems.push(`${key}: ${code} 비어 있음`);
  }
  if(problems.length)continue;
  const want=slots(entry.ko);
  for(const code of ['en','mn']){
   const value=entry[code];
   if(typeof value==='string'){if(slots(value)!==want)problems.push(`${key}: ${code} 값 자리 ${slots(value)} ≠ ko ${want}`);}
   else{if(slots(value.other)!==want)problems.push(`${key}: ${code}.other 값 자리 다름`);if(!value.one)problems.push(`${key}: ${code}.one 없음`);}
  }
 }
 assert.deepEqual(problems,[]);
 assert.ok(Object.keys(STRINGS).length>500,'1판 범위 글이 표에 있다');
});

test('영어·몽골어 칸에는 한글이 없고, 몽골어는 키릴로 쓴다(브랜드·약어만 라틴)',()=>{
 const allowed=/\b(?:SYNK|ID|AI|WORLD|TOPIK|Google|Apple|Unity|PNG|O|X|3D)\b/g;
 const problems=[];
 for(const [key,entry]of Object.entries(STRINGS)){
  for(const code of ['en','mn'])for(const text of forms(entry[code]))if(HANGUL.test(text))problems.push(`${key}: ${code}에 한글`);
  for(const text of forms(entry.mn)){
   const bare=text.replace(/<[^>]+>/g,'').replace(/\{\w+\}/g,'').replace(allowed,'');
   if(/[A-Za-z]/.test(bare))problems.push(`${key}: mn에 라틴 글자 «${bare}»`);
   if(!/[А-Яа-яЁёӨөҮү]/.test(bare)&&/[^\s\d·/{}.,:()-]/.test(bare))problems.push(`${key}: mn에 키릴이 없음`);
  }
  for(const text of forms(entry.en))if(/[А-Яа-яЁёӨөҮү]/.test(text))problems.push(`${key}: en에 키릴`);
 }
 assert.deepEqual(problems,[]);
});

test('msg 줄은 한국어 글이 겹치지 않고, 같은 한국어를 쓰는 화면 줄과 번역이 같다',()=>{
 const seen=new Map(),problems=[];
 for(const [key,entry]of Object.entries(STRINGS)){
  if(!key.startsWith('msg.'))continue;
  if(seen.has(entry.ko))problems.push(`${key}와 ${seen.get(entry.ko)}의 한국어가 같다`);seen.set(entry.ko,key);
 }
 for(const [key,entry]of Object.entries(STRINGS)){
  const msg=seen.get(entry.ko);if(!msg||msg===key)continue;
  for(const code of ['en','mn'])if(JSON.stringify(entry[code])!==JSON.stringify(STRINGS[msg][code]))problems.push(`${key}(${code})가 ${msg}와 다르다`);
 }
 assert.deepEqual(problems,[]);
});

test('표의 한국어가 원문과 같다(설정 스위치·튜터 카드·생활 팩·레슨 목표)',async()=>{
 const {PREF_LABELS}=await import('../world-sound.mjs');
 for(const [name,{title,note}]of Object.entries(PREF_LABELS)){
  assert.equal(STRINGS[`pref.${name}.title`]?.ko,title,name);assert.equal(STRINGS[`pref.${name}.note`]?.ko,note,name);
 }
 const {TUTORS}=await import('../tutor-profiles.mjs');
 for(const tutor of TUTORS){
  const key=field=>STRINGS[`tutor.card.${tutor.id}.${field}`]?.ko;
  assert.equal(STRINGS[`tutor.name.${tutor.id}`]?.ko,tutor.name);
  assert.equal(key('identity'),tutor.card.정체);assert.equal(key('charm'),tutor.card.매력);assert.equal(key('about'),tutor.card.소개);assert.equal(key('weak'),tutor.card.못해요);
  tutor.card.칩.forEach((chip,i)=>assert.equal(key(`chip${i+1}`),chip));
  tutor.card.좋아해요.forEach((like,i)=>assert.equal(key(`like${i+1}`),like));
  assert.ok(key('match'),`${tutor.id} 어울림 한 줄`);
 }
 const {PACKS}=await import('../../synk-world-app/life-content.mjs');
 for(const pack of PACKS){
  assert.equal(STRINGS[`life.packTitle.${pack.id}`]?.ko,pack.title,pack.id);
  assert.equal(STRINGS[`life.packSub.${pack.id}`]?.ko,pack.subtitle,pack.id);
  assert.ok(STRINGS[`life.place.${pack.id}`],pack.id);assert.ok(STRINGS[`life.pack.${pack.id}`],pack.id);
  for(const lesson of pack.lessons){const goal=STRINGS[`life.lessonGoal.${lesson.id}`];if(goal)assert.equal(goal.ko,lesson.goal,lesson.id);}
 }
 // 1판의 첫 레슨들(인사 팩)은 레슨 목표까지 옮겼다.
 for(const lesson of PACKS.find(pack=>pack.id==='greetings').lessons)assert.ok(STRINGS[`life.lessonGoal.${lesson.id}`],lesson.id);
});

test('화면 파일이 t()로 부르는 키는 모두 표에 있다(삼항의 두 키 포함)',()=>{
 const files=['../home.mjs','../first-run.mjs','../opening.mjs','../tutor-onboarding.mjs','../home-tutor.mjs','../home-town.mjs','../life-tutor.mjs','../lang-picker.mjs','../../synk-world-app/app-shell.mjs','../../synk-world-app/world-learning-ui.mjs','../../synk-world-app/life-ui.mjs'];
 const used=new Map();
 for(const file of files){
  const source=read(file);
  for(const [,key]of source.matchAll(/\b(?:t|tr)\('([a-zA-Z][\w.-]*)'/g))used.set(key,file);
  for(const [,a,b]of source.matchAll(/\b(?:t|tr)\([^()]*?\?\s*'([a-zA-Z][\w.-]*)'\s*:\s*'([a-zA-Z][\w.-]*)'/g)){used.set(a,file);used.set(b,file);}
  for(const [,a,b,c]of source.matchAll(/\b(?:t|tr)\([^()]*?\?\s*'([\w.-]+)'\s*:[^()]*?\?\s*'([\w.-]+)'\s*:\s*'([\w.-]+)'/g))for(const key of [a,b,c])used.set(key,file);
 }
 const missing=[...used].filter(([key])=>!Object.hasOwn(STRINGS,key)).map(([key,file])=>`${file}: ${key}`);
 assert.deepEqual(missing,[]);
 assert.ok(used.size>250,`부르는 키 ${used.size}개`);
});

test('한글 만나기의 언어 모듈은 같은 저장 키·언어 목록을 쓴다',async()=>{
 const hangul=await import('../../hangul-stage/lang.mjs');
 assert.equal(hangul.LANG_KEY,LANG_KEY);assert.deepEqual(hangul.LANGS,LANGS);
});

test('몽골어 글꼴: 키릴 조각이 두 곳에 같은 바이트로 있고 글꼴 이름표에 붙어 있다',()=>{
 for(const weight of ['Regular','SemiBold','Bold']){
  const a=readFileSync(new URL(`../assets/SYNKCyrillic-${weight}.woff2`,import.meta.url)),b=readFileSync(new URL(`../../hangul-stage/assets/fonts/SYNKCyrillic-${weight}.woff2`,import.meta.url));
  assert.equal(a.subarray(0,4).toString('latin1'),'wOF2');assert.ok(a.equals(b),`${weight} 사본이 같다`);
 }
 const ui=read('../world-ui.css'),opening=read('../opening.css'),hangul=read('../../hangul-stage/style.css');
 assert.match(ui,/--w-sans:'World Arrow','World Latin','World Cyrillic','World SUIT'/);
 assert.equal((ui.match(/font-family:'World Cyrillic';src:url\(assets\/SYNKCyrillic-\w+\.woff2\)/g)||[]).length,3);
 assert.match(opening,/font-family:OpeningCyrillic,OpeningSUIT/);
 assert.match(hangul,/--w-sans:"World Latin","World Cyrillic",SUIT/);
 for(const css of [ui,opening,hangul])assert.ok(css.includes('unicode-range:U+0400-052F,U+2116'));
});
