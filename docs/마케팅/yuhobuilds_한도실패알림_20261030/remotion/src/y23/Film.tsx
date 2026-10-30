// yuhobuilds Y23(10-30) 「AI 자동화가 실패 알림을 71번 — 풀리는 시각까지 쉬고 알림은 한 번만」.
// 원본 Sf8Gu31kEfA(37.9초) 뼈대: 큰 약속 훅 → 실제 화면 → 목록이 쌓이고 큰 숫자 → 이름 공개 → 한 번 설정 → 한도 도달 → 자동 전환 → 이어짐 →
// 정리해 뒀어요 → 끝(밈). 진행자 얼굴 자리는 우리 실제 알림으로 바꿨다(오마주.json 「다르게」).
// 화면의 알림 시각 · 글은 전부 실제 값: 텔레그램 화면에서 모은 71통(../../자료/알림시각.json), 실제 화면 두 장(public/real — 봇 이름 가림).
// 무대는 지난 두 편(Y22 남색 밤 · 가운데 머리글 · 낱말 칩 자막, Y19 밝은 종이 · 왼쪽 큰 머리글)과 다르게: 앞 절반은 붉은 기가 도는 검정 잠금 화면,
// 고친 뒤는 따뜻한 아침 종이색, 자막은 판 위 한 줄씩.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { clamp, IN_OUT, mix, mixColor, prog as ease } from '../lib/motion';
import { ALERTS } from './data.generated';
import { at, B, lineEnd, ORDER, TOTAL, VO, words, type Spoken } from './time';

const MASTER = 0.8;
const INK0 = '#0E0C10';
const GLOW = '#3A0E16';
const CARD = 'rgba(46,42,52,0.92)';
const EDGE = '#4A4552';
const TEXT = '#F6F3F8';
const MUTED = '#A29DAE';
const RED = '#FF4B57';
const AMBER = '#FFC24B';
const PAPER = '#F4EFE6';
const INK = '#17161B';
const INK2 = '#6D675E';
const GREEN = '#1E9E6A';

const X0 = 64;
const W = 1080 - X0 * 2;
const FAILS = ALERTS.fails;
const N = FAILS.length; // 71
/** 「resets Oct 26, 12pm」이 날짜 없이 「resets 12pm」으로 바뀐 첫 통(10-25 오후 12:01). */
const SHORT_FROM = FAILS.findIndex((x) => x.day === '10-25' && x.t === '오후 12:01');
const body = (i: number) => (i >= SHORT_FROM ? "You've hit your weekly limit · resets 12pm" : "You've hit your weekly limit · resets Oct 26, 12pm");


