// LAB 몽골 M43 「붙다」(11-16 15시 회차) — 원본 같은분야 「야구 우승 반지가 뭔데?」 28.4초의 뼈대(위 고정 질문 → 사실 쌓기 → 가장 센 장면 → 묻기 → 첫 장면).
// 그림은 칸마다 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 1080×1920 화면 판으로 짠 것. 카메라는 같은 판을 당겨 박자를 만든다(칸 안에서는 아주 천천히 다가감).
// 화면 글: 위 고정 질문 판(한국어 「엿을 왜 붙일까?」 + 그 나라 말 — 원본의 위 고정 제목 자리, 끝에는 끝 질문으로 바뀜)과
// 아래 자막 판 하나(그 나라 뜻 + 큰 한국어 + 읽는 법). 글자 안전선 안(65~920 · 269~1428px).
// 판본 틀(11-10): 위 질문 · 뜻 · 읽는 법 · 끝 질문은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
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
const GOLD = '#F2B544'; // 엿 빛
export const LAYOUT = { left: 80, width: 830, bottom: 1420 };
const ASK_AT = 18.77;

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 판 — 칸마다 카메라 자리로 바로 바뀌고, 칸 안에서 5% 다가간다(이해 시험 v1 볼 이유 「1.5~6초가 거의 안 움직인다」 — 2%에서 올림). 철썩 칸은 첫 0.3초 화면이 흔들린다
const Plate: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  const cam = CAMS[c.cam];
  const end = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const push = interpolate(frame, [fr(c.at), fr(end)], [0, 0.05], { ...clamp, easing: Easing.out(Easing.quad) });
  const z = cam.z * (1 + push);
  let tx = Math.min(0, Math.max(1080 - 1080 * z, cam.tx - 540 * cam.z * push));
  let ty = Math.min(0, Math.max(1920 - 1920 * z, cam.ty - 960 * cam.z * push));
  let zz = z;
  if (c.shake && frame < fr(c.at + 0.3)) {
    const k = 1 - (frame - fr(c.at)) / fr(0.3);
    zz = z * (1 + 0.03 * k);
    tx = Math.min(0, Math.max(1080 - 1080 * zz, tx - 540 * z * 0.03 * k + (random(`sx-${frame}`) - 0.5) * 22 * k));
    ty = Math.min(0, Math.max(1920 - 1920 * zz, ty - 960 * z * 0.03 * k + (random(`sy-${frame}`) - 0.5) * 22 * k));
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#8a8580' }}>
      <Img src={staticFile(`img/${c.img}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${zz})` }} />
    </AbsoluteFill>
  );
};

// 위 고정 질문 — 원본의 위 고정 제목 자리. 끝(ASK_AT)부터는 끝 질문으로 바뀐다
const Head: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const ask = frame >= fr(ASK_AT);
  const p = ask ? interpolate(frame, [fr(ASK_AT), fr(ASK_AT) + 5], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }) : 1;
  const lh = Math.max(1.15, L.lineH);
  return (
    <div style={{ position: 'absolute', top: 285, left: 80, width: 830, display: 'flex', justifyContent: 'center', transform: `scale(${p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: PLATE, border: `5px solid ${INK}`, borderRadius: 36, padding: '14px 30px 16px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        {ask ? (
          <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.askSize, color: CREAM, lineHeight: lh, whiteSpace: 'pre-line' }}>{L.ask}</div>
        ) : (
          <>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 64, color: GOLD, lineHeight: 1.1 }}>엿을 왜 붙일까?</div>
            <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: L.headSize, color: CREAM, lineHeight: lh, marginTop: 6, whiteSpace: 'pre-line' }}>{L.head}</div>
          </>
        )}
      </div>
    </div>
  );
};

const Sub: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  if (c.sub < 0) return null;
  // 같은 줄이 이어지는 칸은 판을 다시 튀기지 않는다
  let first = i;
  while (first > 0 && CELLS[first - 1].sub === c.sub) first--;
  const startAt = CELLS[first].at;
  const p = interpolate(frame, [fr(startAt), fr(startAt) + 4], [0.92, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const line = LINES[c.sub];
  // 목소리에 맞춰 한국어가 한 번 톡 커진다
  const voF = line.voAt !== undefined ? fr(line.voAt) : -999;
  const beat = interpolate(frame, [voF, voF + 3, voF + 9], [0, 1, 0], clamp);
  const mean = L.means[c.sub];
  const read = L.reads[c.sub];
  const lh = Math.max(1.15, L.lineH);
  return (
    <div style={{ position: 'absolute', left: LAYOUT.left, bottom: 1920 - LAYOUT.bottom, width: LAYOUT.width, transform: `scale(${p})`, transformOrigin: '50% 100%' }}>
      <div style={{ background: PLATE, border: `5px solid ${INK}`, borderRadius: 40, padding: '18px 30px 18px', textAlign: 'center', boxShadow: '0 10px 26px rgba(0,0,0,0.32)' }}>
        {mean ? <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSize, color: MEAN, lineHeight: lh, whiteSpace: 'pre-line', marginBottom: 4 }}>{mean}</div> : null}
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: line.koSize, color: CREAM, lineHeight: 1.1, transform: `scale(${1 + 0.07 * beat})` }}>{line.ko}</div>
        {read ? <div style={{ fontFamily: EN, fontWeight: 700, fontSize: L.readSize, color: READ, lineHeight: 1.2, marginTop: 4, whiteSpace: 'nowrap' }}>{read}</div> : null}
      </div>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.1 * MASTER} endAt={fr(TOTAL)} />
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

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 butda-<KEY>로 넘긴다
// bare = 장면 심사용(글 판 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#8a8580' }}>
      <Plate i={i} />
      {bare ? null : (
        <>
          <Head L={L} />
          <Sub i={i} L={L} />
        </>
      )}
      <Sound />
    </AbsoluteFill>
  );
};
