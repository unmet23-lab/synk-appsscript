// LAB 몽골 M18 「와요 한 낱말」 — 펠트 판의 다섯 줄(그림 다섯은 무대판 한 장에 구운 것)이 몽골어 → 한국어로 한 줄씩 뒤집히고,
// 줄마다 그것이 「오는」 움직임(손 흔듦 · 비 · 눈 · 졸음 · 벨)이 붙는다. 다섯이 다 뒤집히면 와요가 세로 한 줄로 맞춰지고,
// 끝은 몽골어 동사 넷 ↔ 와요 하나 표(관문 조건 ①). 전부 useCurrentFrame()으로만 움직인다.
// 11-18 판본 틀: 그 나라 글(위 머리 글 · 판의 다섯 줄 · 읽는 법 · 끝 표의 머리 · 동사 · 낱말 · 「한국어로는」 줄 · 와요 읽는 법)과 글꼴 · 글자 크기는
// 판본 꾸러미 p(./판본/<KEY>.json)에서 받는다. 그림 · 한국어 · 소리 · 박자 · 카메라는 그대로다.
import { measureText } from '@remotion/layout-utils';
import React from 'react';
import { AbsoluteFill, Audio, continueRender, delayRender, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { fontsReady } from '../lib/fonts';
import { ROWS, Row, SUBJECTS } from './data';
import { fr, T } from './timeline';
import { LocPack } from './판본';

const C = { coral: '#F96859', coralShade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8', blue: '#5B8FC9' };
const MN = "'Inter Tight', 'SUIT', sans-serif"; // 그 나라 글이 아닌 기호(z · ! · ↓)만 이 서체로 — 그 나라 글은 판본 font
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

const X0 = 330; // 글 줄 왼쪽(그림 칸 오른쪽)
const KO_SIZE = 64;
const SUBJ_BOX = 214; // 와요 줄을 맞출 때 주어 칸 너비(친구가 · 전화가에 맞춤)
const subjW = (s: string) => measureText({ text: s, fontFamily: KO, fontSize: KO_SIZE, fontWeight: '800' }).width;
// 다섯 주어의 폭 — 글꼴(SUIT)이 다 들어온 뒤에만 잰다(11-18 판본 틀로 옮기며 고침). measureText는 처음 잰 폭을 그 렌더 탭에 기억하는데,
// 글꼴이 오기 전에 재면 대체 글꼴 폭(약 7~10px 큼)이 남아 와요 줄 맞춤(14.4초~)에서 와요가 테 왼쪽 선에 걸리고, 그런 탭과 아닌 탭이 섞이면
// 8프레임마다 줄이 튀었다(옮기기 전 렌더 · 옮긴 뒤 렌더 모두). 10-30에 나간 몽골판은 글꼴이 온 뒤에 잰 판이라 이 고침으로 그 화면과 같아진다.
const useSubjWidths = (): number[] | null => {
  const [ws, setWs] = React.useState<number[] | null>(null);
  const [handle] = React.useState(() => delayRender('주어 폭 재기(글꼴 기다림)'));
  React.useEffect(() => {
    let live = true;
    fontsReady.then(() => {
      if (live) setWs(ROWS.map((r) => subjW(r.subj)));
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [handle]);
  return ws;
};

// 판의 한 줄 — 뒤집히기 전 그 나라 말(판본 lines) 크게, 뒤집힌 뒤 한국어 · 읽는 법(판본 reads) · 그 나라 말 작게. L = 판본 글(이 안의 p는 뒤집힘 진행)
const RowText: React.FC<{ L: LocPack; row: Row; i: number; w: number }> = ({ L, row, i, w }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const ft = T.flips[i];
  const p = interpolate(t, [ft, ft + 0.36], [0, 1], { ...clamp, easing: EASE_IO });
  const snap = interpolate(t, [T.snap, T.snap + 0.35], [0, 1], { ...clamp, easing: EASE_OUT });
  const bump = interpolate(t, [T.snap + 0.25, T.snap + 0.4, T.snap + 0.6], [0, 1, 0], clamp);
  const gone = interpolate(t, [T.card, T.card + 0.35], [1, 0.12], clamp); // 끝 표가 뜨면 뒤로 물러난다
  const shift = (SUBJ_BOX - w) * snap; // w = 주어 폭(useSubjWidths)
  const mnRot = interpolate(p, [0, 0.5], [0, 90], clamp);
  const koRot = interpolate(p, [0.5, 1], [-90, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: X0, top: (row.ty ?? row.y) - 86, width: 640, height: 172, perspective: 900, opacity: gone }}>
      {p < 0.5 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', transform: `rotateX(${mnRot}deg)`, fontFamily: L.font, fontWeight: 700, fontSize: L.lineSizes[i], color: C.brown, letterSpacing: -0.5 }}>{L.lines[i]}</div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', transform: `rotateX(${koRot}deg)` }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: KO_SIZE, lineHeight: 1.05, color: C.brown, whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-block', transform: `translateX(${shift}px)` }}>{row.subj}</span>
            <span style={{ display: 'inline-block', marginLeft: 16, transform: `translateX(${shift}px) scale(${1 + 0.14 * bump})`, transformOrigin: 'left center', color: C.coralShade }}>와요</span>
          </div>
          <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: L.readSize, lineHeight: 1.15, color: C.coralShade, marginTop: 4, transform: `translateX(${shift}px)` }}>{L.reads[i]}</div>
          <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: L.meanSize, lineHeight: L.lineH, color: C.brown, opacity: 0.8, transform: `translateX(${shift}px)` }}>{L.lines[i]}</div>
        </div>
      )}
    </div>
  );
};

