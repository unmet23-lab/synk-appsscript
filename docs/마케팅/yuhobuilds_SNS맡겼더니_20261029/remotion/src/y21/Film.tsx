// yuhobuilds Y21 「AI한테 SNS 맡겼더니 좋아요 0 — 같은 틀이었다」(10-29). 기획 · 칸표는 ../../../기획.md 「원본 1:1」.
// 오마주 원본: 1분만 「다이소 가격 왜 이럴까?」(형식만 — 오마주.json). 원본에서 가져온 것은 짜임뿐이다 — 위 고정 제목 상자 · 가운데 그림 띠 · 아래 한 줄 자막,
// 14칸 박자(time.ts K), 칸 안에서 더 나오는 자리(POP). 원본의 그림 · 말 · 화면 글은 쓰지 않는다.
// 우리 색: 검정 무대 · 버터 제목 상자(SNS 키트 builds) · 실제 화면(@yuhobuilds 릴스 탭 · 좋아요 줄 · 지난 두 편 끝 장면) · 구운 그림 둘(시험관 · 썸네일 벽).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, mix, mixColor, OUT, prog } from '../lib/motion';
import { caps, CTA_AT, f, K, POP, S, segs, total, type Cut } from './time';
import { VOICE } from './vo.generated';

const MASTER = 0.8; // 합친 소리가 0 dBFS를 넘지 않게 모든 소리에 같은 값을 곱한다(Y19와 같음)
const BG = '#0A0A0A';
const BUTTER = '#F5C445';
const INK = '#111111';
const SCREEN = '#141414';
const RED = '#E5484D';
const BAND_Y = 380;
const BAND_W = 1080;
const BAND_H = 936;

const img = (n: string) => staticFile(`img/${n}`);
const kStart = (k: number) => f(K[k - 1]);
const kOf = (fr: number) => {
  let k = 1;
  for (let i = 0; i < K.length; i++) if (fr >= f(K[i])) k = i + 1;
  return k;
};

// ───────────── 띠 안의 장면(칸마다) ─────────────

