// yuhobuilds 「AI가 만든 홈페이지가 다 똑같아 보이는 이유 — 고치는 한 줄」(10-25, 장부 Y5). 기획 · 콘티는 ../../../기획.md.
// 문법은 만족 사례 S22(검정 무대 · 흰 글 · 버터 한 곳, 머리글이 곧 내레이션)와 10-24 스킬 편(p3) 그대로다.
//  · 판 안은 전부 실제 화면: 10-25 실험에서 AI가 만든 HTML을 휴대폰 폭(390×844, 2배)으로 찍은 것(../../../자료/실험/).
//  · 휴대폰 두 대의 자리는 한 편 내내 같고, 내용은 장면마다 바뀐다. 「한 줄 붙인 판」은 위에서 아래로 덮는다.
//  · 버터는 「똑같은 자리」(테) · 「한 줄」 · 「실제 물건 하나」 한 뜻으로만.
//  · 버터 테 자리는 자료/상자.mjs가 잰 실제 요소 상자(CSS px, 390 폭 기준) — 실험/상자_기준.json.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, DIM, INK, STAGE } from '../film/parts';
import { EN, KO } from '../lib/fonts';
import { clamp } from '../lib/motion';
import { EndCard, endFollow } from './End';
import { at, lineEnd, TIMING, VO, type Cut, type Timing } from './time';
import { ease, EASE_MOVE, Line } from './Type';

const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)
const MUTED = '#8E8B84';
const FRAME = '#3A3833';

// ───────────── 휴대폰 두 대 ─────────────
const PH = { w: 380, h: 822 }; // 390×844 화면을 0.974배 — 꼬리표가 앱 글자 자리(1428px) 위에 들게(올리기 전 검사 10-25)
const K = PH.w / 390;
const SLOT_Y = 530;
const SLOT_X = [72, 492] as const; // 오른쪽 끝 872px — 릴스 단추 자리(920px~) 밖
const LABEL_Y = SLOT_Y + PH.h + 16;

type R = { x: number; y: number; w: number; h: number };
// 자료/상자.mjs로 잰 실제 요소 상자(CSS px). 식빵은 192px · 112px 이모지 글자 칸이라 그림만 보이게 줄였다.
const BOX = {
  bakery1: [
    { x: 23, y: 131, w: 343, h: 88 },
    { x: 36, y: 359, w: 161, h: 54 },
    { x: 212, y: 357, w: 131, h: 58 },
    { x: 95, y: 470, w: 200, h: 200 },
  ],
  bakery2: [
    { x: 34, y: 204, w: 321, h: 92 },
    { x: 36, y: 406, w: 161, h: 54 },
    { x: 212, y: 404, w: 131, h: 58 },
    { x: 135, y: 535, w: 120, h: 120 },
  ],
  flower: [
    { x: 23, y: 222, w: 343, h: 102 },
    { x: 109, y: 431, w: 172, h: 54 },
  ],
  tax: [
    { x: 31, y: 179, w: 328, h: 76 },
    { x: 113, y: 368, w: 163, h: 110 }, // 세로로 쌓인 버튼 둘은 테 하나로(Fable 완성본 검수: 테 둘이 14px 겹침)
  ],
} satisfies Record<string, R[]>;

/** 버터 테 하나: 6프레임에 살짝 커지며 들어온다. */
const Ring: React.FC<{ r: R; p: number }> = ({ r, p }) =>
  p <= 0 ? null : (
    <div
      style={{
        position: 'absolute',
        left: r.x * K - 7,
        top: r.y * K - 7,
        width: r.w * K + 14,
        height: r.h * K + 14,
        borderRadius: 14,
        boxShadow: `0 0 0 4px ${BUTTER}`,
        opacity: p,
        transform: `scale(${1.06 - 0.06 * p})`,
      }}
    />
  );

/** 한 줄 붙인 판으로 덮인 휴대폰 위 꼬리표(이해 시험 2회: 「어느 결과에 붙인 건지 불분명」). */
const OneTag: React.FC = () => (
  <div style={{ position: 'absolute', left: 14, top: 14, padding: '8px 18px', borderRadius: 14, background: BUTTER, boxShadow: '0 4px 14px rgba(0,0,0,0.35)', fontFamily: KO, fontWeight: 760, fontSize: 30, letterSpacing: '-0.02em', color: '#121211', whiteSpace: 'nowrap' }}>+ 한 줄</div>
);

