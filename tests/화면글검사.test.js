'use strict';
// 화면 글 검사(tools/화면글검사.js) — composition 고르기, 다시 그린 그림과 영상 견주기, 말 짐작.
// 원본 대조 문턱의 근거(11-23 실측 — 원래 크기로 그려 영상과 같은 ffmpeg 넓이 평균으로 줄이고, 장마다 밝기를 직선으로 맞춘 뒤의 평균 차이.
// 평균은 108×192, 칸은 216×384 · 반씩 겹친 8×8):
//   같은 원본인 영상 36편(LAB 27 · synkbrief 5 · yuhobuilds 4) — 어긋난 장 0, 칸 최대 9, 장 평균 차이 최대 1.
//   물개 v14에 0.6초 구운 Arial 가는 자막 — 24px 15~16 · 30px 23~24 · 36px 31~32 · 64px 90 안팎으로 6장 잇달아 「못잼」.
//   원본을 고친 뒤 영상을 다시 뽑지 않은 편(사요찍어요 · 생신 · 성함)과 몽글 층만 다른 렌더(v14 원본 ↔ v13 영상)는 「못잼」이다.
//   전기장판 편은 11-16에 뽑은 뒤 이 PC의 그림 글자(🥶) 그림이 바뀌어 그 자리만 13 차이로 「못잼」이었다 — 받아들인 한계(확인할 것).
//   1/5 크기로 그리면 글자 테두리가 영상을 줄인 것과 달리 뭉개져 같은 원본도 칸이 55까지 튀었다(물개 v8 불꽃놀이 제목 31~32 — 원래 크기로는 0).
//   그래서 장 전체 · 글 자리 문턱은 12, 칸 문턱은 12, 잇단 어긋남은 한 장(0.1초)까지.
// 실제로 렌더하는 시험은 오래 걸려(1~2분) SYNK_화면글_실측=1일 때만 돈다 — 물개 v14는 걸림 0 · 원본 대조 통과.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../tools/화면글검사.js');

const comp = (id, sec, fps = 30) => ({ id, durationInFrames: Math.round(sec * fps), fps, width: 1080, height: 1920 });

test('composition — 영상 길이(±0.1초)가 같은 것만, 말 · 나라 이름이 든 것을 먼저, scene · still은 뒤로', () => {
  const comps = [comp('gyeseyo-CN', 16.3), comp('gyeseyo-scene', 16.3), comp('gyeseyo-MN', 16.3), comp('gyeseyo-MM', 16.3), comp('other', 19.4)];
  const info = { 길이: 16.32, 폭: 1080, 높이: 1920 };
  assert.deepEqual(T.후보들(comps, info, ['MN', 'mn']).map((c) => c.id), ['gyeseyo-MN', 'gyeseyo-CN', 'gyeseyo-MM', 'gyeseyo-scene']);
  assert.deepEqual(T.후보들([comp('m34-mn', 19.4), comp('m34-scene', 19.4)], { 길이: 17.81 }, ['mn']), [], '길이가 다르면 후보가 없다(옛 영상 v8 ↔ 지금 원본)');
  assert.deepEqual(T.후보들([comp('m34-scene', 19.4), comp('m34-mn', 19.4)], { 길이: 19.4 }, []).map((c) => c.id), ['m34-mn', 'm34-scene']);
});

// 견주기는 FINE(216×384) 그림을 받아 평균은 THUMB(108×192)로 줄여 재고, 칸은 FINE 그대로 잰다
const W = T.FINE.w;
const N = T.FINE.w * T.FINE.h;
const 판 = (fill) => { const b = new Uint8Array(N); for (let i = 0; i < b.length; i++) b[i] = fill(i); return b; };
const 무늬 = (k) => 판((i) => ((Math.floor(i / 2) * 37 + Math.floor(i / W / 2) * 13 + k * 11) % 200) + 20);
const 덧칠 = (g, y0, y1, x0, x1, px) => { const b = Uint8Array.from(g); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) b[y * W + x] = px(x, y, b[y * W + x]); return b; };

