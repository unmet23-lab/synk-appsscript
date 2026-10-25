// yuhobuilds 「AI 영상 하나 만들면 전기요금 얼마? — 집 노트북으로 재 봤어요」(10-26, 장부 Y7). 기획 · 콘티는 ../../../기획.md.
// 문법은 만족 사례 S22(검정 무대 · 흰 글 · 버터 한 곳, 머리글이 곧 내레이션)와 10-25 홈페이지 한 줄 편 그대로다.
//  · 화면은 전부 실제 값: 왼쪽은 10-26 이 노트북이 만든 AI 영상(자료/실측/cat.mp4), 오른쪽 그래프는 그 10분의 그래픽카드 전력 1초 기록(기록_cat.csv).
//  · 두 판의 자리는 한 편 내내 같다. 버터는 「요금」 한 뜻으로만(?원 · 9.8원 · 「10원도」).
//  · 그래프는 600초 기록을 「재 봤어요」(h2) 동안 왼쪽부터 그린다 — 걸린 시간도 그 진행대로 0분 → 10분.
//  · 셋째 판(이해 시험 2회 뒤): 「맞혀 보세요」에서 카메라가 「?원」으로 다가가고, 답(10원도 안 나옴)이 바로 뒤에 온다. 「거의 내내 최대」는 답 다음 줄.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, INK, STAGE } from '../film/parts';
import { EN, KO } from '../lib/fonts';
import { clamp, mixColor } from '../lib/motion';
import { EndCard, endFollow } from './End';
import { POWER, POWER_END, POWER_LIMIT } from './power.generated';
import { at, lineEnd, TIMING, VO, type Cut, type Timing } from './time';
import { ease, EASE_MOVE, Line } from './Type';

const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)
const MUTED = '#8E8B84';
const FRAME = '#3A3833';
const CARD = '#161614';

// ───────────── 자리 ─────────────
const VID = { x: 72, y: 560, w: 388, h: 690 }; // 9:16(768×1344) 그대로
const MET = { x: 484, y: 560, w: 436, h: 690 }; // 오른쪽 끝 920px — 릴스 단추 자리 밖

// ───────────── 시각 ─────────────
const CLIP_LAST = 154; // 5.17초 영상의 마지막 장(30fps 기준 시각)
const SC = {
  gen: VO.h2 - 4, // 「집 노트북으로」 — 영상이 처음으로 돌아가 「만드는 중」
  genEnd: lineEnd('h2') + 2, // 「재 봤어요」 끝 — 그래프 · 10분 다 그려짐
  reveal: VO.r1 - 16, // 「십 원도」 앞 — 바퀴가 돌기 시작
  land: VO.r1 + 2, // 「십 원도」 — 9.8원에 선다
  play: VO.r1 - 16, // 영상이 다시 돈다(기지개가 「십 원도」 언저리에)
  max: at('r2', '최대로') - 2, // 「최대로」 — 그래프의 최대 선 · 10분이 밝아짐
  calc: VO.r2 + 6, // 「그래픽카드만 잰 값」 꼬리표
  wait: at('w1', '대신') - 2, // 「대신 하나에 십 분씩」 — 걸린 시간이 커지고 요금은 흐려진다
  cta: VO.ig - 6, // 끝 말 — 두 판이 댓글 상자로
};
const PLAY_FROM = 78; // 다시 돌 때 영상의 시작 장(2.6초 — 하품 끝, 앞발을 뻗기 직전)

/** 만드는 중 진행(0~1). */
const genP = (f: number) => interpolate(f, [SC.gen + 6, SC.genEnd], [0, 1], { ...clamp, easing: (x) => x });

// ───────────── 왼쪽: AI 영상 ─────────────
const clipFrame = (f: number) => {
  if (f < SC.gen) return Math.min(f, CLIP_LAST);
  if (f < SC.play) return 0;
  return Math.min(PLAY_FROM + (f - SC.play), CLIP_LAST);
};

