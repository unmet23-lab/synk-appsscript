// yuhobuilds 첫날 편 v8(10-20 밤) — 유호님 「완전 ai 같고 부자연스러워. 마감도 별로야 … 최신 모션그래픽을 직접 크롤링해서 인기있는걸」.
// 말·박자는 v7b 그대로(src/v7/time.ts · vo7 · bgm_v7.wav). 화면 움직임만 새로 짰다 — 규칙은 모션조사_20261020.md
// (Notion 3.0 · Cursor 2.0 · Linear Diffs · Varun Mayya 쇼츠 + r/MotionDesign · Emil Kowalski).
//  · 글자는 조용히: 줄 단위 올림 하나, 강조는 처음부터 칠한 낱말 하나(Type.tsx).
//  · 판(창)은 자리를 지키고 내용은 컷으로 바뀐다. 움직임은 판 안 카메라가 맡는다 — 늘 천천히 밀고(1.00 → 1.035),
//    동작 자리로 다가간다(Screen Studio식, 18~24프레임, cubic-bezier(0.77,0,0.175,1)).
//  · 판마다 사람 동작 하나: 「올려」·「이어서 해」를 한글 조합 그대로 친다, 커서가 누른다, 목록이 하나씩 체크된다.
//    지금 말하는 자리 하나에만 버터 테두리가 켜지고 다음 자리로 옮겨 간다.
//  · 빼는 것: 낱말 팝 · 흐림 등장 · 튕김 · 형광펜 · 숫자 세기 · 장식 칩 · 크로스페이드 · 매 컷 휙 소리.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, Cursor, DIM, INK, STAGE } from '../film/parts';
import { EN, KO, MONO } from '../lib/fonts';
import { bezier, clamp, mix } from '../lib/motion';
import { Cap, CAP_SIZE, ME_INK, PanelTop, PAPER, RULE, TileGrid, UI_INK, UI_MUTED } from '../day1/parts';
import { CHILDREN, SESSION_TITLE } from '../day1/data';
import { LINES, lineEnd, S, TOTAL, VO, wd } from '../v7/time';
import { EndCard, END_FOLLOW } from './End';
import { ease, EASE_MOVE, Line } from './Type';

// ───────────── 판(창) — 자리는 한 편 내내 같다 ─────────────
const VP = { x: 64, y: 600, w: 952, h: 680, r: 28 };
const W = VP.w;
const H = VP.h;
const BUBBLE = '#2B2A26';

// ───────────── 실제 값(v7과 같다) ─────────────
const TASKS = [
  { t: '【매주 월요일】 SYNK 트렌드 스캔 · Argon 수집 검수', at: '월 09:30' },
  { t: '【매일 07:00】 SYNK LAB 오늘 편 만들기', at: '매일 07:00' },
  { t: '【매일 07:05】 synkbrief 오늘 편 + SYNK SHIFT 블로그 글', at: '매일 07:05' },
  { t: '【매일 07:10】 yuhobuilds 오늘 편 만들기', at: '매일 07:10' },
  { t: '【매일 14:00】 예약 큐 — 새 편 「올려」 받으면 슬롯대로 예약', at: '매일 14:00' },
] as const;
const CANDS = [
  { b: 'yuhobuilds', tr: ['실화', '트렌드'] },
  { b: 'LAB 영어', tr: ['달력', '트렌드', '질문'] },
  { b: 'LAB 스페인어', tr: ['달력'] },
  { b: 'LAB 몽골', tr: ['질문', '트렌드'] },
  { b: 'yuhobuilds', tr: ['트렌드', '실화'] },
  { b: 'synkbrief', tr: ['보도', '질문', '트렌드'] },
  { b: 'synkbrief', tr: ['질문', '달력'] },
] as const;
const TRIG = ['트렌드', '질문', '달력', '실화'] as const;
const Q_DATES = ['10-20', '10-21', '10-22', '10-23', '10-24'] as const;
const Q_BRANDS = ['LAB', 'synkbrief', 'yuhobuilds', 'SHIFT'] as const;
const LIMIT_LINE = "You've hit your session limit · resets 8:20pm (Asia/Seoul)";
const THREE = [
  { src: 'thumb/lab.png', label: 'LAB · 관용구 퀴즈 #4' },
  { src: 'thumb/brief.png', label: 'synkbrief · 음식 사진' },
  { src: 'thumb/yuho_v7.png', label: 'yuhobuilds · 이 영상' },
] as const;
const STEPS = [
  { n: '1', t: '소재', s: '월요일에 한 주 치 후보' },
  { n: '2', t: '제작', s: '매일 아침 7시' },
  { n: '3', t: '게시', s: '「올려」 한 마디' },
] as const;
const CHECK = [
  { t: '월요일: 한 주 소재 목록', s: '트렌드 · 받은 질문 · 달력 · 내 실화', at: wd('c1', 2) },
  { t: '매일 같은 시각: 브랜드마다 한 편', s: '아침 7시로 걸어 둠', at: wd('c1', 4) },
  { t: '최종본 보고 「올려」 한 번', s: '사람 몫은 여기만', at: wd('c1', 6) },
  { t: '4일 치 예약 비축', s: '올리기는 한 창에서 차례로', at: wd('c1', 9) },
] as const;

/** 한글을 치는 그대로(조합 중간 글자 포함). */
const KEYS_POST = ['ㅇ', '오', '올', '올려'] as const; // 「올ㄹ」 상태는 뒤 커서와 붙어 「올리」로 읽혀서 뺐다(Fable 검수)
const KEYS_POST_AT = [58, 60, 63, 67] as const;
const SEND_POST = wd('h1', 6); // 「"올려"」를 말하는 순간 보낸다
const KEYS_RESUME = ['ㅇ', '이', '잉', '이어', '이엇', '이어서', '이어서 ', '이어서 ㅎ', '이어서 해'] as const;
const KEYS_RESUME_AT = [668, 670, 673, 675, 678, 680, 683, 685, 687] as const;
const SEND_RESUME = wd('s2b', 6);

