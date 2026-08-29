// 벤더 한도 마커 회귀 — 「한도 소진 판정이 tmp 런 JSON 에만 남아 세션마다 재발견」을 막은 장치를 지킨다.
//
// 실측 2026-08-13 (런 심문-2026-08-13T0104-87f15a): 소진 상태에서 던진 심문 3회차가 15초에
// 전멸했고, 그 판정을 던진 세션·처분 세션·다음 세션이 **각자 다시** 밟았다(같은 절차 3번째 = 기계화).
// 장치 = 검수런.한도기록/한도상태/한도막나(판정 1벌) + codex() 깔때기 게이트 + 던지기 입구 게이트
//        + review-runs 훅 알림 + 성공 1회 자동 해제.
//
// 새는 방향 점검이 곧 케이스다:
//   · 실측 원문 그대로 못 알아보면 → 마커가 안 적혀 다음 세션이 또 태운다 (케이스 ①)
//   · 리셋 시각을 모르는데 막으면 → 따를 수 없는 처방 = 우회가 정상 통로가 된다(F103 · 케이스 ⑤)
//   · 리셋이 지났는데 막으면 → 처방(「리셋 뒤 같은 명령」)을 가드 자신이 거부한다 (케이스 ③)
// 탐지력은 픽스처가 진다 — 실저장소엔 마커가 대개 없어, 거기서의 초록은 「한도가 아니다」와
// 「장치가 죽었다」를 못 가른다(초록은 분모와 함께 읽는다).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

/* 픽스처 방 — env 로 갈아끼워 실저장소 tmpdir 을 안 건드린다(tests/검수런.test.js 와 같은 규약). */
function 새방() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-한도-test-'));
  process.env.SYNK_REVIEW_CKPT = path.join(d, 'ckpt');
  process.env.SYNK_REVIEW_RUNS = path.join(d, 'runs');
  return d;
}

function 런모듈() {
  delete require.cache[require.resolve('../tools/lib/검수런.js')];
  return require('../tools/lib/검수런.js');
}

/* 2026-08-13 실측 stderr 한 줄 **그대로** — 가드는 사람이 실제로 보는 표기로 검사한다(CLAUDE.md 맹점 ①). */
const 실측줄 = "ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Aug 18th, 2026 12:39 PM.";

/**
 * 마커를 **살아있게** 못박는다 — 「지금 기준 미래」를 벽시계가 아니라 값으로 만든다.
 *
 * 🔴 왜 있나 (실측 2026-08-18 · `tools/환경대조.js` 시간대 축이 잡았다):
 *   아래 두 검사는 `실측줄` 이 든 날짜(`Aug 18th, 2026 12:39 PM`)가 **「지금」보다 미래**라는 데
 *   기대고 있었다. 그런데 그 문자열은 «로컬 시각»으로 파싱된다:
 *     · TZ=UTC(= `test-ci` 가 모사하는 CI)  → 2026-08-18T12:39Z — 그날 12:39Z 까지만 미래
 *     · TZ=Asia/Seoul(= 유호님 노트북)      → 2026-08-18T03:39Z — **이미 지났다**
 *   ⇒ 같은 커밋이 유호님 기계에서는 **그날 아침부터 빨갛고**, CI 에서도 **12:39Z 부터 영구히**
 *     빨개진다. 아무도 안 건드렸는데 모두의 배포 게이트가 막히는 «주인 없는 적색»이다(F296).
 *
 * 🔑 `실측줄` 자체는 **안 바꾼다** — 그건 실제로 받은 stderr 원문이고, 서수(`18th`) 벗기기 회귀가
 *   그 원문에 걸려 있다(F083 「신고 원문을 그대로 다시 넣는다」). 고칠 것은 «파싱»이 아니라
 *   «살아있음을 무엇으로 아는가»다. 그래서 감지는 원문이 지고, 생사는 여기서 값으로 준다.
 *
 * ⚠ 왜 `한도상태(지금)` 주입으로 안 되나: 아래 둘은 **자식 프로세스**(훅·codex-review)를 띄우고,
 *   그쪽은 자기 `Date.now()` 를 쓴다. 부모가 주입해도 안 넘어간다 — 마커 «파일»에 적어야 닿는다.
 */
