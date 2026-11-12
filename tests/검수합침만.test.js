'use strict';
// 검수 사슬 합침 고리(2026-11-12, 검수묶음.mjs 다시 --합침만) — 앞 검수 뒤 이 세션의 고침 없이 origin에 먼저 오른 커밋을 합쳐 바이트만 바뀐 판은
// 검수자를 부르지 않고 앞 검수 판 ⊕ origin 판의 깨끗한 3방향 합침과 바이트로 대조해 잇는다. 진짜 bare origin과 두 작업본(이 세션 · 남의 세션)으로
// rebase · push · 따라가기 흐름을 만들고, 모델은 부르지 않는다(검수 답은 손으로 만든 JSON).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const tool = () => import(pathToFileURL(path.join(root, 'tools/검수묶음.mjs')));
const 증명도구 = () => import(pathToFileURL(path.join(root, 'tools/lib/검수증명.mjs')));

for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-review-merge-test-no-global-config'), GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid', GIT_EDITOR: 'true' });

const 답꼴 = (prompt, 덧 = {}) => JSON.stringify({ findings: [], seen: [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]),
  coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1], ...덧 });
const 답하기 = (지적 = []) => async ({ prompt }) => ({ text: 답꼴(prompt, { findings: 지적 }) });
const 다시답하기 = (지적 = []) => async ({ prompt }) => ({ text: 답꼴(prompt, { findings: 지적, targets: [...prompt.matchAll(/^- \[(Q\d+)\]/gm)].map(m => ({ id: m[1], resolved: true, note: '고친 diff에서 확인' })) }) });
const 몫충분 = () => ({ 주간: 0.9 });
const 지적하나 = (location, grade = 'P1') => ({ grade, location, quote: 'a', problem: '부르는 곳이 옛 값을 기대한다', fix: '부르는 곳도 고친다' });
/** 스무 줄 파일 — 바꿀 줄 번호(0부터) → 새 줄. 바꾼 줄끼리 두 줄 넘게 떨어져 있으면 git이 깨끗이 합친다. */
const 판 = (바꿈 = {}, 이름 = 'v') => Array.from({ length: 20 }, (_, i) => 바꿈[i] ?? `const ${이름}${i} = ${i};`).join('\n') + '\n';

/** bare origin + 이 세션 작업본(나) + 남의 세션 작업본(남). 처음 판을 origin/master에 올려 둔다. */
function 세판(t, 처음 = { 'src/a.js': 판(), 'src/b.js': 판({}, 'b'), 'docs/c.md': '# 문서\n' }) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-merge-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const g = (cwd, ...a) => execFileSync('git', ['-C', cwd, '-c', 'core.autocrlf=false', ...a], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const 원격 = path.join(뿌리, 'origin.git'), 나 = path.join(뿌리, 'me'), 남 = path.join(뿌리, 'other');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격]);
  execFileSync('git', ['clone', '-q', 원격, 나], { stdio: 'pipe' });
  const 쓰기 = (cwd, 표) => { for (const [p, v] of Object.entries(표)) { const f = path.join(cwd, ...p.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); } };
  g(나, 'checkout', '-q', '-b', 'master'); 쓰기(나, 처음); g(나, 'add', '-A'); g(나, 'commit', '-qm', '처음 판'); g(나, 'push', '-q', 'origin', 'master');
  g(나, 'branch', '-q', '--set-upstream-to=origin/master', 'master');
  execFileSync('git', ['clone', '-q', 원격, 남], { stdio: 'pipe' });
  const 바탕 = g(나, 'rev-parse', 'HEAD').trim();
  /** 남의 세션이 고쳐 origin에 올린다(나는 아직 안 받음). */
  const 남올림 = (표, 말) => { g(남, 'pull', '-q', '--ff-only'); 쓰기(남, 표); g(남, 'add', '-A'); g(남, 'commit', '-qm', 말); g(남, 'push', '-q', 'origin', 'master'); return g(남, 'rev-parse', 'HEAD').trim(); };
  /** 이 세션이 바로올리기로 올리듯 커밋 · push하고 작업본 git 폴더의 올림 장부에 한 줄 적는다(tools/lib/git-publish-core.cjs 올림장부와 같은 꼴). */
  const 나올림 = 말 => {
    g(나, 'commit', '-qam', 말); g(나, 'push', '-q', 'origin', 'master');
    const 커밋 = g(나, 'rev-parse', 'HEAD').trim();
    fs.appendFileSync(path.join(나, '.git', '바로올리기-올림.jsonl'), JSON.stringify({ 때: new Date().toISOString(), 커밋, 바탕: null, 원격: 'origin', 가지: 'master' }) + '\n');
    return 커밋;
  };
  return { 뿌리, 원격, 나, 남, g, 쓰기: 표 => 쓰기(나, 표), 바탕, 남올림, 나올림, 폴더: 이름 => path.join(뿌리, '검수', 이름) };
}
/** 이 세션의 처음 검수(백엔드 · Claude 작성 · GPT 하나). 경로는 src. */
async function 검수(api, s, 이름, { 지적 = [], 덧 = {} } = {}) {
  const { 폴더, 목록 } = await api.준비하기({ 이름, 폴더: s.폴더(이름), 저장소: s.나, 종류: '백엔드', 바탕: s.바탕, 경로: ['src'], ...덧 });
  await api.GPT보내기(폴더, 목록, { call: 답하기(지적), 몫: 몫충분 });
  return 폴더;
}
const 합침 = (api, s, 이름, 앞, 덧 = {}) => api.다시하기({ 이름, 폴더: s.폴더(이름), 앞, 저장소: s.나, 합침만: true, ...덧 });
const 읽기 = f => JSON.parse(fs.readFileSync(f, 'utf8'));

// 시험마다 저장소 · 묶음 폴더가 따로라 넷씩 함께 돈다(git 한 번이 0.4초 넘게 걸리는 PC에서 6분 → 줄임)
describe('검수 합침 고리 — 다시 --합침만', { concurrency: 4 }, () => {
test('안 올림: 안 올린 고침을 남의 커밋 위로 rebase한 판은 검수자 없이 합침 고리로 잇고, 확인이 통과한다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'm1');
  assert.equal(api.검수확인(첫).통과, true);
  const 남커밋 = s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남): 15번째 줄');
  s.g(s.나, 'commit', '-qam', 'wip: 이 세션'); s.g(s.나, 'pull', '-q', '--rebase');
  assert.match(api.검수확인(첫).사유.join(' / '), /검수 뒤 파일 변경: src\/a\.js/, '남의 커밋이 이 사슬 파일을 바꾸면 그대로는 막힌다');
  const { 폴더, 목록 } = await 합침(api, s, 'm2', 첫);
  assert.equal(목록.갈래, '합침'); assert.equal(목록.합침.모양, '안 올림'); assert.equal(목록.합침.origin, 남커밋); assert.equal(목록.합침.바탕, s.바탕);
  assert.deepEqual(목록.검수자들, []); assert.deepEqual(목록.묶음, []); assert.deepEqual(목록.바뀐경로.소스, ['src/a.js']);
  assert.deepEqual(목록.합침.커밋들.map(c => c.제목), ['fix(남): 15번째 줄']);
  assert.equal(fs.readdirSync(폴더).some(n => /^(?:GPT|아르곤|그록|Claude|Fable)-/.test(n) || /^묶음-/.test(n)), false, '검수자 묶음 · 답이 없다');
  const r = api.검수확인(폴더);
  assert.deepEqual(r.사유, []); assert.equal(r.통과, true); assert.deepEqual(r.증명.사슬, ['m1', 'm2']);
  assert.equal(r.다시.at(-1).합침.모양, '안 올림');
  assert.equal(r.증명.최종파일.find(f => f.경로 === 'src/a.js').sha256, (await 증명도구()).sha256(fs.readFileSync(path.join(s.나, 'src/a.js'))), '사슬 끝 = 지금 바이트');
});

