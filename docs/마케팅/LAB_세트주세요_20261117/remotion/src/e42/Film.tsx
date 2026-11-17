// LAB 영어 E42 「세트 주세요」(11-17 07시 회차) — 고정 카메라 한 방(판/_판짜기.py가 1080×1920으로 짠 판), 칸마다 계산대 위 음식과 두 인물만 바뀐다.
// 화면 글: 위 빈 벽 자리(110~470)에 머리 글 · 배울 말 카드, 말은 말하는 이의 머리 위 말풍선(한국어 + 읽는 법 + 영어 뜻).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { Body, CELLS, FPS, HOP, Loc, LOCS, NOD, SFX, SHAKE, T, TOTAL, VO } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2A2230';
const WARM = '#E2562A';
const PAPER = '#FFF8EE';
const GREY = '#6B6272';
const GOOD = '#1F8A4C';
const BAD = '#C2372F';

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

// 몸 한 덩이 — img 판의 body 자리를 둥글게 떠서 바닥 줄(baseY)을 기준으로 sx · sy만큼 누르거나 늘인다(E40 「전기장판」과 같은 셈)
const BodyLayer: React.FC<{ img: string; body: Body; sx: number; sy: number }> = ({ img, body, sx, sy }) => {
  const mask = `radial-gradient(ellipse ${body.rx}px ${body.ry}px at ${body.cx}px ${body.cy}px, #000 74%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ transformOrigin: `${body.cx}px ${body.baseY}px`, transform: `scale(${sx}, ${sy})`, WebkitMaskImage: mask, maskImage: mask }}>
      <Img src={staticFile(`img/${img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
    </AbsoluteFill>
  );
};

// 말풍선 — 말하는 이 머리 위, 꼬리가 그 머리를 가리킨다(tail = 꼬리 자리 비율)
const Bubble: React.FC<{ at: number; to: number; ko: string; rom?: string; mean: string; font: string; x: number; bottom: number; tail?: number; maxW?: number; koSize?: number }> = ({ at, to, ko, rom, mean, font, x, bottom, tail = 0.5, maxW = 560, koSize = 64 }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', left: x, top: bottom, transform: `translate(-${tail * 100}%, -100%) scale(${0.85 + 0.15 * p})`, transformOrigin: `${tail * 100}% 100%`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ position: 'relative', background: PAPER, borderRadius: 38, padding: '14px 30px 16px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', border: `5px solid ${INK}`, maxWidth: maxW }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.12, whiteSpace: 'pre' }}>{ko}</div>
        {rom ? <div style={{ fontFamily: font, fontWeight: 600, fontSize: 44, color: GREY, lineHeight: 1.15, marginTop: 2, whiteSpace: 'nowrap' }}>{rom}</div> : null}
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: 44, color: WARM, lineHeight: 1.15, marginTop: 2, whiteSpace: 'pre' }}>{mean}</div>
        <div style={{ position: 'absolute', left: `${tail * 100}%`, bottom: -26, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `26px solid ${INK}` }} />
      </div>
    </div>
  );
};

