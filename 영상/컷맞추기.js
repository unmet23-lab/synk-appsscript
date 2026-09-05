#!/usr/bin/env node
/**
 * 컷맞추기 — 표정 컷의 «눈 밖»을 본체 것으로 고정한다.
 *
 * 🔴 왜 짓나 (유호님 08-26 「까몽이 눈 감을때 털이 변하는데 왜그런거야? 갑자기 털 위치가 좀 변해」):
 *   캐릭터 컷 셋은 **따로따로 구운 Cycles 렌더**다. 까몽 PNG 안의 굽기 기록이 그대로 말해 준다 —
 *     본체 07:40 · 눈감음 07:56 · 눈웃음 08:06 · 셋 다 samples 96 · 렌더 12:30 / 16:17 / 09:31.
 *   96샘플은 털처럼 잔 결에서 **안 수렴한다.** 그래서 굽기마다 털이 다르게 난다.
 *   깜빡임이 컷을 갈아끼우는 순간 **털 전체가 한꺼번에 바뀌고**, 그게 「털이 변했다」로 보인다.
 *
 * 🔑 그래서 «맞춘다»: 눈 밖의 모든 픽셀을 **본체 것으로 덮는다.**
 *   그러면 컷이 바뀌어도 털이 **변할 수가 없다** — 시간축의 튐이 원리상 0 이 된다.
 *   눈자리 안팎의 경계는 «공간»의 이음매인데, 그건 매 프레임 같은 자리라 **안 움직인다.**
 *   움직이지 않는 이음매는 눈에 안 띄고, 움직이는 튐은 띈다 — 그 맞바꿈이 이 도구의 전부다.
 *
 * 🔑 눈자리를 «손으로 안 적는다» — 그림에서 뽑는다. 손으로 적으면 다시 구울 때 낡는다.
 *   갈래 둘이고, 어느 쪽이 답했는지 **찍어서 낸다**(조용한 폴백 금지 — 이 저장소의 규율).
 *     ① 초록 덩어리 — 몸이 무채색인 캐릭터(까몽: 검은 털 위 초록 눈). 노이즈와 아예 축이 다르다.
 *     ② 차이 덩어리 — 색으로 안 갈리는 캐릭터(몽글). 본체↔컷 차이의 큰 덩어리만 집는다.
 *   ⚠ 갈래를 둘 둔 것은 게을러서가 아니다. 08-26 에 «차이»축으로 여섯 가지를 재봤는데
 *     (원시 문턱 · 뭉갠 차이 · 대비 정규화 · 연결 덩어리 · 부호째 뭉갬 · 식구 대조)
 *     **까몽은 여섯 다 몸 전체로 번졌다.** 까몽 눈의 변화가 제 털 노이즈와 크기가 비슷해서다
 *     (점수 최대 9.4 대 몽글 26.1). 색만 갈렸다 — 초록 5,285px 이 눈 세 덩어리에만 있다.
 *
 * 🔵 정본은 **안 건드린다.** 읽기는 `docs/캐릭터/…` 정본, 쓰기는 `영상/public/` (git 밖 사본)이다.
 *   ⇒ 뿌리 고침은 여전히 «까몽 컷 셋을 한 벌로, 수렴하게 다시 굽기»이고 그건 굽기 레인 몫이다.
 *     이 도구는 그때까지 릴이 멀쩡히 나가게 하는 것이지 그 굽기를 대신하지 않는다(트랙에 적었다).
 *
 * 쓰기: node 영상/컷맞추기.js        (자산모으기가 굽기마다 부른다)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const 저장소 = path.resolve(__dirname, '..');
const 공개 = path.join(__dirname, 'public');
const 마스코트 = require(path.join(저장소, 'tools', 'lib', '마스코트자산.js'));

/** 눈자리 밖으로 마스크가 잦아드는 폭(px, 1024² 정본 기준). 공간의 이음매를 부드럽게 한다. */
const 깃 = 14;
/** 눈자리가 몸의 이 비율을 넘으면 «못 찾은 것»으로 본다 — 그 갈래를 버리고 다음 갈래로 간다. */
const 상한 = 0.3;
/** «어두운 덩어리» 갈래가 눈으로 보는 밝기 문턱(max(r,g,b)). 몽글 실측 09-05: 몸 평균 216 · 이 값이면 몸의 7.7%. */
const 어두움 = 80;

/* ── PNG 읽기·쓰기 — 의존성 0 (RGBA/8bit 만. 마스코트 누끼는 전부 이 꼴이다) ── */

