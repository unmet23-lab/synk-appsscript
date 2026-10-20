// yuhobuilds 「AI한테 "트렌디하게" 시켰더니」(10-21). 기획·콘티는 ../../기획.md, 움직임 규칙은 10-20 첫날 편 모션조사_20261020.md(v8 문법) 그대로.
//  · 판(창) 자리는 한 편 내내 같고 내용은 컷. 판은 늘 천천히 밀린다(프레임마다 0.07%, 1.08에서 멈춤).
//  · 머리글은 줄 단위 올림 하나, 강조는 처음부터 칠한 낱말 하나(Type.tsx).
//  · 판 안 근거는 우리 렌더 둘: v7c(「트렌디하게」 판, 공개 안 함)와 v8(뺀 판, 10-20 공개). 남의 영상은 제목·숫자 글만.
//  · 효과음은 체크·누름에만. 컷마다 휙 소리 없음.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, Cursor, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { bezier, clamp, mix } from '../lib/motion';
import { PAPER, RULE, UI_INK, UI_MUTED } from '../day1/parts';
import { EndCard, END_FOLLOW } from './End';
import { at, lineEnd, ORDER, S, TOTAL, VO } from './time';
import { ease, EASE_MOVE, Line } from './Type';

// ───────────── 판(창) — 자리는 한 편 내내 같다 ─────────────
const VP = { x: 64, y: 600, w: 952, h: 680, r: 28 };
const W = VP.w;
const H = VP.h;

// ───────────── 판 안 영상(우리 렌더) ─────────────
/** 크롭: 원본 1080×1920에서 (x, y)를 판 왼쪽 위에 두고 s배. */
type Crop = { x: number; y: number; s: number };
const BAR = 54; // 판 안 영상 위 머리띠(이 영상의 머리글과 판 안 영상의 머리글을 가른다 — Fable 콘티 P2)
const HEAD_CROP: Crop = { x: 0, y: 236, s: W / 1080 }; // 머리글 + 판 위쪽(효과가 몰린 자리)

const STACK_CROP: Crop = { x: 0, y: 250, s: 0.88 }; // 위아래 반 판 하나(머리글 쪽) — 폰에서 머리글 약 20px

/** 판 안 영상. hold(초)가 있으면 원본의 from+hold 프레임에서 멈춰 남은 시간을 채운다. */
const Clip: React.FC<{ src: string; from: number; sceneAt: number; crop: Crop; w?: number; h?: number; top?: number; hold?: number; dim?: number }> = ({ src, from, sceneAt, crop, w = W, h = H, top = 0, hold, dim = 1 }) => {
  const f = useCurrentFrame();
  const local = f - sceneAt;
  const video = (
    <OffthreadVideo
      src={staticFile(src)}
      trimBefore={Math.round(from * 30)}
      muted
      style={{ position: 'absolute', left: -crop.x * crop.s, top: -crop.y * crop.s, width: 1080 * crop.s, height: 1920 * crop.s, opacity: dim }}
    />
  );
  const stop = hold === undefined ? Infinity : Math.round(hold * 30);
  return (
    <div style={{ position: 'absolute', left: 0, top, width: w, height: h, overflow: 'hidden', background: STAGE }}>
      <Sequence from={sceneAt} layout="none">
        {local >= stop ? <Freeze frame={stop}>{video}</Freeze> : video}
      </Sequence>
    </div>
  );
};
/** 판 안 영상 위 머리띠: 무엇을 재생하는지. */
const ClipBar: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, background: '#1C1B19', borderBottom: '1px solid #2E2D2A' }}>
    <div style={{ position: 'absolute', left: 24, top: 21, width: 12, height: 12, borderRadius: 6, background: '#5A5852' }} />
    <div style={{ position: 'absolute', left: 48, top: 0, lineHeight: `${BAR}px`, fontFamily: KO, fontWeight: 620, fontSize: 24, color: '#B6B3AB', whiteSpace: 'nowrap' }}>{text}</div>
  </div>
);

