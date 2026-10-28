// 본편(「AI 글 티 날 때 — 내 글 세 줄 붙이고 '이 말투로 다시 써 줘'」 v3): 청금석 무대 위 카드.
// 마디 다섯 — 훅(견줌 판: 빨간 테 친 처음 공지 줄 아래로 「이렇게」에서 세 줄 붙인 뒤 네 줄이 올라옴) → 한 줄(보낸 말을 크게 다시 짠 입력 칸 · 보내기)
// → 견줌(위 처음 공지 줄 · 아래 세 줄 붙인 뒤 네 줄을 큰 글로 함께: 빨간 테가 지워지고 노란 테) → 정리(그대로 붙여 쓰는 요청문 틀) → 끝(견줌 판 작게 · 질문).
// 마디 사이는 위로 밀기. 글은 모두 2026-10-28 ChatGPT 웹 임시 채팅의 실제 답 글(../자료/실험_답.md 1회) 그대로이고,
// 카드 · 입력 칸은 그 글로 크게 다시 짠 화면이다(제작 절차 「실제 화면은 크게 다시 짜기」). 짜임 · 시간 · 소리는 B14 「디테일 줄여 줘」 v5(이해 시험 4점)에서 옮겼다.
// v1(견줌 · 끝을 카드 두 장 밀어 넘기기 · 나란히로, 정리를 작은 전후 + 한 줄 판으로)은 이해 시험 3점 — 「비교하는 글이 너무 작아 바뀐 증거를 못 봄」,
// 「앞 4초 카드 한 장뿐」, 「끝에 뭘 해야 하는지(댓글?)」로 v2에서 바꿨다. v2(훅은 카드 한 장 밀어 넘기기)도 3점 — 「전후 비교가 8~10초에야 보임」,
// 「0~2초 공지 한 장이 AI가 쓴 것인지 모름」, 「4~8초 작은 대화창 + 입력 칸 배치가 복잡」, 「끝 글이 작음」, 「(내가 쓴 글 세 줄)이 자리표시인지 모름」으로 v3에서
// 훅을 견줌 판으로, 한 줄 장면을 입력 칸 하나로, 끝 판을 크게, 틀 자리를 「여기에 …」로 바꿨다. 옛 짜임은 git 이력에 있다.
// 소리: 배경음(본편 + 곡 끝맺음) + 사건마다 효과음 하나 + 내레이션(범수). 말하는 동안 배경음을 낮춘다(지난 편 값).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { clamp, EASE_OUT } from '../lib/anim';
import { C, F } from '../theme';
import { Lines, MarkF, Stage, Whip } from '../v5/cine';
import { at, CUT, TAIL, TOTAL } from './time';
import { CLIPS, clipEnd, wf } from './vo-time';

export { TOTAL };
export type Variant = 'A' | 'B' | 'C';
const WHERE: Record<Variant, string> = { A: '캡션에', B: '고정 댓글에', C: '아래 글에' };
type Box = { x: number; y: number; w: number; h: number };

// ── 시각(영상 프레임) ─────────────────────────────────────────
const T_LINE = at('line');
const T_CNT = at('cnt');
const T_RECAP = at('recap');
const T_END = at('end');
// 「이렇게」에서 밀기 시작해 2초 안에 네 줄 공지(제작 절차 「0~2초 전후 결과」)
const W_WIPE = wf('v01', '이렇게', 1.5) - 2;
const WIPE = [W_WIPE, W_WIPE + 10];

