// yuhobuilds Y19 v2(10-29) 「AI한테 빵집 홈페이지 글 맡겼더니 — 없는 손님 후기 3개」. 기획 · 칸표는 ../../../기획.md 「v2」.
// 오마주 원본 Ls0r557jclc(단테 「AI한테 맡기고 자리 비웠더니 15배 빨라짐 (근데 8분 만에 퇴근)」, 같은분야)의 뼈대를 1:1로 —
// 0.3초 실제 화면 위 큰 결과(훅) · 6.0초 반전 · 카드 · 빨리 넘기는 실제 답 · 결과 화면 · 다시 해 본 표 · 끝 카드 둘 + 질문.
// 원본에서 가져온 꼴(아르곤 첫 분석): 왼쪽 위 출처 꼬리표 · 아래 고정 자막창(그 칸 말을 한 번에) · 좋은 결과와 한계의 두 색.
// r5(첫 렌더 r4 이해 시험 뒤): 두 시험관이 지난 편들(검정 무대 · 노란 머리글 · 「부탁 맨 끝에 한 줄」)과 「같아 보임」이라 무대를 밝은 종이로,
// 「한 줄」 낱말을 빼고 반전 안내를 크게, 17.8초 칸은 원본의 빨리 감기처럼 받은 답 전체를 빨리 넘기며 [빈칸]이 켜지게 바꿨다.
// 화면은 ChatGPT 임시 채팅 실제 답 두 장(../../../시안/*_실제화면.jpg) 그대로, 다시 짠 판(카드 · 빨리 넘김 · 표 · 끝 카드)의 글은
// 실제 답(../../../자료/실험_답.md A2 · B2) 그대로.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, interpolateColors, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp } from '../lib/motion';
import { ease, EASE_MOVE } from '../y9/Type';
import { at, B, lineEnd, lineText, ORDER, TOTAL, VO } from './time';

const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)
const PAPER = '#F4F1EA';
const INK = '#1F1E1B';
const EDGE = '#D8D3C8';
const CARD = '#FFFFFF';
const CORAL = '#D2532E';
const MARK = '#F5C445';
const SHOT_BG = '#0D0D0D';
// 어두운 판(실제 채팅 화면 · 표 · 끝 카드) — 밝은 종이 위 흰 카드는 밀어도 정지 검사(270칸으로 줄여 잼)에 「거의 멈춤」으로 잡혔다(r8 표 31~35초)
const DARK_CARD = '#1F1E1C';
const DARK_INK = '#F4F2EC';
const DARK_MUTED = '#9B988F';
const DARK_EDGE = '#3A3833';
const CORAL_ON_DARK = '#F2785A';

const PX = 72; // 글 안전 영역 x 65~920(올리기 전 검사 ⑤)
const PW = 920 - PX;
const PANEL = { x: 66, y: 605, w: 880, h: 610 }; // 판째 위로 밀려도(0.12px/프레임 · 장면 6.4초에 23px) 머리글 아래끝 555에 닿지 않게
const HEAD_TOP = 360;

/** [빈칸] 형광펜 — 글은 진하게, 바탕만 버터. */
const Blank: React.FC<{ p?: number; children?: React.ReactNode }> = ({ p = 1, children = '[빈칸]' }) => (
  <span style={{ background: interpolateColors(p, [0, 1], ['rgba(245,196,69,0)', MARK]), color: p > 0.5 ? INK : undefined, borderRadius: 8, padding: '0 8px', margin: '0 -2px' }}>{children}</span>
);

