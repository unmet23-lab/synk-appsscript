// LAB 말 글씨 「튀는 글자」 본보기 — 유호님 11-25 「B로 가자」(시안 2차의 B). 절차는 제작 절차 「말 글씨」다.
// 편에서는 이 파일을 src/film/튀는글자.tsx로 복사해 쓴다. 말풍선(Bubble) 대신 놓는다. 머리 글 · 뜻 카드 · 시간 줄은 그대로다.
// 나라 판본: 바뀌는 것은 한글 층뿐이다. 읽기 · 뜻 줄은 판본 글을 그대로 넣고, 한글은 폭에 맞춰 저절로 줄어든다.
import React from 'react';
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { measureText } from '@remotion/layout-utils';
import { EN, KO } from '../lib/fonts';

const INK = '#2B1B12';
const PAPER = '#FFF8EC';
const KEY = '#FFD84A'; // 배우는 낱말만. 맞는 말 초록 · 틀린 말 빨강과 섞지 않는다
const READ = '#FFE9B8';

// 감정 여덟 — 감정이 없으면 「담담」
export type 감정 = '기쁨' | '당황' | '웃음' | '놀람' | '슬픔' | '화남' | '졸림' | '담담';
export type 말 = {
  at: number; // 시작 초
  to: number; // 끝 초(1.2초 넘게 — 제작 절차 「화면 글은 읽을 만큼」)
  ko: string[]; // 한글 줄(두 줄까지)
  key?: string; // 배우는 낱말(있을 때만 노랑)
  read?: string; // 읽기(키릴 · 로마자)
  mean: string; // 뜻
  x: number; // 글자 덩어리 가운데 x
  y: number; // 글자 덩어리 아래 y
  tip: [number, number]; // 말한 사람 머리 옆이나 위. 꼬리는 이쪽으로 78px까지만 간다(얼굴에 닿지 않게)
  감정: 감정;
  크기?: number; // 한글 크기(안 적으면 130, 두 줄 118)
  폭?: number; // 한글 최대 폭(안 적으면 900)
  그림?: '눈송이'; // 배우는 낱말 위에 얹는 뜻 그림(안 적으면 없음)
};

const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 한글 줄이 폭을 넘으면 줄인다 — 판본에서 긴 문장이 와도 화면을 넘지 않는다 */
const 맞춘크기 = (줄: string[], 크기: number, 폭: number) => {
  const 넓이 = Math.max(...줄.map((t) => measureText({ text: t, fontFamily: 'SUIT', fontWeight: '900', fontSize: 크기 }).width));
  return 넓이 > 폭 ? Math.max(60, Math.floor((크기 * 폭) / 넓이)) : 크기;
};

// 뜻 그림 — 배우는 낱말의 뜻을 낱말에 붙여 보인다(유호님 11-26 「손 시려 할때 "시려"에 눈송이같은 아이콘」). 글자와 같은 먹 테두리
const 눈송이: React.FC<{ size: number }> = ({ size }) => {
  const 가지 = 'M50 50 L50 8 M50 23 L37 12 M50 23 L63 12 M50 36 L41 28 M50 36 L59 28';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', display: 'block' }}>
      {[INK, '#CFEBFF'].map((c, k) => (
        <g key={k} stroke={c} strokeWidth={k === 0 ? 20 : 9} strokeLinecap="round" fill="none">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} d={가지} transform={`rotate(${a} 50 50)`} />
          ))}
        </g>
      ))}
    </svg>
  );
};

