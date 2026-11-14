'use strict';
// 화면·백엔드 검수 묶음 도구(tools/검수묶음.mjs)의 묶기·대조·지적표·집계. 아르곤·Fable은 부르지 않는다(가짜 call).
// 임시 git 저장소에서 준비부터 집계까지 돌리고, 브라우저를 띄울 수 있으면 전후 캡처(바뀐 파일만 바탕 판으로 끼우기)도 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const tool = () => import(pathToFileURL(path.join(root, 'tools/검수묶음.mjs')));

// 시험 git은 이 PC·CI의 전역 설정(autocrlf 등)을 읽지 않는다.
for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-review-test-no-global-config'), GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid' });
// 셸에 GPT 검수 모델 바꿈(SYNK_GPT_REVIEW_MODEL)이 남아 있어도 시험은 기본값에서 시작한다 — 바꿈을 보는 시험이 스스로 켜고 끈다.
delete process.env.SYNK_GPT_REVIEW_MODEL;

function 임시저장소(t, 파일 = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 저장소 = path.join(뿌리, 'repo');
  fs.mkdirSync(저장소);
  const g = (...a) => execFileSync('git', ['-C', 저장소, '-c', 'core.autocrlf=false', ...a], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  g('init', '-q', '-b', 'main');
  const 쓰기 = (p, v) => { const f = path.join(저장소, ...p.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); };
  for (const [p, v] of Object.entries(파일)) 쓰기(p, v);
  g('add', '-A'); g('commit', '-q', '-m', '바탕');
  return { 뿌리, 저장소, g, 쓰기, 바탕: g('rev-parse', 'HEAD').trim(), 출력: path.join(뿌리, 'out') };
}

test('git 읽기: name-status·numstat의 이름 바뀜과 이진, glob', async () => {
  const { 이름상태읽기, 줄수읽기, glob식 } = await tool();
  assert.deepEqual(이름상태읽기('M\0a.js\0R087\0old/b.js\0new/b.js\0A\0c 공백.md\0'), [
    { 상태: 'M', 경로: 'a.js' }, { 상태: 'R', 옛경로: 'old/b.js', 경로: 'new/b.js' }, { 상태: 'A', 경로: 'c 공백.md' }]);
  const 수 = 줄수읽기('3\t1\ta.js\0-\t-\timg.png\0' + '2\t2\t\0old/b.js\0new/b.js\0');
  assert.deepEqual(수.get('a.js'), { 더함: 3, 뺌: 1, 이진: false });
  assert.deepEqual(수.get('img.png'), { 더함: null, 뺌: null, 이진: true });
  assert.deepEqual(수.get('new/b.js'), { 더함: 2, 뺌: 2, 이진: false });
  assert.ok(glob식('**/dist/**').test('experiences/x/dist/app.js'));
  assert.ok(glob식('**/*.min.js').test('a.min.js'));
  assert.ok(!glob식('**/dist/**').test('distance/app.js'));
});

test('낱말 diff: 긴 줄의 바뀐 낱말만 앞뒤 맥락과 줄 번호로', async () => {
  const { 낱말줄이기 } = await tool();
  const porcelain = ['diff --git a/v.mjs b/v.mjs', '--- a/v.mjs', '+++ b/v.mjs', '@@ -56 +56 @@', ` ${'앞'.repeat(200)}`, '-옛 글', '+새 글', ` ${'뒤'.repeat(200)}`, '~'].join('\n');
  const [줄] = 낱말줄이기(porcelain, { 파일이름: 'v.mjs' });
  assert.match(줄, /^\[v\.mjs:56\] … 앞{70}\[-옛 글-\]\{\+새 글\+\}뒤{70} …$/);
  assert.equal(낱말줄이기(porcelain.replace('앞'.repeat(200), '앞'.repeat(100)), { 파일이름: 'v.mjs' })[0].includes('앞'.repeat(100)), true, '맥락이 짧으면 자르지 않는다');
});

test('설정: --주소뿌리는 <주소>=<저장소 경로> 꼴이 아니면 준비 때 멈춘다(캡처 도중 route 처리기에서 터지지 않게)', async () => {
  const { 설정만들기 } = await tool();
  for (const 틀림 of ['docs/site', 'docs/site=http://127.0.0.1:8080/', 'http://127.0.0.1:8080/=', 'ftp://x/=docs']) {
    assert.throws(() => 설정만들기({ 종류: '화면', 바탕: 'HEAD', 주소뿌리: [틀림] }), /--주소뿌리는 <주소>=<저장소 경로> 꼴/, 틀림);
  }
  assert.doesNotThrow(() => 설정만들기({ 종류: '화면', 바탕: 'HEAD', 주소뿌리: ['http://127.0.0.1:8080/=docs\\site\\public'] }));
});

test('주소 → 저장소 경로: 이 PC 주소만, --주소뿌리는 경로 경계에서만 맞추고 역슬래시를 받으며, 그 밖에는 하나뿐인 꼬리 맞춤', async () => {
  const { 경로찾기만들기 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수캡처.mjs')));
  const 헷갈림 = new Set();
  const 찾기 = 경로찾기만들기({ 주소뿌리: [['http://127.0.0.1:8080/app', 'docs\\site\\public']], 바뀐경로들: ['docs/site/public/app.js', 'a/x.js', 'b/x.js', 'c/only.css'], 헷갈림 });
  assert.equal(찾기('http://127.0.0.1:8080/app/app.js?v=1'), 'docs/site/public/app.js');
  assert.equal(찾기('http://127.0.0.1:8080/apple/app.js'), null, '/app은 /apple에 맞지 않는다(꼬리 맞춤도 없음)');
  assert.equal(찾기('http://127.0.0.1:9/only.css'), 'c/only.css');
  assert.equal(찾기('http://127.0.0.1:9/x.js'), null, '같은 꼬리가 둘이면 끼우지 않는다');
  assert.ok([...헷갈림].some(x => x.startsWith('/x.js')));
  assert.equal(찾기('https://synk.im/only.css'), null, '밖의 사이트는 건드리지 않는다');
  const 정적 = 경로찾기만들기({ 정적주소: 'http://127.0.0.1:5555' });
  assert.equal(정적('http://127.0.0.1:5555/experiences/%EC%84%B8%EA%B3%84/'), 'experiences/세계/index.html');
});

test('TAP 요약: 하위 시험 실패만 알리는 부모 줄은 빼고, 실패한 시험을 묶음 › 이름과 첫 오류 줄로', async () => {
  const { TAP요약 } = await tool();
  const tap = ['TAP version 13', '# Subtest: tests/a.test.js', '    # Subtest: 묶음', '        # Subtest: 더하기', '        not ok 1 - 더하기', '          ---',
    '          duration_ms: 1', "          location: 'tests/a.test.js:5:3'", "          failureType: 'testCodeFailure'", '          error: |-', '            Expected values to be strictly equal:', '            1 !== 2', '          ...',
    '    not ok 1 - 묶음', '      ---', "      failureType: 'subtestsFailed'", "      error: '1 subtest failed'", '      ...', 'not ok 1 - tests/a.test.js', '  ---', "  failureType: 'subtestsFailed'", '  ...',
    '# tests 3', '# pass 2', '# fail 1', '# cancelled 0', '# skipped 0', '# todo 0'].join('\n');
  const s = TAP요약(tap);
  assert.deepEqual([s.시험, s.통과, s.실패, s.건너뜀], [3, 2, 1, 0]);
  assert.equal(s.실패목록.length, 1);
  assert.equal(s.실패목록[0].이름, 'tests/a.test.js › 묶음 › 더하기');
  assert.match(s.실패목록[0].오류, /strictly equal.*1 !== 2/);
  assert.equal(s.실패목록[0].위치, 'tests/a.test.js:5:3');
});

test('묶기: 한도를 넘는 항목은 @@ 덩이 경계로 조각(a·b…), 모든 묶음이 한도 안, 코드와 화면은 갈린다', async () => {
  const { 묶기 } = await tool();
  const 항목 = (앞, 몸, 갈래 = '코드') => ({ id: `${앞}-0000`, 앞, 제목: 앞, 몸, 갈래, 파일: `${앞}.js`, 글: `### [${앞}-0000] ${앞}\n${몸}\n` });
  const 덩이 = k => `@@ -${k},3 +${k},3 @@\n${'+줄 '.repeat(400)}`;
  const 큰 = 항목('D01', Array.from({ length: 12 }, (_, k) => 덩이(k * 10)).join('\n'));
  const 묶음들 = 묶기([항목('T01', '시험'), 큰, 항목('D02', '작은 diff'), 항목('S01', '화면 글 '.repeat(3000), '화면')], { 한도: 6000 });
  assert.ok(묶음들.every(b => b.바이트 <= 6000), 묶음들.map(b => b.바이트).join(','));
  const 번호들 = 묶음들.flatMap(b => b.항목.map(x => x.앞));
  assert.ok(번호들.includes('D01a') && 번호들.includes('D01b'), 번호들.join(','));
  assert.ok(묶음들.find(b => b.항목.some(x => x.앞.startsWith('S01'))).항목.every(x => x.갈래 === '화면'));
});

test('묶음글·답대조: 끝 표식은 맨 끝, 읽은 항목 번호(해시까지)와 표식이 다 맞아야 읽음', async () => {
  const { 묶음글, 답대조, 규칙글 } = await tool();
  const 항목들 = [{ id: 'D01-ab12', 글: '### [D01-ab12] a.js\n+x\n' }, { id: 'D02-cd34', 글: '### [D02-cd34] b.js\n+y\n' }];
  const { 글, 표식 } = 묶음글({ 규칙: 규칙글('백엔드'), 배경: '배경', 커밋: '- abc 고침', 파일목록: ['- 바뀜 a.js'], 이름: 'A', 차례: 1, 전체: 1, 항목들 });
  assert.match(표식, /^END_OF_REVIEW_A_[0-9a-f]{12}$/);
  assert.ok(글.trimEnd().endsWith(`자료 끝 표식: ${표식}`));
  const 묶음 = { 표식, 항목: 항목들.map(x => x.id) };
  assert.equal(답대조(묶음, { findings: [], coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식, seen: ['[D01-ab12]', 'd02-cd34'] }).상태, '읽음');
  assert.deepEqual(답대조(묶음, { findings: [], coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식, seen: ['D01-ab12', 'D02'] }).빠진항목, ['D02-cd34'], '해시 없이 번호만 적으면 읽은 것으로 치지 않는다');
  assert.equal(답대조(묶음, { findings: [], coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 'truncated', seen: ['D01-ab12'] }).상태, '잘림');
  assert.equal(답대조(묶음, { findings: [], coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식, seen: ['D01-ab12', 'D02-cd34', 'truncated'] }).상태, '잘림');
});

test('처리: 줄임말을 받고, 반영 말고는 이유가 있어야 하고, 재확인은 반영한 지적에만', async () => {
  const { 처리하기 } = await tool();
  const 표 = { 지적: [{ 번호: 'A1', 출처: '아르곤', 등급: 'P1' }, { 번호: 'A2', 출처: '아르곤', 등급: 'P2' }, { 번호: 'F1', 출처: 'Fable', 등급: 'P1' }] };
  assert.deepEqual(처리하기(표, ['A1=반영', 'A2=재현 안 됨:옛 판도 같은 목록이었다', 'F1=일부:글만 고침']), ['A1', 'A2', 'F1']);
  assert.equal(표.지적[1].처리, '재현 안 됨');
  assert.equal(표.지적[1].이유, '옛 판도 같은 목록이었다');
  assert.throws(() => 처리하기(표, ['A2=안함']), /이유를 붙인다/);
  assert.throws(() => 처리하기(표, ['A9=반영']), /없는 지적/);
  assert.throws(() => 처리하기(표, ['A2=재확인']), /반영한 지적에만/);
  처리하기(표, ['F1=반영', 'F1=재확인']);
  assert.equal(표.지적[2].재확인, '통과');
});

test('처리: 아르곤 F 묶음과 Fable의 번호가 겹치면 출처를 붙여 가리고, 붙이지 않으면 멈춘다', async () => {
  const { 처리하기 } = await tool();
  const 표 = { 지적: [{ 번호: 'F1', 출처: '아르곤', 등급: 'P2' }, { 번호: 'F1', 출처: 'Fable', 등급: 'P2' }, { 번호: 'F2', 출처: 'Fable', 등급: 'P3' }] };
  assert.throws(() => 처리하기(표, ['F1=반영']), /겹친다/);
  assert.equal(표.지적[0].처리, undefined, '멈추면 아무 칸에도 적지 않는다');
  assert.deepEqual(처리하기(표, ['아르곤:F1=반영', 'Fable:F1=안함:표어 그대로', 'F2=반영']), ['F1', 'F1', 'F2']);
  assert.equal(표.지적[0].처리, '반영');
  assert.equal(표.지적[1].처리, '반영 안 함');
  assert.equal(표.지적[1].이유, '표어 그대로');
  assert.throws(() => 처리하기(표, ['GPT:F1=반영']), /없는 지적/);
  처리하기(표, ['Fable:F1=반영', 'Fable:F1=재확인']);
  assert.equal(표.지적[1].재확인, '통과');
});

test('Fable 답: 보고 끝의 json 블록을 읽고 F1…로 더하며(같은 지적은 한 번), 아르곤 지적에 의견을 붙인다', async () => {
  const { 페이블답읽기, 페이블지적넣기 } = await tool();
  const 답 = 페이블답읽기('보고 글\n```json\n{"findings":[{"grade":"P1","location":"a.js:3","quote":"x","problem":"깨짐","fix":"고침"}],"argonReview":[{"id":"A1","agree":false,"note":"아직 넘침"}],"coverage":{"reviewed":"전부","limitations":"없음","complete":true,"missing":[]},"seen":[]}\n```\n');
  const 표 = { 지적: [{ 번호: 'A1', 출처: '아르곤', 묶음: 'A', 등급: 'P2', 위치: 'b.js:1', 인용: '' }] };
  assert.deepEqual(페이블지적넣기(표, 답), ['F1']);
  assert.deepEqual(페이블지적넣기(표, 답), [], '같은 위치·인용·문제는 다시 넣지 않는다');
  assert.equal(표.지적.find(x => x.번호 === 'A1').페이블의견.동의, false);
  assert.equal(표.페이블.회차, 2);
  assert.throws(() => 페이블답읽기('JSON 없음'), /JSON을 못 찾았다/);
});

test('집계: 아르곤·Fable N건(반영 M)과 배포 조건 — 처리 미정·Fable 재확인 전·덜 읽힌 묶음·Fable 검수 전은 미충족', async () => {
  const { 집계하기 } = await tool();
  const 목록 = { 종류: '화면', 묶음: [{ 이름: 'A', sha256: 's' }, { 이름: 'B', sha256: 't' }] };
  const 읽음 = [{ 묶음: 'A', 상태: '읽음', 입력sha256: 's' }, { 묶음: 'B', 상태: '읽음', 입력sha256: 't' }];
  const 지적 = (번호, 출처, 등급, 처리 = null, 재확인 = null) => ({ 번호, 출처, 등급, 처리, 재확인, 위치: '', 문제: '', 이유: 처리 && 처리 !== '반영' ? '까닭' : '' });
  let 표 = { 지적: [지적('A1', '아르곤', 'P1', '반영'), 지적('A2', '아르곤', 'P2', '반영 안 함'), 지적('B1', '아르곤', 'P1', '재현 안 됨')] };
  let s = 집계하기(목록, 읽음, 표);
  assert.equal(s.한줄, '아르곤 3건(반영 1)');
  assert.equal(s.배포조건충족, false);
  assert.ok(s.조건.includes('Fable 최종 검수 전'));
  표 = { ...표, 지적: [...표.지적, 지적('F1', 'Fable', 'P1', '반영')], 페이블: { 회차: 1 } };
  s = 집계하기(목록, 읽음, 표);
  assert.equal(s.한줄, '아르곤 3건(반영 1) · Fable 1건(반영 1)');
  assert.deepEqual(s.열린.map(x => x.번호), ['F1'], 'Fable P1은 반영 뒤 같은 Fable의 재확인까지');
  표.지적[3].재확인 = '통과';
  assert.equal(집계하기(목록, 읽음, 표).배포조건충족, true);
  assert.equal(집계하기(목록, [읽음[0], { ...읽음[1], 상태: '덜 읽음' }], 표).배포조건충족, false);
  assert.equal(집계하기(목록, [읽음[0], { ...읽음[1], 입력sha256: '다름' }], 표).배포조건충족, false);
  // 백엔드는 Fable이 관문이 아니다. 아르곤이 막히면 Fable로 대신해야 한다.
  const 백 = { 종류: '백엔드', 묶음: [{ 이름: 'A', sha256: 's' }] };
  assert.equal(집계하기(백, [읽음[0]], { 지적: [지적('A1', '아르곤', 'P2')] }).배포조건충족, true);
  const 막 = 집계하기(백, [{ 묶음: 'A', 상태: '막힘', 입력sha256: 's' }], { 지적: [] });
  assert.equal(막.한줄, '아르곤 막힘(한도·로그인)');
  assert.ok(막.조건.some(x => /Fable 검수로 대신/.test(x)));
});

test('준비 → 아르곤(가짜) → 처리 → 집계: 생성물은 빼고, 긴 줄은 낱말, 입력 SHA가 바뀌면 멈추고, 막히면 남은 묶음을 보내지 않는다', async t => {
  const { 준비하기, 아르곤보내기, 지적표읽기, 처리하기, 집계하기, 묶음상태들 } = await tool();
  const r = 임시저장소(t, { 'src/app.js': 'export const a = 1;\nexport const b = 2;\n', 'src/view.mjs': `export const 화면 = \`${'<p>글</p>'.repeat(80)}<p>옛 글</p>\`;\n`, 'dist/app.js': '묶음\n' });
  r.쓰기('src/app.js', 'export const a = 1;\nexport const b = 3;\n');
  r.쓰기('src/view.mjs', `export const 화면 = \`${'<p>글</p>'.repeat(80)}<p>새 글</p>\`;\n`);
  r.쓰기('dist/app.js', '새 묶음\n');
  r.쓰기('src/new.js', 'export const c = 4;\n');
  r.g('add', 'src/app.js'); r.g('commit', '-q', '-m', '고침: b를 3으로');
  fs.writeFileSync(path.join(r.뿌리, '배경.md'), '배경: b를 3으로 바꾸고 화면 글을 고쳤다.');
  const { 폴더, 목록 } = await 준비하기({ 이름: '시험', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, 배경: path.join(r.뿌리, '배경.md'), 크기: '40000' });
  assert.deepEqual(목록.파일.map(f => `${f.상태} ${f.경로}${f.뺀까닭 ? ' 뺌' : ''} ${f.꼴 || ''}`.trim()),
    ['M dist/app.js 뺌', 'M src/app.js diff', 'A src/new.js 새 파일', 'M src/view.mjs 낱말']);
  const 묶음 = 목록.묶음[0];
  const 글 = fs.readFileSync(path.join(폴더, 묶음.파일), 'utf8');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(폴더, 묶음.파일))).digest('hex'), 묶음.sha256);
  assert.match(글, /배경: b를 3으로/);
  assert.match(글, /고침: b를 3으로/);
  assert.match(글, /\[view\.mjs:1\] … .{1,70}\[-옛-\]\{\+새\+\} 글<\/p>`;$/m, '띄어쓰기 없는 긴 줄도 바뀐 낱말만');
  assert.match(글, /dist\/app\.js .*뺌: 생성물/);
  assert.ok(!/새 묶음/.test(글), '뺀 생성물의 내용은 싣지 않는다');
  assert.ok(fs.existsSync(path.join(폴더, 'fable.md')) && fs.existsSync(path.join(폴더, 'diff.patch')));
  assert.match(fs.readFileSync(path.join(폴더, 'diff.patch'), 'utf8'), /src\/new\.js/);

  const 부름 = [];
  const 잘읽음 = async ({ prompt, model, thinking, schema }) => {
    부름.push({ model, thinking, sha: crypto.createHash('sha256').update(prompt).digest('hex') });
    assert.equal(model, 'gemini-4-carbon');
    assert.ok(schema.required.includes('endMarker'));
    const 표식 = /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1];
    const seen = [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]);
    return { text: JSON.stringify({ findings: [{ grade: 'P1', location: 'src/app.js:2', quote: 'b = 3', problem: '부르는 곳이 2를 기대한다', fix: '부르는 곳도 고친다' }], seen, coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식 }), selectedModel: 'gemini-4-carbon-high', usage: { input_tokens: 10 } };
  };
  const 몫 = () => ({ 주간: 0.25, 다섯시간: 0.8 });
  const 결과 = await 아르곤보내기(폴더, 목록, { call: 잘읽음, 몫 });
  assert.deepEqual(결과.map(x => x.상태), 목록.묶음.map(() => '읽음'));
  assert.equal(부름[0].thinking, 'high', '백엔드도 카본 high(11-11)');
  assert.equal(부름[0].sha, 묶음.sha256, '보낸 바이트 = 준비한 묶음');
  const 표 = 지적표읽기(폴더);
  assert.equal(표.지적[0].번호, 'A1');
  assert.equal((await 아르곤보내기(폴더, 목록, { call: async () => assert.fail('읽은 묶음은 다시 보내지 않는다'), 몫 })).length, 목록.묶음.length);

  처리하기(표, ['A1=반영']);
  fs.writeFileSync(path.join(폴더, '지적표.json'), JSON.stringify(표));
  const s = 집계하기(목록, 결과, 지적표읽기(폴더));
  assert.equal(s.한줄, `아르곤 ${표.지적.length}건(반영 1) · GPT 미실행`);
  assert.equal(s.배포조건충족, false, '새 판은 필수 GPT 미실행을 막는다');

  // 다시 보낸 답이 잘렸으면 앞의 읽은 답과 지적을 그대로 두고 그 시도만 실패들에 적는다
  const 잘린답 = async ({ prompt }) => ({ text: JSON.stringify({ findings: [], seen: [], coverage: { reviewed: '', limitations: '' }, endMarker: 'truncated' }) });
  // 결과가 있는 묶음은 사람이 고를 때만 다시 보낸다(Fable F2): 잘린 묶음도 --다시·--묶음 없이 다시 돌리면 건너뛴다
  const 잘림폴더 = path.join(r.뿌리, 'out-잘림');
  const 잘림목록 = (await 준비하기({ 이름: '잘림', 폴더: 잘림폴더, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 })).목록;
  assert.equal((await 아르곤보내기(잘림폴더, 잘림목록, { call: 잘린답, 몫 }))[0].상태, '잘림');
  await 아르곤보내기(잘림폴더, 잘림목록, { call: async () => assert.fail('잘린 묶음을 저절로 다시 보내지 않는다'), 몫 });
  assert.equal((await 아르곤보내기(잘림폴더, 잘림목록, { call: 잘읽음, 몫, 고른: [잘림목록.묶음[0].이름] }))[0].상태, '읽음', '--묶음으로 고르면 다시 보낸다');
  const 다시 = await 아르곤보내기(폴더, 목록, { call: 잘린답, 몫, 다시: true });
  assert.equal(다시[0].상태, '읽음');
  assert.equal(다시[0].실패들.at(-1).상태, '잘림');
  assert.equal(지적표읽기(폴더).지적[0].번호, 'A1', '앞 답의 지적이 남는다');
  assert.deepEqual(묶음상태들(폴더, { ...목록, 묶음: [...목록.묶음, { ...묶음, 이름: 'Q' }] }).map(b => b.상태), [...목록.묶음.map(() => '읽음'), '안 보냄'], '보내지 않은 묶음도 상태에 든다');

  fs.appendFileSync(path.join(폴더, 묶음.파일), '덧붙임');
  await assert.rejects(아르곤보내기(폴더, 목록, { call: 잘읽음, 몫, 다시: true }), /입력 SHA/);
  fs.writeFileSync(path.join(폴더, 묶음.파일), 글);
  const 막힘 = await 아르곤보내기(폴더, { ...목록, 묶음: [묶음, { ...묶음, 이름: 'Z' }] }, { call: async () => { throw new Error('구독 통로 실패(종료 2) — RESOURCE_EXHAUSTED quota'); }, 몫, 다시: true });
  assert.deepEqual(막힘.map(x => x.묶음), ['A'], '막히면 남은 묶음(Z)을 보내지 않는다');
  assert.equal(막힘[0].실패들.at(-1).상태, '막힘', '앞의 읽은 답은 두고 막힌 시도만 적는다');
  const 끝몫 = await 아르곤보내기(폴더, 목록, { call: async () => assert.fail('몫이 0이면 부르지 않는다'), 몫: () => ({ 주간: 0 }), 다시: true });
  assert.equal(끝몫[0].실패들.at(-1).상태, '막힘');
  // 쓸 만한 답이 없던 묶음이 막히면 그 묶음은 「막힘」이다. 백엔드는 GPT가 먼저라 아르곤만 막혀서는 Fable 차례가 아니고,
  // GPT·아르곤이 다 막히면 그록(정책 판 6, 11-08), 그록도 막히면 Fable로 대신하라고 한다(판 5 묶음의 GPT·아르곤 → Fable은 「정책 판 2·5」 시험)
  const 새폴더 = path.join(r.뿌리, 'out-막힘');
  const 막힌목록 = (await 준비하기({ 이름: '막힘', 폴더: 새폴더, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 })).목록;
  const 처음막힘 = await 아르곤보내기(새폴더, 막힌목록, { call: async () => { throw new Error('login required'); }, 몫 });
  assert.equal(처음막힘[0].상태, '막힘');
  assert.ok(!집계하기(막힌목록, 처음막힘, 지적표읽기(새폴더)).조건.some(x => /Fable 검수로 대신/.test(x)), 'GPT를 안 돌렸으면 Fable 차례가 아니다');
  const { GPT보내기, 그록보내기 } = await tool();
  const G막힘 = await GPT보내기(새폴더, 막힌목록, { call: async () => { throw new Error('You have hit your usage limit'); }, 몫 });
  assert.equal(G막힘[0].상태, '막힘');
  const 막힌집계 = (K = []) => 집계하기(막힌목록, 처음막힘, 지적표읽기(새폴더), G막힘, [], [], K).조건;
  assert.ok(막힌집계().some(x => /GPT·아르곤 검수가 막혀 그록 검수로 대신/.test(x)), 막힌집계().join(' / '));
  assert.ok(!막힌집계().some(x => /Fable 검수로 대신/.test(x)), '그록 차례를 건너뛰어 Fable을 부르지 않는다');
  const K막힘 = await 그록보내기(새폴더, 막힌목록, { call: async () => { throw new Error('그록 로그인이 필요하다 — grok login'); } });
  assert.equal(K막힘[0].상태, '막힘');
  assert.ok(막힌집계(K막힘).some(x => /GPT·아르곤·그록 검수가 막혀 Fable 검수로 대신/.test(x)), 막힌집계(K막힘).join(' / '));
});

async function 화면캡처시험(t) {
  let browser;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  } catch { /* 아래에서 건너뜀 */ }
  if (!browser) { t.skip('브라우저를 띄울 수 없다(playwright·Chrome 없음)'); return null; }
  await browser.close();
  const { 준비하기, 페이블하기 } = await tool();
  const 쪽 = (글, 꾸밈 = 'style.css') => `<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="icon" href="data:,"><title>시험</title><link rel="stylesheet" href="./${꾸밈}"><main><h1>SYNK</h1><p id="p">${글}</p></main><script src="./app.js"></script></html>`;
  const r = 임시저장소(t, { 'site/index.html': 쪽('옛 글'), 'site/style.css': 'main{font:20px sans-serif;padding:30px;margin:0 auto;max-width:900px}', 'site/app.js': 'document.title = "시험";\n' });
  // 꾸밈 파일 이름을 바꾼다(git mv) — 「전」의 바탕 HTML이 옛 이름을 부르면 그 판 바이트를 내줘야 한다(아르곤 A2)
  r.g('mv', 'site/style.css', 'site/look.css');
  r.쓰기('site/look.css', 'main{font:20px sans-serif;padding:30px;margin:0 auto;max-width:900px;background:#fde}');
  r.쓰기('site/index.html', 쪽('새 글 — 길게 바꾼 글', 'look.css'));
  r.쓰기('site/app.js', 'console.error("새로 생긴 오류");\n');
  return { r, 준비하기, 페이블하기 };
}

test('화면 캡처: 「전」은 바뀐 파일만 바탕 판으로 끼우고, 두 폭의 그림 차이·보이는 글 차이·새 콘솔 오류를 묶음에 싣는다', async t => {
  const fixture = await 화면캡처시험(t);
  if (!fixture) return;
  const { r, 준비하기 } = fixture;
  const { 폴더, 목록 } = await 준비하기({ 이름: '화면시험', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 화면: ['홈=site/index.html'] });
  const 장 = (판, 기기) => 목록.화면.장들.find(x => x.판 === 판 && x.기기 === 기기 && x.이름 === '홈');
  for (const 판 of ['전', '후']) for (const 기기 of ['1440', '390']) assert.ok(fs.existsSync(path.join(폴더, 장(판, 기기).그림)), `${판} ${기기} 그림`);
  assert.match(fs.readFileSync(path.join(폴더, 장('전', '1440').그림.replace(/\.png$/, '.txt')), 'utf8'), /옛 글/, '전은 바탕 판 HTML');
  assert.ok(장('후', '1440').오류.some(e => /새로 생긴 오류/.test(e)), '후는 지금 판 JS');
  assert.deepEqual(장('전', '1440').오류, [], '전은 바뀐 JS와 이름이 바뀐 옛 CSS까지 바탕 판으로 끼운다(404 없음)');
  assert.ok(목록.화면.차이들.every(x => !x.같음 && fs.existsSync(path.join(폴더, x.그림))));
  assert.deepEqual(목록.화면.못끼움, []);
  const 묶음글 = 목록.묶음.map(b => fs.readFileSync(path.join(폴더, b.파일), 'utf8')).join('\n');
  assert.match(묶음글, /화면 「홈」/);
  assert.match(묶음글, /새 오류: 콘솔 새로 생긴 오류/);
  assert.match(묶음글, /-.*옛 글[\s\S]*\+.*새 글/);
  assert.match(fs.readFileSync(path.join(폴더, 'fable.md'), 'utf8'), /\| 홈 \| 1440 \| `캡처\/전\/1440\/홈\.png` \| `캡처\/후\/1440\/홈\.png` \|/);
});

test('화면 캡처: Fable 앞에서는 고친 후만 다시 찍고 준비 때의 전을 보존한다', async t => {
  const fixture = await 화면캡처시험(t);
  if (!fixture) return;
  const { r, 준비하기, 페이블하기 } = fixture;
  const { 폴더 } = await 준비하기({ 이름: '화면시험', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 화면: ['홈=site/index.html'] });
  // 고친 뒤(Fable 앞): 후만 다시 찍어 준비 때의 전과 견준다
  r.쓰기('site/app.js', 'document.title = "고침";\n');
  await 페이블하기(폴더, { 시험: false });
  const 페 = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8'));
  assert.ok(!페.화면.장들.find(x => x.판 === '후' && x.기기 === '1440').오류.length, '고친 뒤 후 그림에는 오류가 없다');
  assert.ok(페.화면.장들.some(x => x.판 === '전' && x.그림.startsWith('캡처/전/')), '전은 준비 때 그림');
});

test('화면 캡처: 장면이 연 첫 문서의 404도 오류로 센다', async t => {
  const fixture = await 화면캡처시험(t);
  if (!fixture) return;
  const { r, 준비하기 } = fixture;
  const 장면 = path.join(r.뿌리, '장면.mjs');
  fs.writeFileSync(장면, "export default async ({ page, 찍기, 주소들 }) => {\n  await page.goto(주소들['홈'].replace('index.html', 'missing.html'));\n  await 찍기('없음');\n  await page.goto(주소들['홈']);\n  await 찍기('첫');\n};\n");
  const 둘 = await 준비하기({ 이름: '장면시험', 폴더: path.join(r.뿌리, 'out2'), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 화면: ['홈=site/index.html'], 장면 });
  assert.deepEqual(둘.목록.화면.화면들.map(x => x.이름), ['없음', '첫']);
  assert.match(둘.목록.화면.화면들[1].주소.후, /site\/index\.html$/, '404 뒤의 정상 장면은 자기 문서 주소를 보존한다');
  assert.ok(둘.목록.화면.장들.find(x => x.이름 === '없음' && x.판 === '후').오류.some(e => /^HTTP 404 /.test(e)), '장면이 연 첫 문서의 404도 센다(Fable F5)');
});

test('화면 캡처: 같은 이름의 장면 둘을 구분하고 바뀐 글을 묶음에 싣는다', async t => {
  const fixture = await 화면캡처시험(t);
  if (!fixture) return;
  const { r, 준비하기 } = fixture;
  r.쓰기('site/app.js', 'document.title = "고침";\n');
  // --장면: 장면이 찍은 이름(같은 이름 두 번이면 -2)이 화면 목록·묶음 항목이 된다(아르곤 A1)
  const 장면 = path.join(r.뿌리, '장면.mjs');
  fs.writeFileSync(장면, "export default async ({ page, 찍기, 주소들 }) => {\n  await page.goto(주소들['홈']);\n  await 찍기('첫');\n  await page.evaluate(() => { document.querySelector('#p').textContent = '눌러서 바뀐 글'; });\n  await 찍기('첫');\n};\n");
  const 둘 = await 준비하기({ 이름: '장면시험', 폴더: path.join(r.뿌리, 'out2'), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 화면: ['홈=site/index.html'], 장면 });
  assert.deepEqual(둘.목록.화면.화면들.map(x => x.이름), ['첫', '첫-2']);
  assert.match(둘.목록.화면.화면들[0].주소.후, /site\/index\.html$/);
  const 둘글 = 둘.목록.묶음.map(b => fs.readFileSync(path.join(둘.폴더, b.파일), 'utf8')).join('\n');
  assert.match(둘글, /화면 「첫」/);
  assert.match(둘글, /화면 「첫-2」[\s\S]*눌러서 바뀐 글/);
});

const 블롭 = b => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(b)}\0`), Buffer.from(b)])).digest('hex');
const 넣기 = (뿌리, 표) => { for (const [p, v] of Object.entries(표)) { const f = path.join(뿌리, ...p.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); } };

