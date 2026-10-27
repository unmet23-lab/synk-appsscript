// 본편(「AI 포스터가 너무 복잡할 때 — '디테일 줄여 줘' 한 줄」 v4~): 청금석 무대 위 세로 카드.
// 마디 다섯 — 훅(꽉 찬 포스터가 「땐,」에서 깔끔한 포스터로 밀려 넘어감) → 한 줄(보낸 말을 크게 다시 짠 입력 칸 · 보내기)
// → 세기(큰 카드 한 장: 글씨 11곳에 빨간 테 → 밀어 넘겨 3곳에 노란 테) → 정리(그 한 줄을 크게 + 전후 작게) → 끝(두 장 나란히 · 질문).
// 마디 사이는 위로 밀기. 그림은 모두 2026-10-28 ChatGPT 웹 일반 채팅에서 받은 실제 결과(../화면/ · 원본 ../시안/)이고,
// 다시 그린 것은 입력 칸과 정리 장면의 한 줄 판뿐이다.
// v1~v3(두 장 나란히 견줌 · 정리 말 「… 이 한 줄이에요」 · 끝 「처음 · 한 줄 뒤」)은 이해 시험 4 · 3점 — 「4~8초 빈 입력 칸이 지루」,
// 「11곳 · 3곳 테가 작아 무엇을 셌는지 모름」, 「13초 뒤 같은 말 반복」, 「"처음"이 모호」로 v4에서 바꿨다. 옛 짜임은 git 이력에 있다.
// 소리: 배경음(본편 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수). 말하는 동안 배경음을 낮춘다(지난 편 값).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_IN_OUT, EASE_OUT } from '../lib/anim';
import { C, F } from '../theme';
import { Lines, MarkF, Stage, Whip } from '../v5/cine';
import { Box, Cam, Screen, WipeEdge } from './screen';
import { at, CUT, TAIL, TOTAL } from './time';
import { CLIPS, clipEnd, wf } from './vo-time';

export { TOTAL };
export type Variant = 'A' | 'B' | 'C';
const WHERE: Record<Variant, string> = { A: '캡션에', B: '고정 댓글에', C: '아래 글에' };

// ── 시각(영상 프레임) ─────────────────────────────────────────
const T_LINE = at('line');
const T_CNT = at('cnt');
const T_RECAP = at('recap');
const T_END = at('end');
// 「땐,」에서 밀기 시작해 2초 안에 깔끔한 포스터(이해 시험 v1 「0~2초 같은 장면」 · 제작 절차 「0~2초 전후 결과」)
const W_WIPE = wf('v01', '땐,', 1.45) + 2;
const WIPE = [W_WIPE, W_WIPE + 12];

// ── 그림(1080×1620, ../화면/) · 카드 ─────────────────────────────
const IMG_H = 1620;
const S = 1080 / 1024; // 원본(1024 폭) 좌표 → 1080 폭
const bx = (x0: number, y0: number, x1: number, y1: number) => ({ x: x0 * S, y: y0 * S, w: (x1 - x0) * S, h: (y1 - y0) * S });
// 글씨 자리(원본 좌표, ../기획.md 「결과 화면 먼저」 표의 셈 — 읽는 차례)
const TEXT_BEFORE = [
  bx(36, 20, 182, 76), // CAFE NEW MENU
  bx(856, 26, 990, 90), // SWEET MILKY STRAWBERRY
  bx(48, 65, 918, 452), // 큰 제목
  bx(72, 418, 268, 560), // NEW MENU 배지
  bx(768, 358, 992, 522), // 오른쪽 문구
  bx(80, 585, 272, 770), // 왼쪽 문구
  bx(752, 700, 975, 830), // 말풍선
  bx(808, 868, 972, 918), // 작은 STRAWBERRY LATTE
  bx(88, 1418, 302, 1494), // 아래 띠 1
  bx(392, 1430, 628, 1488), // 아래 띠 2
  bx(704, 1430, 964, 1488), // 아래 띠 3
];
const TEXT_AFTER = [bx(430, 118, 598, 178), bx(208, 252, 852, 502), bx(386, 535, 644, 600)];
const GLASS = bx(362, 632, 790, 1352);

