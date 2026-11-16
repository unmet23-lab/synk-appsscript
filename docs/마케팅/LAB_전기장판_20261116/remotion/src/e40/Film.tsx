// LAB 영어 E40 「전기장판」(11-16 15시 회차) — 고정 카메라 한 방(판/_판짜기.py가 1080×1920으로 짠 판), 칸마다 몽글 · 담요 · 빛만 바뀐다.
// 화면 글: 위 어두운 벽 자리(285~760)에 큰 글 · 배울 말 카드, 몽글 말은 몽글 머리 위 말풍선(한국어 + 영어 뜻).
// 움직임은 정지 판을 바꾸는 것만이 아니다 — 몸 자리를 둥근 가림으로 떠서 바닥 줄을 기준으로 눌러 펴거나(녹음) 늘이거나(일어나려다 늘어남) 부풀린다(숨).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { BREATHE, Body, BUZZ, CELLS, FPS, Loc, LOCS, MELTS, SFX, SHIVER, STRETCH_BODY, T, THUD, TOTAL, TRIES, VO } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2A2230';
const WARM = '#F0702A';
const PAPER = '#FFF8EE';
const GREY = '#6B6272';

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

// 몸 한 덩이 — img 판의 body 자리를 둥글게 떠서 바닥 줄(baseY)을 기준으로 sx · sy만큼 늘이거나 누른다
const BodyLayer: React.FC<{ img: string; body: Body; sx: number; sy: number; opacity?: number; edge?: number; dx?: number; filter?: string }> = ({ img, body, sx, sy, opacity = 1, edge = 72, dx = 0, filter }) => {
  const mask = `radial-gradient(ellipse ${body.rx}px ${body.ry}px at ${body.cx}px ${body.cy}px, #000 ${edge}%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ transformOrigin: `${body.cx}px ${body.baseY}px`, transform: `translateX(${dx}px) scale(${sx}, ${sy})`, opacity, WebkitMaskImage: mask, maskImage: mask }}>
      <Img src={staticFile(`img/${img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, filter }} />
    </AbsoluteFill>
  );
};

// 몽글 말풍선 — 머리 위, 꼬리가 몽글을 가리킨다
const Bubble: React.FC<{ at: number; to: number; ko: string; mean: string; font: string; x: number; bottom: number; tail?: 'l' | 'c' | 'r' }> = ({ at, to, ko, mean, font, x, bottom, tail = 'c' }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  const tailLeft = tail === 'l' ? '22%' : tail === 'r' ? '78%' : '50%';
  return (
    <div style={{ position: 'absolute', left: x, top: bottom, transform: `translate(-50%, -100%) scale(${0.85 + 0.15 * p})`, transformOrigin: `${tailLeft} 100%`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ position: 'relative', background: PAPER, borderRadius: 40, padding: '16px 34px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.45)', border: `5px solid ${INK}` }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 66, color: INK, lineHeight: 1.12, whiteSpace: 'nowrap' }}>{ko}</div>
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: 46, color: WARM, lineHeight: 1.15, marginTop: 2, whiteSpace: 'nowrap' }}>{mean}</div>
        <div style={{ position: 'absolute', left: tailLeft, bottom: -26, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `26px solid ${INK}` }} />
      </div>
    </div>
  );
};

