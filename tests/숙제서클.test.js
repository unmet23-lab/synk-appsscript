/* 숙제 서클 인쇄물 회귀 — 정본 docs/숙제서클_설계.md §3(인쇄 금지 계약·선정 규칙)·§10.
 *
 * 이 파일이 지키는 것은 «종이 위에서만 보이는 사고»다. 서클 인쇄물의 결함은 라이브 로그에
 * 안 남고, 화면 어디에도 안 빨개지고, 종이를 든 학생 앞에서만 드러난다 — 그래서 기계가 본다.
 *
 * 조립 함수는 tools/서클조판.js 의 로더로 «엔진 소스에서 그대로» 떼어 온다(복제 0).
 * 픽스처가 탐지력을 지고, 실저장소에는 거짓양성만 검사한다(CLAUDE.md 가드 맹점 ②).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { 서클모듈, 자수실측, 적합실측, 최악픽스처, 크롬있나 } = require('../tools/서클조판.js');
const { engineSource } = require('./_engine-source.js');
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다(「slice(1) 잔재가 없다」를 적어 둔 자리가 곧 위반이 된다). (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');

const ROOT = path.resolve(__dirname, '..');
const M = 서클모듈();
const 콘텐츠소스 = fs.readFileSync(path.join(ROOT, 'contents_서클.js'), 'utf8');

/* ── 1. 어휘 정합 — 종이의 말과 엔진의 태그가 한 벌인가 ────────────────────── */

test('오류 태그 24종이 «전부» 학생 표현을 갖는다 — 빠진 태그는 종이에서 줄이 통째로 사라진다', () => {
  const m = engineSource().match(/const HW_ERROR_TAGS = \[([\s\S]*?)\];/);
  assert.ok(m, 'HW_ERROR_TAGS 정의를 못 찾았다 — 정본이 옮겨졌다면 이 검사부터 고친다');
  const 태그 = new Function(`return [${m[1]}];`)();
  const 빠짐 = 태그.filter(t => M.CIRCLE_TAG_SAY[t] === undefined);
  assert.deepEqual(빠짐, [],
    `학생 표현이 없는 태그: ${빠짐.join(', ')} — circleTagSay_ 가 빈 문자열을 내고 「한 번 더 볼 자리」 줄이 조용히 사라진다`);
  const 잉여 = Object.keys(M.CIRCLE_TAG_SAY).filter(k => 태그.indexOf(k) < 0);
  assert.deepEqual(잉여, [], `어휘 밖 표현: ${잉여.join(', ')} — 정본에서 사라진 태그의 유물이다`);
});

test('학생 표현에 태그 «코드» 문자열이 안 섞인다 — §3 「오류 태그 코드 노출 금지」', () => {
  Object.keys(M.CIRCLE_TAG_SAY).forEach(k => {
    const v = M.CIRCLE_TAG_SAY[k];
    assert.ok(v.indexOf(':') < 0, `「${k}」의 학생 표현에 콜론이 있다 — 코드가 그대로 새고 있다: ${v}`);
  });
});

/* ── 2. 선정 규칙 — 설계 §3 표를 픽스처로 못박는다 ──────────────────────────── */

const 행 = (day, 문장, 태그, 숙제ID, 재작성) => ({ day, 제출문: 문장, 태그: 태그 || [], 숙제ID: 숙제ID || '', 재작성: !!재작성 });

test('kept ① 지난번에 틀렸다가 이번에 맞은 것을 «재작성 행»으로 집는다(추정 아님)', () => {
  const r = M.circleKeptPick_([
    행('2026-03-10', '그냥 맞은 문장', ['오류없음'], 'A'),
    행('2026-03-10', '고쳐서 맞은 문장', ['오류없음'], 'B', true),
    행('2026-03-03', '틀렸던 문장', ['조사:목적격(을/를)'], 'B')
  ]);
  assert.equal(r.text, '고쳐서 맞은 문장', '재작성 행을 제치고 아무거나 집었다 — ①이 ③으로 접혔다');
});

test('kept ② 최근 반복 영역과 «같은 영역»에서 맞은 것을 우선한다', () => {
  const r = M.circleKeptPick_([
    행('2026-03-10', '상관없는 영역에서 맞음', ['오류없음'], 'Z'),
    행('2026-03-10', '반복 영역에서 맞음', ['오류없음'], 'B'),
    행('2026-03-03', '', ['조사:목적격(을/를)'], 'B'),
    행('2026-03-02', '', ['조사:주격(이/가·은/는)'], 'B')
  ]);
  assert.equal(r.text, '반복 영역에서 맞음', '②가 안 돌았다 — 반복 영역 대조가 죽으면 종이가 「아무 문장」을 칭찬한다');
});

test('kept ④ 맞은 것이 하나도 없어도 «끝까지 제출한 것»을 집는다 — 빈 줄로 두지 않는다', () => {
  const r = M.circleKeptPick_([행('2026-03-10', '틀렸지만 끝까지 낸 문장', ['어순'], 'A')]);
  assert.equal(r.text, '틀렸지만 끝까지 낸 문장');
  assert.equal(M.circleKeptPick_([]), null, '이력 0인데 줄을 만들어 냈다 — 없으면 인쇄하지 않는 것이 §3이다');
});

test('shaky 동률은 «발음 축»(받침)이 이긴다 — ③', () => {
  const r = M.circleShakyPick_([행('2026-03-10', '', ['어순', '맞춤법:받침'], 'A')]);
  assert.equal(r.tag, '맞춤법:받침', '동률에서 발음 축이 밀렸다 — 몽골 학습자 전 레벨 지속 난점이 매번 뒤로 간다');
});

test('shaky 는 학생 표현으로 나오고, 태그 코드는 절대 안 나온다', () => {
  const r = M.circleShakyPick_([행('2026-03-10', '', ['조사:처소(에·에서)'], 'A')]);
  assert.equal(r.text, '에 와 에서 를 고르는 자리');
  assert.ok(r.text.indexOf('조사:') < 0);
});

/* ── 3. trend_line — 종이가 거짓말하지 않는가 ──────────────────────────────── */

test('지난주에 «없던» 자리에는 「지난주에도 나왔어요」를 안 쓴다 — 늘어난 자리를 그렇게 쓰면 거짓이다', () => {
  const rows = [
    행('2026-03-10', '', ['어순'], 'A'),
    행('2026-03-02', '', ['맞춤법:받침'], 'A')   // 지난주에 있던 것은 «다른» 자리
  ];
  assert.equal(M.circleTrendOf_(rows, '어순', '2026-03-10'), '',
    '지난주에 없던 태그에 「지난주에도 나왔어요」가 붙었다 — 종이 위의 거짓말이다');
});