// ───────────── 머리글(밝은 무대 판 — y9 Line과 같은 올림, 글 색만 진하게) ─────────────
type Accent = { text: string; kind: 'coral' | 'mark' };
const paint = (ln: string, a?: Accent) => {
  const k = a ? ln.indexOf(a.text) : -1;
  if (!a || k < 0) return ln;
  return (
    <>
      {ln.slice(0, k)}
      {a.kind === 'mark' ? <Blank>{a.text}</Blank> : <span style={{ color: CORAL }}>{a.text}</span>}
      {ln.slice(k + a.text.length)}
    </>
  );
};
const Head: React.FC<{ lines: string[]; accent?: Accent; at: number; until: number; dark?: boolean }> = ({ lines, accent, at, until, dark }) => {
  const f = useCurrentFrame();
  if ((at > 0 && f < at) || f >= until) return null;
  return (
    <div style={{ position: 'absolute', left: PX, top: HEAD_TOP, fontFamily: KO, fontWeight: 780, fontSize: 84, lineHeight: 1.16, letterSpacing: '-0.035em', color: dark ? '#F4F2EC' : INK }}>
      {lines.map((ln, i) => {
        const p = at <= 0 ? 1 : ease(f, at + 3 * i, 10);
        return (
          <div key={i} style={{ overflow: 'hidden', whiteSpace: 'nowrap', padding: '0.06em 0 0.16em', margin: '-0.06em 0 -0.16em' }}>
            <div style={{ transform: p < 1 ? `translateY(${(1 - p) * 28}px)` : undefined, opacity: p }}>{paint(ln, accent)}</div>
          </div>
        );
      })}
    </div>
  );
};