// ───────────── 공용 ─────────────
const Scene: React.FC<{ a: number; b: number; drift?: number; zoom?: number; children: React.ReactNode }> = ({ a, b, drift = 0.22, zoom = 0.0007, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  const k = f - a;
  return <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-drift * k}px) scale(${1 + zoom * k})`, transformOrigin: '50% 40%' }}>{children}</div>;
};

const Bell: React.FC<{ size: number; bg: string; fg?: string }> = ({ size, bg, fg = '#fff' }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.26, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24">
      <path d="M12 3a6 6 0 0 0-6 6v4.2L4.3 16a.8.8 0 0 0 .7 1.2h14a.8.8 0 0 0 .7-1.2L18 13.2V9a6 6 0 0 0-6-6Z" fill={fg} />
      <circle cx="12" cy="20" r="2.1" fill={fg} />
    </svg>
  </div>
);

/** 잠금 화면 알림 한 통(제목은 우리 이름표, 시각 · 본문은 실제 값). */
const Banner: React.FC<{ i: number; light?: boolean; title?: string; text?: string; time?: string; scale?: number; ring?: number }> = ({ i, light = false, title = 'AI 자동화 · 실패', text, time, scale = 1, ring = 0 }) => (
  <div
    style={{
      width: W,
      padding: '26px 30px 28px',
      boxSizing: 'border-box',
      borderRadius: 34,
      background: light ? '#FFFFFF' : CARD,
      boxShadow: light ? `0 18px 44px rgba(60,40,20,0.16), inset 0 0 0 ${ring}px ${GREEN}` : `0 18px 40px rgba(0,0,0,0.45), inset 0 0 0 ${ring ? ring : 1.5}px ${ring ? AMBER : EDGE}`,
      transform: `scale(${scale})`,
      transformOrigin: '50% 0%',
      fontFamily: KO,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <Bell size={58} bg={light ? GREEN : RED} />
      <div style={{ flex: 1, fontWeight: 800, fontSize: 40, color: light ? INK : TEXT, letterSpacing: '-0.02em' }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: 36, color: light ? INK2 : MUTED }}>{time ?? FAILS[i].t}</div>
    </div>
    <div style={{ marginTop: 14, fontFamily: EN, fontWeight: 600, fontSize: 38, lineHeight: 1.28, color: light ? INK : TEXT }}>{text ?? body(i)}</div>
  </div>
);

/** i번째 알림이 화면에 들어오는 프레임 — 앞은 띄엄띄엄, 뒤로 갈수록 몰아친다. */
const stormAt = (i: number, a: number, len: number) => a + Math.round(len * Math.pow(i / (N - 1), 0.42));
/** 훅의 몰아침: 첫 알림은 0프레임에 이미 들어와 있다(첫 화면이 비지 않게). */
const STORM_A = -5;
const STORM_LEN = 80;

/** 알림이 위에서 떨어져 쌓이는 더미. 가장 새 알림이 맨 위에 꽂히고 앞의 알림들을 아래로 밀어낸다. */
const Pile: React.FC<{ a: number; len: number; top: number; fold?: number }> = ({ a, len, top, fold = 0 }) => {
  const f = useCurrentFrame();
  let k = -1;
  for (let i = 0; i < N; i++) if (stormAt(i, a, len) <= f) k = i;
  if (k < 0) return null;
  const shown = [];
  const e0 = ease(f, stormAt(k, a, len), 5);
  const STEP = 196 * (1 - fold);
  for (let d = 0; d < 5 && k - d >= 0; d++) {
    const i = k - d;
    const y = d === 0 ? mix(-240, 0, e0) : 0;
    const off = d === 0 ? 0 : (d - 1 + e0) * STEP;
    const s = 1 - d * 0.02 * (1 - fold);
    const op = d === 0 ? e0 : Math.max(0, 1 - (d - 1 + e0) * 0.2) * (1 - fold);
    shown.push(
      <div key={i} style={{ position: 'absolute', left: X0, top: top + off + y, opacity: op, zIndex: 100 - d, transform: `scale(${s})`, transformOrigin: '50% 0%' }}>
        <Banner i={i} />
      </div>,
    );
  }
  return <>{shown}</>;
};

/** 카운터: a부터 len 동안 1 → 71(알림이 들어오는 프레임과 같은 셈). */
const countAt = (f: number, a: number, len: number) => {
  let k = 0;
  for (let i = 0; i < N; i++) if (stormAt(i, a, len) <= f) k = i + 1;
  return k;
};

// ───────────── 장면들 ─────────────
/** 1 훅(0~2.7초): 실패 알림이 몰아치며 쌓이고 숫자가 71까지. */
const Storm: React.FC = () => {
  const f = useCurrentFrame();
  const n = countAt(f, STORM_A, STORM_LEN);
  const t = 1; // 0초부터 약속이 보이게(첫 화면 = 표지 후보)
  const shake = n >= 60 && n < N ? Math.sin(f * 2.3) * 3 : 0;
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 272, textAlign: 'center', fontFamily: KO, opacity: t, transform: `translateY(${(1 - t) * 20}px)` }}>
        <div style={{ fontWeight: 800, fontSize: 54, color: TEXT, letterSpacing: '-0.03em' }}>AI 자동화가 보낸 실패 알림</div>
        <div style={{ marginTop: 10, fontWeight: 760, fontSize: 38, color: MUTED, letterSpacing: '-0.02em' }}>15분마다 AI를 불러 혼자 일하는 예약 작업</div>
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 382, textAlign: 'center', fontFamily: EN, fontWeight: 800, fontSize: 220, lineHeight: 1, color: RED, letterSpacing: '-0.05em', transform: `translateX(${shake}px)`, textShadow: '0 0 70px rgba(255,75,87,0.45)' }}>
        {n}
        <span style={{ fontFamily: KO, fontSize: 96, marginLeft: 10, letterSpacing: '-0.03em' }}>번</span>
      </div>
      <Pile a={STORM_A} len={STORM_LEN} top={640} />
    </>
  );
};

/** 2 실제 화면(2.7~5.5초): 텔레그램 대화 그대로 한 컷 → 「weekly limit」 줄 확대 → 시각 줄 확대 → 다시 전체, 천천히 내려감. */
const Real: React.FC = () => {
  const f = useCurrentFrame();
  // 화면(1080×2400) 좌표에서 보일 자리: [가운데 x, 가운데 y, 배율]
  const shots: [number, number, number, number][] = [
    [B.real, 540, 960, 1],
    [B.zoomA, 410, 404, 1.42], // 「hit your weekly limit · resets Oct 26,」 줄이 한 화면에 다 들어오게
    [B.zoomB, 880, 1050, 2.0], // 오른쪽 시각 줄(11:31 · 11:46 · 12:01 …)
    [B.pan, 540, 960, 1],
  ];
  let s = shots[0];
  for (const x of shots) if (f >= x[0]) s = x;
  const panY = f >= B.pan ? interpolate(f, [B.pan, B.loop], [0, 420], { ...clamp, easing: IN_OUT }) : 0;
  const [, cx, cy, z] = s;
  const left = 540 - cx * z;
  const top = 900 - (cy + panY) * z;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Img src={staticFile('real/chat_storm.png')} style={{ position: 'absolute', left, top, width: 1080 * z, height: 2400 * z }} />
      <div style={{ position: 'absolute', left: X0, top: 150, padding: '10px 22px 12px', borderRadius: 999, background: 'rgba(14,12,16,0.86)', fontFamily: KO, fontWeight: 800, fontSize: 36, color: TEXT, boxShadow: `inset 0 0 0 2px ${EDGE}` }}>
        실제로 온 알림
      </div>
      {f >= B.pan ? (
        <div style={{ position: 'absolute', left: X0, width: W, top: 1010, display: 'flex', justifyContent: 'center', opacity: ease(f, B.pan, 6) }}>
          <div style={{ padding: '18px 36px 22px', borderRadius: 24, background: 'rgba(14,12,16,0.92)', boxShadow: `inset 0 0 0 3px ${AMBER}`, fontFamily: KO, fontWeight: 900, fontSize: 62, color: TEXT, letterSpacing: '-0.03em' }}>
            같은 실패 알림 · <span style={{ color: AMBER }}>15분마다</span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 3 고리(5.5~7.3초): 15분마다 다시 시작 → 실패 → 알림. */
const Loop: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.loop, 8);
  const spin = interpolate(f, [B.loop, B.night], [0, 300], clamp);
  const nodes = [
    { t: '다시 시작', a: -90 },
    { t: '실패', a: 30, c: RED },
    { t: '알림', a: 150, bell: true },
  ];
  const R = 300;
  const cx = 540;
  const cy = 760;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: p }}>
      <svg width={1080} height={1500} style={{ position: 'absolute', left: 0, top: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={EDGE} strokeWidth={6} strokeDasharray="18 16" />
        <g transform={`rotate(${spin} ${cx} ${cy})`}>
          <path d={`M ${cx + R} ${cy} A ${R} ${R} 0 0 1 ${cx} ${cy + R}`} fill="none" stroke={RED} strokeWidth={10} strokeLinecap="round" />
          <polygon points={`${cx - 4},${cy + R - 22} ${cx - 4},${cy + R + 22} ${cx - 40},${cy + R}`} fill={RED} />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: X0, width: W, top: 190, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 50, color: TEXT, letterSpacing: '-0.03em', wordBreak: 'keep-all' }}>
        이번 주 AI 사용량이 <span style={{ color: RED }}>다 찼는데도</span>
      </div>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: cy - 110, textAlign: 'center', fontFamily: KO }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 150, color: TEXT, lineHeight: 1, letterSpacing: '-0.04em' }}>
          15<span style={{ fontFamily: KO, fontSize: 80 }}>분마다</span>
        </div>
      </div>
      {nodes.map((n, i) => {
        const rad = (n.a * Math.PI) / 180;
        const q = ease(f, B.loop + 4 + i * 5, 7);
        return (
          <div key={i} style={{ position: 'absolute', left: cx + Math.cos(rad) * R - 150, top: cy + Math.sin(rad) * R - 52, width: 300, display: 'flex', justifyContent: 'center', opacity: q, transform: `scale(${0.8 + 0.2 * q})` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 30px 20px', borderRadius: 24, background: n.c ?? '#2A2630', boxShadow: `inset 0 0 0 2px ${n.c ? n.c : EDGE}`, fontFamily: KO, fontWeight: 800, fontSize: 50, color: TEXT }}>
              {n.bell ? <Bell size={50} bg={RED} /> : null}
              {n.t}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 4 밤새(7.3~12.8초): 실제 시각 71줄이 쌓이며 밤이 낮이 된다. 그 사이에 온 다른 메시지 20통(내용은 가림)이 실패 알림 속에 묻힌다 — 11.3초 큰 카드 「71번」. */
type Row = { kind: 'fail' | 'other'; t: string; day: string };
const ROWS: Row[] = (() => {
  const out: Row[] = [];
  FAILS.forEach((x, i) => {
    out.push({ kind: 'fail', t: x.t, day: x.day });
    for (const o of ALERTS.others.rows) if (o.after === i + 1) out.push({ kind: 'other', t: o.t ?? '', day: x.day });
  });
  return out;
})();
const MID_ROW = ROWS.findIndex((r) => r.day === '10-25');
const Night: React.FC = () => {
  const f = useCurrentFrame();
  const a = B.night + 2;
  const end = B.count - 6;
  const M = ROWS.length;
  // 날이 바뀌는 줄(10-25 첫 줄)이 원본 박자 9.5초에 오게 둘로 나눠 쌓는다.
  const rowAt = (j: number) =>
    j < MID_ROW ? a + Math.round((B.midnight - a) * Math.pow(j / MID_ROW, 0.8)) : B.midnight + Math.round((end - B.midnight) * Math.pow((j - MID_ROW) / (M - 1 - MID_ROW), 0.75));
  let k = -1;
  for (let j = 0; j < M; j++) if (rowAt(j) <= f) k = j;
  const ROW = 74;
  const DIV = 70;
  const yOf = (j: number) => j * ROW + (j >= MID_ROW ? DIV : 0);
  const viewTop = 300;
  const viewH = 860;
  const scroll = Math.max(0, yOf(Math.max(0, k)) + ROW - viewH + 40);
  const big = ease(f, B.count, 7);
  const nFail = ROWS.slice(0, k + 1).filter((r) => r.kind === 'fail').length;
  const sun = Math.min(1, Math.max(0, (nFail - 38) / 22)); // 오전 6시 무렵부터 밝아진다
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 170, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: KO, fontWeight: 800, fontSize: 44, color: TEXT }}>
        <span>{k >= MID_ROW ? '10월 25일' : '10월 24일'}</span>
        <span style={{ fontFamily: EN, fontWeight: 900, fontSize: 64, color: RED }}>
          {nFail}
          <span style={{ fontFamily: KO, fontSize: 40, color: MUTED }}> 번째 실패</span>
        </span>
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: viewTop, height: viewH, overflow: 'hidden', borderRadius: 30, background: k >= MID_ROW ? mixColor('#2B2132', '#3A2A26', sun) : '#1A1620', boxShadow: `inset 0 0 0 ${f >= B.midnight && f < B.midnight + 18 ? 6 : 2}px ${f >= B.midnight && f < B.midnight + 18 ? AMBER : EDGE}` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: -scroll + 20 }}>
          {ROWS.map((x, j) => {
            if (j > k) return null;
            const q = ease(f, rowAt(j), 4);
            const other = x.kind === 'other';
            return (
              <React.Fragment key={j}>
                {j === MID_ROW ? (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: yOf(j) - DIV + 8, height: DIV - 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 800, fontSize: 34, color: AMBER }}>
                    ── 날이 바뀜 · 10월 25일 ──
                  </div>
                ) : null}
                <div style={{ position: 'absolute', left: 30, right: 30, top: yOf(j), height: ROW - 10, padding: '0 10px', boxSizing: 'border-box', borderRadius: 16, background: other ? 'rgba(90,150,255,0.16)' : 'transparent', display: 'flex', alignItems: 'center', gap: 22, opacity: q, fontFamily: KO }}>
                  <span style={{ width: 210, fontFamily: KO, fontWeight: 800, fontSize: 38, color: other ? '#9CC0FF' : TEXT, fontVariantNumeric: 'tabular-nums' }}>{x.t}</span>
                  {other ? (
                    <>
                      <span style={{ width: 50, height: 50, borderRadius: 14, background: '#3F6FD8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="28" height="22" viewBox="0 0 28 22">
                          <rect x="1" y="1" width="26" height="20" rx="4" fill="none" stroke="#fff" strokeWidth="2.5" />
                          <path d="M2 3l12 9 12-9" fill="none" stroke="#fff" strokeWidth="2.5" />
                        </svg>
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 36, color: '#9CC0FF' }}>다른 메시지</span>
                      <span style={{ flex: 1, height: 22, borderRadius: 11, background: 'rgba(156,192,255,0.28)', filter: 'blur(3px)' }} />
                    </>
                  ) : (
                    <>
                      <span style={{ width: 50, height: 50, borderRadius: 14, background: RED, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 34 }}>✕</span>
                      <span style={{ fontWeight: 760, fontSize: 36, color: MUTED }}>실패 · 알림</span>
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {big > 0 ? (
        <div style={{ position: 'absolute', left: X0 + 20, width: W - 40, top: 420, padding: '40px 30px 46px', boxSizing: 'border-box', borderRadius: 40, background: '#FFF4F2', textAlign: 'center', fontFamily: KO, opacity: big, transform: `scale(${1.12 - 0.12 * big})`, boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}>
          <div style={{ fontWeight: 800, fontSize: 46, color: INK2 }}>오후 8:46 → 다음 날 오후 3:02</div>
          <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 260, lineHeight: 1.02, color: RED, letterSpacing: '-0.05em' }}>
            71<span style={{ fontFamily: KO, fontSize: 110 }}>번</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 48, color: INK, wordBreak: 'keep-all' }}>
            다른 메시지는 <span style={{ color: '#3F6FD8' }}>그 속에 묻혔다</span>
          </div>
        </div>
      ) : null}
    </>
  );
};

/** 5 답은 알림 안에(12.8~16.7초): 알림 한 통 → 14.6초 「resets Oct 26, 12pm」 확대 · 뜻. */
const Twist: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.twist, 8);
  const z = ease(f, B.twist2, 9);
  const hl = ease(f, B.twist2 + 4, 8);
  return (
    <>
      <div style={{ position: 'absolute', left: X0, width: W, top: 230, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 58, color: TEXT, opacity: p, letterSpacing: '-0.03em' }}>
        답은 <span style={{ color: AMBER }}>알림 안에</span> 있었다
      </div>
      <div style={{ position: 'absolute', left: X0, top: mix(420, 380, z), opacity: p, transform: `scale(${mix(1, 1.0, z)})` }}>
        <div style={{ width: W, padding: '30px 32px 34px', boxSizing: 'border-box', borderRadius: 34, background: CARD, boxShadow: `inset 0 0 0 1.5px ${EDGE}`, fontFamily: KO }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Bell size={58} bg={RED} />
            <div style={{ flex: 1, fontWeight: 800, fontSize: 40, color: TEXT }}>AI 자동화 · 실패</div>
            <div style={{ fontWeight: 700, fontSize: 36, color: MUTED }}>{FAILS[0].t}</div>
          </div>
          <div style={{ marginTop: 18, fontFamily: EN, fontWeight: 650, fontSize: mix(44, 50, z), lineHeight: 1.3, color: mixColor(TEXT, MUTED, hl) }}>
            You've hit your weekly limit ·{' '}
            <span style={{ whiteSpace: 'nowrap', color: mixColor(TEXT, INK, hl), background: hl > 0 ? `rgba(255,194,75,${hl})` : 'transparent', borderRadius: 12, padding: '0 10px 4px', boxShadow: hl > 0 ? `0 0 0 ${4 * hl}px ${AMBER}` : undefined }}>resets Oct 26, 12pm</span>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 760, textAlign: 'center', fontFamily: KO, opacity: hl, transform: `translateY(${(1 - hl) * 24}px)` }}>
        <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 90, color: AMBER, lineHeight: 1 }}>↓</div>
        <div style={{ marginTop: 16, fontWeight: 900, fontSize: 84, color: TEXT, letterSpacing: '-0.04em', lineHeight: 1.15 }}>
          10월 26일 낮 12시에
          <br />
          <span style={{ color: AMBER }}>풀린다</span>
        </div>
      </div>
    </>
  );
};

/** 6 고친 규칙(16.7~18.9초). */
const Rule: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.rule, 8);
  const lines = ['오류 글에서 풀리는 시각 읽기', '그 시각까지 쉬기', '알림은 처음 한 번만'];
  const step = [B.rule + 4, at('v5', '시각까지'), at('v5', '알림은')];
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 300, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 52, color: AMBER, marginBottom: 26, letterSpacing: '-0.03em' }}>이렇게 고쳤다</div>
      <div style={{ padding: '24px 34px 30px', borderRadius: 34, background: '#FBF7EE', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        {lines.map((t, i) => {
          const q = ease(f, step[i], 7);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '24px 0', borderTop: i ? '2px solid #E5DDCC' : undefined, opacity: mix(0.25, 1, q), fontFamily: KO }}>
              <span style={{ width: 66, height: 66, borderRadius: 33, background: q > 0.5 ? GREEN : '#CFC6B4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: EN, fontWeight: 900, fontSize: 40, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontWeight: 850, fontSize: 56, color: INK, letterSpacing: '-0.03em' }}>{t}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 7 고친 뒤 첫 알림 — 실제 화면(18.9~20.8초): 마지막 실패(오후 3:02) 다음 오후 3:04 「…다시 보내지 않아요」. */
const Rest: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.rest, 7);
  const hl = ease(f, B.rest + 2, 6);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: 190, width: 1080, height: 1053, opacity: p }}>
        <Img src={staticFile('real/chat_rest.png')} style={{ width: 1080, height: 1053 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 650, background: `rgba(0,0,0,${0.55 * hl})` }} />
        <div style={{ position: 'absolute', left: 14, top: 656, width: 790, height: 380, borderRadius: 30, boxShadow: `0 0 0 ${6 * hl}px ${GREEN}` }} />
      </div>
      <div style={{ position: 'absolute', left: X0, top: 110, padding: '10px 22px 12px', borderRadius: 999, background: 'rgba(14,12,16,0.86)', fontFamily: KO, fontWeight: 800, fontSize: 36, color: TEXT, boxShadow: `inset 0 0 0 2px ${EDGE}` }}>
        고친 뒤 첫 알림 · 실제 화면
      </div>
    </AbsoluteFill>
  );
};

/** 8 고친 뒤(20.8~29.1초): 저절로 다시 → 며칠 뒤 또 한도 → 알림 딱 한 번 → 71 대 1. 아침 종이색 무대. */
const After: React.FC = () => {
  const f = useCurrentFrame();
  if (f < B.again) return <Resume />;
  if (f < B.one) return <Again />;
  if (f < B.versus) return <One />;
  return <Versus p={ease(f, B.versus, 8)} />;
};

/** 8-1 쉬는 동안(20.8~23.0초): 오후 3:04 쉬기 시작 → 다음 날 낮 12:00 풀림 → 12:01 저절로 다시. 그동안 실패 알림 0. */
const Resume: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.resume, 8);
  const fill = interpolate(f, [B.resume + 4, B.resume + 36], [0, 1], { ...clamp, easing: IN_OUT });
  const ok = ease(f, B.resume + 38, 8);
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 300, opacity: p, fontFamily: KO }}>
      <div style={{ fontWeight: 800, fontSize: 50, color: INK2, textAlign: 'center' }}>쉬는 동안 실패 알림</div>
      <div style={{ fontFamily: EN, fontWeight: 900, fontSize: 200, lineHeight: 1, color: GREEN, textAlign: 'center', letterSpacing: '-0.05em' }}>
        0<span style={{ fontFamily: KO, fontSize: 84 }}>번</span>
      </div>
      <div style={{ marginTop: 50, padding: '34px 34px 38px', borderRadius: 30, background: '#FFFFFF', boxShadow: '0 14px 40px rgba(60,40,20,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 36, color: INK2 }}>
          <span>10월 25일 오후 3:04</span>
          <span>10월 26일 낮 12:00</span>
        </div>
        <div style={{ position: 'relative', height: 30, marginTop: 20, borderRadius: 15, background: '#EFE8DA' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, borderRadius: 15, background: '#B9D9C8' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, fontWeight: 850, fontSize: 46, color: INK }}>
          <span>쉬기 시작</span>
          <span>풀림</span>
        </div>
      </div>
      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: ok, transform: `scale(${1.1 - 0.1 * ok})` }}>
        <span style={{ width: 80, height: 80, borderRadius: 40, background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, fontWeight: 900 }}>✓</span>
        <span style={{ fontWeight: 900, fontSize: 64, color: INK, letterSpacing: '-0.03em' }}>12:01 저절로 다시 돎</span>
      </div>
    </div>
  );
};

/** 8-2 이틀 뒤 또 한도(23.0~24.8초). */
const Again: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.again, 7);
  const bar = interpolate(f, [B.again + 2, B.again + 30], [0.35, 1], { ...clamp, easing: IN_OUT });
  const full = bar >= 0.999;
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 380, opacity: p, fontFamily: KO, textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: 50, color: INK2 }}>이틀 뒤 · 10월 28일 오전 12:46</div>
      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', fontWeight: 850, fontSize: 46, color: INK }}>
        <span>이번 주 AI 사용량</span>
        <span style={{ fontFamily: EN, color: full ? RED : INK }}>{Math.round(bar * 100)}%</span>
      </div>
      <div style={{ marginTop: 16, height: 96, borderRadius: 48, background: '#E4DCCB', overflow: 'hidden', boxShadow: full ? `0 0 0 6px ${RED}` : undefined }}>
        <div style={{ width: `${bar * 100}%`, height: '100%', borderRadius: 48, background: full ? RED : '#E89A5A' }} />
      </div>
      <div style={{ marginTop: 40, fontWeight: 900, fontSize: 120, color: full ? RED : INK, letterSpacing: '-0.04em' }}>{full ? '또 한도' : '사용량…'}</div>
    </div>
  );
};

/** 8-3 알림 딱 한 번(24.8~26.8초). */
const One: React.FC = () => {
  const f = useCurrentFrame();
  const one = ease(f, B.one, 8);
  return (
    <>
      <div style={{ position: 'absolute', left: X0, top: mix(260, 420, one), opacity: one }}>
        <Banner i={0} light title="AI 자동화 · 쉬는 중" time={ALERTS.again.t} text="11월 2일 12:00까지 쉬어요. 그동안 이 알림은 다시 보내지 않아요." ring={4} scale={1.04} />
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 800, textAlign: 'center', opacity: one, fontFamily: KO, fontWeight: 900, fontSize: 110, color: GREEN, letterSpacing: '-0.04em' }}>알림 딱 한 번</div>
    </>
  );
};

const Versus: React.FC<{ p: number }> = ({ p }) => {
  const f = useCurrentFrame();
  const fill = interpolate(f, [B.versus + 4, B.versus + 34], [0, N], clamp);
  const cell = 52;
  const gap = 10;
  const cols = 12;
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 230, opacity: p, fontFamily: KO }}>
      <div style={{ fontWeight: 800, fontSize: 46, color: INK2 }}>한도 한 번에 온 실패 알림</div>
      <div style={{ marginTop: 28, padding: '28px 30px 30px', borderRadius: 30, background: '#FFFFFF', boxShadow: '0 14px 40px rgba(60,40,20,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 850, fontSize: 50, color: INK }}>고치기 전</span>
          <span style={{ fontFamily: EN, fontWeight: 900, fontSize: 88, color: RED }}>
            {Math.round(fill)}
            <span style={{ fontFamily: KO, fontSize: 48 }}>번</span>
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap, marginTop: 18, width: cols * (cell + gap) }}>
          {Array.from({ length: N }, (_, i) => (
            <div key={i} style={{ width: cell, height: cell * 0.62, borderRadius: 8, background: i < fill ? RED : '#EFE8DA' }} />
          ))}
        </div>
      </div>
      <div style={{ marginTop: 26, padding: '28px 30px 30px', borderRadius: 30, background: '#FFFFFF', boxShadow: `0 14px 40px rgba(60,40,20,0.12), inset 0 0 0 4px ${GREEN}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 850, fontSize: 50, color: INK }}>고친 뒤</span>
          <span style={{ fontFamily: EN, fontWeight: 900, fontSize: 88, color: GREEN }}>
            1<span style={{ fontFamily: KO, fontSize: 48 }}>번</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap, marginTop: 18 }}>
          <div style={{ width: cell, height: cell * 0.62, borderRadius: 8, background: GREEN }} />
        </div>
      </div>
    </div>
  );
};

