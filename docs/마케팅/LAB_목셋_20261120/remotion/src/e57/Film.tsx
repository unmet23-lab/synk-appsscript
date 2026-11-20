// LAB 영어 E57 「목 · 손목 · 발목」(11-20 07시 회차) — 판(판/_판짜기.py가 1080×1920으로 짠 그림)을 칸마다 바꾸고, 칸 안에서는 천천히 다가가며
// 몸 한 덩이(친구 덜덜 · 몽글 움찔 · 빙글 · 통통)만 움직인다. 화면 글: 위 빈 하늘(280~560)에 머리 글 · 낱말 카드 · 끝 카드,
// 대사는 말하는 이 곁 말풍선, 올려다본 칸에는 목 · 손목 · 발목 이름표(끝 칸은 낱말 카드와 말풍선만 — 교훈 L09)(짧은 선 + 작은 점 — 동그라미 테 · 고리 무늬는 쓰지 않는다).
// 글자는 안전선(가로 65~920 · 세로 269~1428) 안에 둔다(올리기 전 검사 ⑤). 맞음 · 틀림이 없는 편이라 초록 · 빨강을 강조에 쓰지 않는다(제작 절차 「맞는 말 · 틀린 말」).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { Body, CELLS, FPS, GASP, HOP, Loc, LOCS, SFX, SHIVER, SPIN, T, Tag, TAGS_S5, TOTAL, VO } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2A2230';
const PAPER = '#FFF8EE';
const MUSTARD = '#E2A417';
const MEAN = '#2F4BA0'; // 뜻 줄 — 맞음 · 틀림이 아닌 강조라 초록 · 빨강을 피한다

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

// 몸 한 덩이 — img 판의 body 자리를 둥글게 떠서 바닥 줄(baseY)을 기준으로 움직인다(줄이면 밑판 윤곽이 드러나 키우기 · 기울이기만)
const BodyLayer: React.FC<{ img: string; body: Body; k: number; lift?: number; dx?: number; rot?: number }> = ({ img, body, k, lift = 0, dx = 0, rot = 0 }) => {
  const mask = `radial-gradient(ellipse ${body.rx}px ${body.ry}px at ${body.cx}px ${body.cy}px, #000 74%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ transformOrigin: `${body.cx}px ${body.baseY}px`, transform: `translate(${dx}px, ${-lift}px) rotate(${rot}deg) scale(${k}, ${k})`, WebkitMaskImage: mask, maskImage: mask }}>
      <Img src={staticFile(`img/${img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
    </AbsoluteFill>
  );
};

// 말풍선 — 말하는 이 곁, 꼬리가 그 사람을 가리킨다(x, y = 꼬리 끝). dir: down = 말풍선이 위, left = 말풍선이 왼쪽, right = 말풍선이 오른쪽
const Bubble: React.FC<{ at: number; to: number; ko: string; mean: string; font: string; x: number; y: number; tail?: number; dir?: 'down' | 'left' | 'right'; maxW?: number; koSize?: number; meanSize?: number; tailLen?: number }> = ({ at, to, ko, mean, font, x, y, tail = 0.5, dir = 'down', maxW = 620, koSize = 70, meanSize = 48, tailLen = 30 }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  const inner = (
    <>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.12, whiteSpace: 'pre' }}>{ko}</div>
      <div style={{ fontFamily: font, fontWeight: 700, fontSize: meanSize, color: MEAN, lineHeight: 1.15, marginTop: 2, whiteSpace: 'pre' }}>{mean}</div>
    </>
  );
  const box: React.CSSProperties = { position: 'relative', background: PAPER, borderRadius: 38, padding: '14px 30px 16px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.3)', border: `5px solid ${INK}`, maxWidth: maxW };
  if (dir === 'left' || dir === 'right') {
    const left = dir === 'left';
    return (
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${left ? '-100%' : '0%'}, -${tail * 100}%) scale(${0.85 + 0.15 * p})`, transformOrigin: `${left ? '100%' : '0%'} ${tail * 100}%`, opacity: Math.min(1, p * 1.5) }}>
        <div style={{ ...box, [left ? 'marginRight' : 'marginLeft']: tailLen }}>
          {inner}
          <div style={{ position: 'absolute', [left ? 'right' : 'left']: -tailLen, top: `${tail * 100}%`, width: 0, height: 0, transform: 'translateY(-50%)', borderTop: '18px solid transparent', borderBottom: '18px solid transparent', [left ? 'borderLeft' : 'borderRight']: `${tailLen}px solid ${INK}` }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-${tail * 100}%, -100%) scale(${0.85 + 0.15 * p})`, transformOrigin: `${tail * 100}% 100%`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ ...box, marginBottom: tailLen }}>
        {inner}
        <div style={{ position: 'absolute', left: `${tail * 100}%`, bottom: -tailLen, width: 0, height: 0, transform: 'translateX(-50%)', borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `${tailLen}px solid ${INK}` }} />
      </div>
    </div>
  );
};

