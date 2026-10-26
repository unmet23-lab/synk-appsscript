// yuhobuilds 「AI한테 '써서 올려 줘' 했더니 — 꼭 붙일 한 줄」(10-27, 장부 Y9 다시 살림 v2). 기획 · 콘티는 ../../../기획.md.
// 문법은 만족 사례 S22(검정 무대 · 흰 글 · 버터 한 곳, 머리글이 곧 내레이션)와 첫 판(../y9) 그대로.
//  · 판 안은 모두 10-27 ego에서 휴대폰 폭(430 CSS px, 가로 1080px)으로 찍은 claude.ai 시크릿 채팅 실제 화면을 자른 것(../../../자료/채팅실험/).
//    A = 한 줄 없이 · B = 한 줄 붙여서(새 대화) · B 승인 = 같은 B 대화에 「승인」. 자른 판의 자리 값은 그 판의 px(가로 980 · 840).
//  · 첫 판이 떨어진 자리(우리 검토 페이지 · 휴대폰 틀 안 작은 글씨)를 피해, 누구나 아는 채팅창 조각만 크게 · 꼬리표로 두 대화를 가른다.
//  · 버터는 AI가 한 일(올리기 · 기다림 · 그때 올림)과 붙인 한 줄에만.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, INK, STAGE } from '../film/parts';
import { KO } from '../lib/fonts';
import { clamp } from '../lib/motion';
import { ease, EASE_MOVE, Line } from '../y9/Type';
import { EndCard, endFollow } from './End';
import { at, lineEnd, TIMING, VO, type Cut, type Timing } from './time';

const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)
const FRAME = '#3A3833';
const MUTED = '#8E8B84';

// ───────────── 실제 화면 조각(자료/채팅실험/*.jpg, px) ─────────────
type R = { x: number; y: number; w: number; h: number };
const r = (x0: number, y0: number, x1: number, y1: number): R => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
const SHOT = {
  aAsk: { src: 'chat/A_부탁말풍선.jpg', w: 840, h: 355 }, // 이해 시험 1회: 파일 카드(.py · PY)가 개발 화면으로 읽혀 말풍선만
  aReply: { src: 'chat/A_답.jpg', w: 980, h: 1360 },
  bAsk: { src: 'chat/B_부탁말풍선.jpg', w: 840, h: 415 },
  bReply: { src: 'chat/B_답.jpg', w: 980, h: 1380 },
  bOk: { src: 'chat/B_승인.jpg', w: 980, h: 900 },
} as const;
type ShotKey = keyof typeof SHOT;
// 버터 테 자리(그 조각의 px)
const HL = {
  aFirst: r(14, 12, 936, 140), // 「먼저 글을 파일로 만들고, 첨부해 주신 스크립트로 올려 볼게요.」
  aPosted1: r(752, 276, 936, 338), // 「"인스타에
  aPosted2: r(14, 338, 186, 398), //  올렸어요"」
  aRunText: r(14, 176, 284, 244), // 「명령 실행함」
  aNot1: r(424, 338, 966, 398), // 「다만 실제 인스타그램에는 올
  aNot2: r(14, 398, 930, 458), //  라가지 않았습니다. 이 파일은 이름 그대로 연습용이라,」
  bLine: r(50, 286, 792, 364), // 「단, 내가 「승인」이라고 하기 전엔 올리지 마.」(말풍선 조각 기준)
  bDraft: r(14, 20, 826, 100), // 「오늘 올릴 글 초안이에요. 아직 올리지 않았어요.」
  bWait: r(14, 970, 966, 1156), // 「… 마음에 드시면 「승인」이라고 해 주시면 … 올릴게요.」
  bOk: r(800, 40, 966, 170), // 「승인」 말풍선
  bRunText: r(14, 256, 558, 320), // 「명령 2개 실행함, 파일 공유함」
  bDone: r(14, 358, 806, 426), // 「승인해 주신 글을 인스타_올리기.py로 올렸어요.」
} satisfies Record<string, R>;

const PX = 72;
const PW = 936;
const PY = 660;

