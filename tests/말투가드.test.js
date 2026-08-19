/**
 * voice-guard 회귀 — 학생 접점 말투 가드
 *
 * 왜 있나: 금칙어 8개는 **단어 목록이라 「금칙어 0개인 위반」을 구조적으로 못 잡는다.**
 *   "아직 Lv2밖에 안 됐네요"·"8주 하면 3급 나와요"에는 금칙어가 0개인데 둘 다 위반이다.
 *   정본 = `.claude/skills/synk-brand/SKILL.md` 「반례」 표.
 *
 * 검사 범위 세 층 (CLAUDE.md 가드 맹점 ①②③에 각각 대응):
 *   ① 사람이 실제로 쓰는 표기 — 곡선 따옴표(“ ”)·블록 주석 중간 줄
 *   ② 탐지력은 **픽스처**가 지고, 실저장소는 **거짓양성 0건**만 본다
 *      (실저장소에서 위반을 찾게 하면 「버그가 아직 있을 것을 요구하는 회귀」가 된다)
 *   ③ 자기 처방 — 차단하면서 시키는 ○ 문장이 이 훅을 되먹여 통과하는지
 *
 * 2026-08-06 실측: 1차판이 실저장소에서 거짓양성 12건을 냈다. 원인 셋 —
 *   `졌다`가 `-어지다` 어미("즐거워졌다")에 걸림 4건 · 블록 주석 중간 줄 3건 ·
 *   곡선 따옴표 안의 **금지를 말하는 문장** 2건. 아래가 그 셋을 전부 못박는다.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'voice-guard.js');
const 대상경로 = path.join(ROOT, 'contents_픽스처.js'); // 화이트리스트에 걸리는 이름 (파일은 만들지 않는다)

/** 훅에 Edit 한 건을 먹여 차단 여부를 돌려준다. */
function 훅판정(새문장, file = 대상경로) {
  const input = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: file, new_string: 새문장 },
  });
  const out = execFileSync('node', [HOOK], { input, encoding: 'utf8' });
  if (!out.trim()) return { 차단: false, 사유: '' };
  const j = JSON.parse(out);
  return {
    차단: j.hookSpecificOutput?.permissionDecision === 'deny',
    사유: j.hookSpecificOutput?.permissionDecisionReason || '',
  };
}

/* ── ① 탐지력 — 픽스처. 전부 synk-brand 「반례」 표의 ✕ 칸이다 ────────────── */

const 위반픽스처 = [
  ['결핍프레임', '아직 Lv2밖에 안 됐네요'],
  ['손실강조', '3일 연속이 끊겼어요'],
  ['또래비교', '다른 크루는 벌써 다 냈어요'],
  ['재촉', '이번 기수 마감 임박!'],
  ['기간단정', '8주 하면 3급 나와요'],
  ['부정조건', '숙제 안 하면 왕관 못 받아요'],
  ['오답낙인', '틀렸습니다'],
  ['관용구', '발 벗고 나서 볼까요?'],
  ['금칙어', '이번 시즌은 실패했어요'],
];

for (const [id, 문장] of 위반픽스처) {
  test(`① 탐지 — [${id}] "${문장}"`, () => {
    const r = 훅판정(문장);
    assert.ok(r.차단, `잡아야 하는데 통과했다: ${문장}`);
    assert.ok(r.사유.includes(id), `사유에 규칙 id(${id})가 없다: ${r.사유}`);
  });
}

test('① 금칙어 목록이 스킬(8종)보다 좁지 않다 — 좁은 가드는 그 자체가 구멍', () => {
  for (const w of ['패배', '졌다', '실패', '불운', '하락', '부족', '안 됨', '늦었다']) {
    assert.ok(훅판정(`오늘은 ${w} 입니다`).차단, `금칙어 "${w}"를 안 잡는다`);
  }
});

/* ── ② 자기 처방 (맹점③) — 차단하며 시키는 ○ 문장을 되먹인다 ──────────────── */

