// 10번 도담중공업 영어 판(2026-11-17, Claude) — PULSE 영어 시험 첫 편(유호님 11-17 「권고대로」, 결정 표 11-17).
//   PULSE_영어시험_20261117/01_도담중공업_영어/영어판.py가 화면(p10en/picture.mp4 — 한국어 판 1~36컷 그대로 + 영문으로 그린 끝 로고 37컷 + 위아래 60px 띠) ·
//   소리(p10en/sound.wav — 영어 내레이션을 한국어 판과 같은 자리에)를 넣고 이 판을 굽는다. 시각은 최종소리.py가 쓴 timing.json(받아쓰기 낱말 시각)이다.
// 자막: 한국어 판(P10.tsx)의 결 그대로 — 그림 안 아래 명조 44px 한 줄, 마침표 · 쉼표 없음, 흐림이 풀리며 10px 올라옴, 글자 뒤 넓고 옅은 타원.
//   영어 판에는 아래 영문 작은 줄이 없다(말과 자막이 같은 말이다). 명조는 Noto Serif KR의 라틴 글자만 잘라 쓴다(serifen.ts).
// 끝(11-17 고친 판): 도담 로고가 빠지는 60.67~61.17초에 화면은 검정이 아니라 마지막 장면(노을 아래 도시 불)이 45% 밝기로 남고(영어판.py frames37),
//   그 하늘 위에 SYNK PULSE 끝 화면이 뜬다 — 명조 두 줄 한 덩이 → 로고 → 주소 차례로, 0.4초 동안 12px 올라오며(후반 가이드 3절 「글자는 박에 맞춰 차례로」).
//   로고는 승인 파일(브랜드킷/배치용/SYNK-PULSE-Paper.png)을 비례 그대로, 펠트 결이 뭉개져 보이지 않게 680px로 키웠다. 로고가 올라오는 61.68초에 곡의 마지막 화음 메아리가 놓인다.
//   첫 판(검정 판 위 넉 줄 — 명조 · 작은 대문자 소제목 · 로고 · 주소)은 미학 맹검(카본) 기각 4점이었다: 「검정 판 위 서체 결이 다른 넉 줄, 소제목은 폰에서 안 읽힘,
//   정지 그림처럼 멈춤, PULSE 펠트가 작아 뿌옇다」. 그래서 소제목을 빼고 「가상 브랜드」를 둘째 문장으로 넣어 글을 한 서체 한 덩이로 줄였다.
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
  const shade = '0 2px 14px rgba(0,0,0,0.55)';
  return (
    <AbsoluteFill>
      {/* 하늘 쪽(지평선은 화면 위에서 약 660px) — 글 덩이는 위, 로고 · 주소는 그 아래, 모두 도시 불 위의 하늘 안 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 236, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: SERIF_EN, fontWeight: 500, fontSize: 54, lineHeight: 1.3, color: WARM, textAlign: 'center', whiteSpace: 'pre',
          textShadow: shade, ...rise(t, a) }}>
          {'Every person in this film is AI\nDodam Heavy Industries doesn’t exist'}
        </div>
        <Img src={staticFile('p10en/SYNK-PULSE-Paper.png')}
          style={{ marginTop: 64, width: 680, height: 'auto', filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.45))', ...rise(t, a + 0.6) }} />
        <div style={{ marginTop: 26, fontFamily: EN, fontWeight: 500, fontSize: 30, lineHeight: 1, letterSpacing: '0.04em', color: WARM, whiteSpace: 'pre',
          textShadow: shade, ...rise(t, a + 0.75), opacity: 0.92 * ramp(t, a + 0.75, 0.4) }}>
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
      <OffthreadVideo src={staticFile('p10en/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      {c && <Caption c={c} t={t} />}
      {t >= CARD_ON && <EndCard t={t} />}
      <Audio src={staticFile('p10en/sound.wav')} />
    </AbsoluteFill>
  );
};
