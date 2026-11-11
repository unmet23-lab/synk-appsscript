/* 굽기 사본 금지 — 구독 그림 굽기(codex계정을 불러 generated_images에서 그림을 옮기는 코드)를 편 폴더에 다시 두지 않는다 (2026-11-11).
 *
 * 왜: 새 편마다 앞 편의 굽기.cjs(다른 이름으로는 굽기_gpt.cjs · 이미지콘티_굽기.cjs · 이미지콘티_구독굽기.cjs · 이미지콘티_GPT.py)를
 *   복사해 86벌이 됐다. 공용 도구는 tools/그림굽기.js 하나다. 옛 사본은 얼린 목록(tests/fixtures/그림굽기/얼린사본.txt)에 두고,
 *   tools · tests 밖에서 그 표식이 든 새 파일이 생기면 여기서 걸린다.
 * 훑는 법: 추적하는 코드 파일(`git ls-files`의 무늬 다섯) 가운데 두 표식이 모두 든 것을 `git grep`으로 고르고, 이번 push로 처음 들어가는
 *   파일(SYNK_새파일 — tests/_git밖.js)은 직접 읽는다. `git ls-files` 무늬로 훑으므로 바로올리기의 관련 시험이 코드 파일을 올리는 push마다
 *   이 시험을 고른다(2~3초).
 * 옮겨 가는 동안: 이 시험이 origin에 들어가기 전에 뜬 작업 사본의 회차는 이 시험 없이 올린다. 그래서 편 폴더 이름의 날짜가
 *   2026-11-11~14인 편(docs/마케팅/<편>_<날짜>/)의 사본은 얼린 것으로 친다. 그 전 날짜의 편은 목록에 있는 것만이다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 이번push새파일 } = require('./_git밖.js');

const REPO = path.resolve(__dirname, '..');
const 목록파일 = path.join(__dirname, 'fixtures', '그림굽기', '얼린사본.txt');
const 표식 = ['codex계정', 'generated_images'];
const 코드무늬 = ['*.cjs', '*.mjs', '*.js', '*.py', '*.ts'];
const 유예처음 = '20261111';
const 유예끝 = '20261114';

const 얼린목록 = () => fs.readFileSync(목록파일, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const git = (인자) => spawnSync('git', ['-c', 'core.quotepath=false', ...인자], { cwd: REPO, encoding: 'utf8', maxBuffer: 256 << 20 });

/** 표식이 든 코드 파일(저장소 기준 경로) — 추적 파일 + 이번 push로 처음 들어가는 파일 */
function 표식파일들() {
  const 목록 = git(['ls-files', '-z', '--', ...코드무늬]);
  assert.strictEqual(목록.status, 0, `git ls-files 실패: ${목록.stderr}`);
  const 추적 = new Set(String(목록.stdout).split('\0').filter(Boolean));
  assert.ok(추적.size > 1000, `추적하는 코드 파일이 너무 적다: ${추적.size}`);
  // 작업본의 글을 본다(-I 바이너리 건너뜀 · -F 글자 그대로 · --all-match 두 표식이 한 파일에 모두)
  const 찾음 = git(['grep', '-l', '-z', '-I', '-F', '--all-match', ...표식.flatMap((s) => ['-e', s]), '--', ...코드무늬]);
  assert.ok(찾음.status === 0 || 찾음.status === 1, `git grep 실패: ${찾음.stderr}`);
  const 있는 = new Set(String(찾음.stdout).split('\0').filter((p) => p && 추적.has(p)));
  for (const 새 of 이번push새파일()) {
    const p = 새.replace(/\\/g, '/');
    if (!/\.(cjs|mjs|js|py|ts)$/.test(p) || 추적.has(p)) continue;
    let 글 = '';
    try { 글 = fs.readFileSync(path.join(REPO, p), 'utf8'); } catch { continue; }
    if (표식.every((s) => 글.includes(s))) 있는.add(p);
  }
  return [...있는].sort();
}
// 그 전 날짜의 편은 넘기지 않는다 — 옛 편 폴더(그 아래 새 판 · 새 영상 폴더 포함)의 사본은 얼린 목록에 이미 있다
const 유예편인가 = (rel) => { const m = /^docs\/마케팅\/[^/]+_(\d{8})\//.exec(rel); return Boolean(m && m[1] >= 유예처음 && m[1] <= 유예끝); };

test('새 편에 굽기 사본을 두지 않는다 — 구독 굽기를 다시 짠 파일은 tools 밖에서 얼린 목록뿐', () => {
  const 있는 = 표식파일들();
  const 얼린 = 얼린목록();
  // 훑기가 살아 있는지부터 — 디스크에 있는 얼린 파일은 모두 훑기에 잡혀야 한다(훑기가 깨져 0개를 내면 통과하면 안 된다)
  assert.ok(얼린.length >= 80, `얼린 목록이 너무 짧다: ${얼린.length}`);
  const 잡힌 = new Set(있는);
  const 디스크에있는 = 얼린.filter((p) => fs.existsSync(path.join(REPO, p)));
  assert.ok(디스크에있는.length >= 1, '얼린 파일이 이 작업본에 하나도 없다 — 훑기를 확인할 수 없다');
  const 놓친 = 디스크에있는.filter((p) => !잡힌.has(p));
  assert.deepStrictEqual(놓친, [], `얼린 목록의 파일을 훑기가 못 잡았다(표식이 사라졌으면 목록에서 뺀다 · 아직 추적 전인 파일이면 이번 push에 함께 올린다):\n${놓친.map((p) => `  ${p}`).join('\n')}`);

  const 얼린집합 = new Set(얼린);
  const 새사본 = 있는.filter((p) => !/^(tools|tests)\//.test(p) && !얼린집합.has(p) && !유예편인가(p));
  assert.deepStrictEqual(새사본, [], [
    '구독 굽기(codex계정 → generated_images에서 그림 옮기기)를 편 폴더에 다시 두었다:',
    ...새사본.map((p) => `  ${p}`),
    '→ 사본을 지우고 공용 도구를 부른다: node tools/그림굽기.js <편 폴더> <지시문.txt> <이름> [참고 그림…] [--판 <폴더>]',
    '→ 공용 도구로 안 되는 굽기면 tools/그림굽기.js를 고친다. 다른 일을 하는 파일이 표식에 걸린 것이면 tests/fixtures/그림굽기/얼린사본.txt에 한 줄 더한다.',
  ].join('\n'));
});

test('유예는 편 폴더 이름의 날짜로만 준다', () => {
  assert.strictEqual(유예편인가('docs/마케팅/LAB_물개_mn_20261111/굽기.cjs'), true);
  assert.strictEqual(유예편인가(`docs/마케팅/LAB_어느편_${유예끝}/판/굽기.cjs`), true);
  assert.strictEqual(유예편인가('docs/마케팅/LAB_다음편_20261115/굽기.cjs'), false);
  assert.strictEqual(유예편인가('docs/마케팅/LAB_날짜없는편/굽기.cjs'), false);
  // 옛 편 폴더 아래의 새 판 · 새 영상 폴더는 넘기지 않는다
  assert.strictEqual(유예편인가('docs/마케팅/LAB_그래자_mn_20261027/v2/굽기2.cjs'), false);
  assert.strictEqual(유예편인가('docs/마케팅/PULSE_포트폴리오_제작준비_20261012/video/new-film-20261201/굽기_gpt.cjs'), false);
  assert.strictEqual(유예편인가('experiences/drama/qa/시험-20261111/굽기.cjs'), false);
});