test('줄어든 자리에는 「지난주보다 줄었어요」가 붙는다', () => {
  const rows = [
    행('2026-03-10', '', ['어순'], 'A'),          // 이번 주 1회
    행('2026-03-02', '', ['어순', '어순'], 'A')   // 지난주(8일 전) 2회
  ];
  assert.equal(M.circleTrendOf_(rows, '어순', '2026-03-10'), '지난주보다 줄었어요.');
});

test('「지난주」 창은 7~14일 전이다 — 5일 전 행을 지난주로 세면 대조가 통째로 어긋난다', () => {
  const rows = [행('2026-03-10', '', ['어순'], 'A'), 행('2026-03-05', '', ['어순', '어순'], 'A')];
  assert.equal(M.circleTrendOf_(rows, '어순', '2026-03-10'), '',
    '5일 전을 「지난주」로 셌다 — 같은 주 안의 등락이 주간 대조로 둔갑한다');
});

test('이력 1주 미만이면 줄을 생략한다 — 첫 주에 「지난주」를 말할 수 없다', () => {
  assert.equal(M.circleTrendOf_([행('2026-03-10', '', ['어순'], 'A')], '어순', '2026-03-10'), '');
});

test('trend_line 에 숫자가 안 실린다 — 늘어난 학생에게 숫자는 기죽임이다(§3)', () => {
  const 문형 = new Function(`${콘텐츠소스}\nreturn CIRCLE_TREND_LINES;`)();
  Object.keys(문형).forEach(k => assert.ok(!/[0-9]/.test(문형[k]), `${k} 문형에 숫자가 있다: ${문형[k]}`));
});

/* ── 4. 레벨 — 추측하지 않는가 ─────────────────────────────────────────────── */

test('모르는 레벨 어휘는 «모른다»(-1)고 말한다 — 조용히 Lv1~2 로 접으면 상급반 종이가 통째로 초급이 된다', () => {
  assert.equal(M.circleBandOf_('중급', null), -1, '어휘를 코드가 추측했다 — 매핑은 유호님 확정 사항이다');
  assert.equal(M.circleBandOf_('', null), -1);
  assert.equal(M.circleBandOf_('Lv5', null), 2);
  assert.equal(M.circleBandOf_(3, null), 1);
  assert.equal(M.circleBandOf_('중급', { 중급: '4' }), 1, 'app_state 매핑표를 줬는데도 안 읽었다');
});

/* ── 5. 인쇄 페이로드·조판 계약 ────────────────────────────────────────────── */

test('인쇄 페이로드에 학습자 «식별자»가 0 이다 — 이름만 나간다(§3)', () => {
  const s = M.circleSheetFixture_(12);
  const 평문 = JSON.stringify(s);
  assert.ok(평문.indexOf('sid') < 0 && 평문.indexOf('student_id') < 0,
    '조립 결과에 식별자 키가 실렸다 — 종이·소비자 어디로도 안 나가야 한다');
  s.groups.forEach(g => g.members.forEach(m => {
    assert.ok(m.display_name, '이름 칸이 비었다');
    assert.ok(['진행', '기록', '발표', '질문'].indexOf(m.role) >= 0,
      `role 이 한글 ROLE_NAMES 가 아니다: ${m.role} — 영문 enum 사본 금지(§3)`);
  }));
});

/* 인쇄면 = 종이에 «찍히는» 글자. CSS·태그 이름은 종이에 안 나온다 —
 * 통째로 검사하면 `border-radius:50%` 의 % 같은 것이 걸려, 진짜 위반이 왔을 때
 * 아무도 안 믿는 빨강이 된다(거짓양성이 가드를 죽인다). */
const 인쇄면 = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '');

test('조판 HTML 에 점수·등수·정답률·난도 라벨이 0 이다 — §3 인쇄 금지 계약', () => {
  const 본문 = 인쇄면(M.circleSheetHtml_(M.circleSheetFixture_(12)));
  ['점수', '등수', '정답률', '정답 개수', '난도', '평균', '순위', '％', '%'].forEach(w => {
    assert.ok(본문.indexOf(w) < 0, `인쇄면에 「${w}」가 있다 — 비교·성적 표기는 어느 화면·어느 문서에도 두지 않는다(철학 ㉢)`);
  });
});

test('그 검사가 «실제로» 잡는지 — 점수 한 줄을 심으면 빨개진다(탐지력 픽스처)', () => {
  const s = M.circleSheetFixture_(12);
  s.groups[0].members[0].kept = { text: '오늘 정답률 80% 였어요' };
  const 본문 = 인쇄면(M.circleSheetHtml_(s));
  assert.ok(본문.indexOf('정답률') >= 0 && 본문.indexOf('%') >= 0,
    '심어 둔 위반이 인쇄면에서 사라졌다 — 위 검사는 CSS 만 보고 통과하고 있었다');
});

test('조판 HTML 에 한자·이모지가 0 이다 — 커리큘럼 §6-2 · 인쇄면 금칙(발표물린트 ■9)', () => {
  const 본문 = 인쇄면(M.circleSheetHtml_(M.circleSheetFixture_(12)));
  // 범위는 «코드포인트»로 쓴다 — 옛 글자를 문자 그대로 적으면 검사 파일 자체가 금칙을 어긴다
  // (설명하려는 예시도 안 된다 · 유호 확정 「쓰는 문자는 셋뿐」).
  const 한자 = 본문.match(new RegExp('[\\u4E00-\\u9FFF\\u3400-\\u4DBF]', 'g'));
  assert.equal(한자, null, `인쇄면에 한자: ${(한자 || []).join('')}`);
  const 이모지 = 본문.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu);
  assert.equal(이모지, null, `인쇄면에 이모지: ${(이모지 || []).join('')} — 흑백 인쇄에서 그림문자로 뭉갠다`);
});

