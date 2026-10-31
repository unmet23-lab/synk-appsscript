'use strict';
// 검수 효율 여섯 가지(2026-10-31, 운영 원칙 「검수 효율 여섯 가지」) — 모델을 부르지 않고 등급 글·설계 관문·후보 차이·끝 판·P2 미룸·끝 판 시험을 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const tool = () => import(pathToFileURL(path.join(root, 'tools/검수묶음.mjs')));

for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-review-test-no-global-config'), GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid' });

function 임시저장소(t, 파일 = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-eff-'));
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
const 답꼴 = (prompt, 덧 = {}) => JSON.stringify({ findings: [], seen: [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]),
  coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1], ...덧 });
const 답하기 = (지적 = []) => async ({ prompt }) => ({ text: 답꼴(prompt, { findings: 지적 }) });
const 다시답하기 = (지적 = []) => async ({ prompt }) => ({ text: 답꼴(prompt, { findings: 지적, targets: [...prompt.matchAll(/^- \[(Q\d+)\]/gm)].map(m => ({ id: m[1], resolved: true, note: '고친 diff에서 확인' })) }) });
const 지적하나 = (location, grade = 'P1') => ({ grade, location, quote: 'a', problem: '부르는 곳이 옛 값을 기대한다', fix: '부르는 곳도 고친다' });
const 몫충분 = () => ({ 주간: 0.9 });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const 블롭 = 글 => { const b = Buffer.from(글); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex'); };

test('등급: 묶음·다시·Fable 글이 같은 P1 기준을 쓰고, Fable은 P0·P1 처리만 보고 P2·P3는 다섯 건까지', async t => {
  const api = await tool(), r = 임시저장소(t, { 'view.txt': 'a\n' }); r.쓰기('view.txt', 'b\n');
  for (const 글 of [api.규칙글('백엔드'), api.규칙글('화면'), api.다시규칙글('백엔드'), api.다시규칙글('화면')]) {
    assert.match(글, /P1: 실제 사용자나 운영 데이터가 정상 사용 경로에서 밟는 기능 오류/);
    assert.match(글, /운영 데이터를 지우거나 덮는 일, 인증·권한·돈·개인정보, 배포·검수 관문을 잘못 통과시키는 일은 드문 입력이어도 P1/);
    assert.match(글, /일부러 만든 극단 입력이나 가정한 장애에서만 나는 문제도 P2/);
  }
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'grade', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕 });
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 });
  const fable = fs.readFileSync(await api.페이블하기(폴더, { 시험: false, 캡처: false }), 'utf8');
  assert.match(fable, /P1 실제 사용자나 운영 데이터가 정상 사용 경로에서 밟는 기능 오류/);
  assert.match(fable, /P0·P1 지적만 Claude의 처리/);
  assert.match(fable, /P2·P3의 처리는 확인하지 않고 argonReview에도 적지 않는다/);
  assert.match(fable, /고칠 값이 큰 것부터 5건까지만/);
  assert.match(fable, /범위를 줄이지 않는다/, '바뀐 파일 전체를 보는 범위는 그대로다');
});

