// 세션 공유 편 움직임 시험판(01A·06·09, 12.5초).
// 세션 목록 판 하나가 끊기지 않고 변형된다: 목록이 텅 빔(01A) → 같은 판이 로그 창이 되어 거절 1,086번 → 세션 줄 21개가 흐려짐(06)
// → 화면 한 장이 위로 넘어가면 지금 계정의 목록에 바짝 붙어 있고, 새 세션이 들어온 뒤 카메라가 물러나며 25곳이 드러나고 같은 줄이 퍼짐(09).
// 머리글은 카메라 밖, 판·목록은 카메라 안. v6: Fable 검수(「고쳐서」) 반영.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO, MONO } from '../lib/fonts';
import { bezier, clamp, IN, IN_OUT, mix, mixColor, OUT, prog, stagger } from '../lib/motion';
import { HERE, LOG_FIRST, LOG_LAST, LOG_MASKED, LOG_TAIL, PLACES, RANGE, RECORD, REFUSALS, ROWS, UNSAVED, type LogLine } from './data';
import { BUTTER, Cursor, DIM, INK, Odometer, STAGE, Word } from './parts';
import { A, B, C, TOTAL, VO } from './time';

const LEFT = 72;
const TOP = 300;
const HEAD: React.CSSProperties = { fontFamily: KO, fontWeight: 740, fontSize: 88, lineHeight: 1.13, letterSpacing: '-0.035em', color: INK };
const PAPER = '#F6F5F1';
const UI_INK = '#22211E';
const UI_MUTED = '#9B988F';
const WINDOW = '#161614';
const WINDOW_EDGE = '#34322D';
const NEW_ROW = '#F8DF95'; // 새 세션 줄 바탕(버터를 종이에 섞은 색)
const SP = ' ';

// ───────────────────────── 판(세션 목록 → 로그 창 → 세션 줄 자리) ─────────────────────────

type Box = { x: number; y: number; w: number; h: number; r: number };
const BOX_A: Box = { x: 84, y: 610, w: 1120, h: 700, r: 32 };
const BOX_B: Box = { x: 56, y: 820, w: 1110, h: 470, r: 26 };
const BOX_C: Box = { x: 64, y: 650, w: 952, h: 560, r: 22 };

const panelAt = (f: number) => {
  const ab = prog(f, B.start, 15, OUT);
  const bc = prog(f, B.fold, 14, OUT);
  const k = (key: keyof Box) => mix(mix(BOX_A[key], BOX_B[key], ab), BOX_C[key], bc);
  // 첫 1초 안에 기울어진 판이 펴지며 다가온다(떠 있는 3D 카드로 오래 두지 않는다)
  const settle = prog(f, 0, 31, OUT);
  return { x: k('x'), y: k('y'), w: k('w'), h: k('h'), r: k('r'), ry: mix(-12, 0, settle), rx: mix(5, 0, settle) };
};

