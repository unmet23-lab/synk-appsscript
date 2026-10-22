// yuhobuilds 「GitHub 무료 2,000분이 바닥나자, 검사가 2초 만에 꺼졌어요」(10-22 둘째 편). 기획·콘티는 ../../기획.md. 움직임 문법은 같은 날 첫째 편(p3)과 같다.
//  · 판(창) 자리는 한 편 내내 같고 내용은 컷. 판은 늘 천천히 밀린다(프레임마다 0.07%, 1.08에서 멈춤).
//  · 머리글은 줄 단위 올림 하나, 강조는 처음부터 칠한 낱말 하나(Type.tsx). 버터는 머리글 강조에만.
//  · 근거는 전부 실제 기록(data.ts). 실행 목록·실행 화면·결제 화면은 다시 그린 것이라 머리띠·판 아래 표시에 그렇게 적는다.
//  · 숫자 세기·튕김·흐림 전환·형광펜 없음. 한 장면 안에서도 1.5초 넘게 멈추지 않게 목록·띠·커서가 말 박자에 맞춰 움직인다.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Cursor, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { bezier, clamp, mix } from '../lib/motion';
import { PAPER, RULE, UI_INK, UI_MUTED } from '../day1/parts';
import * as D from './data';
import { EndCard, END_FOLLOW } from './End';
import { at, lineEnd, ORDER, S, TOTAL, VO } from './time';
import { ease, EASE_MOVE, Line } from './Type';

// ───────────── 판(창) ─────────────
const VP = { x: 64, y: 600, w: 952, h: 680, r: 28 };
const W = VP.w;
const H = VP.h;
const BAR = 54;
const DARK = '#141412';

const on = (f: number, a: number, b = Infinity) => ease(f, a, 6) * (b === Infinity ? 1 : 1 - ease(f, b, 6));
const Ring: React.FC<{ k: number; r: number; pad?: number; dark?: boolean }> = ({ k, r, pad = 0, dark }) => {
  if (k <= 0) return null;
  const c = dark ? '244,242,236' : '34,33,30';
  return <div style={{ position: 'absolute', inset: -pad, borderRadius: r + pad, background: `rgba(${c},${0.06 * k})`, boxShadow: `inset 0 0 0 3px rgba(${c},${k})`, pointerEvents: 'none' }} />;
};
const WinBar: React.FC<{ text: string; right?: string }> = ({ text, right }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, background: '#1C1B19', borderBottom: '1px solid #2E2D2A' }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ position: 'absolute', left: 24 + i * 22, top: 21, width: 12, height: 12, borderRadius: 6, background: '#3E3C38' }} />
    ))}
    <div style={{ position: 'absolute', left: 110, top: 0, lineHeight: `${BAR}px`, fontFamily: KO, fontWeight: 620, fontSize: 23, color: '#B6B3AB', whiteSpace: 'nowrap' }}>{text}</div>
    {right ? <div style={{ position: 'absolute', right: 24, top: 0, lineHeight: `${BAR}px`, fontFamily: KO, fontWeight: 560, fontSize: 21, color: '#8E8B84' }}>{right}</div> : null}
  </div>
);
const CardHead: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <>
    <div style={{ position: 'absolute', left: 38, top: 32, fontFamily: KO, fontWeight: 760, fontSize: 38, color: UI_INK, letterSpacing: '-0.03em' }}>{title}</div>
    <div style={{ position: 'absolute', left: 40, top: 86, fontFamily: KO, fontWeight: 560, fontSize: 23, color: UI_MUTED }}>{sub}</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 134, height: 1, background: RULE }} />
  </>
);
const XMark: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = INK }) => (
  <svg width={size} height={size} viewBox="0 0 26 26">
    <circle cx={13} cy={13} r={11.5} fill="none" stroke={color} strokeWidth={2.2} />
    <path d="M8.5 8.5 L17.5 17.5 M17.5 8.5 L8.5 17.5" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);