// 이름표 — 장면 속 물건 위에 붙는 꼬리표(한국어 · 읽는 법 · 영어)
const Tag: React.FC<{ at: number; x: number; y: number; ko: string; rom: string; mean: string; font: string; below?: boolean }> = ({ at, x, y, ko, rom, mean, font, below }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at)) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, ${below ? '0%' : '-100%'}) scale(${0.8 + 0.2 * p})`, transformOrigin: below ? '50% 0%' : '50% 100%', opacity: Math.min(1, p * 1.5), display: 'flex', flexDirection: below ? 'column-reverse' : 'column' }}>
      <div style={{ background: INK, color: PAPER, borderRadius: 26, padding: '10px 26px 12px', textAlign: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 84, lineHeight: 1.0 }}>{ko}</span>
        <span style={{ fontFamily: font, fontWeight: 600, fontSize: 40, color: '#CFC6D6', marginLeft: 14 }}>{rom}</span>
        <div style={{ fontFamily: font, fontWeight: 800, fontSize: 50, color: '#FFB27A', lineHeight: 1.1, marginTop: 2 }}>= {mean}</div>
      </div>
      <div style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '18px solid transparent', borderRight: '18px solid transparent', ...(below ? { borderBottom: `22px solid ${INK}` } : { borderTop: `22px solid ${INK}` }) }} />
    </div>
  );
};

const Card: React.FC<{ at: number; to?: number; top?: number; children: React.ReactNode }> = ({ at, to, top = 120, children }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || (to !== undefined && frame >= fr(to))) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', top, left: 70, width: 940, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `scale(${0.9 + 0.1 * p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: PAPER, border: `6px solid ${INK}`, borderRadius: 36, padding: '18px 40px 22px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.35)', maxWidth: 940 }}>{children}</div>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 24, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={MASTER * 0.35} endAt={fr(TOTAL)} />
    {VO.map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
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

export const Film: React.FC<{ loc: Loc; bare?: boolean }> = ({ loc, bare }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const L = LOCS[loc];
  const i = cellAt(t);
  const cell = CELLS[i];
  const next = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const range = cell.push || [1.02, 1.05];
  const push = interpolate(t, [cell.at, next], range, { ...clamp, easing: Easing.inOut(Easing.quad) });
  let dx = 0;
  let dy = 0;
  if (t >= SHAKE.at && t < SHAKE.at + SHAKE.dur) {
    const k = 1 - (t - SHAKE.at) / SHAKE.dur;
    dx = (random(`sx-${frame}`) - 0.5) * 2 * SHAKE.px * k;
    dy = (random(`sy-${frame}`) - 0.5) * 2 * SHAKE.px * k;
  }
  // 끄덕 — 눌렀다(0.9) 튕겨(1.05) 제자리
  let nod: React.ReactNode = null;
  if (t >= NOD.at && t < NOD.at + NOD.dur && cell.img === NOD.img) {
    const sy = interpolate(t, [NOD.at, NOD.at + 0.12, NOD.at + 0.26, NOD.at + NOD.dur], [1, 0.88, 1.05, 1], clamp);
    nod = <BodyLayer img={NOD.img} body={NOD.body} sx={1 + (1 - sy) * 0.4} sy={sy} />;
  }
  if (t >= HOP.at && t < HOP.at + HOP.dur && cell.img === HOP.img) {
    const sy = interpolate(t, [HOP.at, HOP.at + 0.1, HOP.at + 0.25, HOP.at + HOP.dur], [1, 0.9, 1.08, 1], clamp);
    nod = <BodyLayer img={HOP.img} body={HOP.body} sx={1 + (1 - sy) * 0.4} sy={sy} />;
  }
  const flash = interpolate(t, [SHAKE.at, SHAKE.at + 0.05, SHAKE.at + 0.25], [0, 0.35, 0], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: '#f3e4cf', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: cell.origin || '50% 60%', transform: `translate(${dx}px, ${dy}px) scale(${push})` }}>
        <Img src={staticFile(`img/${cell.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
        {nod}
      </AbsoluteFill>
      {flash > 0 ? <AbsoluteFill style={{ background: '#fff', opacity: flash }} /> : null}
      {/* 머리 글 — 원본처럼 위에 고정(끝 카드가 나오기 전까지) */}
      {!bare && t < T.headTo ? (
        <Card at={0} top={290}>
          <div style={{ fontFamily: L.font, fontWeight: 900, fontSize: 84, color: INK, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{L.headBig}</div>
          {L.headSub ? <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: 52, color: WARM, lineHeight: 1.15, marginTop: 6 }}>{L.headSub}</div> : null}
        </Card>
      ) : null}
      {/* 말 — 몽글(왼쪽) · 점원(오른쪽) */}
      <Bubble at={T.m1} to={T.m1To} ko="버거 주세요!" rom="beo-geo ju-se-yo" mean={L.m1} font={L.font} x={250} bottom={1040} tail={0.3} />
      <Bubble at={T.b1} to={T.b1To} ko="네~" rom="ne~" mean={L.b1} font={L.font} x={760} bottom={820} tail={0.5} />
      <Bubble at={T.m2} to={T.m2To} ko="콜라 주세요!" rom="kol-la ju-se-yo" mean={L.m2} font={L.font} x={230} bottom={950} tail={0.3} />
      {/* 점원 「네!」(4.2초)는 말풍선 없이 소리만 — 0.46초라 읽을 틈이 없고, 원본 박자 사이에 박자를 하나 더 만든다(나란히 「박자」) */}
      <Bubble at={T.m3} to={T.m3To} ko={'아이스크림\n주세요!'} rom="a-i-seu-keu-rim" mean={L.m3} font={L.font} x={250} bottom={1040} tail={0.3} maxW={620} />
      <Bubble at={T.m4} to={T.m4To} ko={L.m4ko} mean={L.m4} font={L.font} x={250} bottom={1020} tail={0.3} koSize={92} maxW={640} />
      <Bubble at={T.b3} to={T.b3To} ko="버거 셋이요?" rom="셋 (set) = three 🤚" mean={L.b3} font={L.font} x={740} bottom={790} tail={0.64} koSize={76} />
      <Bubble at={T.m6} to={T.m6To} ko="네!" rom="ne!" mean={L.m6} font={L.font} x={250} bottom={1040} tail={0.3} koSize={80} />
      <Bubble at={T.b4} to={T.b4To} ko={'버거 셋,\n나왔습니다!'} mean={L.b4} font={L.font} x={760} bottom={790} tail={0.77} maxW={640} />
      {/* 끝 이름표 — 버거 셋 위 「셋 = 3」, 위 빈 벽에 「세트 = combo」(올리기 전 검사 v9 「아래 앱 글자 자리」로 쟁반 밑에서 올림)(이해 시험 v2 「가운데 카드의 ❌가 헷갈린다 · 지난 편과 같은 뜻 풀이 카드」 — 교훈 P12대로 0.7초 간격) */}
      {!bare ? <Tag at={T.tag1} x={330} y={1010} ko="셋" rom="set" mean={L.tag1} font={L.font} /> : null}
      {!bare ? <Tag at={T.tag2} x={640} y={830} ko="세트" rom="se-teu" mean={L.tag2} font={L.font} /> : null}
      <Bubble at={T.m5} to={T.m5To} ko={'세… 세트…\n주세요…'} rom="se-teu ju-se-yo" mean={L.m5} font={L.font} x={250} bottom={1030} tail={0.3} maxW={600} />
      <Bubble at={T.b5} to={TOTAL + 1} ko="아~ 세트! 네~!" rom="a~ se-teu! ne~!" mean={L.b5} font={L.font} x={560} bottom={560} tail={0.6} maxW={640} />
      <Sound />
    </AbsoluteFill>
  );
};
