import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'acorn';
import {literalTexts,literalSyllables,SKIP_DIRS} from '../docs/마케팅/온라인마케팅지도/engagement/company/pulse-ui-text.mjs';

// PULSE 고객 앱 글꼴 조각(2026-11-11 첫 방문 무게)의 「화면 원문」 훑개 대조. 회사 폴더 도우미 pulse-ui-text.mjs는 회사 이미지 안(npm 패키지 없음)에서도
// 돌아야 해서 구문 분석 패키지 없이 쓴 작은 훑개다. 저장소 바닥(CI는 npm 설치가 있다)에서 acorn과 같은 글을 내는지 실제 파일로 대조한다 —
// 어긋나면 tools/build-pulse-fonts.py가 만든 ui 조각과 회사 시험 pulse-first-load.test.mjs가 센 글자가 같아도 둘 다 틀릴 수 있다.
const APP=new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/',import.meta.url);
const acornTexts=src=>{const out=[];const visit=n=>{if(!n||typeof n.type!=='string')return;if(n.type==='Literal'&&typeof n.value==='string')out.push(n.value);if(n.type==='TemplateElement')out.push(n.value.cooked??n.value.raw);for(const k of Object.keys(n)){if(k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v.type==='string')visit(v);}};visit(parse(src,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true}));return out;};
const files=()=>{const out=[];const walk=dir=>{for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory()){if(!SKIP_DIRS.includes(e.name))walk(p);}else if(/\.(mjs|js)$/.test(e.name))out.push(p);}};walk(fileURLToPath(APP));return out.sort();};

test('the lexer returns exactly the string and template texts acorn finds, file by file, across the customer app',()=>{
  const list=files();assert.ok(list.length>30,`파일 ${list.length}개`);
  let strings=0;
  for(const file of list){const src=readFileSync(file,'utf8'),want=acornTexts(src).sort(),got=literalTexts(src).sort();strings+=want.length;assert.deepEqual(got,want,file);}
  assert.ok(strings>10000,`문자열 ${strings}개`);
});

test('the lexer skips comments and regular expressions, reads escapes, and follows nested templates',()=>{
  const src=[
    "// 주석의 '따옴표' 「글」",
    "/* 막힌 주석 `템플릿` */",
    "const a='가\\'나',b=\"다\\u{B77C}\\uB9C8\",re=/[\"'`]/g,half=x=>x/2/1;",
    "const c=`바 ${a?`사 ${b}`:'아'} 자`;const d=s.replace(/['\"]/g,'').split('/');",
    "function f(){if(t)return /`/.test(c);} const e=`줄\r\n끝`;",
  ].join('\n');
  // 정규식 /["'`]/ · /['"]/ · /`/ 안의 따옴표는 글이 아니고, x/2/1은 나눗셈이다. 템플릿 안 CRLF는 LF로 읽는다(규격).
  assert.deepEqual(literalTexts(src),["가'나","다라마",'바 ','사 ','','아',' 자','','/','줄\n끝']);
  assert.deepEqual(acornTexts(src).sort(),literalTexts(src).sort(),'같은 꼬마 원문을 acorn도 같게 읽는다(차례는 구문 나무 차례라 정렬해 견준다)');
  // 검수 pulse-first-load-20261111-c B1 · 서버 A1: 점 뒤 예약어 이름(clip.in / 2), 후위 증감 뒤 나눗셈(i++ / w), 그 사이 글은 글로 읽는다.
  const tricky="let i=0,w=2,h=3,clip={in:4};const a=clip.in / 2, b=i++ / w, s='한글', c=i-- / h, d=x.return / 2, t=`끝`;";
  assert.deepEqual(literalTexts(tricky),['한글','끝']);assert.deepEqual(acornTexts(tricky).sort(),literalTexts(tricky).sort());
  assert.throws(()=>literalTexts('const r=/abc'),/정규식이 닫히지 않았다/);
  assert.throws(()=>literalTexts("const s='abc"),/문자열이 닫히지 않았다/);
  // 역슬래시 뒤 줄끝(LF · CRLF)은 줄 잇기 — 오류가 아니고 글에서 빠진다(검수 pulse-first-load-backend-20261111-d GA1).
  for(const nl of ['\n','\r\n']){const cont=`const s='가\\${nl}나',u="다\\${nl}라";`;assert.deepEqual(literalTexts(cont),['가나','다라']);assert.deepEqual(acornTexts(cont).sort(),literalTexts(cont).sort());}
  assert.throws(()=>literalTexts("const s='가\n나';"),/문자열이 줄을 넘었다/);
  assert.deepEqual([...literalSyllables([src])].map(c=>String.fromCodePoint(c)).sort(),['가','끝','나','다','라','마','바','사','아','자','줄'].sort());
});
