// 검수 도구의 「생성물」 칸(2026-11-21 · 설계 주인 11-20 저녁 · 11-21): 명세의 원천 커밋 · 되돌림 · 빌더로 다시 지어 후보와 같을 때만 준비가 서고,
// 라이브 판이 바탕 커밋에서 다시 지어지면(바탕 재현) 본문 대신 재현 결과와 원천 차이가, 지어지지 않으면 본문 차이(라이브 → 후보)가 묶음에 실린다.
// 검수 뒤 명세 · 대본이 바뀌면 확인이 막는다. 합성 저장소만 쓴다(모델 호출 없음).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';
import * as api from '../tools/검수묶음.mjs';
import { 입력증명, 정규해시 } from '../tools/lib/검수증명.mjs';
import { 생성물명세읽기, 상대경로인가, 같은코드, 이름짝인가, 낱말나누기, 모듈나누기, 조각덮음, 묶음대조, 문자열대조, 머리입력읽기, 글맞춤, 이름맞춤, 코드글본, 까닭꼴, 원천덮기, JSON쓰기, JSON쓰기꼴, JSON구조차이, JSON차이완전, JSON연산적용, JSON차이글, 모듈JSON값, 덧글자, 생성물바꿔넣기, 파일모음, 생성물증거쓰기, 생성물허용명세 } from '../tools/lib/검수생성물.mjs';

// 실패 경우를 시험하면 도구가 재현 사본을 남긴다. 이 파일은 자기 임시 뿌리에서 돌고 끝날 때 한 번에 치운다(검수 도구 시험돌리기와 같은 방식).
const 시험임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-run-'));
for (const k of ['TEMP', 'TMP', 'TMPDIR']) process.env[k] = 시험임시;
after(() => fs.rmSync(시험임시, { recursive: true, force: true, maxRetries: 5 }));
// 생성물 칸은 허용 목록의 명세에만 쓴다(설계 주인 11-22). 이 파일은 합성 명세를 쓰므로 node 시험 실행에서만 그 묶음을 건너뛴다 — 허용 목록 시험이 따로 본다.
process.env.SYNK_생성물_시험 = '1';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const 블롭번호 =b => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
const NL = String.fromCharCode(10);
const 몸 = Buffer.from(`/*BUILT*/hello v2${NL}stable${NL}`);
const 바탕몸 = Buffer.from(`/*BUILT*/hello v1${NL}stable${NL}`);
/** 원천 저장소: 바탕(v1) → 바란 고침(v2) → 아직 공개하지 않은 다른 일(unpublished, 되돌림 대본이 걷는다). 라이브 판은 기본으로 바탕에서 지은 바이트다. */
function fixture(t, { 되돌림 = true, 후보몸 = 몸, 라이브 = 바탕몸, 명세고침 = x => x, 바탕파일 = {}, 바란파일 = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-')), repo = path.join(dir, 'repo');
  t.after(() => {
    assert.ok(path.basename(dir).startsWith('synk-review-gen-test-'));
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  });
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(dir, 'none'), GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') && !['GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL'].includes(key)) delete env[key];
  const run = (...args) => execFileSync('git', ['-C', repo, '-c', 'core.autocrlf=false', ...args], { env, encoding: 'utf8', stdio: 'pipe' });
  const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  fs.mkdirSync(repo);
  run('init', '-q', '-b', 'main');
  write(path.join(repo, 'src/msg.txt'), `hello v1${NL}`);
  write(path.join(repo, 'src/other.txt'), `stable${NL}`);
  write(path.join(repo, 'tools/build.mjs'), `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt','/*BUILT*/'+fs.readFileSync('src/msg.txt','utf8')+fs.readFileSync('src/other.txt','utf8'));${NL}`);
  for (const [p, g] of Object.entries(바탕파일)) write(path.join(repo, p), g);
  run('add', '.'); run('commit', '-qm', 'base');
  const base = run('rev-parse', 'HEAD').trim();
  write(path.join(repo, 'src/msg.txt'), `hello v2${NL}`);
  for (const [p, g] of Object.entries(바란파일)) if (g === null) fs.rmSync(path.join(repo, p)); else write(path.join(repo, p), g);
  run('add', '.'); run('commit', '-qm', 'wanted');
  const wanted = run('rev-parse', 'HEAD').trim();
  write(path.join(repo, 'src/other.txt'), `stable${NL}unpublished${NL}`); run('commit', '-qam', 'other work');
  const top = run('rev-parse', 'HEAD').trim();
  const spec = path.join(dir, 'spec'), candidate = path.join(dir, 'candidate');
  // 후보 · 라이브 바이트가 커밋 번호에 기대면(EXPORT_COMMIT을 싣는 빌더) 함수로 받는다
  if (typeof 후보몸 === 'function') 후보몸 = 후보몸({ base, wanted, top });
  if (typeof 라이브 === 'function') 라이브 = 라이브({ base, wanted, top });
  write(path.join(spec, 'revert.cjs'), `const fs=require('fs'),p=require('path');const e=process.argv[2];if(!fs.existsSync(p.join(e,'EXPORT_COMMIT')))throw new Error('no export');fs.writeFileSync(p.join(e,'src/other.txt'),'stable'+String.fromCharCode(10));${NL}`);
  write(path.join(candidate, 'site/bundle.txt'), 후보몸);
  if (라이브) write(path.join(candidate, '.앞판/site/bundle.txt'), 라이브);
  write(path.join(candidate, '후보.json'), JSON.stringify({ 판: 1, 종류: 'synk.im', 항목: [{ 경로: 'site/bundle.txt', 종류: '바꿈', 모드: '100644', sha256: sha(후보몸) }],
    ...(라이브 ? { 앞판: { 'site/bundle.txt': 블롭번호(라이브) } } : {}) }));
  const 명세 = 명세고침({ 판: 1, 원천: top, 꺼냄: ['src', 'tools'], ...(되돌림 ? { 되돌림: { 대본: 'revert.cjs', 목록: [top] } } : {}), 빌더: [['tools/build.mjs']],
    항목: [{ 경로: 'site/bundle.txt', 만든곳: '.tmp/out/bundle.txt', 바탕: base, 원천경로: ['src'] }] }, { base, wanted, top, dir });
  const specFile = path.join(spec, 'spec.json');
  write(specFile, JSON.stringify(명세, null, 2));
  const options = { 이름: 'gen-first', 폴더: path.join(dir, 'packet'), 저장소: repo, 바탕: top, 종류: '화면', 페이블생략: '합성 시험', 배포후보: candidate, 경로: [], 생성물: specFile };
  return { dir, repo, base, wanted, top, spec, specFile, candidate, options, write, run };
}
const 묶음글 = 목록폴더 => fs.readdirSync(목록폴더).filter(n => /^묶음-.*\.txt$/.test(n)).map(n => fs.readFileSync(path.join(목록폴더, n), 'utf8')).join(NL);
const 남은사본지우기 = e => {
  const 곳 = e?.사본 && path.dirname(e.사본);
  if (곳 && path.basename(곳).startsWith('synk-review-gen-') && path.dirname(path.resolve(곳)) === path.resolve(os.tmpdir())) fs.rmSync(곳, { recursive: true, force: true, maxRetries: 5 });
};
/** 합성 카본 답 — 빼기(id)가 참인 항목은 읽지 않은 것으로 답한다. */
const 카본보내기 = (폴더, 목록, 빼기 = () => false) => api.아르곤보내기(폴더, 목록, {
  call: async ({ prompt }) => ({ text: JSON.stringify({ findings: [], seen: [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(x => x[1]).filter(id => !빼기(id)),
    coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1] }), selectedModel: 'fixture-reviewer' }),
  몫: async () => ({ 주간: 0.5, 다섯시간: 0.5 }) });
// 이 파일의 검수는 시험 표지로 지어 증명에 「허용 목록 건너뜀」 표시가 있고, 검수 확인이 그 표시로 늘 막는다(설계 주인 11-22). 그래서 「충족」은
// 그 표시 사유만 남았는지(표시만), 「충족이 아님」은 표시 밖 사유가 있는지(표시뺀)로 본다.
const 표시사유 = /「허용 목록 건너뜀」 표시가 있다/;
const 표시뺀 = r => (r.사유 || []).filter(x => !표시사유.test(x));
const 표시만 = (r, 글) => {
  assert.equal(r.통과, false, '시험 표지로 지은 검수는 확인이 막는다');
  assert.ok((r.사유 || []).some(x => 표시사유.test(x)), '표시 사유가 있다');
  assert.deepEqual(표시뺀(r), [], 글);
};

test('생성물 — 다시 지은 바이트가 후보와 같고 라이브가 바탕에서 다시 지어지면, 묶음은 본문 대신 재현 결과 · 원천 차이 · 되돌림 차이를 싣는다', async t => {
  const f = fixture(t);
  const { 폴더, 목록 } = await api.준비하기(f.options);
  const g = 목록.증명.생성물;
  assert.equal(g.판, 1);
  assert.equal(g.원천, f.top);
  assert.equal(g.명세.sha256, sha(fs.readFileSync(f.specFile)));
  assert.deepEqual(g.대본.map(d => [d.역할, d.sha256]), [['되돌림', sha(fs.readFileSync(path.join(f.spec, 'revert.cjs')))]]);
  // 입력 지도가 같아도 반사실 빌드를 늘 돌린다(설계 검토 F4 · GPT GB5 · GB6) — 그 결과가 증명에 남는다.
  assert.deepEqual(g.항목, [{ 경로: 'site/bundle.txt', 만든곳: '.tmp/out/bundle.txt', 바탕: f.base, 후보sha256: sha(몸), 재현sha256: sha(몸), 라이브sha256: sha(바탕몸), 바탕재현sha256: sha(바탕몸), 바탕재현: true, 바탕까닭꼴: '같음', 입력반사실: '같음' }]);
  const 글 = 묶음글(폴더);
  assert.match(글, /생성물 재현 — 결과/);
  assert.match(글, /배포 후보 site\/bundle\.txt .*— 생성물\(바탕 재현 같음 · 본문 대신/);
  assert.match(글, /-hello v1\r?\n\+hello v2/, '원천 차이는 바탕 → 되돌린 뒤 후보 원천');
  assert.match(글, /생성물 되돌림 목록 [0-9a-f]{10}/);
  assert.doesNotMatch(글, /\/\*BUILT\*\//, '바탕 재현이 같은 생성물은 본문 · 본문 차이를 싣지 않는다');
  for (const n of ['명세.json', '재현.json', '원천차이-1.patch', `되돌림-${f.top.slice(0, 10)}.patch`]) assert.ok(fs.existsSync(path.join(폴더, '생성물', n)), n);
  const 원천차이 = fs.readFileSync(path.join(폴더, '생성물', '원천차이-1.patch'), 'utf8');
  assert.match(원천차이, /\+hello v2/);
  assert.doesNotMatch(원천차이, /unpublished/, '되돌린 변경은 원천 차이에 없다');
  assert.match(fs.readFileSync(path.join(폴더, '생성물', `되돌림-${f.top.slice(0, 10)}.patch`), 'utf8'), /\+unpublished/, '되돌림 목록의 차이는 따로 보인다');
  const 자료 = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8'));
  const 재현칸 = 자료.증명.보조파일.find(x => x.경로 === '생성물/재현.json');
  assert.equal(재현칸?.sha256, sha(fs.readFileSync(path.join(폴더, '생성물', '재현.json'))), 'Fable 최종 자료가 증거 파일을 그 바이트의 해시로 묶는다');
  assert.deepEqual(자료.증명.생성물.항목, g.항목);
  assert.match(fs.readFileSync(path.join(폴더, 'fable.md'), 'utf8'), /생성물 site\/bundle\.txt은 바탕 재현이 같아 본문 대신/);
  assert.equal(표시뺀(api.검수확인(폴더)).some(s => s.includes('생성물')), false, '그대로면 (표시 밖) 생성물 사유가 없다');
});

test('생성물 — 라이브가 바탕에서 다시 지어지지 않으면 바탕재현 false로 적고 본문 차이(라이브 → 후보)를 싣는다. 검수자가 그 항목을 읽지 않으면 미충족이고, 읽으면 충족이다', async t => {
  const 다른라이브 = Buffer.from(`/*BUILT*/hello v0${NL}stable${NL}`);
  const 준비 = async (t, 이름) => { const f = fixture(t, { 라이브: 다른라이브 }); return { f, ...(await api.준비하기({ ...f.options, 이름 })) }; };
  const { f, 폴더, 목록 } = await 준비(t, 'gen-unreproduced');
  const [g] = 목록.증명.생성물.항목;
  assert.equal(g.바탕재현, false);
  assert.equal(g.바탕까닭꼴, '라이브와 다름', '증명만으로 본문 대조로 돌아간 까닭의 꼴을 안다(GPT -c GD19)');
  assert.equal(g.라이브sha256, sha(다른라이브));
  assert.equal(g.바탕재현sha256, sha(바탕몸));
  const 글 = 묶음글(폴더);
  assert.match(글, /배포 후보 site\/bundle\.txt .*— 생성물이지만 바탕 재현 안 됨\(라이브와 다름\): 본문 차이를 검수한다 — 앞 공개본과 달라진 곳만/);
  assert.match(글, /hello v0/, '본문 차이가 실린다');
  assert.match(fs.readFileSync(path.join(폴더, 'fable.md'), 'utf8'), /생성물 site\/bundle\.txt은 바탕 재현이 안 돼 본문 차이/);
  const 본문항목 = id => /^P01(?:[a-z]+|z\d+)?-/.test(id);
  assert.ok(목록.묶음.some(b => b.항목.some(본문항목)), '본문 차이 항목이 묶음에 있다');
  await 카본보내기(폴더, 목록, 본문항목);
  assert.ok(표시뺀(api.검수확인(폴더, { 저장소: f.repo })).length > 0, '본문 차이 항목을 읽지 않은 검수는 충족이 아니다');
  const 둘 = await 준비(t, 'gen-unreproduced-read');
  await 카본보내기(둘.폴더, 둘.목록);
  const r = api.검수확인(둘.폴더, { 저장소: 둘.f.repo });
  표시만(r, (r.사유 || []).join(' / '));
  // 본문 차이 항목이 묶음에서 빠지면 다 읽은 답이 있어도 미충족이다(GPT 다시 검수 GA2 — 읽음 검사만으로는 이 빠짐을 못 잡는다)
  const 묶음파일 = path.join(둘.폴더, '묶음.json'), 원묶음 = fs.readFileSync(묶음파일, 'utf8'), 고친 = JSON.parse(원묶음);
  for (const b of 고친.묶음) b.항목 = b.항목.filter(id => !본문항목(id));
  fs.writeFileSync(묶음파일, JSON.stringify(고친, null, 2));
  const 빠짐 = api.검수확인(둘.폴더, { 저장소: 둘.f.repo });
  assert.ok(표시뺀(빠짐).length > 0);
  assert.ok(빠짐.사유.some(x => /site\/bundle\.txt은 바탕 재현이 안 됐는데 본문 차이 항목이 검수 묶음에 없다/.test(x)), 빠짐.사유.join(' / '));
  // 목록에만 남은 번호는 실린 것이 아니다 — 그 묶음 글에 같은 번호의 머리줄이 있어야 한다(GPT -c GE5)
  const 바꾼 = JSON.parse(원묶음);
  for (const b of 바꾼.묶음) b.항목 = b.항목.map(id => (본문항목(id) ? id.replace(/-[0-9a-f]{4}$/, '-zzzz') : id));
  fs.writeFileSync(묶음파일, JSON.stringify(바꾼, null, 2));
  const 어긋남 = api.검수확인(둘.폴더, { 저장소: 둘.f.repo });
  assert.ok(표시뺀(어긋남).length > 0);
  assert.ok(어긋남.사유.some(x => /목록 항목 P01[a-z0-9]*-zzzz가 그 묶음 글의 머리줄에 없다/.test(x)), 어긋남.사유.join(' / '));
  assert.ok(어긋남.사유.some(x => /본문 차이 항목이 검수 묶음에 없다/.test(x)), 어긋남.사유.join(' / '));
  fs.writeFileSync(묶음파일, 원묶음);
  // Fable이 읽는 지금 공개본은 검수 폴더에 사본으로 고정되고 보조 파일 해시에 든다 — 후보 폴더의 .앞판이 뒤에 바뀌어도 Fable 자료는 그대로다(GPT -c GE9)
  const 앞판사본 = path.join(폴더, '생성물', '앞판-site_bundle.txt');
  assert.ok(fs.readFileSync(앞판사본).equals(다른라이브), '준비 때 증거에도 지금 공개본 사본이 있다');
  await api.페이블하기(폴더, { 시험: false, 캡처: false });
  const 페이블 = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8'));
  assert.ok(페이블.증명.보조파일.some(x => x.경로 === '생성물/앞판-site_bundle.txt' && x.sha256 === sha(다른라이브)), JSON.stringify(페이블.증명.보조파일));
  assert.match(fs.readFileSync(path.join(폴더, 'fable.md'), 'utf8'), /본문 차이\(검수 폴더 생성물\/앞판-\*/);
  assert.deepEqual(fs.readdirSync(폴더).filter(n => n.startsWith('생성물.')), [], '이 실행이 따로 쓴 새 증거 폴더와 옛 증거는 남지 않는다(GPT -c GE7 · GE8)');
  f.write(path.join(f.candidate, '.앞판/site/bundle.txt'), Buffer.from('뒤에 바꾼 앞판'));
  assert.ok(fs.readFileSync(앞판사본).equals(다른라이브), '후보 폴더의 .앞판을 바꿔도 검수 폴더의 사본은 그대로다');
});

test('덧 항목 글자 — 25개를 넘어도 번호가 겹치지 않고, 쪼갠 조각의 작은 글자와도 겹치지 않는다(GPT -c GE6)', () => {
  const xs = Array.from({ length: 60 }, (_, k) => 덧글자(k));
  assert.equal(new Set(xs).size, 60);
  assert.deepEqual([xs[0], xs[24], xs[25], xs[26]], ['A', 'Y', 'Z25', 'Z26']);
  assert.ok(xs.every(x => /^(?:[A-Y]|Z\d+)$/.test(x)), '큰 글자뿐이다 — 쪼갠 조각은 a … z · z<수>');
});

test('생성물 증거 바꿔 넣기 — 새 증거로 바꾸고, 옮기다 실패하면 옛 증거가 그대로이며, 증명을 못 쓰면 되돌리기로 옛 증거를 제자리에 돌린다(GPT -c GE7 · GE8)', () => {
  const 폴더 = fs.mkdtempSync(path.join(시험임시, 'swap-'));
  const 쓰기 = (곳, 글) => { fs.mkdirSync(path.join(폴더, 곳), { recursive: true }); fs.writeFileSync(path.join(폴더, 곳, '재현.json'), 글); };
  const 읽기 = () => fs.readFileSync(path.join(폴더, '생성물', '재현.json'), 'utf8');
  쓰기('생성물', '옛'); 쓰기('생성물.새-a', '새 a');
  const 바꿈 = 생성물바꿔넣기(폴더, '생성물.새-a');
  assert.equal(읽기(), '새 a');
  바꿈.되돌리기();
  assert.equal(읽기(), '옛', '증명을 다 쓰지 못하면 옛 증거가 제자리로 돌아온다');
  쓰기('생성물.새-b', '새 b');
  const 원래 = fs.renameSync;
  let 셈 = 0;
  fs.renameSync = (a, b) => { 셈 += 1; if (셈 === 2) throw Object.assign(new Error('EPERM 흉내'), { code: 'EPERM' }); return 원래(a, b); };
  try { assert.throws(() => 생성물바꿔넣기(폴더, '생성물.새-b'), /EPERM 흉내/); } finally { fs.renameSync = 원래; }
  assert.equal(셈, 3, '옛 증거를 옆으로 옮기고 → 새 증거 옮기기가 실패하고 → 옛 증거를 제자리로');
  assert.equal(읽기(), '옛', '새 증거를 옮기다 실패해도 옛 증거는 지워지지 않는다');
  const 끝 = 생성물바꿔넣기(폴더, '생성물.새-b');
  끝.끝내기();
  assert.equal(읽기(), '새 b');
  assert.deepEqual(fs.readdirSync(폴더).sort(), ['생성물'], '옛 증거는 증명까지 다 쓴 뒤에 지운다');
  assert.doesNotThrow(() => 생성물바꿔넣기(폴더, '생성물.새-없음').끝내기(), '새 증거가 없으면 할 일이 없다');
});

test('생성물 — 꺼냄 파일이 같아도 도구가 쓰는 EXPORT_COMMIT처럼 입력 지도에 없는 입력이 출력을 바꾸면 반사실 빌드가 잡아 바탕재현 false로 돌린다(GPT 다시 검수 GB5)', async t => {
  // 빌더가 EXPORT_COMMIT의 앞 일곱 자를 싣는다 — 라이브는 바탕 커밋, 후보는 원천 커밋 번호를 싣는다. 원천경로 밖 꺼냄 파일은 두 판이 같다.
  const 빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt','/*BUILT*/'+fs.readFileSync('src/msg.txt','utf8')+fs.readFileSync('src/other.txt','utf8')+fs.readFileSync('EXPORT_COMMIT','utf8').trim().slice(0,7));${NL}`;
  const f = fixture(t, { 바탕파일: { 'tools/build.mjs': 빌더 }, 라이브: ({ base }) => Buffer.from(`/*BUILT*/hello v1${NL}stable${NL}${base.slice(0, 7)}`), 후보몸: ({ top }) => Buffer.from(`/*BUILT*/hello v2${NL}stable${NL}${top.slice(0, 7)}`) });
  const { 목록 } = await api.준비하기(f.options);
  const [g] = 목록.증명.생성물.항목;
  assert.equal(g.바탕재현, false, '원천 차이(hello v1 → v2)만으로는 출력 변경(커밋 번호)을 다 말하지 못한다');
  assert.equal(g.바탕까닭꼴, '반사실 다름(입력 지도 밖 입력)');
  assert.equal(g.입력반사실, '다름');
});

test('생성물 — 되돌림 · 준비 대본은 명세를 읽을 때 해시한 바이트를 고정한 자리에서 돌린다: 옆 파일을 상대 경로로 부르는 대본은 멈춘다(GPT 다시 검수 GB4)', async t => {
  const f = fixture(t, { 명세고침: x => ({ ...x, 준비: ['prep.cjs'] }) });
  f.write(path.join(f.spec, 'helper.cjs'), `module.exports = 1;${NL}`);
  f.write(path.join(f.spec, 'prep.cjs'), `require('./helper.cjs');${NL}`);
  let 잡음 = null;
  await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /준비 실패\(종료 1\): node [^\n]*\/대본\/\d+\/prep\.cjs[\s\S]*MODULE_NOT_FOUND/.test(e.message); }, '고정한 자리의 대본이 돌고, 증명에 묶이지 않은 도우미 파일은 찾지 못한다');
  t.after(() => 남은사본지우기(잡음));
});

test('생성물 — 명세 경로의 역슬래시 · 대소문자로 만든곳이 잇기(원본 폴더로 이은 곳) 안을 가리키지 못한다(GPT 다시 검수 GB1)', async t => {
  const 원본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-deps-'));
  t.after(() => fs.rmSync(원본, { recursive: true, force: true, maxRetries: 5 }));
  const 고침 = 만든곳 => x => ({ ...x, 잇기: [{ 경로: 'deps', 원본 }], 항목: x.항목.map(it => ({ ...it, 만든곳 })) });
  assert.equal(상대경로인가('deps\\old.bin'), false, '역슬래시는 경로 구분자로 받지 않는다');
  assert.throws(() => 생성물명세읽기(fixture(t, { 명세고침: 고침('deps\\old.bin') }).specFile), /만든곳은 사본 안 상대 경로다/);
  if (process.platform === 'win32') assert.throws(() => 생성물명세읽기(fixture(t, { 명세고침: 고침('DEPS/old.bin') }).specFile), /만든곳이 잇기 안에 있다: DEPS\/old\.bin · deps/, 'Windows는 대소문자를 가리지 않는다');
  assert.throws(() => 생성물명세읽기(fixture(t, { 명세고침: 고침('deps/old.bin') }).specFile), /만든곳이 잇기 안에 있다/);
});

test('반사실 빌드 덮기 — 바탕 사본의 경로 마디에 링크가 있으면 링크를 따라 사본 밖에 쓰지 않고 멈춘다(GPT 다시 검수 GB2)', t => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-overlay-')), 밖 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-out-'));
  t.after(() => { for (const d of [뿌리, 밖]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 }); });
  fs.mkdirSync(path.join(뿌리, 'src'), { recursive: true });
  fs.writeFileSync(path.join(뿌리, 'src', 'a.txt'), 'a');
  fs.symlinkSync(밖, path.join(뿌리, 'src', 'sub'), process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => { try { fs.unlinkSync(path.join(뿌리, 'src', 'sub')); } catch { /* 없음 */ } });
  assert.throws(() => 원천덮기(뿌리, ['src'], [], new Map([['src/a.txt', Buffer.from('b')], ['src/sub/x.txt', Buffer.from('후보')]])), /덮을 자리에 링크가 있다: src\/sub\/x\.txt\(src\/sub\)/);
  assert.equal(fs.existsSync(path.join(밖, 'x.txt')), false, '사본 밖에 쓰지 않았다');
});

test('반사실 빌드 덮기 — 바탕의 폴더 자리를 후보가 파일로 쓰면 빈 폴더를 걷고 쓴다(GPT -c GD18)', t => {
  const 사본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-overlay-'));
  t.after(() => fs.rmSync(사본, { recursive: true, force: true, maxRetries: 5 }));
  fs.mkdirSync(path.join(사본, 'src/config'), { recursive: true });
  fs.writeFileSync(path.join(사본, 'src/config/index.js'), 'old');
  fs.writeFileSync(path.join(사본, 'src/keep.txt'), 'k');
  원천덮기(사본, ['src'], [], [['src/config', Buffer.from('new')], ['src/keep.txt', Buffer.from('k2')]]);
  assert.equal(fs.readFileSync(path.join(사본, 'src/config'), 'utf8'), 'new', '바탕의 폴더 자리에 후보 파일이 쓰였다');
  assert.equal(fs.readFileSync(path.join(사본, 'src/keep.txt'), 'utf8'), 'k2');
});

test('바탕 까닭의 꼴 — 증명에는 임시 경로가 든 실패 글 대신 꼴만 싣는다(GPT -c GD19)', () => {
  assert.equal(까닭꼴('같음'), '같음');
  assert.equal(까닭꼴('바탕 빌드 실패 — 준비 실패(종료 1): node C:/Temp/synk-review-gen-x/대본/1/prep.cjs'), '바탕 빌드 실패');
  assert.equal(까닭꼴('라이브와 다름 — 바탕 빌드에서 0 아닌 종료: tools/x.mjs 종료 1'), '라이브와 다름(0 아닌 종료 단계 있음)');
  assert.equal(까닭꼴('원천경로 밖 빌드 입력 3개를 바탕 판으로 두면 지어지지 않는다 — x'), '반사실 빌드 실패');
  assert.equal(까닭꼴(null), null);
});

test('생성물 — 라이브에 없는 생성물은 바탕재현 false(라이브에 없음)로 본문을 싣는다', async t => {
  const f = fixture(t, { 라이브: null });
  const { 폴더, 목록 } = await api.준비하기(f.options);
  const [g] = 목록.증명.생성물.항목;
  assert.equal(g.바탕재현, false);
  assert.equal(g.바탕까닭꼴, '라이브에 없음');
  assert.equal(g.라이브sha256, null);
  assert.match(묶음글(폴더), /생성물이지만 바탕 재현 안 됨\(라이브에 없음\)[^\n]*\r?\n\/\*BUILT\*\/hello v2/);
});

