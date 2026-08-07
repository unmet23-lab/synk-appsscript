// decision-queue 회귀 테스트. 실제 메모리는 건드리지 않는다 — 전부 픽스처로 만든다.
//
// 지키려는 성질(둘은 실제로 났던 결함이다):
//  ①**차단자의 공로를 기다리는 쪽에 얹지 않는다.** 첫 판은 '막힘>'의 해소 건수를
//    기다리는 토픽의 ⏳ 줄에 붙여 「이걸 풀면 3건 풀림」이라 썼는데, 그 줄은 그 결정과
//    무관했다 — 참인 숫자를 엉뚱한 문장에 붙이면 그 문장이 거짓이 된다.
//  ②**하루치를 한 토픽이 독점하지 않는다.** 첫 판은 3칸 중 2칸이 같은 토픽이었다.
//  ③인덱스(MEMORY.md)와 자동 생성 역링크 구간은 큐가 아니다.
//  ④미결이 없으면 **아무 말도 하지 않는다**(빈 출력 = 헤르메스가 조용히 넘어간다).
//
// 탐지 능력은 픽스처로 못박는다 — 실제 메모리의 ⏳ 개수를 세는 회귀는 그 결정을
// 답하는 순간 빨간불이 되고, 다음 사람은 테스트를 고치는 게 아니라 끈다.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const q = require('../tools/decision-queue.js');

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-dq-'));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body, 'utf8');
  }
  return dir;
}

const DAY = (s) => new Date(s + 'T00:00:00Z');

test('⏳ 줄을 토픽별로 뽑고, 인덱스와 역링크 구간은 제외한다', () => {
  const dir = fixture({
    'MEMORY.md': '- [a](a.md) — ⏳ 인덱스에도 ⏳가 있지만 이건 지도라 큐가 아니다',
    'a.md': [
      '# A', '- ⏳ 에이 결정 하나', '- 그냥 본문',
      '<!-- memory-graph:역링크 시작 -->', '- 관련 ← [[b]] ⏳ 이건 자동 생성이라 큐가 아니다',
    ].join('\n'),
    'b.md': '# B\n- ⏳ 비 결정 하나',
  });
  const items = q.extract(dir);
  assert.equal(items.length, 2, '인덱스·역링크를 세면 안 된다');
  assert.deepEqual(items.map((i) => i.topic).sort(), ['a', 'b']);
  assert.match(items.find((i) => i.topic === 'a').text, /에이 결정 하나/);
});

/* 인덱스는 **두 파일**이다(F184 쪼개기 2026-08-07). 상한이 「줄」이라 지도(어느 토픽을 열까)를
 * 상주분 밖 `지도.md` 로 내보냈는데, 큐의 제외 목록은 `MEMORY.md` 한 이름 그대로였다 —
 * 실측: 지도가 토픽으로 읽혀 조각 12건(메타 문장·다른 토픽과 중복)이 유호님께 매일 배달됐다.
 * 목록을 여기 다시 적지 않는다 — memory-graph 의 INDEX_FILES 를 그대로 돌려 **등록층**을 검사한다. */
test('인덱스는 두 파일이다 — 지도.md 도 큐가 아니다 (F184 쪼개기)', () => {
  const { INDEX_FILES } = require('../tools/memory-graph.js');
  assert.ok(INDEX_FILES.length >= 2, '인덱스가 한 파일로 되돌아가면 이 검사 자체가 무의미해진다');

  const files = { 't.md': '# T\n- ⏳ 토픽의 진짜 결정' };
  for (const n of INDEX_FILES) files[n] = `- [t](t.md)\n- ⏳ 인덱스 조각이라 큐가 아니다 (${n})`;

  const items = require('../tools/decision-queue.js').extract(fixture(files));
  assert.deepEqual(items.map((i) => i.topic), ['t'],
    `인덱스 파일이 토픽으로 읽혔다 — 나온 것: ${items.map((i) => i.topic).join(',')}`);
});

test('차단자는 자기 줄을 갖고, 기다리는 토픽에는 해소 건수를 붙이지 않는다', () => {
  const dir = fixture({
    'MEMORY.md': '- [w1](w1.md)\n- [w2](w2.md)',
    // w1·w2가 같은 결정을 기다린다 → 그 결정이 2건을 막는 차단자
    'w1.md': '# W1\n- ⏳ 더블유원의 별개 잡무\n- [[막힘>결정-무엇인가]]',
    'w2.md': '# W2\n- ⏳ 더블유투의 별개 잡무\n- [[막힘>결정-무엇인가]]',
  });
  const r = q.build({ dir, date: DAY('2026-08-03'), count: 5 });

  const blocker = r.ranked.find((x) => x.topic === '결정-무엇인가');
  assert.ok(blocker, '차단자가 큐에 독립 항목으로 있어야 한다');
  assert.equal(blocker.unblocks, 2);

  for (const it of r.ranked.filter((x) => x.topic !== '결정-무엇인가')) {
    assert.equal(it.unblocks, 0, `기다리는 쪽(${it.topic})에 해소 건수가 붙으면 안 된다`);
  }
  // 렌더에도 새어나오면 안 된다
  const out = q.render(r, DAY('2026-08-03'));
  const 잡무줄 = out.split('\n').find((l) => l.includes('별개 잡무'));
  assert.ok(잡무줄 && !/풀립니다/.test(잡무줄), '무관한 줄에 「N건 풀립니다」가 붙었다');
});