/** 1~2칸: 우리 릴스 셋이 밀려 들어와 나란히(실제 릴스 탭 칸 그대로, 조회 숫자째). */
const Trio: React.FC<{ fr: number }> = ({ fr }) => {
  const zoom = interpolate(fr, [f(K[1]), f(K[2])], [1, 1.04], clamp);
  return (
    <AbsoluteFill style={{ background: SCREEN, transform: `scale(${zoom})` }}>
      {[1, 2, 3].map((n, i) => {
        const p = i === 0 ? 1 : prog(fr, (i - 1) * 3, 6); // 0프레임부터 첫 칸이 보이고 둘째 · 셋째가 0.3초 안에 들어온다(원본 첫 칸과 같음)
        return (
          <Img
            key={n}
            src={img(`칸${n}.jpg`)}
            style={{ position: 'absolute', left: 30 + i * 345, top: 211, width: 330, height: 514, borderRadius: 6, transform: `translateX(${(1 - p) * 1100}px)` }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** 3칸: 실제 @yuhobuilds 프로필 머리. */
const Profile: React.FC<{ fr: number }> = ({ fr }) => {
  const zoom = interpolate(fr, [kStart(3), kStart(4)], [1, 1.03], clamp);
  return (
    <AbsoluteFill style={{ background: '#0C0F14', alignItems: 'center', justifyContent: 'center' }}>
      <Img src={img('프로필.jpg')} style={{ width: 1040, transform: `scale(${zoom})` }} />
    </AbsoluteFill>
  );
};

/** 4칸: 실제 릴스 한 편의 하트 줄을 크게 — 하트 옆 숫자가 없고 댓글만 1(좋아요 0). 3.24초 빨간 동그라미 · 「좋아요 0」.
 *  (2차 시험 「릴스 탭이 세 번 나와 새 정보 없음」 — 릴스 띠를 빼고 하트 줄 하나만.) */
const Strips: React.FC<{ fr: number }> = ({ fr }) => {
  const zoom = interpolate(fr, [kStart(4), kStart(5)], [1, 1.05], clamp);
  const mark = prog(fr, f(POP.heart), 6);
  return (
    <AbsoluteFill style={{ background: '#25272C', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: BAND_W, height: 400, transform: `scale(${zoom})` }}>
        <Img src={img('좋아요줄.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: BAND_W * 1.85, height: 216 * 1.85 }} />
        <svg width={300} height={250} viewBox="0 0 300 250" style={{ position: 'absolute', left: 0, top: 22, opacity: mark }}>
          <ellipse cx={150} cy={125} rx={128} ry={100} fill="none" stroke={RED} strokeWidth={12} strokeDasharray={760} strokeDashoffset={760 * (1 - mark)} />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: 120, top: 660, padding: '10px 34px', borderRadius: 50, background: RED, color: '#FFFFFF', fontFamily: KO, fontWeight: 900, fontSize: 64, opacity: mark, transform: `scale(${mix(0.6, 1, mark)})` }}>좋아요 0</div>
    </AbsoluteFill>
  );
};

/** 5~6칸: 처음 보는 AI(시험관 그림) — 5.6초 물음표, 6.5초 「같은 틀」 도장. */
const Examiner: React.FC<{ fr: number }> = ({ fr }) => {
  const zoom = interpolate(fr, [kStart(5), kStart(7)], [1, 1.05], clamp);
  const q = prog(fr, f(POP.question), 6);
  const s = prog(fr, kStart(6), 5);
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Img src={img('시험관.jpg')} style={{ width: BAND_W, height: BAND_H }} />
        <div style={{ position: 'absolute', left: 880, top: 96, width: 120, height: 120, borderRadius: 60, background: BUTTER, border: `6px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 900, fontSize: 84, color: INK, opacity: q, transform: `scale(${mix(0.4, 1, q)})` }}>?</div>
      </AbsoluteFill>
      {fr >= kStart(6) ? (
        <div style={{ position: 'absolute', left: 120, top: 400, padding: '14px 40px', border: `10px solid ${RED}`, borderRadius: 22, color: RED, fontFamily: KO, fontWeight: 900, fontSize: 120, letterSpacing: -2, background: 'rgba(255,255,255,0.86)', transform: `rotate(-8deg) scale(${mix(1.9, 1, s)})`, opacity: Math.min(1, s * 1.6) }}>같은 틀</div>
      ) : null}
    </AbsoluteFill>
  );
};

const Arrow: React.FC<{ x: number; y: number; dir: 'right' | 'down'; p: number }> = ({ x, y, dir, p }) => (
  <svg width={90} height={90} viewBox="0 0 90 90" style={{ position: 'absolute', left: x - 45, top: y - 45, opacity: p, transform: `rotate(${dir === 'down' ? 90 : 0}deg) scale(${mix(0.5, 1, p)})` }}>
    <path d="M8 34 H52 V14 L84 45 L52 76 V56 H8 Z" fill={RED} />
  </svg>
);

/** 7칸: 「같은 틀」 ① 화면 — 실제 릴스 두 칸의 머리 글(10월 25일 빵집 편 → 10월 22일 「트렌디하게」 편)을 크게 위아래로, 10.26초부터 ② 끝 인사 —
 *  10월 27 · 28일에 만든(아직 안 올린) 두 편의 끝 장면을 함께 두고 11.23초에 같은 글자에 빨간 테 · 「=」. 칸마다 날짜 꼬리표
 *  (2차 시험 「지난 편 제목 · 끝 인사를 이 영상의 틀로 읽음」 — 증거라는 게 보이게). */
const Label: React.FC<{ text: string; p: number }> = ({ text, p }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 18, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 54, color: RED, opacity: p }}>{text}</div>
);
const Tag: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', right: 18, top: 14, padding: '4px 16px', borderRadius: 16, background: '#FFFFFF', border: `3px solid ${INK}`, fontFamily: KO, fontWeight: 800, fontSize: 32, color: INK, zIndex: 2 }}>{text}</div>
);
const Pairs: React.FC<{ fr: number }> = ({ fr }) => {
  const pair2 = fr >= f(POP.pair2);
  const box = (y: number, h: number, bg: string, p: number, tag: string, child: React.ReactNode) => (
    <div style={{ position: 'absolute', left: 30, top: y, width: 1020, height: h, borderRadius: 28, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: p, transform: `scale(${mix(0.92, 1, p)})` }}>
      {child}
      <Tag text={tag} />
    </div>
  );
  if (!pair2) {
    const a = prog(fr, kStart(7), 5);
    const b = prog(fr, f(POP.arrow1), 5);
    const head = (n: string) => (
      <div style={{ width: 980, height: 340, overflow: 'hidden', borderRadius: 12, background: BG, position: 'relative' }}>
        <Img src={img(n)} style={{ position: 'absolute', left: 0, top: -150, width: 980, height: 1525 }} />
      </div>
    );
    return (
      <AbsoluteFill style={{ background: '#FFFFFF' }}>
        <Label text="같은 틀 ① 화면" p={a} />
        {box(100, 370, '#E3EEF9', a, '10월 25일 편', head('칸1.jpg'))}
        {box(546, 370, '#FBE4E7', b, '10월 22일 편', head('칸4.jpg'))}
        <Arrow x={540} y={508} dir="down" p={b} />
      </AbsoluteFill>
    );
  }
  const a = prog(fr, f(POP.pair2), 5);
  const b = prog(fr, f(POP.arrow2), 6);
  const end = (n: string) => (
    <div style={{ width: 980, height: 320, overflow: 'hidden', borderRadius: 12, background: BG, position: 'relative' }}>
      <Img src={img(n)} style={{ position: 'absolute', left: -40, top: -14, width: 1080, height: 920 }} />
      <div style={{ position: 'absolute', left: 4, top: 22, width: 560, height: 150, borderRadius: 14, border: `7px solid ${RED}`, opacity: b, transform: `scale(${mix(1.15, 1, b)})` }} />
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <Label text="같은 틀 ② 끝 인사" p={a} />
      {box(100, 350, '#E3EEF9', a, '10월 27일에 만든 편', end('끝_y9.jpg'))}
      {box(546, 350, '#FBE4E7', a, '10월 28일에 만든 편', end('끝_y19.jpg'))}
      <div style={{ position: 'absolute', left: 495, top: 452, width: 90, height: 90, borderRadius: 45, background: RED, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 900, fontSize: 72, opacity: b, transform: `scale(${mix(0.5, 1, b)})` }}>=</div>
    </AbsoluteFill>
  );
};

/** 8~9칸: 실제 릴스 탭 두 줄(여섯 편, 조회 숫자째) 천천히 다가감 — 칸마다 같은 자리(머리 글)에 빨간 테가 차례로(2차 시험 「같은 그리드가 다시 나와 새 정보 없음」),
 *  14.2초 그 시험관(5칸 그림의 로봇)이 「채점한 AI」 카드로 솟아오른다. */
const Grid: React.FC<{ fr: number }> = ({ fr }) => {
  const zoom = interpolate(fr, [kStart(8), kStart(10)], [1, 1.06], clamp);
  const r = prog(fr, kStart(9), 8, OUT);
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Img src={img('그리드.jpg')} style={{ position: 'absolute', left: 80, top: -8, width: 920, height: 951 }} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const p = prog(fr, kStart(8) + 6 + i * 7, 4);
          const col = i % 3;
          const row = Math.floor(i / 3);
          return <div key={i} style={{ position: 'absolute', left: 84 + col * 307, top: 12 + row * 476, width: 298, height: 132, borderRadius: 14, border: `7px solid ${RED}`, opacity: p, transform: `scale(${mix(1.25, 1, p)})` }} />;
        })}
      </AbsoluteFill>
      {fr >= kStart(9) ? (
        <div style={{ position: 'absolute', left: 320, top: 440, width: 440, height: 470, borderRadius: 32, overflow: 'hidden', background: '#FFFFFF', boxShadow: '0 -20px 60px rgba(0,0,0,0.55)', transform: `translateY(${(1 - r) * 560}px)` }}>
          <Img src={img('시험관.jpg')} style={{ position: 'absolute', left: -610, top: -190, width: BAND_W, height: BAND_H }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, display: 'flex', justifyContent: 'center' }}>
            <div style={{ padding: '6px 24px', borderRadius: 30, background: BUTTER, fontFamily: KO, fontWeight: 900, fontSize: 44, color: INK }}>채점한 AI</div>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 10~11칸: 흰 바탕에 채점 카드가 올라온다 — 이해 넷 칸, 16.4초 재미 두 칸 반 + 「재미 없음」 도장이 크게 찍혔다 모서리로. */
const Score: React.FC<{ fr: number }> = ({ fr }) => {
  const up = prog(fr, kStart(10), 9);
  const dots = (label: string, n: number, color: string, at: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
      <div style={{ width: 150, fontFamily: KO, fontWeight: 800, fontSize: 64, color: INK }}>{label}</div>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, n - i)) * prog(fr, at + i * 3, 4);
        return (
          <div key={i} style={{ width: 84, height: 84, borderRadius: 42, border: `6px solid ${INK}`, background: '#FFFFFF', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: color }} />
          </div>
        );
      })}
    </div>
  );
  const st = prog(fr, kStart(11), 5);
  const sh = prog(fr, f(POP.stampShrink), 7);
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <div style={{ position: 'absolute', left: 90, top: 190, width: 900, height: 560, borderRadius: 40, border: '4px solid #E2DED6', background: '#FFFFFF', boxShadow: '0 30px 60px rgba(0,0,0,0.10)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 60, paddingLeft: 80, paddingTop: 50, transform: `translateY(${(1 - up) * 760}px)` }}>
        <div style={{ position: 'absolute', left: 80, top: 34, fontFamily: KO, fontWeight: 800, fontSize: 40, color: '#8A857B' }}>다른 AI의 채점</div>
        {dots('이해', 4, BUTTER, kStart(10) + 4)}
        {dots('재미', 2.5, RED, kStart(11))}
      </div>
      {fr >= kStart(11) ? (
        <div style={{ position: 'absolute', left: mix(250, 600, sh), top: mix(330, 150, sh), padding: '10px 30px', border: `9px solid ${RED}`, borderRadius: 20, color: RED, fontFamily: KO, fontWeight: 900, fontSize: 96, background: 'rgba(255,255,255,0.9)', transform: `rotate(${mix(-6, -10, sh)}deg) scale(${mix(1.9, 1, st) * mix(1.15, 0.8, sh)})`, transformOrigin: 'center', opacity: Math.min(1, st * 1.6) }}>재미 없음</div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 12칸: 썸네일 벽 앞에서 고르는 사람(구운 그림) — 칸마다 재생 표시(영상으로 읽히게, 첫 렌더 시험), 터진 한 장에 「터진 영상」. */
const TILE_X = [404, 517, 637, 762, 895];
const TILE_Y = [205, 365, 528, 690];
const HIT = { x: 637, y: 372 };
const Play: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => (
  <svg width={r * 2} height={r * 2} viewBox="0 0 40 40" style={{ position: 'absolute', left: x - r, top: y - r }}>
    <circle cx={20} cy={20} r={19} fill="rgba(255,255,255,0.88)" />
    <path d="M16 12 L29 20 L16 28 Z" fill={INK} />
  </svg>
);
const Wall: React.FC<{ fr: number }> = ({ fr }) => {
  const zoom = interpolate(fr, [kStart(12), kStart(13)], [1, 1.06], clamp);
  const hit = prog(fr, kStart(12) + 8, 6);
  return (
    <AbsoluteFill style={{ background: '#FFFFFF', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Img src={img('썸네일벽.jpg')} style={{ width: BAND_W, height: BAND_H }} />
        {TILE_Y.flatMap((y) => TILE_X.map((x) => (Math.abs(x - HIT.x) < 30 && Math.abs(y - HIT.y) < 40 ? null : <Play key={`${x}-${y}`} x={x} y={y} r={18} />)))}
        <Play x={HIT.x} y={HIT.y} r={30} />
        <div style={{ position: 'absolute', left: HIT.x - 120, top: 470, width: 240, display: 'flex', justifyContent: 'center', opacity: hit, transform: `translateY(${(1 - hit) * 20}px)` }}>
          <div style={{ padding: '8px 22px', borderRadius: 30, background: BUTTER, border: `4px solid ${INK}`, fontFamily: KO, fontWeight: 900, fontSize: 40, color: INK }}>터진 영상</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 13칸: 그 요청문을 크게 다시 짠 판 — 글은 실제 그대로(가운데 줄은 「…」로 줄임). 줄마다 차례로 나온다. */
const PROMPT_LINES: Array<{ t: string; b?: boolean }> = [
  { t: '첨부한 영상은 조회수가 크게 터진 짧은 영상이야.' },
  { t: '이 영상의 「뼈대」만 쪼개 줘.', b: true },
  { t: '1. 첫 2초  2. 장면이 바뀌는 순간 …' },
  { t: '3. 반전  4. 끝 3초' },
  { t: '그다음 내 이야기를 같은 뼈대 · 같은 초에 얹은 칸표를 짜 줘.', b: true },
];
const PromptCard: React.FC<{ fr: number; mini?: boolean }> = ({ fr, mini }) => {
  const zoom = interpolate(fr, [kStart(13), kStart(14)], [1, 1.04], clamp);
  return (
    <AbsoluteFill style={{ background: '#FFFFFF', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 50, top: 70, width: 980, height: 800, borderRadius: 36, background: '#F4F1EA', border: '4px solid #E2DED6', padding: '40px 50px', boxSizing: 'border-box', transform: `scale(${zoom})` }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 36, color: '#8A857B', marginBottom: 26 }}>보낸 요청문(영상과 함께)</div>
        {PROMPT_LINES.map((l, i) => {
          const p = mini ? 1 : prog(fr, kStart(13) + i * 9, 5);
          return (
            <div key={i} style={{ fontFamily: KO, fontWeight: l.b ? 900 : 700, fontSize: l.b ? 58 : 50, lineHeight: 1.3, color: INK, marginBottom: 22, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
              {l.b ? <span style={{ background: `linear-gradient(transparent 58%, ${BUTTER} 58%)` }}>{l.t}</span> : l.t}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 14칸: 칸 열넷(첫 2초 · 반전 · 끝 표시)에 24.62초 끝 자리부터 이 영상의 장면이 차례로 채워지고, 「이 영상처럼요」 뒤 테가 버터로. */
const SLOT_W = 190;
const SLOT_H = 165;
const ROW_Y = [110, 385, 660];
const slotXY = (i: number) => ({ x: 25 + (i % 5) * (SLOT_W + 20), y: ROW_Y[Math.floor(i / 5)] });
const MARK: Record<number, string> = { 0: '첫 2초', 5: '반전', 13: '끝' };
const Timeline: React.FC<{ fr: number; mini?: boolean }> = ({ fr, mini }) => {
  const zoom = interpolate(fr, [kStart(14), kStart(14) + f(4)], [1, 1.04], clamp);
  return (
    <AbsoluteFill style={{ background: '#FFFFFF', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 22, display: 'flex', justifyContent: 'center' }}>
          <div style={{ padding: '4px 26px', borderRadius: 30, background: BUTTER, fontFamily: KO, fontWeight: 900, fontSize: 50, color: INK }}>이 영상의 장면 — 같은 순서</div>
        </div>
        {ROW_Y.map((y) => (
          <div key={y} style={{ position: 'absolute', left: 25, top: y + SLOT_H + 24, width: 1030, height: 6, borderRadius: 3, background: '#D9D4CA' }} />
        ))}
        {K.map((_, i) => {
          const { x, y } = slotXY(i);
          const p = mini ? 0 : prog(fr, kStart(14) + i * 3, 5);
          const lit = mini ? 0 : prog(fr, f(CTA_AT) + 12 + i, 4); // 「이 영상처럼요」 뒤 — 채운 칸 테가 차례로 버터로
          const showK = i === 13 ? 13 : i + 1; // 마지막 칸은 「지금」 — 13칸(요청문)으로 둔다
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: SLOT_W, height: SLOT_H }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `5px dashed ${MARK[i] ? INK : '#BDB8AE'}`, background: '#FAF8F4' }} />
              {p > 0 ? (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden', opacity: p, transform: `scale(${mix(1.25, 1, p)})`, border: `5px solid ${i === 13 ? BUTTER : mixColor(INK, BUTTER, lit)}`, boxShadow: lit > 0 ? `0 0 ${18 * lit}px rgba(245,196,69,${0.55 * lit})` : 'none' }}>
                  <div style={{ width: BAND_W, height: BAND_H, transform: `scale(${SLOT_W / BAND_W})`, transformOrigin: '0 0' }}>
                    <Band k={showK} fr={midOf(showK)} mini />
                  </div>
                </div>
              ) : null}
              {MARK[i] ? <div style={{ position: 'absolute', left: -20, right: -20, top: SLOT_H + 10, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 36, color: INK }}>{MARK[i]}</div> : null}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 칸마다 작은 그림으로 보일 순간(그 칸 안에서 가장 잘 보이는 초). */
const MID: Record<number, number> = { 1: 0.29, 2: 1.2, 3: 2.2, 4: 3.6, 5: 6.2, 6: 6.9, 7: 9.2, 8: 13.0, 9: 15.0, 10: 16.2, 11: 17.4, 12: 19.5, 13: 22.2, 14: 22.2 };
const midOf = (k: number) => f(MID[k] * S);

const Band: React.FC<{ k: number; fr: number; mini?: boolean }> = ({ k, fr, mini }) => {
  if (k <= 2) return <Trio fr={fr} />;
  if (k === 3) return <Profile fr={fr} />;
  if (k === 4) return <Strips fr={fr} />;
  if (k <= 6) return <Examiner fr={fr} />;
  if (k === 7) return <Pairs fr={fr} />;
  if (k <= 9) return <Grid fr={fr} />;
  if (k <= 11) return <Score fr={fr} />;
  if (k === 12) return <Wall fr={fr} />;
  if (k === 13) return <PromptCard fr={fr} mini={mini} />;
  return <Timeline fr={fr} mini={mini} />;
};

// ───────────── 틀: 제목 상자 · 띠 · 자막 ─────────────

const Title: React.FC = () => (
  <div style={{ position: 'absolute', top: 247, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
    <div style={{ height: 103, padding: '0 40px', borderRadius: 10, background: BUTTER, display: 'flex', alignItems: 'center', fontFamily: KO, fontWeight: 900, fontSize: 62, color: INK, letterSpacing: -1 }}>좋아요 0의 비밀</div>
  </div>
);

const Caption: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: 'absolute', top: 1340, left: 40, right: 40, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 58, lineHeight: 1.25, color: '#FFFFFF', letterSpacing: -1 }}>
    {text.split('**').map((part, i) => (i % 2 ? <span key={i} style={{ color: BUTTER }}>{part}</span> : <React.Fragment key={i}>{part}</React.Fragment>))}
  </div>
);

// ───────────── 소리 ─────────────

const SFX: Array<{ at: number; src: string; v: number }> = [
  { at: 0.0, src: 'sfx/swish.wav', v: 0.5 },
  { at: POP.heart, src: 'sfx/pop.wav', v: 0.55 },
  { at: POP.question, src: 'sfx/pop.wav', v: 0.5 },
  { at: K[5], src: 'sfx/thud.wav', v: 0.8 },
  { at: K[6], src: 'sfx/pop.wav', v: 0.45 },
  { at: POP.arrow1, src: 'sfx/pop.wav', v: 0.5 },
  { at: POP.pair2, src: 'sfx/pop.wav', v: 0.45 },
  { at: POP.arrow2, src: 'sfx/pop.wav', v: 0.5 },
  { at: K[8], src: 'sfx/swish.wav', v: 0.5 },
  { at: K[9], src: 'sfx/swish.wav', v: 0.45 },
  { at: K[10], src: 'sfx/thud.wav', v: 0.8 },
  { at: K[11], src: 'sfx/swish.wav', v: 0.35 },
  { at: K[13], src: 'sfx/tick.wav', v: 0.35 },
  { at: K[13] + 0.6, src: 'sfx/tick.wav', v: 0.35 },
  { at: K[13] + 1.2, src: 'sfx/snap.wav', v: 0.45 },
  { at: CTA_AT + 1.32, src: 'sfx/tok.wav', v: 0.55 },
];

// ───────────── 영상 ─────────────

export const HomageFilm: React.FC<{ cut: Cut }> = ({ cut }) => {
  const fr = useCurrentFrame();
  const end = total(cut);
  const k = kOf(fr);
  const cap = caps(cut).find(([a, b]) => fr >= f(a) && fr < f(b));
  const bgmVol = (x: number) => interpolate(x, [0, f(0.4), end - f(1.2), end], [0, 0.11, 0.11, 0], clamp) * MASTER;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Title />
      <div style={{ position: 'absolute', left: 0, top: BAND_Y, width: BAND_W, height: BAND_H, overflow: 'hidden' }}>
        <Band k={k} fr={fr} />
      </div>
      {cap ? <Caption text={cap[2]} /> : null}
      {segs(cut).map((s, i) => {
        const from = f(s.from ?? 0);
        const to = s.to === undefined ? f(VOICE[s.id].dur) : f(s.to);
        return (
          <Sequence key={i} from={f(s.at)} durationInFrames={to - from} layout="none">
            <Audio src={staticFile(`vo/${s.id}.wav`)} trimBefore={from} trimAfter={to} volume={MASTER} />
          </Sequence>
        );
      })}
      {SFX.map((x, i) => (
        <Sequence key={`s${i}`} from={f(x.at)} durationInFrames={45} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      <Audio src={staticFile('bgm.wav')} volume={bgmVol} />
    </AbsoluteFill>
  );
};

/** 표지(1080×1920): 제목 상자 + 실제 릴스 셋 + 큰 글 두 줄. */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <Title />
    <div style={{ position: 'absolute', left: 0, top: BAND_Y, width: BAND_W, height: BAND_H, overflow: 'hidden' }}>
      <Trio fr={f(1.2)} />
    </div>
    <div style={{ position: 'absolute', top: 1340, left: 40, right: 40, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 76, lineHeight: 1.2, color: '#FFFFFF', letterSpacing: -2 }}>
      AI한테 SNS 맡겼더니
      <br />
      <span style={{ color: BUTTER }}>좋아요 0개</span>
    </div>
  </AbsoluteFill>
);