test('생성물 — 다시 지은 바이트가 후보와 다르면 준비가 멈춘다(되돌림을 빠뜨린 명세 · 다른 후보)', async t => {
  for (const [이름, 고침] of [['되돌림 없음', { 되돌림: false }], ['다른 후보', { 후보몸: Buffer.from(`/*BUILT*/hello v3${NL}stable${NL}`) }]]) {
    await t.test(이름, async t => {
      const f = fixture(t, 고침);
      let 잡음 = null;
      await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /생성물 재현이 후보와 다르다/.test(e.message); });
      t.after(() => 남은사본지우기(잡음));
      assert.ok(잡음.사본 && fs.statSync(잡음.사본).isDirectory(), '조사할 재현 사본을 남긴다');
      assert.ok(잡음.message.includes(잡음.사본), '남긴 사본 경로를 알린다');
      assert.ok(fs.readFileSync(path.join(잡음.사본, '.tmp/out/bundle.txt'), 'utf8').startsWith('/*BUILT*/'), '다르게 지은 빌드 결과가 사본에 남는다');
    });
  }
});

test('생성물 — 꺼낸 판에 이미 있던 출력은 재현으로 치지 않는다: 빌더가 아무것도 짓지 않으면 멈춘다(GPT GB5)', async t => {
  // 후보와 같은 바이트가 커밋돼 꺼냄에 든다 — 빌더는 아무것도 짓지 않는다.
  const f = fixture(t, { 바탕파일: { 'tools/build.mjs': `// 아무것도 짓지 않는다${NL}` }, 바란파일: { '.tmp/out/bundle.txt': 몸 }, 명세고침: x => ({ ...x, 꺼냄: [...x.꺼냄, '.tmp'] }) });
  let 잡음 = null;
  await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /생성물 재현이 후보와 다르다 — site\/bundle\.txt: 후보 [0-9a-f]{12} · 재현 없음/.test(e.message); });
  t.after(() => 남은사본지우기(잡음));
  const 재현기록 = JSON.stringify(잡음.기록 ?? null);
  assert.ok(!fs.existsSync(path.join(잡음.사본, '.tmp/out/bundle.txt')), '짓기 전에 꺼낸 출력을 지웠다');
  assert.ok(재현기록 === 'null' || 재현기록.includes('만든곳 비움'));
});

test('생성물 — 바탕 재현이 안 된 이진 생성물은 읽을 본문 차이가 없어 준비가 멈춘다(GPT GB3)', async t => {
  const 이진몸 = Buffer.from(`/*BUILT*/hello\u0000v2${NL}stable${NL}`);
  const f = fixture(t, { 바란파일: { 'src/msg.txt': `hello\u0000v2${NL}` }, 후보몸: 이진몸, 라이브: Buffer.from(`/*BUILT*/손\u0000판${NL}`) });
  await assert.rejects(api.준비하기(f.options), /생성물 site\/bundle\.txt은 바탕 재현이 안 됐는데 이진 파일이라 본문 차이로 볼 수 없다/);
});

test('생성물 — Fable 자료는 처음 검수와 같은 판으로만 다시 뜬다: 준비 뒤 앞판을 바꾸면 페이블이 멈춘다(GPT GB1). 멈출 때 처음 검수의 생성물/ 증거는 그대로다(다시 검수 GC2)', async t => {
  const f = fixture(t);
  const { 폴더 } = await api.준비하기(f.options);
  await api.페이블하기(폴더, { 시험: false, 캡처: false });
  const 증거 = () => Object.fromEntries(fs.readdirSync(path.join(폴더, '생성물')).sort().map(n => [n, sha(fs.readFileSync(path.join(폴더, '생성물', n)))]));
  const 처음 = 증거(), 페이블증명 = fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8');
  // 명세의 설명만 바꿔도 처음 검수와 다른 판이다 — 거절하기 전에 생성물/의 명세 · 증거를 덮지 않는다
  const 원명세 = fs.readFileSync(f.specFile, 'utf8');
  f.write(f.specFile, JSON.stringify({ ...JSON.parse(원명세), 설명: '설명만 바꿈(합성 시험)' }, null, 2));
  await assert.rejects(api.페이블하기(폴더, { 시험: false, 캡처: false }), /생성물 칸이 있는 검수는 처음 검수와 같은 판으로만 Fable 자료를 다시 뜬다 — 바뀐 것: [^\n]*생성물 명세/);
  assert.deepEqual(증거(), 처음, '처음 검수의 생성물/ 증거가 그대로다');
  assert.deepEqual(fs.readdirSync(폴더).filter(n => n.startsWith('생성물.')), [], '이 실행이 따로 쓴 새 증거는 지운다(GPT -c GE7)');
  assert.equal(fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8'), 페이블증명);
  f.write(f.specFile, 원명세);
  const 새라이브 = Buffer.from(`/*BUILT*/손 판${NL}stable${NL}`), 후보파일 = path.join(f.candidate, '후보.json'), 후보 = JSON.parse(fs.readFileSync(후보파일, 'utf8'));
  f.write(path.join(f.candidate, '.앞판/site/bundle.txt'), 새라이브);
  f.write(후보파일, JSON.stringify({ ...후보, 앞판: { 'site/bundle.txt': 블롭번호(새라이브) } }));
  await assert.rejects(api.페이블하기(폴더, { 시험: false, 캡처: false }), /생성물 칸이 있는 검수는 처음 검수와 같은 판으로만 Fable 자료를 다시 뜬다 — 바뀐 것: [^\n]*앞판/);
});

test('생성물 — 대본 · 빌더가 이은 원본 폴더(node_modules 등)에 쓰면 준비가 멈춘다. 읽기만 하면 그대로 선다(GPT GB4)', async t => {
  const 원본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-deps-'));
  t.after(() => fs.rmSync(원본, { recursive: true, force: true, maxRetries: 5 }));
  fs.writeFileSync(path.join(원본, 'keep.txt'), 'k');
  const 읽는빌더 = `import fs from 'node:fs';fs.readFileSync('deps/keep.txt');fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt','/*BUILT*/'+fs.readFileSync('src/msg.txt','utf8')+fs.readFileSync('src/other.txt','utf8'));${NL}`;
  const 쓰는빌더 = `import fs from 'node:fs';fs.mkdirSync('deps/.cache',{recursive:true});fs.writeFileSync('deps/.cache/x','w');${읽는빌더.slice("import fs from 'node:fs';".length)}`;
  const 고치는빌더 = `import fs from 'node:fs';fs.writeFileSync('deps/keep.txt','changed');${읽는빌더.slice("import fs from 'node:fs';".length)}`;
  // 크기와 고친 때를 지킨 채 내용만 바꾼다 — 사본의 내용 지문(바이트 해시)이 잡는다(GPT -c GD6). 원본의 고친 때를 정수 초로 맞춰 두면 사본도 같다.
  fs.utimesSync(path.join(원본, 'keep.txt'), 1_700_000_000, 1_700_000_000);
  const 몰래빌더 = `import fs from 'node:fs';fs.writeFileSync('deps/keep.txt','j');fs.utimesSync('deps/keep.txt',1700000000,1700000000);${읽는빌더.slice("import fs from 'node:fs';".length)}`;
  const 잇기 = x => ({ ...x, 잇기: [{ 경로: 'deps', 원본 }] });
  const 읽기만 = fixture(t, { 바탕파일: { 'tools/build.mjs': 읽는빌더 }, 명세고침: 잇기 });
  await api.준비하기(읽기만.options);
  // 잇기는 원본의 임시 사본에 잇는다(다시 검수 GA1): 새 파일을 쓰든 기존 파일을 고치든 원본 바이트는 그대로이고, 사본에 쓴 것은 잡아 멈춘다.
  for (const [이름, 빌더] of [['새 파일', 쓰는빌더], ['기존 파일 고침', 고치는빌더], ['같은 크기 · 같은 고친 때로 내용만 고침', 몰래빌더]]) {
    const f = fixture(t, { 바탕파일: { 'tools/build.mjs': 빌더 }, 명세고침: 잇기 });
    let 잡음 = null;
    await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /대본 · 빌더가 이은 폴더에 썼다: deps — 공용 원본은 임시 사본으로 이어 그대로지만/.test(e.message); }, 이름);
    t.after(() => 남은사본지우기(잡음));
    assert.equal(fs.existsSync(path.join(원본, '.cache')), false, `${이름}: 원본에는 쓰이지 않는다`);
    assert.equal(fs.readFileSync(path.join(원본, 'keep.txt'), 'utf8'), 'k', `${이름}: 원본의 기존 파일 바이트가 그대로다`);
  }
  // 원본 안의 링크는 사본에서도 원본 밖을 가리키므로 받지 않는다.
  const 밖 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-out-'));
  t.after(() => fs.rmSync(밖, { recursive: true, force: true, maxRetries: 5 }));
  fs.symlinkSync(밖, path.join(원본, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => { try { fs.unlinkSync(path.join(원본, 'linked')); } catch { /* 없음 */ } });
  const 링크원본 = fixture(t, { 바탕파일: { 'tools/build.mjs': 읽는빌더 }, 명세고침: 잇기 });
  await assert.rejects(api.준비하기(링크원본.options), /잇기 원본 안에 링크가 있다: [^\n]*linked/);
});

test('생성물 — 도구가 다루지 않는 꼴은 있으면 준비가 멈춘다: 되돌림 목록의 병합 커밋 · 링크인 잇기 원본 · UTF-8이 아닌 원천 · git과 대소문자가 다른 명세 경로 · .js 대본(설계 주인 11-21 · GPT -c GD1 · GD12 · GD13 · GD16 · GD17)', async t => {
  await t.test('되돌림 목록의 병합 커밋', async t => {
    const f = fixture(t);
    f.run('checkout', '-q', '-b', 'side', f.base);
    f.write(path.join(f.repo, 'side.txt'), `side${NL}`); f.run('add', '.'); f.run('commit', '-qm', 'side');
    f.run('checkout', '-q', 'main'); f.run('merge', '-q', '--no-ff', '-m', 'merge side', 'side');
    const 병합 = f.run('rev-parse', 'HEAD').trim(), 명세 = JSON.parse(fs.readFileSync(f.specFile, 'utf8'));
    f.write(f.specFile, JSON.stringify({ ...명세, 원천: 병합, 되돌림: { ...명세.되돌림, 목록: [병합] } }, null, 2));
    await assert.rejects(api.준비하기(f.options), /되돌림 목록에 병합 커밋이 있다: [0-9a-f]{10}\(부모 2\)/);
  });
  await t.test('링크인 잇기 원본 · 링크를 거치는 잇기 원본', async t => {
    const 원본 = fs.mkdtempSync(path.join(시험임시, 'deps-real-'));
    fs.mkdirSync(path.join(원본, 'sub'));
    fs.writeFileSync(path.join(원본, 'sub', 'keep.txt'), 'k');
    const 링크 = path.join(시험임시, `deps-link-${crypto.randomUUID().slice(0, 8)}`);
    fs.symlinkSync(원본, 링크, process.platform === 'win32' ? 'junction' : 'dir');
    t.after(() => { try { fs.unlinkSync(링크); } catch { /* 없음 */ } });
    for (const [이름, 곳] of [['링크', 링크], ['링크를 거침', path.join(링크, 'sub')]]) {
      const f = fixture(t, { 명세고침: x => ({ ...x, 잇기: [{ 경로: 'deps', 원본: 곳 }] }) });
      await assert.rejects(api.준비하기(f.options), /잇기 원본이 링크이거나 링크를 거친다/, 이름);
    }
    assert.equal(fs.readFileSync(path.join(원본, 'sub', 'keep.txt'), 'utf8'), 'k');
  });
  await t.test('UTF-8이 아닌 원천', async t => {
    const f = fixture(t, { 바란파일: { 'src/latin.txt': Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]) } });
    await assert.rejects(api.준비하기(f.options), /원천 차이: src\/latin\.txt이 UTF-8이 아니다/);
  });
  await t.test('git과 대소문자가 다른 명세 경로', async t => {
    const f = fixture(t, { 명세고침: x => ({ ...x, 꺼냄: ['SRC', 'tools'], 항목: x.항목.map(it => ({ ...it, 원천경로: ['SRC'] })) }) });
    await assert.rejects(api.준비하기(f.options), /명세 경로의 대소문자가 커밋 [0-9a-f]{10}의 git 경로와 다르다: SRC/);
  });
  await t.test('.js 대본', t => {
    const f = fixture(t, { 명세고침: (x, c) => { fs.copyFileSync(path.join(c.dir, 'spec', 'revert.cjs'), path.join(c.dir, 'spec', 'revert.js')); return { ...x, 되돌림: { ...x.되돌림, 대본: 'revert.js' } }; } });
    assert.throws(() => 생성물명세읽기(f.specFile), /대본은 \.cjs나 \.mjs다/);
  });
});

test('생성물 — 출력 경로의 위 마디를 링크로 이어 사본 밖 파일을 가리키면 재현으로 받지 않는다(GPT -c GD5 · GE19)', async t => {
  const 밖 = fs.mkdtempSync(path.join(시험임시, 'out-cache-'));
  fs.mkdirSync(path.join(밖, 'out'));
  fs.writeFileSync(path.join(밖, 'out', 'bundle.txt'), 몸);
  const 빌더 = `import fs from 'node:fs';fs.rmSync('.tmp',{recursive:true,force:true});fs.symlinkSync(${JSON.stringify(밖)},'.tmp',${JSON.stringify(process.platform === 'win32' ? 'junction' : 'dir')});${NL}`;
  const f = fixture(t, { 바란파일: { 'tools/build.mjs': 빌더 } });
  let 잡음 = null;
  await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /생성물 재현이 후보와 다르다 — site\/bundle\.txt: 후보 [0-9a-f]{12} · 재현 없음/.test(e.message); });
  t.after(() => { try { if (잡음?.사본) fs.unlinkSync(path.join(잡음.사본, '.tmp')); } catch { /* 없음 */ } 남은사본지우기(잡음); });
  assert.ok(fs.readFileSync(path.join(밖, 'out', 'bundle.txt')).equals(몸), '사본 밖 파일은 그대로다');
});

test('생성물 — 바탕 빌드가 이은 폴더에 쓰면 바탕 빌드 실패로 삼키지 않고 준비 전체가 멈춘다(다시 검수 GB3)', async t => {
  const 원본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-deps-'));
  t.after(() => fs.rmSync(원본, { recursive: true, force: true, maxRetries: 5 }));
  fs.writeFileSync(path.join(원본, 'keep.txt'), 'k');
  // 바탕 판의 빌더만 이은 폴더에 쓰고 0 아닌 종료로 끝난다 — 후보 빌드는 읽기만 한다.
  const 읽는빌더 = `import fs from 'node:fs';fs.readFileSync('deps/keep.txt');fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt','/*BUILT*/'+fs.readFileSync('src/msg.txt','utf8')+fs.readFileSync('src/other.txt','utf8'));${NL}`;
  const 바탕빌더 = `import fs from 'node:fs';fs.writeFileSync('deps/keep.txt','base wrote');process.exit(3);${NL}`;
  const f = fixture(t, { 바탕파일: { 'tools/build.mjs': 바탕빌더 }, 바란파일: { 'tools/build.mjs': 읽는빌더 }, 명세고침: x => ({ ...x, 잇기: [{ 경로: 'deps', 원본 }] }) });
  let 잡음 = null;
  await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /바탕 [0-9a-f]{10} 대본 · 빌더가 이은 폴더에 썼다: deps/.test(e.message); });
  t.after(() => 남은사본지우기(잡음));
  assert.equal(fs.readFileSync(path.join(원본, 'keep.txt'), 'utf8'), 'k', '원본은 그대로다');
});

test('생성물 — 검수 뒤 되돌림 대본이나 명세가 바뀌거나 사라지면 확인이 막고(검수를 다 마친 폴더도 통과가 거짓이 된다), 이 칸이 있는 검수는 다시를 받지 않는다(GPT 다시 검수 GA3)', async t => {
  const f = fixture(t);
  const { 폴더, 목록 } = await api.준비하기(f.options);
  await 카본보내기(폴더, 목록);
  const 확인 = () => api.검수확인(폴더, { 저장소: f.repo });
  표시만(확인(), (확인().사유 || []).join(' / '));
  const 대본 = path.join(f.spec, 'revert.cjs'), 원래 = fs.readFileSync(대본);
  const 막음 = () => { const r = 확인(); return r.통과 === false && r.사유.includes('검수 뒤 생성물 명세 · 대본 변경'); };
  assert.equal(막음(), false, '검수를 마친 직후에는 막지 않는다');
  fs.appendFileSync(대본, `// 고침${NL}`);
  assert.ok(막음(), '대본이 바뀌면 다 마친 검수도 통과가 거짓이다');
  fs.writeFileSync(대본, 원래);
  표시만(확인(), '대본을 되돌리면 다시 통과한다');
  fs.rmSync(f.specFile);
  assert.ok(막음(), '대본은 그대로이고 명세만 잃어도 막는다');
  await assert.rejects(api.다시하기({ 이름: 'gen-second', 폴더: path.join(f.dir, 'packet-2'), 앞: 폴더 }), /생성물 칸이 있는 검수는 다시를 받지 않는다/);
});

test('생성물 — 증명 칸은 쓸 때만 생기고(앞 증명의 해시는 그대로), 명세 꼴을 엄격히 본다', async t => {
  const 바탕 = { 정책: { 판: 1 }, 파일: [], 항목: ['A'] };
  assert.equal('생성물' in 입력증명(바탕), false);
  assert.equal(입력증명(바탕).검토입력해시, 입력증명({ ...바탕, 생성물: null }).검토입력해시);
  // 생성물 칸을 더하기 전 판(68f1022271의 tools/lib/검수증명.mjs)이 같은 입력으로 낸 해시 — 앞 증명의 봉인이 그대로인지 고정값으로 본다.
  assert.equal(입력증명(바탕).검토입력해시, '16ef9983c84948b9bb52e328e63b162010fce333b1f9098b5a0cf113be78e275');
  assert.equal(입력증명(바탕).표식, 'END_OF_FINAL_REVIEW_16ef9983c84948b9bb52e328e63b162010fce333b1f9098b5a0cf113be78e275');
  assert.notEqual(입력증명(바탕).검토입력해시, 입력증명({ ...바탕, 생성물: { 판: 1 } }).검토입력해시);
  for (const p of ['../x', 'a/../b', 'C:/x', '/abs', 'a//b', '', ' a']) assert.equal(상대경로인가(p), false, p);
  for (const p of ['src', 'experiences/synk-world-app/world-account.mjs', 'package.json']) assert.equal(상대경로인가(p), true, p);
  const 틀린명세 = [
    ['모르는 칸', x => ({ ...x, 덤: 1 })],
    ['꺼냄 밖 경로', x => ({ ...x, 꺼냄: ['../repo'] })],
    ['만든곳 밖 경로', x => ({ ...x, 항목: [{ ...x.항목[0], 만든곳: '../out.txt' }] })],
    ['까닭 없는 실패 허용', x => ({ ...x, 빌더: [{ 명령: ['tools/build.mjs'], 실패해도: true }] })],
    ['원천경로와 잇기가 겹침', x => ({ ...x, 잇기: ['src'] })],
    ['바탕이 커밋 꼴이 아님', x => ({ ...x, 항목: [{ ...x.항목[0], 바탕: 'HEAD~1' }] })],
    ['원천저장소가 상대 경로', x => ({ ...x, 원천저장소: 'repo' })],
  ];
  for (const [이름, 고침] of 틀린명세) {
    await t.test(이름, t => {
      const f = fixture(t, { 명세고침: 고침 });
      assert.throws(() => 생성물명세읽기(f.specFile), /생성물 명세/);
    });
  }
  await t.test('후보에 없는 항목', async t => {
    const f = fixture(t, { 명세고침: x => ({ ...x, 항목: [{ ...x.항목[0], 경로: 'site/other.txt' }] }) });
    await assert.rejects(api.준비하기(f.options), /생성물 항목이 배포 후보에 없다/);
  });
  await t.test('배포 후보 없이', async t => {
    const f = fixture(t);
    await assert.rejects(api.준비하기({ ...f.options, 배포후보: undefined }), /--생성물은 --배포후보와 함께 쓴다/);
  });
  await t.test('대조 칸 꼴', async t => {
    for (const 고침 of [x => ({ ...x, 항목: [{ ...x.항목[0], 대조: '바이트' }] }), x => ({ ...x, 항목: [{ ...x.항목[0], 짝커밋: [x.원천] }] }),
      x => ({ ...x, 항목: [{ ...x.항목[0], 대조: '문자열', 짝커밋: [x.원천] }] }), x => ({ ...x, 항목: [{ ...x.항목[0], 까닭: 'r.json' }] })]) {
      const f = fixture(t, { 명세고침: 고침 });
      assert.throws(() => 생성물명세읽기(f.specFile), /생성물 명세/);
    }
    const f = fixture(t, { 명세고침: x => ({ ...x, 항목: [{ ...x.항목[0], 대조: '모듈', 까닭: 'r.json' }] }) });
    f.write(path.join(f.spec, 'r.json'), JSON.stringify({ 글: {} }));
    assert.throws(() => 생성물명세읽기(f.specFile), /까닭 파일의 칸은 모듈이다/);
    f.write(path.join(f.spec, 'r.json'), JSON.stringify({ 모듈: { 'src/x.js': '' } }));
    assert.throws(() => 생성물명세읽기(f.specFile), /까닭 파일의 모듈은 \{ 경로: 까닭 글 \}이다/, '빈 까닭은 받지 않는다');
    // 문자열 까닭 무리의 꼴
    const g = fixture(t, { 명세고침: x => ({ ...x, 항목: [{ ...x.항목[0], 대조: '문자열', 까닭: 'r.json' }] }) });
    const 무리 = { 꼴: '옮겨감', 까닭: '옮겼다', 파일: ['src/msg.txt'] };
    for (const [j, 틀] of [[{ 무리: { a: { ...무리, 꼴: '모름' } } }, /무리 a의 꼴은/], [{ 무리: { a: { ...무리, 파일: ['../x'] } } }, /무리 a의 파일은/],
      [{ 무리: { a: { ...무리, 커밋: 'abcdef1' } } }, /커밋이 뺌 무리만 커밋/], [{ 무리: { a: { ...무리, 꼴: '커밋이 뺌' } } }, /커밋이 뺌 무리만 커밋/],
      [{ 무리: { a: 무리 }, 글: { x: 'b' } }, /없는 무리를 댔다/], [{ 무리: { a: { ...무리, 까닭: ' ' } } }, /까닭 글이 없다/]]) {
      g.write(path.join(g.spec, 'r.json'), JSON.stringify(j));
      assert.throws(() => 생성물명세읽기(g.specFile), 틀, JSON.stringify(j));
    }
  });
});

// ── 원천경로 밖 빌드 입력 · 빌더 입력 파일(Opus F3 · F6) ──────────────────────────────
const 기본빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt','/*BUILT*/'+fs.readFileSync('src/msg.txt','utf8')+fs.readFileSync('src/other.txt','utf8'));${NL}`;

test('생성물 — 원천경로 항목이 바탕 · 후보 원천 어디에도 없으면 멈추고, 꺼냄 밖 원천경로는 명세에서 받지 않는다(Opus F3)', async t => {
  const f = fixture(t, { 명세고침: x => ({ ...x, 항목: [{ ...x.항목[0], 원천경로: ['src', 'src/journeys.mjs?v=return-1'] }] }) });
  let 잡음 = null;
  await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /원천경로 항목이 바탕 · 후보 원천 어디에도 없다: src\/journeys\.mjs\?v=return-1/.test(e.message); });
  t.after(() => 남은사본지우기(잡음));
  const g = fixture(t, { 명세고침: x => ({ ...x, 항목: [{ ...x.항목[0], 원천경로: ['lib'] }] }) });
  assert.throws(() => 생성물명세읽기(g.specFile), /원천경로가 꺼냄 밖이다: lib/);
});

test('생성물 — 바탕 빌더만 부르던 파일(후보에서 사라진 가져오기)의 차이도 원천경로 밖 빌드 입력 차이에 싣는다(GPT -c GD15)', async t => {
  const 바탕빌더 = `import fs from 'node:fs';import { 붙임 } from './legacy.mjs';fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt',붙임(fs.readFileSync('src/msg.txt','utf8')+fs.readFileSync('src/other.txt','utf8')));${NL}`;
  const f = fixture(t, { 바탕파일: { 'tools/build.mjs': 바탕빌더, 'tools/legacy.mjs': `export const 붙임 = s => '/*BUILT*/' + s; // LEGACY${NL}` }, 바란파일: { 'tools/build.mjs': 기본빌더, 'tools/legacy.mjs': null } });
  const { 폴더, 목록 } = await api.준비하기(f.options);
  assert.equal(목록.증명.생성물.항목[0].바탕재현, true, '바탕 빌더는 legacy.mjs로 라이브를 그대로 짓는다');
  const 글 = 묶음글(폴더);
  assert.match(글, /--- a\/tools\/legacy\.mjs\n\+\+\+ \/dev\/null[\s\S]*LEGACY/, '후보에서 사라진 바탕 빌더 파일도 지운 차이로 보인다');
  assert.match(글, /\+\+\+ b\/tools\/build\.mjs/);
});