test('「전」 판보기(배포 후보, 11-01): 후보 뿌리는 후보 경로를 가장 많이 품은 폴더 하나, 아는 공개 경로는 앞판·새 파일은 404, 그 밖은 바탕 판', async () => {
  const api = await tool();
  const { 경로찾기만들기 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수캡처.mjs')));
  // SYNK-website 꼴: dist/가 공개 뿌리이고, 꼬리가 같은 src/index.html · qa 백업도 있다
  const 파일들 = ['dist/index.html', 'dist/en/index.html', 'dist/mn/index.html', 'dist/assets/v10/home-body.css', 'src/index.html', 'qa/backup/dist/atlas/index.html', 'site-v10/home-body.css'];
  assert.deepEqual(api.후보뿌리찾기(파일들, ['index.html', 'en/index.html', 'assets/v10/home-body.css']), { 뿌리: 'dist/', 동률: [] });
  const 하나 = api.후보뿌리찾기(파일들, ['index.html']);
  assert.equal(하나.뿌리, null, 'index.html 하나로는 dist/·dist/en/·src/가 같아 고르지 않는다');
  assert.ok(하나.동률.includes('dist/') && 하나.동률.includes('src/'));
  assert.deepEqual(api.후보뿌리찾기(파일들, ['없음.js']), { 뿌리: null, 동률: [] });
  assert.deepEqual(api.후보뿌리찾기(['index.html', 'a/b.js', 'x/a/b.js'], ['index.html', 'a/b.js']), { 뿌리: '', 동률: [] }, '저장소 맨 위가 공개 뿌리일 수도 있다');
  // 원고 안(무시 안 된 qa·.tmp)에 둔 후보 폴더와 옛 후보 폴더는 모든 경로를 품어도 뿌리가 아니다(GPT GA1) — 후보.json이 든 폴더는 뺀다
  const 후보안 = ['qa/pub-cand/후보.json', 'qa/pub-cand/index.html', 'qa/pub-cand/en/index.html', 'qa/pub-cand/assets/v10/home-body.css', 'qa/pub-cand/new/index.html',
    'qa/pub-cand/.앞판/index.html', 'qa/pub-cand/.앞판/en/index.html', '.tmp/pub-cand6/후보.json', '.tmp/pub-cand6/index.html', '.tmp/pub-cand6/en/index.html'];
  const 넷 = ['index.html', 'en/index.html', 'assets/v10/home-body.css', 'new/index.html'];
  assert.deepEqual(api.후보뿌리찾기([...파일들, ...후보안], 넷), { 뿌리: 'dist/', 동률: [] });

  const 바탕판 = { 'dist/en/index.html': '바탕 옛 영어', 'dist/en/new/index.html': '바탕에만 있는 새 쪽', 'src/index.html': '바탕 틀' };
  const 바탕 = Object.assign(p => (바탕판[p] == null ? undefined : Buffer.from(바탕판[p])), { 경로들: Object.keys(바탕판) });
  const 앞판 = new Map([['en/index.html', Buffer.from('공개본 영어')], ['index.html', Buffer.from('공개본 홈')]]);
  const 보기 = api.전판보기만들기(바탕, { 앞판, 새: new Set(['en/new/index.html']), 뿌리: 'dist/' });
  assert.equal(String(보기('dist/en/index.html')), '공개본 영어', '바탕 커밋의 낡은 dist 대신 지금 공개본');
  assert.equal(String(보기(`${api.공개표}index.html`)), '공개본 홈');
  assert.equal(보기('dist/en/new/index.html'), null, '후보가 「새」로 적은 파일은 공개본에 없다(404)');
  assert.equal(String(보기('src/index.html')), '바탕 틀', '뿌리 밖은 꼬리가 같아도 바탕 판');
  assert.equal(보기('dist/assets/other.css'), undefined, '후보 밖 파일은 지금처럼');
  assert.equal(보기.공개경로('dist/en/index.html'), 'en/index.html');
  assert.equal(보기.공개경로('dist/assets/other.css'), null);
  assert.deepEqual(보기.경로들, 바탕.경로들);
  const 뿌리없음 = api.전판보기만들기(바탕, { 앞판, 뿌리: null });
  assert.equal(String(뿌리없음('dist/en/index.html')), '바탕 옛 영어', '뿌리를 못 정하면 저장소 경로 요청은 지금처럼 바탕 판');
  assert.equal(String(뿌리없음(`${api.공개표}en/index.html`)), '공개본 영어', '주소로 찾은 공개 경로는 뿌리 없이도 잇는다');

  const 헷갈림 = new Set();
  const 경로찾기 = 경로찾기만들기({ 정적주소: 'http://127.0.0.1:5555', 바뀐경로들: ['dist/en/index.html', 'dist/index.html', 'dist/assets/v10/home-ask.css'], 헷갈림 });
  const 찾기 = api.전경로찾기만들기({ 명시찾기: 경로찾기만들기({ 정적주소: 'http://127.0.0.1:5555' }), 경로찾기, 아는: 보기.아는 });
  assert.equal(찾기('http://127.0.0.1:4871/en/'), `${api.공개표}en/index.html`, '공개 트리를 내주는 이 PC 서버의 길 = 공개 경로');
  assert.equal(찾기('http://127.0.0.1:4871/'), `${api.공개표}index.html`, '꼬리 맞춤으로는 헷갈리는 첫 쪽도 잇는다');
  assert.equal(헷갈림.size, 0);
  assert.equal(찾기('http://127.0.0.1:4871/assets/v10/home-ask.css?v=1'), 'dist/assets/v10/home-ask.css', '후보 밖 파일은 지금처럼 꼬리 맞춤');
  assert.equal(찾기('http://127.0.0.1:5555/dist/en/index.html'), 'dist/en/index.html', '이 도구의 정적 서버는 저장소 경로 그대로');
  assert.equal(찾기('https://synk.im/en/'), null, '밖의 사이트는 건드리지 않는다');
});

// 각 회귀는 독립 후보와 서버를 쓴다. 한 시험에 캡처를 누적해 CI의 120초 제한을 넘기지 않는다.
async function 후보캡처시험(t, 후보만들기 = true) {
  let browser;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  } catch { /* 아래에서 건너뜀 */ }
  if (!browser) return t.skip('브라우저를 띄울 수 없다(playwright·Chrome 없음)');
  await browser.close();
  const { 준비하기 } = await tool();
  const { 정적서버 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수캡처.mjs')));
  const 쪽 = 글 => `<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="icon" href="data:,"><title>시험</title><main><p id="p">${글}</p></main></html>`;
  // 10-31 home-slim-20261031-c 꼴: 바탕 커밋의 dist는 공개본보다 낡았고, 합친 다른 가지가 dist/en/index.html을 바꿔 바탕과 작업본이 다르다
  const r = 임시저장소(t, { 'dist/index.html': 쪽('바탕 홈'), 'dist/en/index.html': 쪽('바탕 영어 줄이기 전'), 'dist/en/new/index.html': 쪽('바탕에만 있는 새 쪽'), 'site/content.mjs': "export const 홈 = '옛';\n" });
  r.쓰기('site/content.mjs', "export const 홈 = '새';\n");
  r.쓰기('dist/en/index.html', 쪽('합친 가지의 영어'));
  const 후보 = { 'index.html': 쪽('후보 홈'), 'en/index.html': 쪽('후보 영어'), 'en/new/index.html': 쪽('후보 새 쪽 전용') };
  const 공개본 = { 'index.html': 쪽('공개본 홈'), 'en/index.html': 쪽('공개본 영어 줄인 뒤') };
  // 후 = 공개 트리(지금 공개본 + 후보)를 내주는 이 PC 서버 — 전도 같은 주소다(바꿔 끼우는 것은 도구)
  const 공개트리 = path.join(r.뿌리, 'pub');
  넣기(공개트리, 공개본); // 서버가 낡은 판이어도 후 캡처는 후보 바이트여야 한다.
  const 서버 = await 정적서버(공개트리);
  t.after(() => 서버.닫기());
  const 글 = (폴더, 목록, 판, 이름) => fs.readFileSync(path.join(폴더, 목록.화면.장들.find(x => x.판 === 판 && x.기기 === '1440' && x.이름 === 이름).그림.replace(/\.png$/, '.txt')), 'utf8');
  // 공개 도구(--후보폴더)가 쓴 꼴: 후보 바이트 · .앞판(그 공개 커밋의 blob) · 후보.json. 원고 안의 무시 안 된 qa/에 둔다 —
  // 후보 자신(과 그 .앞판)이 모든 공개 경로를 품어도 후보 뿌리로 뽑히면 안 된다(GPT GA1). 검수 범위는 --경로로 원고만.
  const 후보폴더 = path.join(r.저장소, 'qa', 'pub-cand');
  if (후보만들기) {
    넣기(후보폴더, 후보); 넣기(path.join(후보폴더, '.앞판'), 공개본);
    fs.writeFileSync(path.join(후보폴더, '후보.json'), JSON.stringify({ 판: 1, 종류: 'synk.im', 위: 'abc123', 계획: '0abf52b987c8',
      항목: Object.entries(후보).map(([경로, v]) => ({ 경로, 종류: 공개본[경로] ? '바꿈' : '새', sha256: crypto.createHash('sha256').update(v).digest('hex'), 모드: '100644' })),
      앞판: Object.fromEntries(Object.entries(공개본).map(([경로, v]) => [경로, 블롭(v)])) }));
  }
  const 옵션 = 이름 => ({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 배포후보: 후보폴더, 경로: ['site', 'dist'] });
  const api = await tool();
  return { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 };
}

test('화면 캡처(배포 후보, 11-01): 후보가 없으면 바탕 판을 끼운다', async t => {
  const f = await 후보캡처시험(t, false); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  const 없음 = await 준비하기({ 이름: '바탕전', 폴더: path.join(r.뿌리, 'out-base'), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕,
    화면: [`영어=${서버.주소}/en/`, '정적=dist/en/index.html'] });
  assert.match(글(없음.폴더, 없음.목록, '전', '영어'), /바탕 영어 줄이기 전/, '후보가 없으면 지금처럼 바뀐 파일만 바탕 판');
  assert.match(글(없음.폴더, 없음.목록, '전', '정적'), /바탕 영어 줄이기 전/);
  assert.equal(없음.목록.화면.전앞판, undefined);
  assert.match(fs.readFileSync(path.join(없음.폴더, 'fable.md'), 'utf8'), /전 = 바탕 판, 후 = 지금 판/);
});

test('화면 캡처(배포 후보, 11-01): 앞판과 후보를 주소와 정적 경로에 끼우고 증명에 묶는다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  const 있음 = await 준비하기({ 이름: '앞판전', 폴더: path.join(r.뿌리, 'out-cand'), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 배포후보: 후보폴더, 경로: ['site', 'dist'],
    화면: [`영어=${서버.주소}/en/`, `새쪽=${서버.주소}/en/new/`, '정적=dist/en/index.html'] });
  assert.deepEqual(있음.목록.파일.map(f => f.경로), ['dist/en/index.html', 'site/content.mjs']);
  assert.match(글(있음.폴더, 있음.목록, '전', '영어'), /공개본 영어 줄인 뒤/, '주소 화면의 전 = 후보의 .앞판(지금 공개본)');
  assert.doesNotMatch(글(있음.폴더, 있음.목록, '전', '영어'), /바탕 영어|합친 가지/);
  assert.match(글(있음.폴더, 있음.목록, '후', '영어'), /후보 영어/, '후는 낡은 서버 대신 검수 후보');
  assert.match(글(있음.폴더, 있음.목록, '전', '정적'), /공개본 영어 줄인 뒤/, '저장소 경로 화면도 후보 뿌리(dist/)로 이어 공개본');
  assert.match(글(있음.폴더, 있음.목록, '후', '정적'), /후보 영어/);
  assert.match(글(있음.폴더, 있음.목록, '전', '새쪽'), /그 판에 없음/, '후보가 「새」로 적은 쪽은 공개본에 없다(404)');
  assert.match(글(있음.폴더, 있음.목록, '후', '새쪽'), /새 쪽/);
  assert.deepEqual(있음.목록.화면.전앞판, { 앞판: 2, 새: 1, 끼움: ['en/index.html', 'en/new/index.html'], 뿌리찾기: { 뿌리: 'dist/', 동률: [] } });
  assert.deepEqual(있음.목록.화면.후후보.끼움, ['en/index.html', 'en/new/index.html']);
  assert.match(있음.목록.화면.후후보.manifestSha256, /^[a-f0-9]{64}$/);
  assert.ok(!있음.목록.화면.못끼움.includes('dist/en/index.html'), '공개본으로 끼운 파일은 못 끼운 것으로 세지 않는다');
  assert.deepEqual(있음.목록.증명.후보앞판, { 위: 'abc123', 항목: Object.fromEntries(Object.entries(공개본).map(([경로, v]) => [경로, 블롭(v)])) }, '전 캡처가 쓴 앞판이 증명에 묶인 그 판이다');
  const 묶음글 = 있음.목록.묶음.map(b => fs.readFileSync(path.join(있음.폴더, b.파일), 'utf8')).join('\n');
  assert.match(묶음글, /화면 「영어」[^\n]*\(전: 같은 주소에 배포 후보의 파일은 지금 공개본\(\.앞판\), 그 밖의 바뀐 파일은 바탕 판\)/);
  assert.match(fs.readFileSync(path.join(있음.폴더, 'fable.md'), 'utf8'), /전 = 지금 공개본\(배포 후보의 \.앞판 2개를 끼움/);
});

for (const 이름 of ['영어', '새쪽', '정적']) test(`화면 캡처(배포 후보, 11-01): 최종 검수의 ${이름} 후 캡처도 후보 뿌리를 찾는다`, async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  const 있음 = await 준비하기({ 이름: '앞판전', 폴더: path.join(r.뿌리, 'out-cand'), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 배포후보: 후보폴더, 경로: ['site', 'dist'],
    화면: [{ 영어: `영어=${서버.주소}/en/`, 새쪽: `새쪽=${서버.주소}/en/new/`, 정적: '정적=dist/en/index.html' }[이름]] });
  // 최종 검수는 「후」만 다시 찍는다. 정적 경로도 후보 뿌리를 계속 찾아야 한다.
  await api.페이블하기(있음.폴더, { 시험: false });
  const 최종 = JSON.parse(fs.readFileSync(path.join(있음.폴더, '페이블자료.json'), 'utf8'));
  const 캡처 = 최종.화면 || 최종.자료?.화면;
  assert.ok(캡처, '최종 캡처 자료');
  const 후장들 = 캡처.장들.filter(x => x.판 === '후');
  assert.deepEqual(후장들.map(x => `${x.기기}/${x.이름}`).sort(), [`1440/${이름}`, `390/${이름}`].sort());
  assert.ok(후장들.every(x => x.후보끼움.length > 0));
});

test('화면 캡처(배포 후보, 11-01): 사용자지정 후보의 전은 지정한 바탕이다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  const { 후보읽기 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  const 있음 = { 목록: { 설정: api.설정만들기(옵션('화면계약')), 파일: [{ 경로: 'dist/en/index.html' }, { 경로: 'site/content.mjs' }], 증명: { 배포후보: 후보읽기(후보폴더) } } };
  // 사용자지정 검수처럼 앞판 증명이 없으면, 공개본에 없는 새 후보라도 전은 지정 바탕이다.
  const 사용자폴더 = path.join(r.뿌리, 'out-custom');
  const 사용자화면 = await api.화면찍기({ ...있음.목록.설정, 파일경로들: 있음.목록.파일.map(x => x.경로), 화면: [{ 이름: '새쪽', 전: { 종류: '경로', 값: 'dist/en/new/index.html' }, 후: { 종류: '경로', 값: 'dist/en/new/index.html' } }] }, 사용자폴더,
    { 후보: 있음.목록.증명.배포후보, 후보앞판: { 판: new Map(), 증명: null } });
  assert.equal(사용자화면.전앞판, undefined);
  assert.match(글(사용자폴더, { 화면: 사용자화면 }, '전', '새쪽'), /바탕에만 있는 새 쪽/);
  assert.match(글(사용자폴더, { 화면: 사용자화면 }, '후', '새쪽'), /후보 새 쪽 전용/);
  assert.doesNotMatch(글(사용자폴더, { 화면: 사용자화면 }, '후', '새쪽'), /바탕에만/);
});

test('화면 캡처(배포 후보, 11-01): 앞판 파일이 없는 새 후보의 전은 404다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  const { 후보읽기 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  const 있음 = { 목록: { 설정: api.설정만들기(옵션('화면계약')), 파일: [{ 경로: 'dist/en/index.html' }, { 경로: 'site/content.mjs' }], 증명: { 배포후보: 후보읽기(후보폴더) } } };
  // 새 파일만 있어 .앞판 증명이 없는 일반 후보도 전은 404다. 사용자지정 여부와 구분한다.
  const 새폴더 = path.join(r.뿌리, 'new-only-candidate');
  넣기(새폴더, { 'en/new/index.html': 후보['en/new/index.html'] });
  const 새후보 = { ...있음.목록.증명.배포후보, 항목: 있음.목록.증명.배포후보.항목.filter(x => x.경로 === 'en/new/index.html') };
  const 새출력 = path.join(r.뿌리, 'out-new-only');
  const 새화면 = await api.화면찍기({ ...있음.목록.설정, 배포후보: 새폴더, 파일경로들: 있음.목록.파일.map(x => x.경로), 화면: [{ 이름: '새쪽', 전: { 종류: '경로', 값: 'dist/en/new/index.html' }, 후: { 종류: '경로', 값: 'dist/en/new/index.html' } }] }, 새출력,
    { 후보: 새후보, 후보앞판: { 판: new Map(), 증명: null }, 앞판씀: true });
  assert.match(글(새출력, { 화면: 새화면 }, '전', '새쪽'), /그 판에 없음/);
  assert.match(글(새출력, { 화면: 새화면 }, '후', '새쪽'), /후보 새 쪽 전용/);
});

