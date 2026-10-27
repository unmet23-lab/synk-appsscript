// 다시 살림 v2(10-27) — 기획.md 「다시 살림 v2」. 첫 판(Film.tsx)이 이해 시험 세 번 3점으로 버려진 자리의 「다시 한다면」 꼴:
//  · 화면은 판 두 개뿐 — 왼쪽 실제 AI 영상(자료/실측/cat.mp4) · 오른쪽 「?원 → 9.8원」 숫자 카드. 그래프 · 걸린 시간 · 누진 단계는 글로 보낸다.
//  · 끝 행동은 댓글 하나(「몇 원일 것 같았어요?」) — 판이 하나라 모든 계정에 같은 최종본.
//  · 문법은 첫 판 그대로(S22 · 버터는 「요금」 한 뜻으로만).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, INK, STAGE } from '../film/parts';
import { KO } from '../lib/fonts';
import { clamp, mixColor } from '../lib/motion';
import { EndCard, endFollow } from './End';
import { Dot, MASTER, Wheels } from './Film';
import { at2, END_TIMING, lineEnd2, T2, VO2 } from './time2';
import { ease, EASE_MOVE, Line } from './Type';

const MUTED = '#8E8B84';
const FRAME = '#3A3833';
const CARD_BG = '#161614';

// ───────────── 자리 ─────────────
const VID = { x: 72, y: 560, w: 400, h: 700 }; // 9:16(768×1344)에 가깝게
const CARD = { x: 496, y: 560, w: 424, h: 700 }; // 오른쪽 끝 920px — 릴스 단추 자리 밖
const NUM_Y = 250; // 카드 안 숫자 줄 위치

// ───────────── 시각 ─────────────
const CLIP_LAST = 154; // 5.17초 영상의 마지막 장(30fps 기준)
const PLAY_FROM = 78; // 다시 돌 때 영상의 시작 장(하품 끝, 앞발을 뻗기 직전)
const SC = {
  gen: VO2.h2 - 4, // 「집 노트북으로」 — 영상이 처음으로 감겨 「만드는 중」
  genEnd: lineEnd2('h2') + 2, // 「재 봤어요」 끝 — 다 만듦 · 다 잼
  reveal: VO2.r3 - 16, // 「십 원도」 앞 — 바퀴가 돌기 시작
  land: VO2.r3 + 2, // 9.8원에 선다
  coin: at2('r3', '동전') - 2, // 「동전」 — 숫자 아래 10원 동전이 「보다 적어요」와 함께 선다(이해 시험 1회: 9.8원이 싼지 비싼지 기준이 없다)
  cta: VO2.cm - 6, // 끝 말 — 두 판이 댓글 상자로
};
const genP = (f: number) => interpolate(f, [SC.gen + 6, SC.genEnd], [0, 1], { ...clamp, easing: (x) => x });

// ───────────── 왼쪽: AI 영상 ─────────────
// 이해 시험 2회(10-27): 3~6초 「만드는 중」이 흐린 로딩 화면이라 넘겼고, 고양이가 방금 만든 그 영상인지 헷갈렸다 →
// 만드는 동안 같은 고양이가 잡음에서 그려져 나오고(AI가 만드는 모습), 이름표는 판 아래 큰 띠 하나에서 「만드는 중 → 다 만듦 → AI가 만든 5초 영상」으로 바뀐다.
const DRAW_FRAME = 40; // 그려져 나오는 장(하품 직전, 얼굴이 잘 보이는 장)
const clipFrame = (f: number) => {
  if (f < SC.gen) return Math.min(f, CLIP_LAST);
  if (f < SC.reveal) return DRAW_FRAME;
  return Math.min(PLAY_FROM + (f - SC.reveal), CLIP_LAST);
};