test('설계 관문: 이름이 달라도 같은 파일이 72시간 안에 3회차 연달아 P0·P1이면 준비가 시험 전에 멈추고, 설계 검토 기록을 주면 지나간다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'src/p.js': 'a=1\n', 'src/q.js': 'q=1\n' }), 뿌리 = path.join(r.뿌리, '묶음들');
  const 살아있음 = [{ 등급: 'P1', 위치: 'src/p.js:3', 처리: '반영' }];
  const 회차 = (이름, 시간전, 지적 = 살아있음, { 경로 = 'src/p.js', 검수 = true } = {}) => {
    const d = path.join(뿌리, 이름); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, '묶음.json'), JSON.stringify({ 이름, 만든때: new Date(Date.now() - 시간전 * 3_600_000).toISOString(), 파일: [{ 경로 }] }));
    fs.writeFileSync(path.join(d, '지적표.json'), JSON.stringify({ 이름, 지적 }));
    if (검수) fs.writeFileSync(path.join(d, 'GPT-A.json'), '{}');
  };
  회차('public-v9', 50); 회차('public-v10', 30);
  회차('안-받음', 26, 살아있음, { 검수: false });   // 검수를 안 받은 회차는 세지 않는다
  회차('다른-파일', 25, [{ 등급: 'P1', 위치: 'src/q.js:1', 처리: '반영' }], { 경로: 'src/q.js' });
  회차('옛날', 200);                                // 창 밖
  assert.deepEqual(api.연속지적찾기(뿌리, ['src/p.js']), [], '두 회차로는 아직 멈추지 않는다');
  회차('server-c12', 2, [{ 등급: 'P0', 위치: 'src/p.js:9', 처리: null }]);   // 처리를 안 적은 P0·P1도 센다
  assert.deepEqual(api.연속지적찾기(뿌리, ['src/p.js', 'src/q.js']), [{ 경로: 'src/p.js', 회차들: ['public-v9', 'public-v10', 'server-c12'] }]);
  r.쓰기('src/p.js', 'a=2\n');
  const 준비 = 덧 => api.준비하기({ 이름: 'next', 폴더: path.join(뿌리, 'next'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, ...덧 });
  await assert.rejects(준비({}), /설계 관문.*src\/p\.js\(public-v9 → public-v10 → server-c12\).*--설계검토/);
  assert.equal(fs.existsSync(path.join(뿌리, 'next')), false, '시험·묶음을 돌리기 전에 멈춘다');
  await assert.rejects(준비({ 설계검토: path.join(r.뿌리, '없는.md') }), /--설계검토 기록이 없거나 비었다/);
  fs.writeFileSync(path.join(r.뿌리, '설계.md'), '정규식 파서를 문법 표로 바꾼다 — Fable 검토 통과\n');
  const p = await 준비({ 설계검토: path.join(r.뿌리, '설계.md') });
  assert.deepEqual(p.목록.설계검토.걸린곳.map(x => x.경로), ['src/p.js']); assert.equal(p.목록.설계검토.sha256.length, 64);
  회차('server-c13', 1, [{ 등급: 'P1', 위치: 'src/p.js:9', 처리: '재현 안 됨' }]);
  assert.deepEqual(api.연속지적찾기(뿌리, ['src/p.js']), [], '재현 안 된 회차가 끼면 연속이 끊긴다');
  // 경로가 온전히 맞아야 센다 — backup/src/a.js 지적은 src/a.js 지적이 아니다
  for (const [이름, 위치] of [['b1', 'backup/src/a.js:1'], ['b2', 'src/a.js.map:1'], ['b3', 'backup/src/a.js:2']]) 회차(이름, 3, [{ 등급: 'P1', 위치, 처리: '반영' }], { 경로: 'src/a.js' });
  assert.deepEqual(api.연속지적찾기(뿌리, ['src/a.js']), []);
  for (const 이름 of ['m1', 'm2', 'm3']) 회차(이름, 3, [{ 등급: 'P1', 위치: 'src/m.js.map:1', 처리: '반영' }], { 경로: 'src/m.js' });
  assert.deepEqual(api.연속지적찾기(뿌리, ['src/m.js']), [], '.map 지적은 원본 파일 지적이 아니다');
  for (const [이름, 위치] of [['k1', 'src/k.js:1'], ['k2', 'src/k.js.'], ['k3', '「src/k.js」 · 화면 글']]) 회차(이름, 3, [{ 등급: 'P1', 위치, 처리: '반영' }], { 경로: 'src/k.js' });
  assert.equal(api.연속지적찾기(뿌리, ['src/k.js']).length, 1, '줄 번호·낱말이 붙어도 같은 파일이다');
});