test('조 안 순서는 «좌석 회전»이다 — 어떤 축으로도 다시 정렬하지 않는다(정렬하는 순간 종이가 등수를 말한다)', () => {
  const src = engineSource();
  const s = src.indexOf('function circleSheetOf_(');
  const e = src.indexOf('\nfunction circleHwBySid_(', s);
  assert.ok(s > 0 && e > s, 'circleSheetOf_ 구간을 못 찾았다');
  const seg = src.slice(s, e);
  assert.ok(!/\.sort\(/.test(seg.replace(/members:[^\n]*\n/g, '')),
    'circleSheetOf_ 안에서 정렬이 돈다 — 좌석 순서 말고 다른 축이 종이에 실릴 수 있다');
});

test('빈 학생 칸을 그리지 않는다 — 3인 조·결석 자리의 빈 칸은 낙인이다(§3)', () => {
  const s = M.circleSheetFixture_(12);
  s.groups[0].members = s.groups[0].members.slice(0, 3);
  const html = M.circleSheetHtml_(s);
  const 칸 = html.match(/class="z"/g) || [];
  assert.equal(칸.length, 4, `머리 1 + 학생 3 = 4칸이어야 하는데 ${칸.length}칸이 그려졌다`);
});

test('제출 못 한 학생 칸이 «모양»으로 드러나지 않는다 — 이름표만 「오늘 볼 것」으로 바뀐다(§3 예외)', () => {
  const 어제 = '2026-03-10';
  const 낸사람 = M.circleMemberCard_({ name: '가', role: '진행' },
    [행(어제, '어제 낸 문장', ['어순'], 'A')], 1, 어제);
  const 못낸사람 = M.circleMemberCard_({ name: '나', role: '기록' },
    [행('2026-03-05', '지난주 문장', ['어순'], 'A')], 1, 어제);
  assert.ok(Object.keys(낸사람).every(k => Object.keys(못낸사람).indexOf(k) >= 0),
    '칸의 «필드 모양»이 갈렸다 — 소비자가 제출 여부를 그 차이로 읽을 수 있다');
  assert.equal(못낸사람.next_one.label, '오늘 볼 것');
  const html = M.circleSheetHtml_({ class_id: 'A', session_no: 12, groups: [{ group_no: 1, warmup_question: { text: 'Q' }, members: [못낸사람] }] });
  ['미제출', '안 냈', '못 냈', '결석'].forEach(w =>
    assert.ok(html.indexOf(w) < 0, `종이에 「${w}」가 있다 — 제출/미제출 표시 0 이 계약이다`));
});

/* ── 6. 질문 카드 풀 ───────────────────────────────────────────────────────── */

test('결 4종 × 레벨 밴드 3 이 «전부» 차 있고, 같은 칸에 중복 카드가 없다', () => {
  M.CIRCLE_TONE_ORDER.forEach(tone => {
    const 밴드들 = M.CIRCLE_QUESTION_CARDS[tone];
    assert.ok(Array.isArray(밴드들) && 밴드들.length === 3, `결 「${tone}」의 밴드가 3칸이 아니다`);
    밴드들.forEach((pool, b) => {
      assert.ok(pool.length >= 4, `결 「${tone}」 밴드 ${b} 카드가 ${pool.length}장뿐 — 시즌 안에 같은 카드가 돌아온다`);
      assert.equal(new Set(pool).size, pool.length, `결 「${tone}」 밴드 ${b} 에 같은 카드가 두 번 있다`);
    });
  });
});

test('질문 카드가 차시로 돈다 — 한 시즌(40차시) 안에서 같은 결이 같은 카드를 연달아 내지 않는다', () => {
  const 본것 = {};
  for (let n = 1; n <= 40; n++) {
    const c = M.circleWarmupOf_(n, 1);
    const k = c.tone;
    if (본것[k] && 본것[k] === c.text) assert.fail(`${n}차시에 결 「${k}」 카드가 직전과 같다: ${c.text}`);
    본것[k] = c.text;
  }
  assert.equal(M.circleWarmupOf_(1, 1).tone, '사실', '결의 순환 시작이 바뀌었다 — 학생에게는 이게 리듬이다');
});

test('질문 카드에 학생끼리 «비교»하게 만드는 말이 없다 — 철학 ㉢', () => {
  const 금지 = ['누가 제일', '가장 잘하는 사람', '누가 더 잘', '반에서 제일', '누구보다'];
  M.CIRCLE_TONE_ORDER.forEach(tone => M.CIRCLE_QUESTION_CARDS[tone].forEach(pool => pool.forEach(q => {
    금지.forEach(w => assert.ok(q.indexOf(w) < 0, `비교를 부르는 카드: 「${q}」`));
    assert.ok(/[?？]$/.test(q) || /주세요\.$/.test(q), `물음도 청유도 아닌 카드: 「${q}」`);
    assert.ok((q.match(/[?？]/g) || []).length <= 2, `한 장에 물음이 셋 이상이다 — 브리핑 2분 30초를 넘긴다: 「${q}」`);
  })));
});

/* ── 7. 라이브 배선 — 새 파일이 실제로 올라가는가 ──────────────────────────── */

test('contents_서클.js 가 clasp 허용목록과 filePushOrder 에 있다 — 빠지면 라이브에서 ReferenceError 로 반쪽 배포', () => {
  const ig = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8');
  assert.ok(/^!contents_\*\.js$/m.test(ig) || /^!contents_서클\.js$/m.test(ig),
    '.claspignore 허용목록에 없다 — 기본값이 「제외」라 라이브에 아예 안 올라간다');
  const cj = JSON.parse(fs.readFileSync(path.join(ROOT, '.clasp.json'), 'utf8'));
  assert.ok(cj.filePushOrder.indexOf('contents_서클.js') >= 0, 'filePushOrder 에 없다');
});

test('서클 절이 contents_서클.js 전역을 «톱레벨»에서 안 읽는다 — 파일 초기화 순서에 물리면 전 트리거가 죽는다', () => {
  const src = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const s = src.indexOf('/* ═════════════ 🟨 숙제 서클');
  const e = src.indexOf('/* ═════════════ [v9.86·D]', s);
  assert.ok(s > 0 && e > s, '서클 절 표식을 못 찾았다');
  const 톱레벨 = src.slice(s, e).split('\n')
    .filter(l => /^(const|let|var)\s/.test(l)).join('\n');
  Object.keys({ CIRCLE_TAG_SAY: 1, CIRCLE_FRAMES: 1, CIRCLE_QUESTION_CARDS: 1, CIRCLE_TONE_ORDER: 1, CIRCLE_START_LINES: 1, CIRCLE_TREND_LINES: 1, CIRCLE_BAND_NAMES: 1 })
    .forEach(n => assert.ok(톱레벨.indexOf(n) < 0, `톱레벨에서 ${n} 을 읽는다 — 함수 안(호출 시점)으로 옮겨야 한다`));
});

/* ── 8. 레벨 「모름」이 조용히 초급으로 접히지 않는다 ─────────────────────────
 * 설계 §10 「추측하지 않는다」. 접히면 상급반 종이가 통째로 초급 문장 틀로 나가는데,
 * 그 사고는 화면 어디에서도 안 빨개지고 조 머리의 질문 카드부터 시작된다. */

test('밴드를 모르면(-1) 질문 카드를 «안 낸다» — 0(Lv1~2)으로 접지 않는다', () => {
  for (let n = 1; n <= 12; n++) {
    assert.equal(M.circleWarmupOf_(n, -1).text, '',
      `${n}차시에 밴드 모름이 카드를 냈다 — Lv1~2 로 접혀 상급반 조 머리에 초급 질문이 인쇄된다`);
    assert.equal(M.circleWarmupOf_(n, -1).tone, M.circleWarmupOf_(n, 1).tone, '결(리듬)까지 사라지면 안 된다');
  }
  // 탐지력 — 아는 밴드는 «반드시» 카드를 낸다(위 검사가 전부 빈 문자열이면 그냥 초록이 된다)
  [0, 1, 2].forEach(b => assert.ok(M.circleWarmupOf_(7, b).text.length > 0,
    `밴드 ${b} 가 카드를 못 냈다 — 이 검사가 눈이 멀었다`));
});

test('밴드를 모르면 첫날 «시작 문장»도 안 낸다 — 문장 틀만 맞고 이 줄만 접혀 있었다', () => {
  const 모름 = M.circleMemberCard_({ name: '가', role: '진행' }, [], -1, '2026-03-10');
  assert.equal(모름.next_one, null, '밴드 모름인데 시작 문장이 나갔다 — CIRCLE_START_LINES[0] 으로 접힌 자리');
  assert.equal(모름.frame, null, '문장 틀은 이미 안 나가던 자리다(여기가 빨개지면 그 보장이 깨진 것)');
  // 탐지력 — 아는 밴드는 시작 문장을 낸다
  [0, 1, 2].forEach(b => {
    const c = M.circleMemberCard_({ name: '가', role: '진행' }, [], b, '2026-03-10');
    assert.ok(c.next_one && c.next_one.text === M.CIRCLE_START_LINES[b],
      `밴드 ${b} 의 첫날 시작 문장이 사라졌다 — 이 검사가 눈이 멀었다`);
  });
});

test('물음이 없으면 빈 상자를 그리지 않는다 — 테두리만 남은 칸은 「오늘은 질문이 없다」로 읽힌다', () => {
  const s = M.circleSheetFixture_(12);
  s.groups[0].warmup_question = M.circleWarmupOf_(12, -1);
  const 상자 = (h) => h.indexOf('<div class="qcard">') >= 0;   // 'qcard' 만 세면 CSS 규칙에 걸려 늘 초록이다
  assert.ok(!상자(M.circleSheetHtml_(s)), '빈 질문 상자가 그려졌다');
  assert.ok(상자(M.circleSheetHtml_(M.circleSheetFixture_(12))),
    '물음이 있는 평시에도 상자가 없다 — 이 검사가 눈이 멀었다');
});

/* ── 9. 굽기 «전»에 칸을 잰다 ────────────────────────────────────────────────
 * `.z` 는 overflow:hidden 이라 학생 줄이 넘치면 종이 위에서 «없는 줄»과 똑같이 보인다.
 * 탐지력은 픽스처가 지고(크롬 불요), 상수의 출처는 헤드리스 실측이 진다(크롬 있을 때만). */

const 긴카드 = (이름, 자수) => ({
  display_name: 이름, role: '진행',
  kept: { text: new Array(자수 + 1).join('가') },
  shaky: { tag: '어순', text: new Array(자수 + 1).join('나'), trend_line: '' },
  next_one: { label: '오늘 볼 것', text: '짧은 줄', check: true }
});

test('학생 줄이 칸을 넘기면 «굽기 전»에 잡는다 — 탐지력 픽스처', () => {
  const 넘침 = { groups: [{ group_no: 1, members: [긴카드('가', 400), 긴카드('나', 400), 긴카드('다', 400), 긴카드('라', 400)] }] };
  const 잡힌것 = M.circleTightOf_(넘침);
  assert.equal(잡힌것.length, 4, `학생 줄만으로 넘긴 칸 4개 중 ${잡힌것.length}개만 잡았다 — 이 눈으로는 조용한 잘림을 못 막는다`);
  assert.equal(잡힌것[0].name, '가', '이름이 안 실렸다 — 강사가 누구 칸인지 모른다');
  assert.ok(잡힌것[0].걷음.length > 0, '무엇을 걷었는지 안 말한다 — 줄어든 칸이 「원래 그런 칸」과 구별이 안 된다');
  // 「모자람」은 이제 0 이어야 한다 — 걷기 사다리(④ kept 까지)가 잔여 넘침을 구조적으로 없앴다.
  // 여기가 0 이 아니면 사다리가 끊긴 것이고, 그 순간 CSS 가 문장 중간을 삼킨다.
  assert.deepEqual(잡힌것.filter(t => t.모자란mm > 0), [],
    '다 걷고도 모자란 칸이 남았다 — overflow:hidden 이 학생 문장을 자르는 자리가 다시 열렸다');
});

test('재기만 하지 않고 «걷어서 막는다» — 보조 줄부터, 학생 문장은 한 글자도 안 다듬는다', () => {
  // 보조 줄만 걷으면 들어가는 크기 — 여기서 걷어야 CSS 가 문장 중간을 삼키지 않는다
  const m = {
    display_name: '어트건바야르', role: '진행',
    kept: { text: new Array(201).join('가') },
    shaky: { tag: '어순', text: new Array(60).join('나'), trend_line: '이 자리는 지난주에도 나왔어요' },
    next_one: { label: '오늘 볼 것', text: '짧은 줄', check: true }
  };
  const 담기는 = 59.4 - M.CIRCLE_FIT.칸여백mm;
  assert.ok(M.circleKeepMm_(m) > 담기는, '픽스처가 애초에 안 넘친다 — 이 검사가 눈이 멀었다');
  const r = M.circleFitCard_(m, 담기는);
  assert.ok(r.걷음.length > 0, '안 들어가는데 아무것도 안 걷었다 — 경고만 붙이고 잘림은 그대로다');
  assert.equal(r.걷음[0], '지난주 대조', '걷는 순서가 바뀌었다 — 보조물부터 걷어야 한다');
  assert.equal(r.card.kept.text, m.kept.text, '학생 문장이 바뀌었다 — §3 「원문 그대로」 위반');
  if (r.card.shaky) assert.equal(r.card.shaky.text, m.shaky.text, '학생 문장이 다듬어졌다');
  assert.ok(M.circleKeepMm_(r.card) <= 담기는, `걷고도 안 들어간다(${M.circleKeepMm_(r.card).toFixed(1)}mm > ${담기는.toFixed(1)}mm)`);
  // 종이에 실제로 반영되는가 — 걷은 줄이 HTML 에서 사라져야 한다
  const html = M.circleSheetHtml_({ class_id: 'A', session_no: 12, groups: [{ group_no: 1, warmup_question: { text: 'Q' }, members: [m, m, m, m] }] });
  assert.ok(html.indexOf('이 자리는 지난주에도 나왔어요') < 0, '걷었다고 해놓고 종이에는 그대로 나갔다 — 렌더러가 원본 카드를 탄다');
  assert.ok(html.indexOf(m.kept.text) > 0, '학생 문장이 종이에서 사라졌다');
});

test('이름줄도 «잰다» — 긴 이름이 접히는 날 예측이 실물보다 낮아지면 그게 조용한 잘림이다', () => {
  const 카드 = (이름, 역할) => ({ display_name: 이름, role: 역할, kept: { text: '짧다' }, shaky: null, next_one: null });
  const 짧은 = M.circleKeepMm_(카드('바트', '진행'));
  const 긴 = M.circleKeepMm_(카드(new Array(M.CIRCLE_FIT.이름자수 + 6).join('가'), '진행'));
  assert.ok(긴 > 짧은, `이름 길이가 예측을 안 바꾼다(${짧은}mm = ${긴}mm) — 이름줄이 고정 1줄로 박혀 있다`);
  // 한 줄 더 접히면 «줄높이»만 는다 — 여백까지 같이 늘면 문단 여백을 줄마다 곱한 것이다(검수 P2 f9a9f133)
  assert.ok(Math.abs((긴 - 짧은) - M.CIRCLE_FIT.이름줄mm) < 0.01,
    `접힌 줄이 ${(긴 - 짧은).toFixed(2)}mm 늘었다 — 줄높이(${M.CIRCLE_FIT.이름줄mm}mm)만 늘어야 한다`);
  // 역할도 같은 줄을 먹는다 — 이름만 세면 긴 역할명이 온 날 또 낮게 본다
  assert.ok(M.circleKeepMm_(카드(new Array(M.CIRCLE_FIT.이름자수).join('가'), new Array(20).join('나'))) > 짧은,
    '역할 길이가 예측을 안 바꾼다 — .nm 은 이름과 역할이 한 줄을 나눠 쓴다');
});

test('보조 줄을 다 걷어도 넘치면 «학생 줄도 통째로» 뺀다 — 잘린 종이가 구조적으로 안 나온다', () => {
  // 한 문장이 칸을 통째로 넘기는 병리적 크기 — 여기서 멈추면 CSS 가 문장 중간을 삼킨다(검수 P1 e5f44c12)
  const 괴물 = { display_name: '가', role: '진행', kept: { text: new Array(801).join('가') }, shaky: null, next_one: null };
  const 담기는 = 59.4 - M.CIRCLE_FIT.칸여백mm;
  const r = M.circleFitCard_(괴물, 담기는);
  assert.ok(M.circleKeepMm_(r.card) <= 담기는,
    `다 걷고도 안 들어간다(${M.circleKeepMm_(r.card).toFixed(1)}mm) — overflow:hidden 이 학생 문장을 자른다`);
  assert.ok(r.걷음.indexOf(M.CIRCLE_LABELS.kept) >= 0, '무엇을 뺐는지 안 말한다 — 강사가 빈 칸의 이유를 모른다');
  assert.deepEqual(M.circleTightOf_({ groups: [{ group_no: 1, members: [괴물, 괴물, 괴물, 괴물] }] })
    .filter(t => t.모자란mm > 0), [], '걷고도 「모자람」이 남는다 — 잘림이 구조적으로 안 닫혔다');
});

test('키릴을 라틴으로 갈음하지 않는다 — 몽골 이름의 기본 문자이고 실측이 더 넓다(0.544 vs 0.481)', () => {
  const 카드 = (이름) => ({ display_name: 이름, role: '진행', kept: { text: '짧다' }, shaky: null, next_one: null });
  // 길이는 «줄 경계를 가르는» 자리로 고른다 — 아무 길이나 대면 둘 다 1줄이라 차이가 양자화에 먹힌다.
  //   60자: 키릴 60×.544=32.6 < 이름자수 44(1줄) · 라틴 상한 60×.953=57.2 > 44(2줄)
  const 키릴 = new Array(61).join('б'), 넓은라틴 = new Array(61).join('W');
  assert.ok(M.circleKeepMm_(카드(키릴)) < M.circleKeepMm_(카드(넓은라틴)),
    '키릴이 라틴 «상한» 폭으로 센다 — 갈래가 지워졌다(검수 P3 a6af8cae · 라틴비를 대문자 W 로 올린 뒤로는 ' +
    '해가 넘침이 아니라 «과잉 걷기»다: 멀쩡히 들어가는 학생 줄을 걷어낸다)');
  assert.ok(M.CIRCLE_FIT.키릴비 > 0 && M.CIRCLE_FIT.키릴비 !== M.CIRCLE_FIT.라틴비,
    '키릴비가 라틴비와 같다 — 따로 잰 값이 아니다. --자수 로 다시 잰다');
});

test('안 넘치는 칸은 «아무것도» 안 걷는다 — 걷기가 평시로 새면 종이가 매일 반쪽이 된다', () => {
  M.circleSheetFixture_(12).groups[0].members.forEach(m => {
    const r = M.circleFitCard_(m, 59.4 - M.CIRCLE_FIT.칸여백mm);
    assert.deepEqual(r.걷음, [], `평시 칸에서 「${r.걷음.join('·')}」을 걷었다`);
    assert.equal(r.card, m, '평시인데 카드를 새로 만들었다 — 원본 그대로 통과해야 한다');
  });
});

test('굽기 «전»에 잰다 — `createFile` 뒤에 재면 그건 막는 게 아니라 나간 종이를 설명하는 것이다', () => {
  const src = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const 본문 = src.slice(src.indexOf('function printCircleSheets('), src.indexOf('function circleSheetsAuto_('));
  assert.ok(본문.indexOf('circleTightOf_(sheet)') > 0 && 본문.indexOf('folder.createFile') > 0, '표식을 못 찾았다');
  assert.ok(본문.indexOf('circleTightOf_(sheet)') < 본문.indexOf('folder.createFile'),
    '적합 측정이 파일 생성 «뒤»다 — 잘린 종이가 이미 만들어진 뒤에 경고가 붙는다(검수 P1 f8603b2b)');
  // 잔여 넘침은 사다리가 구조적으로 없앴지만, 도달했다면 그건 «예측이 낮게 본» 것이다 — 그때는 안 굽는다
  assert.ok(본문.indexOf('if (넘친것.length) {') > 0 && 본문.indexOf('if (넘친것.length) {') < 본문.indexOf('folder.createFile'),
    '잘릴 것을 알고도 파일을 만든다 — 경고는 막는 것이 아니다(검수 P1 f3559b5f)');
  assert.ok(/if \(넘친것\.length\) \{[\s\S]*?return;[\s\S]*?\}/.test(본문), '넘침을 알고도 굽는 자리로 흘러간다');
  // 열람 권한 실패를 «삼키면» 강사는 안 열리는 링크를 받고 아무도 이유를 모른다(검수 P1 2ce886d2)
  assert.ok(/권한실패\.push\(t\.email\)/.test(본문) && /권한실패\.length\) 경고\.push/.test(본문),
    'addViewer 실패를 빈 catch 로 버린다 — 「액세스 요청」 화면이 뜨는데 보고엔 아무 말이 없다');
});