const Check: React.FC<{ size?: number; color?: string; tick?: string }> = ({ size = 26, color = INK, tick = '#141412' }) => (
  <svg width={size} height={size} viewBox="0 0 26 26">
    <circle cx={13} cy={13} r={11.5} fill={color} />
    <path d="M7.5 13.5 L11.5 17.5 L19 9" fill="none" stroke={tick} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
/** 글이 a부터 프레임당 cps자씩 쳐진다. */
const typed = (text: string, f: number, a: number, cps: number) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((f - a) * cps))));
/** 줄바꿈을 걸쳐도 줄마다 그려지는 글 테두리(absolute 테두리는 두 줄에 걸치면 세로 막대가 된다 — 완성본 검수 P2-2). */
const Mark: React.FC<{ k: number; dark?: boolean; children: React.ReactNode }> = ({ k, dark, children }) => {
  const c = dark ? '244,242,236' : '34,33,30';
  return <span style={{ padding: '1px 4px', margin: '0 -4px', borderRadius: 6, boxShadow: k > 0 ? `inset 0 0 0 3px rgba(${c},${k})` : undefined, background: k > 0 ? `rgba(${c},${0.06 * k})` : undefined, WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone' }}>{children}</span>;
};
const slideIn = (f: number, a: number, dist = 12): React.CSSProperties => ({ opacity: ease(f, a, 7), transform: `translateY(${(1 - ease(f, a, 8)) * dist}px)` });

// ───────────── 장면 ─────────────
/** 1. 훅: 0단계로 끝난 실행 18줄이 위에서 쌓이며 흐른다. */
const ROW_H = 56;
const RunRow: React.FC<{ when: string; sec: number; top: number; style?: React.CSSProperties }> = ({ when, sec, top, style }) => (
  <div style={{ position: 'absolute', left: 24, right: 112, top, height: ROW_H - 8, borderRadius: 12, background: '#1C1B19', display: 'flex', alignItems: 'center', gap: 18, padding: '0 18px', ...style }}>
    <XMark />
    <span style={{ fontFamily: MONO, fontSize: 24, color: INK, width: 110 }}>verify</span>
    <span style={{ fontFamily: KO, fontWeight: 650, fontSize: 24, color: INK, width: 130 }}>단계 0개</span>
    <span style={{ fontFamily: EN, fontWeight: 600, fontSize: 24, color: '#B6B3AB', width: 60 }}>{sec}s</span>
    <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 23, color: '#8E8B84' }}>{when}</span>
  </div>
);
const Runs: React.FC<{ f: number }> = ({ f }) => {
  const step = 5; // 5프레임마다 한 줄 — 18줄이 3초 동안 쌓인다(훅 내내 움직임)
  const BASE = 20; // 0프레임에 이미 네 줄
  const n = Math.min(D.DEAD_RUNS.length, Math.max(1, Math.floor((f + BASE) / step)));
  const visible = 10;
  return (
    <>
      <WinBar text="코드 올릴 때마다 도는 자동 검사 · 기록을 다시 그림 · 저장소 이름 가림" />
      <div style={{ position: 'absolute', left: 0, right: 0, top: BAR + 12, bottom: 0, overflow: 'hidden' }}>
        {D.DEAD_RUNS.slice(0, n).map(([when, sec], i) => {
          const fromTop = n - 1 - i; // 새 줄이 맨 위, 오래된 줄은 아래로 밀려 나간다
          if (fromTop >= visible) return null;
          const born = (i + 1) * step - BASE;
          const p = ease(f, born, 5);
          return <RunRow key={i} when={when} sec={sec} top={fromTop * ROW_H + (1 - p) * -24} style={{ opacity: p }} />;
        })}
      </div>
    </>
  );
};

/** 2. 약속. */
const PROMISE = [
  { t: '왜 꺼졌나', s: '단계 0개 · 메시지 · 무료 분' },
  { t: '다시 돌리는 길 둘', s: '공개 저장소 · 내 PC 실행기' },
  { t: '남은 시간 보는 곳', s: 'settings/billing' },
] as const;
const PromiseCard: React.FC<{ f: number }> = ({ f }) => {
  const k = on(f, at('h2', '길') - 2);
  return (
    <>
      <CardHead title="이번 편" sub="끝에 드리는 것까지" />
      <div style={{ position: 'absolute', left: 16, right: 16, top: 150 + 150, height: 140 }}>
        <Ring k={k} r={18} />
      </div>
      {PROMISE.map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: 40, right: 40, top: 168 + i * 150, height: 130, ...slideIn(f, [VO.h2 + 2, VO.h2 + 14, at('h2', '남은') - 4][i], 14) }}>
          <div style={{ fontFamily: KO, fontWeight: 740, fontSize: 40, color: UI_INK, letterSpacing: '-0.02em' }}>{p.t}</div>
          <div style={{ marginTop: 10, fontFamily: KO, fontWeight: 560, fontSize: 27, color: UI_MUTED, filter: 'blur(7px)', opacity: 0.8, whiteSpace: 'nowrap' }}>{p.s}</div>
          {i < 2 ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: RULE }} /> : null}
        </div>
      ))}
    </>
  );
};