test('하루치는 한 토픽이 독점하지 않는다', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => `- ⏳ 항목 ${i}`).join('\n');
  const dir = fixture({
    'MEMORY.md': '- [fat](fat.md)\n- [t1](t1.md)\n- [t2](t2.md)',
    'fat.md': '# FAT\n' + many(10),   // ⏳가 10개 몰린 토픽
    't1.md': '# T1\n- ⏳ 티원',
    't2.md': '# T2\n- ⏳ 티투',
  });
  const r = q.build({ dir, date: DAY('2026-08-03'), count: 3 });
  const topics = r.today.map((t) => t.topic);
  assert.equal(new Set(topics).size, topics.length, `같은 토픽이 겹쳤다: ${topics.join(', ')}`);
});

test('날짜가 지나면 다른 항목이 나온다 — 하위 항목이 굶지 않는다', () => {
  const dir = fixture({
    'MEMORY.md': ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => `- [${n}](${n}.md)`).join('\n'),
    ...Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((n) => [`${n}.md`, `# ${n}\n- ⏳ ${n} 결정`])),
  });
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const r = q.build({ dir, date: new Date(Date.UTC(2026, 7, 3 + i)), count: 2 });
    r.today.forEach((t) => seen.add(t.topic));
  }
  assert.ok(seen.size >= 5, `8일간 ${seen.size}개만 노출됐다 — 회전이 안 돈다`);
});

test('미결이 없으면 아무 말도 하지 않는다', () => {
  const dir = fixture({ 'MEMORY.md': '- [a](a.md)', 'a.md': '# A\n- 다 끝났다' });
  const r = q.build({ dir, date: DAY('2026-08-03') });
  assert.equal(r.total, 0);
  assert.equal(q.render(r, DAY('2026-08-03')), '', '빈 큐인데 말을 걸면 매일 소음이 된다');
});

test('완료 보고가 미결로 올라오지 않는다 — ⏳ 이후만 항목이다', () => {
  // 실제로 났던 결함: 「✅ …완료(커밋) … ⏳남은 건 X」 줄이 통째로 큐에 올라
  // 방금 끝낸 일 3건이 상위 10위 안에 들어갔다. 미결의 본문은 ⏳ 뒤에 있다.
  const dir = fixture({
    'MEMORY.md': '- [d](d.md)',
    'd.md': '# D\n- ✅ 배포 완료(abc1234) — 전부 끝냈다. ⏳남은 건 유호님 확인 하나',
  });
  const items = q.extract(dir);
  assert.equal(items.length, 1);
  assert.match(items[0].text, /남은 건 유호님 확인/);
  assert.ok(!/배포 완료/.test(items[0].text), `완료 보고가 항목 본문에 섞였다: ${items[0].text}`);
});

test('문장 속 ⏳는 항목이 아니다 — 조각이 결정으로 배달되지 않는다', () => {
  // 실제로 났던 결함: "위 ⏳3건 미결 상태에서 답함", "(⏳ 미결 다수)일 가능성" 같은
  // 본문 속 지시어가 큐에 올라, 문장 중간부터 시작하는 조각이 폰으로 갔다(52건 중 5건).
  assert.equal(q.markerClause('위 ⏳3건 미결 상태에서 답함'), null);
  assert.equal(q.markerClause('(⏳ 미결 다수)일 가능성'), null);
  assert.equal(q.markerClause('배경 설명 · ⏳유호 결정 2건'), '⏳유호 결정 2건');
  assert.equal(q.markerClause('⏳ 줄머리 항목'), '⏳ 줄머리 항목');

  const dir = fixture({
    'MEMORY.md': '- [m](m.md)',
    'm.md': '# M\n- 위 ⏳3건 미결 상태에서 답함\n- 무언가 함 · ⏳유호 결정 2건',
  });
  const items = q.extract(dir);
  assert.equal(items.length, 1, `문장 속 ⏳가 항목이 됐다: ${JSON.stringify(items.map((i) => i.text))}`);
  assert.equal(items[0].text, '⏳유호 결정 2건');
});

