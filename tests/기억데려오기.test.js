'use strict';
/**
 * tools/기억데려오기.js 회귀 — 「기억이 제자리에 오는가」를 센다.
 *
 * 🔴 이 시험이 있는 까닭(08-26 실사고): 첫 판은 경로의 «역슬래시»를 안 지웠다.
 *   그러면 path.join 이 그것을 구분자로 먹어, 기억 296벌이 제자리가 아니라
 *   `projects/C-/Users/q1212/Documents/...` 라는 «폴더 트리»로 클론됐다.
 *   그런데 `node --check` 는 통과했다 — 정규식이 여전히 «유효»했기 때문이다.
 *   즉 구문검사가 원리상 못 보는 자리라, 세는 시험이 따로 있어야 한다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 역슬래시 = String.fromCharCode(92);      // 이 파일도 정규식에 그 글자를 직접 안 쓴다
const 도구 = path.join(__dirname, '..', 'tools', '기억데려오기.js');
const { 폴더이름 } = require(도구);

test('폴더이름 은 경로 구분자를 한 글자도 남기지 않는다 — 남으면 기억이 폴더 트리로 흩어진다', () => {
  const 후보 = [
    'C:/Users/q1212/Documents/SYNK-appsscript',
    'C:/Users/q1212/Documents/SYNK-appsscript/.claude/worktrees/foo',
    '/home/runner/work/synk-appsscript/synk-appsscript',   // CI(리눅스) 갈래
  ];
  for (const p of 후보) {
    const 이름 = 폴더이름(p);
    for (const 금지 of [':', '.', '/', 역슬래시]) {
      assert.ok(!이름.includes(금지), `${p} → ${이름} 에 «${금지}» 가 남았다`);
    }
    assert.ok(이름.length > 0, `${p} 가 빈 이름이 됐다`);
  }
});

test('폴더이름 이 이 기계의 «실물» 폴더 이름과 맞는다 (08-26 실측 대조)', () => {
  assert.strictEqual(
    폴더이름('C:/Users/q1212/Documents/SYNK-appsscript'),
    'C--Users-q1212-Documents-SYNK-appsscript');
  assert.strictEqual(
    폴더이름('C:/Users/q1212/Documents/SYNK-appsscript/.claude/worktrees/angry-raman-d891af'),
    'C--Users-q1212-Documents-SYNK-appsscript--claude-worktrees-angry-raman-d891af');
});

test('변환 정규식에 역슬래시가 돌아오지 않았다 — 이스케이프에 조용히 먹히는 글자다', () => {
  const 원문 = fs.readFileSync(도구, 'utf8');
  const 정규식줄 = 원문.split('\n').filter(l => l.includes('replace(/'));
  assert.ok(정규식줄.length > 0, '변환 정규식을 못 찾았다 — 시험이 과녁을 잃었다');
  for (const 줄 of 정규식줄) {
    assert.ok(!줄.includes(역슬래시), `정규식에 역슬래시가 돌아왔다: ${줄.trim()}`);
  }
});

test('require 해도 기억을 건드리지 않는다 — 시험이 클론을 일으키면 안 된다', () => {
  // 이 파일 맨 위에서 이미 require 했다. 가드가 없으면 그때 클론이 돌아
  // 남의 기억 폴더가 생기고 시험이 수십 초 걸린다. 그 가드가 살아 있는지 센다.
  const 원문 = fs.readFileSync(도구, 'utf8');
  assert.ok(원문.includes('require.main === module'), 'require.main 가드가 사라졌다');
});

test('세션 훅이 이 도구를 실제로 부른다 — 안 부르면 새 기계는 백지로 시작한다', () => {
  const 설정 = fs.readFileSync(path.join(__dirname, '..', '.claude', 'settings.json'), 'utf8');
  assert.ok(설정.includes('기억데려오기'),
    'SessionStart 훅에서 기억데려오기 호출이 사라졌다 — 도구는 살아 있는데 아무도 안 부르는 상태다');
});
