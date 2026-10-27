// yuhobuilds 「AI한테 '써서 올려 줘' 했더니 — 붙이면 기다리는 한 줄」(10-27, 장부 Y9 새 꼴로 다시 v3). 기획 · 콘티는 ../../../기획.md 맨 위 v3 절.
// 제작 절차 「synkbrief · yuhobuilds 편」(10-27): 0초에 전후 결과 → 그 한 줄을 크게 → 끝 「아래 글에」. 문법은 만족 사례 S22(검정 무대 · 흰 글 · 버터 한 곳, 머리글이 곧 내레이션).
//  · 판은 스크린숏을 깔지 않고 v2 「실험」의 claude.ai 시크릿 채팅(../../../자료/채팅실험/*.txt)을 크게 다시 짠 것 — 말풍선 · 답의 글자는 실제 그대로,
//    파일 · 스크립트 이야기가 든 자리만 「…」로 줄였다(v2가 떨어진 자리: 「명령 실행함」 · 「.py」 · 「실제로는 안 올라감」이 한 화면에 겹침).
//  · 색은 그 화면에서 잰 값(판 #191919 · 내 말풍선 #252525). 버터는 AI가 한 일(올리기 · 기다림 · 그때 올림)과 붙인 한 줄에만.
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
    ok: t.vo.b1 - 6, // 승인
    cta: t.vo[cta] - 6,
  };
  const EV = {
    aFocus: at('h1', '보여', t) - 3, // 「그냥 부탁했을 때」 답만 밝게
    aMark: at('h1', '올리겠대요', t) - 2,
    bFocus: t.vo.h2 - 2, // 「한 줄 붙였을 때」 답만 밝게
    bMark: at('h2', '아직', t) - 2,
    okBubble: t.vo.b1 + 3,
    okDone: at('b1', '그때', t) - 2,
    ctaMark: at(cta, '맨', t) - 2,
  };
  return { SC, EV, cta };
};

/** 장면 하나: a에 아래에서 올라와 들어오고 b에 위로 빠진다(8프레임 겹침). 그사이 천천히 밀린다(올리기 전 검사 ② 정지 구간). */
const Scene: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b + 8) return null;
  const pin = a <= 0 ? 1 : ease(f, a, 9);
  const pout = ease(f, b, 8, EASE_MOVE);
  const k = f - Math.max(0, a);
  // 올리기 전 검사 ②(첫 마감 22%): 상한을 두면 4초 뒤 멈춘 화면이 된다 — 장면 끝까지 같은 빠르기로 천천히
  const s = 1 + 0.00015 * k;
  const dy = 0.4 * k; // 0.22는 270px 축소 판에서 움직임으로 안 잡혔다(한 줄 장면 9~12초 정지)
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 46 - pout * 46 + dy}px) scale(${s})`, transformOrigin: '50% 50%' }}>{children}</div>
  );
};

/** 꼬리표(우리 덧붙임 — 앱 화면의 일부가 아님). */
const Chip: React.FC<{ text: string; butter?: boolean; size?: number }> = ({ text, butter, size = 42 }) => ( // 최종본 시험 1: 꼬리표가 작다 34 → 42
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

/** 내 말풍선(오른쪽 붙음). */
const Bubble: React.FC<{ y: number; size?: number; p?: number; children: React.ReactNode }> = ({ y, size = 46, p = 1, children }) =>
  p <= 0 ? null : (
    <div style={{ position: 'absolute', right: 1080 - RIGHT, top: y, maxWidth: PW, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <div style={{ padding: '22px 34px 26px', borderRadius: 30, background: BUBBLE, fontFamily: KO, fontWeight: 560, fontSize: size, lineHeight: 1.36, letterSpacing: '-0.02em', color: AI_INK, wordBreak: 'keep-all' }}>{children}</div>
    </div>
  );

/** AI 답 판: 왼쪽 붙음, 꼬리표 + 답 글. lit이 0이면 어둡게 눌린다(짚는 판만 도드라지게 — v2 이해 시험 2회). */
const Answer: React.FC<{ y: number; chip: string; butter?: boolean; lit?: number; size?: number; children: React.ReactNode }> = ({ y, chip, butter, lit = 1, size = 60, children }) => (
  <div style={{ position: 'absolute', left: PX, top: y, width: PW }}>
    <div style={{ position: 'relative', padding: '26px 34px 34px', borderRadius: 30, background: CHAT_BG, boxShadow: `0 0 0 2px ${FRAME}, 0 18px 40px rgba(0,0,0,0.5)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
        <Chip text={chip} butter={butter} />
        <span style={{ fontFamily: KO, fontWeight: 650, fontSize: 36, color: MUTED, letterSpacing: '-0.01em' }}>AI 답</span>
      </div>
      <div style={{ fontFamily: KO, fontWeight: 600, fontSize: size, lineHeight: 1.34, letterSpacing: '-0.025em', color: AI_INK, wordBreak: 'keep-all' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: '#0A0A0A', opacity: 0.62 * (1 - lit), pointerEvents: 'none' }} />
    </div>
  </div>
);