test('괄호 안 ⏳ — 항목과 지시어를 가른다 (실제 메모리 문자열로 못박음)', () => {
  // 거짓음성 3건이 실제로 났다. 「가드는 두 방향으로 틀린다」 — 잡는 것만 보고
  // 놓치는 것을 안 보면 큐가 조용히 짧아진다. 아래는 실제 메모리에서 가져온 문자열이다.
  assert.equal(q.markerClause('아이디어 보드 v1.4: 카드로 승격(⏳유호 승인 대기·미검증 출처 명기).'),
    '⏳유호 승인 대기·미검증 출처 명기).');
  assert.equal(q.markerClause('## 라임 조사 — 라임은 유령 색이다 (⏳유호 발전안 선택 대기)'),
    '⏳유호 발전안 선택 대기)');
  assert.equal(q.markerClause('카드 색 브랜드 키트 전환(v9.125) ⏳유호 Glide 설정 1클릭.'),
    '⏳유호 Glide 설정 1클릭.');
  // 반대편 — 괄호가 문장의 일부면(조사가 ')' 에 붙는다) 지시어다
  assert.equal(q.markerClause('유호의 결정 큐(15건+, 이 세션 시점 ⏳ 미결 다수)일 가능성. 그렇다면 큐가 3배가 된다'), null);
  assert.equal(q.markerClause('착수 게이트=platform-rebuild ⏳3건). 그때 선행 1건으로 가드를 제안함'), null);

  /* [2026-08-07] 머리에 붙은 주석형 — 「뒤에 2자 넘게 남으면 지시어」가 이 모양을 통째로 먹었다.
   * 둘 다 실제 메모리 문자열이고, 아래쪽은 그 줄이 **유일한 기록**이라 유호님께 한 번도 안 갔다. */
  assert.equal(q.markerClause('개정안 7건(⏳유호 승인 대기): ⑨소음+Gemini Live=수집 아님'),
    '⏳유호 승인 대기): ⑨소음+Gemini Live=수집 아님');
  assert.equal(q.markerClause('되돌리는 길=Codex Cloud(⏳유호 웹 환경 1회) · 상세 engine-pipeline-design'),
    '⏳유호 웹 환경 1회) · 상세 engine-pipeline-design');
});

test('상태 기호 범례는 항목이 아니다 — 단 범례 판별이 진짜를 먹지 않는다', () => {
  // 양방향으로 검사한다. 첫 판의 범례 필터는 「줄에 🔍가 있고 '/'가 있으면 범례」였는데,
  // 긴 메모리 줄은 경로(C:/…)·날짜·구분자에 '/'가 흔하고 🔍도 본문에 쓰인다 →
  // 진짜 미결 2건이 조용히 사라졌다. 넓은 가드가 큐를 줄이면 아무도 눈치채지 못한다.
  const dir = fixture({
    'MEMORY.md': '- [l](l.md)',
    'l.md': [
      '# L',
      '- 수정(이동 금지) · 기각도 지우지 않음. 상태 = 💡새 / 🔍검토 / ⏳판단대기 / ✅채택 /',   // 범례
      '- 🔍조사 결과 경로는 C:/Users/q1212 였다. ⏳유호 결정 = 자동 시작 여부',              // 진짜(🔍+/ 둘 다 있음)
      '- ⏳ 유호 답 대기: 3문항 자가진단 결과 / usage credits 상한 설정 여부',                // 진짜(/ 있음)
    ].join('\n'),
  });
  const items = q.extract(dir);
  const texts = items.map((i) => i.text);
  assert.equal(items.length, 2, `범례/진짜 구분 실패: ${JSON.stringify(texts)}`);
  assert.ok(texts.some((t) => /자동 시작 여부/.test(t)), '🔍·/가 든 줄의 진짜 미결이 사라졌다');
  assert.ok(texts.some((t) => /3문항 자가진단/.test(t)), '/가 든 줄의 진짜 미결이 사라졌다');
  assert.ok(!texts.some((t) => /판단대기/.test(t)), '범례가 항목으로 새어들었다');
});

test('짧은 한국어 항목도 살아남는다 — 장식 거르기가 실제 항목을 먹지 않는다', () => {
  // 실제로 났던 결함: 「⏳ 티원」(⏳ 제외 2글자)이 장식으로 오인돼 통째로 사라졌다.
  const dir = fixture({
    'MEMORY.md': '- [s](s.md)',
    's.md': '# S\n- ⏳ 티원\n## ⏳\n- ⏳',   // 첫 줄만 진짜 항목, 나머지 둘은 장식
  });
  const items = q.extract(dir);
  assert.equal(items.length, 1, `짧은 항목이 사라졌거나 장식이 섞였다: ${JSON.stringify(items.map((i) => i.text))}`);
  assert.match(items[0].text, /티원/);
});

test('마크다운 장식은 벗기되 내용은 남긴다', () => {
  assert.equal(q.stripMd('- **⏳ 굵게** `코드` [[막힘>x]] [링크](u)'), '⏳ 굵게 코드 x 링크');
});

/* ── 취소선 (2026-08-06 신설) ──────────────────────────────────────────────
 * 취소선은 세션이 항목을 죽이는 표기인데 stripMd가 표시만 벗기고 **내용을 남겨**
 * 죽은 항목이 되살아나 배달됐다. 실측 2건(minigame 「~~동의 6항목~~ ✅준비완료」·
 * vr-interview 「③~~몽골어 검수~~ ✅해소」) — 유호님 「왜 계속 뜨는거야」의 큐 쪽 절반.
 * 탐지력은 아래 픽스처가 진다(실메모리는 그때그때 달라져 회귀가 못 된다).
 */
