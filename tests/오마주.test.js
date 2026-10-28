'use strict';
// 오마주(tools/오마주.js) · 올리기 전 검사 ⑮ — 네트워크 없이 본다. 장면은 합성이고, ffmpeg가 있으면 작은 합성 영상으로 컷도 잰다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 오마주 = require('../tools/오마주.js');
const 검사 = require('../tools/올리기전검사.js');

const 무늬 = (seed, n = 400) => {
  const v = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 0.37 * seed + seed) + Math.cos(i * 0.11 * seed));
  let m = 0; for (const x of v) m += x; m /= n;
  let s = 0; for (const x of v) s += (x - m) ** 2; s = Math.sqrt(s / n);
  return { z: v.map((x) => (x - m) / s), flat: false, mean: 120 };
};
// 화면 일부(뒤쪽 비율 r)만 다른 무늬로 바꾼 장면 — 컷은 아니고 한 장면 안의 「박자」
const 일부바꿈 = (a, seed, r) => {
  const b = 무늬(seed);
  const cut = Math.floor(a.z.length * (1 - r));
  return { z: a.z.map((x, i) => (i < cut ? x : b.z[i])), flat: false, mean: 120 };
};
const 반복 = (f, n) => Array.from({ length: n }, () => f);

test('원본 주소 — 쇼츠 · youtu.be · 틱톡 · 릴스 · 영상 ID만', () => {
  assert.deepEqual(오마주.parseSource('https://www.youtube.com/shorts/Ia6gYNDm-7o?feature=share'), { 곳: '유튜브', id: 'Ia6gYNDm-7o', 주소: 'https://www.youtube.com/shorts/Ia6gYNDm-7o' });
  assert.equal(오마주.parseSource('https://youtu.be/Ia6gYNDm-7o').id, 'Ia6gYNDm-7o');
  assert.equal(오마주.parseSource('Ia6gYNDm-7o').곳, '유튜브');
  assert.deepEqual(오마주.parseSource('https://www.tiktok.com/@cake.learnkorean/video/7701215756784045332'),
    { 곳: '틱톡', id: '7701215756784045332', 주소: 'https://www.tiktok.com/@cake.learnkorean/video/7701215756784045332' });
  assert.equal(오마주.parseSource('https://www.instagram.com/reel/C4HWoVyPkgC/').곳, '인스타');
  assert.equal(오마주.parseSource('그냥 글'), null);
});

test('컷과 박자 — 다른 그림은 컷, 한 장면 안에서 일부만 한 번에 바뀌면 박자(10-28 doci 「thank you」 꼴)', () => {
  const a = 무늬(1), b = 무늬(2.3);
  const b2 = 일부바꿈(b, 3.1, 0.2), b3 = 일부바꿈(b2, 4.7, 0.2);
  const 장면 = [...반복(a, 12), ...반복(b, 13), ...반복(b2, 15), ...반복(b3, 10)];
  assert.deepEqual(오마주.cutStarts(장면), [0, 1.2], '일부만 바뀐 장면은 컷이 아니다');
  assert.deepEqual(오마주.beatTimes(장면), [1.2, 2.5, 4], '컷 + 한 장면 안에서 바뀐 두 순간');
  // 한 색 화면 사이는 밝기가 크게 달라질 때만 컷
  const 어둠 = { z: new Float64Array(400), flat: true, mean: 10 }, 조금밝음 = { ...어둠, mean: 30 }, 밝음 = { ...어둠, mean: 200 };
  assert.deepEqual(오마주.cutStarts([...반복(어둠, 5), ...반복(조금밝음, 5), ...반복(밝음, 5)]), [0, 1]);
});