const 글자하나: React.FC<{ ch: string; i: number; n: number; 줄: number; w: 말; size: number; fill: string; 그림?: 말['그림'] }> = ({ ch, i, n, 줄, w, size, fill, 그림 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t0 = fr(w.at) + 줄 * 5 + i * 2;
  const sp = spring({ frame: f - t0, fps, config: { damping: w.감정 === '놀람' ? 8 : 11, mass: 0.5, stiffness: 190 } });
  const t = (f - fr(w.at)) / FPS;
  const m = n > 1 ? i / (n - 1) : 0.5;
  const 그림커짐 = 그림 ? spring({ frame: f - fr(w.at) - 12, fps, config: { damping: 9, mass: 0.5, stiffness: 160 } }) : 0;
  let y = 0;
  let rot = 0;
  let sc = sp;
  let gap = 0;
  if (w.감정 === '기쁨') {
    y = -Math.sin(m * Math.PI) * 26;
    rot = (m - 0.5) * 16;
  } else if (w.감정 === '당황') {
    y = i * 7 + (random(`${i}-${Math.floor(f / 3)}`) - 0.5) * 5;
    rot = -4;
    sc = sp * (1 - i * 0.045);
    gap = size * 0.05;
  } else if (w.감정 === '웃음') {
    y = Math.sin(t * 9 - i * 0.9) * 13 * Math.exp(-t * 0.6);
    rot = Math.sin(t * 9 - i * 0.9) * 3;
  } else if (w.감정 === '놀람') {
    rot = (m - 0.5) * 22 + (random(`r${i}`) - 0.5) * 8;
    y = -Math.abs(m - 0.5) * 24;
    sc = sp * (1.12 - 0.12 * Math.min(1, t / 0.35));
  } else if (w.감정 === '슬픔') {
    y = i * 5;
    rot = -2;
    sc = sp * (1 - i * 0.03);
  } else if (w.감정 === '화남') {
    y = (random(`${i}-${Math.floor(f / 2)}`) - 0.5) * 5;
    rot = (random(`a${i}`) - 0.5) * 8;
  } else if (w.감정 === '졸림') {
    y = Math.sin(t * 2 - i * 0.5) * 6 + i * 3;
    rot = -3;
  }
  return (
    <span style={{ display: 'inline-block', fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1.05, color: fill, marginRight: gap, transform: `translateY(${y}px) rotate(${rot}deg) scale(${sc})`, transformOrigin: '50% 80%', WebkitTextStroke: `${size * 0.14}px ${INK}`, paintOrder: 'stroke fill', whiteSpace: 'pre', position: 'relative' }}>
      {ch}
      {그림 === '눈송이' ? (
        <span style={{ position: 'absolute', left: '56%', top: '-52%', transform: `scale(${그림커짐}) rotate(${10 + 5 * Math.sin(t * 2.4)}deg)`, transformOrigin: '50% 50%' }}>
          <눈송이 size={size * 0.86} />
        </span>
      ) : null}
    </span>
  );
};

const 꼬리: React.FC<{ 기점: [number, number]; tip: [number, number]; p: number }> = ({ 기점, tip, p }) => {
  const [x1, y1] = 기점;
  const full = Math.hypot(tip[0] - x1, tip[1] - y1) || 1;
  const k = Math.min(1, 78 / full) * p;
  const x2 = x1 + (tip[0] - x1) * k;
  const y2 = y1 + (tip[1] - y1) * k;
  const n = Math.hypot(x2 - x1, y2 - y1) || 1;
  const px = (-(y2 - y1) / n) * 29;
  const py = ((x2 - x1) / n) * 29;
  const cx = (x1 + x2) / 2 + px * 0.9;
  const cy = (y1 + y2) / 2 + py * 0.9;
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, overflow: 'visible', pointerEvents: 'none' }}>
      <path d={`M ${x1 + px} ${y1 + py} Q ${cx} ${cy} ${x2} ${y2} Q ${(x1 + x2) / 2 - px * 0.3} ${(y1 + y2) / 2 - py * 0.3} ${x1 - px} ${y1 - py} Z`} fill={PAPER} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
    </svg>
  );
};

export const 튀는글자: React.FC<{ w: 말 }> = ({ w }) => {
  const f = useCurrentFrame();
  if (f < fr(w.at) || f >= fr(w.to)) return null;
  const 기본 = w.크기 ?? (w.ko.length > 1 ? 118 : 130);
  const size = 맞춘크기(w.ko, 기본, w.폭 ?? 900);
  const 나타남 = interpolate(f, [fr(w.at) + 8, fr(w.at) + 14], [0, 1], clamp);
  // 글자가 처지는 감정은 마지막 글자가 뜻 줄에 닿지 않게 그만큼 띄운다
  const 글자수 = Math.max(...w.ko.map((t) => Array.from(t).length));
  const 처짐 = w.감정 === '당황' ? 글자수 * 6 : w.감정 === '슬픔' ? 글자수 * 4 : w.감정 === '졸림' ? 글자수 * 3 : 0;
  const 꼬리p = interpolate(f, [fr(w.at) + 4, fr(w.at) + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  return (
    <>
      <꼬리 기점={[w.x, w.y + 10]} tip={w.tip} p={꼬리p} />
      <div style={{ position: 'absolute', left: w.x, top: w.y, transform: 'translate(-50%, -100%)', textAlign: 'center', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.35))' }}>
        {w.ko.map((ln, li) => {
          const 마지막 = li === w.ko.length - 1 && w.ko.length > 1;
          return (
            <div key={li} data-synk-line="" style={{ whiteSpace: 'pre', marginBottom: -4 }}>
              {Array.from(ln).map((ch, i) => {
                const 안 = w.key && ln.includes(w.key) && i >= ln.indexOf(w.key) && i < ln.indexOf(w.key) + w.key.length;
                return <글자하나 key={i} ch={ch} i={i} n={Array.from(ln).length} 줄={li} w={w} size={마지막 ? Math.round(size * 1.15) : size} fill={안 ? KEY : PAPER} 그림={안 && w.key && i === ln.indexOf(w.key) + w.key.length - 1 ? w.그림 : undefined} />;
              })}
            </div>
          );
        })}
        <div style={{ opacity: 나타남, marginTop: 14 + 처짐 }}>
          {w.read ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 44, color: READ, WebkitTextStroke: `9px ${INK}`, paintOrder: 'stroke fill', whiteSpace: 'pre', marginBottom: 2 }}>{w.read}</div> : null}
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 54, color: '#fff', WebkitTextStroke: `11px ${INK}`, paintOrder: 'stroke fill', whiteSpace: 'pre', letterSpacing: -0.5 }}>{w.mean}</div>
        </div>
      </div>
    </>
  );
};