const VideoPanel: React.FC = () => {
  const f = useCurrentFrame();
  const making = f >= SC.gen && f < SC.play;
  const into = ease(f, SC.gen, 8); // 처음으로 감기 · 어두워짐
  const back = ease(f, SC.play, 10); // 다시 밝아짐
  const veil = making ? 0.62 * into : f >= SC.play ? 0.62 * (1 - back) : 0;
  const blur = making ? 7 * into : f >= SC.play ? 7 * (1 - back) : 0;
  const p = genP(f);
  const barShow = making ? 1 : 1 - back;
  return (
    <div style={{ position: 'absolute', left: VID.x, top: VID.y, width: VID.w, height: VID.h, borderRadius: 30, overflow: 'hidden', background: '#000', boxShadow: `inset 0 0 0 2px ${FRAME}` }}>
      <Freeze frame={clipFrame(f)}>
        <OffthreadVideo src={staticFile('clip/cat.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: blur > 0.2 ? `blur(${blur}px)` : undefined, transform: blur > 0.2 ? 'scale(1.04)' : undefined }} />
      </Freeze>
      {veil > 0 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(10,10,10,${veil})` }} /> : null}
      {/* 이 고양이가 「AI가 만든 그 영상」이라는 것(이해 시험 1회: 아래 작은 꼬리표가 안 읽혀 결과물인 줄 몰랐다) */}
      <div style={{ position: 'absolute', left: 20, top: 20, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderRadius: 999, background: 'rgba(10,10,10,0.72)', fontFamily: KO, fontWeight: 720, fontSize: 31, color: INK, letterSpacing: '-0.02em' }}>
        {making ? <Dot f={f} on={p < 1} /> : null}
        {making ? (p < 1 ? '이 영상 만드는 중' : '이 영상 다 만듦') : 'AI가 만든 영상'}
      </div>
      {f >= SC.gen && barShow > 0 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: barShow }}>
          <div style={{ position: 'absolute', left: 28, right: 28, bottom: 34, height: 10, borderRadius: 5, background: 'rgba(244,242,236,0.18)' }}>
            <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 5, background: INK }} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Dot: React.FC<{ f: number; on: boolean }> = ({ f, on }) => {
  const pulse = on ? 0.55 + 0.45 * Math.abs(Math.sin((f / 30) * Math.PI * 1.6)) : 1;
  return <div style={{ width: 16, height: 16, borderRadius: 8, background: on ? '#E5534B' : INK, opacity: pulse }} />;
};

// ───────────── 오른쪽: 계기판 ─────────────
const CH = { x: 30, y: 92, w: 376, h: 250 };
const WMAX = 215;
// 그래프 선은 1초 기록의 5초 이동 평균 — 1초짜리 짧은 떨어짐(7번)이 빗살처럼 보여 「거의 내내 최대」가 안 읽혔다(첫 렌더 10-26). 값은 그대로 실제 기록.
const SMOOTH: (readonly [number, number])[] = POWER.map(([t], i) => {
  const win = POWER.slice(Math.max(0, i - 2), i + 3);
  return [t, win.reduce((a, [, w]) => a + w, 0) / win.length] as const;
});
const px = (t: number) => CH.x + (t / POWER_END) * CH.w;
const py = (w: number) => CH.y + CH.h - (w / WMAX) * CH.h;

const chartPath = (upto: number) => {
  const pts = SMOOTH.filter(([t]) => t <= upto);
  if (pts.length < 2) return { line: '', area: '' };
  const line = pts.map(([t, w], i) => `${i ? 'L' : 'M'}${px(t).toFixed(1)} ${py(w).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return { line, area: `${line} L${px(last[0]).toFixed(1)} ${py(0)} L${px(0)} ${py(0)} Z` };
};

const Meter: React.FC = () => {
  const f = useCurrentFrame();
  const p = genP(f);
  const upto = p * POWER_END;
  const { line, area } = chartPath(upto);
  const done = SMOOTH.filter(([t]) => t <= upto);
  const head = done.length ? done[done.length - 1] : undefined;
  const minutes = f < SC.gen ? null : Math.round((p * POWER_END) / 60); // 599.7초 → 10분
  const ask = ease(f, VO.h3 - 2, 8) * (1 - (f >= SC.reveal ? 1 : 0));
  const calc = ease(f, SC.calc, 10);
  const wait = ease(f, SC.wait, 12);
  const max = ease(f, SC.max, 8) * (1 - ease(f, SC.wait, 12));
  const show = ease(f, SC.gen, 10); // 0초엔 「?원」만 — 그래프 · 시간은 「재 봤어요」에서(이해 시험 1회: 0초의 빈 그래프가 무슨 뜻인지 몰랐다)
  return (
    <div style={{ position: 'absolute', left: MET.x, top: MET.y, width: MET.w, height: MET.h, borderRadius: 30, background: CARD, boxShadow: `inset 0 0 0 2px ${FRAME}`, overflow: 'hidden' }}>
      <div style={{ opacity: show }}>
        <div style={{ position: 'absolute', left: 30, top: 30, fontFamily: KO, fontWeight: 700, fontSize: 31, color: INK, letterSpacing: '-0.02em' }}>그래픽카드가 쓴 전기</div>
        <svg width={MET.w} height={CH.y + CH.h + 20} style={{ position: 'absolute', left: 0, top: 0 }}>
          <line x1={CH.x} x2={CH.x + CH.w} y1={py(0)} y2={py(0)} stroke="#3A3833" strokeWidth={2} />
          <line x1={CH.x} x2={CH.x + CH.w} y1={py(POWER_LIMIT)} y2={py(POWER_LIMIT)} stroke={mixColor('#5A5852', INK, max)} strokeWidth={2 + 1.5 * max} strokeDasharray="8 8" />
          {area ? <path d={area} fill="rgba(244,242,236,0.13)" /> : null}
          {line ? <path d={line} fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" /> : null}
          {head && p > 0 && p < 1 ? <circle cx={px(head[0])} cy={py(head[1])} r={7} fill={INK} /> : null}
        </svg>
        <div style={{ position: 'absolute', right: 30, top: py(POWER_LIMIT) - 42, fontFamily: KO, fontWeight: 700, fontSize: 28 + 6 * max, color: mixColor(MUTED, INK, max) }}>최대</div>
      </div>
      <Stat label="이 영상 만든 시간" top={386}>
        <span style={{ display: 'inline-block', fontFamily: KO, fontWeight: 760, fontSize: 64, color: minutes === null ? '#4A4843' : INK, letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1', transform: `scale(${1 + 0.22 * wait})`, transformOrigin: '0% 55%' }}>{minutes === null ? '–' : `${minutes}분`}</span>
      </Stat>
      <div style={{ opacity: 1 - 0.55 * wait }}>
        <Stat label="이 영상 전기요금" top={510}>
          <Cost f={f} ask={ask} />
        </Stat>
      </div>
      {calc > 0 ? (
        <div style={{ position: 'absolute', left: 30, right: 24, top: 634, opacity: calc, transform: `translateY(${(1 - calc) * 10}px)`, fontFamily: KO, fontWeight: 660, fontSize: 28, color: '#B6B3AB', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          그래픽카드만 · 누진 3단계
        </div>
      ) : null}
    </div>
  );
};

const Stat: React.FC<{ label: string; top: number; children: React.ReactNode }> = ({ label, top, children }) => (
  <div style={{ position: 'absolute', left: 30, top }}>
    <div style={{ fontFamily: KO, fontWeight: 660, fontSize: 30, color: MUTED, letterSpacing: '-0.02em' }}>{label}</div>
    <div style={{ marginTop: 4, height: 84, display: 'flex', alignItems: 'center' }}>{children}</div>
  </div>
);

/** 전기요금: 「?원」 → 바퀴가 0.0에서 돌아 9.8원에 선다. */
const Cost: React.FC<{ f: number; ask: number }> = ({ f, ask }) => {
  const COST = 98; // 9.8원(누진 3단계, 요금.mjs) × 10
  if (f < SC.reveal) {
    const blink = ask > 0 ? 0.5 + 0.5 * Math.abs(Math.cos(((f - VO.h3) / 30) * Math.PI * 1.4)) : 0;
    const c = ask > 0 ? mixColor(INK, BUTTER, ask * blink) : '#4A4843';
    return <span style={{ fontFamily: KO, fontWeight: 780, fontSize: 80, color: c, letterSpacing: '-0.03em' }}>?원</span>;
  }
  const spin = interpolate(f, [SC.reveal, SC.land], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const v = spin * COST;
  const vPrev = interpolate(f - 1, [SC.reveal, SC.land], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) }) * COST;
  const landed = f >= SC.land;
  const punch = landed ? 1 + 0.06 * (1 - ease(f, SC.land, 12)) : 1;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', transform: `scale(${punch})`, transformOrigin: '0% 60%' }}>
      <Wheels value={v} prev={vPrev} size={88} color={landed ? BUTTER : INK} />
      <span style={{ fontFamily: KO, fontWeight: 780, fontSize: 80, color: landed ? BUTTER : INK, marginLeft: 6 }}>원</span>
    </span>
  );
};

/** 숫자 바퀴 두 칸 + 소수점(9.8). film/parts의 Odometer와 같은 계산에 점만 끼웠다. */
const Wheels: React.FC<{ value: number; prev: number; size: number; color: string }> = ({ value, prev, size, color }) => {
  const H = size * 0.94;
  const W = size * 0.6;
  const pos = (v: number, p: number) => {
    if (p === 0) return v;
    const base = Math.pow(10, p);
    const lower = v % base;
    return Math.floor(v / base) + (lower > base - 1 ? lower - (base - 1) : 0);
  };
  const cell = (p: number) => {
    const ps = pos(value, p);
    const blur = Math.min(14, Math.abs(ps - pos(prev, p)) * 5);
    return (
      <span key={p} style={{ display: 'inline-block', width: W, height: H, overflow: 'hidden', position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, width: W, transform: `translateY(${-(ps % 10) * H}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
            <span key={i} style={{ display: 'block', height: H, lineHeight: `${H}px`, textAlign: 'center' }}>
              {d}
            </span>
          ))}
        </span>
      </span>
    );
  };
  return (
    <span style={{ display: 'inline-flex', fontFamily: EN, fontWeight: 700, fontSize: size, color, fontFeatureSettings: '"tnum" 1' }}>
      {cell(1)}
      <span style={{ display: 'inline-block', width: size * 0.26, height: H, lineHeight: `${H}px`, textAlign: 'center' }}>.</span>
      {cell(0)}
    </span>
  );
};

/** 카메라: 그래프가 다 그려지면 「맞혀 보세요」 동안 「?원」으로 다가가(1.12배) 답이 설 때까지 머물고, 「최대로」에서 물러난다.
 * 이해 시험 1 · 2회: 4~10초가 「그래프만 차오르는 같은 화면」으로 읽혀 넘길 자리였다. */
const Cam: React.FC<{ f: number; children: React.ReactNode }> = ({ f, children }) => {
  const push = ease(f, SC.genEnd - 2, 16, EASE_MOVE) * (1 - ease(f, VO.r2 - 4, 16, EASE_MOVE));
  return <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + 0.12 * push})`, transformOrigin: `${MET.x + 140}px ${MET.y + 600}px` }}>{children}</div>;
};

// ───────────── 끝 말 ─────────────
const RIGHT = 160;
const CtaBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', left: 72, top: VID.y, width: 848, height: 470, borderRadius: 30, background: CARD, boxShadow: `inset 0 0 0 2px ${FRAME}`, overflow: 'hidden' }}>{children}</div>
);
const KEY = '전기';
const IgCta: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const typeAt = at('ig', '전기라고', 0, t) - 4;
  const sendAt = typeAt + 12;
  const dmAt = sendAt + 12;
  const postAt = sendAt + 3;
  const typed = Math.max(0, Math.min(KEY.length, Math.floor((f - typeAt) / 4) + 1));
  const press = ease(f, sendAt, 3) * (1 - ease(f, sendAt + 4, 8));
  const dm = ease(f, dmAt, 10, EASE_MOVE);
  const rise = (p: number): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 16}px)` });
  return (
    <CtaBox>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - dm, transform: `translateY(${-dm * 40}px)` }}>
        <div style={{ position: 'absolute', left: 44, top: 44, fontFamily: KO, fontWeight: 640, fontSize: 30, color: MUTED }}>이 릴스에 댓글 달기</div>
        <div style={{ position: 'absolute', left: 44, right: RIGHT - 60, top: 104, height: 104, borderRadius: 24, background: '#121210', boxShadow: `inset 0 0 0 2px ${press > 0 ? `rgba(245,196,69,${0.25 + 0.75 * press})` : FRAME}` }}>
          <div style={{ position: 'absolute', left: 30, top: 0, height: 104, display: 'flex', alignItems: 'center', fontFamily: KO, fontWeight: 680, fontSize: 40, color: f < typeAt || f >= postAt ? '#5A5852' : INK }}>{f < typeAt || f >= postAt ? '댓글 달기…' : KEY.slice(0, typed)}</div>
        </div>
        {f >= postAt ? (
          <div style={{ position: 'absolute', left: 44, top: 250, display: 'flex', alignItems: 'center', gap: 20, ...rise(ease(f, postAt, 9)) }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: '#3A3833' }} />
            <div>
              <div style={{ fontFamily: KO, fontWeight: 640, fontSize: 27, color: MUTED }}>나 · 방금</div>
              <div style={{ marginTop: 4, fontFamily: KO, fontWeight: 700, fontSize: 38, color: INK }}>{KEY}</div>
            </div>
          </div>
        ) : null}
      </div>
      {dm > 0 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: dm, transform: `translateY(${(1 - dm) * 40}px)` }}>
          <div style={{ position: 'absolute', left: 44, top: 40, fontFamily: KO, fontWeight: 640, fontSize: 30, color: MUTED }}>메시지 · @yuhobuilds</div>
          <div style={{ position: 'absolute', left: 44, top: 100, width: 690, borderRadius: 26, background: '#22211E', padding: '24px 30px', fontFamily: KO, fontWeight: 660, fontSize: 35, lineHeight: 1.4, color: INK, letterSpacing: '-0.02em', ...rise(ease(f, dmAt + 4, 9)) }}>
            「전기」 남겨 주셔서 고마워요!
            <br />내 컴퓨터 전기요금을 재는 요청문이에요.
            <div style={{ marginTop: 22, borderRadius: 18, background: '#121210', boxShadow: `inset 0 0 0 2px ${BUTTER}`, padding: '18px 22px', ...rise(ease(f, dmAt + 14, 9)) }}>
              <div style={{ fontFamily: EN, fontWeight: 650, fontSize: 32, color: BUTTER }}>synk.im/prompts</div>
              <div style={{ marginTop: 6, fontFamily: KO, fontWeight: 600, fontSize: 27, color: '#B6B3AB' }}>코딩 AI에 그대로 붙이면 돼요</div>
            </div>
          </div>
        </div>
      ) : null}
    </CtaBox>
  );
};
export const PROMPT_HEAD = '내가 AI로 그림이나 영상을 만드는 동안, 이 컴퓨터의 그래픽카드 전력을 재고 한전 요금으로 몇 원인지 셈해 줘.';
const YtCta: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const pinAt = t.vo.yt - 2;
  const fixAt = at('yt', '고정', 0, t) - 2;
  const ring = ease(f, fixAt, 7);
  const p = ease(f, pinAt, 9);
  return (
    <CtaBox>
      <div style={{ position: 'absolute', left: 44, right: 56, top: 44, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
        <div style={{ fontFamily: KO, fontWeight: 620, fontSize: 27, color: MUTED }}>📌 @yuhobuilds님이 고정함</div>
        <div style={{ marginTop: 16, fontFamily: EN, fontWeight: 650, fontSize: 31, color: INK }}>@yuhobuilds</div>
        <div style={{ marginTop: 14, fontFamily: KO, fontWeight: 640, fontSize: 31, color: '#C9C6BE', letterSpacing: '-0.02em' }}>내 컴퓨터 전기요금을 재는 요청문</div>
        <div style={{ marginTop: 18, borderRadius: 18, padding: '20px 24px', background: '#121210', boxShadow: `inset 0 0 0 ${2 + 1.5 * ring}px rgba(245,196,69,${0.35 + 0.65 * ring})`, fontFamily: KO, fontWeight: 680, fontSize: 33, lineHeight: 1.45, letterSpacing: '-0.02em', color: INK, wordBreak: 'keep-all' }}>{PROMPT_HEAD}</div>
        <div style={{ marginTop: 18, fontFamily: EN, fontWeight: 600, fontSize: 29, color: BUTTER }}>synk.im/prompts</div>
      </div>
    </CtaBox>
  );
};

// ───────────── 머리글 ─────────────
const Heads: React.FC<{ t: Timing }> = ({ t }) => {
  const wait = at('w1', '대신') - 3;
  return (
    <>
      <Line lines={['AI 영상 하나 만들면', '전기요금 얼마?']} accent="얼마?" at={0} until={VO.h2 - 3} />
      <Line lines={['집 노트북으로 만들면서', '그래픽카드 전기를 쟀어요']} at={VO.h2 - 3} until={VO.h3 - 3} />
      <Line lines={['몇 원일까요?', '먼저 맞혀 보세요']} accent="몇 원" at={VO.h3 - 3} until={VO.r1 - 3} />
      <Line lines={['10원도', '안 나왔어요']} accent="10원도" at={VO.r1 - 3} until={VO.r2 - 3} />
      <Line lines={['그래픽카드가 10분 동안', '거의 내내 최대로 돌았는데도']} at={VO.r2 - 3} until={VO.w1 - 3} />
      <Line lines={['전기요금은', '걱정 안 해도 되겠어요']} at={VO.w1 - 3} until={wait} />
      <Line lines={['대신 하나에', '10분씩 걸려요']} at={wait} until={SC.cta} />
      {t.cut === 'ig' ? (
        <Line lines={['댓글에 「전기」라고 쓰면', '전기요금 재는 요청문을 DM으로']} accent="「전기」" at={t.vo.ig - 3} until={t.end} />
      ) : (
        <Line lines={['내 컴퓨터 전기요금 재는', '요청문은 고정 댓글에']} accent="고정 댓글에" at={t.vo.yt - 3} until={t.end} />
      )}
    </>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (t: Timing): Hit[] => {
  const out: Hit[] = [
    { at: SC.gen, src: 'sfx/swish.wav', v: 0.18 },
    { at: SC.genEnd - 2, src: 'sfx/tick2.wav', v: 0.2 },
    ...[0, 3, 6, 9, 12].map((k) => ({ at: SC.reveal + k, src: 'sfx/tick.wav', v: 0.12 })),
    { at: SC.land, src: 'sfx/snap.wav', v: 0.24 },
    { at: SC.max, src: 'sfx/tick2.wav', v: 0.14 },
    { at: SC.wait, src: 'sfx/tick.wav', v: 0.16 },
    { at: SC.cta - 2, src: 'sfx/swish.wav', v: 0.16 },
    { at: t.end, src: 'sfx/swish.wav', v: 0.18 },
    { at: endFollow(t), src: 'sfx/tok.wav', v: 0.42 },
  ];
  if (t.cut === 'ig') {
    const typeAt = at('ig', '전기라고', 0, t) - 4;
    out.push({ at: typeAt + 12, src: 'sfx/tok.wav', v: 0.28 }, { at: typeAt + 24, src: 'sfx/swish.wav', v: 0.18 }, { at: typeAt + 38, src: 'sfx/snap.wav', v: 0.18 });
  } else {
    out.push({ at: at('yt', '고정', 0, t) - 2, src: 'sfx/tick2.wav', v: 0.16 });
  }
  return out;
};

// ───────────── 본편 ─────────────
export const PowerFilm: React.FC<{ cut: Cut; bgm?: boolean }> = ({ cut, bgm = true }) => {
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
  const swap = ease(f, SC.cta, 10, EASE_MOVE);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone }}>
      {swap < 1 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - swap, transform: `translateY(${-swap * 40}px)` }}>
          <Cam f={f}>
            <VideoPanel />
            <Meter />
          </Cam>
        </div>
      ) : null}
      {f >= SC.cta ? <div style={{ position: 'absolute', inset: 0, opacity: swap, transform: `translateY(${(1 - swap) * 40}px)` }}>{t.cut === 'ig' ? <IgCta t={t} /> : <YtCta t={t} />}</div> : null}
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

/** 표지: 고양이 하품 장면 + 다 그린 그래프 + 「?원」. */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <div style={{ position: 'absolute', left: VID.x, top: VID.y, width: VID.w, height: VID.h, borderRadius: 30, overflow: 'hidden', background: '#000', boxShadow: `inset 0 0 0 2px ${FRAME}` }}>
      <Freeze frame={72}>
        <OffthreadVideo src={staticFile('clip/cat.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Freeze>
      <div style={{ position: 'absolute', left: 20, top: 20, padding: '10px 18px', borderRadius: 999, background: 'rgba(10,10,10,0.72)', fontFamily: KO, fontWeight: 720, fontSize: 31, color: INK, letterSpacing: '-0.02em' }}>AI가 만든 영상</div>
    </div>
    <CoverMeter />
    <div style={{ position: 'absolute', left: 72, top: 236, fontFamily: KO, fontWeight: 650, fontSize: 36, color: '#A9A69E', letterSpacing: '-0.02em' }}>
      집 노트북으로 <span style={{ color: INK }}>직접 재 봤어요</span>
    </div>
    <Line lines={['AI 영상 하나', '전기요금 ?원']} accent="?원" at={0} top={300} size={92} />
  </AbsoluteFill>
);
const CoverMeter: React.FC = () => {
  const { line, area } = chartPath(POWER_END);
  return (
    <div style={{ position: 'absolute', left: MET.x, top: MET.y, width: MET.w, height: MET.h, borderRadius: 30, background: CARD, boxShadow: `inset 0 0 0 2px ${FRAME}`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 30, top: 30, fontFamily: KO, fontWeight: 700, fontSize: 31, color: INK, letterSpacing: '-0.02em' }}>그래픽카드가 쓴 전기</div>
      <svg width={MET.w} height={CH.y + CH.h + 20} style={{ position: 'absolute', left: 0, top: 0 }}>
        <line x1={CH.x} x2={CH.x + CH.w} y1={py(0)} y2={py(0)} stroke="#3A3833" strokeWidth={2} />
        <line x1={CH.x} x2={CH.x + CH.w} y1={py(POWER_LIMIT)} y2={py(POWER_LIMIT)} stroke="#5A5852" strokeWidth={2} strokeDasharray="8 8" />
        <path d={area} fill="rgba(244,242,236,0.13)" />
        <path d={line} fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', right: 30, top: py(POWER_LIMIT) - 40, fontFamily: KO, fontWeight: 620, fontSize: 24, color: MUTED }}>최대</div>
      <Stat label="이 영상 만든 시간" top={386}>
        <span style={{ fontFamily: KO, fontWeight: 760, fontSize: 64, color: INK, letterSpacing: '-0.03em' }}>10분</span>
      </Stat>
      <Stat label="이 영상 전기요금" top={510}>
        <span style={{ fontFamily: KO, fontWeight: 780, fontSize: 80, color: BUTTER, letterSpacing: '-0.03em' }}>?원</span>
      </Stat>
    </div>
  );
};
