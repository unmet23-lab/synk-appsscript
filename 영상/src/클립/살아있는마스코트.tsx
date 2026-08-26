/**
 * 살아 있는 마스코트 — **4D 깊이층**을 릴에 옮긴 판 (유호 지시 08-26 「어제 만든 4d 버전 적용해서
 * 살아움직이는것처럼 만들어줄수있어? 막 옆도 보고 이런 느낌 있잖아」).
 *
 * 🔑 어디서 왔나: `docs/캐릭터/생명공방_0826/살아움직이는<캐릭터>.html` 의 4D 층.
 *   그 지면이 하는 일은 한 줄로 이렇다 — **그림 한 장에서 픽셀마다 깊이(z)를 재고,
 *   시점이 움직이면 z 만큼 반대로 민다.** 눈은 z 가 커서(+0.30) «먼저» 움직이고,
 *   그 어긋남이 사람 눈에 «고개를 돌렸다»로 읽힌다. 사진 한 장이 입체가 되는 자리다.
 *   ⚠ 그 층은 08-26 까지 **한 번도 돈 적이 없었다**(`v` 정의 한 줄이 없어 통째로 죽어 있었고,
 *     구조 검사 열 개는 «있나»만 봐서 못 잡았다). 실렌더가 잡아 고친 뒤의 판을 옮긴 것이다.
 *
 * 🔑 깊이는 `영상/깊이뽑기.js` 가 «미리» 뽑아 둔다(`public/깊이/<가이드>.json` · 29×29).
 *   Remotion 은 프레임마다 다시 그리므로, 여기서 256×256 픽셀을 매번 읽으면 900번 읽게 된다.
 *
 * 🔴 캔버스로 그린다 — `<Img>` 로는 못 한다. 깊이만큼 «부분마다 다르게» 밀어야 하는데
 *   CSS transform 은 그림 «통째»로만 움직인다. 그래서 격자 칸마다 따로 그린다.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { 가이드, 표정 } from "./타입";
import { 연출, 그늘, type 경계 } from "./연출";

/* ── 4D 값 — 원본 지면과 «같은 리듬», 세기만 릴에 맞췄다 ────────────────────
   원본은 앱 화면이라 하루 종일 보는 자리다(시차 0.055 · 진폭 0.30 — 미세함이 의도).
   릴은 30초에 한 번 스쳐 가는 지면이라 그 세기면 «안 보인다». 리듬(주기 11초·14초)은 그대로 두고
   세기만 올렸다 — 주기를 건드리면 지면과 릴의 «성격»이 갈린다. */
const 입체 = {
  시차: 0.075,
  가로진폭: 0.42,
  세로진폭: 0.22,
  가로주기: 11,
  세로주기: 14,
  빛세기: 0.5,
  /** 시점을 따라 몸이 «따라 기운다» — 고개만 돌고 몸이 안 움직이면 인형이 된다. */
  기울: 0.028,
} as const;

const 컷들 = ["본체", "눈감음", "눈웃음"] as const;