function 살려두기(런, 앞으로_분 = 60) {
  const 경로 = 런.한도경로();
  const 기록 = JSON.parse(fs.readFileSync(경로, 'utf8'));
  기록.리셋시각 = new Date(Date.now() + 앞으로_분 * 60000).toISOString();
  fs.writeFileSync(경로, JSON.stringify(기록), 'utf8');
  return 기록;
}

// ───────────────────────────────── ① 감지 — 실측 원문을 그대로 알아본다

test('실측 stderr 에서 마커가 적히고 서수(18th)를 벗겨 리셋 시각이 선다', () => {
  새방();
  const 런 = 런모듈();
  delete process.env[런.한도무시키];
  const r = 런.한도기록(`OpenAI Codex v0.9\n배너줄\n${실측줄}\n`);
  assert.ok(r, '실측 원문을 못 알아봤다 — 다음 세션이 또 태운다');
  /* 로컬 파싱끼리 비교하므로 TZ 가 달라도 같은 판이다(F296 — 시간대에 기대는 검사 금지). */
  assert.strictEqual(r.리셋시각, new Date('Aug 18, 2026 12:39 PM').toISOString(),
    '서수를 못 벗기면 Date 파싱이 죽고, 죽으면 차단 없이 알림만 남는다');
  assert.ok(fs.existsSync(런.한도경로()), '마커 파일이 없다 — 다음 프로세스가 볼 수 없다');
  assert.ok(r.원문.includes('usage limit'), '원문 줄이 안 실렸다 — 사람이 근거를 확인할 수 없다');
});

test('한도 오류가 아닌 실패에는 아무것도 적지 않는다 — 오탐은 멀쩡한 통로를 막는다', () => {
  새방();
  const 런 = 런모듈();
  assert.strictEqual(런.한도기록('ERROR: stream disconnected before completion'), null);
  assert.ok(!fs.existsSync(런.한도경로()), '무관한 오류로 마커가 생겼다');
});

test('서수 변형(1st·2nd·3rd·21st)도 전부 파싱된다', () => {
  const 런 = 런모듈();
  for (const [원문, 기대] of [
    ['try again at Aug 1st, 2026 9:00 AM.', 'Aug 1, 2026 9:00 AM'],
    ['try again at Sep 2nd, 2026 11:30 PM.', 'Sep 2, 2026 11:30 PM'],
    ['try again at Oct 3rd, 2026 1:05 AM.', 'Oct 3, 2026 1:05 AM'],
    ['try again at Dec 21st, 2026 6:00 PM.', 'Dec 21, 2026 6:00 PM'],
  ]) {
    assert.strictEqual(런.한도리셋파싱(원문), new Date(기대).toISOString(), `못 읽음: ${원문}`);
  }
  assert.strictEqual(런.한도리셋파싱('usage limit reached, no retry time given'), null,
    '시각이 없는데 지어냈다 — 지어낸 차단은 멀쩡한 리셋 뒤에도 막는다');
});

/* 🔴 2026-08-29 실측 — 벤더가 **날짜 없이 시각만** 주는 판이 있다(그날 실물 그대로):
 *   `ERROR: You've hit your usage limit. … or try again at 9:37 PM.`
 *   이걸 못 읽으면 마커가 「리셋 시각을 못 읽었다」로 남고, 그러면 게이트가 **태우기 전에 못 막는다**
 *   (리셋을 모르는 차단은 따를 수 없는 처방이라 설계상 안 막는다) — 못 읽는 순간 방어가 통째로 꺼진다. */