/** 01A: Code 탭 세션 목록(재현). 제목은 가림 흐림. */
const Sidebar: React.FC<{ f: number }> = ({ f }) => {
  // 계정 칩: 뒤집지 않고 글만 짧은 흐림으로 바뀐다
  const swapBlur = interpolate(f, [A.click, A.click + 3, A.click + 6], [0, 6, 0], clamp);
  const second = f >= A.click + 3;
  const hover = prog(f, 20, 6, OUT) * (1 - prog(f, A.click + 12, 8, OUT));
  // 커서: 계정 칩으로 곡선을 그리며 가서 누르고, 목록이 비는 동안 비켜난다
  const go = prog(f, 1, 23, OUT);
  const away = prog(f, A.click + 9, 18, IN_OUT);
  const [cx0, cy0] = bezier([600, 330], [400, 650], [176, 606], go);
  const cx = mix(cx0, 470, away);
  const cy = mix(cy0, 420, away);
  const press = prog(f, A.click - 3, 3, OUT) * (1 - prog(f, A.click + 1, 4, OUT));
  const ring = interpolate(f, [A.click - 2, A.click + 12], [0, 1], clamp);
  const cursorOpacity = 1 - prog(f, A.empty - 14, 12, IN);
  return (
    <>
      <div style={{ position: 'absolute', left: 46, top: 32, fontFamily: KO, fontWeight: 650, fontSize: 34, color: UI_INK, letterSpacing: '-0.02em' }}>Code</div>
      {ROWS.map((row, i) => {
        const p = prog(f, stagger(A.drain, i, ROWS.length, 21), 9, IN);
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
              background: i === 0 ? '#EBE9E3' : undefined,
              opacity: 1 - p,
              transform: `translateY(${34 * p}px)`,
              filter: p > 0.01 ? `blur(${12 * p}px)` : undefined,
            }}
          >
            <div style={{ position: 'absolute', left: 26, top: 32, width: 13, height: 13, borderRadius: 7, background: i === 0 ? '#2B2A26' : '#CFCBC2' }} />
            <div style={{ position: 'absolute', left: 60, top: 15, fontFamily: KO, fontWeight: 560, fontSize: 33, color: '#2B2A26', filter: 'blur(6px)', whiteSpace: 'nowrap' }}>{row.title}</div>
            {/* 오른쪽 시각도 지어낸 값이라 가린다(무대 표시 「숫자는 실제」와 어긋나지 않게) */}
            <div style={{ position: 'absolute', left: 850, top: 24, fontFamily: MONO, fontSize: 23, color: UI_MUTED, filter: 'blur(4px)' }}>{row.meta}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 556, height: 1, background: '#E2DFD7' }} />
      <div style={{ position: 'absolute', left: 22, top: 574, width: 330, height: 96, borderRadius: 20, background: `rgba(0,0,0,${0.06 * hover})` }} />
      <div style={{ position: 'absolute', left: 42, top: 590, width: 300, height: 64 }}>
        <div style={{ position: 'absolute', left: 0, top: 2, width: 60, height: 60, borderRadius: 30, background: second ? '#C3CBCB' : '#D9D3C6' }} />
        <div style={{ position: 'absolute', left: 80, top: 9, fontFamily: KO, fontWeight: 650, fontSize: 35, color: UI_INK, letterSpacing: '-0.02em', filter: swapBlur > 0.2 ? `blur(${swapBlur}px)` : undefined }}>
          {second ? '계정 2' : '계정 1'}
        </div>
        <svg width={24} height={32} viewBox="0 0 22 30" style={{ position: 'absolute', left: 206, top: 16 }}>
          <path d="M5 11 L11 5 L17 11 M5 19 L11 25 L17 19" fill="none" stroke={UI_MUTED} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <Cursor x={cx} y={cy} press={press} ring={ring} opacity={cursorOpacity} />
    </>
  );
};

const LOG_STREAM: LogLine[] = [...LOG_FIRST, ...Array.from({ length: 40 }, () => LOG_MASKED), ...LOG_LAST];
const LOG_FROM = B.start + 9; // 98 첫 줄
const FAST_END = B.land - 5;

/** 로그 창에 쌓인 줄 수(소수 = 올라가는 중). 첫 줄 → 처음 넷은 또박또박 → 가운데는 빠르게 → 끝 셋은 착지. */
const appended = (f: number) => {
  if (f < LOG_FROM) return 0;
  if (f < B.log) return (f - LOG_FROM) / (B.log - LOG_FROM);
  if (f < B.log + 8) return 1 + (3 * (f - B.log)) / 8;
  if (f < FAST_END) return 4 + 40 * IN_OUT(Math.min(1, (f - B.log - 8) / (FAST_END - B.log - 8)));
  return 44 + 3 * prog(f, FAST_END, 5, OUT);
};

/** 거절 수(실제 1,086)는 줄이 지나간 만큼 오른다. */
const refusals = (f: number) => {
  if (f < LOG_FROM) return 0;
  if (f < B.log) return (f - LOG_FROM) / (B.log - LOG_FROM);
  if (f < B.log + 8) return 1 + (3 * (f - B.log)) / 8;
  if (f < FAST_END) return 4 + (REFUSALS - 7) * IN_OUT(Math.min(1, (f - B.log - 8) / (FAST_END - B.log - 8)));
  return REFUSALS - 3 + 3 * prog(f, FAST_END, 5, OUT);
};

