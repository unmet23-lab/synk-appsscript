// 10번 도담중공업 영어 판(2026-11-17, Claude) — PULSE 영어 시험 첫 편(유호님 11-17 「권고대로」, 결정 표 11-17).
//   PULSE_영어시험_20261117/01_도담중공업_영어/영어판.py가 화면(p10en/picture.mp4 — 한국어 판 1~36컷 그대로 + 영문으로 그린 끝 로고 37컷 + 위아래 60px 띠) ·
//   소리(p10en/sound.wav — 영어 내레이션을 한국어 판과 같은 자리에)를 넣고 이 판을 굽는다. 시각은 최종소리.py가 쓴 timing.json(받아쓰기 낱말 시각)이다.
// 자막: 한국어 판(P10.tsx)의 결 그대로 — 그림 안 아래 명조 44px 한 줄, 마침표 · 쉼표 없음, 흐림이 풀리며 10px 올라옴, 글자 뒤 넓고 옅은 타원.
//   영어 판에는 아래 영문 작은 줄이 없다(말과 자막이 같은 말이다). 명조는 Noto Serif KR의 라틴 글자만 잘라 쓴다(serifen.ts).
// 끝: 필름이 끝나는 자리(도담 로고가 어두워지는 60.67~61.17초)에서 SYNK PULSE 끝 화면이 이어 뜬다 — 문구(명조) → 작은 줄 → 로고 → 주소 차례로,
//   0.4초 동안 12px 올라오며(후반 가이드 3절 「글자는 박에 맞춰 차례로」). 로고는 승인 파일(브랜드킷/배치용/SYNK-PULSE-Paper.png)을 비례 그대로 쓴다.
//   「사람은 모두 AI」 · 「가상 브랜드」 표시는 구석 딱지가 아니라 끝 화면 문구로 둔다(슬롭 점검표 6번 원칙 — 구석 설명 딱지를 쓰지 않는다).
//   크기: 첫 판(문구 46 · 작은 줄 20 · 로고 452 · 주소 28px)은 폰에서 가로 영상이 약 390px로 줄면 작은 줄이 4px 남짓이라 키웠다(11-17).
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { EN } from '../lib/fonts';
import { ramp } from '../lib/motion';
import { SERIF_EN } from './serifen';
import timing from './timing.json';

const FPS = 24;
const FILM = timing.frames;                 // 37컷 + 끝 로고(1470장 · 61.25초)
export const CARD = 78;                     // 끝 화면이 필름 뒤로 더 서 있는 장 수(3.25초) — 로고가 앉은 뒤 2.5초 넘게
export const P10EN_FRAMES = FILM + CARD;    // 영어판.py가 렌더 뒤 장 수를 대조한다
const CARD_ON = (FILM - 8) / FPS;           // 끝 화면 문구가 뜨기 시작하는 초 — 도담 로고가 다 어두워지기 8장 전(겹쳐 이어짐)
const WARM = '#EFE7DA';
const lin = (x: number) => x;
type Line = { a: number; b: number; s: string };
const LINES = timing.lines as Line[];
const noDot = (s: string) => s.replace(/[.,]+$/, '');

const Caption: React.FC<{ c: Line; t: number }> = ({ c, t }) => {
  const k = ramp(t, c.a, 0.5);
  const o = Math.min(k, 1 - ramp(t, c.b - 0.25, 0.25, lin));
  const s = noDot(c.s);
  const w = Math.max(860, s.length * 44 * 0.5 * 2.2);   // 타원 폭 — 라틴 한 자 약 0.5em × 2.2
  return (
    <>
      <div style={{ position: 'absolute', left: 960 - w / 2, width: w, top: 826, height: 270, opacity: o,
        background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.28) 25%, rgba(0,0,0,0.16) 50%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 920, display: 'flex', justifyContent: 'center', opacity: o }}>
        <div style={{ fontFamily: SERIF_EN, fontWeight: 500, fontSize: 44, lineHeight: 1, letterSpacing: '0.005em', color: WARM, textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          transform: `translateY(${(1 - k) * 10}px)`, filter: `blur(${(1 - k) * 6}px)`, whiteSpace: 'pre' }}>
          {s}
        </div>
      </div>
    </>
  );
};

// 한 요소의 들어옴 — 0.4초 동안 12px 올라오며(빠르게 나와 천천히 멎음)
const rise = (t: number, a: number) => {
  const k = ramp(t, a, 0.4);
  return { opacity: k, transform: `translateY(${(1 - k) * 12}px)` };
};

const EndCard: React.FC<{ t: number }> = ({ t }) => {
  const a = CARD_ON;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 0 }}>
        <div style={{ fontFamily: SERIF_EN, fontWeight: 500, fontSize: 62, lineHeight: 1, color: WARM, whiteSpace: 'pre', ...rise(t, a) }}>
          Every person in this film is AI
        </div>
        <div style={{ marginTop: 26, fontFamily: EN, fontWeight: 500, fontSize: 26, lineHeight: 1, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: WARM, whiteSpace: 'pre', ...rise(t, a + 0.18), opacity: 0.78 * ramp(t, a + 0.18, 0.4) }}>
          A spec film for a fictional brand
        </div>
        <Img src={staticFile('p10en/SYNK-PULSE-Paper.png')}
          style={{ marginTop: 92, width: 560, height: 'auto', ...rise(t, a + 0.75) }} />
        <div style={{ marginTop: 36, fontFamily: EN, fontWeight: 500, fontSize: 34, lineHeight: 1, letterSpacing: '0.04em', color: WARM, whiteSpace: 'pre',
          ...rise(t, a + 0.95), opacity: 0.9 * ramp(t, a + 0.95, 0.4) }}>
          synk.im/en/pulse
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P10en: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const c = LINES.find((l) => t >= l.a && t < l.b);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Sequence durationInFrames={FILM}>
        <OffthreadVideo src={staticFile('p10en/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      </Sequence>
      {c && <Caption c={c} t={t} />}
      {t >= CARD_ON && <EndCard t={t} />}
      <Audio src={staticFile('p10en/sound.wav')} />
    </AbsoluteFill>
  );
};