test('화면 캡처(배포 후보, 11-01): SPA 이동은 같은 문서를 인정하고 외부 주소는 거절한다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  const spa장면 = path.join(r.뿌리, 'spa-scene.mjs');
  fs.writeFileSync(spa장면, `export default async ({page,찍기,주소들})=>{await page.goto(주소들.정상);await page.evaluate(()=>history.pushState({},'', '/en/new/'));await 찍기('같은문서');}`);
  const spa = await 준비하기({ ...옵션('SPA정상'), 화면: [`정상=${서버.주소}/en/`], 장면: spa장면 });
  assert.match(글(spa.폴더, spa.목록, '후', '같은문서'), /후보 영어/);
  assert.ok(spa.목록.화면.장들.filter(x => x.판 === '후').every(x => x.문서경로 === 'en/index.html' && x.주소.endsWith('/en/new/')));
  await assert.rejects(() => 준비하기({ ...옵션('외부거절'), 화면: ['외부=https://synk.im/en/'] }), /외부 라이브 주소 불가/);
});

test('화면 캡처(배포 후보, 11-01): 다른 탭이 받은 후보로 원래 탭을 증명하지 않는다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  넣기(공개트리, { 'unmapped.html': 쪽('후보 밖 화면') });
  const 다른탭장면 = path.join(r.뿌리, 'other-tab-scene.mjs');
  fs.writeFileSync(다른탭장면, `export default async ({page,찍기,주소들})=>{await page.goto(${JSON.stringify(서버.주소+'/unmapped.html')});const other=await page.context().newPage();await other.goto(주소들.정상);await 찍기('원래탭');}`);
  await assert.rejects(() => 준비하기({ ...옵션('다른탭거절'), 화면: [`정상=${서버.주소}/en/`], 장면: 다른탭장면 }), /하나도 끼우지 못했다.*원래탭/);
});

test('화면 캡처(배포 후보, 11-01): 후보가 없는 화면 한 장도 거절한다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  넣기(공개트리, { 'unmapped.html': 쪽('후보 밖 화면') });
  await assert.rejects(() => 준비하기({ ...옵션('한장누락거절'), 화면: [`정상=${서버.주소}/en/`, `누락=${서버.주소}/unmapped.html`] }), /하나도 끼우지 못했다.*누락/);
});

test('화면 캡처(배포 후보, 11-01): 외부 주소로의 리다이렉트를 거절한다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  const http = require('node:http');
  const outside = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(쪽('리다이렉트 뒤')); });
  await new Promise(resolve => outside.listen(0, '127.0.0.2', resolve));t.after(() => outside.close());
  const 외부주소 = `http://127.0.0.2:${outside.address().port}/landing`;
  assert.match(await (await fetch(외부주소)).text(), /리다이렉트 뒤/);
  const redirect = http.createServer((req, res) => {
    if (req.url === '/jump') { res.writeHead(302, { location: 외부주소 }); res.end(); }
    else { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(쪽('리다이렉트 뒤')); }
  });
  await new Promise(resolve => redirect.listen(0, '127.0.0.1', resolve));t.after(() => redirect.close());
  await assert.rejects(() => 준비하기({ ...옵션('이동거절'), 화면: [`정상=${서버.주소}/en/`, `이동=http://127.0.0.1:${redirect.address().port}/jump`] }), /외부 라이브 주소 불가/);
});

test('화면 캡처(배포 후보, 11-01): 장면이 후보 밖 페이지로 옮기면 거절한다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  넣기(공개트리, { 'unmapped.html': 쪽('후보 밖 화면') });
  const 장면 = path.join(r.뿌리, 'scene.mjs');
  fs.writeFileSync(장면, `export default async ({page,찍기,주소들})=>{await page.goto(주소들.정상);await 찍기('처음');await page.goto(${JSON.stringify(서버.주소+'/unmapped.html')});await 찍기('장면누락');}`);
  await assert.rejects(() => 준비하기({ ...옵션('장면거절'), 화면: [`정상=${서버.주소}/en/`], 장면 }), /하나도 끼우지 못했다.*장면누락/);
});

test('화면 캡처(배포 후보, 11-01): CSS가 적용돼도 주 문서 후보가 누락되면 거절한다', async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  // CSS 후보 하나가 적용돼도, 잘못된 주소뿌리로 주 문서 후보를 놓치면 거절한다.
  넣기(공개트리, { 'en/index.html': 쪽('낡은 본문')+'<link rel="stylesheet" href="/style.css">' });
  넣기(후보폴더, { 'style.css': 'body { color: #123; }' });
  const 메타 = JSON.parse(fs.readFileSync(path.join(후보폴더, '후보.json'), 'utf8'));
  메타.항목.push({ 경로: 'style.css', 종류: '새', sha256: crypto.createHash('sha256').update('body { color: #123; }').digest('hex'), 모드: '100644' });
  fs.writeFileSync(path.join(후보폴더, '후보.json'), JSON.stringify(메타));
  await assert.rejects(() => 준비하기({ ...옵션('주문서누락거절'), 화면: [`본문=${서버.주소}/en/`], 주소뿌리: [`${서버.주소}/en/=site/en/`] }), /후 주 문서를 끼우지 못했다/);
});

async function 접두후보캡처시험(t) {
  const f = await 후보캡처시험(t); if (!f) return null;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션 } = f;
  const http = require('node:http');
  // CSS 후보 하나가 적용돼도, 잘못된 주소뿌리로 주 문서 후보를 놓치면 거절한다.
  넣기(공개트리, { 'en/index.html': 쪽('낡은 본문')+'<link rel="stylesheet" href="/style.css">' });
  넣기(후보폴더, { 'style.css': 'body { color: #123; }' });
  const 메타 = JSON.parse(fs.readFileSync(path.join(후보폴더, '후보.json'), 'utf8'));
  메타.항목.push({ 경로: 'style.css', 종류: '새', sha256: crypto.createHash('sha256').update('body { color: #123; }').digest('hex'), 모드: '100644' });
  fs.writeFileSync(path.join(후보폴더, '후보.json'), JSON.stringify(메타));
  const prefix = http.createServer((req, res) => {
    if (req.url === '/jump') { res.writeHead(302, { location: '/preview/en/index.html' }); res.end(); }
    else if (req.url === '/report.csv') { res.writeHead(200, { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="report.csv"' }); res.end('test,value\n1,2'); }
    else if (req.url.startsWith('/callback?')) { res.writeHead(400); res.end('bad request'); }
    else if (req.url.startsWith('/network?')) { req.socket.destroy(); }
    else if (req.url === '/style-redirect') { res.writeHead(302, { location: '/preview/style.css' }); res.end(); }
    else if (req.url === '/preview/style.css') { res.writeHead(200, { 'content-type': 'text/css' }); res.end('body { color: blue; }'); }
    else if (req.url.startsWith('/plain')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(쪽('후보 없는 문서')); }
    else { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(쪽('리다이렉트의 낡은 본문')+'<link rel="stylesheet" href="/preview/style.css"><iframe src="/preview/en/index.html"></iframe>'); }
  });
  await new Promise(resolve => prefix.listen(0, '127.0.0.1', resolve));t.after(() => prefix.close());
  const prefix주소 = `http://127.0.0.1:${prefix.address().port}`;
  const 추가장면 = (이름, 내용) => { const f = path.join(r.뿌리, 이름+'.mjs'); fs.writeFileSync(f, 내용); return f; };
  const 접두옵션 = 이름 => ({ ...옵션(이름), 화면: [`본문=${prefix주소}/preview/en/index.html`], 주소뿌리: [`${prefix주소}/preview/=dist/`] });
  return { ...f, prefix주소, 접두옵션, 추가장면 };
}

test('화면 캡처(배포 후보, 11-01): 리다이렉트가 낡은 주 문서를 반환하면 거절한다', async t => {
  const f = await 접두후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션, prefix주소, 접두옵션, 추가장면 } = f;
  await assert.rejects(() => 준비하기({ ...옵션('접두주소이동거절'), 화면: [`본문=${prefix주소}/jump`], 주소뿌리: [`${prefix주소}/preview/=dist/`] }), /후 주 문서를 끼우지 못했다/);
});

test('화면 캡처(배포 후보, 11-01): 다운로드 뒤에 받은 CSS로 낡은 주 문서를 증명하지 않는다', async t => {
  const f = await 접두후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션, prefix주소, 접두옵션, 추가장면 } = f;
  const 다운로드장면 = 추가장면('download-scene', `export default async ({page,찍기,판})=>{await page.goto(${JSON.stringify(prefix주소+'/jump')});if(판==='후'){await Promise.all([page.waitForEvent('download'),page.evaluate(()=>{const a=document.createElement('a');a.href='/report.csv';document.body.append(a);a.click();})]);await page.addStyleTag({url:'/preview/style.css'});}await 찍기('다운로드뒤');}`);
  await assert.rejects(() => 준비하기({ ...접두옵션('다운로드거절'), 장면: 다운로드장면 }), /후 주 문서를 끼우지 못했다/);
});

test('화면 캡처(배포 후보, 11-01): 인증 쿼리는 오류와 캡처 묶음에 남기지 않는다', async t => {
  const f = await 접두후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션, prefix주소, 접두옵션, 추가장면 } = f;
  // 인증값은 장면에서만 만들고 주소에서 지운다. 응답·실패 오류와 모든 캡처/묶음 기록에도 다시 나타나면 안 된다.
  const 비밀 = 'SYNTHETIC_AUTH_SECRET_ONLY_FOR_TEST';
  const 비밀장면 = 추가장면('secret-scene', `export default async ({page,찍기,주소들,판})=>{await page.goto(주소들.본문+'?code=${비밀}');await page.evaluate(()=>history.replaceState({},'', '/clean'));if(판==='후')await page.evaluate(async()=>{await fetch('/callback?code=${비밀}');await fetch('/network?token=${비밀}').catch(()=>{});console.error('/callback?code=${비밀}');});await 찍기('인증뒤');}`);
  const 비밀결과 = await 준비하기({ ...접두옵션('비밀없음'), 장면: 비밀장면 });
  assert.equal(비밀결과.목록.화면.장들.filter(x => x.판 === '후').length, 2);
  assert.ok(비밀결과.목록.화면.장들.filter(x => x.판 === '후').every(x => x.문서경로 === 'en/index.html' && x.오류.some(s => s.includes('HTTP 400')) && x.오류.some(s => s.includes('요청 실패'))));
  const 글파일확인 = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) 글파일확인(f); else if (/\.(?:json|md|txt|patch|tap)$/.test(e.name)) assert.ok(!fs.readFileSync(f, 'utf8').includes(비밀), `비밀 문자열이 남은 파일: ${e.name}`); } };
  글파일확인(비밀결과.폴더);
});

test('화면 캡처(배포 후보, 11-01): 현재 문서의 후보 CSS를 인정한다', async t => {
  const f = await 접두후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션, prefix주소, 접두옵션, 추가장면 } = f;
  const CSS장면 = 추가장면('css-scene', `export default async ({page,찍기,판})=>{await page.goto(${JSON.stringify(prefix주소+'/plain-a')});if(판==='후')await page.addStyleTag({url:'/preview/style.css'});await 찍기('CSS후보');}`);
  const CSS결과 = await 준비하기({ ...접두옵션('CSS정상'), 장면: CSS장면 });
  assert.ok(CSS결과.목록.화면.장들.filter(x => x.판 === '후').every(x => x.후보끼움.includes('style.css')));
});

test('화면 캡처(배포 후보, 11-01): 리다이렉트로 받은 서버 CSS를 후보로 인정하지 않는다', async t => {
  const f = await 접두후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션, prefix주소, 접두옵션, 추가장면 } = f;
  const CSS이동 = 추가장면('css-redirect-scene', `export default async ({page,찍기,판})=>{await page.goto(${JSON.stringify(prefix주소+'/plain-a')});if(판==='후')await page.addStyleTag({url:'/style-redirect'});await 찍기('CSS서버');}`);
  await assert.rejects(() => 준비하기({ ...접두옵션('CSS서버거절'), 장면: CSS이동 }), /하나도 끼우지 못했다.*CSS서버/);
});

test('화면 캡처(배포 후보, 11-01): 이전 문서의 후보 CSS는 다음 문서 증거에서 뺀다', async t => {
  const f = await 접두후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션, prefix주소, 접두옵션, 추가장면 } = f;
  const CSS다음 = 추가장면('css-next-scene', `export default async ({page,찍기,판})=>{await page.goto(${JSON.stringify(prefix주소+'/plain-a')});if(판==='후')await page.addStyleTag({url:'/preview/style.css'});await page.goto(${JSON.stringify(prefix주소+'/plain-b')});await 찍기('다음문서');}`);
  await assert.rejects(() => 준비하기({ ...접두옵션('이전CSS거절'), 장면: CSS다음 }), /하나도 끼우지 못했다.*다음문서/);
});

test('화면 캡처(배포 후보, 11-01): 캡처 중 주 문서가 바뀌면 거절한다', async t => {
  const f = await 접두후보캡처시험(t); if (!f) return;
  const { 준비하기, api, r, 쪽, 후보, 공개본, 공개트리, 서버, 글, 후보폴더, 옵션, prefix주소, 접두옵션, 추가장면 } = f;
  const 캡처이동 = 추가장면('capture-navigation-scene', `export default async ({page,찍기,주소들,판})=>{await page.goto(주소들.본문);if(판==='후')await page.evaluate(()=>{const old=scrollTo;let moved=false;window.scrollTo=(...a)=>{old(...a);if(!moved){moved=true;location.href='/plain-b';}}});await 찍기('도중이동');}`);
  await assert.rejects(() => 준비하기({ ...접두옵션('캡처도중이동거절'), 장면: 캡처이동 }), /후 화면 캡처가 끝나지 않았다/);
});

test('후보 응답 형식: MIME과 문자셋이 다른 응답은 같은 바이트여도 제외한다', async () => {
  const { 후보응답형식맞음: 맞음 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수캡처.mjs')));
  assert.equal(맞음({ mimeType: 'text/html', charset: 'utf-8' }, 'index.html'), true);
  assert.equal(맞음({ mimeType: 'TEXT/HTML', charset: 'UTF-8' }, 'index.html'), true);
  assert.equal(맞음({ mimeType: 'text/plain', charset: 'utf-8' }, 'index.html'), false);
  assert.equal(맞음({ mimeType: 'text/html', charset: 'windows-1252' }, 'index.html'), false);
  assert.equal(맞음({ mimeType: 'text/html' }, 'index.html'), false);
  assert.equal(맞음({ mimeType: 'text/css', charset: 'utf-8' }, 'style.css'), true);
  assert.equal(맞음({ mimeType: 'text/plain', charset: 'utf-8' }, 'style.css'), false);
  assert.equal(맞음({ mimeType: 'image/png', charset: '' }, 'image.png'), true);
  assert.equal(맞음({ mimeType: 'text/plain', charset: 'utf-8' }, 'gone.html', true), true);
  assert.equal(맞음({ mimeType: 'text/html', charset: 'utf-8' }, 'gone.html', true), false);
});

for (const [이름, 형식, 인정] of [
  ['plain', 'text/plain; charset=utf-8', false],
  ['html', 'text/html; charset=utf-8', true],
  ['latin1', 'text/html; charset=windows-1252', false],
  ['charset없음', 'text/html', false],
]) test(`후보 응답 MIME: 리다이렉트 HTML ${이름}`, async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, r, 후보, 옵션, 글 } = f;
  const http = require('node:http');
  const server = http.createServer((req, res) => {
    if (req.url === '/jump') { res.writeHead(302, { location: '/preview/en/index.html' }); res.end(); }
    else { res.writeHead(200, { 'content-type': 형식, 'x-content-type-options': 'nosniff' }); res.end(후보['en/index.html']); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const 주소 = `http://127.0.0.1:${server.address().port}`;
  const 실행 = () => 준비하기({ ...옵션(`MIME-${이름}`), 화면: [`본문=${주소}/jump`], 주소뿌리: [`${주소}/preview/=dist/`] });
  if (!인정) await assert.rejects(실행, /후보 파일을 하나도 끼우지 못했다/);
  else {
    const 결과 = await 실행();
    assert.equal(글(결과.폴더, 결과.목록, '후', '본문'), '후보 영어');
    assert.ok(결과.목록.화면.장들.filter(x => x.판 === '후').every(x => x.후보끼움.includes('en/index.html') && x.문서덧));
  }
});

for (const 잘못된형식 of [false, true]) test(`후보 응답 MIME: CSS ${잘못된형식 ? 'plain nosniff는 제외' : '정상 route는 적용'}`, async t => {
  const f = await 후보캡처시험(t); if (!f) return;
  const { 준비하기, r, 후보, 후보폴더, 옵션 } = f;
  const css = 'body { color: rgb(17, 34, 51); }';
  const html = 후보['en/index.html'] + `<link rel="stylesheet" href="${잘못된형식 ? '/style-jump' : '/preview/style.css'}">`;
  넣기(후보폴더, { 'en/index.html': html, 'style.css': css });
  const manifestPath = path.join(후보폴더, '후보.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.항목.find(x => x.경로 === 'en/index.html').sha256 = crypto.createHash('sha256').update(html).digest('hex');
  manifest.항목.push({ 경로: 'style.css', 종류: '새', sha256: crypto.createHash('sha256').update(css).digest('hex'), 모드: '100644' });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const http = require('node:http');
  const server = http.createServer((req, res) => {
    if (req.url === '/style-jump') { res.writeHead(302, { location: '/preview/style.css' }); res.end(); }
    else if (req.url === '/preview/style.css') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' }); res.end(css); }
    else { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const 주소 = `http://127.0.0.1:${server.address().port}`;
  const 장면 = path.join(r.뿌리, 'mime-css-scene.mjs');
  fs.writeFileSync(장면, `export default async ({page,찍기,주소들,판})=>{await page.goto(주소들.본문);await 찍기('CSS형식');if(판==='후'){const color=await page.evaluate(()=>getComputedStyle(document.body).color);if(color!==${JSON.stringify(잘못된형식 ? 'rgb(0, 0, 0)' : 'rgb(17, 34, 51)')})throw new Error('CSS 색이 다르다: '+color);}}`);
  const 결과 = await 준비하기({ ...옵션('CSS형식'), 화면: [`본문=${주소}/preview/en/index.html`], 주소뿌리: [`${주소}/preview/=dist/`], 장면 });
  const 장들 = 결과.목록.화면.장들.filter(x => x.판 === '후');
  assert.equal(장들.length, 2);
  assert.ok(장들.every(x => x.후보끼움.includes('en/index.html') && x.문서덧));
  assert.ok(장들.every(x => x.후보끼움.includes('style.css') === !잘못된형식));
});

test('후 후보 판보기: 새 파일·삭제·캐시 주소를 잇고 외부 주소와 바뀐 바이트를 거절한다', async t => {
  const api = await tool();
  const r = 임시저장소(t, { 'a.txt': 'old' });
  const 폴더 = path.join(r.뿌리, 'candidate');
  넣기(폴더, { 'index.html': 'candidate' });
  const 후보 = { 항목: [
    { 경로: 'index.html', 종류: '새', sha256: crypto.createHash('sha256').update('candidate').digest('hex') },
    { 경로: 'gone.html', 종류: '지움', sha256: null },
  ] };
  const 보기 = api.후판보기만들기(() => undefined, { 후보, 폴더, 뿌리: 'dist/' });
  assert.equal(보기('dist/index.html').toString(), 'candidate');
  assert.equal(보기(`${api.공개표}gone.html`), null);
  assert.equal(보기('other.js'), undefined);
  const 찾기 = api.전경로찾기만들기({ 명시찾기: () => null, 경로찾기: () => null, 아는: 보기.아는 });
  assert.equal(찾기('http://localhost:1234/?v=new'), `${api.공개표}index.html`);
  assert.doesNotThrow(() => api.후보화면주소확인(['http://127.0.0.1:1234/', 'http://localhost:1234/a']));
  for (const 주소 of ['https://synk.im/', 'http://localhost.evil.invalid/', undefined]) assert.throws(() => api.후보화면주소확인([주소]), /외부 라이브 주소 불가/);
  fs.writeFileSync(path.join(폴더, 'index.html'), 'changed');
  assert.throws(() => api.후판보기만들기(() => undefined, { 후보, 폴더 }), /캡처 중 배포 후보가 바뀌었다/);
});

test('가져온 캡처(--캡처): 전·후/<기기>/<이름>.png를 그대로 견주고, fable.md 표에 1440·390 밖의 기기도 싣는다', async t => {
  let odiff = null;
  try { odiff = require('odiff-bin'); } catch { /* 건너뜀 */ }
  if (!odiff) return t.skip('odiff-bin이 없다');
  const { 준비하기 } = await tool();
  const r = 임시저장소(t, { 'a.txt': '1\n' });
  r.쓰기('a.txt', '2\n');
  // 1×1 흰 점과 검은 점 PNG
  const 흰 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
  const 검 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const 원본 = path.join(r.뿌리, '찍어둔');
  for (const [p, b] of [['전/1280/홈.png', 흰], ['후/1280/홈.png', 검]]) { fs.mkdirSync(path.dirname(path.join(원본, p)), { recursive: true }); fs.writeFileSync(path.join(원본, p), b); }
  fs.writeFileSync(path.join(원본, '전/1280/홈.txt'), '옛 글');
  fs.writeFileSync(path.join(원본, '후/1280/홈.txt'), '새 글');
  const { 폴더, 목록 } = await 준비하기({ 이름: '가져옴', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 캡처: 원본 });
  assert.equal(목록.가져온캡처.차이들[0].같음, false);
  const 페 = fs.readFileSync(path.join(폴더, 'fable.md'), 'utf8');
  assert.match(페, /가져온 캡처, 기기 1280/);
  assert.match(페, /\| 홈 \| 1280 \| `캡처-가져옴\/전\/1280\/홈\.png` \| `캡처-가져옴\/후\/1280\/홈\.png` \|/);
  assert.match(fs.readFileSync(path.join(폴더, 목록.묶음.at(-1).파일), 'utf8'), /화면 「홈」[\s\S]*-옛 글[\s\S]*\+새 글/);
});

// 1×1 RGBA 두 장(거르개 1) — 노란 반투명 · 파란 반투명
const 노점 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
const 파점 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('그림 잇기: PNG 조각을 위에서부터 한 장으로 잇고, PNG가 아니면 멈춘다', async () => {
  const { 그림잇기, png풀기 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수캡처.mjs')));
  const p = png풀기(그림잇기([노점, 파점, 노점]));
  assert.deepEqual([p.폭, p.높이, p.색], [1, 3, 6]);
  assert.deepEqual([...p.화소], [255, 255, 0, 127, 0, 0, 255, 127, 255, 255, 0, 127]);
  assert.throws(() => 그림잇기([노점, Buffer.from('그림 아님')]), /PNG가 아니다/);
});

test('안정된그림: 찍을 때마다 조각을 다시 정해, 조각 수나 내용이 바뀌면 다시 찍고 같아진 조각을 잇는다', async () => {
  const { 안정된그림, png풀기 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수캡처.mjs')));
  // 셋 → 둘(앞 둘과 같지만 수가 달라 같지 않다) → 둘(같음, 안정)
  const 계획들 = [['노', '파', '노'], ['노', '파'], ['노', '파']];
  let 회 = 0;
  const page = { screenshot: async x => ({ 노: 노점, 파: 파점 })[x], waitForTimeout: async () => {} };
  const r = await 안정된그림(page, async () => 계획들[Math.min(회++, 계획들.length - 1)]);
  assert.deepEqual([r.흔들림, r.찍은수, r.조각], [false, 3, 2]);
  assert.deepEqual([...png풀기(r.그림).화소], [255, 255, 0, 127, 0, 0, 255, 127]);
  const 한장 = await 안정된그림(page, '노');
  assert.ok(한장.그림.equals(노점), '조각이 하나면 찍은 그대로');
});

test('긴 쪽 캡처: 배율 2로 그림이 16,384화소를 넘는 쪽은 나눠 찍어 바닥글까지 잇고, 짧은 전과 같은 배율로 견준다', async t => {
  let browser;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  } catch { /* 아래에서 건너뜀 */ }
  if (!browser) return t.skip('브라우저를 띄울 수 없다(playwright·Chrome 없음)');
  await browser.close();
  const 캡 = await import(pathToFileURL(path.join(root, 'tools/lib/검수캡처.mjs')));
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-tall-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  // 머리(파랑 200) + 100px 줄들(줄마다 다른 색, 글은 왼쪽 100px 밖) + 바닥글(빨강 300). 전 25줄 = CSS 3,000 · 후 90줄 = CSS 9,500(×2 = 19,000화소)
  const 줄색 = i => [0, i * 2 % 256, i % 2 ? 0 : 128];
  const 쪽 = 줄수 => `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>긴 쪽</title>
<style>body{margin:0;font:16px sans-serif}header{height:200px;background:#00f}.r{height:100px;padding-left:100px;box-sizing:border-box;color:#fff}footer{height:300px;background:#f00}</style>
<header></header>${Array.from({ length: 줄수 }, (_, i) => `<div class="r" style="background:rgb(${줄색(i)})">줄 ${i}</div>`).join('')}<footer></footer></html>`;
  const 사이트 = path.join(뿌리, 'site');
  fs.mkdirSync(사이트);
  fs.writeFileSync(path.join(사이트, '전.html'), 쪽(25));
  fs.writeFileSync(path.join(사이트, '후.html'), 쪽(90));
  const 서버 = await 캡.정적서버(사이트);
  let r;
  try {
    r = await 캡.찍기({ 화면들: [{ 이름: '긴', 주소: { 전: `${서버.주소}/전.html`, 후: `${서버.주소}/후.html` } }], 판들: [{ 이름: '전', 덧: null }, { 이름: '후', 덧: null }], 폴더: path.join(뿌리, '캡처') });
  } finally { await 서버.닫기(); }
  assert.deepEqual(r.못연, []);
  const 장 = (판, 기기) => r.장들.find(x => x.판 === 판 && x.기기 === 기기);
  const 그림 = x => 캡.png풀기(fs.readFileSync(x.그림));
  const 색 = (p, x, y) => { const 점 = p.색 === 6 ? 4 : 3, i = (y * p.폭 + x) * 점; return [...p.화소.subarray(i, i + 3)]; };
  const 후 = 그림(장('후', '390'));
  assert.equal(장('후', '390').높이, 9500);
  assert.equal(장('후', '390').조각, 2, '9,500 × 2는 한 장 한계를 넘어 두 조각으로 찍는다');
  assert.deepEqual([후.폭, 후.높이], [780, 19000], '기기 배율(2) 그대로 CSS 높이 전체');
  assert.deepEqual(색(후, 10, 후.높이 - 5), [255, 0, 0], '맨 아래는 바닥글');
  assert.deepEqual(색(후, 10, 16450), 줄색(80), '16,384화소 아래도 제 줄(CSS 8,225px = 80번 줄) — 페이지 머리가 다시 찍히지 않는다');
  assert.deepEqual(색(후, 10, 5), [0, 0, 255], '맨 위는 머리');
  const 전 = 그림(장('전', '390'));
  assert.ok(!장('전', '390').조각, '한 장에 들어가는 쪽은 그대로 한 번에 찍는다');
  assert.deepEqual([전.폭, 전.높이], [780, 6000]);
  const 큰 = 그림(장('후', '1440'));
  assert.deepEqual([큰.폭, 큰.높이, 장('후', '1440').조각], [1440, 9500, undefined], '배율 1은 9,500px도 한 장');
  // 짧은 전(한 장)과 긴 후(이은 그림)를 같은 배율로 견준다 — 처음 달라지는 곳은 전의 바닥글 자리(CSS 2,700px)
  const 차 = r.차이들.find(x => x.기기 === '390');
  assert.equal(차.같음, false);
  assert.equal(차.위, 2700);
  assert.equal(캡.png풀기(fs.readFileSync(차.그림)).폭, 780);
  // 풀었다 다시 묶어도 화소가 같다 — Chromium이 묶은 그림을 odiff(따로 푸는 쪽)로 견준다
  const { compare } = require('odiff-bin');
  const 다시 = path.join(뿌리, '다시.png');
  fs.writeFileSync(다시, 캡.그림잇기([fs.readFileSync(장('후', '1440').그림)]));
  assert.equal((await compare(장('후', '1440').그림, 다시, path.join(뿌리, '다시-차이.png'), { threshold: 0 })).match, true);
});

// ── GPT 2차 검수(2026-10-22): 백엔드는 아르곤과 GPT가 같은 묶음을 함께 본다 ──
const 답하기 = (지적 = []) => async ({ prompt }) => {
  const 표식 = /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1];
  const seen = [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]);
  return { text: JSON.stringify({ findings: 지적, seen, coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식 }) };
};
const 지적하나 = (location, grade = 'P1') => ({ grade, location, quote: 'b = 3', problem: '부르는 곳이 2를 기대한다', fix: '부르는 곳도 고친다' });

const 몫충분 = () => ({ 주간: 0.9 });
const final답 = 증명 => JSON.stringify({ findings: [], argonReview: [], coverage: { reviewed: '요구 파일 전체와 영향 범위', limitations: '', complete: true, missing: [] }, seen: 증명.항목, reviewInputHash: 증명.검토입력해시, endMarker: 증명.표식 });

test('입력 전문: 긴 추가·삭제·곁자료와 큰 diff는 생략 없이 조각으로 보낸다', async t => {
  const { 준비하기, 낱말줄이기 } = await tool();
  const old = '옛'.repeat(5000) + '삭제가운데표식' + '끝'.repeat(5000), fresh = '새'.repeat(5000) + '추가가운데표식' + '끝'.repeat(5000);
  const changed = 낱말줄이기(`@@ -1 +1 @@\n-${old}\n+${fresh}\n~`, { 파일이름: 'a.js' }).join('\n');
  assert.ok(changed.includes(old) && changed.includes(fresh));
  const r = 임시저장소(t, { 'src/a.js': 'export const a=1;\n', 'dep.txt': '곁자료\n' });
  r.쓰기('src/a.js', `export const a=${JSON.stringify(fresh.repeat(8))};\n`); r.쓰기('dep.txt', old);
  const { 폴더, 목록 } = await 준비하기({ 이름: 'full', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, 경로: ['src/a.js'], 곁: ['dep.txt'], 크기: 40000 });
  assert.ok(목록.묶음.length > 3);
  const all = 목록.묶음.map(b => fs.readFileSync(path.join(폴더, b.파일), 'utf8')).join('\n');
  assert.ok(all.includes('추가가운데표식') && all.includes('삭제가운데표식'));
  assert.ok(!/\(\d+자 줄임\)/.test(all)); assert.ok(목록.묶음.every(b => b.바이트 <= 40000));
});

test('현재 증명: 필수 검수·원문·소스·의존 파일을 검사하고 무관한 HEAD 이동은 허용', async t => {
  const api = await tool(), r = 임시저장소(t, { 'src/a.js': 'a=1\n', 'dep.txt': 'dep\n' }); r.쓰기('src/a.js', 'a=2\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'proof', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, 경로: ['src/a.js'], 곁: ['dep.txt'] });
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 });
  assert.equal(api.검수확인(폴더).통과, false, 'GPT 미실행');
  await api.GPT보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 }); assert.deepEqual(api.검수확인(폴더).사유, []);
  fs.writeFileSync(path.join(폴더, '묶음.json'), JSON.stringify({ ...목록, 묶음: [] }));
  assert.equal(api.검수확인(폴더).통과, false, '비어 있는 묶음으로 완독을 만들지 않는다');
  fs.writeFileSync(path.join(폴더, '묶음.json'), JSON.stringify(목록));
  r.쓰기('unrelated.txt', '무관\n'); r.g('add', 'unrelated.txt'); r.g('commit', '-qm', '무관');
  assert.equal(api.검수확인(폴더).통과, true);
  r.쓰기('src/a.js', 'a=3\n'); assert.match(api.검수확인(폴더).사유.join(' '), /검수 뒤 파일 변경: src\/a.js/);
  r.쓰기('src/a.js', 'a=2\r\n'); assert.equal(api.검수확인(폴더).통과, true, 'Git LF와 Windows CRLF는 같은 원천');
  r.쓰기('dep.txt', 'changed\n'); assert.match(api.검수확인(폴더).사유.join(' '), /dep.txt/); r.쓰기('dep.txt', 'dep\n');
  const f = path.join(폴더, `GPT-${목록.묶음[0].이름}.json`), result = JSON.parse(fs.readFileSync(f)); result.원문 = '{}'; result.상태 = '읽음'; fs.writeFileSync(f, JSON.stringify(result));
  assert.equal(api.검수확인(폴더).통과, false, '저장된 상태 읽음을 믿지 않는다');
  fs.writeFileSync(path.join(폴더, '묶음.json'), JSON.stringify({ ...목록, 판: 1 })); assert.equal(api.검수확인(폴더).통과, false);
});

test('응답 completeness: 빈 객체·누락·추가 seen은 실패, 정상 0건은 유효', async () => {
  const { 답대조, 페이블지적넣기 } = await tool(), expected = { 항목: ['D1-hash'], 표식: 'END' };
  const good = { findings: [], seen: ['D1-hash'], endMarker: 'END', coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] } };
  assert.equal(답대조(expected, good).상태, '읽음');
  for (const bad of [{}, { ...good, seen: [] }, { ...good, seen: ['D1-hash', 'extra'] }, { ...good, coverage: { ...good.coverage, complete: false, missing: ['D1-hash'] } }]) assert.notEqual(답대조(expected, bad).상태, '읽음');
  assert.throws(() => 페이블지적넣기({ 지적: [] }, {}), /응답 검증 실패/);
});