const LogRow: React.FC<{ l: LogLine; top: number; opacity?: number; blur?: number; timeColor?: string; bg?: number }> = ({ l, top, opacity = 1, blur = 0, timeColor = '#6E6C66', bg = 0 }) => (
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
      fontSize: 20,
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

/**
 * 06: main.log 실제 거절 줄(가림 규칙 적용). 흐르는 동안은 가운데 줄의 시각·ID를 가리고,
 * 착지하면 「실제 앞 넷 · ··· 1,079줄 ··· · 실제 끝 셋」으로 접는다(똑같은 가림 줄이 나란히 멈춰 있지 않게).
 */
const Log: React.FC<{ f: number }> = ({ f }) => {
  const n = appended(f);
  const speed = n - appended(f - 1);
  const blur = Math.min(9, speed * 3.2);
  const fold = prog(f, B.land + 3, 8, OUT);
  const focus = prog(f, B.focus, 8, OUT);
  return (
    <>
      <div style={{ position: 'absolute', left: 30, top: 22, fontFamily: MONO, fontSize: 22, color: DIM }}>main.log</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 1, background: '#2A2926' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 66, bottom: 0, overflow: 'hidden' }}>
        {fold < 1 ? (
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - fold, filter: fold > 0.01 ? `blur(${8 * fold}px)` : undefined }}>
            {LOG_STREAM.map((l, i) => {
              const row = 10 - (n - 1 - i);
              if (row < -1.2 || row > 11.2 || i >= Math.ceil(n)) return null;
              const fresh = Math.min(1, n - i); // 새 줄은 막 들어오며 밝아진다
              return <LogRow key={i} l={l} top={6 + row * 36} opacity={0.35 + 0.65 * fresh} blur={blur} />;
            })}
          </div>
        ) : null}
        {fold > 0 ? (
          <div style={{ position: 'absolute', inset: 0, opacity: fold, filter: fold < 0.99 ? `blur(${8 * (1 - fold)}px)` : undefined }}>
            {LOG_FIRST.map((l, r) => (
              <LogRow key={`a${r}`} l={l} top={58 + r * 36} opacity={1 - 0.5 * focus} />
            ))}
            <div style={{ position: 'absolute', left: 30, top: 58 + 4 * 36, fontFamily: MONO, fontSize: 20, lineHeight: '36px', color: DIM, opacity: 1 - 0.5 * focus }}>
              ··· {(REFUSALS - LOG_FIRST.length - LOG_LAST.length).toLocaleString('en-US')}줄 ···
            </div>
            {LOG_LAST.map((l, r) => (
              <LogRow key={`z${r}`} l={l} top={58 + (5 + r) * 36} timeColor={focus > 0 ? `rgba(244,242,236,${0.45 + 0.55 * focus})` : '#6E6C66'} bg={focus} />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
};

/** 06 둘째 박: 링크 건 계정으로 일한 세션 줄 21개. 깔린 뒤 한 줄씩 흐려진다(회색 판으로 바꾸지 않는다). */
const UnsavedRows: React.FC<{ f: number }> = ({ f }) => {
  const W = 308;
  const H = 66;
  const GX = 14;
  const GY = 14;
  return (
    <>
      {Array.from({ length: UNSAVED }, (_, k) => {
        const col = k % 3;
        const row = Math.floor(k / 3);
        const p = prog(f, stagger(B.rows, k, UNSAVED, 6), 9, OUT);
        const q = prog(f, stagger(B.grey, k, UNSAVED, B.greyEnd - B.grey, 0.85), 7, OUT);
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: col * (W + GX),
              top: row * (H + GY),
              width: W,
              height: H,
              borderRadius: 16,
              background: PAPER,
              opacity: p * (1 - 0.82 * q),
              transform: `translateY(${(1 - p) * 14}px)`,
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', left: 20, top: 27, width: 11, height: 11, borderRadius: 6, background: '#CFCBC2' }} />
            <div style={{ position: 'absolute', left: 44, top: 16, fontFamily: KO, fontWeight: 560, fontSize: 23, color: '#2B2A26', filter: 'blur(4px)', whiteSpace: 'nowrap' }}>
              {ROWS[(k * 2 + 1) % ROWS.length].title}
            </div>
          </div>
        );
      })}
    </>
  );
};

const Panel: React.FC = () => {
  const f = useCurrentFrame();
  const g = panelAt(f);
  const sideOut = prog(f, B.start, 6, IN);
  // 어두운 로그 창은 아래에서 위로 덮으며 올라오고, 밝은 판은 같이 사라진다(섞인 회색·가장자리 흰 띠가 남지 않게)
  const dark = prog(f, B.start + 1, 9, OUT);
  const logIn = prog(f, B.start + 6, 8, OUT);
  const logOut = prog(f, B.fold, 4, IN);
  const darkFade = prog(f, B.fold + 2, 10, IN_OUT);
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2400 }}>
      <div
        style={{
          position: 'absolute',
          left: g.x,
          top: g.y,
          width: g.w,
          height: g.h,
          transform: `rotateY(${g.ry}deg) rotateX(${g.rx}deg)`,
          transformOrigin: 'left center',
        }}
      >
        {dark < 1 ? <div style={{ position: 'absolute', inset: 0, borderRadius: g.r, background: PAPER, opacity: 1 - dark }} /> : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: g.r,
            background: WINDOW,
            boxShadow: `inset 0 0 0 1px ${WINDOW_EDGE}`,
            clipPath: dark < 1 ? `inset(${(1 - dark) * 100}% 0 0 0 round ${g.r}px)` : undefined,
            opacity: 1 - darkFade,
          }}
        />
        <div style={{ position: 'absolute', inset: 0, borderRadius: g.r, overflow: 'hidden' }}>
          {sideOut < 1 ? (
            <div style={{ position: 'absolute', inset: 0, opacity: 1 - sideOut, filter: sideOut > 0.01 ? `blur(${10 * sideOut}px)` : undefined }}>
              <Sidebar f={f} />
            </div>
          ) : null}
          {logIn > 0 && logOut < 1 ? (
            <div style={{ position: 'absolute', inset: 0, opacity: logIn * (1 - logOut), filter: logIn < 0.99 || logOut > 0.01 ? `blur(${10 * Math.max(1 - logIn, logOut)}px)` : undefined }}>
              <Log f={f} />
            </div>
          ) : null}
        </div>
        {f >= B.rows ? <UnsavedRows f={f} /> : null}
      </div>
    </div>
  );
};

