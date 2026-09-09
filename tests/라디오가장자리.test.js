'use strict';
// 실제 그림을 읽거나 고치지 않는다. 합성 RGBA와 모의 브라우저만 검사한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 만들기, 적용 } = require('../bots/오버레이/라디오가장자리.js');

function fixture(width = 40, height = 36) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) data.set([23, 19, 17, 0], p * 4);
  const inset = 5;
  for (let y = inset; y < height - inset; y++) for (let x = inset; x < width - inset; x++) {
    const depth = Math.min(x - inset + 1, width - inset - x, y - inset + 1, height - inset - y);
    const white = Math.max(0, (7 - depth) / 8);
    data.set([70, 53, 41].map(value => Math.round(value + (255 - value) * white))
      .concat(depth <= 6 ? Math.min(245, 50 + depth * 32) : 255), (y * width + x) * 4);
  }
  return { data, width, height, inset };
}

function pixel(data, width, x, y) { return Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)); }

function softFixture() {
  const frame = fixture(64, 64);
  // 흰 오염이 전혀 없는 재질로 softAlpha 자체의 영향만 분리한다.
  for (let p = 0; p < frame.width * frame.height; p++)
    if (frame.data[p * 4 + 3]) frame.data.set([70, 53, 41, 255], p * 4);
  return frame;
}

function recipeCopy(recipe) {
  return { ...recipe, alpha: Array.from(recipe.alpha), indices: Array.from(recipe.indices), colors: Array.from(recipe.colors) };
}

test('기본 경계는 6px이며 만들기·적용은 입력과 recipe를 바꾸지 않는다', () => {
  const source = fixture(), before = new Uint8ClampedArray(source.data);
  const recipe = 만들기(source.data, source.width, source.height);
  const beforeRecipe = recipeCopy(recipe);
  const output = 적용(source.data, recipe);
  assert.equal(recipe.radius, 6);
  assert.ok(recipe.indices.length > 0, '보정할 합성 흰 잔색이 있어야 한다');
  assert.deepEqual(source.data, before);
  assert.deepEqual(recipeCopy(recipe), beforeRecipe);
  assert.notEqual(output, source.data);
  output[0] = 199;
  assert.deepEqual(source.data, before, '출력 버퍼도 입력을 공유하지 않는다');
});

test('바깥 6px보다 안쪽과 완전 투명한 영역은 RGBA가 엄격히 동일하다', () => {
  const { data, width, height, inset } = fixture();
  const recipe = 만들기(data, width, height), output = 적용(data, recipe);
  const changed = new Set(recipe.indices);
  let checked = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    const depth = Math.min(x - inset + 1, width - inset - x, y - inset + 1, height - inset - y);
    if (data[p * 4 + 3] === 0 || depth > 6) {
      assert.deepEqual(pixel(output, width, x, y), pixel(data, width, x, y), `${x},${y}`);
      assert.equal(changed.has(p), false, `경계 밖 recipe 등록: ${x},${y}`);
      checked++;
    }
  }
  assert.ok(checked > 500);
});

test('같은 기본 recipe를 두 표정에 적용하면 공통 알파·털이 같고 눈 차이만 남는다', () => {
  const { data, width, height } = fixture();
  const other = new Uint8ClampedArray(data), eyes = new Set();
  for (let y = 15; y <= 17; y++) for (const x of [16, 17, 22, 23]) {
    const p = y * width + x; eyes.add(p); other.set([121, 157, 75, 255], p * 4);
  }
  const recipe = 만들기(data, width, height), a = 적용(data, recipe), b = 적용(other, recipe);
  for (let p = 0; p < width * height; p++) {
    assert.equal(a[p * 4 + 3], b[p * 4 + 3], `알파 ${p}`);
    if (!eyes.has(p)) assert.deepEqual(a.slice(p * 4, p * 4 + 4), b.slice(p * 4, p * 4 + 4), `공통 털 ${p}`);
    else {
      assert.deepEqual(a.slice(p * 4, p * 4 + 4), data.slice(p * 4, p * 4 + 4));
      assert.deepEqual(b.slice(p * 4, p * 4 + 4), other.slice(p * 4, p * 4 + 4));
    }
  }
});

