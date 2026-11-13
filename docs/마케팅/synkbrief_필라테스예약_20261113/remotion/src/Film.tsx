// synkbrief B47 「필라테스 예약」 본편 — 새 방향 편(재연 드라마 + 끝에 지키는 법 한 줄). 뼈대는 IzfvbmlOcNA(형식만) 30.4초까지 원본 박자 그대로 · 끝 칸만 길게.
// 결(B44 Film.tsx의 장면 코드를 옮김 — 틀 파일은 tools/편틀 원천): 장면을 아래로 내리고 위는 같은 장면을 뒤집어 흐리게 · 위 그늘 위 큰 글자가 곧 말 ·
// 남자 · 여자는 흰, AI 비서의 말은 회색 · 버터는 한 곳(LINES의 butter) · 컷이 1.035배에서 내려앉음 · SUIT 하나 · 마침표 없음 · 안전선 안(장부 「화면 결」).
// 그린 앱 화면 칸은 없다 — 폰 속 「대기 3번」 · 「예약 취소됨」은 시작 그림에 함께 구운 글자다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { S, CUTS, LINES, VO, SOUNDS, TOTAL_S, FPS, type Crop } from './timeline';

export const TOTAL = Math.round(TOTAL_S * FPS);
// 마감 판: REMOTION_MASTER=1이면 컷 · 음악 · 해설 소리를 끄고 마감한 한 줄(public/master.wav — scripts/마감.sh)만 깐다. 조용한 편은 AAC를 다시 담으면 320kbps 아래로 떨어져, 섞은 소리(PCM)에서 바로 담는다(현장 노트 영상 11-04).
const MASTER = process.env.REMOTION_MASTER === '1';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * FPS);
const GREY = '#C4C4C4';
const BUTTER = '#F5C445';
const X = 84;
const TOP = 352; // B38 컷 전수 검수 3: 고지 글 · 큰 글자를 안전선(269px) 안으로. 11-13: 위 표시(298)와 출처 줄 사이를 띄우려 340 → 352

// 한 컷: 1080×1920 영상의 (cx, cy)를 화면 (540, ay)에 두고 s배 — 넘치는 쪽은 가장자리에 맞춘다
const Shot: React.FC<{ src: string; start: number; crop: Crop; rate?: number; drift?: number }> = ({ src, start, crop, rate = 1, drift = 0.012 }) => {
  const f = useCurrentFrame();
  const s = crop.s * (1 + (f / FPS) * drift) * (crop.push ? interpolate(f / FPS, [crop.push.t0, crop.push.t1], [1, crop.push.to], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1);
  const ay = crop.ay ?? 1000;
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

// 내린 장면의 윗단을 흐린 거울 쪽으로 녹여 경계를 없앤다(B38 v8)
const Lowered: React.FC<{ d?: number; children: React.ReactNode }> = ({ d = 210, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(34px) brightness(0.9)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 30%', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 150px)', maskImage: 'linear-gradient(to bottom, transparent 0px, black 150px)' }}>{children}</div>
    </AbsoluteFill>
  );
};

// 큰 글자가 떠 있을 때만 위 그늘을 짙게, 없을 때는 옅게
const Shade: React.FC = () => {
  const f = useCurrentFrame();
  const on = LINES.reduce((m, l) => Math.max(m, interpolate(f, [sec(l.from) - 6, sec(l.from), sec(l.to), sec(l.to) + 8], [0, 1, 1, 0], clamp)), 0);
  const base = interpolate(f, [sec(S.end), sec(S.end) + 8], [0.42, 0.75], clamp);
  const cut = CUTS.find((c) => f >= sec(c.from) && f < sec(c.to));
  const k = (base + (1 - base) * on) * (cut?.shade ?? 1);
  // deep = 석 줄(+출처)이라 셋째 줄이 그늘 꼬리(720px 밖)에 걸리는 줄 — 그 줄이 떠 있을 때만 그늘 꼬리를 1000px까지 늘인다(11-13 올리기 전 검사 ⑤ 흰 기본 글자 28.0초)
  const deep = LINES.reduce((m, l) => (l.deep ? Math.max(m, interpolate(f, [sec(l.from) - 6, sec(l.from), sec(l.to), sec(l.to) + 8], [0, 1, 1, 0], clamp)) : m), 0);
  return (
    <>
      <AbsoluteFill style={{ opacity: k, background: 'linear-gradient(to bottom, rgba(10,10,10,0.8) 0px, rgba(10,10,10,0.66) 440px, rgba(10,10,10,0.22) 720px, rgba(10,10,10,0) 880px)' }} />
      {deep > 0 ? <AbsoluteFill style={{ opacity: deep, background: 'linear-gradient(to bottom, rgba(10,10,10,0) 380px, rgba(10,10,10,0.5) 610px, rgba(10,10,10,0.44) 790px, rgba(10,10,10,0) 1010px)' }} /> : null}
    </>
  );
};