export const 살아있는마스코트: React.FC<{
  가이드: 가이드;
  경계표: 경계[];
  폭: number;
  말할때?: number[];
}> = ({ 가이드, 경계표, 폭, 말할때 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const 캔버스 = useRef<HTMLCanvasElement>(null);
  const [짐, 짐놓기] = useState<{ 그림: Record<string, HTMLImageElement>; z: number[]; N: number } | null>(null);
  const [핸들] = useState(() => delayRender(`4D 마스코트 — ${가이드}`));

  /* 그림 셋 + 깊이 격자를 «한 번만» 싣는다. 다 실릴 때까지 렌더를 붙잡는다
     (안 붙잡으면 Remotion 이 빈 캔버스를 그대로 찍는다 — 조용히 새는 자리다). */
  useEffect(() => {
    let 살아있음 = true;
    const 그림불러오기 = (이름: string) =>
      new Promise<[string, HTMLImageElement]>((성공, 실패) => {
        const im = new Image();
        im.onload = () => 성공([이름, im]);
        im.onerror = () => 실패(new Error(`${가이드}/${이름}.png 를 못 실었다`));
        im.src = staticFile(`${가이드}/${이름}.png`);
      });

    Promise.all([
      Promise.all(컷들.map(그림불러오기)),
      fetch(staticFile(`깊이/${가이드}.json`)).then((r) => {
        if (!r.ok) throw new Error(`깊이/${가이드}.json 을 못 실었다 — 먼저 node 영상/깊이뽑기.js`);
        return r.json();
      }),
    ])
      .then(([그림쌍, 깊이]) => {
        if (!살아있음) return;
        짐놓기({ 그림: Object.fromEntries(그림쌍), z: 깊이.z, N: 깊이.N });
        continueRender(핸들);
      })
      .catch((e) => {
        /* 조용히 넘어가지 않는다 — 4D 가 안 실렸는데 그림만 나오면 아무도 못 본다 */
        throw e;
      });
    return () => {
      살아있음 = false;
    };
  }, [가이드, 핸들]);

  /* ── 이 프레임의 «몸 상태» — 원본 지면의 격자() 와 같은 축들 ─────────────── */
  const 상태 = useMemo(() => {
    const 현 = 경계표.find((b) => frame >= b.시작 && frame < b.끝);
    const 표정: 표정 = 현?.표정 ?? "본체";

    const 등장 = spring({ frame: frame - (현?.시작 ?? 0), fps, config: 연출.스프링탄 });
    const 튐 = interpolate(등장, [0, 1], [0.92, 1]);
    const 숨 = 1 + Math.sin(frame / 26) * 0.014;
    const 부유 = Math.sin(frame / 44) * 14;

    const 최근말 = (말할때 || []).filter((f) => frame >= f && frame < f + 14).pop();
    const 말튐 = 최근말 === undefined ? 0 : Math.sin(((frame - 최근말) / 14) * Math.PI) * 0.055;

    /* 깜빡임 — 두 사인의 곱이라 주기가 어긋나 «불규칙»하게 보인다.
       `frame > 8` 이 첫 프레임을 눈뜸으로 강제한다(릴 커버를 구하는 자리). */
    const 깜빡 = 표정 === "본체" && frame > 8 && Math.sin(frame / 37) * Math.sin(frame / 53) > 0.985;
    const 컷 = 깜빡 ? "눈감음" : 표정;

    /* 4D 시점 — 초 단위로 도는 두 사인. 주기가 11 과 14 라 서로 안 맞아떨어져
       같은 자리를 두 번 지나지 않는다(그게 «둘러본다»로 읽히는 까닭이다). */
    const t = frame / fps;
    const 시점x = Math.cos((t / 입체.가로주기) * Math.PI * 2) * 입체.가로진폭;
    const 시점y = Math.sin((t / 입체.세로주기) * Math.PI * 2) * 입체.세로진폭;

    return { 컷, 튐, 숨, 부유, 말튐, 시점x, 시점y };
  }, [frame, fps, 경계표, 말할때]);

  /* ── 그린다 — **삼각형 메시** ────────────────────────────────────────────
   * 🔴 첫 판은 «격자 칸마다 drawImage» 였는데 **찢어졌다**(실측: 캐릭터 위로 흰 줄이 그어졌다).
   *   까닭은 원리적이다 — 칸을 각자 밀면 이웃 사이에 **틈이 생긴다.** 실루엣 근처에서 z 가
   *   0 → 0.6 으로 뛰므로 이웃 칸의 이동량이 5px 씩 벌어지고, 그 5px 이 빈 채로 남는다.
   *   1px 씩 겹쳐 그려도 못 덮는다(겹침보다 틈이 크다).
   *
   * 🔑 삼각형 메시는 **꼭짓점을 공유**한다 — 이웃한 두 삼각형이 같은 점을 쓰므로 틈이
   *   «생길 수가 없다». 대신 삼각형마다 클립 + 아핀 변환이 필요하다(그래서 느리다).
   *   격자를 16 으로 낮춰 값을 치렀다: 512 삼각형/프레임. 깊이 격자(28)는 그대로 두고
   *   여기서만 성기게 읽는다 — 깊이는 정확하되 변형만 성기다.
   */
  useEffect(() => {
    const cv = 캔버스.current;
    if (!cv || !짐) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const { 그림, z, N: zN } = 짐;
    const im = 그림[상태.컷];
    if (!im) return;

    /* 🔑 캔버스를 2배로 그려 CSS 로 반 줄인다 — 삼각형 «경계»의 반픽셀 겹침이 서브픽셀로 묻힌다.
       0.35px 부풀림만으로는 몸 위에 옅은 메시 선이 남았다(실측). 채우는 비용은 4배지만
       삼각형 수는 그대로라 실측 렌더 시간은 얼마 안 늘었다. */
    const 배율 = 2;
    const S = 폭 * 배율;
    const M = 16; /* 변형 격자 — 삼각형 512개 */
    ctx.clearRect(0, 0, S, S);

    const 배 = 상태.튐 * 상태.숨 * (1 + 상태.말튐);
    const 가운데 = S / 2;

    /** 깊이 격자에서 (u,v) 의 z 를 겹선형으로 읽는다. v=0 이 바닥이라 세로를 뒤집는다. */
    const z읽기 = (u: number, v: number) => {
      const fx = u * zN, fy = v * zN;
      const i0 = Math.min(zN - 1, Math.floor(fx)), j0 = Math.min(zN - 1, Math.floor(fy));
      const tx = fx - i0, ty = fy - j0;
      const g = (i: number, j: number) => z[j * (zN + 1) + i] ?? 0;
      return (
        g(i0, j0) * (1 - tx) * (1 - ty) +
        g(i0 + 1, j0) * tx * (1 - ty) +
        g(i0, j0 + 1) * (1 - tx) * ty +
        g(i0 + 1, j0 + 1) * tx * ty
      );
    };

    /* 꼭짓점 (M+1)² 를 먼저 다 구한다 — 삼각형들이 «같은 점»을 나눠 쓰게 하려는 것이다 */
    const 점 = new Float64Array((M + 1) * (M + 1) * 2);
    for (let j = 0; j <= M; j++) {
      for (let i = 0; i <= M; i++) {
        const u = i / M, vy = j / M;
        const v = 1 - vy; /* 0 = 바닥 · 1 = 머리 */
        const zv = z읽기(u, v);
        const h = Math.pow(v, 1.45); /* 위로 갈수록 크게 — 아래는 바닥에 붙어 있다 */
        const dx = 상태.시점x * zv * 입체.시차 * S * 0.5 + 상태.시점x * 입체.기울 * h * S;
        const dy = 상태.시점y * zv * 입체.시차 * S * 0.5;
        const bx = 가운데 + (u * S - 가운데) * 배;
        const by = 가운데 + (vy * S - 가운데) * 배;
        const o = (j * (M + 1) + i) * 2;
        점[o] = bx + dx;
        점[o + 1] = by + dy;
      }
    }

    const su = im.width / M, sv = im.height / M;

    /** 원본 삼각형 → 화면 삼각형 아핀 변환 + 클립. 이음매가 원리상 안 생긴다. */
    const 삼각 = (
      u0: number, v0: number, u1: number, v1: number, u2: number, v2: number,
      x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
    ) => {
      const d = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
      if (!d) return;
      const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / d;
      const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / d;
      const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / d;
      const e = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / d;
      ctx.save();
      ctx.beginPath();
      /* 무게중심에서 0.35px 씩 부풀린다 — 삼각형 «사이»의 반픽셀 실선(안티에일리어싱 틈)을 덮는다.
         꼭짓점을 공유하므로 틈 자체는 없고, 남는 것은 가장자리 부드러움뿐이다. */
      const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
      const 불 = (x: number, y: number): [number, number] => {
        const l = Math.hypot(x - cx, y - cy) || 1;
        return [x + ((x - cx) / l) * 0.35, y + ((y - cy) / l) * 0.35];
      };
      const p0 = 불(x0, y0), p1 = 불(x1, y1), p2 = 불(x2, y2);
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.closePath();
      ctx.clip();
      ctx.transform(a, b, c, e, x0 - a * u0 - c * v0, y0 - b * u0 - e * v0);
      ctx.drawImage(im, 0, 0);
      ctx.restore();
    };

    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        const o00 = (j * (M + 1) + i) * 2;
        const o10 = (j * (M + 1) + i + 1) * 2;
        const o01 = ((j + 1) * (M + 1) + i) * 2;
        const o11 = ((j + 1) * (M + 1) + i + 1) * 2;
        const u0 = i * su, v0 = j * sv, u1 = (i + 1) * su, v1 = (j + 1) * sv;
        삼각(u0, v0, u1, v0, u0, v1, 점[o00], 점[o00 + 1], 점[o10], 점[o10 + 1], 점[o01], 점[o01 + 1]);
        삼각(u1, v0, u1, v1, u0, v1, 점[o10], 점[o10 + 1], 점[o11], 점[o11 + 1], 점[o01], 점[o01 + 1]);
      }
    }

    /* 빛 — 시점이 움직일 때만 변한다. 정지(시점 0)면 사진 그대로.
       사진에 이미 구워진 조명을 덮어쓰지 않으려는 절제다(원본 지면의 그 규율).
       🔑 «몸 전체»에 아주 옅은 기울기 한 겹으로 준다 — 칸마다 칠하면 그 칸 경계가 다시 보인다. */
    const 빛 = 상태.시점x * 입체.빛세기 * 0.10;
    if (Math.abs(빛) > 0.003) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      const g = ctx.createLinearGradient(0, 0, S, 0);
      g.addColorStop(0, `rgba(255,252,246,${Math.max(0, 빛).toFixed(3)})`);
      g.addColorStop(0.5, "rgba(255,252,246,0)");
      g.addColorStop(1, `rgba(8,9,12,${Math.max(0, 빛).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.restore();
    }
  }, [짐, 상태, 폭]);

  return (
    <canvas
      ref={캔버스}
      width={폭 * 2}
      height={폭 * 2}
      style={{
        width: 폭,
        height: 폭,
        transform: `translateY(${상태.부유 - 상태.말튐 * 120}px)`,
        filter: `drop-shadow(0 18px 26px ${그늘(0.16)})`,
      }}
    />
  );
};