test('올림: 검수한 고침을 올린 뒤 남의 커밋이 같은 파일을 바꾸고 작업본이 따라간 판은, 그 고침만 담은 커밋을 찾아 잇는다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'u1');
  const 나르개 = s.나올림('feat: 이 세션 고침');   // 바로올리기처럼 올림 장부에도 적힌다 — 나르개는 자기 커밋이어도 된다
  s.남올림({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 15: 'const v15 = "남";' }) }, 'fix(남): 15번째 줄');
  s.g(s.나, 'pull', '-q', '--ff-only');
  const { 폴더, 목록 } = await 합침(api, s, 'u2', 첫);
  assert.equal(목록.합침.모양, '올림'); assert.equal(목록.합침.나르개, 나르개);
  assert.deepEqual(목록.합침.커밋들.map(c => c.제목), ['feat: 이 세션 고침', 'fix(남): 15번째 줄']);
  assert.deepEqual(api.검수확인(폴더).사유, []);
  // 남의 커밋이 또 오르면 합침 고리 위에 쌓지 않고 마지막 검수 고리(u1)에 바꿔 잇는다 — 사슬이 고리 수만큼 늘지 않는다
  s.남올림({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 15: 'const v15 = "남";', 18: 'const v18 = "남2";' }) }, 'fix(남): 18번째 줄');
  s.g(s.나, 'pull', '-q', '--ff-only');
  const c = await 합침(api, s, 'u3', 폴더, { 끝: 'HEAD' });   // --끝 <커밋>: 작업본 대신 그 커밋의 판을 잇는다
  assert.equal(c.목록.앞.이름, 'u1'); assert.equal(c.목록.합침.모양, '올림'); assert.equal(c.목록.합침.나르개, 나르개);
  assert.equal(c.목록.끝.커밋, s.g(s.나, 'rev-parse', 'HEAD').trim()); assert.equal(c.목록.머리커밋, null);
  const r = api.검수확인(c.폴더);
  assert.deepEqual(r.사유, []); assert.deepEqual(r.증명.사슬, ['u1', 'u3']);
  // 손으로 앞을 합침 고리(u2)로 바꿔 붙이면 확인이 막는다 — 합침 고리의 머리는 검수자가 읽은 글에 묶이지 않는다
  const 목록파일 = path.join(c.폴더, '묶음.json'), 원래 = fs.readFileSync(목록파일);
  fs.writeFileSync(목록파일, JSON.stringify({ ...c.목록, 앞: { 이름: 'u2', 폴더 } }));
  assert.match(api.검수확인(c.폴더).사유.join(' / '), /합침 고리 바로 앞이 합침 고리다/);
  fs.writeFileSync(목록파일, 원래);
});

test('자기 커밋: 앞 검수 뒤 이 세션이 따로 올린 고침은 남의 커밋과 섞여도 세 모양 모두 거절한다(올림 장부)', async t => {
  const api = await tool();
  // 앞 판 그대로: 올린 판을 검수한 뒤 남의 커밋만 오르면 잇고, 그 뒤 따로 올린 P2 고침은 거절
  const s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  s.나올림('feat: 이 세션 고침');
  const p1 = await 검수(api, s, 'p1');   // 올린 판을 검수 — 작업본은 깨끗하고 HEAD가 그 커밋
  s.남올림({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 15: 'const v15 = "남";' }) }, 'fix(남): 15번째 줄');
  s.g(s.나, 'pull', '-q', '--ff-only');
  const p2 = await 합침(api, s, 'p2', p1);
  assert.equal(p2.목록.합침.모양, '앞 판 그대로'); assert.equal(api.검수확인(p2.폴더).통과, true);
  assert.deepEqual(p2.목록.합침.올림장부, [path.resolve(s.나).split(path.sep).join('/')]);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "P2 고침";', 15: 'const v15 = "남";' }) });
  s.나올림('fix: P2 고침');
  await assert.rejects(합침(api, s, 'p3', p2.폴더), /앞 검수 뒤 이 작업본이 올린 커밋이 이 사슬 파일을 바꿨다\(검수 안 받은 고침\): [0-9a-f]{10} fix: P2 고침/);
  // 올림: 검수한 고침을 올린 뒤 따로 덧고침을 올림 — 나르개는 있어도 거절
  const s2 = 세판(t);
  s2.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const q1 = await 검수(api, s2, 'q1');
  s2.나올림('feat: 이 세션 고침');
  s2.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "덧고침";' }) });
  s2.나올림('fix: 덧고침');
  s2.남올림({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "덧고침";', 15: 'const v15 = "남";' }) }, 'fix(남)');
  s2.g(s2.나, 'pull', '-q', '--ff-only');
  await assert.rejects(합침(api, s2, 'q2', q1), /이 작업본이 올린 커밋이 이 사슬 파일을 바꿨다.*fix: 덧고침/);
  // 안 올림: 검수한 고침은 로컬에 두고 다른 줄 고침만 따로 올림
  const s3 = 세판(t);
  s3.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const w1 = await 검수(api, s3, 'w1');
  s3.g(s3.나, 'stash', 'push', '-q', '-m', '검수한 고침');
  s3.쓰기({ 'src/a.js': 판({ 9: 'const v9 = "따로";' }) });
  s3.나올림('fix: 따로 올림');
  s3.g(s3.나, 'stash', 'pop', '-q');
  s3.남올림({ 'src/a.js': 판({ 9: 'const v9 = "따로";', 15: 'const v15 = "남";' }) }, 'fix(남)');
  s3.g(s3.나, 'stash', 'push', '-q', '-m', '다시'); s3.g(s3.나, 'pull', '-q', '--ff-only'); s3.g(s3.나, 'stash', 'pop', '-q');
  await assert.rejects(합침(api, s3, 'w2', w1), /이 작업본이 올린 커밋이 이 사슬 파일을 바꿨다.*fix: 따로 올림/);
});

