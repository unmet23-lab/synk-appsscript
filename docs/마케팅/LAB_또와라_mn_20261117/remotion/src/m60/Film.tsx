// LAB 몽골 M60 「-어라 · 또 와라」(11-17 07시 회차) — 판 일곱 장(판/_판짜기.py가 1080×1920으로 짠 판), 칸마다 밀어 들어가는 고정 카메라.
// 화면 글: 말은 말하는 이의 머리 위 말풍선(한글 + 키릴 읽기 + 몽골 뜻 세 줄), 위 빈 벽 자리에 「-어라」 카드와 「돌아가는 날」 한 줄.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CELLS, FPS, MN, SFX, SHAKES, T, TOTAL, VO } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2A2230';
const WARM = '#D2452A';
const PAPER = '#FFF8EE';
const GREY = '#5E5566';

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

type Line = { ko: string; cyr: string; mn: string };
// 말풍선 — 말하는 이 머리 위, 꼬리가 그 머리를 가리킨다(tail = 꼬리 자리 비율)
const Bubble: React.FC<{ at: number; to: number; line: Line; x: number; bottom: number; tail?: number; koSize?: number; soft?: boolean }> = ({ at, to, line, x, bottom, tail = 0.5, koSize = 92, soft }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', left: x, top: bottom, transform: `translate(-${tail * 100}%, -100%) scale(${0.85 + 0.15 * p})`, transformOrigin: `${tail * 100}% 100%`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ position: 'relative', background: PAPER, borderRadius: soft ? 46 : 34, padding: '16px 34px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', border: `5px solid ${INK}` }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: koSize, color: INK, lineHeight: 1.08, whiteSpace: 'nowrap' }}>{line.ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 46, color: GREY, lineHeight: 1.15, marginTop: 4, whiteSpace: 'nowrap' }}>{line.cyr}</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, color: WARM, lineHeight: 1.15, marginTop: 2, whiteSpace: 'nowrap' }}>{line.mn}</div>
        <div style={{ position: 'absolute', left: `${tail * 100}%`, bottom: -26, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `26px solid ${INK}` }} />
      </div>
    </div>
  );
};

// 이름표 — 「-어라 · -아라 = -аарай」와 이 편의 다섯 말(검은 바탕 · 꼬리가 말하는 할머니를 가리킨다)
const Label: React.FC<{ at: number; to: number; x: number; bottom: number; tail?: number }> = ({ at, to, x, bottom, tail = 0.5 }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', left: x, top: bottom, transform: `translate(-${tail * 100}%, -100%) scale(${0.85 + 0.15 * p})`, transformOrigin: `${tail * 100}% 100%`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ position: 'relative', background: INK, borderRadius: 30, padding: '16px 36px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.4)' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 92, color: PAPER, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{MN.cardBig}</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 70, color: '#FFB27A', lineHeight: 1.1, marginTop: 4, whiteSpace: 'nowrap' }}>= -аарай</div>
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 46, color: '#D9D0E0', lineHeight: 1.2, marginTop: 8, whiteSpace: 'nowrap' }}>{MN.cardEx}</div>
        <div style={{ position: 'absolute', left: `${tail * 100}%`, bottom: -24, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `26px solid ${INK}` }} />
      </div>
    </div>
  );
};

const Card: React.FC<{ at: number; to: number; top?: number; children: React.ReactNode }> = ({ at, to, top = 150, children }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', top, left: 60, width: 960, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `scale(${0.9 + 0.1 * p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: PAPER, border: `6px solid ${INK}`, borderRadius: 36, padding: '20px 44px 24px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>{children}</div>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm_day.wav')} volume={(i) => 0.22 * MASTER * interpolate(i, [fr(8.9), fr(9.4)], [1, 0], clamp)} endAt={fr(9.5)} />
    <Sequence from={fr(9.3)} layout="none">
      <Audio src={staticFile('bgm_dusk.wav')} volume={(i) => 0.26 * MASTER * interpolate(i, [0, 8, fr(TOTAL - 9.3) - 24, fr(TOTAL - 9.3)], [0, 1, 1, 0], clamp)} />
    </Sequence>
    <Audio src={staticFile('sfx/room.wav')} volume={MASTER * 0.3} endAt={fr(9.3)} />
    <Sequence from={fr(9.3)} layout="none">
      <Audio src={staticFile('sfx/hall.wav')} volume={MASTER * 0.3} />
    </Sequence>
    {VO.map(([t, v]) => (
      <Sequence key={`${t}-${v}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ bare?: boolean }> = ({ bare }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = cellAt(t);
  const cell = CELLS[i];
  const next = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const range = cell.push || [1.0, 1.04];
  const push = interpolate(t, [cell.at, next], range, { ...clamp, easing: Easing.inOut(Easing.quad) });
  const panX = cell.pan ? interpolate(t, [cell.at, next], cell.pan, { ...clamp, easing: Easing.inOut(Easing.sin) }) : 0;
  let dx = 0;
  let dy = 0;
  for (const s of SHAKES) {
    if (t >= s.at && t < s.at + s.dur) {
      const k = 1 - (t - s.at) / s.dur;
      dx = (random(`sx-${frame}`) - 0.5) * 2 * s.px * k;
      dy = (random(`sy-${frame}`) - 0.5) * 2 * s.px * k;
    }
  }
  return (
    <AbsoluteFill style={{ backgroundColor: '#efe2d0', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: cell.origin || '50% 60%', transform: `translate(${dx + panX}px, ${dy}px) scale(${push})` }}>
        <Img src={staticFile(`img/${cell.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
      </AbsoluteFill>
      {/* 하숙집 잔소리 셋 — 할머니 머리 위 */}
      <Bubble at={T.h1} to={T.h1To} line={MN.h1} x={800} bottom={830} tail={0.6} />
      <Bubble at={T.h2} to={T.h2To} line={MN.h2} x={780} bottom={820} tail={0.6} />
      <Bubble at={T.h3} to={T.h3To} line={MN.h3} x={720} bottom={800} tail={0.62} />
      {/* 「-어라」 이름표(원본 7.7초 팻말 자리) — 장면을 덮지 않고 할머니 머리 위에 단다(이해 시험 v2 「카드가 이야기를 끊음」 · haiku 「지난 편 뜻 카드와 같은 순서」, GPT 두 번 「가라 · 와라와 어떻게 이어지나」) */}
      {!bare ? <Label at={T.card} to={T.cardTo} x={560} bottom={780} tail={0.72} /> : null}
      {/* 공항 — 돌아가는 날 한 줄 */}
      {!bare ? (
        <Card at={T.cap} to={T.capTo} top={290}>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 66, color: INK, lineHeight: 1.15, whiteSpace: 'pre' }}>{MN.cap}</div>
        </Card>
      ) : null}
      <Bubble at={T.h4} to={T.h4To} line={MN.h4} x={300} bottom={560} tail={0.35} koSize={110} />
      <Bubble at={T.h5} to={T.h5To} line={MN.h5} x={330} bottom={760} tail={0.3} koSize={100} />
      <Bubble at={T.h6} to={T.h6To} line={MN.h6} x={420} bottom={520} tail={0.3} soft />
      <Bubble at={T.m1} to={T.m1To} line={MN.m1} x={800} bottom={740} tail={0.5} soft />
      <Bubble at={T.h7} to={TOTAL + 1} line={MN.h3} x={380} bottom={700} tail={0.3} />
      <Sound />
    </AbsoluteFill>
  );
};