test('배포 후보: 앞 공개본이 있으면 달라진 곳만 싣고, 앞 판이 어긋나면 통째로 싣고, 지운 문구가 남은 곳을 도구가 찾는다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'src/ko.mjs': "export const a = '교수님 연구실 장면을 해 볼 수 있어요';\n" });
  r.쓰기('src/ko.mjs', "export const a = '학생 식당 장면을 해 볼 수 있어요';\n");
  const 후보폴더 = path.join(r.뿌리, '후보');
  const 안바뀐 = Array.from({ length: 400 }, (_, i) => `안바뀐표식 ${i}`).join('\n');
  const 파일 = { 'knowledge.json': `${안바뀐}\n1화의 연구실 장면이 남아 있다\n새 줄\n`, 'en/knowledge.json': `${안바뀐}\nchanged\n`, 'new.html': '<p>새 쪽 본문</p>\n' };
  const 앞판 = { 'knowledge.json': `${안바뀐}\n1화의 연구실 장면이 남아 있다\n옛 줄\n`, 'en/knowledge.json': `${안바뀐}\nold\n` };
  const 넣기 = (뿌리, 표) => { for (const [p, v] of Object.entries(표)) { const f = path.join(뿌리, ...p.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); } };
  넣기(후보폴더, 파일); 넣기(path.join(후보폴더, '.앞판'), 앞판);
  fs.writeFileSync(path.join(후보폴더, '후보.json'), JSON.stringify({ 판: 1, 종류: 'synk.im', 위: 'abc123', 항목: Object.entries(파일).map(([경로, v]) => ({ 경로, 종류: 앞판[경로] ? '바꿈' : '새', sha256: sha(v), 모드: '100644' })),
    앞판: { 'knowledge.json': 블롭(앞판['knowledge.json']), 'en/knowledge.json': 블롭('어긋난 앞 판') } }));
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'cand', 폴더: r.출력, 저장소: r.저장소, 종류: '화면', 바탕: r.바탕, 배포후보: 후보폴더 });
  const 글 = 목록.묶음.map(b => fs.readFileSync(path.join(폴더, b.파일), 'utf8')).join('\n');
  const 칸 = 경로 => 글.split(/^### \[/m).find(s => s.includes(`배포 후보 ${경로} (`));
  assert.match(칸('knowledge.json'), /앞 공개본과 달라진 곳만/); assert.match(칸('knowledge.json'), /-옛 줄\n\+새 줄/); assert.doesNotMatch(칸('knowledge.json'), /안바뀐표식 0\n/);
  assert.doesNotMatch(칸('en/knowledge.json'), /앞 공개본과/, '번호가 어긋난 앞 판은 믿지 않고 통째로 싣는다'); assert.match(칸('en/knowledge.json'), /안바뀐표식 0\n/);
  assert.match(칸('new.html'), /새 쪽 본문/, '앞 판이 없는 새 파일은 통째로');
  assert.match(글, /지운 문구가 배포 후보의 안 바뀐 줄에 남은 곳 1건/); assert.match(글, /「연구실 장면」 knowledge\.json:401/);
  assert.equal(목록.증명.배포후보.항목.length, 3, '증명은 후보 전체를 그대로 묶는다');
  assert.deepEqual(목록.증명.후보앞판, { 위: 'abc123', 항목: { 'knowledge.json': 블롭(앞판['knowledge.json']) } }, '믿은 앞 판만 증명에 묶어 공개 도구가 대조한다');
  // 문장을 조금 고쳐도 안 바뀐 다른 줄의 옛 문구는 찾고, 달라진 줄은 diff가 보이므로 찾지 않는다
  const 지움 = '-연구실 장면을 볼 수 있어요\n+연구실 장면을 볼 수 없어요\n';
  assert.deepEqual(api.옛문구찾기(지움, [{ 경로: 'a', 글: '옛 안내: 연구실 장면이 있어요\n연구실 장면을 볼 수 없어요\n', 앞글: '옛 안내: 연구실 장면이 있어요\n연구실 장면을 볼 수 있어요\n' }]).map(x => [x.문구, x.줄]), [['연구실 장면', 1]]);
  assert.deepEqual(api.옛문구찾기(지움, [{ 경로: 'a', 글: '연구실 장면을 볼 수 없어요\n', 앞글: '연구실 장면을 볼 수 있어요\n' }]), []);
});