function png읽기(파일) {
  const b = fs.readFileSync(파일);
  let p = 8, w = 0, h = 0, ct = 0, bd = 0;
  const idat = [];
  while (p < b.length - 8) {
    const len = b.readUInt32BE(p);
    const typ = b.toString('ascii', p + 4, p + 8);
    if (typ === 'IHDR') {
      w = b.readUInt32BE(p + 8); h = b.readUInt32BE(p + 12);
      bd = b.readUInt8(p + 16); ct = b.readUInt8(p + 17);
    } else if (typ === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    else if (typ === 'IEND') break;
    p += 12 + len;
  }
  if (ct !== 6 || bd !== 8) throw new Error(`${path.basename(파일)} — RGBA/8bit 이 아니다(색타입 ${ct}·깊이 ${bd})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride), i = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[i++];
    const line = Buffer.from(raw.subarray(i, i + stride));
    i += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, bb = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (ft === 1) line[x] = (line[x] + a) & 255;
      else if (ft === 2) line[x] = (line[x] + bb) & 255;
      else if (ft === 3) line[x] = (line[x] + ((a + bb) >> 1)) & 255;
      else if (ft === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c)) & 255;
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { w, h, d: out };
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function 덩어리(타입, 몸) {
  const t = Buffer.from(타입, 'ascii');
  const 길이 = Buffer.alloc(4); 길이.writeUInt32BE(몸.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, 몸])));
  return Buffer.concat([길이, t, 몸, c]);
}

/** 필터는 전부 0(None) — 크기보다 «다시 읽어도 같다»가 중요하다. */
function png쓰기(파일, im) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(im.w, 0); ihdr.writeUInt32BE(im.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = im.w * 4;
  const raw = Buffer.alloc(im.h * (stride + 1));
  for (let y = 0; y < im.h; y++) {
    raw[y * (stride + 1)] = 0;
    im.d.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  fs.writeFileSync(파일, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    덩어리('IHDR', ihdr),
    덩어리('IDAT', zlib.deflateSync(raw, { level: 9 })),
    덩어리('IEND', Buffer.alloc(0)),
  ]));
}

/* ── 눈자리 찾기 ──────────────────────────────────────────────────────────── */

/** 이어진 덩어리들. `이음` 은 몇 칸 떨어진 것까지 한 덩어리로 볼지(눈은 가닥이 끊겨 보인다). */
function 덩어리들(bin, w, h, 이음) {
  const 표 = new Int32Array(w * h).fill(-1);
  const 큐 = new Int32Array(w * h);
  const 목록 = [];
  for (let s = 0; s < w * h; s++) {
    if (!bin[s] || 표[s] >= 0) continue;
    const id = 목록.length;
    let 앞 = 0, 뒤 = 0;
    큐[뒤++] = s; 표[s] = id;
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    while (앞 < 뒤) {
      const p = 큐[앞++]; n++;
      const x = p % w, y = (p - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -이음; dy <= 이음; dy++) {
        for (let dx = -이음; dx <= 이음; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (bin[q] && 표[q] < 0) { 표[q] = id; 큐[뒤++] = q; }
        }
      }
    }
    목록.push({ n, x0, y0, x1, y1 });
  }
  return 목록;
}

function 몸상자(im) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < im.h; y++) {
    for (let x = 0; x < im.w; x++) if (im.d[(y * im.w + x) * 4 + 3] > 32) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

/** 덩어리들을 하나의 상자로 합친다 — 컷 «전부»의 눈을 담아야 하므로 합집합이다. */
const 상자합치기 = () => {
  let 상자 = null;
  return {
    담기: (b) => {
      상자 = 상자
        ? { x0: Math.min(상자.x0, b.x0), y0: Math.min(상자.y0, b.y0), x1: Math.max(상자.x1, b.x1), y1: Math.max(상자.y1, b.y1) }
        : { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
    },
    낸다: () => 상자,
  };
};

/* ① 초록 — 몸이 무채색인 캐릭터(까몽: 검은 털 위 초록 눈). 노이즈는 밝기를 흔들지 «색상»을 안 옮긴다. */
function 초록갈래(컷그림, w, h) {
  const 모음 = 상자합치기();
  let 초록수 = 0;
  for (const A of Object.values(컷그림)) {
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (A.d[o + 3] < 128) continue;
      if (A.d[o + 1] - Math.max(A.d[o], A.d[o + 2]) >= 18) { bin[i] = 1; 초록수++; }
    }
    덩어리들(bin, w, h, 2).filter((b) => b.n >= 60).forEach(모음.담기);
  }
  if (초록수 < 300) return null;
  return { 상자: 모음.낸다(), 방법: `초록 덩어리 ${초록수}px` };
}

/**
 * ② 어두운 덩어리 — 몸이 «밝은» 캐릭터(몽글: 코랄 펠트 위 검은 구슬 눈).
 *
 * 🔴 [2026-09-05] 왜 생겼나: 몽글 정본이 4K 로 갈리면서 ③ 차이 갈래가 원리상 못 서게 됐다.
 *   새 세트는 컷마다 «따로 그린» 그림이라 털이 통째로 다르다. 실측(4096²): 본체↔눈감음이
 *   **16.7% 다르다**. 눈만 다르면 나올 수 없는 값이고, 그 낱알들이 서로 붙어 몸 전체가 한
 *   덩어리가 된다 ⇒ 차이 갈래가 «몸의 101.5%»를 냈다. 크기로 거르는 방식이 안 통한다.
 *   ⚠ 처방 셋을 재보고 셋 다 버렸다 — 각도 컷 빼기(101.3%) · 덩어리 문턱 16배(101.2%) ·
 *     차이 문턱 200까지 올리기(99.6%) · 1024² 로 줄여 찾기(101.2%). 윤곽·알파를 빼도 96.2%.
 * 🔑 그래서 «차이»를 버리고 ① 과 같은 축으로 간다 — 몸과 눈은 «색»이 다르다.
 *   실측: 몸 평균 밝기 216 · 아래 1% 지점 23. 눈은 검은 구슬이라 그 아래 꼬리에 산다.
 *   밝기 ≤80 으로 잡으면 몸의 **7.7%**(눈 둘을 아우르는 1567x475 상자 · 눈으로 확인했다).
 *   ⚠ 100 으로 올리면 눈 아래 그늘까지 먹어 20.8% 가 된다 — 문턱은 «몸 그늘 위»에 서야 한다.
 * ⚠ 까몽처럼 몸이 어두우면 이 갈래는 몸 전체를 집는다(실측 95~98%). 그것은 아래 상한 검사가
 *   거르고 다음 갈래로 넘긴다 — 갈래마다 제 자를 또 두지 않는다(자가 둘이면 진동한다).
 */
function 어두운갈래(컷그림, w, h) {
  const 모음 = 상자합치기();
  let 어두운수 = 0;
  for (const A of Object.values(컷그림)) {
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (A.d[o + 3] < 128) continue;
      if (Math.max(A.d[o], A.d[o + 1], A.d[o + 2]) <= 어두움) { bin[i] = 1; 어두운수++; }
    }
    덩어리들(bin, w, h, 2).filter((b) => b.n >= 400).forEach(모음.담기);
  }
  if (!모음.낸다()) return null;
  return { 상자: 모음.낸다(), 방법: `어두운 덩어리 ${어두운수}px(밝기≤${어두움})` };
}

/* ③ 차이 덩어리 — 같은 장면을 다시 렌더한 컷 셋(옛 1024² 세트가 그랬다). 큰 덩어리만 집어
   낱알 노이즈를 버린다. 🔴 컷마다 따로 «그린» 세트에서는 안 선다(위 ② 머리말) — 마지막 보루다. */
function 차이갈래(컷그림, w, h) {
  const 모음 = 상자합치기();
  const 본체 = 컷그림['본체'];
  for (const [이름, B] of Object.entries(컷그림)) {
    if (이름 === '본체') continue;
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const d = Math.max(
        Math.abs(본체.d[o] - B.d[o]), Math.abs(본체.d[o + 1] - B.d[o + 1]),
        Math.abs(본체.d[o + 2] - B.d[o + 2]), Math.abs(본체.d[o + 3] - B.d[o + 3]),
      );
      if (d >= 30) bin[i] = 1;
    }
    덩어리들(bin, w, h, 1).filter((b) => b.n >= 400).forEach(모음.담기);
  }
  if (!모음.낸다()) return null;
  return { 상자: 모음.낸다(), 방법: '차이 덩어리 ≥400px' };
}

/**
 * 눈자리를 그림에서 뽑는다. 컷 «전부»의 눈을 담게 합집합으로 잡는다
 * (감은 눈이 뜬 눈보다 아래로 처질 수 있다 — 한 컷만 보면 잘린다).
 *
 * 🔑 갈래가 낸 상자를 **그 자리에서 검증한다** — 몸을 덮으면 버리고 다음 갈래로 간다.
 *   검증이 밖에 있으면 첫 갈래가 헛짚는 순간 도구가 죽는다(09-05 에 그렇게 이틀 막혔다).
 *   ⚠ 순서가 곧 «믿는 순서»다. 어느 갈래가 답했는지는 찍어서 낸다 — 조용한 폴백 금지.
 */
function 눈자리찾기(컷그림) {
  const 첫 = Object.values(컷그림)[0];
  const w = 첫.w, h = 첫.h;
  const 몸 = 몸상자(컷그림['본체']);
  const 몸넓 = (몸.x1 - 몸.x0 + 1) * (몸.y1 - 몸.y0 + 1);
  const 버린것 = [];

  for (const 갈래 of [초록갈래, 어두운갈래, 차이갈래]) {
    const 낸것 = 갈래(컷그림, w, h);
    if (!낸것 || !낸것.상자) { 버린것.push(`${갈래.name}: 아무것도 못 집었다`); continue; }
    const b = 낸것.상자;
    const 비율 = ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1)) / 몸넓;
    if (비율 > 상한) {
      버린것.push(`${갈래.name}: 몸의 ${(비율 * 100).toFixed(1)}% 를 집었다(${낸것.방법})`);
      continue;
    }
    return { 상자: b, 방법: `${낸것.방법} · 몸의 ${(비율 * 100).toFixed(1)}%` };
  }
  throw new Error(
    '눈자리를 못 찾았다 — 갈래 셋이 다 헛짚었다.\n  ' + 버린것.join('\n  ')
    + '\n  🔑 컷 셋이 «눈만 다른» 한 벌인지 먼저 본다(각도·몸짓 컷이 섞이면 여기서 걸린다).',
  );
}

/* ── 맞추기 ──────────────────────────────────────────────────────────────── */

/** 상자 밖으로 `깃` 만큼 잦아드는 마스크. 상자 «안»은 온전히 컷이라 눈이 잘리지 않는다. */
function 마스크(w, h, 상자) {
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const dy = y < 상자.y0 ? 상자.y0 - y : y > 상자.y1 ? y - 상자.y1 : 0;
    for (let x = 0; x < w; x++) {
      const dx = x < 상자.x0 ? 상자.x0 - x : x > 상자.x1 ? x - 상자.x1 : 0;
      const d = Math.hypot(dx, dy);
      if (d === 0) { m[y * w + x] = 1; continue; }
      if (d >= 깃) continue;
      const t = d / 깃;
      m[y * w + x] = 1 - t * t * (3 - 2 * t); /* 매끄럽게(smoothstep) */
    }
  }
  return m;
}

function 맞춘것(본체, 컷, m) {
  const out = Buffer.from(본체.d);
  for (let i = 0; i < 본체.w * 본체.h; i++) {
    const a = m[i];
    if (a === 0) continue;
    const o = i * 4;
    for (let k = 0; k < 4; k++) out[o + k] = Math.round(본체.d[o + k] * (1 - a) + 컷.d[o + k] * a);
  }
  return { w: 본체.w, h: 본체.h, d: out };
}

/* ── 돈다 ────────────────────────────────────────────────────────────────── */

/* 컷 목록은 손으로 안 든다 — 누끼판이 있는 컷을 창구가 안다(마스코트자산 `몽글누끼컷`·`까몽누끼컷`).
   ⚠ 08-29 에 까몽 컷이 3→8 로 늘었는데 그중 누끼가 있는 것은 여전히 셋이다. 여기가
     「구운 것 전부」를 집으면 없는 누끼를 읽다 죽는다 — 그래서 «누끼 있는 것»만 묻는다.

   🔴 [2026-09-01] **목록이 하나뿐이라 사고가 났다.** 이 자리는 `까몽누끼컷` 하나를 **두 가이드에
     그대로** 쓰고 있었다. 08-30 에 까몽 누끼가 3 → 8 로 승격되자 몽글 차례에서 「윙크」를 읽으려다
     죽었고(몽글 누끼는 본체·눈감음·눈웃음·놀람 **넷**뿐), 그 예외가 `영상/자산모으기.js` 를 통째로
     멈춰 세웠다 — **영상을 굽는 길이 이틀 막혀 있었다.** 가이드마다 제 목록을 묻는다.
     🔑 두 가이드의 컷이 나란히 늘어난다는 보장이 없다 — 한 가이드가 앞서 굽히는 것이 정상이다. */
const 가이드들 = [
  { 이름: '몽글', 컷: 마스코트.몽글누끼컷, 경로: (c) => 마스코트.경로(c, { 누끼: true }) },
  { 이름: '까몽', 컷: 마스코트.까몽누끼컷, 경로: (c) => 마스코트.까몽경로(c, { 누끼: true }) },
];

let 쓴것 = 0;
for (const 가이드 of 가이드들) {
  const 컷그림 = {};
  for (const c of 가이드.컷) 컷그림[c] = png읽기(path.join(저장소, 가이드.경로(c)));

  /* 🔴 크기가 갈리면 여기서 죽는다 — 이 도구는 «픽셀 자리»로 덮고(눈 밖을 본체 것으로),
     잦아드는 폭(깃)도 1024² 정본 기준 상수다. 시안(700px)과 정본(1024px)이 한 벌에 섞이면
     인덱스가 어긋난 채 «그림은 나오고 종료코드는 0» 이 된다 — 그 조용한 실패를 여기서 끊는다.
     ⚠ 08-29 실측: 까몽 시안 다섯이 700px 로 구워지는 중이라 이 자리가 진짜 위험이 됐다.
     누끼가 늘어 `까몽누끼컷` 이 그것들을 내주는 순간 이 루프가 섞인 크기를 읽는다. */
  const 첫컷 = 컷그림[가이드.컷[0]];
  const 어긋남 = Object.entries(컷그림).filter(([, g]) => g.w !== 첫컷.w || g.h !== 첫컷.h);
  if (어긋남.length) {
    const 크기들 = Object.entries(컷그림).map(([c, g]) => c + ' ' + g.w + 'x' + g.h).join(' · ');
    throw new Error(
      가이드.이름 + ' 컷 크기가 갈렸다 — ' + 크기들
        + '\n  이 도구는 픽셀 자리로 덮으므로 한 벌은 같은 크기여야 한다.'
        + '\n  시안을 정본 자리에 두지 말고, 승격할 때 정본 규격(1024px)으로 다시 구워라.',
    );
  }

  /* 🔑 상한 검사는 `눈자리찾기` 안으로 들어갔다 — 갈래마다 그 자리에서 재고, 헛짚은 갈래는
     버리고 다음으로 넘어간다. 밖에서 한 번만 재던 옛 판은 첫 갈래가 헛짚으면 곧장 죽었다.
     여기까지 온 상자는 이미 «몸의 30% 밑»이 보장된다(자는 그 안에 하나뿐이다). */
  let 상자, 방법;
  try {
    ({ 상자, 방법 } = 눈자리찾기(컷그림));
  } catch (e) {
    throw new Error(`${가이드.이름} — ${e.message}`);
  }
  const 본체 = 컷그림['본체'];

  const m = 마스크(본체.w, 본체.h, 상자);
  const 방 = path.join(공개, 가이드.이름);
  fs.mkdirSync(방, { recursive: true });
  png쓰기(path.join(방, '본체.png'), 본체);
  쓴것 += 1;

  const 잰것 = [];
  for (const c of 가이드.컷) {
    if (c === '본체') continue;
    const 새것 = 맞춘것(본체, 컷그림[c], m);
    png쓰기(path.join(방, `${c}.png`), 새것);
    쓴것 += 1;

    /* 검사 — 눈자리 «밖»(깃까지 포함)에서 본체와 한 톨도 다르면 안 된다.
       이게 성립해야 「털이 변할 수가 없다」가 사실이 된다. 세어서 낸다. */
    let 밖다름 = 0, 밖셈 = 0, 안다름 = 0, 안셈 = 0;
    for (let i = 0; i < 본체.w * 본체.h; i++) {
      const o = i * 4;
      const 다름 = 새것.d[o] !== 본체.d[o] || 새것.d[o + 1] !== 본체.d[o + 1]
        || 새것.d[o + 2] !== 본체.d[o + 2] || 새것.d[o + 3] !== 본체.d[o + 3];
      if (m[i] === 0) { 밖셈++; if (다름) 밖다름++; }
      else { 안셈++; if (다름) 안다름++; }
    }
    if (밖다름 !== 0) throw new Error(`${가이드.이름}/${c} — 눈자리 밖에서 ${밖다름}px 이 본체와 다르다(0 이어야 한다)`);
    잰것.push(`${c} 눈자리 안 ${안다름}/${안셈}px 바뀜 · 밖 0/${밖셈}`);
  }

  console.log(
    `${가이드.이름} — 눈자리 [${상자.x0},${상자.y0},${상자.x1},${상자.y1}] `
    + `${상자.x1 - 상자.x0 + 1}×${상자.y1 - 상자.y0 + 1} · 방법 «${방법}»`,
  );
  for (const 줄 of 잰것) console.log(`   ${줄}`);
}
console.log(`컷맞추기 끝 — ${쓴것}장 (눈 밖은 전부 본체 그대로 · 깜빡여도 털이 변할 수가 없다)`);
