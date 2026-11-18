// LAB 몽골 M61 「이모~!」(11-18 15시 회차) — 원본 같은분야 WlAqWkRYIkc의 식당 한 곳 구간 뼈대(앉아 먹기 → 직원 부르기 → 음식이 옴 → 반응).
// 그림은 칸마다 기준 판(g1 넓은 구도 · g2 이모 가까이)을 참고로 구운 한 장을 판/_판짜기.py가 1080×1920 화면 판으로 짠 것(폭을 다 담고 위 300px는 벽을 이음).
// 카메라는 같은 판을 전체(W) · 몽글(M) · 친구(F) · 끝(Z)으로 바로 바꿔 자르고, 이모 가까운 판(b1 · b2 · b3)은 따로 구운 판이다(칸 안에서는 천천히 다가감).
// 화면 글: ① 말풍선(한국어 + 읽는 법 + 그 나라 뜻) ② 날아가는 말 — 앞 탁자에서 뒤 계산대로(작은 「저기요…」는 떨어지고, 그 나라 식 부름은 이모 등에 튕기고, 「이모~!」는 닿는다)
// ③ 위 벽 띠 — 0~1.5초 훅, 11.5~14.4초 「이모」 카드. 글자 안전선 안(65~920 · 269~1428px).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CAMS, CARD, CELLS, FLIES, FPS, HEARTS, HOOK_KO, HOOK_UNTIL, LINES, QMARK, SFX, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const PAPER = '#FFF8EC';
const MEAN = '#C2412F';
const READ = '#3F342D'; // v5: G · K 「작은 회색 읽기 줄」 → 더 진하게
const CARD_BG = PAPER; // v4: 지난 편들의 검은 설명판과 다르게 종이 판(G · s v3 「검은 설명판이 같다」)
const CREAM = INK;
const CARD_MEAN = MEAN;
const LOCAL = '#2F6FB0'; // 그 나라 식 부름 — 파란 글(한국어 말풍선과 가른다)

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const Plate: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  const cam = CAMS[c.cam];
  const end = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const push = interpolate(frame, [fr(c.at), fr(end)], [0, c.push ?? 0.015], { ...clamp, easing: Easing.out(Easing.quad) });
  const z = cam.z * (1 + push);
  const tx = Math.min(0, Math.max(1080 - 1080 * z, cam.tx - 540 * cam.z * push));
  const ty = Math.min(0, Math.max(1920 - 1920 * z, cam.ty - 960 * cam.z * push));
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#c98a3e' }}>
      <Img src={staticFile(`img/${c.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` }} />
    </AbsoluteFill>
  );
};

