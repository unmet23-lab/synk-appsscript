'use strict';
/**
 * 🔄 스킬 판 점검 — **밖에서 들여온 스킬이 뒤졌는지 스스로 세는 자**가 제 일을 하나
 *
 * ■ 왜 이 시험이 필요한가 (유호 09-03 「자동화가 확실히 적용됐는지 확인해줘」)
 *   이 도구가 하는 말은 「뒤진 것 0벌」이다. 그 말은 **두 가지 서로 다른 사실**에 같은 얼굴을 준다:
 *   ㉠ 정말 다 최신이다  ㉡ 표를 못 읽어서 «셀 것»이 애초에 없었다.
 *   ㉡이면 도구는 영원히 초록이고 아무도 안 본다 — 그게 이 저장소가 여러 번 겪은 무늬다
 *   ([[zero-is-a-success-face-taxonomy]]). 그래서 과녁은 「0을 내나」가 아니라
 *   **「셀 것을 못 셀 때 그 사실을 «말하나»」**다.
 *
 * ■ 이 시험이 «안» 재는 것 (대가를 함께 적는다)
 *   상류에 실제로 묻는 층(GitHub API)은 안 탄다 — 네트워크가 없으면 시험이 통째로 빨개지고,
 *   그러면 사람이 시험을 끄게 된다. 그 층은 도구를 손으로 돌려 본다(`node tools/스킬판점검.js`).
 *   여기서 닫는 것은 그 앞칸 하나다: **「표를 옳게 읽고, 못 읽은 것을 숨기지 않는가」.**
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const 점검 = require(path.join(ROOT, 'tools', '스킬판점검.js'));

/* 표를 임시로 갈아 끼우고 읽어 본다 — 원본은 반드시 되돌린다. */
function 표로읽기(내용) {
  const 원본 = fs.readFileSync(점검.표경로);
  try {
    fs.writeFileSync(점검.표경로, 내용, 'utf8');
    return 점검.표읽기();
  } finally {
    fs.writeFileSync(점검.표경로, 원본);
  }
}

const 머리 = '| 스킬 | 원본이 있는 곳 | 우리 판 | 우리가 고친 것 |\n|---|---|---|---|\n';

// ── 표를 읽는 층 — 이 도구가 세는 «분모»가 여기서 정해진다 ─────────────

test('🔴 정본 표를 읽으면 저장소가 실제로 쥔 스킬이 나온다 — 분모가 «실물»과 같다', () => {
  const { 항목, 못읽은줄 } = 점검.표읽기();
  assert.ok(항목.length >= 9, `표에서 ${항목.length}벌만 읽혔다 — 밖에서 들여온 스킬은 아홉이다`);
  assert.deepEqual(못읽은줄, [], `꼴이 깨진 줄이 있다: ${(못읽은줄 || []).join(' · ')}`);

  /* 표가 «낡는» 것을 여기서 막는다 — 적혀 있는 스킬이 실제로 폴더로 서 있어야 한다.
   * 안 그러면 도구는 없는 것을 상류에 묻고 「그대로」라 답한다(가장 조용한 거짓 초록). */
  for (const 것 of 항목) {
    const 폴더 = path.join(ROOT, '.claude', 'skills', 것.이름);
    assert.ok(fs.existsSync(폴더),
      `표는 «${것.이름}» 을 세는데 .claude/skills/${것.이름} 이 없다 — 표가 실물보다 낡았다`);
  }
});

test('🔴 꼴이 깨진 줄은 «못 읽었다»고 센다 — 조용히 빠뜨리면 그만큼 0이 거짓이 된다', () => {
  const 표 = 머리
    + '| `쓸만한것` | `owner/repo` → `skills/쓸만한것` | 1.0 | 없음 |\n'
    + '| `깨진것` | 원본 저장소 어딘가 | 1.0 | 없음 |\n';
  const { 항목, 못읽은줄 } = 표로읽기(표);
  assert.equal(항목.length, 1, '읽을 수 있는 줄만 세야 한다');
  assert.deepEqual(못읽은줄, ['깨진것'],
    '경로가 없는 줄을 «없는 셈» 치고 넘어갔다 — 그 스킬은 영원히 안 재진다');
});

test('🔴 「〃」 상속을 받지 않는다 — 줄을 옮기면 조용히 엉뚱한 저장소를 가리킨다', () => {
  const 표 = 머리
    + '| `첫째` | `owner/repo` → `skills/첫째` | 1.0 | 없음 |\n'
    + '| `둘째` | 〃 | 1.0 | 없음 |\n';
  const { 항목, 못읽은줄 } = 표로읽기(표);
  assert.equal(항목.length, 1, '「〃」 를 윗줄에서 물려받았다');
  assert.deepEqual(못읽은줄, ['둘째'], '「〃」 줄을 못 읽었다고 말하지 않는다');
});

test('머리줄·구분선은 항목으로 세지 않는다 — 분모가 둘 부풀던 자리', () => {
  const { 항목 } = 표로읽기(머리 + '| `하나` | `o/r` → `p` | 1.0 | 없음 |\n');
  assert.equal(항목.length, 1);
  assert.equal(항목[0].이름, '하나');
});