// 큰 글자가 곧 말 — at = 줄마다 뜨는 초(말하는 때). butter = 그 편에서 버터를 쓰는 한 줄(첫 줄만).
const T: React.FC<{ lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; metaSize?: number; deep?: boolean; instant?: boolean; fade?: number; at?: number[]; butter?: boolean }> = ({ lines, from, to, grey, size = 92, meta, metaSize = 40, deep, instant, fade = 3, at, butter }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - fade, b], [1, 0], clamp);
  const lift = interpolate(f, [b - fade, b], [0, fade > 3 ? -12 : 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const up = (k: number, lineIdx?: number) => {
    const s0 = at && lineIdx != null && at[lineIdx] != null ? sec(at[lineIdx]) : a + k * 3;
    const p = instant && (!at || lineIdx === 0 || lineIdx == null) ? (f >= s0 ? 1 : 0) : interpolate(f, [s0 - 2, s0 + 3], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28 + lift}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 900, top: TOP, fontFamily: KO, textShadow: deep ? '0 0 3px rgba(0,0,0,0.55), 0 1px 12px rgba(0,0,0,0.55)' : '0 1px 10px rgba(0,0,0,0.45)' }}>
      {/* 11-13 이해 시험: 작은 글(meta)은 줄의 from에 먼저 뜬다 — 큰 글(at)보다 앞서 「누구 · 어디」를 깔기 위해(지금까지 쓴 줄은 from = at[0]이라 그대로) */}
      {meta ? <div style={{ ...up(0), fontWeight: 600, fontSize: metaSize, letterSpacing: -0.6, color: '#D2D2D2', marginBottom: 18, maxWidth: 820, wordBreak: 'keep-all', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0), at ? i : undefined), fontWeight: 700, fontSize: size, lineHeight: 1.18, letterSpacing: -1.8, color: butter && i === 0 ? BUTTER : grey ? GREY : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};

// 「재연 · 상황은 각색」 · 「SYNK 브리핑」 — 위 그늘 안 큰 글자 바로 위 고정 자리(11-13 카본 맹검 06 「출처 줄이 위 표시 바로 밑에 다닥다닥」 — 표시는 298 · 큰 글 자리 TOP을 352로 내려 띄움. 284로 올리면 위 머리 안전선 269에 걸림)
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const end = f >= sec(S.end);
  // v12(컷 전수 2 「5.0초 위 표시가 바로 바뀜」): 바뀌는 자리에서 4장 흐렸다가 다시 뜬다
  const o = end ? interpolate(f, [sec(S.end), sec(S.end) + 6], [0, 1], clamp) : interpolate(f, [sec(S.hook) - 4, sec(S.hook), sec(S.hook) + 4], [1, 0, 1], clamp);
  return <div style={{ position: 'absolute', left: X, top: 298, opacity: o, fontFamily: KO, fontWeight: 600, fontSize: 36, color: 'rgba(255,255,255,0.9)', letterSpacing: -0.3, textShadow: '0 1px 10px rgba(0,0,0,0.85)' }}>{end ? 'SYNK 브리핑' : f < sec(S.hook) ? '재연 · 호주에서 실제로 있었던 일' : '재연 · 인물 · 상황은 각색'}</div>;
};

export const Film: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {CUTS.map((c, i) => (
        <Sequence key={i} from={sec(c.from)} durationInFrames={sec(c.to) - sec(c.from)}>
          <Lowered d={c.low ?? 210}><Shot src={c.src} start={c.start} crop={c.crop} rate={c.rate} drift={c.drift} /></Lowered>
          {!MASTER && c.a ? <Audio src={staticFile(c.a.src)} trimBefore={sec(c.a.start)} volume={c.a.vol ?? 1} /> : !MASTER && c.audio && /\.mp4$/.test(c.src) ? <Audio src={staticFile(c.src)} trimBefore={sec(c.start)} volume={c.audio} playbackRate={c.rate ?? 1} /> : null}
        </Sequence>
      ))}
      <Shade />

      {LINES.map((l, i) => {
        const next = LINES[i + 1];
        const fade = !next || next.from - l.to > 0.6 ? 8 : 3;
        return <T key={i} lines={l.lines} from={l.from} to={l.to} grey={l.grey} size={l.size} meta={l.meta} metaSize={l.metaSize} deep={l.deep} instant={l.instant} fade={fade} at={l.at} butter={l.butter} />;
      })}

      <Label />

      {MASTER ? <Audio src={staticFile('master.wav')} /> : <>
      {/* 배경음(일레븐랩스 연주곡 — 살금살금 피치카토 · 나무 타악 · 뮤트 트럼펫). 반전(S.reveal)에서 조금 올라오고, 끝 줄을 속삭이기 직전(S.stop)에 끊는다 — 끝 줄은 스튜디오 공간 소리 위에서(음악층 ⑲ · 준비.json 「음악꺼짐판단」) */}
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => interpolate(fr, [0, sec(0.8), sec(S.reveal - 0.3), sec(S.reveal + 0.3), sec(S.stop - 0.25), sec(S.stop + 0.05)], [0.06, 0.1, 0.1, 0.14, 0.14, 0], clamp)} />
      {/* 방 소리 — 넓은 대역을 아주 작게(말 사이가 완전히 비지 않게 · 검사 ⑰, 음악이 끊긴 끝 칸의 바탕 소리) */}
      <Audio src={staticFile('sfx/room.wav')} volume={0.05} />
      {VO.map((v) => <Sequence key={v.id} from={sec(v.t)}><Audio src={staticFile(`vo/${v.id}.wav`)} /></Sequence>)}
      {SOUNDS.map((s, i) => <Sequence key={i} from={sec(s.t)} durationInFrames={s.dur ?? 90}><Audio src={staticFile(s.src)} volume={s.vol} /></Sequence>)}
      </>}
    </AbsoluteFill>
  );
};