// 카드는 오른쪽 단추 자리(x 920) 안 — 포스터 속 글씨도 글자 인식에 걸린다(올리기 전 검사 ⑤)
const BIG: Box = { x: 183, y: 452, w: 619, h: 928 };
const PAIR_L: Box = { x: 70, y: 520, w: 412, h: 618 };
const PAIR_R: Box = { x: 506, y: 520, w: 412, h: 618 };
const WIDE: Cam = { cx: 540, cy: 810, z: 1 };

const SOURCE = '실제 ChatGPT 결과 · 2026.10.28 · 같은 요청도 매번 달라요';
const Source: React.FC<{ top: number }> = ({ top }) => (
  <p style={{ position: 'absolute', left: 84, right: 160, top, margin: 0, font: `500 24px/1.35 ${F.ko}`, color: 'rgba(255,255,255,.84)', letterSpacing: '-.01em' }}>{SOURCE}</p>
);

/** 머리 큰 글 두 줄 — 위 끝 272(키트 cover916 위 안전선 269 아래, 올리기 전 검사 ⑤) */
const Head: React.FC<{ lines: React.ReactNode[]; zero?: boolean }> = ({ lines, zero }) => <Lines lines={lines} at={0} size={66} top={272} visibleAtZero={zero} />;
const M: React.FC<{ children: React.ReactNode; at: number }> = ({ children, at: a }) => {
  const f = useCurrentFrame();
  return <MarkF p={interpolate(f, [a, a + 10], [0, 1], clamp)}>{children}</MarkF>;
};

/** 머무는 동안 아주 천천히 당기는 카메라(멈춘 화면 점검 대비): from부터 프레임당 dz씩. */
const push = (c: Cam, f: number, from: number, dz = 0.0012): Cam => ({ ...c, z: c.z + dz * Math.max(0, f - from) });

/** 카드 왼쪽 아래 큰 꼬리표. */
const Tag: React.FC<{ text: React.ReactNode; on: number; off: number; box: Box; bg?: string; fg?: string; size?: number }> = ({ text, on, off, box, bg = 'rgba(0,0,0,.7)', fg = '#fff', size = 34 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [on, on + 5, off - 5, off], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        left: box.x + 20,
        top: box.y + box.h - 20 - size * 1.7,
        height: size * 1.7,
        padding: `0 ${Math.round(size * 0.6)}px`,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 14,
        background: bg,
        color: fg,
        font: `800 ${size}px/1 ${F.ko}`,
        letterSpacing: '-.03em',
        whiteSpace: 'nowrap',
        opacity: o,
      }}
    >
      {text}
    </span>
  );
};

/** 그림 좌표의 테(빨강 = 덜어 낸 것, 노랑 = 남은 것). */
const Frame: React.FC<Box & { at: number; color: string; width?: number }> = ({ x, y, w, h, at: a, color, width = 7 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [a, a + 6], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 8,
        top: y - 8,
        width: w + 16,
        height: h + 16,
        borderRadius: 14,
        boxShadow: `inset 0 0 0 ${width}px ${color}`,
        background: color === C.mark ? 'rgba(255,224,122,.22)' : 'rgba(249,104,89,.2)',
        opacity: p,
        scale: String(1.15 - 0.15 * p),
      }}
    />
  );
};

const Label: React.FC<{ box: Box; text: string; color?: string; dy?: number }> = ({ box, text, color = 'rgba(255,255,255,.9)', dy = 18 }) => (
  <div style={{ position: 'absolute', left: box.x, width: box.w, top: box.y + box.h + dy, textAlign: 'center', font: `800 40px/1 ${F.ko}`, letterSpacing: '-.03em', color }}>{text}</div>
);

