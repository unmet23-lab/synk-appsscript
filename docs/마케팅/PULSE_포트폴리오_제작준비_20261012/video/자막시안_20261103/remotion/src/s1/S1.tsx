// 시즌 1 「옆집의 크리스마스」 화면 글(2026-11-07, Claude) — 16:9 60.04초 · xmas-neighbors-20261025/최종편집.py가 화면(s1/picture.mp4) · 소리(s1/sound.wav)를 넣고 이 판을 굽는다.
//   말자막: 아래 가운데 가는 흰 글자(02_콘티 3절). 이야기 영화라 섞은 판 결(큰 낱말 · 레몬 낱말)은 쓰지 않는다 — 6번 연말과 같은 결.
//     시각은 소리.py가 놓은 자리(timing.json), 마침표는 쓰지 않는다(슬롭 점검표 6번). 전화 꼬리표 「(전화)」는 뺐다(11-07 Fable — 폰에서 안 읽히고 없어도 됨).
//   끝 문구(35): 「1+1의 하나는, 옆집에」 한 줄이 통째로 조용히 떠서 선다. 첫 판의 낱말마다 호박빛으로 켜지는 효과는 11-07 Fable 맹검이
//     「주황 강조 + 타자 치듯 — 점검표 24번 그대로」로 짚어 뺐다.
//   끝(36): 콘티 3절대로 로고 판 + 한 줄을 거리 그림 위에 서서히 — 로고 판은 로고 D(호박빛 바탕 · 흰 그린 글자, 결정 10-29, 최종편집.py가
//     logo_box.png로 굽는다)라 장면 속 간판과 같은 결이고, 원본처럼 길 소실점에 앉히며 꼬리말은 그 위 한 줄. 움직임 · 흐림 · 낱말마다 떠오르기 같은 효과는 없다(점검표 22).
//     지난 판들: 밤하늘 흰 워드마크 + 낱말마다 떠오르는 꼬리말 + 점(Fable 1차 「간판과 로고가 둘 · 타자 효과」) → 글자 없이 간판의 점만(Fable 끝 맹검
//     「이름이 작은 간판 한 곳뿐 — 폰 · 소리 끈 시청자에게 브랜드가 안 남음」) → 이 판. 「켬」 뒤 글로켄 한 점은 소리.py.
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO } from '../lib/fonts';
import { EXPO, life, ramp } from '../lib/motion';
import timing from './timing.json';

const FPS = 24;
export const S1_FRAMES = 1441;
const PAPER = '#F4F1EA';
const CUT_F: number[] = timing.cut_f;   // 화면이 자르는 장 경계(최종편집.py F) — 자막 꼬리를 다음 컷에서 끊는다
const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: w, height: h });

type Line = { a: number; b: number; who?: string; s: string; keep?: boolean; dim?: boolean };
const LINES = timing.lines as Line[];
const tailEnd = (l: Line) => {
  if (l.keep) return l.b;   // 다음 컷으로 이어지는 목소리(34 → 35)는 끝까지
  const nx = CUT_F.find((f) => f / FPS >= l.b - 1 / FPS);
  return Math.min(l.b, nx !== undefined ? nx / FPS : l.b);
};

const Caption: React.FC<{ t: number }> = ({ t }) => {
  const c = LINES.find((l) => t >= l.a - 0.06 && t < tailEnd(l));
  if (!c) return null;
  const end = tailEnd(c);
  const o = life(t, c.a - 0.06, end, 0.14, end < c.b - 1e-6 ? 0.001 : 0.18);
  return (
    <>
      <AbsoluteFill style={{ zIndex: 19, opacity: o * 0.85, background: c.dim ? 'linear-gradient(#0000 70%, #00000059 84%, #0000009e 100%)' : 'linear-gradient(#0000 76%, #00000038 88%, #0000006b 100%)' }} />
      <div style={{ ...abs(0, 950, 1920), zIndex: 20, textAlign: 'center', opacity: o, fontFamily: KO, color: PAPER, textShadow: '0 0 2px #000000a0, 0 2px 16px #00000090' }}>
        {c.who ? <span style={{ fontWeight: 500, fontSize: 25, letterSpacing: '0.04em', opacity: 0.72, marginRight: 14, position: 'relative', top: -3 }}>{c.who}</span> : null}
        <span style={{ fontWeight: 480, fontSize: 40, letterSpacing: '-0.005em' }}>{c.s}</span>
      </div>
    </>
  );
};

