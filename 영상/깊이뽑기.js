#!/usr/bin/env node
/**
 * 4D 깊이 격자 — 캐릭터 PNG 한 장에서 «픽셀마다의 z»를 재서 작은 격자로 굽는다.
 *
 * 🔑 어디서 왔나: `docs/캐릭터/생명공방_0826/살아움직이는<캐릭터>.html` 의 `깊이재기()`.
 *   유호님이 「4d 로도 만들어볼수있어?」로 여신 층이고, 08-26 에 실렌더가
 *   **그 층이 한 번도 돈 적이 없다**는 것을 잡아 고쳤다(`v` 정의 한 줄이 없어 통째로 죽어 있었다).
 *   여기는 그 «같은 수식»을 노드로 옮긴 것이다 — 릴이 브라우저 지면과 다른 그림을 내면 안 된다.
 *
 * 🔑 왜 «미리» 뽑나: 깊이는 그림이 안 바뀌면 안 바뀐다. 900프레임마다 256×256 픽셀을 다시 읽는 것은
 *   낭비이고, 무엇보다 Remotion 렌더는 프레임마다 브라우저를 새로 그린다 — 매번 다시 재게 된다.
 *   격자(29×29)는 3KB 남짓이라 통째로 실어도 가볍다.
 *
 * 🔴 산출물은 `public/깊이/` 로 간다 = git 밖이다. 그림이 바뀌면 다시 뽑으면 되므로
 *   「없는 것은 낡을 수 없다」 쪽이다(자산모으기가 굽기마다 부른다).
 *
 * 쓰기: node 영상/깊이뽑기.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const 방 = __dirname;
const N = 28; /* 격자 칸 수 — 원본 HTML 과 «같은 수»여야 그림이 같다(Live2D 의 메시에 해당) */
const P = 256; /* 깊이를 재는 해상도 — 원본과 같다 */