test('날짜 없이 «시각만» 주는 판도 읽는다 — 가장 가까운 미래로 (2026-08-29 실물)', () => {
  const 런 = 런모듈();
  const 실물 = "ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), "
    + 'visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 9:37 PM.';
  // 같은 날 20:22 에 감지 → 21:37 은 아직 안 지났으니 **오늘**이다
  const 오늘 = new Date('2026-08-29T20:22:00');
  assert.strictEqual(런.한도리셋파싱(실물, 오늘), new Date('2026-08-29T21:37:00').toISOString(),
    '시각만 있는 판을 못 읽었다 — 그러면 한도 게이트가 꺼진 채로 돈다');
  // 이미 지난 시각이면 **내일**로 — 지난 시각을 그대로 두면 마커가 즉시 「지남」이 돼 방어가 헛돈다
  const 늦은밤 = new Date('2026-08-29T23:50:00');
  assert.strictEqual(런.한도리셋파싱(실물, 늦은밤), new Date('2026-08-30T21:37:00').toISOString(),
    '지난 시각을 오늘로 읽으면 마커가 태어나자마자 만료된다');
  // 12시간제 경계 — 12 AM = 0시 · 12 PM = 12시
  assert.strictEqual(런.한도리셋파싱('try again at 12:00 AM', new Date('2026-08-29T10:00:00')),
    new Date('2026-08-30T00:00:00').toISOString(), '12 AM 을 12시로 읽었다');
  assert.strictEqual(런.한도리셋파싱('try again at 12:30 PM', new Date('2026-08-29T10:00:00')),
    new Date('2026-08-29T12:30:00').toISOString(), '12 PM 을 0시로 읽었다');
  // 형식이 아예 다르면 여전히 null — 「안 읽혔다」가 보여야 한다(지어내지 않는 선)
  assert.strictEqual(런.한도리셋파싱('try again later', new Date('2026-08-29T10:00:00')), null);
});

test('실전 모양: 오류 조각들이 「 / 」로 한 줄에 이어 붙어도 리셋 시각이 선다(첫 실심기가 잡음)', () => {
  /* 실측 87f15a 로그의 실제 모양 — 「확인 불가 …」 요약이 ERROR 조각 둘을 한 줄로 이었다.
   * 줄끝 앵커 파싱은 여기서 첫 「try again at」부터 줄끝까지 삼켜 null 이 됐다. */
  const 합쳐진줄 = `🔴 확인 불가 — 검수가 안 돌았다: 설계 심문 1/3 실패: 지적이 하나도 없으면 그대로 적어라. / ${실측줄} / ${실측줄}`;
  assert.strictEqual(런모듈().한도리셋파싱(합쳐진줄), new Date('Aug 18, 2026 12:39 PM').toISOString(),
    '조각이 이어 붙은 실전 줄에서 리셋 시각을 못 읽는다 — 마커가 알림 전용으로 약해진다');
});

// ───────────────────────────────── ② 판정 — 막나/지남 (판정은 한 곳, 여기의 눈금이 전부다)

test('리셋 전엔 막고 리셋이 지나면 스스로 연다 — 가드가 자기 처방(「리셋 뒤 재호출」)을 거부하면 안 된다', () => {
  새방();
  const 런 = 런모듈();
  delete process.env[런.한도무시키];
  const r = 런.한도기록(실측줄);
  const t = Date.parse(r.리셋시각);
  /* 경계 앞뒤 1초 — 벽시계가 아니라 파싱된 시각 자신을 기준으로 재므로 TZ 무관이다. */
  assert.strictEqual(런.한도막나(런.한도상태(t - 1000)), true, '리셋 전인데 안 막는다 — 15초 즉사를 또 태운다');
  assert.strictEqual(런.한도상태(t + 1000).지남, true, '리셋이 지났는데 「지남」이 아니다');
  assert.strictEqual(런.한도막나(런.한도상태(t + 1000)), false, '리셋이 지났는데 막는다 — 따를 수 없는 처방(F103)');
});

test('리셋 시각을 못 읽은 마커는 막지 않는다(알림만) — 열리는 시각을 모르는 차단은 F103 이다', () => {
  새방();
  const 런 = 런모듈();
  delete process.env[런.한도무시키];
  const r = 런.한도기록("ERROR: You've hit your usage limit. try again at some point");
  assert.ok(r, '한도 오류 자체는 알아봐야 한다(알림 재료)');
  assert.strictEqual(r.리셋시각, null);
  assert.strictEqual(런.한도막나(런.한도상태()), false, '시각 미상인데 막았다');
});

test('--한도무시(env)가 서면 막지 않는다 — 성공 1회 해제로 가는 유일한 문이다', () => {
  새방();
  const 런 = 런모듈();
  런.한도기록(실측줄);
  const 살아있는상태 = 런.한도상태(Date.parse(런.한도상태().리셋시각) - 1000);
  assert.strictEqual(런.한도막나(살아있는상태, { [런.한도무시키]: '1' }), false, '우회 env 가 안 먹힌다');
  assert.strictEqual(런.한도막나(살아있는상태, {}), true, '빈 env 인데 안 막는다 — 우회가 기본값이 됐다');
});