test('내커밋 올리기: 검수한 고침과 검수 안 받은 줄을 로컬 커밋 둘로 쌓아 내커밋.js로 올린 판도 올림 장부로 가른다(Fable 다시 검토 X3)', async t => {
  const api = await tool(), 내커밋 = require(path.join(root, 'tools/내커밋.js'));
  const s = 세판(t, { 'src/a.js': 판(), 'src/b.js': 판({}, 'b'), 'docs/c.md': '# 문서\n', 'tools/git-storage-policy.json': fs.readFileSync(path.join(root, 'tools/git-storage-policy.json'), 'utf8') });
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'x1');
  s.g(s.나, 'commit', '-qam', 'feat: 검수한 고침');
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "검수 안 받은 줄";' }) });
  s.g(s.나, 'commit', '-qam', 'fix: 검수 안 받은 줄');
  const 커밋들 = s.g(s.나, 'rev-list', '--reverse', 'origin/master..HEAD').trim().split('\n');
  const r = await 내커밋.올리기({ 저장소: s.나, 커밋들, 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r.문제 || r.이유));
  s.남올림({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "검수 안 받은 줄";', 15: 'const v15 = "남";' }) }, 'fix(남)');
  s.g(s.나, 'pull', '-q', '--rebase');
  // 장부가 없으면 「올림」(나르개 = 검수한 고침 커밋)으로 이어져 검수 안 받은 줄이 확인을 지났다
  await assert.rejects(합침(api, s, 'x2', 첫), /이 작업본이 올린 커밋이 이 사슬 파일을 바꿨다\(검수 안 받은 고침\): [0-9a-f]{10} fix: 검수 안 받은 줄/);
});

test('손 고침: rebase 뒤 작업본 한 줄 · 앞 검수에 없던 파일을 더하거나 고침 · 충돌을 손으로 푼 판은 거절한다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'h1');
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남): 15번째 줄');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  const 합친 = fs.readFileSync(path.join(s.나, 'src/a.js'), 'utf8');
  // 작업본 한 줄
  s.쓰기({ 'src/a.js': 합친.replace('const v9 = 9;', 'const v9 = 99;') });
  await assert.rejects(합침(api, s, 'h2', 첫), /합침만으로 잇지 못한다 — 지금 판이 앞 검수 판 ⊕ origin 판의 깨끗한 합침과 다르다\(손 고침[^)]*\): src\/a\.js.*--함께올림/);
  assert.equal(fs.existsSync(s.폴더('h2')), false, '거절하면 묶음을 만들지 않는다');
  s.쓰기({ 'src/a.js': 합친 });
  // 앞 검수에 없던 새 파일(범위 밖)
  s.쓰기({ 'src/new.js': 'export const x = 1;\n' });
  await assert.rejects(합침(api, s, 'h3', 첫), /깨끗한 합침과 다르다.*src\/new\.js/);
  fs.rmSync(path.join(s.나, 'src/new.js'));
  // 앞 검수에 없던 파일을 고침(범위 밖)
  s.쓰기({ 'src/b.js': 판({ 4: 'const b4 = "몰래";' }, 'b') });
  await assert.rejects(합침(api, s, 'h4', 첫), /깨끗한 합침과 다르다.*src\/b\.js/);
  s.g(s.나, 'checkout', '--', 'src/b.js');
  // 손을 대지 않은 판은 그대로 잇는다
  assert.equal((await 합침(api, s, 'h5', 첫)).목록.합침.모양, '안 올림');
});

test('충돌: 남의 커밋과 같은 줄을 바꿔 rebase 충돌을 손으로 푼 판은 거절한다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'c1');
  s.남올림({ 'src/a.js': 판({ 3: 'const v3 = "남";' }) }, 'fix(남): 같은 줄');
  s.g(s.나, 'commit', '-qam', 'wip');
  assert.throws(() => s.g(s.나, 'pull', '-q', '--rebase'), '같은 줄이라 rebase가 멈춘다');
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션 + 남";' }) });
  s.g(s.나, 'add', 'src/a.js'); s.g(s.나, '-c', 'core.editor=true', 'rebase', '--continue');
  await assert.rejects(합침(api, s, 'c2', 첫), /합침만으로 잇지 못한다 — 앞 검수 판의 고침이 origin에 있는데 그 고침만 담은 커밋을 찾지 못했다[^/]*origin과 합치면 충돌: src\/a\.js/);
});

test('덧고침: 검수한 고침과 같은 커밋에 검수 안 받은 줄을 섞어 올린 판은 남의 커밋이 뒤에 올라도 거절한다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'x1');
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "검수 안 받은 덧고침";' }) });
  s.g(s.나, 'commit', '-qam', 'feat: 이 세션 고침'); s.g(s.나, 'push', '-q', 'origin', 'master');
  s.남올림({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "검수 안 받은 덧고침";', 15: 'const v15 = "남";' }) }, 'fix(남): 15번째 줄');
  s.g(s.나, 'pull', '-q', '--ff-only');
  await assert.rejects(합침(api, s, 'x2', 첫), /그 고침만 담은 커밋을 찾지 못했다 — 덧고침이 같이 올라갔거나 나눠 올렸다/);
  // 덧고침이 없는 다른 경로(시험 파일)만 같은 커밋에 섞여도 마찬가지다
  const s2 = 세판(t);
  s2.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const y1 = await 검수(api, s2, 'y1');
  s2.쓰기({ 'src/b.js': 판({ 4: 'const b4 = "덧";' }, 'b') });
  s2.g(s2.나, 'commit', '-qam', 'feat: 이 세션 고침 + 덧'); s2.g(s2.나, 'push', '-q', 'origin', 'master');
  s2.남올림({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 15: 'const v15 = "남";' }), 'src/b.js': 판({ 4: 'const b4 = "덧";' }, 'b') }, 'fix(남)');
  s2.g(s2.나, 'pull', '-q', '--ff-only');
  await assert.rejects(합침(api, s2, 'y2', y1), /그 고침만 담은 커밋을 찾지 못했다/);
  // 검수한 고침 일부(3번 줄)를 덧고침(9번 줄)과 함께 먼저 올리고 나머지(15번 줄)를 따로 올리면, 둘째 커밋은 나르개가 아니다 —
  // 그 부모에 이 사슬 고침이 이미 일부 있다(GPT 검수 GA1)
  const s3 = 세판(t);
  s3.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 15: 'const v15 = "이 세션";' }) });
  const w1 = await 검수(api, s3, 'w1');
  s3.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "덧고침";' }) });
  s3.g(s3.나, 'commit', '-qam', '나눠 올림 1'); s3.g(s3.나, 'push', '-q', 'origin', 'master');
  s3.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "덧고침";', 15: 'const v15 = "이 세션";' }) });
  s3.g(s3.나, 'commit', '-qam', '나눠 올림 2'); s3.g(s3.나, 'push', '-q', 'origin', 'master');
  await assert.rejects(합침(api, s3, 'w2', w1), /그 고침만 담은 커밋을 찾지 못했다 — 덧고침이 같이 올라갔거나 나눠 올렸다/);
});

test('커밋 제목: 제어 문자로 꾸민 제목이 범위 밖 로컬 커밋을 나르개로 끼워 넣지 못하고, 기록의 제목은 제어 문자를 지운다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'e1');
  // 검수한 판 그대로의 로컬 커밋 C(origin에 없음)를 남겨 두고, 덧고침을 더한 판을 C의 이름을 담은 꾸민 제목으로 올린다(GPT 검수 GA3)
  s.g(s.나, 'commit', '-qam', '검수한 판');
  const C = s.g(s.나, 'rev-parse', 'HEAD').trim();
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 9: 'const v9 = "덧고침";' }) });
  const 메시지 = path.join(s.뿌리, 'msg.txt');
  fs.writeFileSync(메시지, `꾸민 제목\x1e${C}\x1f${s.바탕}\x1f가짜\n`);
  s.g(s.나, 'commit', '-qa', '--amend', '-F', 메시지); s.g(s.나, 'push', '-q', 'origin', 'master');
  await assert.rejects(합침(api, s, 'e2', 첫), /그 고침만 담은 커밋을 찾지 못했다/);
  // 남의 커밋 제목의 제어 문자는 기록에서 빈칸이 된다(판정에는 쓰지 않는다)
  const s2 = 세판(t);
  s2.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const f1 = await 검수(api, s2, 'f1');
  fs.writeFileSync(path.join(s2.뿌리, 'msg.txt'), 'fix(남):\x1f15번째\x1e줄\n');
  s2.g(s2.남, 'pull', '-q', '--ff-only'); fs.writeFileSync(path.join(s2.남, 'src/a.js'), 판({ 15: 'const v15 = "남";' }));
  s2.g(s2.남, 'commit', '-qa', '-F', path.join(s2.뿌리, 'msg.txt')); s2.g(s2.남, 'push', '-q', 'origin', 'master');
  s2.g(s2.나, 'commit', '-qam', 'wip'); s2.g(s2.나, 'pull', '-q', '--rebase');
  const r = await 합침(api, s2, 'f2', f1);
  assert.deepEqual(r.목록.합침.커밋들.map(c => c.제목), ['fix(남): 15번째 줄']);
  assert.equal(api.검수확인(r.폴더).통과, true);
});

