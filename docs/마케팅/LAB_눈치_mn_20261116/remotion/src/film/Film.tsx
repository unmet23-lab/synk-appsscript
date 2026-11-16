// LAB 몽골 M47 「눈치」(11-16 곁 세션 lab-mn-21) — 원본 같은분야 「외국인들이 절대 이해 못 하는 한국말 10가지」의 한 낱말 구간 뼈대(상황 → 우리는 이렇게 말한다 → 외국인은 갸웃).
// 그림은 칸마다 기준 판(g1)을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 탁자 선을 맞춰 1080×1920 화면 판으로 짠 것(배율 1.06 — 폭을 다 담는다).
// 카메라는 같은 판을 전체(W) · 왼쪽(L) · 오른쪽(R) · 몽글 가까이(M) · 가운데 접시(P)로 바로 바꿔 자른다(칸 안에서는 아주 천천히 다가감).
// 화면 글: ① 말풍선 — 말하는 사람 위 벽(한국어 + 읽는 법 + 그 나라 뜻) ② 카드 — 탁자 앞판 위 한 줄(0~1.4초 훅 띠, 8초 「눈치가 없다」 → 11.4초 「눈치 = 뜻」 → 16.6초 「눈치가 있다」).
// 글자 안전선 안(65~920 · 269~1428px). 판본 틀: 뜻 · 읽기 · 카드 뜻 · 훅 띠는 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CAMS, CARD, CARD_END, CELLS, FPS, HOOK_KO, HOOK_UNTIL, LATER, LINES, ROWS, SFX, THOUGHTS, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const PAPER = '#FFF8EC'; // 말풍선 — 따뜻한 흰 펠트
const MEAN = '#C2412F'; // 말풍선 위 뜻 — 짙은 산호
const READ = '#5A4C42'; // v4: 이해 시험 GPT · 그록 「회색 작은 읽기 글자를 못 읽음」 — 더 진하게
const CARD_BG = 'rgba(38, 32, 30, 0.9)';
const CREAM = '#FFF4DE';
const CARD_MEAN = '#FFB9A8';
// 낱말 카드 자리 — 아래 끝을 1420px에 붙이고 위로 자란다(안전선 아래 끝 1428)
export const LAYOUT = { left: 80, width: 830, bottom: 1420 };

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 판 — 칸마다 카메라 자리로 바로 바뀌고, 칸 안에서 1.5% 다가간다(판 밖이 보이지 않게 자리를 판 안으로 묶는다)
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
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#c9a37a' }}>
      <Img src={staticFile(`img/${c.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` }} />
    </AbsoluteFill>
  );
};

// 말풍선 — 그 줄의 칸에서만 뜬다(같은 줄이 이어지는 칸은 다시 튀기지 않는다)
const Bubble: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  if (c.sub < 0) return null;
  const line = LINES[c.sub];
  const startF = fr(line.voAt) - 3;
  if (frame < startF) return null;
  const p = interpolate(frame, [startF, startF + 5], [0.6, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const o = interpolate(frame, [startF, startF + 3], [0, 1], clamp);
  const mean = L.means[c.sub];
  const read = L.reads[c.sub];
  const lh = Math.max(1.15, L.lineH);
  const { x, bottom, tail, top } = line.bub;
  const tailLeft = tail - x; // 꼬리 끝(화면 x) — 말풍선 왼쪽 끝 기준
  const up = top !== undefined; // 위 꼬리 — 말풍선이 말하는 사람 아래에 있을 때(끝 칸: 납작해진 몽글 아래 빈 탁자 앞판)
  const place = up ? { top } : { bottom: 1920 - bottom };
  return (
    <div style={{ position: 'absolute', left: x, ...place, opacity: o, transform: `scale(${p})`, transformOrigin: `${tailLeft}px ${up ? '0%' : '100%'}` }}>
      <div style={{ position: 'relative', background: PAPER, border: `5px solid ${INK}`, borderRadius: 38, padding: '16px 34px 18px', textAlign: 'center', boxShadow: '0 10px 22px rgba(0,0,0,0.25)', maxWidth: Math.max(320, 920 - x), width: 'max-content' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: line.koSize, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{line.ko}</div>
        {read ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: L.readSize, color: READ, lineHeight: 1.2, marginTop: 2 }}>{read}</div> : null}
        {mean ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSize, color: MEAN, lineHeight: lh, marginTop: 4 }}>{mean}</div> : null}
      </div>
      {/* 꼬리 — 말하는 사람을 가리킨다(보통 아래, top을 준 말풍선은 위) */}
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

// 0~1.4초 — 훅 띠(마지막 만두 하나… 누가 먹을까?)
const Hook: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame / FPS >= HOOK_UNTIL) return null;
  const p = interpolate(frame, [0, 5], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, bottom: 1920 - LAYOUT.bottom, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 100%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '16px 22px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 48, color: CREAM, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{HOOK_KO}</div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 42, color: CARD_MEAN, lineHeight: 1.2, marginTop: 6, whiteSpace: 'nowrap' }}>{L.hook}</div>
      </div>
    </div>
  );
};