// ───────────── 요청문 카드(저장용 정본) ─────────────
const PROMPT = [
  { t: '글자는 줄 단위로만', s: '낱말·글자마다 튀지 않게' },
  { t: '강조색은 한 화면에 한 곳', s: '나머지 글은 한 색으로' },
  { t: '장면 전환은 컷', s: '페이드는 끝 화면에만' },
  { t: '움직임은 클릭·입력·화면 확대가 맡게', s: '글자 대신 화면이 일하게' },
  { t: '빼기: 튕김·흐림·형광펜·숫자 세기', s: '한 편에 하나도 넣지 않기' },
] as const;
const CHECK_IDS = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;

/** 지금 자리 표시: a에 6프레임 켜지고 b에 6프레임 꺼진다. */
const on = (f: number, a: number, b = Infinity) => ease(f, a, 6) * (b === Infinity ? 1 : 1 - ease(f, b, 6));
const Ring: React.FC<{ k: number; r: number; pad?: number }> = ({ k, r, pad = 0 }) =>
  k > 0 ? <div style={{ position: 'absolute', inset: -pad, borderRadius: r + pad, background: `rgba(245,196,69,${0.14 * k})`, boxShadow: `inset 0 0 0 2.5px rgba(245,196,69,${k})`, pointerEvents: 'none' }} /> : null;

const ROW_TOP = 150;
const ROW_H = 104;
/** mode: 'veil' = 다섯 줄 자리만(글은 가림), 'list' = 체크해 나감. */
const PromptCard: React.FC<{ f: number; mode: 'veil' | 'list' }> = ({ f, mode }) => {
  const veil = mode === 'veil';
  const save = veil ? 0 : ease(f, SAVE_AT + 1, 5);
  const fiveK = veil ? on(f, at('h2', '다섯') - 2) : 0;
  return (
    <>
      <div style={{ position: 'absolute', left: 38, top: 32, fontFamily: KO, fontWeight: 760, fontSize: 40, color: UI_INK, letterSpacing: '-0.03em' }}>모션 요청문 · 다섯 줄</div>
      <div style={{ position: 'absolute', left: 40, top: 90, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED }}>AI한테 영상 움직임을 시킬 때 붙여 넣기</div>
      <svg width={46} height={58} viewBox="0 0 46 58" style={{ position: 'absolute', right: 38, top: 34 }}>
        <path d="M5 4 Q5 2 7 2 L39 2 Q41 2 41 4 L41 54 L23 41 L5 54 Z" fill={save > 0.5 ? BUTTER : 'none'} stroke={save > 0.5 ? BUTTER : UI_INK} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 134, height: 1, background: RULE }} />
      <div style={{ position: 'absolute', left: 16, right: 16, top: ROW_TOP - 6, height: 5 * ROW_H }}>
        <Ring k={fiveK} r={18} />
      </div>
      {PROMPT.map((p, i) => {
        const id = CHECK_IDS[i];
        const k = veil ? 0 : ease(f, VO[id] + 2, 7);
        const cur = veil ? 0 : on(f, VO[id] - 2, i < 4 ? VO[CHECK_IDS[i + 1]] - 2 : SAVE_AT - 6);
        return (
          <div key={i} style={{ position: 'absolute', left: 20, right: 20, top: ROW_TOP + i * ROW_H, height: ROW_H - 8 }}>
            {cur > 0 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: `rgba(245,196,69,${0.16 * cur})` }} /> : null}
            {i < 4 ? <div style={{ position: 'absolute', left: 6, right: 6, bottom: -4, height: 1, background: RULE }} /> : null}
            <div style={{ position: 'absolute', left: 18, top: 28, width: 40, height: 40, borderRadius: 10, background: k > 0.5 ? UI_INK : undefined, boxShadow: `inset 0 0 0 3px ${UI_INK}` }}>
              {k > 0 ? (
                <svg width={40} height={40} viewBox="0 0 40 40">
                  <path d="M9 21 L17 29 L32 12" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} strokeDashoffset={40 * (1 - k)} />
                </svg>
              ) : null}
            </div>
            <div style={{ position: 'absolute', left: 82, top: 14, filter: veil ? 'blur(7px)' : undefined, opacity: veil ? 0.75 : 1 }}>
              <div style={{ fontFamily: KO, fontWeight: 720, fontSize: 34, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: EN, fontWeight: 700, color: UI_MUTED, marginRight: 14 }}>{i + 1}</span>
                {p.t}
              </div>
              <div style={{ marginTop: 6, marginLeft: 34, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED, whiteSpace: 'nowrap' }}>{p.s}</div>
            </div>
          </div>
        );
      })}
    </>
  );
};