// ───────────────────────── 머리글(카메라 밖) ─────────────────────────

// 장면이 바뀔 때 앞 머리글은 박 4프레임 전부터 6프레임 안에 빠지고, 다음 머리글은 그 뒤에 들어온다(같은 자리에서 겹치지 않게).
const HeadA: React.FC = () => {
  const f = useCurrentFrame();
  const o = B.start - 4;
  const accentStyle: React.CSSProperties = { color: mixColor(INK, BUTTER, prog(f, A.accent, 6, OUT)) };
  return (
    <div style={{ position: 'absolute', left: LEFT, top: TOP, ...HEAD }}>
      <div>
        <Word at={-30} out={o} outLen={6}>Claude</Word>{SP}<Word at={-30} out={o} outLen={6}>계정</Word>{SP}<Word at={-30} out={o + 1} outLen={6}>바꿨더니,</Word>
      </div>
      <div>
        <Word at={-30} out={o + 1} outLen={6}>세션이</Word>{SP}
        <Word at={-30} out={o + 2} outLen={6} style={accentStyle}>다</Word>{SP}
        <Word at={-30} out={o + 2} outLen={6} style={accentStyle}>사라졌어요</Word>
      </div>
    </div>
  );
};

const HeadB: React.FC = () => {
  const f = useCurrentFrame();
  const o = B.fold - 4;
  return (
    <>
      <div style={{ position: 'absolute', left: LEFT, top: TOP, ...HEAD }}>
        <Word at={B.start + 6} out={o} outLen={6}>로그엔</Word>{SP}<Word at={B.start + 10} out={o} outLen={6}>같은</Word>{SP}<Word at={B.start + 14} out={o + 1} outLen={6}>거절이</Word>
      </div>
      <div style={{ position: 'absolute', left: LEFT - 10, top: TOP + 106, display: 'flex', alignItems: 'flex-end' }}>
        <Word at={B.log - 3} out={o + 1} outLen={6}>
          <Odometer value={refusals(f)} prev={refusals(f - 1)} digits={4} size={280} color={BUTTER} dim="#1A1917" comma />
        </Word>
        <Word at={B.log} out={o + 2} outLen={6} style={{ fontFamily: KO, fontWeight: 720, fontSize: 112, color: INK, marginLeft: 14, paddingBottom: 30 }}>
          번
        </Word>
      </div>
      <div style={{ position: 'absolute', left: LEFT, top: TOP + 390, fontFamily: MONO, fontSize: 34, color: '#B9B6AE' }}>
        <Word at={B.range} out={o - 2} outLen={6}>{RANGE}</Word>
      </div>
    </>
  );
};