test('나란히 — 뼈대가 같으면 맞음(화면 짜임은 달라도), 옛 집 틀은 틀림(10-28 유호님 「완전 똑같이 할 필요는 없어」)', () => {
  const orig = { 길이: 14.7, 컷: [0], 박자: [1, 2.3, 4.4, 6.1, 9.3, 10.1, 11.2, 12.5], 뼈대: { 훅: 1, 반전: 9.3, 끝: 12.5 } };
  const 같음 = 오마주.compare(orig, { 길이: 15.2, 컷: [0], 박자: [1.1, 2.4, 4.5, 6.3, 9.6, 10.4, 11.6, 12.9] });
  assert.equal(같음.맞음, true, JSON.stringify(같음.항목));
  // 같은 뼈대를 칸마다 컷으로 나눈 판 — 바로 넘기는 컷 수는 원본과 달라도 칸 · 박자가 같으면 맞음
  const 컷으로 = 오마주.compare(orig, { 길이: 16, 컷: [0, 1.1, 2.5, 4.8, 6.6, 10.1, 11, 12.2, 13.6], 박자: [1.1, 2.5, 4.8, 6.6, 10.1, 11, 12.2, 13.6] });
  assert.equal(컷으로.맞음, true, JSON.stringify(컷으로.항목));
  // 옛 집 틀(E8 「밥 한번 먹어요」 실측 24.2초 — 2초 남짓마다 넘기고 7.6~18.6초 멈춘 글 카드)
  const 집틀 = 오마주.compare(orig, { 길이: 24.21, 컷: [0, 2.3, 4.9, 7.6, 18.6], 박자: [0.4, 2.2, 2.9, 4.8, 7.6, 8.3, 12.3, 14.3, 18.6, 19.2, 20.5] });
  assert.deepEqual(집틀.항목.filter((x) => !x.맞음).map((x) => x.이름), ['길이', '첫 2초', '박자'], '많은 박자가 우연히 겹쳐도 많은 쪽으로 나눠 통과하지 않는다');
  assert.equal(집틀.맞음, false);
  // 첫 0.5초 안의 페이드는 훅 박자로 치지 않는다(Fable P2 — 0.3초 페이드인이 첫 2초를 거짓으로 걸었다)
  assert.equal(오마주.compare(orig, { 길이: 15.2, 컷: [0], 박자: [0.3, 1.1, 2.4, 4.5, 6.3, 9.6, 10.4, 11.6, 12.9] }).맞음, true);
  // 반전 자리에 바뀌는 순간이 없으면 뼈대 자리가 틀림
  const 반전없음 = 오마주.compare(orig, { 길이: 14.7, 컷: [0], 박자: [1, 2.3, 4.4, 6.1, 7.6, 10.6, 11.2, 12.5] });
  assert.equal(반전없음.항목.find((x) => x.이름 === '뼈대 자리').맞음, false);
  // 「다르게」에 무엇 · 까닭을 적은 항목은 맞음을 막지 않는다(까닭 없는 줄은 무시)
  const 길게 = 오마주.compare(orig, { 길이: 22, 컷: [0], 박자: [1, 3.4, 6.6, 9.1, 13.9, 15.1, 16.8, 18.7] }, { 다르게: [{ 무엇: '길이', 까닭: '영어 뜻 줄을 읽을 시간' }, { 무엇: '박자' }] });
  assert.equal(길게.항목.find((x) => x.이름 === '길이').다르게, '영어 뜻 줄을 읽을 시간');
  assert.equal(길게.맞음, true, JSON.stringify(길게.항목));
});

test('박자 짝 — 같은 순서로만 짝짓고, 우리 초는 원본 길이에 맞춰 늘인다', () => {
  assert.deepEqual(오마주.pairCuts([0, 1, 2, 3], [0, 2, 4, 6], 0.5), { 짝: 3, 원본컷: 3, 우리컷: 3, 비율: 1, 중앙어긋남: 0 });
  assert.equal(오마주.pairCuts([0, 1, 2], [0, 1, 1.5, 2, 2.5, 3], 1).비율, 0.4, '우리 박자가 훨씬 많으면 많은 쪽으로 나눈다');
  const 뒤바뀜 = 오마주.pairCuts([0, 1, 5], [0, 5.2, 5.4], 1);
  assert.equal(뒤바뀜.짝, 1, '1초 자리에 짝이 없으면 뒤 컷을 앞으로 당겨 쓰지 않는다');
});