test('마커는 런 목록에 안 선다 — 들이면 「런ID undefined · 멈춤」 유령이 세션마다 알림에 뜬다(첫 실런이 잡음)', () => {
  새방();
  const 런 = 런모듈();
  런.한도기록(실측줄);
  const s = 런.요약();
  /* 분모에 **모든 칸**을 넣는다 — 칸이 늘었는데 여기를 안 넓히면 유령이 새 칸으로 조용히 샌다
   * (F509 에서 '실패미처분' 이 늘었다 · 지침 「초록은 분모와 함께 읽는다」). */
  assert.strictEqual(s.진행.length + s.멈춤.length + s.완주미처분.length + s.실패미처분.length, 0,
    '한도.json 이 런으로 읽혔다 — 유령 멈춤 알림이 진짜 신호를 죽인다');
});

test('한도해제 뒤엔 상태도 차단도 없다 — 성공 1회가 마커를 지우는 자가 치유 경로', () => {
  새방();
  const 런 = 런모듈();
  런.한도기록(실측줄);
  assert.ok(런.한도상태(), '전제: 마커가 있어야 한다');
  런.한도해제();
  assert.strictEqual(런.한도상태(), null, '해제했는데 마커가 남았다 — 풀린 한도를 계속 알린다');
});

// ───────────────────────────────── ③ 배선 핀 — 판정이 실제 통로에 꽂혀 있나

test('배선 핀: codex 깔때기와 던지기 입구가 한도막나 를 부르고, 감지가 catch 에 있다', () => {
  const s = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  const 게이트수 = (s.match(/런\.한도막나\(/g) || []).length;
  assert.ok(게이트수 >= 2, `한도막나 호출이 ${게이트수}곳 — codex() 깔때기와 던지기() 입구 두 곳이 최소다`);
  assert.ok(/런\.한도기록\(/.test(s), '실패 출력에서 마커를 안 적는다 — 다음 세션이 또 태운다');
  assert.ok(/런\.한도해제\(/.test(s), '성공 시 해제가 없다 — 풀린 한도를 영원히 막는다');
  const 훅 = fs.readFileSync(path.join(ROOT, '.claude', 'hooks', 'review-runs.js'), 'utf8');
  assert.ok(/한도상태\(/.test(훅), '훅이 마커를 안 읽는다 — 세션 시작 알림이 없으면 재발견 비용이 그대로다');
});

// ───────────────────────────────── ④ 통합 — 훅 알림 · 던지기 차단 (픽스처 방에서만)

test('훅: 런 0건이어도 살아있는 마커면 알리고, 마커가 지났으면 침묵한다', () => {
  새방();
  const 런 = 런모듈();
  런.한도기록(실측줄);
  살려두기(런);   // 🔑 아래 ⚠ — 실측줄의 날짜에 기대지 않는다
  const env = { ...process.env, SYNK_REVIEW_RUNS: process.env.SYNK_REVIEW_RUNS };
  delete env[런.한도무시키];
  const out = execFileSync(process.execPath, [path.join(ROOT, '.claude', 'hooks', 'review-runs.js')],
    { encoding: 'utf8', env, timeout: 30000 });
  assert.ok(out.includes('한도 소진'), '런 0건 + 마커 → 알림이 없다(세션마다 재발견으로 돌아간다)');
  assert.ok(out.includes('--한도무시'), '알림에 확인 강행 손잡이가 없다 — 처방 없는 차단은 F103 이다');
  assert.ok(!out.includes('멈춘 것'), '마커가 유령 런으로 새어 들었다 — 런 0건인데 멈춤 알림이 떴다');

  /* 지난 마커 → 침묵. 마커를 손으로 과거 리셋으로 바꾼다. */
  const 기록 = JSON.parse(fs.readFileSync(런.한도경로(), 'utf8'));
  기록.리셋시각 = new Date(Date.now() - 60000).toISOString();
  fs.writeFileSync(런.한도경로(), JSON.stringify(기록), 'utf8');
  const out2 = execFileSync(process.execPath, [path.join(ROOT, '.claude', 'hooks', 'review-runs.js')],
    { encoding: 'utf8', env, timeout: 30000 });
  assert.strictEqual(out2.trim(), '', '지난 마커인데 계속 알린다 — 상시 소음은 진짜 신호를 죽인다');
});

test('던지기: 살아있는 마커면 스폰 전에 끊는다 — 런 JSON·장부 던짐행 소음이 0이어야 한다', () => {
  const d = 새방();
  const 런 = 런모듈();
  런.한도기록(실측줄);
  살려두기(런);   // 🔑 아래 ⚠ — 실측줄의 날짜에 기대지 않는다
  const 문서 = path.join(d, '픽스처설계.md');
  fs.writeFileSync(문서, '# 픽스처 — 이 파일은 심문에 닿기 전에 게이트가 끊어야 한다\n', 'utf8');
  const env = { ...process.env, SYNK_REVIEW_RUNS: process.env.SYNK_REVIEW_RUNS, SYNK_REVIEW_CKPT: process.env.SYNK_REVIEW_CKPT };
  delete env[런.한도무시키];
  let status = 0, stderr = '';
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'codex-review.js'), '--심문', 문서, '--던지기'],
      { encoding: 'utf8', env, cwd: ROOT, timeout: 60000 });
  } catch (e) { status = e.status; stderr = String(e.stderr || ''); }
  assert.strictEqual(status, 2, '한도 중 던지기가 통과했다 — 죽을 런을 또 만든다');
  assert.ok(stderr.includes('던지지 않는다'), `차단 사유가 없다: ${stderr.slice(0, 200)}`);
  const 런들 = fs.existsSync(process.env.SYNK_REVIEW_RUNS)
    ? fs.readdirSync(process.env.SYNK_REVIEW_RUNS).filter((f) => f.startsWith('심문-')) : [];
  assert.strictEqual(런들.length, 0, '차단됐는데 런 JSON 이 생겼다 — 「던졌는데 완료 0」 소음이 그대로다');
});