/** 9 글에 그대로(29.1~33.8초): 고친 규칙 한 단락 카드. */
const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.cta, 8);
  const hl = ease(f, B.cta2, 8);
  const pop = ease(f, B.cta2, 5); // 원본 박자 31.5초 — 「영상 아래 글에 그대로」가 서며 카드가 위로
  return (
    <div style={{ position: 'absolute', left: X0, width: W, top: 230 - 60 * pop, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, fontFamily: KO }}>
      <div style={{ fontWeight: 800, fontSize: 48, color: INK2 }}>자동화를 만드는 AI에 붙일 한 단락</div>
      <div style={{ marginTop: 24, padding: '34px 36px 40px', borderRadius: 30, background: '#FFFFFF', boxShadow: '0 20px 50px rgba(60,40,20,0.14)', fontWeight: 700, fontSize: 42, lineHeight: 1.5, color: INK }}>
        이 자동화가 AI 사용 한도에 걸려 실패하면 —
        <br />① 오류 글에서 <b style={{ background: `rgba(255,194,75,${0.25 + 0.55 * hl})`, padding: '0 6px' }}>풀리는 시각</b>을 읽고, 그때까지 다시 실행하지 마.
        <br />② 실패 알림은 <b style={{ background: `rgba(30,158,106,${0.12 + 0.3 * hl})`, padding: '0 6px' }}>처음 한 번만</b>.
        <br />③ 시각이 지나면 저절로 다시.
        <div style={{ marginTop: 12, color: INK2, fontSize: 36 }}>…</div>
      </div>
      <div style={{ marginTop: 34, textAlign: 'center', fontWeight: 900, fontSize: 66 + 24 * pop, color: INK, letterSpacing: '-0.03em', opacity: pop, padding: '20px 0', borderRadius: 26, background: f >= B.cta2 ? '#DFF1E7' : 'transparent' }}>
        영상 아래 글에 <span style={{ color: GREEN }}>그대로</span>
      </div>
    </div>
  );
};