// 와요 줄 맞춤 — 다섯 와요를 두르는 테(그어지며 나타난다)
const SnapFrame: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const p = interpolate(t, [T.snap + 0.3, T.snap + 0.75], [0, 1], { ...clamp, easing: EASE_IO });
  const gone = interpolate(t, [T.card, T.card + 0.35], [1, 0], clamp);
  if (p <= 0) return null;
  const x = X0 + SUBJ_BOX + 4;
  const y0 = ROWS[0].y - 80;
  const y1 = (ROWS[4].ty ?? ROWS[4].y) - 4;
  const w = 158;
  const per = 2 * (w + (y1 - y0));
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: gone }}>
      <rect x={x} y={y0} width={w} height={y1 - y0} rx={34} fill="none" stroke={C.coral} strokeWidth={7} strokeDasharray={per} strokeDashoffset={per * (1 - p)} />
    </svg>
  );
};

// ── 오는 움직임(그 줄이 뒤집힌 뒤 2.4초) ────────────────────────────────
const Fx: React.FC<{ row: Row; i: number }> = ({ row, i }) => {
  const f = useCurrentFrame();
  const t = f / 30 - T.flips[i];
  if (t < 0 || t > 2.6) return null;
  const fade = interpolate(t, [0, 0.2, 2.2, 2.6], [0, 1, 1, 0], clamp);
  const y = row.y;
  if (row.fx === 'wave') {
    // 흔드는 손 옆 움직임 선 셋
    const w = Math.sin(t * Math.PI * 4) * 0.5 + 0.5;
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: fade }}>
        {[0, 1, 2].map((k) => (
          <path key={k} d={`M ${282 + k * 14} ${y - 78 - k * 6} q 14 22 0 44`} fill="none" stroke={C.coralShade} strokeWidth={6} strokeLinecap="round" opacity={0.35 + 0.65 * ((w + k * 0.3) % 1)} />
        ))}
      </svg>
    );
  }
  if (row.fx === 'rain') {
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: fade }}>
        {Array.from({ length: 9 }, (_, k) => {
          const x = 120 + random(`r${k}`) * 170;
          const ph = (t * 1.6 + random(`rp${k}`)) % 1;
          return <ellipse key={k} cx={x} cy={y + 70 + ph * 110} rx={6} ry={13} fill={C.blue} opacity={0.85 * (1 - ph)} />;
        })}
      </svg>
    );
  }
  if (row.fx === 'snow') {
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: fade }}>
        {Array.from({ length: 12 }, (_, k) => {
          const ph = (t * 0.55 + random(`sp${k}`)) % 1;
          const x = 80 + random(`s${k}`) * 250 + Math.sin((t + k) * 2.2) * 12;
          return <circle key={k} cx={x} cy={y - 110 + ph * 230} r={6 + random(`sr${k}`) * 5} fill="#FFFFFF" opacity={0.95 * Math.sin(Math.PI * ph)} stroke="#D9E2EC" strokeWidth={1.5} />;
        })}
      </svg>
    );
  }
  if (row.fx === 'zzz') {
    return (
      <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
        {[0, 1, 2].map((k) => {
          const ph = (t * 0.7 + k / 3) % 1;
          return (
            <div key={k} style={{ position: 'absolute', left: 278 + ph * 50, top: y - 70 - ph * 120, fontFamily: MN, fontWeight: 800, fontSize: 30 + k * 8, color: '#5A5F6E', opacity: Math.sin(Math.PI * ph) }}>
              z
            </div>
          );
        })}
      </div>
    );
  }
  // ring — 전화기 둘레 울림 선(두 쪽, 번갈아)
  const on = Math.floor(t * 8) % 2;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: fade }}>
      {[0, 1].map((k) => (
        <g key={k} opacity={on === k ? 1 : 0.35}>
          <path d={`M ${86 - k * 14} ${y - 40 - k * 10} q -22 40 0 80`} fill="none" stroke={C.coralShade} strokeWidth={6} strokeLinecap="round" />
          <path d={`M ${322 + k * 14} ${y - 40 - k * 10} q 22 40 0 80`} fill="none" stroke={C.coralShade} strokeWidth={6} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
};


// 몽글 — 줄마다 그것이 몽글에게도 「온다」(v1 볼 이유 심사: 인형이 끝까지 아무것도 안 한다): 하트(친구) · 비구름 · 눈 · 졸음 · 벨에 놀람.
// 와요가 맞춰지면 「!」.
const MX = 862; // 몽글 머리 가운데(무대판 좌표)
const MY = 1372; // 몽글 머리 꼭대기
const MongleFx: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const bubble = (txt: string, o: number, key: string) =>
    o > 0 ? (
      <div key={key} style={{ position: 'absolute', left: MX + 40, top: MY - 150 + Math.sin(t * 3) * 4, width: 92, height: 92, borderRadius: 46, background: C.cream, opacity: o, transform: `scale(${0.7 + 0.3 * o})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MN, fontWeight: 900, fontSize: 60, color: C.coralShade, boxShadow: '0 6px 16px rgba(80,40,20,0.18)' }}>{txt}</div>
    ) : null;
  const parts: React.ReactNode[] = [];
  ROWS.forEach((row, i) => {
    const s = t - (T.flips[i] + 0.25);
    if (s < 0 || s > 2.3) return;
    const o = interpolate(s, [0, 0.2, 1.9, 2.3], [0, 1, 1, 0], clamp);
    if (row.fx === 'wave') {
      const up = interpolate(s, [0, 1.2], [0, 1], { ...clamp, easing: EASE_OUT });
      parts.push(<div key="h" style={{ position: 'absolute', left: MX - 30, top: MY - 70 - up * 60, fontSize: 64, opacity: o, transform: `scale(${0.6 + 0.4 * up})` }}>❤️</div>);
    } else if (row.fx === 'rain') {
      parts.push(
        <svg key="r" width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: o }}>
          {[[-60, 0, 56], [0, -14, 66], [62, 2, 52]].map(([dx, dy, r], k) => <circle key={k} cx={MX + dx} cy={MY - 130 + dy} r={r} fill="#9AA3AE" />)}
          {Array.from({ length: 7 }, (_, k) => {
            const ph = (s * 1.8 + random(`mr${k}`)) % 1;
            return <ellipse key={`d${k}`} cx={MX - 90 + random(`mrx${k}`) * 180} cy={MY - 90 + ph * 120} rx={6} ry={13} fill={C.blue} opacity={0.9 * (1 - ph)} />;
          })}
        </svg>,
      );
    } else if (row.fx === 'snow') {
      parts.push(
        <svg key="s" width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: o }}>
          {Array.from({ length: 10 }, (_, k) => {
            const ph = (s * 0.6 + random(`ms${k}`)) % 1;
            return <circle key={k} cx={MX - 140 + random(`msx${k}`) * 280 + Math.sin((s + k) * 2) * 10} cy={MY - 200 + ph * 220} r={7 + random(`msr${k}`) * 5} fill="#FFFFFF" stroke="#D9E2EC" strokeWidth={1.5} opacity={Math.sin(Math.PI * ph)} />;
          })}
        </svg>,
      );
    } else if (row.fx === 'zzz') {
      parts.push(
        <div key="z" style={{ position: 'absolute', inset: 0, opacity: o }}>
          {[0, 1, 2].map((k) => {
            const ph = (s * 0.7 + k / 3) % 1;
            return <div key={k} style={{ position: 'absolute', left: MX + 30 + ph * 70, top: MY - 40 - ph * 150, fontFamily: MN, fontWeight: 900, fontSize: 40 + k * 12, color: '#5A5F6E', opacity: Math.sin(Math.PI * ph) }}>z</div>;
          })}
        </div>,
      );
    } else {
      parts.push(bubble('!', o, 'ring'));
      const on = Math.floor(s * 10) % 2;
      parts.push(
        <svg key="sh" width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: o * (on ? 1 : 0.4) }}>
          <path d={`M ${MX - 180} ${MY + 20} l -26 -16 M ${MX - 186} ${MY + 60} l -32 0 M ${MX - 180} ${MY + 100} l -26 16`} stroke={C.coralShade} strokeWidth={7} strokeLinecap="round" />
        </svg>,
      );
    }
  });
  const ex = interpolate(t, [T.snap + 0.1, T.snap + 0.4, T.card - 0.1, T.card + 0.2], [0, 1, 1, 0], clamp);
  parts.push(bubble('!', ex, 'snap'));
  return <>{parts}</>;
};// ── 위 머리 글 ─────────────────────────────────────────────────────
// 판본 title · titleSize. 줄 바꿈 문자로 줄을 나눌 수 있고, 글 폭 760px를 넘으면 줄이 바뀐다(몽골판 한 줄은 약 703px라 예전 렌더 그대로)
const Title: React.FC<{ p: LocPack }> = ({ p }) => {
  const f = useCurrentFrame();
  const second = [...T.flips].sort((x, y) => x - y)[1];
  const gone = interpolate(f, [fr(second - 0.3), fr(second)], [1, 0], clamp); // 둘째 줄이 뒤집히면 걷는다(v1 시험: 위 제목 띠가 지난 편과 같아 보임)
  return (
    <div style={{ position: 'absolute', left: 0, width: 1080, top: 150, display: 'flex', justifyContent: 'center', opacity: gone }}>
      <div style={{ background: C.cream, borderRadius: 28, padding: '12px 26px 14px', fontFamily: p.font, fontWeight: 800, fontSize: p.titleSize, color: C.brown, boxShadow: '0 6px 18px rgba(80,40,20,0.14)', maxWidth: 760, textAlign: 'center', whiteSpace: 'pre-line' }}>{p.title}</div>
    </div>
  );
};

// ── 끝 표: 그 나라 말 동사 넷 ↔ 와요 하나 ──────────────────────────────────
// 판본 endHead · verbs · nouns · endKo · wayoRead(와 글자 크기). 머리 · 「한국어로는」 줄은 줄 바꿈 문자로 줄을 나눌 수 있고 글 폭 820px에서 줄이 바뀐다(몽골판은 예전 렌더 그대로)
const fadeIn = (f: number, t: number, d = 0.4) => interpolate(f, [fr(t), fr(t + d)], [0, 1], { ...clamp, easing: EASE_IO });
const EndCard: React.FC<{ p: LocPack }> = ({ p }) => {
  const f = useCurrentFrame();
  const a = fadeIn(f, T.card, 0.35);
  if (a <= 0) return null;
  const b = fadeIn(f, T.cardKo);
  const q = fadeIn(f, T.q);
  const c = fadeIn(f, T.c);
  const pop = interpolate(f, [fr(T.cardKo), fr(T.cardKo + 0.3)], [0.6, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: 70, width: 880, top: 170, height: 1190, background: 'rgba(255,253,248,0.97)', borderRadius: 44, opacity: a, transform: `translateY(${(1 - a) * 24}px)`, boxShadow: '0 10px 30px rgba(80,40,20,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 56 }}>
      <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: p.endHeadSize, color: C.brown, maxWidth: 820, textAlign: 'center', whiteSpace: 'pre-line' }}>{p.endHead}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginTop: 30, width: 700 }}>
        {p.verbs.map((v, k) => (
          <div key={k} style={{ background: '#EFE4D2', borderRadius: 24, padding: '14px 0 16px', textAlign: 'center', opacity: fadeIn(f, T.card + 0.08 * k, 0.3) }}>
            <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: p.verbSize, color: C.brown, lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontFamily: p.font, fontWeight: 700, fontSize: p.nounSize, color: C.brown, opacity: 0.7, marginTop: 4 }}>{p.nouns[k]}</div>
          </div>
        ))}
      </div>
      <div style={{ opacity: b, marginTop: 34, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: MN, fontWeight: 800, fontSize: 44, color: C.brown }}>↓</div>
        <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: p.endKoSize, color: C.brown, marginTop: 10, maxWidth: 820, textAlign: 'center', whiteSpace: 'pre-line' }}>{p.endKo}</div>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 176, lineHeight: 1.05, color: C.coralShade, transform: `scale(${pop})` }}>와요</div>
        <div style={{ fontFamily: p.font, fontWeight: 600, fontSize: p.wayoReadSize, color: C.coralShade }}>{p.wayoRead}</div>
      </div>
      {/* 끝 질문 · 댓글 안내는 캡션으로(v1 시험: 세 시험관이 끝 질문을 짚고, 두 시험관이 댓글 알약 끝 카드를 지난 편과 같다고 셈) — 그 자리엔 다섯 주어가 와요 하나로 모인다 */}
      <div style={{ opacity: q, marginTop: 26, fontFamily: KO, fontWeight: 800, fontSize: 46, color: C.brown, transform: `scale(${1 + 0.06 * c})` }}>{SUBJECTS}</div>
    </div>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number; from?: number; dur?: number }> = ({ file, at: t, vol, from = 0, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? Math.max(2, fr(dur)) : undefined} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} startFrom={fr(from)} volume={(i) => vol * MASTER * (dur ? interpolate(i, [0, 2, Math.max(3, fr(dur) - 5), Math.max(4, fr(dur))], [0, 1, 1, 0], clamp) : 1)} />
  </Sequence>
);
const FX_SFX: Record<Row['fx'], { file: string; vol: number }> = {
  wave: { file: 'ding1.wav', vol: 0.3 },
  rain: { file: 'tick.wav', vol: 0.25 },
  snow: { file: 'sparkle.wav', vol: 0.22 },
  zzz: { file: 'tok.wav', vol: 0.2 },
  ring: { file: 'ding1.wav', vol: 0.32 },
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.12 * MASTER * interpolate(i, [0, 8, fr(T.total) - 30, fr(T.total)], [0, 1, 1, 0], clamp)} />
    {ROWS.map((r, i) => (
      <React.Fragment key={i}>
        <Sfx file="page.wav" at={T.flips[i] - 0.02} vol={0.35} />
        <Vo id={`w${i + 1}`} at={T.flips[i] + 0.12} />
        <Sfx file={FX_SFX[r.fx].file} at={T.flips[i] + 1.15} vol={FX_SFX[r.fx].vol} />
        {r.fx === 'ring' ? <Sfx file="ding1.wav" at={T.flips[i] + 1.45} vol={0.28} /> : null}
      </React.Fragment>
    ))}
    <Sfx file="sparkle.wav" at={T.snap + 0.25} vol={0.28} />
    <Vo id="w6" at={T.snap + 0.3} />
    <Sfx file="pop.wav" at={T.card} vol={0.25} />
    <Sfx file="achieve.wav" at={T.cardKo} vol={0.22} />
  </>
);

// p = 판본 글(./판본/<KEY>.json). Root가 글이 다 찬 판본만 컴포지션 wayo-<KEY>로 등록한다(인사가 켜진 판본은 Greeting.tsx가 앞에 인사를 붙인다)
export const Film: React.FC<{ p: LocPack }> = ({ p }) => {
  const f = useCurrentFrame();
  const ws = useSubjWidths(); // 재기 전(null)인 프레임은 찍히지 않는다(delayRender)
  const push = interpolate(f, [0, fr(T.total)], [1, 1.06], clamp); // 끝까지 완전히 멈춘 화면이 되지 않게
  // 뒤집힐 때마다(와요 맞춤 때도) 그 줄 쪽으로 한 박 다가갔다 돌아온다 — 원본의 「한 줄씩 바뀌는 박자」를 화면 전체의 박자로
  const t = f / 30;
  const beats: [number, number][] = [...T.flips.map((b, i) => [b, ROWS[i].ty ?? ROWS[i].y] as [number, number]), [T.snap, 860]];
  let punch = 0;
  let oy = 768;
  for (const [b, y] of beats) {
    const k = interpolate(t, [b - 0.02, b + 0.1, b + 0.7], [0, 1, 0], { ...clamp, easing: EASE_IO });
    if (k > punch) {
      punch = k;
      oy = y;
    }
  }
  const z = push * (1 + 0.07 * punch);
  // 원본은 손에 든 카메라 한 컷 — 판이 멈춘 그림으로 보이지 않게 느린 흔들림(올리기 전 검사 ② 정지 38% → 기준 15%)
  const sx = 7 * Math.sin((2 * Math.PI * t) / 3.1);
  const sy = 6 * Math.sin((2 * Math.PI * t) / 4.3 + 1);
  const rot = 0.35 * Math.sin((2 * Math.PI * t) / 5.3);
  return (
    <AbsoluteFill style={{ backgroundColor: '#E9DCC4' }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${z * 1.03})`, transformOrigin: `50% ${oy}px` }}>
        <Img src={staticFile('img/stage.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
        {ROWS.map((r, i) => (
          <Fx key={`fx${i}`} row={r} i={i} />
        ))}
        {ROWS.map((r, i) => (
          <RowText key={i} L={p} row={r} i={i} w={ws ? ws[i] : SUBJ_BOX} />
        ))}
        <SnapFrame />
        <MongleFx />
      </AbsoluteFill>
      <Title p={p} />
      <EndCard p={p} />
      <Sound />
    </AbsoluteFill>
  );
};