// ── 실제 답 글(../자료/실험_답.md 1회) ─────────────────────────
type Kind = 'emoji' | 'tag' | 'mine';
type Seg = string | { t: string; k: Kind; i: number };
// 견줌 판의 처음 공지 — 이모지 · 해시태그가 든 줄만(가운데 두 줄은 「…」로 줄임, 글은 그대로)
const EX_BEFORE: { b?: boolean; segs: Seg[] }[] = [
  { b: true, segs: [{ t: '☕', k: 'emoji', i: 0 }, ' 카페 임시 휴무 안내'] },
  { segs: ['안녕하세요! ', { t: '🤎', k: 'emoji', i: 1 }] },
  { segs: ['… 찾아뵐게요. ', { t: '☕', k: 'emoji', i: 2 }, { t: '🍰', k: 'emoji', i: 3 }] },
  { segs: ['감사합니다! ', { t: '🌿', k: 'emoji', i: 4 }] },
  { segs: [{ t: '#카페공지 #임시휴무 #휴무안내 #카페일상', k: 'tag', i: 5 }] },
];
const AFTER: Seg[][] = [
  ['다음 주 화요일(11월 3일)은 하루 쉬어갑니다.'],
  ['혹시 오시려던 분들 계시면 ', { t: '헛걸음하지 않으셨으면 좋겠어요.', k: 'mine', i: 0 }],
  ['수요일부터는 평소처럼 문 열게요.'],
  [{ t: '그때 뵐게요.', k: 'mine', i: 1 }],
];
const RED_N = 6; // 빨간 테: 이모지 다섯 + 해시태그 줄

// ── 표시 ─────────────────────────────────────────────────────
type MarkFn = (k: Kind, i: number) => number;
const ON: MarkFn = () => 1;

/** 짚는 글: 빨강(이모지 · 해시태그) · 노랑(내 말투). gone은 빨간 것이 빠지는 몫(흐려지며 줄이 그어짐). */
const Mk: React.FC<{ p: number; k: Kind; gone?: number; children: React.ReactNode }> = ({ p, k, gone = 0, children }) => {
  if (p <= 0) return <>{children}</>;
  const red = k !== 'mine';
  const col = red ? C.crayon : C.mark;
  return (
    <span
      style={{
        borderRadius: 12,
        padding: '0 .1em',
        margin: '0 -.1em',
        boxShadow: `inset 0 0 0 ${Math.max(1, 7 * p)}px ${col}`,
        background: red ? `rgba(249,104,89,${0.26 * p})` : `rgba(255,224,122,${0.24 * p})`,
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
        opacity: 1 - 0.65 * gone,
        textDecoration: gone > 0.3 ? `line-through ${C.crayon} 6px` : undefined,
      }}
    >
      {children}
    </span>
  );
};
const segs = (list: Seg[], mark?: MarkFn, gone = 0) =>
  list.map((s, j) =>
    typeof s === 'string' ? (
      <React.Fragment key={j}>{s}</React.Fragment>
    ) : (
      <Mk key={j} p={mark ? mark(s.k, s.i) : 0} k={s.k} gone={s.k === 'mine' ? 0 : gone}>
        {s.t}
      </Mk>
    ),
  );

const PANEL_BG = '#212121';
const PANEL_SHADOW = '0 0 0 2px rgba(255,255,255,.16),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)';

const SOURCE = '실제 ChatGPT 답 · 2026.10.28 · 같은 요청도 매번 달라요';
const Source: React.FC<{ top: number }> = ({ top }) => (
  <p style={{ position: 'absolute', left: 84, right: 160, top, margin: 0, font: `500 24px/1.35 ${F.ko}`, color: 'rgba(255,255,255,.84)', letterSpacing: '-.01em' }}>{SOURCE}</p>
);

/** 머리 큰 글 두 줄 — 위 끝 272(키트 cover916 위 안전선 269 아래, 올리기 전 검사 ⑤) */
const Head: React.FC<{ lines: React.ReactNode[]; zero?: boolean }> = ({ lines, zero }) => <Lines lines={lines} at={0} size={66} top={272} visibleAtZero={zero} />;
const M: React.FC<{ children: React.ReactNode; at: number }> = ({ children, at: a }) => {
  const f = useCurrentFrame();
  return <MarkF p={interpolate(f, [a, a + 10], [0, 1], clamp)}>{children}</MarkF>;
};

/** 판 오른쪽 위 테두리에 걸친 큰 꼬리표(판 안 글을 가리지 않게). on · off가 없으면 늘 보인다. */
const Tag: React.FC<{ text: React.ReactNode; box: Box; on?: number; off?: number; bg?: string; fg?: string; size?: number; o?: number }> = ({
  text,
  box,
  on,
  off,
  bg = 'rgba(0,0,0,.78)',
  fg = '#fff',
  size = 34,
  o: o0 = 1,
}) => {
  const f = useCurrentFrame();
  const o = (on === undefined || off === undefined ? 1 : interpolate(f, [on, on + 5, off - 5, off], [0, 1, 1, 0], clamp)) * o0;
  if (o <= 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        right: 1080 - box.x - box.w + 22,
        top: box.y - Math.round(size * 0.85),
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
        boxShadow: '0 10px 30px -10px rgba(0,0,0,.5)',
      }}
    >
      {text}
    </span>
  );
};

