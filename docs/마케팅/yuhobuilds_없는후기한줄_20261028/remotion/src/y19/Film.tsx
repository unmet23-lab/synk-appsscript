// yuhobuilds 「AI한테 '후기까지 써 줘' 했더니 — 지어내지 않게 하는 한 줄」(10-28, 장부 Y19). 기획 · 콘티는 ../../../기획.md.
// 제작 절차 「synkbrief · yuhobuilds 편」(10-27): 0초에 전후 결과 → 그 한 줄을 크게 → 끝 「아래 글에」. 문법은 만족 사례 S22(검정 무대 · 흰 글 · 버터 한 곳, 머리글이 곧 내레이션).
// Y9 v3(yuhobuilds_자고일어나면영상_20261026/remotion/src/y9v3/Film.tsx)에서 시작했다.
//  · 판은 스크린숏을 깔지 않고 ChatGPT 임시 채팅 실제 답(../../../자료/실험_답.md의 A2 · B2)을 크게 다시 짠 것 — 글자는 실제 그대로,
//    긴 후기 문장의 뒤쪽만 「…」로 줄였다. 한 줄 없는 답이 적은 「예시입니다」 안내도 판에 둔다(기획 함정 ⓪).
//  · 버터는 AI가 지어낸 자리(작성자) · 빈칸 · 붙인 한 줄에만.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, interpolateColors, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, INK, STAGE } from '../film/parts';
import { KO } from '../lib/fonts';
import { clamp } from '../lib/motion';
import { ease, EASE_MOVE, Line } from '../y9/Type';
import { EndCard, endFollow } from './End';
import { at, ctaOf, idx, lineEnd, TIMING, wd, type Cut, type Timing } from './time';

const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)
const FRAME = '#3A3833';
const MUTED = '#8E8B84';
const CHAT_BG = '#191919';
const BUBBLE = '#252525';
const AI_INK = '#ECEAE4';
const UNLIT = '#55534E';

const PX = 72; // 안전 영역 x 65~920(올리기 전 검사 ⑤)
const RIGHT = 920;
const PW = RIGHT - PX;

// ───────────── 장면 · 사건 ─────────────
const scenes = (t: Timing) => {
  const cta = ctaOf(t.cut);
  const SC = {
    line: t.vo.r1 - 4, // 부탁 끝에 붙인 한 줄
    blank: t.vo.b1 - 6, // 다른 빈칸들
    cta: t.vo[cta] - 6,
  };
  const EV = {
    aFocus: at('h1', '아무도', t) - 3, // 「그냥 부탁했을 때」 답만 밝게
    aMark: at('h1', '지어', t) - 2, // 작성자 줄 셋에 차례로 테
    bFocus: t.vo.h2 - 2, // 「한 줄 붙였을 때」 답만 밝게
    bMark: at('h2', '빈칸', t) - 2,
    name: at('b1', '가게', t) - 2,
    price: at('b1', '가격', t) - 2,
    hours: at('b1', '채우면', t) - 2,
    ctaMark: at(cta, '맨', t) - 2,
  };
  return { SC, EV, cta };
};