/** 3. 실행 하나를 연 화면(다시 그림): ✕ verify → 빈 단계 칸 → 「not started」. */
const Job: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const kEmpty = on(f, at('b1', '하나') - 2, at('b1', '시작') - 2);
  const kStart = on(f, at('b1', '시작') - 2);
  return (
    <>
      <WinBar text="실행 하나를 연 화면 · 10/20 19:20 · 다시 그림" />
      <div style={{ position: 'absolute', left: 32, top: BAR + 26, fontFamily: KO, fontWeight: 650, fontSize: 24, color: '#8E8B84', ...slideIn(f, sceneStart + 2, 30) }}>JOBS</div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 66, height: 60, display: 'flex', alignItems: 'center', gap: 16, ...slideIn(f, sceneStart + 8, 40) }}>
        <XMark size={30} />
        <span style={{ fontFamily: MONO, fontSize: 28, color: INK }}>verify</span>
        <span style={{ fontFamily: KO, fontWeight: 600, fontSize: 26, color: '#B6B3AB' }}>2초</span>
      </div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 128, height: 50, display: 'flex', alignItems: 'center', gap: 16, ...slideIn(f, sceneStart + 16, 40) }}>
        <div style={{ width: 30, height: 4, borderRadius: 2, background: '#5E5C56', margin: '0 0' }} />
        <span style={{ fontFamily: MONO, fontSize: 26, color: '#8E8B84' }}>build</span>
        <span style={{ fontFamily: KO, fontWeight: 600, fontSize: 24, color: '#5E5C56' }}>건너뜀</span>
      </div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 204, height: 150, borderRadius: 16, border: '2px dashed #5E5C56', background: '#1A1917', ...slideIn(f, sceneStart + 26, 80) }}>
        <Ring k={kEmpty} r={16} pad={4} dark />
        <div style={{ position: 'absolute', left: 24, top: 18, fontFamily: KO, fontWeight: 650, fontSize: 24, color: '#8E8B84' }}>verify의 단계</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center', fontFamily: KO, fontWeight: 780, fontSize: 76, color: INK, ...slideIn(f, at('b1', '하나') - 3, 30) }}>0개</div>
      </div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 386, padding: '14px 18px', borderRadius: 14, background: '#1C1B19', fontFamily: MONO, fontSize: 24, lineHeight: 1.5, color: '#D9D6CE', ...slideIn(f, at('b1', '없었') - 4) }}>
        {typed('The job was ', f, at('b1', '없었'), 1.2)}
        {f >= at('b1', '없었') + 10 ? (
          <span style={{ position: 'relative', padding: '0 6px', margin: '0 -6px' }}>
            <Ring k={kStart} r={8} dark />
            {typed('not started', f, at('b1', '없었') + 10, 1.2)}
          </span>
        ) : null}
        {typed(' because …', f, at('b1', '없었') + 20, 1.2)}
      </div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 500, height: 70, borderRadius: 35, background: INK, color: '#141412', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 760, fontSize: 32, ...slideIn(f, at('b1', '시작') + 4, 60) }}>시작도 못 하고 끝남</div>
    </>
  );
};