// ── 마디 1: 훅 — 꽉 찬 포스터(0프레임부터) → 깔끔한 포스터 ─────
const SegHook: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, WIPE, [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const cam = push(WIDE, f, 0, 0.0009);
  return (
    <>
      <Screen src="screen/전.jpg" imgH={IMG_H} cam={cam} box={BIG} radius={34} />
      <Screen src="screen/후.jpg" imgH={IMG_H} cam={cam} box={BIG} radius={34} clip={p} />
      <WipeEdge p={p} box={BIG} />
      <Tag text="ChatGPT가 처음 만든 포스터" on={-6} off={WIPE[0] + 4} box={BIG} />
      <Tag text="“디테일 줄여 줘” 한 줄 뒤" on={WIPE[1] - 4} off={T_LINE} box={BIG} bg={C.mark} fg={C.ink} />
      <Source top={BIG.y + BIG.h + 12} />
    </>
  );
};

// ── 마디 2: 한 줄 — ChatGPT가 만든 포스터(작게) + 보낸 말을 크게 다시 짠 입력 칸 ─────
// 착지하자마자 한 글자씩(2프레임) 쳐져 0.6초 안에 다 보이고(v4 — v3 「빈 입력 칸이 지루」), 「디테일」에서 노랗게, 말이 끝나면 보내기.
const OFF_LINE = T_LINE - 12;
const REQ = '디테일 줄여 줘';
const THUMB: Box = { x: 70, y: 470, w: 300, h: 450 };
const INPUT = { x: 70, y: 1010, w: 850 };
const LIT = wf('v07', '디테일', 2.0) - 2;
const TYPE0 = T_LINE + 2;
const TYPE_STEP = 2;
const SEND = clipEnd('v07') + 4;
const SegLine: React.FC = () => {
  const f = useCurrentFrame() + OFF_LINE;
  const zoom = 1 + 0.06 * interpolate(f, [T_LINE, T_CNT], [0, 1], clamp);
  const press = interpolate(f, [SEND - 2, SEND, SEND + 6], [1, 0.86, 1], clamp);
  const ring = interpolate(f, [SEND, SEND + 14], [0, 1], { ...clamp, easing: EASE_OUT });
  const lit = f >= LIT;
  const typed = Math.max(0, Math.min(REQ.length, Math.floor((f - TYPE0) / TYPE_STEP) + 1));
  const caret = typed < REQ.length || Math.floor(f / 15) % 2 === 0;
  return (
    <>
      <Screen src="screen/전.jpg" imgH={IMG_H} cam={{ cx: 540, cy: 760 + 0.6 * Math.max(0, f - T_LINE), z: 1 + 0.0014 * Math.max(0, f - T_LINE) }} box={THUMB} radius={28} />
      <div style={{ position: 'absolute', left: THUMB.x + THUMB.w + 34, top: THUMB.y + 6, right: 160, font: `700 38px/1.3 ${F.ko}`, color: 'rgba(255,255,255,.9)', letterSpacing: '-.02em', wordBreak: 'keep-all' }}>
        ChatGPT가 처음 만든 포스터
        <div style={{ marginTop: 16, font: `500 28px/1.35 ${F.ko}`, color: 'rgba(255,255,255,.72)' }}>이 대화에 이어서 보냄</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: INPUT.x,
          top: INPUT.y,
          width: INPUT.w,
          padding: '44px 46px 34px',
          boxSizing: 'border-box',
          borderRadius: 54,
          background: '#212121',
          boxShadow: '0 0 0 2px rgba(255,255,255,.12),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)',
          scale: String(zoom),
          transformOrigin: '50% 40%',
        }}
      >
        <p style={{ margin: 0, height: 125, font: `800 104px/1.2 ${F.ko}`, letterSpacing: '-.035em', color: lit ? C.mark : '#fff', whiteSpace: 'nowrap' }}>
          {REQ.slice(0, typed)}
          <span style={{ display: 'inline-block', width: 6, height: 96, marginLeft: 6, verticalAlign: '-10px', background: caret && f < SEND ? '#fff' : 'transparent' }} />
        </p>
        <div style={{ marginTop: 22, height: 104, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" style={{ marginLeft: 6 }}>
            <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div style={{ position: 'relative', width: 104, height: 104 }}>
            {f >= SEND && ring < 1 ? (
              <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', boxShadow: `0 0 0 8px ${C.mark}`, opacity: 1 - ring, scale: String(0.8 + 0.7 * ring) }} />
            ) : null}
            <div style={{ width: 104, height: 104, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', scale: String(press) }}>
              <svg width="54" height="54" viewBox="0 0 24 24">
                <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="#0d0d0d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <span
        style={{
          position: 'absolute',
          left: INPUT.x + 6,
          top: INPUT.y - 58,
          padding: '8px 14px',
          borderRadius: 10,
          background: 'rgba(0,0,0,.62)',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.28)',
          font: `600 26px/1.1 ${F.ko}`,
          color: '#fff',
        }}
      >
        ChatGPT에 보낸 말 그대로
      </span>
    </>
  );
};

// ── 마디 3: 세기 — 큰 카드 한 장에서 글씨 11곳(빨간 테) → 밀어 넘겨 3곳(노란 테) · 잔 ─────
const OFF_CNT = T_CNT - 12;
// 착지하자마자 빨간 테 열하나가 1.5프레임마다 — 0.6초 안에 「글씨 11곳」이 차서 「세 군데로」까지 머문다(v5 — 이해 시험 v4 「화면은 6곳인데 말은 열한 군데」)
const R0 = T_CNT + 2;
const R_STEP = 1.5;
const W2 = wf('v03', '세', 1.07) - 4; // 「세 군데로」에서 깔끔한 포스터로 밀어 넘김
const WIPE2 = [W2, W2 + 10];
const Y0 = WIPE2[1] + 1; // 노란 테 셋이 4프레임마다
const W_GLASS = wf('v03', '잔', 1.98) - 2;
const SegCount: React.FC = () => {
  const f = useCurrentFrame() + OFF_CNT;
  const p = interpolate(f, WIPE2, [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const cam = push(WIDE, f, T_CNT, 0.0007);
  const n = Math.max(0, Math.min(11, Math.floor((f - R0) / R_STEP) + 1));
  const L = (x: number) => x - OFF_CNT; // 이 시퀀스의 프레임
  return (
    <>
      <Screen src="screen/전.jpg" imgH={IMG_H} cam={cam} box={BIG} radius={34}>
        {TEXT_BEFORE.map((b, i) => (
          <Frame key={i} {...b} at={L(R0 + R_STEP * i)} color={C.crayon} width={16} />
        ))}
      </Screen>
      <Screen src="screen/후.jpg" imgH={IMG_H} cam={cam} box={BIG} radius={34} clip={p}>
        {TEXT_AFTER.map((b, i) => (
          <Frame key={i} {...b} at={L(Y0 + 4 * i)} color={C.mark} width={16} />
        ))}
        <Frame {...GLASS} at={L(W_GLASS)} color={C.mark} width={16} />
      </Screen>
      <WipeEdge p={p} box={BIG} />
      <Tag text={`글씨 ${n}곳`} on={L(R0)} off={L(WIPE2[0] + 2)} box={BIG} bg={C.crayon} size={44} />
      <Tag text={`글씨 ${Math.max(1, Math.min(3, Math.floor((f - Y0) / 4) + 1))}곳`} on={L(WIPE2[1] - 2)} off={L(T_RECAP + 20)} box={BIG} bg={C.mark} fg={C.ink} size={44} />
      <Source top={BIG.y + BIG.h + 12} />
    </>
  );
};

// ── 마디 4: 정리 — 「디테일 줄여 줘」 한 줄을 크게 + 전후 작게 ─────
const OFF_RECAP = T_RECAP - 12;
const MINI_L: Box = { x: 130, y: 500, w: 300, h: 450 };
const MINI_R: Box = { x: 560, y: 500, w: 300, h: 450 };
const SegRecap: React.FC = () => {
  const f = useCurrentFrame() + OFF_RECAP;
  const cam = push({ cx: 540, cy: 780, z: 1 }, f, T_RECAP, 0.0016);
  const lit = interpolate(f, [wf('v08', '디테일', 1.7) - 2, wf('v08', '디테일', 1.7) + 6], [0, 1], clamp);
  const arrow = interpolate(f, [T_RECAP, T_RECAP + 16], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <>
      <Screen src="screen/전.jpg" imgH={IMG_H} cam={cam} box={MINI_L} radius={26} />
      <Screen src="screen/후.jpg" imgH={IMG_H} cam={cam} box={MINI_R} radius={26} />
      <Label box={MINI_L} text="한 줄 전" />
      <Label box={MINI_R} text="한 줄 뒤" color={C.markField} />
      <svg width="90" height="60" viewBox="0 0 90 60" style={{ position: 'absolute', left: 452, top: 695, opacity: arrow, translate: `${(arrow - 1) * 30}px 0` }}>
        <path d="M6 30h70M56 10l22 20-22 20" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 70,
          width: 850,
          top: 1050,
          height: 200,
          borderRadius: 40,
          display: 'grid',
          placeItems: 'center',
          background: lit > 0 ? `rgba(255,224,122,${0.15 + 0.85 * lit})` : 'rgba(255,224,122,.15)',
          boxShadow: `0 0 0 4px ${C.mark}`,
          scale: String(1 + 0.04 * interpolate(f, [T_RECAP, T_END], [0, 1], clamp)),
        }}
      >
        <span style={{ font: `800 112px/1 ${F.ko}`, letterSpacing: '-.035em', color: lit > 0.5 ? C.ink : '#fff' }}>디테일 줄여 줘</span>
      </div>
      <Source top={1290} />
    </>
  );
};

// ── 마디 5: 끝 — 두 장 나란히 · 질문 · 요청문 있는 곳 · 로고 ─────
const OFF_END = T_END - 12;
const SegEnd: React.FC<{ variant: Variant }> = ({ variant }) => {
  const f = useCurrentFrame() + OFF_END;
  // 같은 빠르기로 끝 0.6초 전까지(멈춘 화면 점검 대비)
  const p = interpolate(f, [T_END, TOTAL - 18], [0, 1], clamp);
  const o = interpolate(f, [T_END + 10, T_END + 18], [0, 1], clamp);
  const cam: Cam = { cx: 540, cy: 760 + 110 * p, z: 1 + 0.2 * p };
  return (
    <>
      <Screen src="screen/전.jpg" imgH={IMG_H} cam={cam} box={PAIR_L} radius={28} />
      <Screen src="screen/후.jpg" imgH={IMG_H} cam={cam} box={PAIR_R} radius={28} />
      <Label box={PAIR_L} text="한 줄 전" dy={16} />
      <Label box={PAIR_R} text="한 줄 뒤" color={C.markField} dy={16} />
      <div style={{ position: 'absolute', left: 84, right: 160, top: PAIR_L.y + PAIR_L.h + 86, opacity: o }}>
        <div style={{ font: `800 46px/1.3 ${F.ko}`, color: '#fff', letterSpacing: '-.025em' }}>그대로 붙여 쓸 요청문은 {WHERE[variant]} 있어요</div>
        <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 40, marginTop: 20, display: 'block' }} />
      </div>
      <Source top={1352} />
    </>
  );
};

