// LAB 영어 E25 「잘하고 있어」 — 밤 책상, 공책은 빨간 ✗ 투성이, 몽글은 납작 엎드렸다. 창이 저절로 열리고 펠트 글자 괜찮아가 날아들어 몽글이 눈을 뜬다.
// 바람에 공책이 첫 장까지 넘어가고(가 나 다도 못 쓰던 첫날), 오늘 장으로 돌아와 「틀려도 이제는 문장」을 본다 → 연필을 들었다가 또 ✗ → 첫 장과 오늘 장을 나란히 펴 놓자 잘하고 있어가 날아들고 눈물 한 방울 → 그 글자가 내려앉아 연필로 새 줄에 직접 쓴다(✗ 없음).
// 장면은 GPT 이미지 2.5로 구운 판(판/*.png, 지시문 판/*.txt), 글자는 구운 펠트 글자를 오린 것(public/img/letters). 같은 구도의 판을 갈아 끼워 인형극처럼 움직인다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { FONT, Lang, ROMAN, TEXT } from './data';
import { fr, T } from './timeline';

const C = { coral: '#C63A2B', brown: '#2B1A14', paper: '#FFF8EA' };
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const FULL: React.CSSProperties = { position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' };
const prog = (t: number, a: number, b: number, easing?: (n: number) => number) => interpolate(t, [a, b], [0, 1], easing ? { ...clamp, easing } : clamp);

// 장면 — 시작 초 · 그림 · 다가갈 자리(화면 좌표) · 시작/끝 크기
const SHOTS = [
  { at: 0, img: 'page', cam: [760, 1500], z0: 1.0, z1: 1.05 },
  { at: T.flat, img: 'flat', cam: [540, 1350], z0: 1.03, z1: 1.07 },
  { at: T.window, img: 'window', cam: [700, 1200], z0: 1.0, z1: 1.05 },
  { at: T.land, img: 'flat', cam: [540, 1300], z0: 1.06, z1: 1.08 },
  { at: T.eye, img: 'eye', cam: [540, 1300], z0: 1.08, z1: 1.1 },
  { at: T.half, img: 'half', cam: [540, 1250], z0: 1.03, z1: 1.06 },
  { at: T.gust, img: 'gust', cam: [540, 1200], z0: 1.04, z1: 1.12 },
  { at: T.first, img: 'first', cam: [500, 1100], z0: 1.08, z1: 1.0 },
  { at: T.today, img: 'today', cam: [640, 1250], z0: 1.04, z1: 1.09 },
  { at: T.pencil, img: 'pencil', cam: [720, 1400], z0: 1.03, z1: 1.06 },
  { at: T.oops, img: 'oops', cam: [720, 1400], z0: 1.08, z1: 1.1 },
  { at: T.end, img: 'end', cam: [540, 1350], z0: 1.0, z1: 1.04 },
  { at: T.tear, img: 'tear', cam: [560, 1200], z0: 1.0, z1: 1.08 },
  { at: T.again, img: 'end', cam: [820, 1640], z0: 1.02, z1: 1.2 },
];
const shotAt = (t: number) => {
  let k = 0;
  for (let i = 1; i < SHOTS.length; i++) if (t >= SHOTS[i].at) k = i;
  return k;
};
const STAMPS = [
  { at: 0.2, x: 560, y: 985 },
  { at: 0.55, x: 430, y: 1095 },
  { at: 0.9, x: 470, y: 1215 },
];
const Stamps: React.FC<{ t: number }> = ({ t }) => (
  <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
    {STAMPS.map((m, i) => {
      const a = prog(t, m.at, m.at + 0.07);
      const b = prog(t, m.at + 0.07, m.at + 0.14);
      const L = 150;
      return (
        <g key={i} stroke="#D6261E" strokeWidth={15} strokeLinecap="round" fill="none" opacity={0.94}>
          {a > 0 ? <path d={`M ${m.x - 52} ${m.y - 50} L ${m.x + 54} ${m.y + 52}`} strokeDasharray={L} strokeDashoffset={L * (1 - a)} /> : null}
          {b > 0 ? <path d={`M ${m.x + 50} ${m.y - 54} L ${m.x - 50} ${m.y + 50}`} strokeDasharray={L} strokeDashoffset={L * (1 - b)} /> : null}
        </g>
      );
    })}
  </svg>
);
const EndStamps: React.FC = () => (
  <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
    {[
      [800, 1282],
      [730, 1372],
      [760, 1454],
    ].map(([x, y], i) => (
      <path key={i} d={`M ${x - 26} ${y - 25} L ${x + 27} ${y + 26} M ${x + 25} ${y - 27} L ${x - 25} ${y + 25}`} stroke="#D6261E" strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.92} />
    ))}
  </svg>
);
// 끝 — 연필이 새 줄을 쓴다. 같은 구도로 구운 끝씀 판에서 글씨만 뽑은 층(img/ink.png)을 연필 끝까지만 드러낸다
const LINE = { x0: 668, x1: 992, y: 1650, top: 1600, bottom: 1704 };
const PENCIL = { size: 330, tipX: 36, tipY: 296 };
const Writing: React.FC<{ t: number }> = ({ t }) => {
  const w = prog(t, T.write, T.written);
  const tipX = t < T.write ? interpolate(t, [T.again, T.write], [1180, LINE.x0], { ...clamp, easing: EASE_OUT }) : LINE.x0 + (LINE.x1 - LINE.x0) * w;
  // 글자마다 위아래로 짧게 움직인다. 다 쓰면 살짝 들어 올린다
  const wig = t >= T.write && t < T.written ? 12 * Math.sin(w * Math.PI * 12) : 0;
  const lift = prog(t, T.written, T.written + 0.3, EASE_OUT) * 46;
  const tipY = (t < T.write ? interpolate(t, [T.again, T.write], [1520, LINE.y], { ...clamp, easing: EASE_OUT }) : LINE.y) + wig - lift;
  const shown = LINE.x0 - 4 + (LINE.x1 + 8 - LINE.x0) * w;
  return (
    <>
      {w > 0 ? <Img src={staticFile('img/ink.png')} style={{ ...FULL, clipPath: `inset(${LINE.top}px ${1080 - shown}px ${1920 - LINE.bottom}px ${LINE.x0 - 10}px)` }} /> : null}
      <Img src={staticFile('img/pencil1.png')} style={{ position: 'absolute', left: tipX - PENCIL.tipX, top: tipY - PENCIL.tipY, width: PENCIL.size, height: PENCIL.size, filter: 'drop-shadow(0 16px 14px rgba(0,0,0,0.42))' }} />
    </>
  );
};
const Plate: React.FC<{ t: number }> = ({ t }) => {
  const k = shotAt(t);
  const s = SHOTS[k];
  const next = k + 1 < SHOTS.length ? SHOTS[k + 1].at : T.total;
  const z = interpolate(t, [s.at, next], [s.z0, s.z1], clamp);
  const sx = 3 * Math.sin((2 * Math.PI * t) / 3.7);
  const sy = 3 * Math.sin((2 * Math.PI * t) / 4.7 + 1);
  // 바람 — 공책과 함께 화면도 흔들린다
  const g = t >= T.gust && t < T.first ? interpolate(t, [T.gust, T.gust + 0.2, T.first], [14, 10, 4], clamp) : 0;
  const lp = interpolate(t, [T.land, T.land + 0.34, T.land + 0.5], [0, 1, 0], clamp); // 글자가 닿을 때 한 번 눌린다
  return (
    <AbsoluteFill style={{ transform: `translate(${sx + g * Math.sin(t * 53)}px, ${sy + g * 0.5 * Math.sin(t * 37)}px) scale(${z * (1 + 0.012 * lp)})`, transformOrigin: `${s.cam[0]}px ${s.cam[1]}px` }}>
      <Img src={staticFile(`img/${s.img}.jpg`)} style={FULL} />
      {s.img === 'page' ? <Stamps t={t} /> : null}
      {s.img === 'today' ? <Stamps t={99} /> : null}
      {s.img === 'end' ? <EndStamps /> : null}
      {t >= T.again ? <Writing t={t} /> : null}
    </AbsoluteFill>
  );
};