test('생성물 — 원천경로 밖 빌더가 바뀌어 출력이 달라지면 반사실 빌드가 잡아 바탕재현 false(본문 차이)로 돌리고, 빌더 차이를 원천 차이에 싣는다(Opus F3)', async t => {
  const 주입빌더 = 기본빌더.replace("fs.readFileSync('src/other.txt','utf8'))", "fs.readFileSync('src/other.txt','utf8')+'<script src=//x.example/INJECTED.js>')");
  assert.notEqual(주입빌더, 기본빌더);
  const 주입몸 = Buffer.from(`/*BUILT*/hello v2${NL}stable${NL}<script src=//x.example/INJECTED.js>`);
  const f = fixture(t, { 바란파일: { 'tools/build.mjs': 주입빌더 }, 후보몸: 주입몸 });
  const { 폴더, 목록 } = await api.준비하기(f.options);
  const [g] = 목록.증명.생성물.항목;
  assert.equal(g.바탕재현sha256, sha(바탕몸), '바탕은 라이브를 그대로 짓는다');
  assert.equal(g.바탕재현, false, '그래도 원천경로 밖 입력이 출력을 바꿔 원천 차이로 대신하지 않는다');
  assert.equal(g.바탕까닭꼴, '반사실 다름(원천경로 밖 입력)');
  assert.equal(g.입력반사실, '다름');
  const 글 = 묶음글(폴더);
  assert.match(글, /생성물이지만 바탕 재현 안 됨\(원천경로 밖 빌드 입력 1개가 출력을 바꾼다/);
  assert.match(글, /원천경로 밖 빌드 입력 차이 — 바탕 [0-9a-f]{10} → 후보 원천\(되돌림 · 준비 뒤\): 파일 1개/);
  assert.match(글, /바탕 판 입력으로는 sha256 [0-9a-f]{12}로 후보와 다르다/);
  assert.match(글, /\+\+\+ b\/tools\/build\.mjs[\s\S]*INJECTED/, '빌더 차이가 원천 차이 항목에 실린다');
  assert.match(fs.readFileSync(path.join(폴더, '생성물', '원천차이-1.patch'), 'utf8'), /- tools\/build\.mjs: [0-9a-f]{10} → [0-9a-f]{10}/, '증거 파일에 바뀐 경로가 다 있다');
  await t.test('되돌림 대본이 원천경로 밖 빌더를 고쳐도(git에는 그대로) 잡는다', async t => {
    const 되돌림2 = `const fs=require('fs'),p=require('path');const e=process.argv[2];fs.writeFileSync(p.join(e,'src/other.txt'),'stable'+String.fromCharCode(10));const b=p.join(e,'tools/build.mjs');fs.writeFileSync(b,fs.readFileSync(b,'utf8').replace("fs.readFileSync('src/other.txt','utf8'))","fs.readFileSync('src/other.txt','utf8')+'<script src=//x.example/INJECTED.js>')"));${NL}`;
    const g = fixture(t, { 후보몸: 주입몸, 명세고침: (x, c) => { fs.writeFileSync(path.join(c.dir, 'spec', 'revert2.cjs'), 되돌림2); return { ...x, 되돌림: { 대본: 'revert2.cjs', 목록: x.되돌림.목록 } }; } });
    const r = await api.준비하기(g.options);
    assert.equal(r.목록.증명.생성물.항목[0].바탕재현, false);
    assert.match(묶음글(r.폴더), /\+\+\+ b\/tools\/build\.mjs[\s\S]*INJECTED/);
  });
});

test('생성물 — 원천경로 밖 입력이 바뀌어도 출력이 같으면(반사실 빌드) 바탕재현은 그대로이고, 원천 차이 · 되돌림 목록에 그 파일들을 싣는다(Opus F3)', async t => {
  const f = fixture(t, { 바란파일: { 'tools/build.mjs': `${기본빌더}// 빌더 주석${NL}`, 'tools/notes.txt': `note${NL}` },
    명세고침: (x, c) => ({ ...x, 되돌림: { ...x.되돌림, 목록: [...x.되돌림.목록, c.wanted] } }) });
  const { 폴더, 목록 } = await api.준비하기(f.options);
  const [g] = 목록.증명.생성물.항목;
  assert.equal(g.바탕재현, true);
  assert.equal(g.바탕까닭꼴, '같음');
  assert.equal(g.입력반사실, '같음');
  const 글 = 묶음글(폴더);
  assert.match(글, /원천 차이 — 바탕 [0-9a-f]{10} → 후보 원천[^\n]*원천경로 밖 빌드 입력 2개/);
  assert.match(글, /다시 지어도 sha256이 후보와 같다\(반사실 빌드\) — 이 출력에는 영향이 없다/);
  assert.match(글, /폴더별 수: tools\/build\.mjs 1 · tools\/notes\.txt 1/);
  assert.match(글, /\+\/\/ 빌더 주석/, '빌더 차이를 싣는다');
  assert.match(글, /생성물 되돌림 목록 [0-9a-f]{10} — [^\n]*원천경로 밖 빌드 입력 2개/);
  assert.match(글, /- A\ttools\/notes\.txt|- A tools\/notes\.txt/, '되돌림 목록 커밋이 원천경로 밖에서 바꾼 파일');
  assert.match(fs.readFileSync(path.join(폴더, '생성물', '원천차이-1.patch'), 'utf8'), /- tools\/notes\.txt: 없음 → [0-9a-f]{10}/);
});

test('생성물 — 되돌림 목록 커밋이 원천경로 밖에서 바꾼 한글 이름 빌더 파일도 제 경로로 받아 그 차이를 싣는다(core.quotePath=true · GPT -e GD7)', async t => {
  const f = fixture(t, { 바란파일: { 'tools/build.mjs': `import './도움.mjs';${기본빌더}`, 'tools/도움.mjs': `export const 표 = 1;${NL}` },
    명세고침: (x, c) => ({ ...x, 되돌림: { ...x.되돌림, 목록: [...x.되돌림.목록, c.wanted] } }) });
  // git 기본값(core.quotePath=true)은 줄 출력에서 한글 경로를 따옴표 · 8진 탈출로 감싼다 — 도구가 저장소 설정에 기대지 않는지 본다.
  f.run('config', 'core.quotePath', 'true');
  const { 폴더 } = await api.준비하기(f.options);
  const 되돌림글 = fs.readFileSync(path.join(폴더, '생성물', `되돌림-${f.wanted.slice(0, 10)}.patch`), 'utf8');
  assert.match(되돌림글, /^- A tools\/도움\.mjs$/m, '원천경로 밖에서 바꾼 한글 이름 파일을 제 경로로 적는다');
  assert.match(되돌림글, /바꾼 파일 2개 · 빌더가 부르는 파일과 설정 파일 2개는 차이를 싣는다/);
  assert.match(되돌림글, /^\+export const 표 = 1;$/m, '빌더가 부르는 한글 이름 파일의 차이를 싣는다');
});

test('생성물 — 빌더 인자의 사본 밖 파일은 입력 칸에 적은 것만 받고(해시 · 글을 싣는다), 「..」 · 적지 않은 절대 경로는 거절하며, 짓는 동안 바뀌면 멈춘다(Opus F6)', async t => {
  const 설정빌더 = `import fs from 'node:fs';const c=fs.readFileSync(process.argv[process.argv.indexOf('--config')+1],'utf8');fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt','/*BUILT*/'+fs.readFileSync('src/msg.txt','utf8')+fs.readFileSync('src/other.txt','utf8')+c);${NL}`;
  const 설정 = d => path.join(d, 'account-config.json');
  const 고침 = (덧 = {}) => (x, c) => { fs.writeFileSync(설정(c.dir), `{"cfg":1}${NL}`); return { ...x, 입력: [설정(c.dir)], 빌더: [['tools/build.mjs', '--config', 설정(c.dir)]], ...덧 }; };
  const 몸들 = { 후보몸: Buffer.from(`/*BUILT*/hello v2${NL}stable${NL}{"cfg":1}${NL}`), 라이브: Buffer.from(`/*BUILT*/hello v1${NL}stable${NL}{"cfg":1}${NL}`) };
  const f = fixture(t, { 바탕파일: { 'tools/build.mjs': 설정빌더 }, 명세고침: 고침(), ...몸들 });
  const { 폴더, 목록 } = await api.준비하기(f.options);
  assert.deepEqual(목록.증명.생성물.대본.map(d => d.역할), ['되돌림', '입력']);
  assert.equal(목록.증명.생성물.대본[1].sha256, sha(fs.readFileSync(설정(f.dir))));
  assert.equal(목록.증명.생성물.항목[0].바탕재현, true);
  assert.match(묶음글(폴더), /생성물 빌더 입력 파일 account-config\.json — 빌더 인자가 가리키는 사본 밖 파일\(sha256 [0-9a-f]{64}\)\r?\n[^\n]*\{"cfg":1\}/);
  await 카본보내기(폴더, 목록);
  const 마침 = api.검수확인(폴더, { 저장소: f.repo });
  표시만(마침, (마침.사유 || []).join(' / '));
  fs.writeFileSync(설정(f.dir), `{"cfg":2}${NL}`);
  const 바뀐뒤 = api.검수확인(폴더, { 저장소: f.repo });
  assert.ok(표시뺀(바뀐뒤).length > 0, '다 마친 검수도 입력 파일이 바뀌면 통과가 거짓이다');
  assert.ok(바뀐뒤.사유.includes('검수 뒤 생성물 명세 · 대본 변경'), '검수 뒤 입력 파일이 바뀌면 막는다');
  for (const [이름, 명세고침, 틀] of [
    ['적지 않은 절대 경로', (x, c) => { fs.writeFileSync(설정(c.dir), '{}'); return { ...x, 빌더: [['tools/build.mjs', '--config', 설정(c.dir)]] }; }, /빌더 인자의 절대 경로는 명세의 입력 칸에 적은 파일만 받는다/],
    ['--out=절대 경로', x => ({ ...x, 빌더: [['tools/build.mjs', '--out=C:/Users/x/world']] }), /빌더 인자의 절대 경로는/],
    ['.. 마디', x => ({ ...x, 빌더: [['tools/build.mjs', '--out', '../world']] }), /빌더 인자에 \.\.를 쓰지 않는다/],
    ['짝빌더의 절대 경로', x => ({ ...x, 항목: [{ ...x.항목[0], 대조: '모듈', 짝빌더: [['tools/build.mjs', '/abs/x']] }] }), /짝빌더\(site\/bundle\.txt\) 인자의 절대 경로는/],
    ['입력이 상대 경로', x => ({ ...x, 입력: ['cfg.json'] }), /입력은 사본 밖 파일의 절대 경로 목록이다/]]) {
    await t.test(이름, t => { const g = fixture(t, { 명세고침 }); assert.throws(() => 생성물명세읽기(g.specFile), 틀); });
  }
  await t.test('짓는 동안 입력 파일을 고치면 멈추고, 원본은 그대로다', async t => {
    const 쓰는빌더 = 설정빌더.replace("const c=", "const p=process.argv[process.argv.indexOf('--config')+1];const c=").replace(`+c);${NL}`, `+c);fs.writeFileSync(p,'{}');${NL}`);
    assert.notEqual(쓰는빌더, 설정빌더);
    const g = fixture(t, { 바탕파일: { 'tools/build.mjs': 쓰는빌더 }, 명세고침: 고침(), ...몸들 });
    let 잡음 = null;
    const 앞바이트 = fs.readFileSync(설정(g.dir));
    await assert.rejects(api.준비하기(g.options), e => { 잡음 = e; return /대본 · 빌더가 입력 파일 사본에 썼다: [^\n]*account-config\.json/.test(e.message); });
    t.after(() => 남은사본지우기(잡음));
    assert.ok(fs.readFileSync(설정(g.dir)).equals(앞바이트), '빌더는 입력의 임시 사본에 썼고 사본 밖 원본은 그대로다(GPT -c GD2 · B3)');
  });
});

// ── 묶음 대조(설계 주인 11-21 답) ─────────────────────────────────────────────
// 합성 저장소: 바탕(a · b old) → 짝(b mid) → 바란 고침(b new · c 새 파일) → 아직 공개하지 않은 다른 일(a에 한 줄, 되돌림 대본이 걷는다).
// 빌더는 표지(`// <경로>`)를 단 묶음을 짓는다. 라이브는 손으로 만든 판이다 — a는 이름 꼬리만 다르고, b는 짝 커밋 판, d는 라이브에만 있다.
const 묶음빌더 = `import fs from 'node:fs';const L=String.fromCharCode(10);let o='/*HEAD*/'+L;for(const p of ['src/a.js','src/b.js','src/c.js'])if(fs.existsSync(p))o+='// '+p+L+fs.readFileSync(p,'utf8');o+='export {'+L+'  fa'+L+'};'+L;fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.js',o);${NL}`;
const A원 = `var x = 1;${NL}function fa() { return x; }${NL}`;
/** 합성 묶음 — 선언한 fa만 내보내고, 다 지은 글이 ES 모듈로 읽히는지 본다(실행할 수 없는 묶음을 대조 입력으로 쓰지 않는다 · GPT -c B4). */
const 묶음 = 모듈들 => {
  const 몸 = 모듈들.map(([p, g]) => `// ${p}${NL}${g}`).join('');
  const 글 = `/*HEAD*/${NL}${몸}${/function fa\b/.test(몸) ? `export {${NL}  fa${NL}};${NL}` : ''}`;
  acorn.parse(글, { ecmaVersion: 'latest', sourceType: 'module' });
  return Buffer.from(글);
};
const 후보묶음 = 묶음([['src/a.js', A원], ['src/b.js', `var y = "new";${NL}`], ['src/c.js', `var z = 3;${NL}`]]);
const 라이브묶음 = 묶음([['src/a.js', `var x2 = 1;${NL}function fa() { return x2; }${NL}`], ['src/b.js', `var y = "mid";${NL}`], ['src/d.js', `var w = 4;${NL}`]]);
function 대조저장소(t, { 빌더 = 묶음빌더, 커밋들, 후보, 라이브, 항목, 명세고침 = x => x, 되돌림글 = null }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-gen-test-')), repo = path.join(dir, 'repo');
  t.after(() => { assert.ok(path.basename(dir).startsWith('synk-review-gen-test-')); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); });
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(dir, 'none'), GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') && !['GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL'].includes(key)) delete env[key];
  const run = (...args) => execFileSync('git', ['-C', repo, '-c', 'core.autocrlf=false', ...args], { env, encoding: 'utf8', stdio: 'pipe' });
  const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  fs.mkdirSync(repo); run('init', '-q', '-b', 'main');
  write(path.join(repo, 'tools/build.mjs'), 빌더);
  const 커밋 = {};
  for (const c of 커밋들) { for (const [p, g] of Object.entries(c.파일)) write(path.join(repo, p), g); run('add', '.'); run('commit', '-qm', c.이름); 커밋[c.이름] = run('rev-parse', 'HEAD').trim(); }
  const top = 커밋[커밋들.at(-1).이름], spec = path.join(dir, 'spec'), candidate = path.join(dir, 'candidate'), 경로 = 'site/bundle.js';
  write(path.join(spec, 'revert.cjs'), 되돌림글 ?? `const fs=require('fs'),p=require('path');const e=process.argv[2];if(!fs.existsSync(p.join(e,'EXPORT_COMMIT')))throw new Error('no export');fs.writeFileSync(p.join(e,'src/a.js'),${JSON.stringify(A원)});${NL}`);
  write(path.join(candidate, 경로), 후보);
  write(path.join(candidate, `.앞판/${경로}`), 라이브);
  write(path.join(candidate, '후보.json'), JSON.stringify({ 판: 1, 종류: 'synk.im', 항목: [{ 경로, 종류: '바꿈', 모드: '100644', sha256: sha(후보) }], 앞판: { [경로]: 블롭번호(라이브) } }));
  const 명세 = 명세고침({ 판: 1, 원천: top, 꺼냄: ['src', 'tools'], 되돌림: { 대본: 'revert.cjs', 목록: [top] }, 빌더: [['tools/build.mjs']], 항목: [{ 경로, 만든곳: '.tmp/out/bundle.js', 바탕: 커밋.base, 원천경로: ['src'], ...항목(커밋) }] });
  const specFile = path.join(spec, 'spec.json');
  write(specFile, JSON.stringify(명세, null, 2));
  const options = { 이름: 'gen-compare', 폴더: path.join(dir, 'packet'), 저장소: repo, 바탕: top, 종류: '화면', 페이블생략: '합성 시험', 배포후보: candidate, 경로: [], 생성물: specFile };
  return { dir, repo, 커밋, spec, specFile, options, write };
}
const 모듈커밋 = [
  { 이름: 'base', 파일: { 'src/a.js': A원, 'src/b.js': `var y = "old";${NL}` } },
  { 이름: 'pair', 파일: { 'src/b.js': `var y = "mid";${NL}` } },
  { 이름: 'wanted', 파일: { 'src/b.js': `var y = "new";${NL}`, 'src/c.js': `var z = 3;${NL}` } },
  { 이름: 'other', 파일: { 'src/a.js': `${A원}var unpublished = 1;${NL}` } },
];
const 까닭쓰기 = (f, j) => f.write(path.join(f.spec, 'reasons.json'), JSON.stringify(j));

test('묶음 대조(모듈) — 같은 코드는 짝을 증명에 남기고, 바뀐 모듈은 라이브와 같은 코드를 짓는 커밋 → 후보 원천의 차이, 새 모듈은 묶음 안 글, 라이브에만은 까닭으로 싣는다. 대조 항목을 읽지 않은 검수는 미충족이다', async t => {
  const 준비 = async (t, 이름) => {
    const f = 대조저장소(t, { 커밋들: 모듈커밋, 후보: 후보묶음, 라이브: 라이브묶음, 항목: c => ({ 대조: '모듈', 짝커밋: [c.pair], 까닭: 'reasons.json' }) });
    까닭쓰기(f, { 모듈: { 'src/d.js': 'd는 바란 고침 전에 뺐다(합성 시험)' } });
    return { f, ...(await api.준비하기({ ...f.options, 이름 })) };
  };
  const { f, 폴더, 목록 } = await 준비(t, 'gen-compare-module');
  const [g] = 목록.증명.생성물.항목;
  assert.equal(g.바탕재현, false);
  assert.equal(g.대조.꼴, '모듈');
  assert.equal(g.대조.대신, '재현 안 됨 — 모듈 대조로 대신함');
  assert.deepEqual(g.대조.같은코드, [{ 경로: 'src/a.js', 짝: ['x2→x'] }]);
  assert.deepEqual(g.대조.원천차이, [{ 경로: 'src/b.js', 짝커밋: f.커밋.pair }]);
  assert.deepEqual(g.대조.후보에만, ['src/c.js']);
  assert.deepEqual(g.대조.라이브에만, [{ 경로: 'src/d.js', 까닭: 'd는 바란 고침 전에 뺐다(합성 시험)' }]);
  assert.equal(g.대조.같음, 2, '(머리) · (꼬리) 이음 조각은 바이트가 같다');
  assert.deepEqual(g.대조.항목들, ['G30', 'G30A', 'G30B'], '덧 항목은 큰 글자 — 쪼갠 조각의 작은 글자와 겹치지 않는다');
  const 글 = 묶음글(폴더);
  assert.match(글, /배포 후보 site\/bundle\.js .*— 생성물\(바탕 재현 안 됨 · 재현 안 됨 — 모듈 대조로 대신함: \[G30\] \[G30A\] \[G30B\]를 본다\)/);
  assert.match(글, /-var y = "mid";\r?\n\+var y = "new";/, '바뀐 모듈은 짝 커밋 → 후보 원천의 원천 차이');
  assert.match(글, /\+\+\+ b\/src\/c\.js\(묶음 안 모듈 글 · 정리함\)\r?\n\(출처: 후보 원천\(되돌린 뒤 · 준비 대본 전\)의 src\/c\.js · sha256 [0-9a-f]{12}[^\n]*\)\r?\nvar z = 3 ;/, '새 모듈은 묶음 안 글(원천은 출처 줄)');
  assert.match(글, /src\/d\.js · 라이브에만 · 까닭: d는 바란 고침 전에 뺐다/);
  const 대조파일 = fs.readdirSync(path.join(폴더, '생성물')).filter(n => /^대조-G30/.test(n));
  assert.ok(대조파일.some(n => /^대조-G30A-/.test(n)), '대조 자료가 증거 파일로 남는다');
  for (const n of 대조파일) assert.doesNotMatch(fs.readFileSync(path.join(폴더, '생성물', n), 'utf8'), /unpublished/, `되돌린 변경은 대조 자료에 없다: ${n}`);
  assert.match(fs.readFileSync(path.join(폴더, 'fable.md'), 'utf8'), /site\/bundle\.js\(모듈 대조\)/);
  await 카본보내기(폴더, 목록, id => /^G30A(?:[a-z]|z\d+)?-/.test(id));
  assert.ok(표시뺀(api.검수확인(폴더, { 저장소: f.repo })).length > 0, '원천 차이 항목을 읽지 않은 검수는 충족이 아니다');
  const 둘 = await 준비(t, 'gen-compare-module-read');
  await 카본보내기(둘.폴더, 둘.목록);
  const r = api.검수확인(둘.폴더, { 저장소: 둘.f.repo });
  표시만(r, (r.사유 || []).join(' / '));
  // 대조 항목이 묶음 목록에서 빠지면(검수자가 다 읽었어도) 처음 고리 판정이 따로 잡는다
  const 목록파일 = path.join(둘.폴더, '묶음.json'), 목록글 = JSON.parse(fs.readFileSync(목록파일, 'utf8'));
  for (const b of 목록글.묶음) b.항목 = b.항목.filter(id => !/^G30A(?:[a-z]|z\d+)?-/.test(id));
  fs.writeFileSync(목록파일, JSON.stringify(목록글, null, 1));
  const 빠짐 = api.검수확인(둘.폴더, { 저장소: 둘.f.repo });
  assert.ok(표시뺀(빠짐).length > 0);
  assert.ok(빠짐.사유.some(s => /site\/bundle\.js은 모듈 대조로 대신했는데 대조 항목\(G30A\)이 검수 묶음에 없다/.test(s)), 빠짐.사유.join(' / '));
});

test('묶음 대조(모듈) — 원천 파일이 같은데 묶음 안 모듈 글이 다르면(빌드 설정 차이) 정리한 모듈 글 차이를 싣는다(GPT GB9)', async t => {
  // 빌더가 tools/define.json의 값을 모듈에 넣는다 — src/b.js는 세 커밋에서 같고 설정만 1 → 2(짝) → 3(바란 고침)으로 바뀐다.
  const 정의빌더 = `import fs from 'node:fs';const L=String.fromCharCode(10);const d=JSON.parse(fs.readFileSync('tools/define.json','utf8'));let o='/*HEAD*/'+L;for(const p of ['src/a.js','src/b.js'])if(fs.existsSync(p))o+='// '+p+L+fs.readFileSync(p,'utf8').replace('__LIMIT__',String(d.limit));o+='export {'+L+'  fa'+L+'};'+L;fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.js',o);${NL}`;
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/a.js': A원, 'src/b.js': `var limit = __LIMIT__;${NL}`, 'tools/define.json': '{"limit":1}' } },
    { 이름: 'pair', 파일: { 'tools/define.json': '{"limit":2}' } }, { 이름: 'wanted', 파일: { 'tools/define.json': '{"limit":3}' } },
    { 이름: 'other', 파일: { 'src/a.js': `${A원}var unpublished = 1;${NL}` } }];
  const f = 대조저장소(t, { 빌더: 정의빌더, 커밋들, 후보: 묶음([['src/a.js', A원], ['src/b.js', `var limit = 3;${NL}`]]), 라이브: 묶음([['src/a.js', A원], ['src/b.js', `var limit = 2;${NL}`]]),
    항목: c => ({ 대조: '모듈', 짝커밋: [c.pair], 까닭: 'reasons.json' }) });
  까닭쓰기(f, { 모듈: {} });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-module-define' });
  assert.deepEqual(목록.증명.생성물.항목[0].대조.원천차이.map(x => x.경로), ['src/b.js']);
  const 글 = 묶음글(폴더);
  assert.match(글, /짝커밋과 후보 원천의 이 파일 바이트가 같은데 묶음 안 모듈 글은 다르다/);
  assert.match(글, /-var limit = 2 ;?\r?\n\+var limit = 3 ;?/);
  assert.doesNotMatch(글, /두 판의 바이트가 같다/, '원천이 같다는 말만 남기지 않는다');
});

test('묶음 대조(모듈) — 짝 판도 라이브와 묶음 전체로 견준다: 글이 같아도 이름이 다른 모듈의 함수를 가리키는 짝 판은 고르지 않는다(Opus F1)', async t => {
  // 빌더는 import 줄을 떼고 잇는다(묶음이 가져오기를 이름으로 푸는 꼴). 짝 판에서는 p · q가 이름을 맞바꿔 m의 foo가 q의 함수를 부른다.
  const 잇는빌더 = `import fs from 'node:fs';const L=String.fromCharCode(10);let o='/*HEAD*/'+L;for(const p of ['src/p.js','src/q.js','src/m.js'])if(fs.existsSync(p))o+='// '+p+L+fs.readFileSync(p,'utf8').split(L).filter(l=>!l.startsWith('import ')).join(L);fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.js',o);${NL}`;
  const P = n => `function ${n}() { return "P"; }${NL}`, Q = n => `function ${n}() { return "Q"; }${NL}`;
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/p.js': P('foo'), 'src/q.js': Q('foo2'), 'src/m.js': `import { foo } from './p.js';${NL}var v = foo();${NL}` } },
    { 이름: 'pair', 파일: { 'src/p.js': P('foo2'), 'src/q.js': Q('foo'), 'src/m.js': `import { foo } from './q.js';${NL}var v = foo();${NL}` } },
    { 이름: 'wanted', 파일: { 'src/m.js': `import { foo } from './q.js';${NL}var v = foo();${NL}var extra = 1;${NL}` } },
    { 이름: 'other', 파일: { 'src/a.js': `var unpublished = 1;${NL}` } }];
  const 라이브 = 묶음([['src/p.js', P('foo')], ['src/q.js', Q('foo2')], ['src/m.js', `var v = foo(); /* 손 판 */${NL}`]]);
  const 후보 = 묶음([['src/p.js', P('foo2')], ['src/q.js', Q('foo')], ['src/m.js', `var v = foo();${NL}var extra = 1;${NL}`]]);
  const f = 대조저장소(t, { 빌더: 잇는빌더, 커밋들, 후보, 라이브, 항목: c => ({ 대조: '모듈', 짝커밋: [c.pair] }) });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-pair-identity' });
  const [g] = 목록.증명.생성물.항목;
  assert.deepEqual(g.대조.원천차이, [{ 경로: 'src/m.js', 짝커밋: f.커밋.base }], 'm의 foo가 같은 함수(p)를 가리키는 바탕을 고른다');
  assert.deepEqual(g.대조.같은코드.map(x => x.경로), ['src/p.js', 'src/q.js']);
  const 글 = 묶음글(폴더);
  assert.match(글, /-import \{ foo \} from '\.\/p\.js';\r?\n\+import \{ foo \} from '\.\/q\.js';/, '부르는 함수가 바뀐 가져오기가 원천 차이에 실린다');
});

test('묶음 대조(모듈) — 짝 판과 후보의 빌드 입력(원천경로 밖)이 다르면 원천 차이와 함께 정리한 모듈 글 차이를 싣는다(Opus F4)', async t => {
  const 정의빌더 = `import fs from 'node:fs';const L=String.fromCharCode(10);const d=JSON.parse(fs.readFileSync('tools/define.json','utf8'));let o='/*HEAD*/'+L;for(const p of ['src/a.js','src/b.js'])if(fs.existsSync(p))o+='// '+p+L+fs.readFileSync(p,'utf8').replace('__LIMIT__',String(d.limit));o+='export {'+L+'  fa'+L+'};'+L;fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.js',o);${NL}`;
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/a.js': A원, 'src/b.js': `var limit = __LIMIT__;${NL}`, 'tools/define.json': '{"limit":1}' } },
    { 이름: 'pair', 파일: { 'tools/define.json': '{"limit":2}' } }, { 이름: 'wanted', 파일: { 'tools/define.json': '{"limit":1000}', 'src/b.js': `var limit = __LIMIT__;${NL}var note = "new";${NL}` } },
    { 이름: 'other', 파일: { 'src/a.js': `${A원}var unpublished = 1;${NL}` } }];
  const f = 대조저장소(t, { 빌더: 정의빌더, 커밋들, 후보: 묶음([['src/a.js', A원], ['src/b.js', `var limit = 1000;${NL}var note = "new";${NL}`]]), 라이브: 묶음([['src/a.js', A원], ['src/b.js', `var limit = 2;${NL}`]]),
    항목: c => ({ 대조: '모듈', 짝커밋: [c.pair] }) });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-module-inputs' });
  // 원천 차이 모듈은 빌드 입력이 같든 다르든 정리한 모듈 글 차이를 늘 싣는다(설계 검토 F1) — 증명에 따로 적지 않는다.
  assert.deepEqual(목록.증명.생성물.항목[0].대조.원천차이, [{ 경로: 'src/b.js', 짝커밋: f.커밋.pair }]);
  const 글 = 묶음글(폴더);
  assert.match(글, /\+var note = "new";/, '원천 차이');
  assert.match(글, /짝커밋 [0-9a-f]{10} → 후보 원천의 이 파일 차이와, 정리한 모듈 글 차이\(라이브 → 후보\)를 싣는다/);
  assert.match(글, /-var limit = 2 ;?\r?\n\+var limit = 1e3 ;?/, '정리한 모듈 글 차이에 설정에서 온 바뀜이 보인다(esbuild는 1000을 1e3으로 찍는다)');
  assert.match(글, /원천경로 밖 빌드 입력 차이 — 바탕 [0-9a-f]{10}[^\n]*파일 1개/, '모듈 대조만 쓰는 원천 차이도 빌드 입력 차이는 싣는다');
});

