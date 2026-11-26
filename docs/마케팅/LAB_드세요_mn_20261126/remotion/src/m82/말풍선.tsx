// LAB 말 글씨 본보기 — 온전한 말풍선(LAB_하루두편_설계_20261110/본보기_말풍선_20261126/말풍선.tsx를 복사).
// 유호님 11-26 「아까처럼 말풍선이 조각나서 꺠져보이지만않으면 돼」 → 「이런 식으로 안짤리고 잘 나오는거는 이렇게 써줘도 좋을것같아」. 절차는 제작 절차 lab-lettering.
// 몸과 꼬리를 한 획의 SVG 길로 그린다 — 꼬리가 몸에서 떨어지거나 글자 뒤에 묻히지 않는다. 화면(좌우 28px) 밖으로 나가면 안쪽으로 밀고, 꼬리는 말한 사람 쪽(꼬리x)에 남는다.
// 이 편에서 더한 것: 한글 줄을 조각(koParts)으로 줄 수 있다 — 맞는 말 초록 #0A9A66 · 틀린 말 빨강 #D92D20(줄 그음), 머리 줄(head — 문자를 보낸 사람), 알약(pill).
import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { measureText } from '@remotion/layout-utils';
import { EN, KO } from '../lib/fonts';

const INK = '#2B1B12';
const PAPER = '#FFF8EC';
const MEAN = '#2F4BA0';
export const OK = '#0A9A66';
export const NG = '#D92D20';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);

export type 조각 = { t: string; c?: 'ok' | 'ng' };
export type 말풍선말 = {
  at: number; // 시작 초
  to: number; // 끝 초
  ko?: string[]; // 한글 줄(두 줄까지)
  koParts?: 조각[][]; // 한글 줄을 조각으로(색칠) — 있으면 ko 대신
  read?: string; // 읽기(키릴 · 로마자)
  mean: string; // 뜻 — 배우는 말 칸은 한 줄만(제작 절차 lab-learn-pace)
  head?: string; // 머리 줄(문자를 보낸 사람 — 교훈 L21)
  pill?: { t: string; c: 'ok' | 'ng' | 'q' }; // q = 속생각(회갈색) // 맞음 · 틀림 알약(제작 절차 「맞는 말과 틀린 말」)
  x: number; // 말풍선 가운데 x
  y: number; // 꼬리 끝 y
  꼬리x: number; // 꼬리 끝 x(말한 사람 쪽)
  크기?: number; // 한글 크기(안 적으면 86)
  뜻크기?: number; // 뜻 크기(안 적으면 한글이 있을 때 52, 없을 때 58)
  바탕?: string; // 몸 색(문자 말풍선은 흰색)
};

const 폭 = (t: string, f: string, w: string, s: number) => measureText({ text: t, fontFamily: f, fontWeight: w, fontSize: s }).width;

export const 말풍선: React.FC<{ w: 말풍선말 }> = ({ w }) => {
  const f = useCurrentFrame();
  const { width } = useVideoConfig();
  if (f < fr(w.at) || f >= fr(w.to)) return null;
  const parts: 조각[][] = w.koParts ?? (w.ko ?? []).map((t) => [{ t }]);
  const 크 = w.크기 ?? 86;
  // 이해 시험 v1에서 셋이 「몽골어 뜻 · 읽기 줄이 휴대폰에서 작다」고 짚어 키움(52 → 62 · 40 → 46)
  const 뜻 = w.뜻크기 ?? (parts.length ? 62 : 64);
  const 읽 = 50;
  const 머 = 47;
  const 알 = 48;
  const 뜻줄 = w.mean ? w.mean.split('\n') : [];
  const 글폭 = Math.max(
    0,
    ...parts.map((l) => 폭(l.map((p) => p.t).join(''), 'SUIT', '800', 크)),
    ...뜻줄.map((t) => 폭(t, 'Inter Tight', '700', 뜻)),
    w.read ? 폭(w.read, 'Inter Tight', '600', 읽) : 0,
    w.head ? 폭(w.head, 'Inter Tight', '700', 머) : 0,
    w.pill ? 폭(w.pill.t, 'Inter Tight', '800', 알) + 56 : 0,
  );
  const W = Math.ceil(글폭) + 72;
  const H = Math.ceil((w.head ? 머 * 1.3 : 0) + (w.pill ? 알 * 1.55 : 0) + parts.length * 크 * 1.12 + (w.read ? 읽 * 1.2 : 0) + 뜻줄.length * 뜻 * 1.18 + 34);
  const 꼬리 = 40;
  const left = Math.min(Math.max(w.x - W / 2, 28), width - 28 - W);
  const top = w.y - 꼬리 - H;
  const R = 38;
  const tx = Math.min(Math.max(w.꼬리x - left, 12), W - 12); // 꼬리 끝
  const tb = Math.min(Math.max(tx, R + 26), W - R - 26); // 꼬리 밑동
  const d = `M ${R} 0 H ${W - R} Q ${W} 0 ${W} ${R} V ${H - R} Q ${W} ${H} ${W - R} ${H} H ${tb + 24} L ${tx} ${H + 꼬리} L ${tb - 24} ${H} H ${R} Q 0 ${H} 0 ${H - R} V ${R} Q 0 0 ${R} 0 Z`;
  const p = interpolate(f, [fr(w.at), fr(w.at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const 색 = (c?: 'ok' | 'ng' | 'q') => (c === 'ok' ? OK : c === 'ng' ? NG : c === 'q' ? '#7A6352' : INK);
  return (
    <div style={{ position: 'absolute', left, top, width: W, height: H + 꼬리, opacity: Math.min(1, p * 1.5), transform: `scale(${0.85 + 0.15 * p})`, transformOrigin: `${tx}px ${H + 꼬리}px` }}>
      <svg width={W} height={H + 꼬리} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'drop-shadow(0 10px 13px rgba(0,0,0,0.3))' }}>
        <path d={d} fill={w.바탕 ?? PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {w.head ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 머, color: '#6B5647', lineHeight: 1.3, whiteSpace: 'pre' }}>{w.head}</div> : null}
        {w.pill ? (
          <div style={{ display: 'inline-block', background: 색(w.pill.c), color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 알, lineHeight: 1.2, padding: '2px 26px 4px', borderRadius: 999, marginBottom: 6 }}>{w.pill.t}</div>
        ) : null}
        {parts.map((l, i) => (
          <div key={i} style={{ fontFamily: KO, fontWeight: 800, fontSize: 크, color: INK, lineHeight: 1.12, whiteSpace: 'pre' }}>
            {l.map((p2, j) => (
              <span key={j} style={{ color: 색(p2.c), textDecoration: p2.c === 'ng' ? 'line-through' : undefined, textDecorationThickness: p2.c === 'ng' ? 8 : undefined, textDecorationColor: NG }}>{p2.t}</span>
            ))}
          </div>
        ))}
        {w.read ? <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 읽, color: '#6B5647', lineHeight: 1.2, whiteSpace: 'pre' }}>{w.read}</div> : null}
        {w.mean ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 뜻, color: parts.length ? MEAN : INK, lineHeight: 1.18, whiteSpace: 'pre' }}>{w.mean}</div> : null}
      </div>
    </div>
  );
};