/** 4. 메시지 원문 전체 → 사용량 막대. */
const Note: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const kA = on(f, at('b2', '결제') - 2, at('b2', '한도') - 2);
  const kB = on(f, at('b2', '한도') - 2, at('b2', '저는') - 2);
  const meterAt = at('b2', '수단') - 4;
  const fill = interpolate(f, [meterAt, at('b2', '바닥')], [0, 1], clamp);
  return (
    <>
      <CardHead title="실행에 붙은 메시지" sub="원문 첫 문장 · 아래는 결제 화면에서 본 값(다시 그림)" />
      <div style={{ position: 'absolute', left: 32, right: 32, top: 160, padding: '18px 22px', borderRadius: 16, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}`, fontFamily: MONO, fontSize: 25, lineHeight: 1.55, color: UI_INK, ...slideIn(f, sceneStart + 3) }}>
        <Mark k={kA}>{typed(D.ANNOTATION_A, f, sceneStart + 2, 2.4)}</Mark>
        <Mark k={kB}>{typed(D.ANNOTATION_B, f, sceneStart + 2 + Math.ceil(D.ANNOTATION_A.length / 2.4), 2.4)}</Mark>
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 412, ...slideIn(f, meterAt) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 700, fontSize: 27, color: UI_INK }}>
          <span>Actions 무료 분</span>
          <span style={{ fontFamily: EN }}>
            2,000 / 2,000<span style={{ fontFamily: KO, fontWeight: 600, fontSize: 22, color: UI_MUTED }}> 분</span>
          </span>
        </div>
        <div style={{ marginTop: 14, height: 64, borderRadius: 12, background: '#ECEAE4', overflow: 'hidden' }}>
          <div style={{ width: `${fill * 100}%`, height: '100%', background: UI_INK }} />
        </div>
        <div style={{ marginTop: 18, height: 64, borderRadius: 32, background: UI_INK, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 720, fontSize: 27, ...slideIn(f, at('b2', '바닥') - 2, 50) }}>결제 수단 없음 · 예산 $0 · 다 쓰면 막힘</div>
      </div>
    </>
  );
};

/** 5. 하루 넘게: 시간 띠에 ✕ 18개가 재생 위치를 따라 칠해지고 → 되살린 첫 전체 시험 빨강 16. */
const Gap: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const gw = W - 96;
  const x0 = 48;
  const sweepEnd = at('b3', '다시') - 2;
  const pos = interpolate(f, [sceneStart + 4, sweepEnd], [0, 1], clamp);
  const testAt = at('b3', '다시');
  const k16 = on(f, at('b3', '열여섯') - 2);
  const nRed = Math.floor(interpolate(f, [testAt + 4, lineEnd('b3') + 4], [0, D.RED_TESTS], clamp));
  return (
    <>
      <WinBar text="10/20 19:20부터 10/21 23:25 첫 초록까지 · 28시간" />
      <div style={{ position: 'absolute', left: x0, top: BAR + 36, width: gw, height: 80 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 38, height: 4, borderRadius: 2, background: '#2E2D2A' }} />
        <div style={{ position: 'absolute', left: 0, top: 34, width: pos * gw, height: 12, borderRadius: 6, background: '#5E5C56' }} />
        {D.DEAD_HOURS.map((h, i) => {
          const x = (h / D.SPAN_HOURS) * gw;
          const lit = pos * D.SPAN_HOURS >= h;
          const litAt = sceneStart + 4 + (h / D.SPAN_HOURS) * (sweepEnd - sceneStart - 4);
          const r = interpolate(f, [litAt, litAt + 12], [0, 1], clamp);
          return (
            <div key={i} style={{ position: 'absolute', left: x - 11, top: 29 + (i % 2 ? 7 : -7), width: 22, height: 22, opacity: lit ? 1 : 0.18 }}>
              {r > 0 && r < 1 ? <div style={{ position: 'absolute', left: -22 * r, top: -22 * r, width: 22 + 44 * r, height: 22 + 44 * r, borderRadius: '50%', border: '2px solid rgba(244,242,236,0.5)', opacity: 1 - r }} /> : null}
              <XMark size={22} color={INK} />
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: gw - 13, top: 27, width: 26, height: 26, opacity: pos >= 0.999 ? 1 : 0.18 }}>
          <Check size={26} color={INK} />
        </div>
        <div style={{ position: 'absolute', left: pos * gw - 2, top: 14, width: 4, height: 52, borderRadius: 2, background: INK, opacity: pos < 1 ? 1 : 0 }} />
        <div style={{ position: 'absolute', left: -10, top: 70, fontFamily: MONO, fontSize: 20, color: '#8E8B84' }}>10/20 19:20</div>
        <div style={{ position: 'absolute', right: -10, top: 70, fontFamily: MONO, fontSize: 20, color: '#8E8B84' }}>10/21 23:25</div>
      </div>
      {f < testAt - 2 ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: BAR + 160, bottom: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 32, top: 4, fontFamily: KO, fontWeight: 620, fontSize: 22, color: '#8E8B84' }}>그동안 코드는 계속 올라감 · 검사는 시작도 못 함</div>
          {D.DEAD_HOURS.map((h, i) => {
            const litAt = sceneStart + 4 + (h / D.SPAN_HOURS) * (sweepEnd - sceneStart - 4);
            if (f < litAt) return null;
            const nLit = D.DEAD_HOURS.filter((x) => pos * D.SPAN_HOURS >= x).length;
            const fromTop = nLit - 1 - i;
            if (fromTop < 0 || fromTop > 6) return null;
            const p = ease(f, litAt, 5);
            return <RunRow key={i} when={D.DEAD_RUNS[i][0]} sec={D.DEAD_RUNS[i][1]} top={44 + fromTop * ROW_H + (1 - p) * -20} style={{ opacity: p }} />;
          })}
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 172, bottom: 24, borderRadius: 16, background: '#1C1B19', ...slideIn(f, testAt - 2, 40) }}>
        <div style={{ position: 'absolute', left: 24, top: 20, fontFamily: KO, fontWeight: 650, fontSize: 24, color: '#B6B3AB' }}>
          되살린 첫 전체 시험 · <span style={{ fontFamily: EN }}>4,451</span>개 중
        </div>
        <div style={{ position: 'absolute', right: 24, top: 10, padding: '6px 14px', fontFamily: KO, fontWeight: 760, fontSize: 32, color: INK }}>
          <Ring k={k16} r={10} dark />
          빨강 {D.RED_TESTS}
        </div>
        <div style={{ position: 'absolute', left: 24, right: 24, top: 74, display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 18, rowGap: 10 }}>
          {Array.from({ length: D.RED_TESTS }, (_, i) => (
            <div key={i} style={{ height: 34, display: 'flex', alignItems: 'center', gap: 10, opacity: i < nRed ? 1 : 0 }}>
              <XMark size={20} color={i >= D.RED_TESTS - D.RED_BY_PC ? '#8E8B84' : INK} />
              <div style={{ width: 120 + ((i * 53) % 150), height: 12, borderRadius: 6, background: i >= D.RED_TESTS - D.RED_BY_PC ? '#3A3934' : '#5E5C56' }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

/** 6. 빨간불 읽는 법: 갈림표. */
const Fork: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const kA = on(f, at('b4', '한도') - 2);
  const kB = on(f, at('b4', '코드') - 2, at('b4', '초') - 6);
  const row = (top: number, icon: React.ReactNode, a: string, b: string, k: number, appear: number) => (
    <div style={{ position: 'absolute', left: 32, right: 32, top, height: 150, borderRadius: 18, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}`, ...slideIn(f, appear, 14) }}>
      <Ring k={k} r={18} pad={4} />
      <div style={{ position: 'absolute', left: 26, top: 26 }}>{icon}</div>
      <div style={{ position: 'absolute', left: 82, top: 22, fontFamily: KO, fontWeight: 740, fontSize: 32, color: UI_INK }}>{a}</div>
      <div style={{ position: 'absolute', left: 82, top: 80, fontFamily: KO, fontWeight: 650, fontSize: 28, color: UI_MUTED }}>{b}</div>
    </div>
  );
  return (
    <>
      <CardHead title="빨간불 읽는 법" sub="실행을 열어 단계부터" />
      {row(166, <XMark size={34} color={UI_INK} />, '단계에서 실패했다', '코드부터 보기', kB, sceneStart + 4)}
      {row(340, <XMark size={34} color={UI_INK} />, '단계 0개 · 1~3초 만에 끝', '한도·결제부터 보기', kA, sceneStart + 12)}
    </>
  );
};

