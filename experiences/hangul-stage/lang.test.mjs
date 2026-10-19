// 한글 만나기 화면 언어 1판(10-19): 표의 en·mn이 모두 있고, 단원·글자 설명·이유 한 줄을 빠짐없이 덮는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STRINGS,LANGS,t,useLang,missingStrings} from './lang.mjs';

const forms=value=>typeof value==='string'?[value]:[value.one,value.other];
const slots=text=>[...String(text).matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
const app=readFileSync(new URL('./app.mjs',import.meta.url),'utf8');
const strata=JSON.parse(readFileSync(new URL('../../strata/hangul.json',import.meta.url),'utf8'));

test('모든 줄에 ko·en·mn이 있고 en·mn의 값 자리가 같다',()=>{
 const problems=[];
 for(const [key,entry]of Object.entries(STRINGS)){
  for(const code of LANGS)if(entry[code]==null||forms(entry[code]).some(text=>!String(text||'').trim()))problems.push(`${key}: ${code}`);
  if(entry.en&&entry.mn){
   const en=typeof entry.en==='string'?entry.en:entry.en.other;
   if(slots(en)!==slots(entry.mn))problems.push(`${key}: en ${slots(en)} ≠ mn ${slots(entry.mn)}`);
   for(const slot of slots(entry.ko).split(',').filter(Boolean))if(!slots(en).split(',').includes(slot))problems.push(`${key}: ko의 {${slot}}가 en에 없다`);
  }
 }
 assert.deepEqual(problems,[]);
});

test('몽골어는 키릴로, 라틴 글자는 브랜드·약어만',()=>{
 const problems=[];
 for(const [key,entry]of Object.entries(STRINGS)){
  const bare=String(entry.mn).replace(/\{\w+\}/g,'').replace(/\b(?:SYNK|WORLD|O|X)\b/g,'');
  if(/[A-Za-z]/.test(bare))problems.push(`${key}: «${bare}»`);
  for(const text of forms(entry.en))if(/[А-Яа-яЁёӨөҮү]/.test(text))problems.push(`${key}: en에 키릴`);
 }
 assert.deepEqual(problems,[]);
});

test('한글 길의 단원 이름을 모두 옮겼다(한국어는 정본 strata 그대로)',()=>{
 for(const unit of [...strata.units,...strata.later]){
  assert.equal(STRINGS[`unit.${unit.id}`]?.ko,unit.label,unit.id);
  assert.ok(STRINGS[`unit.${unit.id}`].en&&STRINGS[`unit.${unit.id}`].mn,unit.id);
 }
});

test('만나기 카드의 글자 설명을 모두 옮겼다(한국어는 app.mjs 원문과 같다)',()=>{
 const tables=['FINAL_NOTE','ASPIRATED_NOTE','TENSE_NOTE','COMPOUND_NOTE'];
 let count=0;
 for(const name of tables){
  const body=app.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`))?.[1];assert.ok(body,name);
  for(const [,id,text]of body.matchAll(/'([a-z]-[a-z]+)':\s*'([^']+)'/g)){count++;assert.equal(STRINGS[`note.${id}`]?.ko,text,id);}
 }
 assert.ok(count>=24,`설명 ${count}개`);
 assert.ok(STRINGS['note.c-ng']&&STRINGS['note.finalIntro']&&STRINGS['note.sameSound']);
});

test('이유 한 줄의 종류(core.mjs reasonLine)를 모두 덮는다',()=>{
 const core=readFileSync(new URL('./core.mjs',import.meta.url),'utf8');
 const kinds=new Set([...core.slice(core.indexOf('function reasonLine')).matchAll(/kind: '([a-z]+)'/g)].map(m=>m[1]));
 assert.deepEqual([...kinds].sort(),['due','mixed','new','pair','practice','warmup']);
 for(const kind of kinds){
  if(kind==='pair')for(const when of ['now','yesterday','before'])assert.ok(STRINGS[`reason.pair.${when}`],when);
  else if(kind==='new')assert.ok(STRINGS['reason.new']&&STRINGS['reason.newFinals']);
  else assert.ok(STRINGS[`reason.${kind}`],kind);
 }
});

test('t(): 고른 언어·복수·빠진 말의 한국어 대체',()=>{
 useLang('en');
 assert.equal(t('finish.newLetters',{n:1}),'1 new letter, done!');
 assert.equal(t('finish.newLetters',{n:3}),'3 new letters, done!');
 useLang('mn');assert.equal(t('prompt.letter'),'Сонсоод зөв үсгийг сонгоорой');
 useLang('ko');assert.equal(t('prompt.letter'),'소리를 듣고 맞는 글자를 골라요');
 STRINGS['qa.ko']={ko:'한국어만'};
 try{assert.equal(t('qa.ko',undefined,'en'),'한국어만');assert.ok(missingStrings().some(item=>item.key==='qa.ko'&&item.lang==='en'));}
 finally{delete STRINGS['qa.ko'];}
});

test('app.mjs가 부르는 키는 모두 표에 있다',()=>{
 const used=new Set([...app.matchAll(/\btr\('([^']+)'/g)].map(m=>m[1]));
 for(const [,a,b]of app.matchAll(/\btr\([^)]*?\?\s*'([^']+)'\s*:\s*'([^']+)'/g)){used.add(a);used.add(b);}
 const dynamic=[...used].filter(key=>key.endsWith('.')||key.includes('${'));
 const missing=[...used].filter(key=>!dynamic.includes(key)&&!STRINGS[key]);
 assert.deepEqual(missing,[]);
 assert.ok(used.size>60,`쓰는 키 ${used.size}개`);
});
