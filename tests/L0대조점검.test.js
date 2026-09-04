'use strict';
/* L0 대조표 점검 회귀 — 2026-09-01 (⑦ 갈래 ⓒ)
 *
 * 무엇을 지키나: **시트 헤더가 자란 뒤 형제 저장소의 대조표가 따라왔는지를 «기계가» 묻는가.**
 *   실물: talk `L0_데이터계약.md` §5 의 voice_log 행이 12칸 시절 것이었고, 그 뒤 세 판이
 *   지나도록(v9.277·v9.278·v9.289) 한 번도 안 따라왔다. 그 셋을 만든 방식이 「나중에 한 번에」다.
 *
 * ⚠ 이 자는 **판정하지 않는다** — 운영 축 칸은 표에 없어도 정상이라 「낡았다」로 단정하면 거짓이 된다.
 *   말하는 것은 「실물이 바뀌었는데 표는 그대로다 → 사람이 봐야 한다」까지다. 시험도 그 선을 지킨다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 자 = path.join(REPO, 'tools', 'L0대조점검.js');
const 대상 = require(자).대상;

/** 이 저장소 실물 헤더를 그대로 복사한 픽스처 저장소 + 형제. */
function 픽스처(옵션 = {}) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-L0-'));
  const 집 = path.join(방, 'appsscript');
  const 형제 = path.join(방, 'SYNK-talk');
  fs.mkdirSync(집, { recursive: true });
  fs.mkdirSync(path.join(형제, 'docs'), { recursive: true });

  // 헤더 상수를 담은 가짜 엔진 파일 둘 — 실물과 같은 파일 이름·상수 이름이어야 자가 찾는다.
  const 줄 = (이름, 값) => `const ${이름} = [${값.map((v) => `'${v}'`).join(', ')}];\n`;
  const 칸 = 옵션.추가칸 ? ['a', 'b', 옵션.추가칸] : ['a', 'b'];
  fs.writeFileSync(path.join(집, '엔진_셋업확장.js'), 줄('VOICE_LOG_HEADERS', 칸), 'utf8');
  fs.writeFileSync(path.join(집, '엔진_수집.js'),
    ['HW_FEEDBACK_HEADERS', 'QUIZ_LOG_HEADERS', 'TALK_LOG_HEADERS', 'GOLD_HEADERS']
      .map((n) => 줄(n, ['x'])).join(''), 'utf8');

  fs.writeFileSync(path.join(형제, 'docs', 'L0_데이터계약.md'),
    `# L0\n\n## 5. 라이브 필드 ↔ L0 대조\n\n| 라이브 | L0 |\n|---|---|\n| \`voice_log\`: a·b | x |\n${옵션.표꼬리 || ''}\n\n## 6. 다음\n`, 'utf8');

  return { 집, 형제, 도장: path.join(집, '도장.json') };
}

function 돌린다(f, 인자 = []) {
  return spawnSync(process.execPath, [자, ...인자], {
    encoding: 'utf8',
    env: { ...process.env, SYNK_L0_ROOT: f.집, SYNK_TALK_ROOT: f.형제, SYNK_L0_STAMP: f.도장 },
  });
}

test('도장이 없으면 «안 재봤다»고 말한다 — 0건이 아니다', () => {
  const r = 돌린다(픽스처());
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /도장이 없다/);
  assert.match(r.stdout, /0건이 아니다/);
});

test('🔑 헤더가 바뀌었는데 표가 그대로면 «적색» — 이것이 세 판을 놓친 그 자리다', () => {
  const f = 픽스처();
  assert.strictEqual(돌린다(f, ['--도장', '--사유', '첫 도장']).status, 0);
  // 실물만 자란다(v9.277 이 한 그것)
  const f2 = { ...f, 집: 픽스처({ 추가칸: '목표발화' }).집 };
  fs.copyFileSync(path.join(f.형제, 'docs', 'L0_데이터계약.md'),
    path.join(f2.형제 || f.형제, 'docs', 'L0_데이터계약.md'));
  const r = 돌린다({ 집: f2.집, 형제: f.형제, 도장: f.도장 });
  assert.match(r.stdout, /헤더가 바뀌었는데.*대조표는 그대로/);
  assert.match(r.stdout, /단정하지 않는다/, '「낡았다」로 단정하면 거짓이 된다 — 그 선을 문면이 지켜야 한다');
});

