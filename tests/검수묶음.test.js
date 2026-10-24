'use strict';
// 화면·백엔드 검수 묶음 도구(tools/검수묶음.mjs)의 묶기·대조·지적표·집계. 아르곤·Fable은 부르지 않는다(가짜 call).
// 임시 git 저장소에서 준비부터 집계까지 돌리고, 브라우저를 띄울 수 있으면 전후 캡처(바뀐 파일만 바탕 판으로 끼우기)도 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const tool = () => import(pathToFileURL(path.join(root, 'tools/검수묶음.mjs')));

// 시험 git은 이 PC·CI의 전역 설정(autocrlf 등)을 읽지 않는다.
for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-review-test-no-global-config'), GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid' });

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
    assert.equal(model, 'gemini-4-argon');
    assert.ok(schema.required.includes('endMarker'));
    const 표식 = /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1];
    const seen = [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]);
    return { text: JSON.stringify({ findings: [{ grade: 'P1', location: 'src/app.js:2', quote: 'b = 3', problem: '부르는 곳이 2를 기대한다', fix: '부르는 곳도 고친다' }], seen, coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식 }), selectedModel: 'gemini-4-argon-medium', usage: { input_tokens: 10 } };
  };
  const 몫 = () => ({ 주간: 0.25, 다섯시간: 0.8 });
  const 결과 = await 아르곤보내기(폴더, 목록, { call: 잘읽음, 몫 });
  assert.deepEqual(결과.map(x => x.상태), 목록.묶음.map(() => '읽음'));
  assert.equal(부름[0].thinking, 'medium', '백엔드는 medium 먼저');
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
  // 쓸 만한 답이 없던 묶음이 막히면 그 묶음은 「막힘」이다. 백엔드는 GPT가 먼저라 아르곤만 막혀서는 Fable 차례가 아니고, GPT·아르곤이 다 막히면 Fable로 대신하라고 한다
  const 새폴더 = path.join(r.뿌리, 'out-막힘');
  const 막힌목록 = (await 준비하기({ 이름: '막힘', 폴더: 새폴더, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 })).목록;
  const 처음막힘 = await 아르곤보내기(새폴더, 막힌목록, { call: async () => { throw new Error('login required'); }, 몫 });
  assert.equal(처음막힘[0].상태, '막힘');
  assert.ok(!집계하기(막힌목록, 처음막힘, 지적표읽기(새폴더)).조건.some(x => /Fable 검수로 대신/.test(x)), 'GPT를 안 돌렸으면 Fable 차례가 아니다');
  const { GPT보내기 } = await tool();
  const G막힘 = await GPT보내기(새폴더, 막힌목록, { call: async () => { throw new Error('You have hit your usage limit'); }, 몫 });
  assert.equal(G막힘[0].상태, '막힘');
  assert.ok(집계하기(막힌목록, 처음막힘, 지적표읽기(새폴더), G막힘).조건.some(x => /GPT·아르곤 검수가 막혀 Fable 검수로 대신/.test(x)));
});