test('취소선은 내용까지 지운다 — 죽인 조각이 배달되면 안 된다', () => {
  assert.equal(q.stripMd('- ⏳유호: 개정안 승인 · ~~동의 6항목~~ 남은 것'), '⏳유호: 개정안 승인 · 남은 것');
  // 한 줄에 여러 개 + 살아있는 조각이 뒤에 오는 형태
  assert.equal(q.stripMd('⏳ ~~①옛것~~ ~~②옛것~~ ③새것'), '⏳ ③새것');
});

test('취소선으로 통째 죽인 항목은 배달되지 않는다 — 단 조용히 사라지지 않는다', () => {
  const dir = fixture({
    'MEMORY.md': '- [k](k.md)',
    'k.md': '# K\n- ~~⏳ 통째로 죽인 항목~~\n- ⏳ 살아있는 항목',
  });
  const items = q.extract(dir);
  assert.deepStrictEqual(items.map((i) => i.text), ['⏳ 살아있는 항목']);
  // 「걸러졌다」가 --버려진 으로 드러나야 한다 — 통과와 미실행이 같은 모양이면 안 된다
  assert.equal(items.버려진.length, 1, '죽은 항목이 흔적 없이 사라졌다');
  assert.match(items.버려진[0].text, /통째로 죽인/, '버려진 목록에 원문이 남아야 사람이 오판을 잡는다');
});

/* ── 주간 한 장 (2026-08-06 신설 · 유호님 채택) ────────────────────────────
 * 큐는 배달로 안 준다 — 닫아야 준다. 주 1회 전량을 한 장으로 내고 유호님은 번호만 쓴다.
 * 🔑 지켜야 할 성질은 **닫는 조준**이다: 메모리는 세션 여럿이 동시에 고쳐 한 주 안에
 *    행 번호가 반드시 밀린다. 번호로 줄을 찾으면 **엉뚱한 결정이 닫힌다** — 그래서
 *    닫기는 지문으로 다시 찾고, 하나로 안 떨어지면 **안 닫는다**.
 */
function 한장픽스처() {
  const dir = fixture({
    'MEMORY.md': '- [a](a.md)\n- [b](b.md)',
    'a.md': '# A\n- ⏳ 첫째 결정\n- ⏳ 둘째 결정\n',
    'b.md': '# B\n- ⏳ 셋째 결정\n',
  });
  const sheetPath = path.join(dir, '한장.md');
  const r = q.build({ dir, date: DAY('2026-08-06') });
  // ⚠ `이전`을 안 주면 **저장소의 진짜 한 장**(docs/_ops/결정큐_한장.md)에서 번호를 물려받는다 —
  //   픽스처가 실저장소 상태에 매달려 CI에서 갈린다. 자기 경로를 준다(없으면 1부터).
  fs.writeFileSync(sheetPath, q.한장(r, DAY('2026-08-06'), { 이전: sheetPath }), 'utf8');
  return { dir, sheetPath };
}

test('한 장 — 항목마다 번호와 지문이 붙는다', () => {
  const { sheetPath } = 한장픽스처();
  const s = q.시트읽기(sheetPath);
  assert.equal(s.map.size, 3, '세 항목이 번호를 받아야 한다');
  assert.match(s.발행, /^\d{4}-\d{2}-\d{2}$/, '발행일이 없으면 밀림 판정을 못 한다');
  for (const [, v] of s.map) assert.match(v.지문, /^[0-9a-f]{10}$/);

  // 옛 판(ol 줄머리)도 읽어야 **이미 유호님 손에 있는 한 장의 번호가 이어진다** — 못 읽으면
  // 예약이 비어 전 항목이 1부터 다시 매겨지고, 그 한 번이 정확히 이 파일이 막는 사고다.
  const 옛판 = path.join(path.dirname(sheetPath), '옛판.md');
  fs.writeFileSync(옛판, '> **발행 2026-08-06**\n\n7. **[b]** 비 결정 <!--q:b|0123456789-->\n');
  assert.deepEqual(q.시트읽기(옛판).map.get(7), { topic: 'b', 지문: '0123456789' }, '옛 판을 못 읽는다');
});

test('🔴 닫기는 행 번호가 아니라 지문으로 찾는다 — 그 사이 줄이 밀려도 맞게 닫는다', () => {
  const { dir, sheetPath } = 한장픽스처();
  // 옆 세션이 a.md 맨 위에 줄을 끼워 넣는다 → 「첫째 결정」의 행 번호가 밀린다
  const a = path.join(dir, 'a.md');
  fs.writeFileSync(a, fs.readFileSync(a, 'utf8').replace('# A\n', '# A\n- 남의 세션이 끼워 넣은 줄\n- 또 한 줄\n'));

  const 번호 = [...q.시트읽기(sheetPath).map].find(([, v]) => v.topic === 'a')[0];
  const out = q.닫음([번호], { dir, sheet: sheetPath, date: DAY('2026-08-06') });
  assert.equal(out.결과[0].ok, true, `밀린 줄을 못 찾았다: ${out.결과[0].사유}`);

  const 본문 = fs.readFileSync(a, 'utf8');
  assert.match(본문, /✅ 첫째 결정 — 유호님 확정 2026-08-06/, '⏳가 ✅로 바뀌고 확정일이 붙어야 한다');
  assert.match(본문, /⏳ 둘째 결정/, '옆 항목까지 닫으면 안 된다');
  assert.match(본문, /남의 세션이 끼워 넣은 줄/, '남의 줄을 지우면 안 된다');
});