/** 7. 첫째 길: 공개 저장소(문서 문장 → 우리 사례 → 조심할 것, 세 박). */
const Path1: React.FC<{ f: number }> = ({ f }) => {
  const kPub = on(f, at('f1', '무료') - 2);
  return (
    <>
      <CardHead title="첫째 길 · 공개 저장소" sub="GitHub 공식 문서 · 10월 22일 확인" />
      <div style={{ position: 'absolute', left: 32, right: 32, top: 160, minHeight: 130, padding: '18px 22px', borderRadius: 16, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}`, fontFamily: EN, fontWeight: 560, fontSize: 27, lineHeight: 1.45, color: UI_INK, ...slideIn(f, VO.f1, 20) }}>
        {typed('“GitHub Actions usage is free for self-hosted runners and ', f, VO.f1 + 4, 1.6)}
        <Mark k={kPub}>{typed('for public repositories', f, VO.f1 + 4 + Math.ceil(58 / 1.6), 1.6)}</Mark>
        {typed(' that use standard GitHub-hosted runners.”', f, VO.f1 + 4 + Math.ceil(81 / 1.6), 1.6)}
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 392, display: 'flex', alignItems: 'center', gap: 16, ...slideIn(f, at('f1', '공개', 4) - 2) }}>
        <Check size={32} color={UI_INK} tick="#FFFFFF" />
        <span style={{ fontFamily: KO, fontWeight: 700, fontSize: 28, color: UI_INK }}>10월 19일 공개로 바꾼 뒤 첫 실행 · 시험 1,940개 실패 0</span>
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 474, fontFamily: KO, fontWeight: 600, fontSize: 24, color: UI_MUTED, ...slideIn(f, at('f1', '무료') + 4, 8) }}>공개 전에 — 비밀값·개인정보가 커밋에 없는지 먼저</div>
    </>
  );
};

/** 8. 둘째 길: 내 PC 실행기(실행 줄 → 시험 수 → 조심할 것). */
const Path2: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const runFrom = sceneStart + 4;
  const runTo = at('f2', '실행기') + 4;
  const run = interpolate(f, [runFrom, runTo], [0, 1], clamp);
  return (
  <>
    <WinBar text="둘째 길 · 비공개 저장소는 내 PC를 실행기로 · 실제 기록을 다시 그림" />
    <div style={{ position: 'absolute', left: 24, right: 112, top: BAR + 30, height: 64, borderRadius: 12, background: '#2A2925', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 18, padding: '0 18px', ...slideIn(f, sceneStart + 4, 20) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${run * 100}%`, background: '#4A4843' }} />
      {run >= 1 ? <span style={{ position: 'relative', display: 'flex' }}><Check size={28} /></span> : <div style={{ position: 'relative', width: 28, height: 28, borderRadius: 14, border: '2.5px solid #8E8B84' }} />}
      <span style={{ position: 'relative', fontFamily: MONO, fontSize: 25, color: INK, width: 110 }}>verify</span>
      <span style={{ position: 'relative', fontFamily: KO, fontWeight: 650, fontSize: 25, color: INK, opacity: run >= 1 ? 1 : 0.35 }}>10단계 · {D.SELF_RUN.took}</span>
      <span style={{ position: 'relative', marginLeft: 'auto', fontFamily: MONO, fontSize: 23, color: '#8E8B84' }}>{D.SELF_RUN.at}</span>
    </div>
    {/* 잡이 GitHub에서 내 PC 실행기로 건너가는 흐름(그림): 「내 피씨를」부터 점이 계속 건너간다 */}
    <div style={{ position: 'absolute', left: 32, right: 112, top: BAR + 112, height: 96, ...slideIn(f, sceneStart + 6, 16) }}>
      <div style={{ position: 'absolute', left: 0, top: 18, width: 210, height: 60, borderRadius: 14, background: '#2A2925', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 650, fontSize: 26, color: INK }}>GitHub</div>
      <div style={{ position: 'absolute', right: 0, top: 18, width: 330, height: 60, borderRadius: 14, background: '#2A2925', boxShadow: f >= at('f2', '내') ? 'inset 0 0 0 2px #D9D6CE' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 700, fontSize: 26, color: INK }}>내 PC · 실행기(이름 가림)</div>
      <div style={{ position: 'absolute', left: 226, right: 346, top: 46, height: 4, borderRadius: 2, background: '#3A3934' }} />
      {f >= sceneStart + 14
        ? [0, 1, 2].map((k) => {
            const ph = ((f - sceneStart - 14 + k * 8) % 24) / 24;
            return <div key={k} style={{ position: 'absolute', left: `calc(226px + (100% - 572px) * ${ph})`, top: 38, width: 20, height: 20, borderRadius: 10, background: INK, opacity: Math.sin(ph * Math.PI) }} />;
          })
        : null}
    </div>
    <div style={{ position: 'absolute', left: 40, top: BAR + 222, fontFamily: KO, fontWeight: 600, fontSize: 24, color: '#B6B3AB', ...slideIn(f, at('f2', '실행기') + 2) }}>
      시험 <span style={{ fontFamily: EN }}>4,451</span>개 실패 0
    </div>
    <div style={{ position: 'absolute', left: 32, right: 32, top: BAR + 274, height: 140, borderRadius: 16, background: '#1C1B19', ...slideIn(f, sceneStart + 10, 30) }}>
      <div style={{ position: 'absolute', left: 24, top: 22, fontFamily: KO, fontWeight: 650, fontSize: 24, color: '#8E8B84' }}>이 저장소 · 비공개 · 무료 분 다 씀 · 예산</div>
      <div style={{ position: 'absolute', left: 24, top: 60, fontFamily: EN, fontWeight: 700, fontSize: 52, color: INK }}>$0</div>
      <div style={{ position: 'absolute', left: 150, top: 76, fontFamily: KO, fontWeight: 650, fontSize: 28, color: INK, ...slideIn(f, at('f2', '예산') - 2, 10) }}>그래도 잡을 받아 돌았어요</div>
    </div>
    <div style={{ position: 'absolute', left: 40, right: 40, top: BAR + 436, fontFamily: KO, fontWeight: 600, fontSize: 23, lineHeight: 1.5, color: '#8E8B84', ...slideIn(f, at('f2', '돌아') - 2, 8) }}>
      공개 저장소엔 붙이지 않기 — 남이 보낸 PR 코드가 내 PC에서 돌 수 있어요(GitHub 권고)
      <br />
      10월 22일 GitHub 문서 기준 · 자체 실행기 과금 계획은 미뤄진 상태
    </div>
  </>
  );
};