test('견주기 — 같은 그림은 밝기 범위가 달라도 맞고, 두 장(0.2초) 넘게 잇달아 다르면 못 믿는다', () => {
  const 그림 = Array.from({ length: 60 }, (_, k) => 무늬(k));
  const 영상 = 그림.map((g) => 판((i) => Math.round(g[i] * 0.86 + 16))); // 16~235 범위로 누른 영상
  const 같음 = T.견주기(그림, 영상);
  assert.equal(같음.통과, true);
  assert.equal(같음.비율, 1);
  const 다름 = 영상.map((g, k) => (k >= 20 && k < 25 ? 무늬(k + 99) : g));
  const r = T.견주기(그림, 다름);
  assert.equal(r.가장긴어긋남, 5);
  assert.equal(r.통과, false);
  const 한장 = 영상.map((g, k) => (k === 30 ? 무늬(500) : g));
  assert.equal(T.견주기(그림, 한장).통과, true, '한 장 튐은 넘긴다');
  assert.equal(T.견주기(그림, 영상.slice(0, 50)).통과, false, '장 수가 다르면 다른 영상');
  const 두장 = 영상.map((g, k) => (k === 30 || k === 31 ? 무늬(k + 99) : g));
  assert.equal(T.견주기(그림, 두장).가장긴어긋남, 2);
  assert.equal(T.견주기(그림, 두장).통과, false, '두 장 잇단 어긋남은 못 믿는다(RUN_MAX 1, GPT 5회차 GA7)');
});

test('GA1 — 영상에만 구운 글이 두 장 넘게 있으면 못 믿는다(칸 차이)', () => {
  const 그림 = Array.from({ length: 40 }, (_, k) => 무늬(k));
  const 영상 = 그림.map((g, k) => (k >= 10 && k < 16 ? 덧칠(g, 300, 320, 40, 180, (x) => ((x % 3) ? 255 : 0)) : Uint8Array.from(g)));
  const mask = new Uint8Array(T.THUMB.w * T.THUMB.h); for (let i = 0; i < T.THUMB.w * 20; i++) mask[i] = 1; // 원본 글은 맨 위에만
  const r = T.견주기(그림, 영상, mask);
  assert.equal(r.통과, false);
  assert.equal(r.가장긴어긋남, 6);
});

test('다시 GA6 — 영상에만 구운 가는 작은 자막(1080 폭 36px · 획 하나 굵기)도 못 믿는다', () => {
  const 그림 = Array.from({ length: 40 }, (_, k) => 판(() => 40)); // 어두운 바탕
  // 216×384에서 높이 7칸 · 세 칸에 한 칸만 흰 획
  const 영상 = 그림.map((g, k) => (k >= 10 && k < 16 ? 덧칠(g, 300, 307, 40, 180, (x, y, v) => ((x % 3 === 0 && y % 2 === 0) ? 230 : v)) : Uint8Array.from(g)));
  const r = T.견주기(그림, 영상);
  assert.equal(r.통과, false);
  assert.ok(Math.max(...r.칸차이) > T.BLOCK_DIFF);
});

test('3회차 GA1 — 원본 글 상자 안에 영상에만 얹은 자막도 칸 차이로 잡는다(원래 크기로 그려 원본 글 자리를 빼지 않는다)', () => {
  const 그림 = Array.from({ length: 40 }, (_, k) => 무늬(k));
  const mask = new Uint8Array(T.THUMB.w * T.THUMB.h); for (let y = 40; y < 70; y++) for (let x = 6; x < 102; x++) mask[y * T.THUMB.w + x] = 1; // 원본 글 상자(폭 960)
  const 영상 = 그림.map((g, k) => (k >= 10 && k < 16 ? 덧칠(g, 100, 107, 30, 190, (x, y, v) => ((x % 3 === 0 && y % 2 === 0) ? 230 : v)) : Uint8Array.from(g)));
  const r = T.견주기(그림, 영상, mask);
  assert.equal(r.통과, false);
  assert.equal(r.가장긴어긋남, 6);
});