test('컷표 뼈대 — 박자 칸마다 한 줄, 컷인 칸은 표시, 원본의 말 · 글은 넣지 않는다', () => {
  const 표 = 오마주.cutTable({ 원본: { 주소: 'https://www.youtube.com/shorts/Ia6gYNDm-7o', 길이: 14.7 }, 컷: [0, 6.1], 박자: [1, 6.1], 갈래: '같은분야', 원본폴더: '.tmp/오마주/yt_x' });
  const 줄 = 표.split('\n').filter((l) => /^\| \d/.test(l));
  assert.deepEqual(줄.map((l) => l.split('|')[2].trim()), ['0.0–1.0 컷', '1.0–6.1', '6.1–14.7 컷']);
  assert.match(표, /2컷 · 박자 2번 · 갈래 같은분야/);
  assert.match(표, /뼈대\(지킬 것\)/);
});

test('⑮ — 10-29부터 만든 편은 오마주.json이나 「원본없음」 까닭이 있어야 하고, 어긋난 항목은 고칠 것', () => {
  const bundle = (name, prep = {}) => ({ dir: path.join(os.tmpdir(), name), name, prep });
  const 없음 = 검사.homageFindings(bundle('LAB_미안세단계_20261029'), ['a.mp4'], { homage: null });
  assert.deepEqual(없음.findings.map((f) => [f.level, f.code]), [['고칠 것', 'homage-missing']]);
  assert.equal(검사.homageFindings(bundle('LAB_미안세단계_20261029', { 원본없음: '시한 있는 소식 편 — 맞는 원본이 없다' }), ['a.mp4'], { homage: null }).findings.length, 0);
  assert.equal(검사.homageFindings(bundle('LAB_밥한번먹어요_20261027'), ['a.mp4'], { homage: null }).findings.length, 0, '옛 편은 그대로 둔다');

  const homage = { 원본: { 주소: 'https://www.youtube.com/shorts/Ia6gYNDm-7o', 길이: 14.7 }, 갈래: '같은분야', 컷: [0], 박자: [1, 2.3, 4.4, 6.1, 9.3, 10.1, 11.2, 12.5],
    긴구성: [[0, 9.25]], 멈춤: { 비율: 0.67, 구간: [[7, 9]] }, 확정: false, 다르게: [] };
  const fake = (r) => ({ measure: () => r, probe: () => ({ 길이: r.길이 }) });
  const 맞음 = 검사.homageFindings(bundle('LAB_미안세단계_20261029'), ['a.mp4'], { homage, ...fake({ 길이: 15, 컷: [0], 박자: [1, 2.4, 4.5, 6.2, 9.4, 10.3, 11.4, 12.7] }) });
  assert.deepEqual(맞음.findings.map((f) => f.code), ['homage-unconfirmed', 'homage-skeleton']);
  assert.equal(맞음.per.get('a.mp4').맞음, true);
  assert.equal(맞음.per.get('a.mp4').그대로, false, '원본 컷을 확정하기 전에는 ② · ⑬을 내리지 않는다');
  const 확정 = 검사.homageFindings(bundle('LAB_미안세단계_20261029'), ['a.mp4'], { homage: { ...homage, 확정: true, 뼈대: { 훅: 1, 반전: 9.3, 끝: 12.5 } }, ...fake({ 길이: 15, 컷: [0], 박자: [1, 2.4, 4.5, 6.2, 9.4, 10.3, 11.4, 12.7] }) });
  assert.deepEqual(확정.findings, []);
  assert.equal(확정.per.get('a.mp4').그대로, true);
  // 「다르게」로 넘긴 항목이 있으면 ⑮는 확인할 것이지만 ② · ⑬은 내리지 않는다(E8 꼴이 까닭 글만으로 빠져나가지 않게 — Fable P1)
  const 핑계 = 검사.homageFindings(bundle('LAB_미안세단계_20261029'), ['a.mp4'], { homage: { ...homage, 확정: true, 뼈대: { 훅: 1, 반전: 9.3, 끝: 12.5 },
    다르게: [{ 무엇: '길이', 까닭: '영어 뜻 줄을 읽을 시간' }, { 무엇: '첫 2초', 까닭: 'x' }, { 무엇: '박자', 까닭: 'x' }] },
  ...fake({ 길이: 24.21, 컷: [0, 2.3, 4.9, 7.6, 18.6], 박자: [0.4, 2.2, 2.9, 4.8, 7.6, 8.3, 12.3, 14.3, 18.6, 19.2, 20.5] }) });
  assert.ok(핑계.findings.every((f) => f.level === '확인할 것'));
  assert.equal(핑계.per.get('a.mp4').그대로, false);
  // 영상 판이 없는 편(그림 여러 장)은 원본을 묻지 않는다
  assert.equal(검사.homageFindings(bundle('LAB_x_20261030'), [], { homage: null }).findings.length, 0);
  const 집틀 = 검사.homageFindings(bundle('LAB_미안세단계_20261029'), ['a.mp4'], { homage: { ...homage, 확정: true, 뼈대: { 훅: 1, 반전: 9.3, 끝: 12.5 } }, ...fake({ 길이: 24.21, 컷: [0, 2.3, 4.9, 7.6, 18.6], 박자: [0.4, 2.2, 2.9, 4.8, 7.6, 8.3, 12.3, 14.3, 18.6, 19.2, 20.5] }) });
  assert.deepEqual(집틀.findings.map((f) => [f.level, f.code]), [['고칠 것', 'homage-길이'], ['고칠 것', 'homage-첫2초'], ['고칠 것', 'homage-박자']]);
  assert.equal(집틀.per.get('a.mp4').맞음, false);
  const 갈래없음 = 검사.homageFindings(bundle('X_20261030'), [], { homage: { ...homage, 갈래: null, 확정: true, 뼈대: { 훅: 1, 반전: 9.3, 끝: 12.5 } } });
  assert.deepEqual(갈래없음.findings.map((f) => f.code), ['homage-kind']);
});

