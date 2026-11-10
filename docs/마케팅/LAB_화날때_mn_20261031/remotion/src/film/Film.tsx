// LAB 몽골 M1 「화날 때 네 마디」(10-31) — 머리 글 → 몽글의 나쁜 하루 네 칸(상황 → 표현) → 사장님 앞 겉말과 속으로 터지는 화산.
// 왼쪽 화 게이지가 칸마다 찬다. 그림은 장면마다 구운 한 장(누끼 없음), 천천히 다가가는 카메라만 더한다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { BGM_DUCK, BGM_VOL, Bubble as BubbleData, CELLS, END_LINE_AT, FPS, INNER_VO, SFX, TEXT, TOTAL, VO_LEN } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26';
const CREAM = '#FFFDF7';

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const Plate: React.FC<{ i: number; hookMove?: boolean }> = ({ i, hookMove }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  const end = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  // 끝 칸은 맺음 줄이 나올 때 화산 · 웃는 몽글 쪽으로 한 번 끊어 당긴다(원본의 끝 칸 자리)
  const cat = !!c.next && i === CELLS.length - 1 && frame >= fr(c.next.at);
  const punch = i === CELLS.length - 1 && frame >= fr(END_LINE_AT) && !cat;
  let z = punch ? 1.28 : interpolate(frame, [fr(c.at), fr(end)], [1, 1.05], clamp);
  let shake = c.tremble ? Math.sin(frame * 1.9) * 3.2 : 0;
  if (i === 0 && hookMove) {
    // 첫 칸(두 채널 판부터 — 몽골판 10-31 v8은 이미 예약돼 그대로 둔다): 0.4초에 한 번 다가가고, 1.2 · 2.0 · 2.6초에 화가 치밀 때마다 들썩 · 떨림이 커진다
    z = interpolate(frame, [0, fr(3.2)], [1.0, 1.2], { ...clamp, easing: Easing.inOut(Easing.quad) });
    for (const b of [0.6, 1.4, 2.2, 2.8]) z += 0.07 * interpolate(frame, [fr(b), fr(b) + 2, fr(b) + 8], [0, 1, 0.25], clamp);
    shake *= interpolate(frame, [0, fr(3.2)], [0.6, 2.2], clamp);
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
      <Img src={staticFile(`img/${c.next && frame >= fr(c.next.at) ? c.next.img : c.img}`)} style={{ position: 'absolute', left: cat ? -100 : c.x ?? -100, top: 0, width: 1280, height: 1920, transform: `translateX(${shake}px) scale(${z})`, transformOrigin: punch ? '82% 72%' : '50% 58%' }} />
    </AbsoluteFill>
  );
};

// 첫 칸의 김 — 몽글 머리 위에서 솟아 흩어진다(그림 위 흰 김 두 줄 자리)
const Steam: React.FC = () => {
  const frame = useCurrentFrame();
  const out: React.ReactNode[] = [];
  for (let k = 0; k < 14; k++) {
    const t0 = (k * 0.23) % 2.6;
    const s = frame / FPS - t0;
    if (s < 0 || s > 1.4) continue;
    const side = k % 2 ? 1 : -1;
    const x = 540 + side * (150 + 30 * Math.sin(k * 1.7)) + side * 60 * s;
    const y = 760 - 520 * s;
    const r = 60 + 110 * s;
    // 밝은 하늘 위에서도 보이게 가장자리에 옅은 회색 테(v3은 흰 김이 하늘에 묻혔다)
    out.push(<div key={k} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.97) 0%, rgba(250,247,244,0.8) 42%, rgba(196,186,180,0.42) 60%, rgba(255,255,255,0) 72%)', opacity: interpolate(s, [0, 0.15, 1.0, 1.4], [0, 1, 0.6, 0], clamp), filter: 'blur(1.5px)' }} />);
  }
  return <>{out}</>;
};