test('🔴 줄이 그 사이 바뀌었으면 닫지 않는다 — 엉뚱한 결정을 닫는 것이 더 나쁘다', () => {
  const { dir, sheetPath } = 한장픽스처();
  const b = path.join(dir, 'b.md');
  fs.writeFileSync(b, '# B\n- ⏳ 셋째 결정인데 내용이 통째로 바뀌었다\n');

  const 번호 = [...q.시트읽기(sheetPath).map].find(([, v]) => v.topic === 'b')[0];
  const out = q.닫음([번호], { dir, sheet: sheetPath, date: DAY('2026-08-06') });
  assert.equal(out.결과[0].ok, false, '내용이 바뀐 줄을 그대로 닫았다 — 조준이 밀린 것이다');
  assert.match(out.결과[0].사유, /바뀌었거나|다시 발행/);
  assert.match(fs.readFileSync(b, 'utf8'), /⏳ 셋째 결정인데/, '못 닫았는데 파일을 건드렸다');
});

test('🔴 재발행해도 번호는 그 결정을 계속 가리킨다 — 유호님 답은 늦게 온다', () => {
  /* 실측(2026-08-07): 유호님이 한 장 #1 을 보고 「2번 완료」라 답하는 사이 옆 세션이 새 토픽을
   * 만들고 아무 세션이나 `--한장`을 다시 냈다. 번호가 알파벳순으로 다시 매겨져 2번이 [c]에서
   * [b]로 옮겨갔고, 지문은 **새 시트 기준**이라 그대로 맞아 [b]가 `ok=true`로 닫혔다.
   * 지문은 시트↔메모리만 검사한다 — 유호님이 든 사본은 어느 층도 검사하지 못한다. */
  const dir = fixture({
    'MEMORY.md': '- [b](b.md)\n- [c](c.md)',
    'b.md': '# B\n- ⏳ 비 결정\n',
    'c.md': '# C\n- ⏳ 씨 결정\n',
  });
  const sheet = path.join(dir, '한장.md');
  // ⚠ 번호는 **찍힌 줄**로 센다 — 시트읽기의 Map 은 같은 번호가 둘이면 하나를 덮어 가린다.
  //   가려진 중복은 「유호님이 1번이라 답하면 두 결정 중 하나가 닫힌다」와 같은 말이다.
  const 찍힌번호 = () => fs.readFileSync(sheet, 'utf8').split('\n')
    .filter((l) => l.includes('<!--q:')).map((l) => Number((l.match(/\*\*(\d+)\.\*\*/) || [])[1]));
  const 발행 = (날짜) => {
    fs.writeFileSync(sheet, q.한장(q.build({ dir, date: 날짜 }), 날짜, { 이전: sheet }), 'utf8');
    const ns = 찍힌번호();
    assert.equal(new Set(ns).size, ns.length, `한 장에 같은 번호가 둘이다: ${ns.join(',')}`);
  };

  발행(DAY('2026-08-06'));
  const 유호님이_든_사본 = q.시트읽기(sheet);
  const 번호 = [...유호님이_든_사본.map].find(([, v]) => v.topic === 'c')[0];

  // 옆 세션이 알파벳 앞에 오는 토픽을 새로 만든다 → 옛 판이었다면 전 번호가 한 칸씩 밀린다
  fs.appendFileSync(path.join(dir, 'MEMORY.md'), '\n- [a](a.md)');
  fs.writeFileSync(path.join(dir, 'a.md'), '# A\n- ⏳ 에이 결정\n');
  발행(DAY('2026-08-07'));

  assert.equal(q.시트읽기(sheet).map.get(번호).topic, 'c', '재발행이 번호를 다른 결정으로 옮겼다');
  const out = q.닫음([번호], { dir, sheet, date: DAY('2026-08-07') });
  assert.equal(out.결과[0].ok, true, `늦게 온 답을 못 닫았다: ${out.결과[0].사유}`);
  assert.match(fs.readFileSync(path.join(dir, 'c.md'), 'utf8'), /✅ 씨 결정/, '유호님이 뜻한 줄이 안 닫혔다');
  assert.match(fs.readFileSync(path.join(dir, 'b.md'), 'utf8'), /⏳ 비 결정/, '엉뚱한 결정에 「유호님 확정」이 박혔다');

  // 닫힌 번호는 다시 쓰지 않는다 — 재사용하면 옛 답장이 남의 결정을 닫는 이 버그가 되살아난다
  발행(DAY('2026-08-08'));
  const 남은 = q.시트읽기(sheet);
  assert.equal(남은.map.has(번호), false, '닫힌 번호가 한 장에 그대로 남았다');
  assert.equal([...남은.map.values()].some((v) => v.topic === 'c'), false, '닫힌 결정이 다시 올라왔다');
  for (const [n, v] of 남은.map) {
    assert.equal(유호님이_든_사본.map.get(n)?.topic ?? v.topic, v.topic, `${n}번이 다른 결정으로 재사용됐다`);
  }
});

