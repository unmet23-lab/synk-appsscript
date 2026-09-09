/* 라디오 표시 전용: 공통 기본에서 얻은 한 경계 보정을 모든 표정에 적용한다.
 * 원본 파일/몸 안쪽/표정은 다시 그리지 않는다. 기본은 원본의 바깥 6px 이내만,
 * 안쪽 재질보다 밝아진 흰 바탕 잔색을 줄인다. 전체 blur/opacity/filter 없음.
 * 승인 차림만 1024 원본의 바깥 12px(송출 약 4px)에 점진적 경계 감쇠를 적용한다.
 * 정본: docs/캐릭터/캐릭터_생명감_설계.md §1-a (2026-09-09 사용자 요청).
 */
(function (root) {
  'use strict';
  function 만들기(data, width, height, radius = 6, options = {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4 || !Number.isInteger(radius) || radius < 1 || radius > 12)
      throw new Error('경계 입력 규격 오류');
    const n = width * height, distance = new Uint8Array(n), nearest = new Int32Array(n);
    nearest.fill(-1);
    for (let p = 0; p < n; p++) distance[p] = data[p * 4 + 3] <= 8 ? 0 : radius + 1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (x) distance[p] = Math.min(distance[p], distance[p - 1] + 1);
      if (y) distance[p] = Math.min(distance[p], distance[p - width] + 1);
    }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (x + 1 < width) distance[p] = Math.min(distance[p], distance[p + 1] + 1);
      if (y + 1 < height) distance[p] = Math.min(distance[p], distance[p + width] + 1);
    }
    // 불투명한 안쪽 재질의 가장 가까운 표본. 표정마다 다시 추정하지 않는다.
    const queue = new Int32Array(n); let head = 0, tail = 0;
    for (let p = 0; p < n; p++) if (distance[p] > radius && data[p * 4 + 3] >= 250) {
      nearest[p] = p; queue[tail++] = p;
    }
    while (head < tail) {
      const p = queue[head++], x = p % width;
      const visit = q => {
        if (nearest[q] < 0 && data[q * 4 + 3] > 0) { nearest[q] = nearest[p]; queue[tail++] = q; }
      };
      if (x) visit(p - 1);
      if (x + 1 < width) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p + width < n) visit(p + width);
    }
    const indices = [], colors = [];
    for (let p = 0; p < n; p++) {
      const i = p * 4, q = nearest[p] * 4;
      if (!data[i + 3] || distance[p] > radius || q < 0) continue;
      if (data[i + 3] >= 250 && !options.opaqueRim) continue;
      if ((options.protect || []).some(([x0,y0,x1,y1]) => p % width >= x0 && p % width < x1 && Math.floor(p / width) >= y0 && Math.floor(p / width) < y1)) continue;
      // 세 색 모두 안쪽보다 밝아졌을 때만 흰 잔색으로 본다. 흰 실 자체는 보존.
      let white = 1;
      for (let c = 0; c < 3; c++) white = Math.min(white, (data[i + c] - data[q + c] - 8) / Math.max(16, 255 - data[q + c]));
      white = Math.max(0, Math.min(.92, white)) * Math.pow(1 - Math.max(0, distance[p] - 1) / radius, 1.25);
      const t = Math.min(1, (distance[p] + 1) / radius);
      const coverage = options.softAlpha ? .2 + .8 * t * t * (3 - 2 * t) : 1;
      if (white < .025 && coverage >= .999) continue;
      indices.push(p);
      for (let c = 0; c < 3; c++) colors.push(Math.round(data[i + c] * (1 - white) + data[q + c] * white));
      colors.push(Math.round(data[i + 3] * (1 - white * .88) * coverage));
    }
    const alpha = new Uint8Array(n);
    for (let p = 0; p < n; p++) alpha[p] = data[p * 4 + 3];
    return { width, height, radius, alpha, indices: Uint32Array.from(indices), colors: Uint8ClampedArray.from(colors) };
  }
  function 적용(data, recipe) {
    if (data.length !== recipe.width * recipe.height * 4) throw new Error('표정 크기 불일치');
    for (let p = 0; p < recipe.alpha.length; p++) if (data[p * 4 + 3] !== recipe.alpha[p]) throw new Error('공통 표정 알파 불일치');
    const out = new Uint8ClampedArray(data);
    recipe.indices.forEach((p, i) => out.set(recipe.colors.subarray(i * 4, i * 4 + 4), p * 4));
    return out;
  }
  const cache = new Map();
  async function 읽기(url, baseUrl, enabled = true) {
    const load = src => new Promise((resolve, reject) => {
      const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('표정 그림 읽기 실패: ' + src)); im.src = src;
    });
    const pixels = im => {
      const canvas = document.createElement('canvas'); canvas.width = im.naturalWidth; canvas.height = im.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(im, 0, 0);
      return { canvas, ctx, frame: ctx.getImageData(0, 0, canvas.width, canvas.height) };
    };
    const im = await load(url);
    if (!enabled) return im;
    if (!cache.has(baseUrl)) cache.set(baseUrl, load(baseUrl).then(base => {
      const { frame } = pixels(base);
      // 이 승인 차림은 불투명 가장자리에도 흰 배경 잔색이 있다. 흰 옷고름 보호
      // 영역을 함께 검수한 이 버전에만 허용한다. 다른 자산으로 일반화하지 않는다.
      const options = baseUrl.includes('/65f92a753bb5416b/') ? {
        opaqueRim: true, softAlpha: true, protect: [[180,430,280,665],[620,445,716,577],[281,431,620,750]]
      } : {};
      return 만들기(frame.data, frame.width, frame.height, options.opaqueRim ? 12 : 6, options);
    }));
    const recipe = await cache.get(baseUrl), { canvas, ctx, frame } = pixels(im);
    if (frame.width !== recipe.width || frame.height !== recipe.height) throw new Error('표정 종횡비 불일치');
    frame.data.set(적용(frame.data, recipe)); ctx.putImageData(frame, 0, 0);
    const rendered = await load(canvas.toDataURL('image/png'));
    rendered.dataset.originalSrc = url; rendered.dataset.edgePixels = String(recipe.indices.length);
    rendered.dataset.edgeVersion = 'common-rim-v2'; return rendered;
  }
  const api = { 만들기, 적용, 읽기 };
  if (typeof module !== 'undefined') module.exports = api;
  else root.라디오가장자리 = api;
})(typeof window !== 'undefined' ? window : this);
