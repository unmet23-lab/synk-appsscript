'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 관문 = require('../tools/lib/관문대조.js');
const 편 = require('../tools/lib/게시성과편.js');
const 도구 = require('../tools/게시성과.js');

// 편 폴더 · 장부 · 판정은 모두 합성 자료다. 실제 편 폴더 · 장부를 읽거나 고치지 않는다.
const D = 86_400_000;
const NOW = Date.parse('2026-11-08T12:00:00+09:00');

test('편 이름으로 줄을 가르고, 기획.md 첫 줄에서 장부 번호를 읽는다', () => {
  assert.equal(관문.편줄('LAB_화날때_mn_20261031'), 'LAB 몽골');
  assert.equal(관문.편줄('LAB_사층F_20261031'), 'LAB 영어');
  assert.equal(관문.편줄('synkbrief_메뉴판정리_20261030'), 'synkbrief');
  assert.equal(관문.편줄('yuhobuilds_유일한빛_20261031'), 'yuhobuilds');
  assert.equal(관문.편줄('PULSE_가격_20261028'), null);
  assert.equal(관문.장부번호('기획 · LAB · @synk.mn(lab-instagram · lab-facebook) · M15 · 2026-10-27 · 슬롯 2026-10-28(수) 21:00'), 'M15');
  assert.equal(관문.장부번호('기획 · synkbrief · @synkbrief(인스타 · 유튜브 · 틱톡) + SHIFT 네이버 블로그 · B18 · 2026-10-30 · 슬롯'), 'B18');
  assert.equal(관문.장부번호('기획 · yuhobuilds · 인스타 @yuhobuilds · Y29 · 만든 날 10-31(밤)'), 'Y29');
  assert.equal(관문.장부번호('1일 1편 · LAB · 2026-10-05 · 역할 권위'), null);
});

test('장부 상태 칸 — 관문 못 넘음 · 다시 살림 · 완성 · 버림 · 그 밖을 가르고 못 넘은 자리를 센다', () => {
  const a = 관문.판정읽기('**완성(관문 못 넘음 — haiku 9번 같아 보임 · 어이없어 · 억울해를 둘이 같이 짚음 · 10-31 15시 회차 · 슬롯 11-02(월) 21:00)**');
  assert.equal(a.결과, '못 넘음');
  assert.deepEqual(a.자리, ['같아 보임', '같이 짚음']);
  assert.match(a.까닭, /^haiku 9번 같아 보임/);
  assert.doesNotMatch(a.까닭, /\)$/, '닫는 괄호 앞에서 끊는다');
  const b = 관문.판정읽기('**완성 — 다시 살림(관문 못 넘음 — 재미 3 · 3 · 3(v3만 4 · 4) · 볼 이유 2)**');
  assert.equal(b.결과, '못 넘음');
  assert.equal(b.다시살림, true);
  assert.deepEqual(b.자리, ['재미', '볼 이유']);
  assert.match(b.까닭, /\(v3만 4 · 4\)/, '안쪽 괄호는 세며 넘는다');
  assert.equal(관문.판정읽기('**완성 — v2 화면 결(11-03 밤 재제작)**').결과, '넘음');
  assert.equal(관문.판정읽기('**완성(관문 시험 — 지적 4 중 고친 것 2)**').결과, '시험', '관문 시험 편은 넘음 · 못 넘음과 따로');
  assert.equal(관문.판정읽기('버림(이해 시험 세 번 — 다시 살린다면 …)').결과, '버림');
  assert.equal(관문.판정읽기('제작 중 — 편 폴더 …').결과, '모름');
  assert.equal(관문.판정읽기(null).결과, '모름');
});

test('같은 번호가 장부에 여러 줄이면 「완성」 · 「버림」이 든 줄을 쓴다', () => {
  const ledger = [
    '| 번호 | 기획 | 갈래 | 상태 |',
    '|---|---|---|---|',
    '| M7 | 첫 후보 | 근거 B | 순위 1 — 답 없음 |',
    '| M8 | 다른 편 | 근거 B | **완성** |',
    '| M7 | 같은 편, 만든 뒤 | 근거 B | **완성(관문 못 넘음 — 재미 3 · 3)** |',
  ].join('\n');
  assert.match(관문.장부상태(ledger, 'M7'), /관문 못 넘음/);
  assert.equal(관문.장부상태(ledger, 'M9'), null);
  assert.equal(관문.장부상태('', 'M7'), null);
});

