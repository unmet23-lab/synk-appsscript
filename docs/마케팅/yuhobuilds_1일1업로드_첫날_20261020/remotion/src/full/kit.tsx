// 본편 공용 부품. 시험판(src/film)의 값·문법을 그대로 옮겨 장면 여러 곳에서 쓴다.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EN, KO, MONO } from '../lib/fonts';
import { IN, IN_OUT, mix, mixColor, OUT, prog } from '../lib/motion';
import { BUTTER, DIM, INK, STAGE, Word } from '../film/parts';
import { HERE, LOG_TAIL, PLACES, ROWS, type LogLine } from './data';

export { BUTTER, DIM, INK, STAGE };
export const PAPER = '#F6F5F1';
export const UI_INK = '#22211E';
export const UI_MUTED = '#9B988F';
export const WINDOW = '#161614';
export const WINDOW_EDGE = '#34322D';
export const NEW_ROW = '#F8DF95';
export const LEFT = 72;
export const TOP = 300;
export const HEAD: React.CSSProperties = { fontFamily: KO, fontWeight: 740, fontSize: 88, lineHeight: 1.13, letterSpacing: '-0.035em', color: INK };
export const SP = ' ';

// ───────────── 상자 ─────────────
export type Box = { x: number; y: number; w: number; h: number; r: number };
export const lerpBox = (a: Box, b: Box, t: number): Box => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t), r: mix(a.r, b.r, t) });
export const BOX_SIDE: Box = { x: 84, y: 610, w: 1120, h: 700, r: 32 };
export const BOX_LOG: Box = { x: 56, y: 820, w: 1110, h: 470, r: 26 };
export const BOX_ROWS: Box = { x: 64, y: 650, w: 952, h: 560, r: 22 };
export const BOX_STATUS: Box = { x: 56, y: 600, w: 1110, h: 700, r: 26 };
export const BOX_E_LOG: Box = { x: 56, y: 640, w: 1110, h: 610, r: 26 };
export const CARD_W = 308;
export const CARD_H = 400;
export const cardBox = (i: number): Box => ({ x: 64 + i * (CARD_W + 14), y: 650, w: CARD_W, h: CARD_H, r: 22 });

/**
 * 판 하나. paper(밝은 판 불투명도)와 dark(어두운 창이 덮은 정도 0~1)를 따로 받아,
 * 밝은 판 → 어두운 창 전환이 색 섞임(회색) 없이 아래(또는 위)에서 덮으며 일어난다.
 */
export const Shell: React.FC<{
  box: Box;
  paper?: number;
  dark?: number;
  darkFrom?: 'bottom' | 'top';
  darkOpacity?: number;
  ry?: number;
  rx?: number;
  outline?: string;
  children?: React.ReactNode;
  over?: React.ReactNode;
}> = ({ box, paper = 0, dark = 0, darkFrom = 'bottom', darkOpacity = 1, ry = 0, rx = 0, outline, children, over }) => {
  const clip = dark >= 1 ? undefined : darkFrom === 'bottom' ? `inset(${(1 - dark) * 100}% 0 0 0 round ${box.r}px)` : `inset(0 0 ${(1 - dark) * 100}% 0 round ${box.r}px)`;
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2400 }}>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, transform: ry || rx ? `rotateY(${ry}deg) rotateX(${rx}deg)` : undefined, transformOrigin: 'left center' }}>
        {paper > 0 ? <div style={{ position: 'absolute', inset: 0, borderRadius: box.r, background: PAPER, opacity: paper }} /> : null}
        {dark > 0 && darkOpacity > 0 ? (
          <div style={{ position: 'absolute', inset: 0, borderRadius: box.r, background: WINDOW, boxShadow: `inset 0 0 0 1px ${WINDOW_EDGE}`, clipPath: clip, opacity: darkOpacity }} />
        ) : null}
        {outline ? <div style={{ position: 'absolute', inset: 0, borderRadius: box.r, boxShadow: outline, pointerEvents: 'none' }} /> : null}
        <div style={{ position: 'absolute', inset: 0, borderRadius: box.r, overflow: 'hidden' }}>{children}</div>
        {over}
      </div>
    </div>
  );
};