test('묶음 대조(모듈) — 원천경로 안 · 묶음 모듈이 아닌 빌드 입력(src/define.json)이 바뀌어도 정리한 모듈 글 차이와 그 파일의 원천 차이가 묶음에 실린다(설계 검토 F1)', async t => {
  // Opus F4 시험에서 define 파일 자리만 원천경로 src 안으로 옮겼다 — 원천경로 밖 입력 지도는 같다.
  const 정의빌더 = `import fs from 'node:fs';const L=String.fromCharCode(10);const d=JSON.parse(fs.readFileSync('src/define.json','utf8'));let o='/*HEAD*/'+L;for(const p of ['src/a.js','src/b.js'])if(fs.existsSync(p))o+='// '+p+L+fs.readFileSync(p,'utf8').replace('__LIMIT__',String(d.limit));o+='export {'+L+'  fa'+L+'};'+L;fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.js',o);${NL}`;
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/a.js': A원, 'src/b.js': `var limit = __LIMIT__;${NL}`, 'src/define.json': '{"limit":1}' } },
    { 이름: 'pair', 파일: { 'src/define.json': '{"limit":2}' } }, { 이름: 'wanted', 파일: { 'src/define.json': '{"limit":1000}', 'src/b.js': `var limit = __LIMIT__;${NL}var note = "new";${NL}` } },
    { 이름: 'other', 파일: { 'src/a.js': `${A원}var unpublished = 1;${NL}` } }];
  const f = 대조저장소(t, { 빌더: 정의빌더, 커밋들, 후보: 묶음([['src/a.js', A원], ['src/b.js', `var limit = 1000;${NL}var note = "new";${NL}`]]), 라이브: 묶음([['src/a.js', A원], ['src/b.js', `var limit = 2;${NL}`]]),
    항목: c => ({ 대조: '모듈', 짝커밋: [c.pair] }) });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-module-inside-input' });
  assert.deepEqual(목록.증명.생성물.항목[0].대조.원천차이, [{ 경로: 'src/b.js', 짝커밋: f.커밋.pair }]);
  const 글 = 묶음글(폴더);
  assert.match(글, /-var limit = 2 ;?\r?\n\+var limit = 1e3 ;?/, '정리한 모듈 글 차이에 define 값에서 온 바뀜이 보인다');
  assert.match(글, /원천경로 안 · 묶음 모듈이 아닌 파일 1개의 차이/, '모듈 대조만 쓰는 원천 차이(G1)도 묶음 모듈이 아닌 파일의 차이는 싣는다');
  assert.match(글, /바꿈 \$\.limit: 1 → 1000|"limit":1000/, 'src/define.json의 바뀜이 묶음에 있다');
});

test('묶음 대조(모듈) — 한도를 넘어 쪼갠 대조 항목은 조각이 다 실렸을 때 충족이다(GPT GB2: 쪼갠 조각 번호는 작은 글자를 붙인다)', async t => {
  // 작은 묶음 한도로 원천 차이 항목(G30A)을 쪼갠다 — 조각 번호는 G30Aa · G30Ab …이다.
  const 큰 = `${Array.from({ length: 900 }, (_, n) => `var line${n} = "${'값'.repeat(20)} ${n}";`).join(NL)}${NL}`;
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/a.js': A원, 'src/b.js': `var y = "old";${NL}` } }, { 이름: 'pair', 파일: { 'src/b.js': `var y = "mid";${NL}` } },
    { 이름: 'wanted', 파일: { 'src/b.js': 큰, 'src/c.js': `var z = 3;${NL}` } }, { 이름: 'other', 파일: { 'src/a.js': `${A원}var unpublished = 1;${NL}` } }];
  const 큰후보 = 묶음([['src/a.js', A원], ['src/b.js', 큰], ['src/c.js', `var z = 3;${NL}`]]);
  const f = 대조저장소(t, { 커밋들, 후보: 큰후보, 라이브: 라이브묶음, 항목: c => ({ 대조: '모듈', 짝커밋: [c.pair], 까닭: 'reasons.json' }) });
  까닭쓰기(f, { 모듈: { 'src/d.js': 'd는 바란 고침 전에 뺐다(합성 시험)' } });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-module-split', 크기: 30000 });
  const 번호 = 목록.묶음.flatMap(b => b.항목);
  assert.ok(번호.some(id => /^G30Aa-/.test(id)) && 번호.some(id => /^G30Ab-/.test(id)), `원천 차이 항목이 쪼개졌다: ${번호.join(' ')}`);
  await 카본보내기(폴더, 목록);
  const r = api.검수확인(폴더, { 저장소: f.repo });
  표시만(r, (r.사유 || []).join(' / '));
  // 조각 하나가 목록에서 빠지면 미충족이다
  const 목록파일 = path.join(폴더, '묶음.json'), 목록글 = JSON.parse(fs.readFileSync(목록파일, 'utf8'));
  for (const b of 목록글.묶음) b.항목 = b.항목.filter(id => !/^G30Ab-/.test(id));
  fs.writeFileSync(목록파일, JSON.stringify(목록글, null, 1));
  const 뺀뒤 = api.검수확인(폴더, { 저장소: f.repo });
  assert.ok(표시뺀(뺀뒤).length > 0, '다 마친 검수도 조각이 빠지면 통과가 거짓이다');
  assert.ok(뺀뒤.사유.some(s => /대조 항목\(G30A\)이 검수 묶음에 없다/.test(s)), 뺀뒤.사유.join(' / '));
});