// ───────────── 장면표: 컷 프레임, 판 바탕, 카메라 ─────────────
type K = 'chat' | 'cards' | 'outline' | 'tasks1' | 'scan' | 'tiles' | 'pick' | 'tasks2' | 'final' | 'limit' | 'tasks3' | 'queue' | 'caps' | 'one' | 'check';
/** 카메라 열쇠: at부터 len프레임 동안 배율 s, 판 안 초점 (x, y)로 옮겨 간다. */
type Key = { at: number; len: number; s: number; x: number; y: number };
/** o: 판 전체를 미는 기준점(판 안 좌표). cam: 판 안 줌(입력하는 두 곳만, x 0이면 왼쪽 끝 고정). */
type Scene = { k: K; at: number; bg: string; o: [number, number]; cam?: Key[] };
const SCENES: Scene[] = [
  { k: 'chat', at: 0, bg: PAPER, o: [300, 160], cam: [{ at: 44, len: 20, s: 1.32, x: 0, y: H }] },
  { k: 'cards', at: 105, bg: PAPER, o: [476, 120] },
  { k: 'outline', at: 172, bg: PAPER, o: [476, 120] },
  { k: 'tasks1', at: 233, bg: PAPER, o: [400, 160] },
  { k: 'scan', at: 289, bg: PAPER, o: [476, 200] },
  { k: 'tiles', at: 405, bg: PAPER, o: [476, 160] },
  { k: 'pick', at: 445, bg: PAPER, o: [330, 200] },
  { k: 'tasks2', at: 488, bg: PAPER, o: [420, 260] },
  { k: 'final', at: 580, bg: PAPER, o: [476, 120] },
  { k: 'limit', at: 626, bg: PAPER, o: [300, 200], cam: [{ at: 660, len: 20, s: 1.4, x: 0, y: H }, { at: 697, len: 22, s: 1, x: W / 2, y: H / 2 }] },
  { k: 'tasks3', at: 748, bg: PAPER, o: [420, 300] },
  { k: 'queue', at: 815, bg: PAPER, o: [330, 200] },
  { k: 'caps', at: 890, bg: '#1E1D1B', o: [476, 160] },
  { k: 'one', at: 939, bg: PAPER, o: [476, 140] },
  { k: 'check', at: 1025, bg: PAPER, o: [476, 160] },
  { k: 'check', at: 1137, bg: PAPER, o: [600, 60] },
];
const sceneAt = (f: number) => {
  let i = 0;
  for (let j = 0; j < SCENES.length; j++) if (f >= SCENES[j].at) i = j;
  return i;
};

/** 판 안 줌: 열쇠를 차례로 밟는다. 판 밖이 비치지 않게 가장자리에서 멈춘다(x 0이면 왼쪽 끝, y H면 아래 끝 고정 — 글 첫머리가 잘리지 않게). */
const camera = (f: number, i: number) => {
  let s = 1;
  let x = W / 2;
  let y = H / 2;
  for (const key of SCENES[i].cam ?? []) {
    const p = ease(f, key.at, key.len, EASE_MOVE);
    if (p <= 0) break;
    s = mix(s, key.s, p);
    x = mix(x, key.x, p);
    y = mix(y, key.y, p);
  }
  const tx = Math.min(0, Math.max(W - W * s, W / 2 - x * s));
  const ty = Math.min(0, Math.max(H - H * s, H / 2 - y * s));
  return { s, tx, ty };
};
/** 판 전체(테두리째) 밀기: 컷부터 일정한 속도(프레임마다 0.07%, 초당 약 2%)로 밀고 1.08에서 멈춘다. 누를 때 +0.015. 컷에서 1.00으로 돌아간다. 글은 잘리지 않는다.
 *  (첫 렌더의 장면당 3.5%는 tools/정지구간.js에서 38%가 「거의 멈춤」이었다.) */
const push = (f: number, i: number) => {
  const sc = SCENES[i];
  const drift = Math.min(0.08, 0.0007 * Math.max(0, f - sc.at));
  const punch = Math.max(0, ...CLICKS.map((c) => interpolate(f - c.at, [0, 3, 10], [0, 0.015, 0], clamp)));
  return 1 + drift + punch;
};

/** 지금 자리 표시: a에 6프레임 켜지고 b에 6프레임 꺼진다. */
const on = (f: number, a: number, b = Infinity) => ease(f, a, 6) * (b === Infinity ? 1 : 1 - ease(f, b, 6));
const Ring: React.FC<{ k: number; r: number; pad?: number }> = ({ k, r, pad = 0 }) =>
  k > 0 ? <div style={{ position: 'absolute', inset: -pad, borderRadius: r + pad, background: `rgba(245,196,69,${0.14 * k})`, boxShadow: `inset 0 0 0 2.5px rgba(245,196,69,${k})`, pointerEvents: 'none' }} /> : null;