/**
 * 휴대폰 한 대. to가 있으면 wipe(0~1)만큼 위에서 아래로 덮는다.
 * ring은 테 전체의 진행(0~1), ringEach가 있으면 테마다 따로. zoom은 바뀐 화면의 큰 글을 읽히게 당기는 정도(1 = 그대로),
 * origin은 당기는 기준점 — 오른쪽 휴대폰은 오른쪽 끝을 붙잡아 릴스 단추 자리(920px~)로 넘지 않게 한다.
 */
const Phone: React.FC<{ x: number; src: string; to?: string; wipe?: number; dim?: number; rings?: R[]; ring?: number; ringEach?: number[]; zoom?: number; origin?: string }> = ({
  x,
  src,
  to,
  wipe = 0,
  dim = 0,
  rings = [],
  ring = 0,
  ringEach,
  zoom = 1,
  origin = '50% 25%',
}) => (
  <div style={{ position: 'absolute', left: x, top: SLOT_Y, width: PH.w, height: PH.h, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: origin, zIndex: zoom > 1 ? 2 : 1 }}>
    <div style={{ position: 'absolute', inset: 0, borderRadius: 30, overflow: 'hidden', background: '#111' }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: PH.w, height: PH.h }} />
      {to && wipe > 0 ? <Img src={staticFile(to)} style={{ position: 'absolute', left: 0, top: 0, width: PH.w, height: PH.h, clipPath: `inset(0 0 ${(1 - wipe) * 100}% 0)` }} /> : null}
      {to && wipe > 0 && wipe < 1 ? <div style={{ position: 'absolute', left: 0, right: 0, top: wipe * PH.h - 2, height: 4, background: BUTTER }} /> : null}
      {dim > 0 ? <div style={{ position: 'absolute', inset: 0, background: STAGE, opacity: dim }} /> : null}
    </div>
    <div style={{ position: 'absolute', inset: -2, borderRadius: 32, boxShadow: `inset 0 0 0 3px ${FRAME}`, pointerEvents: 'none' }} />
    {to && wipe >= 1 ? <OneTag /> : null}
    {rings.map((r, i) => (
      <Ring key={i} r={r} p={ringEach ? Math.min(ringEach[i] ?? 0, 1) * ring : ring} />
    ))}
  </div>
);

/** 휴대폰 아래 꼬리표. 글이 바뀌면 짧게 올라온다. */
const Label: React.FC<{ x: number; text: string; at?: number; color?: string; hide?: number }> = ({ x, text, at: a = 0, color = MUTED, hide = 0 }) => {
  const f = useCurrentFrame();
  const p = (a <= 0 ? 1 : ease(f, a, 8)) * (1 - hide);
  return (
    <div style={{ position: 'absolute', left: x + 22, top: LABEL_Y, fontFamily: KO, fontWeight: 660, fontSize: 36, letterSpacing: '-0.02em', color, opacity: p, transform: `translateY(${(1 - p) * 10}px)`, whiteSpace: 'nowrap' }}>
      {text}
    </div>
  );
};
/** a 전에는 first, a부터 second(짧게 올라옴). */
const Swap: React.FC<{ x: number; a: number; first: string; second: string; color1?: string; color2?: string; hide?: number }> = ({ x, a, first, second, color1 = MUTED, color2 = INK, hide = 0 }) => {
  const f = useCurrentFrame();
  return f < a ? <Label x={x} text={first} color={color1} hide={hide} /> : <Label x={x} text={second} at={a} color={color2} hide={hide} />;
};

/** 판 아래 작은 회색 줄(무엇을 보는지). */
const Note: React.FC<{ children: React.ReactNode; hide?: number }> = ({ children, hide = 0 }) => (
  <div style={{ position: 'absolute', left: 94, top: LABEL_Y + 58, fontFamily: KO, fontWeight: 560, fontSize: 26, color: '#6E6C66', letterSpacing: '-0.01em', opacity: 1 - hide }}>{children}</div>
);

// ───────────── 장면 ─────────────
/** 장면 경계: 그 줄 첫 소리보다 6프레임 앞(숨 자리)에서 넘긴다. */
const cutAt = (id: keyof typeof VO) => VO[id] - 6;
const SC = {
  bakery: 0,
  why: cutAt('w1'),
  line: cutAt('f1'),
  after: cutAt('f2'),
  cta: cutAt('ig'), // ig · yt 같은 자리(끝 말 앞까지는 두 판이 같다)
};