// ───────────── 장면들 ─────────────
// 첫 렌더 이해 시험(3점) 뒤: 0초 판의 부탁 말풍선을 빼고 두 답을 크게(머리글이 곧 부탁), 꼬리표는 뜻이 바로 읽히게 「그냥 부탁했을 때 · 한 줄 붙였을 때」,
// 한 줄은 부탁 말풍선 맨 끝에 붙는 모습으로(「어디에 붙이는지」), 끝은 그 한 줄만 크게.
const Y_A = 590;
const Y_B = 896;

/** 1 전후: 같은 부탁의 두 답. 0프레임부터 다 보인다(표지 노릇). still이면 두 테를 다 켠다. */
const Pair: React.FC<{ t: Timing; still?: boolean }> = ({ t, still }) => {
  const f = useCurrentFrame();
  const { EV } = scenes(t);
  const aOn = still ? 0 : ease(f, EV.aFocus, 8);
  const bOn = still ? 0 : ease(f, EV.bFocus, 8);
  const litA = still ? 1 : 1 - bOn;
  const litB = still ? 1 : bOn + (1 - aOn) * (1 - bOn);
  return (
    <>
      <Answer y={Y_A} chip="그냥 부탁했을 때" lit={litA} size={66}>
        먼저 글을 … <Mark p={still ? 1 : ease(f, EV.aMark, 8)}>올려 볼게요.</Mark>
      </Answer>
      <Answer y={Y_B} chip="한 줄 붙였을 때" butter lit={litB} size={66}>
        오늘 올릴 글 초안이에요.
        <br />
        <Mark p={still ? 1 : ease(f, EV.bMark, 8)}>아직 올리지 않았어요.</Mark>
      </Answer>
    </>
  );
};