/** 9. 남은 시간 보는 곳: 주소창에 쳐지고 → 사용량 막대. */
const Billing: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const n = Math.max(0, Math.min(D.BILLING_URL.length, Math.floor((f - sceneStart - 4) * 1.2)));
  return (
    <>
      <CardHead title="남은 시간 보는 곳" sub="GitHub 설정의 빌링 화면 · 다시 그림" />
      <div style={{ position: 'absolute', left: 32, right: 32, top: 162, height: 76, borderRadius: 38, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}`, display: 'flex', alignItems: 'center', padding: '0 30px', fontFamily: MONO, fontSize: 30, color: UI_INK }}>
        {D.BILLING_URL.slice(0, n)}
        {n < D.BILLING_URL.length ? <span style={{ display: 'inline-block', width: 3, height: 32, background: UI_INK, marginLeft: 2 }} /> : null}
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 280, ...slideIn(f, sceneStart + 4 + Math.ceil(D.BILLING_URL.length / 1.2)) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: KO, fontWeight: 700, fontSize: 27, color: UI_INK }}>
          <span>Actions 무료 분</span>
          <span style={{ fontFamily: EN }}>2,000분 / 달</span>
        </div>
        <div style={{ marginTop: 14, height: 34, borderRadius: 10, background: '#ECEAE4' }} />
        <div style={{ marginTop: 14, fontFamily: KO, fontWeight: 600, fontSize: 24, color: UI_MUTED }}>매달 1일 다시 2,000분</div>
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 500, fontFamily: KO, fontWeight: 600, fontSize: 24, color: UI_MUTED, ...slideIn(f, lineEnd('c0') - 14, 8) }}>
        조직 계정은 조직 설정의 Billing &amp; Licensing
      </div>
    </>
  );
};

/** 10. 보내기. */
const SEND_XY: [number, number] = [W / 2, 360];
const Share: React.FC<{ f: number; sceneStart: number }> = ({ f, sceneStart }) => {
  const sendAt = at('cta', '보내');
  const sent = f >= sendAt;
  return (
    <>
      <CardHead title="AI로 코딩하는 친구에게" sub="매달 1일 전에 한 번 보면 좋아요" />
      <div style={{ position: 'absolute', left: W / 2 - 70, top: 290, width: 140, height: 140, borderRadius: 70, background: sent ? UI_INK : '#FFFFFF', boxShadow: `inset 0 0 0 2px ${UI_INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...slideIn(f, sceneStart + 4, 10) }}>
        <svg width={64} height={64} viewBox="0 0 32 32">
          <path d="M3 15 L29 4 L21 29 L15 18 Z M15 18 L29 4" fill="none" stroke={sent ? '#FFFFFF' : UI_INK} strokeWidth={2.4} strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 30, color: UI_INK, opacity: ease(f, sendAt + 2, 6) }}>보냈어요</div>
    </>
  );
};
const CursorLayer: React.FC<{ f: number; target: [number, number]; pressAt: number; from: [number, number] }> = ({ f, target, pressAt, from }) => {
  const s0 = pressAt - 17;
  if (f < s0 - 4 || f > pressAt + 16) return null;
  const t = ease(f, s0, pressAt - 1 - s0, EASE_MOVE);
  const mid: [number, number] = [mix(from[0], target[0], 0.5) + 70, mix(from[1], target[1], 0.5) - 40];
  const [cx, cy] = bezier(from, mid, target, t);
  const press = interpolate(f, [pressAt - 2, pressAt, pressAt + 4], [0, 1, 0], clamp);
  const o = ease(f, s0 - 4, 5) * (1 - ease(f, pressAt + 8, 6));
  const r = interpolate(f, [pressAt, pressAt + 12], [0, 1], clamp);
  return <Cursor x={cx} y={cy} press={press} ring={r} opacity={o} />;
};