test('머리 커밋: 합침은 증명과 검수 묶음 글에 함께 묶인 머리만 쓴다 — 증명 밖 머리커밋 칸 · 증명의 머리만 바꿔도 흔들리지 않고, 머리 줄 전에 만든 옛 묶음은 받지 않는다', async t => {
  const api = await tool(), 증 = await 증명도구(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'r1');
  const 목록파일 = path.join(첫, '묶음.json'), 원래 = fs.readFileSync(목록파일), 첫목록 = JSON.parse(원래);
  assert.equal(첫목록.증명.머리, s.바탕, '준비 증명에 그 판이 선 커밋이 묶인다');
  assert.ok(fs.readFileSync(path.join(첫, '묶음-A.txt'), 'utf8').includes(`\n머리 커밋: ${s.바탕}\n\n## 이번 변경\n`), '검수자가 읽는 묶음 글 머리말에도(GPT 다시 검수 GA4)');
  assert.equal(읽기(path.join(첫, '페이블자료.json')).증명.머리, s.바탕, 'Fable 최종 증명에도');
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  // 증명 밖 머리커밋 칸을 남의 커밋으로 바꿔 둘의 바탕을 옮기려 해도(GPT 검수 GA2) 증명의 머리를 쓴다
  fs.writeFileSync(목록파일, JSON.stringify({ ...첫목록, 머리커밋: { 커밋: s.g(s.나, 'rev-parse', 'origin/master').trim(), 제목: '바꿔치기' } }));
  const r = await 합침(api, s, 'r2', 첫);
  assert.equal(r.목록.합침.앞머리, s.바탕); assert.equal(r.목록.합침.바탕, s.바탕); assert.equal(r.목록.증명.머리, r.목록.합침.지금머리);
  assert.equal(api.검수확인(r.폴더).통과, true);
  // 증명의 머리만 지우거나 바꾸고 증명 해시를 다시 맞춰도, 검수자가 읽은 묶음 글의 머리 줄과 달라 확인 · 합침이 막힌다(GPT 다시 검수 GA4)
  for (const [이름, 바꿈] of [['r3', b => { delete b.머리; }], ['r4', b => { b.머리 = s.g(s.나, 'rev-parse', 'origin/master').trim(); }]]) {
    const { 검토입력해시, 표식, ...body } = 첫목록.증명;
    바꿈(body);
    fs.writeFileSync(목록파일, JSON.stringify({ ...첫목록, 증명: 증.입력증명(body) }));
    assert.match(api.검수확인(첫).사유.join(' / '), /검수 묶음 글에 적힌 머리 커밋이 증명의 머리 커밋과 다르다/, 이름);
    await assert.rejects(합침(api, s, 이름, 첫), /아직 끝나지 않았다 — .*검수 묶음 글에 적힌 머리 커밋이 증명의 머리 커밋과 다르다/);
  }
  fs.writeFileSync(목록파일, 원래);
  assert.equal(api.검수확인(r.폴더).통과, true, '되돌리면 r2 사슬이 다시 통과한다');
  // 옛 묶음(머리 줄 전 — 증명 · 묶음 글 둘 다 머리 없음): 확인은 그대로 통과하고, 합침만은 받지 않는다
  const s2 = 세판(t);
  s2.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 옛 = await api.준비하기({ 이름: 'r9', 폴더: s2.폴더('r9'), 저장소: s2.나, 종류: '백엔드', 바탕: s2.바탕, 경로: ['src'] });
  for (const b of 옛.목록.묶음) {
    const f = path.join(옛.폴더, b.파일), 글 = fs.readFileSync(f, 'utf8').replace(/\n머리 커밋: [0-9a-f]+(?=\n\n## 이번 변경\n)/, '');
    fs.writeFileSync(f, 글); b.sha256 = 증.sha256(Buffer.from(글, 'utf8')); b.바이트 = Buffer.byteLength(글);
  }
  { const { 검토입력해시, 표식, 머리, ...body } = 옛.목록.증명; 옛.목록.증명 = 증.입력증명({ ...body, 항목: 옛.목록.묶음.map(b => b.sha256) }); }
  fs.writeFileSync(path.join(옛.폴더, '묶음.json'), JSON.stringify(옛.목록));
  await api.GPT보내기(옛.폴더, 옛.목록, { call: 답하기(), 몫: 몫충분 });
  assert.deepEqual(api.검수확인(옛.폴더).사유, [], '옛 묶음은 확인이 그대로 통과한다');
  s2.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s2.g(s2.나, 'commit', '-qam', 'wip'); s2.g(s2.나, 'pull', '-q', '--rebase');
  await assert.rejects(합침(api, s2, 'r10', 옛.폴더), /머리 커밋이 증명과 검수 묶음 글에 함께 묶여 있지 않다\(합침만 전에 만든 묶음\) — 이번 한 번은 고친 diff를 다시 검수하면/);
});

test('묶인 머리: 묶음 글 머리말의 「머리 커밋:」 줄이 묶음마다 하나씩 증명과 같을 때만 머리를 쓰고, 줄이 없으면(옛 묶음) 쓰지 않는다', async () => {
  const { 묶인머리 } = await tool();
  const H = 'a'.repeat(40), X = 'b'.repeat(40);
  const 글 = 머리 => `규칙\n\n검수 정책: {}\n소스 스냅샷: x${머리 ? `\n머리 커밋: ${머리}` : ''}\n\n## 이번 변경\n배경\n머리 커밋: ${X}\n\n## 이 묶음의 자료\n머리 커밋: ${X}\n`;
  assert.deepEqual(묶인머리([글(H), 글(H)], H), { 머리: H, 사유: [] });
  assert.deepEqual(묶인머리([글(null)], H), { 머리: null, 사유: [] }, '옛 묶음 — 배경 · 자료 칸의 같은 글은 세지 않는다');
  assert.deepEqual(묶인머리([글(null)], null), { 머리: null, 사유: [] });
  assert.equal(묶인머리([글(H)], X).사유.length, 1, '증명과 다른 머리');
  assert.equal(묶인머리([글(H)], null).사유.length, 1, '줄은 있는데 증명에 머리가 없음');
  assert.equal(묶인머리([글(H), 글(null)], H).사유.length, 1, '묶음마다 하나씩');
  assert.equal(묶인머리([글(H).replace('\n\n## 이번 변경', `\n머리 커밋: ${H}\n\n## 이번 변경`)], H).사유.length, 1, '머리말에 둘이면 받지 않는다');
});

test('닻: 합침만은 마지막 검수 고리를 만든 작업본에서만 받는다 — 다른 작업본에서는 검수 고리 이름을 바로 주든 합침 고리를 주든 거절한다(Fable v3 설계 검토 P1 · GPT 셋째 GA1)', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'j1');
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남): 15번째 줄');
  s.g(s.나, 'commit', '-qam', 'wip: 이 세션'); s.g(s.나, 'pull', '-q', '--rebase');
  // 같은 git의 다른 작업본(옆) — 이 작업본에서 갈라진 합침 고리를 만들 수 있으면, 그 작업본이 올린 커밋은 검수 고리 이름을 바로 준 합침만이 읽지 않는다
  const 옆 = path.join(s.뿌리, 'me-side');
  s.g(s.나, 'worktree', 'add', '-q', '-b', 'side', 옆, 'HEAD');
  const 닻글 = /합침만은 마지막 검수 고리 j1를 만든 작업본\([^)]*\)에서만 잇는다 — 이 작업본에서는 고친 diff를 다시 검수하면\(node tools\/검수묶음\.mjs 다시 <새 이름> --앞 j1 --함께올림/;
  await assert.rejects(api.다시하기({ 이름: 'j2', 폴더: s.폴더('j2'), 앞: 첫, 저장소: 옆, 합침만: true }), 닻글);
  assert.equal(fs.existsSync(s.폴더('j2')), false, '거절하면 묶음을 만들지 않는다');
  // 검수 고리를 만든 작업본(나)에서는 잇고, 그 합침 고리 이름을 주어 옆에서 이어도(j1로 건너뜀) 같은 닻으로 거절한다
  const 합 = await 합침(api, s, 'j3', 첫);
  assert.equal(합.목록.합침.모양, '안 올림'); assert.deepEqual(합.목록.합침.올림장부, [path.resolve(s.나).split(path.sep).join('/')]);
  await assert.rejects(api.다시하기({ 이름: 'j4', 폴더: s.폴더('j4'), 앞: 합.폴더, 저장소: 옆, 합침만: true }), 닻글);
  // 검수 고리를 만든 작업본이 없어졌으면 그 고리 뒤로는 어디서도 합침만을 받지 않는다
  const 목록파일 = path.join(첫, '묶음.json'), 원래 = fs.readFileSync(목록파일);
  fs.writeFileSync(목록파일, JSON.stringify({ ...JSON.parse(원래), 저장소: path.join(s.뿌리, 'gone') }));
  await assert.rejects(합침(api, s, 'j5', 첫), /에서만 잇는다 — 그 작업본이 없다/);
  fs.writeFileSync(목록파일, 원래);
  // 건너뛸 합침 고리가 다른 작업본에서 만들어졌으면(닻 전 판 · 손댄 기록) 그 작업본 장부를 못 읽으니 닻 작업본에서도 거절한다(GPT 넷째 검수 GA1)
  const 합목록 = path.join(합.폴더, '묶음.json'), 합원래 = fs.readFileSync(합목록);
  fs.writeFileSync(합목록, JSON.stringify({ ...JSON.parse(합원래), 저장소: path.resolve(옆) }));
  await assert.rejects(합침(api, s, 'j6', 합.폴더), /건너뛴 합침 고리 j3가 마지막 검수 고리 j1의 작업본이 아닌 곳\(또는 없어진 작업본\)에서 만들어졌다/);
  fs.writeFileSync(합목록, 합원래);
});

