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
const { 서클모듈 } = require('../tools/서클조판.js');
const { engineSource } = require('./_engine-source.js');

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