/** 붙인 한 줄의 낱말(「승인」이라고는 버터). */
const LINE_TOKENS: [string, boolean][][] = [
  [['단,', false], ['내가', false], ['「승인」이라고', true]],
  [['하기', false], ['전엔', false], ['올리지', false], ['마.', false]],
];
/** 한 줄 글: lit(k)가 그 낱말이 밝아지는 정도. */
const LineText: React.FC<{ size: number; lit: (k: number) => number }> = ({ size, lit }) => {
  let n = 0;
  return (
    <>
      {LINE_TOKENS.map((row, r) => (
        <div key={r} style={{ fontFamily: KO, fontWeight: 780, fontSize: size, lineHeight: 1.24, letterSpacing: '-0.035em', whiteSpace: 'nowrap' }}>
          {row.map(([w, accent], i) => {
            const p = lit(n++);
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

/** 2 한 줄: 「한 줄 붙였을 때」의 실제 부탁 말풍선 — 첫 줄 · 「…」(가게 정보 · 올리기 줄) · 맨 끝에 붙인 한 줄. 읽는 낱말마다 밝아진다. */
const LineScene: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const { SC } = scenes(t);
  const k0 = idx('r1', '단');
  const box = ease(f, wd('r1', k0, t) - 4, 8);
  return (
    <div style={{ position: 'absolute', right: 1080 - RIGHT, top: 600, width: PW, opacity: ease(f, SC.line + 2, 10) }}>
      <div style={{ padding: '30px 38px 36px', borderRadius: 32, background: BUBBLE, fontFamily: KO, fontWeight: 560, fontSize: 46, lineHeight: 1.36, letterSpacing: '-0.02em', color: MUTED }}>
        우리 가게 오늘 인스타 글 하나 써서 올려 줘.
        <br />…
        <div style={{ marginTop: 22, marginLeft: -16, marginRight: -16, padding: '14px 16px 18px', borderRadius: 18, boxShadow: `inset 0 0 0 ${5 * box}px ${BUTTER}`, background: `rgba(245,196,69,${0.08 * box})` }}>
          <LineText size={64} lit={(k) => ease(f, wd('r1', k0 + k, t) - 2, 12)} />
        </div>
      </div>
    </div>
  );
};

/** 3 승인: 「한 줄 붙였을 때」 대화 이어서 — AI 안내 → 내 「승인」 → 그때 올림. */
const Approve: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const { EV } = scenes(t);
  return (
    <>
      <div style={{ position: 'absolute', left: PX, top: 560, width: PW, height: 700, borderRadius: 30, background: CHAT_BG, boxShadow: `0 0 0 2px ${FRAME}, 0 18px 40px rgba(0,0,0,0.5)` }} />
      <div style={{ position: 'absolute', left: PX + 34, top: 590 }}>
        <Chip text="한 줄 붙였을 때" butter />
      </div>
      <div style={{ position: 'absolute', left: PX + 34, top: 690, width: PW - 68, fontFamily: KO, fontWeight: 600, fontSize: 48, lineHeight: 1.36, letterSpacing: '-0.025em', color: AI_INK, wordBreak: 'keep-all' }}>
        마음에 드시면 「승인」이라고 해 주시면 … 올릴게요.
      </div>
      <Bubble y={850} size={68} p={ease(f, EV.okBubble, 6)}>
        승인
      </Bubble>
      <div style={{ position: 'absolute', left: PX + 34, top: 1060, width: PW - 68, fontFamily: KO, fontWeight: 650, fontSize: 56, lineHeight: 1.34, letterSpacing: '-0.025em', color: AI_INK, opacity: ease(f, EV.okDone - 6, 8), transform: `translateY(${(1 - ease(f, EV.okDone - 6, 8)) * 14}px)` }}>
        <Mark p={ease(f, EV.okDone, 8)}>승인해 주신 글을 … 올렸어요.</Mark>
      </div>
    </>
  );
};

/** 4 끝: 그 한 줄만 크게(다 밝힌 채) + 「부탁 맨 끝 줄에 그대로」. */
const Cta: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const { SC, EV } = scenes(t);
  const p = ease(f, SC.cta + 2, 10);
  return (
    <>
      <div style={{ position: 'absolute', left: PX, top: 650, width: PW, opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
        <div style={{ position: 'relative', paddingLeft: 44 }}>
          <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 10, borderRadius: 5, background: BUTTER }} />
          <LineText size={88} lit={() => 1} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: PX + 44, top: 920, fontFamily: KO, fontWeight: 700, fontSize: 56, letterSpacing: '-0.02em', color: '#D9D6CE', opacity: ease(f, EV.ctaMark, 8), transform: `translateY(${(1 - ease(f, EV.ctaMark, 8)) * 10}px)` }}>
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
      <Line lines={["AI한테 '써서 올려 줘'", '했더니']} accent="올려 줘" at={0} until={EV.aFocus} />
      <Line lines={['보여 주기도 전에', '먼저 올리겠대요']} accent="먼저 올리겠대요" at={EV.aFocus} until={EV.bFocus} />
      <Line lines={['한 줄 붙였더니', '기다려요']} accent="기다려요" at={EV.bFocus} until={SC.line} />
      <Line lines={['부탁 맨 끝에', '이 한 줄']} accent="이 한 줄" at={t.vo.r1 - 3} until={SC.ok} />
      <Line lines={["'승인' 했더니", '그때 올렸어요']} accent="'승인'" at={t.vo.b1 - 3} until={SC.cta} />
      <Line lines={['이 한 줄은', where]} accent={where} at={t.vo[cta] - 3} until={t.end} />
    </>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (t: Timing): Hit[] => {
  const { SC, EV } = scenes(t);
  return [
    { at: EV.aMark, src: 'sfx/thud.wav', v: 0.26 },
    { at: EV.bFocus, src: 'sfx/tick2.wav', v: 0.14 },
    { at: EV.bMark, src: 'sfx/tick.wav', v: 0.16 },
    ...[SC.line, SC.ok, SC.cta].map((a) => ({ at: a - 2, src: 'sfx/swish.wav', v: 0.15 })),
    { at: SC.line + 2, src: 'sfx/snap.wav', v: 0.14 },
    { at: EV.okBubble, src: 'sfx/tok.wav', v: 0.3 },
    { at: EV.okDone, src: 'sfx/tick2.wav', v: 0.16 },
    { at: EV.ctaMark, src: 'sfx/tick.wav', v: 0.14 },
    { at: t.end, src: 'sfx/swish.wav', v: 0.18 },
    { at: endFollow(t), src: 'sfx/tok.wav', v: 0.42 },
  ];
};

// ───────────── 본편 ─────────────
export const OneLineFilm3: React.FC<{ cut: Cut; bgm?: boolean }> = ({ cut, bgm = true }) => {
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
          <Audio src={staticFile(`vo3/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {hits(t).map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile(`bgm_v3_${cut}.wav`)} volume={bgmVolume} /> : null}
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
      <Scene a={0} b={SC.line}>
        <Pair t={t} />
      </Scene>
      <Scene a={SC.line} b={SC.ok}>
        <LineScene t={t} />
      </Scene>
      <Scene a={SC.ok} b={SC.cta}>
        <Approve t={t} />
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

/** 표지: 0초 장면 그대로(머리글 + 같은 부탁 + 두 답) — 두 테를 다 켠 전후 비교. */
export const CoverStill3: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <Line lines={["AI한테 '써서 올려 줘'", '했더니']} accent="올려 줘" at={0} />
    <Pair t={TIMING.main} still />
  </AbsoluteFill>
);
