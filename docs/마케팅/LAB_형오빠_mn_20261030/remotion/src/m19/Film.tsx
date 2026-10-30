// LAB 몽골 M19 「ах = 형 · 오빠」 — 집에 막 들어온 형(오빠)에게 남동생은 「형!」, 여동생은 「오빠!」(핵심 장면), 그다음 동생이 손위를
// 부르는 장면 넷(형 · 오빠 · 누나 · 언니)이 원본 박자마다 바뀌고, 끝은 가족 소파 위 2×2 표 → «Хэн дуудахаас хамаарна!».
// 장면 그림은 판/*.png(GPT 이미지 2.5, 몽글 정본은 생김새 참고로만). 전부 useCurrentFrame()으로만 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { END, KEY, OOPS, SCENES, TEXT } from './data';
import { fr, T } from './timeline';

const C = { coral: '#F96859', coralShade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8' };
const MN = "'Inter Tight', 'SUIT', sans-serif";
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const K = 1080 / 941; // 장면 그림(941×1672) → 화면(1080×1920)
const fadeIn = (t: number, at: number, d = 0.3) => interpolate(t, [at, at + d], [0, 1], { ...clamp, easing: EASE_OUT });

// 지금 장면: -1 = 핵심(둘이), 0~3 = SCENES, 4 = 가족 소파
const sceneAt = (t: number) => {
  if (t >= T.table) return 4;
  let k = -1;
  T.scenes.forEach((s, i) => {
    if (t >= s) k = i;
  });
  return k;
};

// ── 장면 그림 + 카메라(천천히 다가감 · 박자마다 한 번 다가갔다 돌아옴 · 손카메라 흔들림) ─────────────────
const Plate: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const k = sceneAt(t);
  const oops = k === -1 && t >= T.wrong && t < T.reveal;
  const img = k === -1 ? (oops ? OOPS.img : KEY.img) : k === 4 ? END.img : SCENES[k].img;
  const s0 = k === -1 ? 0 : k === 4 ? T.table : T.scenes[k];
  const s1 = k === -1 ? T.scenes[0] : k === 4 ? T.total : k === 3 ? T.table : T.scenes[k + 1];
  // 핵심 장면은 「형!」 때 남동생 쪽, 「오빠!」 때 여동생 쪽, 「한 형 두 이름」 때 형 얼굴로 옮겨 간다
  let cam: [number, number] = k === -1 ? KEY.cam : k === 4 ? END.cam : SCENES[k].cam;
  if (k === -1) {
    if (oops) cam = OOPS.cam;
    else if (t >= T.reveal) cam = [640, 820];
    else if (t >= T.girl) cam = [640, 900];
    else if (t >= T.boy) cam = [300, 900];
  }
  const push = interpolate(t, [s0, s1], [1.03, 1.1], clamp);
  const beats: number[] = k === -1 ? [T.boy, T.girl, T.reveal] /* ✗(6.6)은 컷이 이미 박자 */ : k === 4 ? [T.table, T.end] : [T.scenes[k], T.subs[k]]; // 누나 고침(fix2)은 다가가지 않는다 — v4 나란히 칸 19(기준 18 안)
  let punch = 0;
  for (const b of beats) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.1, b + 0.65], [0, 1, 0], { ...clamp, easing: EASE_IO }));
  const sx = 6 * Math.sin((2 * Math.PI * t) / 3.1);
  const sy = 5 * Math.sin((2 * Math.PI * t) / 4.3 + 1);
  const rot = 0.3 * Math.sin((2 * Math.PI * t) / 5.3);
  const z = push * (1 + 0.07 * punch);
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${z})`, transformOrigin: `${cam[0] * K}px ${cam[1] * K}px` }}>
      <Img src={staticFile(img)} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' }} />
      <Bubbles k={k} t={t} />
    </AbsoluteFill>
  );
};

// 말풍선 — 그림 좌표(Plate 안에서 그림과 함께 움직인다)
const Bubble: React.FC<{ at: [number, number]; text: string; t: number; from: number; tail: -1 | 1 }> = ({ at, text, t, from, tail }) => {
  const a = interpolate(t, [from, from + 0.18], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  if (a <= 0) return null;
  const w = text.length > 1 ? 300 : 230;
  const h = 150;
  const x = at[0] * K;
  const y = at[1] * K;
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, transform: `scale(${a})`, transformOrigin: `${50 + tail * 30}% 100%` }}>
      <svg width={w} height={h + 46} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={`M ${w / 2 + tail * 10} ${h - 4} L ${w / 2 + tail * 60} ${h + 44} L ${w / 2 + tail * 62} ${h - 4} Z`} fill={C.cream} stroke={C.coralShade} strokeWidth={6} strokeLinejoin="round" />
        <rect x={3} y={3} width={w - 6} height={h - 6} rx={60} fill={C.cream} stroke={C.coralShade} strokeWidth={6} />
        <rect x={w / 2 + tail * 10 - 4} y={h - 12} width={56} height={12} fill={C.cream} transform={tail < 0 ? `translate(${-52} 0)` : undefined} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 800, fontSize: 92, color: C.coralShade }}>{text}</div>
    </div>
  );
};

// 여동생의 「형!」에 빨간 ✗(6.6초) — 8.6초에 「오빠!」로 바뀌며 사라진다
const WrongMark: React.FC<{ at: [number, number]; t: number; from?: number; until?: number }> = ({ at, t, from = T.wrong, until = T.reveal }) => {
  if (t < from || t >= until) return null;
  const a = interpolate(t, [from, from + 0.15], [1.6, 1], { ...clamp, easing: EASE_OUT });
  const o = interpolate(t, [from, from + 0.1], [0, 1], clamp);
  const x = at[0] * K;
  const y = at[1] * K;
  return (
    <svg width={200} height={200} style={{ position: 'absolute', left: x - 100, top: y - 100, opacity: o, transform: `scale(${a})` }}>
      <path d="M 40 40 L 160 160 M 160 40 L 40 160" stroke="#D93A2B" strokeWidth={22} strokeLinecap="round" />
    </svg>
  );
};

const Bubbles: React.FC<{ k: number; t: number }> = ({ k, t }) => {
  if (k === -1) {
    return (
      <>
        {t >= T.reveal ? <Bubble at={KEY.boy} text="형!" t={t} from={T.boy} tail={1} /> : null}
        {t < T.wrong ? <Bubble at={KEY.boy} text="형!" t={t} from={T.boy} tail={1} /> : null}
        {t < T.wrong ? <Bubble at={KEY.girl} text="형!" t={t} from={T.girl} tail={-1} /> : t < T.reveal ? <Bubble at={OOPS.girl} text="형!" t={t} from={T.wrong - 1} tail={-1} /> : <Bubble at={KEY.girl} text="오빠!" t={t} from={T.reveal} tail={-1} />}
        <WrongMark at={t < T.reveal ? OOPS.girl : KEY.girl} t={t} />
      </>
    );
  }
  if (k >= 0 && k <= 3) {
    const sc = SCENES[k];
    if (k === 2) {
      return (
        <>
          {t < T.fix2 ? <Bubble at={sc.bubble} text="언니!" t={t} from={T.scenes[2] + 0.05} tail={sc.tail} /> : <Bubble at={sc.bubble} text="누나!" t={t} from={T.fix2} tail={sc.tail} />}
          <WrongMark at={sc.bubble} t={t} from={T.subs[2]} until={T.fix2} />
        </>
      );
    }
    return <Bubble at={sc.bubble} text={`${sc.ko}!`} t={t} from={T.scenes[k] + 0.05} tail={sc.tail} />;
  }
  return null;
};

// ── 아래 띠: 핵심 장면은 물음 → 「한 형 두 이름」, 장면 넷은 한국어 · 읽기 · 몽골어 풀이 ─────────────────
const BAND_TOP = 290; // 쇼츠 · 릴스 안전선 안(위 269 · 아래 1428 · 오른쪽 920)
const band: React.CSSProperties = { position: 'absolute', left: 60, width: 860, top: BAND_TOP, background: 'rgba(255,253,248,0.97)', borderRadius: 40, boxShadow: '0 10px 28px rgba(60,20,10,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const BottomBand: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const k = sceneAt(t);
  if (k === 4) return null;
  if (k === -1) {
    // v1: 3~10초 같은 그림에 물음 글만 남아 셋이 같이 넘김 → 말풍선마다 띠가 바로 그 말로 바뀐다
    if (t < T.boy) {
      return (
        <div style={{ ...band, padding: '40px 40px 44px' }}>
          <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 56, lineHeight: 1.15, color: C.brown, textAlign: 'center' }}>{TEXT.hook}</div>
        </div>
      );
    }
    const stage = t < T.girl ? 0 : t < T.reveal ? 1 : 2;
    const at = stage === 0 ? T.boy : stage === 1 ? T.girl : T.reveal;
    const a = fadeIn(t, at, 0.15);
    const ko = stage === 2 ? '오빠' : '형';
    const read = stage === 2 ? 'оппа' : 'хён';
    const x = stage === 1 ? interpolate(t, [T.wrong, T.wrong + 0.15], [0, 1], clamp) : 0;
    return (
      <div style={{ ...band, padding: '22px 30px 30px', transform: `translateY(${(1 - a) * 16}px)` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 28, position: 'relative' }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 130, lineHeight: 1.0, color: C.coralShade, opacity: 1 - 0.45 * x }}>{ko}</div>
          <div style={{ fontFamily: MN, fontWeight: 700, fontSize: 56, color: C.coralShade, opacity: 1 - 0.45 * x }}>🔊 {read}</div>
          {x > 0 ? <div style={{ position: 'absolute', left: -20, top: -14, fontFamily: MN, fontWeight: 900, fontSize: 150, lineHeight: 1, color: '#D93A2B', opacity: x }}>✗</div> : null}
        </div>
        {stage === 2 ? <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 44, lineHeight: 1.2, color: C.brown, marginTop: 10, whiteSpace: 'nowrap', opacity: fadeIn(t, T.reveal + 0.15, 0.2) }}>{SCENES[1].mn}</div> : null}
      </div>
    );
  }
  const sc = SCENES[k];
  const a = fadeIn(t, T.scenes[k], 0.15);
  const m = fadeIn(t, T.subs[k], 0.25);
  if (k === 0 && t < T.subs[0]) {
    // v2: ✗의 까닭이 늦다(셋이 같이 짚음) → 8.6초에 여자 풀이 줄을 먼저, 「한 형 두 이름」은 여기로
    return (
      <div style={{ ...band, padding: '40px 30px 44px', transform: `translateY(${(1 - a) * 16}px)` }}>
        <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 72, lineHeight: 1.15, color: C.brown }}>{TEXT.reveal}</div>
      </div>
    );
  }
  if (k === 2 && t < T.fix2) {
    // 누나 장면: 남동생이 먼저 「언니!」 — 17.1초 ✗
    const x = interpolate(t, [T.subs[2], T.subs[2] + 0.15], [0, 1], clamp);
    return (
      <div style={{ ...band, padding: '22px 30px 30px', transform: `translateY(${(1 - a) * 16}px)` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 28, position: 'relative' }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 130, lineHeight: 1.0, color: C.coralShade, opacity: 1 - 0.45 * x }}>언니</div>
          <div style={{ fontFamily: MN, fontWeight: 700, fontSize: 56, color: C.coralShade, opacity: 1 - 0.45 * x }}>🔊 өнни</div>
          {x > 0 ? <div style={{ position: 'absolute', left: -20, top: -14, fontFamily: MN, fontWeight: 900, fontSize: 150, lineHeight: 1, color: '#D93A2B', opacity: x }}>✗</div> : null}
        </div>
      </div>
    );
  }
  const mm = k === 2 ? fadeIn(t, T.fix2 + 0.15, 0.2) : k === 0 ? 1 : m; // 형 장면은 11.9초 띠가 바뀔 때 풀이 줄도 함께(나란히: 늦게 뜨면 원본에 없는 박자)
  return (
    <div style={{ ...band, padding: '22px 30px 30px', transform: `translateY(${(1 - a) * 16}px)` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 130, lineHeight: 1.0, color: C.coralShade }}>{sc.ko}</div>
        <div style={{ fontFamily: MN, fontWeight: 700, fontSize: 56, color: C.coralShade }}>🔊 {sc.read}</div>
      </div>
      <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 50, lineHeight: 1.2, color: C.brown, marginTop: 10, opacity: mm, transform: `translateY(${(1 - mm) * 12}px)`, whiteSpace: 'nowrap' }}>{sc.mn}</div>
    </div>
  );
};

// ── 끝: 가족 사진 위 이름표(형 · 오빠 / 누나 · 언니 — 부르는 아이 색으로) + 범례 띠 ───────────────────────
// v1: 2×2 표 카드가 오늘 「와요」 편 끝 표와 같은 틀(haiku 9번) · 표 글자가 작음 → 사람 머리 위 이름표로
const BLUE = '#2F65B0';
const PINK = '#D24F7E';
const Tag: React.FC<{ at: [number, number]; head: string; a: string; b: string; t: number; from: number }> = ({ at, head, a, b, t, from }) => {
  const o = interpolate(t, [from, from + 0.25], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  if (o <= 0) return null;
  const x = at[0] * K;
  const y = at[1] * K;
  const chip = (ko: string, c: string) => <span style={{ background: c, color: C.cream, borderRadius: 24, padding: '2px 20px 8px', fontFamily: KO, fontWeight: 800, fontSize: 76 }}>{ko}</span>;
  return (
    <div style={{ position: 'absolute', left: x - 250, top: y - 190, width: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${o})`, transformOrigin: '50% 100%' }}>
      <div style={{ background: 'rgba(255,253,248,0.97)', borderRadius: 30, padding: '8px 20px 14px', boxShadow: '0 8px 20px rgba(60,20,10,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 52, color: C.brown }}>{head}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          {chip(a, BLUE)}
          {chip(b, PINK)}
        </div>
      </div>
    </div>
  );
};
const EndTags: React.FC = () => {
  const t = useCurrentFrame() / 30;
  if (t < T.table) return null;
  const sc = interpolate(t, [T.table, T.total], [1.03, 1.1], clamp);
  return (
    <AbsoluteFill style={{ transform: `scale(${sc})`, transformOrigin: `${END.cam[0] * K}px ${END.cam[1] * K}px` }}>
      <Tag at={END.ah} head={TEXT.colA} a="형" b="오빠" t={t} from={T.table + 0.15} />
      <Tag at={END.egch} head={TEXT.colB} a="누나" b="언니" t={t} from={T.table + 0.55} />
    </AbsoluteFill>
  );
};
const Legend: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const a = fadeIn(t, T.table + 0.2, 0.3); // 이름표와 함께(나란히: 23.1초 따로 뜨면 원본에 없는 박자)
  if (a <= 0 || t >= T.end) return null;
  const dot = (c: string) => <span style={{ display: 'inline-block', width: 34, height: 34, borderRadius: 17, background: c, marginRight: 14, transform: 'translateY(4px)' }} />;
  return (
    <div style={{ ...band, top: 1200, padding: '22px 30px 26px', opacity: a, alignItems: 'flex-start', paddingLeft: 50 }}>
      <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 64, color: C.brown }}>{dot(BLUE)}{TEXT.rowM}</div>
      <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 64, color: C.brown, marginTop: 8 }}>{dot(PINK)}{TEXT.rowF}</div>
    </div>
  );
};