test('② 자기 처방 — 훅이 시키는 「이렇게」 문장이 전부 이 훅을 통과한다', () => {
  const src = fs.readFileSync(HOOK, 'utf8');
  const 대신들 = [...src.matchAll(/대신:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(대신들.length >= 9, `처방을 못 읽었다(${대신들.length}개) — 정규식이 낡았다`);
  for (const 처방 of 대신들) {
    const r = 훅판정(처방);
    assert.ok(!r.차단, `자기 처방이 자기 가드에 막힌다 — "${처방}"\n${r.사유}`);
  }
});

/* ── ③ 거짓양성 — 실측으로 드러난 세 형태 ──────────────────────────────── */

test('③ `-어지다` 어미의 「졌다」는 패배가 아니다 (실측 거짓양성 4건의 원인)', () => {
  for (const s of ['학교가 더 즐거워졌다', '서체가 통째로 지워졌다', '실력이 좋아졌다', '글씨가 커졌다']) {
    assert.ok(!훅판정(s).차단, `어미를 패배로 읽었다: ${s}`);
  }
  assert.ok(훅판정('우리가 졌다').차단, '진짜 패배의 「졌다」는 잡아야 한다');
});

test('③ 블록 주석 **중간 줄**도 면제된다 (라인 시작만 보면 샌다)', () => {
  assert.ok(!훅판정('/* 설명\n   순서가 틀렸다. 자리를 먼저 잡는다\n */').차단);
  assert.ok(!훅판정('<!-- 조판 메모\n     그 순서가 틀렸다\n-->').차단);
  assert.ok(훅판정('/* 주석 */\n답이 틀렸습니다').차단, '주석 밖 본문은 그대로 잡아야 한다');
});

test('③ 곡선 따옴표 안은 **언급**이라 통과한다 (맹점① — 한글 문서의 실제 표기)', () => {
  assert.ok(!훅판정('“6개월에 3급” 같은 개월 수 약속을 저희는 하지 않습니다').차단);
  assert.ok(!훅판정('「실패」라는 낱말을 쓰지 않는다').차단);
  assert.ok(!훅판정('"실패"라는 낱말을 쓰지 않는다').차단);
  assert.ok(훅판정('6개월에 3급 만들어 드립니다').차단, '따옴표를 벗기면 다시 잡혀야 한다');
});

test('③ 화이트리스트 밖 파일은 건드리지 않는다 — 규칙 문서가 인질이 되면 안 된다', () => {
  const 밖 = path.join(ROOT, '.claude', 'skills', 'synk-brand', 'SKILL.md');
  assert.ok(!훅판정('아직 Lv2밖에 안 됐네요', 밖).차단, '반례 표를 품은 스킬 자신이 막히면 안 된다');
  /* 2026-08-19 — 이 줄의 사유가 바뀌었다. 「Code.js 는 학생 접점이 아니다」는 **틀린 말이었다**
   * (운세·마스코트 대사·학부모 카드 91개가 거기 산다). 통과하는 이유는 이제 다르다:
   * 구역 밖 편집이라 안 본다. 판정은 같은데 근거가 달라졌으므로 문구를 고친다 —
   * 맞는 얼굴로 틀린 값을 내는 자리(CLAUDE.md 가드 맹점④)가 바로 이런 곳이다. */
  assert.ok(!훅판정('틀렸습니다', path.join(ROOT, 'Code.js')).차단,
    'old_string 이 @학생문구 구역에 안 닿는 편집은 통과한다');
});

test('③ 실저장소 화이트리스트 전량 — 거짓양성 0건 (탐지는 위 픽스처가 진다)', () => {
  execFileSync('node', [HOOK, '--check'], { cwd: ROOT, encoding: 'utf8' }); // 위반 있으면 exit 1 → throw
});

/* 「SNS·DM 은 파일 밖이라 못 막는다」는 절반만 맞았다 — 아래 둘은 파일 안에 있다.
 * 경로 **실재까지** 못박는 이유: 정규식 오타·파일명 변경의 새는 방향은 언제나 「통과」라서,
 * 대상에서 조용히 빠져도 초록은 그대로다(F044 등록층). */
test('③ 파일 안에 있는 SNS·DM 실문구가 대상이다 (경로 실재까지)', () => {
  const 접점 = [
    ['docs', 'DM상담_Phase0_절차서.md'],                                        // Meta 자동응답 실문구
    ['.claude', 'skills', 'synk-content', 'references', '캐러셀', '캐러셀_5세트.md'], // SNS 산출물
  ];
  for (const seg of 접점) {
    const p = path.join(ROOT, ...seg);
    assert.ok(fs.existsSync(p), `${seg.join('/')} 가 없다 — 이름이 바뀌면 규칙이 조용히 빗나간다`);
    assert.ok(훅판정('아직 Lv2밖에 안 됐네요', p).차단, `${seg.join('/')} 가 검사 대상이 아니다`);
  }
});

/* ── ④ 등록층 — 훅이 실제로 발화하는가 (가드는 로직보다 등록층에서 샌다) ──── */

test('④ settings.json 에 등록돼 있고, 라우팅이 훅보다 좁지 않다', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const 등록 = (s.hooks?.PreToolUse || []).filter((h) =>
    (h.hooks || []).some((x) => String(x.command || '').includes('voice-guard.js')));
  assert.equal(등록.length, 1, 'voice-guard 등록이 정확히 1개여야 한다');

  const m = 등록[0].matcher;
  for (const t of ['Edit', 'Write', 'MultiEdit']) {
    assert.ok(new RegExp(`^(${m})$`).test(t), `매처가 ${t}를 안 잡는다 — 훅보다 좁다`);
  }
  const cmd = 등록[0].hooks[0].command;
  assert.ok(!/\.md/.test(cmd), '앞단 필터가 .md로 좁히면 .js·.html 학생 접점이 통째로 샌다');
  assert.ok(/CLAUDE_PROJECT_DIR/.test(cmd), '로컬 절대경로 등록은 다른 기계에서 죽는다(F044)');
  // 실행 불가를 **deny 로 드러낸다** — exit 코드만으로는 조용한 통과와 구분되지 않는다(F044).
  assert.ok(/"permissionDecision":\\?"deny/.test(cmd), '훅을 못 찾을 때 통과가 아니라 차단해야 한다(F044)');
});

/* ── ⑤ 구역 검사 — 엔진 파일 «안»의 학생 문구 (2026-08-19 신설) ──────────────
 *
 * 왜: 「학생 문구는 contents_*.js 에 산다」는 전제로 대상 목록이 짜였는데 실물이 달랐다 —
 *   Code.js 에 91개, 엔진_*.js 7벌에 324개가 훅이 생긴 08-06 이래 무검사였다.
 * 왜 파일 전량이 아닌가: 그날 Code.js 전량 검사가 낸 8건이 **8건 다 거짓양성**이었다
 *   (버전 이력 주석·Logger.log·관리자 메일·원장용 리텐션 신호, 그리고 «금칙어를 지키려고 쓴 주석»).
 *   거짓양성 폭발 → BYPASS 습관 → 다음 사람은 규칙이 아니라 훅을 끈다(맹점③).
 *
 * ⚠ 이 장치가 **틀릴 때의 모습**: 마커를 안 두른 학생 문구는 여전히 무검사인데
 *   `--check` 의 마지막 줄은 「✅ 위반 0건」이다. 그래서 무검사 파일 이름을 그 **앞에** 찍게 했다.
 *   그래도 마지막 줄만 보는 사람은 속는다 — **이 구멍은 안 닫혔다**(엔진 7벌은 대기열 일감).
 * ✅ 대신 **닫은 것 1개**: 위 ③의 「Code.js 는 학생 접점이 아니다」라고 못박던 회귀를 사유째 고쳤다.
 *   그 줄이 남아 있었으면 다음 사람이 그것을 근거로 이 배선을 되돌린다.
 */

const os = require('node:os');

/** 구역 파일 픽스처를 임시로 만들고 훅에 Edit 한 건을 먹인다(실저장소를 안 건드린다). */
function 구역훅판정(본문, old_string, new_string, 이름 = '엔진_픽스처.js') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-guard-구역-'));
  const p = path.join(dir, 이름);
  fs.writeFileSync(p, 본문);
  try {
    const input = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: p, old_string, new_string } });
    const out = execFileSync('node', [HOOK], { input, encoding: 'utf8' });
    if (!out.trim()) return { 차단: false, 사유: '' };
    const j = JSON.parse(out);
    return {
      차단: j.hookSpecificOutput?.permissionDecision === 'deny',
      사유: j.hookSpecificOutput?.permissionDecisionReason || '',
    };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/* 구역 밖 두 줄은 **실측된 거짓양성 형태 그대로**다 — 픽스처가 실물을 안 닮으면 회귀가 아니다. */