// ── 머리 큰 글(장면마다) ───────────────────────────────────────
const HEADS: { from: number; to: number; el: React.ReactNode }[] = [
  { from: 0, to: T_LINE, el: <Head zero lines={['AI 포스터가 복잡할 때', <M at={W_WIPE}>한 줄이면 이렇게</M>]} /> },
  { from: T_LINE, to: T_CNT - 6, el: <Head lines={['같은 대화에', <M at={LIT - T_LINE}>“디테일 줄여 줘”</M>]} /> },
  { from: T_CNT, to: T_RECAP - 6, el: <Head lines={['포스터 속 글씨', <M at={W2 - T_CNT}>11곳이 3곳으로</M>]} /> },
  { from: T_RECAP, to: T_END - 6, el: <Head lines={['AI 그림이 너무 복잡하면', <M at={wf('v08', '디테일', 1.7) - T_RECAP}>이 한 줄</M>]} /> },
  { from: T_END, to: TOTAL, el: <Head lines={['여러분은', '어느 포스터가 좋아요?']} /> },
];

// ── 소리 ─────────────────────────────────────────────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: 1, src: 'sfx/thud.wav', v: 0.42 },
  { at: WIPE[0], src: 'sfx/swish.wav', v: 0.4 },
  { at: WIPE[1] - 2, src: 'sfx/earn.wav', v: 0.3 },
  { at: T_LINE - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: SEND, src: 'sfx/tok.wav', v: 0.4 },
  { at: T_CNT - 10, src: 'sfx/swish.wav', v: 0.45 },
  ...TEXT_BEFORE.filter((_, i) => i % 2 === 0).map((_, i) => ({ at: Math.round(R0 + R_STEP * 2 * i), src: 'sfx/tick.wav', v: 0.16 })),
  { at: WIPE2[0], src: 'sfx/swish.wav', v: 0.32 },
  ...TEXT_AFTER.map((_, i) => ({ at: Y0 + 4 * i, src: 'sfx/pop.wav', v: 0.22 })),
  { at: T_RECAP - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: T_END - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: CUT, src: 'sfx/tok.wav', v: 0.5 },
];
const BGM_OPEN = 0.42;
const BGM_UNDER = 0.16;
const SFX_UNDER = 0.7;
const MASTER = 0.8;
const windows = CLIPS.reduce<[number, number][]>((w, c) => {
  const last = w[w.length - 1];
  if (last && c.at - last[1] <= 30) last[1] = c.speechEnd;
  else w.push([c.at, c.speechEnd]);
  return w;
}, []);
const duck = (fr: number) => Math.max(0, ...windows.map(([a, e]) => interpolate(fr, [a - 6, a, e, e + 10], [0, 1, 1, 0], clamp)));
const bgm = (fr: number) => MASTER * (BGM_OPEN - (BGM_OPEN - BGM_UNDER) * duck(fr));

