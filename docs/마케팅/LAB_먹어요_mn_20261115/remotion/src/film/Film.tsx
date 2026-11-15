// LAB 몽골 M53 「먹어요」(11-15 15시 회차) — 우리편 원본 M27 「벗어요」(20초) 뼈대, 밤 분식집 계산대 한 장면(고정 카메라).
// 그림은 칸마다 기준 판(g1)을 참고로 구운 한 장을 판/_판짜기.py가 1080×1920 화면 판으로 미리 짠 것 — 칸은 박자에 바로 바뀐다.
// 화면 글: 맨 위(벽)에 머리 카드 하나 — 훅 · 물음 · 가장 새 낱말 상자(한국어 + 키릴 읽기 · 몽골 뜻) · 반전 앞 물음 · 끝 정리 표가 차례로 바뀐다.
// v2(이해 시험 v1): 계산대 앞 작은 칩을 빼고 끝 정리 표(한국어는 다 「먹어요」, 몽골 뜻이 매번 다름)로 한 번에 보인다.
// 계산대 앞 띠에는 한국어 대사 넷의 자막(한국어 + 그 나라 뜻)이 뜬다.
// 판본 틀(11-10): 머리 글 · 읽는 법 · 뜻 · 끝 줄은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { BOXES, CELLS, END_AT, FPS, HOOK_TO, PUNCH, Q_TO, SETUP, SFX, SHAKE, SUBS, TOTAL, VO } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 진한 산호
const READ = '#5A4A3E';
const PAPER = '#FFFDF7';
// 자리(1080×1920 화면 판 기준)
export const LAYOUT = {
  top: 236, // 머리 카드 위 끝(앱 위 글자 자리 밑)
  subTop: 1300, // 계산대 앞면 — 대사 자막 띠(앱 아래 글자 자리 1428px 위)
};

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

const Plate: React.FC<{ src: string; push: number; dx: number; dy: number; zoom?: { s: number; x: number; y: number }; origin: string }> = ({ src, push, dx, dy, zoom, origin }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a211a' }}>
    <Img
      src={staticFile(`img/${src}`)}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1080,
        height: 1920,
        transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : origin,
        transform: `translate(${dx}px, ${dy}px) scale(${push * (zoom ? zoom.s : 1)})`,
      }}
    />
  </AbsoluteFill>
);

// 맨 위 머리 카드 — 지금 무엇을 보일지 고른다
type Head = { key: string; at: number; kind: 'text'; text: string; size: number } | { key: string; at: number; kind: 'box'; i: number } | { key: string; at: number; kind: 'table' };
const headAt = (sec: number, L: LocPack): Head | null => {
  if (sec < HOOK_TO) return { key: 'hook', at: 0, kind: 'text', text: L.hook, size: L.hookSize };
  if (sec < Q_TO) return { key: 'q', at: HOOK_TO, kind: 'text', text: L.q, size: L.qSize };
  if (sec >= END_AT) return { key: 'end', at: END_AT, kind: 'table' };
  if (sec >= SETUP.from && sec < SETUP.to) return { key: 'setup', at: SETUP.from, kind: 'text', text: L.setup, size: L.setupSize };
  let b = -1;
  BOXES.forEach((x, k) => {
    if (sec >= x.at) b = k;
  });
  return b >= 0 ? { key: `box${b}`, at: BOXES[b].at, kind: 'box', i: b } : null;
};

const HeadCard: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const h = headAt(frame / FPS, L);
  if (!h) return null;
  const big = h.kind === 'box' && h.i === BOXES.length - 1; // 반전 상자는 더 크게 튀어나온다
  const p = interpolate(frame, [fr(h.at), fr(h.at) + (big ? 7 : 5)], [big ? 0.6 : 0.88, 1], { ...clamp, easing: Easing.out(Easing.back(big ? 2.6 : 2)) });
  if (h.kind === 'table') return <EndTable L={L} at={h.at} />;
  const inner =
    h.kind === 'text' ? (
      <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: h.size, color: INK, lineHeight: Math.max(1.16, L.lineH), whiteSpace: 'pre-line' }}>{h.text}</div>
    ) : (
      <>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: big ? 92 : 80, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
          {BOXES[h.i].obj} <span style={{ color: CORAL }}>{BOXES[h.i].verb}</span>
        </div>
        <div style={{ marginTop: 8, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: L.font, fontWeight: 700, fontSize: L.readSize, color: READ }}>{L.reads[h.i]}</span>
          <span style={{ fontFamily: L.font, fontWeight: 700, fontSize: L.readSize, color: READ }}> · </span>
          <span style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSizes[h.i], color: MEAN }}>{L.means[h.i]}</span>
        </div>
      </>
    );
  return (
    <div style={{ position: 'absolute', top: LAYOUT.top, left: 40, width: 880, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          display: 'inline-block',
          maxWidth: 880, // v5: 오른쪽 단추 자리(920px) 안 — 올리기 전 검사 12초 「오른쪽 끝 992px」
          textAlign: 'center',
          background: PAPER,
          border: `6px solid ${big ? CORAL : INK}`,
          borderRadius: 40,
          padding: '18px 40px 20px',
          boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
          transform: `scale(${p})`,
          transformOrigin: '50% 0%',
        }}
      >
        {inner}
      </div>
    </div>
  );
};

