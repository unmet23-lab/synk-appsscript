// synkbrief B37 「회의록」 본편 — 새 방향 첫 편(재연 드라마 + 끝에 지키는 법 한 줄). 뼈대는 B21 우리편(Xx2i---7BmA) 박자 × 1.2.
// 결: 장면을 아래로 내리고 위는 같은 장면을 뒤집어 흐리게 · 위 그늘 위 큰 글자가 곧 말 · 대리는 회색, 과장 · 부장 · 해설은 흰 ·
// 버터는 회의록 「비밀」 한 곳 · 컷이 1.035배에서 내려앉음 · SUIT 하나 · 마침표 없음 · 안전선 안(장부 「화면 결」).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { S, CUTS, LINES, VO, SOUNDS, TOTAL_S, type Crop } from './timeline';

export const TOTAL = Math.round(TOTAL_S * 30);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);
const GREY = '#C4C4C4';
const X = 74;
// v8(11-10 올리기 전 검사 「위 머리 자리 — 재연 표시 위 끝 197~212px · 안전선 269」): 표시를 안전선 안으로 내리고 큰 글자도 그만큼 내린다
const TOP = 334;

// 한 컷: 1080×1920 영상의 (cx, cy)를 화면 (540, ay)에 두고 s배 — 넘치는 쪽은 가장자리에 맞춘다
const Shot: React.FC<{ src: string; start: number; crop: Crop; rate?: number; drift?: number }> = ({ src, start, crop, rate = 1, drift = 0.012 }) => {
  const f = useCurrentFrame();
  const s = crop.s * (1 + (f / 30) * drift);
  const ay = crop.ay ?? 880;
  const x = Math.min(0, Math.max(1080 - 1080 * s, 540 - crop.cx * s));
  const y = Math.min(0, Math.max(1920 - 1920 * s, ay - crop.cy * s));
  const style: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${s})` };
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {/\.(png|jpg)$/.test(src)
        ? <Img src={staticFile(src)} style={style} />
        : <OffthreadVideo muted src={staticFile(src)} startFrom={sec(start)} playbackRate={rate} style={style} />}
    </AbsoluteFill>
  );
};

// v9: 글자가 없는 구간은 d=0(내리지 않고 전체 화면) — 맹검 v8 03 「글 없는 구간인데 위가 빈 검은 띠」
const Lowered: React.FC<{ d?: number; children: React.ReactNode }> = ({ d = 260, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      {d > 0 ? <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.55)' }}>{children}</div> : null}
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 30%' }}>{children}</div>
    </AbsoluteFill>
  );
};

// v5(11-10 미학 맹검 「글자 없는 장면에도 위를 짙은 띠로 눌러 둠」): 큰 글자가 떠 있을 때만 짙게, 없을 때는 옅게(뒤집은 흐린 장면이 보이게)
const Shade: React.FC = () => {
  const f = useCurrentFrame();
  const on = LINES.reduce((m, l) => Math.max(m, interpolate(f, [sec(l.from) - 6, sec(l.from), sec(l.to), sec(l.to) + 8], [0, 1, 1, 0], clamp)), 0);
  const k = 0.42 + 0.58 * on;
  return <AbsoluteFill style={{ opacity: k, background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />;
};
const _ShadeOld: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />
);

// 큰 글자가 곧 말
const T: React.FC<{ lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean }> = ({ lines, from, to, grey, size = 92, meta, instant }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - 3, b], [1, 0], clamp);
  const up = (k: number) => {
    const p = instant ? 1 : interpolate(f, [a + k * 3, a + k * 3 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 846, top: TOP, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {meta ? <div style={{ ...up(0), fontWeight: 600, fontSize: 34, letterSpacing: -0.5, color: '#BDBDBD', marginBottom: 18 }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: grey ? GREY : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};

// 「재연 · 상황은 각색」 — v5(11-10 미학 맹검 「소매 위에 어정쩡하게 뜬 문구」): 아래 그늘 띠를 빼고 위 그늘 안 큰 글자 바로 위 고정 자리로
const Small: React.FC<{ text: string; from: number; to: number }> = ({ text, from, to }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  return <div style={{ position: 'absolute', left: X, top: 276, fontFamily: KO, fontWeight: 600, fontSize: 32, color: 'rgba(255,255,255,0.72)', letterSpacing: -0.3, textShadow: '0 1px 10px rgba(0,0,0,0.7)' }}>{text}</div>;
};

// 노트북 화면 근접 — 구운 그림에 천천히 다가가고, 빨간 점만 숨 쉬듯 깜빡인다(앱 화면 글자는 구운 판 그대로)
const LaptopStill: React.FC = () => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 75], [1.0, 1.05], clamp);
  const blink = 0.55 + 0.45 * Math.abs(Math.sin(f * 0.11));
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '30% 44%' }}>
      <Img src={staticFile('img/laptop.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />
      <div style={{ position: 'absolute', left: 289, top: 820, width: 62, height: 62, borderRadius: 31, background: '#ff1e1e', opacity: blink, filter: 'blur(1px)' }} />
      <div style={{ position: 'absolute', left: 259, top: 790, width: 122, height: 122, borderRadius: 61, background: 'rgba(255,40,40,0.28)', opacity: blink, filter: 'blur(16px)' }} />
    </div>
  );
};

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  // 피치카토: 훅은 아주 작게 → 3분 전 험담에서 올라옴 → 탁에서 내려앉아 방 소리만 → 부장이 앉을 때 돌아옴(둘째 토막은 곡의 25초부터)
  const musicA = interpolate(f, [0, sec(S.ago - 0.2), sec(S.ago + 0.4), sec(S.lid + 0.6), sec(S.lid + 1.6)], [0.05, 0.05, 0.15, 0.15, 0], clamp);
  const musicB = interpolate(f, [0, 20, sec(TOTAL_S - S.v5) - 18, sec(TOTAL_S - S.v5)], [0, 0.13, 0.13, 0.03], clamp);
  const room = interpolate(f, [0, sec(S.lid), sec(S.lid + 1.2), sec(S.v5), sec(S.v5 + 1)], [0.08, 0.08, 0.22, 0.22, 0.1], clamp);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {CUTS.map((c, i) => (
        <Sequence key={i} from={sec(c.from)} durationInFrames={sec(c.to) - sec(c.from)}>
          {c.src === 'laptop' ? <Lowered d={c.d}><LaptopStill /></Lowered> : <Lowered d={c.d}><Shot src={c.src} start={c.start} crop={c.crop} rate={c.rate} drift={c.drift} /></Lowered>}
          {c.audio && /\.mp4$/.test(c.src) ? <Audio src={staticFile(c.src)} trimBefore={sec(c.start)} volume={c.audio} /> : null}
        </Sequence>
      ))}
      <Shade />

      {LINES.map((l, i) => <T key={i} lines={l.lines} from={l.from} to={l.to} grey={l.grey} size={l.size} meta={l.meta} instant={l.instant} />)}

      {/* 회의록 화면 동안은 쉰다 — 그 화면의 글을 표시 그늘이 덮었다(이해 시험 h 11-10) */}
      <Small text="재연 · 상황은 각색" from={0} to={S.minutes} />
      <Small text="재연 · 상황은 각색" from={S.minutesEnd} to={S.v6} />

      {/* 피치카토 한 줄을 끝까지(원곡 첫 56초 — 빈 마디 없음). 훅 · 탁 뒤 긴장 · 회의록은 가운데 크기에서 −6dB 안으로만 낮추고 밑에 방 소리(음악층 ⑲ · 제작 절차 2) */}
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => interpolate(fr, [0, sec(S.ago - 0.3), sec(S.ago + 0.3), sec(S.lid + 0.4), sec(S.lid + 1.0), sec(S.reveal), sec(S.reveal + 0.8), sec(TOTAL_S - 0.4), sec(TOTAL_S)], [0.085, 0.085, 0.14, 0.14, 0.08, 0.08, 0.13, 0.13, 0.07], clamp)} />
      <Audio src={staticFile('room.mp3')} volume={room} />
      {VO.map((v) => <Sequence key={v.id} from={sec(v.t)}><Audio src={staticFile(`vo/${v.id}.wav`)} /></Sequence>)}
      {SOUNDS.map((s, i) => <Sequence key={i} from={sec(s.t)} durationInFrames={s.dur ?? 90}><Audio src={staticFile(s.src)} volume={s.vol} /></Sequence>)}
      {musicA > 2 || musicB > 2 ? null : null}
    </AbsoluteFill>
  );
};