// ── 견줌 판: 위 처음 공지(이모지 · 해시태그 든 줄) · 아래 세 줄 붙인 뒤 네 줄 — 큰 글로 함께 ──
const CMP_TOP: Box = { x: 70, y: 462, w: 840, h: 374 };
const CMP_BOT: Box = { x: 70, y: 878, w: 840, h: 440 };
const Compare: React.FC<{ red: MarkFn; yel: MarkFn; gone: number; bot: number; topTag?: string }> = ({ red, yel, gone, bot, topTag = '처음 쓴 공지' }) => (
  <>
    <div style={{ position: 'absolute', left: CMP_TOP.x, top: CMP_TOP.y, width: CMP_TOP.w, height: CMP_TOP.h, boxSizing: 'border-box', padding: '32px 46px', borderRadius: 34, background: PANEL_BG, boxShadow: PANEL_SHADOW, color: '#ececec', font: `500 40px/1.45 ${F.ko}`, letterSpacing: '-.02em', wordBreak: 'keep-all' }}>
      {EX_BEFORE.map((p, i) => (
        <p key={i} style={{ margin: i ? '6px 0 0' : 0, fontWeight: p.b ? 800 : 500, whiteSpace: 'nowrap' }}>
          {segs(p.segs, red, gone)}
        </p>
      ))}
    </div>
    <Tag text={topTag} box={CMP_TOP} bg={C.crayon} size={40} />
    <div
      style={{
        position: 'absolute',
        left: CMP_BOT.x,
        top: CMP_BOT.y,
        width: CMP_BOT.w,
        height: CMP_BOT.h,
        boxSizing: 'border-box',
        padding: '0 46px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: 34,
        background: PANEL_BG,
        boxShadow: PANEL_SHADOW,
        color: '#ececec',
        font: `600 40px/1.45 ${F.ko}`,
        letterSpacing: '-.02em',
        wordBreak: 'keep-all',
        opacity: bot,
        translate: `0 ${(1 - bot) * 60}px`,
      }}
    >
      {AFTER.map((ln, i) => (
        <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>
          {segs(ln, yel)}
        </p>
      ))}
    </div>
    <Tag text="내 글 세 줄 붙인 뒤" box={{ ...CMP_BOT, y: CMP_BOT.y + (1 - bot) * 60 }} bg={C.mark} fg={C.ink} size={40} o={bot} />
  </>
);

// ── 마디 1: 훅 — 견줌 판: 빨간 테 친 처음 공지 줄(0프레임부터) → 「이렇게」에서 아래로 네 줄 공지(노란 테)가 올라옴 ─────
// 0~2초에 전후가 한 화면에 서게(v2 이해 시험 「전후 비교가 8~10초에야 보임」)
const SegHook: React.FC = () => {
  const f = useCurrentFrame();
  const bot = interpolate(f, WIPE, [0, 1], { ...clamp, easing: EASE_OUT });
  const yel: MarkFn = (k, i) => (k !== 'mine' ? 0 : interpolate(f, [WIPE[1] - 4 + 4 * i, WIPE[1] + 2 + 4 * i], [0, 1], { ...clamp, easing: EASE_OUT }));
  const z = 1 + 0.0006 * f;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '540px 900px', scale: String(z) }}>
        <Compare red={ON} yel={yel} gone={0} bot={bot} topTag="ChatGPT가 쓴 공지" />
      </div>
      <Source top={CMP_BOT.y + CMP_BOT.h + 14} />
    </>
  );
};