test('🔴 시한폭탄 금지 — 자식을 띄우는 검사는 마커의 «생사»를 값으로 준다(벽시계에 안 기댄다 · F296)', () => {
  /* 왜 등록층인가 — 「이 파일이 언젠가 빨개진다」는 **그날이 오기 전엔 값으로 못 잰다**.
   *   그날 잡으면 이미 늦다(주인 없는 적색이 모두의 배포 게이트를 막는다). 그래서 «기대는 모양»
   *   자체를 금지한다. 실측 2026-08-18: 이 두 검사가 `실측줄` 의 날짜가 미래라는 데 기대고 있었고,
   *   KST 에서는 그날 아침에 이미, UTC 에서도 12:39Z 부터 영구히 빨개질 판이었다. */
  const src = fs.readFileSync(__filename, 'utf8');
  const 자식띄움 = src.split('\ntest(')
    .filter((b) => /execFileSync\(process\.execPath/.test(b) && /한도기록\(실측줄\)/.test(b));
  assert.ok(자식띄움.length >= 2,
    `자식을 띄우면서 실측줄로 마커를 적는 검사를 ${자식띄움.length}건만 찾았다 — 이 회귀가 낡았다(과녁이 사라졌거나 이름이 바뀌었다)`);
  for (const b of 자식띄움) {
    assert.match(b, /살려두기\(/,
      `자식 프로세스를 띄우는데 마커 생사를 실측줄의 날짜에 맡겼다 — 그 날짜가 지나는 순간 «주인 없는 적색»이 된다:\n`
      + `      ${b.split('\n')[0].slice(0, 90)}`);
  }
});

test('자기 처방: 차단문이 시키는 --한도무시 는 인자 검사를 통과한다(F103 — 처방이 거절되면 우회가 정상 통로가 된다)', () => {
  let stderr = '';
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'codex-review.js'), '--한도무시', '--확인'],
      { encoding: 'utf8', cwd: ROOT, timeout: 60000 });
  } catch (e) { stderr = String(e.stderr || ''); }
  assert.ok(!stderr.includes('모르는 인자'), '--한도무시 가 등록되지 않았다 — 차단문의 처방을 도구가 거절한다');
});