// ───────────── 판 내용 ─────────────
/** 입력창: 한 글자씩(조합 중간 포함) 쳐지고, send에 보낸다. 놀 때는 깜빡이는 커서. */
const Composer: React.FC<{ f: number; keys: readonly string[]; times: readonly number[]; send: number; top: number }> = ({ f, keys, times, send, top }) => {
  let text = '';
  for (let i = 0; i < keys.length; i++) if (f >= times[i]) text = keys[i];
  if (f >= send) text = '';
  const typing = f >= times[0] - 6 && f < send;
  const caret = typing || Math.floor(f / 16) % 2 === 0;
  const press = interpolate(f, [send - 1, send, send + 5], [0, 1, 0], clamp);
  const active = text.length > 0;
  const caretEl = <span style={{ display: 'inline-block', width: 3, height: 40, borderRadius: 2, background: UI_INK, opacity: caret ? 1 : 0, margin: '0 2px', verticalAlign: 'middle' }} />;
  return (
    <div style={{ position: 'absolute', left: 24, right: 24, top, height: 76, borderRadius: 24, background: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${RULE}` }}>
      <div style={{ position: 'absolute', left: 26, top: 0, height: 76, display: 'flex', alignItems: 'center', fontFamily: KO, fontWeight: 600, fontSize: 34, letterSpacing: '-0.02em', whiteSpace: 'pre' }}>
        {active ? (
          <>
            <span style={{ color: UI_INK }}>{text}</span>
            {caretEl}
          </>
        ) : (
          <>
            {caretEl}
            <span style={{ color: '#B3AFA6', fontWeight: 520 }}>답장</span>
          </>
        )}
      </div>
      <div style={{ position: 'absolute', right: 12, top: 12, width: 52, height: 52, borderRadius: 26, background: active || press > 0 ? UI_INK : '#DDD9D0', transform: `scale(${1 - 0.1 * press})` }}>
        <svg width={52} height={52} viewBox="0 0 52 52">
          <path d="M26 36 L26 17 M18 24 L26 16 L34 24" fill="none" stroke={ME_INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};

/** 보낸 말풍선(오른쪽). */
const Sent: React.FC<{ f: number; at: number; text: string; top: number }> = ({ f, at, text, top }) => {
  const a = ease(f, at, 8);
  if (a <= 0) return null;
  return (
    <div style={{ position: 'absolute', right: 30, top: top + (1 - a) * 10, opacity: a, padding: '9px 24px 11px', borderRadius: 24, background: BUBBLE, color: ME_INK, fontFamily: KO, fontWeight: 620, fontSize: 30, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
      {text}
    </div>
  );
};

/** 0~3.5초: 예약 큐 대화. 「올려」를 쳐서 보내면 오늘 칸이 하나씩 찬다. */
const ChatQueue: React.FC<{ f: number }> = ({ f }) => {
  const colX = (i: number) => 330 + i * 112;
  return (
    <>
      <PanelTop title="예약 큐 · 매일 14:00" right="Claude" />
      <div style={{ position: 'absolute', left: 34, top: 122, width: 13, height: 13, borderRadius: 7, background: UI_INK }} />
      <div style={{ position: 'absolute', left: 62, top: 108, width: 850, fontFamily: KO, fontWeight: 560, fontSize: 28, lineHeight: 1.45, color: UI_INK, letterSpacing: '-0.02em' }}>
        오늘 만든 편이 준비됐어요. 「올려」 하시면 슬롯대로 예약할게요.
      </div>
      <div style={{ position: 'absolute', left: 34, top: 226, fontFamily: KO, fontWeight: 600, fontSize: 22, color: UI_MUTED }}>브랜드</div>
      {Q_DATES.map((d, i) => (
        <div key={d} style={{ position: 'absolute', left: colX(i) - 50, width: 100, top: 228, textAlign: 'center', fontFamily: MONO, fontSize: 21, color: i === 0 ? UI_INK : UI_MUTED }}>
          {d}
        </div>
      ))}
      <div style={{ position: 'absolute', left: 24, right: 24, top: 266, height: 1, background: RULE }} />
      {Q_BRANDS.map((b, r) => {
        const fill = ease(f, SEND_POST + 4 + r * 3, 6);
        return (
          <React.Fragment key={b}>
            <div style={{ position: 'absolute', left: 34, top: 282 + r * 54, fontFamily: KO, fontWeight: 650, fontSize: 29, color: UI_INK }}>{b}</div>
            {Q_DATES.map((d, i) => (
              <div key={d} style={{ position: 'absolute', left: colX(i) - 50, width: 100, top: 278 + r * 54, textAlign: 'center', fontFamily: EN, fontWeight: 600, fontSize: 34, color: i === 0 ? UI_INK : '#C9C5BC' }}>
                {i === 0 ? (fill > 0.5 ? <span style={{ color: '#C99A1C' }}>●</span> : '○') : '·'}
              </div>
            ))}
          </React.Fragment>
        );
      })}
      <Composer f={f} keys={KEYS_POST} times={KEYS_POST_AT} send={SEND_POST} top={586} />
    </>
  );
};

const CARD_W = 286;
const CARD_H = 508;
/** 오늘 만든 세 편의 실제 0초 화면. cur: 지금 자리 테두리, chk: 체크. */
const ThreeCards: React.FC<{ cur?: (i: number) => number; chk?: (i: number) => number }> = ({ cur, chk }) => {
  const left0 = (W - (3 * CARD_W + 2 * 24)) / 2;
  return (
    <>
      {THREE.map((c, i) => {
        const k = cur ? cur(i) : 0;
        const ck = chk ? chk(i) : 0;
        return (
          <div key={i} style={{ position: 'absolute', left: left0 + i * (CARD_W + 24), top: 46, width: CARD_W }}>
            <div style={{ position: 'relative', width: CARD_W, height: CARD_H }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', background: '#0A0A0A', boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 12px 30px rgba(0,0,0,0.14)' }}>
                <Img src={staticFile(c.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              {k > 0 ? <div style={{ position: 'absolute', inset: -7, borderRadius: 26, boxShadow: `inset 0 0 0 3px rgba(245,196,69,${k})` }} /> : null}
              {ck > 0 ? (
                <div style={{ position: 'absolute', right: 14, bottom: 14, width: 58, height: 58, borderRadius: 29, background: '#141412', opacity: Math.min(1, ck * 2), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px ${INK}` }}>
                  <svg width={30} height={24} viewBox="0 0 40 32">
                    <path d="M4 17 L15 27 L36 5" fill="none" stroke={BUTTER} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={50} strokeDashoffset={50 * (1 - ck)} />
                  </svg>
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 16, textAlign: 'center', fontFamily: KO, fontWeight: 650, fontSize: 25, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{c.label}</div>
          </div>
        );
      })}
    </>
  );
};

