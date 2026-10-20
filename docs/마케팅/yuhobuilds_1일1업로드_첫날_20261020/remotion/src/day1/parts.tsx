// 이 편의 판 부품. S22·자동 DM 편처럼 밝은 판 하나가 검정 무대 위에서 혼자 빛나고 끝까지 변형된다.
// 재현 판(대화창·채널 12칸·세션 목록·문서 카드)은 값만 실제이고, 실제 캡처(인스타·틱톡·샤오훙수)는 조율 세션이 찍은 원본을 가려서 쓴다.
// 버터는 한 번에 한 곳.
import React from 'react';
import { Img, interpolate, staticFile } from 'remotion';
import { BUTTER, DIM, INK } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { clamp, IN_OUT, OUT, prog, stagger } from '../lib/motion';
import { API_CMD, API_HEAD, API_ROWS, CHANNELS, CHILDREN, PARENT, QUESTION, SCAN_HEAD, SCAN_ROWS, SCAN_SUB, SESSION_TITLE, TODAY_ROW, type Channel } from './data';

export const PAPER = '#F6F5F1';
export const UI_INK = '#22211E';
export const UI_MUTED = '#8E8B84';
export const RULE = '#E2DFD7';
export const BUBBLE_ME = '#2B2A26';
export const ME_INK = '#F4F2EC';
export const TILE = '#ECEAE4';

/** DM Mono에 없는 →를 SUIT(꺾쇠로 그림) 대신 Inter Tight에서 가져온다. */
export const ARROW_MONO = "'DM Mono', 'Inter Tight', monospace";

const nowrap: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/** 판 위 머리줄: 세션 이름 + 오른쪽 작은 표시. */
export const PanelTop: React.FC<{ title: string; right?: React.ReactNode; dark?: boolean }> = ({ title, right, dark }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 92 }}>
    <div style={{ position: 'absolute', left: 34, top: 26, fontFamily: KO, fontWeight: 680, fontSize: 31, color: dark ? INK : UI_INK, letterSpacing: '-0.02em' }}>{title}</div>
    {right ? <div style={{ position: 'absolute', right: 34, top: 32, fontFamily: MONO, fontSize: 22, color: dark ? DIM : UI_MUTED }}>{right}</div> : null}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 91, height: 1, background: dark ? '#2A2926' : RULE }} />
  </div>
);