test('리허설 중엔 실물 종이를 굽지 않는다 — 도장이 남으면 진짜 수업날 종이가 안 나온다', () => {
  const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const 본문 = 셋업.slice(셋업.indexOf('function circleSheetsAuto_('), 셋업.indexOf('function circleBatchDone_('));
  assert.ok(/isRehearsal_\(\)/.test(본문), '리허설 격리가 없다 — 리허설 산출물이 Drive 와 도장에 남는다(검수 P2 0fc810dc)');
  assert.ok(본문.indexOf('isRehearsal_()') < 본문.indexOf('LockService'), '락보다 뒤에서 막는다 — 이미 일한 뒤다');
});

test('빈 출석 배치를 «확정»으로 읽지 않는다 — 결석자가 실린 종이가 자동으로 나간다', () => {
  const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const 본문 = 셋업.slice(셋업.indexOf('function circleBatchDone_('), 셋업.indexOf('function circleStampOf_('));
  assert.ok(/'전개완료'/.test(본문), '전개완료 도장을 안 본다');
  assert.ok(/r\[2\][\s\S]*?trim\(\) !== ''/.test(본문),
    '출석자목록이 비었는지 안 본다 — 빈 배치도 전개완료로 찍히고, 그러면 편성 전원이 인쇄된다(검수 P1 3338367d)');
});