test('한 장은 ol 이 아니라 불릿으로 번호를 낸다 — ol 은 렌더러가 1부터 다시 매긴다', () => {
  // 번호에 틈이 생기는 순간 `N.` 은 거짓말이 된다(GitHub·폰 미리보기가 1,2,3으로 다시 그린다).
  const { sheetPath } = 한장픽스처();
  const 항목줄 = fs.readFileSync(sheetPath, 'utf8').split('\n').filter((l) => l.includes('<!--q:'));
  assert.ok(항목줄.length >= 3, '항목이 없으면 이 검사가 아무것도 안 본다');
  for (const l of 항목줄) assert.match(l, /^- \*\*\d+\.\*\* /, `ol 줄머리로 되돌아갔다: ${l.slice(0, 40)}`);
});

test('닫아도 원문은 지우지 않는다 — 되돌림이 ✅→⏳ 한 수여야 한다', () => {
  const { dir, sheetPath } = 한장픽스처();
  const 번호 = [...q.시트읽기(sheetPath).map].find(([, v]) => v.topic === 'b')[0];
  q.닫음([번호], { dir, sheet: sheetPath, date: DAY('2026-08-06') });
  const 줄 = fs.readFileSync(path.join(dir, 'b.md'), 'utf8').split('\n').find((l) => l.includes('셋째'));
  assert.match(줄, /셋째 결정/, '원문이 사라졌다');
  assert.equal(줄.replace('✅', '⏳').replace(/ — 유호님 확정 .*$/, ''), '- ⏳ 셋째 결정');
});

test('없는 번호·빈 한 장은 조용히 넘어가지 않는다', () => {
  const { dir, sheetPath } = 한장픽스처();
  const out = q.닫음([99], { dir, sheet: sheetPath, date: DAY('2026-08-06') });
  assert.equal(out.결과[0].ok, false);
  assert.match(out.결과[0].사유, /한 장에 없다/);
  assert.match(q.닫음([1], { dir, sheet: path.join(dir, '없다.md') }).error, /한 장이 없다/);
});

test('밀림 판정 — 7일째부터 알린다 (경계값)', () => {
  const { sheetPath } = 한장픽스처();   // 발행 2026-08-06
  assert.equal(q.한장밀림(DAY('2026-08-12'), sheetPath).밀림, false, '6일째는 아직 아니다');
  assert.equal(q.한장밀림(DAY('2026-08-13'), sheetPath).밀림, true, '7일째는 알려야 한다');
  assert.equal(q.한장밀림(DAY('2026-08-13'), path.join(__dirname, '없다.md')).밀림, true, '한 장이 없으면 밀린 것이다');
});

/* ── 날짜 게이트 (2026-08-04 신설) ─────────────────────────────────────────
 * ⏳는 「몰라서 못 정함」과 **「알지만 아직 때가 아님」** 둘 다에 쓰인다.
 * 후자를 그냥 두면 매일 배달돼 큐 전체가 배경 소음이 된다 — 이 도구가 풀려는
 * 병목을 이 도구가 도로 만든다. 게이트는 미룰 뿐 **버리지 않는다**(scheduled).
 */
test('날짜 게이트 — 아직 때가 안 된 항목은 배달하지 않는다', () => {
  const dir = fixture({
    'MEMORY.md': '- [g](g.md)',
    'g.md': [
      '# G',
      '- ⏳2026-12 얼리버드 가격 확정 — 광고 P2 실측 뒤',
      '- ⏳ 지금 답해야 하는 것',
    ].join('\n'),
  });
  const 이전 = q.build({ dir, date: DAY('2026-08-04') });
  assert.equal(이전.total, 1, '미래 항목이 큐에 남았다 — 4개월간 매일 배달된다');
  assert.match(이전.ranked[0].text, /지금 답해야/);
  assert.equal(이전.scheduled.length, 1, '미룬 항목이 조용히 사라졌다 — 미실행과 부재가 같은 모양이면 안 된다');
  assert.match(이전.scheduled[0].text, /얼리버드/);

  const 이후 = q.build({ dir, date: DAY('2026-12-01') });
  assert.equal(이후.total, 2, '그 달이 됐는데도 안 뜬다 — 게이트가 안 열렸다');
  assert.equal(이후.scheduled.length, 0);
});

test('날짜 게이트 — 날짜처럼 안 생긴 숫자는 게이트가 아니다', () => {
  // 버전·수량·연도범위를 게이트로 오인하면 진짜 미결이 조용히 사라진다(넓은 가드가 큐를 먹는 계열).
  assert.equal(q.gateDate('⏳2026-13 달이 13월'), null, '13월을 게이트로 셌다');
  assert.equal(q.gateDate('⏳2026-00 0월'), null, '0월을 게이트로 셌다');
  assert.equal(q.gateDate('⏳2026-2027 연도 범위'), null, '연도 범위를 게이트로 셌다');
  assert.equal(q.gateDate('⏳ v9.164 배포 대기'), null, '버전 번호를 게이트로 셌다');
  assert.equal(q.gateDate('⏳ 그냥 미결'), null);
  assert.equal(q.gateDate('⏳2026-12 확정'), Date.UTC(2026, 11, 1), '연-월 게이트를 못 읽었다');
  assert.equal(q.gateDate('⏳2026-12-10 신청'), Date.UTC(2026, 11, 10), '연-월-일 게이트를 못 읽었다');
});

