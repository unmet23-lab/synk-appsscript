// LAB 몽골 M69 「써요」(11-21 07시 회차) — 우리편 원본 M53 「먹어요」(21.3초) 뼈대, 작은 펠트 모자 가게 계산대 한 장면(고정 카메라).
// 그림은 칸마다 기준 판(h1)을 참고로 구운 한 장을 판/_판짜기.py가 1080×1920 화면 판으로 미리 짠 것 — 칸은 박자에 바로 바뀐다.
// 화면 글: 맨 위(빈 펠트 벽)에 머리 카드 하나 — 훅 · 물음 · 가장 새 낱말 상자(한국어 + 키릴 읽기 · 몽골 뜻) · 반전 앞 물음 · 끝 정리 표가 차례로 바뀐다.
// M53과 다른 점: 대사는 계산대 앞 띠가 아니라 말한 사람 머리 위 말풍선(꼬리가 입 쪽 — 교훈 L21)이다. 계산대 앞면이 화면 아래 글자 자리(1428px) 밖이라서다.
// 색: 한국어 낱말 「써요」는 호박색, 몽골 뜻은 남색 — 맞음 · 틀림이 아닌 강조라 빨강 · 초록을 쓰지 않는다(올리기 전 검사 ㉒).
// 판본 틀(11-10): 머리 글 · 읽는 법 · 뜻 · 끝 줄 · 말풍선 뜻은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { BOXES, CELLS, END_AT, FPS, HOOK_TO, PUNCH, Q_TO, SETUP, SFX, SHAKES, SUBS, TOTAL, VERB_PLAIN, VO } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const VERB = '#C26A00'; // 한국어 「써요」 — 진한 호박색
const MEAN = '#2F4BA0'; // 몽골 뜻 — 남색
const READ = '#5A4A3E';
const PAPER = '#FFFDF7';
// 자리(1080×1920 화면 판 기준)
export const LAYOUT = {
  top: 272, // 머리 카드 위 끝(앱 위 글자 자리 269px 밑 — 올리기 전 검사 v2 「위 끝 254px」)
};
// 말풍선 자리 — R: 점원 머리 위(꼬리 끝 x 860 · y 700), L: 몽글 머리 위(꼬리 끝 x 210 · y 990)
const BUBBLE = {
  R: { right: 160, top: 540, tailX: 0.82, tailLen: 70 },
  L: { left: 70, top: 820, tailX: 0.28, tailLen: 80 },
} as const;

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
          {BOXES[h.i].obj} <span style={{ color: VERB }}>{BOXES[h.i].verb}</span>
        </div>
        <div style={{ marginTop: 8, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: L.font, fontWeight: 700, fontSize: L.readSize, color: READ }}>{L.reads[h.i]}</span>
          <span style={{ fontFamily: L.font, fontWeight: 700, fontSize: L.readSize, color: READ }}> · </span>
          <span style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.meanSizes[h.i], color: MEAN }}>{L.means[h.i]}</span>
        </div>
      </>
    );
  return (
    <div style={{ position: 'absolute', top: LAYOUT.top, left: 60, width: 860, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          display: 'inline-block',
          maxWidth: 860, // 오른쪽 단추 자리(920px) 안
          textAlign: 'center',
          background: PAPER,
          border: `6px solid ${big ? VERB : INK}`,
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

// 끝 정리 표(18.4초~) — 네 상자가 한 표로: 한국어는 다 「써요」, 그 나라 뜻은 매번 다르다.
const EndTable: React.FC<{ L: LocPack; at: number }> = ({ L, at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [fr(at), fr(at) + 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', top: LAYOUT.top, left: 60, width: 860, display: 'flex', justifyContent: 'center', transform: `scale(${p})`, transformOrigin: '50% 0%' }}>
      <div style={{ background: PAPER, border: `6px solid ${VERB}`, borderRadius: 36, padding: '14px 32px 16px', boxShadow: '0 10px 28px rgba(0,0,0,0.28)' }}>
        {BOXES.map((b, k) => {
          const q = interpolate(frame, [fr(at) + k * 2, fr(at) + k * 2 + 3], [0, 1], clamp); // v4: 이해 시험 v3 sonnet · haiku 「20.6초 넷째 줄이 흐림」 — 네 줄이 0.3초 안에 다 뜨게
          return (
            <div key={k} style={{ whiteSpace: 'nowrap', lineHeight: 1.18, opacity: q, transform: `translateX(${(1 - q) * -20}px)` }}>
              <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 52, color: INK }}>
                {b.obj} <span style={{ color: VERB }}>{VERB_PLAIN}</span>
              </span>
              <span style={{ fontFamily: L.font, fontWeight: 700, fontSize: 44, color: READ }}> = </span>
              <span style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.chipSize, color: MEAN }}>{L.chips[k]}</span>
            </div>
          );
        })}
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.endSize, color: INK, lineHeight: Math.max(1.16, L.lineH), marginTop: 4, whiteSpace: 'pre-line', textAlign: 'center' }}>{L.endLine}</div>
      </div>
    </div>
  );
};