// ───────────── 모션 디자이너 글(다시 그림 — 원문 화면 아님) ─────────────
const QuoteCard: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  // 세 번 바뀐다(Fable 콘티 P2): 영어 제목 → 우리말 첫 줄 → 둘째 줄, 「없어진」에 둘째 줄 테두리
  const l0 = ease(f, sceneStart + 4, 10);
  const l1 = ease(f, at('b2', '모든') - 2, 10);
  const l2 = ease(f, at('b2', '중요한') - 2, 10);
  const k2 = on(f, at('b2', '없어진') - 2);
  const row = (p: number): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 18}px)` });
  return (
    <>
      <div style={{ position: 'absolute', left: 40, top: 38, width: 46, height: 46, borderRadius: 23, background: '#E7E4DC' }} />
      <div style={{ position: 'absolute', left: 102, top: 36, fontFamily: EN, fontWeight: 650, fontSize: 28, color: UI_INK }}>r/MotionDesign</div>
      <div style={{ position: 'absolute', left: 102, top: 72, fontFamily: MONO, fontSize: 20, color: UI_MUTED }}>2026-09-10 · 글 제목</div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 128, fontFamily: EN, fontWeight: 600, fontSize: 34, lineHeight: 1.3, color: '#5E5B54', letterSpacing: '-0.01em', ...row(l0) }}>
        “If every word moves, none of the words feel important”
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 262, height: 1, background: RULE }} />
      <div style={{ position: 'absolute', left: 40, top: 292, fontFamily: KO, fontWeight: 600, fontSize: 23, color: UI_MUTED }}>우리말로</div>
      <div style={{ position: 'absolute', left: 24, right: 24, top: 340, height: 250 }}>
        <div style={{ position: 'absolute', left: 16, top: 6, fontFamily: KO, fontWeight: 760, fontSize: 52, lineHeight: 1.25, color: UI_INK, letterSpacing: '-0.035em', ...row(l1) }}>모든 낱말이 움직이면,</div>
        <div style={{ position: 'absolute', left: 4, top: 80, padding: '6px 12px', ...row(l2) }}>
          <Ring k={k2} r={14} />
          <div style={{ position: 'relative', fontFamily: KO, fontWeight: 760, fontSize: 52, lineHeight: 1.25, color: UI_INK, letterSpacing: '-0.035em', whiteSpace: 'nowrap' }}>어떤 낱말도 중요해 보이지 않는다</div>
        </div>
      </div>
    </>
  );
};

// ───────────── 많이 본 소개 영상 네 편(제목·숫자 글만) ─────────────
const TOP = [
  { t: 'Introducing Notion 3.0: Agents', who: 'Notion · 2025-09', v: '1,575만' },
  { t: 'Introducing Cursor 2.0', who: 'Cursor · 2025-10', v: '946만' },
  { t: 'Ben Affleck Went From Batman to Writing…', who: 'Varun Mayya · 쇼츠 · 2026-10', v: '39만' },
  { t: 'Introducing Linear Diffs', who: 'Linear · 2026-05 · 주 채널은 X', v: '8,653' },
] as const;
const TopList: React.FC<{ f: number }> = ({ f }) => {
  const one = on(f, at('b3', '노션') - 2, at('b3', '많이') - 2);
  const all = on(f, at('b3', '많이') - 2);
  return (
    <>
      <div style={{ position: 'absolute', left: 38, top: 32, fontFamily: KO, fontWeight: 760, fontSize: 38, color: UI_INK, letterSpacing: '-0.03em' }}>조사한 영상 넷</div>
      <div style={{ position: 'absolute', left: 40, top: 86, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED }}>유튜브 조회수 · 2026-10-20 기준</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 134, height: 1, background: RULE }} />
      {/* 「많이 본 영상들은」 — 조회가 큰 위 세 줄만(Linear 8,653회는 빼고, Opus 완성본 검수 P2) */}
      <div style={{ position: 'absolute', left: 16, right: 16, top: 144, height: 3 * 126 - 8 }}>
        <Ring k={all} r={18} />
      </div>
      {TOP.map((r, i) => (
        <div key={i} style={{ position: 'absolute', left: 24, right: 24, top: 150 + i * 126, height: 112 }}>
          {i === 0 ? <Ring k={one} r={16} /> : null}
          {i < 3 ? <div style={{ position: 'absolute', left: 4, right: 4, bottom: -7, height: 1, background: RULE }} /> : null}
          <div style={{ position: 'absolute', left: 16, top: 18, width: 640, fontFamily: EN, fontWeight: 650, fontSize: 31, color: UI_INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>{r.t}</div>
          <div style={{ position: 'absolute', left: 16, top: 64, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED, whiteSpace: 'nowrap' }}>{r.who}</div>
          <div style={{ position: 'absolute', right: 16, top: 28, fontFamily: EN, fontWeight: 700, fontSize: 40, color: UI_INK, letterSpacing: '-0.02em' }}>
            {r.v}
            <span style={{ fontFamily: KO, fontWeight: 600, fontSize: 22, color: UI_MUTED, marginLeft: 6 }}>회</span>
          </div>
        </div>
      ))}
    </>
  );
};

// ───────────── 전·후 위아래(같은 순간 — 가로 반반은 폰에서 판 안 머리글이 13px라 Fable 콘티 P2로 쌓았다) ─────────────
const Stack: React.FC<{ f: number; sceneAt: number }> = ({ f, sceneAt }) => {
  const half = H / 2;
  const kT = on(f, at('b5', '더하기') - 2, at('b5', '빼기') - 2);
  const kB = on(f, at('b5', '빼기') - 2);
  const tag = (text: string, k: number): React.ReactNode => (
    <div style={{ position: 'absolute', top: 16, right: 18, padding: '6px 16px', borderRadius: 12, background: k > 0.5 ? BUTTER : '#26251F', color: k > 0.5 ? '#141412' : INK, fontFamily: KO, fontWeight: 700, fontSize: 25 }}>{text}</div>
  );
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: half - 1, overflow: 'hidden' }}>
        <Clip src="clip/v7c.mp4" from={18.0} sceneAt={sceneAt} crop={STACK_CROP} h={half - 1} />
        {tag('더한 판', kT)}
        <Ring k={kT} r={0} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: half - 1, width: W, height: 2, background: '#3A3934' }} />
      <div style={{ position: 'absolute', left: 0, top: half + 1, width: W, height: half - 1, overflow: 'hidden' }}>
        <Clip src="clip/v8.mp4" from={18.0} sceneAt={sceneAt} crop={STACK_CROP} h={half - 1} />
        {tag('뺀 판', kB)}
        <Ring k={kB} r={0} />
      </div>
    </>
  );
};

// ───────────── 장면표 ─────────────
type K = 'hook' | 'veil' | 'pop' | 'pen' | 'count' | 'all' | 'quote' | 'top' | 'v8' | 'stack' | 'list';
type Scene = { k: K; at: number; bg: string; o: [number, number] };
const SCENES: Scene[] = [
  { k: 'hook', at: 0, bg: STAGE, o: [476, 140] },
  { k: 'veil', at: VO.h2 - 2, bg: PAPER, o: [476, 300] },
  { k: 'pop', at: VO.b1 - 2, bg: STAGE, o: [200, 100] },
  { k: 'pen', at: at('b1', '형광펜') - 2, bg: STAGE, o: [600, 120] },
  { k: 'count', at: at('b1', '숫자') - 2, bg: STAGE, o: [200, 120] },
  { k: 'all', at: at('b1', '효과') - 2, bg: STAGE, o: [300, 120] },
  { k: 'quote', at: VO.b2 - 2, bg: PAPER, o: [476, 420] },
  { k: 'top', at: VO.b3 - 2, bg: PAPER, o: [476, 200] },
  { k: 'v8', at: VO.b4 - 2, bg: PAPER, o: [300, 560] },
  { k: 'stack', at: VO.b5 - 2, bg: STAGE, o: [476, 340] },
  // 다섯 줄 카드: 줄을 말할 때마다 그 줄 쪽으로 미는 컷(같은 판, 말 박자에 붙임). 한 장면으로 느리게 밀면 15.5초가 「거의 멈춤」으로 잡혔다.
  { k: 'list', at: VO.c0 - 2, bg: PAPER, o: [476, 300] },
  ...(['c1', 'c2', 'c3', 'c4', 'c5'] as const).map((id, i): Scene => ({ k: 'list', at: VO[id] - 2, bg: PAPER, o: [300, ROW_TOP + i * ROW_H + 48] })),
  { k: 'list', at: VO.cta - 2, bg: PAPER, o: [893, 64] },
];
const sceneAt = (f: number) => {
  let i = 0;
  for (let j = 0; j < SCENES.length; j++) if (f >= SCENES[j].at) i = j;
  return i;
};

/** 판 안 v7c의 시작 시각(원본 초): 효과가 낱말과 같이 일어나게 조금 앞에서 시작한다. 시각은 Fable이 프레임으로 확인한 값
 *  (「7시」 숫자 3→5→6→7 18.1~18.5초 · 「텅」 흐림 팝 14.0~14.2초 · 「체크리스트」 형광펜 6.9~7.2초 · 「2편→3편」 4.4~4.6초 · 「트렌드, 질문, 달력, 실화」 11~13.5초). */
const FX_FROM: Record<string, number> = { hook: 18.0, pop: 13.75, pen: 6.7, count: 4.3, all: 11.0 };
const BAR_TEXT = '처음 판 · 「트렌디하게」라고만 시킨 결과';

const Content: React.FC<{ k: K; f: number; sceneStart: number }> = ({ k, f, sceneStart }) => {
  switch (k) {
    case 'hook':
    case 'pop':
    case 'pen':
    case 'count':
    case 'all':
      return (
        <>
          <Clip src="clip/v7c.mp4" from={FX_FROM[k]} sceneAt={sceneStart} crop={HEAD_CROP} top={BAR} h={H - BAR} dim={0.9} />
          <ClipBar text={BAR_TEXT} />
        </>
      );
    case 'veil':
      return <PromptCard f={f} mode="veil" />;
    case 'quote':
      return <QuoteCard f={f} sceneStart={sceneStart} />;
    case 'top':
      return <TopList f={f} />;
    case 'v8':
      // v8 1.3~3.4초(입력 → 보냄 → 칸이 참)만 쓰고 남는 시간은 마지막 프레임(Fable 콘티 P2)
      return (
        <>
          <Clip src="clip/v8.mp4" from={1.3} hold={2.1} sceneAt={sceneStart} crop={{ x: 64, y: 600 + BAR, s: 1 }} top={BAR} h={H - BAR} />
          <ClipBar text="다시 만든 판 · 이 규칙대로" />
        </>
      );
    case 'stack':
      return <Stack f={f} sceneAt={sceneStart} />;
    case 'list':
      return <PromptCard f={f} mode="list" />;
    default:
      return null;
  }
};

// ───────────── 커서: 「저장해」에 책갈피를 누른다 ─────────────
const SAVE_AT = VO.cta + 2;
const SAVE_XY: [number, number] = [893, 64];
const CursorLayer: React.FC<{ f: number }> = ({ f }) => {
  const s0 = SAVE_AT - 17;
  if (f < s0 - 4 || f > SAVE_AT + 16) return null;
  const from: [number, number] = [700, 380];
  const t = ease(f, s0, SAVE_AT - 1 - s0, EASE_MOVE);
  const mid: [number, number] = [mix(from[0], SAVE_XY[0], 0.5) + 70, mix(from[1], SAVE_XY[1], 0.5) + 50];
  const [cx, cy] = bezier(from, mid, SAVE_XY, t);
  const press = interpolate(f, [SAVE_AT - 2, SAVE_AT, SAVE_AT + 4], [0, 1, 0], clamp);
  const o = ease(f, s0 - 4, 5) * (1 - ease(f, SAVE_AT + 8, 6));
  const r = interpolate(f, [SAVE_AT, SAVE_AT + 12], [0, 1], clamp);
  return (
    <>
      {r > 0 && r < 1 ? <div style={{ position: 'absolute', left: SAVE_XY[0] - 10 - 46 * r, top: SAVE_XY[1] - 10 - 46 * r, width: 20 + 92 * r, height: 20 + 92 * r, borderRadius: '50%', border: '3px solid rgba(17,17,17,0.45)', opacity: 1 - r }} /> : null}
      <Cursor x={cx} y={cy} press={press} ring={0} opacity={o} />
    </>
  );
};

// ───────────── 판 + 밀기 ─────────────
const push = (f: number, i: number) => {
  const drift = Math.min(0.08, 0.0007 * Math.max(0, f - SCENES[i].at));
  const punch = interpolate(f - SAVE_AT, [0, 3, 10], [0, 0.015, 0], clamp);
  return 1 + drift + punch;
};
const Panel: React.FC = () => {
  const f = useCurrentFrame();
  const i = sceneAt(f);
  const sc = SCENES[i];
  const p = push(f, i);
  const fadeOut = 1 - ease(f, S.end - 8, 8);
  if (fadeOut <= 0) return null;
  const dark = sc.bg === STAGE;
  return (
    <div
      style={{
        position: 'absolute',
        left: VP.x,
        top: VP.y,
        width: W,
        height: H,
        borderRadius: VP.r,
        overflow: 'hidden',
        background: sc.bg,
        boxShadow: dark ? '0 0 0 1.5px rgba(255,255,255,0.16), 0 26px 70px rgba(0,0,0,0.5)' : '0 0 0 1px rgba(255,255,255,0.07), 0 26px 70px rgba(0,0,0,0.5)',
        opacity: fadeOut,
        transform: `scale(${p})`,
        transformOrigin: `${sc.o[0]}px ${sc.o[1]}px`,
      }}
    >
      <Content k={sc.k} f={f} sceneStart={sc.at} />
      {sc.k === 'list' ? <CursorLayer f={f} /> : null}
    </div>
  );
};

// ───────────── 머리글 ─────────────
type Head = { at: number; lines: string[]; accent?: string; size?: number };
const HEADS = (): Head[] => [
  { at: -1, lines: ['AI한테 "트렌디하게"', '시켰더니,', '더 AI 같아졌어요'], accent: '더 AI 같아졌어요', size: 74 },
  { at: VO.h2 - 3, lines: ['AI 티 안 나게 시키는', '다섯 줄, 끝에 드려요'], accent: '다섯 줄', size: 74 },
  { at: VO.b1 - 3, lines: ['낱말마다 팝,', '형광펜, 숫자 세기'] },
  { at: at('b1', '효과') - 3, lines: ['효과를', '전부 넣었더라고요'], accent: '전부' },
  { at: VO.b2 - 3, lines: ['모든 낱말이 움직이면,', '중요한 낱말이 없어요'], accent: '없어요', size: 74 },
  { at: VO.b3 - 3, lines: ['많이 본 영상은', '반대였어요'], accent: '반대' },
  { at: VO.b4 - 3, lines: ['글자는 가만히,', '움직이는 건 화면'], accent: '화면' },
  { at: VO.b5 - 3, lines: ['AI는 더하기,', '답은 빼기'], accent: '빼기' },
  { at: VO.c0 - 3, lines: ['모션 시킬 땐', '이 다섯 줄'], accent: '다섯 줄' },
  { at: VO.cta - 3, lines: ['저장해 두고', '그대로 붙여 보세요'], accent: '저장해' },
];
const Heads: React.FC = () => {
  const hs = HEADS();
  return (
    <>
      {hs.map((h, i) => (
        <Line key={i} lines={h.lines} accent={h.accent} at={h.at} until={i + 1 < hs.length ? hs[i + 1].at : S.end} fade={i + 1 === hs.length} size={h.size} />
      ))}
    </>
  );
};

// ───────────── 판 아래 표시 ─────────────
const LABEL: Record<K, string> = {
  hook: 'AI가 처음 만든 판 · 우리 렌더',
  veil: '끝에 드리는 다섯 줄',
  pop: '낱말마다 팝',
  pen: '형광펜',
  count: '숫자 세기',
  all: '한 화면에 효과 전부',
  quote: '모션 디자이너 커뮤니티 글 · 다시 그린 화면',
  top: '제목과 조회수만 옮김',
  v8: '다시 만든 판 · 실제 렌더',
  stack: '같은 문장, 같은 순간',
  list: '저장해 두고 붙여 넣기',
};
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - ease(f, S.end - 8, 8);
  if (o <= 0) return null;
  const k = SCENES[sceneAt(f)].k;
  return <div style={{ position: 'absolute', left: 72, top: VP.y + VP.h + 64, fontFamily: KO, fontWeight: 560, fontSize: 25, letterSpacing: '-0.01em', color: DIM, opacity: o }}>{LABEL[k]}</div>;
};

// ───────────── 소리: 체크·누름만 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  ...CHECK_IDS.map((id) => ({ at: VO[id] + 2, src: 'sfx/tick2.wav', v: 0.22 })),
  { at: SAVE_AT, src: 'sfx/tok.wav', v: 0.3 },
  { at: END_FOLLOW, src: 'sfx/tok.wav', v: 0.42 },
];

export const TrendyFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number])
    .sort((p, q) => p[0] - q[0])
    .reduce<[number, number][]>((acc, [a, b]) => {
      const last = acc[acc.length - 1];
      if (last && a - last[1] < 20) last[1] = Math.max(last[1], b);
      else acc.push([a, b]);
      return acc;
    }, []);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 20);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.42 - 0.14 * voice) * tail;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Panel />
      <Label />
      <Heads />
      <EndGate />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} />
        </Sequence>
      ))}
      {hits().map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm_cut.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

/** 끝 카드는 전체 프레임 기준으로 짜여 있어 Sequence로 감싸지 않는다. 검정에서 8프레임 불투명도로만 들어온다. */
const EndGate: React.FC = () => {
  const f = useCurrentFrame();
  if (f < S.end) return null;
  return (
    <AbsoluteFill style={{ opacity: ease(f, S.end, 8) }}>
      <EndCard />
    </AbsoluteFill>
  );
};