/** 오른쪽 짙은 말풍선(유호님). mark는 버터 밑줄 정도. */
export const MeBubble: React.FC<{ parts: { t: string; mark?: number }[]; appear?: number; size?: number; width?: number; time?: string }> = ({ parts, appear = 1, size = 30, width = 780, time }) => {
  if (appear <= 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 14, opacity: Math.min(1, appear * 1.6) }}>
      {time ? <div style={{ fontFamily: MONO, fontSize: 20, color: UI_MUTED, marginBottom: 8 }}>{time}</div> : null}
      <div
        style={{
          maxWidth: width,
          padding: '18px 26px 20px',
          borderRadius: 30,
          background: BUBBLE_ME,
          color: ME_INK,
          fontFamily: KO,
          fontWeight: 560,
          fontSize: size,
          lineHeight: 1.42,
          letterSpacing: '-0.015em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all',
          transform: `scale(${0.94 + 0.06 * Math.min(1, appear)})`,
          transformOrigin: '100% 100%',
        }}
      >
        {parts.map((p, i) => {
          const m = p.mark ?? 0;
          return (
            <span
              key={i}
              style={{
                fontWeight: m > 0 ? 720 : undefined,
                backgroundImage: m > 0 ? `linear-gradient(${BUTTER}, ${BUTTER})` : undefined,
                backgroundSize: m > 0 ? `${m * 100}% 6px` : undefined,
                backgroundPosition: '0 96%',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {p.t}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** 00 질문 줄(대화창 위). */
export const Question: React.FC<{ appear?: number }> = ({ appear = 1 }) => (
  <div style={{ position: 'absolute', left: 30, right: 30, top: 116 }}>
    <MeBubble parts={[{ t: QUESTION }]} appear={appear} size={29} width={800} time="17:35" />
  </div>
);

// ───────────── 채널 12칸 ─────────────
export const TILE_W = 286;
export const TILE_H = 98;
const GAP_X = 16;
const GAP_Y = 14;
export const tilePos = (i: number, top: number) => ({ x: 26 + (i % 3) * (TILE_W + GAP_X), y: top + Math.floor(i / 3) * (TILE_H + GAP_Y) });

/** 한 칸: 플랫폼 · 계정, 오른쪽 「예약 0」. on: 켜진 정도, zero: 「0」이 찍힌 정도, ring: 버터 테두리, badge: 막힌 곳 번호가 붙은 정도. */
export const Tile: React.FC<{ ch: Channel; x: number; y: number; on: number; zero: number; ring?: number; badge?: number; dim?: number }> = ({ ch, x, y, on, zero, ring = 0, badge = 0, dim = 0 }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: TILE_W,
      height: TILE_H,
      borderRadius: 18,
      background: TILE,
      opacity: (0.35 + 0.65 * on) * (1 - 0.55 * dim),
      boxShadow: ring > 0 ? `0 0 0 ${4 * ring}px rgba(245,196,69,0.6)` : undefined,
    }}
  >
    <div style={{ position: 'absolute', left: 20, top: 15, fontFamily: MONO, fontSize: 18, color: UI_MUTED, ...nowrap, width: 196 }}>{ch.p}</div>
    <div style={{ position: 'absolute', left: 20, top: 44, fontFamily: KO, fontWeight: 650, fontSize: 29, color: UI_INK, letterSpacing: '-0.02em', ...nowrap, width: 200 }}>{ch.h}</div>
    {/* 「예약」은 0 위에 작게(계정 이름과 겹치지 않게) */}
    <div style={{ position: 'absolute', right: 16, top: 12, width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: zero, transform: `translateY(${(1 - zero) * 10}px)` }}>
      <span style={{ fontFamily: KO, fontWeight: 600, fontSize: 17, color: UI_MUTED, lineHeight: '22px' }}>예약</span>
      <span style={{ fontFamily: EN, fontWeight: 700, fontSize: 48, color: UI_INK, lineHeight: '52px' }}>0</span>
    </div>
    {badge > 0 && ch.grp ? (
      <div
        style={{
          position: 'absolute',
          right: -18,
          top: -20,
          width: 40,
          height: 40,
          borderRadius: 20,
          background: BUTTER,
          color: '#141412',
          fontFamily: EN,
          fontWeight: 760,
          fontSize: 24,
          lineHeight: '40px',
          textAlign: 'center',
          transform: `scale(${interpolate(badge, [0, 0.6, 1], [0.3, 1.12, 1], clamp)})`,
          opacity: Math.min(1, badge * 2),
        }}
      >
        {ch.grp}
      </div>
    ) : null}
  </div>
);

/** 12칸 전체. checkA~checkB 동안 실제 확인 순서대로 켜진다. ringAt: 「하나도」에 모두 버터 테두리. badgeAt: 막힌 곳 번호. */
export const TileGrid: React.FC<{ f: number; top: number; checkA: number; checkB: number; ringAt?: number; ringOff?: number; badgeAt?: number; all?: boolean }> = ({ f, top, checkA, checkB, ringAt, ringOff, badgeAt, all }) => (
  <>
    {CHANNELS.map((ch, i) => {
      const at = stagger(checkA, i, CHANNELS.length, checkB - checkA, 1);
      const on = all ? 1 : prog(f, at, 6, OUT);
      const zero = all ? 1 : prog(f, at + 5, 7, OUT);
      const ring = ringAt === undefined ? 0 : prog(f, ringAt + Math.round(i * 0.6), 6, OUT) * (ringOff === undefined ? 1 : 1 - prog(f, ringOff, 10, IN_OUT));
      const badge = badgeAt === undefined || !ch.grp ? 0 : prog(f, badgeAt + (ch.grp - 1) * 4, 9, OUT);
      const dim = badgeAt === undefined ? 0 : prog(f, badgeAt, 8, OUT) * (ch.grp ? 0 : 1);
      const { x, y } = tilePos(i, top);
      return <Tile key={i} ch={ch} x={x} y={y} on={on} zero={zero} ring={ring} badge={badge} dim={dim} />;
    })}
  </>
);

// ───────────── 세션 목록(앱 Code 탭 재현) ─────────────
export const ROW_TOP = 108;
export const CHILD_H = 84;
/** childIn(i): 새 세션 줄이 들어온 정도. mark: 셋째 줄(이 편) 테두리. glow: 위 줄 띠. */
export const SessionList: React.FC<{ childIn: (i: number) => number; mark?: number; tag?: number; parentRight?: React.ReactNode; parentGlow?: number }> = ({ childIn, mark = 0, tag = 0, parentRight, parentGlow = 0 }) => (
  <>
    <div style={{ position: 'absolute', left: 40, top: 30, fontFamily: KO, fontWeight: 650, fontSize: 33, color: UI_INK, letterSpacing: '-0.02em' }}>Code</div>
    <div style={{ position: 'absolute', right: 36, top: 38, fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>10-20</div>
    {/* 맨 위: 조율 세션 */}
    <div style={{ position: 'absolute', left: 20, right: 20, top: ROW_TOP, height: 76, borderRadius: 18, background: '#EBE9E3', boxShadow: parentGlow > 0 ? `0 0 0 ${4 * parentGlow}px ${BUTTER}` : undefined }}>
      <div style={{ position: 'absolute', left: 24, top: 31, width: 13, height: 13, borderRadius: 7, background: '#2B2A26' }} />
      <div style={{ position: 'absolute', left: 56, top: 17, fontFamily: KO, fontWeight: 620, fontSize: 31, color: '#2B2A26', letterSpacing: '-0.02em' }}>{PARENT.title}</div>
      <div style={{ position: 'absolute', right: 22, top: 24 }}>{parentRight ?? <span style={{ fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>{PARENT.meta}</span>}</div>
    </div>
    {CHILDREN.map((c, i) => {
      const p = childIn(i);
      if (p <= 0) return null;
      const me = i === 2;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 66,
            right: 20,
            top: ROW_TOP + 90 + i * CHILD_H,
            height: 72,
            borderRadius: 16,
            background: me && mark > 0 ? '#F3EBD3' : undefined,
            boxShadow: me && mark > 0 ? `0 0 0 ${4 * mark}px ${BUTTER}` : undefined,
            opacity: Math.min(1, p * 1.5),
            transform: `translateX(${(1 - p) * -40}px)`,
          }}
        >
          <svg width={26} height={40} viewBox="0 0 26 40" style={{ position: 'absolute', left: -38, top: 2 }}>
            <path d="M4 0 L4 20 Q4 26 10 26 L22 26" fill="none" stroke="#CFCBC2" strokeWidth={2.4} strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', left: 18, top: 30, width: 11, height: 11, borderRadius: 6, background: '#2B2A26' }} />
          <div style={{ position: 'absolute', left: 44, top: 17, width: 690, fontFamily: KO, fontWeight: 560, fontSize: 28.5, color: '#2B2A26', letterSpacing: '-0.02em', ...nowrap }}>{c.title}</div>
          <div style={{ position: 'absolute', right: 20, top: 24, fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>{c.meta}</div>
        </div>
      );
    })}
    {/* 셋째 줄 꼬리표 「지금 이 영상」 */}
    {tag > 0 ? (
      <div
        style={{
          position: 'absolute',
          right: 40,
          top: ROW_TOP + 90 + 2 * CHILD_H + 84,
          padding: '10px 20px',
          borderRadius: 16,
          background: '#2B2A26',
          color: BUTTER,
          fontFamily: KO,
          fontWeight: 700,
          fontSize: 27,
          letterSpacing: '-0.02em',
          opacity: tag,
          transform: `translateY(${(1 - tag) * -12}px)`,
        }}
      >
        ▲ 지금 이 영상
      </div>
    ) : null}
    {/* 다른 세션 줄(흐림) */}
    {[0, 1, 2].map((k) => (
      <div key={k} style={{ position: 'absolute', left: 20, right: 20, top: ROW_TOP + 90 + 3 * CHILD_H + 70 + k * 64, height: 54, opacity: 0.8 }}>
        <div style={{ position: 'absolute', left: 26, top: 21, width: 11, height: 11, borderRadius: 6, background: '#CFCBC2' }} />
        <div style={{ position: 'absolute', left: 56, top: 16, width: 300 + ((k * 97) % 180), height: 22, borderRadius: 11, background: '#DAD6CD', filter: 'blur(3px)' }} />
      </div>
    ))}
  </>
);

/** 세션 줄 하나의 판 안 세로 위치(꼬리표·카드가 출발하는 곳). */
export const childY = (i: number) => ROW_TOP + 90 + i * CHILD_H;

// ───────────── 03 어두운 창(유튜브 API 출력) ─────────────
export const Terminal: React.FC<{ f: number; at: number; markAt: number }> = ({ f, at, markAt }) => {
  const line = (k: number) => prog(f, at + 3 + k * 2, 6, OUT);
  const m = prog(f, markAt, 8, OUT);
  return (
    <>
      <div style={{ position: 'absolute', left: 34, top: 28, fontFamily: MONO, fontSize: 24, color: DIM, opacity: line(0) }}>{API_CMD}</div>
      <div style={{ position: 'absolute', left: 34, top: 82, fontFamily: ARROW_MONO, fontSize: 25, color: INK, opacity: line(1), whiteSpace: 'nowrap' }}>
        <span
          style={{
            backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`,
            backgroundSize: `${m * 100}% 5px`,
            backgroundPosition: '0 100%',
            backgroundRepeat: 'no-repeat',
            paddingBottom: 6,
            color: m > 0.5 ? BUTTER : INK,
          }}
        >
          {API_HEAD}
        </span>
      </div>
      {API_ROWS.map((s, k) => (
        <div key={k} style={{ position: 'absolute', left: 58, top: 136 + k * 44, height: 36, opacity: line(2 + k) * 0.9, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 150, height: 16, borderRadius: 8, background: '#4A4843', filter: 'blur(3px)' }} />
          <div style={{ fontFamily: MONO, fontSize: 22, color: '#A9A69E', width: 110 }}>{s}</div>
          <div style={{ width: 360 - ((k * 53) % 120), height: 16, borderRadius: 8, background: '#3E3C38', filter: 'blur(3px)' }} />
        </div>
      ))}
    </>
  );
};

/** 스튜디오 채널 칩(재현): 이름이 바뀔 때 흐려졌다 또렷해진다. */
export const ChannelChip: React.FC<{ name: string; blur: number; note?: string; noteO?: number; shake?: number; o?: number }> = ({ name, blur, note, noteO = 0, shake = 0, o = 1 }) => (
  <div style={{ position: 'absolute', left: 30, right: 30, top: 446, height: 120, opacity: o }}>
    <div style={{ position: 'absolute', left: 4, top: 0, fontFamily: MONO, fontSize: 21, color: DIM }}>스튜디오 · 채널 전환</div>
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 36,
        width: 640,
        height: 80,
        borderRadius: 22,
        background: '#23221F',
        boxShadow: 'inset 0 0 0 1px #3A3935',
        transform: `translateX(${Math.sin(shake * Math.PI * 4) * 10 * (1 - shake)}px)`,
      }}
    >
      <div style={{ position: 'absolute', left: 18, top: 16, width: 48, height: 48, borderRadius: 24, background: '#5A5852' }} />
      <div style={{ position: 'absolute', left: 84, top: 20, fontFamily: KO, fontWeight: 650, fontSize: 31, color: INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap', filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>{name}</div>
      <svg width={24} height={32} viewBox="0 0 22 30" style={{ position: 'absolute', right: 22, top: 24 }}>
        <path d="M5 11 L11 5 L17 11 M5 19 L11 25 L17 19" fill="none" stroke={DIM} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    {note ? <div style={{ position: 'absolute', left: 664, top: 60, fontFamily: MONO, fontSize: 22, color: DIM, opacity: noteO, whiteSpace: 'nowrap' }}>{note}</div> : null}
  </div>
);

// ───────────── 실제 캡처 ─────────────
/** 캡처 한 장(잘라 키운 판). top~bottom 칸 안에 비율을 지켜 가운데 놓는다(폭 w, 높이 h는 그림의 실제 크기). */
export const Cap: React.FC<{ src: string; w: number; h: number; top?: number; bottom?: number; o?: number; blur?: number; y?: number; bg?: string; maxW?: number; border?: string }> = ({
  src,
  w,
  h,
  top = 0,
  bottom = 0,
  o = 1,
  blur = 0,
  y = 0,
  bg,
  maxW = 952,
  border,
}) =>
  o <= 0 ? null : (
    <div style={{ position: 'absolute', left: 0, right: 0, top, bottom, overflow: 'hidden', opacity: o, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Img
        src={staticFile(src)}
        style={{ width: Math.min(maxW, w), maxHeight: '100%', objectFit: 'contain', display: 'block', transform: y ? `translateY(${y}px)` : undefined, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, borderRadius: 10, boxShadow: border ? `0 0 0 1px ${border}` : undefined }}
      />
    </div>
  );
export const CAP_SIZE: Record<string, [number, number]> = {
  bs: [600, 505],
  ig_sw2: [700, 575],
  ig_cal1: [1200, 480],
  ig_cal2: [1200, 480],
  ig_cal3: [1200, 480],
  tt: [1120, 400],
  xhs: [880, 750],
  rednote: [1464, 350],
};

/** 주소줄(재현). old → 새 주소로 바뀔 때 old가 위로 빠지고 새 주소가 올라온다. mark: rednote 버터 밑줄. */
export const UrlBar: React.FC<{ f: number; text: string; next?: { a: string; b: string; c: string }; swapAt?: number; mark?: number }> = ({ f, text, next, swapAt, mark = 0 }) => {
  const p = next && swapAt !== undefined ? prog(f, swapAt, 8, OUT) : 0;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 74, background: '#E9E7E1', borderBottom: `1px solid ${RULE}` }}>
      <svg width={22} height={26} viewBox="0 0 22 26" style={{ position: 'absolute', left: 30, top: 24 }}>
        <rect x={2} y={11} width={18} height={13} rx={3} fill="none" stroke={UI_MUTED} strokeWidth={2.2} />
        <path d="M6 11 L6 7 Q6 2 11 2 Q16 2 16 7 L16 11" fill="none" stroke={UI_MUTED} strokeWidth={2.2} />
      </svg>
      <div style={{ position: 'absolute', left: 68, top: 0, right: 20, height: 74, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 21, fontFamily: MONO, fontSize: 25, color: UI_INK, whiteSpace: 'nowrap', transform: `translateY(${-50 * p}px)`, opacity: 1 - p }}>{text}</div>
        {next ? (
          <div style={{ position: 'absolute', left: 0, top: 21, fontFamily: MONO, fontSize: 25, color: UI_INK, whiteSpace: 'nowrap', transform: `translateY(${50 * (1 - p)}px)`, opacity: p }}>
            {next.a}
            <span
              style={{
                fontWeight: 700,
                backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`,
                backgroundSize: `${mark * 100}% 6px`,
                backgroundPosition: '0 100%',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {next.b}
            </span>
            {next.c}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 캡처 아래 띠: 왼쪽 계정·설명, 오른쪽 세기. */
export const CapBar: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 86, background: '#141412', borderTop: '1px solid #2A2926' }}>
    <div style={{ position: 'absolute', left: 30, top: 24, fontFamily: KO, fontWeight: 650, fontSize: 30, color: INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{children}</div>
    {right ? <div style={{ position: 'absolute', right: 28, top: 22 }}>{right}</div> : null}
  </div>
);

/** 세기 점 셋(인스타 전환 1·2·3). */
export const Count3: React.FC<{ n: number; flash: number }> = ({ n, flash }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    {[1, 2, 3].map((k) => (
      <div
        key={k}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          background: k <= n ? (k === n ? BUTTER : '#3A3935') : 'transparent',
          boxShadow: k <= n ? undefined : 'inset 0 0 0 2px #3A3935',
          color: k <= n ? (k === n ? '#141412' : INK) : '#6E6C66',
          fontFamily: EN,
          fontWeight: 740,
          fontSize: 24,
          lineHeight: '44px',
          textAlign: 'center',
          transform: k === n ? `scale(${1 + 0.15 * flash})` : undefined,
        }}
      >
        {k}
      </div>
    ))}
  </div>
);

// ───────────── 07 문서 카드(월요일 스캔) ─────────────
const Check: React.FC<{ p: number }> = ({ p }) =>
  p <= 0 ? null : (
    <svg width={40} height={32} viewBox="0 0 40 32">
      <path d="M4 17 L15 27 L36 5" fill="none" stroke={UI_INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={50} strokeDashoffset={50 * (1 - p)} />
    </svg>
  );

export const DocCard: React.FC<{ f: number; at: number; picks: number[]; todayAt: number }> = ({ f, at, picks, todayAt }) => {
  const rowA = (k: number) => prog(f, at + 2 + k * 3, 7, OUT);
  return (
    <>
      <div style={{ position: 'absolute', left: 36, top: 30, fontFamily: MONO, fontSize: 22, color: UI_MUTED }}>{SCAN_HEAD}</div>
      <div style={{ position: 'absolute', left: 36, top: 66, fontFamily: KO, fontWeight: 720, fontSize: 38, color: UI_INK, letterSpacing: '-0.02em' }}>{SCAN_SUB}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 128, height: 1, background: RULE }} />
      {SCAN_ROWS.map((r, k) => {
        const a = rowA(k);
        const pick = r.pick ? prog(f, picks[k - 1] ?? 0, 9, OUT) : 0;
        return (
          <div key={k} style={{ position: 'absolute', left: 24, right: 24, top: 148 + k * 92, height: 80, borderRadius: 16, background: pick > 0 ? `rgba(245,196,69,${0.28 * pick})` : undefined, opacity: a * (r.pick ? 1 : 0.5), transform: `translateY(${(1 - a) * 14}px)` }}>
            <div style={{ position: 'absolute', left: 18, top: 24, fontFamily: MONO, fontSize: 25, color: UI_MUTED }}>{k + 1}</div>
            <div style={{ position: 'absolute', left: 64, top: 19, width: 640, fontFamily: KO, fontWeight: 620, fontSize: 31, color: UI_INK, letterSpacing: '-0.02em', ...nowrap }}>{r.t}</div>
            <div style={{ position: 'absolute', right: 22, top: 24 }}>{r.tag ? <span style={{ fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>{r.tag}</span> : <Check p={pick} />}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 36, right: 36, top: 148 + 3 * 92 + 10, height: 0, borderTop: `2px dashed ${RULE}` }} />
      {(() => {
        const a = prog(f, todayAt - 6, 7, OUT);
        const pick = prog(f, todayAt, 9, OUT);
        return (
          <div style={{ position: 'absolute', left: 24, right: 24, top: 148 + 3 * 92 + 30, height: 80, borderRadius: 16, background: pick > 0 ? `rgba(245,196,69,${0.28 * pick})` : undefined, opacity: a, transform: `translateY(${(1 - a) * 14}px)` }}>
            <div style={{ position: 'absolute', left: 18, top: 24, fontFamily: MONO, fontSize: 25, color: UI_MUTED }}>+</div>
            <div style={{ position: 'absolute', left: 64, top: 19, fontFamily: KO, fontWeight: 620, fontSize: 31, color: UI_INK, letterSpacing: '-0.02em' }}>{TODAY_ROW}</div>
            <div style={{ position: 'absolute', right: 22, top: 24 }}>
              <Check p={pick} />
            </div>
          </div>
        );
      })()}
    </>
  );
};

/** 08 꼬리표 「올리기」: 세션 줄 오른쪽에 한 박에 뜨고, 다음 박에 셋이 한꺼번에 맨 위 줄로 간다. p<0이면 아직 제자리. */
export const PostTag: React.FC<{ fromY: number; p: number; i: number }> = ({ fromY, p, i }) => {
  if (p <= 0 || p >= 1) return null;
  const y = interpolate(p, [0, 1], [fromY + 14, ROW_TOP + 18], { ...clamp, easing: IN_OUT });
  const x = interpolate(p, [0, 1], [700 - i * 10, 560 + i * 34], clamp);
  const o = interpolate(p, [0, 0.15, 0.85, 1], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: x, top: y, padding: '8px 16px', borderRadius: 12, background: '#2B2A26', color: ME_INK, fontFamily: KO, fontWeight: 650, fontSize: 22, opacity: o }}>올리기</div>
  );
};

/** 08 맨 위 줄 오른쪽: 「올리기 · 한 곳씩」 + 지금 올리는 계정 칩. */
export const PostRight: React.FC<{ o: number; name: string; blur: number }> = ({ o, name, blur }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: o }}>
    <span style={{ fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>올리기</span>
    <span style={{ padding: '6px 14px', borderRadius: 12, background: '#2B2A26', color: ME_INK, fontFamily: KO, fontWeight: 650, fontSize: 24, filter: blur > 0.2 ? `blur(${blur}px)` : undefined, whiteSpace: 'nowrap' }}>{name}</span>
  </div>
);

/** 09 7칸 달력: 오늘(10-20 화) ✓, 「매일」에 다음 날 칸이 차례로 테두리를 얻는다. */
const DAYS = [
  ['화', '10-20'],
  ['수', '10-21'],
  ['목', '10-22'],
  ['금', '10-23'],
  ['토', '10-24'],
  ['일', '10-25'],
  ['월', '10-26'],
] as const;
export const DayStrip: React.FC<{ f: number; at: number; everyAt: number; top: number }> = ({ f, at, everyAt, top }) => (
  <div style={{ position: 'absolute', left: 26, right: 26, top, height: 150, display: 'flex', gap: 12 }}>
    {DAYS.map(([d, date], i) => {
      const a = prog(f, at + i * 2, 8, OUT);
      const today = i === 0;
      const ring = today ? 0 : prog(f, everyAt + (i - 1) * 3, 7, OUT);
      return (
        <div
          key={i}
          style={{
            flex: 1,
            height: 150,
            borderRadius: 18,
            background: today ? '#2B2A26' : TILE,
            boxShadow: ring > 0 ? `inset 0 0 0 ${3 * ring}px ${BUTTER}` : undefined,
            opacity: a,
            transform: `translateY(${(1 - a) * 14}px)`,
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, top: 18, textAlign: 'center', fontFamily: KO, fontWeight: 680, fontSize: 30, color: today ? ME_INK : UI_INK }}>{d}</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 58, textAlign: 'center', fontFamily: MONO, fontSize: 18, color: today ? '#B6B3AB' : UI_MUTED }}>{date}</div>
          {today ? (
            <svg width={40} height={32} viewBox="0 0 40 32" style={{ position: 'absolute', left: '50%', marginLeft: -20, top: 96 }}>
              <path d="M4 17 L15 27 L36 5" fill="none" stroke={BUTTER} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <div style={{ position: 'absolute', left: '50%', marginLeft: -14, top: 98, width: 28, height: 28, borderRadius: 14, boxShadow: `inset 0 0 0 2.5px ${ring > 0.5 ? UI_INK : '#CFCBC2'}` }} />
          )}
        </div>
      );
    })}
  </div>
);

export { SESSION_TITLE };