test('올림 장부 줄바꿈 지킴: 앞 기록이 쓰다 잘렸으면 줄바꿈부터 넣어 다음 기록을 삼키지 않고, 잘린 줄은 지울 때까지 합침만을 막는다(Fable v3 설계 검토)', () => {
  const 장부 = require(path.join(root, 'tools/lib/올림장부.cjs'));
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ledger-'));
  try {
    const H = 'a'.repeat(40), X = 'b'.repeat(40), 파일 = path.join(d, 장부.파일이름);
    fs.writeFileSync(파일, `${JSON.stringify({ 커밋: H })}\n{"때":"잘린 줄`);
    장부.적기(d, [X], { 바탕: H, 원격: 'origin', 가지: 'master' });
    assert.deepEqual(장부.읽기(d), { 커밋들: [H], 못읽음: [`${장부.파일이름} 깨진 줄`] }, '잘린 줄은 못읽음 — 합침만이 거절한다');
    fs.writeFileSync(파일, fs.readFileSync(파일, 'utf8').split('\n').filter(줄 => !줄.includes('잘린 줄')).join('\n'));
    assert.deepEqual(장부.읽기(d), { 커밋들: [H, X], 못읽음: [] }, '잘린 줄을 지우면 다음 기록은 그대로 남아 있다');
    assert.throws(() => 장부.적기(d, ['nope']), /커밋 이름 꼴이 아니다/);
    // 일부만 쓰고 돌아와도 이어 써서 끝까지 적고, 더 못 쓰면 던진다 — push를 막는다(GPT 장부 검수 GA1). 바꿔 끼운 쓰기는 이 동기 구간 안에서만 산다
    const Y = 'c'.repeat(40), 원래쓰기 = fs.writeSync;
    try {
      let 처음 = true;
      fs.writeSync = (fd, buf, off, len) => { if (처음) { 처음 = false; return 원래쓰기(fd, buf, off, Math.min(len, 10)); } return 원래쓰기(fd, buf, off, len); };
      장부.적기(d, [Y]);
      assert.equal(처음, false, '바꿔 끼운 쓰기를 거쳤다');
      assert.deepEqual(장부.읽기(d), { 커밋들: [H, X, Y], 못읽음: [] });
      fs.writeSync = () => 0;
      assert.throws(() => 장부.적기(d, [Y]), /올림 장부를 끝까지 쓰지 못했다\(0\/\d+바이트\)/);
    } finally { fs.writeSync = 원래쓰기; }
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('경로 이름이 커밋 이름과 같아도: 커밋마다 바꾼 경로를 git 경로 거르기로 가려 자기 커밋을 놓치지 않는다(GPT 다시 검수 GA2)', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'i1');
  const 남커밋 = s.남올림({ 'docs/c.md': '# 문서 2\n' }, 'docs(남)');
  // 검수한 고침은 로컬에 두고, 남의 커밋 이름과 같은 이름의 파일과 사슬 파일 한 줄을 한 커밋으로 따로 올린다 — 옛 log -z 읽기는 이 파일 이름을 커밋 경계로 읽었다
  s.g(s.나, 'stash', 'push', '-q', '-m', '검수한 고침');
  s.g(s.나, 'pull', '-q', '--ff-only');
  fs.writeFileSync(path.join(s.나, 남커밋), '이름이 커밋과 같은 파일\n');
  s.쓰기({ 'src/a.js': 판({ 9: 'const v9 = "따로";' }) });
  s.g(s.나, 'add', '-A');
  s.나올림('fix: 줄 9');
  s.g(s.나, 'stash', 'pop', '-q');
  await assert.rejects(합침(api, s, 'i2', 첫), /이 작업본이 올린 커밋이 이 사슬 파일을 바꿨다\(검수 안 받은 고침\): [0-9a-f]{10} fix: 줄 9/);
});

test('올림 장부를 못 읽으면: 장부가 폴더이거나 깨진 줄이 있으면 자기 커밋을 가를 수 없어 거절하고, 빈 줄은 넘긴다(GPT 다시 검수 GA3)', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'l1');
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  const 장부 = path.join(s.나, '.git', '바로올리기-올림.jsonl');
  fs.mkdirSync(장부);
  await assert.rejects(합침(api, s, 'l2', 첫), /올림 장부를 읽지 못해 .*가를 수 없다: .*\(바로올리기-올림\.jsonl E[A-Z]+\)/);
  fs.rmdirSync(장부);
  fs.writeFileSync(장부, '{"커밋":"0123"}\n');
  await assert.rejects(합침(api, s, 'l3', 첫), /올림 장부를 읽지 못해 .*\(바로올리기-올림\.jsonl 깨진 줄\)/);
  fs.writeFileSync(장부, `\n${JSON.stringify({ 커밋: 'a'.repeat(40) })}\r\n\n`);
  assert.equal((await 합침(api, s, 'l4', 첫)).목록.합침.모양, '안 올림');
});