/** 10 끝(33.8~37.9초): 71통이 다시 몰아쳤다가 35.2초에 한 통으로 접힌다 — 가장 센 장면을 끝에 한 번 더. */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const fold = ease(f, B.fold, 5);
  const n = f < B.fold ? countAt(f, B.end, B.fold - B.end - 6) : Math.round(mix(N, 1, fold));
  const one = ease(f, B.fold + 8, 10);
  const mark = ease(f, B.settle, 8);
  return (
    <>
      <AbsoluteFill style={{ background: INK0, opacity: 1 - fold }} />
      {f >= B.settle ? <AbsoluteFill style={{ background: '#DCEFE3' }} /> : null}
      <div style={{ position: 'absolute', left: X0, width: W, top: 230, textAlign: 'center', fontFamily: EN, fontWeight: 900, fontSize: 230, lineHeight: 1, letterSpacing: '-0.05em', color: mixColor(RED, GREEN, fold) }}>
        {n}
        <span style={{ fontFamily: KO, fontSize: 92 }}>번</span>
      </div>
      {f < B.fold + 10 ? (
        <div style={{ opacity: 1 - fold }}>
          <Pile a={B.end} len={B.fold - B.end - 6} top={540} fold={fold} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: X0, top: 560, opacity: one, transform: `translateY(${(1 - one) * -40}px)` }}>
        <Banner i={0} light title="AI 자동화 · 쉬는 중" time={ALERTS.again.t} text="11월 2일 12:00까지 쉬어요. 그동안 이 알림은 다시 보내지 않아요." ring={4} />
      </div>
      {/* 끝 줄(v8)은 자막 대신 크게 — 「일흔한 번이,」 빨강 → 「한 번으로.」 초록 */}
      <div style={{ position: 'absolute', left: X0, width: W, top: 880, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 96, lineHeight: 1.18, letterSpacing: '-0.04em' }}>
        <div style={{ color: RED, opacity: ease(f, VO.v8 - 2, 6) }}>71번이,</div>
        <div style={{ color: GREEN, opacity: ease(f, at('v8', '한') - 2, 6) }}>한 번으로.</div>
      </div>
      <div style={{ position: 'absolute', left: X0, width: W, top: 1150, textAlign: 'center', opacity: mark, fontFamily: EN, fontWeight: 700, fontSize: 34, color: INK2 }}>@yuhobuilds</div>
    </>
  );
};