// ── 마디 2: 한 줄 — 처음 공지(작게) + 보낸 말을 크게 다시 짠 입력 칸 ─────
// 세 줄은 처음부터 붙여 넣어져 있고, 「이 말투로 다시 써 줘.」는 0.8초 안에 쳐지고 「이 말투로」에서 노랗게, 말이 끝나면 보내기.
const OFF_LINE = T_LINE - 12;
const PRE = '내가 전에 쓴 글이야.';
const MINE3 = ['비 와서 손님 없을 줄 알았는데 다들 와 주셨네요. 고마워요.', '오늘 스콘은 일찍 다 나갔어요. 내일 더 구울게요.', '문 앞 화분 물은 제가 줄게요. 그냥 두셔도 돼요.'];
const REQ = '이 말투로 다시 써 줘.';
const INPUT = { x: 70, y: 590, w: 850 };
const TYPE0 = T_LINE + 4;
const TYPE_STEP = 2;
const LIT3 = wf('v02', '세', 1.63) - 2;
const LIT = wf('v02', '말투로', 2.9) - 4;
const SEND = clipEnd('v02') + 4;
const SegLine: React.FC = () => {
  const f = useCurrentFrame() + OFF_LINE;
  const zoom = 1 + 0.035 * interpolate(f, [T_LINE, T_CNT], [0, 1], clamp);
  const press = interpolate(f, [SEND - 2, SEND, SEND + 6], [1, 0.86, 1], clamp);
  const ring = interpolate(f, [SEND, SEND + 14], [0, 1], { ...clamp, easing: EASE_OUT });
  const lit3 = interpolate(f, [LIT3, LIT3 + 6], [0, 1], clamp);
  const lit = f >= LIT;
  const typed = Math.max(0, Math.min(REQ.length, Math.floor((f - TYPE0) / TYPE_STEP) + 1));
  const caret = typed < REQ.length || Math.floor(f / 15) % 2 === 0;
  return (
    <>
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
      <div
        style={{
          position: 'absolute',
          left: INPUT.x,
          top: INPUT.y,
          width: INPUT.w,
          padding: '34px 40px 24px',
          boxSizing: 'border-box',
          borderRadius: 48,
          background: PANEL_BG,
          boxShadow: '0 0 0 2px rgba(255,255,255,.12),0 50px 90px -40px rgba(4,12,36,.75),0 18px 40px -24px rgba(4,12,36,.6)',
          scale: String(zoom),
          transformOrigin: '50% 30%',
        }}
      >
        <p style={{ margin: 0, font: `600 40px/1.3 ${F.ko}`, color: '#ececec', letterSpacing: '-.02em' }}>{PRE}</p>
        <div
          style={{
            position: 'relative',
            margin: '40px 0 0',
            padding: '34px 22px 20px',
            borderRadius: 20,
            background: `rgba(255,224,122,${0.06 + 0.1 * lit3})`,
            boxShadow: `inset 0 0 0 ${2 + 3 * lit3}px rgba(255,224,122,${0.3 + 0.7 * lit3})`,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 16,
              top: -30,
              padding: '8px 16px',
              borderRadius: 12,
              background: C.mark,
              color: C.ink,
              font: `800 32px/1.1 ${F.ko}`,
              letterSpacing: '-.02em',
              boxShadow: lit3 > 0.5 ? `0 0 0 4px rgba(255,224,122,.35)` : undefined,
              scale: String(1 + 0.08 * lit3 * (1 - lit3) * 4),
            }}
          >
            내가 전에 쓴 글 세 줄
          </span>
          {MINE3.map((t, i) => (
            <p key={i} style={{ margin: i ? '6px 0 0' : 0, font: `500 31px/1.36 ${F.ko}`, color: 'rgba(236,236,236,.94)', letterSpacing: '-.03em', whiteSpace: 'nowrap' }}>
              {t}
            </p>
          ))}
        </div>
        <p style={{ margin: '22px 0 0', height: 90, font: `800 74px/1.2 ${F.ko}`, letterSpacing: '-.035em', color: lit ? C.mark : '#fff', whiteSpace: 'nowrap' }}>
          {REQ.slice(0, typed)}
          <span style={{ display: 'inline-block', width: 6, height: 70, marginLeft: 6, verticalAlign: '-8px', background: caret && f < SEND ? '#fff' : 'transparent' }} />
        </p>
        <div style={{ marginTop: 10, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <svg width="52" height="52" viewBox="0 0 24 24" style={{ marginLeft: 4 }}>
            <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div style={{ position: 'relative', width: 92, height: 92 }}>
            {f >= SEND && ring < 1 ? (
              <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', boxShadow: `0 0 0 8px ${C.mark}`, opacity: 1 - ring, scale: String(0.8 + 0.7 * ring) }} />
            ) : null}
            <div style={{ width: 92, height: 92, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', scale: String(press) }}>
              <svg width="48" height="48" viewBox="0 0 24 24">
                <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="#0d0d0d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── 마디 3: 견줌 — 위 처음 공지 줄(빨간 테 → 지워짐) · 아래 세 줄 붙인 뒤(노란 테) ─────
const OFF_CNT = T_CNT - 12;
// 착지하자마자 빨간 테 여섯이 3프레임마다 — 0.6초 안에 차서 「빠지고」까지 머문다
const R0 = T_CNT + 2;
const R_STEP = 3;
const GONE = wf('v03', '빠지고,', 1.0) + 2; // 「빠지고」에서 빨간 것이 흐려지며 그어지고 아래 판이 올라온다
const Y0 = wf('v03', '내가', 1.89) - 4; // 「내가 쓴 글처럼」에서 노란 테 둘
const SegCount: React.FC = () => {
  const f = useCurrentFrame() + OFF_CNT;
  const red: MarkFn = (k, i) => (k === 'mine' ? 0 : interpolate(f, [R0 + R_STEP * i, R0 + R_STEP * i + 6], [0, 1], { ...clamp, easing: EASE_OUT }));
  const yel: MarkFn = (k, i) => (k !== 'mine' ? 0 : interpolate(f, [Y0 + 5 * i, Y0 + 5 * i + 8], [0, 1], { ...clamp, easing: EASE_OUT }));
  const gone = interpolate(f, [GONE, GONE + 8], [0, 1], clamp);
  const bot = interpolate(f, [GONE, GONE + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  const z = 1 + 0.0005 * Math.max(0, f - T_CNT);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '540px 900px', scale: String(z) }}>
        <Compare red={red} yel={yel} gone={gone} bot={bot} />
      </div>
      <Source top={CMP_BOT.y + CMP_BOT.h + 14} />
    </>
  );
};

// ── 마디 4: 정리 — 그대로 붙여 쓰는 요청문 틀(내 글 세 줄 자리 + 「이 말투로 다시 써 줘」) ─────
const OFF_RECAP = T_RECAP - 12;
const TPL = { x: 70, y: 500, w: 850 };
const R_LIT = wf('v04', '말투로', 2.55) - 4;
const R_LIT3 = wf('v04', '내', 1.1) - 2;
const SegRecap: React.FC = () => {
  const f = useCurrentFrame() + OFF_RECAP;
  const lit = interpolate(f, [R_LIT - 2, R_LIT + 6], [0, 1], clamp);
  const lit3 = interpolate(f, [R_LIT3, R_LIT3 + 6], [0, 1], clamp);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: TPL.x,
          top: TPL.y,
          width: TPL.w,
          padding: '44px 46px 46px',
          boxSizing: 'border-box',
          borderRadius: 40,
          background: PANEL_BG,
          boxShadow: `0 0 0 4px ${C.mark},0 50px 90px -40px rgba(4,12,36,.75)`,
          scale: String(1 + 0.04 * interpolate(f, [T_RECAP, T_END], [0, 1], clamp)),
          transformOrigin: '50% 40%',
        }}
      >
        <p style={{ margin: 0, font: `600 46px/1.3 ${F.ko}`, color: '#ececec', letterSpacing: '-.025em' }}>{PRE}</p>
        <div
          style={{
            margin: '24px 0 0',
            height: 196,
            borderRadius: 22,
            display: 'grid',
            placeItems: 'center',
            border: `4px dashed rgba(255,224,122,${0.45 + 0.55 * lit3})`,
            background: `rgba(255,224,122,${0.04 + 0.16 * lit3})`,
            font: `800 50px/1.2 ${F.ko}`,
            letterSpacing: '-.03em',
            color: lit3 > 0.5 ? C.mark : 'rgba(255,255,255,.8)',
          }}
        >
          여기에 내가 쓴 글 세 줄
        </div>
        <p style={{ margin: '28px 0 0', font: `800 80px/1.2 ${F.ko}`, letterSpacing: '-.04em', color: lit > 0.5 ? C.mark : '#fff', whiteSpace: 'nowrap' }}>{REQ}</p>
      </div>
      <span
        style={{
          position: 'absolute',
          left: TPL.x + 30,
          top: TPL.y - 30,
          padding: '10px 18px',
          borderRadius: 12,
          background: C.mark,
          color: C.ink,
          font: `800 32px/1.1 ${F.ko}`,
        }}
      >
        그대로 붙여 쓰는 요청문
      </span>
    </>
  );
};

// ── 마디 5: 끝 — 견줌 판 작게 · 질문 · 요청문 있는 곳 · 로고 ─────
const OFF_END = T_END - 12;
const END_Z = 0.86;
const SegEnd: React.FC<{ variant: Variant }> = ({ variant }) => {
  const f = useCurrentFrame() + OFF_END;
  // 같은 빠르기로 끝 0.6초 전까지(멈춘 화면 점검 대비)
  const p = interpolate(f, [T_END, TOTAL - 18], [0, 1], clamp);
  const o = interpolate(f, [T_END + 10, T_END + 18], [0, 1], clamp);
  const bottom = CMP_TOP.y + (CMP_BOT.y + CMP_BOT.h - CMP_TOP.y) * END_Z;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: `540px ${CMP_TOP.y}px`, scale: String(END_Z * (1 + 0.04 * p)) }}>
        <Compare red={ON} yel={ON} gone={0} bot={1} />
      </div>
      <Source top={bottom + 10} />
      <div style={{ position: 'absolute', left: 84, right: 160, top: bottom + 58, opacity: o }}>
        <div style={{ font: `800 42px/1.3 ${F.ko}`, color: '#fff', letterSpacing: '-.025em' }}>그대로 붙여 쓸 요청문은 {WHERE[variant]} 있어요</div>
        <Img src={staticFile('kit/logo-shift.webp')} style={{ height: 34, marginTop: 16, display: 'block' }} />
      </div>
    </>
  );
};

