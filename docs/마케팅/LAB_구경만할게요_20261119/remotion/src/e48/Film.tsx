// LAB 영어 E48 「구경만 할게요」(11-19 07시 회차) — 고정 카메라 한 방(판/_판짜기.py가 1080×1920으로 짠 판), 칸마다 점원 다섯의 자리 · 자세와 몽글 표정만 바뀐다.
// 몽글이 말하는 칸만 몽글 가까이(s4c). 화면 글: 위 빈 벽(300~560)에 머리 글 · 끝 낱말 카드, 말은 말하는 이의 머리 위 말풍선 — 점원 말은 원본 낱말 목록처럼 쌓인다(첫 말은 가운데 줄, 둘째 · 셋째는 위 줄 양쪽에서 긴 꼬리로).
// 글자는 안전선(가로 65~920 · 세로 269~1428) 안에 둔다(올리기 전 검사 ⑤).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { Body, CELLS, FPS, GLOWS, GlowSpot, HOP, Loc, LOCS, NOD, NOD2, SFX, SHAKE, SHAKE2, T, TOTAL, VO } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2A2230';
const WARM = '#D9466A';
const PAPER = '#FFF8EE';
const GREY = '#6B6272';
const GOOD = '#1F8A4C';
const TAG = '#FFF3D6';

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.7)) });

// 몸 한 덩이 — img 판의 body 자리를 둥글게 떠서 바닥 줄(baseY)을 기준으로 키운다(줄이면 밑판 윤곽이 드러나 늘 키우기만 — E42 미학 맹검)
const BodyLayer: React.FC<{ img: string; body: Body; k: number; lift?: number }> = ({ img, body, k, lift = 0 }) => {
  const mask = `radial-gradient(ellipse ${body.rx}px ${body.ry}px at ${body.cx}px ${body.cy}px, #000 74%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ transformOrigin: `${body.cx}px ${body.baseY}px`, transform: `translateY(${-lift}px) scale(${k}, ${k})`, WebkitMaskImage: mask, maskImage: mask }}>
      <Img src={staticFile(`img/${img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
    </AbsoluteFill>
  );
};

// 말풍선 — 말하는 이 머리 위, 꼬리가 그 머리를 가리킨다(tail = 꼬리 자리 비율). down = 꼬리를 아래로(기본) · up = 위로
const Bubble: React.FC<{ at: number; to: number; ko: string; rom?: string; mean: string; font: string; x: number; y: number; tail?: number; dir?: 'down' | 'up' | 'left'; maxW?: number; koSize?: number; meanSize?: number; tailLen?: number }> = ({ at, to, ko, rom, mean, font, x, y, tail = 0.5, dir = 'down', maxW = 560, koSize = 64, meanSize = 46, tailLen = 26 }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || frame >= fr(to)) return null;
  const p = pop(frame, at);
  if (dir === 'left') {
    // 말하는 이의 왼쪽에 서는 말풍선 — 꼬리가 오른쪽 가장자리에서 말하는 이를 가리킨다(x, y = 꼬리 끝)
    return (
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-100%, -${tail * 100}%) scale(${0.85 + 0.15 * p})`, transformOrigin: `100% ${tail * 100}%`, opacity: Math.min(1, p * 1.5) }}>
        <div style={{ position: 'relative', background: PAPER, borderRadius: 34, padding: '12px 26px 14px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.3)', border: `5px solid ${INK}`, maxWidth: maxW, marginRight: tailLen }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.12, whiteSpace: 'pre' }}>{ko}</div>
          <div style={{ fontFamily: font, fontWeight: 700, fontSize: meanSize, color: WARM, lineHeight: 1.15, marginTop: 2, whiteSpace: 'pre' }}>{mean}</div>
          <div style={{ position: 'absolute', right: -tailLen, top: `${tail * 100}%`, width: 0, height: 0, transform: 'translateY(-50%)', borderTop: '18px solid transparent', borderBottom: '18px solid transparent', borderLeft: `${tailLen}px solid ${INK}` }} />
        </div>
      </div>
    );
  }
  const down = dir === 'down';
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-${tail * 100}%, ${down ? '-100%' : '0%'}) scale(${0.85 + 0.15 * p})`, transformOrigin: `${tail * 100}% ${down ? '100%' : '0%'}`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ position: 'relative', background: PAPER, borderRadius: 38, padding: '14px 30px 16px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.3)', border: `5px solid ${INK}`, maxWidth: maxW, marginBottom: down ? tailLen : 0, marginTop: down ? 0 : tailLen }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: koSize, color: INK, lineHeight: 1.12, whiteSpace: 'pre' }}>{ko}</div>
        {rom ? <div style={{ fontFamily: font, fontWeight: 600, fontSize: 44, color: GREY, lineHeight: 1.15, marginTop: 2, whiteSpace: 'nowrap' }}>{rom}</div> : null}
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: meanSize, color: WARM, lineHeight: 1.15, marginTop: 2, whiteSpace: 'pre' }}>{mean}</div>
        <div
          style={{
            position: 'absolute',
            left: `${tail * 100}%`,
            [down ? 'bottom' : 'top']: -tailLen,
            width: 0,
            height: 0,
            transform: 'translateX(-50%)',
            borderLeft: '20px solid transparent',
            borderRight: '20px solid transparent',
            [down ? 'borderTop' : 'borderBottom']: `${tailLen}px solid ${INK}`,
          }}
        />
      </div>
    </div>
  );
};

