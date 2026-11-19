// 검수묶음 `페이블`이 끝이 커밋인 묶음에서도 고친 판을 본다(2026-11-19).
// atlas-redesign-stage4-me-final-20261119의 Fable F2: 묶음의 끝(8da8f76f7) 뒤에 고친 커밋(eabe1decc)이 있는데
// 페이블이 끝 커밋으로 diff · 해시 · 시험을 떠서 Fable 자료에 고침이 없었다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as api from '../tools/검수묶음.mjs';

const 뿌리저장소 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const 읽기 = (폴더, 이름) => fs.readFileSync(path.join(폴더, 이름), 'utf8');
const 페이블자료 = 폴더 => JSON.parse(읽기(폴더, '페이블자료.json'));

// 시험 git은 이 PC · CI의 전역 설정(autocrlf 등)을 읽지 않는다 — 검수 도구가 부르는 git도 같은 환경을 물려받는다.
for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-review-test-no-global-config'), GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid' });

const 시험파일 = "const test = require('node:test'); const assert = require('node:assert/strict');\ntest('값', () => assert.equal(require('node:fs').readFileSync('src/value.txt', 'utf8'), 'good\\n'));\n";

/** 바탕 → 끝 커밋(묶음을 준비한 판). 고친 커밋은 시험마다 그 위에 쌓는다. */
function 저장소(t) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-fable-end-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const repo = path.join(뿌리, 'repo');
  fs.mkdirSync(repo);
  const g = (...a) => execFileSync('git', ['-C', repo, '-c', 'core.autocrlf=false', ...a], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const 쓰기 = (p, v) => { const f = path.join(repo, ...p.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); };
  const 커밋 = (메시지, 파일 = {}) => { for (const [p, v] of Object.entries(파일)) 쓰기(p, v); g('add', '-A'); g('commit', '-q', '-m', 메시지); return g('rev-parse', 'HEAD').trim(); };
  g('init', '-q', '-b', 'main');
  const 바탕 = 커밋('바탕', { 'src/app.js': 'export const value = 1;\n', 'src/value.txt': 'bad\n', 'value.test.js': 시험파일, 'docs/note.md': '메모\n' });
  const 끝 = 커밋('묶음의 끝', { 'src/app.js': 'export const value = 2;\n' });
  return { 뿌리, repo, g, 쓰기, 커밋, 바탕, 끝, 폴더: path.join(뿌리, 'out') };
}
const 준비 = (r, 덧 = {}) => api.준비하기({ 이름: 'fable-end', 폴더: r.폴더, 저장소: r.repo, 종류: '백엔드', 바탕: r.바탕, 끝: r.끝, 경로: ['src'], ...덧 });
const 답하기 = () => async ({ prompt }) => {
  const 표식 = /자료 끝 표식: (\S+)\s*$/.exec(prompt)[1];
  const seen = [...prompt.matchAll(/^### \[([^\]]+)\]/gm)].map(m => m[1]);
  return { text: JSON.stringify({ findings: [], seen, coverage: { reviewed: '전부', limitations: '', complete: true, missing: [] }, endMarker: 표식 }) };
};
const final답 = 증명 => JSON.stringify({ findings: [], argonReview: [], coverage: { reviewed: '요구 파일 전체와 영향 범위', limitations: '', complete: true, missing: [] }, seen: 증명.항목, reviewInputHash: 증명.검토입력해시, endMarker: 증명.표식 });

test('끝이 커밋인 묶음: 끝 뒤에 고친 커밋이 fable.md의 diff · 해시 · 시험에 든다', async t => {
  const r = 저장소(t);
  const { 폴더, 목록 } = await 준비(r, { 시험: ['value.test.js'] });
  assert.equal(목록.끝.커밋, r.끝);
  assert.equal(목록.시험.실패, 1, '묶음의 끝에서는 시험이 실패한다');
  const 고침 = r.커밋('고친 판', { 'src/app.js': 'export const value = 3; // 고친 판\n', 'src/value.txt': 'good\n',
    'value.test.js': `${시험파일}test('고친 뒤 더한 시험', () => {});\n` });
  const fable = fs.readFileSync(await api.페이블하기(폴더, { 캡처: false }), 'utf8');
  const 자료 = 페이블자료(폴더), 해시 = 경로 => 자료.증명.파일.find(f => f.경로 === 경로)?.sha256;
  assert.match(읽기(폴더, 'diff.patch'), /\+export const value = 3; \/\/ 고친 판/, 'diff.patch에 고친 줄이 있다');
  assert.equal(해시('src/app.js'), sha('export const value = 3; // 고친 판\n'), '검토 항목 해시가 고친 판이다');
  assert.equal(해시('value.test.js'), sha(`${시험파일}test('고친 뒤 더한 시험', () => {});\n`), '시험 파일 해시도 고친 판이다');
  assert.equal(자료.증명.머리, 고침, '최종 증명의 머리는 자료를 뜬 끝이다');
  assert.equal(자료.시험.실패, 0); assert.equal(자료.시험.통과, 2, '시험은 고친 판에서 돈다');
  assert.deepEqual(자료.끝, { 커밋: 고침, 제목: '고친 판' });
  // fable.md 머리에 자료를 뜬 끝과 준비한 끝 뒤 커밋을 적는다
  const 머리 = fable.split('## 1단계')[0];
  assert.match(머리, new RegExp(`자료를 뜬 끝: \`${고침}\` \\(고친 판\\)`));
  assert.match(머리, new RegExp(`묶음을 준비한 끝 \`${r.끝.slice(0, 9)}\` 뒤 커밋 1개`));
  assert.match(머리, new RegExp(`- \`${고침.slice(0, 9)}\` 고친 판`));
  assert.match(fable, new RegExp(`→ 끝 ${고침.slice(0, 9)} \\(고친 판\\)`), '1단계의 끝도 자료를 뜬 끝이다');
  // 페이블받기는 새 증명의 입력 해시 · 끝 표식만 받는다
  assert.deepEqual(api.페이블받기(폴더, final답(자료.증명)), []);
});

test('화면 묶음: 고친 판으로 뜬 Fable 최종이 확인 · 배포 증명의 최종 파일이 된다', async t => {
  const r = 저장소(t);
  const { 폴더, 목록 } = await 준비(r, { 종류: '화면' });
  await api.아르곤보내기(폴더, 목록, { call: 답하기(), 몫: () => ({ 주간: 0.9 }) });
  const 옛 = 페이블자료(폴더).증명;
  r.커밋('고친 판', { 'src/app.js': 'export const value = 3;\n' });
  await api.페이블하기(폴더, { 시험: false, 캡처: false });
  const 지금 = 페이블자료(폴더).증명;
  assert.throws(() => api.페이블받기(폴더, final답(옛)), /최종 검토 입력 해시/);
  api.페이블받기(폴더, final답(지금));
  const 확인 = api.검수확인(폴더);
  assert.deepEqual(확인.사유, []);
  assert.equal(확인.증명.최종파일.find(f => f.경로 === 'src/app.js').sha256, sha('export const value = 3;\n'));
  r.커밋('Fable 뒤에 또 고침', { 'src/app.js': 'export const value = 4;\n' });
  assert.match(api.검수확인(폴더).사유.join(' / '), /검수 뒤 파일 변경: src\/app\.js/);
});

test('범위 파일에 커밋하지 않은 변경이 있으면 멈추고 자료를 덮지 않는다', async t => {
  const r = 저장소(t);
  const { 폴더 } = await 준비(r, { 시험: ['value.test.js'] });
  r.커밋('고친 판', { 'src/app.js': 'export const value = 3;\n' });
  const 앞 = 읽기(폴더, '페이블자료.json'), 앞fable = 읽기(폴더, 'fable.md');
  const 막힘 = async 까닭 => {
    await assert.rejects(api.페이블하기(폴더, { 시험: false, 캡처: false }), /커밋하지 않은 변경/, 까닭);
    assert.equal(읽기(폴더, '페이블자료.json'), 앞, `${까닭} — 페이블자료.json을 덮지 않는다`);
    assert.equal(읽기(폴더, 'fable.md'), 앞fable, `${까닭} — fable.md를 덮지 않는다`);
  };
  r.쓰기('src/app.js', 'export const value = 9;\n');
  await 막힘('바뀐 경로의 고침');
  r.g('checkout', '--', 'src/app.js');
  r.쓰기('src/새파일.js', 'export {};\n');
  await 막힘('추적 안 된 새 파일');
  fs.rmSync(path.join(r.repo, 'src', '새파일.js'));
  r.쓰기('value.test.js', `${시험파일}// 커밋 안 한 시험\n`);
  await 막힘('범위 밖 경로라도 스냅샷에 드는 시험 파일');
  r.g('checkout', '--', 'value.test.js');
  r.쓰기('src/app.js', 'export const value = 9;\n'); r.g('add', 'src/app.js');
  await 막힘('스테이징만 한 고침');
  r.g('reset', '-q', '--hard');
  r.쓰기('docs/note.md', '범위 밖 메모\n');
  await api.페이블하기(폴더, { 캡처: false });
  assert.equal(페이블자료(폴더).증명.파일.find(f => f.경로 === 'src/app.js').sha256, sha('export const value = 3;\n'), '범위 밖 미커밋 변경은 막지 않는다');
});

test('시험이 범위 파일을 고치면 멈춘다 — 끝이 커밋이면 스냅샷을 커밋에서 읽어 앞뒤 대조가 못 잡는다', async t => {
  const r = 저장소(t);
  const 끝 = r.커밋('표지가 있으면 파일을 고치는 시험', { 'race.test.js': "const fs = require('node:fs');\nif (fs.existsSync('race.flag')) fs.writeFileSync('src/app.js', 'export const value = 7;\\n');\n" });
  const { 폴더 } = await 준비(r, { 끝, 시험: ['race.test.js'] });
  r.커밋('고친 판', { 'src/app.js': 'export const value = 3;\n', 'race.flag': '' });
  const 앞 = 읽기(폴더, '페이블자료.json');
  await assert.rejects(api.페이블하기(폴더, { 캡처: false }), /페이블 중 범위 파일이 바뀌었다\(src\/app\.js\)/);
  assert.equal(읽기(폴더, '페이블자료.json'), 앞);
});

test('--끝 <커밋>: HEAD가 품은 커밋이고 범위 파일이 HEAD와 같을 때만 그 커밋으로 뜬다', async t => {
  const r = 저장소(t);
  const { 폴더 } = await 준비(r);
  const 고침 = r.커밋('고친 판', { 'src/app.js': 'export const value = 3;\n' });
  const 문서 = r.커밋('범위 밖 문서', { 'docs/note.md': '고친 뒤 메모\n' });
  await api.페이블하기(폴더, { 시험: false, 캡처: false, 끝: 고침 });
  let 자료 = 페이블자료(폴더);
  assert.equal(자료.증명.머리, 고침);
  assert.deepEqual(자료.끝, { 커밋: 고침, 제목: '고친 판' });
  assert.match(읽기(폴더, 'fable.md'), new RegExp(`자료를 뜬 끝: \`${고침}\``));
  // --끝 없이는 HEAD(범위 밖 커밋까지)로 뜬다 — 범위 파일은 같다
  await api.페이블하기(폴더, { 시험: false, 캡처: false });
  자료 = 페이블자료(폴더);
  assert.equal(자료.증명.머리, 문서);
  assert.equal(자료.증명.파일.find(f => f.경로 === 'src/app.js').sha256, sha('export const value = 3;\n'));
  // 범위 파일이 --끝 뒤에 또 바뀌면 시험과 Fable이 여는 작업본이 그 끝과 다르다
  r.커밋('또 고침', { 'src/app.js': 'export const value = 4;\n' });
  await assert.rejects(api.페이블하기(폴더, { 시험: false, 캡처: false, 끝: 고침 }), /범위 파일이 바뀌었다[^]*src\/app\.js/);
  // 묶음의 끝을 품지 않는 끝은 받지 않는다
  await assert.rejects(api.페이블하기(폴더, { 시험: false, 캡처: false, 끝: r.바탕 }), /묶음의 끝[^]*품지 않는다/);
  // 작업본 HEAD에 없는 커밋(곁 갈래)은 묶음의 끝을 품어도 받지 않는다 — 시험과 Fable은 작업본을 읽는다
  r.g('checkout', '-q', '-b', '곁갈래');
  const 곁 = r.커밋('곁 갈래 고침', { 'src/app.js': 'export const value = 6;\n' });
  r.g('checkout', '-q', 'main');
  await assert.rejects(api.페이블하기(폴더, { 시험: false, 캡처: false, 끝: 곁 }), /작업본 HEAD\([0-9a-f]{9}\)에 없다/);
  // 명령 줄에서도 --끝을 받는다
  const 출력 = execFileSync(process.execPath, [path.join(뿌리저장소, 'tools/검수묶음.mjs'), '페이블', 폴더, '--끝', 'HEAD', '--시험안함', '--캡처안함'], { encoding: 'utf8' });
  assert.match(출력, /자료를 뜬 끝: [0-9a-f]{9}/);
  assert.equal(페이블자료(폴더).증명.파일.find(f => f.경로 === 'src/app.js').sha256, sha('export const value = 4;\n'));
});

test('HEAD가 묶음의 끝을 품지 않으면 멈춘다 · 끝이 작업본인 묶음은 --끝을 받지 않는다', async t => {
  const r = 저장소(t);
  const { 폴더 } = await 준비(r);
  r.g('checkout', '-q', '-b', '다른갈래', r.바탕);
  r.커밋('다른 갈래의 고침', { 'src/app.js': 'export const value = 5;\n' });
  await assert.rejects(api.페이블하기(폴더, { 시험: false, 캡처: false }), /묶음의 끝[^]*품지 않는다/);
  r.g('checkout', '-q', 'main');
  // 고친 커밋이 없으면 지금처럼 묶음의 끝으로 뜨고, 그렇다고 적는다
  const fable = fs.readFileSync(await api.페이블하기(폴더, { 시험: false, 캡처: false }), 'utf8');
  assert.match(fable, new RegExp(`자료를 뜬 끝: \`${r.끝}\` \\(묶음의 끝\\) — 묶음을 준비한 끝 그대로다`));
  // 끝이 작업본인 묶음
  const w = 저장소(t);
  w.쓰기('src/app.js', 'export const value = 3;\n');
  const 작업 = await api.준비하기({ 이름: 'fable-worktree', 폴더: w.폴더, 저장소: w.repo, 종류: '백엔드', 바탕: w.바탕, 경로: ['src'] });
  await assert.rejects(api.페이블하기(작업.폴더, { 시험: false, 캡처: false, 끝: w.끝 }), /끝이 작업본인 묶음.*--끝/);
});

test('끝이 작업본인 묶음: fable.md 머리는 준비 때가 아니라 페이블 때의 HEAD를 적는다', async t => {
  const r = 저장소(t);
  r.쓰기('src/app.js', 'export const value = 3;\n');
  const { 폴더, 목록 } = await api.준비하기({ 이름: 'fable-worktree', 폴더: r.폴더, 저장소: r.repo, 종류: '백엔드', 바탕: r.바탕, 경로: ['src'] });
  assert.equal(목록.머리커밋.커밋, r.끝);
  const 고침 = r.커밋('고친 판 커밋');
  r.쓰기('src/app.js', 'export const value = 4;\n');
  const fable = fs.readFileSync(await api.페이블하기(폴더, { 시험: false, 캡처: false }), 'utf8');
  const 자료 = 페이블자료(폴더);
  assert.equal(자료.증명.머리, 고침);
  assert.equal(자료.증명.파일.find(f => f.경로 === 'src/app.js').sha256, sha('export const value = 4;\n'), '작업본 묶음은 커밋하지 않은 변경까지 뜬다');
  assert.match(fable, new RegExp(`자료를 뜬 끝: 작업본\\(HEAD \`${고침}\` \\+ 커밋하지 않은 변경\\) — 준비 때 HEAD \`${r.끝.slice(0, 9)}\` 뒤 커밋 1개`));
  assert.match(fable, new RegExp(`→ 끝 작업본\\(HEAD ${고침.slice(0, 9)} \\+ 미커밋 변경\\)`));
});
