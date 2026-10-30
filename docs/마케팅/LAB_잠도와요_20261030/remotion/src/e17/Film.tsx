// LAB 영어 E17 「잠도 와요」 — 펠트 카페 장면 다섯(잠 · 친구 · 비 · 눈 · 전화)이 원본 박자마다 바뀌고, 장면마다 몽글이 그것을 몸으로 겪는다
// (M18 심사관 두 번 「몽글이 그 말을 몸으로 당하는 그림이 없으면 글줄이 바뀌는 슬라이드」). 위 카드는 그 장면의 「○○가 와요」 · 읽기 · 영어 뜻.
// 다 한꺼번에 온 끝 장면에서 와요 다섯이 세로 한 줄로 맞춰지고(관문 조건 ②), 영어 동사 넷 ↔ 와요 하나 표 뒤 잠든 몽글로 끝난다.
// 전부 useCurrentFrame()으로만 움직인다.
import { measureText } from '@remotion/layout-utils';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Loc, LOCS, LocPack, SCENES, Scene, TEXT } from './data';
import { fr, T } from './timeline';

// 판(en · zhs · my) — 기획장부/LAB.md 머리말 「두 채널 판」. 영어 글만 data.ts LOCS의 그 판 글로 바뀌고, 그림 · 박자 · 소리 · 자리는 모든 판이 같다.

const C = { coral: '#F96859', coralShade: '#AE322A', brown: '#2B1A14', cream: '#FFFDF8', blue: '#7FA8D6', yellow: '#FFD86B' };
const EN = "'Inter Tight', 'SUIT', sans-serif";
const KO = "'SUIT', 'Inter Tight', sans-serif";
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const K = 1080 / 940; // 장면 그림(940×1672) → 화면(1080×1920)
const END_IMG = 'img/end.jpg';
const FIGHT_IMG = 'img/fight.jpg'; // 14.4~17.6초 — 다 몰려오는데 졸며 버티는 몽글(v5 볼 이유 「잠이 이기는 순간이 안 보인다」)
const PRE_IMG = 'img/jam_a.jpg';
const PRE_CAM: [number, number] = [720, 620];
const YAWN_CAM: [number, number] = [400, 880]; // 잠 장면 그림에서 몽글 얼굴
const END_CAM: [number, number] = [470, 900];

// 지금 보이는 장면 차례(-1 = 끝 장면 앞, 0~4 = SCENES, 5 = 끝 장면)
const sceneAt = (t: number) => {
  if (t >= T.snap) return 5;
  let k = 0;
  for (let i = 1; i < T.flips.length; i++) if (t >= T.flips[i]) k = i;
  return k;
};
const startOf = (k: number) => (k === 0 ? 0 : k === 5 ? T.snap : T.flips[k]);
const endOf = (k: number) => (k === 5 ? T.total : k === 4 ? T.snap : T.flips[k + 1]);

