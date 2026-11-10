// synkbrief B38 「가짜 의사」 본편 — 새 방향 둘째 편(재연 드라마 + 끝에 지키는 법 한 줄). 뼈대는 VtzxG-Ait0I(형식만) 박자 × 약 0.8.
// 결: 장면을 아래로 내리고 위는 같은 장면을 뒤집어 흐리게 · 위 그늘 위 큰 글자가 곧 말 · 아들은 회색, 아버지 · 해설 · 광고 속 의사는 흰 ·
// 버터는 검색 화면 「없습니다」 한 곳 · 컷이 1.035배에서 내려앉음 · SUIT 하나 · 마침표 없음 · 안전선 안(장부 「화면 결」).
// B37 미학 맹검에서 배운 것: 표시는 위 그늘 안 고정 자리(소매 위에 띄우지 않음) · 글자 없을 땐 그늘을 옅게 · 글자는 끝에서 천천히 사라짐.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Freeze, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { Search } from './Search';
import { S, CUTS, LINES, VO, SOUNDS, AD_AUDIO, TOTAL_S, FPS, type Crop, type CutT } from './timeline';

export const TOTAL = Math.round(TOTAL_S * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * FPS);
const GREY = '#C4C4C4';
const X = 74;
const TOP = 340; // v11(컷 전수 검수 3): 고지 글 · 큰 글자를 안전선(269px) 안으로 70px 내림

// 한 컷: 1080×1920 영상의 (cx, cy)를 화면 (540, ay)에 두고 s배 — 넘치는 쪽은 가장자리에 맞춘다
const Shot: React.FC<{ src: string; start: number; crop: Crop; rate?: number; drift?: number }> = ({ src, start, crop, rate = 1, drift = 0.012 }) => {
  const f = useCurrentFrame();
  const s = crop.s * (1 + (f / FPS) * drift);
  const ay = crop.ay ?? 1000; // v8: 내린 폭을 260 → 210으로 줄인 50px만큼 당긴 컷의 기준을 내린다
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

// v8(11-10 맹검 GPT 두 번 「위의 검은 머리판 · 수평 경계가 덧댄 판처럼 보임」): 내린 폭을 줄이고, 또렷한 장면의 윗단을 흐린 거울 쪽으로 녹여 경계를 없앤다
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

// 광고 화면 표시 — 아래 얇은 진행 막대와 작은 「광고」(실제 서비스 화면을 흉내 내지 않는 우리 꼴). 광고 칸 안에서만.
const AdChrome: React.FC<{ len: number }> = ({ len }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, len], [0.18, 0.34], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: X, top: 1700, fontFamily: KO, fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,0.92)', background: 'rgba(0,0,0,0.42)', borderRadius: 8, padding: '6px 14px', letterSpacing: -0.3 }}>광고</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1772, height: 6, background: 'rgba(255,255,255,0.22)' }}>
        <div style={{ width: `${p * 100}%`, height: '100%', background: 'rgba(255,255,255,0.85)' }} />
      </div>
    </AbsoluteFill>
  );
};

