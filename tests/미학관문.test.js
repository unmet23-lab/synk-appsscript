'use strict';

// ⑱ 미학 맹검 관문(tools/lib/미학관문.js) — 11-10 「LAB 하루 두 편」 설계 18: 「맹검못함」 · 「맹검판단」 글만으로는 답 없는 맹검을 넘기지 않는다.
// 막힌 증거(보낸 시각 · 거절 첫 줄) + 대체 눈(GPT → Opus) 결과 파일이 있어야 확인할 것, 셋 다 막히면 예비편(고칠 것). Fable은 시각 대체에서 뺀다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 관문 = require('../tools/lib/미학관문.js');

const { aestheticFindings, aestheticBlock } = 관문;
const 레벨 = (list) => list.map((f) => `${f.level}:${f.code}`);
const 지금 = Date.now();
const 때 = (ms) => new Date(지금 + ms).toISOString();

function 판(t) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), '미학관문-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true }));
  return (name, prep = {}) => { const dir = path.join(뿌리, name); fs.mkdirSync(path.join(dir, '게시'), { recursive: true }); return { name, dir, prep }; };
}
const 쓰기 = (b, 파일, body) => fs.writeFileSync(path.join(b.dir, '게시', 파일), JSON.stringify(body));
const 영상 = (b, 이름, 늦게 = 0) => { const f = path.join(b.dir, 이름); fs.writeFileSync(f, 'x'); const t = new Date(지금 + 늦게); fs.utimesSync(f, t, t); return f; };

const 화면셋 = [{ 번호: '01', 컷: '순간@1.20' }, { 번호: '02', 컷: '순간@4.29' }, { 번호: '03', 컷: '순간@22.76' }];
const 막힌P = (막힘 = [{ 묶음: 1, 화면: ['01', '02', '03'], 꼴: '거절', 보낸때: '2026-11-09 17:36:24', 첫줄: '저는 그런 것을 하도록 프로그램되지 않았습니다.' }]) =>
  ({ 판: 2, 만든때: 때(-60_000), 눈: '아르곤', 화면: 화면셋, 낱장: [], 쌍: [], 빠짐: ['01', '02', '03'], 막힘 });
const GPT적중 = { 기각: '6/8', 채택: '1/4', 쌍: '3/4', 아르곤: '7/8', 잰날: '2026-11-10' };
const 대체S = (낱장, 더 = {}) => ({ 판: 2, 만든때: 때(-30_000), 눈: 'gpt', 화면: 화면셋, 낱장, 쌍: [], 빠짐: [], 적중: GPT적중, 시도: [{ 눈: 'gpt', 결과: '받음', 때: 때(-30_000) }], ...더 });
const 다냄 = 화면셋.map(({ 번호 }) => ({ 번호, 판정: '그대로 냄', 점수: 8 }));

test('기록 없음: 맹검없음 · 「맹검못함」 글만 · 대체만 — 모두 고칠 것(글만으로는 못 넘는다)', (t) => {
  const 편 = 판(t);
  assert.deepEqual(레벨(aestheticFindings(편('없음'), [])), ['고칠 것:aesthetic-missing']);
  const 못함 = aestheticFindings(편('못함', { 맹검못함: '아르곤 줄 막힘' }), []);
  assert.deepEqual(레벨(못함), ['고칠 것:aesthetic-unverified'], '11-09 구멍 — 결과 없이 「맹검못함」만으로 넘어갔다');
  assert.match(못함[0].message, /막힌 증거.*--눈 gpt → --눈 opus.*예비편/);
  assert.deepEqual(레벨(aestheticFindings(편('판단만', { 맹검판단: '빈 날 없음' }), [])), ['고칠 것:aesthetic-missing'], '「맹검판단」은 아르곤이 본 기각에 쓰는 칸 — 결과가 없으면 그냥 맹검 없음');
  const 대체만 = 편('대체만'); 쓰기(대체만, 관문.대체이름, 대체S(다냄));
  assert.deepEqual(레벨(aestheticFindings(대체만, [])), ['고칠 것:aesthetic-order'], '아르곤부터 — 막힘 기록이 없으면 대체 눈을 안 받는다');
  assert.equal(aestheticBlock(편('못함2', { 맹검못함: '막힘' }), []), '맹검 막힘 · 대체 맹검 없음');
});