// ── 장면 그림 + 카메라(천천히 다가감 · 박자마다 한 번 다가갔다 돌아옴 · 손카메라 흔들림 · 전화 장면 진동) ─────────
const Plate: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const k = sceneAt(t);
  const s0 = startOf(k);
  const s1 = endOf(k);
  const pre = k === 0 && t < T.flips[0]; // 첫 1초 — 졸음 구름이 창으로 들어오는 중(v2 볼 이유 심사 「잠이 오는 움직임이 없다」)
  const yawn = k === 0 && t >= T.yawn; // 2.6초 하품 컷 — 얼굴로 다가간다(v4 볼 이유 「1.5~4초 거의 같은 화면이 3초」)
  const img = k === 5 ? (t < T.cardKo ? FIGHT_IMG : END_IMG) : pre ? PRE_IMG : SCENES[k].img;
  const [cx, cy] = k === 5 ? END_CAM : pre ? PRE_CAM : yawn ? YAWN_CAM : SCENES[k].cam;
  const push = pre
    ? interpolate(t, [0, T.flips[0]], [1.02, 1.1], clamp)
    : yawn
      ? interpolate(t, [T.yawn, s1], [1.34, 1.4], clamp)
      : interpolate(t, [s0, s1], [1.02, 1.09], clamp);
  // 박자: 장면이 바뀔 때만(뜻 줄이 붙을 때도 다가가면 원본에 없는 박자로 잡힌다 — 나란히 v1 칸 15 · 박자 57%)
  const beats = k === 5 ? [T.snap, T.card, T.cardKo, T.q] : [k === 0 ? T.flips[0] : s0];
  let punch = 0;
  for (const b of beats) punch = Math.max(punch, interpolate(t, [b - 0.02, b + 0.1, b + 0.65], [0, 1, 0], { ...clamp, easing: EASE_IO }));
  // 잠 장면: 뜻 줄이 붙을 때 고개가 한 번 꾸벅(카메라가 아래로 기울었다 돌아옴)
  let nod = 0;
  if (k === 0) nod = interpolate(t, [T.flips[0] + T.sub, T.flips[0] + T.sub + 0.5, T.flips[0] + T.sub + 1.3], [0, 1, 0], { ...clamp, easing: EASE_IO });
  // 전화 장면: 진동 두 번(장면 시작 · 뜻 줄)
  let bx = 0;
  let by = 0;
  if (k === 4) {
    for (const b of [T.flips[4] + 0.05, T.flips[4] + T.sub]) {
      const s = t - b;
      if (s >= 0 && s < 0.7) {
        bx += Math.sin(s * 95) * 9 * (1 - s / 0.7);
        by += Math.cos(s * 83) * 5 * (1 - s / 0.7);
      }
    }
  }
  const sx = 6 * Math.sin((2 * Math.PI * t) / 3.1) + bx;
  const sy = 5 * Math.sin((2 * Math.PI * t) / 4.3 + 1) + by + nod * 10;
  const rot = 0.3 * Math.sin((2 * Math.PI * t) / 5.3) - nod * 0.5;
  const z = push * (1 + 0.06 * punch);
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${z})`, transformOrigin: `${cx * K}px ${cy * K}px` }}>
      <Img src={staticFile(img)} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' }} />
      <SceneFx k={k} t={t} />
    </AbsoluteFill>
  );
};

// ── 장면마다 그것이 「오는」 움직임(그림 좌표 그대로 — Plate 안에서 함께 움직인다) ─────────────────────
const SceneFx: React.FC<{ k: number; t: number }> = ({ k, t }) => {
  if (k === 5) {
    if (t < T.cardKo) {
      // 졸며 버티는 동안: 폰이 떤다(진동 선)
      const on = Math.floor(t * 8) % 2;
      return (
        <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          {[0, 1].map((j) => (
            <g key={j} opacity={on === j ? 0.95 : 0.35}>
              <path d={`M ${(88 - j * 16) * K} ${(1300 - j * 8) * K} q -20 44 0 88`} fill="none" stroke="#FFFDF8" strokeWidth={6} strokeLinecap="round" />
              <path d={`M ${(436 + j * 16) * K} ${(1300 - j * 8) * K} q 20 44 0 88`} fill="none" stroke="#FFFDF8" strokeWidth={6} strokeLinecap="round" />
            </g>
          ))}
        </svg>
      );
    }
    // 잠이 이긴 뒤: 잠든 몽글 위 구름에서 z가 오른다(끝까지)
    return <Zzz t={t - T.cardKo} x={600} y={820} big />;
  }
  const sc: Scene = SCENES[k];
  const s = t - (k === 0 ? T.flips[0] : T.flips[k]);
  if (sc.fx === 'zzz') return s > 0 ? <Zzz t={s} x={560} y={500} /> : null; // 첫 1초(구름이 들어오는 중)엔 z가 없다
  if (sc.fx === 'bell') {
    // 문 위 종: 흔들림 선(종소리와 함께)
    const on = s > 0 && s < 2.2;
    if (!on) return null;
    const o = interpolate(s, [0, 0.15, 1.8, 2.2], [0, 1, 1, 0], clamp);
    const w = Math.floor(s * 7) % 2;
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: o }}>
        {[0, 1].map((j) => (
          <g key={j} opacity={w === j ? 1 : 0.35}>
            <path d={`M ${(780 - j * 16) * K} ${(450 - j * 8) * K} q -18 34 0 68`} fill="none" stroke={C.coralShade} strokeWidth={6} strokeLinecap="round" />
            <path d={`M ${(895 + j * 16) * K} ${(450 - j * 8) * K} q 18 34 0 68`} fill="none" stroke={C.coralShade} strokeWidth={6} strokeLinecap="round" />
          </g>
        ))}
      </svg>
    );
  }
  if (sc.fx === 'rain' || sc.fx === 'snow') {
    // 창 안쪽(그림의 창 자리)에만 내린다 — 실내로 떨어지지 않게(관문 조건 ⑤)
    const [x0, y0, x1, y1] = WINDOW[sc.fx];
    const n = sc.fx === 'rain' ? 26 : 22;
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <clipPath id={`win${k}`}>
            <rect x={x0 * K} y={y0 * K} width={(x1 - x0) * K} height={(y1 - y0) * K} />
          </clipPath>
        </defs>
        <g clipPath={`url(#win${k})`}>
          {Array.from({ length: n }, (_, j) => {
            const speed = sc.fx === 'rain' ? 1.5 : 0.32;
            const ph = (t * speed + random(`${sc.fx}p${j}`)) % 1;
            const x = (x0 + random(`${sc.fx}x${j}`) * (x1 - x0)) * K + (sc.fx === 'snow' ? Math.sin((t + j) * 1.7) * 14 : 0);
            const y = (y0 - 40 + ph * (y1 - y0 + 80)) * K;
            return sc.fx === 'rain' ? (
              <line key={j} x1={x} y1={y} x2={x - 6} y2={y + 46} stroke="#DDE8F4" strokeWidth={3.2} strokeLinecap="round" opacity={0.75} />
            ) : (
              <circle key={j} cx={x} cy={y} r={6 + random(`sr${j}`) * 6} fill="#FFFFFF" opacity={0.9} />
            );
          })}
        </g>
      </svg>
    );
  }
  return null;
};