test('날짜 게이트 — 게이트가 걸려도 항목 본문은 안 잘린다', () => {
  const dir = fixture({
    'MEMORY.md': '- [g](g.md)',
    'g.md': '# G\n- ⏳2026-12 얼리버드 가격 확정',
  });
  const r = q.build({ dir, date: DAY('2026-08-04') });
  assert.match(r.scheduled[0].text, /⏳2026-12 얼리버드 가격 확정/,
    '날짜를 벗겨내면 예약 목록에서 언제부터인지 사람이 못 읽는다');
});

test('헤더의 ⏳는 구획 이름이지 항목이 아니다 — 빈 배달을 막는다', () => {
  // 실측(2026-08-04): 하루치 3칸 중 2칸이 「⏳ 남은 것」류 헤더였다. 배달됐는데 무엇을 답할지 모른다.
  const dir = fixture({
    'MEMORY.md': '- [h](h.md)',
    'h.md': [
      '# H',
      '## ⏳ 남은 것',          // 헤더 = 구획 이름
      '- ⏳ 진짜 답해야 하는 것', // 불릿 = 항목
      '### ⏳ 유호님 대기',
    ].join('\n'),
  });
  const items = q.extract(dir);
  assert.equal(items.length, 1, `헤더가 항목으로 배달됐다: ${JSON.stringify(items.map((i) => i.text))}`);
  assert.match(items[0].text, /진짜 답해야/);
});

test('헤더 필터가 진짜 항목을 먹지 않는다 — # 이 문장 속에 있는 경우', () => {
  // 넓은 가드가 큐를 조용히 줄이는 계열을 막는다(이 파일 「범례 판별」 테스트와 같은 취지).
  const dir = fixture({
    'MEMORY.md': '- [h](h.md)',
    'h.md': '# H\n- ⏳ 이슈 #12 처리 여부\n  ⏳ 들여쓴 문단도 항목이다',
  });
  const items = q.extract(dir);
  assert.equal(items.length, 2, `# 가 든 항목이나 들여쓴 항목이 사라졌다: ${JSON.stringify(items.map((i) => i.text))}`);
});

/* ── 끝난 일이 미결로 배달되는 것 (같은 계열 3번째) ─────────────────────────
 * 이 파일 머리말의 결함 ①②는 「참인 숫자를 엉뚱한 문장에」였고, 이건 그 사촌이다:
 * **한 줄에 「✅…끝났다」와 「⏳…남았다」를 같이 쓰면 큐가 끝난 쪽을 배달한다.**
 * 실측 — 08-03 첫 판에서 상위 10건 중 3건이 이 형태였고, 08-04에 같은 실수가
 * 두 번 더 났다(해소 표시를 하면서 같은 줄에 ⏳를 남겼다 · 설명문 안의 ⏳ 글자까지 잡혔다).
 * 🔑 처방은 도구가 아니라 **표기 규율**이다 — 해소분과 미결은 **줄을 나눈다.**
 *    도구로 「✅ 있으면 무시」를 넣으면 진짜 미결까지 조용히 삼킨다(새는 방향이 침묵).
 *    그래서 도구는 그대로 두고, **배달물에 ✅가 섞이면 빨간불**로 표기 규율을 강제한다. */
test('탐지: 한 줄에 해소와 미결을 같이 쓰면 끝난 쪽이 배달된다 (픽스처)', () => {
  const dir = fixture({
    'MEMORY.md': '- [h](h.md)',
    'h.md': '# H\n- ⏳유호: ①A → ✅08-03 완료. ②B → ✅완료. 남은 건 C',
  });
  const items = q.extract(dir);
  assert.equal(items.length, 1);
  assert.match(items[0].text, /✅/,
    '이 픽스처는 「해소가 섞인 배달」을 재현해야 한다 — 재현이 안 되면 아래 실저장소 검사가 헛돈다');
});

test('실저장소: 큐가 배달하는 항목 본문에 ✅가 없다 (끝난 일이 미결로 안 간다)', () => {
  const 실제 = require('../tools/memory-graph.js').memoryDir();
  if (!fs.existsSync(실제)) return; // 다른 기계엔 메모리가 없다
  const 오염 = q.extract(실제).filter((i) => /✅/.test(String(i.text || '')));
  assert.deepEqual(오염.map((i) => `${i.topic}: ${String(i.text).slice(0, 70)}`), [],
    '끝난 일이 미결로 배달되고 있다 — 해소 표시를 하면서 같은 줄에 대기 마커를 남긴 것이다.\n' +
    '  고치는 법: 그 줄을 둘로 나눈다(✅ 줄 하나 + 정말 남은 질문만 담은 ⏳ 줄 하나).\n' +
    '  왜 중요한가: 이 큐는 매일 아침 유호님 폰으로 간다. 끝난 일이 배달되면 큐 자체를 안 믿게 된다.');
});