test('화면 캡처: 「전」은 바뀐 파일만 바탕 판으로 끼우고, 두 폭의 그림 차이·보이는 글 차이·새 콘솔 오류를 묶음에 싣는다', async t => {
  let browser;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  } catch { /* 아래에서 건너뜀 */ }
  if (!browser) return t.skip('브라우저를 띄울 수 없다(playwright·Chrome 없음)');
  await browser.close();
  const { 준비하기, 페이블하기 } = await tool();
  const 쪽 = (글, 꾸밈 = 'style.css') => `<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="icon" href="data:,"><title>시험</title><link rel="stylesheet" href="./${꾸밈}"><main><h1>SYNK</h1><p id="p">${글}</p></main><script src="./app.js"></script></html>`;
  const r = 임시저장소(t, { 'site/index.html': 쪽('옛 글'), 'site/style.css': 'main{font:20px sans-serif;padding:30px;margin:0 auto;max-width:900px}', 'site/app.js': 'document.title = "시험";\n' });
  // 꾸밈 파일 이름을 바꾼다(git mv) — 「전」의 바탕 HTML이 옛 이름을 부르면 그 판 바이트를 내줘야 한다(아르곤 A2)
  r.g('mv', 'site/style.css', 'site/look.css');
  r.쓰기('site/look.css', 'main{font:20px sans-serif;padding:30px;margin:0 auto;max-width:900px;background:#fde}');
  r.쓰기('site/index.html', 쪽('새 글 — 길게 바꾼 글', 'look.css'));
  r.쓰기('site/app.js', 'console.error("새로 생긴 오류");\n');
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
  // 고친 뒤(Fable 앞): 후만 다시 찍어 준비 때의 전과 견준다
  r.쓰기('site/app.js', 'document.title = "고침";\n');
  await 페이블하기(폴더, { 시험: false });
  const 페 = JSON.parse(fs.readFileSync(path.join(폴더, '페이블자료.json'), 'utf8'));
  assert.ok(!페.화면.장들.find(x => x.판 === '후' && x.기기 === '1440').오류.length, '고친 뒤 후 그림에는 오류가 없다');
  assert.ok(페.화면.장들.some(x => x.판 === '전' && x.그림.startsWith('캡처/전/')), '전은 준비 때 그림');
  // --장면: 장면이 찍은 이름(같은 이름 두 번이면 -2)이 화면 목록·묶음 항목이 된다(아르곤 A1)
  const 장면 = path.join(r.뿌리, '장면.mjs');
  fs.writeFileSync(장면, "export default async ({ page, 찍기, 주소들 }) => {\n  await page.goto(주소들['홈'].replace('index.html', 'missing.html'));\n  await 찍기('없음');\n  await page.goto(주소들['홈']);\n  await 찍기('첫');\n  await page.evaluate(() => { document.querySelector('#p').textContent = '눌러서 바뀐 글'; });\n  await 찍기('첫');\n};\n");
  const 둘 = await 준비하기({ 이름: '장면시험', 폴더: path.join(r.뿌리, 'out2'), 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 화면: ['홈=site/index.html'], 장면 });
  assert.deepEqual(둘.목록.화면.화면들.map(x => x.이름), ['없음', '첫', '첫-2']);
  assert.match(둘.목록.화면.화면들[1].주소.후, /site\/index\.html$/);
  assert.ok(둘.목록.화면.장들.find(x => x.이름 === '없음' && x.판 === '후').오류.some(e => /^HTTP 404 /.test(e)), '장면이 연 첫 문서의 404도 센다(Fable F5)');
  const 둘글 = 둘.목록.묶음.map(b => fs.readFileSync(path.join(둘.폴더, b.파일), 'utf8')).join('\n');
  assert.match(둘글, /화면 「첫」/);
  assert.match(둘글, /화면 「첫-2」[\s\S]*눌러서 바뀐 글/);
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

test('정책 판 2(10-24): Claude 백엔드는 GPT 하나 — 막히면 아르곤 → Fable, 옛 판 1 증거(아르곤+GPT·GPT만)도 통과', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const 준비 = (이름, 덧 = {}) => api.준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, ...덧 });
  const 한도 = 누구 => async () => { throw new Error(누구 === 'GPT' ? 'You have hit your usage limit' : 'RESOURCE_EXHAUSTED quota'); };
  // GPT 하나로 통과 — 아르곤은 돌리지 않는다
  const a = await 준비('gpt-only');
  assert.equal(a.목록.정책.판, 2); assert.deepEqual(a.목록.정책.필수, ['GPT']);
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
  assert.equal(받은[0].thinking, null, '수준을 안 주면 본 계정 설정 그대로');
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
  await assert.rejects(GPT보내기(폴더, 목록, { call: gpt, 몫, 수준: 'max', 다시: true }), /--수준은/);
  // fable.md 2단계는 두 검수자의 지적표를 다 가리킨다
  const { 페이블하기 } = await tool();
  const 페 = fs.readFileSync(await 페이블하기(폴더, { 시험: false, 캡처: false }), 'utf8');
  assert.match(페, /아르곤\(Gemini 4 Argon\)과 GPT\(다른 회사 모델\)이 먼저 본 뒤/);
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