// ── 머리 큰 글(장면마다) ───────────────────────────────────────
const HEADS: { from: number; to: number; el: React.ReactNode }[] = [
  { from: 0, to: T_LINE, el: <Head zero lines={['AI 티 나는 공지', <M at={W_WIPE}>내 말투로 이렇게</M>]} /> },
  { from: T_LINE, to: T_CNT - 6, el: <Head lines={['같은 대화에 내 글 세 줄', <M at={LIT - T_LINE}>“이 말투로 다시 써 줘”</M>]} /> },
  { from: T_CNT, to: T_RECAP - 6, el: <Head lines={['이모지 · 해시태그 빼고', <M at={Y0 - T_CNT}>내가 쓴 글처럼</M>]} /> },
  { from: T_RECAP, to: T_END - 6, el: <Head lines={['AI 글 티 나면', <M at={R_LIT - T_RECAP}>이 한 줄</M>]} /> },
  { from: T_END, to: TOTAL, el: <Head lines={['어느 공지가 좋아요?', '댓글로 알려 주세요']} /> },
];

// ── 소리 ─────────────────────────────────────────────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: 1, src: 'sfx/thud.wav', v: 0.42 },
  { at: WIPE[0], src: 'sfx/swish.wav', v: 0.4 },
  { at: WIPE[1] - 2, src: 'sfx/earn.wav', v: 0.3 },
  { at: WIPE[1] + 2, src: 'sfx/pop.wav', v: 0.2 },
  { at: T_LINE - 10, src: 'sfx/swish.wav', v: 0.45 },
  { at: SEND, src: 'sfx/tok.wav', v: 0.4 },
  { at: T_CNT - 10, src: 'sfx/swish.wav', v: 0.45 },
  ...Array.from({ length: RED_N }, (_, i) => ({ at: R0 + R_STEP * i, src: 'sfx/tick.wav', v: 0.16 })),
  { at: GONE, src: 'sfx/swish.wav', v: 0.32 },
  { at: Y0, src: 'sfx/pop.wav', v: 0.22 },
  { at: Y0 + 5, src: 'sfx/pop.wav', v: 0.22 },
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