test('아르곤이 다 본 판은 예전 그대로 — 그대로 냄은 조용, 기각은 고칠 것 · 「맹검판단」이면 확인할 것', (t) => {
  const 편 = 판(t);
  const 좋음 = 편('좋음'); 쓰기(좋음, 관문.기록이름, { 만든때: 때(60_000), 낱장: [{ 번호: '01', 판정: '그대로 냄', 점수: 8 }], 빠짐: [] });
  assert.deepEqual(레벨(aestheticFindings(좋음, [])), []);
  const 기각 = 편('기각'); 쓰기(기각, 관문.기록이름, { 만든때: 때(60_000), 낱장: [{ 번호: '01', 판정: '기각', 점수: 3, 약점: ['[K35] 손 없이 움직이는 연필'] }, { 번호: '02', 판정: '고쳐서 냄', 점수: 5 }], 빠짐: [] });
  assert.deepEqual(레벨(aestheticFindings(기각, [])), ['고칠 것:aesthetic-reject', '확인할 것:aesthetic-fix']);
  기각.prep.맹검판단 = '빈 날 없음 — 두 번 고쳐도 기각, 가장 나은 판';
  assert.deepEqual(레벨(aestheticFindings(기각, [])), ['확인할 것:aesthetic-reject', '확인할 것:aesthetic-fix'], '기각 + 판단은 막힘이 아니다 — 아르곤이 실제로 봤다');
});

test('답 빠짐: 막힌 증거가 없으면(옛 기록) 「맹검판단」 · 「맹검못함」이 있어도 고칠 것', (t) => {
  const 편 = 판(t);
  const b = 편('옛빠짐', { 맹검판단: '아르곤 줄 막힘', 맹검못함: '아르곤 줄 막힘' });
  쓰기(b, 관문.기록이름, { 만든때: 때(-60_000), 낱장: [], 빠짐: ['01', '02', '03'] });
  const f = aestheticFindings(b, []);
  assert.deepEqual(레벨(f), ['고칠 것:aesthetic-incomplete']);
  assert.match(f[0].message, /막힌 증거.*없다.*글만으로는 못 넘는다/);
  const 증거빈 = 편('증거빈'); 쓰기(증거빈, 관문.기록이름, 막힌P([{ 묶음: 1, 화면: ['01', '02', '03'], 꼴: '거절' }]));
  assert.deepEqual(레벨(aestheticFindings(증거빈, [])), ['고칠 것:aesthetic-incomplete'], '꼴만 있고 보낸 시각 · 첫 줄이 없는 줄은 증거가 아니다');
  const 반만 = 편('반만'); 쓰기(반만, 관문.기록이름, 막힌P([{ 묶음: 1, 화면: ['01'], 꼴: '답 없음', 보낸때: '2026-11-09 15:47:00' }]));
  assert.match(aestheticFindings(반만, [])[0].message, /화면 02, 03/, '못 본 화면이 든 묶음마다 증거가 있어야 한다');
});

