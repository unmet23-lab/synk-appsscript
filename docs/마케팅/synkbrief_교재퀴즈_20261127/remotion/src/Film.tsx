// synkbrief B75 「교재 사진 한 장으로 퀴즈 다섯 문제」 본편 — 수요 장부 synkbrief 5번(공부할 때 쓰는 명령어, 한 사람의 한 가지 일).
// 결(장부 머리말 「화면 결」): 실제 화면(판)을 아래에 두고, 빈 위쪽은 같은 판을 뒤집어 흐리게 채운 뒤 그늘을 얹는다. 큰 글자가 곧 말이다.
// 검정 · 흰 + 버터 한 곳, SUIT 하나. 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선은 우리가 더하지 않는다(말풍선 · 빨강 · 초록은 ChatGPT 화면의 것).
// 화면은 모두 2026-11-27 ChatGPT 임시 채팅에 실제로 보내고 받은 것이다(scripts/재료.py). 보낸 사진은 우리가 직접 쓴 공부 쪽이다.
// 여행 동선 편 최종 확인 미흡(글자 가림)에서 배운 것: 글이 든 조각(카드 · 말풍선)은 처음부터 안전선(가로 65~920 · 아래 1428) 안에 두고, 판 다가감을 작게 둔다.
// 첫 칸은 Omni 1.2 Flash로 구운 지하철 영상이다(영상칸/ — 제작 절차 「정지 그림 칸은 Omni 영상으로」).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import sizes from './sizes.json';
import { S, VO, TAGS, LINES, SOUNDS, BGM, FPS, TOTAL, SCENE, SCENE_DUR } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const sec = (s: number) => Math.round(s * FPS);
const SZ = sizes as unknown as Record<string, [number, number]>;
const BG = `rgb(${(SZ._bg ?? [14, 14, 14]).join(',')})`; // ChatGPT 어두운 화면 바탕
const SHADE = '10,10,10';
const BUTTER = '#F5C445';
const X = 84;
const PT = 600; // 판 윗변 — 큰 글 두 줄(332~560) 아래
const TEXT_TOP = 332;
const TAG_TOP = 278; // 위 머리 자리 안전선 269 아래
const MASTER = 0.8;
// 판 안에서 글이 든 조각을 두는 상자 — 화면 가로 82~902(안전선 65~920 안쪽 여유), 판 0~808(화면 600~1408, 아래 안전선 1428 위)
const BOX = { x0: 82, x1: 902, h: 808 };
const CARD_K = 820 / 1002; // 카드(가로 1002px)를 상자 너비에 — 모든 카드를 같은 배율로 둔다
const BIG_K = 1.14; // 장면 심사판(글 · 말 없음)은 카드를 화면보다 조금 넓게 — 첫 컷 검사 v3 「위아래 어두운 여백이 넓다」
const img = (n: string) => staticFile(`img/${n}.png`);
const inAt = (t: number, a: number, d = 0.22) => interpolate(t, [a - 0.02, a + d], [0, 1], { ...clamp, easing: EASE_OUT });