/** 세 단계 목차(이 영상의 구조). 「세 단계로」에 세 줄이 한 묶음으로, 「체크리스트」에 마지막 줄로 테두리가 옮겨 간다. */
const Outline: React.FC<{ f: number }> = ({ f }) => {
  const stepsK = on(f, wd('h2', 8) - 1, wd('h2', 11) - 4);
  const listK = on(f, wd('h2', 11) - 4);
  return (
    <>
      <div style={{ position: 'absolute', left: 40, top: 34, fontFamily: KO, fontWeight: 760, fontSize: 40, color: UI_INK, letterSpacing: '-0.03em' }}>SNS 업로드 자동화</div>
      <div style={{ position: 'absolute', left: 42, top: 92, fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>yuhobuilds · 10-20 첫날에 짠 구조</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 138, height: 1, background: RULE }} />
      <div style={{ position: 'absolute', left: 20, right: 20, top: 156, height: 3 * 108 - 8 }}>
        <Ring k={stepsK} r={18} />
        {STEPS.map((s, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 108, height: 100 }}>
            <div style={{ position: 'absolute', left: 24, top: 22, fontFamily: EN, fontWeight: 700, fontSize: 44, color: UI_MUTED }}>{s.n}</div>
            <div style={{ position: 'absolute', left: 92, top: 14, fontFamily: KO, fontWeight: 740, fontSize: 38, color: UI_INK, letterSpacing: '-0.02em' }}>{s.t}</div>
            <div style={{ position: 'absolute', left: 94, top: 62, fontFamily: KO, fontWeight: 560, fontSize: 25, color: UI_MUTED }}>{s.s}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 492, height: 1, background: RULE }} />
      <div style={{ position: 'absolute', left: 20, right: 20, top: 510, height: 100 }}>
        <Ring k={listK} r={18} />
        <div style={{ position: 'absolute', left: 22, top: 28, width: 40, height: 40, borderRadius: 10, boxShadow: `inset 0 0 0 3px ${UI_INK}` }} />
        <div style={{ position: 'absolute', left: 92, top: 14, fontFamily: KO, fontWeight: 740, fontSize: 38, color: UI_INK, letterSpacing: '-0.02em' }}>체크리스트</div>
        <div style={{ position: 'absolute', left: 94, top: 62, fontFamily: KO, fontWeight: 560, fontSize: 25, color: UI_MUTED }}>끝에 저장용 네 줄</div>
      </div>
    </>
  );
};