// 창 자리(그림 좌표 x0 y0 x1 y1) — 비 · 눈 장면 그림을 보고 맞춘다
const WINDOW: Record<'rain' | 'snow', [number, number, number, number]> = {
  rain: [250, 290, 935, 800], // 창 윗부분 — 아래쪽은 창에 기댄 몽글이 가린다
  snow: [20, 250, 800, 900],
};

const Zzz: React.FC<{ t: number; x: number; y: number; big?: boolean }> = ({ t, x, y, big }) => {
  if (t < 0) return null;
  return (
    <>
      {[0, 1, 2].map((j) => {
        const ph = (t * 0.6 + j / 3) % 1;
        const sz = (big ? 46 : 40) + j * 12;
        return (
          <div key={j} style={{ position: 'absolute', left: (x + ph * 90) * K, top: (y - ph * 170) * K, fontFamily: EN, fontWeight: 900, fontSize: sz, color: '#6A6F80', opacity: Math.sin(Math.PI * ph) * 0.9, textShadow: '0 2px 0 rgba(255,253,248,0.9)' }}>
            z
          </div>
        );
      })}
    </>
  );
};

// ── 아래 띠: 첫 1초는 머리 글, 그 뒤 장면마다 「○○가 와요」 · 🔊 읽기 · 영어 직역(바로) → 「= 뜻」(뒤에) ─────────────────
// v2 시험: 위 흰 상자가 지난 두 편 머리 글 자리와 같다(haiku 9번) · 첫 「잠이 와요」의 뜻이 늦다(sonnet · GPT) · 로마자가 읽는 법인지 모름(haiku)
const subjW = (s: string, size: number) => measureText({ text: s, fontFamily: KO, fontSize: size, fontWeight: '800' }).width;
const BAND_TOP = 290; // 쇼츠 안전선 안(위 269 · 아래 1428 · 오른쪽 920) — 1530은 앱 제목 · 채널 글자에 가렸다(올리기 전 검사)
const BottomBand: React.FC<{ p: LocPack }> = ({ p }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  if (t >= T.snap) return null;
  const hookGone = interpolate(t, [T.flips[0] - 0.1, T.flips[0] + 0.05], [1, 0], clamp);
  const hookIn = interpolate(t, [0, 0.12], [0.6, 1], clamp);
  const k = sceneAt(t);
  const s = t - T.flips[k];
  const flip = interpolate(s, [0, 0.15], [0, 1], { ...clamp, easing: EASE_OUT }); // v3 · v4: 기울며 넘어가는 글을 「작아 못 읽음」 → 기울지 않고 바로 뜬다
  const mean = interpolate(s, [T.sub, T.sub + 0.3], [0, 1], { ...clamp, easing: EASE_OUT });
  const sc = SCENES[k];
  const line = p.scenes[k];
  const band: React.CSSProperties = { position: 'absolute', left: 60, width: 860, top: BAND_TOP, background: 'rgba(255,253,248,0.97)', borderRadius: 40, boxShadow: '0 10px 28px rgba(60,20,10,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center' };
  return (
    <>
      {hookGone > 0 ? (
        <div style={{ ...band, padding: '44px 40px 48px', opacity: hookGone, transform: `scale(${hookIn})` }}>
          <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: p.hookSize, lineHeight: p.hookLine, color: C.brown, textAlign: 'center', whiteSpace: 'pre-line' }}>{p.hook}</div>
        </div>
      ) : null}
      {t >= T.flips[0] ? (
        <div style={{ ...band, padding: '26px 30px 30px', transform: `translateY(${(1 - flip) * 16}px) scale(${0.96 + 0.04 * flip})` }}>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 100, lineHeight: 1.05, color: C.brown, whiteSpace: 'nowrap' }}>
            {sc.subj}
            <span style={{ color: C.coralShade, marginLeft: 20 }}>와요</span>
          </div>
          <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 44, color: C.coralShade, whiteSpace: 'nowrap', marginTop: 2 }}>🔊 {sc.read}</div>
          <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: p.litSize, lineHeight: p.litLine, color: C.brown, marginTop: 8, whiteSpace: 'nowrap' }}>
            {line.lit}
            {line.mean ? <span style={{ color: C.coralShade, opacity: mean, marginLeft: 16 }}>{line.mean}</span> : null}
          </div>
        </div>
      ) : null}
    </>
  );
};