test('헤더와 표가 «둘 다» 바뀌면 조용하다 — 사람이 이미 손댄 것이다', () => {
  const f = 픽스처();
  돌린다(f, ['--도장', '--사유', '첫 도장']);
  const f2 = 픽스처({ 추가칸: '목표발화', 표꼬리: '| `voice_log`: 목표발화 | y |' });
  const r = 돌린다({ 집: f2.집, 형제: f2.형제, 도장: f.도장 });
  assert.doesNotMatch(r.stdout, /그대로다/);
  assert.match(r.stdout, /둘 다.*바뀌었다/);
});

test('🔑 형제 저장소가 없으면 «확인 불가»다 — 통과로 위장하지 않는다', () => {
  const f = 픽스처();
  const r = 돌린다({ ...f, 형제: path.join(f.형제, '없는곳') });
  assert.strictEqual(r.status, 1, '못 잰 것은 종료 1 이다');
  assert.match(r.stdout, /못 쟀다/);
  assert.match(r.stdout, /「표가 맞다」가 아니라/);
});

test('§5 절을 못 찾으면 그 사실을 말한다 — 절 제목이 바뀌면 자부터 고쳐야 한다', () => {
  const f = 픽스처();
  fs.writeFileSync(path.join(f.형제, 'docs', 'L0_데이터계약.md'), '# L0\n\n## 5. 딴 제목\n', 'utf8');
  const r = 돌린다(f);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /절을 못 찾았다/);
});

test('🔑 사유 없는 도장은 거절한다 — 「검토했다」와 「그냥 찍었다」가 같은 모양이면 안 된다', () => {
  const f = 픽스처();
  const r = 돌린다(f, ['--도장']);
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /--사유 가 필요하다/);
  assert.ok(!fs.existsSync(f.도장), '거절했는데 도장이 찍혔다');
});

test('못 잰 상태에서는 도장을 안 찍는다 — 모르는 것에 「맞다」를 박으면 그게 거짓의 출처다', () => {
  const f = 픽스처();
  const r = 돌린다({ ...f, 형제: path.join(f.형제, '없는곳') }, ['--도장', '--사유', 'ㅇ']);
  assert.notStrictEqual(r.status, 0);
  assert.ok(!fs.existsSync(f.도장));
});

test('표가 이름을 대는데 대상 목록에 없는 시트를 알린다 — 한쪽만 자라는 것도 잡는다', () => {
  const f = 픽스처({ 표꼬리: '| `새로운로그`: 뭔가 | z |' });
  돌린다(f, ['--도장', '--사유', 'ㅇ']);
  const r = 돌린다(f);
  assert.match(r.stdout, /새로운로그/);
  assert.match(r.stdout, /한쪽만 자란 것/);
});

test('🔑 실저장소 — 자의 «대상» 목록이 실제 헤더 상수를 다 찾는다(이름이 바뀌면 조용히 못 잰다)', () => {
  /* 🔴 09-05: 이 줄만 «형제 저장소»를 요구한다. 원격 CI 는 이 저장소 하나만 체크아웃하므로
   *   talk 이 원리상 없고, 그때 나는 빨강은 결함이 아니라 «못 잰 것»이다(실측: run 33915165291).
   *   위 픽스처 시험들이 자의 동작을 이미 다 재므로, 여기서는 못 잼을 적고 건너뛴다. */
  const 형제L0 = path.join(REPO, '..', 'SYNK-talk', 'docs', 'L0_데이터계약.md');
  if (!fs.existsSync(형제L0)) {
    return void console.log(`  ↷ skip: 형제 저장소 L0 가 이 판에 없다 — ${형제L0}`);
  }
  const r = spawnSync(process.execPath, [자, '--json'], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout);
  assert.ok(!j.못잼, `실저장소에서 못 쟀다: ${j.못잼}`);
  assert.ok(j.헤더지문 && j.표지문, '지문 둘이 다 나와야 한다');
  assert.strictEqual(대상.length, 5, '§5 가 덮는 시트 다섯 — 늘리려면 이 시험부터 고친다');
});