// 끝 정리 표(18.4초~) — 네 상자가 한 표로: 한국어는 다 「먹어요」, 그 나라 뜻은 매번 다르다. 오른쪽 사장님 얼굴을 덮지 않게 왼쪽에 붙인다.
const EndTable: React.FC<{ L: LocPack; at: number }> = ({ L, at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [fr(at), fr(at) + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', top: LAYOUT.top, left: 40, transform: `scale(${p})`, transformOrigin: '0% 0%' }}>
      <div style={{ background: PAPER, border: `6px solid ${CORAL}`, borderRadius: 36, padding: '16px 30px 18px', boxShadow: '0 10px 28px rgba(0,0,0,0.28)' }}>
        {BOXES.map((b, k) => {
          const q = interpolate(frame, [fr(at) + k * 3, fr(at) + k * 3 + 5], [0, 1], clamp);
          return (
            <div key={k} style={{ whiteSpace: 'nowrap', lineHeight: 1.18, opacity: q, transform: `translateX(${(1 - q) * -20}px)` }}>
              <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 52, color: INK }}>
                {b.obj} <span style={{ color: CORAL }}>먹어요</span>
              </span>
              <span style={{ fontFamily: L.font, fontWeight: 700, fontSize: 42, color: READ }}> = </span>
              <span style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.chipSize, color: MEAN }}>{L.chips[k]}</span>
            </div>
          );
        })}
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, color: INK, lineHeight: Math.max(1.16, L.lineH), marginTop: 8, whiteSpace: 'pre-line' }}>{L.endLine}</div>
      </div>
    </div>
  );
};

// 대사 자막 띠(v2) — 한국어 대사 + 그 나라 뜻(꼬리 없이 — 띠와 떨어져 떠 보였다)
const Subs: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const k = SUBS.findIndex((x) => sec >= x.at && sec < x.to);
  if (k < 0) return null;
  const s = SUBS[k];
  const q = interpolate(frame, [fr(s.at), fr(s.at) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <>
      <div style={{ position: 'absolute', top: LAYOUT.subTop, left: 50, width: 860, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'inline-block', textAlign: 'center', background: PAPER, border: `5px solid ${INK}`, borderRadius: 30, padding: '8px 28px 10px', boxShadow: '0 6px 16px rgba(0,0,0,0.25)', transform: `scale(${q})` }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 50, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{s.ko}</div>
          <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.subSize, color: MEAN, lineHeight: Math.max(1.12, L.lineH), whiteSpace: 'nowrap' }}>{L.subs[k]}</div>
        </div>
      </div>
    </>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.1 * MASTER} endAt={fr(TOTAL)} />
    {VO.map(([v, t]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 meog-<KEY>로 넘긴다
// bare = 장면 심사용(글 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  const c = CELLS[i];
  const s0 = fr(SHAKE.at);
  const shake = frame >= s0 && frame < fr(SHAKE.to) ? Math.sin((frame - s0) * 2.3) * SHAKE.px * (1 - (frame - s0) / (fr(SHAKE.to) - s0)) : 0;
  const p0 = fr(PUNCH.at);
  const punch = 1 + PUNCH.amt * interpolate(frame, [p0, p0 + 3, p0 + 14], [0, 1, 0], clamp);
  const nextAt = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const push0 = interpolate(frame, [fr(c.at), fr(nextAt)], [1.02, 1.05], clamp);
  // 김 칸은 구름이 부풀며 출렁인다(장면 심사 v1) — 펑 하고 커졌다가 숨 쉬듯
  const pf = frame - fr(c.at);
  const push = c.puff ? push0 * (1 + 0.06 * interpolate(pf, [0, 4], [1, 0], clamp) + 0.025 * Math.sin(pf * 0.55)) : push0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a211a' }}>
      <AbsoluteFill style={{ transformOrigin: PUNCH.origin, transform: `scale(${punch})` }}>
        <Plate src={c.img} push={push} dx={shake} dy={shake * 0.5} zoom={c.zoom} origin={c.puff ? '32% 55%' : '40% 55%'} />
      </AbsoluteFill>
      {bare ? null : <Subs L={L} />}
      {bare ? null : <HeadCard L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