const 구역본문 = [
  'function 엔진로직_() { return 1; }',
  "  Logger.log('이어하기 트리거 예약 실패: ' + e);",
  '// @학생문구:시작',
  "const 말 = ['오늘 한 문장만 해봐요'];",
  '// @학생문구:끝',
  "  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 메일 쿼터 부족');",
].join('\n');

test('⑤ 구역 «안» 편집의 위반은 잡는다', () => {
  const r = 구역훅판정(구역본문, "const 말 = ['오늘 한 문장만 해봐요'];", "const 말 = ['아직 Lv2밖에 안 됐네요'];");
  assert.ok(r.차단, '구역 안인데 통과했다 — 배선이 안 닿았다');
  assert.ok(r.사유.includes('결핍프레임'), `사유에 규칙 id 가 없다: ${r.사유}`);
});

test('⑤ 구역 «밖» 편집은 안 본다 — 08-19 실측 거짓양성 8/8 이 이 형태였다', () => {
  for (const [old, neu] of [
    ["  Logger.log('이어하기 트리거 예약 실패: ' + e);", "  Logger.log('이어하기 트리거 예약 실패(재시도): ' + e);"],
    ["  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 메일 쿼터 부족');", "  MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] 메일 쿼터 부족 — 확인');"],
  ]) assert.ok(!구역훅판정(구역본문, old, neu).차단, `구역 밖이 걸렸다: ${old.trim()}`);
});

