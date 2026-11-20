// synkbrief B46 「포스트잇 인증」 — 재연 드라마 + 끝에 지키는 법 한 줄. 뼈대는 원본 KojyBLpl64U(19.4초) 박자 × 약 1.25.
// 결(장부 「화면 결」): 판을 아래로 내리고 위는 같은 판을 뒤집어 흐리게 · 위 그늘 위 큰 글자가 곧 말 · 흰 글자, 버터 #F5C445는 끝 줄 「안전결제」 한 곳 ·
// 컷이 1.035배에서 내려앉음 · SUIT 하나 · 마침표 없음 · 안전선 안. 구성 Film(본편)과 Scene(한 장면 먼저 — 글 · 말 없이 소리째)을 같은 부품으로 그린다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { CUTS, LINES, VO, SOUNDS, TOTAL_S, SCENE_CUTS, SCENE_SOUNDS, SCENE_S, type Crop, type CutT } from './timeline';

export const TOTAL = Math.round(TOTAL_S * 30);
export const SCENE_TOTAL = Math.round(SCENE_S * 30);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);
const BUTTER = '#F5C445';
const X = 74;
const TOP = 334;

// 한 컷: 1080×1920 판의 (cx, cy)를 화면 (540, ay)에 두고 s배. path = 컷 안 초마다 s · cx · cy(한 컷 안에서 카메라가 옮겨 감).
// t0 = 이 컷이 이어받는 카메라 시각(같은 판을 넘기는 컷끼리 카메라가 끊기지 않게 — 닉네임만 바뀌는 사진 넘김)
const Shot: React.FC<{ src: string; start: number; crop: Crop; drift?: number; t0?: number }> = ({ src, start, crop, drift = 0.012, t0 = 0 }) => {
  const f = useCurrentFrame() + sec(t0);
  const pt = crop.path;
  const along = (k: number[] | undefined, base: number) => (pt && k ? interpolate(f / 30, pt.t, k, { ...clamp, easing: Easing.inOut(Easing.cubic) }) : base);
  const s = along(pt?.s, crop.s) * (1 + (f / 30) * drift);
  const cx = along(pt?.cx, crop.cx), cy = along(pt?.cy, crop.cy);
  const ay = crop.ay ?? 880;
  const x = Math.min(0, Math.max(1080 - 1080 * s, 540 - cx * s));
  const y = Math.min(0, Math.max(1920 - 1920 * s, ay - cy * s));
  const style: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${s})` };
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {/\.(png|jpg)$/.test(src)
        ? <Img src={staticFile(src)} style={style} />
        : <OffthreadVideo muted src={staticFile(src)} startFrom={sec(start)} style={style} />}
    </AbsoluteFill>
  );
};

// 판을 d만큼 내리고 빈 위쪽은 같은 판을 뒤집어 흐리게(장부 「화면 결」 ①). land = 컷이 1.035배에서 내려앉음(넘김 컷은 끈다)
const Lowered: React.FC<{ d?: number; dPath?: { t: number[]; d: number[] }; land?: boolean; children: React.ReactNode }> = ({ d: d0 = 0, dPath, land = true, children }) => {
  const f = useCurrentFrame();
  const d = dPath ? interpolate(f / 30, dPath.t, dPath.d, { ...clamp, easing: Easing.inOut(Easing.cubic) }) : d0;
  const z = land ? interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) : 1;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      {d > 0.5 ? <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.55)' }}>{children}</div> : null}
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 30%' }}>{children}</div>
    </AbsoluteFill>
  );
};

// 큰 글자가 떠 있을 때만 위를 짙게
const Shade: React.FC = () => {
  const f = useCurrentFrame();
  const on = LINES.reduce((m, l) => Math.max(m, interpolate(f, [sec(l.from) - 6, sec(l.from), sec(l.to), sec(l.to) + 8], [0, 1, 1, 0], clamp)), 0);
  const k = 0.35 + 0.65 * on;
  return <AbsoluteFill style={{ opacity: k, background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />;
};

// 큰 글자가 곧 말. at = 줄마다 뜨는 초. butter = 버터로 칠할 낱말
const T: React.FC<{ lines: string[]; from: number; to: number; size?: number; at?: number[]; butter?: string }> = ({ lines, from, to, size = 92, at, butter }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - 3, b], [1, 0], clamp);
  const up = (i: number) => {
    const s0 = at && at[i] != null ? sec(at[i]) : a + i * 3;
    const p = interpolate(f, [s0, s0 + 6], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  const paint = (l: string) => {
    if (!butter || !l.includes(butter)) return l;
    const [h, t] = l.split(butter);
    return <>{h}<span style={{ color: BUTTER }}>{butter}</span>{t}</>;
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 900, top: TOP, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i), fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: '#fff', wordBreak: 'keep-all' }}>{paint(l)}</div>
      ))}
    </div>
  );
};

// 「실제 사건 재연」 — 큰 글자 바로 위 고정 자리의 작은 한 줄(이해 시험: 재연인지 몰랐다 → 키움)
const Small: React.FC<{ text: string; from: number; to: number }> = ({ text, from, to }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  return <div style={{ position: 'absolute', left: X, top: 274, fontFamily: KO, fontWeight: 700, fontSize: 42, color: 'rgba(255,255,255,0.82)', letterSpacing: -0.3, textShadow: '0 1px 10px rgba(0,0,0,0.7)' }}>{text}</div>;
};

const Cuts: React.FC<{ cuts: CutT[] }> = ({ cuts }) => (
  <>
    {cuts.map((c, i) => (
      <Sequence key={i} from={sec(c.from)} durationInFrames={sec(c.to) - sec(c.from)}>
        <Lowered d={c.d} dPath={c.dPath} land={c.land !== false}><Shot src={c.src} start={c.start} crop={c.crop} drift={c.drift} t0={c.t0} /></Lowered>
        {c.audio && /\.mp4$/.test(c.src) ? <Audio src={staticFile(c.src)} trimBefore={sec(c.start)} volume={c.audio} /> : null}
      </Sequence>
    ))}
  </>
);

const Sounds: React.FC<{ list: { t: number; vol: number; src: string; dur?: number }[] }> = ({ list }) => (
  <>{list.map((s, i) => <Sequence key={i} from={sec(s.t)} durationInFrames={s.dur ? sec(s.dur) : 90}><Audio src={staticFile(s.src)} volume={s.vol} /></Sequence>)}</>
);

// 한 장면 먼저(장면 심사용) — 제목 · 이름표 · 설명 말 없이 그 장면의 소리째
export const Scene: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    <Cuts cuts={SCENE_CUTS} />
    <Audio src={staticFile('room.mp3')} volume={0.16} />
    <Sounds list={SCENE_SOUNDS} />
  </AbsoluteFill>
);

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Cuts cuts={CUTS} />
      <Shade />
      {LINES.map((l, i) => <T key={i} lines={l.lines} from={l.from} to={l.to} size={l.size} at={l.at} butter={l.butter} />)}
      <Small text="실제 사건 재연" from={0} to={TOTAL_S - 3.2} />
      {/* 곡 파일이 작게 녹음돼(가운데 -44dB) 음악층 「말 없는 자리가 빈 듯」에 걸려 약 11dB 올림(11-20) */}
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => interpolate(fr, [0, sec(9.3), sec(9.6), sec(TOTAL_S - 3.4), sec(TOTAL_S - 3.0), sec(TOTAL_S)], [0.38, 0.38, 0.28, 0.28, 0.42, 0.35], clamp)} />
      <Audio src={staticFile('room.mp3')} volume={0.14} />
      {/* 넓은 띠 공기 소리(아주 작게) — 올림 마스터 AAC가 320k 아래로 줄지 않게 */}
      <Audio src={staticFile('air.wav')} volume={0.35} loop />
      {VO.map((v) => <Sequence key={v.id} from={sec(v.t)}><Audio src={staticFile(`vo/${v.id}.wav`)} /></Sequence>)}
      <Sounds list={SOUNDS} />
      {f < 0 ? null : null}
    </AbsoluteFill>
  );
};