test('앞 판 스냅샷 변조: 만들 때 앞 검수 판 바이트를 못 찾으면 멈추고, 만든 뒤 바뀌면 확인이 다시 돌린 대조에서 막는다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'z1');
  const 앞 = 읽기(path.join(첫, '묶음.json')).증명.파일.find(f => f.경로 === 'src/a.js');
  const 보관 = path.join(첫, '내용', 앞.sha256), 원래 = fs.readFileSync(보관);
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  fs.writeFileSync(보관, 판({ 3: 'const v3 = "바꿔치기";' }));
  await assert.rejects(합침(api, s, 'z2', 첫), /앞 판 내용을 찾지 못했다: src\/a\.js/);
  fs.writeFileSync(보관, 원래);
  const { 폴더 } = await 합침(api, s, 'z3', 첫);
  assert.equal(api.검수확인(폴더).통과, true);
  fs.writeFileSync(보관, 판({ 3: 'const v3 = "바꿔치기";' }));
  assert.match(api.검수확인(폴더).사유.join(' / '), /z3: 합침 대조를 다시 돌리지 못했다: 앞 판 내용을 찾지 못했다: src\/a\.js/);
  fs.writeFileSync(보관, 원래);
  assert.equal(api.검수확인(폴더).통과, true);
});

test('기록 고침: 합침 고리의 모양 · origin · 지금 판을 고쳐 증명 해시를 다시 맞춰도 확인이 다시 돌린 대조에서 막는다', async t => {
  const api = await tool(), 증 = await 증명도구(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'k1');
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  const { 폴더 } = await 합침(api, s, 'k2', 첫);
  const 목록파일 = path.join(폴더, '묶음.json'), 원래 = fs.readFileSync(목록파일);
  const 고쳐쓰기 = 고침 => {
    const 목록 = JSON.parse(원래), { 검토입력해시, 표식, ...body } = 목록.증명;
    고침(body); 목록.합침 = body.합침; body.자료해시 = 증.정규해시(body.합침); 목록.증명 = 증.다시증명(body);
    fs.writeFileSync(목록파일, JSON.stringify(목록));
  };
  고쳐쓰기(b => { b.합침.모양 = '앞 판 그대로'; });
  assert.match(api.검수확인(폴더).사유.join(' / '), /합침 대조를 다시 돌린 결과가 기록과 다르다/);
  고쳐쓰기(b => { b.합침.커밋들 = []; });
  assert.match(api.검수확인(폴더).사유.join(' / '), /합침 대조를 다시 돌린 결과가 기록과 다르다/, '합친 커밋 목록을 지워도 잡는다');
  고쳐쓰기(b => { b.합침.origin = s.바탕; });
  assert.equal(api.검수확인(폴더).통과, false, 'origin을 바꾸면 지금 판이 그 합침과 다르다');
  고쳐쓰기(b => { b.합침.앞머리 = s.g(s.나, 'rev-parse', 'HEAD').trim(); });
  assert.match(api.검수확인(폴더).사유.join(' / '), /앞머리가 앞 k1의 증명에 묶인 머리 커밋과 다르다/);
  고쳐쓰기(b => { b.머리 = s.바탕; });
  assert.match(api.검수확인(폴더).사유.join(' / '), /합침 고리의 머리 커밋이 합침 기록의 지금 머리와 다르다/);
  // 지적을 지적표에 끼우거나 갈래만 바꾸면 막는다
  fs.writeFileSync(목록파일, 원래);
  fs.writeFileSync(path.join(폴더, '지적표.json'), JSON.stringify({ 이름: 'k2', 지적: [{ 번호: 'A1', 출처: 'GPT', 등급: 'P2', 위치: 'src/a.js:1', 인용: '', 문제: 'x', 방향: '' }] }));
  assert.match(api.검수확인(폴더).사유.join(' / '), /합침 고리 지적표에 지적이 있다/);
  fs.writeFileSync(path.join(폴더, '지적표.json'), JSON.stringify({ 이름: 'k2', 지적: [] }));
  fs.writeFileSync(목록파일, JSON.stringify({ ...JSON.parse(원래), 갈래: '델타' }));
  assert.match(api.검수확인(폴더).사유.join(' / '), /묶음 갈래와 증명이 맞지 않는다/);
  fs.writeFileSync(목록파일, 원래);
  assert.equal(api.검수확인(폴더).통과, true);
});

test('막는 때: 고친 P0·P1이 남은 앞 검수 · 같이 못 쓰는 옵션 · 바뀐 것 없음 · synk.im 후보 바이트가 바뀐 판', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'b1', { 지적: [지적하나('src/a.js:4')] });
  api.지적표고치기(첫, 표 => api.처리하기(표, ['GA1=반영']));
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";', 6: 'const v6 = "고침";' }) });
  await assert.rejects(합침(api, s, 'b2', 첫), /고친 P0·P1\(GA1\)이 있다 — 고친 diff는 합침만으로 잇지 않고 다시 검수한다/);
  await assert.rejects(합침(api, s, 'b3', 첫, { 함께올림: '까닭' }), /--합침만과 함께 쓰지 않는 옵션이다: --함께올림 — /);
  await assert.rejects(합침(api, s, 'b4', 첫, { 시험: ['tests/x.test.js'] }), /--합침만과 함께 쓰지 않는 옵션이다: --시험 — /);
  // 고친 뒤 다시 검수하면 그 고리부터는 합침만으로 이을 수 있다
  const 다시 = await api.다시하기({ 이름: 'b5', 폴더: s.폴더('b5'), 앞: 첫, 저장소: s.나 });
  await api.GPT보내기(다시.폴더, 다시.목록, { call: 다시답하기(), 몫: 몫충분 });
  assert.equal(api.검수확인(다시.폴더).통과, true);
  await assert.rejects(합침(api, s, 'b6', 다시.폴더), /다시 볼 것이 없다/);
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  const 이은 = await 합침(api, s, 'b7', 다시.폴더);
  assert.deepEqual(api.검수확인(이은.폴더).증명.사슬, ['b1', 'b5', 'b7']);
  // synk.im 화면 후보: 공개 트리 바탕 · origin 판이 이 저장소에 없어 후보 바이트가 바뀐 판은 대조하지 못한다
  const 후보 = (이름, 글) => { const d = path.join(s.뿌리, 이름); fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'index.html'), 글);
    fs.writeFileSync(path.join(d, '후보.json'), JSON.stringify({ 판: 1, 종류: 'synk.im', 항목: [{ 경로: 'index.html', 종류: '바꿈', sha256: require('node:crypto').createHash('sha256').update(글).digest('hex'), 모드: '100644' }] })); return d; };
  const 화면 = await api.준비하기({ 이름: 's1', 폴더: s.폴더('s1'), 저장소: s.나, 종류: '화면', 바탕: s.바탕, 경로: ['src'], 배포후보: 후보('cand1', '<p>1</p>\n'), 페이블생략: '글만 바꿈' });
  await api.아르곤보내기(화면.폴더, 화면.목록, { call: 답하기(), 몫: 몫충분 });
  assert.equal(api.검수확인(화면.폴더).통과, true);
  await assert.rejects(합침(api, s, 's2', 화면.폴더, { 배포후보: 후보('cand2', '<p>2</p>\n') }), /배포 후보\(synk\.im\) 바이트가 바뀐 판은 합침만으로 잇지 않는다/);
});