const TaskList: React.FC<{ cur: (i: number) => number }> = ({ cur }) => (
  <>
    <PanelTop title="예약된 작업" right="Claude" />
    {TASKS.map((t, i) => (
      <div key={i} style={{ position: 'absolute', left: 20, right: 20, top: 110 + i * 102, height: 90, borderRadius: 18, background: '#EFEDE7' }}>
        <Ring k={cur(i)} r={18} />
        <div style={{ position: 'absolute', left: 24, top: 14, width: 860, fontFamily: KO, fontWeight: 640, fontSize: 28, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.t}</div>
        <div style={{ position: 'absolute', left: 24, top: 54, fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>{t.at}</div>
      </div>
    ))}
  </>
);

/** 월요일 스캔 문서. lit: 지금 말하는 계기 낱말의 꼬리표만 켠다. picks: 고른 줄(누른 프레임). */
const ScanCard: React.FC<{ f: number; lit?: boolean; picks?: { i: number; at: number }[] }> = ({ f, lit, picks }) => {
  const trigK = (tr: string) => {
    if (!lit) return 0;
    const k = TRIG.indexOf(tr as (typeof TRIG)[number]);
    if (k < 0) return 0;
    return on(f, wd('s1', 8 + k) - 2, k < 3 ? wd('s1', 9 + k) - 2 : Infinity);
  };
  return (
    <>
      <PanelTop title="월요일 트렌드 스캔 · 2026-10-19" right="후보 7개" />
      {CANDS.map((c, i) => {
        const pk = picks?.find((p) => p.i === i);
        const pv = pk ? ease(f, pk.at, 6) : 0;
        const rowLit = Math.max(0, ...c.tr.map((tr) => trigK(tr)));
        return (
          <div key={i} style={{ position: 'absolute', left: 20, right: 20, top: 104 + i * 78, height: 70, borderBottom: `1px solid ${RULE}` }}>
            {pv > 0 || rowLit > 0 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: `rgba(245,196,69,${Math.max(0.22 * pv, 0.2 * rowLit)})` }} /> : null}
            <div style={{ position: 'absolute', left: 12, top: 21, fontFamily: MONO, fontSize: 22, color: UI_MUTED }}>{i + 1}</div>
            <div style={{ position: 'absolute', left: 54, top: 16, fontFamily: KO, fontWeight: 640, fontSize: 29, color: UI_INK, whiteSpace: 'nowrap' }}>
              {c.b}
              {pv > 0 ? <span style={{ marginLeft: 14, fontSize: 22, fontWeight: 700, color: '#7A5C00', opacity: pv }}>✓ 오늘 고름</span> : null}
            </div>
            <div style={{ position: 'absolute', right: 10, top: 13, display: 'flex', gap: 8 }}>
              {c.tr.map((tr) => {
                const l = trigK(tr);
                return (
                  <div key={tr} style={{ position: 'relative', padding: '6px 14px', borderRadius: 12, background: '#ECEAE4', color: UI_INK, fontFamily: KO, fontWeight: 650, fontSize: 23 }}>
                    <Ring k={l} r={12} />
                    {tr}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
};

/** 세션 목록(앱 Code 탭 재현): 조율 세션 하나와 만드는 세션 셋. */
const Sessions: React.FC<{ pill?: (i: number) => React.ReactNode; dim?: number; parentRight?: React.ReactNode; parentK?: number }> = ({ pill, dim = 0, parentRight, parentK = 0 }) => (
  <>
    <div style={{ position: 'absolute', left: 40, top: 28, fontFamily: KO, fontWeight: 650, fontSize: 33, color: UI_INK, letterSpacing: '-0.02em' }}>Code</div>
    <div style={{ position: 'absolute', right: 36, top: 36, fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>10-20</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 91, height: 1, background: RULE }} />
    <div style={{ position: 'absolute', left: 20, right: 20, top: 108, height: 76, borderRadius: 18, background: '#EBE9E3' }}>
      <Ring k={parentK} r={18} />
      <div style={{ position: 'absolute', left: 24, top: 31, width: 13, height: 13, borderRadius: 7, background: BUBBLE }} />
      <div style={{ position: 'absolute', left: 56, top: 17, fontFamily: KO, fontWeight: 620, fontSize: 31, color: BUBBLE, letterSpacing: '-0.02em' }}>{SESSION_TITLE}</div>
      <div style={{ position: 'absolute', right: 18, top: 18 }}>{parentRight ?? <span style={{ fontFamily: MONO, fontSize: 21, color: UI_MUTED, lineHeight: '40px' }}>17:35</span>}</div>
    </div>
    {CHILDREN.map((c, i) => (
      <div key={i} style={{ position: 'absolute', left: 66, right: 20, top: 198 + i * 84, height: 72 }}>
        <svg width={26} height={40} viewBox="0 0 26 40" style={{ position: 'absolute', left: -38, top: 2 }}>
          <path d="M4 0 L4 20 Q4 26 10 26 L22 26" fill="none" stroke="#CFCBC2" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', left: 18, top: 30, width: 11, height: 11, borderRadius: 6, background: BUBBLE, opacity: 1 - 0.5 * dim }} />
        <div style={{ position: 'absolute', left: 44, top: 17, width: 640, fontFamily: KO, fontWeight: 560, fontSize: 28.5, color: BUBBLE, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 1 - 0.5 * dim }}>{c.title}</div>
        <div style={{ position: 'absolute', right: 14, top: 16 }}>{pill ? pill(i) : <span style={{ fontFamily: MONO, fontSize: 21, color: UI_MUTED, lineHeight: '40px' }}>{c.meta}</span>}</div>
      </div>
    ))}
  </>
);
const Pill: React.FC<{ text: string; dark?: boolean; o?: number }> = ({ text, dark, o = 1 }) => (
  <span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 12, background: dark ? BUBBLE : '#E1DED6', color: dark ? ME_INK : '#5E5C56', fontFamily: KO, fontWeight: 680, fontSize: 22, lineHeight: '30px', opacity: o, whiteSpace: 'nowrap' }}>{text}</span>
);

/** 한도에 멈춘 세 세션 → 「이어서 해」를 쳐서 보낸다 → 다시 돈다. */
const LimitView: React.FC<{ f: number }> = ({ f }) => {
  const stop = ease(f, wd('s2b', 3), 6);
  const line = ease(f, wd('s2b', 4) - 2, 5);
  const resume = f >= wd('s2b', 8);
  return (
    <>
      <Sessions dim={stop * (resume ? 0 : 1)} pill={(i) => (stop > 0 ? <Pill text={resume ? '진행 중' : '멈춤'} dark={resume} o={stop} /> : <span style={{ fontFamily: MONO, fontSize: 21, color: UI_MUTED, lineHeight: '40px' }}>{CHILDREN[i].meta}</span>)} />
      {line > 0 ? (
        <div style={{ position: 'absolute', left: 20, right: 20, top: 458, height: 52, borderRadius: 14, background: BUBBLE, fontFamily: MONO, fontSize: 21, lineHeight: '52px', color: '#E8C26A', paddingLeft: 20, whiteSpace: 'nowrap', overflow: 'hidden', opacity: line * (resume ? 0.45 : 1) }}>{LIMIT_LINE}</div>
      ) : null}
      <Sent f={f} at={SEND_RESUME} text="이어서 해" top={520} />
      <Composer f={f} keys={KEYS_RESUME} times={KEYS_RESUME_AT} send={SEND_RESUME} top={590} />
    </>
  );
};

/** 예약 큐 출력(밝은 판 — 어두운 판은 검정 무대와 테두리가 붙어 밀어도 움직임이 안 보였다). 「사일 치」에 앞으로 나흘 칸 테두리, 「오늘부터」에 오늘 칸이 찬다. */
const QueueView: React.FC<{ f: number }> = ({ f }) => {
  const colX = (i: number) => 330 + i * 112;
  return (
    <>
      <div style={{ position: 'absolute', left: 34, top: 30, fontFamily: MONO, fontSize: 23, color: UI_MUTED }}>$ node tools/예약큐.js</div>
      <div style={{ position: 'absolute', left: 34, top: 74, fontFamily: KO, fontWeight: 650, fontSize: 30, color: UI_INK }}>예약 큐 · 오늘 2026-10-20</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 130, height: 1, background: RULE }} />
      <div style={{ position: 'absolute', left: 34, top: 156, fontFamily: KO, fontWeight: 600, fontSize: 22, color: UI_MUTED }}>브랜드</div>
      {Q_DATES.map((d, i) => (
        <div key={d} style={{ position: 'absolute', left: colX(i) - 50, width: 100, top: 158, textAlign: 'center', fontFamily: MONO, fontSize: 21, color: i === 0 ? UI_INK : UI_MUTED }}>
          {d}
        </div>
      ))}
      <div style={{ position: 'absolute', left: 852, top: 156, fontFamily: KO, fontWeight: 600, fontSize: 22, color: UI_MUTED }}>비축</div>
      {[1, 2, 3, 4].map((i) => {
        const g = ease(f, wd('s3', 6) + (i - 1) * 3, 6);
        return g > 0 ? <div key={i} style={{ position: 'absolute', left: colX(i) - 46, width: 92, top: 196, height: 4 * 74 - 6, borderRadius: 16, border: `2.5px dashed rgba(214,163,30,${0.9 * g})`, background: `rgba(245,196,69,${0.12 * g})` }} /> : null;
      })}
      {ease(f, wd('s3', 9), 8) > 0 ? <div style={{ position: 'absolute', left: colX(0) - 46, width: 92, top: 196, height: 4 * 74 - 6, borderRadius: 16, background: `rgba(245,196,69,${0.22 * ease(f, wd('s3', 9), 8)})` }} /> : null}
      {Q_BRANDS.map((b, r) => {
        const fill = ease(f, wd('s3', 9) + r * 3, 6);
        return (
          <React.Fragment key={b}>
            <div style={{ position: 'absolute', left: 34, top: 210 + r * 74, fontFamily: KO, fontWeight: 650, fontSize: 31, color: UI_INK }}>{b}</div>
            {Q_DATES.map((d, i) => (
              <div key={d} style={{ position: 'absolute', left: colX(i) - 50, width: 100, top: 206 + r * 74, textAlign: 'center', fontFamily: EN, fontWeight: 600, fontSize: 36, color: i === 0 ? UI_INK : '#C9C5BC' }}>
                {i === 0 ? (fill > 0.5 ? <span style={{ color: '#C99A1C' }}>●</span> : '○') : '·'}
              </div>
            ))}
            <div style={{ position: 'absolute', left: 852, top: 214 + r * 74, fontFamily: KO, fontWeight: 600, fontSize: 26, color: UI_MUTED }}>0일</div>
          </React.Fragment>
        );
      })}
      <div style={{ position: 'absolute', left: 34, top: 528, fontFamily: KO, fontWeight: 600, fontSize: 22, color: UI_MUTED }}>○ 승인 대기 · ● 예약됨</div>
    </>
  );
};

/** 실제 캡처 넷: 브라우저 창 안에서 박마다 컷. */
/** page: 있으면 그 폭으로 왼쪽 위에 붙인다(웹 페이지처럼, 오른쪽은 창 밖). 없으면 가운데 맞춤. */
const CAPS: { src: string; key: string; bg: string; url: string; label: string; page?: number }[] = [
  { src: 'cap/ig_cal2.png', key: 'ig_cal2', bg: '#0C0D10', url: 'instagram.com · 예약된 콘텐츠', label: '인스타 · 계정마다 따로 예약 달력' },
  { src: 'cap/bs.png', key: 'bs', bg: '#FFFFFF', url: 'business.facebook.com · 예약됨', label: 'Business Suite · 예약된 게시물 없음' },
  { src: 'cap/tt.png', key: 'tt', bg: '#FFFFFF', url: 'tiktok.com/tiktokstudio', label: '틱톡 스튜디오 · 로그인한 한 계정만', page: 1100 },
  { src: 'cap/rednote.png', key: 'rednote', bg: '#FFFFFF', url: 'creator.rednote.com', label: '샤오훙수 · 주소가 rednote', page: 1700 },
];
const CAP_AT = [890, 902, 914, 926] as const;
const BrowserCaps: React.FC<{ f: number }> = ({ f }) => {
  let k = 0;
  for (let i = 0; i < CAP_AT.length; i++) if (f >= CAP_AT[i]) k = i;
  const c = CAPS[k];
  const [w, hh] = CAP_SIZE[c.key];
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 64, background: '#1E1D1B', borderBottom: '1px solid #2E2D2A' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: 'absolute', left: 26 + i * 22, top: 26, width: 12, height: 12, borderRadius: 6, background: '#3E3C38' }} />
        ))}
        <div style={{ position: 'absolute', left: 110, right: 26, top: 14, height: 36, borderRadius: 10, background: '#2A2926', fontFamily: MONO, fontSize: 20, lineHeight: '36px', color: '#B6B3AB', paddingLeft: 16, overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.url}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 64, bottom: 76, background: c.bg, overflow: 'hidden' }}>
        {c.page ? (
          <Img src={staticFile(c.src)} style={{ position: 'absolute', left: 0, top: 0, width: c.page, height: (c.page * hh) / w, display: 'block' }} />
        ) : (
          <Cap src={c.src} w={w} h={hh} maxW={c.key === 'bs' ? 620 : 952} />
        )}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 76, background: '#141412', borderTop: '1px solid #2A2926' }}>
        <div style={{ position: 'absolute', left: 28, top: 22, fontFamily: KO, fontWeight: 650, fontSize: 28, color: INK, whiteSpace: 'nowrap' }}>{c.label}</div>
      </div>
    </>
  );
};