const Card: React.FC<{ at: number; to?: number; top?: number; children: React.ReactNode; glow?: boolean }> = ({ at, to, top = 300, children, glow }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || (to !== undefined && frame >= fr(to))) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', top, left: 70, width: 850, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `scale(${0.9 + 0.1 * p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: PAPER, border: `6px solid ${INK}`, borderRadius: 36, padding: '18px 44px 22px', textAlign: 'center', boxShadow: glow ? '0 0 46px rgba(255,140,50,0.75), 0 10px 26px rgba(0,0,0,0.4)' : '0 10px 26px rgba(0,0,0,0.4)', maxWidth: 850 }}>{children}</div>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.22 * MASTER * interpolate(i, [fr(TOTAL) - 24, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/wind.wav')} volume={(i) => MASTER * interpolate(i, [0, fr(3.3), fr(4.3), fr(12.4), fr(12.9), fr(17.4), fr(17.8)], [0.5, 0.5, 0.22, 0.22, 0.4, 0.4, 0.2], clamp)} endAt={fr(TOTAL)} />
    {VO.map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ loc: Loc; bare?: boolean }> = ({ loc, bare }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const L = LOCS[loc];
  const i = cellAt(t);
  const cell = CELLS[i];
  const next = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  // 판마다 천천히 밀어 들어감(4% → 8%), 가까이 칸은 그 배율을 곱하고, 끝 인사 자리(T.zoomCut)에서 한 번에 당겨 들어감
  const range = cell.push || [1.04, 1.08];
  let push = interpolate(t, [cell.at, next], range, clamp) * (cell.zoom || 1);
  if (t >= T.zoomCut) push += 0.12;
  push += THUD.amp * interpolate(t, [THUD.at, THUD.at + 0.03, THUD.at + 0.35], [0, 1, 0], clamp);
  const origin = cell.origin || '52% 62%';
  // 알람이 울릴 때 화면이 짧게 떤다
  let dx = 0;
  const dy = 0;
  BUZZ.forEach((b) => {
    if (t >= b && t < b + 0.45) dx = (frame % 2 ? 1 : -1) * 5;
  });
  // 켜는 순간 따뜻한 빛이 번진다
  const glowOn = interpolate(t, [3.3, 3.45, 4.3], [0, 0.4, 0], clamp);
  // 녹아내림(처음엔 천천히 풀리다 뒤로 갈수록 빨리)
  const melt = MELTS.find((m) => t >= m.from && t < m.from + m.dur) || null;
  let meltLayer: React.ReactNode = null;
  if (melt) {
    const u = (t - melt.from) / melt.dur;
    const e = Math.pow(u, 1.7);
    meltLayer = <BodyLayer img={melt.top} body={melt.body} sx={1 + 0.55 * e} sy={1 - 0.62 * e} opacity={interpolate(u, [0, 0.65, 1], [1, 0.9, 0], clamp)} filter={cell.filter} />;
  }
  // 떨림 — 처음 2.4초 담요 쓴 몽글의 몸이 잘게 떤다
  let shiver: React.ReactNode = null;
  if (t >= SHIVER.from && t < SHIVER.to && cell.img === SHIVER.img) {
    shiver = <BodyLayer img={SHIVER.img} body={SHIVER.body} sx={1} sy={1 + 0.012 * Math.sin(frame * 2.1)} dx={(random(`sh-${frame}`) - 0.5) * 2 * SHIVER.px} edge={78} />;
  }
  // 숨 — 녹은 몽글의 머리가 천천히 부풀었다 가라앉는다
  let breathe: React.ReactNode = null;
  if (t >= BREATHE.from && t < BREATHE.to && cell.img === BREATHE.img) {
    const s = 1 + BREATHE.amp * (0.5 - 0.5 * Math.cos(((t - BREATHE.from) / BREATHE.period) * 2 * Math.PI));
    breathe = <BodyLayer img={BREATHE.img} body={BREATHE.body} sx={1 + (s - 1) * 0.3} sy={s} edge={70} />;
  }
  // 늘어남 — 일어나려다 치즈처럼 늘어나 장판에 붙은 채 버티고 철퍽 내려앉는다(세 번)
  let stretch: React.ReactNode = null;
  const tr = TRIES.find((x) => t >= x.from && t < x.to);
  if (tr) {
    const up = interpolate(t, [tr.from, tr.peak], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
    const hold = t > tr.peak ? 0.05 * Math.sin((t - tr.peak) * 11) : 0;
    const drop = interpolate(t, [tr.snap, tr.to], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
    const sy = 1 + ((tr.max - 1) * up + hold) * drop;
    const shake = t > tr.peak && t < tr.snap ? (random(`st-${frame}`) - 0.5) * 6 : 0;
    stretch = <BodyLayer img="b5.jpg" body={STRETCH_BODY} sx={1 - 0.08 * up * drop} sy={sy} edge={80} dx={shake} filter={cell.filter} />;
  }
  // 아침 창빛 — 창 자리를 밝게(아침인 줄 알게)
  const daylight = cell.filter ? 0.55 : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#11131c', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: origin, transform: `translate(${dx}px, ${dy}px) scale(${push})` }}>
        <Img src={staticFile(`img/${cell.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, filter: cell.filter }} />
        {shiver}
        {breathe}
        {stretch}
        {meltLayer}
      </AbsoluteFill>
      {daylight > 0 ? <AbsoluteFill style={{ background: 'radial-gradient(ellipse 330px 220px at 88% 36%, rgba(255,250,235,1), rgba(255,250,235,0) 75%)', opacity: daylight, mixBlendMode: 'screen' }} /> : null}
      {glowOn > 0 ? <AbsoluteFill style={{ background: 'radial-gradient(ellipse 700px 520px at 52% 75%, rgba(255,150,60,1), rgba(255,150,60,0) 70%)', opacity: glowOn, mixBlendMode: 'screen' }} /> : null}
      {bare ? null : (
        <>
          {/* 훅 — 큰 온도 한 줄과 작은 줄(정보 정리 꼴 — 지난 편들의 영어 두 줄 머리 글과 다르게) */}
          {t < T.hookTo ? (
            <div style={{ position: 'absolute', top: 290, left: 70, width: 900 }}>
              <div style={{ fontFamily: L.font, fontWeight: 900, fontSize: 176, color: '#DDEEFF', textShadow: '0 0 30px rgba(120,180,255,0.6), 0 6px 20px rgba(0,0,0,0.95)', lineHeight: 1.0, letterSpacing: '-0.03em' }}>{L.hookBig}</div>
              <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 62, color: '#fff', textShadow: '0 4px 16px rgba(0,0,0,0.95)', lineHeight: 1.15, marginTop: 6 }}>{L.hookSub}</div>
            </div>
          ) : null}
          <Bubble at={T.cold} to={T.coldTo} ko="추, 추워…" mean={L.coldMean} font={L.font} x={560} bottom={810} />
          <Bubble at={T.warm} to={T.warmTo} ko="아~ 따뜻해~" mean={L.warmMean} font={L.font} x={560} bottom={890} />
          <Bubble at={T.melt} to={T.meltTo} ko="녹는다~" mean={L.meltMean} font={L.font} x={300} bottom={1060} tail="r" />
          {/* 배울 말 — 전기장판(장판 쪼개기 풀이는 v3에서 게시글로 — 화면은 한 낱말만) */}
          <Card at={T.word} to={T.wordTo} glow>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 136, color: INK, lineHeight: 1.05 }}>전기장판</div>
            <div style={{ fontFamily: L.font, fontWeight: 600, fontSize: 48, color: GREY, lineHeight: 1.2, marginTop: 2 }}>jeon-gi-jang-pan</div>
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 58, color: WARM, lineHeight: 1.15, marginTop: 4 }}>{L.wordMean}</div>
          </Card>
          {/* 다음 날 아침 */}
          {t >= T.morning && t < T.morningTo ? (
            <div style={{ position: 'absolute', top: 300, left: 96, fontFamily: L.font, fontWeight: 800, fontSize: 66, color: '#fff', textShadow: '0 4px 16px rgba(0,0,0,0.9)', opacity: pop(frame, T.morning) }}>{L.morning}</div>
          ) : null}
          <Bubble at={T.getUp} to={T.getUpTo} ko="일어나야지…" mean={L.getUpMean} font={L.font} x={560} bottom={1130} />
          {/* 둘째 시도 — 가장 높이 늘어난 머리 위 말풍선 */}
          <Bubble at={T.stuck} to={T.stuckTo} ko="못 일어나…!" mean={L.stuck} font={L.font} x={560} bottom={820} />
          {/* 끝 3초 — 다시 녹은 몽글 위 큰 전기장판, 끝 질문 */}
          {t >= T.end ? (
            <div style={{ position: 'absolute', top: 290, left: 60, width: 960, textAlign: 'center', opacity: pop(frame, T.end + 0.15) }}>
              <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 150, color: '#FFE2C2', textShadow: '0 0 36px rgba(255,130,40,0.85), 0 6px 20px rgba(0,0,0,0.9)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>전기장판</div>
              <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: 48, color: '#fff', textShadow: '0 3px 12px rgba(0,0,0,0.9)', marginTop: 6, lineHeight: 1.2 }}>jeon-gi-jang-pan</div>
              <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 52, color: '#FFB27A', textShadow: '0 3px 12px rgba(0,0,0,0.9)', lineHeight: 1.2 }}>{L.wordMean}</div>
            </div>
          ) : null}
          <Bubble at={T.giveUp} to={TOTAL + 1} ko="포기…" mean={L.giveUpMean} font={L.font} x={560} bottom={1170} />
          <Card at={T.ask} top={630}>
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 54, color: INK, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{L.ask}</div>
          </Card>
        </>
      )}
      <Sound />
    </AbsoluteFill>
  );
};