test('합침 고리 뒤: 진짜 고침은 다시로 잇고(앞 판 = 합침 판), 합침 고리에서는 검수자 명령을 받지 않는다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'n1');
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  const 합 = await 합침(api, s, 'n2', 첫);
  // CLI: 합침 고리에서 검수자 · 처리 명령은 멈추고, 집계는 기계 대조를 적는다
  const cli = (...a) => { try { return { code: 0, out: execFileSync(process.execPath, [path.join(root, 'tools/검수묶음.mjs'), ...a], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: `${e.stdout}${e.stderr}` }; } };
  for (const 명령 of ['GPT', '카본', '처리', '페이블', '검수받기']) {
    const x = cli(명령, 합.폴더, ...(명령 === '처리' ? ['A1=반영'] : []));
    assert.equal(x.code, 2, 명령); assert.match(x.out, /합침 고리다 — 검수자를 부르지 않는 기계 대조라/);
  }
  const 집 = cli('집계', 합.폴더, '--저장소', s.나);
  assert.equal(집.code, 0, 집.out); assert.match(집.out, /검수자 없음 — 기계 대조: 앞 「n1」/);
  assert.match(fs.readFileSync(path.join(합.폴더, '보고.md'), 'utf8'), /## 합친 origin 커밋\n\n- [0-9a-f]{10} fix\(남\)/);
  // 진짜 고침은 다시로 — 앞 판은 합침 판이라 남의 줄은 diff에 없다
  const 지금 = fs.readFileSync(path.join(s.나, 'src/a.js'), 'utf8');
  s.쓰기({ 'src/a.js': 지금.replace('const v7 = 7;', 'const v7 = "고침";') });
  assert.match(cli('집계', 합.폴더, '--저장소', s.나).out, /미충족 — 검수 뒤 파일 변경: src\/a\.js/);
  const 다시 = await api.다시하기({ 이름: 'n3', 폴더: s.폴더('n3'), 앞: 합.폴더, 저장소: s.나, 함께올림: 'P2 고침을 함께 올린다' });
  const 글 = fs.readFileSync(path.join(다시.폴더, '묶음-A.txt'), 'utf8');
  assert.match(글, /-const v7 = 7;\n\+const v7 = "고침";/); assert.doesNotMatch(글, /v15 = "남"/, '합침 판을 앞 판으로 견주어 남의 줄은 diff에 없다');
  assert.match(api.검수확인(다시.폴더).사유.join(' / '), /다시 검수 GPT 미완료/);
  await api.GPT보내기(다시.폴더, 다시.목록, { call: 다시답하기(), 몫: 몫충분 });
  const r = api.검수확인(다시.폴더);
  assert.deepEqual(r.사유, []); assert.deepEqual(r.증명.사슬, ['n1', 'n2', 'n3']);
  // 다시 고리의 머리도 검수자가 읽은 묶음 글 머리말에 묶인다 — 증명의 머리만 바꿔 해시를 다시 맞추면 막는다(GPT 다시 검수 GA4)
  assert.ok(글.includes(`\n머리 커밋: ${s.g(s.나, 'rev-parse', 'HEAD').trim()}\n\n## 이번 변경\n`));
  const 증 = await 증명도구(), 목록파일 = path.join(다시.폴더, '묶음.json'), 원래 = fs.readFileSync(목록파일), 목록 = JSON.parse(원래), { 검토입력해시, 표식, ...body } = 목록.증명;
  fs.writeFileSync(목록파일, JSON.stringify({ ...목록, 증명: 증.다시증명({ ...body, 머리: s.바탕 }) }));
  assert.match(api.검수확인(다시.폴더).사유.join(' / '), /검수 묶음 글에 적힌 머리 커밋이 증명의 머리 커밋과 다르다/);
  fs.writeFileSync(목록파일, 원래);
  assert.equal(api.검수확인(다시.폴더).통과, true);
});

test('GPT 작성 사슬: 처음 검수(GPT · Claude) 뒤 합침 고리는 그대로 닫히고, GPT만 본 다시 뒤의 합침 고리는 끝 판을 요구한다', async t => {
  const api = await tool(), s = 세판(t);
  const 클로드 = async (폴더, 목록, 답) => { for (const b of 목록.묶음) api.검수받기(폴더, 'Claude', b.이름, (await 답({ prompt: fs.readFileSync(path.join(폴더, b.파일), 'utf8') })).text); };
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "GPT 작성";' }) });
  const x = await api.준비하기({ 이름: 'g1', 폴더: s.폴더('g1'), 저장소: s.나, 종류: '백엔드', 작성자: 'GPT', 바탕: s.바탕, 경로: ['src'] });
  await api.GPT보내기(x.폴더, x.목록, { call: 답하기([지적하나('src/a.js:4')]), 몫: 몫충분 });
  await 클로드(x.폴더, x.목록, 답하기());
  api.지적표고치기(x.폴더, 표 => api.처리하기(표, ['GA1=반영']));
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "GPT 작성";', 6: 'const v6 = "고침";' }) });
  const y = await api.다시하기({ 이름: 'g2', 폴더: s.폴더('g2'), 앞: x.폴더, 저장소: s.나 });
  await api.GPT보내기(y.폴더, y.목록, { call: 다시답하기(), 몫: 몫충분 });
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  const z = await 합침(api, s, 'g3', y.폴더);
  assert.match(api.검수확인(z.폴더).사유.join(' / '), /끝 판을 Claude가 아직 보지 않았다 — node tools\/검수묶음\.mjs 다시 <새 이름> --앞 g3 --끝판/, '합침 고리는 끝 판이 아니다');
  const w = await api.다시하기({ 이름: 'g4', 폴더: s.폴더('g4'), 앞: z.폴더, 저장소: s.나, 끝판: true });
  assert.deepEqual(w.목록.검수자들, ['GPT', 'Claude']);
  assert.match(fs.readFileSync(path.join(w.폴더, '묶음-A.txt'), 'utf8'), /\+const v6 = "고침";/, '끝 판은 Claude가 마지막으로 본 g1부터 쌓인 diff');
  await api.GPT보내기(w.폴더, w.목록, { call: 다시답하기(), 몫: 몫충분 });
  await 클로드(w.폴더, w.목록, 다시답하기());
  assert.deepEqual(api.검수확인(w.폴더).사유, []);
  // 처음 검수만 받은 GPT 작성 사슬(Claude가 본 판) 뒤 합침 고리는 그대로 닫힌다
  const s2 = 세판(t);
  s2.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "GPT 작성";' }) });
  const p = await api.준비하기({ 이름: 'q1', 폴더: s2.폴더('q1'), 저장소: s2.나, 종류: '백엔드', 작성자: 'GPT', 바탕: s2.바탕, 경로: ['src'] });
  await api.GPT보내기(p.폴더, p.목록, { call: 답하기(), 몫: 몫충분 });
  await 클로드(p.폴더, p.목록, 답하기());
  s2.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  s2.g(s2.나, 'commit', '-qam', 'wip'); s2.g(s2.나, 'pull', '-q', '--rebase');
  assert.deepEqual(api.검수확인((await 합침(api, s2, 'q2', p.폴더)).폴더).사유, []);
});

test('Fable 최종 뒤: 화면 검수(카본 → Fable 최종) 사이에 origin을 따라갔어도, 그 뒤 남의 커밋만 합친 판은 Fable 최종 증명의 머리로 잇는다', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "화면";' }) });
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'v1', 폴더: s.폴더('v1'), 저장소: s.나, 종류: '화면', 바탕: s.바탕, 경로: ['src'] });
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: 몫충분 });
  // 카본 뒤 origin을 따라가고(다른 파일) Fable 최종 — 그 판의 머리는 준비 때 HEAD가 아니다
  s.남올림({ 'src/b.js': 판({ 2: 'const b2 = "남";' }, 'b') }, 'fix(남): b');
  s.g(s.나, 'pull', '-q', '--ff-only');
  await api.페이블하기(폴더, { 시험: false, 캡처: false });
  const { 증명 } = 읽기(path.join(폴더, '페이블자료.json'));
  assert.equal(증명.머리, s.g(s.나, 'rev-parse', 'HEAD').trim()); assert.notEqual(증명.머리, 목록.머리커밋.커밋);
  api.페이블받기(폴더, JSON.stringify({ findings: [], argonReview: [], coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, seen: 증명.항목, reviewInputHash: 증명.검토입력해시, endMarker: 증명.표식 }));
  assert.equal(api.검수확인(폴더).통과, true);
  s.남올림({ 'src/b.js': 판({ 2: 'const b2 = "남";' }, 'b'), 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남): a');
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'pull', '-q', '--rebase');
  const r = await 합침(api, s, 'v2', 폴더);
  assert.equal(r.목록.합침.모양, '안 올림'); assert.equal(r.목록.합침.앞머리, 증명.머리);
  assert.deepEqual(api.검수확인(r.폴더).사유, []);
});