// v10(11-10 15시 회차 — 아르곤 v9 05 · 06 기각): 광고를 「폰 화면 안의 광고」로 보인다 — 어두운 바탕 위 둥근 폰 화면, 그 안에 광고 영상과 광고 표시.
// lockAt이 있으면 그 초에 영상이 멈추고 흑백으로 빠지며 얼굴 둘레에 모서리 표식 넷과 훑는 줄 하나(검색 화면의 표식과 같은 꼴) — 「사람이 아니었어요」를 그림으로.
const PW = 664, PH = 1180, PL = 208, PT = 580;
const PhoneAd: React.FC<{ c: CutT; len: number }> = ({ c, len }) => {
  const f = useCurrentFrame();
  // v14(Opus 맹검 05 「반전 자리에 그림이 하는 일이 흑백뿐 · 폰이 혼자 줄어듦」): 들어올 때 줄어드는 움직임을 빼고, 멈춘 뒤에는 그 얼굴로 천천히 다가간다
  const lock0 = c.lockAt != null ? sec(c.lockAt - c.from) : null;
  const z = lock0 != null ? interpolate(f, [lock0, len], [1, 1.16], { ...clamp, easing: Easing.out(Easing.quad) }) : 1;
  const lock = c.lockAt != null ? sec(c.lockAt - c.from) : null;
  const k = lock != null ? interpolate(f, [lock, lock + 8], [0, 1], clamp) : 0;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      {/* v12(Opus 맹검 05 기각 「검은 빈 판 위 설명 카드 · 얼굴 인식 괄호 프리셋」): 뒤에 그 순간의 부엌을 흐리게 깔아 드라마 안에 두고, 괄호 · 훑는 줄은 뺀다 — 멈춤 + 흑백만 */}
      {c.bg ? <div style={{ position: 'absolute', inset: 0, filter: 'blur(26px) brightness(0.42) saturate(0.85)', transform: 'scale(1.08)' }}><Shot src={c.bg.src} start={c.bg.start} crop={{ s: 1.0, cx: 540, cy: 960 }} drift={0} /></div> : null}
      <div style={{ position: 'absolute', left: PL, top: PT, width: PW, height: PH, borderRadius: 60, overflow: 'hidden', transform: `scale(${z})`, transformOrigin: '50% 34%', boxShadow: '0 0 0 9px #161616, 0 0 0 11px #2c2c2c, 0 36px 110px rgba(0,0,0,0.7)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `scale(${PW / 1080})`, filter: `grayscale(${k * 0.9}) brightness(${1 - k * 0.12})` }}>
          <Freeze frame={lock ?? 0} active={lock != null && f >= lock}>
            <Shot src={c.src} start={c.start} crop={c.crop} rate={c.rate} drift={c.drift ?? 0} />
          </Freeze>
          <AdChrome len={len} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 큰 글자가 떠 있을 때만 위 그늘을 짙게, 없을 때는 옅게(뒤집은 흐린 장면이 보이게)
const Shade: React.FC = () => {
  const f = useCurrentFrame();
  const on = LINES.reduce((m, l) => Math.max(m, interpolate(f, [sec(l.from) - 6, sec(l.from), sec(l.to), sec(l.to) + 8], [0, 1, 1, 0], clamp)), 0);
  // v7(맹검 GPT 07 「끝의 짙은 띠가 작은 표기에 비해 크다」): 끝 칸은 표기만 읽히게 더 옅게
  const base = interpolate(f, [sec(S.end), sec(S.end) + 8], [0.42, 0.2], clamp);
  // v9(아르곤 맹검 06 「밝은 약국 장면 위를 시커멓게 덮음」): 밝은 칸은 그 칸의 shade 배율만큼 옅게
  const cut = CUTS.find((c) => f >= sec(c.from) && f < sec(c.to));
  const k = (base + (1 - base) * on) * (cut?.shade ?? 1);
  return <AbsoluteFill style={{ opacity: k, background: 'linear-gradient(to bottom, rgba(10,10,10,0.62) 0px, rgba(10,10,10,0.46) 420px, rgba(10,10,10,0.16) 700px, rgba(10,10,10,0) 880px)' }} />;
};

// 큰 글자가 곧 말 — 다음 줄까지 0.6초 넘게 비면 끝에서 8프레임에 걸쳐 12px 올라가며 사라진다(맞받는 말은 3프레임)
// at = 줄마다 뜨는 초(말하는 때 · 원본 박자 자리). 없으면 첫 줄부터 3프레임씩.
const T: React.FC<{ lines: string[]; from: number; to: number; grey?: boolean; size?: number; meta?: string; instant?: boolean; fade?: number; at?: number[]; lead?: boolean }> = ({ lines, from, to, grey, size = 92, meta, instant, fade = 3, at, lead }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - fade, b], [1, 0], clamp);
  const lift = interpolate(f, [b - fade, b], [0, fade > 3 ? -12 : 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const up = (k: number, lineIdx?: number) => {
    const s0 = at && lineIdx != null && at[lineIdx] != null ? sec(at[lineIdx]) : a + k * 3;
    const p = instant && (!at || lineIdx === 0 || lineIdx == null) ? (f >= s0 ? 1 : 0) : interpolate(f, [s0, s0 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28 + lift}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 900, top: TOP, fontFamily: KO, textShadow: '0 1px 10px rgba(0,0,0,0.45)' }}>
      {meta ? <div style={{ ...up(0, at ? 0 : undefined), fontWeight: 600, fontSize: 34, letterSpacing: -0.5, color: '#BDBDBD', marginBottom: 18 }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0), at ? i : undefined), fontWeight: lead && i === 0 ? 600 : 700, fontSize: lead && i === 0 ? Math.round(size * 0.86) : size, lineHeight: 1.18, letterSpacing: -1.8, color: grey || (lead && i === 0) ? GREY : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};

// 「재연 · …」 · 「SYNK 브리핑」 — 위 그늘 안 큰 글자 바로 위 고정 자리. 칸마다 하나만: 광고 칸 → 가상 인물, 검색 화면 → 없음, 끝 → SYNK 브리핑, 나머지 → 재연
// v6(11-10 미학 맹검 01 「컷에서 표시가 깜박」): 글이 바뀌면 6프레임에 걸쳐 새 글이 떠오른다
const labelAt = (t: number): string | null => {
  if (t >= S.end) return 'SYNK 브리핑';
  if (t >= S.search && t < S.searchEnd) return null;
  // v9(아르곤 맹검 05 「표기가 컷 도중 바뀌고 아래 큰 글자와 같은 말」): 해설이 「AI로 만든 가상 인물」을 말하는 칸은 앞 칸 표기를 그대로 둔다
  if (CUTS.some((c) => c.ad && c.chrome !== false && t >= c.from && t < c.to)) return '재연 · AI로 만든 가상 인물';
  return '재연 · 상황은 각색';
};
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const text = labelAt(f / FPS);
  if (!text) return null;
  let since = 0;
  while (since < 6 && f - since - 1 >= 0 && labelAt((f - since - 1) / FPS) === text) since++;
  // 첫 프레임부터 같은 글이면 바뀐 게 아니다(v7 — 맹검 GPT 01 「처음에 표시가 흐려졌다 돌아옴」)
  const o = f - since <= 0 ? 1 : interpolate(since, [0, 6], [0, 1], clamp);
  return <div style={{ position: 'absolute', left: X, top: 276, opacity: o, fontFamily: KO, fontWeight: 600, fontSize: 32, color: 'rgba(255,255,255,0.78)', letterSpacing: -0.3, textShadow: '0 1px 10px rgba(0,0,0,0.85)' }}>{text}</div>;
};

export const Film: React.FC = () => {

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {CUTS.map((c, i) => (
        <Sequence key={i} from={sec(c.from)} durationInFrames={sec(c.to) - sec(c.from)}>
          {c.phone ? <PhoneAd c={c} len={sec(c.to) - sec(c.from)} /> : <Lowered d={c.low ?? 210}><Shot src={c.src} start={c.start} crop={c.crop} rate={c.rate} drift={c.drift} /></Lowered>}
          {c.ad && c.chrome !== false && !c.phone ? <AdChrome len={sec(c.to) - sec(c.from)} /> : null}
          {c.audio && /\.mp4$/.test(c.src) ? <Audio src={staticFile(c.src)} trimBefore={sec(c.start)} volume={c.audio} playbackRate={c.rate ?? 1} /> : null}
        </Sequence>
      ))}
      <Sequence from={sec(S.search)} durationInFrames={sec(S.searchEnd) - sec(S.search)}>
        <Search resultAt={sec(S.searchResult - S.search)} />
      </Sequence>
      <Shade />

      {LINES.map((l, i) => {
        const next = LINES[i + 1];
        const fade = !next || next.from - l.to > 0.6 ? 8 : 3;
        return <T key={i} lines={l.lines} from={l.from} to={l.to} grey={l.grey} size={l.size} meta={l.meta} instant={l.instant} fade={fade} at={l.at} lead={l.lead} />;
      })}

      <Label />

      {/* 잔잔한 피아노(따뜻_118 · 0~58초, 빈 마디 없음). 끝 광고 소리 동안 −6dB 안으로 내려앉았다 폰을 엎은 뒤 웃음에서 돌아온다(음악층 ⑲) */}
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => interpolate(fr, [0, sec(1.4), sec(44.7), sec(45.2), sec(S.flip), sec(S.flip + 0.6), sec(TOTAL_S - 0.6), sec(TOTAL_S)], [0.05, 0.11, 0.11, 0.06, 0.06, 0.12, 0.12, 0.06], clamp)} />
      {AD_AUDIO.map((a, i) => (
        <Sequence key={`aa${i}`} from={sec(a.from)} durationInFrames={sec(a.to) - sec(a.from)}>
          <Audio src={staticFile(a.src.replace('.mp4', '_phone.wav'))} trimBefore={sec(a.start)} volume={a.vol} />
        </Sequence>
      ))}
      {VO.map((v) => <Sequence key={v.id} from={sec(v.t)}><Audio src={staticFile(`vo/${v.id}.wav`)} /></Sequence>)}
      {SOUNDS.map((s, i) => <Sequence key={i} from={sec(s.t)} durationInFrames={s.dur ?? 90}><Audio src={staticFile(s.src)} volume={s.vol} /></Sequence>)}
    </AbsoluteFill>
  );
};