const Gauge: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  let from = 0;
  let to = 0;
  let at = 0;
  CELLS.forEach((c, k) => {
    if (k <= i && c.bubble) {
      from = to;
      to = c.bubble.gauge;
      at = c.at;
    }
  });
  const v = interpolate(frame, [fr(at), fr(at) + 10], [from, to], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const H = 620;
  const top = 700;
  return (
    <div style={{ position: 'absolute', left: 28, top, width: 66, height: H + 64, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 30, color: '#fff', background: 'rgba(28,22,20,0.82)', borderRadius: 12, padding: '4px 8px 6px', marginBottom: 8, whiteSpace: 'nowrap' }}>{L.gauge}</div>
      <div style={{ position: 'relative', width: 44, height: H, background: 'rgba(255,253,247,0.92)', border: `5px solid ${INK}`, borderRadius: 24, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.min(1, v) * 100}%`, background: 'linear-gradient(0deg, #F7B733 0%, #F06A35 55%, #D81E1E 100%)' }} />
      </div>
    </div>
  );
};

const Sit: React.FC<{ text: string; at: number; L: LocPack }> = ({ text, at, L }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [fr(at), fr(at) + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', left: 44, right: 44, top: 276, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <span style={{ display: 'inline-block', background: 'rgba(28,22,20,0.84)', color: '#fff', fontFamily: L.font, fontWeight: 700, fontSize: L.sitSize, lineHeight: Math.max(1.2, L.lineH), padding: '18px 34px 22px', borderRadius: 28, whiteSpace: 'pre-line' }}>{text}</span>
    </div>
  );
};

const Hook: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 6], [0.92, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', left: 44, right: 44, top: 250, textAlign: 'center', transform: `scale(${p})` }}>
      <span style={{ display: 'inline-block', background: CREAM, border: `7px solid ${INK}`, color: INK, fontFamily: L.font, fontWeight: 800, fontSize: L.hookSize, lineHeight: L.lineH, padding: '20px 44px 28px', borderRadius: 40, whiteSpace: 'pre-line', boxShadow: '0 10px 28px rgba(0,0,0,0.28)' }}>{L.hook}</span>
    </div>
  );
};

const HOOK_CHIPS = ['짜증 나', '열받아', '어이없어', '억울해'];
const Chips: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1640, display: 'flex', justifyContent: 'center', gap: 14 }}>
      {HOOK_CHIPS.map((c, k) => {
        const at = fr(0.7 + k * 0.6);
        const p = interpolate(frame, [at, at + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
        return (
          <div key={k} style={{ background: k === 3 ? CORAL : CREAM, color: k === 3 ? '#fff' : INK, border: `5px solid ${INK}`, borderRadius: 999, padding: '8px 22px 12px', fontFamily: KO, fontWeight: 800, fontSize: 50, lineHeight: 1.1, whiteSpace: 'nowrap', transform: `scale(${p}) rotate(${(k % 2 ? 3 : -3) * p}deg)`, opacity: p > 0 ? 1 : 0 }}>
            {c}
          </div>
        );
      })}
    </div>
  );
};

const Speech: React.FC<{ b: BubbleData; at: number; L: LocPack }> = ({ b, at, L }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [fr(at), fr(at) + 4], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const tailL = Math.max(0, b.tip[0] - 56);
  return (
    <>
      <div style={{ position: 'absolute', bottom: 1920 - b.bottom, ...(b.side === 'right' ? { right: 28 } : { left: 112 }), width: b.width, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: '100%', boxSizing: 'border-box', background: CREAM, border: `6px solid ${INK}`, borderRadius: 48, padding: '20px 30px 24px', boxShadow: '0 10px 28px rgba(0,0,0,0.28)', transform: `scale(${p})`, transformOrigin: '50% 100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ background: CORAL, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 42, lineHeight: 1, padding: '9px 22px 11px', borderRadius: 999 }}>{b.n}/4</span>
          </div>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 112, color: INK, lineHeight: 1.14, whiteSpace: 'nowrap' }}>{b.ko}</div>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 52, color: '#5F4E42', lineHeight: 1.15, marginTop: 2 }}>🔊 {L.reads[b.n - 1]}</div>
          <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSize, color: MEAN, lineHeight: L.lineH, marginTop: 8, whiteSpace: 'pre-line' }}>{L.means[b.n - 1]}</div>
        </div>
      </div>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path d={`M ${tailL} ${b.bottom - 8} L ${tailL + 60} ${b.bottom - 8} L ${b.tip[0]} ${b.tip[1]} Z`} fill={CREAM} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <rect x={tailL + 3} y={b.bottom - 14} width={54} height={9} fill={CREAM} />
      </svg>
    </>
  );
};

const End: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const at = CELLS[CELLS.length - 1].at;
  const p = interpolate(frame, [fr(at), fr(at) + 4], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const q = interpolate(frame, [fr(END_LINE_AT), fr(END_LINE_AT) + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  return (
    <>
      {/* 겉말 — 사장님 앞치마 위, 꼬리는 몽글 입으로(맺음 줄이 나오면 내린다) */}
      {frame >= fr(END_LINE_AT) ? null : <>
      <div style={{ position: 'absolute', left: 30, top: 1236, width: 470, textAlign: 'center', background: CREAM, border: `6px solid ${INK}`, borderRadius: 40, padding: '14px 18px 18px', boxSizing: 'border-box', transform: `scale(${p})` }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 68, color: INK, lineHeight: 1.14 }}>{TEXT.endKo}</div>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 42, color: '#5F4E42', lineHeight: 1.15 }}>🔊 {L.endRead}</div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.endMnSize, color: MEAN, lineHeight: L.lineH, marginTop: 4 }}>{L.endMn}</div>
      </div>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path d="M 494 1380 L 494 1450 L 590 1470 Z" fill={CREAM} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <rect x={488} y={1384} width={10} height={60} fill={CREAM} />
      </svg>
      </>}
      {/* 화산 옆 「(속으로) 억울해!!」 — 겉말과 속말을 잇는다(두 채널 판 v5부터 — 판본 inner를 비우면 없음: 몽골판 10-31 v8) */}
      {L.inner && frame >= fr(INNER_VO.at) && frame < fr(END_LINE_AT) ? (
        <div style={{ position: 'absolute', left: 560, top: 300, transform: `rotate(6deg) scale(${interpolate(frame, [fr(INNER_VO.at), fr(INNER_VO.at) + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) })})` }}>
          <div style={{ background: '#2B2522', color: '#fff', borderRadius: 26, padding: '10px 24px 14px', textAlign: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 40, lineHeight: L.lineH }}>({L.inner})</div>
            <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 76, lineHeight: 1.1, color: '#FFB199' }}>억울해!!</div>
          </div>
        </div>
      ) : null}
      {/* 맺음 줄 — 어른 앞에서는 속으로만 */}
      <div style={{ position: 'absolute', left: 36, right: 36, top: 240, textAlign: 'center', opacity: q, transform: `scale(${0.9 + 0.1 * q})` }}>
        <span style={{ display: 'inline-block', background: CREAM, border: `7px solid ${INK}`, color: INK, fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, lineHeight: L.lineH, padding: '14px 38px 22px', borderRadius: 34 }}>
          {L.end1}
          <br />
          <span style={{ color: CORAL }}>{L.end2}</span>
          {/* 끝 질문(판본 ask, 선택) — 끝 카드 셋째 줄. 비우면 몽골 · 두 채널 · 영어판 그대로 */}
          {L.ask ? <span style={{ display: 'block', fontSize: L.askSize, lineHeight: L.lineH, color: '#5F4E42', marginTop: 10 }}>{L.ask}</span> : null}
        </span>
      </div>
    </>
  );
};

// 영상 전체에 까는 배경음 — 앞뒤로 살짝 페이드하고, 말 둘레에서만 낮춘다(현장 노트 「효과음·킥이 말머리에 겹치면 첫 자음이 묻힌다」)
const VO_SPANS = [...CELLS.flatMap((c) => c.vo ?? []), INNER_VO].map((v) => [fr(v.at), fr(v.at + VO_LEN[v.id])]);
const bgmVol = (f: number) => {
  const duck = Math.min(...VO_SPANS.map(([a, b]) => interpolate(f, [a - 6, a, b, b + 6], [1, BGM_DUCK, BGM_DUCK, 1], clamp)));
  return BGM_VOL * MASTER * duck * interpolate(f, [0, 8, TOTAL_FRAMES - 30, TOTAL_FRAMES], [0, 1, 1, 0], clamp);
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={bgmVol} />
    {CELLS.flatMap((c) => c.vo ?? []).map((v) => (
      <Sequence key={`${v.id}-${v.at}`} from={fr(v.at)} layout="none">
        <Audio src={staticFile(`vo/${v.id}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    <Sequence from={fr(INNER_VO.at)} layout="none">
      <Audio src={staticFile(`sfx/${INNER_VO.id}.wav`)} volume={MASTER} />
    </Sequence>
    {SFX.map((s) => (
      <Sequence key={`${s.file}-${s.at}`} from={fr(s.at)} layout="none">
        <Audio src={staticFile(`sfx/${s.file}`)} volume={MASTER * s.vol} />
      </Sequence>
    ))}
  </>
);

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 angry-<KEY>로 넘긴다
export const Film: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  const c = CELLS[i];
  const sitN = CELLS.slice(0, i + 1).filter((x) => x.sit).length - 1; // 몇째 상황 칸인가
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      <Plate i={i} hookMove={L.hookMotion} />
      {i > 0 ? <Gauge i={i} L={L} /> : null}
      {i === 0 && L.hookMotion ? <Steam /> : null}
      {i === 0 ? <Hook L={L} /> : null}
      {i === 0 && L.hookMotion ? <Chips /> : null}
      {c.sit ? <Sit text={L.sits[sitN]} at={c.at} L={L} /> : null}
      {c.bubble ? <Speech b={c.bubble} at={c.at} L={L} /> : null}
      {i === CELLS.length - 1 ? <End L={L} /> : null}
      <Sound />
    </AbsoluteFill>
  );
};