test('카본 작성 화면도 독립 아르곤·Fable과 최종 바이트 대조를 모두 요구한다', async t => {
  const api = await tool(), 증명 = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  const 정책 = 증명.정책만들기({ 종류: '화면', 작성자: '카본' }, []);
  assert.deepEqual(정책.필수, ['아르곤', 'Fable']);
  assert.equal(증명.대체순서(정책), null);
  assert.throws(() => 증명.정책만들기({ 종류: '백엔드', 작성자: '카본' }, []), /화면 구현에만/);
  assert.throws(() => 증명.정책만들기({ 종류: '화면', 작성자: '카본' }, [], { 판: 5 }), /현재 판/);
  assert.throws(() => 증명.정책만들기({ 종류: '화면', 작성자: '카본', GPT구독: '종료', 사유: '시험' }, []), /Claude 작업/);
  assert.deepEqual(증명.정책만들기({ 종류: '백엔드', 작성자: 'GPT' }, []).필수, ['GPT', 'Claude']);
  const r = 임시저장소(t, { 'view.html': '<p>옛</p>\n' }); r.쓰기('view.html', '<p>새</p>\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'carbon-screen', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 작성자: '카본', 바탕: r.바탕 });
  assert.equal(목록.정책.작성자, '카본');
  assert.equal(api.검수확인(폴더).통과, false, '구현만으로 검수 통과가 아니다');
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 });
  assert.equal(api.검수확인(폴더).통과, false, '독립 카본 검수 뒤에도 최종 검수가 필요하다');
  const proof = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'))).증명;
  api.페이블받기(폴더, final답(proof));
  assert.equal(api.검수확인(폴더).통과, true);
  r.쓰기('view.html', '<p>검수 뒤 바뀜</p>\n');
  assert.equal(api.검수확인(폴더).통과, false, '카본 작성도 검수 뒤 바뀐 파일은 거절한다');
});

test('화면 아르곤 A→수정→Fable B는 정상, B 이후 수정·낡은 Fable 답은 실패', async t => {
  const api = await tool(), r = 임시저장소(t, { 'view.txt': 'a\n' }); r.쓰기('view.txt', 'b\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'screen', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕 });
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 });
  const old = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'))).증명;
  r.쓰기('view.txt', 'c\n'); await api.페이블하기(폴더, { 시험: false, 캡처: false });
  assert.throws(() => api.페이블받기(폴더, final답(old)), /최종 검토 입력 해시/);
  const now = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'))).증명; api.페이블받기(폴더, final답(now)); assert.deepEqual(api.검수확인(폴더).사유, []);
  r.쓰기('view.txt', 'd\n'); assert.equal(api.검수확인(폴더).통과, false);
});

test('화면 Fable 생략(10-24): 아르곤만 끝까지 읽으면 통과, 막히면 Fable이 대신, 고친 아르곤 P1은 다시(아르곤·Fable), 다시 볼 지적 없는 다시는 아르곤만', async t => {
  const api = await tool(), 증명 = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  assert.throws(() => 증명.정책만들기({ 종류: '백엔드', 페이블생략: '그림만' }, []), /화면 검수에서/);
  assert.throws(() => 증명.정책만들기({ 종류: '화면', 페이블생략: ' ' }, []), /까닭과 함께/);
  assert.deepEqual(증명.정책만들기({ 종류: '화면' }, []).필수, ['아르곤', 'Fable'], '주지 않으면 지금처럼 Fable 최종까지');
  assert.ok(!('페이블생략' in 증명.정책만들기({ 종류: '화면' }, [])), '옛 묶음의 정책 해시가 그대로다');
  const r = 임시저장소(t, { 'view.html': '<p>옛</p>\n' }); r.쓰기('view.html', '<p>새</p>\n');
  const 준비 = 이름 => api.준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 페이블생략: '그림만 바꿈' });
  // ① 아르곤 0건이면 Fable 없이 통과
  const s = await 준비('skip');
  assert.deepEqual(s.목록.정책.필수, ['아르곤']); assert.equal(s.목록.정책.페이블생략, '그림만 바꿈');
  assert.match(증명.필수글(s.목록.정책), /Fable 생략 — 그림만 바꿈/);
  assert.match(api.검수확인(s.폴더).사유.join(' / '), /필수 아르곤 검수 미완료/);
  await api.아르곤보내기(s.폴더, s.목록, { call: 답하기(), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(s.폴더).사유, []);
  const 집계 = x => api.집계하기(x.목록, api.결과들읽기(x.폴더, x.목록), api.지적표읽기(x.폴더));
  assert.equal(집계(s).배포조건충족, true, 집계(s).조건.join(' / '));
  // ② 아르곤이 한도로 막히면 Fable이 대신한다
  const b = await 준비('skip-blocked');
  await api.아르곤보내기(b.폴더, b.목록, { call: async () => { throw new Error('RESOURCE_EXHAUSTED quota'); }, 몫: 몫충분 });
  assert.match(api.검수확인(b.폴더).사유.join(' / '), /아르곤이 한도·로그인으로 막혀 Fable 검수로 대신/);
  assert.ok(집계(b).조건.some(x => /Fable 검수로 대신/.test(x)), 집계(b).조건.join(' / '));
  await api.페이블하기(b.폴더, { 시험: false, 캡처: false });
  api.페이블받기(b.폴더, final답(JSON.parse(fs.readFileSync(path.join(b.폴더, '페이블자료.json'))).증명));
  assert.deepEqual(api.검수확인(b.폴더).사유, []);
  // ③ 고친 아르곤 P1은 Fable 없이 닫히지 않는다 — 다시 검수에서 아르곤·Fable이 고친 diff를 본다
  const p = await 준비('skip-p1');
  await api.아르곤보내기(p.폴더, p.목록, { call: 답하기([{ ...지적하나('view.html:1'), quote: '<p>새</p>' }]), 몫: 몫충분 });
  api.지적표고치기(p.폴더, 표 => api.처리하기(표, ['A1=반영']));
  assert.match(api.검수확인(p.폴더).사유.join(' / '), /A1 P1 미해결 — 반영: 고친 diff를 다시 검수받는다/);
  assert.ok(집계(p).조건.some(x => /A1 P1 반영 — 고친 diff를 다시 검수받는다.*아르곤·Fable/.test(x)), 집계(p).조건.join(' / '));
  r.쓰기('view.html', '<p>새 글</p>\n');
  const d = await api.다시하기({ 이름: 'skip-p1-again', 폴더: path.join(r.뿌리, 'skip-p1-again'), 앞: p.폴더 });
  assert.deepEqual(d.목록.검수자들, ['아르곤', 'Fable']);
  assert.deepEqual(d.목록.대상.map(x => x.번호), ['A1']);
  // ④ 다시 볼 지적이 없는 다시 검수는 아르곤만 본다
  const e = await api.다시하기({ 이름: 'skip-again', 폴더: path.join(r.뿌리, 'skip-again'), 앞: s.폴더, 함께올림: '시험' });
  assert.deepEqual(e.목록.검수자들, ['아르곤']); assert.deepEqual(e.목록.대상, []);
  await api.아르곤보내기(e.폴더, e.목록, { call: 다시답하기(), 몫: 몫충분 });
  const ok = api.검수확인(e.폴더);
  assert.deepEqual(ok.사유, []); assert.deepEqual(ok.증명.사슬, ['skip', 'skip-again']);
});

test('Fable 재검수: 위치·인용이 같아도 문제 문장이 바뀌면 새 지적을 처리해야 한다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'view.txt': 'a\n' }); r.쓰기('view.txt', 'b\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'fable-repeat', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕 });
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 });
  const 증명 = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'))).증명;
  const reply = problem => JSON.stringify({ ...JSON.parse(final답(증명)), findings: [{ grade: 'P1', location: 'view.txt:1', quote: 'b', problem, fix: '표시 조건 확인' }] });
  assert.deepEqual(api.페이블받기(폴더, reply('표시가 빠진다')), ['F1']);
  api.지적표고치기(폴더, 표 => api.처리하기(표, ['F1=재현 안 됨:해당 조건에서 표시 확인']));
  assert.equal(api.검수확인(폴더).통과, true);
  assert.deepEqual(api.페이블받기(폴더, reply('특정 순서에서 표시가 빠진다')), ['F2']);
  const 표 = api.지적표읽기(폴더);
  assert.equal(표.지적.length, 2); assert.equal(표.지적.find(x => x.번호 === 'F1').처리, '재현 안 됨');
  assert.equal(표.지적.find(x => x.번호 === 'F2').처리, null);
  assert.match(api.검수확인(폴더).사유.join(' / '), /F2 P1 미해결/);
  api.지적표고치기(폴더, current => api.처리하기(current, ['F2=재현 안 됨:지정 순서에서도 표시 확인']));
  assert.deepEqual(api.검수확인(폴더).사유, []);
});

test('검수자 재검수: 같은 위치·인용의 새 문제에 옛 재현 안 됨 처리를 잇지 않는다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'reviewer-repeat', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 작성자: 'GPT', 바탕: r.바탕 });
  const b = 목록.묶음[0], prompt = fs.readFileSync(path.join(폴더, b.파일), 'utf8');
  for (const who of ['아르곤', 'GPT', 'Claude']) api.검수받기(폴더, who, b.이름, (await 답하기()({ prompt })).text);
  for (const who of ['아르곤', 'GPT', 'Claude']) {
    const first = (await 답하기([{ ...지적하나('a.js:1'), problem: '처음 문제' }])({ prompt })).text;
    api.검수받기(폴더, who, b.이름, first);
    const id = api.지적표읽기(폴더).지적.find(x => x.출처 === who).번호;
    api.지적표고치기(폴더, 표 => api.처리하기(표, [`${id}=재현 안 됨:처음 조건에서 확인`]));
    api.검수받기(폴더, who, b.이름, first);
    assert.equal(api.지적표읽기(폴더).지적.find(x => x.번호 === id).처리, '재현 안 됨', `${who}: 같은 문제의 처리는 유지`);
    assert.equal(api.검수확인(폴더).통과, true);
    api.검수받기(폴더, who, b.이름, (await 답하기([{ ...지적하나('a.js:1'), problem: '새 조건의 다른 문제' }])({ prompt })).text);
    const fresh = api.지적표읽기(폴더).지적.find(x => x.번호 === id);
    assert.equal(fresh.처리, null); assert.equal(fresh.이유, '');
    assert.equal(api.검수확인(폴더).통과, false, `${who}: 새 P1은 다시 처리해야 한다`);
    api.지적표고치기(폴더, 표 => api.처리하기(표, [`${id}=재현 안 됨:새 조건에서도 확인`]));
    assert.equal(api.검수확인(폴더).통과, true);
  }
});

test('몫 0 경계: 사전 0이면 호출하지 않고, 정상 답을 받은 뒤 0이어도 읽음을 유지한다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'quota-boundary', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 작성자: 'GPT', 바탕: r.바탕 });
  const blocked = await api.GPT보내기(폴더, 목록, { 몫: () => ({ 주간: 0 }), call: async () => assert.fail('사전 몫 0에서 모델을 호출할 수 없다') });
  assert.equal(blocked[0].상태, '막힘'); assert.equal(blocked[0].원문, null); assert.ok(blocked[0].차단증거);
  let quotaReads = 0;
  const answered = await api.GPT보내기(폴더, 목록, { 몫: () => ({ 주간: quotaReads++ ? 0 : 0.5 }), call: 답하기() });
  assert.equal(answered[0].상태, '읽음'); assert.equal(answered[0].차단증거, null); assert.equal(answered[0].몫.뒤.주간, 0);
  for (const b of 목록.묶음) api.검수받기(폴더, 'Claude', b.이름, (await 답하기()({ prompt: fs.readFileSync(path.join(폴더, b.파일), 'utf8') })).text);
  assert.deepEqual(api.검수확인(폴더).사유, []);
});