// 목도리 띠(술은 다섯 가닥 같은 길이 — 미학 맹검 「띠 좌우 잔선이 비대칭으로 깨져 보인다」) — 머리 글 · 낱말 띠 · 끝 띠가 모두 친구의 겨자색 목도리 꼴이다(골지 세로 줄 + 양끝 술). 이해 시험 v3 h 「머리 글 상자 · 낱말 카드가 지난 두 편과 같다」 — 지난 E48 분홍 띠 · 가격표, E46 크림 상자와 다르게.
const KNIT = `repeating-linear-gradient(90deg, ${MUSTARD} 0px, ${MUSTARD} 13px, #C98E0E 13px, #C98E0E 17px)`;
const Fringe: React.FC<{ side: 'left' | 'right' }> = ({ side }) => (
  <div style={{ position: 'absolute', [side]: -40, top: 14, bottom: 14, width: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
    {[0, 1, 2, 3, 4].map((k) => (
      <div key={k} style={{ height: 9, borderRadius: 5, background: '#C98E0E', border: `3px solid ${INK}` }} />
    ))}
  </div>
);
const Scarf: React.FC<{ top: number; at: number; children: React.ReactNode; tilt?: number }> = ({ top, at, children, tilt = 0 }) => {
  const frame = useCurrentFrame();
  const p = pop(frame, at);
  const sway = 0.8 * Math.sin(((frame - fr(at)) / FPS) * Math.PI * 1.1);
  return (
    <div style={{ position: 'absolute', top, left: 65, width: 855, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `scale(${0.9 + 0.1 * p}) rotate(${tilt + sway}deg)`, transformOrigin: '50% 0%' }}>
      <div style={{ position: 'relative', background: KNIT, border: `6px solid ${INK}`, borderRadius: 16, padding: '10px 44px 14px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.3)' }}>
        <Fringe side="left" />
        <Fringe side="right" />
        {children}
      </div>
    </div>
  );
};

// 머리 글 — 목도리 띠에 작은 줄 + 큰 줄 두 줄(다시 시험 v4 h · G 「'3 necks'가 진짜 목이 셋이라는 건지」 — 몸 세 곳의 이름이라는 걸 머리 글에서 말한다)
// 셋째 줄에 그 세 곳(neck · wrist · ankle)을 둔다 — 다시 시험 v5 s · h · G 「'3 body parts are necks'가 어느 세 곳인지 한참 뒤에야 풀린다」(시험 없이 고침)
const HeadBand: React.FC<{ font: string; small: string; big: string; sub: string }> = ({ font, small, big, sub }) => (
  <Scarf top={272} at={0} tilt={-2}>
    <div style={{ fontFamily: font, fontWeight: 800, fontSize: 46, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{small}</div>
    <div style={{ fontFamily: font, fontWeight: 900, fontSize: 70, color: INK, lineHeight: 1.04, whiteSpace: 'pre' }}>{big}</div>
    <div style={{ display: 'inline-block', marginTop: 6, background: PAPER, border: `4px solid ${INK}`, borderRadius: 14, padding: '0 20px 4px', fontFamily: font, fontWeight: 800, fontSize: 44, color: MEAN, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{sub}</div>
  </Scarf>
);

// 낱말 띠 — 아는 영어 낱말부터: 「wrist = 손목」 · 읽는 법 · (b초에) 쪼갠 뜻 「손 hand + 목 neck」(다시 시험 v3 · v4 h 「한국어 → 읽는 법 → 영어 카드 차례가 지난 편과 같다」 — 차례를 뒤집었다)
const WordCard: React.FC<{ at: number; b?: number; to: number; en: string; ko: string; rom: string; parts?: [string, string, string, string]; font: string; top?: number }> = ({ at, b, to, en, ko, rom, parts, font, top = 285 }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const q = b === undefined ? 1 : interpolate(frame, [fr(b), fr(b) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <Scarf top={top} at={at}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 16, whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: font, fontWeight: 900, fontSize: 66, color: INK, lineHeight: 1.08 }}>{en} =</span>
        <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 100, color: INK, lineHeight: 1.08 }}>{ko}</span>
      </div>
      <div style={{ fontFamily: font, fontWeight: 700, fontSize: 46, color: INK, opacity: 0.8, lineHeight: 1.12, whiteSpace: 'nowrap' }}>{rom}</div>
      {parts ? (
        <div style={{ opacity: q, transform: `translateY(${(1 - q) * 14}px)`, display: 'inline-block', marginTop: 6, background: PAPER, border: `4px solid ${INK}`, borderRadius: 14, padding: '2px 22px 6px', whiteSpace: 'nowrap', lineHeight: 1.15 }}>
          <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 56, color: INK }}>{parts[0]} </span>
          <span style={{ fontFamily: font, fontWeight: 800, fontSize: 50, color: MEAN }}>{parts[1]}</span>
          <span style={{ fontFamily: font, fontWeight: 800, fontSize: 50, color: INK }}> + </span>
          <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 56, color: INK }}>{parts[2]} </span>
          <span style={{ fontFamily: font, fontWeight: 800, fontSize: 50, color: MEAN }}>{parts[3]}</span>
        </div>
      ) : null}
    </Scarf>
  );
};