test('묶음 대조(모듈) — 라이브에서 사라지는 모듈 · 라이브와 같은 코드를 짓는 커밋이 없는 모듈에 까닭이 없으면 준비가 멈추고, 까닭이 있으면 까닭과 정리한 글 차이를 싣는다', async t => {
  await t.test('라이브에만 모듈에 까닭 없음', async t => {
    const f = 대조저장소(t, { 커밋들: 모듈커밋, 후보: 후보묶음, 라이브: 라이브묶음, 항목: c => ({ 대조: '모듈', 짝커밋: [c.pair], 까닭: 'reasons.json' }) });
    까닭쓰기(f, { 모듈: {} });
    await assert.rejects(api.준비하기(f.options), /모듈 대조\(site\/bundle\.js\): 까닭이 없는 모듈 1개 — src\/d\.js\(라이브에만\)/);
  });
  await t.test('후보에만 모듈 — 준비 대본이 원천 파일을 바꿔 넣으면 준비 전 원천이 아니라 묶음에 실제로 든 코드를 싣는다(GPT 다시 검수 GC6)', async t => {
    // 준비 대본이 개발용 src/c.js(z = 3)를 운영용(z = 4)으로 바꾼 뒤 짓는다 — 후보 묶음에는 운영용이 든다.
    const 준비글 = `const fs=require('fs'),p=require('path');const e=process.argv[2];fs.writeFileSync(p.join(e,'src/c.js'),${JSON.stringify(`var z = 4;${NL}`)});${NL}`;
    const 운영후보 = 묶음([['src/a.js', A원], ['src/b.js', `var y = "new";${NL}`], ['src/c.js', `var z = 4;${NL}`]]);
    const f = 대조저장소(t, { 커밋들: 모듈커밋, 후보: 운영후보, 라이브: 라이브묶음, 항목: c => ({ 대조: '모듈', 짝커밋: [c.pair], 까닭: 'reasons.json' }), 명세고침: x => ({ ...x, 준비: ['prep.cjs'] }) });
    f.write(path.join(f.spec, 'prep.cjs'), 준비글);
    까닭쓰기(f, { 모듈: { 'src/d.js': '뺐다' } });
    const { 폴더 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-prep-new-module' });
    const 글 = 묶음글(폴더);
    assert.match(글, /\+\+\+ b\/src\/c\.js\(묶음 안 모듈 글 · 정리함\)\r?\n\(출처: [^\n]*준비 대본이 바꾼 파일이면 묶음에는 바뀐 판이 든다[^\n]*\)\r?\nvar z = 4 ;/, '실제로 나가는 운영용 코드');
    assert.doesNotMatch(글, /var z = 3/, '준비 전 개발용 원천을 나가는 코드로 싣지 않는다');
  });
  await t.test('짝빌더 — 짝커밋에서는 준비 대본 없이 짝빌더만 돌려 짝만든곳을 읽는다', async t => {
    const 가벼운 = 묶음빌더.replaceAll('.tmp/out', '.tmp/light');
    // 준비 대본은 짝커밋 판(b가 mid)에서 돌면 실패한다 — 짝빌더를 쓰면 짝커밋에서 돌지 않아야 한다
    const 준비글 = `const fs=require('fs'),p=require('path');const e=process.argv[2];if(fs.readFileSync(p.join(e,'src/b.js'),'utf8').includes('mid'))throw new Error('prep at pair');${NL}`;
    const f = 대조저장소(t, { 커밋들: [{ ...모듈커밋[0], 파일: { ...모듈커밋[0].파일, 'tools/light.mjs': 가벼운 } }, ...모듈커밋.slice(1)], 후보: 후보묶음, 라이브: 라이브묶음,
      항목: c => ({ 대조: '모듈', 짝커밋: [c.pair], 짝빌더: [['tools/light.mjs']], 짝만든곳: '.tmp/light/bundle.js', 까닭: 'reasons.json' }), 명세고침: x => ({ ...x, 준비: ['prep.cjs'] }) });
    f.write(path.join(f.spec, 'prep.cjs'), 준비글);
    까닭쓰기(f, { 모듈: { 'src/d.js': '뺐다' } });
    const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-pairbuilder' });
    // 짝빌더로 지은 판도 원천 차이와 함께 정리한 모듈 글 차이를 싣는다(Opus F4 · 설계 검토 F1 — 원천 차이 모듈은 늘 싣는다)
    assert.deepEqual(목록.증명.생성물.항목[0].대조.원천차이, [{ 경로: 'src/b.js', 짝커밋: f.커밋.pair }]);
    assert.match(묶음글(폴더), /-var y = "mid" ;\r?\n\+var y = "new" ;/, '정리한 모듈 글 차이');
    const 틀림 = 대조저장소(t, { 커밋들: 모듈커밋, 후보: 후보묶음, 라이브: 라이브묶음, 항목: () => ({ 대조: '문자열', 짝빌더: [['tools/build.mjs']] }) });
    assert.throws(() => 생성물명세읽기(틀림.specFile), /짝빌더 · 짝만든곳은 모듈 대조 항목에만 쓴다/);
  });
  await t.test('짝 커밋이 없어 설명으로 넘김', async t => {
    const f = 대조저장소(t, { 커밋들: 모듈커밋, 후보: 후보묶음, 라이브: 라이브묶음, 항목: () => ({ 대조: '모듈', 까닭: 'reasons.json' }) });
    까닭쓰기(f, { 모듈: { 'src/d.js': '뺐다' } });
    await assert.rejects(api.준비하기(f.options), /까닭이 없는 모듈 1개 — src\/b\.js\(바뀜 · 라이브와 같은 코드를 짓는 커밋이 없다/);
    까닭쓰기(f, { 모듈: { 'src/d.js': '뺐다', 'src/b.js': 'mid 판은 다른 공개가 얹었다(합성 시험)' } });
    const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-explained' });
    const [g] = 목록.증명.생성물.항목;
    assert.deepEqual(g.대조.설명, [{ 경로: 'src/b.js', 까닭: 'mid 판은 다른 공개가 얹었다(합성 시험)' }]);
    const 글 = 묶음글(폴더);
    assert.match(글, /생성물 설명으로 넘기는 모듈 — site\/bundle\.js: 1개/);
    assert.match(글, /-var y = "mid" ;\r?\n\+var y = "new" ;/, '정리한 모듈 글 차이');
  });
});

test('같은 코드 — 이름은 esbuild 숫자 꼬리만 다르고 짝이 일대일일 때만 같다(짝이 일대일이 아니면 · 속성 이름 · 글자가 바뀌면 다르다)', () => {
  assert.equal(같은코드('var x2=1;function f(){return x2+y}', 'var x=1;function f(){return x+y}').같음, true);
  assert.deepEqual(같은코드('var x2=1;f(x2)', 'var x=1;f(x)').짝, ['x2→x']);
  assert.equal(같은코드('f(a,a2)', 'f(a,a)').같음, false, '짝이 일대일이 아님 — 앞의 두 이름이 뒤의 한 이름으로 간다');
  assert.equal(같은코드('f(a2,a)', 'f(a,a)').같음, false, '짝이 일대일이 아님 — 차례가 바뀌어도');
  // 전역 이름 규칙이 아니라 묶인 이름의 일대일로 막는 경우 — 두 지역 묶임(a · a2)이 한 묶임(a)으로 합쳐지면 값이 3에서 4로 바뀐다
  assert.equal(같은코드('function f(){var a=1,a2=2;return a+a2}', 'function f(){var a=1,a=2;return a+a}').같음, false, '두 지역 묶임이 하나로 합쳐짐');
  assert.equal(같은코드('function f(){var a=1,a=2;return a+a}', 'function f(){var a=1,a2=2;return a+a2}').같음, false, '한 지역 묶임이 둘로 갈라짐');
  assert.equal(같은코드('function f(){var a=1,a2=2;return a+a2}', 'function f(){var a=1,a3=2;return a+a3}').같음, true, '일대일로 바뀐 지역 이름은 같은 코드');
  assert.equal(같은코드('f(a,b)', 'f(a,c)').같음, false, '꼬리가 아닌 이름 바뀜');
  assert.equal(같은코드('o.alpha2=1', 'o.alpha=1').같음, false, '점 뒤 속성 이름은 그대로');
  assert.equal(같은코드('var o={alpha2:1}', 'var o={alpha:1}').같음, false, '객체 열쇠는 그대로');
  assert.equal(같은코드('var s="a"', 'var s="b"').같음, false, '글자는 그대로');
  assert.equal(같은코드('function g({clock=()=>1}){return clock()}', 'function g({clock:clock2=()=>1}){return clock2()}').같음, true, '줄여 쓴 기본값 ↔ 풀어 쓴 속성');
  assert.equal(같은코드('var q2={id:1};f(`${q2.id}`)', 'var q={id:1};f(`${q.id}`)').같음, true, '틀 글자 속 이름');
  assert.equal(같은코드('var exact=1;var o={get exact(){return exact},run(){return exact}}', 'var exact2=1;var o={get exact(){return exact2},run(){return exact2}}').같음, true, '게터 · 메서드 이름은 열쇠');
  assert.equal(같은코드('var o={get exact(){return 1}}', 'var o={get exact2(){return 1}}').같음, false, '게터 이름은 글자 그대로');
  assert.equal(같은코드('class A{run(){return 1}stop(){return 2}}', 'class A{run(){return 1}stop2(){return 2}}').같음, false, '클래스 메서드 이름은 글자 그대로');
  assert.equal(같은코드('f(a,g2(1));function g2(x){return x}', 'f(a,g(1));function g(x){return x}').같음, true, '인자 속 부르기는 이름 짝');
  const 따옴표정규식 = 'var r=/["' + String.fromCharCode(39) + ']/g;';
  assert.equal(같은코드(`${따옴표정규식}var t2=1;`, `${따옴표정규식}var t=1;`).같음, true, '정규식 속 따옴표');
  // GPT GB7: 여러 글자 연산자는 한 낱말이다 — 「x + ++y」(4)와 「x++ + y」(3)는 다르다. 자동 쌍반점이 걸리는 줄바꿈도 낱말로 남는다.
  assert.deepEqual(낱말나누기('x + ++y'), ['x', '+', '++', 'y']);
  assert.deepEqual(낱말나누기('x++ + y'), ['x', '++', '+', 'y']);
  assert.equal(같은코드('var x=1,y=2;f(x + ++y);', 'var x=1,y=2;f(x++ + y);').같음, false);
  assert.deepEqual(낱말나누기(`return${NL}x`), ['return', '⏎', 'x'], 'return 뒤 줄바꿈은 undefined를 돌려준다');
  assert.deepEqual(낱말나누기(`a${NL}++b`), ['a', '⏎', '++', 'b'], '줄바꿈 뒤 ++는 앞 문장을 끝낸다');
  assert.deepEqual(낱말나누기(`a = b${NL}c = d`), ['a', '=', 'b', 'c', '=', 'd'], '뜻이 그대로인 줄바꿈은 남기지 않는다');
  assert.equal(같은코드('var a2;a2?.b.c', 'var a;a?.b.c').같음, true, '「?.」 뒤 이름도 속성이다 — 앞 이름만 짝');
  assert.equal(같은코드('a?.b2', 'a?.b').같음, false, '「?.」 뒤 속성 이름은 그대로');
  // GPT GB6: 줄여 쓴 속성의 이름은 열쇠다 — {count} ↔ {count2}는 공개 열쇠가 바뀐 것이다.
  assert.equal(같은코드('const count=1;globalThis.state={count};', 'const count2=1;globalThis.state={count2};').같음, false);
  assert.equal(같은코드('const count=1;globalThis.state={count};', 'const count2=1;globalThis.state={count:count2};').같음, true, '열쇠를 남기고 값 이름만 바꾼 것은 같다');
  assert.equal(같은코드('var a2,b2;f(a2,b2,c);var x=[a2,b2,c];', 'var a,b;f(a,b,c);var x=[a,b,c];').같음, true, '인자 · 배열의 쉼표 사이 이름은 줄여 쓴 속성이 아니다');
});

test('같은 코드 — acorn 구문 나무로 견준다: 묶인 이름만 일대일로 바뀌고 전역 이름 · 속성 이름 · 열쇠 · 상수는 그대로다(설계 검토 D2 · GPT 다시 검수 GB8~GB10)', () => {
  const 같다 = (a, b, 뜻, 바깥) => assert.equal(같은코드(a, b, 바깥).같음, true, 뜻), 다르다 = (a, b, 뜻, 바깥) => assert.equal(같은코드(a, b, 바깥).같음, false, 뜻);
  // GB8: 기본값이 있는 줄인 구조 분해의 이름은 읽는 열쇠이기도 하다
  다르다('function read({limit=5}){return limit}', 'function read({limit2=5}){return limit2}', 'GB8 {limit=5} ↔ {limit2=5}는 읽는 속성이 바뀐 것');
  같다('function read({limit=5}){return limit}', 'function read({limit:limit2=5}){return limit2}', '열쇠를 남기고 값 이름만 바꿈');
  // GB9: 조각 밖 이름은 묶음 맨 위 선언이 있을 때만 짝을 받는다(묶음 전체 확인으로 넘긴다). 전역 이름은 그대로여야 한다.
  다르다('var r=readLimit();', 'var r=readLimit2();', 'GB9 묶음 밖(전역) 함수 이름이 바뀜');
  같다('var r=readLimit();', 'var r=readLimit2();', '묶음 맨 위 이름의 짝', { 바깥A: new Set(['readLimit']), 바깥B: new Set(['readLimit2']) });
  다르다('var r=readLimit();', 'var r=readLimit2();', '한쪽만 묶음 맨 위 이름', { 바깥A: new Set(['readLimit']), 바깥B: new Set() });
  // GB10: 이름의 유니코드 탈출 글자는 풀어서 본다
  다르다('var v=item.\\u0062;', 'var v=item.\\u0063;', 'GB10 item.b ↔ item.c');
  같다('var v=item.\\u0062;', 'var v=item.b;', '탈출만 다른 같은 속성');
  // 범위: 안쪽 선언과 같은 이름의 바깥 쓰임은 전역이다 · 인자와 몸의 var는 한 묶임 · 인자 기본값은 몸의 var를 보지 않는다
  다르다('function f(){var x;}x;', 'function f(){var x2;}x2;', '안쪽 var와 같은 이름의 전역');
  다르다('function f(x){var x;return x}', 'function f(x2){var x;return x}', '인자와 몸 var는 한 묶임');
  같다('function f(x){var x;return x}', 'function f(x2){var x2;return x2}');
  다르다('var x;function f(a=x){var x;return a}', 'var x2;function f(a=x){var x;return a}', '인자 기본값의 x는 바깥 x다');
  같다('{let y=1;f(y)}y;', '{let y2=1;f(y2)}y;', '블록 let 짝 · 블록 밖 y는 전역 그대로');
  같다('try{}catch(e){f(e)}', 'try{}catch(e2){f(e2)}', 'catch 인자');
  다르다('label:for(;;){break label}', 'label2:for(;;){break label2}', '꼬리표는 그대로');
  다르다('function f(){return eval("x")}var x;', 'function f(){return eval("x")}var x2;', '직접 eval이 있으면 이름을 바꾸지 않는다');
  다르다('import {a} from "m";f(a)', 'import {a2} from "m";f(a2)', '가져오는 바깥 이름');
  같다('import {a as b} from "m";f(b)', 'import {a as b2} from "m";f(b2)', '가져온 안쪽 이름');
  다르다('var x;export {x}', 'var x2;export {x2}', '내보내는 바깥 이름');
  같다('var x;export {x as y}', 'var x2;export {x2 as y}', '내보내는 안쪽 이름');
  // 상수는 값으로 본다. 꾸밈 없는 틀 글자는 값(cooked)으로, 태그 붙은 틀 글자는 raw도 본다.
  같다('f(0x10,1e3,"a")', "f(16,1000,'a')");
  같다('f(`「${a}」`)', 'f(`\\u300C${a}\\u300D`)', '꾸밈 없는 틀 글자의 탈출 글자(실제 생활 묶음 atlas/vellum.js의 꼴)');
  다르다('tag`「${a}」`', 'tag`\\u300C${a}\\u300D`', '태그 붙은 틀 글자는 raw가 같아야 한다');
  다르다('var o={f(){}}', 'var o={f:function(){}}', '메서드와 함수 값은 다르다');
  // 읽지 못한 조각은 같은 코드가 아니다(바이트가 같아도) — 낱말 근사로 받지 않는다
  const r = 같은코드('}var x2=1;', '}var x=1;');
  assert.equal(r.같음, false);
  assert.match(r.왜, /ES 모듈로 읽지 못했다/);
  assert.equal(같은코드('}var x=1;', '}var x=1;').같음, false, '읽지 못하면 글이 같아도 이음을 확인하지 못한다');
  assert.match(같은코드('var x=1;', 'var x=1;').정리, /^acorn \d+\.\d+\.\d+$/);
});

test('묶음 대조 — 맨 위 이름이 두 묶음에서 다른 모듈의 선언을 가리키면 같은 코드가 아니다(글이 같아도). 두 묶음에 다 있는 모듈의 차례가 바뀌면 옮겨진 모듈을 적는다(GPT GB6 · GB8)', () => {
  const X = `function getLimit() { return 1; }${NL}`, M = `var v = getLimit();${NL}`;
  // getLimit2 → 다른 모듈(src/y.js)의 다른 함수
  let r = 묶음대조(묶음([['src/x.js', X], ['src/m.js', M]]), 묶음([['src/x.js', X], ['src/y.js', `function getLimit2() { return 2; }${NL}`], ['src/m.js', `var v = getLimit2();${NL}`]]));
  let m = r.경로.find(x => x.경로 === 'src/m.js');
  assert.equal(m.꼴, '바뀜');
  assert.match(m.어긋남, /이름 getLimit → getLimit2이 가리키는 맨 위 선언의 모듈이 다르다\(라이브 src\/x\.js · 후보 src\/y\.js\)/);
  // 글이 같은 모듈도 — x.js의 함수가 getLimit2로 비키고 새 y.js가 getLimit를 가져가면 m.js는 다른 함수를 부른다
  r = 묶음대조(묶음([['src/x.js', X], ['src/m.js', M]]), 묶음([['src/x.js', `function getLimit2() { return 1; }${NL}`], ['src/y.js', `function getLimit() { return 2; }${NL}`], ['src/m.js', M]]));
  assert.equal(r.경로.find(x => x.경로 === 'src/x.js').꼴, '같은 코드', '제 모듈 안의 이름 바뀜은 같은 코드');
  m = r.경로.find(x => x.경로 === 'src/m.js');
  assert.equal(m.꼴, '바뀜');
  assert.equal(m.참조, true);
  assert.match(m.어긋남, /이름 getLimit이 가리키는 맨 위 선언의 모듈이 다르다\(라이브 src\/x\.js · 후보 src\/y\.js\)/);
  // 같은 모듈 안 선언을 가리키는 이름 바뀜은 그대로 같은 코드
  r = 묶음대조(묶음([['src/x.js', X], ['src/m.js', M]]), 묶음([['src/x.js', `function getLimit2() { return 1; }${NL}`], ['src/m.js', `var v = getLimit2();${NL}`]]));
  assert.deepEqual(r.경로.map(x => [x.경로, x.꼴]), [['(머리)', '같음'], ['src/x.js', '같은 코드'], ['src/m.js', '같은 코드']], '내보내는 꼬리가 없는 묶음 — 두 모듈이 다 있고 각각 같은 코드다');
  // 차례
  const a = ['src/a.js', `var a = 1;${NL}`], b = ['src/b.js', `globalThis.mode = "b";${NL}`], c = ['src/c.js', `globalThis.mode = "c";${NL}`];
  r = 묶음대조(묶음([a, b, c]), 묶음([a, c, b]));
  assert.ok(r.경로.filter(x => /^src\//.test(x.경로)).every(x => x.꼴 === '같음'), '몸은 다 같다');
  assert.equal(r.차례.옮김.length, 1);
  assert.ok(['src/b.js#1', 'src/c.js#1'].includes(r.차례.옮김[0]), '차례 이름은 「경로#몇 번째」다');
  assert.deepEqual(묶음대조(묶음([a, b, c]), 묶음([a, b, c])).차례.옮김, []);
  // GPT 다시 검수 GB7: 같은 경로의 판(?v=) 사이에 낀 모듈이 옮겨 가도 잡는다 — 차례는 「경로#몇 번째」로 견준다(?v=는 뗀다 · GPT -c GE2)
  const v1 = ['src/init.js?v=1', `globalThis.mode = "1";${NL}`], v2 = ['src/init.js?v=2', `globalThis.mode = "2";${NL}`], o = ['src/other.js', `globalThis.mode = "o";${NL}`];
  r = 묶음대조(묶음([v1, o, v2]), 묶음([v1, v2, o]));
  assert.ok(r.경로.filter(x => /^src\//.test(x.경로)).every(x => x.꼴 === '같음'), '경로별 몸은 같다');
  assert.equal(r.차례.옮김.length, 1, '조각 차례가 바뀌었다');
  assert.ok(['src/other.js#1', 'src/init.js#2'].includes(r.차례.옮김[0]));
  // GPT -c GE2: ?v=가 바뀐 판이 자리를 옮기면(a.js?v=one → b.js 를 b.js → a.js?v=two로) 차례 대조에서 빠지지 않는다
  const 판1 = ['src/a.js?v=one', `globalThis.k = "a";${NL}`], 판2 = ['src/a.js?v=two', `globalThis.k = "a";${NL}`], 비 = ['src/b.js', `globalThis.k = "b";${NL}`];
  r = 묶음대조(묶음([판1, 비]), 묶음([비, 판2]));
  assert.equal(r.경로.find(x => x.경로 === 'src/a.js').꼴, '같은 코드', '표지 줄의 ?v=만 다르다');
  assert.deepEqual(r.차례.옮김, ['src/a.js#1'], '마지막에 저장되는 값이 바뀌는 차례 변경을 잡는다');
  // GPT -c GE1: 같은 경로 조각 사이로 문장을 옮기면(다른 모듈을 사이에 두고) 이어 붙인 글은 같아도 조각마다 견줘 바뀜이다
  const 앞조각 = (몸1, 몸2) => 묶음([['src/a.js', 몸1], ['src/b.js', `globalThis.v = 2;${NL}`], ['src/a.js', 몸2]]);
  r = 묶음대조(앞조각(`var x = 1;${NL}console.log(globalThis.v);${NL}`, `var y = 2;${NL}`), 앞조각(`var x = 1;${NL}`, `console.log(globalThis.v);${NL}var y = 2;${NL}`));
  const 옮긴 = r.경로.find(x => x.경로 === 'src/a.js');
  assert.equal(옮긴.꼴, '바뀜', '조각 사이로 옮긴 문장(실행 결과 undefined → 2)');
  assert.match(옮긴.어긋남, /번째 조각/);
  assert.equal(묶음대조(앞조각(`var x = 1;${NL}`, `var y = 2;${NL}`), 묶음([['src/a.js', `var x = 1;${NL}var y = 2;${NL}`], ['src/b.js', `globalThis.v = 2;${NL}`]])).경로.find(x => x.경로 === 'src/a.js').꼴, '바뀜', '조각 수가 다르면 바뀜');
  // 앞 조각이 같아도 후보에 같은 경로 조각이 하나 더 붙으면 바뀜이다 — 조각마다 견줄 때 짝 없는 조각을 건너뛰지 않는다(GPT -c GE1)
  assert.equal(묶음대조(묶음([['src/a.js', `var x = 1;${NL}`], ['src/b.js', `globalThis.v = 2;${NL}`]]), 앞조각(`var x = 1;${NL}`, `var y = 2;${NL}`)).경로.find(x => x.경로 === 'src/a.js').꼴, '바뀜', '후보에만 있는 둘째 조각');
  // 묶음 전체를 ES 모듈로 읽지 못하면 모듈 대조는 서지 않는다
  assert.equal(묶음대조(Buffer.from(`/*HEAD*/${NL}// src/a.js${NL}var x = ;${NL}`), 후보묶음), null);
  // 모듈이 스스로 묶는 이름(안쪽 함수 · 여러 선언 · 화살표 매개변수)은 다른 모듈의 맨 위 선언과 견주지 않는다 — 실제 (2-2) 생활 묶음의 strata · atlas 모듈 꼴
  // (묶음의 맨 위 이름은 묶음 전체에서 하나다 — 안쪽 이름이 다른 모듈의 맨 위 이름과 글자가 같을 수 있다)
  const 위 = ['src/x.js', `function copy(a) { return a; }${NL}var rows = [];${NL}`];
  const 안 = (c, r, o) => [`src/m.js`, `var m = (() => {${NL}  function ${c}(b) { return b + 1; }${NL}  return ${c}(1);${NL}})();${NL}{${NL}  const a1=1,${r}=new Map;${r}.set(a1,1);${NL}}${NL}[1].map((${o})=>${o}+1);${NL}`];
  r = 묶음대조(묶음([위, 안('copy', 'rows', 'order')]), 묶음([위, 안('copy3', 'rows2', 'order2')]));
  assert.equal(r.경로.find(x => x.경로 === 'src/m.js').꼴, '같은 코드', '안쪽 선언의 이름 바뀜은 같은 코드');
});

test('같은 코드 · 묶음 대조 — esbuild 이름 짝은 같은 원래 이름에 붙인 수뿐이고, 맨 위 이름의 짝은 묶음 전체에서 일대일이다(Opus F2)', () => {
  for (const [x, y, 짝] of [['getLimit', 'getLimit2', true], ['getLimit2', 'getLimit3', true], ['foo10', 'foo2', true], ['sha1', 'sha12', true], ['a', 'a', true],
    ['sha1', 'sha256', false], ['step1', 'step2', false], ['a01', 'a', false], ['a', 'a1', false], ['ab', 'ac2', false]]) assert.equal(이름짝인가(x, y), 짝, `${x} ↔ ${y}`);
  assert.equal(같은코드('var h=sha256(d);', 'var h=sha1(d);').같음, false, '끝 숫자만 다른 다른 함수');
  // 한 모듈이 두 이름을 다 선언할 때 부르는 쪽이 다른 이름으로 바뀌면(hash2 → hash3) — 선언한 모듈의 짝(hash2 → hash2)과 어긋난다
  const C = ['src/crypto.js', `function hash2(d) { return 1; }${NL}function hash3(d) { return 2; }${NL}`];
  let r = 묶음대조(묶음([C, ['src/m.js', `var h = hash2(d);${NL}`]]), 묶음([C, ['src/m.js', `var h = hash3(d);${NL}`]]));
  let m = r.경로.find(x => x.경로 === 'src/m.js');
  assert.equal(m.꼴, '바뀜');
  assert.equal(m.참조, true);
  assert.match(m.어긋남, /맨 위 이름의 짝이 묶음 전체에서 일대일이 아니다 — 라이브 이름 hash2가 후보의 여러 이름으로 간다/);
  assert.equal(r.경로.find(x => x.경로 === 'src/crypto.js').꼴, '바뀜', '선언한 모듈도 까닭 · 원천 차이를 받는다');
  // 선언한 모듈 안에서 두 이름을 맞바꾸면 — 부르는 쪽은 글이 같아도 다른 몸을 부른다
  r = 묶음대조(묶음([C, ['src/m.js', `var h = hash2(d);${NL}`]]), 묶음([['src/crypto.js', `function hash3(d) { return 1; }${NL}function hash2(d) { return 2; }${NL}`], ['src/m.js', `var h = hash2(d);${NL}`]]));
  assert.deepEqual(['src/crypto.js', 'src/m.js'].map(p => r.경로.find(x => x.경로 === p).꼴), ['바뀜', '바뀜']);
  // esbuild가 겹친 이름을 다시 지은 꼴(새 모듈이 getLimit를 가져가 p → getLimit2, q → getLimit3)은 그대로 같은 코드
  const 라이브 = 묶음([['src/p.js', `function getLimit() { return 1; }${NL}`], ['src/q.js', `function getLimit2() { return 2; }${NL}`], ['src/c.js', `var c = getLimit();${NL}`], ['src/d.js', `var d = getLimit2();${NL}`]]);
  const 후보 = 묶음([['src/r.js', `function getLimit() { return 9; }${NL}`], ['src/p.js', `function getLimit2() { return 1; }${NL}`], ['src/q.js', `function getLimit3() { return 2; }${NL}`], ['src/c.js', `var c = getLimit2();${NL}`], ['src/d.js', `var d = getLimit3();${NL}`]]);
  r = 묶음대조(라이브, 후보);
  assert.deepEqual(['src/p.js', 'src/q.js', 'src/c.js', 'src/d.js'].map(p => r.경로.find(x => x.경로 === p).꼴), ['같은 코드', '같은 코드', '같은 코드', '같은 코드']);
  // 내보내는 바깥 이름(export { getLimit2 as getLimit }의 getLimit)은 열쇠다 — 맨 위 이름 getLimit의 짝으로 세지 않는다
  const 꼬리 = (본, n) => Buffer.from(`${본.toString('utf8').replace(/export \{\n {2}fa\n\};\n$/, '')}export {${NL}  ${n} as getLimit${NL}};${NL}`);
  r = 묶음대조(꼬리(라이브, 'getLimit2'), 꼬리(후보, 'getLimit3'));
  assert.deepEqual(['src/p.js', '(꼬리)'].map(p => r.경로.find(x => x.경로 === p).꼴), ['같은 코드', '같은 코드']);
});

test('같은 코드 — 이름이 바뀐 함수 · 클래스는 증거에 따로 싣고, 그 이름의 .name을 직접 읽으면 다름이다(설계 주인 11-21 · GPT -c GD9 · GE3)', () => {
  // 조각 안: 함수 선언 · 클래스 · 이름 없는 함수를 받은 변수
  assert.equal(같은코드('function f(){function render(){}return render.name}', 'function f(){function render2(){}return render2.name}').같음, false, 'X.name');
  assert.equal(같은코드('function f(){class C{who(){return this.constructor.name}}return C}', 'function f(){class C2{who(){return this.constructor.name}}return C2}').같음, false, '그 클래스 안의 this.constructor.name');
  assert.equal(같은코드('function f(){function g(){return new.target.name}return g}', 'function f(){function g2(){return new.target.name}return g2}').같음, false, 'new.target.name');
  assert.equal(같은코드('function f(){var h=()=>1;return h.name}', 'function f(){var h2=()=>1;return h2.name}').같음, false, '이름 없는 함수를 받은 변수도 이름이 .name이 된다');
  assert.equal(같은코드('function f(){var h=()=>1;return h["name"]}', 'function f(){var h2=()=>1;return h2["name"]}').같음, false, '대괄호로 읽어도');
  const 읽지않음 = 같은코드('function f(){function render(){}return render()}', 'function f(){function render2(){}return render2()}');
  assert.equal(읽지않음.같음, true, '.name을 읽지 않으면 같은 코드');
  assert.deepEqual(읽지않음.함수바뀜, [['render', 'render2']], '이름이 바뀐 함수를 따로 낸다');
  // 묶음 맨 위: 선언한 모듈과 다른 모듈에서 .name을 읽어도 본다
  const r = 묶음대조(묶음([['src/x.js', `function format() { return 1; }${NL}`], ['src/m.js', `var n = format.name;${NL}`]]), 묶음([['src/x.js', `function format2() { return 1; }${NL}`], ['src/m.js', `var n = format2.name;${NL}`]]));
  assert.equal(r.경로.find(x => x.경로 === 'src/x.js').꼴, '바뀜');
  assert.match(r.경로.find(x => x.경로 === 'src/x.js').어긋남, /format → format2의 \.name을 묶음에서 직접 읽는다/);
  const r2 = 묶음대조(묶음([['src/x.js', `function format() { return 1; }${NL}`], ['src/m.js', `var n = format();${NL}`]]), 묶음([['src/x.js', `function format2() { return 1; }${NL}`], ['src/m.js', `var n = format2();${NL}`]]));
  assert.deepEqual(r2.경로.find(x => x.경로 === 'src/x.js').함수바뀜, ['format→format2'], '읽지 않으면 같은 코드이고 이름 바뀜을 싣는다');
});

test('같은 코드 · 묶음 대조 — 도구가 다루지 않는 꼴(계산된 문자열 열쇠 · __proto__ 줄여 쓰기 · 선언과 함께 내보냄 · 탈출이 든 태그 틀 글자)이 묶음에 있으면 멈춘다(설계 주인 11-21)', () => {
  const 꼬리 = `${NL}export {${NL}  fa${NL}};${NL}`;
  const 판 = 몸 => Buffer.from(`/*HEAD*/${NL}// src/a.js${NL}var x = 1;${NL}function fa() { return x; }${NL}// src/b.js${NL}${몸}${꼬리}`);
  const 보통 = 판('var y = 1;');
  for (const [이름, 몸] of [['계산된 문자열 열쇠', 'var y = { ["ready"]: true };'], ['__proto__ 줄여 쓰기', 'var __proto__ = {}; var y = { __proto__ };'],
    ['선언과 함께 내보냄', 'export const ready = 1;'], ['탈출이 든 태그 틀 글자', 'var y = String.raw`a\\tb`;']]) {
    assert.throws(() => 묶음대조(판(몸), 보통), new RegExp(`묶음 대조: 라이브 묶음에 도구가 다루지 않는 꼴이 있다 — ${이름}`), 이름);
    assert.throws(() => 문자열대조(보통, 판(몸)), new RegExp(`문자열 대조: 후보 묶음에 도구가 다루지 않는 꼴이 있다 — ${이름}`), 이름);
    // 반대쪽도 본다 — 한쪽 검사를 빼도 단언이 다 통과하던 빈틈(GPT -d GB3)
    assert.throws(() => 묶음대조(보통, 판(몸)), new RegExp(`묶음 대조: 후보 묶음에 도구가 다루지 않는 꼴이 있다 — ${이름}`), `${이름}(후보)`);
    assert.throws(() => 문자열대조(판(몸), 보통), new RegExp(`문자열 대조: 라이브 묶음에 도구가 다루지 않는 꼴이 있다 — ${이름}`), `${이름}(라이브)`);
  }
  // 조각 단위로도 다름으로 닫는다
  assert.equal(같은코드('export function run(){}', 'export function run2(){}').같음, false, '선언과 함께 내보내는 이름');
  assert.equal(같은코드('var __proto__=1;var o={__proto__};', 'var __proto__=1;var o={__proto__:__proto__};').같음, false, '__proto__ 줄여 쓰기');
});

test('같은 코드 — 클래스 필드 · # 이름은 열쇠이고, 조건 괄호 뒤 「/」는 정규식이며, 맨 위 여러 이름 선언의 뒤 이름도 맨 위 선언이다(Opus F5)', () => {
  // 이름 짝이 될 수 있는 이름(v2 ↔ v3)으로 본다 — v1 ↔ v2는 이름 짝 규칙(F2)이 먼저 막는다
  assert.equal(같은코드('class A { v2 = 1; v3 = 2; get() { return this.v2; } }', 'class A { v3 = 1; v2 = 2; get() { return this.v2; } }').같음, false, '클래스 필드 이름은 글자 그대로');
  assert.equal(같은코드('class A { v1 = 1; v2 = 2; get() { return this.v1; } }', 'class A { v2 = 1; v1 = 2; get() { return this.v1; } }').같음, false);
  assert.equal(같은코드('class A { static n2 = 1; }', 'class A { static n3 = 1; }').같음, false, 'static 필드도');
  assert.equal(같은코드('class A { #a = 1; f() { return this.#a; } }', 'class A { #a2 = 1; f() { return this.#a2; } }').같음, false, '# 이름은 글자 그대로');
  assert.equal(같은코드('function f() { let v2 = 1; return class { v2 = v2; }; }', 'function f() { let v3 = 1; return class { v3 = v3; }; }').같음, false, '묶인 이름과 철자가 같은 필드 이름도 열쇠다');
  assert.equal(같은코드('var x2;class A { v = x2; }', 'var x;class A { v = x; }').같음, true, '필드 초기값 속 이름은 짝');
  assert.equal(같은코드('if (a) /item1/.test(s) && go();', 'if (a) /item2/.test(s) && go();').같음, false, '조건 괄호 뒤 정규식');
  assert.deepEqual(낱말나누기('while(x)/b/g.test(y)'), ['while', '(', 'x', ')', '/b/g', '.', 'test', '(', 'y', ')']);
  assert.deepEqual(낱말나누기('f(a)/2/g(b)'), ['f', '(', 'a', ')', '/', '2', '/', 'g', '(', 'b', ')'], '부르기 괄호 뒤는 나누기');
  // var a = 1, getLimit = … 의 getLimit도 맨 위 선언이다 — 그 선언이 다른 모듈로 옮겨 가면 글이 같은 부르는 쪽도 바뀜이다
  const M = ['src/m.js', `var v = getLimit();${NL}`];
  const r = 묶음대조(묶음([['src/x.js', `var a = 1, getLimit = () => 1;${NL}`], M]), 묶음([['src/x.js', `var a = 1, getLimit2 = () => 1;${NL}`], ['src/y.js', `var b = 2, getLimit = () => 2;${NL}`], M]));
  const m = r.경로.find(x => x.경로 === 'src/m.js');
  assert.equal(m.꼴, '바뀜');
  assert.match(m.어긋남, /이름 getLimit이 가리키는 맨 위 선언의 모듈이 다르다\(라이브 src\/x\.js · 후보 src\/y\.js\)/);
});

test('모듈 나누기 — 이음 글(머리 · 꼬리)까지 조각이 바이트를 빠짐없이 덮는다. 조각이 하나라도 빠지면 덮음이 아니고 묶음 대조는 서지 않는다', () => {
  const 조각 = 모듈나누기(후보묶음);
  assert.deepEqual(조각.map(x => x.이름), ['(머리)', 'src/a.js', 'src/b.js', 'src/c.js', '(꼬리)']);
  assert.equal(조각덮음(후보묶음, 조각), true);
  assert.equal(조각덮음(후보묶음, 조각.filter(x => x.이름 !== '(머리)')), false, '이음 글 조각 뺌');
  assert.equal(조각덮음(후보묶음, 조각.filter(x => x.이름 !== '(꼬리)')), false);
  assert.equal(조각덮음(후보묶음, 조각.filter(x => x.이름 !== 'src/b.js')), false);
  assert.equal(묶음대조(Buffer.from('no markers'), 후보묶음), null);
  const 판 = 묶음([['src/q.mjs?v=1', `var q = 1;${NL}`], ['src/q.mjs?v=2', `var q2 = 2;${NL}`]]);
  // 내보내는 꼬리가 없는 묶음(fa를 선언하지 않는다)
  assert.deepEqual(모듈나누기(판).map(x => x.이름), ['(머리)', 'src/q.mjs?v=1', 'src/q.mjs?v=2'], '?v= 표지도 조각을 나눈다');
  assert.deepEqual(묶음대조(판, 판).경로.map(x => [x.경로, x.꼴]), [['(머리)', '같음'], ['src/q.mjs', '같음']], '같은 파일의 판은 한 경로로 모은다');
});

test('묶음 대조(문자열) — 압축 묶음의 문자열 · 속성 이름 집합을 견주고, 라이브에만 있는 값은 까닭 무리마다 소속을 도구가 확인한다. 까닭이 없거나 무리에 들지 않으면 멈추고, 대조 목록을 읽지 않은 검수는 미충족이다', async t => {
  const 복사빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');${NL}`;
  // 라이브는 바탕 판에 손 고침(주석 · 옮긴 글)을 얹은 것이다 — 바탕에서 다시 지어지지 않는다. gone · x는 바란 고침이 뺐고, "moved text"는 생활 파일로 옮겨 갔다.
  const 후보 = Buffer.from('var a={k:"v",fresh:"y"};a.go();'), 라이브 = Buffer.from('var a={k:"v",gone:"x"};a.go("moved text");/*hand*/');
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': 'var a={k:"v",gone:"x"};a.go();', 'src/a.js': A원, 'src/life.js': `export const t = "moved text";${NL}` } }, { 이름: 'wanted', 파일: { 'src/acct.js': String(후보) } }];
  const f = 대조저장소(t, { 빌더: 복사빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', 까닭: 'reasons.json' }) });
  const 무리 = c => ({ 뺌: { 꼴: '커밋이 뺌', 까닭: 'gone 칸은 바란 고침이 fresh로 바꿨다(합성 시험)', 파일: ['src/acct.js'], 커밋: c }, 옮김: { 꼴: '옮겨감', 까닭: '생활 파일로 옮겼다(합성 시험)', 파일: ['src/life.js'] } });
  까닭쓰기(f, { 무리: 무리(f.커밋.wanted), 글: { 'moved text': '옮김' }, 이름: { gone: '뺌' } });
  await assert.rejects(api.준비하기(f.options), /문자열 대조\(site\/bundle\.js\): 라이브에만 있는 값 1개에 까닭이 없다 — 글 "x"/);
  까닭쓰기(f, { 무리: 무리(f.커밋.wanted), 글: { x: '옮김', 'moved text': '옮김' }, 이름: { gone: '뺌' } });
  await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 1개 — 글 "x"\(무리 옮김 · 옮겨감: 후보 원천의 무리 파일에서 못 찾음\)/, '값이 무리 파일에 없으면 멈춘다');
  까닭쓰기(f, { 무리: 무리(f.커밋.base), 글: { x: '뺌', 'moved text': '옮김' }, 이름: { gone: '뺌' } });
  await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 2개 — 글 "x"\(무리 뺌 · 커밋이 뺌: [0-9a-f]{10}의 앞 판 파일에 있고 그 판에 없는 곳을 못 찾음\)/, '그 커밋의 앞 판이 없으면 멈춘다');
  까닭쓰기(f, { 무리: { ...무리(f.커밋.wanted), 남음: { 꼴: '커밋이 뺌', 까닭: '빼지 않았는데 뺐다고 적음(합성 시험)', 파일: ['src/life.js'], 커밋: f.커밋.wanted } }, 글: { x: '뺌', 'moved text': '남음' }, 이름: { gone: '뺌' } });
  await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 1개 — 글 "moved text"\(무리 남음 · 커밋이 뺌/, '그 커밋 판에도 남아 있으면 멈춘다');
  까닭쓰기(f, { 글: { x: 'x는 gone 칸의 값이다' }, 이름: { gone: 'gone 칸은 바뀌었다' } });
  assert.throws(() => 생성물명세읽기(f.specFile), /문자열 까닭 파일은 무리가 있어야 한다/, '옛 꼴(값마다 글)은 받지 않는다');
  까닭쓰기(f, { 무리: 무리(f.커밋.wanted), 글: { x: '뺌', 'moved text': '옮김' }, 이름: { gone: '뺌' } });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-strings' });
  const [g] = 목록.증명.생성물.항목;
  assert.equal(g.대조.대신, '재현 안 됨 — 문자열 대조로 대신함(연산자 · 흐름 · 지역 이름은 보지 않음)', 'P 항목 제목에도 대조가 보지 않는 것을 밝힌다(설계 검토 F2)');
  assert.deepEqual([g.대조.라이브에만, g.대조.후보에만], [{ 글: 2, 이름: 1 }, { 글: 1, 이름: 1 }]);
  assert.deepEqual(g.대조.무리.map(x => [x.이름, x.꼴, x.글, x.이름들, x.앞부분]), [['뺌', '커밋이 뺌', ['x'], ['gone'], []], ['옮김', '옮겨감', ['moved text'], [], []]], '증명에 값마다 무리가 있다');
  const 글 = 묶음글(폴더);
  assert.match(글, /\| 뺌 \| 커밋이 뺌 \| src\/acct\.js \| [0-9a-f]{10} \| 1 \| 1 \| 0 · 0 \| 2 · 0 \| "x" · "gone" \|/);
  assert.match(글, /\| 옮김 \| 옮겨감 \| src\/life\.js \|  \| 1 \| 0 \| 0 · 0 \| 1 · 0 \| "moved text" \|/);
  assert.match(글, /보지 않는 것: 연산자[^\n]*점 뒤가 아닌 이름/, '대조가 보지 않는 것을 밝힌다(설계 검토 F2)');
  assert.match(글, /머리 입력: 후보 묶음 머리에 `\/\/ 경로` 입력 줄이 없다/, '머리 입력 줄이 없으면 그 사실을 밝힌다(설계 검토 F3)');
  assert.match(글, /- 뺌\(커밋이 뺌\): gone 칸은 바란 고침이 fresh로 바꿨다/);
  assert.doesNotMatch(글, /^- 글 "moved text" — 무리/m, '한 줄씩 목록은 묶음이 아니라 증거 파일에 있다');
  const 목록파일 = fs.readFileSync(path.join(폴더, '생성물', '대조-G40-site_bundle.js-목록.md'));
  assert.match(목록파일.toString('utf8'), /^- 글 "moved text" — 무리 옮김\(옮겨감\) · src\/life\.js · 같음$/m);
  assert.match(목록파일.toString('utf8'), /^- 이름 "gone" — [^\n]*\n {2}둘레: "var a=\{k:\\"v\\",gone:\\"x\\"\};a\.go\(/m, '값마다 라이브 묶음의 둘레 글을 싣는다(설계 검토 F2)');
  assert.equal(g.대조.목록sha256, sha(목록파일), '증명의 목록 해시는 증거 파일 바이트의 해시다');
  assert.match(글, /## 후보에만 있는 이름 1개\r?\n- fresh/);
  assert.match(글, /## 참고 — 까닭 묻지 않음: 점 뒤가 아닌 이름의 집합 차이\(라이브에만 0개 · 후보에만 0개\)/, '점 뒤가 아닌 이름은 집합 차이만 참고로 싣는다(설계 주인 11-21 F2 조건 2)');
  assert.deepEqual(g.대조.참고이름, { 라이브에만: 0, 후보에만: 0 });
  assert.match(글, /— 생성물\(바탕 재현 안 됨 · 재현 안 됨 — 문자열 대조로 대신함\(연산자 · 흐름 · 지역 이름은 보지 않음\): \[G40\]를 본다\)/);
  assert.deepEqual(문자열대조(라이브, 후보).라이브에만, { 글: ['moved text', 'x'], 이름: ['gone'] });
  // 같은 자료를 다 읽은 검수는 통과한다 — 아래 미충족이 G40을 읽지 않은 탓임을 가린다(GPT -c B8)
  const 온 = await api.준비하기({ ...f.options, 이름: 'gen-compare-strings-full', 폴더: path.join(f.dir, 'packet-full') });
  await 카본보내기(온.폴더, 온.목록);
  const 다읽음 = api.검수확인(온.폴더, { 저장소: f.repo });
  표시만(다읽음, (다읽음.사유 || []).join(' / '));
  await 카본보내기(폴더, 목록, id => /^G40(?:z\d+)?-/.test(id));
  const 안읽음 = api.검수확인(폴더, { 저장소: f.repo });
  assert.ok(표시뺀(안읽음).length > 0, '문자열 대조 목록을 읽지 않은 검수는 충족이 아니다');
  // 두 검수의 차이는 G40을 읽었는가 하나다 — 미충족 까닭은 읽은 항목이 요구 항목과 다르다는 것이다
  assert.ok(안읽음.사유.some(s => /seen이 요구 항목 집합과 다르다/.test(s)), `미충족 까닭: ${안읽음.사유.join(' / ')}`);
});

test('묶음 대조(문자열) — 소속은 되돌린 뒤 후보 원천으로 본다: 원천 커밋에는 있으나 되돌림 대본이 뺀 값은 그 파일의 무리에 들지 않는다(실제 (2-2)에서 도구가 잡은 「저는 수진이에요.」)', async t => {
  const 복사빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');${NL}`;
  const 값 = '저는 수진이에요.', 후보 = Buffer.from('var a={k:"v"};a.go();'), 라이브 = Buffer.from(`var a={k:"v"};a.go("${값}");/*hand*/`);
  // 바탕: 판정 목록은 비었고 생활 파일에 값이 있다. 아직 공개하지 않은 다른 일(other)이 판정 글에 같은 값을 넣고, 되돌림 대본이 그 일을 걷는다.
  // 판정 글의 값은 문자열 상수 하나 그대로다 — 원천 커밋 판(git)을 읽으면 낱말 단위 맞춤으로도 「같음」이 되어 되돌린 사본을 읽는지 가린다.
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': String(후보), 'src/a.js': A원, 'src/verdicts.json': `{"items":[]}${NL}`, 'src/life.js': `export const t = "${값}";${NL}` } },
    { 이름: 'other', 파일: { 'src/verdicts.json': `{"items":[{"reason":"${값}"}]}${NL}` } }];
  const 되돌림글 = `const fs=require('fs'),p=require('path');const e=process.argv[2];if(!fs.existsSync(p.join(e,'EXPORT_COMMIT')))throw new Error('no export');fs.writeFileSync(p.join(e,'src/verdicts.json'),${JSON.stringify(`{"items":[]}${NL}`)});${NL}`;
  const f = 대조저장소(t, { 빌더: 복사빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', 까닭: 'reasons.json' }), 되돌림글 });
  const 무리 = { 판정: { 꼴: '안 쓰임', 까닭: '판정 글에 있다(합성 시험)', 파일: ['src/verdicts.json'] }, 옮김: { 꼴: '옮겨감', 까닭: '생활 파일로 옮겼다(합성 시험)', 파일: ['src/life.js'] } };
  assert.match(execFileSync('git', ['-C', f.repo, 'show', `${f.커밋.other}:src/verdicts.json`], { encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))) }), new RegExp(값.replace('.', '\\.')), '원천 커밋의 판정 글에는 값이 있다');
  까닭쓰기(f, { 무리, 글: { [값]: '판정' } });
  await assert.rejects(api.준비하기(f.options), new RegExp(`무리에 들지 않는 값 1개 — 글 "${값.replace('.', '\\.')}"\\(무리 판정 · 안 쓰임: 후보 원천의 무리 파일에서 못 찾음\\)`), '되돌림이 뺀 파일 판에서는 찾지 못한다');
  까닭쓰기(f, { 무리, 글: { [값]: '옮김' } });
  const { 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-strings-reverted' });
  assert.deepEqual(목록.증명.생성물.항목[0].대조.무리.map(x => [x.이름, x.글]), [['옮김', [값]]]);
});

test('묶음 대조(문자열) — 커밋이 뺌은 커밋이 원천과 같아도 그 커밋 판(git)을 보고, 되돌림이 지운 꺼냄 안 파일은 원천 커밋 판으로 대신 읽지 않는다(GPT GB12)', async t => {
  const 복사빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');${NL}`;
  const 값 = '되돌림이 지운 값', 후보 = Buffer.from('var a={k:"v"};a.go();'), 라이브 = Buffer.from(`var a={k:"v"};a.go("${값}");`);
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': String(후보), 'src/a.js': A원, 'src/verdicts.json': `{"items":["${값}"]}${NL}`, 'src/life.js': `export const t = "${값}";${NL}` } },
    { 이름: 'other', 파일: { 'src/note.txt': `n${NL}` } }];
  // 되돌림 대본이 판정 글에서 값을 빼고 생활 파일을 통째로 지운다 — 원천 커밋(other)의 두 파일에는 값이 그대로 있다.
  const 되돌림글 = `const fs=require('fs'),p=require('path');const e=process.argv[2];if(!fs.existsSync(p.join(e,'EXPORT_COMMIT')))throw new Error('no export');fs.writeFileSync(p.join(e,'src/verdicts.json'),${JSON.stringify(`{"items":[]}${NL}`)});fs.rmSync(p.join(e,'src/life.js'));${NL}`;
  const f = 대조저장소(t, { 빌더: 복사빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', 까닭: 'reasons.json' }), 되돌림글 });
  까닭쓰기(f, { 무리: { 원천뺌: { 꼴: '커밋이 뺌', 까닭: '원천 커밋이 뺐다고 적음(합성 시험 — 실제로는 되돌림이 뺐다)', 파일: ['src/verdicts.json'], 커밋: f.커밋.other } }, 글: { [값]: '원천뺌' } });
  await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 1개 — 글 "되돌림이 지운 값"\(무리 원천뺌 · 커밋이 뺌/, '커밋이 원천과 같아도 그 커밋 판에 값이 남아 있으면 멈춘다');
  까닭쓰기(f, { 무리: { 옮김: { 꼴: '옮겨감', 까닭: '생활 파일로 옮겼다고 적음(합성 시험 — 되돌림이 그 파일을 지웠다)', 파일: ['src/life.js'] } }, 글: { [값]: '옮김' } });
  await assert.rejects(api.준비하기({ ...f.options, 이름: 'gen-compare-strings-deleted' }), /무리에 들지 않는 값 1개 — 글 "되돌림이 지운 값"\(무리 옮김 · 옮겨감: 후보 원천의 무리 파일에서 못 찾음\)/, '되돌림이 지운 파일은 원천 커밋 판으로 대신 읽지 않는다');
});

test('묶음 대조(문자열) — 커밋 판 읽기는 블롭만 받는다: 무리 파일 자리가 폴더면 git 트리 목록을 본문으로 읽지 않는다(GPT 다시 검수 GC5)', async t => {
  const 복사빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');${NL}`;
  // 라이브에만 있는 속성 이름 life — 두 폴더의 트리 목록에는 life.js라는 파일 이름으로 「life」 낱말이 있다.
  // 꺼냄 밖 docs는 원천 커밋 판(git)에서 읽고, 꺼냄 안 src는 되돌린 사본에서 읽는다. 어느 쪽이든 폴더는 본문이 아니다.
  const 후보 = Buffer.from('var a={k:"v"};a.go();'), 라이브 = Buffer.from('var a={k:"v"};a.life();');
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': String(후보), 'src/a.js': A원, 'src/life.js': `export const t = 1;${NL}`, 'docs/life.js': `export const t = 1;${NL}` } }, { 이름: 'wanted', 파일: { 'src/note.txt': `n${NL}` } }];
  for (const 폴더 of ['docs', 'src']) {
    const f = 대조저장소(t, { 빌더: 복사빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', 까닭: 'reasons.json' }) });
    까닭쓰기(f, { 무리: { 폴더: { 꼴: '옮겨감', 까닭: '파일 대신 폴더를 적음(합성 시험)', 파일: [폴더] } }, 이름: { life: '폴더' } });
    await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 1개 — 이름 "life"\(무리 폴더 · 옮겨감: 후보 원천의 무리 파일에서 못 찾음\)/, 폴더);
  }
});

test('JSON 구조 차이 — 앞 값에 연산을 적용해 같은 꼴로 쓰면 뒤 바이트가 나온다(완전). 바뀐 열쇠는 옛 값 → 새 값을 줄이지 않고 싣고, 연산을 하나라도 빼면 완전하지 않다', () => {
  const 꼴 = { 들여쓰기: 2, 끝줄: true, 줄끝: '\n', bom: false };
  const 긴옛 = 'x'.repeat(500), 긴새 = 'y'.repeat(500);
  const 앞값 = { version: 1, note: '옛', items: [{ itemKey: 'k1', verdict: 'pass', long: 긴옛 }, { itemKey: 'k2', verdict: 'fail' }], meta: { a: 1, b: 2 }, list: [1, 2, 3] };
  const 뒤값 = { version: 2, items: [{ itemKey: 'k2', verdict: 'pass' }, { itemKey: 'k1', verdict: 'pass', long: 긴새 }, { itemKey: 'k3', verdict: 'pass' }], meta: { b: 2, a: 1 }, list: [1, 5], added: true };
  const 앞b = Buffer.from(JSON쓰기(앞값, 꼴)), 뒤b = Buffer.from(JSON쓰기(뒤값, 꼴));
  assert.deepEqual(JSON쓰기꼴(앞b), 꼴);
  const r = JSON구조차이(앞b, 뒤b);
  assert.equal(r.완전, true);
  const 글 = JSON차이글({ 경로: 'r.json', 앞sha256: sha(앞b), 뒤sha256: sha(뒤b), ...r });
  assert.ok(글.includes(`바꿈 $.items[itemKey="k1"].long: "${긴옛}" → "${긴새}"`), '바뀐 값을 줄이지 않는다');
  assert.match(글, /^바꿈 \$\.items\[itemKey="k2"\]\.verdict: "fail" → "pass"$/m);
  assert.match(글, /^뺌 \$\.note: "옛"$/m);
  assert.match(글, /^더함 \$\.items\[itemKey="k3"\]: \{"itemKey":"k3","verdict":"pass"\}$/m);
  assert.match(글, /^차례 \$\.items\(itemKey 차례\): \["k2","k1","k3"\]$/m);
  assert.match(글, /^차례 \$\.meta: \["b","a"\]$/m);
  assert.match(글, /^뺌 \$\.list\[2\]: 3$/m);
  assert.match(글, /^완전: /m);
  // 바뀐 열쇠 하나 뺌(변형) — 어느 연산을 빼도 적용한 값이 뒤 바이트를 만들지 못한다
  for (const i of r.연산.keys()) assert.equal(JSON차이완전(JSON.parse(앞b.toString()), r.연산.filter((_, k) => k !== i), r.꼴, 뒤b), false, `연산 ${i}(${r.연산[i].연산}) 뺌`);
  // 꼴이 다르거나 그대로 다시 쓸 수 없는 글이면 구조 차이를 쓰지 않는다(줄 차이로 간다)
  assert.equal(JSON구조차이(Buffer.from(JSON.stringify(앞값)), 뒤b), null);
  assert.equal(JSON구조차이(Buffer.from('{"a":1, "b":2}\n'), Buffer.from('{"a":1, "b":3}\n')), null);
  // 옛 값이 다르거나 길이 없는 연산은 적용하지 않는다
  assert.throws(() => JSON연산적용({ a: 1 }, [{ 연산: '바꿈', 길: ['a'], 앞: 2, 뒤: 3 }]), /옛 값이 다르다/);
  assert.throws(() => JSON연산적용({ a: 1 }, [{ 연산: '더함', 길: ['a'], 뒤: 3 }]), /이미 있다/);
  assert.throws(() => JSON연산적용({ a: [] }, [{ 연산: '뺌', 길: ['a', 0], 앞: 1 }]), /뺄 값이 다르다/);
  // __proto__ 열쇠 · 정수 열쇠 · CRLF와 BOM 꼴 — JSON쓰기를 거치지 않고 손으로 쓴 바이트로 본다(GPT -c B9: 같은 함수로 지은 두 판끼리면 BOM을 빠뜨려도 맞는다)
  const CRLF = `${String.fromCharCode(13)}${NL}`, BOM = String.fromCharCode(0xfeff);
  const 손글 = (...줄) => Buffer.from(`${BOM}${줄.join(CRLF)}${CRLF}`);
  const 앞2 = 손글('{', '  "__proto__": {', '    "x": 1', '  },', '  "k": 1', '}');
  const 뒤2 = 손글('{', '  "2": 4,', '  "10": 3,', '  "k": 2,', '  "__proto__": {', '    "x": 2', '  }', '}');
  assert.ok(앞2.includes(Buffer.from([0x0d, 0x0a])) && 앞2.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), '입력에 실제 CRLF와 BOM 바이트가 있다');
  const 꼴2 = { 들여쓰기: 2, 끝줄: true, 줄끝: '\r\n', bom: true };
  assert.deepEqual(JSON쓰기꼴(앞2), 꼴2);
  const r2 = JSON구조차이(앞2, 뒤2);
  assert.equal(r2.완전, true);
  assert.ok(Buffer.from(JSON쓰기(JSON연산적용(JSON.parse(앞2.toString('utf8').slice(1)), r2.연산), 꼴2)).equals(뒤2), '연산을 적용해 감지한 꼴로 쓰면 뒤 바이트(BOM · CRLF 포함)가 그대로 나온다');
});

test('JSON 모듈 값 읽기 — 묶음의 JSON 모듈 글자 값을 코드를 돌리지 않고 읽고(\\uXXXX 이름 열쇠 · 따옴표 세 가지 · ["__proto__"] 열쇠), 글자 값이 아니면 읽지 않는다', () => {
  const 모듈글 = `// data/x.json${NL}var x_default = { version: "v1", \\uB0A8\\uC790: 'a\\'b', items: [{ id: "i1", n: -1.5e3, ok: true, z: null, t: \`x\` }], ["__proto__"]: { p: 1 }, 10: "ten" };${NL}`;
  const r = 모듈JSON값(모듈글);
  assert.equal(JSON.stringify(r.값), '{"10":"ten","version":"v1","남자":"a\'b","items":[{"id":"i1","n":-1500,"ok":true,"z":null,"t":"x"}],"__proto__":{"p":1}}');
  assert.equal(r.틀, `// data/x.json${NL}var x_default = 0;${NL}`);
  assert.equal(모듈JSON값(`var x = { a: f() };${NL}`), null, '부르기는 글자 값이 아니다');
  // 문자열 · 주석 안의 선언 · 대입 꼴은 값 자리가 아니다 — 두 판의 내보내는 글이 달라도 같은 값으로 읽던 길(GPT -c GD10)
  assert.equal(모듈JSON값(`export default 'module.exports = {"n": 1e0}';${NL}`), null, '문자열 안의 module.exports =');
  assert.equal(모듈JSON값(`/* var d = {"n": 1} */ var e = 1;${NL}`), null, '주석 안의 선언');
  assert.deepEqual(모듈JSON값(`module.exports = {"n": 1};${NL}`).값, { n: 1 }, '맨 위 module.exports 대입은 읽는다');
  assert.equal(모듈JSON값(`var x = { a: \`\${y}\` };${NL}`), null, '틀 글자 식은 글자 값이 아니다');
  assert.equal(모듈JSON값(`function f() {}${NL}`), null);
  // 계산하지 않은 __proto__ 열쇠는 실행하면 프로토타입을 바꾼다 — JSON 값으로 읽지 않는다(GPT GB10). 계산한 ["__proto__"]만 자체 속성이다.
  for (const 글 of ['var x = { "__proto__": null };', "var x = { '__proto__': { p: 1 } };", 'var x = { __proto__: 1 };', 'var x = { \\u005f_proto__: null };'])
    assert.equal(모듈JSON값(`${글}${NL}`), null, 글);
  assert.ok(Object.hasOwn(모듈JSON값(`var x = { ["__proto__"]: null };${NL}`).값, '__proto__'));
  // -0은 JSON으로 쓰면 0이 된다 — JSON 값으로 읽지 않는다(다시 검수 GB12). 틀 글자의 CRLF는 값 규칙대로 LF다(GB11).
  for (const 글 of ['var x = { a: -0 };', 'var x = { a: [1, -0.0] };', 'var x = { a: -0e3 };']) assert.equal(모듈JSON값(`${글}${NL}`), null, 글);
  assert.equal(모듈JSON값(`var x = { a: \`줄1\r\n줄2\r줄3\` };${NL}`).값.a, '줄1\n줄2\n줄3');
  assert.equal(모듈JSON값(`var x = { a: \`줄1\\r\\n줄2\` };${NL}`).값.a, '줄1\r\n줄2', '탈출 글자로 쓴 CR은 그대로');
  assert.deepEqual(문자열대조(Buffer.from('f(`a\r\nb`)'), Buffer.from('f(`a\nb`)')).라이브에만.글, [], '틀 글자 조각도 같은 값 규칙으로 모은다');
  assert.deepEqual(문자열대조(Buffer.from('f(`a\r\nb`)'), Buffer.from('f(`c`)')).라이브에만.글, ['a\nb'], '틀 글자 값을 실제로 모은다 — 모으지 않아도 위 단언은 통과한다(GPT -d GB5)');
});

test('JSON 구조 차이 — 열쇠에 NUL이 들어도 차례 바뀜을 놓치지 않는다(GPT GB14)', () => {
  const 꼴 = { 들여쓰기: 2, 끝줄: true, 줄끝: '\n', bom: false };
  const 앞b = Buffer.from(JSON쓰기({ a: 1, 'a\u0000a': 2 }, 꼴)), 뒤b = Buffer.from(JSON쓰기({ 'a\u0000a': 2, a: 1 }, 꼴));
  const r = JSON구조차이(앞b, 뒤b);
  assert.deepEqual(r.연산.map(x => x.연산), ['차례']);
  assert.equal(r.완전, true);
});

test('두 판 차이 — 긴 줄 파일에서 공백만 바뀌어도 차이를 싣는다: 낱말 차이가 비면 공백도 낱말로 세어 다시 본다(GPT 다시 검수 GC1)', () => {
  const 긴 = 'x'.repeat(450);
  const d = api.두판diff(Buffer.from(`var s = "${긴} a b";${NL}`), Buffer.from(`var s = "${긴} a  b";${NL}`), 'site/long.js');
  assert.equal(d.꼴, '낱말');
  assert.match(d.글, /a\[- -\]\{\+ {2}\+\}b/, '공백 하나 → 둘');
  const d2 = api.두판diff(Buffer.from(`var s = "${긴} a";${NL}`), Buffer.from(`var s = "${긴} b";${NL}`), 'site/long.js');
  assert.match(d2.글, /\[-a-\]\{\+b\+\}/, '보통 낱말 차이는 그대로');
  const d3 = api.두판diff(Buffer.from(`var s = "${긴} a b", t = "c";${NL}`), Buffer.from(`var s = "${긴} a  b", t = "d";${NL}`), 'site/long.js');
  assert.match(d3.글, /\[-c-\]\{\+d\+\}/, '보이는 낱말 바뀜');
  assert.match(d3.글, /a\[- -\]\{\+ {2}\+\}b/, '같은 줄의 공백 바뀜도 함께 싣는다 — 보이는 바뀜 곁에서 버리지 않는다(GPT -c GE4)');
});

test('시험 결과 글 — 집계를 읽지 못하면 「실패 없음」 대신 미확인이라고 적는다(GPT -c A1)', () => {
  const 끝 = { 명령: 'node --test a', 종료: null, 시험: null, 통과: null, 실패: null, 건너뜀: null, 취소: null, 초: 2400, 실패목록: [] };
  assert.match(api.시험결과글(끝), /결과 미확인/);
  assert.doesNotMatch(api.시험결과글(끝), /실패 없음/);
  assert.match(api.시험결과글({ ...끝, 종료: 0, 시험: 3, 통과: 3, 실패: 0, 건너뜀: 0, 취소: 0 }), /\n실패 없음$/);
  assert.match(api.시험결과글({ ...끝, 종료: 1, 시험: 3, 통과: 3, 실패: 0, 건너뜀: 0, 취소: 0 }), /실패 목록은 없으나 종료 1/);
  const 이름속 = api.시험결과글({ ...끝, 종료: 1, 시험: 3, 통과: 2, 실패: 1, 건너뜀: 0, 취소: 0 });
  assert.match(이름속, /실패 1개 — 집계에는 실패가 있는데 실패 목록을 읽지 못했다/, '시험 이름 속 「# TODO」로 목록이 비어도 실패 수를 적는다(GPT -d GE7)');
  assert.doesNotMatch(이름속, /실패 없음/);
  assert.match(api.시험결과글({ ...끝, 종료: 1, 시험: 3, 통과: 2, 실패: 1, 실패목록: [{ 이름: 'x', 위치: 'a.js:1', 오류: 'boom' }] }), /실패:\n- x \(a\.js:1\): boom/);
});

test('문자열 소속 맞춤 — 「앞부분」은 앞 공백을 걷은 마디로 보고, 들여쓰기만 같은 파일은 맞지 않는다(GPT GB13)', () => {
  const v = `${' '.repeat(64)}안녕하세요 반가워요`;
  assert.equal(글맞춤(v, { 글: `export const t = 1;${NL}${' '.repeat(80)}const u = 2;${NL}`, 낱말: null }), null, '공백만 같다');
  assert.equal(글맞춤(`${v}${NL}둘째 줄`, { 글: `const s = \`안녕하세요 반가워요${NL}\`;`, 낱말: null }), '앞부분');
  // 4자 경계 — 뒤 내용은 다르고 첫 마디만 같은 여러 줄 값으로 본다(한 줄 값은 앞의 규칙으로 이미 null이라 경계를 가리지 못한다 · GPT -c B10)
  const 여러줄 = (머리, 꼬리) => `${머리}${' '.repeat(70)}${꼬리}${NL}둘째 줄`;
  assert.equal(글맞춤(여러줄('a', 'bcde'), { 글: `x = \`${여러줄('a', 'wxyz')}\`;`, 낱말: null }), null, '앞 60자에 글자가 1자면 맞추지 않는다');
  assert.equal(글맞춤(여러줄('abc', 'defg'), { 글: `x = \`${여러줄('abc', 'wxyz')}\`;`, 낱말: null }), null, '앞 60자에 글자가 3자면 맞추지 않는다');
  assert.equal(글맞춤(여러줄('abcd', 'efgh'), { 글: `x = \`${여러줄('abcd', 'wxyz')}\`;`, 낱말: null }), '앞부분', '앞 60자에 글자가 4자면 앞부분이다');
});

test('문자열 소속 맞춤 — 파일을 낱말로 읽어 값과 같은 문자열 상수 · 이름 낱말이 있을 때만 「같음」이다. 다른 값의 일부 · 주석 · 한 줄 값의 앞부분은 소속이 아니다(GPT 다시 검수 GB15)', () => {
  const 본 = 글 => ({ 글, 낱말: null });
  assert.equal(글맞춤('POST', 본('const m = "POSTCARD";')), null, '다른 값의 일부');
  assert.equal(글맞춤('저장했어요', 본(`// 저장했어요${NL}const t = "다른 글";`)), null, '주석에 적은 값');
  assert.equal(글맞춤('저장했어요', 본("const t = '저장했어요';")), '같음');
  assert.equal(글맞춤(`a${NL}b`, 본(`const t = \`a${NL}b\`;`)), '같음', '틀 글자 상수');
  assert.equal(글맞춤('오늘의 연습을 시작해요 지금', 본('const t = "오늘의 연습을 시작해요";')), null, '한 줄 값은 앞부분으로 맞추지 않는다');
  assert.equal(글맞춤('오늘의 연습을 시작해요', 본(`const t = \`오늘의 연습을 시작해요${NL}둘째 줄\`;`)), null, '한 줄 값은 여러 줄 상수의 첫 마디와 같아도 앞부분이 아니다');
  assert.equal(글맞춤(`줄 하나 입니다${NL}둘`, 본(`/* 줄 하나 입니다${NL}*/ const t = "다른";`)), null, '여러 줄 값도 주석의 첫 마디로는 맞지 않는다');
  assert.equal(이름맞춤('gone', 본(`// gone${NL}var x = 1;`)), null, '주석의 이름');
  assert.equal(이름맞춤('go', 본('var gone = 1;')), null, '다른 이름의 일부');
  assert.equal(이름맞춤('gone', 본('var o = { gone: 1 };')), '같음');
  assert.equal(이름맞춤('gone', 본('o["gone"] = 1;')), '같음', '따옴표로 쓴 열쇠');
});

test('문자열 대조 — 값을 처음 쓴 낱말의 원문 자리를 적고(주석 · 다른 낱말 속 같은 글자가 아니라), 점 뒤가 아닌 이름의 집합 차이를 참고로 낸다(GPT 다시 검수 GC7 · 설계 주인 11-21 F2 조건 2)', () => {
  const 라이브글 = '/*gone .5*/var a={gone:1};f(".5",.5)';
  const s = 문자열대조(Buffer.from(라이브글), Buffer.from('var a={};'));
  assert.equal(s.라이브원형.get('이름\0gone').자리, 라이브글.indexOf('gone:'), '주석 속 gone이 아니라 열쇠 자리');
  assert.equal(s.라이브원형.get('글\0.5').자리, 라이브글.indexOf('".5"'));
  assert.equal(s.라이브원형.get('숫자\x000.5').자리, 라이브글.lastIndexOf('.5'), '숫자 .5는 점 낱말 자리부터');
  const r = 문자열대조(Buffer.from('const __atlasOwners=new Set();let owners=1;function f(){return true}var x=undefined;'), Buffer.from('let owners=1,owners2=2;function f(){return false}'));
  assert.deepEqual(r.참고이름, { 라이브에만: ['Set', '__atlasOwners', 'x'], 후보에만: [] }, '예약어 · 리터럴 낱말을 빼고 esbuild 꼬리 수를 뗀다');
  assert.deepEqual(r.라이브에만, { 글: [], 이름: [] }, '참고 이름은 까닭을 묻는 칸에 들지 않는다');
});

test('문자열 대조 — 줄여 쓴 속성({count})과 따옴표로 쓴 메서드 이름도 속성 이름으로 모은다(GPT GB11)', () => {
  const 다름 = (a, b) => 문자열대조(Buffer.from(a), Buffer.from(b)).라이브에만.이름;
  assert.deepEqual(다름('const count=1;globalThis.state={count};', 'const count=1;globalThis.state={};'), ['count'], '후보에서 객체가 {}가 되면 count 속성이 사라진다');
  assert.deepEqual(다름('var o={a:1,count};', 'var o={a:1};'), ['count']);
  assert.deepEqual(다름("var o={'run'(){return 1}};", 'var o={};'), ['run'], '따옴표로 쓴 메서드 이름');
  assert.deepEqual(다름('f(count);', 'f();'), [], '부르기의 인자는 속성 이름이 아니다');
  assert.deepEqual(다름('f(a,false,b);var x=[1,count,2];var a,b,c;', 'f();var x=[];'), [], '인자 · 배열 · 변수 목록의 쉼표 사이 이름은 속성 이름이 아니다');
});

test('문자열 대조 — 숫자는 값으로(1e3 = 1000 · .5 = 0.5 · 1e-3 = 0.001), 정규식은 글 그대로 모은다. 연산자 · 점 뒤가 아닌 이름은 보지 않는다(설계 검토 F2)', () => {
  const 에만 = (a, b) => 문자열대조(Buffer.from(a), Buffer.from(b)).라이브에만;
  assert.deepEqual(에만('f(1e3,.5,1e-3,0x10,1_000)', 'f(1000,0.5,0.001,16,1e3)'), { 글: [], 이름: [] }, '쓰는 꼴만 다른 같은 값');
  assert.throws(() => 에만('f(010)', 'f(10)'), /묶음을 ES 모듈로 읽지 못했다/, '옛 8진 010은 ES 모듈에서 문법 오류다 — 문자열 대조가 멈춘다(GPT -c GE17)');
  assert.throws(() => 에만('var s="\\123";', 'var s="123";'), /묶음을 ES 모듈로 읽지 못했다/, '8진 탈출도 멈춘다(GPT -c GE17)');
  assert.deepEqual(에만('x*.5', 'x*5').숫자, ['0.5'], '「.5」를 「5」로 읽지 않는다');
  assert.deepEqual(에만('f(1e-3)', 'f(1e3)').숫자, ['0.001'], '지수의 부호');
  assert.deepEqual(에만('var n=86400;', 'var n=3600;').숫자, ['86400']);
  assert.deepEqual(에만('if(a)/x+/.test(s);s.replace(/b/g,"")', 'if(a)/y+/.test(s);s.replace(/b/g,"")').정규식, ['/x+/'], '조건 괄호 뒤 정규식');
  assert.deepEqual(에만('a/b/c', 'a/b/c'), { 글: [], 이름: [] }, '나눗셈은 정규식이 아니다');
  assert.deepEqual(에만('if(a<b)go(x)', 'if(a>b)go(y)'), { 글: [], 이름: [] }, '연산자와 점 뒤가 아닌 이름은 보지 않는다(밝혀 둔 한계)');
});

test('문자열 대조 — 묶음을 acorn 낱말로 읽어 CR · U+2028로 끝나는 한 줄 주석 · 「1.e」 숫자 · 객체 식 뒤 나눗셈과 정규식을 바르게 가른다(GPT -c GD11 · GE14 · GE15)', () => {
  const 에만 = (a, b) => 문자열대조(Buffer.from(a), Buffer.from(b)).라이브에만;
  for (const 끝 of ['\r', '\u2028']) assert.deepEqual(에만(`// c${끝}var mode = "old";export { mode };`, `// c${끝}var mode = "new";export { mode };`).글, ['old'], `주석은 ${JSON.stringify(끝)}에서 끝난다`);
  assert.deepEqual(에만('var t = 1.e-3, c = 4;export { t, c };', 'var t = 1.e-4, c = 3;export { t, c };').숫자.sort(), ['0.001', '4'], '「1.e-3」은 한 숫자다');
  assert.deepEqual(에만('var q = {valueOf() { return 6; }} / /Gone/.test(x);export { q };', 'var q = {valueOf() { return 6; }} / /Stay/.test(x);export { q };').정규식, ['/Gone/'], '객체 식 뒤 「/」는 나눗셈이고 그 뒤가 정규식이다');
});

test('묶음 머리 입력 읽기 — 맨 앞에 이어진 「// 낱말」 줄을 읽고(맨 위 파일 · ?v= 물음 글 포함) 첫 코드 줄에서 멈춘다. 없으면 null이고, 한 낱말이 아닌 머리 줄이나 정규 상대 경로가 아닌 입력은 덮음을 판정하지 않고 멈춘다. 머리 길이에는 한도가 없다(설계 검토 F3 · GPT 다시 검수 GB14 · GC4 · -c GE11 · GE12)', () => {
  assert.deepEqual(머리입력읽기(Buffer.from(`// a/b.js${NL}// top.js${NL}// c/d.mjs?v=1${NL}// a/b.js${NL}var x;${NL}// e/f.js${NL}`)), ['a/b.js', 'top.js', 'c/d.mjs']);
  assert.deepEqual(머리입력읽기(Buffer.from('// a/b.js\r\n// c.json\r\nvar x;')), ['a/b.js', 'c.json']);
  assert.equal(머리입력읽기(Buffer.from('var x;// a/b.js')), null);
  assert.throws(() => 머리입력읽기(Buffer.from(`// a/b.js${NL}// my dir/c.js${NL}// d.js${NL}var x;`)), /입력 줄을 경로 하나로 읽지 못했다: "\/\/ my dir\/c\.js"/, '빈칸 든 줄 뒤의 입력을 버리고 다 덮었다고 하지 않는다');
  assert.throws(() => 머리입력읽기(Buffer.from(`// Generated by tool${NL}var x;`)), /경로 하나로 읽지 못했다/, '설명 글 머리도 목록으로 읽지 않는다');
  const 긴 = Buffer.from(`${Array.from({ length: 80000 }, (_, k) => `// src/m${k}.js`).join(NL)}${NL}var x;`);
  assert.ok(긴.length > 1 << 20);
  assert.equal(머리입력읽기(긴).length, 80000, '1MiB를 넘는 머리도 끝까지 읽는다(GPT -c GE12)');
  const 긴줄 = Buffer.concat([Buffer.from(`// a/b.js${NL}`), Buffer.alloc(2 << 20, 0x61)]);
  assert.deepEqual(머리입력읽기(긴줄), ['a/b.js'], '머리 뒤의 아주 긴 코드 줄 하나는 머리가 아니라 거기서 멈춘다(GPT -c GE12)');
  for (const 틀린 of ['../x.js', 'a/./b.js', 'a//b.js', 'a\\b.js', 'C:/x.js', '/abs.js']) {
    assert.throws(() => 머리입력읽기(Buffer.from(`// ${틀린}${NL}var x;`)), /정규 상대 경로가 아니다/, `${틀린} — 원천경로 덮음을 거짓으로 세우지 않는다(GPT -c GE11)`);
  }
});

test('묶음 대조(문자열) — 묶음 머리의 입력 목록을 원천경로가 다 덮어야 한다. 마지막 빌더가 입력 이름을 바꿔 쓰면 머리곳(이 빌드가 지은 중간 묶음)의 머리를 읽고, 그 목록이 후보 묶음 머리와 바꿔 쓴 이름만 다른지 본다. 머리곳에 머리바꿈을 적용한 바이트가 후보와 다르면 문자열 대조 대신 본문 차이로 검수한다(설계 검토 F3 · GPT 다시 검수 GC3 · GA4 · 설계 주인 11-21 물음 1 · GPT -c C1 · GE10)', async t => {
  // 중간 묶음 머리: src/acct.js · src/suno.js · tools/extra.js. 마지막 빌더가 src/suno.js를 gen/recording.js로 바꿔 써 후보 묶음을 짓는다(실제 (2-2) 계정 묶음의 꼴).
  const 머리 = ps => ps.map(p => `// ${p}${NL}`).join('');
  const 끝머리 = 머리(['src/acct.js', 'gen/recording.js', 'tools/extra.js']);
  // 마지막 빌더는 머리의 이름과 함께 몸의 이름도 바꿔 쓴다 — 실제 (2-2) 계정 묶음의 두 쌍(src/suno.js → gen/recording.js · SUNO_RECORDINGS → RECORDINGS, GPT -d GC1).
  const 몸글 = 'var a={k:"v"};a.go(RECORDINGS);', 중간몸 = 'var a={k:"v"};a.go(SUNO_RECORDINGS);';
  const 후보 = Buffer.from(`${끝머리}${몸글}`), 라이브 = Buffer.from(`${끝머리}${몸글}/*hand*/`);
  const 쓰기 = (p, ps, 몸 = 중간몸) => `fs.writeFileSync(${JSON.stringify(p)},${JSON.stringify(`${머리(ps)}${몸}`)});`;
  const 빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});${쓰기('.tmp/out/stage.js', ['src/acct.js', 'src/suno.js', 'tools/extra.js'])}${쓰기('.tmp/out/short.js', ['src/acct.js', 'src/suno.js'])}${쓰기('.tmp/out/other.js', ['src/acct.js', 'src/suno.js', 'src/a.js'])}${쓰기('.tmp/out/body.js', ['src/acct.js', 'src/suno.js', 'tools/extra.js'], 'var a={k:"w"};a.go(SUNO_RECORDINGS);')}fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');${NL}`;
  // tools/old-stage.js: 커밋에 들어 있는 옛 중간 묶음(머리는 맞다) — 이번 빌드가 짓지 않았으면 머리곳으로 읽지 않는다
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': String(후보), 'src/a.js': A원, 'src/suno.js': `export const s = 1;${NL}`, 'tools/extra.js': `export const e = 1;${NL}`,
    'tools/old-stage.js': `${머리(['src/acct.js', 'src/suno.js', 'tools/extra.js'])}var s;` } }, { 이름: 'wanted', 파일: { 'src/note.txt': `n${NL}` } }];
  const 준비 = (항목, 이름 = 'gen-compare-strings-header') => api.준비하기({ ...대조저장소(t, { 빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', ...항목 }) }).options, 이름 });
  await assert.rejects(준비({ 원천경로: ['src', 'tools/extra.js'], 머리곳: 'tools/old-stage.js' }), /머리곳 tools\/old-stage\.js을 빌드가 짓지 않았다/, '꺼낸 판에 있던 파일은 짓기 전에 지운다');
  await assert.rejects(준비({}), /문자열 대조\(site\/bundle\.js\): 후보 묶음 머리의 입력 2개가 원천경로 밖이다 — gen\/recording\.js · tools\/extra\.js\./, '묶음에 든 파일이 원천경로에서 빠지면 멈춘다');
  await assert.rejects(준비({ 원천경로: ['src', 'tools/extra.js'] }), /입력 1개가 원천경로 밖이다 — gen\/recording\.js\. [^\n]*머리곳에 적는다/);
  const 덮음 = { 원천경로: ['src', 'tools/extra.js'] };
  await assert.rejects(준비({ ...덮음, 머리곳: '.tmp/out/none.js' }), /머리곳 \.tmp\/out\/none\.js을 빌드가 짓지 않았다/);
  const 바꿈 = { 머리바꿈: [['src/suno.js', 'gen/recording.js'], ['SUNO_RECORDINGS', 'RECORDINGS']] };
  await assert.rejects(준비({ 원천경로: ['src'], 머리곳: '.tmp/out/stage.js', ...바꿈 }), /머리곳 \.tmp\/out\/stage\.js\(이 빌드가 사본에서 지은 중간 묶음\) 머리의 입력 1개가 원천경로 밖이다 — tools\/extra\.js/, '중간 묶음의 입력도 원천경로가 덮어야 한다');
  // 머리바꿈을 적용한 바이트가 후보와 다르면(다른 묶음 · 바꿈을 빠뜨린 명세) 머리곳이 후보의 중간 묶음임을 보이지 못한다 — 문자열 대조로 대신하지 않고
  // 본문 차이로 검수한다(설계 주인 11-21 물음 1 (가)). 수가 다른 묶음 · 원천경로 안 입력이 빠진 묶음도 여기서 걸러진다.
  // 머리는 맞고 몸만 다른 중간 묶음(body) · 머리 쌍만 적은 명세(header-only)도 머리만 견주면 놓친다(GPT -d GC1).
  for (const [이름, 항목, 쌍] of [['short', { ...덮음, 머리곳: '.tmp/out/short.js', ...바꿈 }, 2], ['other', { ...덮음, 머리곳: '.tmp/out/other.js', ...바꿈 }, 2], ['no-swap', { ...덮음, 머리곳: '.tmp/out/stage.js' }, 0],
    ['header-only', { ...덮음, 머리곳: '.tmp/out/stage.js', 머리바꿈: [['src/suno.js', 'gen/recording.js']] }, 1], ['body', { ...덮음, 머리곳: '.tmp/out/body.js', ...바꿈 }, 2]]) {
    const 다름 = await 준비(항목, `gen-compare-strings-header-${이름}`);
    const [h] = 다름.목록.증명.생성물.항목;
    assert.equal(h.대조, undefined, 이름);
    assert.match(h.대조못함, new RegExp(`머리바꿈 ${쌍}쌍을 적용한 바이트가 후보와 다르다`), 이름);
    assert.match(묶음글(다름.폴더), /이 항목은 본문 차이\(라이브 → 후보\)를 검수한다\(머리곳 /, 이름);
  }
  const { 폴더, 목록 } = await 준비({ ...덮음, 머리곳: '.tmp/out/stage.js', ...바꿈 }, 'gen-compare-strings-header-ok');
  const [g] = 목록.증명.생성물.항목;
  assert.deepEqual([g.대조.머리입력, g.대조.머리곳, g.대조.바꿔씀], [3, '.tmp/out/stage.js', { 후보에만: ['gen/recording.js'], 중간에만: ['src/suno.js'] }]);
  const 글 = 묶음글(폴더);
  assert.match(글, /머리 입력: 머리곳 \.tmp\/out\/stage\.js\(이 빌드가 사본에서 지은 중간 묶음\) 머리의 `\/\/ 경로` 입력 3개를 원천경로\(\+잇기\)가 다 덮는다\(도구가 확인했다\)\. 후보 묶음 머리와 수가 같고 원천경로 안 입력이 모두 같다\. 마지막 빌더가 바꿔 쓴 이름: 후보 머리 gen\/recording\.js \/ 중간 머리 src\/suno\.js\./);
  assert.match(글, /머리 입력 3개 원천경로 안/);
  // 옛 입력바꿈 칸은 받지 않는다. 머리곳은 문자열 대조 항목의 사본 안 상대 경로이고 만든곳과 달라야 한다.
  const 명세틀림 = (항목, 틀) => assert.throws(() => 생성물명세읽기(대조저장소(t, { 커밋들: 모듈커밋, 후보: 후보묶음, 라이브: 라이브묶음, 항목: () => 항목 }).specFile), 틀);
  명세틀림({ 대조: '문자열', 입력바꿈: { 'gen/recording.js': 'src/b.js' } }, /항목의 모르는 칸 입력바꿈/);
  명세틀림({ 대조: '모듈', 머리곳: '.tmp/out/stage.js' }, /머리곳은 문자열 대조 항목의 사본 안 상대 경로/);
  명세틀림({ 대조: '문자열', 머리곳: '.tmp/out/bundle.js' }, /머리곳은 문자열 대조 항목의 사본 안 상대 경로\(만든곳과 다른 중간 묶음\)/);
  명세틀림({ 대조: '문자열', 머리곳: '.tmp/out/Bundle.js' }, /머리곳은 문자열 대조 항목의 사본 안 상대 경로\(만든곳과 다른 중간 묶음\)/);   // 대소문자만 다른 같은 파일(GPT -d GD6)
  명세틀림({ 대조: '문자열', 머리곳: '../outside.js' }, /머리곳은 문자열 대조 항목의 사본 안 상대 경로/);
  명세틀림({ 대조: '문자열', 머리바꿈: [['a', 'b']] }, /머리바꿈은 머리곳이 있는 항목의 \[바꿀 글, 새 글\] 쌍 목록이다/);
  명세틀림({ 대조: '문자열', 머리곳: '.tmp/out/stage.js', 머리바꿈: [['', 'b']] }, /머리바꿈은 머리곳이 있는 항목의/);
  명세틀림({ 대조: '문자열', 머리곳: '.tmp/out/stage.js', 머리바꿈: [['a']] }, /머리바꿈은 머리곳이 있는 항목의/);
});

test('코드 글 본 — 손 판 상수는 상수마다 따로 낱말로 나눈다: 앞 상수의 "/*"가 뒤 상수를 주석으로 삼키지 않는다(GPT -c GE20)', () => {
  const 코드 = 코드글본({ 글: `const a = "/*";${NL}const b = "obj.status = 'live';";${NL}`, 낱말: null });
  assert.equal(이름맞춤('status', 코드), '같음');
  assert.equal(글맞춤('live', 코드), '같음');
  assert.equal(이름맞춤('obj', 코드), '같음');
  assert.equal(이름맞춤('stat', 코드), null, '다른 이름의 일부는 여전히 아니다');
});

test('묶음 대조(문자열) — 손 판 무리는 손 고침 대본이 끼울 코드 글 안의 낱말도 소속으로 받고(코드 글 안), 다른 무리는 받지 않는다(GPT 다시 검수 GB15 · 실제 (2-2)의 D · E 공개묶음)', async t => {
  const 복사빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');${NL}`;
  // 라이브에는 손 고침 대본(docs/patch.cjs)이 끼운 가져오기 줄의 경로와 부르는 속성 이름이 있다. 대본은 그 코드를 글자 상수 하나로 지닌다.
  const 후보 = Buffer.from('var a={k:"v"};a.go();'), 라이브 = Buffer.from('var a={k:"v"};a.go("./engine.mjs");a.coachMap();');
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': String(후보), 'src/a.js': A원, 'docs/patch.cjs': `const 끼울 = 'import*as e from"./engine.mjs";e.coachMap();';${NL}` } },
    { 이름: 'wanted', 파일: { 'src/note.txt': `n${NL}` } }];
  const f = 대조저장소(t, { 빌더: 복사빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', 까닭: 'reasons.json' }) });
  까닭쓰기(f, { 무리: { 안: { 꼴: '안 쓰임', 까닭: '코드 글 안은 손 판만 받는다(합성 시험)', 파일: ['docs/patch.cjs'] } }, 글: { './engine.mjs': '안' }, 이름: { coachMap: '안' } });
  await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 2개 — 글 "\.\/engine\.mjs"\(무리 안 · 안 쓰임/, '손 판이 아닌 무리는 코드 글 안의 낱말을 받지 않는다');
  까닭쓰기(f, { 무리: { 손: { 꼴: '손 판', 까닭: '손 고침 대본이 끼운 코드다(합성 시험)', 파일: ['docs/patch.cjs'] } }, 글: { './engine.mjs': '손' }, 이름: { coachMap: '손' } });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-strings-hand-code' });
  assert.deepEqual(목록.증명.생성물.항목[0].대조.무리.map(x => [x.이름, x.코드글안]), [['손', ['글 ./engine.mjs', '이름 coachMap']]]);
  const 목록글 = fs.readFileSync(path.join(폴더, '생성물', '대조-G40-site_bundle.js-목록.md'), 'utf8');
  assert.match(목록글, /^- 글 "\.\/engine\.mjs" — 무리 손\(손 판\) · docs\/patch\.cjs · 코드 글 안$/m);
  assert.match(묶음글(폴더), /\| 손 \| 손 판 \| docs\/patch\.cjs \|  \| 1 \| 1 \| 0 · 0 \| 0 · 0 · 코드 글 안 2 \|/);
});

test('묶음 대조(문자열) — 라이브에만 있는 숫자 · 정규식도 까닭 무리와 소속 확인을 요구하고, 목록에 라이브 묶음의 둘레 글을 싣는다(설계 검토 F2)', async t => {
  const 복사빌더 = `import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');${NL}`;
  // 라이브에는 손으로 넣은 하루 한도(86400)와 거르기(/ab+c/g)가 있다. 1e3은 두 판에 다 있다.
  const 후보 = Buffer.from('var a={k:"v"};a.go(1e3);'), 라이브 = Buffer.from('var a={k:"v"};a.go(1e3,86400,/ab+c/g);');
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': String(후보), 'src/a.js': A원, 'src/hand.js': `export const DAY = 86_400, re = /ab+c/g;${NL}` } },
    { 이름: 'wanted', 파일: { 'src/note.txt': `n${NL}` } }];
  const f = 대조저장소(t, { 빌더: 복사빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', 까닭: 'reasons.json' }) });
  const 무리 = { 손: { 꼴: '손 판', 까닭: '라이브에 손으로 넣은 하루 한도와 거르기다(합성 시험)', 파일: ['src/hand.js'] } };
  까닭쓰기(f, { 무리 });
  await assert.rejects(api.준비하기(f.options), /라이브에만 있는 값 2개에 까닭이 없다 — 숫자 "86400" \/ 정규식 "\/ab\+c\/g"/);
  까닭쓰기(f, { 무리, 숫자: { 86400: '없음' } });
  assert.throws(() => 생성물명세읽기(f.specFile), /까닭 파일의 숫자는 \{ 값: 무리 이름 \}이다/);
  까닭쓰기(f, { 무리: { ...무리, 틀린: { 꼴: '손 판', 까닭: '값이 없는 파일(합성 시험)', 파일: ['src/a.js'] } }, 숫자: { 86400: '틀린' }, 정규식: { '/ab+c/g': '손' } });
  await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 1개 — 숫자 "86400"\(무리 틀린 · 손 판: 후보 원천의 무리 파일에서 못 찾음\)/, '값이 무리 파일에 없으면 멈춘다(86_400은 값으로 맞는다)');
  까닭쓰기(f, { 무리: { ...무리, 틀린: { 꼴: '손 판', 까닭: '값이 없는 파일(합성 시험)', 파일: ['src/a.js'] } }, 숫자: { 86400: '손' }, 정규식: { '/ab+c/g': '틀린' } });
  await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 1개 — 정규식 "\/ab\+c\/g"\(무리 틀린 · 손 판: 후보 원천의 무리 파일에서 못 찾음\)/, '정규식도 무리 파일에서 찾는다(GPT -d GC2)');
  까닭쓰기(f, { 무리, 숫자: { 86400: '손' }, 정규식: { '/ab+c/g': '손' } });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-strings-values' });
  const [g] = 목록.증명.생성물.항목;
  assert.deepEqual(g.대조.라이브에만, { 글: 0, 이름: 0, 숫자: 1, 정규식: 1 });
  assert.deepEqual(g.대조.무리.map(x => [x.이름, x.숫자, x.정규식]), [['손', ['86400'], ['/ab+c/g']]]);
  const 목록글 = fs.readFileSync(path.join(폴더, '생성물', '대조-G40-site_bundle.js-목록.md'), 'utf8');
  assert.match(목록글, /^- 숫자 "86400" — 무리 손\(손 판\) · src\/hand\.js · 같음\r?\n {2}둘레: "var a=\{k:\\"v\\"\};a\.go\(1e3,86400,\/ab\+c\/g\);"$/m);
  assert.match(묶음글(폴더), /라이브에만 글 0 · 이름 0 · 숫자 1 · 정규식 1\(까닭 무리 1개 · 소속 확인\)/);
});

test('JSON 구조 차이 — 원천 차이의 JSON 파일은 열쇠 단위 연산으로 한 번만 싣고(G5…) 원천 차이는 그 항목을 가리킨다. 적용해도 후보가 안 나오면(완전하지 않으면) 미충족이다', async t => {
  const 앞 = { version: 1, items: [{ id: 'a', v: 'old' }] }, 뒤 = { version: 1, items: [{ id: 'a', v: 'new' }, { id: 'b', v: 'add' }] };
  // 두 항목의 원천 차이(G10 · G11)가 같은 JSON 차이를 품는다 — 한 번만 싣고 둘 다 가리킨다(설계 주인 11-21 existing-verdicts.json)
  const f = fixture(t, { 바탕파일: { 'src/data.json': `${JSON.stringify(앞, null, 2)}${NL}` }, 바란파일: { 'src/data.json': `${JSON.stringify(뒤, null, 2)}${NL}` },
    명세고침: x => ({ ...x, 항목: [...x.항목, { 경로: 'site/copy.txt', 만든곳: '.tmp/out/bundle.txt', 바탕: x.항목[0].바탕, 원천경로: ['src/data.json'] }] }) });
  f.write(path.join(f.candidate, 'site/copy.txt'), 몸);
  f.write(path.join(f.candidate, '.앞판/site/copy.txt'), 바탕몸);
  f.write(path.join(f.candidate, '후보.json'), JSON.stringify({ 판: 1, 종류: 'synk.im', 항목: ['site/bundle.txt', 'site/copy.txt'].map(경로 => ({ 경로, 종류: '바꿈', 모드: '100644', sha256: sha(몸) })),
    앞판: { 'site/bundle.txt': 블롭번호(바탕몸), 'site/copy.txt': 블롭번호(바탕몸) } }));
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-json' });
  const [j, ...남음] = 목록.증명.생성물.JSON차이;
  assert.equal(남음.length, 0, '같은 JSON 차이는 한 번만 기록한다');
  assert.deepEqual([j.앞, j.경로, j.완전, j.연산수], ['G50', 'src/data.json', true, 2]);
  const 글 = 묶음글(폴더);
  assert.equal(글.match(/\(JSON 구조 차이 — \[G50\]에 한 번 싣는다 · 연산 2개 · 완전\)/g)?.length, 2, '두 원천 차이가 같은 구조 차이 항목을 가리킨다');
  assert.match(글, /바꿈 \$\.items\[id="a"\]\.v: "old" → "new"/);
  assert.match(글, /더함 \$\.items\[id="b"\]: \{"id":"b","v":"add"\}/);
  assert.doesNotMatch(글, /^[-+]\s+"v": "(?:old|new)"/m, 'JSON 파일은 줄 차이로 싣지 않는다');
  assert.equal(글.split('바꿈 $.items[id="a"].v').length - 1, 1, '구조 차이는 한 번만 싣는다');
  assert.ok(fs.existsSync(path.join(폴더, '생성물', 'JSON차이-G50-src_data.json.md')));
  assert.match(fs.readFileSync(path.join(폴더, '생성물', '원천차이-1.patch'), 'utf8'), /\[G50\]에 한 번 싣는다/);
  await 카본보내기(폴더, 목록);
  const r = api.검수확인(폴더, { 저장소: f.repo });
  표시만(r, (r.사유 || []).join(' / '));
  // 적용해도 후보가 안 나오면 미충족 — 도구가 완전하지 않다고 적은 증명(봉인까지 맞춘 것)은 처음 고리 판정이 막는다
  const 목록파일 = path.join(폴더, '묶음.json'), 원래 = fs.readFileSync(목록파일, 'utf8');
  const 봉인 = 증명 => { const { 검토입력해시, 표식, ...몸글 } = 증명; const h = 정규해시(몸글); return { ...몸글, 검토입력해시: h, 표식: `END_OF_FINAL_REVIEW_${h}` }; };
  const 고친 = JSON.parse(원래);
  고친.증명.생성물.JSON차이[0].완전 = false;
  고친.증명 = 봉인(고친.증명);
  fs.writeFileSync(목록파일, JSON.stringify(고친, null, 1));
  const 막힘 = api.검수확인(폴더, { 저장소: f.repo });
  assert.ok(표시뺀(막힘).length > 0);
  assert.ok(막힘.사유.some(s => /JSON 구조 차이 G50\(src\/data\.json\)가 완전하지 않다/.test(s)), 막힘.사유.join(' / '));
  // 구조 차이 항목이 묶음에서 빠져도 막는다
  const 빠진 = JSON.parse(원래);
  for (const b of 빠진.묶음) b.항목 = b.항목.filter(id => !/^G50(?:z\d+)?-/.test(id));
  fs.writeFileSync(목록파일, JSON.stringify(빠진, null, 1));
  const 빠짐 = api.검수확인(폴더, { 저장소: f.repo });
  assert.ok(빠짐.사유.some(s => /JSON 구조 차이 G50\(src\/data\.json\) 항목이 검수 묶음에 없다/.test(s)), 빠짐.사유.join(' / '));
});

test('묶음 대조(모듈) — 모듈 대조로 대신한 항목만 쓰는 원천 차이(G1…)는 묶음에 싣지 않고 증거 파일로만 남긴다. 설명으로 넘기는 JSON 모듈은 값의 구조 차이로 싣는다', async t => {
  const 데이터빌더 = `import fs from 'node:fs';const L=String.fromCharCode(10);let o='/*HEAD*/'+L;for(const p of ['src/a.js','src/b.js'])if(fs.existsSync(p))o+='// '+p+L+fs.readFileSync(p,'utf8');const d=JSON.parse(fs.readFileSync('src/data.json','utf8'));o+='// src/data.json'+L+'var data_default = '+JSON.stringify(d).replace(/"([a-z]+)":/g,'$1: ')+';'+L;o+='export {'+L+'  fa'+L+'};'+L;fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.js',o);${NL}`;
  const 데이터 = v => `${JSON.stringify(v, null, 2)}${NL}`, 모듈글 = v => `var data_default = ${JSON.stringify(v).replace(/"([a-z]+)":/g, '$1: ')};${NL}`;
  // 라이브 JSON 모듈(옛)은 어느 커밋도 짓지 않는다(바탕은 draft) — 설명으로 넘긴다
  const 옛 = { items: [{ id: 'a', review: { status: 'passed' } }] }, 새 = { items: [{ id: 'a', review: { status: 'passed', task: 't1' } }] };
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/a.js': A원, 'src/b.js': `var y = "old";${NL}`, 'src/data.json': 데이터({ items: [{ id: 'a', review: { status: 'draft' } }] }) } }, { 이름: 'wanted', 파일: { 'src/b.js': `var y = "new";${NL}`, 'src/data.json': 데이터(새) } }];
  const 후보 = 묶음([['src/a.js', A원], ['src/b.js', `var y = "new";${NL}`], ['src/data.json', 모듈글(새)]]);
  const 라이브 = 묶음([['src/a.js', A원], ['src/b.js', `var y = "hand";${NL}`], ['src/data.json', 모듈글(옛)]]);
  const f = 대조저장소(t, { 빌더: 데이터빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '모듈', 까닭: 'reasons.json' }) });
  까닭쓰기(f, { 모듈: { 'src/b.js': 'hand 판은 손으로 얹었다(합성 시험)', 'src/data.json': '검수 기록 칸이 더해졌다(합성 시험)' } });
  const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-json-module' });
  const [g] = 목록.증명.생성물.항목;
  assert.deepEqual(g.대조.설명.map(x => x.경로), ['src/b.js', 'src/data.json']);
  const [j] = 목록.증명.생성물.JSON차이;
  assert.deepEqual([j.앞, j.경로, j.모듈, j.완전, j.연산수], ['G50', 'src/data.json', true, true, 1]);
  const 글 = 묶음글(폴더);
  assert.doesNotMatch(글, /### \[G10-/, '모듈 대조로 대신한 항목만 쓰는 원천 차이는 싣지 않는다');
  assert.ok(fs.existsSync(path.join(폴더, '생성물', '원천차이-1.patch')), '원천 차이 증거 파일은 남는다');
  assert.match(글, /더함 \$\.items\[id="a"\]\.review\.task: "t1"/);
  assert.match(글, /## src\/data\.json\r?\n까닭: 검수 기록 칸이 더해졌다\(합성 시험\)\r?\n--- a\/src\/data\.json\r?\n\+\+\+ b\/src\/data\.json\r?\n\(JSON 구조 차이 — \[G50\]에 한 번 싣는다/);
  await 카본보내기(폴더, 목록);
  const r = api.검수확인(폴더, { 저장소: f.repo });
  표시만(r, (r.사유 || []).join(' / '));
});

test('JSON 모듈 — 후보 모듈 값이 후보 원천 파일과 다르거나 라이브 모듈에 값 밖 코드가 있으면 구조 차이로 싣지 않고 정리한 글 차이로 싣는다', async t => {
  const 빌더글 = 더함 => `import fs from 'node:fs';const L=String.fromCharCode(10);let o='/*HEAD*/'+L;for(const p of ['src/a.js','src/b.js'])if(fs.existsSync(p))o+='// '+p+L+fs.readFileSync(p,'utf8');const d=JSON.parse(fs.readFileSync('src/data.json','utf8'));${더함}o+='// src/data.json'+L+'var data_default = '+JSON.stringify(d).replace(/"([a-z]+)":/g,'$1: ')+';'+L;o+='export {'+L+'  fa'+L+'};'+L;fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.js',o);${NL}`;
  const 데이터 = v => `${JSON.stringify(v, null, 2)}${NL}`, 모듈글 = v => `var data_default = ${JSON.stringify(v).replace(/"([a-z]+)":/g, '$1: ')};${NL}`;
  const 옛 = { items: [{ id: 'a', review: { status: 'passed' } }] }, 새 = { items: [{ id: 'a', review: { status: 'passed', task: 't1' } }] };
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/a.js': A원, 'src/b.js': `var y = "old";${NL}`, 'src/data.json': 데이터({ items: [] }) } }, { 이름: 'wanted', 파일: { 'src/b.js': `var y = "new";${NL}`, 'src/data.json': 데이터(새) } }];
  const 보기 = async (t, { 빌더, 후보값, 라이브값 = 옛, 라이브꼬리 = '', 더볼 = null }) => {
    const 후보 = 묶음([['src/a.js', A원], ['src/b.js', `var y = "new";${NL}`], ['src/data.json', 모듈글(후보값)]]);
    const 라이브 = 묶음([['src/a.js', A원], ['src/b.js', `var y = "hand";${NL}`], ['src/data.json', `${모듈글(라이브값)}${라이브꼬리}`]]);
    const f = 대조저장소(t, { 빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '모듈', 까닭: 'reasons.json' }) });
    까닭쓰기(f, { 모듈: { 'src/b.js': '손으로 얹었다(합성 시험)', 'src/data.json': '칸이 바뀌었다(합성 시험)' } });
    const { 폴더, 목록 } = await api.준비하기({ ...f.options, 이름: 'gen-compare-json-module-fallback' });
    assert.equal(목록.증명.생성물.JSON차이, undefined, '구조 차이를 싣지 않는다');
    const 글 = 묶음글(폴더);
    assert.doesNotMatch(글, /JSON 구조 차이 — \[G5/);
    assert.match(글, /## src\/data\.json\r?\n까닭: 칸이 바뀌었다\(합성 시험\)\r?\n--- a\/src\/data\.json\r?\n\+\+\+ b\/src\/data\.json\r?\n@@/, '정리한 글 차이');
    if (더볼) 더볼(글);
  };
  await t.test('후보 모듈 값이 원천 파일과 다름(빌더가 값을 바꿈)', t => 보기(t, { 빌더: 빌더글('d.extra=1;'), 후보값: { ...새, extra: 1 } }));
  await t.test('라이브 모듈에 값 밖 코드', t => 보기(t, { 빌더: 빌더글(''), 후보값: 새, 라이브꼬리: `data_default.items.length = 0;${NL}` }));
  // 값은 같고 값 밖 코드만 다르다 — 값 차이로는 가릴 수 없으니 그 줄이 지운 줄로 실려야 한다(GPT -c C2)
  await t.test('값은 같고 라이브 모듈에만 값 밖 코드', t => 보기(t, { 빌더: 빌더글(''), 후보값: 새, 라이브값: 새, 라이브꼬리: `data_default.items.length = 0;${NL}`,
    더볼: 글 => assert.match(글, /^-data_default \. items \. length = 0 ;\r?$/m, '값 밖 코드가 정리한 글에서 지운 줄로 보인다') }));
});

// ── GPT 다시 검수 -d의 (ㄷ): 실제 재료에 없는 꼴에서 「같다」로 새던 곳을 감지해서 멈추거나 다름으로 닫는다(설계 주인 11-21) ──────────────
test('GPT -d — 빌더 인자의 --a=절대 경로는 입력 칸에 적어도 받지 않는다: 입력 사본으로 바꿔 끼울 수 없어 원본이 넘어간다(GD1)', t => {
  const f = fixture(t, { 명세고침: (x, c) => { const p = path.join(c.dir, 'cfg.json'); fs.writeFileSync(p, '{}'); return { ...x, 입력: [p], 빌더: [['tools/build.mjs', `--config=${p}`]] }; } });
  assert.throws(() => 생성물명세읽기(f.specFile), /빌더 인자의 절대 경로는 따로 인자로 적는다/);
});

test('GPT -d — 빌더 대본 경로의 마디가 링크면(잇기 안 대본) 사본 밖 대본을 돌리지 않고 멈춘다(GD2)', async t => {
  const 원본 = fs.mkdtempSync(path.join(시험임시, 'deps-builder-'));
  fs.writeFileSync(path.join(원본, 'build.mjs'), "import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt','x');\n");
  const f = fixture(t, { 명세고침: x => ({ ...x, 잇기: [{ 경로: 'deps', 원본 }], 빌더: [['deps/build.mjs']] }) });
  let 잡음 = null;
  await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /빌더 대본 경로에 링크가 있다: deps\/build\.mjs\(deps\)/.test(e.message); });
  t.after(() => 남은사본지우기(잡음));
});

test('GPT -d — 원천경로 항목의 마디(위 마디 · 항목 자체)가 링크면 링크를 따라 사본 밖 파일을 원천 차이로 읽지 않고 멈춘다(GD3)', t => {
  const 뿌리 = fs.mkdtempSync(path.join(시험임시, 'src-root-')), 밖 = fs.mkdtempSync(path.join(시험임시, 'src-outside-'));
  fs.writeFileSync(path.join(밖, 'config.mjs'), 'export default 1;');
  fs.symlinkSync(밖, path.join(뿌리, 'src'), process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => { try { fs.unlinkSync(path.join(뿌리, 'src')); } catch { /* 없음 */ } });
  assert.throws(() => 파일모음(뿌리, ['src/config.mjs'], []), /원천경로 src\/config\.mjs의 마디가 링크다\(src\)/, '위 마디가 링크');
  assert.throws(() => 파일모음(뿌리, ['src'], []), /원천경로 src의 마디가 링크다\(src\)/, '항목 자체가 링크');
  fs.mkdirSync(path.join(뿌리, 'real'));
  fs.writeFileSync(path.join(뿌리, 'real', 'a.txt'), 'a');
  const 모음 = 파일모음(뿌리, ['real', 'none'], []);
  assert.deepEqual([...모음.keys()], ['real/a.txt'], '링크가 없으면 그대로 모은다');
  assert.deepEqual(모음.없음, ['none']);
  assert.equal(fs.readFileSync(path.join(밖, 'config.mjs'), 'utf8'), 'export default 1;');
});

test('GPT -d — 잇기 원본을 뜨는 사이 링크가 생겨 사본에 링크가 떠지면 멈춘다(GD4)', async t => {
  const 원본 = fs.mkdtempSync(path.join(시험임시, 'deps-copy-')), 밖 = fs.mkdtempSync(path.join(시험임시, 'deps-outside-'));
  fs.writeFileSync(path.join(원본, 'keep.txt'), 'k');
  fs.writeFileSync(path.join(밖, 'shared.txt'), 's');
  // 원본의 링크 검사를 지난 뒤 뜨는 사이에 원본에 링크가 생긴 경우를 흉내 낸다 — 사본에 링크가 떠진다
  const 원래 = fs.cpSync;
  fs.cpSync = (a, b, o) => { 원래(a, b, o); if (path.resolve(a) === path.resolve(원본)) fs.symlinkSync(밖, path.join(b, 'late-link'), process.platform === 'win32' ? 'junction' : 'dir'); };
  t.after(() => { fs.cpSync = 원래; });
  const f = fixture(t, { 명세고침: x => ({ ...x, 잇기: [{ 경로: 'deps', 원본 }] }) });
  let 잡음 = null;
  await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /잇기 사본 안에 링크가 있다: deps — late-link/.test(e.message); });
  fs.cpSync = 원래;
  t.after(() => 남은사본지우기(잡음));
  assert.equal(fs.readFileSync(path.join(밖, 'shared.txt'), 'utf8'), 's', '링크 너머 파일은 그대로다');
});

test('GPT -d — 빌드가 입력 사본 폴더에 다른 파일(입력 옆 캐시)을 만들면 다음 빌드가 그 파일을 읽지 않게 멈춘다(GD5)', async t => {
  const 빌더 = "import fs from 'node:fs';import path from 'node:path';const p=process.argv[process.argv.indexOf('--config')+1];fs.writeFileSync(path.join(path.dirname(p),'cache.json'),'{}');fs.mkdirSync('.tmp/out',{recursive:true});fs.writeFileSync('.tmp/out/bundle.txt','/*BUILT*/'+fs.readFileSync('src/msg.txt','utf8')+fs.readFileSync('src/other.txt','utf8'));\n";
  const f = fixture(t, { 바탕파일: { 'tools/build.mjs': 빌더 }, 명세고침: (x, c) => { const p = path.join(c.dir, 'cfg.json'); fs.writeFileSync(p, '{}'); return { ...x, 입력: [p], 빌더: [['tools/build.mjs', '--config', p]] }; } });
  let 잡음 = null;
  await assert.rejects(api.준비하기(f.options), e => { 잡음 = e; return /빌더가 입력 사본 폴더에 다른 파일을 만들었다: 입력\/1\/cache\.json/.test(e.message); });
  t.after(() => 남은사본지우기(잡음));
  assert.equal(fs.existsSync(path.join(f.dir, 'cache.json')), false, '사본 밖(입력 원본 옆)에는 쓰지 않았다');
});

test('GPT -d — 완성 묶음은 표준 ES 모듈로 읽혀야 하고(GD7), 맨 위 문장이 모듈 표지 경계를 넘으면 조각마다 견주지 않고 멈춘다(GE1)', () => {
  const 느슨 = Buffer.from('/*HEAD*/\n// src/a.js\nconst f = () => 1;\n{ export { f }; }\n'), 보통 = Buffer.from('/*HEAD*/\n// src/a.js\nconst f = () => 1;\nexport { f };\n');
  assert.throws(() => acorn.parse(String(느슨), { ecmaVersion: 'latest', sourceType: 'module' }), '표준 파서는 읽지 못한다');
  assert.equal(묶음대조(느슨, 보통), null, '모듈 대조가 서지 않는다(실행할 수 없는 묶음)');
  assert.throws(() => 문자열대조(보통, 느슨), /문자열 대조: 묶음을 표준 ES 모듈로 읽지 못했다/);
  // 선언 없는 이름을 내보내는 묶음은 모듈 나누기를 지나고 표준 파서만 거절한다 — 모듈 대조의 표준 모듈 확인을 가른다(변이 시험)
  const 느슨2 = Buffer.from('/*HEAD*/\n// src/a.js\nconst f = () => 1;\n// src/b.js\nvar y = 2;\nexport {\n  g\n};\n'), 보통2 = Buffer.from('/*HEAD*/\n// src/a.js\nconst f = () => 1;\n// src/b.js\nvar y = 2;\nexport {\n  f\n};\n');
  assert.ok(모듈나누기(느슨2), '모듈 나누기는 지난다');
  assert.equal(묶음대조(느슨2, 보통2), null, '선언 없는 이름을 내보내는 묶음도 모듈 대조가 서지 않는다');
  // 앞 조각 끝의 ;를 빼면 조각마다의 나무는 그대로인데, 묶음 전체에서는 run()의 반환값을 부르는 한 식이 된다
  const 앞 = 묶음([['src/a.js', 'globalThis.run();\n'], ['src/b.js', '(globalThis.after)();\n']]), 뒤 = 묶음([['src/a.js', 'globalThis.run()\n'], ['src/b.js', '(globalThis.after)();\n']]);
  assert.throws(() => 묶음대조(앞, 뒤), /묶음 대조: 후보 묶음의 맨 위 문장이 모듈 표지 경계를 넘는다/);
  assert.throws(() => 묶음대조(뒤, 앞), /묶음 대조: 라이브 묶음의 맨 위 문장이 모듈 표지 경계를 넘는다/);
});

test('GPT -d — .name 직접 읽기: 기본값 · 논리 대입이 붙인 이름(GD9), this["constructor"](GD10), 화살 함수 안 new.target(GD11). 원문을 직접 읽으면(X.toString) 글이 다를 때 다름이다(GD12)', () => {
  const 같음 = (a, b) => 같은코드(a, b).같음;
  assert.equal(같음('function f(handler = () => 0) { return handler.name; }', 'function f(handler2 = () => 0) { return handler2.name; }'), false, '인자 기본값');
  assert.equal(같음('let handler; handler ??= () => 0; var n = handler.name;', 'let handler2; handler2 ??= () => 0; var n = handler2.name;'), false, '논리 대입');
  assert.equal(같음('var { a: h = () => 0 } = {}; var n = h.name;', 'var { a: h2 = () => 0 } = {}; var n = h2.name;'), false, '구조 분해 기본값');
  assert.equal(같음('class Maker { who() { return this["constructor"].name; } }', 'class Maker2 { who() { return this["constructor"].name; } }'), false, 'this["constructor"]');
  assert.equal(같음('function Maker() { const read = () => new.target.name; this.label = read(); }', 'function Maker2() { const read = () => new.target.name; this.label = read(); }'), false, '화살 함수 안 new.target은 바깥 함수');
  assert.equal(같음('class A { constructor() { this.n = new.target.name; } }', 'class A2 { constructor() { this.n = new.target.name; } }'), false, '생성자 안 new.target은 그 클래스');
  const 다른함수 = 같은코드('class A { constructor() { this.n = new.target.name; } } function g() {} g();', 'class A { constructor() { this.n = new.target.name; } } function g2() {} g2();');
  assert.equal(다른함수.같음, true, '생성자 안 new.target이 가리키는 클래스는 이름이 그대로다 — 다른 함수 이름 바뀜은 다름이 아니다');
  assert.deepEqual(다른함수.함수바뀜, [['g', 'g2']]);
  const 모름 = 같은코드('var o = { m: function () { return new.target.name; } }; function g() {} g();', 'var o = { m: function () { return new.target.name; } }; function g2() {} g2();');
  assert.equal(모름.같음, false, '어느 함수의 .name인지 가릴 수 없는 직접 읽기가 있으면 이름 바뀜은 다름이다');
  assert.match(모름.왜, /어느 함수의 \.name인지 가릴 수 없는 직접 읽기/);
  const 원문 = 같은코드('function f(){return 1}var s = f.toString();', 'function f() { return 1 }var s = f.toString();');
  assert.equal(원문.같음, false, 'X.toString');
  assert.match(원문.왜, /함수 · 클래스 f의 원문을 직접 읽는다/);
  assert.equal(같음('function f(){return 1}var s = f.toString();', 'function f(){return 1}var s = f.toString();'), true, '글이 같으면 같은 코드');
  // 묶음 맨 위: 다른 모듈에서 원문을 읽어도 그 함수를 선언한 모듈의 글이 다르면 바뀜이다
  const r = 묶음대조(묶음([['src/x.js', 'function f(){return 1}\n'], ['src/m.js', 'var s = f.toString();\n']]), 묶음([['src/x.js', 'function f() { return 1 }\n'], ['src/m.js', 'var s = f.toString();\n']]));
  const x = r.경로.find(e => e.경로 === 'src/x.js');
  assert.equal(x.꼴, '바뀜');
  assert.match(x.어긋남, /함수 · 클래스 f의 원문을 묶음에서 직접 읽는다/);
});

test('GPT -d — 묶음 머리의 입력 목록이 빈 줄로 끊기고 다시 「// 경로」 줄이 나오면 앞부분만으로 덮음을 판정하지 않고 멈춘다(GE2)', () => {
  assert.throws(() => 머리입력읽기(Buffer.from('// world/a.mjs\n\n// vendor/b.mjs\nconst x = 1;\n')), /묶음 머리의 입력 목록이 빈 줄로 끊겼다 — 끊긴 뒤 다시 나온 줄 "\/\/ vendor\/b\.mjs"/);
  assert.throws(() => 머리입력읽기(Buffer.from('// world/a.mjs\r\n \r\n\r\n// vendor/b.mjs\r\nconst x = 1;\r\n')), /빈 줄로 끊겼다/, 'CRLF · 빈칸만 있는 줄도 빈 줄이다');
  assert.deepEqual(머리입력읽기(Buffer.from('// world/a.mjs\n\nconst x = 1; // 꼬리 주석\n')), ['world/a.mjs'], '빈 줄 뒤 코드 줄은 머리 끝이다');
});

test('GPT -d — 생성물 증거 파일 이름이 겹치면(경로의 / → _) 앞 항목의 증거가 덮이지 않게 멈춘다(GE4)', () => {
  const 재현 = { 원천: 'x', 결과: [{ 경로: 'world/label/text.css', 바탕재현: false }, { 경로: 'world/label_text.css', 바탕재현: false }], 기록: [], 원천차이: [], 되돌림차이: [] };
  const 앞판 = new Map([['world/label/text.css', Buffer.from('a')], ['world/label_text.css', Buffer.from('b')]]), 정보 = { 원문: '{}', 대본: [] };
  assert.throws(() => 생성물증거쓰기(fs.mkdtempSync(path.join(시험임시, 'evidence-')), 정보, 재현, { 앞판 }), /생성물 증거 파일 이름이 겹친다: 앞판-world_label_text\.css/);
  const 쓴 = 생성물증거쓰기(fs.mkdtempSync(path.join(시험임시, 'evidence-')), 정보, { ...재현, 결과: 재현.결과.slice(0, 1) }, { 앞판 });
  assert.deepEqual(쓴.filter(x => x.startsWith('생성물/앞판-')), ['생성물/앞판-world_label_text.css'], '겹치지 않으면 쓴다');
});

test('GPT -d — 소속 맞춤은 전체 구문 분석으로 읽힌 무리 파일의 낱말만 쓴다: 토크나이저가 나누기를 정규식으로 읽은 곳 · 전체로 읽히지 않는 파일은 소속이 아니다(GD8)', async t => {
  const 복사빌더 = "import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');\n";
  const 후보 = Buffer.from('var a={k:"v"};a.go();'), 라이브 = Buffer.from('var a={k:"v"};a.go(/x/g,/y/g,"READY");a.legacy();');
  // src/div.js: 함수 식 뒤 「/x/g」는 나누기 둘이다(토크나이저는 정규식 하나로 읽는다). src/jsx.js: JSX가 있어 전체 구문 분석으로 읽히지 않는다 —
  // 토크나이저로는 /y/g · "READY" · legacy가 다 보이지만 맞춤 셋(글 · 이름 · 값)이 모두 받지 않는다.
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': String(후보), 'src/a.js': A원, 'src/div.js': 'export const n = async function f() {} /x/g;\n', 'src/jsx.js': 'export const t = "READY", re = /y/g;\nexport function legacy() {}\nconst v = <div />;\n' } },
    { 이름: 'wanted', 파일: { 'src/note.txt': 'n\n' } }];
  const f = 대조저장소(t, { 빌더: 복사빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', 까닭: 'reasons.json' }) });
  까닭쓰기(f, { 무리: { 나눔: { 꼴: '옮겨감', 까닭: '나누기를 정규식으로 적음(합성 시험)', 파일: ['src/div.js'] }, 못읽음: { 꼴: '옮겨감', 까닭: '전체로 읽히지 않는 파일(합성 시험)', 파일: ['src/jsx.js'] } }, 정규식: { '/x/g': '나눔', '/y/g': '못읽음' }, 글: { READY: '못읽음' }, 이름: { legacy: '못읽음' } });
  await assert.rejects(api.준비하기(f.options), e => /무리에 들지 않는 값 4개/.test(e.message) && /글 "READY"\(무리 못읽음 · 옮겨감/.test(e.message) && /이름 "legacy"\(무리 못읽음 · 옮겨감/.test(e.message)
    && /정규식 "\/x\/g"\(무리 나눔 · 옮겨감/.test(e.message) && /정규식 "\/y\/g"\(무리 못읽음 · 옮겨감/.test(e.message));
});

test('GPT -d — 커밋이 뺌은 그 커밋 판 파일이 없거나 전체 구문 분석으로 읽혀 값을 못 찾을 때만 받는다: 읽지 못한 판을 「없음」으로 세지 않는다(GE3)', async t => {
  const 복사빌더 = "import fs from 'node:fs';fs.mkdirSync('.tmp/out',{recursive:true});fs.copyFileSync('src/acct.js','.tmp/out/bundle.js');\n";
  const 후보 = Buffer.from('var a={k:"v"};a.go();'), 라이브 = Buffer.from('var a={k:"v"};a.go("READY");');
  // 뺐다고 적은 커밋의 판에 값이 그대로 있지만 JSX가 들어 전체 구문 분석도 토크나이저도 읽지 못한다
  const 커밋들 = [{ 이름: 'base', 파일: { 'src/acct.js': String(후보), 'src/a.js': A원, 'src/view.js': 'export const kept = "READY";\n' } },
    { 이름: 'wanted', 파일: { 'src/view.js': 'export const kept = "READY";\nconst v = <div>/x/</div>;\n' } }];
  const f = 대조저장소(t, { 빌더: 복사빌더, 커밋들, 후보, 라이브, 항목: () => ({ 대조: '문자열', 까닭: 'reasons.json' }) });
  까닭쓰기(f, { 무리: { 뺌: { 꼴: '커밋이 뺌', 까닭: '뺐다고 적었지만 값이 남았다(합성 시험)', 파일: ['src/view.js'], 커밋: f.커밋.wanted } }, 글: { READY: '뺌' } });
  await assert.rejects(api.준비하기(f.options), /무리에 들지 않는 값 1개 — 글 "READY"\(무리 뺌 · 커밋이 뺌: [0-9a-f]{10}의 앞 판 파일에 있고 그 판에 없는 곳을 못 찾음 — 그 판의 src\/view\.js을 전체 구문 분석으로 읽지 못해 없음을 증명하지 않았다\)/);
});

test('GPT -d — 두 판 차이: 낱말 차이가 두 판을 다 담지 못하면(한쪽에만 더하거나 옮긴 줄바꿈 · 한쪽에만 없는 끝 줄바꿈) 줄 차이를 싣는다(GE5)', () => {
  const 긴 = 'const s = "' + 'x'.repeat(450) + '";';
  const 꼴 = (a, b) => api.두판diff(Buffer.from(a), Buffer.from(b), 'world/x.mjs').꼴;
  assert.equal(꼴('function f() { return null; }\n' + 긴 + ' n = 1;\n', 'function f() { return \nnull; }\n' + 긴 + ' n = 2;\n'), 'diff', 'return 뒤에 더한 줄바꿈 — 낱말 차이에는 보이지 않는다');
  assert.equal(꼴(긴 + '\na\nb c\n', 긴 + '\na b\nc\n'), 'diff', '옮긴 줄바꿈');
  assert.equal(꼴(긴 + ' n = 1;\n', 긴 + ' n = 2;'), 'diff', '한쪽에만 없는 끝 줄바꿈');
  assert.equal(꼴(긴 + ' n = 1;\nok\n', 긴 + ' n = 2;\nok\n'), '낱말', '보통 긴 줄 바뀜은 낱말 차이');
  assert.equal(꼴(긴 + ' n = 1;\r\nok\r\n', 긴 + ' n = 2;\r\nok\r\n'), '낱말', 'CRLF도 낱말 차이');
  assert.equal(꼴(긴 + ' n = 1;', 긴 + ' n = 2;'), '낱말', '끝 줄바꿈이 둘 다 없어도 낱말 차이');
  assert.equal(api.낱말차이온전('diff --git a/a b/b\n@@ -1 +1 @@\n x\n-a\n+b\n~\n', 'diff --git a/a b/b\n@@ -1 +1 @@\n-xa\n+xb\n'), true);
  assert.equal(api.낱말차이온전('diff --git a/a b/b\n@@ -1 +1,2 @@\n x \n~\n y\n~\n', 'diff --git a/a b/b\n@@ -1 +1,2 @@\n-x y\n+x \n+y\n'), false, '두 판을 다 담지 못하는 낱말 차이');
  // 첫 검수 묶음의 긴 줄 파일(파일diff — 저장소의 git 차이)도 같다
  const repo = fs.mkdtempSync(path.join(시험임시, 'wd-repo-'));
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(repo, 'none') };
  const g = (...a) => execFileSync('git', ['-C', repo, '-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], { env, encoding: 'utf8' });
  g('init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'x.mjs'), 'function f() { return null; }\n' + 긴 + ' n = 1;\n');
  g('add', '.'); g('commit', '-qm', 'base');
  const 설정 = { 저장소: repo, 바탕: { 커밋: g('rev-parse', 'HEAD').trim() }, 끝: '작업본' };
  fs.writeFileSync(path.join(repo, 'x.mjs'), 'function f() { return \nnull; }\n' + 긴 + ' n = 2;\n');
  assert.equal(api.파일diff({ 상태: 'M', 경로: 'x.mjs' }, 설정).꼴, 'diff', '첫 검수 묶음도 return 뒤에 더한 줄바꿈이 있으면 줄 차이');
  fs.writeFileSync(path.join(repo, 'x.mjs'), 'function f() { return null; }\n' + 긴 + ' n = 2;\n');
  assert.equal(api.파일diff({ 상태: 'M', 경로: 'x.mjs' }, 설정).꼴, '낱말', '첫 검수 묶음의 보통 긴 줄 바뀜은 낱말 차이');
});

test('생성물 칸은 허용 목록의 명세에만 쓴다: 목록 밖 명세는 준비가 멈추고, 시험 표지로 지은 증명은 「허용 목록 건너뜀」 표시가 남아 표지가 꺼져 있든 켜져 있든 확인이 막는다(설계 주인 11-22)', async t => {
  const f = fixture(t);
  const { 폴더, 목록 } = await api.준비하기(f.options);   // 시험 표지(SYNK_생성물_시험)로 지은 검수
  assert.equal(목록.증명.생성물.허용목록건너뜀, true, '시험 표지로 지은 증명에는 표시가 남는다');
  await 카본보내기(폴더, 목록);
  표시만(api.검수확인(폴더, { 저장소: f.repo }), '표지가 켜져 있어도 그 표시 하나로 막는다');
  delete process.env.SYNK_생성물_시험;
  t.after(() => { process.env.SYNK_생성물_시험 = '1'; });
  assert.throws(() => 생성물명세읽기(f.specFile), /생성물 칸은 허용 목록의 명세에만 쓴다[^\n]*sha256 [0-9a-f]{12}는 목록 밖이다/);
  await assert.rejects(api.준비하기({ ...f.options, 이름: 'gen-allow-out', 폴더: path.join(f.dir, 'packet-out') }), /생성물 칸은 허용 목록의 명세에만 쓴다/);
  const r = api.검수확인(폴더, { 저장소: f.repo });
  assert.equal(r.통과, false);
  assert.ok(r.사유.some(x => 표시사유.test(x)), '표지가 꺼져 있어도 표시로 막는다 — ' + r.사유.join(' / '));
  assert.ok(r.사유.some(x => /생성물 명세 sha256 [0-9a-f]{12}가 허용 목록 밖이다/.test(x)), r.사유.join(' / '));
  assert.deepEqual(Object.values(생성물허용명세), ['WORLD 선택 공개 2단계 (2-2) 계정 · 생활 묶음 · 생활 css(spec-2-2r)'], '허용 목록은 (2-2) 명세 하나다');
  assert.ok(Object.keys(생성물허용명세).every(k => /^[0-9a-f]{64}$/.test(k)));
});
