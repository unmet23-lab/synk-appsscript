// synkbrief B54 「원생 명단」 본편 — 새 방향 편(재연 드라마 + 끝에 지키는 법 한 줄). 뼈대는 형식 원본 92mUc9V0eJY(AI 사기 예방 재연 숏드라마 · 39.2초)의 박자 자리.
// 결(B50 Film.tsx의 장면 코드를 옮김 — 틀 파일은 tools/편틀 원천): 장면을 아래로 내리고 위는 같은 장면을 뒤집어 흐리게 · 위 그늘 위 큰 글자가 곧 말 ·
// 원장 · 경찰관(방 안 사람)은 흰, 휴대폰 속 협박범의 말은 회색(11-16) · 버터는 한 곳(LINES의 butter · bi) · 컷이 1.035배에서 내려앉음 · SUIT 하나 · 마침표 없음 · 안전선 안(장부 「화면 결」).
// 그린 앱 화면 칸은 없다 — 메일 · 「발신번호 표시제한」 · 송금 화면은 시작 그림에 함께 구운 글자다.
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
// look: 'past' = 회상(이해 시험 11-15 「경찰을 언제 불렀는지 안 보인다」 → 몰래 누르던 손을 빛 바랜 결로 다시) · 'dim' = 사실 카드 밑 장면(흐리지 않고 어둡게만)
const Shot: React.FC<{ src: string; start: number; crop: Crop; rate?: number; drift?: number; blur?: number; look?: 'past' | 'dim' }> = ({ src, start, crop, rate = 1, drift = 0.012, blur = 0, look }) => {
  const f = useCurrentFrame();
  const s = crop.s * (1 + (f / FPS) * drift) * (crop.push ? interpolate(f / FPS, [crop.push.t0, crop.push.t1], [1, crop.push.to], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1);
  const ay = crop.ay ?? 1000;
  const x = Math.min(0, Math.max(1080 - 1080 * s, 540 - crop.cx * s));
  const y = Math.min(0, Math.max(1920 - 1920 * s, ay - crop.cy * s));
  const style: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${s})`, filter: blur ? `blur(${blur}px) brightness(0.62)` : look === 'past' ? 'grayscale(0.85) sepia(0.12) contrast(1.06) brightness(1.06)' : look === 'dim' ? 'brightness(0.42) saturate(0.7)' : undefined };
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
const T: React.FC<{ lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; metaSize?: number; deep?: boolean; instant?: boolean; fade?: number; at?: number[]; butter?: boolean; bi?: number }> = ({ lines, from, to, grey, size = 92, meta, metaSize = 40, deep, instant, fade = 3, at, butter, bi = 0 }) => {
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
        <div key={i} style={{ ...up(i + (meta ? 1 : 0), at ? i : undefined), fontWeight: 700, fontSize: size, lineHeight: 1.18, letterSpacing: -1.8, color: butter && i === bi ? BUTTER : grey ? GREY : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};

// 위 표시 — 콘티 검수(11-15 · 「재연」과 「지어낸 이야기」가 부딪치고 끝 장면 전에 사라짐) → 「실제 사건을 바탕으로 꾸민 장면」을 끝까지 두고, 사실 카드(S.card) 위에서만 뺀다.
// 이해 시험(11-15 · 둘이 「SYNK 브리핑」이 끝에야 작게 나온다) → 처음부터 「SYNK 브리핑 · 」을 붙인다. 자리는 위 그늘 안 큰 글자 바로 위(298 — 머리 안전선 269 안).
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const [c0, c1] = S.card;
  const o = interpolate(f, [sec(c0) - 4, sec(c0), sec(c1), sec(c1) + 4], [1, 0, 0, 1], clamp);
  return <div style={{ position: 'absolute', left: X, top: 298, opacity: o, fontFamily: KO, fontWeight: 600, fontSize: 36, color: 'rgba(255,255,255,0.9)', letterSpacing: -0.3, textShadow: '0 1px 10px rgba(0,0,0,0.85)' }}>{'SYNK 브리핑 · 실제 사건을 바탕으로 꾸민 장면'}</div>;
};

// 미학 맹검(11-14 · 끝 장면 「셔터 소리는 나는데 찍는 순간이 화면에 없다」) → 셔터(SOUNDS의 셔터.wav)에 맞춰 화면이 한 번 하얗게 번쩍인다(0.75 → 0, 6장 = 0.25초)
const Flash: React.FC = () => {
  const f = useCurrentFrame();
  const sh = SOUNDS.find((s) => s.src.includes('셔터'));
  if (!sh) return null;
  const a = sec(sh.t);
  if (f < a || f > a + 6) return null;
  return <AbsoluteFill style={{ background: '#fff', opacity: interpolate(f, [a, a + 1, a + 6], [0.75, 0.6, 0], clamp) }} />;
};

// 회상 들고 나기 — 들어갈 때 흰 빛 0.55 → 0(5장), 나올 때 0 → 0.45(마지막 4장)
const PastFlash: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const o = Math.max(interpolate(f, [0, 5], [0.55, 0], clamp), interpolate(f, [dur - 4, dur], [0, 0.45], clamp));
  return <AbsoluteFill style={{ background: '#fff', opacity: o }} />;
};

export const Film: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {CUTS.map((c, i) => (
        <Sequence key={i} from={sec(c.from)} durationInFrames={sec(c.to) - sec(c.from)}>
          <Lowered d={c.low ?? 210}><Shot src={c.src} start={c.start} crop={c.crop} rate={c.rate} drift={c.drift} blur={c.blur} look={c.look} /></Lowered>
          {c.look === 'past' ? <PastFlash dur={sec(c.to) - sec(c.from)} /> : null}
          {!MASTER && c.a ? <Audio src={staticFile(c.a.src)} trimBefore={sec(c.a.start)} volume={c.a.vol ?? 1} /> : !MASTER && c.audio && /\.mp4$/.test(c.src) ? <Audio src={staticFile(c.src)} trimBefore={sec(c.start)} volume={c.audio} playbackRate={c.rate ?? 1} /> : null}
        </Sequence>
      ))}
      <Shade />
      <Flash />

      {LINES.map((l, i) => {
        const next = LINES[i + 1];
        const fade = !next || next.from - l.to > 0.6 ? 8 : 3;
        return <T key={i} lines={l.lines} from={l.from} to={l.to} grey={l.grey} size={l.size} meta={l.meta} metaSize={l.metaSize} deep={l.deep} instant={l.instant} fade={fade} at={l.at} butter={l.butter} bi={l.bi} />;
      })}

      <Label />

      {MASTER ? <Audio src={staticFile('master.wav')} /> : <>
      {/* 배경음(일레븐랩스 연주곡 — 낮은 맥박 신스 · 시계 같은 잔 타악 · 어두운 펠트 피아노, 8초 마디라 0~32초에 16~32초를 이어 48초 · 빈 마디 없음). 반전(S.reveal)에서 조금 올라오고 끝까지 간다(마지막 0.6초에 사그라짐) — 바탕에 방 소리 */}
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => interpolate(fr, [0, sec(0.8), sec(S.reveal - 0.3), sec(S.reveal + 0.3), sec(TOTAL_S - 0.6), sec(TOTAL_S)], [0.06, 0.1, 0.1, 0.13, 0.13, 0], clamp)} />
      {/* 방 소리 — 넓은 대역을 아주 작게(말 사이가 완전히 비지 않게 · 검사 ⑰, 음악이 끊긴 끝 칸의 바탕 소리) */}
      <Audio src={staticFile('sfx/room.wav')} volume={0.05} />
      {VO.map((v) => <Sequence key={v.id} from={sec(v.t)}><Audio src={staticFile(`vo/${v.id}.wav`)} /></Sequence>)}
      {SOUNDS.map((s, i) => <Sequence key={i} from={sec(s.t)} durationInFrames={s.dur ?? 90}><Audio src={staticFile(s.src)} volume={s.vol} /></Sequence>)}
      </>}
    </AbsoluteFill>
  );
};
