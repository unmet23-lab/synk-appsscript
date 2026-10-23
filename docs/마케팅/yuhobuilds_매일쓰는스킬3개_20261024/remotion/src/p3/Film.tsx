// yuhobuilds 「매일 쓰는 스킬 3개, 파일째 드려요」(10-24, 장부 Y1). 기획 · 콘티는 ../../../기획.md.
// 문법은 만족 사례 S22(검정 무대 · 흰 글 · 버터 한 곳, 머리글이 곧 내레이션, 판 하나가 장면마다 내용을 바꾼다)와
// 10-21 멈춘시간재기 편(p2) 그대로다.
//  · 판(창) 자리는 한 편 내내 같고 내용은 장면마다 위로 넘긴다. 판은 장면 안에서 늘 천천히 밀린다(프레임마다 0.07%).
//  · 버터는 「틀린 것 · 스킬이 해 낸 것」 한 뜻으로만 — 틀린 날짜 · 다른 눈이 찾은 문제 · 먼저 읽은 노트 줄 · 넘겨받은 메모.
//  · 셋째 판(이해 시험 두 번 뒤): 문제로 연다(「다 했어요 ✓」인데 날짜가 틀림) → 폴더 → 다른눈 → 실수노트 → 인계.
//    「한도 · 창 20개」(이어서)는 두 번 다 개발자 얘기로 읽혀 인계로 바꿨다. 슬래시 명령 · 코드 표기는 화면에 없다.
//  · 판 안 값은 전부 실제: 10-24 범용판 시험(휴무 안내 문자 · 엑셀 한글 깨짐 · 빵집 이벤트 인계 메모와 새 창의 첫 답).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, INK, STAGE } from '../film/parts';
import { EN, KO } from '../lib/fonts';
import { clamp, mix } from '../lib/motion';
import { PAPER, Shell, UI_INK, type Box } from '../full/kit';
import { EndCard, endFollow } from './End';
import { at, lineEnd, TIMING, VO, type Cut, type Timing } from './time';
import { ease, EASE_MOVE, Line } from './Type';

// ───────────── 판(창) ─────────────
const VP: Box = { x: 64, y: 640, w: 952, h: 720, r: 30 };
const W = VP.w;
const HB = 66; // 창 머리 띠
const PADX = 40;
const RIGHT = 96; // 판 오른쪽 여백: 글자 오른쪽 끝이 화면 920px(릴스 단추 자리) 안에 들게
const MUTED = '#8E8B84';
const FAINT = '#5A5852';
const RULE = '#2E2D2A';
const BUBBLE = '#22211E';
const SOFT = '#B6B3AB';
const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)

/** 장면 경계: 그 줄 첫 소리보다 6프레임 앞(숨 자리)에서 넘긴다. */
const cutAt = (id: keyof typeof VO) => VO[id] - 6;
const SC = {
  problem: 0,
  folder: cutAt('h2'),
  review: cutAt('d1'),
  notes: cutAt('n1'),
  handoff: cutAt('k1'),
  cta: cutAt('ig'), // ig · yt 같은 자리(끝 말 앞까지는 두 판이 같다)
};

/** 장면 하나: a에 아래에서 올라와 들어오고 b에 위로 빠진다(8프레임 겹침). 그사이 판 내용은 천천히 밀린다. */
const Scene: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b + 8) return null;
  const pin = a === 0 ? 1 : ease(f, a, 9);
  const pout = ease(f, b, 8, EASE_MOVE);
  const s = 1 + Math.min(0.05, 0.0007 * (f - a));
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 46 - pout * 46}px) scale(${s})`, transformOrigin: '50% 45%' }}>{children}</div>
  );
};

/** 창 머리 띠: 점 셋 + 제목(+ 오른쪽). */
const Bar: React.FC<{ title: React.ReactNode; right?: React.ReactNode }> = ({ title, right }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: HB, borderBottom: `1px solid ${RULE}`, background: '#1A1917' }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ position: 'absolute', left: 28 + i * 22, top: 27, width: 12, height: 12, borderRadius: 6, background: '#3D3B36' }} />
    ))}
    <div style={{ position: 'absolute', left: 108, top: 0, lineHeight: `${HB}px`, fontFamily: KO, fontWeight: 640, fontSize: 29, color: '#C9C6BE', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{title}</div>
    {right ? <div style={{ position: 'absolute', right: RIGHT, top: 0, height: HB, display: 'flex', alignItems: 'center' }}>{right}</div> : null}
  </div>
);
const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ position: 'absolute', left: 0, right: 0, top: HB, bottom: 0 }}>{children}</div>;

/** a부터 len 동안 0 → 1(들어오는 것). */
const pin = (f: number, a: number, len = 10) => ease(f, a, len);
const rise = (p: number, dy = 24): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * dy}px)` });