// ───────────── 실제 화면 ─────────────
/** 실제 화면 한 장을 판 안에 놓는다. 원본 좌표 (sx, sy)가 판 왼쪽 위에, 배율 s, 판 가운데 기준 확대 z. 표시(marks)도 원본 좌표로. */
type Box = { x0: number; y0: number; x1: number; y1: number; p: number; color?: string; tag?: string };
const Shot: React.FC<{ src: string; s: number; sx: number; sy: number; z?: number; marks?: Box[] }> = ({ src, s, sx, sy, z = 1, marks = [] }) => (
  <div style={{ position: 'absolute', left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, overflow: 'hidden', borderRadius: 28, background: SHOT_BG, boxShadow: '0 2px 0 rgba(0,0,0,0.04), 0 24px 50px rgba(60,50,30,0.22)' }}>
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 50%' }}>
      <div style={{ position: 'absolute', left: -sx * s, top: -sy * s, width: 1080 * s }}>
        <Img src={staticFile(src)} style={{ width: 1080 * s, display: 'block' }} />
        {marks.map((m, i) => {
          const c = m.color ?? MARK;
          return (
            <React.Fragment key={i}>
              <div style={{ position: 'absolute', left: (m.x0 - 14) * s, top: (m.y0 - 10) * s, width: (m.x1 - m.x0 + 28) * s, height: (m.y1 - m.y0 + 20) * s, borderRadius: 12, boxShadow: `inset 0 0 0 ${5 * m.p}px ${c}`, background: interpolateColors(m.p, [0, 1], ['rgba(0,0,0,0)', c === MARK ? 'rgba(245,196,69,0.12)' : 'rgba(242,120,90,0.16)']) }} />
              {m.tag ? (
                <div style={{ position: 'absolute', left: (m.x1 + 30) * s, top: ((m.y0 + m.y1) / 2) * s, transform: `translateY(-50%) scale(${m.p < 1 ? 1.5 - 0.5 * m.p : 1})`, transformOrigin: '0 50%', opacity: m.p, padding: '6px 18px 9px', borderRadius: 12, background: c === MARK ? MARK : '#F2785A', color: '#121211', fontFamily: KO, fontWeight: 800, fontSize: 38, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{m.tag}</div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  </div>
);

/** 왼쪽 위 출처 꼬리표(원본의 「단테 맥 · …」 자리). */
const Badge: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', left: PX, top: 286, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px 10px', borderRadius: 999, background: CARD, boxShadow: `inset 0 0 0 2px ${EDGE}`, fontFamily: KO, fontWeight: 680, fontSize: 30, color: '#55524B', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
    <span style={{ width: 12, height: 12, borderRadius: 6, background: CORAL }} />
    {text}
  </div>
);

/** 장면 하나: a에 들어와(원본처럼 바로 넘김) b에 사라진다. drift는 아주 느린 밀림(올리기 전 검사 ② · ⑬). */
const Scene: React.FC<{ a: number; b: number; drift?: number; children: React.ReactNode }> = ({ a, b, drift = 0, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  // 원본처럼 바로 넘김 — r5까지 4프레임 올림을 두었더니 컷 첫 프레임이 빈 화면으로 찍혀 「6초 화면이 비었다」(r5 sonnet)
  const k = f - Math.max(0, a);
  return <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-drift * k}px)` }}>{children}</div>;
};

// ───────────── 장면들 ─────────────
// 실제 화면 좌표(원본 1080px 기준, 줄마다 잰 값): before.jpg 안내 547~650 · 후기 작성자 889~927 / 1165~1202 / 1441~1479,
// after.jpg [빈칸] 1364~1404 · 작성자 줄 1470~1510 · 후기 02 [빈칸] 1681~1721.

/** 1 훅(0~6초): 그냥 부탁해 받은 실제 답 — 후기 셋의 작성자 줄에 「없는 손님」. */
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const p = (i: number) => ease(f, B.hook + 4 * i, 8);
  return (
    <Shot
      src="img/before.jpg"
      s={0.77}
      sx={-24}
      sy={700}
      z={1 + 0.00028 * f}
      marks={[
        { x0: 105, y0: 889, x1: 409, y1: 927, p: p(0), color: CORAL, tag: '지어낸 손님' },
        { x0: 105, y0: 1165, x1: 544, y1: 1202, p: p(1), color: CORAL, tag: '지어낸 손님' },
        { x0: 105, y0: 1441, x1: 332, y1: 1479, p: p(2), color: CORAL, tag: '지어낸 손님' },
      ]}
    />
  );
};

/** 2 반전(6~11.9초): 같은 답 위쪽 — 후기 바로 위 안내 두 문장에 테, 그 두 문장을 크게(자르지 않는다, v1 Fable 사실 검수 1). */
const Twist: React.FC = () => {
  const f = useCurrentFrame();
  const k = f - B.twist;
  const big = ease(f, B.twistMark, 9);
  const sweep = ease(f, at('v2', '예시니까') - 2, 14); // 「예시니까」에 형광펜이 두 낱말을 긋는다
  const hl = (t: string, p: number) => <span style={{ backgroundImage: `linear-gradient(${MARK}, ${MARK})`, backgroundRepeat: 'no-repeat', backgroundSize: `${100 * p}% 100%`, borderRadius: 6 }}>{t}</span>;
  return (
    <>
      <Shot src="img/before.jpg" s={0.9} sx={78} sy={418} z={1 + 0.0004 * k} marks={[{ x0: 111, y0: 547, x1: 950, y1: 650, p: big }]} />
      <div style={{ position: 'absolute', left: PANEL.x + 30, top: PANEL.y + 300, width: PANEL.w - 60, opacity: big, transform: `translateY(${(1 - big) * 36}px)`, padding: '30px 36px 34px 50px', borderRadius: 24, background: CARD, boxShadow: '0 26px 54px rgba(40,30,10,0.35)', fontFamily: KO }}>
        <div style={{ position: 'absolute', left: 0, top: 22, bottom: 22, width: 10, borderRadius: 5, background: MARK }} />
        <div style={{ fontWeight: 700, fontSize: 50, lineHeight: 1.34, letterSpacing: '-0.03em', color: INK, fontStyle: 'italic', wordBreak: 'keep-all' }}>
          아래 후기는 홈페이지 구성용 {hl('예시입니다.', sweep)} 실제 손님들의 후기로 {hl('교체해 주세요.', ease(f, at('v2', '예시니까') + 10, 14))}
        </div>
      </div>
    </>
  );
};

/** 3 덧붙인 말(11.9~17.8초): 새 채팅의 실제 부탁(B2 원문, 가운데만 「…」) → 끝에 덧붙인 말 두 토막. */
const Rules: React.FC = () => {
  const f = useCurrentFrame();
  const ask = ease(f, B.rule, 7);
  const c1 = ease(f, B.card2, 7);
  const c2 = ease(f, B.card3, 7);
  const card = (p: number, body: React.ReactNode) => (
    <div style={{ marginTop: 22, opacity: p, transform: `translateY(${(1 - p) * -20}px)`, padding: '26px 34px 30px', borderRadius: 24, background: CARD, boxShadow: `inset 0 0 0 3px ${INK}, 0 14px 30px rgba(40,30,10,0.12)`, fontFamily: KO, fontWeight: 800, fontSize: 62, lineHeight: 1.2, letterSpacing: '-0.035em', color: INK, whiteSpace: 'nowrap' }}>{body}</div>
  );
  return (
    <div style={{ position: 'absolute', left: PX, top: PANEL.y + 10, width: PW }}>
      <div style={{ opacity: ask, padding: '24px 32px 28px', borderRadius: 24, background: '#E9E5DC', fontFamily: KO, fontWeight: 600, fontSize: 40, lineHeight: 1.36, letterSpacing: '-0.02em', color: '#57534B', wordBreak: 'keep-all' }}>
        동네에서 작은 빵집을 해. … 홈페이지에 들어갈 글 써 줘. 소개, 대표 메뉴, 손님 후기까지.
      </div>
      {card(c1, '단, 모르는 숫자 · 후기 · 이름은')}
      {card(
        c2,
        <>
          지어내지 말고 <Blank />
          으로 남겨 줘.
        </>,
      )}
    </div>
  );
};

/** 4 빨리 넘김(17.8~23.2초): 덧붙여 받은 실제 답(B2 원문 — 소개 · 메뉴 문장은 몇 줄만) 전체를 빨리 넘긴다 — 원본의 85배속 실행 기록 자리.
 *  [빈칸]이 화면 가운데를 지나며 켜진다. */
// r10: r9 이해 시험 두 시험관이 다 18~24초에서 넘김(「글씨가 작고 빽빽한 데다 같은 [빈칸]이 되풀이」) — 스물여섯 줄 42px에서
// 사람이 채울 자리 열 줄만 56px로 줄였다(B2 원문 그대로, 줄 순서도 답 순서).
const B2: string[] = [
  '판매 가격: [빈칸]원',
  '알레르기 및 원재료 정보: [빈칸]',
  '고객 후기 01  [빈칸]',
  '— 작성자: [빈칸]',
  '고객 후기 02  [빈칸]',
  '고객 후기 03  [빈칸]',
  '매장 이름: [빈칸]',
  '주소: [빈칸]',
  '영업시간: [빈칸]',
  '전화번호: [빈칸]',
];
const ROW = 104;
const STREAM_BG = '#161616';
const STREAM_TOP = 560; // 머리글 아래부터 자막창 위까지가 흐르는 칸
const STREAM_H = 1225 - STREAM_TOP;
/** r6 올리기 전 검사: 밝은 종이 위 판 안에서만 글이 흐르면 장면 모양이 그대로라 「한 구성 5.5초」(⑬)로 잡혔다 — 원본처럼 화면 전체를 어두운
 *  실행 기록 칸으로 바꾸고 글줄이 화면 폭 그대로 흐르게 했다. */
const Stream: React.FC = () => {
  const f = useCurrentFrame();
  // 17.8초에 맨 위에서 출발해 22.3초에 맨 끝에 멈춘다(원본은 21초에 로그가 멈추고 22.3초에 다음 박자).
  const run = interpolate(f, [B.prompt, B.sent], [0, 1], { ...clamp, easing: EASE_MOVE });
  const top = STREAM_TOP + 40 - run * (B2.length * ROW - (STREAM_H - 100));
  const stop = ease(f, B.sent, 8);
  return (
    <AbsoluteFill style={{ background: STREAM_BG }}>
      {B2.map((ln, i) => {
        const y = top + i * ROW;
        if (y < STREAM_TOP - ROW || y > STREAM_TOP + STREAM_H) return null;
        const lit = interpolate(y, [STREAM_TOP + STREAM_H * 0.62, STREAM_TOP + STREAM_H * 0.86], [1, 0], clamp); // 아래에서 올라와 보이자마자 켜진다(r10 — 맨 끝 줄도 멈추기 전에 켜지게)
        const parts = ln.split('[빈칸]');
        return (
          <div key={i} style={{ position: 'absolute', left: PX, top: y, height: ROW, whiteSpace: 'nowrap', fontFamily: KO, fontSize: 56, letterSpacing: '-0.025em', color: '#ECEAE4', fontWeight: 700 }}>
            {parts.map((t, k) => (
              <React.Fragment key={k}>
                {t}
                {k < parts.length - 1 ? <Blank p={lit} /> : null}
              </React.Fragment>
            ))}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: STREAM_TOP + 40, background: `linear-gradient(${STREAM_BG} 0, ${STREAM_BG} ${STREAM_TOP}px, rgba(22,22,22,0) ${STREAM_TOP + 40}px)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: STREAM_TOP + STREAM_H, bottom: 0, background: STREAM_BG }} />
      <div style={{ position: 'absolute', left: PANEL.x - 20, right: 1080 - PANEL.x - PANEL.w - 20, top: STREAM_TOP - 10, height: STREAM_H + 20, borderRadius: 24, boxShadow: `inset 0 0 0 ${6 * stop}px ${MARK}` }} />
    </AbsoluteFill>
  );
};

/** 5 결과(23.2~29.6초): 덧붙여 받은 실제 답 — 후기 · 작성자 [빈칸], 매장 이름 · 판매 가격 칸을 크게(B2 원문). */
const Result: React.FC = () => {
  const f = useCurrentFrame();
  const k = f - B.result;
  const box = ease(f, VO.v5 + 8, 8);
  const who = ease(f, VO.v5 + 30, 8);
  return (
    <>
      <Shot
        src="img/after.jpg"
        s={0.92}
        sx={70}
        sy={1180 + 0.43 * k} // 실제 화면을 천천히 내린다(r7 검사 「25~28.5초 거의 멈춤」)
        z={1 + 0.0003 * k}
        marks={[
          { x0: 145, y0: 1364, x1: 241, y1: 1404, p: box },
          { x0: 105, y0: 1470, x1: 697, y1: 1510, p: who },
          { x0: 145, y0: 1681, x1: 241, y1: 1721, p: box },
        ]}
      />
      <div style={{ position: 'absolute', left: PANEL.x + 40, top: PANEL.y + PANEL.h - 300, width: PANEL.w - 80, padding: '28px 36px 30px', borderRadius: 24, background: CARD, boxShadow: `inset 0 0 0 3px ${INK}, 0 24px 50px rgba(40,30,10,0.35)`, fontFamily: KO, fontWeight: 760, fontSize: 56, lineHeight: 1.4, letterSpacing: '-0.03em', color: INK }}>
        <div>
          매장 이름: <Blank />
        </div>
        <div>
          판매 가격: <Blank />원
        </div>
      </div>
    </>
  );
};

/** 6 다시 해 본 표(29.6~35.4초): 새 채팅 네 번 — 그냥 두 번 · 덧붙여 두 번(10-28 실험 A · A2 · B · B2). */
const Again: React.FC = () => {
  const f = useCurrentFrame();
  const r1 = ease(f, B.row1, 7);
  const r2 = ease(f, B.row2, 7);
  const cell = (t: React.ReactNode, w: number) => <div style={{ width: w }}>{t}</div>;
  return (
    <div style={{ position: 'absolute', left: PX, top: PANEL.y + 50, width: PW, padding: '10px 30px 20px', borderRadius: 26, background: DARK_CARD, boxShadow: '0 24px 50px rgba(60,50,30,0.22)', fontFamily: KO, letterSpacing: '-0.03em', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', fontWeight: 700, fontSize: 38, color: DARK_MUTED, padding: '22px 0 18px', borderBottom: `2px solid ${DARK_EDGE}` }}>
        {cell('', 236)}
        {cell('1번', 296)}
        {cell('2번', 250)}
      </div>
      {[
        { p: r1, label: '그냥 부탁', v: <span style={{ color: CORAL_ON_DARK }}>후기 3개 지어냄</span> },
        {
          p: r2,
          label: '덧붙여 부탁',
          v: (
            <>
              후기 3개 <Blank />
            </>
          ),
        },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', fontWeight: 780, fontSize: 40, padding: '44px 0', borderBottom: i === 0 ? `2px solid ${DARK_EDGE}` : 'none', whiteSpace: 'nowrap', color: DARK_INK, opacity: 0.15 + 0.85 * r.p }}>
          {cell(r.label, 236)}
          {cell(r.v, 296)}
          {cell(r.v, 250)}
        </div>
      ))}
    </div>
  );
};

/** 7 끝(35.4~42.5초): 원본 끝 장치(「통했다 · 15배」 + 한계 「8분 만에 종료」 + 질문) — 통한 한마디(그대로 복사해 쓸 문장 전체) · 대신(사람이 채울 것) · 질문.
 *  r5까지는 「그냥 부탁 / 덧붙여 부탁」 비교 카드라 지난 편(Y9 v3)의 전후 카드로 읽혔다(r5 haiku). 카드 하나는 컷과 함께, 둘째 · 질문은 36.4 · 37.1초. */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, B.end, 6);
  const b = ease(f, B.endA, 8);
  const q = ease(f, B.endB, 10);
  const last = ease(f, B.last, 8);
  const card = (p: number, c: string, label: string, body: React.ReactNode, size: number) => (
    <div style={{ marginTop: 24, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, padding: '24px 34px 30px', borderRadius: 26, background: DARK_CARD, boxShadow: `inset 0 0 0 4px ${c}, 0 24px 50px rgba(60,50,30,0.22)` }}>
      <div style={{ fontWeight: 700, fontSize: 36, color: DARK_MUTED }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: size, lineHeight: 1.24, color: DARK_INK, marginTop: 6, wordBreak: 'keep-all' }}>{body}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: PX, top: 380, width: PW, fontFamily: KO, letterSpacing: '-0.03em' }}>
      {card(
        a,
        MARK,
        '통한 한마디 — 부탁 끝에 그대로',
        <>
          단, 모르는 숫자 · 후기 · 이름은
          <br />
          지어내지 말고 <Blank />
          으로 남겨 줘.
        </>,
        54,
      )}
      {card(
        b,
        CORAL,
        '대신',
        <>
          빈칸은 <span style={{ color: CORAL_ON_DARK }}>진짜 손님 말</span>로
        </>,
        62,
      )}
      <div style={{ marginTop: 44, opacity: q, transform: `translateY(${(1 - q) * 14}px) scale(${1 + 0.04 * last})`, transformOrigin: '0 50%', fontWeight: 800, fontSize: 58, lineHeight: 1.22, color: INK }}>
        AI가 <span style={{ color: CORAL }}>지어낸 거</span>,
        <br />
        발견한 적 있어요?
      </div>
    </div>
  );
};