// 펠트 글자 하나 — 자리표 사이를 때에 맞춰 옮겨 가고, 멈춰 있을 때는 가볍게 떠 있다
type Key = { at: number; x: number; y: number; s: number; r?: number; o?: number };
const Letter: React.FC<{ t: number; id: string; keys: Key[]; seed: number }> = ({ t, id, keys, seed }) => {
  if (t < keys[0].at || t > keys[keys.length - 1].at) return null;
  let i = 0;
  while (i + 1 < keys.length && t >= keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const p = a === b ? 1 : prog(t, a.at, b.at, EASE_IO);
  const mix = (u: number, v: number) => u + (v - u) * p;
  const bob = 7 * Math.sin(t * 2.1 + seed * 1.7);
  const sway = 1.6 * Math.sin(t * 1.5 + seed);
  const size = mix(a.s, b.s);
  const op = mix(a.o ?? 1, b.o ?? 1);
  return (
    <Img
      src={staticFile(`img/letters/${id}.png`)}
      style={{ position: 'absolute', left: mix(a.x, b.x) - size / 2, top: mix(a.y, b.y) - size / 2 + bob, width: size, height: size, objectFit: 'contain', opacity: op, transform: `rotate(${mix(a.r ?? 0, b.r ?? 0) + sway}deg)`, filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.5)) drop-shadow(0 0 26px rgba(255,190,110,0.32))' }}
    />
  );
};
// 창틈(그림 window의 열린 자리)
const GATE = { x: 830, y: 870 };
const ROW_G = [300, 540, 780];
const ROW_J = [136, 318, 492, 712, 908];
const G_IDS = ['gwaen', 'chan', 'a'];
const J_IDS = ['jal', 'ha', 'go', 'it', 'eo'];
const Letters: React.FC<{ t: number }> = ({ t }) => (
  <>
    {G_IDS.map((id, i) => {
      const go = T.window + 0.08 + i * 0.2;
      const keys: Key[] = [
        { at: go, x: GATE.x, y: GATE.y, s: 100, r: 30 - i * 24, o: 0 },
        { at: go + 0.08, x: GATE.x - 30, y: GATE.y + 20, s: 140, r: 22 - i * 16 },
        { at: go + 0.5, x: ROW_G[i] + 60, y: 1130 + (i === 1 ? -26 : 0), s: 190, r: -6 + i * 6 },
        { at: T.land - 0.05, x: ROW_G[i] + 60, y: 1130 + (i === 1 ? -26 : 0), s: 190, r: -6 + i * 6 },
        { at: T.land + 0.34, x: ROW_G[i], y: 1090 + (i === 1 ? -20 : 0), s: 236, r: -4 + i * 4 },
        { at: T.half + 0.15, x: ROW_G[i], y: 880 + (i === 1 ? -20 : 0), s: 224, r: -4 + i * 4 },
        { at: T.gust + 0.02, x: ROW_G[i], y: 880 + (i === 1 ? -20 : 0), s: 224, r: -4 + i * 4 },
        { at: T.gust + 0.5, x: ROW_G[i] - 900, y: 520 + i * 40, s: 150, r: -60 - i * 20, o: 0.4 },
      ];
      return <Letter key={id} t={t} id={id} keys={keys} seed={i} />;
    })}
    {J_IDS.map((id, i) => {
      const go = T.end + 0.3 + i * 0.14;
      const keys: Key[] = [
        { at: go, x: 880, y: 760, s: 100, r: 24 - i * 10, o: 0 },
        { at: go + 0.08, x: 860, y: 760, s: 140, r: 18 - i * 8 },
        { at: go + 0.55, x: ROW_J[i], y: 600, s: 186, r: -3 + i * 1.5 },
        { at: T.tear, x: ROW_J[i], y: 600, s: 186, r: -3 + i * 1.5 },
        { at: T.tear + 0.3, x: ROW_J[i], y: 700, s: 192, r: -2 + i },
        { at: T.again, x: ROW_J[i], y: 700, s: 192, r: -2 + i },
        { at: T.again + 0.25, x: ROW_J[i], y: 600, s: 186, r: -2 + i },
        { at: T.write + 0.1 + i * 0.12, x: ROW_J[i], y: 600, s: 186, r: -2 + i },
        { at: T.write + 0.75 + i * 0.12, x: 700 + i * 62, y: 1640, s: 44, r: 0, o: 0 },
      ];
      return <Letter key={id} t={t} id={id} keys={keys} seed={i + 3} />;
    })}
  </>
);

// 위 쪽지 — 공책을 찢은 줄 종이(안전선 위 269 · 오른쪽 920 안)
const Note: React.FC<{ t: number; from: number; until: number; lang: Lang; rot?: number; sub?: string; children: React.ReactNode }> = ({ t, from, until, lang, rot = -1.2, sub, children }) => {
  if (t < from || t >= until) return null;
  const a = prog(t, from, from + 0.22, Easing.out(Easing.back(1.8)));
  const o = prog(t, from, from + 0.1);
  return (
    <div style={{ position: 'absolute', left: 60, width: 860, top: 286, opacity: o, transform: `rotate(${rot}deg) scale(${0.94 + 0.06 * a})`, transformOrigin: '50% 0%', background: C.paper, borderRadius: 8, padding: '24px 36px 26px', boxShadow: '0 14px 30px rgba(0,0,0,0.45)', textAlign: 'center' }}>
      <div style={{ position: 'absolute', left: 370, top: -18, width: 120, height: 36, background: 'rgba(240,226,190,0.72)', transform: 'rotate(-2deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
      <div style={{ fontFamily: FONT[lang], fontWeight: 800, fontSize: TEXT[lang].size, lineHeight: 1.18, color: C.brown, textWrap: 'balance' }}>{children}</div>
      {sub ? <div style={{ fontFamily: FONT.en, fontWeight: 600, fontSize: 40, lineHeight: 1.2, color: C.coral, marginTop: 6 }}>{sub}</div> : null}
    </div>
  );
};

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
// 첫 3초는 초침뿐인 빈자리 → 창이 열리며 피아노가 들어온다 · 첫 장에서 다시 줄었다가 끝에서 부푼다
const bgmAt = 3.0;
const bgmVol = (f: number) => {
  const t = f / 30 + bgmAt;
  const lvl = interpolate(t, [T.window, T.window + 0.8, T.gust, T.gust + 0.1, T.first, T.first + 0.2, T.today, T.today + 0.5, T.end, T.end + 0.8, T.total - 0.6, T.total], [0, 0.8, 0.8, 0.5, 0.5, 0.35, 0.35, 0.8, 0.8, 1, 1, 0], clamp);
  return 0.42 * MASTER * lvl;
};
const tickVol = (f: number) => {
  const t = f / 30;
  return 0.36 * MASTER * interpolate(t, [0, T.window, T.window + 0.8, T.first, T.first + 0.2, T.today, T.today + 0.4, T.total], [1, 1, 0.3, 0.3, 0.8, 0.8, 0.12, 0.12], clamp);
};
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('sfx/air.wav')} volume={(f) => 0.1 * MASTER * interpolate(f, [0, 8, fr(T.total) - 14, fr(T.total)], [0, 1, 1, 0], clamp)} />
    <Audio src={staticFile('sfx/tick.wav')} volume={tickVol} />
    <Sequence from={fr(bgmAt)} layout="none">
      <Audio src={staticFile('sfx/bgm.wav')} volume={bgmVol} />
    </Sequence>
    <Sfx file="write.wav" at={0.18} vol={0.26} />
    <Sfx file="wrong.wav" at={0.92} vol={0.2} />
    <Sfx file="roll.wav" at={1.1} vol={0.36} />
    <Sfx file="sigh.wav" at={T.flat + 0.1} vol={0.34} />
    <Sfx file="creak.wav" at={T.window - 0.1} vol={0.34} />
    <Sfx file="breeze.wav" at={T.window - 0.05} vol={0.3} />
    {[0, 1, 2].map((i) => <Sfx key={i} file="pom.wav" at={T.land - 0.1 + i * 0.1} vol={0.26} />)}
    <Vo id="g1" at={T.window + 0.5} />
    <Sfx file="gust.wav" at={T.gust - 0.1} vol={0.46} />
    <Sfx file="pages.wav" at={T.gust} vol={0.42} />
    <Sfx file="write.wav" at={T.pencil + 0.02} vol={0.5} />
    <Sfx file="wrong.wav" at={T.oops} vol={0.34} />
    <Sfx file="breeze.wav" at={T.end - 0.1} vol={0.22} />
    {[0, 1, 2, 3, 4].map((i) => <Sfx key={`j${i}`} file="pom.wav" at={T.end + 0.82 + i * 0.14} vol={0.2} />)}
    <Vo id="j1" at={T.end + 0.7} />
    <Sfx file="write.wav" at={T.write} vol={0.5} />
    <Vo id="j2" at={T.write + 0.05} />
    <Sfx file="pom.wav" at={T.written} vol={0.22} />
  </>
);

export const Film: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = useCurrentFrame() / 30;
  const X = TEXT[lang];
  return (
    <AbsoluteFill style={{ backgroundColor: '#160C07' }}>
      <Plate t={t} />
      <Letters t={t} />
      <Note t={t} lang={lang} from={0.15} until={T.flat}>{X.bad}</Note>
      <Note t={t} lang={lang} from={T.flat} until={T.window + 0.3} rot={1}>{X.coming}</Note>
      <Note t={t} lang={lang} from={T.window + 0.3} until={T.gust} sub={ROMAN.g}>{X.g}</Note>
      <Note t={t} lang={lang} from={T.gust + 0.05} until={T.first + 0.05} rot={-1.6}>{X.back}</Note>
      <Note t={t} lang={lang} from={T.first + 0.05} until={T.today} sub={ROMAN.ga}>{X.first}</Note>
      <Note t={t} lang={lang} from={T.today + 0.05} until={T.pencil} rot={1}>{X.today}</Note>
      <Note t={t} lang={lang} from={T.end + 0.6} until={T.again} rot={1} sub={ROMAN.j}>{X.j}</Note>
      <Note t={t} lang={lang} from={T.save} until={T.total + 1} rot={-0.8}>{X.save}</Note>
      <Sound />
    </AbsoluteFill>
  );
};