/** 위로 넘기는 두 판(한 장면 안에서 앞 판 → 뒤 판). */
const Flip: React.FC<{ at: number; first: React.ReactNode; second: React.ReactNode }> = ({ at: a, first, second }) => {
  const f = useCurrentFrame();
  const s = ease(f, a, 10, EASE_MOVE);
  return (
    <>
      {s < 1 ? <div style={{ position: 'absolute', inset: 0, opacity: 1 - s, transform: `translateY(${-s * 46}px)` }}>{first}</div> : null}
      {s > 0 ? <div style={{ position: 'absolute', inset: 0, opacity: s, transform: `translateY(${(1 - s) * 46}px)` }}>{second}</div> : null}
    </>
  );
};

/** 말풍선. mine이면 오른쪽(사람), 아니면 왼쪽(클로드). */
const Bubble: React.FC<{ mine?: boolean; top: number; p: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ mine, top, p, children, style }) => (
  <div
    style={{
      position: 'absolute',
      ...(mine ? { right: RIGHT } : { left: PADX }),
      top,
      maxWidth: 780,
      borderRadius: 26,
      background: mine ? '#2E2D2A' : BUBBLE,
      padding: '20px 28px',
      fontFamily: KO,
      fontWeight: 660,
      fontSize: 35,
      lineHeight: 1.38,
      color: INK,
      letterSpacing: '-0.02em',
      textAlign: mine ? 'right' : 'left',
      ...rise(p, 16),
      ...style,
    }}
  >
    {children}
  </div>
);