/** 올리기는 조율 창 하나에서, 만드는 창은 만들기만. */
const OnePlace: React.FC<{ f: number }> = ({ f }) => (
  <Sessions parentK={on(f, wd('s3b', 5) - 2)} parentRight={<Pill text="올리기 · 한 창에서" dark />} pill={() => <Pill text="만들기만" />} />
);

/** 체크리스트: 말에 맞춰 한 줄씩 체크되고, 지금 줄에만 옅은 바탕. 「저장해」에 커서가 책갈피를 누른다. */
const Checklist: React.FC<{ f: number }> = ({ f }) => {
  const save = ease(f, wd('cta', 0) + 1, 5);
  return (
    <>
      <div style={{ position: 'absolute', left: 38, top: 34, fontFamily: KO, fontWeight: 760, fontSize: 40, color: UI_INK, letterSpacing: '-0.03em' }}>SNS 업로드 자동화 체크리스트</div>
      <div style={{ position: 'absolute', left: 40, top: 92, fontFamily: MONO, fontSize: 21, color: UI_MUTED }}>yuhobuilds · 10-20 첫날에 짠 구조</div>
      <svg width={46} height={58} viewBox="0 0 46 58" style={{ position: 'absolute', right: 38, top: 34 }}>
        <path d="M5 4 Q5 2 7 2 L39 2 Q41 2 41 4 L41 54 L23 41 L5 54 Z" fill={save > 0.5 ? BUTTER : 'none'} stroke={save > 0.5 ? BUTTER : UI_INK} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 140, height: 1, background: RULE }} />
      {CHECK.map((c, i) => {
        const k = ease(f, c.at, 7);
        const cur = on(f, c.at - 2, i < 3 ? CHECK[i + 1].at - 2 : wd('cta', 0) - 6);
        return (
          <div key={i} style={{ position: 'absolute', left: 20, right: 20, top: 156 + i * 128, height: 118 }}>
            {cur > 0 ? <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: `rgba(245,196,69,${0.16 * cur})` }} /> : null}
            {i < 3 ? <div style={{ position: 'absolute', left: 6, right: 6, bottom: -6, height: 1, background: RULE }} /> : null}
            <div style={{ position: 'absolute', left: 20, top: 36, width: 44, height: 44, borderRadius: 11, background: k > 0.5 ? UI_INK : undefined, boxShadow: `inset 0 0 0 3px ${UI_INK}` }}>
              {k > 0 ? (
                <svg width={44} height={44} viewBox="0 0 40 40">
                  <path d="M9 21 L17 29 L32 12" fill="none" stroke={BUTTER} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} strokeDashoffset={40 * (1 - k)} />
                </svg>
              ) : null}
            </div>
            <div style={{ position: 'absolute', left: 90, top: 22, fontFamily: KO, fontWeight: 720, fontSize: 35, color: UI_INK, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{c.t}</div>
            <div style={{ position: 'absolute', left: 92, top: 70, fontFamily: KO, fontWeight: 560, fontSize: 24, color: UI_MUTED, whiteSpace: 'nowrap' }}>{c.s}</div>
          </div>
        );
      })}
    </>
  );
};