test('막힌 증거 + 대체 눈: 없음 → 고칠 것, GPT가 다 덮으면 확인할 것(적중과 함께), 대체 기각은 고칠 것', (t) => {
  const 편 = 판(t);
  const 대체없음 = 편('대체없음', { 맹검못함: '11-09 아르곤 거절' }); 쓰기(대체없음, 관문.기록이름, 막힌P());
  const f0 = aestheticFindings(대체없음, []);
  assert.deepEqual(레벨(f0), ['고칠 것:aesthetic-unverified']);
  assert.match(f0[0].message, /거절 11-09 17:36 「저는 그런 것을/);
  assert.match(f0[0].message, /--눈 gpt/);

  const 대체됨 = 편('대체됨', { 맹검못함: '11-09 아르곤 거절' }); 쓰기(대체됨, 관문.기록이름, 막힌P()); 쓰기(대체됨, 관문.대체이름, 대체S(다냄));
  const f1 = aestheticFindings(대체됨, []);
  assert.deepEqual(레벨(f1), ['확인할 것:aesthetic-substitute']);
  assert.match(f1[0].message, /대체 눈 GPT의 판정을 쓴다\(11-08 눈가림 기각 6\/8\(아르곤 7\/8\)\).*약한 눈/);
  assert.equal(aestheticBlock(대체됨, []), null, '예약 큐 · 14시 게시도 같은 판정');

  const 대체기각 = 편('대체기각'); 쓰기(대체기각, 관문.기록이름, 막힌P());
  쓰기(대체기각, 관문.대체이름, 대체S([{ 번호: '01', 판정: '기각', 점수: 3, 약점: ['떠 있는 은행잎'] }, { 번호: '02', 판정: '그대로 냄' }, { 번호: '03', 판정: '고쳐서 냄', 점수: 6 }]));
  assert.deepEqual(레벨(aestheticFindings(대체기각, [])), ['확인할 것:aesthetic-substitute', '고칠 것:aesthetic-reject', '확인할 것:aesthetic-fix']);
  assert.match(aestheticFindings(대체기각, []).find((x) => x.code === 'aesthetic-reject').message, /GPT 대체 맹검 「기각」/);
  대체기각.prep.맹검판단 = '고쳐도 기각 — 빈 날 없음';
  assert.deepEqual(레벨(aestheticFindings(대체기각, [])), ['확인할 것:aesthetic-substitute', '확인할 것:aesthetic-reject', '확인할 것:aesthetic-fix']);
});