// {…}로 싼 글자는 호박색 — 말풍선의 「써」 · 「썼」을 상자의 「써요」와 같은 색으로 잇는다
const marked = (t: string) => t.split(/(\{[^}]+\})/).map((p, i) => (p.startsWith('{') ? <span key={i} style={{ color: VERB }}>{p.slice(1, -1)}</span> : <React.Fragment key={i}>{p}</React.Fragment>));

// 대사 말풍선 — 한국어 대사 + 그 나라 뜻, 꼬리가 말한 사람 입 쪽을 가리킨다
const Bubbles: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const k = SUBS.findIndex((x) => sec >= x.at && sec < x.to);
  if (k < 0) return null;
  const s = SUBS[k];
  const b = BUBBLE[s.side];
  const q = interpolate(frame, [fr(s.at), fr(s.at) + 4], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const pos: React.CSSProperties = s.side === 'R' ? { right: (b as typeof BUBBLE.R).right, top: b.top } : { left: (b as typeof BUBBLE.L).left, top: b.top };
  return (
    <div style={{ position: 'absolute', ...pos, transform: `scale(${q})`, transformOrigin: `${b.tailX * 100}% 100%` }}>
      <div style={{ position: 'relative', display: 'inline-block', textAlign: 'center', background: PAPER, border: `5px solid ${INK}`, borderRadius: 34, padding: '10px 30px 12px', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 52, color: INK, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{marked(s.ko)}</div>
        <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: L.subSize, color: MEAN, lineHeight: Math.max(1.12, L.lineH), whiteSpace: 'nowrap' }}>{L.subs[k]}</div>
        <svg width={60} height={b.tailLen + 6} style={{ position: 'absolute', left: `calc(${b.tailX * 100}% - 30px)`, top: '100%', marginTop: -6, overflow: 'visible' }}>
          <polygon points={`8,0 52,0 30,${b.tailLen}`} fill={PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <rect x={6} y={-6} width={48} height={9} fill={PAPER} />
        </svg>
      </div>
    </div>
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

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 sseo-<KEY>로 넘긴다
// bare = 장면 심사용(글 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  const c = CELLS[i];
  let shake = 0;
  for (const s of SHAKES) {
    const s0 = fr(s.at);
    if (frame >= s0 && frame < fr(s.to)) shake = Math.sin((frame - s0) * 2.3) * s.px * (1 - (frame - s0) / (fr(s.to) - s0));
  }
  const p0 = fr(PUNCH.at);
  const punch = 1 + PUNCH.amt * interpolate(frame, [p0, p0 + 3, p0 + 14], [0, 1, 0], clamp);
  const nextAt = i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL;
  const push0 = interpolate(frame, [fr(c.at), fr(nextAt)], [1.02, 1.05], clamp);
  // 김 칸은 구름이 부풀며 출렁인다 — 펑 하고 커졌다가 숨 쉬듯
  const pf = frame - fr(c.at);
  const push = c.puff ? push0 * (1 + 0.06 * interpolate(pf, [0, 4], [1, 0], clamp) + 0.025 * Math.sin(pf * 0.55)) : push0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a211a' }}>
      <AbsoluteFill style={{ transformOrigin: PUNCH.origin, transform: `scale(${punch})` }}>
        {c.fade && i > 0 && pf < fr(c.fade) ? <Plate src={CELLS[i - 1].img} push={1.05} dx={0} dy={0} zoom={CELLS[i - 1].zoom} origin="45% 60%" /> : null}
        <AbsoluteFill style={{ opacity: c.fade ? interpolate(pf, [0, fr(c.fade)], [0, 1], clamp) : 1 }}>
          <Plate src={c.img} push={push} dx={shake} dy={shake * 0.3} zoom={c.zoom} origin={c.puff ? '22% 60%' : '45% 60%'} />
        </AbsoluteFill>
      </AbsoluteFill>
      {bare ? null : <Bubbles L={L} />}
      {bare ? null : <HeadCard L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