// 그림 한 장 — 왼쪽 끝이 큰 글의 왼쪽 축(BOX.x0)에, 위 y. vis = 원본에서 보일 높이(px) — 글줄 사이에서 자르고 카드 밑변을 둥글게 닫는다
// 미학 맹검(카본, r5) 「카드 아래가 마감선 없이 허공에 잘림 · 해설 둘째 줄이 반토막」 · 「제목 왼쪽 축과 카드 왼쪽 축이 어긋남」으로 흐리게 끊던 것과 가운데 두기를 바꿨다
const EDGE = 3; // 카드 조각에서 테두리 바깥 끝(px) — 재료.py의 CARD_X가 테두리 바깥 4px부터 자른다
const RAD = 46; // 카드 모서리 둥글기(원본 px)
const Pic: React.FC<{ n: string; k: number; y: number; x?: number; vis?: number; style?: React.CSSProperties }> = ({ n, k, y, x, vis, style }) => {
  const [w, h] = SZ[n];
  const hh = (vis ?? h) * k;
  const im = <Img src={img(n)} style={{ position: 'absolute', left: vis ? -EDGE * k : 0, top: 0, width: w * k, height: h * k, display: 'block' }} />;
  return (
    <div style={{ position: 'absolute', left: x ?? BOX.x0, top: y, width: w * k, height: hh, overflow: 'hidden', ...style }}>
      {vis ? (
        <>
          <div style={{ position: 'absolute', left: EDGE * k, top: 0, width: (w - 2 * EDGE) * k, height: hh, overflow: 'hidden', borderBottomLeftRadius: RAD * k, borderBottomRightRadius: RAD * k }}>{im}</div>
          <div style={{ position: 'absolute', left: EDGE * k, bottom: 0, width: (w - 2 * EDGE) * k, height: RAD * k + 4, boxSizing: 'border-box', border: `${Math.max(1.5, 2 * k)}px solid rgb(49,49,49)`, borderTop: 'none', borderRadius: `0 0 ${RAD * k}px ${RAD * k}px` }} />
        </>
      ) : im}
    </div>
  );
};
const fitK = (n: string, maxW = BOX.x1 - BOX.x0, maxH = BOX.h) => Math.min(maxW / SZ[n][0], maxH / SZ[n][1]);

// 누른 자리 — 화면 녹화의 「누른 곳 보이기」처럼 흰 둥근 빛이 한 번 퍼진다(0.45초)
// 장면 심사 v5 「누를 때 누르는 표시가 없고 화면이 이미 결과로 넘어가 있다」 — 빛이 결과보다 0.25초 먼저 서고(눌림), 결과가 뜬 뒤 퍼지며 사라진다
const TAP_LEAD = 0.25;
const Tap: React.FC<{ t: number; at: number; x: number; y: number }> = ({ t, at, x, y }) => {
  const p = interpolate(t, [at - TAP_LEAD, at, at + 0.5], [0, 0.35, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  const r = 30 + 46 * p;
  const a = p < 0.35 ? p / 0.35 : (1 - p) / 0.65;
  return <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `rgba(255,255,255,${0.42 * a})`, border: `4px solid rgba(255,255,255,${0.85 * a})` }} />;
};

