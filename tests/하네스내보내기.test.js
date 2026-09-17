'use strict';
/* 하네스 내보내기 — «정본 판을 읽는가» 회귀 — 2026-09-06
 *
 * 무엇을 지키나: **자가 자기 눈이 먼 것을 스스로 말하는가.**
 *   09-06 실측 — `CLAUDE.md` v11.0 개편이 머리줄의 굵게 표시를 걷으면서
 *   (`**v6.12 · 2026-08-03**` → `> v11.0 · 2026-09-02 —`) 굵게만 찾던 정규식이 못 읽게 됐다.
 *   그런데 아무것도 안 죽었다 — `(버전 미검출)` 이라는 «글자»가 그대로 이식 폴더 머리말에 박히고,
 *   rot-check 은 그 값으로 낡음을 재므로 자가 눈이 먼 채 초록을 냈다.
 *   0건이 성공 얼굴인 그 무늬다(memory `zero-is-a-success-face-taxonomy`).
 *
 * 🔑 그래서 재는 것은 「정규식이 어떻게 생겼나」가 아니라 **«지금 정본에서 값이 실제로 나오나»**다.
 *   정규식 글자를 재면 CLAUDE.md 머리 꼴이 또 바뀌는 날 시험만 초록으로 남는다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const H = require('../tools/harness-export.js');   // require 는 생성기를 실행하지 않는다

test('날짜 없는 짧은 지침도 내보낼 수 있으며 원문을 임의로 보강하지 않는다', (t) => {
  const {repo, out, run} = 내보내기자리(t);
  const content = '# SYNK\n@docs/AI_운영원칙.md\n';
  fs.writeFileSync(path.join(repo, 'CLAUDE.md'), content);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(out, '00_정본/CLAUDE.md'), 'utf8'), content);
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'README.md'), 'utf8'), /미검출/);
});

function 내보내기자리(t) {
  const tempBase = path.resolve(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(tempBase, 'synk-harness-export-test-'));
  t.after(() => {
    const relative = path.relative(tempBase, dir);
    assert.ok(relative.startsWith('synk-harness-export-test-') && !relative.includes(path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const repo = path.join(dir, 'repo');
  const out = path.join(dir, 'output');
  const originals = {
    'AGENTS.md': '# GPT 총괄 작업자\r\nCodex 원문.\r\n',
    'CLAUDE.md': '# Claude 설계자\n\n> 2026-09-09 — 원문\n',
    'GEMINI.md': '# Gemini 자료 검토자\nAntigravity 원문.\n',
    'docs/AI_운영원칙.md': '# 공통 원칙\n네이티브 하네스 활용.\n',
  };
  for (const [file, body] of Object.entries(originals)) {
    const target = path.join(repo, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  fs.mkdirSync(path.join(repo, 'tools'));
  fs.copyFileSync(path.join(__dirname, '..', 'tools/harness-export.js'), path.join(repo, 'tools/harness-export.js'));
  const run = (...args) => spawnSync(process.execPath, [path.join(repo, 'tools/harness-export.js'), '--out', out, ...args], { encoding: 'utf8' });
  return { dir, repo, out, originals, run };
}

test('실제 내보내기는 모델별 원문을 구분하고 관계없는 파일을 보존한다', (t) => {
  const { repo, out, originals, run } = 내보내기자리(t);
  fs.mkdirSync(out);
  const sentinel = path.join(out, 'unrelated.txt');
  fs.writeFileSync(sentinel, '사용자가 둔 파일');
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  for (const [file, body] of Object.entries(originals)) {
    assert.equal(fs.readFileSync(path.join(out, '00_정본', file), 'utf8'), body);
  }
  assert.deepEqual(fs.readdirSync(out).sort(), ['00_정본', 'README.md', 'unrelated.txt'].sort());
  assert.equal(fs.readFileSync(sentinel, 'utf8'), '사용자가 둔 파일');

  fs.writeFileSync(path.join(repo, 'AGENTS.md'), '# GPT 변경된 원문\n');
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(out, '00_정본/AGENTS.md'), 'utf8'), '# GPT 변경된 원문\n');
  assert.equal(fs.readFileSync(sentinel, 'utf8'), '사용자가 둔 파일');
  for (const omitted of ['01_스킬', '02_훅', '03_에이전트', '04_메모리_볼트', '05_도구']) {
    assert.equal(fs.existsSync(path.join(out, omitted)), false, `${omitted}를 새로 복제하면 안 된다`);
  }
});

test('필수 원문이 없으면 기존 출력물을 건드리지 않고 실패한다', (t) => {
  const { repo, out, run } = 내보내기자리(t);
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'README.md'), '원래 안내문');
  fs.unlinkSync(path.join(repo, 'GEMINI.md'));
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GEMINI\.md/);
  assert.deepEqual(fs.readdirSync(out), ['README.md']);
  assert.equal(fs.readFileSync(path.join(out, 'README.md'), 'utf8'), '원래 안내문');
});

test('dry run은 출력 폴더를 만들지 않고 생성 목록만 보여준다', (t) => {
  const { out, run } = 내보내기자리(t);
  const result = run('--dry');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /00_정본\/AGENTS\.md/);
  assert.match(result.stdout, /실제 쓰기 없음/);
  assert.equal(fs.existsSync(out), false);
});
