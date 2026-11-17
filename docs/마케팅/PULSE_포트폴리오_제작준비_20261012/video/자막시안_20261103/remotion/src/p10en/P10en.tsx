// 10번 도담중공업 영어 판(2026-11-17, Claude) — PULSE 영어 시험 첫 편(유호님 11-17 「권고대로」, 결정 표 11-17).
//   PULSE_영어시험_20261117/01_도담중공업_영어/영어판.py가 화면(p10en/picture.mp4 — 한국어 판 1~36컷 그대로 + 영문으로 그린 끝 로고 37컷 + 위아래 60px 띠) ·
//   소리(p10en/sound.wav — 영어 내레이션을 한국어 판과 같은 자리에)를 넣고 이 판을 굽는다. 시각은 최종소리.py가 쓴 timing.json(받아쓰기 낱말 시각)이다.
// 자막: 한국어 판(P10.tsx)의 결 그대로 — 그림 안 아래 명조 44px 한 줄, 마침표 · 쉼표 없음, 흐림이 풀리며 10px 올라옴, 글자 뒤 넓고 옅은 타원.
//   영어 판에는 아래 영문 작은 줄이 없다(말과 자막이 같은 말이다). 명조는 Noto Serif KR의 라틴 글자만 잘라 쓴다(serifen.ts).
// 끝(11-18 다섯째 판): 도담 로고가 60.67~61.17초에 빠지는 동안 마지막 장면(노을 아래 도시 불)의 하늘만 가라앉고(영어판.py frames37 — 위 30% → 700px에서 80%),
//   61.08초부터 그 하늘 가운데(y 360)에 제작사 서명 한 묶음이 0.4초 동안 12px 올라온다 — 왼쪽 SYNK PULSE 로고(600px) · 가는 세로줄 · 오른쪽 고지(Inter Tight 600 40px)와 주소(500 30px).
//   로고는 승인 파일(브랜드킷/배치용/SYNK-PULSE-Paper.png)의 투명 여백만 잘라 비례 그대로 쓴다(영어판.py가 p10en/SYNK-PULSE-Paper-trim.png로 만든다). 61.08초에 곡의 마지막 화음 메아리가 놓인다.
//   앞 판(검정 판 · 장면을 45%로 누른 판 · 노을 위에 큰 로고와 명조 글)은 미학 맹검에서 4 · 3 · 4점으로 기각됐다. 카본이 막힌 11-18 새벽 GPT 맹검에 9점 기준을 묻고
//   시안을 견줬다 — 승인 갈색 단색 판(8 → 영상 낱장 7)은 후반 가이드 「마지막 장면 안에서 끝낸다 · 납작한 판으로 덮지 않는다」(유호님 11-04)에 걸려,
//   같은 묶음을 장면 하늘에 둔 판(8점, 쌍 비교에서 단색 판을 이김)으로 정했다. 기록: 01_도담중공업_영어/검수/끝화면_GPT기준_20261118. 「가상 브랜드」 고지는 게시 글에 둔다.
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
const RULE = 'rgba(242,236,226,0.55)';

// 한 요소의 들어옴 — 0.4초 동안 12px 올라오며(빠르게 나와 천천히 멎음, 후반 가이드 3절)
const rise = (t: number, a: number) => {
  const k = ramp(t, a, 0.4);
  return { opacity: k, transform: `translateY(${(1 - k) * 12}px)` };
};

const EndCard: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 360 - 100, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', ...rise(t, CARD_ON) }}>
    <Img src={staticFile('p10en/SYNK-PULSE-Paper-trim.png')} style={{ width: 600, height: 'auto' }} />
    <div style={{ width: 1, height: 128, background: RULE, margin: '0 88px' }} />
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}>
      <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 40, lineHeight: 1, color: CREAM, whiteSpace: 'pre' }}>Every person in this film is AI</div>
      {/* 주소는 고지보다 한 단 낮추되 풍경에 묻히지 않게 크림 88%(맹검 3 「주소가 묻힌다」) */}
      <div style={{ marginTop: 16, fontFamily: EN, fontWeight: 500, fontSize: 30, lineHeight: 1, color: CREAM, opacity: 0.88, whiteSpace: 'pre' }}>synk.im/en/pulse</div>
    </div>
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
