'use strict';
// 실제 HTML의 스크립트를 실행한다. DOM·이미지 디코더는 모의이며 픽셀 검수와 구분한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../bots/오버레이/마스코트.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const 표정들 = ['기본', '깜빡', '눈웃음', '궁금함', '집중', '안도', '응원', '놀람'];
const flush = () => new Promise(setImmediate);
function 목록(상태 = '통과') {
  const 차림 = {};
  for (const [키, 의상, 악세] of [['헤드폰+한복', '한복', '헤드폰'], ['안경+후드', '후드', '안경'], ['모자+델', '델', '모자']]) {
    차림[키] = { 의상, 악세, 상태, 표정: Object.fromEntries(표정들.map(p => [p, `까몽/${키}_${p}.webp`])) };
  }
  return { 캐릭터: { 까몽: { 의상: ['한복', '후드', '델'], 악세: ['헤드폰', '안경', '모자'], 차림 }, 몽글: { 의상: ['한복'], 악세: ['헤드폰'], 차림: {} } } };
}
async function 화면(options = {}) {
  let now = 0, timerId = 0;
  const nodes = new Map(), timers = new Map(), images = [], loads = [], decoded = [], warnings = [];
  const preference = { matches: !!options.reduce };
  function element() {
    const classes = new Set();
    return {
      style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, children: [], hidden: false,
      clientWidth: 614.4, clientHeight: 614.4,
      classList: { add(x) { classes.add(x); }, contains(x) { return classes.has(x); } },
      appendChild(x) { x.remove(); this.children.push(x); x.parent = this; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; },
      removeAttribute(k) { if (k === 'src') this._src = ''; else delete this[k]; },
      getContext() { throw Error('VM에서 알파 픽셀은 측정하지 않는다'); },
    };
  }
  function Image() {
    Object.assign(this, element()); this.naturalWidth = 1024; this.naturalHeight = 1024; images.push(this);
    this.decode = async () => {
      const src = this.src;
      if (options.holdDecode && src.includes(options.holdDecode)) await new Promise(resolve => { this.releaseDecode = resolve; });
      if (options.decodeFail && src.includes(options.decodeFail)) throw Error('decode 실패');
      decoded.push(src);
    };
    Object.defineProperty(this, 'src', {
      get() { return this._src || ''; },
      set(src) {
        this._src = src; loads.push(src);
        queueMicrotask(() => {
          if (this._src !== src) return;
          if (options.sizeFail && src.includes(options.sizeFail)) this.naturalWidth = 512;
          if (options.imageFail && src.includes(options.imageFail)) this.onerror?.(); else this.onload?.();
        });
      },
    });
  }
  const document = {
    body: element(), documentElement: element(),
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    createElement: element,
  };
  const ctx = vm.createContext({
    document, Image, URLSearchParams, AbortController, innerHeight: 1080,
    라디오표정리듬: require('../bots/오버레이/라디오표정리듬.js'),
    location: { search: options.search || '?밤=0' }, performance: { now: () => now },
    console: { warn: s => warnings.push(s), error: s => warnings.push(s) },
    matchMedia: () => preference, requestAnimationFrame() {}, setInterval() {},
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    BroadcastChannel: function () {}, window: { addEventListener() {} },
    fetch: async () => {
      if (options.fetchFail) throw Error('목록 통신 실패');
      return { ok: true, json: async () => structuredClone(options.catalogue || 목록()) };
    },
  });
  vm.runInContext(script, ctx); await flush();
  const evalJS = s => vm.runInContext(s, ctx);
  const snap = () => JSON.parse(JSON.stringify(ctx.window.마스코트상태()));
  function tick(ms) { now += ms; evalJS('한틱()'); }
  async function choose(value) {
    const p = ctx.window.마스코트차림(value); await flush(); tick(150); tick(150); return p;
  }
  return { ctx, images, loads, decoded, warnings, evalJS, snap, tick, choose, preference, timers };
}
const 한복 = { DJ: '까몽', 의상: '한복', 악세: '헤드폰' };
const 후드 = { DJ: '까몽', 의상: '후드', 악세: '안경' };