test('⑤ 마커가 0개면 통째로 통과한다 — fail-open 이 아니라 «좁게 닫기»다', () => {
  const 마커없음 = "const x = ['틀렸습니다'];";
  assert.ok(!구역훅판정(마커없음, 마커없음, "const x = ['정말 틀렸습니다'];").차단,
    '마커 없는 파일을 검사하면 전량 검사와 같아져 거짓양성이 돌아온다');
});

test('⑤ 닫히지 않은 시작 마커는 파일 끝까지 구역이다 — 마커를 지우다 만 편집이 검사를 끄면 안 된다', () => {
  const g = require(HOOK);
  assert.deepEqual(g.구역범위('a\n// @학생문구:시작\nb\nc'), [[1, 3]]);
  assert.equal(g.구역범위('마커가 없는 파일'), null, '마커 0개는 null 이어야 «구역 파일이 아니다»와 구분된다');
});

test('⑤ 구역 밖은 «행 수를 유지한 채» 비운다 — 행 번호가 밀리면 --check 가 자리를 못 짚는다', () => {
  const g = require(HOOK);
  const 잘린것 = g.구역만(구역본문);
  assert.equal(잘린것.split('\n').length, 구역본문.split('\n').length, '행 수가 달라졌다');
  assert.ok(잘린것.includes('해봐요'), '구역 «안»이 지워졌다');
  assert.ok(!잘린것.includes('Logger'), '구역 «밖»이 남았다');
});

test('⑤ 구역 파일 목록이 대상 목록과 갈라지지 않는다 — 같은 판정을 두 곳에 적으면 갈라진다', () => {
  const g = require(HOOK);
  for (const p of ['Code.js', '엔진_수집.js', 'a/b/Code.js']) {
    assert.ok(g.대상인가(p), `${p} 가 대상이 아니다 — 구역 판정 전에 훅이 먼저 빠져나간다`);
    assert.ok(g.구역파일인가(p), `${p} 가 구역 파일이 아니다`);
  }
  assert.ok(g.대상인가('contents_서클.js'), 'contents_*.js 는 여전히 대상이다');
  assert.ok(!g.구역파일인가('contents_서클.js'), 'contents_*.js 는 파일 «전량»이 학생 접점이라 구역 파일이 아니다');
});

test('⑤ --check 가 «구역을 몇 줄 봤는지» 밝힌다 — 「0건」과 「안 봤다」는 같은 모양이다(F207)', () => {
  /* ⚠ 실저장소로 재지 않는다. 저장소에 마커가 몇 벌 있는지는 **오늘의 상태**라,
   *   실저장소로 못박으면 마커를 두르는 날·거두는 날 이 회귀가 깨진다 —
   *   그건 「버그(또는 특정 상태)가 아직 있을 것을 요구하는 회귀」다(맹점②). 능력은 픽스처가 진다. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-guard-분모줄-'));
  const p = path.join(dir, '엔진_구역있음.js');
  fs.writeFileSync(p, 구역본문 + '\n');
  try {
    const out = execFileSync('node', [HOOK, '--check', p], { encoding: 'utf8' });
    assert.match(out, /구역 검사: \d+줄/, '구역을 몇 줄 봤는지 안 밝히면 초록의 분모가 없다');
    assert.doesNotMatch(out, /통째로 무검사/, '마커가 있는데 무검사로 셌다');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('⑤ --check 가 «무검사 파일»을 이름 대고 드러낸다 (F207 — 분모 없는 초록 금지)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-guard-분모-'));
  const p = path.join(dir, '엔진_마커없음.js');
  fs.writeFileSync(p, "const x = ['평범한 문자열'];\n");
  try {
    const out = execFileSync('node', [HOOK, '--check', p], { encoding: 'utf8' });
    assert.match(out, /통째로 무검사/, '무검사 파일을 안 알리면 초록이 거짓말이 된다');
    assert.ok(out.includes('엔진_마커없음.js'), '몇 개인지만 알리고 «이름»을 안 부르면 고칠 수 없다');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
