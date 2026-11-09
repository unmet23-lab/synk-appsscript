// 다국어 판 2(2026-11-09, 기획 12-2 「사전 검사」) — 영어 사전 대조. pulse-i18n-screen.test.mjs에서 떼어 왔다(11-09 회사 사슬 58).
// 구문 트리 도우미 pulse-i18n-scan.mjs가 저장소 devDependency acorn을 쓴다. 회사 판 시험은 예비 노드 Linux 격리 컨테이너(node_modules 없음)에서도 돌아야 하므로
// 이 시험 · 도우미 · pulse-i18n-server-errors.test.mjs는 회사 판에 싣지 않고 저장소에서만 돈다(사슬 58 make-carry NOT_IN_RELEASE).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {scanModule} from './pulse-i18n-scan.mjs';
import en from './public/pulse-app/i18n/en.mjs';

// 영어 사전 대조(기획 12-2 「사전 검사」 · 판 2): 손님 화면 모듈의 t('…') · k('…') 키는 모두 사전에 있고(빠진 키 0),
// 사전의 모든 키는 화면 · 서버 코드의 문자열로 실제로 쓰인다(죽은 키 0 — 서버 오류 문장은 서버가 만든다). 손님 길 모듈은 번역 틀 밖 한글도 0이다
// (직원 전용 · 옛 탭 · 저장값은 줄 끝 // i18n-skip 또는 // i18n-skip-start … -end 표시 — pulse-i18n-scan.mjs). 원문을 고치면 옛 키를 지워야 지나간다.
const APP=new URL('./public/pulse-app/',import.meta.url),ROOT=new URL('./',import.meta.url);
const SCREEN=readdirSync(APP).filter(name=>name.endsWith('.mjs')&&readFileSync(new URL(name,APP),'utf8').includes("from './i18n.mjs'"));
// 고객 방(usesRoom) 손님 길에서 그려지는 모듈 — 판 2에서 통째로 번역 틀을 지난다. 손님 길에 새 모듈이 생기면 여기에 더한다.
const CUSTOMER=['request-flow.mjs','request-data.mjs','request-backend.mjs','casting-catalog.mjs','film-home.mjs','film-views.mjs','film-review.mjs','room-view.mjs','films-view.mjs','views.mjs','production-context.mjs','feedback-rounds-view.mjs','deliverables-view.mjs','kickoff-view.mjs','changes-view.mjs','app.mjs','install.mjs','push.mjs','api.mjs','locale-menu.mjs'];
test('영어 사전: 손님 화면의 t() · k() 문장은 빠짐없이 있고, 손님 길에 틀 밖 한글이 없고, 쓰이지 않는 키는 없다',()=>{
  assert.ok(SCREEN.length>=5,SCREEN.join(','));
  const calls=new Map(),scans=new Map();
  for(const name of new Set([...SCREEN,...CUSTOMER])){const result=scanModule(readFileSync(new URL(name,APP),'utf8'));scans.set(name,result);for(const [key,vars]of result.keys)calls.set(key,[...(calls.get(key)||[]),...vars]);}
  const missing=[...calls.keys()].filter(key=>!Object.hasOwn(en,key));
  assert.deepEqual(missing,[],'사전에 없는 t() · k() 문장');
  for(const name of CUSTOMER){
    const {loose,dynamic}=scans.get(name);
    assert.deepEqual(loose.map(item=>`${item.line}: ${item.text}`),[],name+' — 번역 틀 밖 한글(직원 전용 · 저장값이면 i18n-skip 표시)');
    assert.deepEqual(dynamic.map(item=>`${item.line}: ${item.text}`),[],name+' — 정적 문장이 아닌 t() 키');
  }
  const read=url=>{try{return readFileSync(url,'utf8');}catch{return '';}};
  const sources=[...readdirSync(APP).filter(name=>/\.(mjs|js)$/.test(name)).map(name=>read(new URL(name,APP))),...readdirSync(ROOT).filter(name=>name.endsWith('.mjs')&&!name.endsWith('.test.mjs')).map(name=>read(new URL(name,ROOT))),read(new URL('../../../../../tools/company-messenger/web-push-service.mjs',import.meta.url))];
  const quoted=text=>sources.some(src=>["'",'"','`'].some(q=>src.includes(q+text+q)));
  const dead=Object.keys(en).filter(key=>!calls.has(key)&&!quoted(key.includes('\u0004')?key.split('\u0004')[1]:key));
  assert.deepEqual(dead,[],'화면 · 서버 어디에도 없는 사전 키(원문이 바뀌었으면 옛 키를 지운다)');
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
