'use strict';
/* 4D 깊이 격자 — «그림 한 장에서 픽셀마다의 z를 재는» 수식의 **유일한 주인**.
 *
 * ■ 이게 무슨 층인가 (한 줄)
 *   그림 한 장에서 픽셀마다 깊이(z)를 재고, **시점이 움직이면 z 만큼 반대로 민다.**
 *   눈은 z 가 커서(+0.30) «먼저» 움직이고, 그 어긋남이 사람 눈에 «고개를 돌렸다»로 읽힌다.
 *   사진 한 장이 입체가 되는 자리다. 유호님이 08-26 「4d 로도 만들어볼수있어?」로 여셨다.
 *
 * ■ 🔴 왜 «모듈»로 올렸나 (2026-09-02)
 *   이 수식은 세 곳에서 같은 값을 내야 한다 —
 *     ① 판정 지면 `docs/캐릭터/생명공방_0826/살아움직이는<가이드>.html`(원본·브라우저)
 *     ② 릴 `영상/깊이뽑기.js` → `영상/public/깊이/<가이드>.json`
 *     ③ **앱** talk `contents/깊이.json`(09-02 신설 — 이 모듈이 생긴 까닭)
 *   ②까지는 「수식이 두 곳」이어도 릴만 틀리면 끝이었다. ③이 서는 순간 **학생 손의 앱과 릴이
 *   다른 각도로 고개를 돌린다** — 그리고 그건 아무도 못 잰다(각자 자기 파일만 보니까).
 *   이 저장소가 가장 자주 앓는 병이 정확히 이것이다(memory constant-known-in-two-places).
 *   ⇒ **수식은 여기 하나.** ②③은 창구고, ①은 브라우저라 이 모듈을 못 부르니
 *      그 지면이 바뀌면 여기도 같이 바뀌어야 한다(그 대조는 사람 몫이다 — 안 재봤다).
 *
 * ■ 무엇을 «안» 하나
 *   z 를 어떻게 «쓰는가»(시차·기울임·주기·세기)는 여기 없다. 그건 매체마다 다르다 —
 *   릴은 30fps 900프레임이고 앱은 손안의 작은 화면이다. 여기는 **z 만** 낸다.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** 격자 칸 수 — 원본 HTML 과 «같은 수»여야 그림이 같다(Live2D 의 메시에 해당). */
const 기본N = 28;
/** 깊이를 재는 해상도 — 원본과 같다. */
const 기본P = 256;

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
function 줄이기(img, P = 기본P) {
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
function 깊이재기(d, N = 기본N, P = 기본P) {
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

/**
 * 그림 한 장 → 깊이 격자 한 벌. 부르는 쪽이 원하는 것은 늘 이것이다.
 *
 * 🔴 **z 가 전부 0 이면 던진다** — 08-26 에 실제로 그랬다(`v` 정의 한 줄이 없어 층이 통째로
 *   죽어 있었고, 구조 검사 열 개는 «있나»만 봐서 못 잡았다). 조용한 0 은 «성공한 얼굴»을 한다.
 *
 * @returns {{N:number, z:number[], 몸색:number[], 통계:{최대:number,평균:number,산것:number,칸:number}}}
 */
function 뽑기(그림절대경로, { N = 기본N, P = 기본P } = {}) {
  const img = png읽기(그림절대경로);
  const { zArr, 몸색 } = 깊이재기(줄이기(img, P), N, P);

  let 최대 = 0, 합 = 0, 산것 = 0;
  for (const z of zArr) { 최대 = Math.max(최대, z); if (z > 0) { 합 += z; 산것++; } }
  if (최대 === 0) {
    throw new Error(`z 가 전부 0 이다 — 깊이 함수가 죽었다는 뜻이다(${path.basename(그림절대경로)})`);
  }

  return {
    N,
    /* 소수 셋째 자리에서 끊는다 — 격자 하나가 3KB 남짓이라 통째로 실어도 가볍다. */
    z: Array.from(zArr, (v) => Math.round(v * 1000) / 1000),
    몸색,
    통계: { 최대, 평균: 산것 ? 합 / 산것 : 0, 산것, 칸: zArr.length },
  };
}

module.exports = { 기본N, 기본P, png읽기, 줄이기, 깊이재기, 뽑기 };