// ───────────── 장면표 ─────────────
type K = 'runs' | 'promise' | 'job' | 'note' | 'gap' | 'fork' | 'path1' | 'path2' | 'billing' | 'share';
type Scene = { k: K; at: number; bg: string; o: [number, number] };
const SCENES: Scene[] = [
  { k: 'runs', at: 0, bg: DARK, o: [476, 120] },
  { k: 'promise', at: VO.h2 - 2, bg: PAPER, o: [476, 360] },
  { k: 'job', at: VO.b1 - 2, bg: DARK, o: [300, 300] },
  { k: 'note', at: VO.b2 - 2, bg: PAPER, o: [476, 300] },
  { k: 'gap', at: VO.b3 - 2, bg: DARK, o: [476, 200] },
  { k: 'fork', at: VO.b4 - 2, bg: PAPER, o: [476, 420] },
  { k: 'path1', at: VO.f1 - 2, bg: PAPER, o: [300, 300] },
  { k: 'path2', at: VO.f2 - 2, bg: DARK, o: [300, 200] },
  { k: 'billing', at: VO.c0 - 2, bg: PAPER, o: [476, 200] },
  { k: 'share', at: VO.cta - 2, bg: PAPER, o: [476, 360] },
];
const sceneAt = (f: number) => {
  let i = 0;
  for (let j = 0; j < SCENES.length; j++) if (f >= SCENES[j].at) i = j;
  return i;
};
const Content: React.FC<{ k: K; f: number; sceneStart: number }> = ({ k, f, sceneStart }) => {
  switch (k) {
    case 'runs':
      return <Runs f={f} />;
    case 'promise':
      return <PromiseCard f={f} />;
    case 'job':
      return <Job f={f} sceneStart={sceneStart} />;
    case 'note':
      return <Note f={f} sceneStart={sceneStart} />;
    case 'gap':
      return <Gap f={f} sceneStart={sceneStart} />;
    case 'fork':
      return <Fork f={f} sceneStart={sceneStart} />;
    case 'path1':
      return <Path1 f={f} />;
    case 'path2':
      return <Path2 f={f} sceneStart={sceneStart} />;
    case 'billing':
      return <Billing f={f} sceneStart={sceneStart} />;
    case 'share':
      return <Share f={f} sceneStart={sceneStart} />;
    default:
      return null;
  }
};

