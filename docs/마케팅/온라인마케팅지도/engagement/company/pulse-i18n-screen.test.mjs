// 다국어 판 1(2026-11-09, 기획 12-2) — 화면 쪽: 번역 틀(복수형 · 언어 고르기), 영어 사전 대조(빠진 키 0 · 죽은 키 0), 화면 빈 답과 서버 답 칸, 오류 코드.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {emptyRequestAnswers,normalizeRequestAnswers} from './pulse-requests.mjs';
import {tl,pickLocale,registerLocale} from './public/pulse-app/i18n.mjs';
import en from './public/pulse-app/i18n/en.mjs';

test('새 답 칸의 값 꼴(서버 허용 목록 · 기본값 · 화면 빈 답이 같은 이름)',async()=>{
  const {emptyAnswers,answersForServer}=await import('./public/pulse-app/request-data.mjs');
  const server=Object.keys(emptyRequestAnswers()).sort(),screen=Object.keys(emptyAnswers()).sort();
  assert.deepEqual(screen,server,'화면 빈 답과 서버 기본값의 칸이 같다');
  const sent=answersForServer(emptyAnswers());
  for(const key of ['hair','contactLocale','outputLocales','targetMarket','quoteCurrency'])assert.equal(Object.hasOwn(sent,key),false,key+' — 비어 있으면 보내지 않는다(옛 서버 호환)');
  assert.doesNotThrow(()=>normalizeRequestAnswers(sent));
  const filled=answersForServer({...emptyAnswers(),hair:'look-3',targetMarket:['US'],contactLocale:'en'});
  assert.equal(filled.hair,'look-3');assert.deepEqual(filled.targetMarket,['US']);
  const clean=normalizeRequestAnswers({...sent,...filled,outputLocales:['ko','ko','en'],targetMarket:['US','US']});
  assert.deepEqual(clean.outputLocales,['ko','en']);assert.deepEqual(clean.targetMarket,['US']);
  assert.throws(()=>normalizeRequestAnswers({targetMarket:['U1']}),/고른 값/);
  assert.throws(()=>normalizeRequestAnswers({targetMarket:Array(9).fill('US')}),/고른 값/);
});

test('번역 틀: 한국어는 받은 문장 그대로, 복수형은 그 언어의 꼴로, 언어 고르기는 서버가 허락한 목록 안에서',()=>{
  registerLocale('en',{...en,'파일 {count}개':{one:'{count} file',other:'{count} files'}});
  assert.equal(tl('ko','파일 {count}개',{count:1}),'파일 1개');
  assert.equal(tl('en','파일 {count}개',{count:1}),'1 file');assert.equal(tl('en','파일 {count}개',{count:3}),'3 files');
  assert.equal(tl('en','사전에 없는 문장'),'사전에 없는 문장');
  const allowed=['ko','en'];
  assert.equal(pickLocale({browser:['en-US','ko-KR'],allowed:['ko']}),'ko','허락 전에는 늘 한국어');
  assert.equal(pickLocale({browser:['fr-FR','de'],allowed}),'en','한국어가 없는 브라우저는 영어로');
  assert.equal(pickLocale({browser:['fr-FR','ko'],allowed}),'ko');
  assert.equal(pickLocale({browser:[],allowed}),'ko');
  assert.equal(pickLocale({chosen:'ko',browser:['en'],allowed}),'ko','손님이 고른 것이 먼저');
  assert.equal(pickLocale({project:'en',browser:['ko'],allowed}),'en','프로젝트 소통 언어가 브라우저보다 먼저');
  assert.equal(pickLocale({chosen:'ja',project:'ja',browser:['ja'],allowed:['ko','en','ja']}),'en','사전 없는 일본어는 고르지 않는다(한국어 없는 브라우저 → 영어)');
});