const HeadB2: React.FC = () => (
  <div style={{ position: 'absolute', left: LEFT, top: TOP, ...HEAD }}>
    <div>
      <Word at={179}>두</Word>{SP}<Word at={182}>시간,</Word>{SP}<Word at={201}>세션</Word>{SP}<Word at={210}>{UNSAVED}개가</Word>
    </div>
    <div>
      <Word at={225}>저장이</Word>{SP}<Word at={233}>안</Word>{SP}<Word at={237}>됐어요</Word>
    </div>
  </div>
);

/** 다시 터지는 박에 결과 한 줄(가운데 알약이 아니라 머리글과 같은 왼쪽 줄에, 버터 글자로). */
const Stamp: React.FC = () => (
  <div style={{ position: 'absolute', left: LEFT, top: 1222, fontFamily: KO, fontWeight: 740, fontSize: 56, letterSpacing: '-0.03em', color: BUTTER }}>
    <Word at={B.stamp}>저장 안 됨 · {UNSAVED}개</Word>
  </div>
);

// ───────────────────────── 09: 25곳의 같은 목록 ─────────────────────────

const TW = 166; // 오른쪽 열이 릴스 단추 줄(x 960 넘음)에 걸리지 않게
const TS = TW / 176; // 칸 안은 176×118 기준으로 짜고 줄여 넣는다
const TH = 118 * TS;
const TG = 16;
const GX = 64;
const GY = 600;
const coord = (j: number) => ({ col: j % 5, row: Math.floor(j / 5) });
const dist = (j: number) => {
  const a = coord(j);
  const b = coord(HERE);
  return Math.hypot(a.col - b.col, a.row - b.row);
};
// 아래 끝은 5.6배일 때 밑 칸(1312부터)이 회색 띠로 비치지 않게 1300에서 닫는다. 1배 격자는 1224에서 끝난다.
const VIEWPORT = 'linear-gradient(to bottom, transparent 548px, #000 600px, #000 1250px, transparent 1300px)';
const HX = GX + coord(HERE).col * (TW + TG) + TW / 2;
const HY = GY + coord(HERE).row * (TH + TG) + TH / 2;
/** 칸마다 새 세션이 꽂히는 프레임: 지금 계정 칸이 먼저, 나머지는 가까운 칸부터. */
const arrive = (j: number) => (j === HERE ? C.add : C.ripple + 4 + Math.round(dist(j) * 8));

/**
 * 한 곳의 Code 탭 목록(축소판). 처음엔 카메라가 5.6배로 붙어 있어 실제 목록처럼 읽힌다.
 * 새 세션 줄은 맨 위에 들어오고 아래 줄은 한 칸씩 밀린다.
 */