// 속마음 구름 — 「배불러요」라고 말하는 사람 머리 위의 펠트 만두 생각(글 없음)
const Thought: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const th = THOUGHTS.find((x) => t >= x.from && t < x.to);
  if (!th) return null;
  const sf = fr(th.from);
  const p = interpolate(frame, [sf, sf + 6], [0.6, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const o = interpolate(frame, [sf, sf + 3], [0, 1], clamp);
  const bob = Math.sin((frame - sf) / 6) * 3;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: o }}>
      {th.dots.map(([x, y, r], k) => (
        <div key={k} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: PAPER, border: `4px solid ${INK}`, transform: `scale(${p})` }} />
      ))}
      <div style={{ position: 'absolute', left: th.x, top: th.y + bob, width: 176, height: 140, borderRadius: '50%', background: PAPER, border: `5px solid ${INK}`, boxShadow: '0 8px 18px rgba(0,0,0,0.22)', transform: `scale(${p})`, transformOrigin: '50% 100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Img src={staticFile('img/thought_mandu.jpg')} style={{ width: 118, height: 94, borderRadius: '50%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};

// 「얼마 뒤…」 작은 띠(벽 위)
const Later: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < LATER.from || t >= LATER.to) return null;
  const o = interpolate(frame, [fr(LATER.from), fr(LATER.from) + 4], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 290, textAlign: 'center', opacity: o }}>
      <span style={{ display: 'inline-block', background: CARD_BG, border: `4px solid ${INK}`, borderRadius: 999, padding: '10px 36px 12px', fontFamily: L.font, fontWeight: 800, fontSize: 54, color: CREAM }}>{L.later}</span>
    </div>
  );
};

// 카드 — 탁자 앞판 위 한 줄. 지금 줄만 보인다: 8초 「눈치가 없다 ✗」 → 9.95초 「눈치 = 뜻」(v3: 대리가 「눈치 좀…!」 속삭일 때) → 16.6초 「눈치가 있다 ✓」
// (스캔 조건 ⑴: 몽글이 만두를 집는 칸 위에 「눈치」 한 낱말을 얹지 않는다 — 집은 뒤 정적 칸에 「눈치가 없다」, 뜻은 몽글이 물을 때)
const Card: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  type S = { key: string; at: number; ko: string; mark: string; markColor: string; mean: string; read?: string };
  const states: S[] = [
    { key: 'no', at: ROWS[0].at, ko: ROWS[0].ko, mark: ROWS[0].mark, markColor: '#FF8A7A', mean: L.rows[0] },
    { key: 'head', at: CARD.at, ko: CARD.ko, mark: '', markColor: '#E9DCC6', mean: L.cardMean, read: L.cardRead },
    { key: 'yes', at: ROWS[1].at, ko: ROWS[1].ko, mark: ROWS[1].mark, markColor: '#9FE0A8', mean: L.rows[1] },
  ];
  if (t >= CARD_END) return null;
  let s: S | null = null;
  for (const x of states) if (t >= x.at) s = x;
  if (!s) return null;
  const sf = fr(s.at);
  const p = interpolate(frame, [sf, sf + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, bottom: 1920 - LAYOUT.bottom, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 100%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '16px 28px 20px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        <div style={{ whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 70, color: CREAM, lineHeight: 1.1 }}>{s.ko}</span>
          {s.read ? <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 46, color: '#E9DCC6', marginLeft: 14 }}>{s.read}</span> : null}
          <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 62, color: s.markColor, marginLeft: 16 }}>{s.mark}</span>
        </div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.rowSize, color: CARD_MEAN, lineHeight: 1.2, marginTop: 4 }}>{s.mean}</div>
      </div>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.1 * MASTER} endAt={fr(TOTAL)} />{/* 식당 방 소리 */}
    {LINES.map((l) => (
      <Sequence key={l.vo} from={fr(l.voAt)} layout="none">
        <Audio src={staticFile(`vo/${l.vo}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 nunchi-<KEY>로 넘긴다
// bare = 장면 심사용(글 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#c9a37a' }}>
      <Plate i={i} />
      <Thought />
      {bare ? null : (
        <>
          <Hook L={L} />
          <Later L={L} />
          <Card L={L} />
          <Bubble i={i} L={L} />
        </>
      )}
      <Sound />
    </AbsoluteFill>
  );
};