// ───────────── 장면 · 사건 ─────────────
const SC = {
  aReply: VO.h2 - 4, // A 부탁 → A 답(h2 · h3)
  bAsk: VO.r1 - 6, // B 부탁(한 줄)
  line: VO.r2 - 4, // 큰 한 줄
  bReply: VO.b1 - 6, // B 답(기다림)
  bOk: VO.b2 - 6, // 승인
  cta: VO.c1 - 6,
};
const EV = {
  aFile: 10,
  aFirst: at('h2', '보여') - 2,
  aRun: at('h2', '올리기부터') - 2, // 「명령 실행함」 옆 꼬리표
  aPosted: at('h2', '버렸어요') - 2,
  aNot: VO.h3 + 2, // 「다만 실제 인스타그램에는 올라가지 않았습니다 …」 — 이해 시험 1회: 「올렸다」와 어긋나 보였다
  bLine: at('r1', '줄을') - 2,
  bDraft: VO.b1 + 2,
  bScroll: at('b1', '아직') - 4,
  bRun: VO.b2 + 14, // 「명령 2개 실행함」 옆 꼬리표
  bWait: at('b1', '기다려요') - 4,
  bOk: VO.b2 + 2,
  bDone: at('b2', '그때') - 2,
  ctaSub: at('c1', '줄') - 2,
};