// ───────────── 머리글 · 꼬리표 · 자막 ─────────────
const SCENES: { a: number; b: number; badge: string; dark?: boolean; head?: { lines: string[]; accent: Accent } }[] = [
  { a: 0, b: B.twist, badge: '10월 28일 · AI 채팅 · 그냥 부탁', head: { lines: ['AI가 지어 넣은', '손님 후기 3개'], accent: { text: '3개', kind: 'coral' } } },
  { a: B.twist, b: B.rule, badge: '같은 답 · 후기 바로 위', head: { lines: ['지어 놓고는', '「예시입니다」'], accent: { text: '「예시입니다」', kind: 'coral' } } },
  { a: B.rule, b: B.prompt, badge: '새 채팅 · 부탁 끝에 덧붙인 말', head: { lines: ['이번엔 부탁에', '이 말을 덧붙여'], accent: { text: '덧붙여', kind: 'coral' } } },
  { a: B.prompt, b: B.result, badge: '새 채팅 · 받은 답 그대로(빨리 넘김)', dark: true, head: { lines: ['답에 [빈칸]이', '줄줄이'], accent: { text: '[빈칸]', kind: 'mark' } } },
  { a: B.result, b: B.again, badge: '10월 28일 · AI 채팅 · 덧붙여 부탁', head: { lines: ['후기 · 작성자', '전부 [빈칸]'], accent: { text: '[빈칸]', kind: 'mark' } } },
  { a: B.again, b: B.end, badge: '새 채팅 네 번', head: { lines: ['똑같이', '두 번씩'], accent: { text: '두 번씩', kind: 'coral' } } },
  { a: B.end, b: TOTAL + 1, badge: '@yuhobuilds · 직접 해 본 AI 실험' }, // 끝 브랜드 자리(원본은 끝에 꼬리표 없음 — 우리 색)
];