test('불투명한 흰 실은 어두운 몸의 바깥 2px에 있어도 색·알파가 유지된다', () => {
  const { data, width, height } = fixture();
  const thread = [244, 237, 220, 255];
  for (let y = 11; y <= 24; y++) data.set(thread, (y * width + 6) * 4);
  const output = 적용(data, 만들기(data, width, height));
  for (let y = 11; y <= 24; y++) assert.deepEqual(pixel(output, width, 6, y), thread, `흰 실 y=${y}`);
});

test('불투명 경계를 명시 허용해도 보호 사각형 속 흰 실은 엄격히 보존한다', () => {
  const { data, width, height } = fixture();
  const thread = [244, 237, 220, 255];
  for (let y = 11; y <= 24; y++) data.set(thread, (y * width + 6) * 4);
  data.set(thread, (17 * width + 33) * 4);
  const options = { opaqueRim: true, protect: [[6, 11, 7, 25]] };
  const snapshot = JSON.stringify(options);
  const recipe = 만들기(data, width, height, 6, options), output = 적용(data, recipe);
  for (let y = 11; y <= 24; y++) assert.deepEqual(pixel(output, width, 6, y), thread, `보호 흰 실 y=${y}`);
  assert.ok(pixel(output, width, 33, 17)[3] < 255, '보호 밖 불투명 경계는 명시 옵션에 따라 보정된다');
  assert.equal(JSON.stringify(options), snapshot, '보호 좌표를 수정하지 않는다');
  for (let p = 0; p < width * height; p++) assert.ok(output[p * 4 + 3] <= data[p * 4 + 3]);
});

test('v2 12px softAlpha는 경계 알파만 단조롭게 감쇠하고 내부로 부드럽게 돌아온다', () => {
  const { data, width, height, inset } = softFixture();
  const before = new Uint8ClampedArray(data);
  const recipe = 만들기(data, width, height, 12, { opaqueRim: true, softAlpha: true });
  const output = 적용(data, recipe);
  assert.equal(recipe.radius, 12);
  const expectedAlpha = [66, 83, 104, 128, 153, 178, 202, 223, 240, 251, 255, 255, 255];
  for (let depth = 1; depth <= expectedAlpha.length; depth++) {
    const p = pixel(output, width, inset + depth - 1, 32);
    assert.deepEqual(p.slice(0, 3), [70, 53, 41], `흰 오염 없는 RGB는 그대로: 깊이 ${depth}`);
    assert.equal(p[3], expectedAlpha[depth - 1], `0.2+0.8 smoothstep 감쇠: 깊이 ${depth}`);
  }
  for (let p = 0; p < width * height; p++) assert.ok(output[p * 4 + 3] <= data[p * 4 + 3]);
  assert.deepEqual(data, before);
});

test('v2 12px softAlpha에서도 세 보호 영역·12px 밖·투명 바탕의 RGBA는 불변이다', () => {
  const { data, width, height, inset } = softFixture();
  // 실제 자산 좌표의 적합성은 실물 QA의 몫. 합성 입력에는 서로 다른 위치 세 곳을 둔다.
  const protect = [[6, 11, 9, 25], [55, 32, 58, 46], [20, 5, 44, 8]];
  for (const [x0, y0, x1, y1] of protect) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
    data.set([244, 237, 220, 255], (y * width + x) * 4);
  const recipe = 만들기(data, width, height, 12, { opaqueRim: true, softAlpha: true, protect });
  const output = 적용(data, recipe), changed = new Set(recipe.indices);
  let protectedPixels = 0, interiorPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    const depth = Math.min(x - inset + 1, width - inset - x, y - inset + 1, height - inset - y);
    const guarded = protect.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
    if (guarded || depth > 12 || data[p * 4 + 3] === 0) {
      assert.deepEqual(pixel(output, width, x, y), pixel(data, width, x, y), `${x},${y}`);
      assert.equal(changed.has(p), false);
    }
    if (guarded) protectedPixels++;
    if (depth > 12) interiorPixels++;
  }
  assert.equal(protectedPixels, 156);
  assert.ok(interiorPixels > 800);
  assert.ok(pixel(output, width, 5, 30)[3] < 255, '보호 밖 경계의 실제 감쇠도 확인한다');
});