// 립스틱 반짝임 — 몽글이 반한 물건을 보이게(이해 시험 v3 G 「무엇을 보고 예쁘다는 건지」). 글자 없이 빛 둥근 판과 네 갈래 반짝이만
const Glow: React.FC<{ t: number; g: GlowSpot }> = ({ t, g }) => {
  const u = t - g.at;
  const a = interpolate(u, [0, 0.2], [0, 1], clamp) * (0.85 + 0.15 * Math.sin(u * Math.PI * 3));
  const sparks: [number, number, number][] = [[-30, -70, 0.0], [78, -40, 0.25], [40, 62, 0.5], [-48, 40, 0.75]];
  return (
    <>
      <div style={{ position: 'absolute', left: g.x - g.r, top: g.y - g.r, width: g.r * 2, height: g.r * 2, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,250,0.95) 0%, rgba(255,246,214,0.8) 22%, rgba(255,236,196,0.45) 45%, rgba(255,230,200,0) 70%)', opacity: a, mixBlendMode: 'screen' }} />
      {sparks.map(([dx, dy, ph], i) => {
        const s = g.spark * (0.6 + 0.4 * Math.abs(Math.sin((u + ph) * Math.PI * 2.2)));
        return (
          <div key={i} style={{ position: 'absolute', left: g.x + dx * g.spark - 36, top: g.y + dy * g.spark - 36, width: 72, height: 72, opacity: a, transform: `scale(${s})` }}>
            {/* 돌리지 않은 네 갈래 빛줄기(「×」로 읽히지 않게 — 교훈 L04) */}
            <div style={{ position: 'absolute', left: 32, top: 0, width: 8, height: 72, background: 'linear-gradient(#fff0, #FFFFFF 50%, #fff0)', borderRadius: 4, boxShadow: '0 0 14px #fff, 0 0 4px #FFE9A8' }} />
            <div style={{ position: 'absolute', left: 0, top: 32, width: 72, height: 8, background: 'linear-gradient(90deg, #fff0, #FFFFFF 50%, #fff0)', borderRadius: 4, boxShadow: '0 0 14px #fff, 0 0 4px #FFE9A8' }} />
          </div>
        );
      })}
    </>
  );
};

// 머리 글 — 분홍 띠(지난 편 E42 · E46의 크림 상자 머리 글과 다르게 — 다시 시험 v4 h · G 「머리 글이 버거 편과 같다」)
const HeadBanner: React.FC<{ font: string; big: string; sub: string }> = ({ font, big, sub }) => {
  const frame = useCurrentFrame();
  const p = pop(frame, 0);
  return (
    <div style={{ position: 'absolute', top: 300, left: 70, width: 850, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `scale(${0.9 + 0.1 * p}) rotate(-2deg)`, transformOrigin: '50% 0%' }}>
      <div style={{ background: WARM, border: `6px solid ${INK}`, borderRadius: 999, padding: '16px 56px 20px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.3)' }}>
        <div style={{ fontFamily: font, fontWeight: 900, fontSize: 74, color: '#FFFFFF', lineHeight: 1.05, whiteSpace: 'nowrap' }}>{big}</div>
        {sub ? <div style={{ fontFamily: font, fontWeight: 800, fontSize: 54, color: '#FFE9A8', lineHeight: 1.15, marginTop: 4, whiteSpace: 'nowrap' }}>{sub}</div> : null}
      </div>
    </div>
  );
};