const Heads: React.FC = () => (
  <>
    {SCENES.map((s, i) => (s.head ? <Head key={i} lines={s.head.lines} accent={s.head.accent} at={s.a} until={s.b} dark={s.dark} /> : null))}
  </>
);

const Badges: React.FC = () => {
  const f = useCurrentFrame();
  const s = SCENES.find((x) => f >= x.a && f < x.b);
  return s ? <Badge text={s.badge} /> : null;
};

/** 아래 고정 자막창(원본처럼 창은 늘 같은 자리 · 같은 크기). 글은 그 장면의 말 한 줄 전체를 장면 첫 프레임부터 끝까지 —
 *  원본도 칸마다 그 칸의 말을 두세 줄로 한 번에 띄운다. 문장마다 바꾸거나 말이 끝날 때 지우면 그 자리가 박자로 잡혀 나란히가 어긋났다(r2 24칸). */
const SCENE_LINE = [B.twist, B.rule, B.prompt, B.result, B.again, B.end, TOTAL + 1].map((b, i) => ({ b, id: ORDER[i] }));
const Subtitle: React.FC = () => {
  const f = useCurrentFrame();
  const id = SCENE_LINE.find((x) => f < x.b)?.id;
  if (f >= B.last) return null; // 42.0초 — 원본처럼 자막창을 걷고 끝 그림만 남긴다
  const dark = f >= B.prompt && f < B.result;
  return (
    <div style={{ position: 'absolute', left: PX - 6, width: PW + 12, top: 1240, height: 186, borderRadius: 22, background: dark ? '#262624' : CARD, boxShadow: `inset 0 0 0 2px ${dark ? '#3A3833' : EDGE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 30px', boxSizing: 'border-box' }}>
      <div style={{ fontFamily: KO, fontWeight: 660, fontSize: 40, lineHeight: 1.32, letterSpacing: '-0.025em', color: dark ? '#F4F2EC' : INK, textAlign: 'center', wordBreak: 'keep-all' }}>{id ? lineText(id) : ''}</div>
    </div>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  { at: B.hook, src: 'sfx/thud.wav', v: 0.32 },
  ...[0, 1, 2].map((i) => ({ at: B.hook + 4 * i, src: 'sfx/tick.wav', v: 0.13 })),
  ...[B.twist, B.rule, B.prompt, B.result, B.again, B.end].map((a) => ({ at: a - 1, src: 'sfx/swish.wav', v: 0.15 })),
  { at: B.twistMark, src: 'sfx/snap.wav', v: 0.16 },
  { at: B.card2, src: 'sfx/tick.wav', v: 0.14 },
  { at: B.card3, src: 'sfx/tick2.wav', v: 0.14 },
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ at: B.prompt + 14 + 14 * i, src: 'sfx/tick.wav', v: 0.07 })), // 빨리 넘김 — [빈칸]이 지나가는 잔 박
  { at: B.sent, src: 'sfx/snap.wav', v: 0.15 },
  { at: B.row1, src: 'sfx/tick.wav', v: 0.14 },
  { at: B.row2, src: 'sfx/tick2.wav', v: 0.14 },
  { at: B.endA, src: 'sfx/thud.wav', v: 0.3 }, // [빈칸] 카드가 서는 소리 한 방
  { at: B.endB, src: 'sfx/tok.wav', v: 0.3 },
  { at: B.last, src: 'sfx/tok.wav', v: 0.4 },
];

// ───────────── 본편 ─────────────
export const ReviewFilmV2: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const ranges = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 15);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.4 - 0.16 * voice) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Scene a={0} b={B.twist} drift={0.12}>
        <Hook />
      </Scene>
      <Scene a={B.twist} b={B.rule} drift={0.12}>
        <Twist />
      </Scene>
      <Scene a={B.rule} b={B.prompt} drift={0.12}>
        <Rules />
      </Scene>
      <Scene a={B.prompt} b={B.result}>
        <Stream />
      </Scene>
      <Scene a={B.result} b={B.again} drift={0.12}>
        <Result />
      </Scene>
      <Scene a={B.again} b={B.end} drift={0.4}>
        <Again />
      </Scene>
      <Scene a={B.end} b={TOTAL} drift={0.25}>
        <End />
      </Scene>
      <Badges />
      <Heads />
      <Subtitle />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo2/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {HITS.map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm_v2.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

/** 표지: 0.5초 장면(꼬리표 + 머리글 + 없는 손님 셋). */
export const CoverStillV2: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    <Badge text="10월 28일 · AI 채팅 · 그냥 부탁" />
    <Head lines={['AI가 지어 넣은', '손님 후기 3개']} accent={{ text: '3개', kind: 'coral' }} at={0} until={99999} />
    <Sequence from={-30} layout="none">
      <Hook />
    </Sequence>
  </AbsoluteFill>
);