test('GPT 작성은 외부 Claude 응답 필요, 한도 실패 원문만 대체 사유', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'gpt-owner', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 작성자: 'GPT', 바탕: r.바탕 });
  await api.GPT보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 }); assert.equal(api.검수확인(폴더).통과, false);
  const missing = api.집계하기(목록, [], api.지적표읽기(폴더), api.결과들읽기(폴더, 목록, 'GPT'));
  assert.equal(missing.한줄, 'GPT 0건(반영 0) · Claude 미실행'); assert.equal(missing.배포조건충족, false);
  for (const b of 목록.묶음) api.검수받기(폴더, 'Claude', b.이름, (await 답하기([지적하나('a.js:1', 'P2')])({ prompt: fs.readFileSync(path.join(폴더, b.파일), 'utf8') })).text);
  assert.deepEqual(api.검수확인(폴더).사유, []);
  execFileSync(process.execPath, [path.join(root, 'tools/검수묶음.mjs'), '집계', 폴더], { encoding: 'utf8' });
  const report = fs.readFileSync(path.join(폴더, '보고.md'), 'utf8');
  assert.match(report, /GPT 0건\(반영 0\) · Claude 1건\(반영 0\)/); assert.match(report, /필수 검수: GPT · Claude/);
  assert.match(report, /Claude A 읽음/); assert.match(report, /Claude: P0 0·P1 0·P2 1/); assert.doesNotMatch(report, /아르곤 0건/);
  // Claude 백엔드(정책 판 2)는 GPT 하나 — GPT가 한도로 막힌 실패 원문이 있을 때만 아르곤이 대신한다
  const other = await api.준비하기({ 이름: 'blocked', 폴더: path.join(r.뿌리, 'blocked'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  await api.GPT보내기(other.폴더, other.목록, { call: async () => { throw new Error('GPT 한도(quota) — You have hit your usage limit'); }, 몫: 몫충분 });
  await api.아르곤보내기(other.폴더, other.목록, { call: 답하기(), 몫: 몫충분 }); assert.deepEqual(api.검수확인(other.폴더).사유, []);
  const f = path.join(other.폴더, 'GPT-A.json'), v = JSON.parse(fs.readFileSync(f)); v.실패원문 = 'socket timeout; quota may be available'; fs.writeFileSync(f, JSON.stringify(v));
  assert.match(api.검수확인(other.폴더).사유.join(' / '), /필수 GPT 검수 미완료/);
});

test('정책 판 2·5: Claude 백엔드는 GPT 하나 — 막히면 아르곤 → Fable, 옛 판 1 증거(아르곤+GPT·GPT만)도 통과', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  // 판 5로 봉인한 묶음(11-08 판 6 전) — 판 6의 그록 차례는 아래 「그록 대체(정책 판 6 · 11-08)」 시험이 본다
  const 준비 = (이름, 덧 = {}) => api.준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, 정책판: 5, ...덧 });
  const 한도 = 누구 => async () => { throw new Error(누구 === 'GPT' ? 'You have hit your usage limit' : 'RESOURCE_EXHAUSTED quota'); };
  // GPT 하나로 통과 — 아르곤은 돌리지 않는다
  const a = await 준비('gpt-only');
  assert.equal(a.목록.정책.판, 5); assert.deepEqual(a.목록.정책.필수, ['GPT']);
  assert.match(api.검수확인(a.폴더).사유.join(' / '), /필수 GPT 검수 미완료/);
  await api.GPT보내기(a.폴더, a.목록, { call: 답하기(), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(a.폴더).사유, []);
  const s = api.집계하기(a.목록, [], api.지적표읽기(a.폴더), api.결과들읽기(a.폴더, a.목록, 'GPT'));
  assert.equal(s.한줄, 'GPT 0건(반영 0)'); assert.equal(s.배포조건충족, true);
  execFileSync(process.execPath, [path.join(root, 'tools/검수묶음.mjs'), '집계', a.폴더], { encoding: 'utf8' });
  assert.match(fs.readFileSync(path.join(a.폴더, '보고.md'), 'utf8'), /필수 검수: GPT\(한도·로그인으로 막히면 아르곤 → Fable\)/);
  // 아르곤만으로는 안 된다 — GPT가 막힌 증거가 없으면 대신이 아니다
  const b = await 준비('argon-only');
  await api.아르곤보내기(b.폴더, b.목록, { call: 답하기(), 몫: 몫충분 });
  assert.match(api.검수확인(b.폴더).사유.join(' / '), /필수 GPT 검수 미완료/);
  assert.equal(api.집계하기(b.목록, api.결과들읽기(b.폴더, b.목록), api.지적표읽기(b.폴더)).한줄, '아르곤 0건(반영 0) · GPT 미실행');
  // GPT가 한도로 막히면 아르곤이 대신한다
  await api.GPT보내기(b.폴더, b.목록, { call: 한도('GPT'), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(b.폴더).사유, []);
  assert.equal(api.집계하기(b.목록, api.결과들읽기(b.폴더, b.목록), api.지적표읽기(b.폴더), api.결과들읽기(b.폴더, b.목록, 'GPT')).배포조건충족, true);
  // GPT·아르곤이 다 막히면 Fable이 대신한다(Fable 증명이 최종)
  const c = await 준비('all-blocked');
  await api.GPT보내기(c.폴더, c.목록, { call: 한도('GPT'), 몫: 몫충분 });
  assert.match(api.검수확인(c.폴더).사유.join(' / '), /필수 아르곤 검수 미완료.*GPT 검수가 한도·로그인으로 막혀 대신/);
  assert.ok(api.집계하기(c.목록, [], api.지적표읽기(c.폴더), api.결과들읽기(c.폴더, c.목록, 'GPT')).조건.some(x => /GPT 검수가 막혀 아르곤 검수로 대신/.test(x)));
  await api.아르곤보내기(c.폴더, c.목록, { call: 한도('아르곤'), 몫: 몫충분 });
  assert.match(api.검수확인(c.폴더).사유.join(' / '), /Fable 대체 검수 필요/);
  const 집 = api.집계하기(c.목록, api.결과들읽기(c.폴더, c.목록), api.지적표읽기(c.폴더), api.결과들읽기(c.폴더, c.목록, 'GPT'));
  assert.ok(집.조건.some(x => /GPT·아르곤 검수가 막혀 Fable 검수로 대신/.test(x)), 집.조건.join(' / '));
  await api.페이블하기(c.폴더, { 시험: false, 캡처: false });
  assert.match(fs.readFileSync(path.join(c.폴더, 'fable.md'), 'utf8'), /GPT·아르곤\(다른 회사 모델\)이 한도·로그인으로 막혀 그 대신/);
  api.페이블받기(c.폴더, final답(JSON.parse(fs.readFileSync(path.join(c.폴더, '페이블자료.json'))).증명));
  assert.deepEqual(api.검수확인(c.폴더).사유, []);
  // 옛 판 1: 필수 [아르곤, GPT]로 적힌 증거 — 둘 다 받은 것과 GPT만 받은 것은 통과, 아르곤만은 안 된다
  const old = await 준비('old-both', { 정책판: 1 });
  assert.equal(old.목록.정책.판, 1); assert.deepEqual(old.목록.정책.필수, ['아르곤', 'GPT']);
  await api.아르곤보내기(old.폴더, old.목록, { call: 답하기(), 몫: 몫충분 });
  assert.match(api.검수확인(old.폴더).사유.join(' / '), /필수 GPT 검수 미완료/);
  await api.GPT보내기(old.폴더, old.목록, { call: 답하기(), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(old.폴더).사유, []);
  const oldGpt = await 준비('old-gpt', { 정책판: 1 });
  await api.GPT보내기(oldGpt.폴더, oldGpt.목록, { call: 답하기(), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(oldGpt.폴더).사유, []);
  // 같이 돌린 아르곤이 낸 P1은 GPT가 통과해도 처리해야 한다
  await api.아르곤보내기(oldGpt.폴더, oldGpt.목록, { call: 답하기([지적하나('a.js:1')]), 몫: 몫충분 });
  assert.match(api.검수확인(oldGpt.폴더).사유.join(' / '), /A1 P1 미해결/);
  // 정책 판을 바꿔 쓴 묶음은 받지 않는다
  fs.writeFileSync(path.join(old.폴더, '묶음.json'), JSON.stringify({ ...old.목록, 정책: { ...old.목록.정책, 판: 2 } }));
  assert.match(api.검수확인(old.폴더).사유.join(' / '), /정책이 준비 뒤 바뀌었다/);
  const { 정책만들기 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  assert.throws(() => 정책만들기({ 종류: '백엔드' }, [], { 판: 3 }), /정책 판/);
  assert.deepEqual(정책만들기({ 종류: '백엔드', GPT구독: '종료', 사유: '시험' }, []).필수, ['아르곤']);
});

test('최종 검수: 소스를 바꾼 뒤 시험안함으로 옛 통과 TAP를 다시 붙이지 않는다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'value.txt': 'before\n', 'value.test.js': "const test = require('node:test'); const assert = require('node:assert/strict'); test('value', () => assert.equal(require('node:fs').readFileSync('value.txt', 'utf8'), 'good\\n'));\n" });
  r.쓰기('value.txt', 'good\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'tap-reuse', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 시험: ['value.test.js'] });
  assert.equal(목록.시험.통과, 1); assert.equal(목록.시험.실패, 0);
  await api.페이블하기(폴더, { 시험: false, 캡처: false });
  const before = fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8');
  r.쓰기('value.txt', 'bad\n');
  await assert.rejects(api.페이블하기(폴더, { 시험: false, 캡처: false }), /옛 TAP.*재사용할 수 없다/);
  assert.equal(fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8'), before, '실패한 갱신은 새 최종 증명을 쓰지 않는다');
  await api.페이블하기(폴더, { 시험: true, 캡처: false });
  const current = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8'));
  assert.equal(current.시험.실패, 1); assert.equal(current.시험.종료, 1, '시험을 다시 돌리면 현재 실패를 그대로 보고한다');
});

test('최종 검수: 현재 판 TAP 명시 수신은 새 소스와 TAP 해시에 묶고 자동 재사용·시험안함 혼용은 막는다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'view.txt': 'a\n' }); r.쓰기('view.txt', 'b\n');
  const oldTap = path.join(r.뿌리, 'old.tap'), newTap = path.join(r.뿌리, 'current.tap');
  fs.writeFileSync(oldTap, 'TAP version 13\nok 1 - initial\n1..1\n# tests 1\n# pass 1\n# fail 0\n');
  fs.writeFileSync(newTap, 'TAP version 13\nok 1 - current\nok 2 - additional\n1..2\n# tests 2\n# pass 2\n# fail 0\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'tap-receive', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 시험결과: oldTap });
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 });
  const oldProof = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'))).증명;
  api.페이블받기(폴더, final답(oldProof)); assert.equal(api.검수확인(폴더).통과, true);
  r.쓰기('view.txt', 'c\n');
  await assert.rejects(api.페이블하기(폴더, { 캡처: false }), /옛 TAP.*재사용할 수 없다/);
  await assert.rejects(api.페이블하기(폴더, { 시험: false, 시험결과: newTap, 캡처: false }), /시험안함과 --시험결과는 함께 쓸 수 없다/);
  execFileSync(process.execPath, [path.join(root, 'tools/검수묶음.mjs'), '페이블', 폴더, '--시험결과', newTap, '--캡처안함'], { encoding: 'utf8' });
  const current = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json')));
  assert.equal(current.시험.통과, 2); assert.match(current.시험.명령, /현재 판으로 명시 수신한 TAP current.tap/);
  assert.equal(current.증명.파일.find(x => x.경로 === 'view.txt').sha256, crypto.createHash('sha256').update('c\n').digest('hex'));
  assert.equal(current.증명.보조파일.find(x => x.경로 === '시험.tap').sha256, crypto.createHash('sha256').update(fs.readFileSync(newTap)).digest('hex'));
  assert.throws(() => api.페이블받기(폴더, final답(oldProof)), /최종 검토 입력 해시/);
  api.페이블받기(폴더, final답(current.증명)); assert.equal(api.검수확인(폴더).통과, true);
  fs.appendFileSync(path.join(폴더, '시험.tap'), '# changed\n');
  assert.match(api.검수확인(폴더).사유.join(' / '), /캡처·시험 자료 변경/);
});

test('준비 중 시험이 소스를 바꾸면 다른 판의 diff와 snapshot을 묶지 않는다', async t => {
  const { 준비하기 } = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  r.쓰기('race.test.js', "require('node:fs').writeFileSync('a.js','a=3\\n');\n");
  await assert.rejects(준비하기({ 이름: 'race', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, 시험: ['race.test.js'] }), /준비 중.*바뀌었다/);
});

test('배포 후보의 raw bytes·종류·모드와 정책은 검수 입력에 묶인다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n', 'memo.md': 'a\n' }); r.쓰기('a.js', 'a=2\n');
  const 배포후보 = path.join(r.뿌리, 'candidate'); fs.mkdirSync(배포후보);
  const body = 'function run(){return 2}\n', manifest = { 판: 1, 종류: 'apps-script', 항목: [{ 경로: 'Code.js', sha256: crypto.createHash('sha256').update(body).digest('hex'), 모드: '100644', 종류: '바꿈' }] };
  fs.writeFileSync(path.join(배포후보, 'Code.js'), body); fs.writeFileSync(path.join(배포후보, '후보.json'), JSON.stringify(manifest));
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'candidate', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, 배포후보 });
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 }); await api.GPT보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(폴더).사유, []);
  fs.appendFileSync(path.join(배포후보, 'Code.js'), '// changed'); assert.equal(api.검수확인(폴더).통과, false);
  fs.writeFileSync(path.join(배포후보, 'Code.js'), body); manifest.항목[0].모드 = '100755'; fs.writeFileSync(path.join(배포후보, '후보.json'), JSON.stringify(manifest));
  assert.match(api.검수확인(폴더).사유.join(' '), /배포 후보 변경/);
  const { 정책만들기 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  assert.throws(() => 정책만들기({ 종류: '백엔드', 예외: '내부', 대상: 'a.js', 사유: '내부' }, [{ 경로: 'a.js' }]), /내부 화면/);
  assert.throws(() => 정책만들기({ 종류: '화면', 작성자: 'GPT' }, []), /Claude 담당/);
  assert.throws(() => 정책만들기({ 종류: '백엔드', 저장소: r.저장소, 배포후보, 예외: '콘텐츠', 대상: 'memo.md,Code.js', 사유: '글' }, [{ 경로: 'memo.md' }]), /코드·설정/);
  assert.throws(() => 정책만들기({ 종류: '백엔드', 예외: '콘텐츠', 대상: 'other.md', 사유: '글' }, [{ 경로: 'memo.md' }]), /대상/);
});