test('합침 커밋 · 다른 작업본 · origin 없는 저장소 · 나중에 「반영」으로 바꾼 앞 지적', async t => {
  const api = await tool(), s = 세판(t);
  s.쓰기({ 'src/a.js': 판({ 3: 'const v3 = "이 세션";' }) });
  const 첫 = await 검수(api, s, 'g1', { 지적: [지적하나('src/a.js:4')] });
  api.지적표고치기(첫, 표 => api.처리하기(표, ['GA1=재현안됨:부르는 곳이 없다']));
  s.남올림({ 'src/a.js': 판({ 15: 'const v15 = "남";' }) }, 'fix(남)');
  // git merge로 합친 가지(안 올림) — 합침 커밋의 판도 깨끗한 합침과 같다
  s.g(s.나, 'commit', '-qam', 'wip'); s.g(s.나, 'fetch', '-q'); s.g(s.나, 'merge', '-q', '--no-edit', 'origin/master');
  const r = await 합침(api, s, 'g2', 첫);
  assert.equal(r.목록.합침.모양, '안 올림');
  // 같은 git 저장소의 다른 작업본에서 확인해도 대조가 다시 돈다
  const 딴곳 = path.join(s.뿌리, 'me2');
  s.g(s.나, 'worktree', 'add', '-q', '--detach', 딴곳, 'HEAD');
  assert.deepEqual(api.검수확인(r.폴더, { 저장소: 딴곳 }).사유, []);
  // 합침 고리 뒤에 앞 고리 지적을 「반영」으로 바꾸면, 고친 diff를 다시 본 검수가 없어 막힌다
  api.지적표고치기(첫, 표 => api.처리하기(표, ['GA1=반영']));
  assert.match(api.검수확인(r.폴더).사유.join(' / '), /GA1 P1 미해결 — 다음 다시 검수 g2가 이 지적을 다시 보지 않았다/);
  // origin/master 원격 참조가 없는 저장소는 합침만으로 잇지 못한다고 분명히 말한다
  const 홀로 = path.join(s.뿌리, 'solo');
  fs.mkdirSync(path.join(홀로, 'src'), { recursive: true });
  const h = (...a) => execFileSync('git', ['-C', 홀로, '-c', 'core.autocrlf=false', ...a], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  h('init', '-q', '-b', 'master'); fs.writeFileSync(path.join(홀로, 'src/a.js'), 판()); h('add', '-A'); h('commit', '-qm', '처음');
  fs.writeFileSync(path.join(홀로, 'src/a.js'), 판({ 3: 'const v3 = "홀로";' }));
  const 홀 = await api.준비하기({ 이름: 'o1', 폴더: path.join(s.뿌리, '검수', 'o1'), 저장소: 홀로, 종류: '백엔드', 바탕: 'HEAD', 경로: ['src'] });
  await api.GPT보내기(홀.폴더, 홀.목록, { call: 답하기(), 몫: 몫충분 });
  fs.writeFileSync(path.join(홀로, 'src/a.js'), 판({ 3: 'const v3 = "홀로";', 15: 'const v15 = "더";' }));
  await assert.rejects(api.다시하기({ 이름: 'o2', 폴더: path.join(s.뿌리, '검수', 'o2'), 앞: 홀.폴더, 저장소: 홀로, 합침만: true }), /지금 머리와 origin\/master을 git에서 읽지 못했다/);
});

test('3방향 합침: 같은 고침은 깨끗이 합쳐지지만 되돌리면 드러나고, 이웃한 줄 · 이진 · 있음/없음 엇갈림 · 모드 셋은 충돌이다', async () => {
  const { 판합침, sha256 } = await 증명도구();
  const v = (글, 모드 = '100644') => (글 === null ? { sha256: null, 모드: null, 바이트: null } : { sha256: sha256(Buffer.from(글)), 모드, 바이트: Buffer.from(글) });
  const y = v(판()), a = v(판({ 3: 'A' })), t = v(판({ 15: 'T' })), at = v(판({ 3: 'A', 15: 'T' }));
  assert.equal(판합침(a, y, t).판.sha256, at.sha256);
  assert.equal(판합침(판합침(a, y, t).판, a, y).판.sha256, t.sha256, '떨어진 고침은 되돌리면 정확히 origin');
  assert.equal(판합침(a, y, at).판.sha256, at.sha256, 'origin이 같은 고침을 이미 가지면 깨끗하다');
  assert.notEqual(판합침(판합침(a, y, at).판, a, y).판.sha256, at.sha256, '그러나 되돌리면 origin과 달라 「안 올림」이 아니다');
  assert.equal(판합침(a, y, v(판({ 4: 'T' }))).충돌, true, '이웃한 줄은 충돌');
  assert.equal(판합침(v('a\0b'), v('a\0c'), v('a\0d')).충돌, true, '이진 셋은 충돌');
  assert.equal(판합침(v(null), y, t).충돌, true, '이 세션이 지운 파일을 origin이 고침');
  assert.equal(판합침(v(null), y, y).판.sha256, null, '이 세션이 지우고 origin은 그대로 — 지움');
  assert.equal(판합침(v(판(), '100755'), y, t).판.모드, '100755', '모드는 따로 합친다');
  assert.equal(판합침(v(판({ 3: 'A' }), '100755'), y, v(판({ 15: 'T' }), '100700')).충돌, true, '모드 셋이 다 다르면 충돌');
});
});