test('② · ⑬ 내림 — 원본도 같은 자리가 한 구성 · 그만큼 멈췄을 때만', () => {
  const orig = { 길이: 14.7, 긴구성: [[0, 9.25]], 멈춤: { 비율: 0.67 } };
  assert.equal(검사.compositionLikeOriginal({ start: 0, end: 9.5 }, orig, 15), true);
  assert.equal(검사.compositionLikeOriginal({ start: 9.5, end: 14.8 }, orig, 15), false, '원본은 그 자리에서 바뀌었다');
  assert.equal(검사.stillLikeOriginal({ ratio: 0.7 }, orig), true);
  assert.equal(검사.stillLikeOriginal({ ratio: 0.9 }, orig), false, '원본보다 훨씬 더 멈추면 그대로 고칠 것');
  assert.equal(검사.stillLikeOriginal({ ratio: 0.2 }, { 길이: 10 }), false, '원본 멈춤을 안 잰 오마주.json은 내리지 않는다');
});

const ffmpeg있음 = spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0;
test('합성 영상 — 빨강 1.2초 · 파랑 1.5초 · 무늬 1.3초의 컷을 잰다', { skip: !ffmpeg있음 && 'ffmpeg 없음' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '오마주-'));
  try {
    const file = path.join(dir, 'a.mp4');
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=180x320:r=30:d=1.2', '-f', 'lavfi', '-i', 'color=c=blue:s=180x320:r=30:d=1.5',
      '-f', 'lavfi', '-i', 'testsrc2=s=180x320:r=30:d=1.3', '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0', '-pix_fmt', 'yuv420p', file], { windowsHide: true });
    assert.equal(r.status, 0, String(r.stderr));
    const m = 오마주.measure(file);
    assert.deepEqual(m.컷, [0, 1.2, 2.7]);
    assert.equal(오마주.probe(file).길이, 4);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