/** 장면 하나: a에 아래에서 올라와 들어오고 b에 위로 빠진다(8프레임 겹침). 그사이 천천히 밀린다. */
const Scene: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b + 8) return null;
  const pin = a === 0 ? 1 : ease(f, a, 9);
  const pout = ease(f, b, 8, EASE_MOVE);
  const s = 1 + Math.min(0.06, 0.0008 * (f - a)); // 정지 구간(10-25): 0.05%로는 글 카드 · 끝 말 장면이 「거의 멈춤」으로 잡혀 지난 편보다 조금 세게
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 46 - pout * 46}px) scale(${s})`, transformOrigin: '50% 62%' }}>{children}</div>
  );
};

// 장면 1·2 · 빵집 두 번 → 한 줄 붙인 판
// 이해 시험 1회(3점): 「처음엔 무엇을 견주는지 약함」 · 「한 줄 붙인 결과에서 무엇이 달라졌는지 글씨가 작아 안 읽힘」
// → 같은 자리 테를 0.5초부터 하나씩(제목 · 버튼 · 식빵) 치고, 덮은 뒤 오른쪽 화면을 당겨 「종이봉투에 담아 드려요」가 읽히게 한다.
const BakeryScene: React.FC = () => {
  const f = useCurrentFrame();
  const wipeAt = at('h2', '붙였더니') - 2;
  const ring = 1 - ease(f, wipeAt - 8, 8);
  const each = [ease(f, 14, 6), ease(f, 26, 6), ease(f, 26, 6), ease(f, 38, 6)]; // 제목 → 버튼 둘 → 식빵
  const wipe = ease(f, wipeAt, 14, EASE_MOVE);
  const zoomP = ease(f, wipeAt + 16, 14, EASE_MOVE);
  return (
    <>
      <Phone x={SLOT_X[0]} src="shot/b_base1.png" rings={BOX.bakery1} ring={ring} ringEach={each} dim={0.55 * zoomP} />
      <Phone x={SLOT_X[1]} src="shot/b_base2.png" to="shot/b_one.png" wipe={wipe} rings={BOX.bakery2} ring={ring} ringEach={each} zoom={1 + 0.3 * zoomP} origin="100% 0%" />
      <Swap x={SLOT_X[0]} a={wipeAt} first="1번째 결과" second="그냥 시킨 것" color1={INK} color2={MUTED} hide={zoomP} />
      <Swap x={SLOT_X[1]} a={wipeAt} first="2번째 결과" second="한 줄 붙인 것" color1={INK} hide={zoomP} />
      <Note hide={zoomP}>같은 요청 · AI가 실제로 만든 화면</Note>
    </>
  );
};

// 장면 3 · 까닭 — 꽃집 · 세무사도 같은 틀
const WhyScene: React.FC = () => {
  const f = useCurrentFrame();
  const fl = at('w1', '꽃집도') - 2;
  const tx = at('w1', '세무사도') - 2;
  const same = at('w1', '똑같죠') - 2;
  // 「꽃집도」에 세무사가, 「세무사도」에 꽃집이 어두워지고, 「똑같죠」에 둘 다 밝아지며 같은 자리에 테
  const flowerDim = 0.55 * ease(f, tx, 6) * (1 - ease(f, same, 6));
  const taxDim = 0.55 * ease(f, fl, 6) * (1 - ease(f, tx, 6));
  const ring = ease(f, same, 6);
  return (
    <>
      <Phone x={SLOT_X[0]} src="shot/f_base.png" dim={flowerDim} rings={BOX.flower} ring={ring} />
      <Phone x={SLOT_X[1]} src="shot/t_base.png" dim={taxDim} rings={BOX.tax} ring={ring} />
      <Label x={SLOT_X[0]} text="꽃집" />
      <Label x={SLOT_X[1]} text="세무사" />
      <Note>한 줄 없이 시킨 화면 · 같은 AI</Note>
    </>
  );
};

// 장면 4 · 그 한 줄
// 이해 시험 3회(최종 판 3점): 글자를 한 자씩 치면 정지컷마다 반쯤 비고, 회색 요청 줄의 「…」가 「잘렸다」로 읽혔다.
// → 요청 줄은 빼고, 한 줄 전문을 장면 시작부터 줄 단위로 바로 다 띄운다(크게 52px). 「실제 물건 하나」만 버터.
// 줄 나눔은 손으로 고정한다(낱말이 줄 끝에서 갈리지 않게).
const ONE = '먼저 이 가게에 어울리는 실제 물건 하나(간판, 포장지, 메뉴판 같은)를 정하고, 그 물건의 색과 글씨로 화면을 만들어 줘.';
const ONE_LINES = ['먼저 이 가게에 어울리는', '실제 물건 하나', '(간판, 포장지, 메뉴판 같은)를 정하고,', '그 물건의 색과 글씨로', '화면을 만들어 줘.'];
// 줄마다 낱말 묶음과 그 묶음을 밝히는 말의 낱말(정지 구간 10-25: 줄 단위로만 밝히면 17.5초 칸이 「거의 멈춤」).
const ONE_SEGS: [string, string][][] = [
  [['먼저 이 ', '먼저'], ['가게에 ', '가게에'], ['어울리는', '어울리는']],
  [['실제 물건 하나', '실제']],
  [['(간판, ', '간판이나'], ['포장지, ', '포장지,'], ['메뉴판 같은)를 ', '메뉴판'], ['정하고,', '정하고,']],
  [['그 물건의 ', '물건의'], ['색과 ', '색과'], ['글씨로', '글씨로']],
  [['화면을 ', '화면을'], ['만들어 줘.', '만들어']],
];
const KEY = '실제 물건 하나';
// 이해 시험 4회(3점): 「말은 요약이라 정확한 문장은 DM으로 받아야 한다」 — 말이 한 줄을 그대로 읽고(괄호 예시는 「간판이나 포장지, 메뉴판 같은 걸」로),
// 카드는 읽는 줄을 따라 밝아진다(지난 줄 흰색 · 지금 줄 흰색 · 아직 안 읽은 줄 회색).
const LineScene: React.FC = () => {
  const f = useCurrentFrame();
  const a = SC.line + 6;
  const card = ease(f, SC.line, 10);
  const dimC = [92, 90, 84];
  return (
    <div style={{ position: 'absolute', left: 72, top: SLOT_Y, width: 848, height: 640, borderRadius: 30, background: '#161614', boxShadow: `inset 0 0 0 2px ${FRAME}`, opacity: card }}>
      <div style={{ position: 'absolute', left: 52, top: 44, fontFamily: KO, fontWeight: 700, fontSize: 36, color: '#B6B3AB' }}>요청 끝에 붙인 한 줄</div>
      <div style={{ position: 'absolute', left: 52, right: 40, top: 118, fontFamily: KO, fontWeight: 740, fontSize: 52, lineHeight: 1.5, letterSpacing: '-0.035em' }}>
        {ONE_SEGS.map((segs, i) => {
          const p = ease(f, a + 3 * i, 10);
          return (
            <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, whiteSpace: 'nowrap', fontSize: i === 2 ? 44 : 52 }}>
              {segs.map(([txt, word], k) => {
                const lit = ease(f, at('f1', word) - 3, 5);
                const base = ONE_LINES[i] === KEY ? [245, 196, 69] : [244, 242, 236];
                const c = base.map((v, j) => Math.round(dimC[j] + (v - dimC[j]) * lit));
                return (
                  <span key={k} style={{ color: `rgb(${c.join(',')})` }}>
                    {txt}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 장면 5 · 꽃집은 포장지, 세무사는 서류 봉투
// 덮는 화면마다 잠깐 당겨 큰 글(「꽃 한 다발, 종이에 싸서 드려요」 · 「서류는 봉투째 주세요」)이 읽히게, 다른 쪽은 어둡게.
const AfterScene: React.FC = () => {
  const f = useCurrentFrame();
  const fl = at('f2', '꽃집은') - 2;
  const tx = at('f2', '세무사는') - 2;
  const flZoom = ease(f, fl + 10, 10, EASE_MOVE) * (1 - ease(f, tx, 10, EASE_MOVE));
  const txZoom = ease(f, tx + 10, 10, EASE_MOVE);
  const drift = Math.max(0, f - (tx + 20)) * 0.0012; // 당긴 뒤에도 천천히 더(정지 구간 10-25: 23초 칸)
  return (
    <>
      <Phone x={SLOT_X[0]} src="shot/f_base.png" to="shot/f_one.png" wipe={ease(f, fl, 14, EASE_MOVE)} zoom={1 + 0.24 * flZoom} origin="0% 0%" dim={0.5 * txZoom} />
      <Phone x={SLOT_X[1]} src="shot/t_base.png" to="shot/t_one.png" wipe={ease(f, tx, 14, EASE_MOVE)} zoom={1 + 0.24 * txZoom + drift} origin="100% 0%" dim={0.5 * flZoom} />
      <Swap x={SLOT_X[0]} a={fl} first="꽃집" second="꽃집 · 포장지" hide={Math.max(flZoom, txZoom)} />
      <Swap x={SLOT_X[1]} a={tx} first="세무사" second="세무사 · 서류 봉투" hide={Math.max(flZoom, txZoom)} />
      <Note hide={Math.max(flZoom, txZoom)}>같은 요청에 한 줄만 붙인 화면 · 이름은 가림</Note>
    </>
  );
};

// 장면 6 · 끝 말(판마다)
const RIGHT = 160;
const CtaBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', left: 72, top: SLOT_Y, width: 848, height: 470, borderRadius: 30, background: '#161614', boxShadow: `inset 0 0 0 2px ${FRAME}`, overflow: 'hidden' }}>{children}</div>
);
const IgCta: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const typeAt = at('ig', '한줄이라고', 0, t) - 4;
  const sendAt = typeAt + 14;
  // 정지 구간(10-25): 보낸 뒤 DM까지 2초가 멈춰 있었다 → 보낸 댓글이 아래에 올라오고, DM은 「주시면」 뒤에 바로.
  const dmAt = sendAt + 12;
  const postAt = sendAt + 3;
  const typed = Math.max(0, Math.min(2, Math.floor((f - typeAt) / 4) + 1));
  const press = ease(f, sendAt, 3) * (1 - ease(f, sendAt + 4, 8));
  const dm = ease(f, dmAt, 10, EASE_MOVE);
  const rise = (p: number): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 16}px)` });
  return (
    <CtaBox>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - dm, transform: `translateY(${-dm * 40}px)` }}>
        <div style={{ position: 'absolute', left: 44, top: 44, fontFamily: KO, fontWeight: 640, fontSize: 30, color: MUTED }}>이 릴스에 댓글 달기</div>
        <div style={{ position: 'absolute', left: 44, right: RIGHT - 60, top: 104, height: 104, borderRadius: 24, background: '#121210', boxShadow: `inset 0 0 0 2px ${press > 0 ? `rgba(245,196,69,${0.25 + 0.75 * press})` : FRAME}` }}>
          <div style={{ position: 'absolute', left: 30, top: 0, height: 104, display: 'flex', alignItems: 'center', fontFamily: KO, fontWeight: 680, fontSize: 40, color: f < typeAt || f >= postAt ? '#5A5852' : INK }}>{f < typeAt || f >= postAt ? '댓글 달기…' : '한줄'.slice(0, typed)}</div>
        </div>
        {f >= postAt ? (
          <div style={{ position: 'absolute', left: 44, top: 250, display: 'flex', alignItems: 'center', gap: 20, ...rise(ease(f, postAt, 9)) }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: '#3A3833' }} />
            <div>
              <div style={{ fontFamily: KO, fontWeight: 640, fontSize: 27, color: MUTED }}>나 · 방금</div>
              <div style={{ marginTop: 4, fontFamily: KO, fontWeight: 700, fontSize: 38, color: INK }}>한줄</div>
            </div>
          </div>
        ) : null}
      </div>
      {dm > 0 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: dm, transform: `translateY(${(1 - dm) * 40}px)` }}>
          <div style={{ position: 'absolute', left: 44, top: 40, fontFamily: KO, fontWeight: 640, fontSize: 30, color: MUTED }}>메시지 · @yuhobuilds</div>
          <div style={{ position: 'absolute', left: 44, top: 100, width: 690, borderRadius: 26, background: '#22211E', padding: '24px 30px', fontFamily: KO, fontWeight: 660, fontSize: 35, lineHeight: 1.4, color: INK, letterSpacing: '-0.02em', ...rise(ease(f, dmAt + 4, 9)) }}>
            「한줄」 남겨 주셔서 고마워요!
            <br />
            홈페이지 요청 끝에 붙일 한 줄이에요.
            <div style={{ marginTop: 22, borderRadius: 18, background: '#121210', boxShadow: `inset 0 0 0 2px ${BUTTER}`, padding: '18px 22px', ...rise(ease(f, dmAt + 14, 9)) }}>
              <div style={{ fontFamily: EN, fontWeight: 650, fontSize: 32, color: BUTTER }}>synk.im/prompts</div>
              <div style={{ marginTop: 6, fontFamily: KO, fontWeight: 600, fontSize: 27, color: '#B6B3AB' }}>복사해서 그대로 붙이면 돼요</div>
            </div>
          </div>
        </div>
      ) : null}
    </CtaBox>
  );
};
const YtCta: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const pinAt = t.vo.yt - 2;
  const copyAt = at('yt', '복사해서', 0, t) - 2;
  const ring = ease(f, copyAt, 7);
  const p = ease(f, pinAt, 9);
  return (
    <CtaBox>
      <div style={{ position: 'absolute', left: 44, right: 56, top: 44, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
        <div style={{ fontFamily: KO, fontWeight: 620, fontSize: 27, color: MUTED }}>📌 @yuhobuilds님이 고정함</div>
        <div style={{ marginTop: 16, fontFamily: EN, fontWeight: 650, fontSize: 31, color: INK }}>@yuhobuilds</div>
        <div style={{ marginTop: 14, fontFamily: KO, fontWeight: 640, fontSize: 31, color: '#C9C6BE', letterSpacing: '-0.02em' }}>홈페이지 요청 끝에 이 한 줄을 붙이세요</div>
        <div style={{ marginTop: 18, borderRadius: 18, padding: '20px 24px', background: '#121210', boxShadow: `inset 0 0 0 ${2 + 1.5 * ring}px rgba(245,196,69,${0.35 + 0.65 * ring})`, fontFamily: KO, fontWeight: 680, fontSize: 33, lineHeight: 1.45, letterSpacing: '-0.02em', color: INK, wordBreak: 'keep-all' }}>{ONE}</div>
        <div style={{ marginTop: 18, fontFamily: EN, fontWeight: 600, fontSize: 29, color: BUTTER }}>synk.im/prompts</div>
      </div>
    </CtaBox>
  );
};

// ───────────── 머리글 ─────────────
const Heads: React.FC<{ t: Timing }> = ({ t }) => {
  const same = at('h1', '거의') - 3;
  const fl = at('w1', '꽃집도') - 3;
  return (
    <>
      <Line lines={['AI한테 빵집 홈페이지', '두 번 시켰더니']} at={0} until={same} />
      <Line lines={['거의 똑같이', '나왔어요']} accent="똑같이" at={same} until={VO.h2 - 3} />
      <Line lines={['한 줄 붙였더니']} accent="한 줄" at={VO.h2 - 3} until={SC.why} />
      <Line lines={['종이봉투처럼 바뀌었어요']} at={at('h2', '종이봉투처럼') - 3} until={SC.why} top={300 + 90} />
      <Line lines={['AI는 말 안 하면', '제일 흔한 모양을 골라요']} accent="흔한" at={VO.w1 - 3} until={fl} />
      <Line lines={['꽃집도, 세무사도', '똑같죠']} accent="똑같죠" at={fl} until={SC.line} />
      <Line lines={['붙인 한 줄은', '이거예요']} accent="한 줄" at={VO.f1 - 3} until={SC.after} />
      <Line lines={['꽃집은 포장지,']} at={at('f2', '꽃집은') - 3} until={SC.cta} />
      <Line lines={['세무사는 서류 봉투']} at={at('f2', '세무사는') - 3} until={SC.cta} top={300 + 90} />
      {t.cut === 'ig' ? (
        <Line lines={['댓글에 「한줄」이라고 쓰면', '이 한 줄을 DM으로']} accent="「한줄」" at={t.vo.ig - 3} until={t.end} />
      ) : (
        <Line lines={['이 한 줄은', '고정 댓글에']} accent="고정 댓글" at={t.vo.yt - 3} until={t.end} />
      )}
    </>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (t: Timing): Hit[] => {
  const out: Hit[] = [
    { at: at('h1', '똑같이') - 2, src: 'sfx/tick2.wav', v: 0.2 },
    { at: at('h2', '붙였더니') - 4, src: 'sfx/swish.wav', v: 0.2 },
    { at: at('h2', '붙였더니') + 10, src: 'sfx/snap.wav', v: 0.2 },
    ...[SC.why, SC.line, SC.after, SC.cta].map((a) => ({ at: a - 2, src: 'sfx/swish.wav', v: 0.15 })),
    { at: at('w1', '똑같죠') - 2, src: 'sfx/tick2.wav', v: 0.18 },
    { at: at('f1', '실제') - 1, src: 'sfx/tick.wav', v: 0.16 },
    { at: SC.line + 6, src: 'sfx/snap.wav', v: 0.16 },
    { at: at('f2', '꽃집은') - 4, src: 'sfx/swish.wav', v: 0.16 },
    { at: at('f2', '세무사는') - 4, src: 'sfx/swish.wav', v: 0.16 },
    { at: t.end, src: 'sfx/swish.wav', v: 0.18 },
    { at: endFollow(t), src: 'sfx/tok.wav', v: 0.42 },
  ];
  if (t.cut === 'ig') {
    const typeAt = at('ig', '한줄이라고', 0, t) - 4;
    out.push({ at: typeAt + 14, src: 'sfx/tok.wav', v: 0.28 }, { at: typeAt + 26, src: 'sfx/swish.wav', v: 0.18 }, { at: typeAt + 40, src: 'sfx/snap.wav', v: 0.18 });
  } else {
    out.push({ at: at('yt', '복사해서', 0, t) - 2, src: 'sfx/tick2.wav', v: 0.16 });
  }
  return out;
};

// ───────────── 본편 ─────────────
export const OneLineFilm: React.FC<{ cut: Cut; bgm?: boolean }> = ({ cut, bgm = true }) => {
  const t = TIMING[cut];
  const ranges = t.order.map((id) => [t.vo[id], lineEnd(id, t)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (t.total - fr) / 20);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.42 - 0.16 * voice) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Stage t={t} />
      <Heads t={t} />
      <EndGate t={t} />
      {t.order.map((id) => (
        <Sequence key={id} from={t.vo[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {hits(t).map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile(`bgm_${cut}.wav`)} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

const Stage: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  if (f >= t.end + 8) return null;
  const gone = ease(f, t.end, 8);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone }}>
      <Scene a={SC.bakery} b={SC.why}>
        <BakeryScene />
      </Scene>
      <Scene a={SC.why} b={SC.line}>
        <WhyScene />
      </Scene>
      <Scene a={SC.line} b={SC.after}>
        <LineScene />
      </Scene>
      <Scene a={SC.after} b={SC.cta}>
        <AfterScene />
      </Scene>
      <Scene a={SC.cta} b={t.end}>
        {t.cut === 'ig' ? <IgCta t={t} /> : <YtCta t={t} />}
      </Scene>
    </div>
  );
};

const EndGate: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  if (f < t.end) return null;
  return (
    <AbsoluteFill style={{ opacity: ease(f, t.end, 8) }}>
      <EndCard t={t} />
    </AbsoluteFill>
  );
};

/** 표지: 같은 빵집, 그냥 시킨 것 · 한 줄 붙인 것. */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <Phone x={SLOT_X[0]} src="shot/b_base1.png" />
    <Phone x={SLOT_X[1]} src="shot/b_one.png" />
    <Label x={SLOT_X[0]} text="그냥 시킨 것" />
    <Label x={SLOT_X[1]} text="한 줄 붙인 것" color={INK} />
    <div style={{ position: 'absolute', left: 72, top: 276, fontFamily: KO, fontWeight: 650, fontSize: 36, color: '#A9A69E', letterSpacing: '-0.02em' }}>
      AI한테 빵집 홈페이지 시키면 <span style={{ color: INK }}>다 똑같죠?</span>
    </div>
    <Line lines={['AI 티 빼는', '한 줄']} accent="한 줄" at={0} top={334} />
    <div style={{ position: 'absolute', left: 94, top: LABEL_Y + 56, fontFamily: KO, fontWeight: 600, fontSize: 28, color: DIM }}>같은 요청 · AI가 실제로 만든 화면</div>
  </AbsoluteFill>
);