test('v2 브라우저 API 모의: 승인 버전 8표정만 12px 감쇠 recipe를 공유한다', async () => {
  const base = softFixture(), baseUrl = '/65f92a753bb5416b/base.webp', normalBase = '/other-version/base.webp';
  const assets = { [baseUrl]: base, [normalBase]: base }, eye = 28 * base.width + 30;
  for (let i = 0; i < 8; i++) {
    const data = new Uint8ClampedArray(base.data);
    data.set([30 + i * 12, 160 - i * 9, 60 + i * 7, 255], eye * 4);
    assets[`expression-${i}`] = { ...base, data };
  }
  const browser = browserHarness(assets);
  const frames = await Promise.all(Array.from({ length: 8 }, (_, i) => browser.api.읽기(`expression-${i}`, baseUrl)));
  assert.equal(browser.reads.get(baseUrl), 1);
  for (let i = 0; i < frames.length; i++) {
    assert.equal(frames[i].dataset.edgeVersion, 'common-rim-v2');
    assert.equal(frames[i].dataset.edgePixels, frames[0].dataset.edgePixels);
    assert.deepEqual(frames[i].data.slice(eye * 4, eye * 4 + 4), assets[`expression-${i}`].data.slice(eye * 4, eye * 4 + 4));
    for (let p = 0; p < base.width * base.height; p++) {
      assert.equal(frames[i].data[p * 4 + 3], frames[0].data[p * 4 + 3], `표정 ${i} 공통 알파 ${p}`);
      if (p !== eye) assert.deepEqual(frames[i].data.slice(p * 4, p * 4 + 4), frames[0].data.slice(p * 4, p * 4 + 4), `표정 ${i} 공통 털 ${p}`);
    }
  }
  assert.equal(pixel(frames[0].data, base.width, base.inset + 6, 32)[3], 202, '6px를 넘어선 깊이 7에서 승인 버전 12px 옵션이 적용된다');
  const ordinary = await browser.api.읽기('expression-0', normalBase);
  assert.deepEqual(ordinary.data, assets['expression-0'].data, '다른 버전에는 불투명 경계 옵션을 일반화하지 않는다');
});

test('흰 잔색의 밝기와 알파를 낮추되 어떤 픽셀도 알파가 늘지 않는다', () => {
  const { data, width, height } = fixture(), output = 적용(data, 만들기(data, width, height));
  let reduced = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    assert.ok(output[i + 3] <= data[i + 3], `알파 확장 ${p}`);
    if (output[i + 3] < data[i + 3]) {
      reduced++;
      for (let c = 0; c < 3; c++) assert.ok(output[i + c] <= data[i + c], `흰 잔색 증가 ${p}/${c}`);
    }
  }
  assert.ok(reduced > 0);
});

test('표정의 알파가 기본과 다르면 원본 확장 없이 불일치를 거절한다', () => {
  const { data, width, height } = fixture(), recipe = 만들기(data, width, height);
  assert.ok(recipe.indices.length > 1);
  const other = new Uint8ClampedArray(data);
  other[recipe.indices[0] * 4 + 3] = 0;
  other[recipe.indices[1] * 4 + 3] = 1;
  const before = new Uint8ClampedArray(other);
  assert.throws(() => 적용(other, recipe), /알파.*불일치/);
  assert.deepEqual(other, before);
});

test('완전 투명·흰 실만 있는 바탕은 빈 recipe이며 픽셀 그대로다', () => {
  const width = 24, height = 24;
  for (const alpha of [0, 255]) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let p = 0; p < width * height; p++) data.set([244, 237, 220, alpha], p * 4);
    const recipe = 만들기(data, width, height);
    assert.equal(recipe.indices.length, 0);
    assert.deepEqual(적용(data, recipe), data);
  }
});

test('입력 길이와 반지름 규격 오류를 거절한다', () => {
  assert.throws(() => 만들기(new Uint8ClampedArray(3), 1, 1), /규격/);
  for (const radius of [-1, 0, 1.5, 13, NaN, Infinity])
    assert.throws(() => 만들기(new Uint8ClampedArray(64), 4, 4, radius), /규격/, `radius=${radius}`);
  const { data, width, height } = fixture();
  assert.throws(() => 적용(new Uint8ClampedArray(4), 만들기(data, width, height)), /크기|규격|불일치/);
});