// ── 끝 장면 ─────────────────────────────────────────────────────
// 14.4초(원본 18.0) 다 한꺼번에 온 카페 — 1초는 글 없이 잠든 몽글만(v3 볼 이유 심사 「다 왔는데 잠이 이김」이 표에 가렸다).
// 15.52초(원본 19.4 컷) 다섯 줄이 쌓이고 와요가 세로 한 줄로 맞춰진다(관문 조건 ②). 17.6초(원본 22.0) 줄마다 영어 동사가 붙고
// 가 · 이 고르는 법 한 줄(v2 · v3 셋이 같이 짚음). 개수 대비(「English 4 → Korean 1」)는 지난 편 끝 카드와 같은 틀이라 뺐다(v3 haiku 9번).
const SNAP_KO = 76;
const SUBJ_BOX = Math.max(...SCENES.map((s) => subjW(s.subj, SNAP_KO)));
const fadeIn = (f: number, t: number, d = 0.35) => interpolate(f, [fr(t), fr(t + d)], [0, 1], { ...clamp, easing: EASE_IO });
const EndCard: React.FC<{ p: LocPack }> = ({ p }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const a = fadeIn(f, T.snap + 0.15, 0.25);
  if (a <= 0 || t >= T.cardKo + 0.3) return null;
  const gone = interpolate(t, [T.cardKo, T.cardKo + 0.25], [1, 0], clamp); // 17.6초에 걷히고 잠든 몽글만 남는다(v4 볼 이유 「펀치라인이 표에 덮임」)
  const snap = interpolate(t, [T.card - 0.05, T.card + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
  const frame = interpolate(t, [T.card + 0.1, T.card + 0.35], [0, 1], { ...clamp, easing: EASE_IO });
  const en = fadeIn(f, T.snap + 0.25, 0.3);
  const wayo = interpolate(t, [T.card + 0.15, T.card + 0.35], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2.2)) });
  const rowH = 92;
  const x0 = 34;
  const top = 26;
  return (
    <div style={{ position: 'absolute', left: 60, width: 860, top: 340, height: rowH * 5 + 52, background: 'rgba(255,253,248,0.97)', borderRadius: 44, opacity: a * gone, boxShadow: '0 10px 30px rgba(80,40,20,0.18)' }}>
      {SCENES.map((sc, i) => {
        const r = interpolate(t, [T.snap + 0.15 + i * 0.08, T.snap + 0.15 + i * 0.08 + 0.2], [0, 1], { ...clamp, easing: EASE_OUT });
        const shift = (SUBJ_BOX - subjW(sc.subj, SNAP_KO)) * snap;
        return (
          <div key={i} style={{ position: 'absolute', left: x0, top: top + i * rowH, height: rowH, width: 840, display: 'flex', alignItems: 'center', opacity: r, transform: `translateX(${(1 - r) * -30}px)` }}>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: SNAP_KO, color: C.brown, whiteSpace: 'nowrap', transform: `translateX(${shift}px)` }}>
              {sc.subj.slice(0, -1)}
              <span style={{ color: '#9A7B66' }}>{sc.subj.slice(-1)}</span>
              <span style={{ color: C.coralShade, marginLeft: 18 }}>와요</span>
            </div>
            <div style={{ position: 'absolute', left: SUBJ_BOX + subjW('와요', SNAP_KO) + (p.sentSize > 50 ? 40 : 56), fontFamily: p.font, fontWeight: 800, fontSize: p.sentSize, color: C.brown, whiteSpace: 'nowrap', opacity: en }}>{p.scenes[i].sent}</div>
          </div>
        );
      })}
      {wayo > 0 ? (
        <div style={{ position: 'absolute', left: x0 + SUBJ_BOX - 30, top: -64, transform: `scale(${wayo})`, transformOrigin: '50% 100%', background: C.coralShade, color: C.cream, fontFamily: KO, fontWeight: 800, fontSize: 64, borderRadius: 30, padding: '4px 26px 8px', boxShadow: '0 6px 16px rgba(60,20,10,0.25)' }}>와요!</div>
      ) : null}
      {frame > 0 ? (
        <svg width={860} height={rowH * 5 + 52} style={{ position: 'absolute', inset: 0 }}>
          {(() => {
            const x = x0 + SUBJ_BOX + 4;
            const w = subjW('와요', SNAP_KO) + 28;
            const per = 2 * (w + rowH * 5);
            return <rect x={x} y={top - 2} width={w} height={rowH * 5 + 4} rx={30} fill="none" stroke={C.coral} strokeWidth={7} strokeDasharray={per} strokeDashoffset={per * (1 - frame)} />;
          })()}
        </svg>
      ) : null}
    </div>
  );
};