const Content: React.FC<{ k: K; f: number }> = ({ k, f }) => {
  switch (k) {
    case 'chat':
      return <ChatQueue f={f} />;
    case 'cards':
      // 「세 편」에 한 편씩 테두리가 옮겨 간다
      return <ThreeCards cur={(i) => on(f, wd('h2', 2) - 1 + i * 6, i < 2 ? wd('h2', 2) + 5 + i * 6 : Infinity)} />;
    case 'outline':
      return <Outline f={f} />;
    case 'tasks1':
      return <TaskList cur={(i) => (i === 0 ? on(f, wd('s1', 2)) : 0)} />;
    case 'scan':
      return <ScanCard f={f} lit />;
    case 'tiles':
      return (
        <>
          <PanelTop title="오늘 17:53 · 채널 12곳" right="예약 0" />
          <TileGrid f={f} top={124} checkA={0} checkB={0} all />
        </>
      );
    case 'pick':
      return <ScanCard f={f} picks={CLICKS.filter((c) => c.pick !== undefined).map((c) => ({ i: c.pick as number, at: c.at }))} />;
    case 'tasks2':
      return <TaskList cur={(i) => (i >= 1 && i <= 3 ? on(f, wd('s2', 2) + (i - 1) * 8, i < 3 ? wd('s2', 2) + i * 8 : Infinity) : 0)} />;
    case 'final':
      return <ThreeCards chk={(i) => ease(f, wd('s2', 10) - 6 + i * 4, 8)} />;
    case 'limit':
      return <LimitView f={f} />;
    case 'tasks3':
      return <TaskList cur={(i) => (i === 4 ? on(f, wd('s3', 1)) : 0)} />;
    case 'queue':
      return <QueueView f={f} />;
    case 'caps':
      return <BrowserCaps f={f} />;
    case 'one':
      return <OnePlace f={f} />;
    case 'check':
      return <Checklist f={f} />;
    default:
      return null;
  }
};

// ───────────── 커서(재현): 누를 곳(판 안 좌표)과 누르는 프레임 ─────────────
type Click = { at: number; x: number; y: number; from: [number, number]; pick?: number };
const CLICKS: Click[] = [
  { at: wd('s1', 2), x: 400, y: 160, from: [720, 640] }, // 월요일 스캔 작업
  { at: wd('s1b', 7), x: 330, y: 217, from: [760, 620], pick: 1 }, // 후보 2 고름
  { at: wd('s1b', 7) + 8, x: 330, y: 529, from: [330, 217], pick: 5 }, // 후보 6 고름(이어서)
  { at: wd('s3', 1), x: 420, y: 566, from: [780, 660] }, // 14:00 예약 큐 작업
  { at: wd('cta', 0), x: 893, y: 66, from: [700, 380] }, // 저장(책갈피)
];
const TRAVEL = 16;
const chained = (j: number) => j > 0 && CLICKS[j].at - CLICKS[j - 1].at < 30;
const startOf = (j: number) => (chained(j) ? CLICKS[j - 1].at + 2 : CLICKS[j].at - TRAVEL - 1);

const CursorLayer: React.FC<{ f: number; s: number }> = ({ f, s }) => {
  let i = -1;
  for (let j = 0; j < CLICKS.length; j++) if (f >= startOf(j) - 4) i = j;
  const rings = CLICKS.map((c, j) => {
    const r = interpolate(f, [c.at, c.at + 12], [0, 1], clamp);
    if (r <= 0 || r >= 1) return null;
    return <div key={j} style={{ position: 'absolute', left: c.x - 10 - 46 * r, top: c.y - 10 - 46 * r, width: 20 + 92 * r, height: 20 + 92 * r, borderRadius: '50%', border: '3px solid rgba(17,17,17,0.45)', opacity: 1 - r }} />;
  });
  if (i < 0) return <>{rings}</>;
  const c = CLICKS[i];
  const cin = chained(i);
  const cout = i + 1 < CLICKS.length && chained(i + 1);
  const s0 = startOf(i);
  const from: [number, number] = cin ? [CLICKS[i - 1].x, CLICKS[i - 1].y] : c.from;
  const t = ease(f, s0, c.at - 1 - s0, EASE_MOVE);
  const mid: [number, number] = [mix(from[0], c.x, 0.5) + (cin ? 24 : 70), mix(from[1], c.y, 0.5) + (cin ? 0 : 50)];
  const [cx, cy] = bezier(from, mid, [c.x, c.y], t);
  const press = interpolate(f, [c.at - 2, c.at, c.at + 4], [0, 1, 0], clamp);
  const o = (cin ? 1 : ease(f, s0 - 4, 5)) * (cout ? 1 : 1 - ease(f, c.at + 8, 6));
  return (
    <>
      {rings}
      {o > 0 ? (
        <div style={{ position: 'absolute', left: cx, top: cy, transform: `scale(${1 / Math.sqrt(s)})`, transformOrigin: '0 0' }}>
          <Cursor x={0} y={0} press={press} ring={0} opacity={o} />
        </div>
      ) : null}
    </>
  );
};

// ───────────── 판 + 카메라 ─────────────
const Panel: React.FC = () => {
  const f = useCurrentFrame();
  const i = sceneAt(f);
  const sc = SCENES[i];
  const { s, tx, ty } = camera(f, i);
  const p = push(f, i);
  const fadeOut = 1 - ease(f, S.end - 8, 8);
  if (fadeOut <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: VP.x, top: VP.y, width: W, height: H, borderRadius: VP.r, overflow: 'hidden', background: sc.bg, boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 26px 70px rgba(0,0,0,0.5)', opacity: fadeOut, transform: `scale(${p})`, transformOrigin: `${sc.o[0]}px ${sc.o[1]}px` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: '0 0' }}>
        <Content k={sc.k} f={f} />
        <CursorLayer f={f} s={s} />
      </div>
    </div>
  );
};