const Typed: React.FC<{ text: string; a: number; per?: number }> = ({ text, a, per = 3 }) => {
  const f = useCurrentFrame();
  const n = f < a ? 0 : Math.min(text.length, Math.floor((f - a) / per) + 1);
  const blink = Math.floor(f / 15) % 2 === 0;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {text.slice(0, n)}
      <span style={{ display: 'inline-block', width: 3, height: '1em', marginLeft: 4, verticalAlign: '-0.12em', background: blink ? INK : 'transparent' }} />
    </span>
  );
};
const Input: React.FC<{ top: number; h?: number; children: React.ReactNode; press?: number }> = ({ top, h = 104, children, press = 0 }) => (
  <div style={{ position: 'absolute', left: PADX, right: RIGHT, top, height: h, borderRadius: 24, background: '#121210', boxShadow: `inset 0 0 0 2px ${press > 0 ? `rgba(245,196,69,${0.25 + 0.75 * press})` : '#3A3833'}` }}>
    <div style={{ position: 'absolute', left: 30, top: 0, height: h, display: 'flex', alignItems: 'center', fontFamily: KO, fontWeight: 650, fontSize: 36, color: INK }}>{children}</div>
    <div style={{ position: 'absolute', right: 22, top: (h - 56) / 2, width: 56, height: 56, borderRadius: 28, background: press > 0 ? BUTTER : '#3A3833', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - 0.1 * press})` }}>
      <svg width={26} height={26} viewBox="0 0 26 26">
        <path d="M13 21 L13 5 M6 12 L13 5 L20 12" fill="none" stroke={press > 0 ? '#121210' : '#8E8B84'} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  </div>
);

// ───────────── 장면 0 · 폴더 훅 ─────────────
const SKILLS = ['다른눈', '실수노트', '인계'] as const;
const CARD = { w: 224, h: 292 };
const CARD_END = [
  { cx: 196, top: 92, rot: -7 },
  { cx: 476, top: 64, rot: 0 },
  { cx: 756, top: 92, rot: 7 },
];
const MiniCard: React.FC<{ name: string }> = ({ name }) => (
  <div style={{ width: CARD.w, height: CARD.h, borderRadius: 20, background: PAPER, boxShadow: '0 18px 40px rgba(0,0,0,0.45)', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 24, top: 26, fontFamily: KO, fontWeight: 790, fontSize: 44, letterSpacing: '-0.04em', color: UI_INK, whiteSpace: 'nowrap' }}>{name}</div>
    <div style={{ position: 'absolute', left: 25, top: 82, fontFamily: EN, fontWeight: 600, fontSize: 21, color: '#9B988F' }}>SKILL.md</div>
    {[0.82, 0.64, 0.74, 0.5].map((k, i) => (
      <div key={i} style={{ position: 'absolute', left: 24, top: 130 + i * 24, width: (CARD.w - 48) * k, height: 10, borderRadius: 6, background: '#DEDAD1' }} />
    ))}
  </div>
);
const Folder: React.FC<{ open: number }> = ({ open }) => (
  <div style={{ position: 'absolute', left: W / 2 - 200, top: 352, width: 400, height: 300 }}>
    <svg width={400} height={300} viewBox="0 0 400 300" style={{ position: 'absolute', inset: 0 }}>
      <path d="M18 40 Q18 22 36 22 L150 22 Q162 22 170 32 L184 50 L364 50 Q382 50 382 68 L382 282 L18 282 Z" fill="#C99A2A" />
    </svg>
    <div style={{ position: 'absolute', left: 0, top: 96, width: 400, height: 204, transformOrigin: '50% 100%', transform: `perspective(900px) rotateX(${-38 * open}deg)` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: BUTTER, boxShadow: '0 -6px 22px rgba(0,0,0,0.25)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 74, textAlign: 'center', fontFamily: KO, fontWeight: 760, fontSize: 36, color: '#6B5313' }}>스킬</div>
    </div>
  </div>
);
const FolderScene: React.FC<{ still?: boolean }> = ({ still }) => {
  const f = useCurrentFrame();
  const a = still ? -60 : SC.folder; // 표지 · 시안은 다 펼친 때
  const open = ease(f, a + 2, 10);
  const pulse = still ? 0 : ease(f, at('h2', '파일째') - 1, 5) * (1 - ease(f, at('h2', '파일째') + 4, 10));
  return (
    <>
      {SKILLS.map((n, i) => {
        const p = ease(f, a + 7 + 6 * i, 16);
        const e = CARD_END[i];
        const cx = mix(W / 2, e.cx, p);
        const top = mix(360, e.top, p);
        const s = mix(0.55, 1, p) * (1 + 0.035 * pulse);
        return (
          <div key={n} style={{ position: 'absolute', left: cx - CARD.w / 2, top, transform: `rotate(${e.rot * p}deg) scale(${s})`, transformOrigin: '50% 100%', opacity: Math.min(1, p * 3) }}>
            <MiniCard name={n} />
          </div>
        );
      })}
      <Folder open={open} />
    </>
  );
};

// ───────────── 장면 0 · 문제: 「다 했어요 ✓」인데 날짜가 틀렸다 ─────────────
// 10-24 범용판 시험의 요청(10월 28일 수요일 휴무 · 80자 안)과 클로드가 만든 문자(10월 27일 화요일 · 96자) 그대로.
const DRAFT_A = '안녕하세요, 손님! 저희 가게는 ';
const DRAFT_DATE = '10월 27일 화요일';
const DRAFT_B = ' 하루 쉽니다. 예약을 바꾸고 싶으신 분은 가게로 편하게 전화 주세요.';
const ProblemScene: React.FC = () => {
  const f = useCurrentFrame();
  const markAt = at('h1', '틀려') - 3;
  const mark = ease(f, markAt, 8);
  const stamp = ease(f, markAt + 4, 9);
  return (
    <>
      <Bar title="휴무 안내 문자" />
      <Body>
        <Bubble mine top={26} p={1}>
          28일 휴무 안내 문자 써 줘
        </Bubble>
        <Bubble top={142} p={1} style={{ display: 'flex', alignItems: 'center', gap: 18, whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 740, fontSize: 38 }}>다 했어요.</span>
          <span style={{ padding: '6px 16px', borderRadius: 14, background: '#2E2D2A', fontWeight: 700, fontSize: 30, color: '#D9D6CE' }}>✓ 완성</span>
        </Bubble>
        <div style={{ position: 'absolute', left: PADX, right: RIGHT, top: 270, height: 330, borderRadius: 24, background: PAPER, padding: '30px 34px' }}>
          <div style={{ fontFamily: KO, fontWeight: 650, fontSize: 26, color: '#9B988F' }}>보낼 문자</div>
          <div style={{ marginTop: 14, fontFamily: KO, fontWeight: 620, fontSize: 36, lineHeight: 1.5, color: UI_INK, letterSpacing: '-0.02em' }}>
            {DRAFT_A}
            <span style={{ position: 'relative', fontWeight: 760 }}>
              {DRAFT_DATE}
              <span style={{ position: 'absolute', left: -8, right: -8, top: -4, bottom: -4, borderRadius: 12, boxShadow: `0 0 0 4px rgba(245,196,69,${mark})`, background: `rgba(245,196,69,${0.28 * mark})` }} />
            </span>
            {DRAFT_B}
          </div>
          <div style={{ position: 'absolute', right: 24, top: -26, padding: '10px 20px', borderRadius: 16, background: BUTTER, fontFamily: KO, fontWeight: 800, fontSize: 32, color: '#121210', whiteSpace: 'nowrap', opacity: stamp, transform: `rotate(${-4 * stamp}deg) scale(${mix(1.4, 1, stamp)})` }}>✗ 날짜가 틀렸어요</div>
        </div>
      </Body>
    </>
  );
};

// ───────────── 장면 2 · 다른눈: 다 했다고 하면, 새 클로드를 불러 처음 보는 눈으로 다시 확인 ─────────────
// 10-24 범용판 시험: 사장님 요청(10월 28일 수요일 휴무 · 전화로 예약 변경 · 80자 안) → 만든 문자는 27일 · 96자.
const ReviewScene: React.FC = () => {
  const f = useCurrentFrame();
  const doneAt = at('d1', '했다고') - 4;
  const cardAt = at('d1', '새') - 2;
  const x1 = cardAt + 16;
  const x2 = x1 + 12;
  const strikeAt = at('d1', '확인') - 2;
  const fixedAt = lineEnd('d1') - 2;
  const card = pin(f, cardAt, 12);
  const strike = ease(f, strikeAt, 8);
  return (
    <>
      <Bar title="휴무 안내 문자" />
      <Body>
        <Bubble mine top={26} p={1}>
          28일 휴무 안내 문자 써 줘
          <div style={{ marginTop: 4, fontSize: 27, fontWeight: 600, color: SOFT }}>수요일 · 80자 안으로</div>
        </Bubble>
        <Bubble top={180} p={pin(f, doneAt, 9)} style={{ display: 'flex', alignItems: 'center', gap: 20, whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 720, fontSize: 36 }}>다 했어요.</span>
          <span style={{ position: 'relative', padding: '6px 16px', borderRadius: 14, background: '#2E2D2A', fontWeight: 680, fontSize: 28, color: strike > 0.5 ? MUTED : '#D9D6CE' }}>
            ✓ 완성
            <span style={{ position: 'absolute', left: 10, right: 10, top: '52%', height: 3, borderRadius: 2, background: BUTTER, transform: `scaleX(${strike})`, transformOrigin: 'left center' }} />
          </span>
        </Bubble>
        <div style={{ position: 'absolute', left: PADX, right: RIGHT, top: mix(720, 300, card), height: 330, borderRadius: 26, background: '#1D1C19', boxShadow: `inset 0 0 0 2px ${BUTTER}`, opacity: Math.min(1, card * 2) }}>
          <div style={{ position: 'absolute', left: 30, top: 26, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 17, boxShadow: `inset 0 0 0 3px ${BUTTER}` }} />
            <div style={{ fontFamily: KO, fontWeight: 740, fontSize: 32, color: INK, letterSpacing: '-0.02em' }}>새 클로드 · 처음 보는 눈</div>
          </div>
          {(
            [
              ['날짜가 27일로 틀렸어요', x1],
              ['80자를 넘었어요', x2],
            ] as const
          ).map(([text, a], i) => (
            <div key={i} style={{ position: 'absolute', left: 30, top: 98 + i * 64, display: 'flex', gap: 18, fontFamily: KO, fontWeight: 680, fontSize: 36, color: INK, whiteSpace: 'nowrap', ...rise(pin(f, a, 8), 12) }}>
              <span style={{ color: BUTTER, fontWeight: 800 }}>✗</span>
              <span style={{ letterSpacing: '-0.02em' }}>{text}</span>
            </div>
          ))}
          <div style={{ position: 'absolute', left: 30, right: 30, top: 244, height: 1, background: RULE, opacity: pin(f, fixedAt, 6) }} />
          <div style={{ position: 'absolute', left: 30, top: 262, fontFamily: KO, fontWeight: 660, fontSize: 31, color: '#D9D6CE', whiteSpace: 'nowrap', ...rise(pin(f, fixedAt, 8), 10) }}>
            고친 뒤 다시 확인 · 틀린 곳 없음 <span style={{ color: BUTTER }}>✓</span>
          </div>
        </div>
      </Body>
    </>
  );
};

// ───────────── 장면 3 · 실수노트: 적어 두고, 다음엔 먼저 읽기 ─────────────
// 10-24 범용판 시험: CSV 예약 명단을 엑셀에서 열자 한글이 깨짐 → BOM 있는 UTF-8로 저장해 해결 → 다음 대화가 노트를 먼저 읽고 처음부터 그렇게 저장.
const NOTE_TITLE = '엑셀에서 열면 한글이 깨짐';
const NOTE_ROWS: [string, string][] = [
  ['증상', '이름이 이상한 글자로 나옴'],
  ['원인', '엑셀이 다른 글자표로 읽음'],
  ['고침', '저장 방식 하나 바꾸기'],
  ['다시 확인', '엑셀로 열어 이름 보기'],
];
const Reveal: React.FC<{ a: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ a, children, style }) => {
  const f = useCurrentFrame();
  const p = ease(f, a, 10);
  return <div style={{ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, whiteSpace: 'nowrap', ...style }}>{children}</div>;
};
const NoteTitle: React.FC<{ size: number }> = ({ size }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
    <span style={{ width: size * 0.32, height: size * 0.32, borderRadius: size, background: BUTTER, flex: 'none' }} />
    <span>{NOTE_TITLE}</span>
  </span>
);
const NotesScene: React.FC = () => {
  const f = useCurrentFrame();
  const titleAt = VO.n1 + 4;
  const writeAt = at('n1', '막힌') - 2;
  const nextAt = at('n1', '다음엔') - 4;
  const askAt = nextAt + 8;
  const readAt = at('n1', '노트부터') - 2;
  const answerAt = at('n1', '읽어요') + 2;
  return (
    <Flip
      at={nextAt}
      first={
        <>
          <Bar title="실수노트 · 엑셀" />
          <Body>
            <Reveal a={titleAt} style={{ position: 'absolute', left: PADX, top: 40, fontFamily: KO, fontWeight: 780, fontSize: 40, color: INK, letterSpacing: '-0.03em' }}>
              <NoteTitle size={40} />
            </Reveal>
            {NOTE_ROWS.map(([k, v], i) => (
              <Reveal key={k} a={writeAt + 5 * i} style={{ position: 'absolute', left: PADX, top: 140 + i * 80, display: 'flex', fontFamily: KO, fontSize: 35 }}>
                <span style={{ width: 196, color: MUTED, fontWeight: 640 }}>{k}</span>
                <span style={{ color: '#E6E3DB', fontWeight: 620, letterSpacing: '-0.02em' }}>{v}</span>
              </Reveal>
            ))}
          </Body>
        </>
      }
      second={
        <>
          <Bar title="새 대화" />
          <Body>
            <Bubble mine top={30} p={pin(f, askAt, 8)}>
              예약 명단, 엑셀 파일로 줘
            </Bubble>
            <div style={{ position: 'absolute', left: PADX, top: 150, fontFamily: KO, fontWeight: 640, fontSize: 28, color: MUTED, ...rise(pin(f, readAt - 6, 8), 10) }}>실수노트부터 확인</div>
            <div style={{ position: 'absolute', left: PADX, right: RIGHT, top: 196, height: 88, borderRadius: 18, background: '#1D1C19', boxShadow: `inset 0 0 0 ${2 + ease(f, readAt, 6)}px rgba(245,196,69,${0.25 + 0.75 * ease(f, readAt, 6)})`, ...rise(pin(f, readAt - 6, 8), 10) }}>
              <div style={{ position: 'absolute', left: 26, top: 0, lineHeight: '88px', fontFamily: KO, fontWeight: 740, fontSize: 35, color: INK, whiteSpace: 'nowrap', letterSpacing: '-0.03em' }}>
                <NoteTitle size={35} />
              </div>
            </div>
            <Bubble top={326} p={pin(f, answerAt, 9)}>
              노트대로 저장할게요.
              <br />
              <span style={{ color: BUTTER }}>한글이 안 깨져요.</span>
            </Bubble>
          </Body>
        </>
      }
    />
  );
};

// ───────────── 장면 4 · 인계: 대화가 길어지면, 지금까지를 한 장으로 적어 새 창에 ─────────────
// 10-24 범용판 시험: 빵집 11월 이벤트 대화(15% → 10%로 바꿈 · 이모지 금지 · 해시태그 다섯 개 이하) → 인계 메모 일곱 칸 →
// 앞 대화를 모르는 새 창이 메모만 받고 「남은 일 첫째는 인스타 글 … 10% · 이모지 없이」로 이어 감.
const LONG: [boolean, string][] = [
  [true, '첫 주문 15% 할인으로 하자'],
  [false, '포스터 문구 세 안이에요'],
  [true, '이모지는 빼 줘. 앞으로도'],
  [false, '처음 오신 날, 빵이 더 고소해요'],
  [true, '15%는 세다. 10%로 바꾸자'],
  [false, '포스터도 10%로 바꿨어요'],
  [true, '해시태그는 다섯 개 이하로'],
  [false, '사진은 어떤 걸 쓰실 거예요?'],
  [true, '크루아상. 내일 찍을 거야'],
];
const MEMO: [string, string][] = [
  ['목표', '11월 첫 주문 이벤트 글 셋'],
  ['정한 것', '10% 할인 · 11월 1~10일'],
  ['한 것', '포스터 문구 확정'],
  ['지금 상태', '인스타 글 쓰기 전'],
  ['남은 일', '인스타 글, 다음은 단골 문자'],
  ['하지 말 것', '이모지 · 해시태그 많이'],
  ['물어볼 것', '없음'],
];
const HandoffScene: React.FC = () => {
  const f = useCurrentFrame();
  const a = SC.handoff;
  const memoAt = at('k1', '지금까지를') - 4;
  const newAt = lineEnd('k1') - 10;
  const scroll = interpolate(f, [a, memoAt], [0, 300], clamp);
  return (
    <Flip
      at={memoAt}
      first={
        <>
          <Bar title="빵집 11월 이벤트" right={<span style={{ fontFamily: KO, fontWeight: 640, fontSize: 24, color: MUTED }}>대화 길어짐</span>} />
          <Body>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 80px, #000 560px, transparent 650px)' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 40 - scroll }}>
                {LONG.map(([mine, text], i) => (
                  <div key={i} style={{ position: 'absolute', ...(mine ? { right: RIGHT } : { left: PADX }), top: i * 96, borderRadius: 22, background: mine ? '#2E2D2A' : BUBBLE, padding: '16px 24px', fontFamily: KO, fontWeight: 640, fontSize: 31, color: '#D9D6CE', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </Body>
        </>
      }
      second={
        <Flip
          at={newAt}
          first={
            <>
              <Bar title="인계 메모 · 한 장" />
              <Body>
                {MEMO.map(([k, v], i) => (
                  <div key={k} style={{ position: 'absolute', left: PADX, top: 26 + i * 76, display: 'flex', fontFamily: KO, fontSize: 33, whiteSpace: 'nowrap', ...rise(pin(f, memoAt + 4 + 3 * i, 8), 10) }}>
                    <span style={{ width: 200, color: k === '정한 것' || k === '하지 말 것' ? BUTTER : MUTED, fontWeight: 680 }}>{k}</span>
                    <span style={{ color: '#E6E3DB', fontWeight: 620, letterSpacing: '-0.02em' }}>{v}</span>
                  </div>
                ))}
              </Body>
            </>
          }
          second={
            <>
              <Bar title="새 대화" />
              <Body>
                <div style={{ position: 'absolute', right: RIGHT, top: 30, borderRadius: 22, background: '#2E2D2A', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, fontFamily: KO, fontWeight: 660, fontSize: 31, color: INK, ...rise(pin(f, newAt + 6, 8), 12) }}>
                  <div style={{ width: 26, height: 34, borderRadius: 5, background: PAPER }} />
                  인계 메모 붙여 넣음
                </div>
                <Bubble top={150} p={pin(f, newAt + 14, 9)}>
                  남은 일 첫째는 인스타 글이에요.
                  <br />
                  <span style={{ color: BUTTER }}>10% · 이모지 없이 쓸게요.</span>
                </Bubble>
              </Body>
            </>
          }
        />
      }
    />
  );
};

// ───────────── 장면 5 · 끝 말(판마다) ─────────────
const IgCta: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const typeAt = at('ig', '스킬', 0, t) - 4;
  const sendAt = typeAt + 14;
  const dmAt = at('ig', '링크를', 0, t) - 6;
  const press = ease(f, sendAt, 3) * (1 - ease(f, sendAt + 4, 8));
  return (
    <Flip
      at={dmAt}
      first={
        <>
          <Bar title="댓글" />
          <Body>
            <div style={{ position: 'absolute', left: PADX, top: 40, fontFamily: KO, fontWeight: 640, fontSize: 30, color: MUTED }}>이 릴스에 댓글 달기</div>
            <Input top={100} press={press}>
              {f < typeAt ? <span style={{ color: FAINT }}>댓글 달기…</span> : <Typed text="스킬" a={typeAt} per={4} />}
            </Input>
          </Body>
        </>
      }
      second={
        <>
          <Bar title="메시지 · @yuhobuilds" />
          <Body>
            <Bubble top={34} p={pin(f, dmAt + 4, 9)} style={{ width: 780 }}>
              「스킬」 남겨 주셔서 고마워요!
              <br />
              매일 쓰는 스킬 세 개, 설치 글이에요.
              <div style={{ marginTop: 22, borderRadius: 18, background: '#121210', boxShadow: `inset 0 0 0 2px ${BUTTER}`, padding: '18px 22px', ...rise(pin(f, dmAt + 14, 9), 12) }}>
                <div style={{ fontFamily: EN, fontWeight: 650, fontSize: 32, color: BUTTER }}>synk.im/prompts</div>
                <div style={{ marginTop: 6, fontFamily: KO, fontWeight: 600, fontSize: 27, color: SOFT }}>클로드에 붙여 넣으면 깔려요</div>
              </div>
            </Bubble>
          </Body>
        </>
      }
    />
  );
};
const FileChip: React.FC<{ name: string; p: number; i: number }> = ({ name, p, i }) => (
  <div style={{ position: 'absolute', left: i * 196, top: 0, width: 182, height: 64, borderRadius: 16, background: PAPER, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', ...rise(p, 18) }}>
    <div style={{ width: 22, height: 30, borderRadius: 4, background: '#DEDAD1' }} />
    <div style={{ fontFamily: KO, fontWeight: 760, fontSize: 27, color: UI_INK, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>{name}</div>
  </div>
);
const YtCta: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  const pinAt = t.vo.yt - 2;
  const linkAt = at('yt', '링크의', 0, t) - 2;
  const filesAt = at('yt', '깔려요', 0, t) - 6;
  const ring = ease(f, linkAt, 7);
  return (
    <>
      <Bar title="댓글" />
      <Body>
        <div style={{ position: 'absolute', left: PADX, right: RIGHT, top: 40, borderRadius: 24, background: BUBBLE, padding: '26px 30px 30px', ...rise(pin(f, pinAt, 9), 16) }}>
          <div style={{ fontFamily: KO, fontWeight: 620, fontSize: 26, color: MUTED }}>📌 @yuhobuilds님이 고정함</div>
          <div style={{ marginTop: 14, fontFamily: EN, fontWeight: 650, fontSize: 30, color: INK }}>@yuhobuilds</div>
          <div style={{ marginTop: 10, fontFamily: KO, fontWeight: 650, fontSize: 33, color: '#E6E3DB', letterSpacing: '-0.02em' }}>매일 쓰는 스킬 세 개 · 클로드에 붙여 넣으면 깔려요</div>
          <div style={{ display: 'inline-block', marginTop: 14, padding: '8px 16px', borderRadius: 12, fontFamily: EN, fontWeight: 600, fontSize: 29, color: BUTTER, boxShadow: `inset 0 0 0 ${2 * ring}px rgba(245,196,69,${ring})` }}>synk.im/prompts/#daily-skills</div>
        </div>
        <div style={{ position: 'absolute', left: PADX, top: 380, height: 64, width: 600 }}>
          {SKILLS.map((n, i) => (
            <FileChip key={n} name={n} i={i} p={pin(f, filesAt + 5 * i, 9)} />
          ))}
        </div>
      </Body>
    </>
  );
};

// ───────────── 머리글 ─────────────
const TOP2 = 300 + 104; // 두 번째 머리글 줄(작게) — 첫 줄 78px 아래
const Heads: React.FC<{ t: Timing }> = ({ t }) => (
  <>
    <Line lines={['클로드가 다 했다는데', '틀려 있던 적 있죠?']} accent="틀려" at={0} until={SC.folder} />
    <Line lines={['매일 넣어 쓰는 스킬 3개,', '파일째 드려요']} accent="3개" at={VO.h2 - 3} until={SC.review} />
    <Line lines={['하나, 다른눈']} accent="다른눈" at={VO.d1 - 3} until={SC.notes} />
    <Line lines={['새 클로드가 처음 보는 눈으로']} at={at('d1', '새') - 3} until={SC.notes} top={TOP2} size={64} />
    <Line lines={['둘, 실수노트']} accent="실수노트" at={VO.n1 - 3} until={SC.handoff} />
    <Line lines={['막힌 건 적고, 다음엔 먼저 읽기']} at={at('n1', '막힌') - 3} until={SC.handoff} top={TOP2} size={64} />
    <Line lines={['셋, 인계']} accent="인계" at={VO.k1 - 3} until={SC.cta} />
    <Line lines={['길어지면 한 장으로, 새 창에']} at={at('k1', '길어지면') - 3} until={SC.cta} top={TOP2} size={64} />
    {t.cut === 'ig' ? (
      <Line lines={['댓글에 「스킬」', '설치 글 링크를 DM으로']} accent="「스킬」" at={t.vo.ig - 3} until={t.end} />
    ) : (
      <Line lines={['고정 댓글 링크의 글을', '클로드에 붙여 넣기']} accent="고정 댓글" at={t.vo.yt - 3} until={t.end} />
    )}
  </>
);

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (t: Timing): Hit[] => {
  const out: Hit[] = [
    { at: at('h1', '틀려') + 1, src: 'sfx/thud.wav', v: 0.26 },
    ...[SC.folder, SC.review, SC.notes, SC.handoff, SC.cta].map((a) => ({ at: a - 2, src: 'sfx/swish.wav', v: 0.16 })),
    ...[0, 1, 2].map((i) => ({ at: SC.folder + 9 + 6 * i, src: 'sfx/tok.wav', v: 0.22 })),
    { at: at('h2', '파일째') - 1, src: 'sfx/snap.wav', v: 0.2 },
    { at: at('d1', '새') - 2, src: 'sfx/swish.wav', v: 0.2 },
    { at: at('d1', '새') + 14, src: 'sfx/tick2.wav', v: 0.16 },
    { at: at('d1', '새') + 26, src: 'sfx/tick2.wav', v: 0.16 },
    { at: at('n1', '다음엔') - 4, src: 'sfx/swish.wav', v: 0.18 },
    { at: at('n1', '노트부터') - 2, src: 'sfx/tick2.wav', v: 0.16 },
    { at: at('k1', '지금까지를') - 4, src: 'sfx/swish.wav', v: 0.18 },
    { at: lineEnd('k1') - 10, src: 'sfx/swish.wav', v: 0.16 },
    { at: lineEnd('k1') + 4, src: 'sfx/tick.wav', v: 0.14 },
    { at: t.end, src: 'sfx/swish.wav', v: 0.18 },
    { at: endFollow(t), src: 'sfx/tok.wav', v: 0.42 },
  ];
  if (t.cut === 'ig') {
    const typeAt = at('ig', '스킬', 0, t) - 4;
    out.push({ at: typeAt + 14, src: 'sfx/tok.wav', v: 0.28 }, { at: at('ig', '링크를', 0, t) - 6, src: 'sfx/swish.wav', v: 0.18 }, { at: at('ig', '링크를', 0, t) + 8, src: 'sfx/snap.wav', v: 0.18 });
  } else {
    out.push({ at: at('yt', '링크의', 0, t) - 2, src: 'sfx/tick2.wav', v: 0.16 }, { at: at('yt', '깔려요', 0, t) - 6, src: 'sfx/snap.wav', v: 0.18 });
  }
  return out;
};

// ───────────── 본편 ─────────────
export const SkillsFilm: React.FC<{ cut: Cut; bgm?: boolean }> = ({ cut, bgm = true }) => {
  const t = TIMING[cut];
  const ranges = t.order.map((id) => [t.vo[id], lineEnd(id, t)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (t.total - fr) / 20);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.42 - 0.16 * voice) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Panel t={t} />
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

const Panel: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  if (f >= t.end + 8) return null;
  const gone = ease(f, t.end, 8);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone }}>
      <Shell box={VP} dark={1}>
        <Scene a={SC.problem} b={SC.folder}>
          <ProblemScene />
        </Scene>
        <Scene a={SC.folder} b={SC.review}>
          <FolderScene />
        </Scene>
        <Scene a={SC.review} b={SC.notes}>
          <ReviewScene />
        </Scene>
        <Scene a={SC.notes} b={SC.handoff}>
          <NotesScene />
        </Scene>
        <Scene a={SC.handoff} b={SC.cta}>
          <HandoffScene />
        </Scene>
        <Scene a={SC.cta} b={t.end}>
          {t.cut === 'ig' ? <IgCta t={t} /> : <YtCta t={t} />}
        </Scene>
      </Shell>
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

/** 표지: 폴더에서 파일 셋이 다 나온 때. */
export const FolderStill: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <Shell box={VP} dark={1}>
      <FolderScene still />
    </Shell>
    <Line lines={['매일 넣어 쓰는 스킬 3개,', '파일째 드려요']} accent="3개" at={0} />
  </AbsoluteFill>
);
