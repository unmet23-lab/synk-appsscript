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
  assert.equal(답대조(묶음, { endMarker: 표식, seen: ['[D01-ab12]', 'd02-cd34'] }).상태, '읽음');
  assert.deepEqual(답대조(묶음, { endMarker: 표식, seen: ['D01-ab12', 'D02'] }).빠진항목, ['D02-cd34'], '해시 없이 번호만 적으면 읽은 것으로 치지 않는다');
  assert.equal(답대조(묶음, { endMarker: 'truncated', seen: ['D01-ab12'] }).상태, '잘림');
  assert.equal(답대조(묶음, { endMarker: 표식, seen: ['D01-ab12', 'D02-cd34', 'truncated'] }).상태, '잘림');
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
  const 답 = 페이블답읽기('보고 글\n```json\n{"findings":[{"grade":"P1","location":"a.js:3","quote":"x","problem":"깨짐","fix":"고침"}],"argonReview":[{"id":"A1","agree":false,"note":"아직 넘침"}],"coverage":{"reviewed":"전부","limitations":"없음"}}\n```\n');
  const 표 = { 지적: [{ 번호: 'A1', 출처: '아르곤', 묶음: 'A', 등급: 'P2', 위치: 'b.js:1', 인용: '' }] };
  assert.deepEqual(페이블지적넣기(표, 답), ['F1']);
  assert.deepEqual(페이블지적넣기(표, 답), [], '같은 위치·인용은 다시 넣지 않는다');
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
    return { text: JSON.stringify({ findings: [{ grade: 'P1', location: 'src/app.js:2', quote: 'b = 3', problem: '부르는 곳이 2를 기대한다', fix: '부르는 곳도 고친다' }], seen, coverage: { reviewed: '전부', limitations: '' }, endMarker: 표식 }), selectedModel: 'gemini-4-argon-medium', usage: { input_tokens: 10 } };
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
  assert.equal(s.한줄, `아르곤 ${목록.묶음.length}건(반영 1)`.replace(/\d+건/, `${표.지적.length}건`));
  assert.equal(s.배포조건충족, true);

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
  // 쓸 만한 답이 없던 묶음이 막히면 그 묶음은 「막힘」이고 집계가 Fable로 대신하라고 한다
  const 새폴더 = path.join(r.뿌리, 'out-막힘');
  const 막힌목록 = (await 준비하기({ 이름: '막힘', 폴더: 새폴더, 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕 })).목록;
  const 처음막힘 = await 아르곤보내기(새폴더, 막힌목록, { call: async () => { throw new Error('login required'); }, 몫 });
  assert.equal(처음막힘[0].상태, '막힘');
  assert.ok(집계하기(막힌목록, 처음막힘, 지적표읽기(새폴더)).조건.some(x => /Fable 검수로 대신/.test(x)));
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