test('너비·높이는 양의 정수여야 하며 0·음수·소수·문자 치수는 거절한다', () => {
  for (const [width, height, length] of [[0, 0, 0], [0, 2, 0], [-1, -1, 4], [2.5, 2, 20], ['4', 4, 64]])
    assert.throws(() => 만들기(new Uint8ClampedArray(length), width, height), /규격/, `${width}×${height}`);
});

function browserHarness(initial) {
  const assets = new Map(Object.entries(initial)), reads = new Map();
  let canvasCount = 0, imageNumber = 0;
  class MockImage {
    constructor() { this.dataset = {}; }
    set src(url) {
      this.url = url; reads.set(url, (reads.get(url) || 0) + 1);
      queueMicrotask(() => {
        const asset = assets.get(url);
        if (!asset) return this.onerror();
        this.naturalWidth = asset.width; this.naturalHeight = asset.height;
        this.data = new Uint8ClampedArray(asset.data); this.onload();
      });
    }
    get src() { return this.url; }
  }
  const document = { createElement(name) {
    assert.equal(name, 'canvas'); canvasCount++;
    const canvas = { width: 0, height: 0 }; let pixels;
    const ctx = {
      drawImage(im) { pixels = new Uint8ClampedArray(im.data); },
      getImageData() { return { data: new Uint8ClampedArray(pixels), width: canvas.width, height: canvas.height }; },
      putImageData(frame) { pixels = new Uint8ClampedArray(frame.data); }
    };
    canvas.getContext = () => ctx;
    canvas.toDataURL = type => {
      assert.equal(type, 'image/png');
      const url = `data:image/png;synthetic,${++imageNumber}`;
      assets.set(url, { width: canvas.width, height: canvas.height, data: new Uint8ClampedArray(pixels) });
      return url;
    };
    return canvas;
  } };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../bots/오버레이/라디오가장자리.js'), 'utf8'), { window, document, Image: MockImage, Uint8ClampedArray, Uint8Array, Uint32Array, Int32Array, Map, Promise, Math, Number, Error });
  return { api: window.라디오가장자리, reads, get canvasCount() { return canvasCount; } };
}

test('브라우저 API 모의: 비활성일 때 원본만 읽고 보정·기본 읽기를 건너뛴다', async () => {
  const frame = fixture(), browser = browserHarness({ expression: frame });
  const image = await browser.api.읽기('expression', 'base', false);
  assert.equal(image.src, 'expression');
  assert.deepEqual(image.data, frame.data);
  assert.equal(browser.canvasCount, 0);
  assert.equal(browser.reads.get('base'), undefined);
});

test('브라우저 API 모의: 두 표정이 기본 recipe 하나를 공유하고 출처를 남긴다', async () => {
  const base = fixture(), changed = { ...base, data: new Uint8ClampedArray(base.data) };
  changed.data.set([90, 149, 70, 255], (17 * base.width + 19) * 4);
  const browser = browserHarness({ base, first: base, second: changed });
  const [a, b] = await Promise.all([browser.api.읽기('first', 'base'), browser.api.읽기('second', 'base')]);
  assert.equal(browser.reads.get('base'), 1);
  assert.equal(a.dataset.originalSrc, 'first');
  assert.equal(b.dataset.originalSrc, 'second');
  assert.equal(a.dataset.edgePixels, b.dataset.edgePixels);
  assert.ok(Number(a.dataset.edgePixels) > 0);
  assert.match(a.dataset.edgeVersion, /^common-rim-/);
  const changedPixel = 17 * base.width + 19;
  for (let p = 0; p < base.width * base.height; p++) {
    assert.equal(a.data[p * 4 + 3], b.data[p * 4 + 3]);
    if (p !== changedPixel) assert.deepEqual(a.data.slice(p * 4, p * 4 + 4), b.data.slice(p * 4, p * 4 + 4));
  }
});

test('브라우저 API 모의: 면적만 같아도 기본과 다른 너비·높이 그림은 거절한다', async () => {
  const base = fixture(40, 36), expression = fixture(36, 40);
  const browser = browserHarness({ base, expression });
  await assert.rejects(browser.api.읽기('expression', 'base'), /크기|규격|불일치/);
});

test('브라우저 API 모의: 그림 읽기 실패를 호출자에게 돌린다', async () => {
  const browser = browserHarness({ base: fixture() });
  await assert.rejects(browser.api.읽기('missing', 'base'), /표정 그림 읽기 실패/);
});