// 끝 문구 — 35 넓은 그림, 하린 자막이 빠진 뒤(timing.copy_at) 한 줄이 통째로 떠서 내레이션 앞(copy_out)까지 선다
const EndCopy: React.FC<{ t: number }> = ({ t }) => {
  const at: number = timing.copy_at;
  const out: number = timing.copy_out;
  if (t < at - 0.01 || t >= out) return null;
  const o = ramp(t, at, 0.4, EXPO) * (1 - ramp(t, out - 0.32, 0.32, (x) => x));
  return (
    <>
      <AbsoluteFill style={{ zIndex: 14, opacity: o * 0.9, background: 'linear-gradient(#0000 64%, #0000003d 82%, #00000070 100%)' }} />
      <div style={{ ...abs(0, 874, 1920), zIndex: 15, textAlign: 'center', fontFamily: KO, fontWeight: 400, fontSize: 48, letterSpacing: '-0.004em', whiteSpace: 'nowrap',
        color: PAPER, opacity: o, transform: `translateY(${(1 - ramp(t, at, 0.6, EXPO)) * 6}px)`, textShadow: '0 0 2px #00000080, 0 2px 18px #00000088' }}>
        1+1의 하나는, 옆집에
      </div>
    </>
  );
};

// 끝 로고 판 — 원본처럼 길 소실점(세로 50~60%)에 앉힌다. 꼬리말이 내레이션 순서대로 위, 로고 판이 아래 — 함께 0.9초에 걸쳐 떠오른다.
//   하늘 자리(세로 18%)에 두었던 판은 Fable 끝 맹검 2차 「붕 떠 워터마크처럼」, 얇은 꼬리말은 「폰에서 안 읽힘」.
const Lockup: React.FC<{ t: number }> = ({ t }) => {
  const a0: number = timing.lockup_at;
  if (t < a0) return null;
  const o = ramp(t, a0, 0.9, EXPO);
  return (
    <>
      <AbsoluteFill style={{ zIndex: 14, opacity: o * 0.9, background: 'radial-gradient(560px 260px at 975px 560px, #00000047, #0000)' }} />
      <div style={{ ...abs(675, 476, 600), zIndex: 15, textAlign: 'center', opacity: o }}>
        <div style={{ fontFamily: KO, fontWeight: 500, fontSize: 34, letterSpacing: '0.01em', color: '#FAF6EE', whiteSpace: 'nowrap',
          textShadow: '0 0 2px #000000a0, 0 2px 14px #00000099' }}>옆집까지 늘 켜 둡니다</div>
        <Img src={staticFile('s1/logo_box.png')} style={{ height: 104, display: 'inline-block', marginTop: 16, boxShadow: '0 6px 26px #00000066' }} />
      </div>
    </>
  );
};

const NOTICE = '가상 브랜드 · AI로 만든 가상 모델 · 음성';

export const S1: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('s1/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      <EndCopy t={t} />
      <Lockup t={t} />
      <Caption t={t} />
      <div style={{ ...abs(40, 1036, 1840), zIndex: 30, textAlign: 'right', fontFamily: KO, fontWeight: 500, fontSize: 22, color: '#ffffff96' }}>{NOTICE}</div>
      <Audio src={staticFile('s1/sound.wav')} />
    </AbsoluteFill>
  );
};