function tempMarketing(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gate-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'docs', '마케팅');
  fs.mkdirSync(path.join(root, '기획장부'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sns-계정.json'), JSON.stringify({ accounts: {
    'lab-instagram': { platform: 'instagram', dailyLine: 'LAB 몽골' },
    'lab-youtube': { platform: 'youtube', dailyLine: 'LAB 영어' },
    'lab-mm-tiktok': { platform: 'tiktok', dailyLine: 'LAB 두 채널' },
  } }));
  fs.writeFileSync(path.join(root, '기획장부', 'LAB.md'), [
    '| 번호 | 기획 | 갈래 | 상태 |', '|---|---|---|---|',
    '| M1 | 넘은 편 | 오마주 | **완성 — 원본 1:1** |',
    '| M2 | 못 넘은 편 | 오마주 | **완성(관문 못 넘음 — haiku 9번 같아 보임)** |',
    '| E5 | 영어 편 | 오마주 | **완성** |',
  ].join('\n'));
  const mk = (name, firstLine) => {
    fs.mkdirSync(path.join(root, name, '게시'), { recursive: true });
    fs.writeFileSync(path.join(root, name, '기획.md'), `${firstLine}\n\n# ${name}\n`);
  };
  mk('LAB_넘음_mn_20261101', '기획 · LAB · @synk.mn · M1 · 2026-11-01 · 슬롯 2026-11-02 21:00');
  mk('LAB_못넘음_mn_20261102', '기획 · LAB · @synk.mn · M2 · 2026-11-02 · 슬롯 2026-11-03 21:00');
  mk('LAB_영어_20261102', '기획 · LAB · @synkkorean · E5 · 2026-11-02 · 슬롯 2026-11-04 21:00');
  return { root };
}

const j = (post, folder, account, point, value, days, metrics = {}) => ({
  post, folder, account, point, multiple: value === null ? null : { value, median: 100, n: 6, basis: 'same-age' }, metrics,
  publishedAt: new Date(NOW - days * D).toISOString(),
});