// 끝 줄 — 표가 걷히면 잠든 몽글 위에 한 줄(끝 3초의 그림은 다 한꺼번에 온 카페에서 잠든 몽글)
const EndLine: React.FC<{ p: LocPack }> = ({ p }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const a = fadeIn(f, T.q + 0.1, 0.35);
  if (a <= 0) return null;
  const bump = interpolate(t, [T.c, T.c + 0.15, T.c + 0.4], [0, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 110, width: 790, top: 300, background: 'rgba(255,253,248,0.96)', borderRadius: 40, opacity: a, transform: `translateY(${(1 - a) * 18}px)`, boxShadow: '0 10px 30px rgba(80,40,20,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 0 30px' }}>
      <div style={{ fontFamily: p.font, fontWeight: 800, fontSize: p.endLineSize, color: C.brown }}>{p.endLine}</div>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 96, lineHeight: 1.1, color: C.coralShade, transform: `scale(${1 + 0.08 * bump})` }}>{TEXT.endLineKo}</div>
    </div>
  );
};

// ── 소리 ─────────────────────────────────────────────────────────
const Vo: React.FC<{ id: string; at: number; vol?: number }> = ({ id, at: t, vol = 1 }) => (
  <Sequence from={fr(t)} layout="none">
    <Audio src={staticFile(`vo/${id}.wav`)} volume={vol * MASTER} />
  </Sequence>
);
const Sfx: React.FC<{ file: string; at: number; vol: number; dur?: number }> = ({ file, at: t, vol, dur }) => (
  <Sequence from={Math.max(0, fr(t))} durationInFrames={dur ? Math.max(2, fr(dur)) : undefined} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={(i) => vol * MASTER * (dur ? interpolate(i, [0, 3, Math.max(4, fr(dur) - 8), Math.max(5, fr(dur))], [0, 1, 1, 0], clamp) : 1)} />
  </Sequence>
);
// 장면마다 그것이 오는 소리(장면이 바뀌는 때) — 잠은 하품 대신 낮게 내려앉는 소리, 친구는 문 종, 비 · 눈은 창밖 소리, 전화는 진동
const FX_SFX: Record<Scene['fx'], { file: string; vol: number; dur?: number; at?: number }> = {
  zzz: { file: 'sleepy.wav', vol: 0.35, at: 0.05 },
  bell: { file: 'bell.wav', vol: 0.4, at: 0.02 },
  rain: { file: 'rain.wav', vol: 0.32, dur: 2.72, at: 0 },
  snow: { file: 'sparkle.wav', vol: 0.22, at: 0.1 },
  buzz: { file: 'buzz.wav', vol: 0.42, at: 0.05 },
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.11 * MASTER * interpolate(i, [0, 8, fr(T.total) - 30, fr(T.total)], [0, 1, 1, 0], clamp)} />
    {SCENES.map((sc, i) => {
      const x = FX_SFX[sc.fx];
      return (
        <React.Fragment key={i}>
          <Sfx file={x.file} at={T.flips[i] + (x.at ?? 0)} vol={x.vol} dur={x.dur} />
          <Vo id={sc.vo} at={T.flips[i] + 0.18} />
          <Sfx file="pop.wav" at={T.flips[i] + T.sub} vol={0.16} />
          {sc.fx === 'buzz' ? <Sfx file="buzz.wav" at={T.flips[i] + T.sub} vol={0.36} /> : null}
          {sc.fx === 'snow' ? <Sfx file="wind.wav" at={T.flips[i]} vol={0.22} dur={2.64} /> : null}
        </React.Fragment>
      );
    })}
    <Sfx file="sleepy.wav" at={T.yawn} vol={0.3} />
    <Sfx file="bell.wav" at={T.snap} vol={0.3} />
    <Sfx file="buzz.wav" at={T.snap + 0.15} vol={0.3} />
    <Sfx file="pop.wav" at={T.snap + 0.15} vol={0.2} />
    <Sfx file="sparkle.wav" at={T.card + 0.1} vol={0.28} />
    <Vo id="w6" at={T.card + 0.15} />
    <Sfx file="buzz.wav" at={T.card + 1.2} vol={0.26} />
    <Sfx file="sleepy.wav" at={T.cardKo} vol={0.34} />
    <Sfx file="tok.wav" at={T.cardKo + 0.35} vol={0.2} />
    <Sfx file="sleepy.wav" at={T.q + 0.1} vol={0.3} />
    <Vo id="w4" at={T.c} vol={0.9} />
  </>
);

export const Film: React.FC<{ loc?: Loc }> = ({ loc = 'en' }) => {
  const p = LOCS[loc];
  return (
    <AbsoluteFill style={{ backgroundColor: '#E9DCC4' }}>
      <Plate />
      <BottomBand p={p} />
      <EndCard p={p} />
      <EndLine p={p} />
      <Sound />
    </AbsoluteFill>
  );
};