/** PNG(색타입 6 = RGBA · 8bit) 를 의존성 없이 푼다. 마스코트 누끼는 전부 이 꼴이다(실측). */
function png읽기(파일) {
  const b = fs.readFileSync(파일);
  let p = 8;
  let w = 0, h = 0, ct = 0, bd = 0;
  const idat = [];
  while (p < b.length - 8) {
    const len = b.readUInt32BE(p);
    const typ = b.toString('ascii', p + 4, p + 8);
    if (typ === 'IHDR') {
      w = b.readUInt32BE(p + 8);
      h = b.readUInt32BE(p + 12);
      bd = b.readUInt8(p + 16);
      ct = b.readUInt8(p + 17);
    } else if (typ === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    else if (typ === 'IEND') break;
    p += 12 + len;
  }
  if (ct !== 6 || bd !== 8) throw new Error(`${path.basename(파일)} — RGBA/8bit 이 아니다(색타입 ${ct}·깊이 ${bd})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  let i = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[i++];
    const line = Buffer.from(raw.subarray(i, i + stride));
    i += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const bb = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
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
  return { w, h, data: out };
}

/** 최근접으로 P×P 로 줄인다(원본 HTML 의 `drawImage(img,0,0,P,P)` 자리). */
function 줄이기(img) {
  const d = Buffer.alloc(P * P * 4);
  for (let y = 0; y < P; y++) {
    const sy = Math.min(img.h - 1, Math.round((y / P) * img.h));
    for (let x = 0; x < P; x++) {
      const sx = Math.min(img.w - 1, Math.round((x / P) * img.w));
      img.data.copy(d, (y * P + x) * 4, (sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4);
    }
  }
  return d;
}

/**
 * 깊이재기 — 원본 HTML 의 수식 그대로.
 *   · 몸 색 = 알파 안쪽 픽셀의 **중앙값**(평균이 아니다 — 눈·지느러미 같은 튀는 색이 평균을 끌고 간다)
 *   · z = sqrt(1 - s²) · s = 중심에서의 가로 위치 ⇒ **회전체**로 가정한 깊이
 *   · 눈은 z 를 +0.30 — 「눈이 먼저 움직이는 것」이 입체로 읽히는 자리다
 *   ⚠ 까몽은 몸통만 회전체다(귀·날개·꼬리는 아니다) — 원본 지면도 그 한계를 스스로 적어 뒀다.
 */
function 깊이재기(d) {
  const rs = [], gs = [], bs = [];
  for (let i = 3; i < d.length; i += 4 * 7) {
    if (d[i] > 60) { rs.push(d[i - 3]); gs.push(d[i - 2]); bs.push(d[i - 1]); }
  }
  const 중앙 = (arr) => { if (!arr.length) return 128; arr.sort((a, b) => a - b); return arr[arr.length >> 1]; };
  const 몸색 = [중앙(rs), 중앙(gs), 중앙(bs)];
  const 눈문턱 = 78;

  const zArr = new Float32Array((N + 1) * (N + 1));
  let k = 0;
  for (let j = 0; j <= N; j++) {
    const py = Math.min(P - 1, Math.round((1 - j / N) * (P - 1))); /* v=0 이 바닥 */
    const v = j / N;
    let L = -1, R = -1;
    for (let x = 0; x < P; x++) if (d[(py * P + x) * 4 + 3] > 60) { if (L < 0) L = x; R = x; }
    const cx = (L + R) / 2, hw = Math.max(1, (R - L) / 2);
    for (let i = 0; i <= N; i++) {
      const px = Math.min(P - 1, Math.round((i / N) * (P - 1)));
      const o = (py * P + px) * 4;
      let z = 0;
      if (L >= 0 && d[o + 3] > 60) {
        const s = (px - cx) / hw;
        z = Math.sqrt(Math.max(0, 1 - s * s));
        if (v >= 0.5 && v <= 0.92) {
          const dr = d[o] - 몸색[0], dg = d[o + 1] - 몸색[1], db = d[o + 2] - 몸색[2];
          if (Math.sqrt(dr * dr + dg * dg + db * db) > 눈문턱) z += 0.3;
        }
      }
      zArr[k++] = z;
    }
  }
  return { zArr, 몸색 };
}

/* ── 실행 ──────────────────────────────────────────────────────────────── */
const 나갈방 = path.join(방, 'public', '깊이');
fs.mkdirSync(나갈방, { recursive: true });

const 결과 = [];
for (const 가이드 of ['몽글', '까몽']) {
  const 원 = path.join(방, 'public', 가이드, '본체.png');
  if (!fs.existsSync(원)) {
    console.error(`🔴 ${원} 이 없다 — 먼저 node 영상/자산모으기.js`);
    process.exit(1);
  }
  const img = png읽기(원);
  const { zArr, 몸색 } = 깊이재기(줄이기(img));
  let 최대 = 0, 합 = 0, 산것 = 0;
  for (const z of zArr) { 최대 = Math.max(최대, z); if (z > 0) { 합 += z; 산것++; } }
  fs.writeFileSync(
    path.join(나갈방, `${가이드}.json`),
    JSON.stringify({ N, z: Array.from(zArr, (v) => Math.round(v * 1000) / 1000) }),
    'utf8',
  );
  결과.push({ 가이드, 최대: 최대.toFixed(2), 평균: 산것 ? (합 / 산것).toFixed(2) : '0', 산것, 칸: zArr.length, 몸색 });
}

console.log(`4D 깊이 격자 — ${N + 1}×${N + 1} 칸`);
for (const r of 결과) {
  console.log(
    `  ${r.가이드}  z 최대 ${r.최대} · 몸 안 평균 ${r.평균} · 몸이 있는 칸 ${r.산것}/${r.칸} · 몸색 rgb(${r.몸색.join(',')})`,
  );
}
if (결과.some((r) => Number(r.최대) === 0)) {
  console.error('🔴 z 가 전부 0 이다 — 깊이 함수가 죽었다는 뜻이다(08-26 에 실제로 그랬다).');
  process.exit(1);
}