test('GPT 작성(정책 판 5): 다시는 GPT만, Claude는 첫 판·끝 판·자기 지적만 — 끝 판을 안 보면 배포가 막히고, 옛 판 사슬은 그대로 둘 다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' }); r.쓰기('a.js', 'a=2\n');
  const 준비 = (이름, 덧 = {}) => api.준비하기({ 이름, 폴더: path.join(r.뿌리, 이름), 저장소: r.저장소, 종류: '백엔드', 작성자: 'GPT', 바탕: r.바탕, ...덧 });
  const 클로드 = async (목록, 폴더, 답) => { for (const b of 목록.묶음) api.검수받기(폴더, 'Claude', b.이름, (await 답({ prompt: fs.readFileSync(path.join(폴더, b.파일), 'utf8') })).text); };
  const x = await 준비('g1'); assert.equal(x.목록.정책.판, 5); assert.deepEqual(x.목록.정책.필수, ['GPT', 'Claude']);
  await api.GPT보내기(x.폴더, x.목록, { call: 답하기([지적하나('a.js:1')]), 몫: 몫충분 });
  await 클로드(x.목록, x.폴더, 답하기());
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  r.쓰기('a.js', 'a=3\n');
  const y = await api.다시하기({ 이름: 'g2', 폴더: path.join(r.뿌리, 'g2'), 앞: x.폴더 });
  assert.deepEqual(y.목록.검수자들, ['GPT'], 'GPT가 낸 지적을 고친 판은 GPT만 본다');
  await api.GPT보내기(y.폴더, y.목록, { call: 다시답하기(), 몫: 몫충분 });
  assert.match(api.검수확인(y.폴더).사유.join(' / '), /끝 판을 Claude가 아직 보지 않았다.*--앞 g2 --끝판/);
  const z = await api.다시하기({ 이름: 'g3', 폴더: path.join(r.뿌리, 'g3'), 앞: y.폴더, 끝판: true });
  assert.deepEqual(z.목록.검수자들, ['GPT', 'Claude']); assert.equal(z.목록.끝판, true); assert.equal(z.목록.증명.끝판, true);
  const 글 = fs.readFileSync(path.join(z.폴더, '묶음-A.txt'), 'utf8');
  assert.match(글, /끝 판 확인/); assert.match(글, /-a=2\n\+a=3/, '바뀐 것이 없어도 Claude가 본 g1부터 쌓인 diff를 보인다');
  await api.GPT보내기(z.폴더, z.목록, { call: 다시답하기(), 몫: 몫충분 });
  assert.match(api.검수확인(z.폴더).사유.join(' / '), /다시 검수 Claude 미완료/);
  await 클로드(z.목록, z.폴더, 다시답하기());
  assert.deepEqual(api.검수확인(z.폴더).사유, []); assert.deepEqual(api.검수확인(z.폴더).증명.사슬, ['g1', 'g2', 'g3']);
  // 증명의 끝판 표시를 지우면 검수자가 정책과 어긋난다
  const 목록파일 = path.join(z.폴더, '묶음.json'), 목록 = JSON.parse(fs.readFileSync(목록파일, 'utf8')); delete 목록.증명.끝판; fs.writeFileSync(목록파일, JSON.stringify(목록));
  assert.equal(api.검수확인(z.폴더).통과, false);
  // Claude가 낸 지적을 고친 판은 Claude도 본다
  r.쓰기('a.js', 'a=4\n');
  const u = await 준비('c1');
  await api.GPT보내기(u.폴더, u.목록, { call: 답하기(), 몫: 몫충분 });
  await 클로드(u.목록, u.폴더, 답하기([지적하나('a.js:1')]));
  api.지적표고치기(u.폴더, 표 => api.처리하기(표, ['CA1=반영']));
  r.쓰기('a.js', 'a=5\n');
  assert.deepEqual((await api.다시하기({ 이름: 'c2', 폴더: path.join(r.뿌리, 'c2'), 앞: u.폴더 })).목록.검수자들, ['GPT', 'Claude']);
  // 끝 판은 GPT 작성 판 5 사슬에서만, 옛 판 2는 다시마다 둘 다
  r.쓰기('a.js', 'a=6\n');
  const o = await 준비('o1', { 정책판: 2 }); assert.equal(o.목록.정책.판, 2);
  await api.GPT보내기(o.폴더, o.목록, { call: 답하기([지적하나('a.js:1')]), 몫: 몫충분 });
  await 클로드(o.목록, o.폴더, 답하기());
  api.지적표고치기(o.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  r.쓰기('a.js', 'a=7\n');
  await assert.rejects(api.다시하기({ 이름: 'o2x', 폴더: path.join(r.뿌리, 'o2x'), 앞: o.폴더, 끝판: true }), /--끝판은 GPT가 작성한 백엔드 사슬/);
  assert.deepEqual((await api.다시하기({ 이름: 'o2', 폴더: path.join(r.뿌리, 'o2'), 앞: o.폴더 })).목록.검수자들, ['GPT', 'Claude']);
});