test('GPT 보내기: 아르곤과 같은 묶음·대조로 GPT-<묶음>.json과 GA1… 지적을 남기고, 둘을 같이 돌려도 서로의 지적을 지우지 않는다', async t => {
  const { 준비하기, 아르곤보내기, GPT보내기, 지적표읽기, 처리하기, 집계하기, 묶음상태들 } = await tool();
  const r = 임시저장소(t, { 'src/app.js': 'export const b = 2;\n' });
  r.쓰기('src/app.js', 'export const b = 3;\n');
  const { 폴더, 목록 } = await 준비하기({ 이름: 'gpt', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  const 몫 = () => ({ 주간: 0.99 });
  const 받은 = [];
  const gpt = async a => { 받은.push(a); return 답하기([지적하나('src/app.js:1'), 지적하나('src/app.js:1', 'P2')])(a); };
  // 둘을 함께 띄워도 지적표에 두 검수자 지적이 다 남는다
  await Promise.all([아르곤보내기(폴더, 목록, { call: 답하기([지적하나('src/app.js:1')]), 몫 }), GPT보내기(폴더, 목록, { call: gpt, 몫 })]);
  assert.equal(받은[0].thinking, 'max', '수준을 안 주면 GPT검수의 추론(max) — 앱 설정을 따르지 않는다');
  assert.equal(받은[0].model, 'gpt-6.1-sol');
  assert.equal(받은[0].prompt, fs.readFileSync(path.join(폴더, 목록.묶음[0].파일), 'utf8'), 'GPT도 아르곤과 같은 바이트');
  assert.ok(fs.existsSync(path.join(폴더, `GPT-${목록.묶음[0].이름}.json`)));
  const 표 = 지적표읽기(폴더);
  assert.deepEqual(표.지적.map(x => `${x.출처}:${x.번호}`), ['아르곤:A1', 'GPT:GA1', 'GPT:GA2']);
  assert.ok(fs.existsSync(path.join(폴더, 'GPT지적표.md')));
  assert.deepEqual(묶음상태들(폴더, 목록, 'GPT').map(b => b.상태), ['읽음']);
  처리하기(표, ['A1=반영', 'GA1=반영', 'GA2=재현안됨:2를 기대하는 곳이 없다']);
  fs.writeFileSync(path.join(폴더, '지적표.json'), JSON.stringify(표));
  const 결과 = JSON.parse(fs.readFileSync(path.join(폴더, `아르곤-${목록.묶음[0].이름}.json`), 'utf8'));
  const G결과 = JSON.parse(fs.readFileSync(path.join(폴더, `GPT-${목록.묶음[0].이름}.json`), 'utf8'));
  const s = 집계하기(목록, [결과], 지적표읽기(폴더), [G결과]);
  assert.equal(s.한줄, '아르곤 1건(반영 1) · GPT 2건(반영 1)');
  assert.equal(s.배포조건충족, true);
  await assert.rejects(GPT보내기(폴더, 목록, { call: gpt, 몫, 수준: 'huge', 다시: true }), /--수준은[^]*빼면 max/);
  // fable.md 2단계는 두 검수자의 지적표를 다 가리킨다
  const { 페이블하기 } = await tool();
  const 페 = fs.readFileSync(await 페이블하기(폴더, { 시험: false, 캡처: false }), 'utf8');
  assert.match(페, /아르곤\(Gemini 4 Carbon\)과 GPT\(다른 회사 모델\)이 먼저 본 뒤/);
  assert.match(페, /아르곤지적표\.md`와 `.*GPT지적표\.md`를 읽고/);
});

test('집계(백엔드): 아르곤이 막혀도 GPT가 끝까지 읽었으면 충족, 둘 다 못 읽으면 Fable로 대신, GPT를 보냈는데 덜 읽혔으면 미충족', async () => {
  const { 집계하기 } = await tool();
  const 백 = { 종류: '백엔드', 묶음: [{ 이름: 'A', sha256: 's' }] };
  const 읽음 = { 묶음: 'A', 상태: '읽음', 입력sha256: 's' }, 막힘 = { 묶음: 'A', 상태: '막힘', 입력sha256: 's' };
  let s = 집계하기(백, [막힘], { 지적: [] }, [읽음]);
  assert.equal(s.배포조건충족, true, '다른 회사 검수가 하나는 끝까지 읽었다');
  assert.equal(s.한줄, '아르곤 막힘(한도·로그인) · GPT 0건(반영 0)');
  s = 집계하기(백, [막힘], { 지적: [] }, [막힘]);
  assert.ok(s.조건.some(x => /GPT도 끝까지 못 읽음\) Fable 검수로 대신/.test(x)));
  assert.equal(s.한줄, '아르곤 막힘(한도·로그인) · GPT 막힘(한도·로그인)');
  s = 집계하기(백, [읽음], { 지적: [] }, [{ ...읽음, 상태: '잘림' }]);
  assert.ok(s.조건.some(x => /^GPT 묶음 A\(잘림\)/.test(x)), s.조건.join(' / '));
  assert.equal(집계하기(백, [읽음], { 지적: [] }, [{ ...읽음, 입력sha256: '다름' }]).배포조건충족, false);
  assert.equal(집계하기(백, [읽음], { 지적: [] }, [막힘]).배포조건충족, true, 'GPT가 막히면 아르곤만으로 간다');
  assert.equal(집계하기(백, [읽음], { 지적: [] }).한줄, '아르곤 0건(반영 0)', 'GPT를 안 보냈으면 한 줄에 넣지 않는다(구독이 끝난 뒤)');
  // 화면은 GPT가 읽어도 Fable 최종 검수가 관문이다
  assert.ok(집계하기({ ...백, 종류: '화면' }, [막힘], { 지적: [] }, [읽음]).조건.some(x => /Fable 검수로 대신/.test(x)));
  assert.ok(집계하기({ ...백, 종류: '화면' }, [읽음], { 지적: [] }, [읽음]).조건.includes('Fable 최종 검수 전'));
});

// 가짜 codex(CODEX_BIN) — 실제 모델·계정을 부르지 않는다. 띄울 때마다 인자를 부름.log에 한 줄씩 적는다(부르지 않았는지 보려고).
//  exec: 인자·CODEX_HOME·표준입력·답 꼴을 args.json에 적고, FAKE_CODEX가 limit·login이면 그 오류로 끝난다.
//        답은 받은 묶음의 끝 표식·항목 번호를 그대로 돌려준다(없으면 END_X · D01-aaaa).
//  app-server: 계정 읽기(Pro)·몫 읽기(주간 10% 사용)만 흉내 낸다 — GPT 명령이 계정을 고르고 몫을 읽게.
// CODEX_BIN · CODEX_HOME · CODEX_BAKE_DIR(빈 굽기 장부) · FAKE_CODEX · SYNK_GPT_REVIEW_MODEL은 시험이 끝나면 되돌린다.
function 가짜코덱스(t) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fake-codex-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 가짜 = path.join(뿌리, 'codex.js'), 기록 = path.join(뿌리, 'args.json'), 부름 = path.join(뿌리, '부름.log');
  fs.writeFileSync(가짜, `
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(부름)}, JSON.stringify(a) + '\\n');
process.stdin.setEncoding('utf8');
let 입력 = '';
if (a[0] === 'app-server') {
  process.stdin.on('data', d => {
    입력 += d;
    for (let i; (i = 입력.indexOf('\\n')) >= 0;) {
      const 줄 = 입력.slice(0, i);
      입력 = 입력.slice(i + 1);
      let m;
      try { m = JSON.parse(줄); } catch { continue; }
      if (m.id == null) continue;
      const result = m.method === 'account/read' ? { account: { planType: 'pro' } }
        : m.method === 'account/rateLimits/read' ? { rateLimits: { primary: { usedPercent: 10, windowDurationMins: 10080 } } } : {};
      process.stdout.write(JSON.stringify({ id: m.id, result }) + '\\n');
    }
  });
  process.stdin.on('end', () => process.exit(0));
} else {
  process.stdin.on('data', d => { 입력 += d; });
  process.stdin.on('end', () => {
    fs.writeFileSync(${JSON.stringify(기록)}, JSON.stringify({ a, home: process.env.CODEX_HOME || null, 입력, 꼴: JSON.parse(fs.readFileSync(a[a.indexOf('--output-schema') + 1], 'utf8')) }));
    if (process.env.FAKE_CODEX === 'limit') { process.stderr.write("ERROR: You've hit your usage limit. Try again in 2 hours.\\n"); process.exit(1); }
    if (process.env.FAKE_CODEX === 'login') { process.stderr.write('ERROR: Not logged in\\n'); process.exit(1); }
    const 표식 = (/자료 끝 표식: (\\S+)\\s*$/.exec(입력) || [])[1] || 'END_X';
    const seen = [...입력.matchAll(/^### \\[([^\\]]+)\\]/gm)].map(m => m[1]);
    fs.writeFileSync(a[a.indexOf('-o') + 1], JSON.stringify({ findings: [], seen: seen.length ? seen : ['D01-aaaa'], coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식 }));
    process.stdout.write(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 3 } }) + '\\n');
  });
}`);
  const 옛 = Object.fromEntries(['CODEX_BIN', 'CODEX_HOME', 'CODEX_BAKE_DIR', 'FAKE_CODEX', 'SYNK_GPT_REVIEW_MODEL'].map(k => [k, process.env[k]]));
  t.after(() => { for (const [k, v] of Object.entries(옛)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  Object.assign(process.env, { CODEX_BIN: 가짜, CODEX_HOME: path.join(뿌리, '다른계정'), CODEX_BAKE_DIR: path.join(뿌리, '굽기장부없음') });
  delete process.env.FAKE_CODEX;
  delete process.env.SYNK_GPT_REVIEW_MODEL;
  const 읽기 = () => JSON.parse(fs.readFileSync(기록, 'utf8'));
  return { 뿌리, 읽기,
    부른것: () => { const { a } = 읽기(); return { 모델: a[a.indexOf('-m') + 1], 추론: a.find(x => x.startsWith('model_reasoning_effort=')) }; },
    부름수: () => (fs.existsSync(부름) ? fs.readFileSync(부름, 'utf8').split('\n').filter(Boolean).length : 0) };
}

test('GPT 부르기: codex exec를 본 계정·읽기 전용·빈 폴더·답 꼴로 한 번 부르고, 한도·로그인 오류는 막힘으로 읽힌다', async t => {
  const { GPT부르기, GPT검수, 답꼴 } = await tool();
  // 11-11 유호님 「응, sol max로」: 모델·추론은 검수 도구에 고정 — 앱 기본값이 바뀌어도 검수 강도가 따라 바뀌지 않는다
  assert.deepEqual({ ...GPT검수 }, { 모델: 'gpt-6.1-sol', 추론: 'max' });
  assert.ok(Object.isFrozen(GPT검수));
  const 가짜 = 가짜코덱스(t);
  const 굽기계정 = { 이름: 'bake3', home: path.join(가짜.뿌리, 'bake3') };
  const r = await GPT부르기({ prompt: '묶음 글\n자료 끝 표식: END_X\n', schema: 답꼴, thinking: 'high', timeoutMs: 60_000, 계정: 굽기계정 });
  assert.equal(JSON.parse(r.text).endMarker, 'END_X');
  assert.deepEqual(r.usage, { input_tokens: 12, output_tokens: 3 });
  assert.equal(r.selectedModel, 'gpt-6.1-sol-high · 굽기 장부 bake3');
  const 본 = 가짜.읽기();
  assert.equal(본.home, 굽기계정.home, '고른 계정의 CODEX_HOME으로');
  assert.equal(본.입력, '묶음 글\n자료 끝 표식: END_X\n', '묶음은 표준입력으로');
  assert.deepEqual(본.꼴.required, 답꼴.required);
  for (const 칸 of ['exec', '--ephemeral', '--skip-git-repo-check', 'read-only', '--json', 'model_reasoning_effort="high"']) assert.ok(본.a.includes(칸), 칸);
  assert.equal(본.a[본.a.indexOf('-m') + 1], 'gpt-6.1-sol', '모델은 늘 -m으로 — 계정 폴더 config.toml의 옛 값을 타지 않게');
  const 빈 = 본.a[본.a.indexOf('-C') + 1];
  assert.match(빈, /synk-gpt-review-[^\\/]+[\\/]empty$/, '-C는 저장소가 아니라 빈 임시 폴더(읽기 전용 실행은 파일 읽기도 거절한다)');
  assert.ok(!fs.existsSync(빈), '끝나면 임시 폴더를 지운다');
  await GPT부르기({ prompt: 'x\n자료 끝 표식: END_X\n', schema: 답꼴, timeoutMs: 60_000 });
  const 기본 = 가짜.읽기();
  assert.equal(기본.home, null, '계정을 안 주면 본 계정(~/.codex) — 밖의 CODEX_HOME을 따르지 않는다');
  assert.ok(기본.a.includes('model_reasoning_effort="max"'), '수준을 안 주면 GPT검수의 추론(max)');
  assert.equal(기본.a[기본.a.indexOf('-m') + 1], 'gpt-6.1-sol');
  // 환경변수 SYNK_GPT_REVIEW_MODEL이 있는 동안(한 회차 뒤 저절로 풀리지 않는다) — 부른 모델이 -m과 결과의 모델 칸에 그대로 남고, 기본값은 바뀌지 않는다
  process.env.SYNK_GPT_REVIEW_MODEL = 'gpt-6-astra';
  const 바꿈 = await GPT부르기({ prompt: 'x\n자료 끝 표식: END_X\n', schema: 답꼴, timeoutMs: 60_000 });
  assert.equal(바꿈.selectedModel, 'gpt-6-astra-max · 본 계정(~/.codex)');
  assert.equal(가짜.부른것().모델, 'gpt-6-astra');
  // 부른 뒤 실패해도 오류에 실제로 부른 모델·추론·계정이 붙는다 — 검수보내기가 기본 모델(gpt-6.1-sol-null)을 적지 않게
  process.env.FAKE_CODEX = 'limit';
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, timeoutMs: 60_000 }), e => /quota/.test(e.message) && e.selectedModel === 'gpt-6-astra-max · 본 계정(~/.codex)');
  assert.equal(가짜.부른것().모델, 'gpt-6-astra', '한도로 끝난 그 부름도 astra였다');
  delete process.env.FAKE_CODEX;
  // 이름 꼴이 아니면 codex를 띄우지 않고 멈춘다 — 부르지 않았으니 오류에 모델이 붙지 않는다
  process.env.SYNK_GPT_REVIEW_MODEL = 'gpt-6-astra; rm -rf x';
  let 부름앞 = 가짜.부름수();
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, timeoutMs: 60_000 }), e => /모델 이름 꼴이 아니다/.test(e.message) && !('selectedModel' in e));
  assert.equal(가짜.부름수(), 부름앞, '이름 꼴이 아니면 codex를 띄우지 않는다');
  delete process.env.SYNK_GPT_REVIEW_MODEL;
  assert.deepEqual({ ...GPT검수 }, { 모델: 'gpt-6.1-sol', 추론: 'max' }, '기본값은 그대로다');
  process.env.FAKE_CODEX = 'limit';
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, timeoutMs: 60_000 }), e => /quota/.test(e.message) && e.selectedModel === 'gpt-6.1-sol-max · 본 계정(~/.codex)');
  process.env.FAKE_CODEX = 'login';
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, timeoutMs: 60_000 }), e => /login/.test(e.message) && e.selectedModel === 'gpt-6.1-sol-max · 본 계정(~/.codex)');
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, thinking: 'high', timeoutMs: 60_000, 계정: 굽기계정 }), e => /login/.test(e.message) && e.selectedModel === 'gpt-6.1-sol-high · 굽기 장부 bake3');
  부름앞 = 가짜.부름수();
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, timeoutMs: 60_000, 계정: null }), e => /quota — 주간 90% 아래인 Pro 계정이 없다/.test(e.message) && !('selectedModel' in e));
  assert.equal(가짜.부름수(), 부름앞, '계정이 없으면 부르지 않는다');
});

test('GPT 모델·추론 한 곳(11-14 후속): 공식 GPT보내기 → GPT부르기 → 가짜 codex — 성공·한도·로그인 결과의 모델·수준이 실제로 넘긴 -m·추론과 같고, 이름 꼴이 아닌 환경 모델은 아무것도 쓰기 전에 멈추며, 환경 모델은 지울 때까지 검수마다 보인다', async t => {
  const { 준비하기, GPT보내기, GPT부르기, GPT검수 } = await tool();
  const 가짜 = 가짜코덱스(t);
  const r = 임시저장소(t, { 'a.js': 'export const a = 1;\n' });
  r.쓰기('a.js', 'export const a = 2;\n');
  const 준비 = 이름 => 준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  // GPT 명령(main)과 같은 꼴: --수준을 안 주면 수준 null, call은 고른 계정(여기서는 본 계정)으로 GPT부르기
  const 보내기 = async (x, 덧 = {}) => {
    const 알림 = [];
    await GPT보내기(x.폴더, x.목록, { 수준: null, call: a => GPT부르기({ ...a, 계정: { 이름: null, home: null } }), 몫: () => null, 알리기: m => 알림.push(m), ...덧 });
    return { 보냄: 알림.filter(m => / 보냄 · /.test(m)), 결과: JSON.parse(fs.readFileSync(path.join(x.폴더, 'GPT-A.json'), 'utf8')) };
  };
  const 본계정 = '본 계정(~/.codex)';

  // ① 기본값: sol · max — 수준을 안 줘도 결과의 수준은 실제로 넘긴 max, 보내기 안내에는 「기본 모델」
  const 기본 = await 준비('기본');
  const d = await 보내기(기본);
  assert.deepEqual(가짜.부른것(), { 모델: 'gpt-6.1-sol', 추론: 'model_reasoning_effort="max"' });
  assert.equal(d.결과.상태, '읽음');
  assert.equal(d.결과.모델, `gpt-6.1-sol-max · ${본계정}`);
  assert.equal(d.결과.수준, 'max');
  assert.deepEqual(d.결과.모델설정, { 모델: 'gpt-6.1-sol', 추론: 'max', 환경바꿈: false });
  assert.equal(d.보냄.length, 1);
  assert.match(d.보냄[0], /gpt-6\.1-sol-max · 기본 모델/);
  assert.doesNotMatch(d.보냄[0], /적용/);
  // ② 명시한 --수준은 그대로 -c와 결과에
  const h = await 보내기(await 준비('높음'), { 수준: 'high' });
  assert.equal(가짜.부른것().추론, 'model_reasoning_effort="high"');
  assert.equal(h.결과.모델, `gpt-6.1-sol-high · ${본계정}`);
  assert.equal(h.결과.수준, 'high');
  // ③ 환경 모델: 이름이 다른 두 검수를 이어 보내도 둘 다 바꾼 모델로 가고, 보내기 안내·결과에 바꿈이 보이며, 도구는 환경을 지우지 않는다
  process.env.SYNK_GPT_REVIEW_MODEL = 'gpt-6-astra';
  for (const 이름 of ['바꿈-1', '바꿈-2']) {
    const s = await 보내기(await 준비(이름));
    assert.equal(가짜.부른것().모델, 'gpt-6-astra', 이름);
    assert.equal(s.결과.상태, '읽음', 이름);
    assert.equal(s.결과.모델, `gpt-6-astra-max · ${본계정}`, 이름);
    assert.deepEqual(s.결과.모델설정, { 모델: 'gpt-6-astra', 추론: 'max', 환경바꿈: true }, 이름);
    assert.match(s.보냄[0], /gpt-6-astra-max · 환경변수 SYNK_GPT_REVIEW_MODEL 적용\(기본 gpt-6\.1-sol 아님/, 이름);
    assert.equal(process.env.SYNK_GPT_REVIEW_MODEL, 'gpt-6-astra', `${이름}: 한 회차 뒤에도 환경은 그대로다`);
  }
  // ④ 바꾼 모델로 부른 뒤 한도(11-14 재현: 수준 null · quota 종료) — 결과는 기본 gpt-6.1-sol-null이 아니라 실제로 부른 astra · max · 계정
  process.env.FAKE_CODEX = 'limit';
  const q = await 보내기(await 준비('바꿈-한도'));
  assert.equal(가짜.부른것().모델, 'gpt-6-astra');
  assert.equal(q.결과.상태, '막힘');
  assert.equal(q.결과.차단증거?.종류, '한도');
  assert.equal(q.결과.모델, `gpt-6-astra-max · ${본계정}`);
  assert.equal(q.결과.수준, 'max');
  assert.equal(q.결과.모델설정.환경바꿈, true);
  // 읽은 답이 있는 묶음을 다시 보내다 막히면 앞 답(sol)과 그 모델은 그대로 두고, 실패들에는 이번에 부른 모델(astra)을 적는다
  const 다시 = await 보내기(기본, { 다시: true });
  assert.equal(다시.결과.상태, '읽음');
  assert.equal(다시.결과.모델, `gpt-6.1-sol-max · ${본계정}`);
  assert.deepEqual(다시.결과.답, d.결과.답);
  assert.equal(다시.결과.모델설정.환경바꿈, false, '남긴 답의 설정은 그 답을 낸 기본 모델 그대로');
  const 실패 = 다시.결과.실패들.at(-1);
  assert.deepEqual({ 상태: 실패.상태, 모델: 실패.모델, 수준: 실패.수준, 모델설정: 실패.모델설정 },
    { 상태: '막힘', 모델: `gpt-6-astra-max · ${본계정}`, 수준: 'max', 모델설정: { 모델: 'gpt-6-astra', 추론: 'max', 환경바꿈: true } });
  // ⑤ 로그인
  process.env.FAKE_CODEX = 'login';
  const l = await 보내기(await 준비('바꿈-로그인'));
  assert.equal(l.결과.상태, '막힘');
  assert.equal(l.결과.차단증거?.종류, '로그인');
  assert.equal(l.결과.모델, `gpt-6-astra-max · ${본계정}`);
  delete process.env.FAKE_CODEX;
  // ⑥ 이름 꼴이 아닌 환경 모델: codex를 띄우지 않고, 결과·보내는 중 표시를 하나도 쓰지 않은 채 멈춘다(앞 결과가 있으면 그대로)
  process.env.SYNK_GPT_REVIEW_MODEL = 'gpt-6-astra; rm -rf x';
  const 틀림 = await 준비('틀린모델');
  const 부름앞 = 가짜.부름수(), 기본앞 = fs.readFileSync(path.join(기본.폴더, 'GPT-A.json'));
  await assert.rejects(보내기(틀림), /SYNK_GPT_REVIEW_MODEL이 모델 이름 꼴이 아니다/);
  await assert.rejects(보내기(기본, { 다시: true }), /모델 이름 꼴이 아니다/);
  assert.equal(가짜.부름수(), 부름앞, '부르기 전에 멈춘다');
  assert.deepEqual(fs.readdirSync(틀림.폴더).filter(f => f.startsWith('GPT-')), [], '부르지 않은 모델을 결과에 남기지 않는다');
  assert.deepEqual(fs.readFileSync(path.join(기본.폴더, 'GPT-A.json')), 기본앞, '앞 결과도 건드리지 않는다');
  assert.deepEqual({ ...GPT검수 }, { 모델: 'gpt-6.1-sol', 추론: 'max' });
});

test('GPT 시간 초과 자동 대체(11-15 유호님 「응, 바꿔줘」): 기본 모델이 같은 묶음에서 시간 초과로 두 번 끝나면 다음 보내기는 묻지 않고 gpt-6-astra · 같은 추론, 다른 실패 · 환경 모델 회차는 세지 않는다', async t => {
  const { 준비하기, GPT보내기, GPT부르기, GPT시간초과대체, 이번자동대체 } = await tool();
  const 가짜 = 가짜코덱스(t);
  const r = 임시저장소(t, { 'a.js': 'export const a = 1;\n' });
  r.쓰기('a.js', 'export const a = 2;\n');
  const 준비 = 이름 => 준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  assert.deepEqual({ ...GPT시간초과대체 }, { 횟수: 2, 모델: 'gpt-6-astra' });
  // 가짜 call: 받은 설정을 적고, 정한 대로 GPT부르기와 같은 꼴의 오류를 던지거나 끝까지 읽은 답을 낸다
  const 부름들 = [];
  const call = 할일 => async a => {
    부름들.push({ model: a.model, 설정: a.설정 });
    const 모델글 = `${a.설정.모델}-${a.설정.추론} · 가짜`;
    const 오류 = 할일(a);
    if (오류) { const e = new Error(오류); e.selectedModel = 모델글; throw e; }
    const 표식 = (/자료 끝 표식: (\S+)\s*$/.exec(a.prompt) || [])[1];
    const seen = [...a.prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]);
    return { text: JSON.stringify({ findings: [], seen, coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식 }), selectedModel: 모델글 };
  };
  const 시간초과 = () => 'codex exec 시간 초과(45분)';
  const 보내기 = async (x, 할일, 덧 = {}) => {
    const 알림 = [];
    await GPT보내기(x.폴더, x.목록, { 수준: null, call: call(할일), 몫: () => null, 알리기: m => 알림.push(m), ...덧 });
    return { 알림, 결과: JSON.parse(fs.readFileSync(path.join(x.폴더, 'GPT-A.json'), 'utf8')) };
  };

  // ① 한 번째 시간 초과: 기본 sol · max로 불렀고 1로 쌓인다, 아직 대체 안내 없음
  const 묶 = await 준비('초과');
  const 첫 = await 보내기(묶, 시간초과);
  assert.equal(부름들.at(-1).model, 'gpt-6.1-sol');
  assert.deepEqual(부름들.at(-1).설정, { 모델: 'gpt-6.1-sol', 추론: 'max', 환경바꿈: false });
  assert.equal(첫.결과.상태, '실패');
  assert.equal(첫.결과.기본시간초과, 1);
  assert.equal(첫.알림.some(m => /묻지 않고 gpt-6-astra/.test(m)), false);
  // 실패 결과는 사람이 고를 때만 다시 보낸다 — 고르지 않으면 부르지 않는다(그대로)
  const 앞수 = 부름들.length;
  await 보내기(묶, 시간초과);
  assert.equal(부름들.length, 앞수, '실패한 묶음을 저절로 다시 부르지 않는다');
  // ② 두 번째 시간 초과(--묶음 A): 아직 sol, 2로 쌓이고 다음 보내기가 astra라는 안내
  const 둘 = await 보내기(묶, 시간초과, { 고른: ['A'] });
  assert.equal(부름들.at(-1).model, 'gpt-6.1-sol');
  assert.equal(둘.결과.기본시간초과, 2);
  assert.ok(둘.알림.some(m => /시간 초과로 2번 끝났다 — 다시 보내면\(--묶음 A\) 묻지 않고 gpt-6-astra-max로 부른다/.test(m)), 둘.알림.join('\n'));
  // ③ 세 번째: 묻지 않고 astra · 같은 추론, 결과의 모델 · 모델설정에 자동 대체가 남고 횟수는 0으로
  const 셋 = await 보내기(묶, () => null, { 고른: ['A'] });
  assert.equal(부름들.at(-1).model, 'gpt-6-astra');
  assert.equal(부름들.at(-1).설정.모델, 'gpt-6-astra');
  assert.equal(부름들.at(-1).설정.추론, 'max');
  assert.match(부름들.at(-1).설정.자동대체, /기본 gpt-6\.1-sol이 이 묶음에서 시간 초과 2번/);
  assert.equal(셋.결과.상태, '읽음');
  assert.equal(셋.결과.모델, 'gpt-6-astra-max · 가짜');
  assert.equal(셋.결과.모델설정.모델, 'gpt-6-astra');
  assert.equal(셋.결과.기본시간초과, 0);
  assert.ok(셋.알림.some(m => / 보냄 · gpt-6-astra-max · 자동 대체\(기본 gpt-6\.1-sol이 이 묶음에서 시간 초과 2번 — 11-15 규칙, 묻지 않음\)/.test(m)), 셋.알림.join('\n'));
  // ④ 대체 모델도 시간 초과면 횟수를 더하지 않고 다음에도 대체 모델(기본으로 돌아가 또 45분을 쓰지 않게)
  const 묶2 = await 준비('초과-대체도');
  await 보내기(묶2, 시간초과);
  await 보내기(묶2, 시간초과, { 고른: ['A'] });
  const 대체초과 = await 보내기(묶2, 시간초과, { 고른: ['A'] });
  assert.equal(부름들.at(-1).model, 'gpt-6-astra');
  assert.equal(대체초과.결과.기본시간초과, 2);
  await 보내기(묶2, 시간초과, { 고른: ['A'] });
  assert.equal(부름들.at(-1).model, 'gpt-6-astra', '대체 뒤 실패해도 대체 모델로 이어 간다');
  // ⑤ 시간 초과가 아닌 실패는 세지 않는다
  const 묶3 = await 준비('다른실패');
  await 보내기(묶3, () => 'codex exec 실패(종료 1) — boom');
  const 다른 = await 보내기(묶3, () => 'codex exec 실패(종료 1) — boom', { 고른: ['A'] });
  assert.equal(다른.결과.기본시간초과, 0);
  await 보내기(묶3, () => null, { 고른: ['A'] });
  assert.equal(부름들.at(-1).model, 'gpt-6.1-sol');
  // ⑥ 환경변수로 모델을 정한 회차는 세지도 바꾸지도 않는다
  process.env.SYNK_GPT_REVIEW_MODEL = 'gpt-6-terra';
  const 묶4 = await 준비('환경');
  await 보내기(묶4, 시간초과);
  const 환경둘 = await 보내기(묶4, 시간초과, { 고른: ['A'] });
  assert.equal(환경둘.결과.기본시간초과, 0);
  await 보내기(묶4, () => null, { 고른: ['A'] });
  assert.equal(부름들.at(-1).model, 'gpt-6-terra');
  assert.equal(부름들.at(-1).설정.자동대체, undefined);
  delete process.env.SYNK_GPT_REVIEW_MODEL;
  // ⑦ 읽은 답이 있는 묶음을 --다시로 보내다 시간 초과면 앞 답은 그대로, 실패들에 이번 설정이 남고 횟수가 쌓인다.
  //    두 번째 뒤 안내는 --묶음이 아니라 --다시다(--묶음만이면 「읽음」이라 건너뛴다 — GPT 검수 GA1), 그 --다시는 astra로 간다
  const 묶5 = await 준비('읽은뒤');
  await 보내기(묶5, () => null);
  const 다시1 = await 보내기(묶5, 시간초과, { 다시: true });
  assert.equal(다시1.결과.상태, '읽음');
  assert.equal(다시1.결과.기본시간초과, 1);
  assert.equal(다시1.결과.실패들.at(-1).모델설정.모델, 'gpt-6.1-sol');
  const 다시2 = await 보내기(묶5, 시간초과, { 다시: true });
  assert.equal(다시2.결과.기본시간초과, 2);
  assert.ok(다시2.알림.some(m => /다시 보내면\(--다시\) 묻지 않고 gpt-6-astra-max로/.test(m)), 다시2.알림.join('\n'));
  const 묶음만수 = 부름들.length;
  await 보내기(묶5, () => null, { 고른: ['A'] });
  assert.equal(부름들.length, 묶음만수, '읽음인 묶음은 --묶음만으로는 다시 부르지 않는다(그래서 안내가 --다시)');
  const 시작때 = new Date().toISOString();
  const 다시3 = await 보내기(묶5, 시간초과, { 다시: true });
  assert.equal(부름들.at(-1).model, 'gpt-6-astra', '안내대로 --다시면 astra');
  // ⑦′ 대체 시도가 실패해 앞 sol 답이 남아도 완료 줄의 목록에는 이번 대체 시도가 잡힌다(GPT 검수 GA2) — 지난 실행 기록은 넣지 않는다
  assert.equal(다시3.결과.모델설정.자동대체, undefined, '남은 답은 앞 sol 답');
  assert.equal(다시3.결과.실패들.at(-1).모델설정.모델, 'gpt-6-astra');
  assert.deepEqual(이번자동대체([다시3.결과], 시작때), ['A gpt-6-astra-max · 가짜']);
  assert.deepEqual(이번자동대체([다시3.결과], new Date(Date.now() + 60_000).toISOString()), [], '시작 뒤 시도만');
  assert.deepEqual(이번자동대체([다시3.결과], 시작때, ['B']), [], '고른 묶음만');
  assert.deepEqual(이번자동대체([셋.결과], '1970-01-01T00:00:00.000Z'), ['A gpt-6-astra-max · 가짜'], '대체로 읽은 답도 센다');
  // ⑧ GPT부르기는 받은 설정으로 -m · 추론을 넘기고, 꼴이 틀린 설정은 codex를 띄우지 않고 멈춘다
  const 바꿈 = await GPT부르기({ prompt: 'x\n자료 끝 표식: END_X\n', schema: { type: 'object' }, timeoutMs: 60_000, 설정: { 모델: 'gpt-6-astra', 추론: 'max', 환경바꿈: false, 자동대체: '시험' } });
  assert.deepEqual(가짜.부른것(), { 모델: 'gpt-6-astra', 추론: 'model_reasoning_effort="max"' });
  assert.equal(바꿈.selectedModel, 'gpt-6-astra-max · 본 계정(~/.codex)');
  const 부름앞 = 가짜.부름수();
  await assert.rejects(GPT부르기({ prompt: 'x', schema: { type: 'object' }, timeoutMs: 60_000, 설정: { 모델: 'gpt-6-astra; rm -rf x', 추론: 'max' } }), /모델·추론 꼴이 아니다/);
  await assert.rejects(GPT부르기({ prompt: 'x', schema: { type: 'object' }, timeoutMs: 60_000, 설정: { 모델: 'gpt-6-astra', 추론: 'huge' } }), /모델·추론 꼴이 아니다/);
  assert.equal(가짜.부름수(), 부름앞, '꼴이 틀리면 부르지 않는다');
});

test('GPT 명령(11-14 후속): 계정·보내기·완료 안내에 이번 모델·추론과 환경변수 바꿈이 보이고(이름이 다른 두 검수 연속), 이름 꼴이 아닌 환경 모델은 계정도 읽지 않고 종료 2', async t => {
  const { 준비하기 } = await tool();
  const 가짜 = 가짜코덱스(t);
  const r = 임시저장소(t, { 'a.js': 'export const a = 1;\n' });
  r.쓰기('a.js', 'export const a = 2;\n');
  const 준비 = 이름 => 준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  // 명령 그대로(node tools/검수묶음.mjs GPT <폴더>) — 계정·몫은 가짜 app-server, 검수는 가짜 exec
  const GPT명령 = x => {
    const p = spawnSync(process.execPath, [path.join(root, 'tools/검수묶음.mjs'), 'GPT', x.폴더], { encoding: 'utf8', env: { ...process.env }, timeout: 120_000, windowsHide: true });
    const 파일 = path.join(x.폴더, 'GPT-A.json');
    return { 종료: p.status, 출력: p.stdout || '', 알림: p.stderr || '', 결과: fs.existsSync(파일) ? JSON.parse(fs.readFileSync(파일, 'utf8')) : null };
  };
  const 줄 = (글, 식) => 글.split(/\r?\n/).find(l => 식.test(l)) || '';
  const 세안내 = s => [줄(s.알림, /GPT 계정: /), 줄(s.알림, / 보냄 · /), 줄(s.출력, /^GPT A /)];
  // 기본: 세 안내 모두 「기본 모델」
  const 기본 = GPT명령(await 준비('명령-기본'));
  assert.equal(기본.종료, 0, 기본.알림);
  assert.match(줄(기본.알림, /GPT 계정: /), /→ 본 계정\(~\/\.codex\)/);
  for (const l of 세안내(기본)) { assert.match(l, /gpt-6\.1-sol-max · 기본 모델/, l); assert.doesNotMatch(l, /적용/, l); }
  assert.equal(기본.결과.모델, 'gpt-6.1-sol-max · 본 계정(~/.codex)');
  // 환경 모델: 이름이 다른 두 검수를 이어 돌려도 둘 다 계정·보내기·완료 안내에 바꾼 모델과 환경변수가 보인다
  process.env.SYNK_GPT_REVIEW_MODEL = 'gpt-6-astra';
  for (const 이름 of ['명령-바꿈-1', '명령-바꿈-2']) {
    const s = GPT명령(await 준비(이름));
    assert.equal(s.종료, 0, s.알림);
    for (const l of 세안내(s)) assert.match(l, /gpt-6-astra-max · 환경변수 SYNK_GPT_REVIEW_MODEL 적용/, `${이름}: ${l}`);
    assert.equal(가짜.부른것().모델, 'gpt-6-astra', 이름);
    assert.equal(s.결과.모델, 'gpt-6-astra-max · 본 계정(~/.codex)', 이름);
    assert.deepEqual(s.결과.모델설정, { 모델: 'gpt-6-astra', 추론: 'max', 환경바꿈: true }, 이름);
  }
  // 이름 꼴이 아니면 계정 읽기(app-server)도 codex exec도 띄우지 않고 종료 2 — 결과를 쓰지 않는다
  process.env.SYNK_GPT_REVIEW_MODEL = 'gpt-6-astra; rm -rf x';
  const 틀림 = await 준비('명령-틀림'), 부름앞 = 가짜.부름수();
  const e = GPT명령(틀림);
  assert.equal(e.종료, 2, e.알림);
  assert.match(e.알림, /SYNK_GPT_REVIEW_MODEL이 모델 이름 꼴이 아니다/);
  assert.equal(가짜.부름수(), 부름앞, '계정도 읽지 않는다');
  assert.equal(e.결과, null);
});

test('GPT 계정 고르기: Pro이고 주간 90% 아래인 계정 가운데 가장 덜 쓴 것, 없으면 null', async () => {
  const { GPT계정가리기 } = await tool();
  const 계정 = (이름, 요금제, 주간사용) => ({ 이름, home: 이름, 요금제, 주간사용 });
  assert.equal(GPT계정가리기([계정(null, 'pro', 90), 계정('bake1', 'plus', 0), 계정('bake3', 'pro', 1)]).이름, 'bake3', '본 계정이 90%면 넘기고 plus는 안 쓴다');
  assert.equal(GPT계정가리기([계정(null, 'pro', 30), 계정('bake3', 'pro', 50)]).이름, null);
  assert.equal(GPT계정가리기([계정(null, 'pro', 95), 계정('bake3', 'pro', null)]), null, '못 읽은 계정은 고르지 않는다');
});

test('보내는 중 표시·지적표 잠금: 답을 기다리는 묶음은 관문을 막고, 주인 없는 표시·잠금은 걷는다, GPT 0건이어도 GPT지적표.md', async t => {
  const { 준비하기, GPT보내기, 결과들읽기, 묶음상태들, 집계하기, 지적표읽기, 지적표고치기 } = await tool();
  const r = 임시저장소(t, { 'a.js': 'export const a = 1;\n' });
  r.쓰기('a.js', 'export const a = 2;\n');
  const { 폴더, 목록 } = await 준비하기({ 이름: '표시', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  const 묶음 = 목록.묶음[0].이름;
  let 도중 = null;
  await GPT보내기(폴더, 목록, { 몫: () => null, call: async a => { 도중 = 묶음상태들(폴더, 목록, 'GPT')[0].상태; return 답하기([])(a); } });
  assert.equal(도중, '보내는 중', '답을 기다리는 동안');
  assert.equal(묶음상태들(폴더, 목록, 'GPT')[0].상태, '읽음');
  assert.ok(fs.existsSync(path.join(폴더, 'GPT지적표.md')), 'GPT가 0건이어도 fable.md가 가리키는 파일이 있다');
  // 살아 있는 프로세스의 표시는 관문을 막고, 죽은 프로세스의 표시는 없는 셈
  const 표시 = path.join(폴더, `GPT-${묶음}.보내는중.json`);
  fs.writeFileSync(표시, JSON.stringify({ 묶음, pid: process.pid, 보낸때: new Date().toISOString() }));
  const 아르곤읽음 = [{ 묶음, 상태: '읽음', 입력sha256: 목록.묶음[0].sha256 }];
  let s = 집계하기(목록, 아르곤읽음, 지적표읽기(폴더), 결과들읽기(폴더, 목록, 'GPT'));
  assert.equal(s.배포조건충족, false);
  assert.ok(s.조건.some(x => new RegExp(`GPT ${묶음} 묶음을 보내는 중`).test(x)), s.조건.join(' / '));
  fs.writeFileSync(표시, JSON.stringify({ 묶음, pid: 2 ** 22 + 12345, 보낸때: new Date().toISOString() }));
  assert.equal(결과들읽기(폴더, 목록, 'GPT')[0].상태, '읽음');
  // 남은 잠금은 저절로 걷지 않고(걷기 경합), 한계가 지나면 주인과 함께 알린다 — 주인이 죽었으면 그렇다고
  const 잠금 = path.join(폴더, '지적표.lock');
  fs.writeFileSync(잠금, `${2 ** 22 + 12345}-옛표`);
  assert.throws(() => 지적표고치기(폴더, () => assert.fail('잠금을 못 얻었으면 고치지 않는다'), { 한계: 300 }), /잠금을 0초 동안 얻지 못했다.*이미 없다/);
  fs.writeFileSync(잠금, `${process.ppid}-살아있는표`);
  assert.throws(() => 지적표고치기(폴더, () => 0, { 한계: 300 }), e => /얻지 못했다/.test(e.message) && !/이미 없다/.test(e.message));
  fs.rmSync(잠금);
  assert.equal(지적표고치기(폴더, 표 => { 표.메모 = '고침'; return 7; }), 7);
  assert.equal(지적표읽기(폴더).메모, '고침');
  assert.ok(!fs.existsSync(잠금), '고친 뒤 잠금을 푼다');
});

test('2차 검수 고침: 표시는 결과·지적표를 다 쓴 뒤 지우고, 살아 있는 남의 표시 묶음은 겹쳐 보내지 않고, 보내는 중이면 앞 막힘과 상관없이 미충족, 낡은 잠금 걷기는 한쪽만', async t => {
  const { 준비하기, GPT보내기, 결과들읽기, 집계하기, 지적표읽기, 풀기 } = await tool();
  const r = 임시저장소(t, { 'a.js': 'export const a = 1;\n' });
  r.쓰기('a.js', 'export const a = 2;\n');
  const { 폴더, 목록 } = await 준비하기({ 이름: '고침', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  const 묶음 = 목록.묶음[0].이름, 표시 = path.join(폴더, `GPT-${묶음}.보내는중.json`);
  // GA2: 답을 받은 뒤 몫을 다시 읽는 동안에도(결과·지적표를 쓰기 전) 표시가 남아 있다
  let 뒤몫때표시 = null, 몫부름 = 0;
  await GPT보내기(폴더, 목록, { 몫: () => { if (++몫부름 === 2) 뒤몫때표시 = fs.existsSync(표시); return null; }, call: 답하기([지적하나('a.js:1')]) });
  assert.equal(뒤몫때표시, true);
  assert.ok(!fs.existsSync(표시), '다 쓴 뒤에는 지운다');
  assert.equal(지적표읽기(폴더).지적.length, 1);
  // GA3: 살아 있는 다른 프로세스(부모)의 표시가 있으면 그 묶음은 보내지 않고 남의 표시도 지우지 않는다
  fs.writeFileSync(표시, JSON.stringify({ 묶음, pid: process.ppid, 표: '남', 보낸때: '2026-10-22T00:00:00Z' }));
  await GPT보내기(폴더, 목록, { 다시: true, 몫: () => null, call: async () => assert.fail('남이 보내는 묶음을 겹쳐 보내지 않는다') });
  assert.equal(JSON.parse(fs.readFileSync(표시, 'utf8')).표, '남');
  // GA4: 한 묶음이 보내는 중이면 다른 묶음의 앞 막힘 결과가 있어도 미충족
  const 둘 = { ...목록, 묶음: [...목록.묶음, { ...목록.묶음[0], 이름: 'Q' }] };
  const G = [...결과들읽기(폴더, 둘, 'GPT'), { 묶음: 'Q', 상태: '막힘', 입력sha256: 목록.묶음[0].sha256 }];
  const 아르곤 = 둘.묶음.map(b => ({ 묶음: b.이름, 상태: '읽음', 입력sha256: b.sha256 }));
  const s = 집계하기(둘, 아르곤, { 지적: [] }, G);
  assert.equal(s.배포조건충족, false);
  assert.ok(s.조건.some(x => new RegExp(`GPT ${묶음} 묶음을 보내는 중`).test(x)), s.조건.join(' / '));
  fs.rmSync(표시);
  // 주인이 죽은 표시는 잠금 안에서 덮어 잡고 보낸다
  fs.writeFileSync(표시, JSON.stringify({ 묶음, pid: 2 ** 22 + 12345, 표: '죽은', 보낸때: '2026-10-22T00:00:00Z' }));
  let 보냄 = 0;
  await GPT보내기(폴더, 목록, { 다시: true, 몫: () => null, call: async a => { 보냄++; return 답하기([])(a); } });
  assert.equal(보냄, 1);
  assert.ok(!fs.existsSync(표시), '덮어 잡은 표시도 끝나면 지운다');
  // 풀기는 제 표가 든 잠금만
  const 잠금 = path.join(폴더, '시험.lock');
  fs.writeFileSync(잠금, '새로-잡은-표');
  풀기(잠금, '내-표');
  assert.equal(fs.readFileSync(잠금, 'utf8'), '새로-잡은-표', '남이 잡은 잠금은 풀지 않는다');
});

// ── 다시 검수(2026-10-24 다섯 가지 ②·⑤): 고친 diff와 그 지적만, 사슬은 해시로 처음 검수까지 ──
const 다시답하기 = (지적 = [], 풀림 = {}) => async ({ prompt }) => {
  const 표식 = /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1];
  const seen = [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]);
  const 대상 = [...prompt.matchAll(/^- \[(Q\d+)\]/gm)].map(m => m[1]);
  return { text: JSON.stringify({ findings: 지적, targets: 대상.map(id => ({ id, resolved: 풀림[id] ?? true, note: '고친 diff에서 확인' })), seen,
    coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식 }) };
};

test('추가 검수자의 유효한 재확인도 집계하되 필수 검수와 입력 대조는 유지한다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const first = await api.준비하기({ 이름:'extra-first', 폴더:path.join(r.뿌리,'first'), 저장소:r.저장소, 종류:'백엔드', 작성자:'GPT', 바탕:r.바탕 });
  await api.GPT보내기(first.폴더,first.목록,{call:답하기(),몫:몫충분});
  const send = async (p,who,answer) => api.검수받기(p.폴더,who,'A',(await answer({prompt:fs.readFileSync(path.join(p.폴더,'묶음-A.txt'),'utf8')})).text);
  await send(first,'Claude',답하기()); await api.아르곤보내기(first.폴더,first.목록,{call:답하기([지적하나('a.js:1')]),몫:몫충분});
  api.지적표고치기(first.폴더,s=>api.처리하기(s,['A1=반영']));r.쓰기('a.js','a=3\n');
  const final=await api.다시하기({이름:'extra-final',폴더:path.join(r.뿌리,'final'),앞:first.폴더,끝판:true});
  await api.GPT보내기(final.폴더,final.목록,{call:다시답하기(),몫:몫충분});await send(final,'Claude',다시답하기());
  assert.equal(api.검수확인(final.폴더).통과,false,'원래 추가 검수자의 응답 없이 통과하지 않는다');
  await send(final,'아르곤',다시답하기([], {Q1:false}));assert.equal(api.검수확인(final.폴더).통과,false,'미해결 답도 막는다');
  await send(final,'아르곤',다시답하기());assert.equal(api.검수확인(final.폴더).통과,true,'같은 입력에 대한 실제 추가 검수자의 재확인으로 해결');
  const file=path.join(final.폴더,'아르곤-A.json'),valid=fs.readFileSync(file);const bad=JSON.parse(valid);bad.입력sha256='0'.repeat(64);fs.writeFileSync(file,JSON.stringify(bad));
  assert.equal(api.검수확인(final.폴더).통과,false,'다른 입력의 답은 인정하지 않는다');fs.writeFileSync(file,valid);
  const required=path.join(final.폴더,'GPT-A.json');fs.renameSync(required,required+'.preserved');
  assert.equal(api.검수확인(final.폴더).통과,false,'아르곤의 답으로 필수 GPT 검수를 대신하지 않는다');
});

test('다시(백엔드): 고친 diff와 그 지적만 GPT가 다시 보고, 해시로 이어진 사슬이면 끝 후보로 통과', async t => {
  const api = await tool(), r = 임시저장소(t, { 'src/a.js': 'export const a = 1;\n', 'src/b.js': 'export const b = 1;\n' });
  r.쓰기('src/a.js', 'export const a = 2;\n'); r.쓰기('src/b.js', 'export const b = 2;\n');
  const 처음 = await api.준비하기({ 이름: 'first', 폴더: path.join(r.뿌리, 'first'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  assert.ok(fs.readdirSync(path.join(처음.폴더, '내용')).length >= 2, '검수한 판의 바이트를 해시 이름으로 보관한다');
  await api.GPT보내기(처음.폴더, 처음.목록, { call: 답하기([{ ...지적하나('src/a.js:1'), quote: 'a = 2' }]), 몫: 몫충분 });
  await assert.rejects(api.다시하기({ 이름: 'early', 폴더: path.join(r.뿌리, 'early'), 앞: 처음.폴더 }), /아직 끝나지 않았다.*GA1 P1 미해결/, '처리하지 않은 P0·P1이 있으면 만들지 않는다');
  api.지적표고치기(처음.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  r.쓰기('src/a.js', 'export const a = 3;\n');
  assert.match(api.검수확인(처음.폴더).사유.join(' / '), /검수 뒤 파일 변경: src\/a\.js.*다시 <새 이름> --앞 first/);
  const 다시 = await api.다시하기({ 이름: 'again', 폴더: path.join(r.뿌리, 'again'), 앞: 처음.폴더 });
  assert.deepEqual(다시.목록.검수자들, ['GPT']);
  assert.deepEqual(다시.목록.대상.map(x => `${x.아이디}=${x.고리}:${x.번호}`), ['Q1=first:GA1']);
  assert.deepEqual(다시.목록.바뀐경로, { 소스: ['src/a.js'], 후보: [] });
  const 글 = fs.readFileSync(path.join(다시.폴더, '묶음-A.txt'), 'utf8');
  assert.match(글, /-export const a = 2;\n\+export const a = 3;/, '앞 고리가 검수한 판 → 지금 판');
  assert.match(글, /\[Q1\] GPT GA1/);
  assert.doesNotMatch(글, /b = 2/, '앞 검수 뒤 안 바뀐 파일은 싣지 않는다');
  const p = 다시.목록.증명;
  assert.equal(p.앞.후보해시.length, 64); assert.equal(p.새후보해시.length, 64); assert.equal(p.자료해시.length, 64);
  assert.deepEqual(p.항목, [다시.목록.묶음[0].sha256]); assert.match(다시.목록.묶음[0].표식, /^END_OF_REVIEW_A_/);
  assert.match(api.검수확인(다시.폴더).사유.join(' / '), /again: 다시 검수 GPT 미완료/);
  await api.GPT보내기(다시.폴더, 다시.목록, { call: 다시답하기(), 몫: 몫충분 });
  const ok = api.검수확인(다시.폴더);
  assert.deepEqual(ok.사유, []);
  assert.deepEqual(ok.증명.사슬, ['first', 'again']);
  assert.equal(ok.증명.최종파일.find(f => f.경로 === 'src/a.js').sha256, crypto.createHash('sha256').update('export const a = 3;\n').digest('hex'));
  assert.equal(ok.다시[0].대상[0].풀림, true);
  execFileSync(process.execPath, [path.join(root, 'tools/검수묶음.mjs'), '집계', 다시.폴더], { encoding: 'utf8' });
  const 보고 = fs.readFileSync(path.join(다시.폴더, '보고.md'), 'utf8');
  assert.match(보고, /다시 검수: 앞 「first」 · 다시 볼 지적 1건 · 다시 검수자 GPT · 바뀐 파일 1개 · 사슬 first → again/);
  assert.match(보고, /Q1 GPT GA1 P1 → 풀림\(GPT\)/); assert.match(보고, /배포 조건\(재현되는 P0·P1 0건\): 충족/);
  // 끝 후보 뒤에 또 바뀌면 막는다(CRLF는 같은 판)
  r.쓰기('src/a.js', 'export const a = 4;\n');
  assert.match(api.검수확인(다시.폴더).사유.join(' / '), /검수 뒤 파일 변경: src\/a\.js.*--앞 again/);
  r.쓰기('src/a.js', 'export const a = 3;\r\n');
  assert.deepEqual(api.검수확인(다시.폴더).사유, []);
});

test('다시: 끝까지 안 읽힘·targets 빠짐·새 P0·P1·안 풀림·해시 끊김·diff 바뀜은 막고, 안 풀린 지적은 다음 다시 검수가 잇는다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const x = await api.준비하기({ 이름: 'x', 폴더: path.join(r.뿌리, 'x'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  await api.GPT보내기(x.폴더, x.목록, { call: 답하기([지적하나('a.js:1')]), 몫: 몫충분 });
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  r.쓰기('a.js', 'a=3\n');
  const y = await api.다시하기({ 이름: 'y', 폴더: path.join(r.뿌리, 'y'), 앞: x.폴더 });
  const 고친답 = 바꿈 => async a => ({ text: JSON.stringify({ ...JSON.parse((await 다시답하기()(a)).text), ...바꿈 }) });
  await api.GPT보내기(y.폴더, y.목록, { call: 고친답({ endMarker: 'truncated' }), 몫: 몫충분 });
  assert.match(api.검수확인(y.폴더).사유.join(' / '), /y: 다시 검수 GPT 미완료/, '끝까지 읽히지 않은 답은 다시 검수로 치지 않는다');
  await api.GPT보내기(y.폴더, y.목록, { call: 고친답({ targets: [] }), 몫: 몫충분, 다시: true });
  assert.match(api.검수확인(y.폴더).사유.join(' / '), /targets가 다시 볼 지적 집합과 다르다/);
  // 새 P1은 처리해야 하고, 재현 안 됨이면 닫힌다
  await api.GPT보내기(y.폴더, y.목록, { call: 다시답하기([{ ...지적하나('a.js:1'), quote: 'a=3', problem: '새로 생긴 문제' }]), 몫: 몫충분, 다시: true });
  assert.match(api.검수확인(y.폴더).사유.join(' / '), /y: GA1 P1 미해결/);
  api.지적표고치기(y.폴더, 표 => api.처리하기(표, ['GA1=재현안됨:a=3을 부르는 곳이 없다']));
  assert.deepEqual(api.검수확인(y.폴더).사유, []);
  // 안 풀렸다고 답하면 그 지적이 이 고리의 지적으로 다시 올라오고, 반영하면 또 다시 검수받는다
  await api.GPT보내기(y.폴더, y.목록, { call: 다시답하기([], { Q1: false }), 몫: 몫충분, 다시: true });
  const 올림 = api.지적표읽기(y.폴더).지적.find(x => /다시 검수에서 풀리지 않았다\(앞 x GA1\)/.test(x.문제));
  assert.ok(올림, '안 풀린 지적이 다시 올라온다');
  assert.match(api.검수확인(y.폴더).사유.join(' / '), new RegExp(`y: ${올림.번호} P1 미해결`));
  api.지적표고치기(y.폴더, 표 => api.처리하기(표, [`${올림.번호}=반영`]));
  assert.match(api.검수확인(y.폴더).사유.join(' / '), /y: GA1 P1 미해결 — 반영: 고친 diff를 다시 검수받는다: node tools\/검수묶음\.mjs 다시 <새 이름> --앞 y/);
  r.쓰기('a.js', 'a=4\n');
  const z = await api.다시하기({ 이름: 'z', 폴더: path.join(r.뿌리, 'z'), 앞: y.폴더 });
  assert.deepEqual(z.목록.대상.map(t => `${t.고리}:${t.번호}`), [`y:${올림.번호}`]);
  assert.match(fs.readFileSync(path.join(z.폴더, '묶음-A.txt'), 'utf8'), /-a=3\n\+a=4/, '앞 고리(y)가 검수한 판에서 지금 판으로');
  assert.match(z.목록.경고, /두 회차 연달아 P0·P1/);
  await api.GPT보내기(z.폴더, z.목록, { call: 다시답하기(), 몫: 몫충분 });
  const 끝 = api.검수확인(z.폴더);
  assert.deepEqual(끝.사유, []); assert.deepEqual(끝.증명.사슬, ['x', 'y', 'z']);
  // 해시 끊김: 다른 판을 검수한 묶음을 앞으로 대면 잇지 않는다
  const 남 = await api.준비하기({ 이름: 'other', 폴더: path.join(r.뿌리, 'other'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  await api.GPT보내기(남.폴더, 남.목록, { call: 답하기(), 몫: 몫충분 });
  const zj = path.join(z.폴더, '묶음.json'), zm = JSON.parse(fs.readFileSync(zj, 'utf8'));
  fs.writeFileSync(zj, JSON.stringify({ ...zm, 앞: { 이름: 'other', 폴더: 남.폴더 } }));
  assert.match(api.검수확인(z.폴더).사유.join(' / '), /z: 앞 other의 검수한 후보와 해시로 이어지지 않는다/);
  fs.writeFileSync(zj, JSON.stringify({ ...zm, 대상: [] }));
  assert.match(api.검수확인(z.폴더).사유.join(' / '), /다시 볼 지적·다시 검수자가 준비 뒤 바뀌었다/);
  const { 갈래, ...처음처럼 } = zm;
  fs.writeFileSync(zj, JSON.stringify(처음처럼));
  assert.match(api.검수확인(z.폴더).사유.join(' / '), /묶음 갈래와 증명이 맞지 않는다/, '증명 밖 갈래만 지워 처음 검수처럼 읽히지 않는다(GPT 2차 검수 GB1)');
  fs.writeFileSync(zj, JSON.stringify(zm));
  const 묶음글 = fs.readFileSync(path.join(z.폴더, '묶음-A.txt'), 'utf8');
  assert.ok(묶음글.includes(`앞 후보 ${zm.증명.앞.후보해시} → 지금 후보 ${zm.증명.새후보해시}`), '검수자가 읽은 글이 사슬 해시를 말한다');
  fs.appendFileSync(path.join(z.폴더, 'diff.patch'), '덧붙임');
  assert.match(api.검수확인(z.폴더).사유.join(' / '), /z: 다시 검수 diff가 준비 뒤 바뀌었다/);
});

test('다시: 작업본을 옮겨도 --저장소로 앞 사슬의 바탕 판을 보고 잇는다(GPT 2차 검수 GB2)', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n', 'b.js': 'b=1\n' }); r.쓰기('a.js', 'a=2\n');
  const x = await api.준비하기({ 이름: 'move-x', 폴더: path.join(r.뿌리, 'move-x'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  await api.GPT보내기(x.폴더, x.목록, { call: 답하기([지적하나('a.js:1')]), 몫: 몫충분 });
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  r.쓰기('b.js', 'b=2\n');
  const y = await api.다시하기({ 이름: 'move-y', 폴더: path.join(r.뿌리, 'move-y'), 앞: x.폴더 });
  assert.deepEqual(y.목록.바뀐경로.소스, ['b.js'], '앞 검수에 없던 b.js는 바탕 판에서 지금 판으로');
  await api.GPT보내기(y.폴더, y.목록, { call: 다시답하기([{ ...지적하나('b.js:1'), quote: 'b=2' }]), 몫: 몫충분 });
  api.지적표고치기(y.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  const 새곳 = path.join(r.뿌리, 'repo-moved');
  fs.renameSync(r.저장소, 새곳);
  fs.writeFileSync(path.join(새곳, 'b.js'), 'b=3\n');
  await assert.rejects(api.다시하기({ 이름: 'move-z0', 폴더: path.join(r.뿌리, 'move-z0'), 앞: y.폴더 }), /작업본이 없다|검수 git 읽기 실패/);
  const z = await api.다시하기({ 이름: 'move-z', 폴더: path.join(r.뿌리, 'move-z'), 앞: y.폴더, 저장소: 새곳 });
  assert.match(fs.readFileSync(path.join(z.폴더, '묶음-A.txt'), 'utf8'), /-b=2\n\+b=3/);
  await api.GPT보내기(z.폴더, z.목록, { call: 다시답하기(), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(z.폴더, { 저장소: 새곳 }).사유, []);
});

test('다시: 대상 지적 없는 고침(P2)도 정책의 첫 검수자가 보고, GPT가 한도로 막히면 아르곤이 대신, 바뀐 것이 없으면 만들지 않는다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const x = await api.준비하기({ 이름: 'p2', 폴더: path.join(r.뿌리, 'p2'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  await api.GPT보내기(x.폴더, x.목록, { call: 답하기([지적하나('a.js:1', 'P2')]), 몫: 몫충분 });
  await assert.rejects(api.다시하기({ 이름: 'same', 폴더: path.join(r.뿌리, 'same'), 앞: x.폴더 }), /다시 볼 것이 없다/);
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  r.쓰기('a.js', 'a=2 // 이름 고침\n');
  const y = await api.다시하기({ 이름: 'p2-again', 폴더: path.join(r.뿌리, 'p2-again'), 앞: x.폴더, 함께올림: '시험' });
  assert.deepEqual(y.목록.대상, []); assert.deepEqual(y.목록.검수자들, ['GPT']);
  await api.GPT보내기(y.폴더, y.목록, { call: async () => { throw new Error('You have hit your usage limit'); }, 몫: 몫충분 });
  assert.match(api.검수확인(y.폴더).사유.join(' / '), /다시 검수 아르곤 미완료.*GPT 검수가 한도·로그인으로 막혀 대신/);
  await api.아르곤보내기(y.폴더, y.목록, { call: 다시답하기(), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(y.폴더).사유, []);
});

test('다시(화면): 반영한 Fable P1은 같은 Fable이 고친 diff만 다시 확인하고, Fable 최종 전에 고친 아르곤 지적은 대상이 아니다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'view.html': '<p>옛</p>\n' }); r.쓰기('view.html', '<p>새</p>\n');
  const s = await api.준비하기({ 이름: 'screen', 폴더: path.join(r.뿌리, 'screen'), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕 });
  await api.아르곤보내기(s.폴더, s.목록, { call: 답하기([{ ...지적하나('view.html:1'), quote: '<p>새</p>' }]), 몫: 몫충분 });
  api.지적표고치기(s.폴더, 표 => api.처리하기(표, ['A1=반영']));
  r.쓰기('view.html', '<p>새 글</p>\n');
  await api.페이블하기(s.폴더, { 시험: false, 캡처: false });
  const 증명 = JSON.parse(fs.readFileSync(path.join(s.폴더, '페이블자료.json'))).증명;
  api.페이블받기(s.폴더, JSON.stringify({ ...JSON.parse(final답(증명)), findings: [{ grade: 'P1', location: 'view.html:1', quote: '<p>새 글</p>', problem: '안내 문장이 빠졌다', fix: '안내 문장을 붙인다' }] }));
  api.지적표고치기(s.폴더, 표 => api.처리하기(표, ['F1=반영']));
  r.쓰기('view.html', '<p>새 글</p><p>안내</p>\n');
  const d = await api.다시하기({ 이름: 'screen-again', 폴더: path.join(r.뿌리, 'screen-again'), 앞: s.폴더 });
  assert.deepEqual(d.목록.검수자들, ['Fable']);
  assert.deepEqual(d.목록.대상.map(x => x.번호), ['F1'], 'Fable 최종 전에 고친 아르곤 A1은 대상이 아니다');
  assert.match(fs.readFileSync(path.join(d.폴더, '묶음-A.txt'), 'utf8'), /-<p>새 글<\/p>\n\+<p>새 글<\/p><p>안내<\/p>/, 'Fable이 본 판에서 지금 판으로');
  const fable = fs.readFileSync(path.join(d.폴더, 'fable.md'), 'utf8');
  assert.match(fable, /묶음-A\.txt/);
  assert.ok(!fable.includes(d.목록.묶음[0].표식), 'fable.md에 끝 표식을 적지 않는다(묶음을 끝까지 읽어야 안다)');
  await assert.rejects(api.페이블하기(d.폴더, { 시험: false, 캡처: false }), /페이블을 쓰지 않는다/);
  assert.match(api.검수확인(d.폴더).사유.join(' / '), /다시 검수 Fable 미완료/);
  fs.writeFileSync(path.join(d.폴더, 'Fable-답-A.json'), (await 다시답하기()({ prompt: fs.readFileSync(path.join(d.폴더, '묶음-A.txt'), 'utf8') })).text);
  execFileSync(process.execPath, [path.join(root, 'tools/검수묶음.mjs'), '페이블받기', d.폴더], { encoding: 'utf8' });
  const ok = api.검수확인(d.폴더);
  assert.deepEqual(ok.사유, []); assert.deepEqual(ok.증명.사슬, ['screen', 'screen-again']);
});

test('다시: 내용 보관 전 옛 묶음은 git에서 앞 판을 찾고, 못 찾으면 처음부터 준비하라고 멈춘다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const x = await api.준비하기({ 이름: 'old', 폴더: path.join(r.뿌리, 'old'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  await api.GPT보내기(x.폴더, x.목록, { call: 답하기([지적하나('a.js:1')]), 몫: 몫충분 });
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  fs.rmSync(path.join(x.폴더, '내용'), { recursive: true });
  r.쓰기('a.js', 'a=3\n');
  await assert.rejects(api.다시하기({ 이름: 'lost', 폴더: path.join(r.뿌리, 'lost'), 앞: x.폴더 }), /앞 판 내용을 찾지 못했다: a\.js.*처음부터 준비한다/);
  r.쓰기('a.js', 'a=2\n'); r.g('commit', '-qam', '검수한 판'); r.쓰기('a.js', 'a=3\n');
  const y = await api.다시하기({ 이름: 'found', 폴더: path.join(r.뿌리, 'found'), 앞: x.폴더 });
  assert.match(fs.readFileSync(path.join(y.폴더, '묶음-A.txt'), 'utf8'), /-a=2\n\+a=3/);
});

test('그록(11-07): 같은 묶음 · 같은 대조로 보내고 지적은 KA1…, 그록 막힘은 grok 도구로 적고, 집계에 서도 필수는 아니며 낸 P1은 처리해야 닫힌다', async t => {
  const { 준비하기, 그록보내기, 지적표읽기, 처리하기, 집계하기, 그록답JSON } = await tool();
  const { 막힘증거 } = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  const r = 임시저장소(t, { 'src/app.js': 'export const a = 1;\n' });
  r.쓰기('src/app.js', 'export const a = 2;\n');
  r.g('add', 'src/app.js'); r.g('commit', '-q', '-m', '고침: a를 2로');
  const { 폴더, 목록 } = await 준비하기({ 이름: '그록시험', 폴더: r.출력, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  const 받은 = [];
  const 잘읽음 = async ({ prompt, model, thinking, schema }) => {
    받은.push({ model, thinking });
    assert.ok(schema.required.includes('endMarker'));
    const 표식 = /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1];
    const seen = [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]);
    // 그록은 울타리 · 앞말을 붙여 답할 수 있다 — 그록부르기는 그록답JSON으로 벗긴 글을 돌려준다
    const 답 = { findings: [{ grade: 'P1', location: 'src/app.js:1', quote: 'a = 2', problem: '부르는 곳이 1을 기대한다', fix: '부르는 곳도 고친다' }], seen, coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식 };
    return { text: 그록답JSON('검수 결과입니다\n```json\n' + JSON.stringify(답) + '\n```'), selectedModel: 'grok' };
  };
  const 결과 = await 그록보내기(폴더, 목록, { call: 잘읽음 });
  assert.deepEqual(결과.map(x => x.상태), 목록.묶음.map(() => '읽음'));
  assert.equal(받은[0].thinking, 'high', '그록 기본 노력은 high');
  assert.ok(fs.existsSync(path.join(폴더, '그록-A.json')));
  const 표 = 지적표읽기(폴더);
  assert.deepEqual(표.지적.map(x => `${x.출처}:${x.번호}`), ['그록:KA1']);
  const 셈 = 집계하기(목록, [], 표, [], [], [], 결과);
  assert.deepEqual(셈.열린.map(x => x.번호), ['KA1'], '처리 안 한 그록 P1은 열린 지적이다');
  const 그록줄 = 셈.검수자별.find(x => x.이름 === '그록');
  assert.ok(그록줄 && 그록줄.필수 === false && 그록줄.셈.건 === 1, '집계에 그록 줄이 서지만 필수가 아니다');
  assert.ok(!셈.검수자별.some(x => x.이름 === '그록' && x.필수), '그록 때문에 필수가 늘지 않는다');
  처리하기(표, ['그록:KA1=재현안됨:부르는 곳이 없다']);
  assert.equal(표.지적[0].처리, '재현 안 됨');
  // 막힘: 그록 통로의 한도 · 로그인 말을 막힘 증거로 읽고 도구는 grok, 일반 실패와 다른 검수자 판정은 그대로
  assert.equal(막힘증거('그록', '그록 사용량 한도 — rate limited')?.종류, '한도');
  assert.equal(막힘증거('그록', '그록 사용량 한도 — x')?.도구, 'grok');
  assert.equal(막힘증거('그록', '그록 로그인이 필요하다 — grok login')?.종류, '로그인');
  assert.equal(막힘증거('그록', '그록 답을 읽지 못했다(끝 코드 1)'), null);
  assert.equal(막힘증거('아르곤', '그록 사용량 한도'), null);
  assert.equal(막힘증거('아르곤', 'RESOURCE_EXHAUSTED')?.도구, 'agy');
  const 막힘 = await 그록보내기(폴더, 목록, { call: async () => { throw new Error('그록 사용량 한도 — 429'); }, 다시: true });
  assert.equal(막힘[0].실패들.at(-1).상태, '막힘', '앞의 읽은 답은 두고 막힌 시도만 적는다');
  assert.equal(그록답JSON('앞 {"a":1} 뒤'), '{"a":1}');
  assert.equal(그록답JSON('{"a":'), '{"a":');
  assert.equal(그록답JSON('{"findings":[1]}{"findings":[2],"q":"}{"}'), '{"findings":[2],"q":"}{"}', '답이 두 번 이어 붙으면 마지막 덩이(글자열 속 괄호는 안 셈)');
  assert.equal(그록답JSON('앞말 {"a":1} 가운데 {"b":'), '{"a":1}', '깨진 뒤 덩이는 빼고 읽히는 것만');
});

// 그록 대체(정책 판 6 · 2026-11-08 눈가림 시험 뒤 유호님과 정함): Claude 백엔드는 GPT → 아르곤 → 그록 → Fable, 그록이 대신 본 사슬은 그록 P2도 처리.
const 막힌말 = { GPT: 'You have hit your usage limit', 아르곤: 'RESOURCE_EXHAUSTED quota', 그록: '그록 사용량 한도 — 429' };
const 한도로 = 누구 => async () => { throw new Error(막힌말[누구]); };
const GPT아르곤막기 = async (api, x) => {
  await api.GPT보내기(x.폴더, x.목록, { call: 한도로('GPT'), 몫: 몫충분 });
  await api.아르곤보내기(x.폴더, x.목록, { call: 한도로('아르곤'), 몫: 몫충분 });
};
const 그록판정 = (api, x) => ({ 사유: api.검수확인(x.폴더).사유.join(' / '),
  집계: api.집계하기(x.목록, api.결과들읽기(x.폴더, x.목록), api.지적표읽기(x.폴더), api.결과들읽기(x.폴더, x.목록, 'GPT'), [], [], api.결과들읽기(x.폴더, x.목록, '그록')) });

test('그록 대체(정책 판 6 · 11-08): 백엔드는 GPT·아르곤이 둘 다 막힌 증거가 있을 때만 그록 — 읽으면 Fable 없이 충족, 그록도 막히면 Fable, 막힌 증거가 모자라면 그록 차례가 아니다', async t => {
  const api = await tool(), 증명 = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  const r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const 준비 = (이름, 덧 = {}) => api.준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, ...덧 });
  // ① 새 묶음은 판 7(11-14 — Claude 백엔드는 판 6과 같다) — 필수는 그대로 GPT 하나, 차례는 GPT → 아르곤 → 그록 → Fable
  const a = await 준비('k-sub');
  assert.equal(증명.정책판, 7); assert.equal(a.목록.정책.판, 7); assert.deepEqual(a.목록.정책.필수, ['GPT']); assert.deepEqual(증명.실제필수(a.목록.정책), ['GPT']);
  assert.deepEqual(증명.대체순서(a.목록.정책), ['GPT', '아르곤', '그록', 'Fable']); assert.equal(증명.그록대체정책(a.목록.정책), true);
  assert.equal(증명.필수글(a.목록.정책), 'GPT(한도·로그인으로 막히면 아르곤 → 그록 → Fable · 그록이 대신 본 사슬은 그록 P2도 처리를 적는다)');
  assert.deepEqual(증명.대신할검수자(a.목록.정책, 'GPT'), ['GPT', '아르곤', '그록', 'Fable']);
  assert.deepEqual(증명.대신할검수자(a.목록.정책, '아르곤'), ['아르곤', 'GPT', '그록', 'Fable'], '아르곤이 다시 볼 때 막히면 그록보다 GPT가 먼저다');
  assert.deepEqual(증명.대신할검수자(a.목록.정책, '그록'), ['그록', 'Fable']); assert.deepEqual(증명.대신할검수자(a.목록.정책, 'Fable'), ['Fable']);
  assert.equal(api.대체안내(증명.대체순서(a.목록.정책), 'k-sub'), '한도·로그인으로 막히면 아르곤 k-sub, 둘 다 막히면 그록 k-sub, 셋 다 막히면 페이블 k-sub');
  assert.equal(api.대체안내(['GPT', '아르곤', 'Fable'], 'x'), '한도·로그인으로 막히면 아르곤 x, 둘 다 막히면 페이블 x', '판 5의 옛 안내 글 그대로');
  assert.match(api.검수자들.GPT.막힘말(a.목록), /아르곤도 막히면 그록 k-sub, 그록도 막히면 Fable\(페이블 k-sub\)/);
  assert.match(api.검수자들.아르곤.막힘말(a.목록), /백엔드\(GPT가 막혀 대신한 검수\)는 그록으로 대신하고\(그록 k-sub, 그록도 막히면 Fable\(페이블 k-sub\)\)/);
  assert.match(api.검수자들.그록.막힘말(a.목록), /GPT·아르곤도 막혀 대신하던 검수면 Fable\(페이블 k-sub\)로 대신/);
  await GPT아르곤막기(api, a);
  let v = 그록판정(api, a);
  assert.equal(v.사유, '필수 그록 검수 미완료(미전송은 한도 예외가 아니다) — GPT·아르곤 검수가 한도·로그인으로 막혀 대신하는 검수', '그록 차례를 건너뛰어 Fable을 부르지 않는다');
  assert.ok(v.집계.조건.some(x => /^GPT·아르곤 검수가 막혀 그록 검수로 대신해야 한다/.test(x)), v.집계.조건.join(' / '));
  // 그록이 끝까지 읽으면 Fable 없이 배포 조건이 찬다
  await api.그록보내기(a.폴더, a.목록, { call: 답하기() });
  v = 그록판정(api, a);
  assert.equal(v.사유, ''); assert.equal(v.집계.배포조건충족, true, v.집계.조건.join(' / ')); assert.equal(v.집계.그록대신, true);
  assert.equal(v.집계.한줄, '아르곤 막힘(한도·로그인) · GPT 막힘(한도·로그인) · 그록 0건(반영 0)');
  execFileSync(process.execPath, [path.join(root, 'tools/검수묶음.mjs'), '집계', a.폴더], { encoding: 'utf8' });
  assert.match(fs.readFileSync(path.join(a.폴더, '보고.md'), 'utf8'), /필수 검수: GPT\(한도·로그인으로 막히면 아르곤 → 그록 → Fable/);
  // ② 그록도 막히면 Fable이 대신한다(Fable 증명이 최종)
  const c = await 준비('k-all');
  await GPT아르곤막기(api, c);
  await api.그록보내기(c.폴더, c.목록, { call: 한도로('그록') });
  assert.equal(api.결과들읽기(c.폴더, c.목록, '그록')[0].차단증거.도구, 'grok');
  v = 그록판정(api, c);
  assert.match(v.사유, /필수 검수\(GPT·아르곤·그록\)가 한도·로그인으로 막혀 Fable 대체 검수 필요/);
  assert.ok(v.집계.조건.some(x => /^GPT·아르곤·그록 검수가 막혀 Fable 검수로 대신해야 한다/.test(x)), v.집계.조건.join(' / '));
  await api.페이블하기(c.폴더, { 시험: false, 캡처: false });
  assert.match(fs.readFileSync(path.join(c.폴더, 'fable.md'), 'utf8'), /GPT·아르곤·그록\(다른 회사 모델\)이 한도·로그인으로 막혀 그 대신/);
  api.페이블받기(c.폴더, final답(JSON.parse(fs.readFileSync(path.join(c.폴더, '페이블자료.json'))).증명));
  assert.deepEqual(api.검수확인(c.폴더).사유, []);
  // ③ 아르곤만 막히고 GPT는 미실행 — 그록이 읽어도 그록 차례가 아니다(GPT가 막힌 증거가 없다). 일반 실패도 막힘 증거가 아니다
  const d = await 준비('k-no-turn');
  await api.아르곤보내기(d.폴더, d.목록, { call: 한도로('아르곤'), 몫: 몫충분 });
  await api.그록보내기(d.폴더, d.목록, { call: 답하기() });
  v = 그록판정(api, d);
  assert.equal(v.사유, '필수 GPT 검수 미완료(미전송은 한도 예외가 아니다)');
  assert.equal(v.집계.배포조건충족, false); assert.equal(v.집계.그록대신, false);
  await api.GPT보내기(d.폴더, d.목록, { call: async () => { throw new Error('socket hang up'); }, 몫: 몫충분 });
  assert.match(그록판정(api, d).사유, /필수 GPT 검수 미완료/, '일반 실패로는 그록 차례가 오지 않는다');
  // ④ GPT만 막히고 아르곤은 미실행 — 그록이 아니라 아르곤 차례다
  const e = await 준비('k-argon-missing');
  await api.GPT보내기(e.폴더, e.목록, { call: 한도로('GPT'), 몫: 몫충분 });
  await api.그록보내기(e.폴더, e.목록, { call: 답하기() });
  assert.equal(그록판정(api, e).사유, '필수 아르곤 검수 미완료(미전송은 한도 예외가 아니다) — GPT 검수가 한도·로그인으로 막혀 대신하는 검수');
});

test('그록이 대신 본 사슬의 P2(판 6 · 11-08): 처리 미정이면 막고 처리하면 풀린다 — P3는 막지 않고, 막힌 증거 없이 더 본 그록 P2도 막지 않으며, 다시 사슬도 같다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const 준비 = 이름 => api.준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 });
  // ① GPT·아르곤이 막혀 그록이 대신 — 그록 P2 미정은 막고 P3는 막지 않는다
  const b = await 준비('k-p2');
  await GPT아르곤막기(api, b);
  await api.그록보내기(b.폴더, b.목록, { call: 답하기([지적하나('a.js:1', 'P2'), { ...지적하나('a.js:1', 'P3'), problem: '이름이 모호하다' }]) });
  assert.deepEqual(api.지적표읽기(b.폴더).지적.map(x => `${x.번호}:${x.등급}`), ['KA1:P2', 'KA2:P3']);
  let v = 그록판정(api, b);
  assert.equal(v.사유, 'KA1 P2 처리 미정 — 그록이 대신 본 사슬이라 그록 P2도 처리를 적는다: node tools/검수묶음.mjs 처리 k-p2 KA1=<반영|일부|안함|재현안됨|후속>[:<이유>]', 'P3(KA2)는 막지 않는다');
  assert.deepEqual(v.집계.조건, ['KA1 P2 처리 미정 — 그록이 대신 본 검수라 그록 P2도 처리를 적는다']);
  // 지적표의 등급만 P3로 고쳐도 원문 답의 P2로 잡는다
  const 표파일 = path.join(b.폴더, '지적표.json'), 원표 = fs.readFileSync(표파일, 'utf8'), 표 = JSON.parse(원표);
  fs.writeFileSync(표파일, JSON.stringify({ ...표, 지적: 표.지적.map(x => (x.번호 === 'KA1' ? { ...x, 등급: 'P3' } : x)) }));
  assert.match(그록판정(api, b).사유, /KA1 P2 처리 미정/);
  fs.writeFileSync(표파일, 원표);
  // 처리(반영·일부·안함·재현안됨·후속 아무거나)를 적으면 풀린다
  api.지적표고치기(b.폴더, 표 => api.처리하기(표, ['그록:KA1=후속:다음 판에서 이름을 정리한다']));
  v = 그록판정(api, b);
  assert.equal(v.사유, ''); assert.equal(v.집계.배포조건충족, true, v.집계.조건.join(' / '));
  assert.ok(fs.existsSync(path.join(b.폴더, '그록지적표.md')), 'fable.md 2단계가 가리킬 그록 지적표');
  // ② GPT가 읽은 묶음에 더 본 그록 — P1은 처리해야 닫히고, P2는 막지 않는다
  const e = await 준비('k-extra');
  await api.GPT보내기(e.폴더, e.목록, { call: 답하기(), 몫: 몫충분 });
  await api.그록보내기(e.폴더, e.목록, { call: 답하기([지적하나('a.js:1', 'P2'), { ...지적하나('a.js:1'), problem: '경계 값에서 틀린다' }]) });
  v = 그록판정(api, e);
  assert.match(v.사유, /KA2 P1 미해결/); assert.doesNotMatch(v.사유, /KA1/, '대신 보지 않은 그록 P2는 막지 않는다');
  api.지적표고치기(e.폴더, 표 => api.처리하기(표, ['그록:KA2=재현안됨:경계 값을 부르는 곳이 없다']));
  v = 그록판정(api, e);
  assert.equal(v.사유, ''); assert.equal(v.집계.그록대신, false); assert.equal(v.집계.배포조건충족, true, v.집계.조건.join(' / '));
  // ③ 다시 사슬: 그록이 낸 P1을 고친 판은 첫 다시 검수자 GPT가 보고, GPT·아르곤이 막히면 그록이 대신한다 — 사슬의 그록 P2도 처리해야 닫힌다
  const r2 = 임시저장소(t, { 'a.js': 'a=1\n' }); r2.쓰기('a.js', 'a=2\n');
  const x = await api.준비하기({ 이름: 'k-chain', 폴더: path.join(r2.뿌리, 'k-chain'), 저장소: r2.저장소, 종류: '백엔드', 바탕: r2.바탕 });
  await GPT아르곤막기(api, x);
  await api.그록보내기(x.폴더, x.목록, { call: 답하기([{ ...지적하나('a.js:1'), quote: 'a=2' }, { ...지적하나('a.js:1', 'P2'), quote: 'a=2', problem: '이름이 모호하다' }]) });
  await assert.rejects(api.다시하기({ 이름: 'k-early', 폴더: path.join(r2.뿌리, 'k-early'), 앞: x.폴더 }), /아직 끝나지 않았다.*KA1 P1 미해결.*KA2 P2 처리 미정/);
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['그록:KA1=반영']));
  r2.쓰기('a.js', 'a=3\n');
  await assert.rejects(api.다시하기({ 이름: 'k-early', 폴더: path.join(r2.뿌리, 'k-early'), 앞: x.폴더 }), /KA2 P2 처리 미정/, '앞 사슬의 그록 P2가 미정이면 다시를 만들지 않는다');
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['그록:KA2=후속:이름은 다음 판에서']));
  const y = await api.다시하기({ 이름: 'k-chain-2', 폴더: path.join(r2.뿌리, 'k-chain-2'), 앞: x.폴더 });
  assert.deepEqual(y.목록.검수자들, ['GPT'], '그록이 낸 지적도 그록에게 바로 묻지 않고 첫 검수자가 본다');
  assert.deepEqual(y.목록.대상.map(q => `${q.아이디}=${q.출처}:${q.번호}`), ['Q1=그록:KA1']);
  await GPT아르곤막기(api, y);
  v = 그록판정(api, y);
  assert.match(v.사유, /k-chain-2: 다시 검수 그록 미완료\(미전송은 한도 예외가 아니다\) — GPT·아르곤 검수가 한도·로그인으로 막혀 대신하는 검수/);
  assert.match(v.사유, /k-chain: KA1 P1 미해결 — 다음 다시 검수 k-chain-2가 이 지적을 다시 보지 않았다/);
  assert.doesNotMatch(v.사유, /Fable/, '그록 차례를 건너뛰어 Fable을 부르지 않는다');
  assert.ok(v.집계.조건.some(q => /^GPT·아르곤 검수가 막혀 그록 검수로 대신해야 한다/.test(q)), v.집계.조건.join(' / '));
  await api.그록보내기(y.폴더, y.목록, { call: 다시답하기([{ ...지적하나('a.js:1', 'P2'), quote: 'a=3' }]) });
  v = 그록판정(api, y);
  assert.equal(v.사유, 'k-chain-2: KA1 P2 처리 미정 — 그록이 대신 본 사슬이라 그록 P2도 처리를 적는다: node tools/검수묶음.mjs 처리 k-chain-2 KA1=<반영|일부|안함|재현안됨|후속>[:<이유>]');
  assert.ok(v.집계.조건.some(q => /^KA1 P2 처리 미정/.test(q)), v.집계.조건.join(' / '));
  api.지적표고치기(y.폴더, 표 => api.처리하기(표, ['그록:KA1=안함:값 이름은 그대로 둔다']));
  const ok = api.검수확인(y.폴더);
  assert.deepEqual(ok.사유, []); assert.deepEqual(ok.증명.사슬, ['k-chain', 'k-chain-2']);
  assert.equal(ok.다시[0].대상[0].풀림, true); assert.equal(ok.다시[0].대상[0].누구, '그록', '막힌 GPT·아르곤 대신 그록의 답으로 그록 지적을 판정한다');
  // ④ 다시 사슬: 아르곤이 낸 지적을 다시 볼 때 아르곤이 막히면 그록이 아니라 GPT가 먼저다 — GPT도 막혀야 그록 차례
  const r3 = 임시저장소(t, { 'a.js': 'a=1\n' }); r3.쓰기('a.js', 'a=2\n');
  const p = await api.준비하기({ 이름: 'k-argon', 폴더: path.join(r3.뿌리, 'k-argon'), 저장소: r3.저장소, 종류: '백엔드', 바탕: r3.바탕 });
  await api.GPT보내기(p.폴더, p.목록, { call: 한도로('GPT'), 몫: 몫충분 });
  await api.아르곤보내기(p.폴더, p.목록, { call: 답하기([{ ...지적하나('a.js:1'), quote: 'a=2' }]), 몫: 몫충분 });
  api.지적표고치기(p.폴더, 표 => api.처리하기(표, ['A1=반영']));
  r3.쓰기('a.js', 'a=3\n');
  const q = await api.다시하기({ 이름: 'k-argon-2', 폴더: path.join(r3.뿌리, 'k-argon-2'), 앞: p.폴더 });
  assert.deepEqual(q.목록.검수자들, ['아르곤']);
  assert.match(api.검수자들.아르곤.막힘말(q.목록), /GPT가 이 다시 검수를 아직 안 봤으면 GPT k-argon-2로, GPT도 막혔으면 그록 k-argon-2로/);
  await api.아르곤보내기(q.폴더, q.목록, { call: 한도로('아르곤'), 몫: 몫충분 });
  await api.그록보내기(q.폴더, q.목록, { call: 다시답하기() });
  v = 그록판정(api, q);
  assert.match(v.사유, /k-argon-2: 다시 검수 GPT 미완료\(미전송은 한도 예외가 아니다\) — 아르곤 검수가 한도·로그인으로 막혀 대신하는 검수/, 'GPT가 막힌 증거 없이는 그록이 대신하지 않는다');
  assert.ok(v.집계.조건.some(c => /^아르곤 검수가 막혀 GPT 검수로 대신해야 한다/.test(c)), v.집계.조건.join(' / '));
  await api.GPT보내기(q.폴더, q.목록, { call: 한도로('GPT'), 몫: 몫충분 });
  const ok2 = api.검수확인(q.폴더);
  assert.deepEqual(ok2.사유, []); assert.equal(ok2.다시[0].대상[0].누구, '그록', 'GPT·아르곤이 둘 다 막힌 뒤에만 그록의 답으로 판정한다');
});

test('그록 대체는 화면·GPT 작성·옛 판에 들지 않는다(11-08): 화면은 아르곤 → Fable, 판 5로 봉인한 묶음은 GPT → 아르곤 → Fable과 그 정책 꼴 그대로', async t => {
  const api = await tool(), 증명 = await import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));
  const r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const 준비 = (이름, 덧 = {}) => api.준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 바탕: r.바탕, ...덧 });
  // 화면: 판 6부터(지금 7)도 대체 순서가 없다 — 아르곤이 막히면 그록이 읽어도 Fable이 대신하고, 그록 P2는 막지 않는다
  const s = await 준비('k-screen', { 종류: '화면' });
  assert.equal(s.목록.정책.판, 7); assert.equal(증명.대체순서(s.목록.정책), null); assert.equal(증명.그록대체정책(s.목록.정책), false);
  assert.deepEqual(증명.대신할검수자(s.목록.정책, '아르곤'), ['아르곤', 'Fable']);
  assert.match(api.검수자들.아르곤.막힘말(s.목록), /화면은 Fable 최종 검수로 가고/);
  assert.match(api.검수자들.그록.막힘말(s.목록), /이 묶음에서 그록은 대체 순서 밖이니 그 차례\(아르곤 · Fable\)대로 간다/);
  await api.아르곤보내기(s.폴더, s.목록, { call: 한도로('아르곤'), 몫: 몫충분 });
  await api.그록보내기(s.폴더, s.목록, { call: 답하기([지적하나('a.js:1', 'P2')]) });
  let 사유 = api.검수확인(s.폴더).사유.join(' / ');
  assert.equal(사유, 'Fable 최종 검수 미완료');
  // 화면 Fable 생략 묶음도 아르곤이 막히면 그록이 아니라 Fable이 대신한다
  const s2 = await 준비('k-screen-skip', { 종류: '화면', 페이블생략: '글만 바꿈' });
  await api.아르곤보내기(s2.폴더, s2.목록, { call: 한도로('아르곤'), 몫: 몫충분 });
  await api.그록보내기(s2.폴더, s2.목록, { call: 답하기() });
  assert.equal(api.검수확인(s2.폴더).사유.join(' / '), 'Fable 생략 묶음이지만 아르곤이 한도·로그인으로 막혀 Fable 검수로 대신해야 한다');
  // GPT 작성은 판 6에서 대신이 없고 그록이 들지 않는다. 판 7(11-14)은 GPT 자리만 아르곤이 대신하고 그록은 여전히 들지 않는다
  const g = 증명.정책만들기({ 종류: '백엔드', 작성자: 'GPT' }, [], { 판: 6 });
  assert.equal(g.판, 6); assert.equal(증명.대체순서(g), null); assert.deepEqual(증명.대신할검수자(g, 'GPT'), ['GPT']); assert.equal(증명.끝판정책(g), true, '판 6도 판 5의 끝 판 규칙을 잇는다');
  const g7 = 증명.정책만들기({ 종류: '백엔드', 작성자: 'GPT' }, []);
  assert.equal(g7.판, 7); assert.equal(증명.대체순서(g7), null); assert.equal(증명.그록대체정책(g7), false); assert.deepEqual(증명.대신할검수자(g7, 'GPT'), ['GPT', '아르곤']); assert.equal(증명.끝판정책(g7), true);
  // 판 5로 봉인한 묶음: 정책 꼴(봉인 해시)이 11-08 전 그대로이고, GPT·아르곤이 막히면 그록이 읽어도 Fable이 대신한다
  const o = await 준비('k-old', { 종류: '백엔드', 정책판: 5 });
  assert.deepEqual(o.목록.정책, { 판: 5, 작성자: 'Claude', 종류: '백엔드', GPT구독: '유지', 필수: ['GPT'], 예외: null });
  assert.deepEqual(증명.대체순서(o.목록.정책), ['GPT', '아르곤', 'Fable']); assert.deepEqual(증명.대신할검수자(o.목록.정책, 'GPT'), ['GPT', '아르곤', 'Fable']);
  assert.equal(증명.필수글(o.목록.정책), 'GPT(한도·로그인으로 막히면 아르곤 → Fable)');
  assert.match(api.검수자들.GPT.막힘말(o.목록), /아르곤도 막히면 Fable\), 끝 보고에/);
  await GPT아르곤막기(api, o);
  await api.그록보내기(o.폴더, o.목록, { call: 답하기([지적하나('a.js:1', 'P2')]) });
  사유 = api.검수확인(o.폴더).사유.join(' / ');
  assert.equal(사유, '필수 검수(GPT·아르곤)가 한도·로그인으로 막혀 Fable 대체 검수 필요', '판 5 묶음에서는 그록이 대신하지 않고 그 P2도 막지 않는다');
  const 옛집계 = 그록판정(api, o).집계;
  assert.ok(옛집계.조건.some(x => /^GPT·아르곤 검수가 막혀 Fable 검수로 대신해야 한다/.test(x)), 옛집계.조건.join(' / ')); assert.equal(옛집계.그록대신, false);
  await api.페이블하기(o.폴더, { 시험: false, 캡처: false });
  api.페이블받기(o.폴더, final답(JSON.parse(fs.readFileSync(path.join(o.폴더, '페이블자료.json'))).증명));
  assert.deepEqual(api.검수확인(o.폴더).사유, []);
  // GPT 구독 종료: 판 5는 아르곤 → Fable, 판 6은 아르곤 → 그록 → Fable. 그록이 낸 지적만 다시 볼 때 다시 검수자는 정책의 첫 검수자다
  const 종료 = { 종류: '백엔드', GPT구독: '종료', 사유: '시험' };
  assert.deepEqual(증명.대체순서(증명.정책만들기(종료, [], { 판: 5 })), ['아르곤', 'Fable']);
  assert.deepEqual(증명.대체순서(증명.정책만들기(종료, [])), ['아르곤', '그록', 'Fable']);
  assert.deepEqual(증명.다시검수자들(o.목록.정책, [{ 출처: '그록' }]), ['GPT']);
  assert.deepEqual(증명.다시검수자들(증명.정책만들기({ 종류: '백엔드' }, []), [{ 출처: '그록' }]), ['GPT']);
  assert.throws(() => 증명.정책만들기({ 종류: '백엔드' }, [], { 판: 8 }), /정책 판/);
});