// ── 판의 내용(판 좌표: 0 = 판 윗변) ──
// 공부 쪽(보낸 사진)이 오른쪽부터 퀴즈 카드(1/5)로 쓸려 바뀐다 — 흰 세로 줄이 오른쪽 끝에서 왼쪽 끝으로
const PageToCard: React.FC<{ from: number; at: number; dur?: number; big?: boolean }> = ({ from, at, dur = 0.55, big }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const kp = big ? 1080 / SZ.page[0] : fitK('page');
  const kc = big ? BIG_K : CARD_K;
  const pw = SZ.page[0] * kp;
  const ph = SZ.page[1] * kp;
  const cw = SZ.q1[0] * kc;
  const ch = SZ.q1[1] * kc;
  const mw = Math.max(pw, cw);
  const L = big ? 540 - mw / 2 : BOX.x0;
  const px = big ? 540 - pw / 2 : BOX.x0;
  const qx = big ? 540 - cw / 2 : BOX.x0;
  const pageTop = big ? (1920 - ph) / 2 : (BOX.h - ph) / 2;
  const cardTop = big ? (1920 - ch) / 2 : (BOX.h - ch) / 2;
  const d = interpolate(t, [at, at + dur], [L + mw, L], { ...clamp, easing: EASE_IO });
  const done = t >= at + dur;
  return (
    <>
      {!done ? <Pic n="page" k={kp} y={pageTop} x={px} style={{ clipPath: `inset(0 ${Math.max(0, px + pw - d)}px 0 0)` }} /> : null}
      {t >= at ? <Pic n="q1" k={kc} y={cardTop} x={qx} style={{ clipPath: `inset(0 0 0 ${Math.max(0, d - qx)}px)` }} /> : null}
      {t >= at && !done ? <div style={{ position: 'absolute', left: d - 4, top: Math.min(pageTop, cardTop) - 20, width: 8, height: Math.max(ph, ch) + 40, background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 24px 8px rgba(255,255,255,0.45)' }} /> : null}
    </>
  );
};

// 보낸 사진 미리보기와 보낸 한 줄 — 실제 화면 그대로, 크게
// 볼 이유 심사 r4 「4~8초 검은 화면에 말풍선 하나와 작은 사진만 4초」 — 받은 1번 카드를 어둡게 깔고, 그 위에 보낸 사진 미리보기와 말풍선을 얹는다
// 미학 맹검 r5 「캡처를 대충 덮어 씌운 짜깁기 티」 — 말풍선 조각은 바탕을 투명하게(재료.py), 뒤 카드는 어둡게 하지 않고 옅게(바탕색이 그대로)
// 이해 시험 r4 · r5 s · G 「답은 맨 끝이라더니 바로 채점」 — 「답은 숨겨 뒀다가」(S.d)에 말풍선이 빠지고 뒤의 1번 카드(답이 안 보이는 처음 화면)가 밝아진다
const SentPanel: React.FC<{ from?: number }> = ({ from = S.c }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const k = fitK('sent');
  const p = inAt(t, S.c + 0.05, 0.3);
  const out = interpolate(t, [S.d, S.d + 0.3], [1, 0], clamp);
  const lit = interpolate(t, [S.d, S.d + 0.45], [0, 1], { ...clamp, easing: EASE_OUT });
  const ch = SZ.q1[1] * CARD_K;
  return (
    <>
      <Pic n="q1" k={CARD_K} y={(BOX.h - ch) / 2} style={{ opacity: 0.3 + 0.7 * lit, filter: `blur(${1.5 * (1 - lit)}px)` }} />
      {out > 0 ? <Pic n="sent" k={k} y={40 + (1 - p) * 30} style={{ opacity: p * out, filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.7))' }} /> : null}
    </>
  );
};

// 끝 — 찍은 쪽 사진이 누른 퀴즈 카드 위(오른쪽 아래)에 흰 테로 얹힌다. 사진 속 글은 안전선 안(가로 690~900 · 화면 아래 1413 안)
const EndThumb: React.FC<{ from: number; at: number }> = ({ from, at }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const p = inAt(t, at, 0.35);
  if (p <= 0) return null;
  const w = 190; // r6에서 230이 B의 까닭 글 끝을 가려 줄이고 내렸다
  const h = (w * SZ.page[1]) / SZ.page[0];
  return (
    <div style={{ position: 'absolute', left: 690, top: 540 + (1 - p) * 40, width: w + 20, height: h + 20, background: '#fff', borderRadius: 6, boxShadow: '0 18px 40px rgba(0,0,0,0.6)', transform: `rotate(${4 * p}deg)`, opacity: p }}>
      <Img src={img('page')} style={{ position: 'absolute', left: 10, top: 10, width: w, height: h }} />
    </div>
  );
};

// 1/5 카드 — 누르기 전 → A를 누름 → 틀림(빨강)과 정답(초록) · 까닭. 누른 뒤 판은 정답 까닭 아래(C · D)를 끊는다
const Q1_VIS = 784; // q1x 원본에서 보일 높이(B의 까닭 742 아래 · C 805 위)
const Q5_VIS = 1050; // q5x 원본에서 보일 높이(넷째 보기 해설 둘째 줄 1022 아래 · 「제출」 줄 1091 위)
// full — 끝 화면은 카드를 잘라 두지 않고 다 보인다(이해 시험 r4 h 「끝에 카드가 아래쪽에서 잘린 채 멈춤 — 흐지부지」)
const Q1X_FULL_K = BOX.h / SZ.q1x[1];
const TapPanel: React.FC<{ from: number; tap: number; big?: boolean; full?: boolean }> = ({ from, tap, big, full }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const k = big ? BIG_K : full ? Q1X_FULL_K : CARD_K;
  const y = big ? (1920 - SZ.q1[1] * k) / 2 : full ? 0 : (BOX.h - SZ.q1[1] * k) / 2;
  const left = big ? 540 - (SZ.q1[0] * k) / 2 : BOX.x0;
  const after = t >= tap;
  // A 동그라미: 원본 화면 (122, 1300) → q1 조각 (85, 394)
  return (
    <>
      {after ? <Pic n="q1x" k={k} y={full ? 0 : y} x={left} vis={full ? undefined : Q1_VIS} /> : <Pic n="q1" k={k} y={y} x={left} />}
      <Tap t={t} at={tap} x={left + 85 * k} y={y + 394 * k} />
    </>
  );
};

// 틀린 2번 · 3번 — 같은 배율, 넘어갈 때 아래에서 살짝 올라온다
const WrongPanel: React.FC<{ from: number; n: string; vis?: number; k?: number }> = ({ from, n, vis, k = CARD_K }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const p = inAt(t, from, 0.22);
  const h = (vis ?? SZ[n][1]) * k;
  return <Pic n={n} k={k} y={(BOX.h - h) / 2 + (1 - p) * 40} vis={vis} style={{ opacity: 0.4 + 0.6 * p }} />;
};

// 4/5 맞음(초록) — 판이 들어올 때 O 자리에 누른 빛. O 동그라미: 원본 화면 (123, 1347) → q4x 조각 (86, 391)
const RightPanel: React.FC<{ from: number; tap: number }> = ({ from, tap }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const y = (BOX.h - SZ.q4x[1] * CARD_K) / 2;
  const left = BOX.x0;
  return (
    <>
      <Pic n="q4x" k={CARD_K} y={y} x={left} />
      <Tap t={t} at={tap} x={left + 86 * CARD_K} y={y + 391 * CARD_K} />
    </>
  );
};

// 같은 대화에 이어 보낸 한 줄(실제 말풍선, 오른쪽) → 「했더니」에 받은 답(틀린 네 문제만 다시 · 1/4)
const RePanel: React.FC<{ from?: number }> = ({ from = S.f }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const kb = 1.5; // r10 「17.5~18.5초 거의 멈춤」 — 작은 말풍선 하나라 다가가도 움직임이 안 보여 1.3배에서 키웠다(오른쪽 끝 902)
  const pb = inAt(t, S.f + 0.05, 0.3);
  const out = interpolate(t, [S.fRe - 0.1, S.fRe + 0.15], [1, 0], clamp);
  const kr = fitK('recard');
  const pr = inAt(t, S.fRe, 0.3);
  const bw = SZ.rebub[0] * kb;
  return (
    <>
      {out > 0 ? <Pic n="rebub" k={kb} x={BOX.x1 - bw} y={300 + (1 - pb) * 40} style={{ opacity: pb * out }} /> : null}
      {pr > 0 ? <Pic n="recard" k={kr} y={(BOX.h - SZ.recard[1] * kr) / 2 + (1 - pr) * 40} style={{ opacity: pr }} /> : null}
    </>
  );
};

// 판 한 장 — 들어올 때 1.015배에서 내려앉고 천천히 다가간다. 다가감의 중심은 카드 왼쪽 위(큰 글 왼쪽 축)라 왼쪽 축은 그대로이고 오른쪽 아래로만 커진다.
// 올리기 전 검사 r9 「거의 멈춘 시간 57%」(초당 0.4%)로 구간마다 글이 안전선(오른쪽 920 · 아래 1428) 안에 남는 만큼 키웠다(Film의 drift 값 옆 셈). 위쪽은 판 바탕색 그대로 — 미학 맹검(r5) 「위 배경에 초록 · 회색 얼룩과 가로 단차」로 뒤집은 흐린 판과 그늘을 뺐다
const Board: React.FC<{ pt?: number; drift?: number; origin?: string; pop?: boolean; children: React.ReactNode }> = ({ pt = PT, drift = 0.016, origin = `${BOX.x0}px 0px`, pop = true, children }) => {
  const f = useCurrentFrame();
  const z = (pop ? interpolate(f, [0, 8], [1.015, 1], { ...clamp, easing: EASE_OUT }) : 1) * (1 + (f / FPS) * drift);
  const H = 1920 - pt;
  const inner = <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}</div>;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{ position: 'absolute', left: 0, top: pt, width: 1080, height: H, overflow: 'hidden', background: BG }}>
        {inner}
      </div>
    </AbsoluteFill>
  );
};

// 지하철에서 공부 쪽을 찍는 손(Omni 영상) — 휴대폰과 책장이 함께 크게 보이게 당겨 둔다. shade면 위에 그늘을 얹어 큰 글을 둔다
const Subway: React.FC<{ start: number; shade?: boolean; flash?: number }> = ({ start, shade, flash }) => {
  const f = useCurrentFrame();
  const z = 1.28 + (f / FPS) * 0.02;
  // 셔터 빛(찍는 순간) — flash는 이 판 안의 초. 장면 심사 v2 · v4 「찍는 행동으로 안 읽힌다」
  const fl = flash === undefined ? 0 : interpolate(f / FPS, [flash - 0.02, flash + 0.04, flash + 0.26], [0, 0.78, 0], clamp);
  return (
    <AbsoluteFill style={{ background: `rgb(${SHADE})`, overflow: 'hidden' }}>
      <OffthreadVideo src={staticFile('vid/o1.mp4')} muted startFrom={sec(start)} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover', transform: `scale(${z})`, transformOrigin: '58% 52%' }} />
      {fl > 0 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(255,255,255,${fl})` }} /> : null}
      {shade ? <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 760, background: `linear-gradient(to bottom, rgba(${SHADE},0.9) 0%, rgba(${SHADE},0.78) 55%, rgba(${SHADE},0) 100%)` }} /> : null}
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string) =>
  l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));

// 큰 글자가 곧 말 — 첫 줄은 구성 첫 프레임부터 서 있고, 다음 줄부터 28px 올라오며 뜬다
const BigBlock: React.FC<{ lines: string[]; at: number[]; size: number; from: number }> = ({ lines, at, size, from }) => {
  const f = useCurrentFrame();
  const first = sec(from);
  return (
    <div style={{ position: 'absolute', left: X, top: TEXT_TOP, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: '-0.045em', lineHeight: size >= 104 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap', textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}>
      {lines.map((s, k) => {
        const a = sec(at[k]);
        const p = a <= first ? 1 : interpolate(f, [a - 2, a + 4], [0, 1], { ...clamp, easing: EASE_OUT });
        return <div key={k} style={{ opacity: p, transform: `translateY(${(1 - p) * 28}px)` }}>{rich(s)}</div>;
      })}
    </div>
  );
};
const Big: React.FC = () => {
  const f = useCurrentFrame();
  const l = LINES.find((x) => f >= sec(x.from) && f < sec(x.to));
  return l ? <BigBlock lines={l.lines} at={l.at} size={l.size} from={l.from} /> : null;
};

// 위 작은 줄 — 굵은 낱말 | 옅은 설명
const Tag: React.FC = () => {
  const f = useCurrentFrame();
  const g = TAGS.find((x) => f >= sec(x.from) && f < sec(x.to));
  if (!g) return null;
  return (
    <div style={{ position: 'absolute', left: X, top: TAG_TOP, fontFamily: KO, fontWeight: 700, fontSize: 40, letterSpacing: '0.01em', lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap' }}>
      {g.b}
      <span style={{ display: 'inline-block', width: 2, height: 30, margin: '0 20px', background: 'rgba(255,255,255,0.42)', verticalAlign: '-3px' }} />
      <span style={{ fontWeight: 500, opacity: 0.74 }}>{g.i}</span>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, BGM.t.map(sec), BGM.v, clamp) * MASTER} />
    {VO.map((o, i) => (
      <Sequence key={i} from={sec(o.t)}>
        <Audio src={staticFile(`vo/${o.id}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SOUNDS.map((s, i) => (
      <Sequence key={`s${i}`} from={Math.max(0, sec(s.t))} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
    ))}
  </>
);

const Seq: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={sec(a)} durationInFrames={sec(b) - sec(a)}>{children}</Sequence>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: `rgb(${SHADE})` }}>
    <Seq a={S.a} b={S.a2}><Subway start={1.4} shade flash={S.aFlash - S.a} /></Seq>
    <Seq a={S.a2} b={S.aCard}><Board><PageToCard from={S.a2} at={S.aWipe} /></Board></Seq>
    <Seq a={S.aCard} b={S.c}><Board pop={false} drift={0.02}><TapPanel from={S.aCard} tap={S.aTap} /></Board></Seq>
    {/* r10 「5.0~7.5초 거의 멈춤」 — 옅은 카드와 말풍선이라 같은 다가감으로는 움직임이 작다. 「답은 숨겨 뒀다가」(S.d)에서 판을 나눠 다가감을 새로 시작한다 */}
    <Seq a={S.c} b={S.d}><Board drift={0.03}><SentPanel /></Board></Seq>
    <Seq a={S.d} b={S.dTap - 0.2}><Board pop={false} drift={0.02}><SentPanel from={S.d} /></Board></Seq>
    <Seq a={S.dTap - 0.2} b={S.d2}><Board drift={0.02}><RightPanel from={S.dTap - 0.2} tap={S.dTap} /></Board></Seq>
    <Seq a={S.d2} b={S.e}><Board drift={0.02}><WrongPanel from={S.d2} n="q2x" /></Board></Seq>
    <Seq a={S.e} b={S.f}><Board drift={0.016}><WrongPanel from={S.e} n="q5x" vis={Q5_VIS} k={BOX.h / Q5_VIS} /></Board></Seq>
    <Seq a={S.f} b={S.fRe}><Board drift={0.03}><RePanel /></Board></Seq>
    <Seq a={S.fRe} b={S.g}><Board pop={false} drift={0.024}><RePanel from={S.fRe} /></Board></Seq>
    <Seq a={S.g} b={S.g2}><Subway start={0.4} shade flash={S.gFlash - S.g} /></Seq>
    <Seq a={S.g2} b={S.gCard}><Board><PageToCard from={S.g2} at={S.gWipe} /></Board></Seq>
    <Seq a={S.gCard} b={TOTAL}><Board pop={false} drift={0.006}><TapPanel from={S.gCard} tap={S.gTap} full /><EndThumb from={S.gCard} at={S.gEnd} /></Board></Seq>
    <Big />
    <Tag />
    <Sound />
  </AbsoluteFill>
);