// 생각 풍선 — 몽글이 제 옆구리에서 손목을 찾는 칸(말이 아니라 생각 — 목소리 없음, 교훈 L07 「상상 칸은 표시로 가른다」). 꼬리는 꽉 찬 작은 점 둘(고리 · 빽빽한 점 무늬를 쓰지 않는다)
const Thought: React.FC<{ at: number; to: number; ko: string; mean: string; font: string; x: number; y: number; tx: number; ty: number }> = ({ at, to, ko, mean, font, x, y, tx, ty }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  return (
    <>
      <div style={{ position: 'absolute', left: (x + tx) / 2 - 17, top: (y + ty) / 2 - 17, width: 34, height: 34, borderRadius: '50%', background: PAPER, border: `4px solid ${INK}`, opacity: Math.min(1, p * 1.5) }} />
      <div style={{ position: 'absolute', left: tx - 12, top: ty - 12, width: 24, height: 24, borderRadius: '50%', background: PAPER, border: `4px solid ${INK}`, opacity: Math.min(1, p * 1.5) }} />
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -100%) scale(${0.85 + 0.15 * p})`, transformOrigin: '50% 100%', opacity: Math.min(1, p * 1.5), background: PAPER, border: `6px dashed ${INK}`, borderRadius: 64, padding: '14px 40px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.25)' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 80, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{ko}</div>
        <div style={{ fontFamily: font, fontWeight: 800, fontSize: 56, color: MEAN, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{mean}</div>
      </div>
    </>
  );
};

// 이름표 — 작은 크림 알약에 한국어, 짧은 선이 그 몸 자리의 작은 점으로 간다
const TagLabel: React.FC<{ t: number; at: number; g: Tag }> = ({ t, at, g }) => {
  const frame = useCurrentFrame();
  if (t < at) return null;
  const p = pop(frame, at);
  const len = Math.hypot(g.px - g.x, g.py - g.y);
  const ang = (Math.atan2(g.py - g.y, g.px - g.x) * 180) / Math.PI;
  const draw = interpolate(frame, [fr(at), fr(at) + 6], [0, 1], clamp);
  return (
    <>
      <div style={{ position: 'absolute', left: g.x, top: g.y - 3, width: len * draw, height: 6, background: INK, borderRadius: 3, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, opacity: 0.9 }} />
      <div style={{ position: 'absolute', left: g.px - 11, top: g.py - 11, width: 22, height: 22, borderRadius: '50%', background: MUSTARD, border: `4px solid ${INK}`, opacity: draw }} />
      <div style={{ position: 'absolute', left: g.x, top: g.y, transform: `translate(-50%, -50%) scale(${0.8 + 0.2 * p})`, opacity: Math.min(1, p * 1.5), background: PAPER, border: `5px solid ${INK}`, borderRadius: 999, padding: '4px 26px 8px', fontFamily: KO, fontWeight: 900, fontSize: 60, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap', boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }}>{g.ko}</div>
    </>
  );
};

// 끝 띠 — 손목 · 발목 두 줄(한국어 + 글자 그대로의 뜻)을 가장 센 그림 위 빈 하늘에, 목도리 띠 꼴로
const EndCard: React.FC<{ font: string; hand: string; foot: string }> = ({ font, hand, foot }) => {
  const frame = useCurrentFrame();
  if (frame < fr(T.card)) return null;
  const q = interpolate(frame, [fr(T.card + 0.3), fr(T.card + 0.3) + 7], [0, 1], clamp);
  const row = (ko: string, mean: string, o: number) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, opacity: o, whiteSpace: 'nowrap', margin: '4px 0' }}>
      <span style={{ fontFamily: KO, fontWeight: 900, fontSize: 88, color: INK, lineHeight: 1.1 }}>{ko}</span>
      <span style={{ background: PAPER, border: `4px solid ${INK}`, borderRadius: 14, padding: '0 18px 4px', fontFamily: font, fontWeight: 800, fontSize: 56, color: MEAN, lineHeight: 1.15 }}>{mean}</span>
    </div>
  );
  return (
    <Scarf top={280} at={T.card} tilt={1.5}>
      {row('손목', hand, 1)}
      {row('발목', foot, q)}
    </Scarf>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 24, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/wind.wav')} volume={MASTER * 0.3} endAt={fr(TOTAL)} />
    {VO.map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        {/* 몽글 줄(소진)은 친구 줄(도윤)보다 2.5~3dB 작게 사져 1.35배로 맞춘다(제작 절차 「대사 한 줄만 작게 들리면 맞춘다」 · 최종본 검사가 몽글 줄을 말로 못 잡음) */}
        <Audio src={staticFile(`${v}.wav`)} volume={MASTER * (v.startsWith('vo/m') ? 1.35 : 1)} />
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
  const range = cell.push || [1.0, 1.03];
  const push = interpolate(t, [cell.at, next], range, { ...clamp, easing: Easing.inOut(Easing.quad) });
  let body: React.ReactNode = null;
  if (t >= SHIVER.from && t < SHIVER.to && cell.img === SHIVER.img) {
    const dx = (random(`sv-${Math.floor(frame / 2)}`) - 0.5) * 2 * SHIVER.px;
    body = <BodyLayer img={SHIVER.img} body={SHIVER.body} k={1.004} dx={dx} />;
  }
  if (t >= GASP.at && t < GASP.at + GASP.dur && cell.img === GASP.img) {
    const u = (t - GASP.at) / GASP.dur;
    // 뒤로 젖혔다(기울기 −7°) 부풀었다 제자리 — v1 「젖혔다 부푸는 동작이 안 보인다」
    const k = interpolate(u, [0, 0.25, 0.55, 1], [1, 1.14, 1.06, 1.03], clamp);
    const rot = interpolate(u, [0, 0.25, 0.6, 1], [0, -9, -4, -2], clamp);
    body = <BodyLayer img={GASP.img} body={GASP.body} k={k} rot={rot} />;
  }
  if (t >= SPIN.from && t < SPIN.to && cell.img === SPIN.img) {
    const u = (t - SPIN.from) / (SPIN.to - SPIN.from);
    const rot = 7 * Math.sin(u * Math.PI * 3);
    body = <BodyLayer img={SPIN.img} body={SPIN.body} k={1.02} rot={rot} />;
  }
  if (t >= HOP.at && t < HOP.at + HOP.dur && cell.img === HOP.img) {
    const u = (t - HOP.at) / HOP.dur;
    const lift = Math.sin(Math.PI * u) * 34;
    const k = interpolate(u, [0, 0.2, 0.6, 1], [1, 1.05, 1.02, 1], clamp);
    body = <BodyLayer img={HOP.img} body={HOP.body} k={k} lift={lift} />;
  }
  return (
    <AbsoluteFill style={{ backgroundColor: '#5b5aa8', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: cell.origin || '50% 50%', transform: `scale(${push})` }}>
        <Img src={staticFile(`img/${cell.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
        {body}
        {/* 이름표는 그림과 함께 다가간다 */}
        {!bare && cell.img === 's5.jpg' ? TAGS_S5.map((g, k) => <TagLabel key={g.ko} t={t} at={T.tags[k]} g={g} />) : null}
      </AbsoluteFill>
      {!bare && t < T.headTo ? <HeadBand font={L.font} small={L.headSmall} big={L.headBig} sub={L.headSub} /> : null}
      {/* 친구 덜덜 — 머리 오른쪽(몽글 위 빈 하늘), 꼬리가 왼쪽 친구 얼굴로 */}
      <Bubble at={T.f1} to={T.f1To} ko="으, 추워!" mean={L.f1} font={L.font} x={540} y={720} tail={0.42} dir="right" />
      {!bare ? <WordCard at={T.w1} to={T.w1To} en={L.neck} ko="목" rom="mok" font={L.font} /> : null}
      {!bare ? <WordCard at={T.w2} b={T.w2b} to={T.w2To} en={L.wrist} ko="손목" rom="son-mok" parts={['손', L.hand, '목', L.neck]} font={L.font} /> : null}
      {!bare ? <WordCard at={T.w3} b={T.w3b} to={T.w3To} en={L.ankle} ko="발목" rom="bal-mok" parts={['발', L.foot, '목', L.neck]} font={L.font} /> : null}
      {/* 몽글 생각 — 제 옆구리에서 손목을 찾는다(s3m2 몽글 머리 오른쪽 위) */}
      <Thought at={T.th} to={T.thTo} ko="손목…?" mean={L.th} font={L.font} x={720} y={745} tx={640} ty={840} />
      {/* 몽글 놀람 — 몽글 머리 위 빈 하늘, 꼬리가 몽글로 */}
      <Bubble at={T.m1} to={T.m1To} ko="목이… 셋?!" mean={L.m1} font={L.font} x={640} y={640} tail={0.5} koSize={84} meanSize={54} />
      {/* 친구 「너도!」 — 친구 머리 위, 꼬리가 아래로 */}
      <Bubble at={T.f5} to={T.f5To} ko="너도!" mean={L.f5} font={L.font} x={450} y={630} tail={0.4} />
      {/* 몽글 「내 목은…?」 — 내려다본 몽글 머리 위 */}
      <Bubble at={T.m2} to={T.m2To} ko="내 목은…?" mean={L.m2} font={L.font} x={520} y={585} tail={0.5} koSize={76} />
      {/* 털실 고치 몽글 「따뜻해~」 — 고치 위, 친구 오른팔 아래 빈 자리 */}
      <Bubble at={T.m3} to={T.m3To} ko="따뜻해~" mean={L.m3} font={L.font} x={790} y={1150} tail={0.62} koSize={60} meanSize={42} maxW={300} />
      {!bare ? <EndCard font={L.font} hand={L.cardHand} foot={L.cardFoot} /> : null}
      <Sound />
    </AbsoluteFill>
  );
};