test('`--넘침시험`은 브라우저 «안에서» 부풀린다 — 걷기가 그 시험의 눈을 멀게 했던 자리다', () => {
  const 도구 = fs.readFileSync(path.join(ROOT, 'tools', '서클조판.js'), 'utf8');
  const 본문 = 도구.slice(도구.indexOf("argv.includes('--넘침시험')"), 도구.indexOf("argv.includes('--자수')"));
  assert.ok(/const 부풀리기 = `/.test(본문) && /keep\.appendChild\(p\)/.test(본문),
    '카드를 부풀려 circleSheetHtml_ 에 넣는다 — circleFitCard_ 가 그 줄을 먼저 걷어 0/4 가 나온다(검수 P1 30e26a7d)');
  // 넣는 쪽도 «쪽마다» 머리를 가려야 한다 — 재는 쪽만 고치고 여기 잔재가 남아 있었다(검수 P1 69d2304d)
  assert.ok(/parentElement\.querySelector\('\.z'\) === z\) return;/.test(본문),
    '부풀리기가 머리 칸을 안 가린다 — 다중 조에서 둘째 쪽 머리를 학생 칸처럼 부풀린다');
  const 본문코드 = 코드만(본문);
  assert.ok(!/\.slice\(1\)/.test(본문코드), '부풀리기에 slice(1) 잔재가 남아 있다 — 문서 첫 칸만 건너뛴다');
  assert.ok(!/m\.kept = \{ text:/.test(본문코드), '옛 방식(카드 kept 부풀리기)이 남아 있다 — 걷기가 그걸 먼저 지운다');
  // 실측 자체는 크롬이 필요하다 — 여기서는 «어느 층에서 부풀리는가»만 못박는다(F296)
});

test('머리 칸은 «쪽마다» 있다 — 첫 칸 하나만 빼면 조가 둘 이상일 때 학생 칸과 섞인다', () => {
  const 도구 = fs.readFileSync(path.join(ROOT, 'tools', '서클조판.js'), 'utf8');
  assert.ok(/z\.parentElement\.querySelector\('\.z'\) === z/.test(도구),
    '머리 칸을 문서 인덱스(i===0)로 가른다 — 둘째 쪽 머리가 학생 칸으로 센다(검수 P2 6f1bcc3f)');
  assert.ok(!/잰것\.slice\(1\)/.test(코드만(도구)), 'slice(1) 로 머리를 빼는 자리가 남아 있다 — 첫 쪽만 빠진다');
  assert.ok((도구.match(/filter\(z => !z\.머리\)/g) || []).length >= 2,
    '머리 판정을 쓰는 소비자가 둘(적합실측·넘침시험) 다 안 바뀌었다');
});

test('동그라미의 «폭»도 센다 — 높이만 세면 그 줄이 한 줄 더 접히는 날을 못 본다', () => {
  const 틀 = (체크) => ({
    display_name: '가', role: '진행', kept: null, shaky: null,
    // 50자 = 줄 «경계»다(라벨 뒤 여유 ≈51자) — 아무 길이나 대면 둘 다 1줄이라 차이가 양자화에 먹히고,
    //   그러면 체크줄mm(5.97) vs 줄mm(5.91) 의 0.06mm 만 남아 「폭을 안 센다」를 못 잡는다(4차 변이 실측).
    next_one: { label: '오늘 볼 것', text: new Array(51).join('가'), check: 체크 }
  });
  assert.ok(M.circleKeepMm_(틀(true)) - M.circleKeepMm_(틀(false)) >= M.CIRCLE_FIT.줄mm,
    '동그라미 때문에 한 줄 더 접히는 것을 못 본다 — 폭이 계산에서 빠졌다(검수 P2 cee4b75f)');
  assert.ok(M.CIRCLE_FIT.체크비 > 1, '체크비가 실측값이 아니다 — `--자수` 로 다시 잰다');
});

test('평시 픽스처에는 «거짓 경고»가 0 이다 — 과대예측은 진짜 경고까지 같이 죽인다', () => {
  assert.deepEqual(M.circleTightOf_(M.circleSheetFixture_(12)), [],
    '평시에 넘침 경고가 났다 — 매번 뜨는 경고는 곧 안 읽히는 경고다');
});

test('칸 높이 배분 — 평시엔 지금까지 그대로, 긴 제출문이 오면 «필요한 만큼» 옮긴다', () => {
  const 평시 = M.circleSheetFixture_(12).groups[0].members;
  M.circleZoneHeights_(평시).forEach(h => assert.ok(Math.abs(h - 59.4) < 0.01,
    `4인 조 평시 칸이 59.4mm 가 아니다(${h}) — 안 넘치는 날의 종이까지 바꿨다`));
  const 셋 = 평시.slice(0, 3);
  M.circleZoneHeights_(셋).forEach(h => assert.ok(Math.abs(h - 79.2) < 0.01,
    `3인 조가 79.2mm 가 아니다(${h}) — 빈 자리를 나눠 갖는 §3 규약이 깨졌다`));
  // 한 명만 길면 그 칸이 커지고, 주는 쪽은 «자기 필요분 아래로» 안 내려간다
  const 섞임 = [긴카드('긴사람', 300), 평시[1], 평시[2], 평시[3]];
  const h = M.circleZoneHeights_(섞임);
  assert.ok(h[0] > 59.4, '긴 칸이 안 커졌다 — 옆 칸은 여백을 남긴 채 이 사람만 잘린다');
  assert.ok(Math.abs(h.reduce((a, b) => a + b, 0) - 237.6) < 0.01, 'A4 한 쪽(237.6mm)을 벗어났다 — 쪽이 밀린다');
  h.slice(1).forEach((x, i) => assert.ok(x >= M.circleKeepMm_(섞임[i + 1]) + M.CIRCLE_FIT.칸여백mm - 0.01,
    '주는 쪽이 자기 필요분 아래로 내려갔다 — 옮기다가 새 잘림을 만들었다'));
});

test('줄 이름표는 한 벌뿐 — 재는 쪽과 그리는 쪽에 따로 적으면 문구가 갈리는 날 예측만 틀어진다', () => {
  const src = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const 절 = src.slice(src.indexOf('/* ═════════════ 🟨 숙제 서클'), src.indexOf('/* ═════════════ [v9.86·D]'));
  [M.CIRCLE_LABELS.kept, M.CIRCLE_LABELS.shaky].forEach(라벨 => {
    const 박힌횟수 = (절.match(new RegExp(`'${라벨}'`, 'g')) || []).length;
    assert.equal(박힌횟수, 1, `「${라벨}」이 ${박힌횟수}곳에 문자열로 박혀 있다 — CIRCLE_LABELS 한 곳에서만 온다`);
  });
});

/* ── 10. 상수의 출처 = 실측(크롬 없으면 skip — repo 밖 환경을 fail 로 만들지 않는다 · F296) ── */

test('CIRCLE_FIT 이 실물 CSS 아래서 «다시 재도» 같다 — 지어 박은 상수가 아니다', (t) => {
  // 🔑 skip 은 「크롬이 없다」에만 준다. 예외를 통째로 삼키면 HTML 깨짐·선택자 유실·측정기 오류까지
  //    「크롬 없음」으로 사라져 이 회귀가 CI 에서 조용히 죽는다(검수 P2 5c774a0d).
  if (!크롬있나()) return t.skip('헤드리스 크롬이 없다 — repo 밖 환경은 fail 이 아니라 skip 이다(F296)');
  const r = 자수실측();
  Object.keys(r).forEach(k => assert.equal(M.CIRCLE_FIT[k], r[k],
    `CIRCLE_FIT.${k} 가 실측(${r[k]})과 다르다(${M.CIRCLE_FIT[k]}) — CSS·서체가 바뀌었으면 ` +
    '`node tools/서클조판.js --자수` 로 다시 재서 옮긴다'));
  assert.equal(Object.keys(M.CIRCLE_FIT).length, Object.keys(r).length, '엔진 상수와 실측 항목 수가 다르다');
});

test('«굽기 전» 예측이 실물보다 작지 않다 — 낮게 보면 조용한 잘림이 그대로 돌아온다', (t) => {
  if (!크롬있나()) return t.skip('헤드리스 크롬이 없다 — repo 밖 환경은 fail 이 아니라 skip 이다(F296)');
  const 표 = 적합실측(M, 최악픽스처(M, 12));   // 측정 실패는 여기서 throw 로 드러난다(skip 이 아니다)
  표.forEach(x => assert.ok(x.어긋남mm >= 0,
    `${x.이름} 칸의 예측(${x.예측mm}mm)이 실물(${x.실물mm}mm)보다 작다 — 이 모델로는 잘림을 못 막는다`));
  // 안전한 쪽으로 틀리되 «너무» 크게 틀리면 거짓 경고가 된다
  표.forEach(x => assert.ok(x.어긋남mm <= 6,
    `${x.이름} 칸의 예측이 실물보다 ${x.어긋남mm}mm 크다 — 과대예측이 커지면 평시에도 경고가 뜬다`));
});

/* ── 11. 자동 인쇄 배선 — 「앱이 매 차시 자동 인쇄」(설계 §0·③ 운영 게이트) ───── */

test('출석 «확정 뒤»에 발화한다 — attendance 전개 다음 자리이고, 확정 없는 반은 안 굽는다', () => {
  const ai = fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');
  const sweep = ai.slice(ai.indexOf('function parentSweep()'), ai.indexOf('function parentSweep()') + 4000);
  const 전개 = sweep.indexOf('expandAttendanceBatch_');
  const 인쇄 = sweep.indexOf('circleSheetsAuto_');
  assert.ok(전개 > 0 && 인쇄 > 0, 'parentSweep 에 자동 인쇄 배선이 없다 — 「수동 실행」으로 남으면 §0 전제가 안 선다');
  assert.ok(인쇄 > 전개, '출석 전개보다 «앞»에서 굽는다 — 그 틱의 확정을 못 보고 결석자 칸이 실려 나간다');
  assert.ok(/safeRun\('circleSheetsAuto'/.test(sweep), 'safeRun 밖이다 — 여기서 throw 하면 뒤의 알림·보드가 함께 멈춘다');

  const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const 본문 = 셋업.slice(셋업.indexOf('function circleSheetsAuto_('), 셋업.indexOf('function menuPrintCircleSheets('));
  assert.ok(/circleBatchDone_\(ss, c, day, tz\)/.test(본문),
    '개별 attendance 행을 확정으로 읽는다 — QR 은 학생당 한 행씩 들어와서 첫 한 명으로 부분 명단이 나간다(검수 P1 f5f43034)');
  assert.ok(/!sheet\.보고\.출석확정/.test(본문),
    '배치 도장만 보고 굽는다 — 목록 ID 가 전부 무효면 attendance 0 이라 편성 전원이 인쇄된다(검수 P1 b2e79b22)');
  // 「굽지 않았다」를 완료로 찍으면 그날 재시도가 통째로 막힌다 — 파일 생성 여부를 «문자열이 아니라» 배열로 받는다
  assert.ok(/const 구운반 = \[\];/.test(본문) && /printCircleSheets\(c, 구운반\)/.test(본문),
    '반환 문자열만 보고 도장을 찍는다 — ⛔·⚠ 결과도 완료로 남는다(검수 P1 ee142cdd)');
  // ⚠ indexOf 가 -1 일 때 「앞에 있다」로 통과하던 자리 — 존재부터 못박는다(5차 변이 실측)
  const 문 = 본문.indexOf('if (!구운반.length) return;');
  assert.ok(문 > 0 && 문 < 본문.indexOf('도장.구움[c] = 결과'), '파일이 안 생겼는데도 도장을 찍는다');
  assert.ok(/teacherEmailMap_\(ss\)/.test(본문),
    '링크가 운영자에게만 간다 — 정작 종이를 쓸 담당 강사가 못 받는다(검수 P1 e4c00b45 · profiles role=teacher 정본)');
  assert.ok(/서클인쇄_도장/.test(본문), '반·날짜 도장이 없다 — 10분마다 같은 종이가 쌓여 강사가 오늘 것을 못 고른다');
  // 락은 «있다»만 보면 안 된다 — tryLock 을 무력화해도 그 검사는 초록이었다(2차 변이 실측)
  assert.ok(/const lock = LockService\.getScriptLock\(\)/.test(본문), '락이 없다 — 겹친 sweep 이 같은 반 종이를 두 벌 굽는다(검수 P3 f8991d41)');
  assert.ok(/if \(!lock\.tryLock\(\d+\)\) return;/.test(본문), '락을 잡았는지 «안 보고» 지나간다 — 락이 장식이 됐다');
  assert.ok(/finally \{[\s\S]*?lock\.releaseLock\(\);/.test(본문), 'finally 에서 락을 안 푼다 — 한 번 예외가 나면 그날 인쇄가 통째로 멈춘다');
  // 줄바꿈에 안 기댄다(이 저장소는 CRLF 라 '\n' 앵커가 조용히 안 맞는다)
  const 구움 = 본문.indexOf('도장.구움[c] = 결과');
  const 찍기 = 본문.indexOf("props.setProperty('서클인쇄_도장', JSON.stringify(도장))");
  assert.ok(구움 > 0 && 찍기 > 구움 && 찍기 < 본문.indexOf('lock.releaseLock'),
    '도장을 반마다 안 찍는다 — 뒤의 반에서 예외가 나면 앞서 구운 반을 다음 틱에 또 굽는다');
});

test('알림은 락 «밖»에서 «즉시» 나간다 — 안 그러면 종이는 구워지고 아무도 못 받는다', () => {
  const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const 본문 = 셋업.slice(셋업.indexOf('function circleSheetsAuto_('), 셋업.indexOf('function circleBatchDone_('));
  assert.ok(본문.indexOf('adminMail(') < 0,
    'adminMail 을 쓴다 — DIGEST_MODE 에서 같은 스크립트 락을 30초 기다리다 죽고(재진입 불가), 살아도 링크가 다음 날 아침에 온다(검수 P1 28db800d·df8b0be6)');
  const 첫해제 = 본문.indexOf('lock.releaseLock();');
  assert.ok(첫해제 > 0 && 첫해제 < 본문.indexOf('MailApp.sendEmail'),
    '락을 쥔 채 메일을 보낸다 — 메일 경로가 같은 락을 다시 잡는다');
  // lastIndexOf 로 재면 «앞쪽에» 찍는 줄이 하나 더 생겨도 안 보인다(3차 변이가 그 구멍을 냈다)
  assert.ok(본문.indexOf('MailApp.sendEmail') < 본문.indexOf('알림.push(c)'),
    '알림 도장을 «보내기 전»에 옮긴다 — 발송이 실패하면 그대로 영구 미전달이 된다(검수 P2 b74e8ee4)');
  // 쿼터는 «수신자» 수로 센다 — 반 수로 세면 반마다 강사가 붙는 만큼 모자라 마지막 반이 조용히 못 받는다
  assert.ok(/quotaOk\(받는이별\[c\]\.length\)/.test(본문),
    '쿼터를 수신자 수가 아니라 반 수로 센다 — 마지막 반의 알림이 조용히 끊긴다(검수 P2 32ae5420)');
  // safety.test 의 「관문 밖 발송 0」 불변식과 같은 축 — 발송 바로 앞에서 세면 원리상 안 벌어진다
  본문.split(/\r?\n/).forEach((l, i, a) => {
    if (!/MailApp\.sendEmail/.test(l)) return;
    assert.ok(/quotaOk\(/.test(a.slice(Math.max(0, i - 12), i + 1).join('\n')),
      `관문(quotaOk) 밖 발송이 있다: ${l.trim().slice(0, 50)}`);
  });
  assert.ok(/circleStampTrim_\(도장\)/.test(본문),
    '도장 전체 크기를 안 재고 저장한다 — 9KB 를 넘으면 파일을 만든 뒤 저장이 실패해 다음 틱이 또 굽는다(검수 P2 c92783fe)');
  const 압축 = 셋업.slice(셋업.indexOf('function circleStampTrim_('), 셋업.indexOf('/* 오늘 도장'));
  assert.ok(/도장\.알림\.indexOf\(c\) >= 0/.test(압축),
    '아직 «안 알린» 반의 링크까지 지운다 — 그 자리에 ✅ 가 메일로 나가고 도장은 「알렸다」로 찍힌다(검수 P1 39819a34)');
  // 종이를 못 받는 «모든» 갈래가 한 자리에서 이름을 얻어야 한다 — 하나라도 조용히 return 하면
  // 그날 그 반의 종이가 이유 없이 안 나온다(검수 P1 cda019ad·575e6b7e)
  assert.ok(/const 못굽는이유 = /.test(본문) && /막힌반\.push\(\{ 반: c, 이유: 못굽는이유 \}\)/.test(본문),
    '못 굽는 이유를 한 자리에서 안 낸다 — 조 편성 없음·시즌 밖이 조용히 지나간다');
  ['조 편성이 없습니다', '시즌 기간 밖입니다', 'attendance 행이 0', '0명입니다'].forEach(w =>
    assert.ok(본문.indexOf(w) > 0, `못 굽는 갈래 「${w}」가 이름을 못 얻는다`));
  assert.ok(/도장\.막힘/.test(본문),
    '「전개완료인데 출석 0」 고착을 안 알린다 — 종이가 조용히 안 나오는 것이 이 트랙이 막으려던 모양이다(검수 P1 a63e6120)');

  // 도장은 날짜가 넘어가면 스스로 비워진다 — 어제 도장으로 오늘을 건너뛰면 종이가 안 나온다
  const 도장부 = 셋업.slice(셋업.indexOf('function circleStampOf_('), 셋업.indexOf('function circleStampOf_(') + 700);
  assert.ok(/s\.day !== day/.test(도장부), '날짜 대조가 없다 — 어제 도장이 오늘 인쇄를 막는다');
  assert.ok(본문.indexOf('printCircleSheets(') > 0, '굽는 통로를 새로 짰다 — 경고 문구가 두 벌로 갈린다');
  assert.ok(/addItem\('🖨[^']*', 'menuPrintCircleSheets'\)/.test(셋업), '메뉴에 손 재인쇄 통로가 없다 — 지각·정정 날에 다시 뽑을 자리가 사라진다');
});