test('GPT 부르기: codex exec를 본 계정·읽기 전용·빈 폴더·답 꼴로 한 번 부르고, 한도·로그인 오류는 막힘으로 읽힌다', async t => {
  const { GPT부르기, 답꼴 } = await tool();
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fake-codex-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 가짜 = path.join(뿌리, 'codex.js'), 기록 = path.join(뿌리, 'args.json');
  fs.writeFileSync(가짜, `
const fs = require('fs');
const a = process.argv.slice(2);
let 입력 = '';
process.stdin.on('data', d => { 입력 += d; });
process.stdin.on('end', () => {
  fs.writeFileSync(${JSON.stringify(기록)}, JSON.stringify({ a, home: process.env.CODEX_HOME || null, 입력, 꼴: JSON.parse(fs.readFileSync(a[a.indexOf('--output-schema') + 1], 'utf8')) }));
  if (process.env.FAKE_CODEX === 'limit') { process.stderr.write("ERROR: You've hit your usage limit. Try again in 2 hours.\\n"); process.exit(1); }
  if (process.env.FAKE_CODEX === 'login') { process.stderr.write('ERROR: Not logged in\\n'); process.exit(1); }
  fs.writeFileSync(a[a.indexOf('-o') + 1], JSON.stringify({ findings: [], seen: ['D01-aaaa'], coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 'END_X' }));
  process.stdout.write(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 3 } }) + '\\n');
});`);
  const 옛 = { bin: process.env.CODEX_BIN, home: process.env.CODEX_HOME, mode: process.env.FAKE_CODEX, conf: process.env.SYNK_CODEX_CONFIG };
  t.after(() => { for (const [k, v] of [['CODEX_BIN', 옛.bin], ['CODEX_HOME', 옛.home], ['FAKE_CODEX', 옛.mode], ['SYNK_CODEX_CONFIG', 옛.conf]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  const 본설정 = path.join(뿌리, 'config.toml');
  fs.writeFileSync(본설정, 'model = "test-model"\nmodel_reasoning_effort = "xhigh"\n');
  Object.assign(process.env, { CODEX_BIN: 가짜, CODEX_HOME: path.join(뿌리, '다른계정'), SYNK_CODEX_CONFIG: 본설정 });
  delete process.env.FAKE_CODEX;
  const 굽기계정 = { 이름: 'bake3', home: path.join(뿌리, 'bake3') };
  const r = await GPT부르기({ prompt: '묶음 글\n자료 끝 표식: END_X\n', schema: 답꼴, thinking: 'high', timeoutMs: 60_000, 계정: 굽기계정 });
  assert.equal(JSON.parse(r.text).endMarker, 'END_X');
  assert.deepEqual(r.usage, { input_tokens: 12, output_tokens: 3 });
  assert.equal(r.selectedModel, 'test-model-high · 굽기 장부 bake3');
  const 본 = JSON.parse(fs.readFileSync(기록, 'utf8'));
  assert.equal(본.home, 굽기계정.home, '고른 계정의 CODEX_HOME으로');
  assert.equal(본.입력, '묶음 글\n자료 끝 표식: END_X\n', '묶음은 표준입력으로');
  assert.deepEqual(본.꼴.required, 답꼴.required);
  for (const 칸 of ['exec', '--ephemeral', '--skip-git-repo-check', 'read-only', '--json', 'test-model', 'model_reasoning_effort="high"']) assert.ok(본.a.includes(칸), 칸);
  const 빈 = 본.a[본.a.indexOf('-C') + 1];
  assert.match(빈, /synk-gpt-review-[^\\/]+[\\/]empty$/, '-C는 저장소가 아니라 빈 임시 폴더(읽기 전용 실행은 파일 읽기도 거절한다)');
  assert.ok(!fs.existsSync(빈), '끝나면 임시 폴더를 지운다');
  await GPT부르기({ prompt: 'x\n자료 끝 표식: END_X\n', schema: 답꼴, timeoutMs: 60_000 });
  const 기본 = JSON.parse(fs.readFileSync(기록, 'utf8'));
  assert.equal(기본.home, null, '계정을 안 주면 본 계정(~/.codex) — 밖의 CODEX_HOME을 따르지 않는다');
  assert.ok(기본.a.includes('model_reasoning_effort="xhigh"'), '수준을 안 주면 본 설정의 추론 그대로');
  process.env.FAKE_CODEX = 'limit';
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, timeoutMs: 60_000 }), /quota/);
  process.env.FAKE_CODEX = 'login';
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, timeoutMs: 60_000 }), /login/);
  await assert.rejects(GPT부르기({ prompt: 'x', schema: 답꼴, timeoutMs: 60_000, 계정: null }), /quota — 주간 90% 아래인 Pro 계정이 없다/);
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
  const { 준비하기, GPT보내기, 결과들읽기, 집계하기, 지적표읽기, 풀기, GPT설정 } = await tool();
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
  // GA4(3차): 본 설정은 맨 위 칸과 고른 프로필에서, 작은따옴표도
  assert.deepEqual(GPT설정("model = 'main-model'\nmodel_reasoning_effort = \"xhigh\"\n[profiles.old]\nmodel = \"old-model\"\n"), { 모델: 'main-model', 추론: 'xhigh' });
  assert.deepEqual(GPT설정('profile = "fast"\nmodel = "main"\n[profiles.fast]\nmodel = "fast-model"\nmodel_reasoning_effort = \'low\'\n[plugins."x"]\nmodel = "nope"\n'), { 모델: 'fast-model', 추론: 'low' });
  assert.deepEqual(GPT설정(''), { 모델: null, 추론: null });
});