/** 장면 하나: a에 아래에서 올라와 들어오고 b에 위로 빠진다(8프레임 겹침). 그사이 천천히 밀린다(올리기 전 검사 ② 정지 구간). */
const Scene: React.FC<{ a: number; b: number; drift?: number; children: React.ReactNode }> = ({ a, b, drift = 0.4, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b + 8) return null;
  const pin = a <= 0 ? 1 : ease(f, a, 9);
  const pout = ease(f, b, 8, EASE_MOVE);
  const k = f - Math.max(0, a);
  // Y9 v3 마감에서 맞춘 빠르기: 상한 없이 장면 끝까지 같은 빠르기로 천천히(0.22px/프레임은 정지로 잡혔다)
  const s = 1 + 0.00015 * k;
  const dy = drift * k; // 첫 장면은 9초로 길어 0.25 — 아래 판이 끝까지 안전 영역(y 1428) 안에
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 46 - pout * 46 + dy}px) scale(${s})`, transformOrigin: '50% 50%' }}>{children}</div>
  );
};

/** 꼬리표(우리 덧붙임 — 앱 화면의 일부가 아님). */
const Chip: React.FC<{ text: string; butter?: boolean; size?: number }> = ({ text, butter, size = 42 }) => (
  <div
    style={{
      display: 'inline-block',
      padding: '8px 22px 10px',
      borderRadius: 14,
      background: butter ? BUTTER : '#2A2926',
      boxShadow: butter ? 'none' : 'inset 0 0 0 2px #4A4842',
      fontFamily: KO,
      fontWeight: 760,
      fontSize: size,
      letterSpacing: '-0.02em',
      color: butter ? '#121211' : INK,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
);

/** 판 속 글 한 토막에 버터 테. p가 0이면 그냥 글. */
const Mark: React.FC<{ p: number; children: React.ReactNode }> = ({ p, children }) => (
  <span
    style={{
      borderRadius: 12,
      padding: '0 10px',
      margin: '0 -10px',
      boxShadow: `inset 0 0 0 ${4.5 * p}px ${BUTTER}`,
      background: `rgba(245,196,69,${0.1 * p})`,
      color: p > 0.5 ? INK : undefined,
    }}
  >
    {children}
  </span>
);

/** AI 답 판: 왼쪽 붙음, 꼬리표 + 답 글. 꼬리표는 판 위 가장자리에 걸친 탭(두 판이 안전 영역 y 1428 안에 들게). lit이 0이면 어둡게 눌린다(짚는 판만 도드라지게). */
const Answer: React.FC<{ y: number; chip: string; butter?: boolean; lit?: number; children: React.ReactNode }> = ({ y, chip, butter, lit = 1, children }) => (
  <div style={{ position: 'absolute', left: PX, top: y, width: PW }}>
    <div style={{ position: 'relative', padding: '42px 34px 28px', borderRadius: 30, background: CHAT_BG, boxShadow: `0 0 0 2px ${FRAME}, 0 18px 40px rgba(0,0,0,0.5)` }}>
      <div style={{ position: 'absolute', left: 28, top: -36, display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* 이해 시험 둘 「위아래 비교 꼬리표가 작다」 42 → 48 */}
        <Chip text={chip} butter={butter} size={48} />
        <span style={{ fontFamily: KO, fontWeight: 650, fontSize: 34, color: MUTED, letterSpacing: '-0.01em', background: STAGE, padding: '0 10px', borderRadius: 10 }}>AI 답</span>
      </div>
      <div style={{ fontFamily: KO, color: AI_INK, wordBreak: 'keep-all', letterSpacing: '-0.025em' }}>{children}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: -40, borderRadius: 30, background: '#0A0A0A', opacity: 0.62 * (1 - lit), pointerEvents: 'none' }} />
    </div>
  </div>
);

/** 답 속 한 줄(크기 · 굵기 · 색만 다르다). */
const Row: React.FC<{ size: number; weight?: number; color?: string; italic?: boolean; gap?: number; children: React.ReactNode }> = ({ size, weight = 600, color, italic, gap = 0, children }) => (
  <div style={{ fontSize: size, fontWeight: weight, lineHeight: 1.28, color, fontStyle: italic ? 'italic' : undefined, marginTop: gap }}>{children}</div>
);

// ───────────── 장면들 ─────────────
const Y_A = 540;
const Y_B = 1112;

/** 지어 넣은 후기 셋(A2 원문 — 긴 문장은 뒤쪽만 「…」). 작성자 줄이 차례로 테를 받는다. */
const FAKE: [string, string][] = [
  ['“겉은 바삭하고 속은 정말 부드러워요. …”', '— 동네 단골손님'],
  ['“아침에 소금빵 하나랑 …”', '— 출근길에 들르는 손님'],
  ['“크고 화려한 빵집은 …”', '— 동네 이웃'],
];

/** 1 전후: 같은 부탁의 두 답. 0프레임부터 다 보인다(표지 노릇). still이면 테를 다 켠다. */
const Pair: React.FC<{ t: Timing; still?: boolean }> = ({ t, still }) => {
  const f = useCurrentFrame();
  const { EV } = scenes(t);
  const aOn = still ? 0 : ease(f, EV.aFocus, 8);
  const bOn = still ? 0 : ease(f, EV.bFocus, 8);
  const litA = still ? 1 : 1 - bOn;
  const litB = still ? 1 : bOn + (1 - aOn) * (1 - bOn);
  const markA = (i: number) => (still ? 1 : ease(f, EV.aMark + 5 * i, 8));
  const markB = still ? 1 : ease(f, EV.bMark, 8);
  return (
    <>
      <Answer y={Y_A} chip="그냥 부탁했을 때" lit={litA}>
        {/* Fable 사실 검수 1: 안내 줄은 자르지 않고 두 문장 다(뒷문장이 AI가 「교체하라」고 쓴 자리) */}
        <Row size={32} weight={520} color={MUTED} italic>
          아래 후기는 홈페이지 구성용 예시입니다. 실제 손님들의 후기로 교체해 주세요.
        </Row>
        {FAKE.map(([q, who], i) => (
          <React.Fragment key={i}>
            <Row size={42} gap={i === 0 ? 6 : 8}>
              {q}
            </Row>
            <Row size={38} weight={650} color="#CFCCC4">
              <Mark p={markA(i)}>{who}</Mark>
            </Row>
          </React.Fragment>
        ))}
      </Answer>
      <Answer y={Y_B} chip="한 줄 붙였을 때" butter lit={litB}>
        <Row size={42} weight={760}>
          고객 후기 01
        </Row>
        <Row size={46} gap={4}>
          <Mark p={markB}>[빈칸]</Mark>
        </Row>
        <Row size={38} weight={650} color="#CFCCC4" gap={4}>
          — 작성자: [빈칸] / 작성일: [빈칸]
        </Row>
      </Answer>
    </>
  );
};

/** 붙인 한 줄의 낱말([빈칸]으로는 버터). 줄 나눔은 화면 폭에 맞춘 것. */
const LINE_TOKENS: [string, boolean][][] = [
  [['단,', false], ['모르는', false], ['숫자', false], ['·', false]],
  [['후기', false], ['·', false], ['이름은', false]],
  [['지어내지', false], ['말고', false]],
  [['[빈칸]으로', true], ['남겨', false], ['줘.', false]],
];
/** 목소리 낱말(「단,」부터) 순번 → 화면 낱말 순번. 「·」는 소리가 없어 앞 낱말과 같이 밝아진다. */
const SPOKEN_OF_TOKEN = (() => {
  const out: number[] = [];
  let k = -1;
  for (const row of LINE_TOKENS) for (const [w] of row) out.push(w === '·' ? Math.max(0, k) : ++k);
  return out;
})();
/** 한 줄 글: lit(k)가 그 낱말(목소리 순번 k)이 밝아지는 정도. */
const LineText: React.FC<{ size: number; lit: (k: number) => number }> = ({ size, lit }) => {
  let n = 0;
  return (
    <>
      {LINE_TOKENS.map((row, r) => (
        <div key={r} style={{ fontFamily: KO, fontWeight: 780, fontSize: size, lineHeight: 1.24, letterSpacing: '-0.035em', whiteSpace: 'nowrap' }}>
          {row.map(([w, accent], i) => {
            const p = lit(SPOKEN_OF_TOKEN[n++]);
            return (
              <span key={i} style={{ color: interpolateColors(p, [0, 1], [UNLIT, accent ? BUTTER : INK]) }}>
                {i > 0 ? ' ' : ''}
                {w}
              </span>
            );
          })}
        </div>
      ))}
    </>
  );
};

/** 2 한 줄: 「한 줄 붙였을 때」의 실제 부탁 말풍선 — 첫 줄 · 「…」 · 맨 끝에 붙인 한 줄. 읽는 낱말마다 밝아진다. */
const LineScene: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const { SC } = scenes(t);
  const k0 = idx('r1', '단');
  const box = ease(f, wd('r1', k0, t) - 4, 8);
  return (
    <div style={{ position: 'absolute', right: 1080 - RIGHT, top: 580, width: PW, opacity: ease(f, SC.line + 2, 10) }}>
      <div style={{ padding: '30px 38px 36px', borderRadius: 32, background: BUBBLE, fontFamily: KO, fontWeight: 560, fontSize: 44, lineHeight: 1.36, letterSpacing: '-0.02em', color: MUTED, wordBreak: 'keep-all' }}>
        동네에서 작은 빵집을 해. … 홈페이지에 들어갈 글 써 줘. 소개, 대표 메뉴, 손님 후기까지.
        <div style={{ marginTop: 22, marginLeft: -16, marginRight: -16, padding: '14px 16px 18px', borderRadius: 18, boxShadow: `inset 0 0 0 ${5 * box}px ${BUTTER}`, background: `rgba(245,196,69,${0.08 * box})` }}>
          <LineText size={68} lit={(k) => ease(f, wd('r1', k0 + k, t) - 2, 12)} />
        </div>
      </div>
    </div>
  );
};

/** 3 다른 빈칸: 「한 줄 붙였을 때」 답의 다른 자리(B2 원문 — 메뉴 칸과 오시는 길 칸 사이는 「…」). */
const Blanks: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const { EV } = scenes(t);
  const row = (label: string, rest: string, p: number) => (
    <Row size={54} weight={700} gap={18}>
      {label}:{'  '}
      <Mark p={p}>[빈칸]</Mark>
      {rest}
    </Row>
  );
  return (
    <Answer y={640} chip="한 줄 붙였을 때" butter>
      {row('판매 가격', '원', ease(f, EV.price, 8))}
      <Row size={44} color={MUTED} gap={14}>
        …
      </Row>
      {row('매장 이름', '', ease(f, EV.name, 8))}
      {row('주소', '', ease(f, EV.name + 6, 8))}
      {row('영업시간', '', ease(f, EV.hours, 8))}
    </Answer>
  );
};

/** 4 끝: 그 한 줄만 크게(다 밝힌 채) + 「부탁 맨 끝 줄에 그대로」. */
const Cta: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const { SC, EV } = scenes(t);
  const p = ease(f, SC.cta + 8, 10); // 이해 시험 둘 「20초 글자 겹침」 — 앞 장면이 빠진 뒤에
  return (
    <>
      <div style={{ position: 'absolute', left: PX, top: 600, width: PW, opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
        <div style={{ position: 'relative', paddingLeft: 44 }}>
          <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 10, borderRadius: 5, background: BUTTER }} />
          <LineText size={84} lit={() => 1} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: PX + 44, top: 1060, fontFamily: KO, fontWeight: 700, fontSize: 56, letterSpacing: '-0.02em', color: '#D9D6CE', opacity: ease(f, EV.ctaMark, 8), transform: `translateY(${(1 - ease(f, EV.ctaMark, 8)) * 10}px)` }}>
        부탁 맨 끝 줄에 그대로
      </div>
    </>
  );
};

const Heads: React.FC<{ t: Timing }> = ({ t }) => {
  const { SC, EV, cta } = scenes(t);
  const where = t.cut === 'yt' ? '고정 댓글에' : '아래 글에';
  return (
    <>
      <Line lines={["AI한테 '후기까지 써 줘'", '했더니']} accent="후기까지" at={0} until={EV.aFocus} />
      <Line lines={['아무도 안 쓴 후기를', '지어 넣었어요']} accent="지어 넣었어요" at={EV.aFocus} until={EV.bFocus} />
      <Line lines={['한 줄 붙였더니', '빈칸으로 남겨요']} accent="빈칸" at={EV.bFocus} until={SC.line} />
      <Line lines={['부탁 맨 끝에', '이 한 줄']} accent="이 한 줄" at={t.vo.r1 - 3} until={SC.blank} />
      <Line lines={['가게 이름 · 가격도', '빈칸으로']} accent="빈칸" at={t.vo.b1 - 3} until={SC.cta} />
      <Line lines={['이 한 줄은', where]} accent={where} at={t.vo[cta] - 3} until={t.end} />
    </>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (t: Timing): Hit[] => {
  const { SC, EV } = scenes(t);
  return [
    ...[0, 1, 2].map((i) => ({ at: EV.aMark + 5 * i, src: 'sfx/tick.wav', v: 0.13 })),
    { at: EV.bFocus, src: 'sfx/tick2.wav', v: 0.14 },
    { at: EV.bMark, src: 'sfx/snap.wav', v: 0.15 },
    ...[SC.line, SC.blank, SC.cta].map((a) => ({ at: a - 2, src: 'sfx/swish.wav', v: 0.15 })),
    { at: SC.line + 2, src: 'sfx/snap.wav', v: 0.14 },
    { at: EV.name, src: 'sfx/tick.wav', v: 0.14 },
    { at: EV.price, src: 'sfx/tick.wav', v: 0.14 },
    { at: EV.hours, src: 'sfx/tick2.wav', v: 0.14 },
    { at: EV.ctaMark, src: 'sfx/tick.wav', v: 0.14 },
    { at: t.end, src: 'sfx/swish.wav', v: 0.18 },
    { at: endFollow(t), src: 'sfx/tok.wav', v: 0.42 },
  ];
};

// ───────────── 본편 ─────────────
export const ReviewFilm: React.FC<{ cut: Cut; bgm?: boolean }> = ({ cut, bgm = true }) => {
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
  const { SC } = scenes(t);
  if (f >= t.end + 8) return null;
  const gone = ease(f, t.end, 8);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone }}>
      <Scene a={0} b={SC.line} drift={0.25}>
        <Pair t={t} />
      </Scene>
      <Scene a={SC.line} b={SC.blank}>
        <LineScene t={t} />
      </Scene>
      <Scene a={SC.blank} b={SC.cta}>
        <Blanks t={t} />
      </Scene>
      <Scene a={SC.cta} b={t.end}>
        <Cta t={t} />
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

/** 표지: 0초 장면 그대로(머리글 + 두 답) — 테를 다 켠 전후 비교. */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <Line lines={["AI한테 '후기까지 써 줘'", '했더니']} accent="후기까지" at={0} />
    <Pair t={TIMING.main} still />
  </AbsoluteFill>
);
