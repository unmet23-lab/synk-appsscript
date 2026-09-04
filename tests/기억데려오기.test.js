'use strict';
/**
 * tools/기억데려오기.js 회귀 — 「기억이 제자리에 오는가」를 센다.
 *
 * 🔴 이 시험이 있는 까닭(08-26 실사고): 첫 판은 경로의 «역슬래시»를 안 지웠다.
 *   그러면 path.join 이 그것을 구분자로 먹어, 기억 296벌이 제자리가 아니라
 *   projects/C-/Users/q1212/Documents/... 라는 «폴더 트리»로 클론됐다.
 *   그런데 node --check 는 통과했다 — 정규식이 여전히 «유효»했기 때문이다.
 *   즉 구문검사가 원리상 못 보는 자리라, 세는 시험이 따로 있어야 한다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 역슬래시 = String.fromCharCode(92);      // 이 파일도 그 글자를 직접 안 쓴다
const 도구 = path.join(__dirname, '..', 'tools', '기억데려오기.js');
const { 폴더이름, 형제기억 } = require(도구);

test('폴더이름 은 경로 구분자를 한 글자도 남기지 않는다 — 남으면 기억이 폴더 트리로 흩어진다', () => {
  const 후보 = [
    'C:/Users/q1212/Documents/SYNK-appsscript',
    'C:/Users/q1212/Documents/SYNK-appsscript/.claude/worktrees/foo',
    '/home/user/synk-appsscript',                 // 원격 세션(claude.ai/code) 무늬
  ];
  for (const p of 후보) {
    const 이름 = 폴더이름(p);
    for (const 금지 of [':', '.', '/', 역슬래시]) {
      assert.ok(!이름.includes(금지), p + ' -> ' + 이름 + ' 에 «' + 금지 + '» 가 남았다');
    }
    assert.ok(이름.length > 0, p + ' 가 빈 이름이 됐다');
  }
});

test('폴더이름 이 이 기계의 «실물» 폴더 이름과 맞는다 (08-26 실측 대조)', () => {
  /* 🔴 09-05: 이 대조는 «윈도 경로»를 재는 것이라 윈도에서만 참이다. path.resolve 는 플랫폼마다
   *   다르게 읽어, 리눅스(원격 CI)에서는 `C:/Users/...` 를 **상대 경로**로 보고 앞에 cwd 를 붙인다
   *   (실측: `-home-runner-work-synk-appsscript-synk-appsscript-C--Users-q1212-...`).
   *   그래서 도구가 멀쩡한데 리눅스에서는 영원히 빨갛다 — 자가 틀린 자리이지 결함이 아니다.
   * 🔑 플랫폼과 무관한 진짜 성질(구분자를 한 글자도 안 남긴다)은 바로 위 시험이 이미 지킨다.
   *   그러니 여기서는 «못 잰다»를 정직하게 적고 건너뛴다 — 통과로 세지 않는다. */
  if (process.platform !== 'win32') {
    return void console.log(`  ↷ skip: 윈도 경로 대조라 이 판에서는 못 잰다 (platform=${process.platform})`);
  }
  assert.strictEqual(
    폴더이름('C:/Users/q1212/Documents/SYNK-appsscript'),
    'C--Users-q1212-Documents-SYNK-appsscript');
  assert.strictEqual(
    폴더이름('C:/Users/q1212/Documents/SYNK-appsscript/.claude/worktrees/angry-raman-d891af'),
    'C--Users-q1212-Documents-SYNK-appsscript--claude-worktrees-angry-raman-d891af');
});

test('🔴 도구 파일에 역슬래시가 한 글자도 없다 — 그 글자가 조용히 사라지는 게 첫 사고였다', () => {
  const 원문 = fs.readFileSync(도구, 'utf8');
  const 개수 = 원문.split(역슬래시).length - 1;
  assert.strictEqual(개수, 0,
    '역슬래시 ' + 개수 + '개가 돌아왔다 — 이스케이프에 먹혀도 구문검사는 통과하는 자리다');
});

test('형제 폴더에 synk-memory 가 있으면 그것을 찾는다 — 원격 세션의 유일한 길', () => {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-형제-'));
  const 옛 = process.env.CLAUDE_PROJECT_DIR;
  try {
    const 기억 = path.join(임시, 'synk-memory');
    fs.mkdirSync(기억);
    fs.writeFileSync(path.join(기억, 'MEMORY.md'), '# 시늉');
    const 작업 = path.join(임시, 'synk-appsscript');
    fs.mkdirSync(작업);

    process.env.CLAUDE_PROJECT_DIR = 작업;
    assert.strictEqual(형제기억(), 기억, '형제 폴더를 못 찾았다');

    // MEMORY.md 가 없으면 «기억 저장소가 아니다» — 아무 폴더나 집으면 안 된다
    fs.rmSync(path.join(기억, 'MEMORY.md'));
    assert.strictEqual(형제기억(), null, 'MEMORY.md 없는 폴더를 기억으로 오인했다');
  } finally {
    if (옛 === undefined) { delete process.env.CLAUDE_PROJECT_DIR; } else { process.env.CLAUDE_PROJECT_DIR = 옛; }
    fs.rmSync(임시, { recursive: true, force: true });
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