// 영어 사전 대조(기획 12-2 「사전 검사」): 손님 화면 모듈의 t('…') 리터럴은 모두 사전에 있고(빠진 키 0),
// 사전의 모든 키는 손님 화면 모듈 · 카탈로그의 문자열로 실제로 쓰인다(죽은 키 0). 원문을 고치면 옛 키를 지워야 이 시험이 지나간다.
const APP=new URL('./public/pulse-app/',import.meta.url);
const SCREEN=readdirSync(APP).filter(name=>name.endsWith('.mjs')&&readFileSync(new URL(name,APP),'utf8').includes("from './i18n.mjs'"));
function literalKeys(src){
  const keys=new Map(),read=i=>{const q=src[i];let j=i+1,out='';while(j<src.length){const c=src[j];if(c==='\\'){out+=src[j]+src[j+1];j+=2;continue;}if(c===q)break;if(q==='`'&&c==='$'&&src[j+1]==='{')return null;out+=c;j++;}return {raw:out,end:j+1};};
  const text=raw=>JSON.parse('"'+raw.replace(/\\'/g,"'").replace(/"/g,'\\"')+'"');
  const re=/(?<![A-Za-z0-9_$.])t\(\s*(['"`])/g;let m;
  while((m=re.exec(src))){
    const first=read(m.index+m[0].length-1);if(!first)continue;
    let depth=0,args=[''];
    for(let k=first.end;k<src.length;k++){const c=src[k];if('([{'.includes(c))depth++;else if(')]}'.includes(c)){if(depth===0)break;depth--;}else if(c===','&&depth===0){args.push('');continue;}else if("'\"`".includes(c)){const r=read(k);if(!r){args[args.length-1]+='${}';continue;}args[args.length-1]+=c+r.raw+c;k=r.end-1;continue;}args[args.length-1]+=c;}
    const ctx=/^'([^']*)'$/.exec((args[2]||'').trim())?.[1]||'';
    const key=ctx?`${ctx}\u0004${text(first.raw)}`:text(first.raw);
    if(!keys.has(key))keys.set(key,[]);keys.get(key).push(args[1]||'');
  }
  return keys;
}
test('영어 사전: 손님 화면의 t() 문장은 빠짐없이 있고, 쓰이지 않는 키는 없다',()=>{
  assert.ok(SCREEN.length>=5,SCREEN.join(','));
  const sources=[...SCREEN,'casting-catalog.mjs'].map(name=>readFileSync(new URL(name,APP),'utf8'));
  const calls=new Map();
  for(const name of SCREEN)for(const [key,vars]of literalKeys(readFileSync(new URL(name,APP),'utf8')))calls.set(key,[...(calls.get(key)||[]),...vars]);
  const used=new Set(calls.keys());
  const missing=[...used].filter(key=>!Object.hasOwn(en,key));
  assert.deepEqual(missing,[],'사전에 없는 t() 문장');
  const quoted=text=>sources.some(src=>["'",'"','`'].some(q=>src.includes(q+text+q)));
  const dead=Object.keys(en).filter(key=>!used.has(key)&&!quoted(key.includes('\u0004')?key.split('\u0004')[1]:key));
  assert.deepEqual(dead,[],'화면 어디에도 없는 사전 키(원문이 바뀌었으면 옛 키를 지운다)');
  for(const [key,value]of Object.entries(en)){
    const forms=typeof value==='string'?[value]:Object.values(value);
    assert.ok(forms.length&&forms.every(form=>typeof form==='string'&&form.trim()),key);
    const names=text=>[...String(text).matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(m=>m[1]).sort().join(',');
    const source=key.includes('\u0004')?key.split('\u0004')[1]:key;
    // 영어에만 있는 자리표(예: 달 이름 {mon})는 그 문장을 부르는 모든 자리가 값을 넘겨야 한다.
    const passes=name=>(calls.get(key)||[]).length>0&&calls.get(key).every(vars=>new RegExp(`(^|[{,\\s])${name}\\s*[:,}]`).test(vars.trim()));
    for(const form of forms)for(const name of names(form).split(',').filter(Boolean))assert.ok(names(source).split(',').includes(name)||passes(name),`${key}: 영어에만 있는 자리표 {${name}}를 넘기지 않는 자리가 있다`);
  }
});
test('서버 오류 코드: 서버가 붙이는 SYNK_PULSE_ 코드마다 화면 문장이 있고, 한국어 화면은 받은 문장 그대로다',async()=>{
  const {ERROR_CODE_TEXT,errorText}=await import('./public/pulse-app/api.mjs');
  const {setLocale}=await import('./public/pulse-app/i18n.mjs');
  const server=['pulse-requests.mjs','pulse-studio.mjs','client-projects.mjs'].map(name=>readFileSync(new URL(name,import.meta.url),'utf8')).join('\n');
  const codes=[...new Set([...server.matchAll(/'(SYNK_PULSE_[A-Z0-9_]+)'/g)].map(m=>m[1]))];
  assert.ok(codes.includes('SYNK_PULSE_FILE_MISSING'));
  for(const code of codes){assert.ok(Object.hasOwn(ERROR_CODE_TEXT,code),code);assert.ok(Object.hasOwn(en,ERROR_CODE_TEXT[code]),code+' 영어');}
  const message='「사진.png」 파일을 찾지 못했어요. 지우고 다시 올려 주세요.';
  assert.equal(errorText(message,'SYNK_PULSE_FILE_MISSING'),message,'한국어는 파일 이름이 든 서버 문장 그대로');
  await setLocale('en');
  try{
    assert.equal(errorText(message,'SYNK_PULSE_FILE_MISSING'),en[ERROR_CODE_TEXT.SYNK_PULSE_FILE_MISSING]);
    assert.equal(errorText('사전에 없는 서버 문장'),'사전에 없는 서버 문장','없는 문장은 원문(판 2에서 사전을 채운다)');
  }finally{await setLocale('ko');}
});
// 판 2: 서버 오류 문장의 영어 — 손님 길의 fail · httpError 리터럴과 사전을 대조하는 시험을 여기서 빠짐 0으로 켠다.
// 빈 todo 자리표시는 두지 않는다 — 회사 이미지 판의 격리 QA(tools/company-release/local-qa.cjs)가 todo 0을 요구해 사슬 57이 여기서 멈췄다(11-09).