/** 장면 하나: a에 아래에서 올라와 들어오고 b에 위로 빠진다(8프레임 겹침). 그사이 천천히 밀린다. */
const Scene: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b + 8) return null;
  const pin = a <= 0 ? 1 : ease(f, a, 9);
  const pout = ease(f, b, 8, EASE_MOVE);
  const k = f - Math.max(0, a);
  const s = 1 + Math.min(0.05, 0.0006 * k);
  const dy = 0.45 * k; // 장면 내내 천천히 내려온다 — 올리기 전 검사 ②(거의 멈춘 시간 20% → 15% 이하)
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 46 - pout * 46 + dy}px) scale(${s})`, transformOrigin: '50% 55%' }}>{children}</div>
  );
};

/** 꼬리표: A는 어두운 칩, B는 버터 칩(우리 덧붙임 — 앱 화면의 일부가 아님). */
const Chip: React.FC<{ text: string; butter?: boolean; x?: number; y?: number; size?: number; p?: number }> = ({ text, butter, x = PX, y = PY - 76, size = 38, p = 1 }) =>
  p <= 0 ? null : (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        padding: '10px 24px 12px',
        borderRadius: 16,
        background: butter ? BUTTER : '#2A2926',
        boxShadow: butter ? '0 6px 18px rgba(0,0,0,0.45)' : 'inset 0 0 0 2px #4A4842',
        fontFamily: KO,
        fontWeight: 760,
        fontSize: size,
        letterSpacing: '-0.02em',
        color: butter ? '#121211' : INK,
        whiteSpace: 'nowrap',
        opacity: p,
        transform: `translateY(${(1 - p) * 10}px)`,
      }}
    >
      {text}
    </div>
  );

type Mark = { box: R; at: number; plain?: boolean };
/** 실제 화면 조각 판: 가로 PW로 맞추고, 창 높이 wh만큼 보인다. scroll(조각 px)로 아래를 올려 보이고, marks에 버터 테를 친다.
 *  이해 시험 2회(4점 · 「4~10초 작은 글자가 빽빽하게 멈춰 있어 넘길 수도」) → 창은 필요한 줄만 짧게, 첫 테가 들어오면 테 밖을 어둡게 눌러
 *  짚는 줄만 도드라지게(plain은 테 없이 밝히기만 — 꼬리표가 가리키는 앱 글). */
const ShotPanel: React.FC<{ k: ShotKey; wh?: number; scroll?: number; marks?: Mark[]; y?: number }> = ({ k, wh, scroll = 0, marks = [], y = PY }) => {
  const f = useCurrentFrame();
  const s = SHOT[k];
  const kk = PW / s.w;
  const H = wh ?? s.h * kk;
  const ps = marks.map((m) => ease(f, m.at, 8));
  const dim = 0.6 * Math.max(0, ...ps);
  const id = `spot-${k}`;
  return (
    <div style={{ position: 'absolute', left: PX, top: y, width: PW, height: H }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 28, overflow: 'hidden', background: '#1F1F1D', boxShadow: `0 0 0 2px ${FRAME}, 0 18px 40px rgba(0,0,0,0.5)` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: s.w, height: s.h, transformOrigin: '0 0', transform: `scale(${kk}) translateY(${-scroll}px)` }}>
          <Img src={staticFile(s.src)} style={{ position: 'absolute', left: 0, top: 0, width: s.w, height: s.h }} />
          {dim > 0 ? (
            <svg width={s.w} height={s.h} style={{ position: 'absolute', left: 0, top: 0 }}>
              <defs>
                <mask id={id}>
                  <rect x={0} y={0} width={s.w} height={s.h} fill="white" />
                  {marks.map((m, i) => (ps[i] > 0 ? <rect key={i} x={m.box.x} y={m.box.y} width={m.box.w} height={m.box.h} rx={14 / kk} fill="black" fillOpacity={ps[i]} /> : null))}
                </mask>
              </defs>
              <rect x={0} y={0} width={s.w} height={s.h} fill="#0A0A0A" fillOpacity={dim} mask={`url(#${id})`} />
            </svg>
          ) : null}
          {marks.map((m, i) => {
            const p = ps[i];
            if (p <= 0 || m.plain) return null;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: m.box.x,
                  top: m.box.y,
                  width: m.box.w,
                  height: m.box.h,
                  borderRadius: 14 / kk,
                  border: `${5.5 / kk}px solid ${BUTTER}`,
                  background: 'rgba(245,196,69,0.08)',
                  opacity: p,
                  transform: `scale(${1.06 - 0.06 * p})`,
                  transformOrigin: '50% 50%',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** 판 아래 「크게 옮긴 말」 — 판 속 AI 답의 핵심 말을 그대로 크게(최종본 1회: 「4~10초 작은 글씨 로그뿐」). items는 [시작 프레임, 머리표, 글]. */
const Excerpt: React.FC<{ y: number; items: [number, string, string][] }> = ({ y, items }) => {
  const f = useCurrentFrame();
  return (
    <>
      {items.map(([a, label, text], i) => {
        const b = items[i + 1]?.[0] ?? Infinity;
        if (f < a || f >= b + 6) return null;
        const pin = ease(f, a, 8);
        const pout = Number.isFinite(b) ? ease(f, b, 6) : 0;
        return (
          <div key={i} style={{ position: 'absolute', left: PX, top: y, width: 870, opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 14 - pout * 10}px)` }}>
            <div style={{ display: 'inline-block', padding: '20px 30px 24px', borderRadius: 24, background: '#161614', boxShadow: `0 0 0 3px ${BUTTER}, 0 14px 30px rgba(0,0,0,0.5)` }}>
              <div style={{ fontFamily: KO, fontWeight: 650, fontSize: 30, letterSpacing: '-0.01em', color: MUTED, marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: KO, fontWeight: 720, fontSize: 52, lineHeight: 1.22, letterSpacing: '-0.03em', color: INK, wordBreak: 'keep-all' }}>{text}</div>
            </div>
          </div>
        );
      })}
    </>
  );
};

/** 붙인 한 줄을 크게(4 · 7장면). */
const BigLine: React.FC<{ y: number; p: number; grow?: number }> = ({ y, p, grow = 1 }) => (
  <div style={{ position: 'absolute', left: PX, top: y, width: PW, opacity: p, transform: `translateY(${(1 - p) * 18}px) scale(${grow})`, transformOrigin: '0% 50%' }}>
    <div style={{ position: 'absolute', left: 0, top: 6, width: 10, height: 236, borderRadius: 5, background: BUTTER }} />
    <div style={{ marginLeft: 46, fontFamily: KO, fontWeight: 780, fontSize: 96, lineHeight: 1.18, letterSpacing: '-0.04em', color: INK }}>
      <div style={{ whiteSpace: 'nowrap' }}>
        내가 <span style={{ color: BUTTER }}>'승인'</span>이라고
      </div>
      <div style={{ whiteSpace: 'nowrap' }}>하기 전엔 올리지 마</div>
    </div>
  </div>
);

// ───────────── 장면들 ─────────────
const AAsk: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      <Chip text="한 줄 없이" />
      <ShotPanel k="aAsk" />
      {/* 붙인 파일 꼬리표 — 실제 인스타가 아니라는 것이 처음부터 보이게(파일 카드 자체는 개발 화면으로 읽혀 잘랐다) */}
      <Chip text="＋ 가짜 올리기 파일(시험용)" x={PX} y={PY + 355 * (PW / 840) + 26} size={36} p={ease(f, EV.aFile, 9)} />
    </>
  );
};

const K_REPLY = PW / 980;
// A 답 판은 첫 네 줄(「먼저 … 올려 볼게요」 · 「명령 실행함」 · 「"인스타에 올렸어요"라고 출력했어요. 다만 실제 인스타그램에는 올」)까지만 —
// 최종본 2회: 로그 같은 줄이 빽빽하다 → 나머지(연습용 설명)는 판 아래 크게 옮긴 말로 보인다.
const A_ROWS = 404;
const AReply: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      <Chip text="한 줄 없이" />
      <ShotPanel
        k="aReply"
        wh={A_ROWS * K_REPLY}
        marks={[
          { box: HL.aFirst, at: EV.aFirst },
          { box: HL.aRunText, at: EV.aRun, plain: true },
          { box: HL.aPosted1, at: EV.aPosted },
          { box: HL.aPosted2, at: EV.aPosted },
          { box: HL.aNot1, at: EV.aNot },
          { box: HL.aNot2, at: EV.aNot },
        ]}
      />
      <Excerpt
        y={PY + A_ROWS * K_REPLY + 34}
        items={[
          [EV.aFirst, 'AI 답', '「먼저 … 올려 볼게요.」'],
          [EV.aPosted, '올리기 결과', '「인스타에 올렸어요」'],
          [EV.aNot, 'AI 답', '「실제 인스타그램에는 올라가지 않았습니다」'],
        ]}
      />
      {/* 「명령 실행함」(앱 글) 옆 우리 꼬리표 — 이해 시험 1회: 무슨 뜻인지 모름 */}
      <Chip text="= 올리기 실행" butter x={PX + 292 * K_REPLY} y={PY + 182 * K_REPLY - 6} size={34} p={ease(f, EV.aRun, 8)} />
    </>
  );
};

const BAsk: React.FC = () => (
  <>
    <Chip text="한 줄 붙여서" butter />
    <ShotPanel k="bAsk" marks={[{ box: HL.bLine, at: EV.bLine }]} />
  </>
);

const LineScene: React.FC = () => {
  const f = useCurrentFrame();
  return <BigLine y={820} p={ease(f, SC.line + 2, 10)} grow={1 + 0.0012 * Math.max(0, f - SC.line)} />;
};

const BReply: React.FC = () => {
  const f = useCurrentFrame();
  // 「승인」이라고 해 주시면 … 올릴게요 줄이 오른쪽 아래 앱 단추 자리(y 1150~)에 안 걸리게 높이 올린다
  const sc = 925 * ease(f, EV.bScroll, 22, EASE_MOVE);
  return (
    <>
      <Chip text="한 줄 붙여서" butter />
      <ShotPanel
        k="bReply"
        wh={470 * K_REPLY}
        scroll={sc}
        marks={[
          { box: HL.bDraft, at: EV.bDraft },
          { box: HL.bWait, at: EV.bWait },
        ]}
      />
    </>
  );
};

const BOk: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      <Chip text="한 줄 붙여서" butter />
      <ShotPanel
        k="bOk"
        marks={[
          { box: HL.bOk, at: EV.bOk },
          { box: HL.bDone, at: EV.bDone },
        ]}
      />
      <Chip text="= 이때 올리기 실행" butter x={PX + 566 * K_REPLY} y={PY + 262 * K_REPLY - 6} size={34} p={ease(f, EV.bRun, 8)} />
    </>
  );
};

const CtaScene: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, EV.ctaSub, 9);
  return (
    <>
      <BigLine y={760} p={ease(f, SC.cta + 2, 10)} grow={1 + 0.0012 * Math.max(0, f - SC.cta)} />
      <div style={{ position: 'absolute', left: PX + 46, top: 1060, fontFamily: KO, fontWeight: 650, fontSize: 46, letterSpacing: '-0.02em', color: MUTED, opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
        부탁 맨 끝 줄에 그대로 붙이세요
      </div>
    </>
  );
};

const Heads: React.FC<{ t: Timing }> = ({ t }) => (
  <>
    <Line lines={["AI한테 '써서 올려 줘'", '했더니']} accent="올려 줘" at={0} until={VO.h2 - 3} />
    <Line lines={['보여 주기도 전에', '올리기부터 했어요']} accent="올리기부터" at={VO.h2 - 3} until={VO.h3 - 3} />
    <Line lines={['진짜였으면', '그대로 올라감']} accent="그대로 올라감" at={VO.h3 - 3} until={SC.bAsk} />
    <Line lines={['그래서 부탁 끝에', '한 줄을 붙였어요']} accent="한 줄" at={VO.r1 - 3} until={SC.bReply} />
    <Line lines={['글만 보여 주고', '기다려요']} accent="기다려요" at={VO.b1 - 3} until={SC.bOk} />
    <Line lines={["'승인' 하니까", '그때 올렸어요']} accent="승인" at={VO.b2 - 3} until={SC.cta} />
    <Line lines={['AI한테 올리기까지', '맡길 땐']} accent="올리기까지" at={VO.c1 - 3} until={t.end} />
  </>
);

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (t: Timing): Hit[] => [
  { at: EV.aFile, src: 'sfx/tick.wav', v: 0.12 },
  { at: SC.aReply - 2, src: 'sfx/swish.wav', v: 0.14 },
  { at: EV.aFirst, src: 'sfx/tick.wav', v: 0.14 },
  { at: EV.aRun, src: 'sfx/tick2.wav', v: 0.14 },
  { at: EV.aNot, src: 'sfx/tick.wav', v: 0.14 },
  { at: EV.aPosted, src: 'sfx/thud.wav', v: 0.3 },
  ...[SC.bAsk, SC.bReply, SC.bOk, SC.cta].map((a) => ({ at: a - 2, src: 'sfx/swish.wav', v: 0.15 })),
  { at: EV.bLine, src: 'sfx/tick2.wav', v: 0.16 },
  { at: SC.line, src: 'sfx/snap.wav', v: 0.16 },
  { at: EV.bDraft, src: 'sfx/tick.wav', v: 0.14 },
  { at: EV.bWait, src: 'sfx/tick.wav', v: 0.14 },
  { at: EV.bOk, src: 'sfx/tok.wav', v: 0.32 },
  { at: EV.bRun, src: 'sfx/tick2.wav', v: 0.12 },
  { at: EV.bDone, src: 'sfx/tick2.wav', v: 0.16 },
  { at: t.end, src: 'sfx/swish.wav', v: 0.18 },
  { at: endFollow(t), src: 'sfx/tok.wav', v: 0.42 },
];

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
          <Audio src={staticFile(`vo2/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {hits(t).map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile(`bgm_v2.wav`)} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

const Stage: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  if (f >= t.end + 8) return null;
  const gone = ease(f, t.end, 8);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone }}>
      <Scene a={0} b={SC.aReply}>
        <AAsk />
      </Scene>
      <Scene a={SC.aReply} b={SC.bAsk}>
        <AReply />
      </Scene>
      <Scene a={SC.bAsk} b={SC.line}>
        <BAsk />
      </Scene>
      <Scene a={SC.line} b={SC.bReply}>
        <LineScene />
      </Scene>
      <Scene a={SC.bReply} b={SC.bOk}>
        <BReply />
      </Scene>
      <Scene a={SC.bOk} b={SC.cta}>
        <BOk />
      </Scene>
      <Scene a={SC.cta} b={t.end}>
        <CtaScene />
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

/** 표지: 머리글(약속) + A의 답 — 글을 보여 주기 전에 올린 자리에 버터 테. 아래 작은 줄이 답. */
export const CoverStill2: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: PX, top: 300, fontFamily: KO, fontWeight: 760, fontSize: 84, lineHeight: 1.12, letterSpacing: '-0.035em', color: INK }}>
      <div>AI한테 '써서</div>
      <div>
        <span style={{ color: BUTTER }}>올려 줘'</span> 했더니
      </div>
    </div>
    <Chip text="한 줄 없이" />
    <ShotPanel
      k="aReply"
      wh={600}
      marks={[
        { box: HL.aFirst, at: -20 },
        { box: HL.aPosted1, at: -20 },
        { box: HL.aPosted2, at: -20 },
      ]}
    />
    <div style={{ position: 'absolute', left: PX, top: PY + 640, fontFamily: KO, fontWeight: 700, fontSize: 50, letterSpacing: '-0.025em', color: '#D9D6CE' }}>
      보여 주기도 전에 <span style={{ color: BUTTER }}>올리기부터</span>
    </div>
  </AbsoluteFill>
);