const Tile: React.FC<{ j: number; f: number }> = ({ j, f }) => {
  const { col, row } = coord(j);
  const here = j === HERE;
  const t = arrive(j);
  const q = prog(f, t, 9, OUT);
  const flash = prog(f, t, 3, OUT) * (1 - prog(f, t + 3, 16, IN_OUT));
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
        {/* 새 세션 줄 */}
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
        {/* 원래 있던 줄: 새 줄이 들어오면 한 칸씩 내려가고, 목록 칸 밖으로 밀린 줄은 계정 칸에 가려진다 */}
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

const HeadC: React.FC = () => {
  const f = useCurrentFrame();
  const typed = Math.floor(interpolate(f, [C.ripple + 4, C.rippleEnd + 6], [0, RECORD.length], clamp));
  const caret = typed < RECORD.length && f >= C.ripple + 2;
  const head = RECORD.slice(0, Math.min(typed, 21));
  const rest = typed > 21 ? RECORD.slice(21, typed) : '';
  return (
    <>
      <div style={{ position: 'absolute', left: LEFT, top: TOP, ...HEAD }}>
        <div>
          <Word at={C.land + 1}>한</Word>{SP}<Word at={C.land + 5}>곳이</Word>{SP}<Word at={C.land + 11}>바뀌면,</Word>
        </div>
        <div>
          <Word at={C.ripple + 5}>1~2초</Word>{SP}<Word at={C.ripple + 11}>안에</Word>{SP}<Word at={C.ripple + 35}>전부</Word>{SP}<Word at={C.ripple + 45}>똑같이</Word>
        </div>
      </div>
      <div style={{ position: 'absolute', left: LEFT, top: TOP + 228, fontFamily: MONO, fontSize: 25, whiteSpace: 'nowrap' }}>
        <span style={{ color: DIM }}>{head}</span>
        <span style={{ color: INK }}>{rest}</span>
        {caret ? <span style={{ display: 'inline-block', width: 13, height: 28, marginLeft: 3, background: INK, verticalAlign: '-5px' }} /> : null}
      </div>
    </>
  );
};

// ───────────────────────── 카메라·전환 ─────────────────────────

/** 앞 장면 묶음(01A·06): 천천히 다가가다가, 계정 칩을 누를 때와 끝 세 줄을 볼 때만 그 자리로 붙는다(1.12배 이하). */
const CamAB: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const push = mix(1, 1.035, prog(f, 0, C.out, IN_OUT));
  const chip = prog(f, 14, 14, OUT) * (1 - prog(f, A.click + 10, 16, IN_OUT));
  const tail = prog(f, B.focus - 1, 14, OUT) * (1 - prog(f, B.fold, 10, IN_OUT));
  return (
    <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '540px 980px' }}>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.12 * chip})`, transformOrigin: '250px 1220px' }}>
        <AbsoluteFill style={{ transform: `scale(${1 + 0.06 * tail})`, transformOrigin: '540px 1120px' }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 09: 지금 계정 목록에 5.6배로 붙어 있다가(01A 판과 같은 크기), 새 세션이 들어오면 물러나며 25곳을 보여 준다. */
const CamC: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const s = mix(5.6, 1, prog(f, C.back, 16, IN_OUT)) * mix(1, 1.03, prog(f, C.back + 16, TOTAL - C.back - 16, IN_OUT));
  // 원점을 6px 왼쪽에 두면 5.6배일 때 지금 계정 칸이 화면 가운데(540)에 오고 양옆 칸 조각이 화면 밖으로 나간다
  return <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: `${HX - 6}px ${HY}px` }}>{children}</AbsoluteFill>;
};

/** 하나뿐인 장면 전환: 두 장면이 한 장으로 이어 붙은 채 위로 넘어간다(겹침·투명·크로스페이드 없음). */
const strip = (f: number) => prog(f, C.out, 14, IN_OUT);
const stripBlur = (p: number) => 3 * (1 - Math.abs(2 * p - 1));
const PushOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const p = strip(f);
  if (p >= 1) return null;
  const blur = stripBlur(p);
  return <AbsoluteFill style={{ transform: `translateY(${-1920 * p}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
};

const PushIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  if (f < C.out) return null;
  const p = strip(f);
  const blur = stripBlur(p);
  return <AbsoluteFill style={{ transform: `translateY(${1920 * (1 - p)}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
};

// ───────────────────────── 소리 ─────────────────────────

type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  { at: A.click, src: 'sfx/tok.wav', v: 0.6 },
  { at: A.drain, src: 'sfx/whoosh_down.wav', v: 0.3 },
  { at: A.empty, src: 'sfx/thud.wav', v: 0.45 },
  { at: B.start, src: 'sfx/swish.wav', v: 0.35 },
  ...Array.from({ length: 12 }, (_, i) => ({ at: B.log + i * 2, src: 'sfx/tick.wav', v: 0.16 })),
  { at: B.land, src: 'sfx/snap.wav', v: 0.5 },
  { at: B.fold, src: 'sfx/swish.wav', v: 0.22 },
  ...Array.from({ length: 8 }, (_, i) => ({ at: B.grey + i * 2, src: 'sfx/tick2.wav', v: 0.13 })),
  { at: B.stamp, src: 'sfx/thud.wav', v: 0.55 },
  { at: C.out, src: 'sfx/swish.wav', v: 0.5 },
  { at: C.add, src: 'sfx/pop.wav', v: 0.42 },
  { at: C.back, src: 'sfx/whoosh_side.wav', v: 0.32 },
  ...Array.from({ length: 15 }, (_, i) => ({ at: C.ripple + 4 + i * 2, src: 'sfx/tick2.wav', v: 0.06 })),
];

/** 목소리 구간에서는 배경음을 낮춘다. */
const VO_RANGES: [number, number][] = [
  [VO.h1, VO.h1 + 80],
  [VO.t3, VO.t3 + 160],
  [VO.m2, VO.m2 + 101],
];
const bgmVolume = (fr: number) => {
  const voice = Math.max(...VO_RANGES.map(([a, b]) => interpolate(fr, [a - 6, a, b, b + 6], [0, 1, 1, 0], clamp)));
  return (0.3 - 0.1 * voice) * Math.min(1, (TOTAL - fr) / 15);
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.mp3')} volume={bgmVolume} />
    <Sequence from={VO.h1} layout="none">
      <Audio src={staticFile('vo/h1.wav')} />
    </Sequence>
    <Sequence from={VO.t3} layout="none">
      <Audio src={staticFile('vo/t3.wav')} />
    </Sequence>
    <Sequence from={VO.m2} layout="none">
      <Audio src={staticFile('vo/m2.wav')} />
    </Sequence>
    {HITS.map((h, i) => (
      <Sequence key={i} from={h.at} durationInFrames={60} layout="none">
        <Audio src={staticFile(h.src)} volume={h.v} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      {/* 무대에 붙은 한 줄: 화면은 다시 그린 것, 숫자·기록 줄은 실제 값. 맨 아래 겹이라 전환 중 지나가는 판에 가려질 뿐 위에 겹쳐 그려지지 않는다 */}
      <div style={{ position: 'absolute', left: LEFT, top: 1360, fontFamily: MONO, fontSize: 26, color: DIM }}>재현 화면 · 숫자는 실제</div>
      <PushOut>
        <CamAB>
          <Panel />
        </CamAB>
        {f < B.start + 12 ? <HeadA /> : null}
        {f >= B.start && f < B.fold + 12 ? <HeadB /> : null}
        {f >= B.fold ? <HeadB2 /> : null}
        {f >= B.stamp - 2 ? <Stamp /> : null}
      </PushOut>
      <PushIn>
        {/* 목록 칸은 머리글 아래 · 무대 표시 위의 창 안에서만 보인다(물러나는 동안 머리글과 「재현 화면」 줄을 가리지 않게) */}
        <AbsoluteFill style={{ WebkitMaskImage: VIEWPORT, maskImage: VIEWPORT }}>
          <CamC>
            {PLACES.map((_, j) => (
              <Tile key={j} j={j} f={f} />
            ))}
          </CamC>
        </AbsoluteFill>
        <HeadC />
      </PushIn>
      <Sound />
    </AbsoluteFill>
  );
};
