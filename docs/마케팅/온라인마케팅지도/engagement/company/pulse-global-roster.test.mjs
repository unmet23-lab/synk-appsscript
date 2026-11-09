import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';

// 글로벌 모델 네 명(F12 · M11 · F13 · M12)은 얼굴 자산 · 승인 전이라 공개되지 않는 준비 목록에만 있다.
// 이 시험은 그 목록이 공개 쪽(명단 · 빌더 · 화면 · 서버)으로 새지 않고, 공개 전환 검사가 지금은 막는 것을 잠근다.
const here=dirname(fileURLToPath(import.meta.url));
const book=resolve(here,'../../../PULSE_AI모델_캐스팅_20260930');
const text=(file)=>readFileSync(file,'utf8');
const json=(file)=>JSON.parse(text(file));
const draft=json(join(book,'roster-global-draft.json'));
const codes=draft.candidates.map((c)=>c.code);
const check=join(book,'check-global-publish.cjs');
const run=(...args)=>spawnSync(process.execPath,[check,...args],{encoding:'utf8'});

function walk(dir){
  const out=[];
  for(const name of readdirSync(dir)){
    const file=join(dir,name);
    if(statSync(file).isDirectory())out.push(...walk(file));
    else if(/\.(js|cjs|mjs|css|html|json)$/.test(name))out.push(file);
  }
  return out;
}

test('준비 목록은 준비 중이고 단계가 모두 안 끝났으며 사진 · 이름 · 프롬프트가 없다',()=>{
  assert.equal(draft.status,'preparing');
  assert.deepEqual(codes,['F12','M11','F13','M12']);
  for(const c of draft.candidates){
    assert.ok(c.steps.length>=5);
    assert.ok(c.steps.every((s)=>s.done===false));
    for(const key of Object.keys(c))assert.ok(!/name|photo|image|hero|prompt|src|path/i.test(key),key);
  }
});

test('준비 코드는 지금 명단과 겹치지 않는다',()=>{
  const roster=json(join(book,'roster-v2.json')).models.map((m)=>m.code);
  const catalog=Object.keys(json(join(book,'catalog.json')).models);
  const casting=CASTING_MODELS.map((m)=>m.id);
  for(const code of codes){
    assert.ok(!roster.includes(code),`roster-v2 ${code}`);
    assert.ok(!catalog.includes(code),`catalog ${code}`);
    assert.ok(!casting.includes(code),`CASTING_MODELS ${code}`);
  }
});

test('준비 코드는 공개 쪽 파일 어디에도 문자열로 나오지 않는다',()=>{
  const files=[
    join(book,'roster-v2.json'),join(book,'catalog.json'),
    join(here,'public/pulse-app/casting-catalog.mjs'),join(here,'public/pulse-app/sw.js'),join(here,'server.mjs'),
    ...walk(join(book,'site-src')),
  ];
  const siteBuilt=join(book,'site');
  if(existsSync(siteBuilt))files.push(...walk(siteBuilt));
  for(const file of files){
    const body=text(file);
    for(const code of codes)assert.ok(!new RegExp(`(^|[^A-Za-z0-9])${code}([^A-Za-z0-9]|$)`,'i').test(body),`${file} 에 ${code}`);
  }
});

test('build-site.cjs는 roster-global-draft를 읽지 않는다',()=>{
  assert.ok(!/roster-global-draft/.test(text(join(book,'build-site.cjs'))));
});

test('공개 전환 검사는 준비 코드마다 막는다',()=>{
  for(const code of codes){
    const r=run(code);
    assert.equal(r.status,1,code);
    assert.ok(r.stdout.includes(`[${code}] 빠짐`));
    assert.match(r.stdout,/막힘/);
  }
  assert.equal(run().status,1);
});

test('공개 전환 검사는 기존 공개 모델의 자산 · 명단 줄을 통과시키고 준비 단계 줄은 건너뛴다',()=>{
  const r=run('F01');
  const lines=r.stdout.split('\n').filter((l)=>l.startsWith('[F01]'));
  assert.ok(lines.length>=10);
  assert.ok(lines.some((l)=>/준비 단계: 준비 목록에 없는 코드라 건너뜀/.test(l)&&l.includes('통과')));
  for(const l of lines)assert.ok(l.includes('통과'),l);
  assert.ok(r.stdout.includes("[전체] 통과 화면 글 인원수"));
});