const VideoPanel: React.FC = () => {
  const f = useCurrentFrame();
  const making = f >= SC.gen && f < SC.reveal;
  const into = ease(f, SC.gen, 8);
  const p = genP(f);
  const fog = making ? into * Math.pow(1 - p, 1.15) : 0; // 1 = 잡음뿐 → 0 = 다 그려짐
  const label = making ? (p < 1 ? 'AI가 만드는 중' : 'AI가 다 만듦') : 'AI가 만든 5초 영상';
  return (
    <div style={{ position: 'absolute', left: VID.x, top: VID.y, width: VID.w, height: VID.h, borderRadius: 30, overflow: 'hidden', background: '#000', boxShadow: `inset 0 0 0 2px ${FRAME}` }}>
      <Freeze frame={clipFrame(f)}>
        <OffthreadVideo src={staticFile('clip/cat.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: fog > 0.01 ? `blur(${26 * fog}px) saturate(${1 - 0.7 * fog})` : undefined, transform: fog > 0.01 ? `scale(${1 + 0.08 * fog})` : undefined }} />
      </Freeze>
      {fog > 0.01 ? (
        <svg width={VID.w} height={VID.h} style={{ position: 'absolute', inset: 0, opacity: 0.92 * fog, mixBlendMode: 'screen' }}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={f % 97} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 98, background: 'rgba(10,10,10,0.8)' }}>
        <div style={{ position: 'absolute', left: 24, top: 0, height: 86, display: 'flex', alignItems: 'center', gap: 12, fontFamily: KO, fontWeight: 740, fontSize: 35, color: INK, letterSpacing: '-0.03em' }}>
          {making ? <Dot f={f} on={p < 1} /> : null}
          {label}
        </div>
        {making ? (
          <div style={{ position: 'absolute', left: 24, right: 24, bottom: 14, height: 8, borderRadius: 4, background: 'rgba(244,242,236,0.18)' }}>
            <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 4, background: INK }} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ───────────── 오른쪽: 숫자 카드 ─────────────
const CostCard: React.FC = () => {
  const f = useCurrentFrame();
  const p = genP(f);
  const measuring = f >= SC.gen && f < SC.reveal;
  const status = ease(f, SC.gen, 8) * (1 - ease(f, SC.reveal, 8));
  const coin = ease(f, SC.coin, 12);
  return (
    <div style={{ position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 30, background: CARD_BG, boxShadow: `inset 0 0 0 2px ${FRAME}`, overflow: 'hidden' }}>
      <CardLabel />
      <div style={{ position: 'absolute', left: 36, top: NUM_Y, height: 150, display: 'flex', alignItems: 'center' }}>
        <Cost f={f} />
      </div>
      {measuring ? (
        <div style={{ position: 'absolute', left: 36, top: NUM_Y + 190, display: 'flex', alignItems: 'center', gap: 12, opacity: status, fontFamily: KO, fontWeight: 720, fontSize: 35, color: '#D9D6CE', letterSpacing: '-0.02em' }}>
          <Dot f={f} on={p < 1} />
          {p < 1 ? '전기 재는 중' : '다 쟀어요'}
        </div>
      ) : null}
      {coin > 0 ? <Coin p={coin} /> : null}
    </div>
  );
};

/** 카드 이름 — 9.8원은 그래픽카드만 잰 값이라 이름에 그 범위를 넣는다(Fable 사실 검수 10-27: 「이 영상 전기요금」은 영상 전체 요금처럼 읽힘). */
const CardLabel: React.FC = () => (
  <div style={{ position: 'absolute', left: 36, top: 38, fontFamily: KO, fontWeight: 700, fontSize: 34, lineHeight: 1.3, color: INK, letterSpacing: '-0.03em' }}>
    <div style={{ color: '#C9C6BE' }}>이 영상</div>
    <div>그래픽카드 전기요금</div>
  </div>
);

/** 10원 동전 그림(그린 것 — 실제 동전 사진 아님) + 「보다 적어요」. 9.8원 바로 아래에서 「동전」에 선다. */
const Coin: React.FC<{ p: number }> = ({ p }) => (
  <div style={{ position: 'absolute', left: 36, top: NUM_Y + 196, display: 'flex', alignItems: 'center', gap: 22, opacity: p, transform: `translateY(${(1 - p) * 18}px) scale(${0.9 + 0.1 * p})`, transformOrigin: '0% 50%' }}>
    <div style={{ width: 132, height: 132, borderRadius: 66, background: 'radial-gradient(circle at 35% 30%, #E4A877 0%, #B9784A 55%, #8A5432 100%)', boxShadow: 'inset 0 0 0 5px rgba(90,52,28,0.55), inset 0 0 0 11px rgba(240,190,140,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 46, color: '#5E3519', letterSpacing: '-0.04em' }}>10원</span>
    </div>
    <span style={{ fontFamily: KO, fontWeight: 720, fontSize: 38, color: INK, letterSpacing: '-0.03em' }}>보다 적어요</span>
  </div>
);

/** 「?원」 → 바퀴가 0.0에서 돌아 9.8원에 선다. */
const Cost: React.FC<{ f: number }> = ({ f }) => {
  const COST = 98; // 9.8원(누진 3단계, 자료/실측/요금.mjs) × 10
  if (f < SC.reveal) {
    const ask = ease(f, VO2.h3 - 2, 8);
    const blink = ask > 0 ? 0.5 + 0.5 * Math.abs(Math.cos(((f - VO2.h3) / 30) * Math.PI * 1.4)) : 0;
    const c = ask > 0 ? mixColor(INK, BUTTER, ask * blink) : INK;
    return <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 150, color: c, letterSpacing: '-0.03em' }}>?원</span>;
  }
  const curve = (x: number) => 1 - Math.pow(1 - x, 3);
  const spin = interpolate(f, [SC.reveal, SC.land], [0, 1], { ...clamp, easing: curve });
  const prev = interpolate(f - 1, [SC.reveal, SC.land], [0, 1], { ...clamp, easing: curve });
  const landed = f >= SC.land;
  const punch = landed ? 1 + 0.07 * (1 - ease(f, SC.land, 12)) : 1;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', transform: `scale(${punch})`, transformOrigin: '0% 60%' }}>
      <Wheels value={spin * COST} prev={prev * COST} size={140} color={landed ? BUTTER : INK} />
      <span style={{ fontFamily: KO, fontWeight: 800, fontSize: 128, color: landed ? BUTTER : INK, marginLeft: 6 }}>원</span>
    </span>
  );
};

/** 카메라: 다 재면 「맞혀 보세요」 동안 숫자로 다가가(1.12배) 답이 설 때까지 머물고, 정리 줄에서 물러난다. */
const Cam: React.FC<{ f: number; children: React.ReactNode }> = ({ f, children }) => {
  const push = ease(f, SC.genEnd - 2, 16, EASE_MOVE) * (1 - ease(f, VO2.w2 - 4, 16, EASE_MOVE));
  return <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + 0.12 * push})`, transformOrigin: `${CARD.x + 120}px ${CARD.y + NUM_Y + 75}px` }}>{children}</div>;
};

// ───────────── 끝 말: 댓글 ─────────────
const GUESS = '저는 ○○원 생각했어요';
const CommentCta: React.FC = () => {
  const f = useCurrentFrame();
  const typeAt = SC.cta + 10;
  const sendAt = typeAt + GUESS.length * 2 + 6;
  const postAt = sendAt + 3;
  const typed = Math.max(0, Math.min(GUESS.length, Math.floor((f - typeAt) / 2) + 1));
  const press = ease(f, sendAt, 3) * (1 - ease(f, sendAt + 4, 8));
  const rise = (p: number): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 16}px)` });
  const empty = f < typeAt || f >= postAt;
  return (
    <div style={{ position: 'absolute', left: 72, top: VID.y, width: 848, height: 470, borderRadius: 30, background: CARD_BG, boxShadow: `inset 0 0 0 2px ${FRAME}`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 44, top: 44, fontFamily: KO, fontWeight: 640, fontSize: 30, color: MUTED }}>댓글 달기</div>
      <div style={{ position: 'absolute', left: 44, right: 100, top: 104, height: 104, borderRadius: 24, background: '#121210', boxShadow: `inset 0 0 0 2px ${press > 0 ? `rgba(245,196,69,${0.25 + 0.75 * press})` : FRAME}` }}>
        <div style={{ position: 'absolute', left: 30, top: 0, height: 104, display: 'flex', alignItems: 'center', fontFamily: KO, fontWeight: 680, fontSize: 40, color: empty ? '#5A5852' : INK }}>{empty ? '댓글 달기…' : GUESS.slice(0, typed)}</div>
      </div>
      {f >= postAt ? (
        <div style={{ position: 'absolute', left: 44, top: 250, display: 'flex', alignItems: 'center', gap: 20, ...rise(ease(f, postAt, 9)) }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: '#3A3833' }} />
          <div>
            <div style={{ fontFamily: KO, fontWeight: 640, fontSize: 27, color: MUTED }}>나 · 방금</div>
            <div style={{ marginTop: 4, fontFamily: KO, fontWeight: 700, fontSize: 38, color: INK }}>{GUESS}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ───────────── 머리글 ─────────────
const Heads: React.FC = () => (
  <>
    <Line lines={['AI 영상 하나 만들면', '전기요금 얼마?']} accent="얼마?" at={0} until={VO2.h2 - 3} />
    <Line lines={['집 노트북으로 만들면서', '그래픽카드 전기를 쟀어요']} at={VO2.h2 - 3} until={VO2.h3 - 3} />
    <Line lines={['몇 원일까요?', '먼저 맞혀 보세요']} accent="몇 원" at={VO2.h3 - 3} until={VO2.r3 - 3} />
    <Line lines={['10원짜리 동전', '하나 값도 안 나왔어요']} accent="10원짜리 동전" at={VO2.r3 - 3} until={VO2.w2 - 3} />
    <Line lines={['이 정도면 전기요금', '걱정은 안 해도 되겠어요']} at={VO2.w2 - 3} until={VO2.cm - 3} />
    <Line lines={['몇 원일 것 같았어요?', '댓글로 알려 주세요']} accent="몇 원" at={VO2.cm - 3} until={T2.end} />
  </>
);

// ───────────── 소리 ─────────────
const hits = () => {
  const sendAt = SC.cta + 10 + GUESS.length * 2 + 6;
  return [
    { at: SC.gen, src: 'sfx/swish.wav', v: 0.18 },
    { at: SC.genEnd - 2, src: 'sfx/tick2.wav', v: 0.2 },
    ...[0, 3, 6, 9, 12].map((k) => ({ at: SC.reveal + k, src: 'sfx/tick.wav', v: 0.12 })),
    { at: SC.land, src: 'sfx/snap.wav', v: 0.24 },
    { at: SC.coin, src: 'sfx/tok.wav', v: 0.22 },
    { at: SC.cta - 2, src: 'sfx/swish.wav', v: 0.16 },
    { at: sendAt, src: 'sfx/tok.wav', v: 0.28 },
    { at: T2.end, src: 'sfx/swish.wav', v: 0.18 },
    { at: endFollow(END_TIMING), src: 'sfx/tok.wav', v: 0.42 },
  ];
};

// ───────────── 본편 ─────────────
export const PowerFilm2: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = T2.order.map((id) => [T2.vo[id], lineEnd2(id)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (T2.total - fr) / 20);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.42 - 0.16 * voice) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Stage />
      <Heads />
      <EndGate />
      {T2.order.map((id) => (
        <Sequence key={id} from={T2.vo[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {hits().map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm_v2.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

const Stage: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= T2.end + 8) return null;
  const gone = ease(f, T2.end, 8);
  const swap = ease(f, SC.cta, 10, EASE_MOVE);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone }}>
      {swap < 1 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - swap, transform: `translateY(${-swap * 40}px)` }}>
          <Cam f={f}>
            <VideoPanel />
            <CostCard />
          </Cam>
        </div>
      ) : null}
      {f >= SC.cta ? (
        <div style={{ position: 'absolute', inset: 0, opacity: swap, transform: `translateY(${(1 - swap) * 40}px)` }}>
          <CommentCta />
        </div>
      ) : null}
    </div>
  );
};