test('P2·P3만 고친 판은 다음 판으로 미룬다(판 5) — 함께올림·후보만 다시 지은 판·옛 판은 잇는다', async t => {
  const api = await tool(), r = 임시저장소(t, { 'a.js': 'a=1\n' });
  const 후보 = (이름, 글) => { const d = path.join(r.뿌리, 이름); fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'Code.js'), 글); fs.writeFileSync(path.join(d, '후보.json'), JSON.stringify({ 판: 1, 종류: 'apps-script', 항목: [{ 경로: 'Code.js', 종류: '바꿈', sha256: sha(글), 모드: '100644' }] })); return d; };
  r.쓰기('a.js', 'a=2\n');
  const x = await api.준비하기({ 이름: 'p', 폴더: path.join(r.뿌리, 'p'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, 배포후보: 후보('c1', 'v=1\n') });
  await api.GPT보내기(x.폴더, x.목록, { call: 답하기([지적하나('a.js:1', 'P2')]), 몫: 몫충분 });
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  const c = await api.다시하기({ 이름: 'p-cand', 폴더: path.join(r.뿌리, 'p-cand'), 앞: x.폴더, 배포후보: 후보('c2', 'v=2\n') });
  assert.deepEqual(c.목록.바뀐경로.소스, [], '후보만 다시 지은 판은 고침이 아니라 그대로 잇는다');
  await api.GPT보내기(c.폴더, c.목록, { call: 다시답하기(), 몫: 몫충분 });
  r.쓰기('a.js', 'a=2 // P2 고침\n');
  await assert.rejects(api.다시하기({ 이름: 'p2', 폴더: path.join(r.뿌리, 'p2'), 앞: c.폴더 }), /P2·P3 고침은 다시 검수하지 않고 다음 판으로 미룬다.*앞 검수 p-cand.*--함께올림/);
  assert.equal(fs.existsSync(path.join(r.뿌리, 'p2')), false);
  const y = await api.다시하기({ 이름: 'p2', 폴더: path.join(r.뿌리, 'p2'), 앞: c.폴더, 함께올림: '사용자 글 오타라 함께 올린다' });
  assert.equal(y.목록.함께올림, '사용자 글 오타라 함께 올린다');
  // 옛 판 사슬은 진행 중이던 그대로다
  r.쓰기('a.js', 'a=3\n');
  const o = await api.준비하기({ 이름: 'old', 폴더: path.join(r.뿌리, 'old'), 저장소: r.저장소, 종류: '백엔드', 바탕: r.바탕, 정책판: 2 });
  await api.GPT보내기(o.폴더, o.목록, { call: 답하기(), 몫: 몫충분 });
  r.쓰기('a.js', 'a=4\n');
  assert.deepEqual((await api.다시하기({ 이름: 'old2', 폴더: path.join(r.뿌리, 'old2'), 앞: o.폴더 })).목록.대상, []);
});

test('서비스 백엔드 끝 판 시험: 11-14까지 통과한 Claude 작성 서비스 코드만 아르곤 끝 판을 안내한다', async () => {
  const { 끝판시험말 } = await tool();
  const 목록 = { 이름: 'town-engine', 종류: '백엔드', 정책: { 작성자: 'Claude', 예외: null }, 끝: '작업본', 바탕: { 커밋: 'abcdef1234' }, 저장소: 'C:/repo', 설정: { 경로: ['experiences/synk-town'] } };
  const 확인 = (경로, 통과 = true) => ({ 통과, 증명: { 최종파일: [{ 경로, 역할: '소스' }] } });
  const 안 = new Date('2026-11-01T00:00:00Z');
  assert.match(끝판시험말(목록, 확인('experiences/synk-town/core.mjs'), { 지금: 안 }), /11-14까지.*준비 town-engine-끝판 --종류 백엔드 --바탕 abcdef123 --저장소 C:\/repo --경로 experiences\/synk-town --시험결과.*아르곤 town-engine-끝판/);
  assert.match(끝판시험말(목록, 확인('엔진_콘텐츠AI.js'), { 지금: 안 }), /끝판/);
  for (const 경로 of ['tools/바로올리기.js', 'tests/a.test.js', 'experiences/x/qa/a.mjs', 'experiences/x/a.test.mjs', 'docs/a.md']) assert.equal(끝판시험말(목록, 확인(경로), { 지금: 안 }), null, 경로);
  assert.equal(끝판시험말(목록, 확인('lib/a.js', false), { 지금: 안 }), null, '배포 조건이 차기 전에는 안내하지 않는다');
  assert.equal(끝판시험말(목록, 확인('lib/a.js'), { 지금: new Date('2026-11-15T00:00:00Z') }), null, '시험 기간이 끝나면 저절로 멈춘다');
  assert.equal(끝판시험말({ ...목록, 정책: { 작성자: 'GPT' } }, 확인('lib/a.js'), { 지금: 안 }), null);
  assert.equal(끝판시험말({ ...목록, 이름: 'town-engine-끝판' }, 확인('lib/a.js'), { 지금: 안 }), null, '끝 판 묶음에서 또 안내하지 않는다');
});