test('기본 방송의 기존 까몽 파일은 보존하고 URL DJ는 결이 덮지 않는다', async () => {
  const h = await 화면();
  assert.equal(h.snap().DJ, '까몽'); assert.match(h.snap().표시파일, /라디오DJ\/까몽_여름델\+전설의팻말_본체.webp$/);
  const m = await 화면({ search: '?DJ=마린&결=전자밤도시&밤=0' });
  assert.equal(m.snap().DJ, '마린');
  m.ctx.window.마스코트반응({ 종류: '결', 결: '시티팝노을휴양지' }); m.tick(2500);
  assert.equal(m.snap().DJ, '마린'); assert.equal(m.snap().결, '시티팝노을휴양지');
});
test('선택 8컷을 모두 decode한 뒤 화면 밖에서 원자 교체하고 기존 파일은 그대로 둔다', async () => {
  const h = await 화면();
  const base = h.images.filter(im => im.src).map(im => [im, im.src]);
  const before = h.snap().표시파일;
  const p = h.ctx.window.마스코트차림(한복); await flush();
  assert.equal(h.snap().표시파일, before); assert.equal(h.snap().보류이미지수, 8);
  assert.equal(h.decoded.filter(s => s.includes('/라디오차림/')).length, 8);
  h.tick(120); assert.equal(h.snap().표시파일, before);
  h.tick(30); assert.equal(h.snap().차림.키, '헤드폰+한복');
  assert.match(h.snap().transform, /translateY\([1-9]/);
  assert.equal(h.images.filter(im => im.parent && im.parent === h.evalJS('틀') && im.src && !im.hidden).length, 1);
  h.tick(150); await p;
  assert.equal(h.snap().활성이미지수, 8); assert.equal(h.snap().보류이미지수, 0);
  for (const [im, src] of base) assert.equal(im.src, src, '기존 이미지 경로를 덮어쓰지 않는다');
});
test('검수후보는 방송에서 거절하며 검수 URL에서만 선택 가능하다', async () => {
  const h = await 화면({ catalogue: 목록('검수후보') });
  await assert.rejects(h.ctx.window.마스코트차림(한복), { code: '검수미완료' });
  assert.equal(h.snap().차림.상태, '기존승인'); assert.equal(h.snap().보류이미지수, 0);
  const qa = await 화면({ catalogue: 목록('검수후보'), search: '?검수=1&밤=0', reduce: true });
  await qa.choose(한복); assert.equal(qa.snap().차림.상태, '검수후보');
});
test('1+1 초과·다른 캐릭터 항목·미준비 조합을 다른 옷으로 대체하지 않는다', async () => {
  const h = await 화면();
  for (const value of [{ ...한복, 악세: ['헤드폰', '안경'] }, { ...한복, 의상: '한복+후드' }, { ...한복, 악세2: '안경' },
    { ...한복, DJ: '몽글' }, { ...한복, DJ: '마린' }, { ...한복, 악세: '안경' }]) {
    await assert.rejects(h.ctx.window.마스코트차림(value));
    assert.equal(h.snap().차림.상태, '기존승인'); assert.equal(h.snap().선택중, false);
  }
  assert.equal(h.loads.filter(s => s.includes('/라디오차림/')).length, 0);
});
for (const [name, option] of [['404', 'imageFail'], ['decode 실패', 'decodeFail'], ['틀린 해상도', 'sizeFail']]) {
  test(`한 표정 ${name}이면 현재 차림을 지키고 보류 이미지를 해제한다`, async () => {
    const h = await 화면({ [option]: '안경+후드_눈웃음' });
    await h.choose(한복); const before = h.snap().표시파일;
    await assert.rejects(h.ctx.window.마스코트차림(후드));
    assert.equal(h.snap().표시파일, before); assert.equal(h.snap().차림.키, '헤드폰+한복');
    assert.equal(h.snap().보류이미지수, 0); assert.ok(h.snap().오류);
    assert.ok(!h.images.some(im => im.src.includes('안경+후드')));
  });
}
test('누락·외부경로·다른 캐릭터 이미지의 목록을 이미지 로드 전에 거절한다', async () => {
  for (const bad of [undefined, '../까몽/파일.webp', 'https://example.test/파일.webp', '마린/파일.webp', '까몽/%2e%2e/파일.webp']) {
    const catalogue = 목록(); catalogue.캐릭터.까몽.차림['헤드폰+한복'].표정.놀람 = bad;
    const h = await 화면({ catalogue });
    await assert.rejects(h.ctx.window.마스코트차림(한복), { code: '잘못된파일' });
    assert.equal(h.loads.filter(s => s.includes('/라디오차림/')).length, 0);
  }
});
test('느린 이전 선택이 나중에 끝나도 최신 선택을 덮지 않고 캐시는 활성1+보류1로 제한된다', async () => {
  const h = await 화면({ holdDecode: '헤드폰+한복_기본' });
  const older = h.ctx.window.마스코트차림(한복); const settled = Promise.allSettled([older]); await flush();
  assert.equal(h.snap().보류이미지수, 1);
  const slow = h.images.find(im => im.releaseDecode);
  await h.choose(후드); slow.releaseDecode(); await flush();
  assert.equal((await settled)[0].reason.code, '선택취소'); assert.equal(h.snap().차림.키, '안경+후드');
  assert.equal(h.snap().보류이미지수, 0); assert.equal(slow.src, '');
  for (let i = 0; i < 6; i++) await h.choose(i % 2 ? 후드 : { DJ: '까몽', 의상: '델', 악세: '모자' });
  assert.equal(h.images.filter(im => im.src.includes('/라디오차림/')).length, 8);
  const requests = h.loads.length; await h.choose(후드); assert.equal(h.loads.length, requests, '현재 세트 재선택은 재로딩하지 않는다');
});
test('선택 이동 중 재선택은 이전 결과를 취소하고 빈 이미지 없이 최신 세트만 남긴다', async () => {
  const h = await 화면();
  const older = h.ctx.window.마스코트차림(한복); const settled = Promise.allSettled([older]); await flush(); h.tick(150);
  await h.choose(후드);
  assert.equal((await settled)[0].reason.code, '선택취소'); assert.equal(h.snap().차림.키, '안경+후드');
  assert.equal(h.images.filter(im => im.src.includes('/라디오차림/')).length, 8);
});
test('고른 착용 세트는 장르와 인사·정답·모든 검수표정 동안 유지되고 몸을 찌그러뜨리지 않는다', async () => {
  const h = await 화면({ search: '?검수=1&밤=0' }); await h.choose(한복);
  h.ctx.window.마스코트반응({ 종류: '결', 결: '전자밤도시', DJ: '마린' });
  assert.equal(h.snap().차림.키, '헤드폰+한복'); assert.equal(h.snap().DJ, '까몽');
  for (const name of 표정들) {
    const s = h.ctx.window.마스코트검수표정(name); assert.equal(s.표정, name); assert.match(s.표시파일, /헤드폰\+한복/);
  }
  h.ctx.window.마스코트검수표정(null);
  for (const event of ['인사', '정답', '투표', '체크인']) {
    h.ctx.window.마스코트반응(event); h.tick(100);
    assert.equal(h.snap().차림.키, '헤드폰+한복'); assert.doesNotMatch(h.snap().transform, /scale/); h.tick(3000);
  }
});
test('reduced motion은 위치 움직임 없이 교체하며 승인된 기본 마린 인사 컷을 유지한다', async () => {
  const h = await 화면({ reduce: true }); await h.choose(한복);
  assert.equal(h.snap().교체중, false); assert.match(h.snap().transform, /translateY\(0/);
  h.ctx.window.마스코트반응('정답'); h.tick(100); assert.match(h.snap().transform, /translateY\(0\.00px\) rotate\(0\.00deg\)/);
  const m = await 화면({ search: '?DJ=마린&밤=0', reduce: true });
  m.ctx.window.마스코트반응('인사'); m.tick(100); assert.equal(m.snap().표정, '인사'); assert.match(m.snap().표시파일, /마린_인사.webp$/);
  assert.throws(() => m.ctx.window.마스코트검수표정('눈웃음'), { code: '검수전용' });
});
test('URL 차림 선택도 같은 검증·비동기 계약을 통과한다', async () => {
  const h = await 화면({ search: '?DJ=까몽&의상=한복&악세=헤드폰&밤=0', reduce: true });
  await flush(); assert.equal(h.snap().차림.키, '헤드폰+한복');
  const before = h.snap(); before.차림.의상 = '변조'; assert.equal(h.snap().차림.의상, '한복', '상태 객체 수정이 런타임을 바꾸지 않는다');
});
test('같은 DJ는 큰 모자·긴 옷의 알파 높이가 달라도 얼굴 배율과 좌표 보정이 같다', async () => {
  const h = await 화면();
  h.evalJS("액자재기 = im => ({높이몫: im.src.includes('모자+델') ? 0.95 : 0.55, 바닥몫: 0.1})");
  await h.choose(한복);
  const first = h.evalJS('선택세트.이미지.기본.style.transform');
  await h.choose({ DJ: '까몽', 의상: '델', 악세: '모자' });
  assert.equal(h.evalJS('선택세트.이미지.기본.style.transform'), first);
  assert.equal(first, h.evalJS('DJ꼴.까몽'));
});
