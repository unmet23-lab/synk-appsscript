// LAB 몽골 M44 「눈 + 물 = 눈물?」(11-16 곁 세션 lab-mn-21) — 원본 우리편 M24 「물고기」의 뼈대(낱말 A · B → 합침 → 진짜 뜻 → 둘째 세트 → 끝 반전).
// 그림은 칸마다 기준 판 gD를 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 1080×1920 화면 판으로 짠 것. 카메라는 고정(칸 안에서 아주 천천히 다가감).
// 화면 글: ① 말풍선 — 몽글 위 하늘 · 언덕(한국어 + 읽는 법 + 그 나라 뜻) ② 카드 — 아래 한 장(0~1.8초 훅 띠, 낱말 카드 셋).
// 글자 안전선 안(65~920 · 269~1428px). 판본 틀: 뜻 · 읽기 · 카드 뜻 · 훅 띠는 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CAMS, CARDS, CELLS, END, FPS, HOOK_KO, HOOK_UNTIL, LINES, NOPE, SFX, TOTAL } from './data';
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
// 카드 자리 — 위 끝을 290px에 붙이고 아래로 자란다(안전선 위 끝 269)
export const LAYOUT = { left: 80, width: 830, top: 290 }; // v3: 위 하늘에 — 1.25배 판에서 몽글과 웅덩이가 화면 아래 절반을 채운다

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

// 0~1.8초 — 훅 띠(눈 + 물 = 눈물?)
const Hook: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame / FPS >= HOOK_UNTIL) return null;
  const p = interpolate(frame, [0, 5], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, top: LAYOUT.top, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '16px 22px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 48, color: CREAM, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{HOOK_KO}</div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 42, color: CARD_MEAN, lineHeight: 1.2, marginTop: 6, whiteSpace: 'nowrap' }}>{L.hook}</div>
      </div>
    </div>
  );
};

// 낱말 카드 — 아래 한 장. 한 번에 하나만(눈 + 사람 = 눈사람 → 눈 + 물 = 눈물? → 눈 + 물 = 눈물).
// 한국어 식 + 읽는 법, 아래에 그 나라 뜻(판본 cardReads · cardMeans).
const Cards: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const k = CARDS.findIndex((c) => t >= c.at && t < c.end);
  if (k < 0) return null;
  const c = CARDS[k];
  const sf = fr(c.at);
  const p = interpolate(frame, [sf, sf + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, top: LAYOUT.top, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 0%' }}>
      <div style={{ position: 'relative', background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '12px 28px 14px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        {k === 1 && t >= NOPE.at ? <Nope /> : null}
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 60, color: CREAM, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{c.ko}</div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 40, color: '#E9DCC6', lineHeight: 1.2, marginTop: 2 }}>{L.cardReads[k]}</div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.rowSize, color: CARD_MEAN, lineHeight: 1.2, marginTop: 4 }}>{L.cardMeans[k]}</div>
      </div>
    </div>
  );
};

// 빨간 ✗ — 「눈 + 물 = 눈물?」 카드 한가운데(v5). 몽글의 짐작이 틀렸다는 표시 — 바로 다음 카드가 진짜 뜻(눈 👁️ + 물)
const Nope: React.FC = () => {
  const frame = useCurrentFrame();
  const sf = fr(NOPE.at);
  const p = interpolate(frame, [sf, sf + 4], [1.6, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const n = NOPE.size;
  const d = `M${n * 0.16} ${n * 0.16} L${n * 0.84} ${n * 0.84} M${n * 0.84} ${n * 0.16} L${n * 0.16} ${n * 0.84}`;
  return (
    <svg width={n} height={n} style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -n / 2, marginTop: -n / 2, transform: `scale(${p})`, zIndex: 2 }}>
      <path d={d} stroke={INK} strokeWidth={n * 0.2} strokeLinecap="round" />
      <path d={d} stroke="#E8432F" strokeWidth={n * 0.13} strokeLinecap="round" />
    </svg>
  );
};

// 끝 카드 — 위. 「눈 ❄️ цас」 「눈 👁️ нүд」 두 꼬리표를 제목 크기로 나란히, 아래에 그 나라 말 한 줄(한 낱말, 두 뜻)
const End: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame / FPS < END.at) return null;
  const sf = fr(END.at);
  const p = interpolate(frame, [sf, sf + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2.4)) });
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, top: LAYOUT.top, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: CARD_BG, border: `5px solid ${INK}`, borderRadius: 40, padding: '14px 22px 16px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 22 }}>
          {END.tags.map((g, k) => (
            <div key={k} style={{ background: 'rgba(255,244,222,0.12)', border: '3px solid rgba(255,244,222,0.5)', borderRadius: 24, padding: '4px 24px 8px', whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 72, color: CREAM }}>{g.ko}</span>
              <span style={{ fontSize: 56, marginLeft: 8 }}>{g.icon}</span>
              <span style={{ fontFamily: L.font, fontWeight: 800, fontSize: 46, color: CARD_MEAN, marginLeft: 12 }}>{L.endNames[k]}</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 44, color: CREAM, lineHeight: 1.2, marginTop: 8 }}>{L.endMean}</div>
      </div>
    </div>
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

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 nunmul-<KEY>로 넘긴다
// bare = 장면 심사용(글 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#c9a37a' }}>
      <Plate i={i} />
      {/* 판 겹침 — xf를 준 칸은 앞 칸 판이 그 위에서 서서히 사라진다(눈사람 몸통이 녹아 없어지는 사이) */}
      {i > 0 && CELLS[i].xf && frame < fr(CELLS[i].at + (CELLS[i].xf ?? 0)) ? (
        <AbsoluteFill style={{ opacity: interpolate(frame, [fr(CELLS[i].at), fr(CELLS[i].at + (CELLS[i].xf ?? 0))], [1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) }) }}>
          <Plate i={i - 1} />
        </AbsoluteFill>
      ) : null}
      {/* 아래 그늘 — 판 아래를 늘여 이은 땅(1468px~)이 얼룩처럼 보이지 않게 아래로 갈수록 어둡게 덮는다(장면 심사 v2 「아래 35~40%가 세로로 번진 얼룩」) */}
      {/* v6: 미학 맹검(GPT) 「아래 3분의 1이 어두운 회색으로 눌려 풀과 물이 탁하다」 — 76%부터 옅게 */}
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 76%, rgba(24,30,22,0.2) 88%, rgba(24,30,22,0.34) 100%)' }} />
      {bare ? null : (
        <>
          <Hook L={L} />
          <Cards L={L} />
          <End L={L} />
          <Bubble i={i} L={L} />
        </>
      )}
      <Sound />
    </AbsoluteFill>
  );
};