test('표 — 편 줄 계정의 72시간 배수(없으면 24시간)를 관문 판정과 맞대고, 두 채널 판 · 다른 줄 계정 · 7일 판정은 뺀다', t => {
  const { root } = tempMarketing(t);
  const index = 편.buildIndex(root);
  const judgments = [
    j('instagram:a', 'LAB_넘음_mn_20261101', 'lab-instagram', '24h', 1.2, 6),
    j('instagram:a', 'LAB_넘음_mn_20261101', 'lab-instagram', '72h', 0.9, 6),
    j('instagram:a', 'LAB_넘음_mn_20261101', 'lab-instagram', '7d', 9.0, 6),
    j('instagram:b', 'LAB_못넘음_mn_20261102', 'lab-instagram', '24h', 41.5, 5, { views: 8300, saves: 120, shares: 60 }),
    j('youtube:c', 'LAB_영어_20261102', 'lab-youtube', '72h', 0.05, 4),
    j('tiktok:d', 'LAB_영어_20261102', 'lab-mm-tiktok', '72h', 12, 4), // 두 채널 판은 그 편 관문과 따로라 뺀다
    j('instagram:e', 'LAB_영어_20261102', 'lab-instagram', '72h', 30, 4), // 영어 편에 몽골 계정 판이 섞여도 뺀다
  ];
  const rows = 관문.표({ judgments, index, now: NOW });
  const by = Object.fromEntries(rows.map(r => [r.folder, r]));
  assert.equal(by.LAB_넘음_mn_20261101.결과, '넘음');
  assert.equal(by.LAB_넘음_mn_20261101.배수, 0.9, '72시간이 있으면 24시간 · 7일보다 72시간');
  assert.equal(by.LAB_넘음_mn_20261101.시점, '72h');
  assert.equal(by.LAB_못넘음_mn_20261102.결과, '못 넘음');
  assert.deepEqual(by.LAB_못넘음_mn_20261102.자리, ['같아 보임']);
  assert.equal(by.LAB_못넘음_mn_20261102.시점, '24h');
  assert.equal(by.LAB_못넘음_mn_20261102.저장, 120);
  assert.equal(by.LAB_영어_20261102.배수, 0.05, '두 채널 · 다른 줄 판의 큰 배수를 가져오지 않는다');
  const s = 관문.셈(rows);
  assert.deepEqual(s['LAB 몽골']['넘음'], { n: 1, 튐: 0, 위: 0 });
  assert.deepEqual(s['LAB 몽골']['못 넘음'], { n: 1, 튐: 1, 위: 1 });
  const text = 관문.요약절(rows).join('\n');
  assert.match(text, /## 관문과 실제 반응/);
  assert.match(text, /\| LAB 몽골 \| 1편 · 3배\+ 0 \| 1편 · 3배\+ 1 \| — \| — \| — \|/);
  assert.match(text, /같아 보임 1편 중 3배\+ 1/);
  assert.match(text, /LAB_못넘음_mn_20261102 \(M2\) · 42배\(24h\) · 조회 8,300 · 관문 못 넘음 — 같아 보임/);
  // 창 밖(30일 넘은) 편은 세지 않는다
  assert.equal(관문.표({ judgments, index, now: NOW + 40 * D }).length, 0);
  assert.deepEqual(관문.요약절([]), []);
});

test('게시성과 요약 — 관문 절은 편 색인이 없거나 읽다 막혀도 요약을 멈추지 않는다', () => {
  const text = 도구.summarize({ ledger: [], now: NOW, index: null });
  assert.match(text, /## 훅 이름표별/);
  assert.doesNotMatch(text, /## 관문과 실제 반응/);
  const broken = { folders: new Map([['LAB_가_mn_20261101', { folder: 'LAB_가_mn_20261101' }]]), resolve: () => null };
  assert.match(도구.summarize({ ledger: [], now: NOW, index: broken }), /## 훅 이름표별/);
});

test('새 방향 표 — 슬롯 시작일부터 편 · 판마다 저장 · 공유 · 좋아요, 앞 14일은 판마다 반응 중앙값으로만', () => {
  const at = day => `2026-${day}T21:00:00+09:00`;
  const j = (post, folder, account, day, point, metrics) => ({ post, folder, account, publishedAt: at(day), point, metrics });
  const judgments = [
    j('a', 'synkbrief_옛편_20261105', 'synkbrief-instagram', '11-05', '72h', { views: 120, likes: 1, comments: 0, shares: 0, saves: 0 }),
    j('b', 'synkbrief_옛편둘_20261106', 'synkbrief-instagram', '11-06', '72h', { views: 110, likes: 3, comments: 0, shares: 0, saves: 0 }),
    j('old', 'synkbrief_아주옛편_20261001', 'synkbrief-instagram', '10-20', '72h', { views: 90, likes: 50 }),
    j('c', 'synkbrief_회의록_20261110', 'synkbrief-instagram', '11-14', '24h', { views: 300, likes: 4, comments: 1, shares: 2, saves: 3 }),
    j('c', 'synkbrief_회의록_20261110', 'synkbrief-instagram', '11-14', '72h', { views: 900, likes: 9, comments: 2, shares: 5, saves: 7 }),
    j('d', 'synkbrief_회의록_20261110', 'synkbrief-youtube', '11-14', '24h', { views: 1000, likes: 20, comments: 3 }),
    j('e', 'yuhobuilds_형식시험_20261108', 'yuhobuilds-instagram', '11-08', '72h', { views: 200, likes: 2 }),
    j('f', 'LAB_화날때_mn_20261031', 'lab-instagram', '11-14', '72h', { views: 19000, likes: 900 }),
    j('g', 'synkbrief_회의록_20261110', 'shift-naver', '11-14', '72h', { views: 5 }),
  ];
  const t = 관문.새방향표({ judgments });
  assert.deepEqual(t.rows.map(r => [r.folder, r.판, r.시점, r.조회, r.반응]), [
    ['synkbrief_회의록_20261110', '유튜브', '24h', 1000, 23],
    ['synkbrief_회의록_20261110', '인스타', '72h', 900, 23],
  ]);
  assert.deepEqual(t.기준.synkbrief.인스타, { 중앙값: 2, 판수: 2 }, '앞 14일 판만 — 10-20 편은 빠진다');
  assert.deepEqual(t.기준.yuhobuilds.인스타, { 중앙값: 2, 판수: 1 }, '슬롯 11-10 앞의 편은 앞 판이다');
  const 절 = 관문.새방향절(t).join('\n');
  assert.match(절, /## 새 방향 편 — 저장 · 공유 · 좋아요\(synkbrief 슬롯 11-10~ · yuhobuilds 슬롯 11-10~\)/);
  assert.match(절, /synkbrief: 인스타 2\(2판\)/);
  assert.match(절, /\| 11-14 \| synkbrief_회의록_20261110 \| 인스타 \| 72시간 \| 900 \| 9 \| 2 \| 5 \| 7 \| 23 \|/);
  assert.match(절, /\| 유튜브 \| 24시간 \| 1,000 \| 20 \| 3 \| — \| — \| 23 \|/);
});

test('새 방향 절 — 새 편이 없으면 기준과 「아직 나온 편 없음」, 앞 판도 없으면 절을 내지 않는다', () => {
  assert.deepEqual(관문.새방향절(관문.새방향표({ judgments: [] })), []);
  const 절 = 관문.새방향절(관문.새방향표({ judgments: [{ post: 'a', folder: 'yuhobuilds_옛편_20261105', account: 'yuhobuilds-youtube', publishedAt: '2026-11-05T21:00:00+09:00', point: '72h', metrics: { views: 700, likes: 5, comments: 1 } }] })).join('\n');
  assert.match(절, /yuhobuilds: 유튜브 6\(1판\)/);
  assert.match(절, /synkbrief: 앞 판 없음/);
  assert.match(절, /아직 나온 편 없음/);
});