test('GA2 — 그린 장마다 글 기록이 있어야 하고, 읽은 글이 하나도 없으면 판정하지 않는다', () => {
  const 장 = (f, t) => ({ f, items: t ? [{ t, b: [0, 0, 100, 50], o: 1 }] : [] });
  assert.equal(T.기록확인({ order: [0, 3, 6], frames: [장(0, '물'), 장(3, '물'), 장(6, '물')], errors: [] }), null);
  assert.match(T.기록확인({ order: [0, 3, 6, 9], frames: [장(0, '물'), 장(9, '물')], errors: [] }), /4장 가운데 2장의 글 기록이 없다/);
  assert.match(T.기록확인({ order: [0, 3], frames: [장(0), 장(3)], errors: [] }), /하나도 못 읽었다/);
  assert.match(T.기록확인({ order: [0], frames: [장(0, '물')], errors: ['boom'] }), /주입 스크립트가 오류/);
});

test('다시 GA1 · GA9 — 한 후보의 글 기록 빠짐이나 렌더 오류가 다음 후보를 막지 않는다', async () => {
  const 맞음 = { 통과: true, 비율: 1, 가운데차: 1 };
  const 다름 = { 통과: false, 비율: 0.2, 가운데차: 9 };
  const cs = [{ id: 'a-mn' }, { id: 'b-mn' }];
  let r = await T.후보고르기(cs, async (c) => (c.id === 'a-mn' ? { 대조: 맞음, g: 'A', 기록: '그린 10장 가운데 3장의 글 기록이 없다' } : { 대조: 맞음, g: 'B', 기록: null }));
  assert.equal(r.고른.comp.id, 'b-mn', '첫 후보의 글 기록이 비면 둘째 후보를 그린다');
  r = await T.후보고르기(cs, async (c) => { if (c.id === 'a-mn') throw new Error('boom'); return { 대조: 맞음, g: 'B', 기록: null }; });
  assert.equal(r.고른.comp.id, 'b-mn', '첫 후보의 렌더 오류는 둘째 후보를 막지 않는다');
  r = await T.후보고르기(cs, async (c) => { if (c.id === 'a-mn') throw new Error('boom'); return { 대조: 다름, g: 'B', 기록: null }; });
  assert.match(r.까닭, /^렌더하다 멈췄다: a-mn — boom/, '오류가 섞이면 관문이 다음에 다시 재는 까닭으로');
  r = await T.후보고르기(cs, async () => ({ 대조: 맞음, g: 'A', 기록: '원본에서 화면 글을 하나도 못 읽었다' }));
  assert.match(r.까닭, /하나도 못 읽었다/);
  r = await T.후보고르기(cs, async () => ({ 대조: 다름, g: 'A', 기록: null }));
  assert.match(r.까닭, /^원본을 다시 그린 그림이 영상과 안 맞는다\(a-mn 20% · 가운데 차 9 \/ b-mn/);
});

test('3회차 GA7 · GA10 — 첫 줄이 빈 렌더 오류도 다시 잴 까닭으로, 글 기록 빠짐을 글을 못 읽음보다 먼저 고른다', async () => {
  const 맞음 = { 통과: true, 비율: 1, 가운데차: 1 };
  const cs = [{ id: 'a-mn' }, { id: 'b-mn' }];
  let r = await T.후보고르기(cs, async () => { throw new Error('\nrender failed'); });
  assert.match(r.까닭, /^렌더하다 멈췄다: a-mn — render failed/);
  r = await T.후보고르기(cs, async (c) => ({ 대조: 맞음, g: c.id, 기록: c.id === 'a-mn' ? '원본에서 화면 글을 하나도 못 읽었다' : '그린 10장 가운데 2장의 글 기록이 없다' }));
  assert.match(r.까닭, /글 기록이 없다/);
});

test('설계 5 — 그리지 않은 후보가 남았으면 「안 맞는다」로 단정하지 않는다(관문이 다시 잰다)', async () => {
  const 다름 = { 통과: false, 비율: 0.2, 가운데차: 9 };
  const r = await T.후보고르기([{ id: 'a-mn' }, { id: 'b-cn' }, { id: 'c-mm' }], async () => ({ 대조: 다름, g: 'x', 기록: null }), [{ id: 'd-vn' }]);
  assert.match(r.까닭, /^그린 후보 3개가 영상과 안 맞고 길이가 같은 후보 1개\(d-vn\)는 그리지 않았다/);
  assert.ok(!require('../tools/lib/화면글관문.js').남길못잼.test(r.까닭));
});

test('글 자리 — 보이는 글 덩이의 상자만 작은 그림 칸으로 합친다', () => {
  const mask = T.글자리([{ f: 0, items: [{ t: '물개', b: [0, 0, 1080, 192], o: 1 }, { t: '+', b: [0, 1800, 1080, 1920], o: 1 }, { t: 'ус', b: [0, 960, 1080, 1152], o: 0.2 }] }], { width: 1080, height: 1920 });
  const rows = new Set();
  mask.forEach((v, i) => { if (v) rows.add(Math.floor(i / T.THUMB.w)); });
  const h = T.THUMB.h;
  assert.ok(rows.has(0) && rows.has(Math.floor(h / 10) - 1) && !rows.has(Math.floor(h / 2) + 2) && !rows.has(h - 1), '글자 없는 「+」와 반투명 줄은 빼고 「물개」 줄만');
  assert.equal(T.글자리([{ f: 0, items: [] }], { width: 1080, height: 1920 }), null);
});

test('보는 사람의 말 — 판 폴더 꼬리, _mn_ 편, 그 밖 LAB은 영어, synkbrief는 한국어', () => {
  const 편 = path.join(__dirname, '없는편_mn_20261124');
  assert.equal(T.언어짐작(편, path.join(편, '게시', '03-xiaohongshu-cn', 'video.mp4'), 'LAB'), 'zh-Hans');
  assert.equal(T.언어짐작(편, path.join(편, '게시', '04-tiktok-mm', 'video.mp4'), 'LAB'), 'my');
  assert.equal(T.언어짐작(편, path.join(편, '게시', '01-ig-fb', 'video.mp4'), 'LAB'), 'mn');
  assert.equal(T.언어짐작(path.join(__dirname, 'LAB_없는편_20261124'), path.join(__dirname, 'x', 'video.mp4'), 'LAB'), 'en');
  assert.equal(T.언어짐작(path.join(__dirname, 'synkbrief_없는편_20261124'), path.join(__dirname, 'x', 'video.mp4'), 'synkbrief'), 'ko');
});

const 물개 = path.join(__dirname, '..', 'docs', '마케팅', 'LAB_물개_mn_20261111');
const v14 = path.join(물개, '게시', '03-fb-mn-v14', 'video.mp4');
test('실측 — 물개 v14는 원본 대조가 맞고 걸림이 없다', { skip: process.env.SYNK_화면글_실측 !== '1' || !fs.existsSync(v14) || !T.부품찾기('4.0.535') ? 'SYNK_화면글_실측=1 · 부품 · 영상이 있어야 돈다' : false, timeout: 10 * 60 * 1000 }, async () => {
  const out = await T.검사(물개, { 영상: [v14] });
  const r = out.결과[0];
  assert.ok(!r.못잼, r.못잼);
  assert.equal(r.대조.통과, true);
  assert.deepEqual(r.걸림, []);
  assert.deepEqual(r.낱말.map((x) => x.낱말), ['물', '개', '물개', '고기']);
});