// 끝 낱말 카드 — 「구경만 할게요」 한 줄과 뜻을 위 빈 벽 한 장에. 뜻 줄은 0.3초 뒤 미끄러져 들어오고 카드는 천천히 숨 쉰다.
const WordCard: React.FC<{ font: string; mean: string }> = ({ font, mean }) => {
  const frame = useCurrentFrame();
  if (frame < fr(T.card) || (frame >= fr(T.cardOff) && frame < fr(T.cardBack))) return null;
  const p = pop(frame, frame >= fr(T.cardBack) ? T.cardBack : T.card);
  const q = frame >= fr(T.cardBack) ? 1 : interpolate(frame, [fr(T.card2), fr(T.card2) + 7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const breathe = 1 + 0.012 * Math.sin(((frame - fr(T.card)) / FPS) * Math.PI * 1.2);
  const swing = 2.2 * Math.sin(((frame - fr(T.card)) / FPS) * Math.PI * 0.9);
  // 가격표 꼴 — 위에서 끈으로 매달려 살짝 흔들린다(다시 시험 v4 h · G 「끝 풀이 카드가 지난 버거 편과 같다」 — 교훈 L02)
  return (
    <div style={{ position: 'absolute', top: 250, left: 70, width: 850, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `scale(${(0.9 + 0.1 * p) * breathe}) rotate(${swing}deg)`, transformOrigin: '50% 0%' }}>
      <div style={{ position: 'relative', marginTop: 60, background: TAG, border: `6px solid ${INK}`, borderRadius: '30px 30px 30px 30px', padding: '22px 52px 26px 92px', textAlign: 'center', boxShadow: '0 12px 26px rgba(0,0,0,0.3)' }}>
        {/* 끈과 구멍 */}
        {/* 끈이 구멍에서 시작해 카드 위로 나간다(미학 맹검 v6 「구멍과 동떨어진 끈 조각」) */}
        <div style={{ position: 'absolute', left: 34, top: -70, width: 6, height: 110, background: INK, borderRadius: 3, transform: 'rotate(-14deg)', transformOrigin: '50% 100%' }} />
        <div style={{ position: 'absolute', left: 22, top: 22, width: 30, height: 30, borderRadius: '50%', background: '#f2c9c4', border: `5px solid ${INK}` }} />
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 100, color: GOOD, lineHeight: 1.05, whiteSpace: 'nowrap' }}>구경만 할게요</div>
        <div style={{ fontFamily: font, fontWeight: 600, fontSize: 54, color: GREY, lineHeight: 1.2, marginTop: 4, whiteSpace: 'nowrap' }}>gu-gyeong-man hal-ge-yo</div>
        <div style={{ opacity: q, transform: `translateX(${(1 - q) * -28}px)`, fontFamily: font, fontWeight: 800, fontSize: 62, color: INK, lineHeight: 1.15, marginTop: 6, whiteSpace: 'nowrap' }}>= {mean}</div>
      </div>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 24, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={MASTER * 0.35} endAt={fr(TOTAL)} />
    {VO.map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`${v}.wav`)} volume={MASTER * (v === 'vo/c5' ? 0.7 : 1)} />
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
  let dx = 0;
  let dy = 0;
  for (const S of [SHAKE, SHAKE2]) {
    if (t >= S.at && t < S.at + S.dur) {
      const k = 1 - (t - S.at) / S.dur;
      dx = (random(`sx-${frame}`) - 0.5) * 2 * S.px * k;
      dy = (random(`sy-${frame}`) - 0.5) * 2 * S.px * k;
    }
  }
  const flash = interpolate(t, [T.flash, T.flash + 0.04, T.flash + 0.22], [0, 0.4, 0], clamp);
  let body: React.ReactNode = null;
  if (t >= NOD.at && t < NOD.at + NOD.dur && cell.img === NOD.img) {
    const k = interpolate(t, [NOD.at, NOD.at + 0.12, NOD.at + 0.26, NOD.at + NOD.dur], [1, 1.06, 1.02, 1], clamp);
    body = <BodyLayer img={NOD.img} body={NOD.body} k={k} />;
  }
  if (t >= NOD2.at && t < NOD2.at + NOD2.dur && cell.img === NOD2.img) {
    const k = interpolate(t, [NOD2.at, NOD2.at + 0.15, NOD2.at + 0.3, NOD2.at + NOD2.dur], [1, 1.07, 1.03, 1], clamp);
    body = <BodyLayer img={NOD.img} body={NOD.body} k={k} />;
  }
  if (t >= HOP.at && t < HOP.at + HOP.dur && cell.img === HOP.img) {
    const u = (t - HOP.at) / HOP.dur;
    const lift = Math.sin(Math.PI * u) * 46;
    const k = interpolate(u, [0, 0.2, 0.6, 1], [1, 1.06, 1.03, 1], clamp);
    body = <BodyLayer img={HOP.img} body={HOP.body} k={k} lift={lift} />;
  }
  return (
    <AbsoluteFill style={{ backgroundColor: '#f2c9c4', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: cell.origin || '50% 50%', transform: `translate(${dx}px, ${dy}px) scale(${push})` }}>
        <Img src={staticFile(`img/${cell.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
        {body}
        {GLOWS.map((g, i) => (t >= g.at && t < g.to ? <Glow key={i} t={t} g={g} /> : null))}
      </AbsoluteFill>
      {flash > 0 ? <AbsoluteFill style={{ background: '#fff', opacity: flash }} /> : null}
      {/* 머리 글 — 분홍 띠(훅 0~1.45초) */}
      {!bare && t < T.headTo ? <HeadBanner font={L.font} big={L.headBig} sub={L.headSub} /> : null}
      {/* 점원 말 — 가운데 머리띠(c1) · 오른쪽 남자(c2) · 왼쪽 묶은 머리(c3). 원본 낱말 목록처럼 앞 말이 남아 쌓인다 */}
      <Bubble at={T.c1} to={T.crowdTo} ko="어서 오세요~!" mean={L.c1} font={L.font} x={508} y={800} tail={0.5} />
      <Bubble at={T.c2} to={T.crowdTo} ko="이거 써 보세요!" mean={L.c2} font={L.font} x={810} y={880} tail={0.78} tailLen={360} />
      <Bubble at={T.c3} to={T.crowdTo} ko="이것도요!" mean={L.c3} font={L.font} x={220} y={905} tail={0.435} tailLen={385} />
      {/* 몽글 말 — 가까운 판(s4c)에서 몽글 머리 위 빈 벽(양쪽 점원 얼굴 사이 가로 380~800), 꼬리가 몽글을 가리킨다. 읽는 법은 끝 카드에 */}
      <Bubble at={T.m1} to={T.m1To} ko={'구경만\n할게요…'} mean={L.m1} font={L.font} x={590} y={935} tail={0.45} koSize={72} maxW={400} />
      {/* 점원들 함께 — 한 줄로 고개 숙인 가운데 머리띠 점원을 가리킨다 */}
      <Bubble at={T.c4} to={T.c4To} ko="네~ 천천히 보세요~" mean={L.c4} font={L.font} x={545} y={955} tail={0.5} maxW={760} />
      {/* 끝 사건 — 넓은 s6b에서 몽글 왼쪽(점원 얼굴 아래 앞치마 자리, 꼬리가 몽글로), 다시 몰려온 s7에서 가운데 점원 머리 위 */}
      <Bubble at={T.m2} to={T.m2To} ko={'와…\n예쁘다…'} mean={L.m2} font={L.font} x={402} y={1300} tail={0.5} dir="left" koSize={56} meanSize={40} maxW={300} />
      <Bubble at={T.c6} to={T.c6To} ko="이거요?!" mean={L.c6} font={L.font} x={520} y={800} tail={0.5} koSize={80} />
      {!bare ? <WordCard font={L.font} mean={L.cardMean} /> : null}
      <Sound />
    </AbsoluteFill>
  );
};