const Bubble: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  if (c.sub < 0) return null;
  const line = LINES[c.sub];
  const startF = Math.max(fr(c.at), fr(line.voAt) - 3);
  if (frame < startF) return null;
  const p = interpolate(frame, [startF, startF + 5], [0.6, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  let o = interpolate(frame, [startF, startF + 3], [0, 1], clamp);
  // 떨어지는 말풍선(너무 작은 「저기요…」) — drop 초부터 옆으로 밀리며 바닥으로 떨어지고 사라진다
  let fall = '';
  if (line.drop !== undefined && frame >= fr(line.drop)) {
    const v = interpolate(frame, [fr(line.drop), fr(line.drop) + 20], [0, 1], clamp);
    fall = ` translate(${160 * v}px, ${300 * v * v}px) rotate(${38 * v}deg)`;
    o *= interpolate(v, [0.55, 1], [1, 0], clamp);
  }
  const mean = L.means[c.sub];
  const read = L.reads[c.sub];
  const lh = Math.max(1.15, L.lineH);
  const { x, bottom, tail, top } = line.bub;
  const tailLeft = tail - x;
  const up = top !== undefined;
  const place = up ? { top } : { bottom: 1920 - bottom };
  return (
    <div style={{ position: 'absolute', left: x, ...place, opacity: o, transform: `scale(${p})${fall}`, transformOrigin: `${tailLeft}px ${up ? '0%' : '100%'}` }}>
      <div style={{ position: 'relative', background: PAPER, border: `5px solid ${INK}`, borderRadius: 38, padding: '16px 34px 18px', textAlign: 'center', boxShadow: '0 10px 22px rgba(0,0,0,0.25)', maxWidth: Math.max(320, 920 - x), width: 'max-content' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: line.koSize, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{line.ko}</div>
        {read ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: L.readSize, color: READ, lineHeight: 1.2, marginTop: 2 }}>{read}</div> : null}
        {mean ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSize, color: MEAN, lineHeight: lh, marginTop: 4, whiteSpace: 'pre-line' }}>{mean}</div> : null}
      </div>
      {up ? (
        <svg width={60} height={44} style={{ position: 'absolute', left: tailLeft - 30, top: -38 }}>
          <path d="M6 44 L30 4 L54 44 Z" fill={PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <rect x={4} y={37} width={52} height={7} fill={PAPER} />
        </svg>
      ) : (
        <svg width={60} height={44} style={{ position: 'absolute', left: tailLeft - 30, top: '100%', marginTop: -6 }}>
          <path d="M6 0 L30 40 L54 0 Z" fill={PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <rect x={4} y={0} width={52} height={7} fill={PAPER} />
        </svg>
      )}
    </div>
  );
};

// 날아가는 말 — path 세 점(출발 · 가운데 · 끝)을 지나 간다. drop: 끝에서 떨어져 사라짐 · bounce: 끝에서 튕겨 흔들리다 사라짐
const Flying: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <>
      {FLIES.map((f, k) => {
        if (t < f.from || t >= f.to) return null;
        const start = f.from + (f.hold ?? 0); // hold 동안은 말한 이의 입가에 꼬리를 달고 머문다
        const dur = f.to - start;
        const travelEnd = start + dur * (f.drop || f.bounce ? 0.6 : 0.9);
        const u = interpolate(t, [start, travelEnd], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
        const holding = t < start;
        const [a, b, c] = f.path;
        const seg = u < 0.5 ? u * 2 : (u - 0.5) * 2;
        const [p0, p1] = u < 0.5 ? [a, b] : [b, c];
        let x = p0[0] + (p1[0] - p0[0]) * seg;
        let y = p0[1] + (p1[1] - p0[1]) * seg;
        let rot = 0;
        let o = interpolate(t, [f.from, f.from + 0.08], [0, 1], clamp);
        let s = f.drop ? interpolate(u, [0, 1], [1, 0.8], clamp) : f.bounce ? 1 : interpolate(u, [0, 1], [0.9, 1.25], clamp);
        if (u >= 1 && f.drop) {
          const v = interpolate(t, [travelEnd, f.to], [0, 1], clamp);
          y += 180 * v * v;
          rot = 30 * v;
          o *= interpolate(v, [0.6, 1], [1, 0], clamp);
        }
        if (u >= 1 && f.bounce) {
          const v = interpolate(t, [travelEnd, f.to], [0, 1], clamp);
          x -= 70 * Math.sin(v * Math.PI) ;
          y -= 50 * Math.sin(v * Math.PI);
          rot = -14 * Math.sin(v * Math.PI * 3);
          o *= interpolate(v, [0.65, 1], [1, 0], clamp);
        }
        const text = f.kind === 'local' ? L.localCall : f.ko ?? '';
        const local = f.kind === 'local';
        return (
          <div key={k} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${s})`, opacity: o }}>
            <div style={{ position: 'relative', background: PAPER, border: `5px solid ${INK}`, borderRadius: 999, padding: '10px 30px 14px', boxShadow: '0 8px 18px rgba(0,0,0,0.25)', whiteSpace: 'nowrap', fontFamily: local ? L.font : KO, fontWeight: 800, fontSize: f.size, color: local ? LOCAL : INK, lineHeight: 1.1 }}>
              {text}
              {holding ? (
                <svg width={60} height={44} style={{ position: 'absolute', left: 18, top: '100%', marginTop: -6 }}>
                  <path d="M6 0 L14 40 L54 0 Z" fill={PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
                  <rect x={4} y={0} width={52} height={7} fill={PAPER} />
                </svg>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
};

// 튕긴 뒤 이모 머리 위 「?」
const QMark: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < QMARK.from || t >= QMARK.to) return null;
  const sf = fr(QMARK.from);
  const p = interpolate(frame, [sf, sf + 5], [0.3, 1], { ...clamp, easing: Easing.out(Easing.back(3)) });
  const wob = Math.sin((frame - sf) / 2.5) * 8;
  return (
    <div style={{ position: 'absolute', left: QMARK.x - 50, top: QMARK.y - 70, width: 100, textAlign: 'center', transform: `scale(${p}) rotate(${wob}deg)`, fontFamily: KO, fontWeight: 900, fontSize: 120, color: PAPER, WebkitTextStroke: `6px ${INK}`, paintOrder: 'stroke fill', lineHeight: 1 }}>?</div>
  );
};

// 몽글의 「이모~!」에 이모 위로 하트 셋이 솟는다
const Hearts: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < HEARTS.from || t >= HEARTS.to) return null;
  const sf = fr(HEARTS.from);
  return (
    <>
      {[-70, 0, 70].map((dx, k) => {
        const f0 = sf + k * 3;
        const v = interpolate(frame, [f0, f0 + 16], [0, 1], clamp);
        const p = interpolate(frame, [f0, f0 + 5], [0.2, 1], { ...clamp, easing: Easing.out(Easing.back(3)) });
        return (
          <div key={k} style={{ position: 'absolute', left: HEARTS.x + dx - 40, top: HEARTS.y - 60 - 90 * v - (k === 1 ? 30 : 0), width: 80, textAlign: 'center', transform: `scale(${p})`, opacity: interpolate(v, [0.7, 1], [1, 0], clamp), fontFamily: KO, fontWeight: 900, fontSize: 84, color: '#E8505B', WebkitTextStroke: `5px ${INK}`, paintOrder: 'stroke fill', lineHeight: 1 }}>♥</div>
        );
      })}
    </>
  );
};

// 위 벽 띠 — 0~1.5초 훅
const Hook: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame / FPS >= HOOK_UNTIL) return null;
  const p = interpolate(frame, [0, 5], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: 80, top: 300, width: 920, transform: `scale(${p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '18px 22px 20px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)', width: 840 }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 60, color: CREAM, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{HOOK_KO}</div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 48, color: CARD_MEAN, lineHeight: 1.2, marginTop: 6 }}>{L.hook}</div>
      </div>
    </div>
  );
};

// 위 벽 카드 — 「이모」(엄마의 자매) 한 줄, 그 아래 두 나라의 식당 부름을 나란히(v3: = 꼴 대신, 글자 키움)
const Card: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < CARD.from || t >= CARD.to) return null;
  const sf = fr(CARD.from);
  const p = interpolate(frame, [sf, sf + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  const second = interpolate(frame, [sf + 15, sf + 21], [0, 1], clamp);
  const col = (label: string, call: React.ReactNode, color: string) => (
    <div style={{ flex: 1, background: '#F1E2C8', border: `3px solid ${INK}`, borderRadius: 26, padding: '8px 10px 12px' }}>
      <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 58, color: READ, lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 76, color, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{call}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: 80, top: 286, width: 840, transform: `scale(${p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '14px 22px 20px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        <div style={{ whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 88, color: CREAM, lineHeight: 1.05 }}>{CARD.ko}</span>
          <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 52, color: READ, marginLeft: 16 }}>{L.cardRead}</span>
        </div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 62, color: CARD_MEAN, lineHeight: 1.2, marginTop: 2 }}>{L.cardMean}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14, opacity: second }}>
          {col(L.cardLeft, <span style={{ fontFamily: L.font, color: LOCAL }}>{L.localCall}</span>, LOCAL)}
          {col(L.cardRight, <span style={{ fontFamily: KO }}>이모~!</span>, MEAN)}
        </div>
      </div>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/sizzle.wav')} volume={0.09 * MASTER} endAt={fr(TOTAL)} />{/* 불판 지글 */}
    <Audio src={staticFile('sfx/crowd.wav')} volume={0.05 * MASTER} />
    <Sequence from={fr(9)} layout="none">
      <Audio src={staticFile('sfx/crowd.wav')} volume={0.05 * MASTER} />
    </Sequence>
    <Sequence from={fr(18)} layout="none">
      <Audio src={staticFile('sfx/crowd.wav')} volume={0.05 * MASTER} />
    </Sequence>
    {LINES.map((l) => (
      <Sequence key={l.vo} from={fr(l.voAt)} layout="none">
        <Audio src={staticFile(`vo/${l.vo}.wav`)} volume={(l.vol ?? 1) * MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 imo-<KEY>로 넘긴다
// bare = 장면 심사용(글 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①). 날아가는 말(대사)은 장면의 움직임이라 bare에서도 남긴다.
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#c98a3e' }}>
      <Plate i={i} />
      <Flying L={L} />
      <QMark />
      <Hearts />
      {bare ? null : (
        <>
          <Hook L={L} />
          <Card L={L} />
          <Bubble i={i} L={L} />
        </>
      )}
      <Sound />
    </AbsoluteFill>
  );
};