// ── 「언제 재봤나」 — 조용함이 «게으름»이 아니라 «규칙»이어야 한다 ──────

test('🔴 잰 적 없거나 값이 쓰레기면 «안 재봤다»로 읽는다 — 0일로 읽으면 영영 안 잰다', () => {
  assert.equal(점검.지난날(null), Infinity, 'null 을 0일로 읽으면 훅이 영원히 조용하다');
  assert.equal(점검.지난날(''), Infinity);
  assert.equal(점검.지난날('어제쯤'), Infinity, '날짜가 아닌 값을 0일로 읽었다');
  assert.ok(점검.지난날(new Date(Date.now() - 3 * 86400000).toISOString()) > 2.9, '사흘 전을 사흘로 안 센다');
});

test('🔴 「잰 때」는 저장소 «밖»에 산다 — 안에 두면 훅이 돌 때마다 원장이 더러워진다', () => {
  assert.ok(!점검.잰때경로.startsWith(ROOT),
    `잰때 파일이 저장소 안이다(${점검.잰때경로}) — 세션마다 미커밋이 떠서 배포 1단계가 헛세게 된다`);
  assert.ok(점검.잰때경로.startsWith(os.tmpdir()), '잰때 파일이 임시 폴더 밖에 있다');
  assert.ok(점검.장부경로.startsWith(ROOT),
    '기준선 장부는 저장소 «안»이어야 한다 — 세션 사이에 공유되는 값이다');
});

// ── 표와 도구가 한 몸인가 ────────────────────────────────────────────

/* 🔴 도구는 «상류가 움직였나»만 잰다. 그래서 **우리가 스킬을 올리고 표를 안 고치면** 아무도 안 잡는다 —
 *   표가 조용히 낡고, 다음 사람이 그 낡은 값을 믿는다([[constant-known-in-two-places]]).
 *   판번호를 스스로 적어 두는 스킬은 그 값이 곧 자다. 있는 자를 안 쓰면 없는 것과 같다. */
test('🔴 표의 「우리 판」이 실물 SKILL.md 의 판번호와 같다 — 표가 조용히 낡지 않게', () => {
  const 표글 = fs.readFileSync(점검.표경로, 'utf8');
  const { 항목 } = 점검.표읽기();
  const 어긋남 = [];

  for (const ln of 표글.split('\n')) {
    if (!ln.startsWith('|')) continue;
    const 칸 = ln.split('|').slice(1, -1).map((s) => s.trim());
    if (칸.length < 3) continue;
    const 이름 = (칸[0].match(/`([^`]+)`/) || [])[1];
    if (!이름 || !항목.some((it) => it.이름 === 이름)) continue;

    const p = path.join(ROOT, '.claude', 'skills', 이름, 'SKILL.md');
    if (!fs.existsSync(p)) continue;
    const 실물 = (fs.readFileSync(p, 'utf8').slice(0, 2000).match(/^version:\s*"?([\d.]+)"?/m) || [])[1];
    if (!실물) continue;                       // 판번호를 안 적는 스킬은 이 자로 못 잰다(있는 그대로 둔다)
    if (!칸[2].includes(실물)) 어긋남.push(`${이름}: 표=「${칸[2]}」 실물=${실물}`);
  }

  assert.deepEqual(어긋남, [],
    `표의 판번호가 실물과 갈렸다 — 스킬을 올렸으면 .claude/skills/외부반입_출처.md 도 같은 커밋에서 고친다:\n  ${어긋남.join('\n  ')}`);
});

test('표 문서가 이 도구를 가리킨다 — 「어떻게 다시 재나」가 한 곳에서만 나온다', () => {
  const 표글 = fs.readFileSync(점검.표경로, 'utf8');
  assert.ok(표글.includes('tools/스킬판점검.js'),
    '표에 재는 방법이 안 적혀 있다 — 다음 사람이 또 「잴 자가 없다」로 남긴다');
  assert.ok(/도장/.test(표글), '봤고 처리했을 때 무엇을 하는지가 표에 없다');
});

test('🔴 세션 시작 훅이 이 도구를 «--훅» 으로 부른다 — 안 걸려 있으면 아무도 안 잰다', () => {
  const 설정 = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const 훅들 = (설정.hooks && 설정.hooks.SessionStart) || [];
  const 명령 = 훅들.flatMap((g) => (g.hooks || []).map((h) => h.command || '')).join('\n');
  assert.ok(명령.includes('스킬판점검.js'), '세션 시작 훅에 이 도구가 없다 — 자동으로 도는 자리가 사라졌다');
  assert.ok(/스킬판점검\.js[^\n]*--훅/.test(명령.replace(/\\"/g, '"')),
    '훅 모드(--훅) 없이 부른다 — 매 세션 네트워크를 때리고 7일 규칙이 죽는다');
  assert.ok(/확인 불가/.test(명령),
    '도구가 없을 때 「다 최신」이라고 말하는 훅이다 — 「없다」와 «못 쟀다»를 갈라야 한다');
});