const SEGS: { from: number; to: number; el: (v: Variant) => React.ReactNode; noIn?: boolean; noOut?: boolean }[] = [
  { from: 0, to: T_LINE, el: () => <SegHook />, noIn: true },
  { from: OFF_LINE, to: T_CNT, el: () => <SegLine /> },
  { from: OFF_CNT, to: T_RECAP, el: () => <SegCount /> },
  { from: OFF_RECAP, to: T_END, el: () => <SegRecap /> },
  { from: OFF_END, to: TOTAL, el: (v) => <SegEnd variant={v} />, noOut: true },
];

export const FullFilm: React.FC<{ variant: Variant }> = ({ variant }) => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={CUT} layout="none">
      <Audio src={staticFile('bgm.mp3')} volume={(fr) => bgm(fr) * interpolate(fr, [CUT - 2, CUT], [1, 0], clamp)} />
    </Sequence>
    <Sequence from={CUT} durationInFrames={TOTAL - CUT} layout="none">
      <Audio src={staticFile('bgm.mp3')} trimBefore={TAIL.songFrame} volume={(fr) => bgm(CUT + fr) * interpolate(fr, [0, 1, TOTAL - CUT - 10, TOTAL - CUT], [0.4, 1, 1, 0], clamp)} />
    </Sequence>
    <Stage total={TOTAL} />
    {SEGS.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.to - s.from}>
        <Whip len={s.to - s.from} noIn={s.noIn} noOut={s.noOut}>
          {s.el(variant)}
        </Whip>
      </Sequence>
    ))}
    {HEADS.map((h, i) => (
      <Sequence key={i} from={h.from} durationInFrames={h.to - h.from}>
        {h.el}
      </Sequence>
    ))}
    {CLIPS.map((c) => (
      <Sequence key={c.id} from={c.at} durationInFrames={c.end - c.at + 2} layout="none">
        <Audio src={staticFile(`vo/${c.id}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {hits().map((h, i) => (
      <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
        <Audio src={staticFile(h.src)} volume={MASTER * h.v * (1 - (1 - SFX_UNDER) * duck(h.at))} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