/** 내용 층을 짧은 흐림으로 바꾼다(들어옴 inP, 나감 outP). */
export const Swap: React.FC<{ inP?: number; outP?: number; children: React.ReactNode }> = ({ inP = 1, outP = 0, children }) => {
  if (inP <= 0 || outP >= 1) return null;
  const b = 10 * Math.max(1 - inP, outP);
  return <div style={{ position: 'absolute', inset: 0, opacity: inP * (1 - outP), filter: b > 0.3 ? `blur(${b}px)` : undefined }}>{children}</div>;
};

// ───────────── 머리글 ─────────────
/** 낱말: 글자, 들어오는 프레임, (있으면) 버터로 바뀌는 프레임. */
export type HW = { t: string; at: number; accent?: number };
/** 머리글 한 벌. out이 있으면 그 프레임부터 6프레임 안에 위로 빠진다(두 낱말마다 1프레임씩 늦게). */
export const Headline: React.FC<{ lines: HW[][]; out?: number; top?: number; style?: React.CSSProperties }> = ({ lines, out, top = TOP, style }) => {
  const f = useCurrentFrame();
  let k = 0;
  return (
    <div style={{ position: 'absolute', left: LEFT, top, ...HEAD, ...style }}>
      {lines.map((ws, li) => (
        <div key={li}>
          {ws.map((w, wi) => {
            const idx = k++;
            const color = w.accent === undefined ? undefined : mixColor(INK, BUTTER, prog(f, w.accent, 6, OUT));
            return (
              <React.Fragment key={wi}>
                {wi > 0 ? SP : null}
                <Word at={w.at} out={out === undefined ? undefined : out + Math.floor(idx / 2)} outLen={6} style={color ? { color } : undefined}>
                  {w.t}
                </Word>
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** 머리글 아래 왼쪽 한 줄(모노 기록이나 버터 결과 줄). */
export const SubLine: React.FC<{ at: number; out?: number; top: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, out, top, children, style }) => (
  <div style={{ position: 'absolute', left: LEFT, top, ...style }}>
    <Word at={at} out={out} outLen={6}>
      {children}
    </Word>
  </div>
);

/** 무대 아래 고정 표시. hideAt부터 빠진다(끝 화면의 실제 얼굴·핸들 밑에는 남기지 않는다). */
export const StageLabel: React.FC<{ hideAt?: number }> = ({ hideAt }) => {
  const f = useCurrentFrame();
  const o = hideAt === undefined ? 1 : 1 - prog(f, hideAt, 6, IN);
  if (o <= 0) return null;
  return <div style={{ position: 'absolute', left: LEFT, top: 1360, fontFamily: MONO, fontSize: 26, color: DIM, opacity: o }}>재현 화면 · 숫자는 실제</div>;
};

// ───────────── 사이드바(Code 탭 세션 목록 재현) ─────────────
export type SideRowT = { title: string; meta: string; isNew?: boolean };
export const SIDE_ROWS: SideRowT[] = ROWS;
export const SIDE_ROWS_AFTER: SideRowT[] = [{ title: '세션 공유 영상 다듬기', meta: '방금', isNew: true }, ...ROWS.slice(0, 4)];

/** 목록 줄. drain(0~1)이면 아래로 빠지며 흐려진다. dim은 다시 읽을 때의 깜빡임. */
/** newGlow: 새 세션 줄 띠가 켜진 정도(0이면 맨 윗줄 보통 띠, 기본 1). */
export const SideRows: React.FC<{ rows: SideRowT[]; drain?: (i: number) => number; dim?: number; newGlow?: number }> = ({ rows, drain, dim = 0, newGlow = 1 }) => (
  <>
    {rows.map((row, i) => {
      const p = drain ? drain(i) : 0;
      if (p >= 1) return null;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 22,
            top: 108 + i * 88,
            width: 990,
            height: 76,
            borderRadius: 18,
            background: row.isNew ? (newGlow >= 1 ? NEW_ROW : mixColor('#EBE9E3', NEW_ROW, newGlow)) : i === 0 ? '#EBE9E3' : undefined,
            opacity: (1 - p) * (1 - 0.3 * dim),
            transform: `translateY(${34 * p}px)`,
            filter: p > 0.01 ? `blur(${12 * p}px)` : undefined,
          }}
        >
          <div style={{ position: 'absolute', left: 26, top: 32, width: 13, height: 13, borderRadius: 7, background: row.isNew || i === 0 ? '#2B2A26' : '#CFCBC2' }} />
          <div style={{ position: 'absolute', left: 60, top: 15, fontFamily: KO, fontWeight: 560, fontSize: 33, color: '#2B2A26', filter: 'blur(6px)', whiteSpace: 'nowrap' }}>{row.title}</div>
          <div style={{ position: 'absolute', left: 850, top: 24, fontFamily: MONO, fontSize: 23, color: UI_MUTED, filter: 'blur(4px)' }}>{row.meta}</div>
        </div>
      );
    })}
  </>
);

/** 머리줄: Code + (있으면) 5시간 한도 막대. fullColor는 막대가 가득 찼을 때 색(기본 버터). */
export const SideHeader: React.FC<{ meter?: number; meterShow?: number; fullColor?: string }> = ({ meter = 0, meterShow = 0, fullColor = BUTTER }) => (
  <>
    <div style={{ position: 'absolute', left: 46, top: 32, fontFamily: KO, fontWeight: 650, fontSize: 34, color: UI_INK, letterSpacing: '-0.02em' }}>Code</div>
    {meterShow > 0 ? (
      <div style={{ position: 'absolute', left: 520, top: 34, width: 430, height: 40, opacity: meterShow }}>
        <div style={{ position: 'absolute', left: 0, top: 4, fontFamily: KO, fontWeight: 600, fontSize: 25, color: UI_MUTED }}>5시간 한도</div>
        <div style={{ position: 'absolute', left: 150, top: 14, width: 260, height: 14, borderRadius: 7, background: '#E2DFD7', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%`, height: '100%', borderRadius: 7, background: meter >= 0.999 ? fullColor : '#2B2A26' }} />
        </div>
      </div>
    ) : null}
  </>
);

/** 아래 계정 칩. swapBlur는 글자가 바뀌는 순간의 흐림. */
export const SideChip: React.FC<{ label: string; avatar: string; hover?: number; swapBlur?: number }> = ({ label, avatar, hover = 0, swapBlur = 0 }) => (
  <>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 556, height: 1, background: '#E2DFD7' }} />
    <div style={{ position: 'absolute', left: 22, top: 574, width: 330, height: 96, borderRadius: 20, background: `rgba(0,0,0,${0.06 * hover})` }} />
    <div style={{ position: 'absolute', left: 42, top: 590, width: 300, height: 64 }}>
      <div style={{ position: 'absolute', left: 0, top: 2, width: 60, height: 60, borderRadius: 30, background: avatar }} />
      <div style={{ position: 'absolute', left: 80, top: 9, fontFamily: KO, fontWeight: 650, fontSize: 35, color: UI_INK, letterSpacing: '-0.02em', filter: swapBlur > 0.2 ? `blur(${swapBlur}px)` : undefined }}>
        {label}
      </div>
      <svg width={24} height={32} viewBox="0 0 22 30" style={{ position: 'absolute', left: 206, top: 16 }}>
        <path d="M5 11 L11 5 L17 11 M5 19 L11 25 L17 19" fill="none" stroke={UI_MUTED} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  </>
);
export const AVATARS: Record<string, string> = { '계정 1': '#D9D3C6', '계정 2': '#C3CBCB', '계정 3': '#D6CBBE' };

/** 칩 글자 교체: at에서 3프레임 흐려졌다가 바뀌고 3프레임 안에 또렷해진다. */
export const chipSwap = (f: number, at: number) => (f < at ? 0 : f < at + 3 ? (6 * (f - at)) / 3 : f < at + 6 ? 6 - (6 * (f - at - 3)) / 3 : 0);

// ───────────── 로그 줄 ─────────────
export const LogRow: React.FC<{ l: LogLine; top: number; opacity?: number; blur?: number; timeColor?: string; bg?: number; size?: number }> = ({ l, top, opacity = 1, blur = 0, timeColor = '#6E6C66', bg = 0, size = 20 }) => (
  <div
    style={{
      position: 'absolute',
      left: 16,
      right: 0,
      top,
      height: 36,
      paddingLeft: 14,
      borderRadius: 8,
      background: bg > 0 ? `rgba(244,242,236,${0.06 * bg})` : undefined,
      whiteSpace: 'nowrap',
      fontFamily: MONO,
      fontSize: size,
      lineHeight: '36px',
      opacity,
      filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
    }}
  >
    <span style={{ color: timeColor }}>{l.time}</span>
    <span style={{ color: '#B6B3AB' }}> [error] </span>
    <span style={{ color: DIM }}>Failed to save session {l.id}</span>
    <span style={{ color: DIM }}>: </span>
    <span style={{ color: INK }}>Refusing non-directory</span>
    <span style={{ color: '#5E5C57' }}>{LOG_TAIL.slice(24)}</span>
  </div>
);

export const LogTitle: React.FC<{ name?: string }> = ({ name = 'main.log' }) => (
  <>
    <div style={{ position: 'absolute', left: 30, top: 22, fontFamily: MONO, fontSize: 22, color: DIM }}>{name}</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 1, background: '#2A2926' }} />
  </>
);

// ───────────── 폴더 카드(03·04·05·08) ─────────────
export const FolderGlyph: React.FC<{ color?: string }> = ({ color = UI_INK }) => (
  <svg width={28} height={22} viewBox="0 0 28 22" style={{ position: 'absolute', left: 18, top: 24 }}>
    <path d="M2 4 Q2 2 4 2 L10 2 L13 5 L24 5 Q26 5 26 7 L26 18 Q26 20 24 20 L4 20 Q2 20 2 18 Z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
  </svg>
);
export const ChainGlyph: React.FC<{ left: number; top: number; color?: string }> = ({ left, top, color = UI_INK }) => (
  <svg width={30} height={18} viewBox="0 0 30 18" style={{ position: 'absolute', left, top }}>
    <rect x={2} y={4} width={14} height={10} rx={5} fill="none" stroke={color} strokeWidth={2.2} />
    <rect x={14} y={4} width={14} height={10} rx={5} fill="none" stroke={color} strokeWidth={2.2} />
  </svg>
);

/**
 * 폴더 하나의 목록(축소판). rows: 목록 줄이 보이는 정도, pointer: 링크로 바뀐 정도(본거지 경로를 가리킴).
 */
export const FolderCard: React.FC<{ id: string; rows: number; pointer?: number; target?: string; seed?: number }> = ({ id, rows, pointer = 0, target, seed = 0 }) => (
  <>
    <FolderGlyph />
    <div style={{ position: 'absolute', left: 56, top: 24, fontFamily: MONO, fontSize: 20, color: UI_INK, whiteSpace: 'nowrap' }}>{id}</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 66, height: 1, background: '#E2DFD7' }} />
    {rows > 0
      ? ROWS.map((r, i) => (
          <div key={i} style={{ position: 'absolute', left: 16, top: 84 + i * 58, width: CARD_W - 32, height: 46, opacity: rows * (1 - 0.85 * pointer) }}>
            <div style={{ position: 'absolute', left: 6, top: 19, width: 9, height: 9, borderRadius: 5, background: '#CFCBC2' }} />
            <div style={{ position: 'absolute', left: 26, top: 9, fontFamily: KO, fontWeight: 560, fontSize: 21, color: '#2B2A26', filter: 'blur(4px)', whiteSpace: 'nowrap' }}>
              {ROWS[(i + seed) % ROWS.length].title}
            </div>
          </div>
        ))
      : null}
    {pointer > 0 && target ? (
      <div style={{ position: 'absolute', left: 0, right: 0, top: 84, height: 60, opacity: pointer }}>
        <ChainGlyph left={20} top={12} />
        <div style={{ position: 'absolute', left: 60, top: 8, fontFamily: MONO, fontSize: 19, color: UI_INK, whiteSpace: 'nowrap' }}>→ {target}</div>
      </div>
    ) : null}
  </>
);

// ───────────── 25곳 칸(09·10a) ─────────────
export const TW = 166; // 오른쪽 열이 릴스 단추 줄(x 960 넘음)에 걸리지 않게
export const TS = TW / 176;
export const TH = 118 * TS;
export const TG = 16;
export const GX = 64;
export const GY = 600;
export const VIEWPORT = 'linear-gradient(to bottom, transparent 548px, #000 600px, #000 1250px, transparent 1300px)';
export const coord = (j: number) => ({ col: j % 5, row: Math.floor(j / 5) });
export const dist = (j: number) => {
  const a = coord(j);
  const b = coord(HERE);
  return Math.hypot(a.col - b.col, a.row - b.row);
};
export const HX = GX + coord(HERE).col * (TW + TG) + TW / 2;
export const HY = GY + coord(HERE).row * (TH + TG) + TH / 2;

export const Tile: React.FC<{ j: number; f: number; arrive: number }> = ({ j, f, arrive }) => {
  const { col, row } = coord(j);
  const here = j === HERE;
  const q = prog(f, arrive, 9, OUT);
  const flash = prog(f, arrive, 3, OUT) * (1 - prog(f, arrive + 3, 16, IN_OUT));
  const [a, b] = PLACES[j].split('/');
  const pitch = 17;
  return (
    <div style={{ position: 'absolute', left: GX + col * (TW + TG), top: GY + row * (TH + TG), width: TW, height: TH, borderRadius: 7 * TS, background: PAPER, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 176, height: 118, transform: `scale(${TS})`, transformOrigin: '0 0' }}>
        <div style={{ position: 'absolute', left: 10, top: 7, fontFamily: KO, fontWeight: 650, fontSize: 7.6, color: UI_INK }}>Code</div>
        <div style={{ position: 'absolute', left: 98, top: 8.6, fontFamily: MONO, fontSize: 6, color: here ? UI_INK : UI_MUTED, whiteSpace: 'nowrap' }}>
          {here ? '★ ' : ''}
          {a}····/{b}····
        </div>
        <div
          style={{
            position: 'absolute',
            left: 5,
            top: 21,
            width: 166,
            height: 15,
            borderRadius: 4,
            background: NEW_ROW,
            boxShadow: flash > 0 ? `0 0 0 1.2px rgba(245,196,69,${flash})` : undefined,
            opacity: q,
            transform: `translateX(${-8 * (1 - q)}px)`,
          }}
        >
          <div style={{ position: 'absolute', left: 6, top: 6, width: 3.4, height: 3.4, borderRadius: 2, background: '#2B2A26' }} />
          <div style={{ position: 'absolute', left: 13, top: 3, fontFamily: KO, fontWeight: 600, fontSize: 7, color: '#2B2A26', filter: 'blur(1.25px)', whiteSpace: 'nowrap' }}>세션 공유 영상 다듬기</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 20, height: 76, overflow: 'hidden' }}>
          {ROWS.slice(0, 4).map((r, i) => (
            <div key={i} style={{ position: 'absolute', left: 5, top: 1 + (i + q) * pitch, width: 166, height: 15 }}>
              <div style={{ position: 'absolute', left: 6, top: 6, width: 3.4, height: 3.4, borderRadius: 2, background: '#CFCBC2' }} />
              <div style={{ position: 'absolute', left: 13, top: 3, fontFamily: KO, fontWeight: 560, fontSize: 7, color: '#2B2A26', filter: 'blur(1.25px)', whiteSpace: 'nowrap' }}>{r.title}</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 97, height: 0.6, background: '#E2DFD7' }} />
        <div style={{ position: 'absolute', left: 10, top: 103, width: 9, height: 9, borderRadius: 5, background: '#D9D3C6' }} />
      </div>
    </div>
  );
};

// ───────────── 카메라·넘김 ─────────────
export const Cam: React.FC<{ s: number; ox: number; oy: number; children: React.ReactNode }> = ({ s, ox, oy, children }) => (
  <AbsoluteFill style={{ transform: Math.abs(s - 1) > 1e-4 ? `scale(${s})` : undefined, transformOrigin: `${ox}px ${oy}px` }}>{children}</AbsoluteFill>
);

/** 두 장면이 한 장으로 이어 붙은 채 위로 넘어간다(14프레임, 흐림은 가운데에서만 3px). */
export const stripP = (f: number, at: number) => prog(f, at, 14, IN_OUT);
const stripBlur = (p: number) => 3 * (1 - Math.abs(2 * p - 1));
export const StripOut: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const p = stripP(f, at);
  if (p >= 1) return null;
  const b = stripBlur(p);
  return <AbsoluteFill style={{ transform: p > 0 ? `translateY(${-1920 * p}px)` : undefined, filter: b > 0.3 ? `blur(${b}px)` : undefined }}>{children}</AbsoluteFill>;
};
export const StripIn: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = stripP(f, at);
  const b = stripBlur(p);
  return <AbsoluteFill style={{ transform: p < 1 ? `translateY(${1920 * (1 - p)}px)` : undefined, filter: b > 0.3 ? `blur(${b}px)` : undefined }}>{children}</AbsoluteFill>;
};

export const monoStyle = (size = 22, color = INK): React.CSSProperties => ({ fontFamily: MONO, fontSize: size, color, whiteSpace: 'nowrap' });
export const enStyle = (size: number, weight = 650, color = INK): React.CSSProperties => ({ fontFamily: EN, fontSize: size, fontWeight: weight, color, letterSpacing: '-0.01em' });
export { IN, IN_OUT, OUT };
