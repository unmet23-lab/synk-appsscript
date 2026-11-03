// 편마다 같이 쓰는 S42 부품 — 피사체 다시 얹기(뒤 글자를 가림) · 문짝 전환 · 가림 검사 탐침(../../가림검사.py)
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { ramp } from './motion';

const FPS = 24;
// 마스크 컷 목록은 편마다 피사체따기_rembg.py가 쓰는 src/<편>/masks.json
export type MaskCut = { cut: string; from: number; to: number; frames: number };
// 컷 안 프레임으로 견준다 — 마스크는 ffmpeg -ss <from>(그 초 뒤 첫 프레임)부터 뽑았고, 화면은 컷 경계를 round(초 × 24) 프레임에서 자른다.
// 끝을 초로 견주면 경계 프레임(2.17초 = 52.08 → 화면은 52에서 다음 컷)에 앞 컷 피사체가 한 장 얹혔다(11-03 밤 11번 52번째 프레임)
const startF = (c: MaskCut) => Math.ceil(c.from * FPS - 1e-6);
const endF = (c: MaskCut) => Math.round(c.to * FPS);
export const maskAt = (cuts: MaskCut[], t: number) => {
  const f = Math.round(t * FPS);
  return cuts.find((c) => f >= startF(c) && f < endF(c));
};

// 그 컷의 프레임 위에 마스크 알파로 피사체만 다시 얹는다 — 부모(편 화면이나 띠) 크기에 꽉 차게
export const Subject: React.FC<{ film: string; cuts: MaskCut[]; t: number }> = ({ film, cuts, t }) => {
  const m = maskAt(cuts, t);
  if (!m) return null;
  const n = Math.min(m.frames, Math.max(1, Math.round(t * FPS) - startF(m) + 1));
  const id = String(n).padStart(5, '0');
  const mask = `url("${staticFile(`${film}/cut/${m.cut}/m/${id}.png`)}")`;
  return (
    <AbsoluteFill style={{ zIndex: 5 }}>
      <Img src={staticFile(`${film}/cut/${m.cut}/f/${id}.jpg`)} style={{ width: '100%', height: '100%', WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }} />
    </AbsoluteFill>
  );
};

// 문짝 전환(S42 Door) — 세 장이 위 · 아래에서 번갈아 덮고 걷힌다
export const Door: React.FC<{ t: number; at: number; color: string; w?: number; h?: number }> = ({ t, at, color, w = 1080, h = 1920 }) => {
  const q = t - at;
  if (q < -0.23 || q > 0.35) return null;
  const leaf = w / 3;
  return (
    <AbsoluteFill style={{ zIndex: 60 }}>
      {[0, 1, 2].map((i) => {
        const p = q < 0 ? ramp(q + 0.23 - i * 0.018, 0, 0.2) : 1 - ramp(q - i * 0.018, 0, 0.28);
        return <div key={i} style={{ position: 'absolute', left: i * leaf, top: -5, width: leaf + 2, height: h + 10, background: color, transform: `translateY(${(1 - p) * (i % 2 === 0 ? -(h + 20) : h + 20)}px)` }} />;
      })}
    </AbsoluteFill>
  );
};

// 가림 검사 탐침: 큰 낱말만 글자마다 다른 순색으로, 왼쪽 위 16px 칸 색 = (16 × (낱말 번호 + 1), 피사체 뒤면 255, 밝은 글자면 255)
const PROBE = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
export const ProbeMeta: React.FC<{ i: number; behind: boolean; light?: boolean }> = ({ i, behind, light }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 16, height: 16, background: `rgb(${16 * (i + 1)},${behind ? 255 : 0},${light ? 255 : 0})` }} />
);
export const probeChars = (word: string) => {
  let k = 0;
  return [...word].map((ch, j) => <span key={j} style={{ color: ch === ' ' ? 'transparent' : PROBE[k++ % PROBE.length] }}>{ch}</span>);
};