// ───────────── 머리글: 문장마다 한 벌, 다음 벌로 컷 ─────────────
type Head = { at: number; lines: string[]; accent?: string; size?: number };
const HEADS: Head[] = [
  { at: -1, lines: ['SNS 업로드 자동화,', '사람이 할 일은', '"올려" 한 마디'], accent: '"올려"', size: 74 },
  { at: 105, lines: ['첫날인 오늘', '세 편'], accent: '세 편' },
  { at: 172, lines: ['세 단계로,', '끝엔 체크리스트'], accent: '체크리스트' },
  { at: 233, lines: ['첫째, 소재는', '월요일에 한 주 치'], accent: '월요일에' },
  { at: wd('s1', 8) - 3, lines: ['트렌드, 질문,', '달력, 실화'] },
  { at: 405, lines: ['예약이 텅 비어도,', '만들 건 이 후보에서'], accent: '후보에서', size: 74 },
  { at: 488, lines: ['둘째, 제작은 매일', '아침 7시로 걸어 뒀어요'], accent: '7시', size: 74 },
  { at: 580, lines: ['저는', '최종본만 봐요'], accent: '최종본만' },
  { at: 626, lines: ['오늘은 셋 다', '사용량 한도에 멈췄는데'], accent: '한도에', size: 74 },
  { at: wd('s2b', 6) - 3, lines: ['"이어서 해"로', '다시 이었어요'], accent: '"이어서 해"' },
  { at: 748, lines: ['셋째, 게시는', '"올려" 한 마디'], accent: '"올려"' },
  { at: 815, lines: ['목표는 4일 치 비축,', '오늘부터 쌓아요'], accent: '4일 치', size: 74 },
  { at: 890, lines: ['채널마다 화면이 달라서,', '올리기는 한 창에서'], accent: '한 창에서', size: 72 },
  { at: wd('s3b', 8) - 3, lines: ['동시엔', '엉켜요'], accent: '엉켜요' },
  { at: 1025, lines: ['정리하면', '넷'], accent: '넷' },
  { at: wd('cta', 0) - 3, lines: ['저장해 두고', '하나씩 따라 해 보세요'], accent: '저장해' },
];
const Heads: React.FC = () => (
  <>
    {HEADS.map((h, i) => (
      <Line key={i} lines={h.lines} accent={h.accent} at={h.at} until={i + 1 < HEADS.length ? HEADS[i + 1].at : S.end} fade={i + 1 === HEADS.length} size={h.size} />
    ))}
  </>
);

// ───────────── 무대 아래 표시 ─────────────
const Label: React.FC = () => {
  const f = useCurrentFrame();
  const o = 1 - ease(f, S.end - 8, 8);
  if (o <= 0) return null;
  const k = SCENES[sceneAt(f)].k;
  const text = k === 'cards' || k === 'final' ? '오늘 만든 세 편의 실제 0초 화면' : k === 'caps' ? '실제 화면 · 10-20 17:45~17:51' : k === 'outline' || k === 'check' ? '이 영상의 구조' : '재현 화면 · 이름과 시각은 실제';
  return <div style={{ position: 'absolute', left: 72, top: VP.y + VP.h + 64, fontFamily: KO, fontWeight: 560, fontSize: 25, letterSpacing: '-0.01em', color: DIM, opacity: o }}>{text}</div>;
};

// ───────────── 소리: 컷은 박이 맡고, 효과음은 누름·입력·체크에만 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (): Hit[] => [
  ...KEYS_POST_AT.map((at) => ({ at, src: 'sfx/tick.wav', v: 0.09 })),
  { at: SEND_POST, src: 'sfx/snap.wav', v: 0.22 },
  { at: SEND_POST + 4, src: 'sfx/tick2.wav', v: 0.14 },
  ...CLICKS.map((c) => ({ at: c.at, src: 'sfx/tok.wav', v: 0.3 })),
  { at: wd('s2b', 3), src: 'sfx/thud.wav', v: 0.22 },
  ...KEYS_RESUME_AT.map((at) => ({ at, src: 'sfx/tick.wav', v: 0.09 })),
  { at: SEND_RESUME, src: 'sfx/snap.wav', v: 0.22 },
  { at: wd('s2b', 8), src: 'sfx/tick2.wav', v: 0.16 },
  ...[0, 1, 2].map((i) => ({ at: wd('s2', 10) - 6 + i * 4, src: 'sfx/tick2.wav', v: 0.18 })),
  { at: wd('s3', 9), src: 'sfx/tick2.wav', v: 0.14 },
  ...CHECK.map((c) => ({ at: c.at, src: 'sfx/tick2.wav', v: 0.22 })),
  // 큰 카메라 이동에만 아주 작게(한 편 넷)
  ...[44, 316, 662, 1134].map((at) => ({ at, src: 'sfx/swish.wav', v: 0.1 })),
  { at: END_FOLLOW, src: 'sfx/tok.wav', v: 0.42 },
];

export const V8Film: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = LINES.map((id) => [VO[id], lineEnd(id)] as [number, number])
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
    return (0.42 - 0.14 * voice) * tail;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Panel />
      <Label />
      <Heads />
      <EndGate />
      {LINES.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo7/${id}.wav`)} />
        </Sequence>
      ))}
      {hits().map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm_v7.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

/** 끝 카드는 전체 프레임 기준으로 짜여 있어 Sequence로 감싸지 않는다. 검정에서 8프레임 불투명도로만 들어온다. */
const EndGate: React.FC = () => {
  const f = useCurrentFrame();
  if (f < S.end) return null;
  return (
    <AbsoluteFill style={{ opacity: ease(f, S.end, 8) }}>
      <EndCard />
    </AbsoluteFill>
  );
};
