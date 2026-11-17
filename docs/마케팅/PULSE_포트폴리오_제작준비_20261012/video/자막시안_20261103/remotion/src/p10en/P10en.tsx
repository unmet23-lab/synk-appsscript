// 10번 도담중공업 영어 판(2026-11-17, Claude) — PULSE 영어 시험 첫 편(유호님 11-17 「권고대로」, 결정 표 11-17).
//   PULSE_영어시험_20261117/01_도담중공업_영어/영어판.py가 화면(p10en/picture.mp4 — 한국어 판 1~36컷 그대로 + 영문으로 그린 끝 로고 37컷 + 위아래 60px 띠) ·
//   소리(p10en/sound.wav — 영어 내레이션을 한국어 판과 같은 자리에)를 넣고 이 판을 굽는다. 시각은 최종소리.py가 쓴 timing.json(받아쓰기 낱말 시각)이다.
// 자막: 한국어 판(P10.tsx)의 결 그대로 — 그림 안 아래 명조 44px 한 줄, 마침표 · 쉼표 없음, 흐림이 풀리며 10px 올라옴, 글자 뒤 넓고 옅은 타원.
//   영어 판에는 아래 영문 작은 줄이 없다(말과 자막이 같은 말이다). 명조는 Noto Serif KR의 라틴 글자만 잘라 쓴다(serifen.ts).
// 끝(11-18 여섯째 판): 도담 로고가 60.67~61.17초에 빠지는 동안 마지막 장면(노을 아래 도시 불)의 하늘이 가라앉고, 서명 자리 뒤는 무채색으로 한 번 더 눌린다(영어판.py frames37).
//   61.08초부터 그 하늘에 제작사 서명이 가운데 한 줄기로 0.4초 동안 12px 올라온다 — SYNK PULSE 로고(700px) → 고지 「Every person in this film is AI-generated」(Inter Tight 600 56px) → 주소(500 44px).
//   글 크기는 폰 기준이다 — 휴대폰 가로 360px에서 고지 약 10px · 주소 약 8px(다섯째 판 40 · 30px는 8 · 6px라 「3.5초 안에 못 읽는다」, 11-18 GPT · 카본 맹검).
//   로고는 승인 파일(브랜드킷/배치용/SYNK-PULSE-Paper.png)의 투명 여백만 잘라 비례 그대로 쓴다(영어판.py가 p10en/SYNK-PULSE-Paper-trim.png로 만든다). 61.08초에 곡의 마지막 화음 메아리가 놓인다.
//   앞 판(검정 판 · 장면 45% · 노을 위 큰 로고와 명조 · 장면 하늘에 좌우 두 단)은 맹검에서 4 · 3 · 4 · 4점(카본)으로 기각됐다. 기록: 01_도담중공업_영어/검수/끝화면_GPT기준_20261118.
//   「가상 브랜드」 고지는 게시 글에 둔다.
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { EN } from '../lib/fonts';
import { ramp } from '../lib/motion';
import { SERIF_EN } from './serifen';
import timing from './timing.json';

const FPS = 24;
const FILM = timing.frames;                 // 37컷 + 끝 로고(1470장 · 61.25초)
export const CARD = 84;                     // 끝 화면이 필름 뒤로 더 서 있는 장 수(3.5초 — 영어판.py CARD와 같다) — 로고가 앉은 뒤 2.5초 넘게
export const P10EN_FRAMES = FILM + CARD;    // 영어판.py가 렌더 뒤 장 수를 대조한다
const CARD_ON = (FILM - 4) / FPS;           // 끝 화면 문구가 뜨기 시작하는 초(61.08) — 도담 로고가 거의 빠진 자리
const WARM = '#EFE7DA';
const lin = (x: number) => x;
type Line = { a: number; b: number; s: string };
const LINES = timing.lines as Line[];
// 끝 마침표 · 쉼표를 빼고 아포스트로피를 굽은 꼴(’)로 — 끝 화면 글과 같게(11-17 마감 관문 F41)
const noDot = (s: string) => s.replace(/[.,]+$/, '').replace(/'/g, '’');

const Caption: React.FC<{ c: Line; t: number }> = ({ c, t }) => {
  const k = ramp(t, c.a, 0.5);
  const o = Math.min(k, 1 - ramp(t, c.b - 0.25, 0.25, lin));
  const s = noDot(c.s);
  const w = Math.max(900, s.length * 50 * 0.5 * 2.2);   // 타원 폭 — 라틴 한 자 약 0.5em × 2.2
  return (
    <>
      <div style={{ position: 'absolute', left: 960 - w / 2, width: w, top: 826, height: 270, opacity: o,
        background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.30) 25%, rgba(0,0,0,0.17) 50%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 912, display: 'flex', justifyContent: 'center', opacity: o }}>
        <div style={{ fontFamily: SERIF_EN, fontWeight: 500, fontSize: 50, lineHeight: 1, letterSpacing: '0.005em', color: WARM,
          // 11-17 마감 관문 F3 · F43 — 밝은 바닥(2 · 13 · 17 · 23번)에서 흰 자막이 묻혀, 글자 둘레에 가는 그늘을 더하고 44 → 50px로 키웠다(미학 맹검 「폰에서 작다」)
          textShadow: '0 0 2px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.6), 0 2px 14px rgba(0,0,0,0.55)',
          transform: `translateY(${(1 - k) * 10}px)`, filter: `blur(${(1 - k) * 6}px)`, whiteSpace: 'pre' }}>
          {s}
        </div>
      </div>
    </>
  );
};

const CREAM = '#F2ECE2';

// 한 요소의 들어옴 — 0.4초 동안 12px 올라오며(빠르게 나와 천천히 멎음, 후반 가이드 3절)
const rise = (t: number, a: number) => {
  const k = ramp(t, a, 0.4);
  return { opacity: k, transform: `translateY(${(1 - k) * 12}px)` };
};

const EndCard: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 180, display: 'flex', flexDirection: 'column', alignItems: 'center',
    textShadow: '0 1px 8px rgba(0,0,0,0.35)', ...rise(t, CARD_ON) }}>
    <Img src={staticFile('p10en/SYNK-PULSE-Paper-trim.png')} style={{ width: 700, height: 'auto' }} />
    {/* 문구: 「is AI」는 투박하고(GPT) 「an AI model」은 「학습된 AI 모델」로 먼저 읽힌다(Fable · GPT) — 11-18 「AI-generated」. cv08 — 대문자 I에 가로획을 붙여 「AI」가 「Al」로 읽히지 않게(카본) */}
    <div style={{ marginTop: 60, fontFamily: EN, fontWeight: 600, fontSize: 56, lineHeight: 1, color: CREAM, whiteSpace: 'pre', fontFeatureSettings: '"cv08" 1' }}>Every person in this film is AI-generated</div>
    <div style={{ marginTop: 26, fontFamily: EN, fontWeight: 500, fontSize: 44, lineHeight: 1, color: CREAM, opacity: 0.9, whiteSpace: 'pre' }}>synk.im/en/pulse</div>
  </div>
);

export const P10en: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const c = LINES.find((l) => t >= l.a && t < l.b);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('p10en/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      {c && <Caption c={c} t={t} />}
      {t >= CARD_ON && <EndCard t={t} />}
      <Audio src={staticFile('p10en/sound.wav')} />
    </AbsoluteFill>
  );
};