const EndGate: React.FC = () => {
  const f = useCurrentFrame();
  if (f < T2.end) return null;
  return (
    <AbsoluteFill style={{ opacity: ease(f, T2.end, 8) }}>
      <EndCard t={END_TIMING} />
    </AbsoluteFill>
  );
};

/** 표지: 고양이 하품 장면 + 「?원」 카드. */
export const CoverStill2: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: VID.x, top: VID.y, width: VID.w, height: VID.h, borderRadius: 30, overflow: 'hidden', background: '#000', boxShadow: `inset 0 0 0 2px ${FRAME}` }}>
      <Freeze frame={72}>
        <OffthreadVideo src={staticFile('clip/cat.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Freeze>
      <div style={{ position: 'absolute', left: 20, top: 20, padding: '10px 18px', borderRadius: 999, background: 'rgba(10,10,10,0.72)', fontFamily: KO, fontWeight: 720, fontSize: 31, color: INK, letterSpacing: '-0.02em' }}>AI가 만든 영상</div>
    </div>
    <div style={{ position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 30, background: CARD_BG, boxShadow: `inset 0 0 0 2px ${FRAME}`, overflow: 'hidden' }}>
      <CardLabel />
      <div style={{ position: 'absolute', left: 36, top: NUM_Y, height: 150, display: 'flex', alignItems: 'center', fontFamily: KO, fontWeight: 800, fontSize: 150, color: BUTTER, letterSpacing: '-0.03em' }}>?원</div>
    </div>
    <div style={{ position: 'absolute', left: 72, top: 236, fontFamily: KO, fontWeight: 650, fontSize: 36, color: '#A9A69E', letterSpacing: '-0.02em' }}>
      집 노트북으로 <span style={{ color: INK }}>직접 재 봤어요</span>
    </div>
    <Line lines={['AI 영상 하나', '전기요금 ?원']} accent="?원" at={0} top={300} size={92} />
  </AbsoluteFill>
);

// at2는 대본이 바뀌면 렌더를 멈추게 하는 확인용 — 끝 말 낱말이 그대로인지 본다.
at2('cm', '댓글로');
