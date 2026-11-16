// LAB 몽골 M59 「1000/50이 뭐예요?」(11-16 곁 세션 lab-mn-21) — 원본 같은분야 「한국의 집 종류와 월세」의 뼈대(집 이름표 + 월세 → 내려가다 고시원).
// 그림은 칸마다 그 장면의 기준 판(gA · gB · gC)을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 장면마다 배율을 달리해 1080×1920 화면 판으로 짠 것.
// 카메라는 같은 판을 전체(W) · 사무실 몽글 쪽(MB) · 고시원 몽글 얼굴 가까이(MC)로 바로 바꿔 자른다(칸 안에서는 아주 천천히 다가감).
// 화면 글: ① 말풍선 — 말하는 사람 위(한국어 + 읽는 법 + 그 나라 뜻) ② 카드 — 아래 한 장(0~1.7초 훅 띠, 4.5초 보증금 · 월세 두 줄, 12.4초 고시원).
// 글자 안전선 안(65~920 · 269~1428px). 판본 틀: 뜻 · 읽기 · 카드 뜻 · 훅 띠는 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CAMS, CELLS, CMP, FPS, GOSI, HOOK_KO, HOOK_UNTIL, LINES, NOPE, ROWS, ROWS_END, SFX, TOTAL } from './data';
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
const NUM = '#FF9A85'; // 카드의 숫자 — 창의 「1000/50」과 잇는 산호색
// 카드 자리 — 아래 끝을 1420px에 붙이고 위로 자란다(안전선 아래 끝 1428)
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
  const up = top !== undefined; // 위 꼬리 — 말풍선이 말하는 사람 아래에 있을 때
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

// 0~1.7초 — 훅 띠(1000/50이 뭐예요?)
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

// 보증금 · 월세 카드 — 책상 앞판 위. 중개사가 「보증금 천에,」 할 때 첫 줄, 「월세 오십이요~」 할 때 둘째 줄이 뜬다.
// 줄마다 창의 숫자(산호색) = 한국어 + 낱말 읽는 법, 아래에 그 나라 뜻(한 줄 — 두 줄로 넘치면 카드가 자라 몽글을 덮는다).
const Rows: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < ROWS[0].at || t >= ROWS_END) return null;
  const sf = fr(ROWS[0].at);
  const p = interpolate(frame, [sf, sf + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, bottom: 1920 - LAYOUT.bottom, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 100%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '12px 28px 14px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        {ROWS.map((r, k) => {
          const rf = fr(r.at);
          const o = interpolate(frame, [rf, rf + 4], [0, 1], clamp);
          const y = interpolate(frame, [rf, rf + 6], [10, 0], { ...clamp, easing: Easing.out(Easing.quad) });
          return (
            <div key={k} style={{ opacity: o, transform: `translateY(${y}px)`, marginTop: k ? 6 : 0 }}>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 56, color: NUM, lineHeight: 1.1 }}>{r.lead}</span>
                <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 48, color: '#E9DCC6', margin: '0 12px' }}>=</span>
                <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 54, color: CREAM, lineHeight: 1.1 }}>{r.ko}</span>
                <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 34, color: '#E9DCC6', marginLeft: 12 }}>{L.rowReads[k]}</span>
              </div>
              <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.rowSize, color: CARD_MEAN, lineHeight: 1.2, marginTop: 2 }}>{L.rows[k]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 고시원 카드 — 중개사가 「고시원!」이라고 말하는 박에 떠서 문이 열린 복도까지(바닥 위)
const Gosi: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < GOSI.at || t >= GOSI.end) return null;
  const sf = fr(GOSI.at);
  const p = interpolate(frame, [sf, sf + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, bottom: 1920 - LAYOUT.bottom, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 100%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '12px 28px 14px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        <div style={{ whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 62, color: CREAM, lineHeight: 1.1 }}>{GOSI.ko}</span>
          <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 42, color: '#E9DCC6', marginLeft: 14 }}>{L.gosiRead}</span>
        </div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.rowSize, color: CARD_MEAN, lineHeight: 1.2, marginTop: 4 }}>{L.gosiMean}</div>
      </div>
    </div>
  );
};

// 끝 비교 카드 — 위(벽 자리). 「아까 집 1000/50」 「고시원 0/50」 두 꼬리표를 나란히, 월세 숫자만 산호색, 아래에 그 나라 뜻 한 줄
const Compare: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame / FPS < CMP.at) return null;
  const sf = fr(CMP.at);
  const p = interpolate(frame, [sf, sf + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, top: 272, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '14px 22px 16px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18 }}>
          {CMP.tags.map((g, k) => (
            <div key={k} style={{ background: 'rgba(255,244,222,0.12)', border: '3px solid rgba(255,244,222,0.5)', borderRadius: 22, padding: '6px 22px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
              <div>
                <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 40, color: CREAM }}>{g.name}</span>
                <span style={{ fontFamily: L.font, fontWeight: 700, fontSize: 32, color: '#E9DCC6', marginLeft: 10 }}>{L.cmpNames[k]}</span>
              </div>
              <div style={{ lineHeight: 1.05 }}>
                <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 64, color: CREAM }}>{g.dep}/</span>
                <span style={{ fontFamily: EN, fontWeight: 800, fontSize: 64, color: NUM }}>{g.rent}</span>
              </div>
            </div>
          ))}
        </div>
        {frame >= fr(CMP.meanAt) ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.rowSize, color: CARD_MEAN, lineHeight: 1.2, marginTop: 8, opacity: interpolate(frame, [fr(CMP.meanAt), fr(CMP.meanAt) + 4], [0, 1], clamp) }}>{L.cmpMean}</div> : null}
      </div>
    </div>
  );
};

// 계산기 「20」 위 빨간 ✗ — 몽글의 답이 틀렸다(글 없이 그림으로)
const Nope: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < NOPE.at || t >= NOPE.end) return null;
  const sf = fr(NOPE.at);
  const p = interpolate(frame, [sf, sf + 4], [1.6, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const n = NOPE.size;
  return (
    <svg width={n} height={n} style={{ position: 'absolute', left: NOPE.x - n / 2, top: NOPE.y - n / 2, transform: `scale(${p})` }}>
      <path d={`M${n * 0.16} ${n * 0.16} L${n * 0.84} ${n * 0.84} M${n * 0.84} ${n * 0.16} L${n * 0.16} ${n * 0.84}`} stroke={INK} strokeWidth={n * 0.2} strokeLinecap="round" />
      <path d={`M${n * 0.16} ${n * 0.16} L${n * 0.84} ${n * 0.84} M${n * 0.84} ${n * 0.16} L${n * 0.16} ${n * 0.84}`} stroke="#E8432F" strokeWidth={n * 0.13} strokeLinecap="round" />
    </svg>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
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

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 bojeung-<KEY>로 넘긴다
// bare = 장면 심사용(글 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#c9a37a' }}>
      <Plate i={i} />
      {bare ? null : (
        <>
          <Hook L={L} />
          <Rows L={L} />
          <Gosi L={L} />
          <Compare L={L} />
          <Nope />
          <Bubble i={i} L={L} />
        </>
      )}
      <Sound />
    </AbsoluteFill>
  );
};