// ───────────── 판 + 밀기 ─────────────
const SEND_AT = () => at('cta', '보내');
const push = (f: number, i: number) => {
  const drift = Math.min(0.08, 0.0007 * Math.max(0, f - SCENES[i].at));
  const punch = interpolate(f - SEND_AT(), [0, 3, 10], [0, 0.012, 0], clamp);
  return 1 + drift + punch;
};
const Panel: React.FC = () => {
  const f = useCurrentFrame();
  const i = sceneAt(f);
  const sc = SCENES[i];
  const p = push(f, i);
  const fadeOut = 1 - ease(f, S.end - 8, 8);
  if (fadeOut <= 0) return null;
  const dark = sc.bg !== PAPER;
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
      {sc.k === 'share' ? <CursorLayer f={f} target={SEND_XY} pressAt={SEND_AT()} from={[760, 600]} /> : null}
    </div>
  );
};

// ───────────── 머리글 ─────────────
type Head = { at: number; lines: string[]; accent?: string; size?: number };
const HEADS = (): Head[] => [
  { at: -1, lines: ['GitHub 무료 2,000분이', '바닥나자, 자동 검사가', '2초 만에 꺼졌어요'], accent: '2초 만에', size: 72 },
  { at: VO.h2 - 3, lines: ['공짜로 다시 돌리는 길 둘,', '남은 시간 보는 곳까지'], accent: '길 둘', size: 74 },
  { at: VO.b1 - 3, lines: ['빨간불인데', '실패한 단계는 0개'], accent: '0개' },
  { at: VO.b2 - 3, lines: ['「결제 실패」? 「한도」?', '무료 2,000분이 바닥'], accent: '바닥', size: 74 },
  { at: VO.b3 - 3, lines: ['하루 넘게 18번,', '빨간 시험 16개'], accent: '16개' },
  { at: VO.b4 - 3, lines: ['2초 만에 끝났다면', '한도부터'], accent: '한도부터' },
  { at: VO.f1 - 3, lines: ['첫째, 감출 게 없으면', '공개 저장소로'], accent: '공개' },
  { at: VO.f2 - 3, lines: ['둘째, 비공개라면', '내 PC를 실행기로'], accent: '내 PC' },
  { at: VO.c0 - 3, lines: ['남은 시간은', 'settings/billing'], accent: 'settings/billing' },
  { at: VO.cta - 3, lines: ['AI로 코딩하는 친구에게', '보내 주세요'], accent: '보내 주세요' },
];
const Heads: React.FC = () => {
  const hs = HEADS();
  return (
    <>
      {hs.map((h, i) => (
        <Line key={i} lines={h.lines} accent={h.accent} at={h.at} until={i + 1 < hs.length ? hs[i + 1].at : S.end} fade={i + 1 === hs.length} size={h.size} top={h.lines.length > 2 ? 264 : undefined} />
      ))}
    </>
  );
};

// ───────────── 판 아래 표시 ─────────────
const LABEL: Record<K, string> = {
  runs: '끝에 검사를 공짜로 다시 돌리는 길 둘을 드려요',
  promise: '끝에 드리는 것',
  job: '실행 하나를 연 화면 · 다시 그림',
  note: '메시지는 원문 · 막대는 결제 화면 값',
  gap: '실제 실행 기록 · 빨강 16개 중 3개는 PC 설정 탓',
  fork: '빨간불 읽는 법',
  path1: 'GitHub 공식 문서 · 우리 기록',
  path2: '실제 실행 기록 · 조심할 것 둘',
  billing: '남은 시간 보는 곳',
  share: '보내 주세요',
};
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - ease(f, S.end - 8, 8);
  if (o <= 0) return null;
  const k = SCENES[sceneAt(f)].k;
  return <div style={{ position: 'absolute', left: 72, top: VP.y + VP.h + 64, fontFamily: KO, fontWeight: 560, fontSize: 25, letterSpacing: '-0.01em', color: DIM, opacity: o }}>{LABEL[k]}</div>;
};

// ───────────── 소리 ─────────────
// 모든 소리에 같은 마스터 값을 곱한다 — Remotion은 합이 0 dBFS를 넘는 표본을 그 자리에서 자른다(현장 노트 영상).
const MASTER = 0.8;
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  { at: SEND_AT(), src: 'sfx/tok.wav', v: 0.3 },
  { at: END_FOLLOW, src: 'sfx/tok.wav', v: 0.42 },
];

export const MinutesFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
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
    return (0.42 - 0.14 * voice) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Panel />
      <Label />
      <Heads />
      <EndGate />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {hits().map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm_cut.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

const EndGate: React.FC = () => {
  const f = useCurrentFrame();
  if (f < S.end) return null;
  return (
    <AbsoluteFill style={{ opacity: ease(f, S.end, 8) }}>
      <EndCard />
    </AbsoluteFill>
  );
};
