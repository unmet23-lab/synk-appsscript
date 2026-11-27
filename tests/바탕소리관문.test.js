'use strict';
// ㉔ 바탕 잡음(tools/lib/바탕소리관문.js) — 11-27 유호님 「화이트노이즈 소리랑 … 」: E64 「서비스」 v7의 분식집 바탕(합성 잡음)을 막고 v8(바탕 뺌)은 지나간다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bedNoiseFindings, 잡음섞임, 잡음바탕, FIX_FROM } = require('../tools/lib/바탕소리관문.js');
const { FIX, LOOK } = require('../tools/lib/게시글규칙.js');

function 편(t, name, prep = { 브랜드: 'LAB' }) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), '바탕-')), name);
  fs.mkdirSync(path.join(dir, '게시', '01-youtube-en'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'remotion', 'public', 'sfx'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'remotion', 'public', 'vo'), { recursive: true });
  const video = path.join(dir, '게시', '01-youtube-en', 'video.mp4');
  fs.writeFileSync(video, 'x');
  const bed = path.join(dir, 'remotion', 'public', 'sfx', 'bunsik.wav');
  fs.writeFileSync(bed, 'x');
  fs.writeFileSync(path.join(dir, 'remotion', 'public', 'vo', 'm1.wav'), 'x');
  fs.writeFileSync(path.join(dir, 'remotion', 'public', 'bgm.wav'), 'x');
  t.after(() => fs.rmSync(path.dirname(dir), { recursive: true, force: true }));
  return { bundle: { name, dir, prep }, video, bed };
}

// 실측값(11-27): v7 최종본 · v8 최종본 · bunsik.wav
const v7 = { 길이: 29.4, 평탄도: 0.322, 잡음초비율: 0.59, 초수: 29, 흔들림dB: 5.4 };
const v8 = { 길이: 30.4, 평탄도: 0.125, 잡음초비율: 0, 초수: 30, 흔들림dB: 6.6 };
const 분식 = { 길이: 30, 평탄도: 0.356, 잡음초비율: 1, 초수: 30, 흔들림dB: 0.71 };
const fake = (video, bed, mix) => (files) => {
  assert.ok(files.includes(video));
  assert.ok(!files.some((f) => /[\\/]vo[\\/]|bgm\.wav$/.test(f)), '목소리 · 음악은 바탕 후보가 아니다');
  return files.map((f) => ({ 파일: f, ...(f === video ? mix : f === bed ? 분식 : { 못잼: '?' }) }));
};

test('문턱 — 실측 v7 · 드세요 · 아까워 · 이잔주세요는 잡음, v8과 음악만 있는 편(사층F 0.12 · 배 0.179)은 아님', () => {
  assert.equal(잡음섞임(v7), true);
  assert.equal(잡음섞임({ 평탄도: 0.255, 잡음초비율: 0.4 }), true);
  assert.equal(잡음섞임({ 평탄도: 0.224, 잡음초비율: 0.23 }), true);
  assert.equal(잡음섞임({ 평탄도: 0.203, 잡음초비율: 0.21 }), true);
  assert.equal(잡음섞임(v8), false);
  assert.equal(잡음섞임({ 평탄도: 0.045, 잡음초비율: 0.12 }), false);
  assert.equal(잡음섞임({ 평탄도: 0.179, 잡음초비율: 0 }), false);
  assert.equal(잡음바탕(분식), true);
  assert.equal(잡음바탕({ 길이: 2.4, 평탄도: 0.56, 흔들림dB: 0.36 }), false, '짧은 효과음은 바탕이 아니다');
  assert.equal(잡음바탕({ 길이: 19, 평탄도: 0.13, 흔들림dB: 0.8 }), false, '음악');
});

test(`${FIX_FROM}부터 만든 LAB 편 — 잡음 섞임은 고칠 것이고 바탕 파일을 이름으로 짚는다, 바탕을 뺀 판은 지나간다`, (t) => {
  const { bundle, video, bed } = 편(t, 'LAB_무엇_20261128');
  const r = bedNoiseFindings(bundle, [video], { run: fake(video, bed, v7) });
  assert.equal(r.length, 1);
  assert.equal(r[0].level, FIX);
  assert.match(r[0].message, /59%가 고르게 쉬익거리는 잡음 같다/);
  assert.match(r[0].message, /remotion\/public\/sfx\/bunsik\.wav/);
  assert.deepEqual(bedNoiseFindings(bundle, [video], { run: fake(video, bed, v8) }), []);
});

test('「바탕소리판단」 까닭이 있으면 확인할 것, 앞에 만든 LAB 편과 synkbrief도 확인할 것, 다른 브랜드는 묻지 않는다', (t) => {
  const a = 편(t, 'LAB_무엇_20261128', { 브랜드: 'LAB', 바탕소리판단: '빗소리 장면이라 일부러 깜' });
  const r1 = bedNoiseFindings(a.bundle, [a.video], { run: fake(a.video, a.bed, v7) });
  assert.equal(r1[0].level, LOOK);
  assert.match(r1[0].message, /빗소리 장면/);
  const b = 편(t, 'LAB_서비스_20261125');
  assert.equal(bedNoiseFindings(b.bundle, [b.video], { run: fake(b.video, b.bed, v7) })[0].level, LOOK);
  const c = 편(t, 'synkbrief_무엇_20261128', { 브랜드: 'synkbrief' });
  assert.equal(bedNoiseFindings(c.bundle, [c.video], { run: fake(c.video, c.bed, v7) })[0].level, LOOK);
  const d = 편(t, 'PULSE_무엇_20261128', { 브랜드: 'PULSE' });
  assert.deepEqual(bedNoiseFindings(d.bundle, [d.video], { run: () => { throw new Error('부르면 안 됨'); } }), []);
});

test('못 재면 확인할 것 한 줄 — 올리기 전 검사를 멈추지 않는다', (t) => {
  const { bundle, video } = 편(t, 'LAB_무엇_20261128');
  const r = bedNoiseFindings(bundle, [video], { run: () => { throw new Error('python 없음'); } });
  assert.equal(r.length, 1);
  assert.equal(r[0].level, LOOK);
  assert.equal(r[0].code, 'bed-noise-failed');
  const r2 = bedNoiseFindings(bundle, [video], { run: (files) => files.map((f) => ({ 파일: f, 못잼: '1초보다 짧거나 읽지 못했다' })) });
  assert.equal(r2[0].code, 'bed-noise-failed');
});