// 한 장면 심사용 v5 — 찍는 손(셔터 빛) → 찍힌 공부 쪽 → 흰 줄로 퀴즈 카드 → 풀어 볼 틈 → A를 눌러 틀림 · 정답과 까닭(글 · 말 없이, 그 장면의 화면과 소리만)
export const Scene: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <Seq a={0} b={SCENE.page}><Subway start={1.4} flash={SCENE.flash} /></Seq>
    <Seq a={SCENE.page} b={SCENE.card}><Board pt={0} drift={0.01} origin="50% 50%"><PageToCard from={SCENE.page} at={SCENE.wipe} big /></Board></Seq>
    <Seq a={SCENE.card} b={SCENE_DUR}><Board pt={0} drift={0.01} origin="50% 50%" pop={false}><TapPanel from={SCENE.card} tap={SCENE.tap} big /></Board></Seq>
    <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, [0, 8, sec(SCENE_DUR) - 20, sec(SCENE_DUR)], [0.14, 0.22, 0.22, 0], clamp) * MASTER} />
    <Sequence from={sec(SCENE.flash - 0.02)} durationInFrames={45}><Audio src={staticFile('sfx/shutter.wav')} volume={0.3 * MASTER} /></Sequence>
    <Sequence from={sec(SCENE.wipe - 0.02)} durationInFrames={45}><Audio src={staticFile('sfx/swish.wav')} volume={0.24 * MASTER} /></Sequence>
    <Sequence from={sec(SCENE.tap - 0.02)} durationInFrames={45}><Audio src={staticFile('sfx/tick.wav')} volume={0.24 * MASTER} /></Sequence>
    <Sequence from={sec(SCENE.tap + 0.08)} durationInFrames={45}><Audio src={staticFile('sfx/thud.wav')} volume={0.22 * MASTER} /></Sequence>
  </AbsoluteFill>
);