const EndLine: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const a = fadeIn(t, T.end, 0.3);
  if (a <= 0) return null;
  const bump = interpolate(t, [T.bump, T.bump + 0.15, T.bump + 0.4], [0, 1, 0], clamp);
  return (
    <div style={{ ...band, top: 1220, padding: '36px 30px 40px', opacity: a, transform: `translateY(${(1 - a) * 16}px) scale(${1 + 0.05 * bump})` }}>
      <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 62, color: C.brown, textAlign: 'center' }}>{TEXT.end}</div>
    </div>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at, vol = 1 }) => (
  <Sequence from={fr(at)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number }> = ({ file, at, vol }) => (
  <Sequence from={Math.max(0, fr(at))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.11 * MASTER * interpolate(i, [0, 8, fr(T.total) - 30, fr(T.total)], [0, 1, 1, 0], clamp)} />
    <Sfx file="bell.wav" at={0.05} vol={0.3} />
    <Sfx file="pop.wav" at={T.boy} vol={0.22} />
    <Vo id="h1" at={T.boy + 0.05} />
    <Sfx file="pop.wav" at={T.girl} vol={0.22} />
    <Vo id="g1" at={T.girl + 0.05} />
    <Sfx file="boing.wav" at={T.wrong} vol={0.3} />
    <Sfx file="pop.wav" at={T.reveal} vol={0.22} />
    <Vo id="o1" at={T.reveal + 0.05} />
    <Sfx file="sparkle.wav" at={T.reveal + 0.3} vol={0.24} />
    {SCENES.map((sc, i) => (
      <React.Fragment key={i}>
        <Sfx file="tok.wav" at={T.scenes[i]} vol={0.22} />
        <Vo id={i === 2 ? 'b2' : sc.vo} at={T.scenes[i] + 0.1} />
      </React.Fragment>
    ))}
    <Sfx file="boing.wav" at={T.subs[2]} vol={0.3} />
    <Sfx file="pop.wav" at={T.fix2} vol={0.22} />
    <Vo id="n1" at={T.fix2 + 0.05} />
    <Sfx file="pop.wav" at={T.table} vol={0.22} />
    <Sfx file="achieve.wav" at={T.end} vol={0.2} />
  </>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#E9DCC4' }}>
    <Plate />
    <BottomBand />
    <EndTags />
    <Legend />
    <EndLine />
    <Sound />
  </AbsoluteFill>
);
