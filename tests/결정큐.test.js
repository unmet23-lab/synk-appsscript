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
  // 반대편 — 괄호 뒤로 문장이 이어지면 지시어다
  assert.equal(q.markerClause('유호의 결정 큐(15건+, 이 세션 시점 ⏳ 미결 다수)일 가능성. 그렇다면 큐가 3배가 된다'), null);
  assert.equal(q.markerClause('착수 게이트=platform-rebuild ⏳3건). 그때 선행 1건으로 가드를 제안함'), null);
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