test('대체 눈 자격: Fable · 그록은 안 받고, GPT는 적중 기록이 있어야, Opus는 적중 없이 받는다', (t) => {
  const 편 = 판(t);
  for (const [눈, 글] of [['fable', /언어 교정 몫/], ['그록', /무르다/], ['', /GPT → Claude Opus만/]]) {
    const b = 편(`눈-${눈 || '빈'}`); 쓰기(b, 관문.기록이름, 막힌P()); 쓰기(b, 관문.대체이름, { ...대체S(다냄), 눈 });
    const f = aestheticFindings(b, []);
    assert.deepEqual(레벨(f), ['고칠 것:aesthetic-eye'], 눈);
    assert.match(f[0].message, 글);
  }
  const 적중없음 = 편('적중없음'); 쓰기(적중없음, 관문.기록이름, 막힌P()); 쓰기(적중없음, 관문.대체이름, { ...대체S(다냄), 적중: null });
  assert.match(aestheticFindings(적중없음, [])[0].message, /적중.*먼저 잰다/);
  const opus = 편('opus'); 쓰기(opus, 관문.기록이름, 막힌P()); 쓰기(opus, 관문.대체이름, { ...대체S(다냄), 눈: 'opus', 적중: null, 시도: [{ 눈: 'gpt', 결과: '막힘', 꼴: '계정 없음', 첫줄: '쓸 수 있는 굽기 계정이 없다' }, { 눈: 'opus', 결과: '받음' }] });
  const f = aestheticFindings(opus, []);
  assert.deepEqual(레벨(f), ['확인할 것:aesthetic-substitute']);
  assert.match(f[0].message, /대체 눈 Claude Opus의 판정을 쓴다\(적중 모름/);
});

test('셋 다 막힘은 예비편(고칠 것) — GPT만 막혔으면 다음 눈 Opus를 가리킨다', (t) => {
  const 편 = 판(t);
  const gpt막힘 = { 눈: 'gpt', 결과: '막힘', 꼴: '계정 없음', 첫줄: '[codex계정] 쓸 수 있는 굽기 계정이 없다', 때: 때(-20_000) };
  const 하나 = 편('GPT막힘', { 맹검못함: '아르곤 · GPT 막힘' }); 쓰기(하나, 관문.기록이름, 막힌P()); 쓰기(하나, 관문.대체이름, 대체S([], { 시도: [gpt막힘] }));
  const f1 = aestheticFindings(하나, []);
  assert.deepEqual(레벨(f1), ['고칠 것:aesthetic-unverified']);
  assert.match(f1[0].message, /다음 눈 Claude Opus.*--눈 opus/);
  const 셋 = 편('셋다', { 맹검못함: '셋 다 막힘' }); 쓰기(셋, 관문.기록이름, 막힌P());
  쓰기(셋, 관문.대체이름, 대체S([], { 눈: 'opus', 시도: [gpt막힘, { 눈: 'opus', 결과: '막힘', 꼴: '부르기 실패', 첫줄: '하위 에이전트 한도', 때: 때(-10_000) }] }));
  const f2 = aestheticFindings(셋, []);
  assert.deepEqual(레벨(f2), ['고칠 것:aesthetic-swap']);
  assert.match(f2[0].message, /셋 다 막혔다: 예비편으로 바꿔 건다\(「맹검못함」으로 통과하지 않는다/);
  assert.equal(aestheticBlock(셋, []), '맹검 눈 셋 다 막힘 — 예비편');
});

test('일부만 막힘: 대체 눈은 아르곤이 못 본 컷만 덮으면 된다(컷 이름으로), 다른 컷을 보면 모자람', (t) => {
  const 편 = 판(t);
  const P = { ...막힌P([{ 묶음: 2, 화면: ['03'], 꼴: '답 없음', 보낸때: '2026-11-09 15:47:00', 첫줄: '보낸 글이 사라짐(대화 없음)' }]),
    낱장: [{ 번호: '01', 판정: '그대로 냄', 점수: 8 }, { 번호: '02', 판정: '고쳐서 냄', 점수: 6, 약점: ['끝 글자 작음'] }], 빠짐: ['03'] };
  const 덮음 = 편('덮음'); 쓰기(덮음, 관문.기록이름, P);
  쓰기(덮음, 관문.대체이름, 대체S([{ 번호: '01', 판정: '그대로 냄', 점수: 7 }], { 화면: [{ 번호: '01', 컷: '순간@22.76' }] }));
  assert.deepEqual(레벨(aestheticFindings(덮음, [])), ['확인할 것:aesthetic-substitute', '확인할 것:aesthetic-fix']);
  const 엇컷 = 편('엇컷'); 쓰기(엇컷, 관문.기록이름, P);
  쓰기(엇컷, 관문.대체이름, 대체S([{ 번호: '01', 판정: '그대로 냄', 점수: 7 }], { 화면: [{ 번호: '01', 컷: '순간@1.20' }] }));
  const f = aestheticFindings(엇컷, []);
  assert.deepEqual(레벨(f), ['고칠 것:aesthetic-incomplete', '확인할 것:aesthetic-fix']);
  assert.match(f[0].message, /화면 03을 못 덮었다/);
});

test('낡은 대체: 영상이 바뀌었거나 지금 아르곤 기록보다 먼저 만든 대체는 다시 본다', (t) => {
  const 편 = 판(t);
  const 바뀜 = 편('바뀜'); 쓰기(바뀜, 관문.기록이름, { ...막힌P(), 만든때: 때(-3_600_000) }); 쓰기(바뀜, 관문.대체이름, { ...대체S(다냄), 만든때: 때(-3_000_000) });
  const 새판 = 영상(바뀜, '최종.mp4', -1_000_000);
  assert.deepEqual(레벨(aestheticFindings(바뀜, [새판])), ['고칠 것:aesthetic-stale'], '아르곤 기록부터 낡았다 — 다시 렌더한 판은 다시 맹검(막혀도 증거가 남는다)');
  const 먼저 = 편('먼저'); 쓰기(먼저, 관문.기록이름, 막힌P()); 쓰기(먼저, 관문.대체이름, { ...대체S(다냄), 만든때: 때(-600_000) });
  const f = aestheticFindings(먼저, []);
  assert.deepEqual(레벨(f), ['고칠 것:aesthetic-stale']);
  assert.match(f[0].message, /대체 맹검이 지금 아르곤 기록보다 먼저/);
});

test('맹검한 영상(「영상」 칸)만 바뀜을 본다 — 언어판 렌더는 원본 맹검을 따르고, 다른 영상을 맹검했으면 고칠 것', (t) => {
  const 편 = 판(t);
  const b = 편('언어판');
  const 원본 = 영상(b, 'e32_en.mp4', -7_200_000), 중국어 = 영상(b, 'e32_cn.mp4', -60_000);
  쓰기(b, 관문.기록이름, { 만든때: 때(-3_600_000), 영상: [{ 파일: `${path.basename(b.dir)}/e32_en.mp4`, 이름: 'e32_en.mp4', 크기: 1 }], 낱장: [{ 번호: '01', 판정: '그대로 냄', 점수: 8 }], 빠짐: [] });
  assert.deepEqual(레벨(aestheticFindings(b, [원본, 중국어])), [], '원본은 맹검 뒤 그대로 · 중국어판은 동결 뒤 렌더(글자 검사가 본다)');
  const 다시 = 영상(b, 'e32_en.mp4', -60_000);
  assert.deepEqual(레벨(aestheticFindings(b, [다시, 중국어])), ['고칠 것:aesthetic-stale'], '원본이 다시 렌더되면 바뀜');
  const 다른 = 편('다른');
  쓰기(다른, 관문.기록이름, { 만든때: 때(60_000), 영상: [{ 파일: 'out/scene.mp4', 이름: 'scene.mp4' }], 낱장: [{ 번호: '01', 판정: '그대로 냄' }], 빠짐: [] });
  const f = aestheticFindings(다른, [영상(다른, '최종.mp4', -60_000)]);
  assert.deepEqual(레벨(f), ['고칠 것:aesthetic-stale']);
  assert.match(f[0].message, /scene\.mp4.*판 영상이 아니다/);
  assert.deepEqual(레벨(aestheticFindings(다른, [])), [], '판 영상이 없는 편(카드)은 넘긴다');
  // 「영상」 칸이 없는 옛 기록은 예전처럼 모든 영상
  const 옛 = 편('옛'); 쓰기(옛, 관문.기록이름, { 만든때: 때(-3_600_000), 낱장: [{ 번호: '01', 판정: '그대로 냄' }], 빠짐: [] });
  assert.deepEqual(레벨(aestheticFindings(옛, [영상(옛, 'cn.mp4', -60_000)])), ['고칠 것:aesthetic-stale']);
});

test('11-11 P1-4 ⓐ 「이번에 안 봄」으로 남은 옛 판정도 그대로 판정한다 — 뺀 컷 · 같은 그림을 다시 물어 바뀐 기각은 확인할 것(내력), 옛 기록은 조용', (t) => {
  const 편 = 판(t);
  const 남은기각 = 편('남은기각');
  쓰기(남은기각, 관문.기록이름, { 만든때: 때(60_000), 화면: [{ 번호: '01', 컷: '첫' }, { 번호: '02', 컷: '가운데', 안봄: { 이름: 'c1' } }],
    낱장: [{ 번호: '01', 판정: '그대로 냄', 점수: 8, 눈: '아르곤' }, { 번호: '02', 판정: '기각', 점수: 3, 눈: '아르곤', 안봄: { 이름: 'c1' }, 약점: ['떠 있는 잎'] }], 빠짐: [] });
  const f = aestheticFindings(남은기각, []);
  assert.deepEqual(레벨(f), ['고칠 것:aesthetic-reject']);
  assert.match(f[0].message, /02\(3점 · 이번에 안 봄\) 떠 있는 잎/);
  const 뺌 = 편('뺌'); 쓰기(뺌, 관문.기록이름, { 만든때: 때(60_000), 화면: [{ 번호: '01', 컷: '첫' }], 낱장: [{ 번호: '01', 판정: '그대로 냄' }], 빠짐: [],
    뺌: [{ 컷: '가운데', 번호: '02', 판정: '기각', 까닭: '가운데 장면을 렌더에서 뺐다' }, { 컷: '덤', 번호: '03', 판정: '그대로 냄', 까닭: '안 씀' }] });
  const f2 = aestheticFindings(뺌, []);
  assert.deepEqual(레벨(f2), ['확인할 것:aesthetic-history']);
  assert.match(f2[0].message, /아르곤 맹검 내력: 뺀 컷 1 — 가운데\(옛 기각\) 「가운데 장면을 렌더에서 뺐다」/, '그대로 냄을 뺀 것은 내력에 안 올린다');
  assert.equal(aestheticBlock(뺌, []), null, '확인할 것이라 예약 큐 · 14시 게시는 막지 않는다');
  const 다시굴림 = 편('다시굴림'); 쓰기(다시굴림, 관문.기록이름, { 만든때: 때(60_000), 화면: [{ 번호: '01', 컷: '끝' }, { 번호: '02', 컷: '첫' }],
    낱장: [{ 번호: '01', 판정: '그대로 냄', 앞판정: { 판정: '기각', 눈: '아르곤', 같은그림: true } }, { 번호: '02', 판정: '그대로 냄', 앞판정: { 판정: '기각', 눈: '아르곤', 같은그림: false } }], 빠짐: [] });
  const f3 = aestheticFindings(다시굴림, []);
  assert.deepEqual(레벨(f3), ['확인할 것:aesthetic-history']);
  assert.match(f3[0].message, /같은 그림을 다시 물어 「기각」이 바뀐 컷 1 — 끝\(아르곤 기각 → 그대로 냄\)/, '고친 그림(같은그림 false)은 내력에 안 올린다');
  // 대체 기록의 내력도 대체를 받을 때 본다
  const 대체내력 = 편('대체내력'); 쓰기(대체내력, 관문.기록이름, 막힌P());
  쓰기(대체내력, 관문.대체이름, 대체S(다냄.map((x) => (x.번호 === '01' ? { ...x, 앞판정: { 판정: '기각', 눈: 'opus', 같은그림: true } } : x))));
  assert.deepEqual(레벨(aestheticFindings(대체내력, [])), ['확인할 것:aesthetic-substitute', '확인할 것:aesthetic-history']);
  assert.match(aestheticFindings(대체내력, [])[1].message, /GPT 대체 맹검 내력: .*순간@1\.20\(Claude Opus 기각 → 그대로 냄\)/);
});

test('막힘됨 · 막힘증거: 꼴이 알려진 것이고 보낸 시각 · 첫 줄 · 끈 때 가운데 하나가 있어야 증거다', () => {
  assert.equal(관문.막힘됨({ 꼴: '거절', 첫줄: '저는 언어 모델일 뿐이라' }), true);
  assert.equal(관문.막힘됨({ 꼴: '줄 꺼짐', 끈때: '2026-11-08 08:23' }), true);
  assert.equal(관문.막힘됨({ 꼴: '거절' }), false);
  assert.equal(관문.막힘됨({ 꼴: '기분', 첫줄: 'x' }), false);
  assert.equal(관문.막힘됨(null), false);
  assert.deepEqual(관문.막힘증거({ 막힘: [{ 꼴: '답 없음', 보낸때: '2026-11-09 15:47:00' }] }, ['01', '02']).ok, true, '화면을 안 적은 줄은 기록 전체를 덮는다');
  assert.deepEqual(관문.막힘증거({ 막힘: [] }, ['01']), { ok: false, 글: '' });
  assert.deepEqual(관문.대체눈, ['gpt', 'opus']);
});