// ───────────── 자막: 판 위에 지금 줄 한 줄 ─────────────
const Caption: React.FC = () => {
  const f = useCurrentFrame();
  // 판은 다음 줄이 올 때까지 남긴다(줄 사이에 판이 꺼졌다 켜지면 그것도 화면이 바뀌는 박자가 된다 — 원본 박자 수에 맞춤).
  const id = [...ORDER].reverse().find((x) => f >= VO[x] - 2) as Spoken | undefined;
  if (!id || id === 'v8' || f >= B.end) return null; // 끝 줄은 End 장면이 크게 쓴다
  const light = f >= B.resume && f < B.end + 20 ? true : f >= B.fold;
  const ws = words(id);
  const p = ease(f, VO[id] - 2, 5);
  return (
    <div style={{ position: 'absolute', left: 70, width: 850, top: 1250, display: 'flex', justifyContent: 'center', opacity: p }}>
      <div style={{ maxWidth: 850, padding: '16px 30px 20px 36px', borderRadius: 18, background: light ? 'rgba(16,64,44,0.94)' : 'rgba(74,16,26,0.94)', borderLeft: `10px solid ${light ? '#4FD49A' : RED}`, fontFamily: KO, fontWeight: 800, fontSize: 48, lineHeight: 1.3, letterSpacing: '-0.025em', textAlign: 'center', wordBreak: 'keep-all', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        {ws.map((w, i) => {
          const said = f >= VO[id] + Math.round(w[1] * 30);
          return (
            <span key={i} style={{ color: said ? '#FFFFFF' : 'rgba(255,255,255,0.42)' }}>
              {w[0]}
              {i < ws.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ───────────── 소리 ─────────────
/** 훅 · 끝의 띵: 들어오는 알림마다(2프레임보다 가까우면 하나로), 뒤로 갈수록 작게. */
const dings = (a: number, len: number, vol: number) => {
  const out: { at: number; v: number }[] = [];
  let last = -9;
  for (let i = 0; i < N; i++) {
    const t = stormAt(i, a, len);
    if (t - last < 2) continue;
    last = t;
    out.push({ at: t, v: vol * (1 - 0.5 * (i / N)) });
  }
  return out;
};
const DINGS = [...dings(STORM_A, STORM_LEN, 0.32), ...dings(B.end, B.fold - B.end - 6, 0.22)].map((d) => ({ ...d, at: Math.max(0, d.at) })).filter((d, i, all) => i === 0 || d.at !== all[i - 1].at);
type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  { at: B.real, src: 'sfx/tok.wav', v: 0.22 },
  { at: B.loop, src: 'sfx/swish.wav', v: 0.13 },
  { at: B.night, src: 'sfx/snap.wav', v: 0.12 },
  { at: B.count, src: 'sfx/thud.wav', v: 0.26 },
  { at: B.twist, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.twist2 + 4, src: 'sfx/tick2.wav', v: 0.16 },
  { at: B.rule, src: 'sfx/tok.wav', v: 0.2 },
  { at: B.rest, src: 'sfx/ding.wav', v: 0.2 },
  { at: B.resume, src: 'sfx/tick.wav', v: 0.14 },
  { at: B.again + 30, src: 'sfx/thud.wav', v: 0.2 },
  { at: B.one, src: 'sfx/calm.wav', v: 0.3 },
  { at: B.versus, src: 'sfx/snap.wav', v: 0.12 },
  { at: B.cta, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.fold, src: 'sfx/calm.wav', v: 0.32 },
];

// ───────────── 본편 ─────────────
export const LimitFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const f = useCurrentFrame();
  const voice = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number]);
  const calm = interpolate(f, [B.resume - 4, B.resume + 6], [0, 1], clamp) * (f >= B.end ? 0 : 1) + (f >= B.end ? 1 : 0);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 15);
    const v = Math.max(0, ...voice.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    const storm = fr < B.real || (fr >= B.end && fr < B.fold) ? 1 : 0; // 띵이 몰아치는 동안은 배경음을 뺀다
    const hush = interpolate(fr, [B.rest - 6, B.rest, B.rest + 40, B.rest + 50], [1, 0.5, 0.5, 1], clamp);
    return (0.34 - 0.13 * v) * (1 - 0.8 * storm) * hush * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: mixColor(INK0, PAPER, calm) }}>
      <AbsoluteFill style={{ background: `radial-gradient(110% 60% at 50% 30%, ${GLOW} 0%, rgba(14,12,16,0) 70%)`, opacity: 1 - calm }} />
      <Scene a={0} b={B.real}>
        <Storm />
      </Scene>
      <Scene a={B.real} b={B.loop} drift={0} zoom={0.0012}>
        <Real />
      </Scene>
      <Scene a={B.loop} b={B.night}>
        <Loop />
      </Scene>
      <Scene a={B.night} b={B.twist} drift={0.1} zoom={0.0006}>
        <Night />
      </Scene>
      <Scene a={B.twist} b={B.rule}>
        <Twist />
      </Scene>
      <Scene a={B.rule} b={B.rest}>
        <Rule />
      </Scene>
      <Scene a={B.rest} b={B.resume} drift={0} zoom={0.0004}>
        <Rest />
      </Scene>
      <Scene a={B.resume} b={B.cta} drift={0.22}>
        <After />
      </Scene>
      <Scene a={B.cta} b={B.end} drift={0.22}>
        <Cta />
      </Scene>
      <Scene a={B.end} b={TOTAL} drift={0.15} zoom={0.0008}>
        <End />
      </Scene>
      <Caption />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {DINGS.map((d, i) => (
        <Sequence key={`d${i}`} from={d.at} durationInFrames={24} layout="none">
          <Audio src={staticFile('sfx/ding.wav')} volume={d.v * MASTER} />
        </Sequence>
      ))}
      {HITS.map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

/** 표지: 2.5초 장면(71통 더미 · 「71번」). */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: INK0 }}>
    <AbsoluteFill style={{ background: `radial-gradient(110% 60% at 50% 30%, ${GLOW} 0%, rgba(14,12,16,0) 70%)` }} />
    <Sequence from={-Math.round(2.6 * 30)} layout="none">
      <Storm />
    </Sequence>
  </AbsoluteFill>
);
