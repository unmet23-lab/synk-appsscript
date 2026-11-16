// LAB 몽골 M55 「단디」(11-16 곁 세션 lab-mn-21) — 원본 같은분야 「Seoul Korean vs Busan Korean」 앞 15.3초의 뼈대(이름표 둘 → 같은 말 짝 주고받기).
// 그림은 칸마다 기준 판(g1)을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 탁자 선을 맞춰 1080×1920 화면 판으로 짠 것.
// 카메라는 원본의 두 사람 번갈아 컷처럼 같은 판을 동료 쪽(L) · 반장님 쪽(R) · 전체(W) · 몽글(C)로 바로 바꿔 자른다(칸 안에서는 아주 천천히 다가감).
// 화면 글: 탁자 앞판 위 자막 판 하나(이름표 알약 + 그 나라 뜻 + 큰 한국어 + 읽는 법) — 원본의 이름표 · 자막 자리. 글자 안전선 안(65~920 · 269~1428px).
// 판본 틀(11-10): 이름표 · 뜻 · 읽는 법 · 속말 · 끝 질문은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CAMS, CELLS, FPS, LINES, SFX, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const PLATE = 'rgba(38, 32, 30, 0.9)';
const CREAM = '#FFF4DE';
const MEAN = '#FFB9A8'; // 뜻 줄 — 어두운 판 위 연한 산호
const READ = '#E9DCC6';
const SEOUL = '#A9D8B8'; // 동료 조끼 민트
const GYEONG = '#E8503D'; // 산호
// 자막 판 자리 — 아래 끝을 1420px에 붙이고 글이 많으면 위로 자란다(v8: 올리기 전 검사 「아래 앱 글자 자리」 — 위에 붙였을 때 세 줄 판의 읽기 줄이 1436~1488px로 안전선 1428px을 넘었다)
export const LAYOUT = { left: 80, width: 830, bottom: 1420 };

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 판 — 칸마다 카메라 자리로 바로 바뀌고, 칸 안에서 1.5% 다가간다(좌상단 기준 변환 — 판 밖이 보이지 않게 자리를 판 안으로 묶는다)
const Plate: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  const cam = CAMS[c.cam];
  const end = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const push = interpolate(frame, [fr(c.at), fr(end)], [0, c.push ?? 0.015], { ...clamp, easing: Easing.out(Easing.quad) });
  const z = cam.z * (1 + push);
  // 다가가는 만큼 가운데 쪽으로 — 판 밖이 드러나지 않게 tx ∈ [1080 − 1080z, 0], ty ∈ [1920 − 1920z, 0]
  const tx = Math.min(0, Math.max(1080 - 1080 * z, cam.tx - 540 * cam.z * push));
  const ty = Math.min(0, Math.max(1920 - 1920 * z, cam.ty - 960 * cam.z * push));
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#8a8580' }}>
      <Img src={staticFile(`img/${c.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` }} />
    </AbsoluteFill>
  );
};

const Pill: React.FC<{ k: number; L: LocPack }> = ({ k, L }) => (
  <div style={{ position: 'absolute', left: 24, top: -(L.pillSize + 6) }}>{/* v8: 미학 맹검 · 이해 시험 v6 · v7 「작은 이름표를 못 읽음」 — 40 → 48px */}
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 12,
        background: k === 0 ? SEOUL : GYEONG,
        color: k === 0 ? INK : '#FFFFFF',
        border: `5px solid ${INK}`,
        borderRadius: 999,
        padding: '6px 26px 8px',
        boxShadow: '0 6px 14px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontFamily: KO, fontWeight: 800, fontSize: L.pillSize + 2 }}>{k === 0 ? '서울 말' : '경상도 말'}</span>
      <span style={{ fontFamily: L.font, fontWeight: 700, fontSize: L.pillSize - 4, opacity: 0.92 }}>· {L.pills[k]}</span>
    </div>
  </div>
);

const Sub: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  if (c.sub < 0) return null;
  // 같은 줄이 이어지는 칸은 판을 다시 튀기지 않는다
  let first = i;
  while (first > 0 && CELLS[first - 1].sub === c.sub && CELLS[first - 1].pill === c.pill) first--;
  const startAt = CELLS[first].at;
  const p = interpolate(frame, [fr(startAt), fr(startAt) + 4], [0.92, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const line = LINES[c.sub];
  // 목소리에 맞춰 한국어가 한 번 톡 커진다
  const voF = line.voAt !== undefined ? fr(line.voAt) : -999;
  const beat = interpolate(frame, [voF, voF + 3, voF + 9], [0, 1, 0], clamp);
  const mean = L.means[c.sub];
  const read = L.reads[c.sub];
  const lh = Math.max(1.15, L.lineH);
  const body = (
    <>
      {mean ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSize, color: MEAN, lineHeight: lh, whiteSpace: 'pre-line', marginBottom: 4 }}>{mean}</div> : null}
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: line.koSize, color: CREAM, lineHeight: 1.1, transform: `scale(${1 + 0.07 * beat})` }}>{line.ko}</div>
      {read ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: L.readSize, color: READ, lineHeight: 1.2, marginTop: 4, whiteSpace: 'nowrap' }}>{read}</div> : null}
    </>
  );
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, bottom: 1920 - LAYOUT.bottom, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 100%' }}>
      <div style={{ background: PLATE, border: `5px solid ${INK}`, borderRadius: 40, padding: c.pill >= 0 ? '30px 34px 18px' : '18px 34px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>{body}</div>
      {c.pill >= 0 ? <Pill k={c.pill} L={L} /> : null}
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/factory.wav')} volume={0.12 * MASTER} endAt={fr(TOTAL)} />
    {LINES.filter((l) => l.vo).map((l) => (
      <Sequence key={l.vo} from={fr(l.voAt as number)} layout="none">
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

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 dandi-<KEY>로 넘긴다
// bare = 장면 심사용(자막 판 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#8a8580' }}>
      <Plate i={i} />
      {bare ? null : <Sub i={i} L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