/* 걸러진 ⏳를 보이게 한다 — 2026-08-05 실측: 「삭제 후보 6묶음(⏳유호 확정 대기)」가 문장 속
 * 지시어로 분류돼 정본 §12의 유호님 결정 8문항이 하루 동안 큐에 없었다. 필터가 맞았는지는
 * 사람이 봐야 갈리는데 안 보이면 못 본다(같은 계열 3번째 · 앞선 둘은 도구 주석에 있다).
 * ⚠[2026-08-07 정정] 이 픽스처는 **그 진짜 항목을 걸러진 예시로 썼다** — 위 문장이 「이건 미결이었다」고
 * 적어놓고 아래 assert 가 「걸러진 채로 있어라」를 못박은 꼴이라, 회귀가 결함을 얼렸다(가드 맹점②의 거울).
 * 이 테스트가 지킬 것은 「걸러진 줄이 기록된다」이지 「이 줄이 걸러진다」가 아니다 → 픽스처를 진짜
 * 지시어(괄호에 조사가 붙어 문장이 되는 줄)로 바꾼다. 주석형이 항목이라는 쪽은 markerClause 회귀가 진다. */
test('탐지: 걸러진 ⏳가 흔적 없이 사라지지 않는다 (픽스처)', () => {
  const dir = fixture({
    'MEMORY.md': '- [d](d.md)',
    'd.md': [
      '# D',
      '- 어떤 판정(⏳ 미결 다수)일 가능성이 있다. 그렇다면 다시 본다',
      '- ⏳ 진짜 미결 하나',
    ].join('\n'),
  });
  const items = q.extract(dir);
  assert.equal(items.length, 1, '진짜 항목 하나만 큐에 든다');

  const 버려진 = items.버려진;
  assert.equal(버려진.length, 1, '걸러진 줄이 기록돼야 한다 — 0이면 도로 조용해진 것이다');
  assert.match(버려진[0].사유, /문장 속/);
  assert.match(버려진[0].text, /어떤 판정/);
  assert.equal(버려진[0].line, 2, '몇 번째 줄인지 없으면 찾아갈 수가 없다');

  // 장치가 스스로 발화하는지. ⚠ 이 주석은 원래 「세션 시작 훅은 render() 출력만 보여준다」였는데
  // **거짓이었다**(F173) — 훅은 자기 텍스트를 다시 조립한다. 훅 쪽 회귀는 tests/결정큐훅.test.js ⑤.
  const out = q.render(q.build({ dir, date: DAY('2026-08-05'), count: 3 }), DAY('2026-08-05'));
  assert.match(out, /걸러졌다/, '기본 출력에 경고가 없으면 --버려진 을 아무도 안 친다');
});

test('걸러진 게 있는데 미결이 0이면 빈 출력이 아니라 경고를 낸다', () => {
  const dir = fixture({
    'MEMORY.md': '- [e](e.md)',
    'e.md': '# E\n- 어떤 판정(⏳ 미결 다수)일 가능성이 있다. 그렇다면 다시 본다',
  });
  const r = q.build({ dir, date: DAY('2026-08-05'), count: 3 });
  assert.equal(r.total, 0);
  assert.match(q.render(r, DAY('2026-08-05')), /걸러졌다/,
    '「없다」와 「안 보인다」가 같은 모양이면 안 된다 — CLAUDE.md 신뢰성');
});

/* [2026-08-07 · F173] `--all` 은 「전부 보여달라」다 — 걸러진 것만 빠지면 그 전량이 「이게 전부다」로
 * 읽힌다(바로 위 예약 줄이 같은 이유로 이미 나가고 있었다). CLI 분기라 render() 로는 못 재고
 * 실행층으로만 재진다. 옆 세션 b6cb681a 가 「그쪽에 --all 한 곳이 남았다」로 지목했다. */
function cli(args, dir) {
  return require('child_process').spawnSync(
    process.execPath, [path.join(__dirname, '..', 'tools', 'decision-queue.js'), ...args],
    { encoding: 'utf8', env: { ...process.env, SYNK_MEMORY_DIR: dir } },
  );
}

test('--all 도 폐기함을 말한다 (전량 조회에서 빠지면 「이게 전부다」가 된다)', () => {
  const dir = fixture({
    'MEMORY.md': '- [f](f.md)',
    'f.md': '# F\n- ⏳ 진짜 미결 하나\n- 어떤 판정(⏳ 미결 다수)일 가능성이 있다. 그렇다면 다시 본다\n',
  });
  const r = cli(['--all'], dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /미결 1건/, '전제: 진짜 항목은 전량에 뜬다');
  assert.match(r.stdout, /걸러졌다/, '--all 에서 폐기함이 빠지면 전량이 「이게 전부다」로 읽힌다');
});

test('--all 거짓양성: 걸러진 게 없으면 폐기함을 말하지 않는다', () => {
  const dir = fixture({ 'MEMORY.md': '- [g](g.md)', 'g.md': '# G\n- ⏳ 진짜 미결 하나\n' });
  const r = cli(['--all'], dir);
  assert.doesNotMatch(r.stdout, /걸러졌다/, '0건인데 뜨면 그 줄이 배경 소음이 된다');
});
