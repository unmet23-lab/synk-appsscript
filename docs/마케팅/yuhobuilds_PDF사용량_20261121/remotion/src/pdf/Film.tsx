// 「클로드에 PDF 올리기 전에」 본편 — 수요 장부 yuhobuilds 2번(11-21).
// 처음과 끝은 몽글이 장면(구운 그림 · 눈 둘레 조각만 바꿔 끼운다), 가운데는 범수 보이스오버와 큰 그림이다.
// 숫자는 2026-11-21에 직접 잰 값이다: 글만 있는 8쪽 약관 · PDF 그대로 23,596토큰 · 크롬에서 전체 복사한 글 10,917토큰(2.16배).
// 화면 결: 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나. 안전 영역 x 65~920 · y 269~1428.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, OUT } from '../lib/motion';
import { BGM, LEN, P2G_AT, SFX, SFX_END, T, TG, VO } from './timeline';

/** 끝 말 — dm: 인스타(댓글 키워드 DM) · post: 키워드 DM이 없는 판(게시글에 자료 주소). */
export type Ending = 'dm' | 'post';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const INK = '#0A0A0A';
const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const SUB = 'rgba(255,255,255,0.66)';
const LEFT = 79;

/** 모든 소리에 같은 값을 곱한다 — Remotion은 합이 0 dBFS를 넘으면 그 자리에서 자른다(현장 노트 「Remotion은 소리를 16비트로 더해」). 크기는 음량 마감에서 되올린다. */
const MASTER = 0.8;

const PDF_TOKENS = 23596;
const TEXT_TOKENS = 10917;
const num = (n: number) => Math.round(n).toLocaleString('en-US');

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.22) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
/** 몽글이 장면의 등불 숨결 — 2.4초에 한 번 6%만 밝아졌다 어두워진다(몽글이는 크게 움직이지 않고 빛으로 작게, 11-20 유호님). 11-21 올리기 전 검사 「거의 멈춘 시간 32%」를 15% 아래로 내리려고 둘째 장면들의 당겨 들어감도 함께 키웠다. */
const glow = (t: number) => 1 + 0.06 * Math.sin((2 * Math.PI * t) / 2.4);
/** 들어올 때 1.035배에서 당겨 앉음. */
const settle = (t: number, a: number) => 1.035 - 0.035 * appear(t, a, 0.34);

// ───────────────────────── 부품 ─────────────────────────

type Line = { at: number; node: React.ReactNode; size: number; color?: string; gap?: number; weight?: number };
/** 위 큰 글 — 줄 단위로 28px 올라온다. */
const Head: React.FC<{ t: number; lines: Line[]; top: number; left?: number }> = ({ t, lines, top, left = LEFT }) => (
  <div style={{ position: 'absolute', left, top, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap' }}>
    {lines
      .filter((l) => t >= l.at - 0.001)
      .map((l, i) => {
        const p = l.at <= 0 ? 1 : appear(t, l.at);
        return (
          <div key={i} style={{ fontSize: l.size, fontWeight: l.weight ?? 800, color: l.color ?? WHITE, opacity: p, transform: `translateY(${(1 - p) * 28}px)`, marginTop: l.gap ?? 0 }}>
            {l.node}
          </div>
        );
      })}
  </div>
);

const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

/** 계정 이름표 — 표지와 같은 자리 · 크기. */
const Tag: React.FC = () => (
  <div style={{ position: 'absolute', left: 84, top: 286, fontFamily: KO, fontSize: 34, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap' }}>
    yuhobuilds<span style={{ fontWeight: 500, opacity: 0.7, marginLeft: 16 }}>AI와 회사 만들기</span>
  </div>
);

/** 작은 설명 한 줄 — 11-21 시험관 셋이 0.66 흰색 40px을 「흐려서 못 읽음」으로 짚어 0.84 · 44px로 올렸다. */
const CAP = 'rgba(255,255,255,0.84)';
const Cap: React.FC<{ t: number; at: number; x: number; y: number; size?: number; children: React.ReactNode }> = ({ t, at, x, y, size = 44, children }) => {
  const p = appear(t, at, 0.26);
  if (p <= 0) return null;
  return <div style={{ position: 'absolute', left: x, top: y + (1 - p) * 20, opacity: p, fontFamily: KO, fontSize: size, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.25, color: CAP, whiteSpace: 'nowrap', textShadow: '0 2px 14px rgba(0,0,0,0.75)' }}>{children}</div>;
};

type Eye = { x: number; y: number; rx: number; ry: number };
/** 몽글이 장면 — 구운 그림(1080 × 1620)을 깔고 위는 검정 그늘. 눈만 다른 둘째 장은 눈 둘레 조각만 mix만큼 겹친다(장면 전체를 갈아 끼우면 떨린다). */
const Mong: React.FC<{ a: string; b: string; mix: number; eye: Eye; top: number; s: number; ox: number; oy: number; solid: number; fade: number; light?: number }> = ({ a, b, mix, eye, top, s, ox, oy, solid, fade, light = 1 }) => {
  const mask = `radial-gradient(ellipse ${eye.rx}px ${eye.ry}px at ${eye.x}px ${eye.y}px, #000 58%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: INK }}>
      <div style={{ position: 'absolute', left: 0, top, width: 1080, height: 1620, transform: `scale(${s})`, transformOrigin: `${ox}px ${oy}px`, filter: `brightness(${light})` }}>
        <Img src={staticFile(a)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620 }} />
        {mix > 0 && <Img src={staticFile(b)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620, opacity: mix, WebkitMaskImage: mask, maskImage: mask }} />}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) ${solid}px, rgba(10,10,10,0) ${fade}px)` }} />
      {/* 그림이 화면 아래 끝에 못 미치는 자리 — 책상이 검정으로 스며들게(릴스 글 · 단추 자리) */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 500, background: 'linear-gradient(0deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 170px, rgba(10,10,10,0) 500px)' }} />
    </AbsoluteFill>
  );
};

/** 더미 아래 이름표 — 이름(작게)과 잰 숫자(크게). cx는 더미 가운데. */
const StackLabel: React.FC<{ t: number; at: number; cx: number; y: number; name: string; value: number; strong?: boolean }> = ({ t, at, cx, y, name, value, strong }) => {
  const p = appear(t, at, 0.28);
  if (p <= 0) return null;
  const shown = interpolate(t, [at, at + 0.45], [0, value], { ...clamp, easing: OUT });
  return (
    <div style={{ position: 'absolute', left: cx - 200, top: y + (1 - p) * 22, width: 400, textAlign: 'center', opacity: p, fontFamily: KO, letterSpacing: '-0.035em', whiteSpace: 'nowrap', textShadow: '0 2px 14px rgba(0,0,0,0.75)' }}>
      <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1.2, color: 'rgba(255,255,255,0.86)' }}>{name}</div>
      <div style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.1, color: WHITE, opacity: strong ? 1 : 0.92, fontVariantNumeric: 'tabular-nums' }}>{num(shown)}</div>
    </div>
  );
};

/** 문서 한 쪽 카드 — 글 줄(막대)만 그린다. tone이 butter면 「사진」 쪽(모서리 표시가 붙는다). */
const Page: React.FC<{ x: number; y: number; w: number; h: number; tone: 'white' | 'butter'; o?: number; flash?: number; reveal?: number }> = ({ x, y, w, h, tone, o = 1, flash = 0, reveal = 1 }) => {
  const c = tone === 'butter' ? BUTTER : WHITE;
  const bars = [0.82, 0.94, 0.7, 0.9, 0.86, 0.56, 0.92, 0.78, 0.4];
  const mark = (style: React.CSSProperties) => <div style={{ position: 'absolute', width: 34, height: 34, ...style }} />;
  const edge = `5px solid ${BUTTER}`;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: o }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, border: `3px solid ${tone === 'butter' ? 'rgba(245,196,69,0.9)' : 'rgba(255,255,255,0.88)'}`, backgroundColor: tone === 'butter' ? 'rgba(245,196,69,0.13)' : '#141414' }} />
      <div style={{ position: 'absolute', left: 34, top: 44, right: 34 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ width: `${b * 100 * Math.max(0, Math.min(1, reveal * bars.length - i))}%`, height: 14, borderRadius: 7, marginBottom: 22, backgroundColor: c, opacity: tone === 'butter' ? 0.62 : 0.5 }} />
        ))}
      </div>
      {tone === 'butter' && (
        <>
          {mark({ left: -14, top: -14, borderLeft: edge, borderTop: edge })}
          {mark({ right: -14, top: -14, borderRight: edge, borderTop: edge })}
          {mark({ left: -14, bottom: -14, borderLeft: edge, borderBottom: edge })}
          {mark({ right: -14, bottom: -14, borderRight: edge, borderBottom: edge })}
        </>
      )}
      {flash > 0 && <div style={{ position: 'absolute', inset: 0, borderRadius: 16, backgroundColor: WHITE, opacity: flash }} />}
    </div>
  );
};

/** 자판 한 개. */
const Key: React.FC<{ x: number; y: number; w: number; label: string; hit: number }> = ({ x, y, w, label, hit }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: 116, borderRadius: 20, border: '3px solid rgba(255,255,255,0.86)', backgroundColor: `rgba(255,255,255,${0.06 + 0.5 * hit})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontSize: 54, fontWeight: 800, letterSpacing: '-0.02em', color: WHITE, transform: `scale(${1 - 0.07 * hit})` }}>
    {label}
  </div>
);

// ───────────────────────── 장면 ─────────────────────────

/** ① 처음 — 몽글이와 두 더미. 0초부터 더미의 키 차이가 보이고, 숫자 둘이 붙고, 「2.2배」가 뜬다. Sequence 안이라 frame은 0부터. */
const Opening: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const drift = 1 + 0.07 * interpolate(t, [0, T.why], [0, 1], clamp);
  const lean = 0.035 * interpolate(t, [T.say22 - 0.1, T.say22 + 0.4], [0, 1], { ...clamp, easing: IN_OUT });
  const pulse = 1 + 0.06 * interpolate(t, [T.say22, T.say22 + 0.12, T.say22 + 0.5], [0, 1, 0], clamp);
  const TOP = 130;
  return (
    <AbsoluteFill>
      <Mong
        a="mong/a.jpg"
        b="mong/a2.jpg"
        mix={interpolate(t, [T.say22 - 0.2, T.say22 + 0.2], [0, 1], clamp)}
        eye={{ x: 244, y: 912, rx: 128, ry: 74 }}
        top={TOP}
        ox={532}
        oy={790}
        s={drift + lean}
        solid={400}
        fade={640}
        light={glow(t) * (1 - 0.06 * interpolate(t, [T.say22, T.say22 + 0.5], [0, 1], clamp))}
      />
      <Tag />
      <Head
        t={t}
        top={346}
        lines={[
          { at: 0, node: '클로드에 같은 문서를', size: 78, color: 'rgba(255,255,255,0.8)' },
          { at: 0, node: 'PDF로 올리면', size: 104 },
          {
            at: T.n22,
            node: (
              <span style={{ display: 'inline-block', transform: `scale(${pulse})`, transformOrigin: '0 80%' }}>
                <Gold>
                  <span style={{ fontSize: 140 }}>2.2배</span>
                </Gold>
                <span style={{ fontSize: 78 }}>를 읽어요</span>
              </span>
            ),
            size: 140,
          },
        ]}
      />
      {/* 11-21 시험관 넷이 모두 「23,596이 무엇을 센 숫자인지 모름(토큰은 14초에야)」으로 짚어 0.9초에 단위와 문서를 붙인다. */}
      <Cap t={t} at={T.lab2 + 0.15} x={84} y={694} size={40}>
        8쪽 약관 · 클로드가 읽은 양(토큰)
      </Cap>
      <StackLabel t={t} at={T.lab1} cx={532} y={TOP + 1166} name="PDF 그대로" value={PDF_TOKENS} strong />
      <StackLabel t={t} at={T.lab2} cx={804} y={TOP + 1166} name="글로 바꾸면" value={TEXT_TOKENS} />
    </AbsoluteFill>
  );
};

/** ② 왜 — PDF 한 쪽이 「글」과 「사진」 두 장으로 갈라지고, 쪽마다 한 쌍씩 여덟 쌍이 선다. */
const WhyScene: React.FC<{ t: number }> = ({ t }) => {
  const split = interpolate(t, [T.wText, T.wText + 0.34], [0, 1], { ...clamp, easing: OUT });
  const photo = interpolate(t, [T.wPhoto, T.wPhoto + 0.34], [0, 1], { ...clamp, easing: OUT });
  const flash = 0.7 * interpolate(t, [T.wPhoto + 0.05, T.wPhoto + 0.12, T.wPhoto + 0.42], [0, 1, 0], clamp);
  // r4 실측: 1.12배로 키우면 7.8초 내용이 x 31~934로 안전 영역(65~920) 밖에 나갔다 — 폭 810px 짜임이라 1.045배까지, 가운데(489)를 축으로.
  const push = settle(t, T.why) * (1 + 0.045 * interpolate(t, [T.why, T.how], [0, 1], clamp));
  const lines = interpolate(t, [T.why + 0.3, T.wEach], [0, 1], clamp);
  const x1 = 390 - 240 * split;
  const x2 = x1 + 410 * photo;
  const first = appear(t, T.why + 0.18, 0.3);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.why - 0.3, node: 'PDF는 클로드가', size: 96 },
          { at: T.wEach, node: '쪽마다 두 번 읽어요', size: 106 },
        ]}
      />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '489px 900px' }}>
        <Cap t={t} at={T.why + 0.18} x={84} y={596} size={44}>
          PDF 한 쪽을 받으면
        </Cap>
        {/* 11-21 시험관 셋이 6초 장면을 「두 번이라면서 「글」 하나만」으로 짚어, 갈라지는 순간부터 둘째 자리를 흐리게 먼저 보인다. */}
        {split > 0 && photo < 1 && (
          <div style={{ position: 'absolute', left: 560, top: 690, width: 300, height: 400, borderRadius: 16, border: `3px dashed ${BUTTER}`, opacity: 0.55 * split * (1 - photo) }} />
        )}
        {photo > 0 && <Page x={x2} y={690} w={300} h={400} tone="butter" o={photo} flash={flash} />}
        <Page x={x1} y={690 + (1 - first) * 28} w={300} h={400} tone="white" o={first} reveal={lines} />
        {split > 0 && (
          <div style={{ position: 'absolute', left: 150, top: 1112 + (1 - split) * 20, width: 300, textAlign: 'center', opacity: split, fontFamily: KO, fontSize: 84, fontWeight: 800, letterSpacing: '-0.04em', color: WHITE, lineHeight: 1.1 }}>글</div>
        )}
        {photo > 0 && (
          <div style={{ position: 'absolute', left: 560, top: 1112 + (1 - photo) * 20, width: 300, textAlign: 'center', opacity: photo, fontFamily: KO, fontSize: 84, fontWeight: 800, letterSpacing: '-0.04em', color: BUTTER, lineHeight: 1.1 }}>사진</div>
        )}
        {/* 쪽마다 한 쌍 — 흰 쪽(글)과 버터 쪽(사진)이 여덟 번 */}
        <div style={{ position: 'absolute', left: 84, top: 1276 }}>
          {Array.from({ length: 8 }).map((_, i) => {
            const p = appear(t, T.wRow + i * 0.075, 0.2);
            if (p <= 0) return null;
            return (
              <div key={i} style={{ position: 'absolute', left: i * 104, top: (1 - p) * 16, opacity: p }}>
                <div style={{ position: 'absolute', left: 0, top: 0, width: 38, height: 52, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.86)' }} />
                <div style={{ position: 'absolute', left: 44, top: 0, width: 38, height: 52, borderRadius: 6, backgroundColor: BUTTER }} />
              </div>
            );
          })}
        </div>
        {/* r6 독립 검수: 네모 줄에 이름이 없어 꾸밈으로 읽힌다. */}
        <Cap t={t} at={T.wRow + 0.05} x={84} y={1344} size={40}>
          8쪽이면 글과 사진 여덟 쌍
        </Cap>
      </div>
    </AbsoluteFill>
  );
};

/** ③ 어떻게 — 열어서 전체 선택 · 복사 · 붙여 넣기. 자판 세 줄이 말과 함께 눌린다. */
const HowScene: React.FC<{ t: number }> = ({ t }) => {
  const rows: { at: number; key: string; label: string }[] = [
    { at: T.hAll, key: 'A', label: '전체 선택' },
    { at: T.hCopy, key: 'C', label: '복사' },
    { at: T.hPaste, key: 'V', label: '클로드에 붙여 넣기' },
  ];
  const push = settle(t, T.how) * (1 + 0.08 * interpolate(t, [T.how, T.proof], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.how - 0.3, node: '글만 있는 문서는', size: 92 },
          { at: T.hAll - 0.06, node: '전체 복사해서', size: 118 },
          { at: T.hPaste, node: <Gold>붙여 넣기</Gold>, size: 118 },
        ]}
      />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '84px 1000px' }}>
        {/* 11-21 시험관 넷과 독립 검수가 7.9~9.4초를 「한 줄만 뜬 빈 화면」으로 짚어, 자판 세 줄을 장면 처음부터 흐리게 세워 두고 말에 맞춰 켠다. */}
        <Cap t={t} at={T.how + 0.12} x={84} y={706} size={48}>
          PDF를 크롬으로 열고
        </Cap>
        {rows.map((r, i) => {
          const pre = appear(t, T.how + 0.22 + i * 0.34, 0.3);
          if (pre <= 0) return null;
          const p = 0.3 * pre + 0.7 * appear(t, r.at, 0.2);
          const hit = interpolate(t, [r.at, r.at + 0.08, r.at + 0.4], [0, 1, 0], clamp);
          const y = 800 + i * 160;
          return (
            <div key={i} style={{ position: 'absolute', left: 0, top: (1 - pre) * 26, opacity: p }}>
              <Key x={84} y={y} w={176} label="Ctrl" hit={hit * 0.5} />
              <Key x={276} y={y} w={122} label={r.key} hit={hit} />
              <div style={{ position: 'absolute', left: 430, top: y + 18, fontFamily: KO, fontSize: 60, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.3, color: WHITE, whiteSpace: 'nowrap' }}>{r.label}</div>
            </div>
          );
        })}
        {/* r6 독립 검수: 맥 사용자는 Ctrl이 아니다. */}
        <Cap t={t} at={T.how + 0.9} x={84} y={1272} size={42}>
          맥은 Ctrl 대신 command
        </Cap>
      </div>
    </AbsoluteFill>
  );
};

/** ④ 증거 — 크롬 PDF 보기에서 전체 선택한 실제 화면 한 컷 + 잰 숫자 둘. */
const ProofScene: React.FC<{ t: number }> = ({ t }) => {
  const shot = appear(t, T.proof + 0.26, 0.3);
  const zoom = (1 + 0.14 * interpolate(t, [T.proof, T.caution], [0, 1], clamp)) * settle(t, T.proof + 0.26);
  const push = 1 + 0.06 * interpolate(t, [T.proof, T.caution], [0, 1], clamp);
  const rowP = appear(t, T.pRead, 0.26);
  const shown = interpolate(t, [T.pHalf, T.pHalf + 0.3], [PDF_TOKENS, TEXT_TOKENS], { ...clamp, easing: IN_OUT });
  const arrow = appear(t, T.pHalf - 0.05, 0.2);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.proof - 0.3, node: '8쪽 약관을 붙였더니', size: 88 },
          {
            at: T.pRead,
            node: (
              <>
                읽는 양이 <Gold>절반 아래</Gold>
              </>
            ),
            size: 98,
          },
        ]}
      />
      <Cap t={t} at={T.proof + 0.16} x={84} y={536}>
        크롬에서 전체 선택한 실제 화면
      </Cap>
      {shot > 0 && (
        <div style={{ position: 'absolute', left: 70, top: 600 + (1 - shot) * 28, width: 850, height: 417, opacity: shot, borderRadius: 18, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.22)', backgroundColor: '#161616' }}>
          <Img src={staticFile('img/selected.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '0% 0%', transform: `scale(${zoom})`, transformOrigin: '20% 20%' }} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '84px 1150px' }}>
      {/* 11-21 시험관 셋과 독립 검수가 「앱 사용량 표시가 아니라」를 「그럼 아끼는 게 아닌가」로 읽어, 잰 것을 먼저 말하고 앱 이야기는 뒤에 둔다. */}
      <Cap t={t} at={T.pNote} x={84} y={1034} size={42}>
        읽는 양(토큰)이 많을수록 사용량이 더 들어요
        <br />
        앱의 사용량 표시로 잰 값은 아니에요
      </Cap>
      {rowP > 0 && (
        <div style={{ position: 'absolute', left: LEFT, top: 1168 + (1 - rowP) * 26, opacity: rowP, display: 'flex', alignItems: 'flex-end', gap: 22, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', whiteSpace: 'nowrap' }}>
          <div>
            <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', color: SUB, lineHeight: 1.2 }}>PDF 그대로</div>
            <div style={{ fontSize: 86, lineHeight: 1.16, color: 'rgba(255,255,255,0.62)', fontVariantNumeric: 'tabular-nums' }}>{num(PDF_TOKENS)}</div>
          </div>
          <div style={{ fontSize: 64, lineHeight: 1.6, color: SUB, fontWeight: 500, opacity: arrow }}>→</div>
          <div style={{ opacity: arrow }}>
            <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', color: SUB, lineHeight: 1.2 }}>붙인 글</div>
            <div style={{ fontSize: 116, lineHeight: 1.1, color: WHITE, fontVariantNumeric: 'tabular-nums' }}>{num(shown)}</div>
          </div>
        </div>
      )}
      </div>
    </AbsoluteFill>
  );
};

/** ⑤ 그대로 둘 때 — 그래프가 든 문서를 글로 바꾸면 막대가 사라지고 문장만 남는다. 「그건 PDF 그대로」에서 돌아온다. */
const CautionScene: React.FC<{ t: number }> = ({ t }) => {
  const values = [412, 388, 530, 610, 475, 702];
  const keep = t >= T.cKeep;
  const card = appear(t, T.caution + 0.12, 0.3);
  const push = settle(t, T.caution) * (1 + 0.03 * interpolate(t, [T.caution, T.end], [0, 1], clamp));
  const gap = interpolate(t, [T.cGone + 0.25, T.cGone + 0.9], [0, 1], clamp) * (1 - appear(t, T.cKeep, 0.2));
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {keep ? (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.caution, node: '그래프 · 스캔본은', size: 90 },
            { at: T.cKeep, node: <Gold>PDF 그대로</Gold>, size: 150 },
          ]}
        />
      ) : (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.caution - 0.3, node: '단, 그래프 · 스캔본은', size: 90 },
            { at: T.cGone - 0.06, node: '글로 바꾸면 사라져요', size: 92 },
          ]}
        />
      )}
      <div style={{ position: 'absolute', left: 94, top: 600 + (1 - card) * 28, width: 810, height: 610, opacity: card, transform: `scale(${push})`, transformOrigin: '405px 300px' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 22, border: '2px solid rgba(255,255,255,0.3)', backgroundColor: '#141414' }} />
        <div style={{ position: 'absolute', left: 44, top: 38, fontFamily: KO, fontSize: 46, fontWeight: 800, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>방문자 보고서(가상 예시)</div>
        <div style={{ position: 'absolute', left: 44, top: 112, fontFamily: KO, fontSize: 40, fontWeight: 600, letterSpacing: '-0.035em', color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap' }}>달마다의 숫자는 그래프 안에 적었습니다.</div>
        {/* 그래프 자리 */}
        <div style={{ position: 'absolute', left: 44, top: 196, width: 742, height: 372 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: '3px dashed rgba(255,255,255,0.4)', opacity: gap }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.5)', opacity: 1 - gap }} />
          {values.map((v, i) => {
            const grow = interpolate(t, [T.caution + 0.3 + i * 0.2, T.caution + 0.9 + i * 0.2], [0, 1], { ...clamp, easing: OUT });
            const gone = interpolate(t, [T.cGone + 0.1 + i * 0.1, T.cGone + 0.4 + i * 0.1], [0, 1], { ...clamp, easing: IN_OUT });
            const back = interpolate(t, [T.cKeep + i * 0.04, T.cKeep + 0.3 + i * 0.04], [0, 1], { ...clamp, easing: OUT });
            const on = keep ? back : grow * (1 - gone);
            const h = (290 * v) / 702;
            // 11-21 독립 검수: 「숫자는 그래프 안에」라면서 막대에 숫자가 없었다 — 막대 위에 숫자를 두고 막대와 함께 사라졌다 돌아오게 한다.
            return (
              <React.Fragment key={i}>
                <div style={{ position: 'absolute', left: 24 + i * 120, bottom: 3, width: 92, height: h * on, opacity: Math.min(1, on * 1.6), borderRadius: '10px 10px 0 0', backgroundColor: 'rgba(255,255,255,0.9)' }} />
                <div style={{ position: 'absolute', left: 24 + i * 120 - 14, width: 120, bottom: 3 + h * on + 8, textAlign: 'center', opacity: Math.max(0, on * 1.4 - 0.4), fontFamily: KO, fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: WHITE, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {!keep && (
        <Cap t={t} at={T.cGone + 0.25} x={84} y={1240} size={50}>
          글로 바꾼 결과
          <br />
          그래프 숫자가 통째로 빠졌어요
        </Cap>
      )}
      {keep && (
        <Cap t={t} at={T.cKeep + 0.05} x={84} y={1240} size={50}>
          PDF로 올리면
          <br />
          그래프 숫자도 읽었어요
        </Cap>
      )}
    </AbsoluteFill>
  );
};

/** ⑥ 끝 — 몽글이를 가까이(처음과 다른 크기 · 높이 · 방향). 끝 3초는 「2.2배」와 「댓글에 「PDF」」(post 판은 「자료는 게시글에」). Sequence 안이라 frame은 0부터. */
const EndScene: React.FC<{ ending: Ending }> = ({ ending }) => {
  const E = ending === 'post' ? TG : T;
  const t = useCurrentFrame() / FPS + T.end;
  const q = interpolate(t, [E.cta - 0.08, E.cta + 0.42], [0, 1], { ...clamp, easing: IN_OUT });
  // r7 검수 · 최종본 검사: 웃는 눈 뒤 2.6초 거의 멎음 — 「보내 드려요」 자리에서 한 번 더 작게 당겨 앉는다.
  const drift = 1 + 0.1 * interpolate(t, [T.end, LEN], [0, 1], clamp) + 0.014 * appear(t, E.key + 0.85, 0.35) + 0.014 * appear(t, E.last, 0.3);
  const row = appear(t, E.cta);
  const cta = appear(t, E.cta + 0.1);
  const under = interpolate(t, [E.key, E.key + 0.3], [0, 100], { ...clamp, easing: OUT });
  const smile = interpolate(t, [E.key - 0.2, E.key + 0.2], [0, 1], clamp);
  const mark = (label: string) => (
    <span style={{ color: BUTTER, backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 100%', backgroundSize: `${under}% 7px`, paddingBottom: 6 }}>{label}</span>
  );
  return (
    <AbsoluteFill>
      <Mong a="mong/c.jpg" b="mong/c2.jpg" mix={smile} eye={{ x: 426, y: 757, rx: 150, ry: 78 }} top={170} ox={430} oy={900} s={(1.02 + 0.05 * q) * drift * settle(t, T.end)} solid={470 + 80 * q} fade={690 + 60 * q} light={glow(t) * (0.96 + 0.1 * smile)} />
      {t < E.cta ? (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.end - 0.3, node: '바꿔도 되는 문서', size: 112 },
            { at: E.eL2, node: '고르는 법', size: 112 },
          ]}
        />
      ) : (
        <>
          <div style={{ position: 'absolute', left: LEFT, top: 286, display: 'flex', alignItems: 'baseline', gap: 22, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', whiteSpace: 'nowrap', opacity: row, transform: `translateY(${(1 - row) * 28}px)` }}>
            {/* r3 독립 검수: 끝에서 「8쪽 약관」이 빠져 2.2배가 모든 PDF의 규칙처럼 읽힌다 — 잰 문서를 붙인다. */}
            <div style={{ fontSize: 50, fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>8쪽 약관 PDF는</div>
            <div style={{ fontSize: 112, lineHeight: 1.08, color: WHITE }}>2.2배</div>
          </div>
          <div style={{ position: 'absolute', left: LEFT, top: 430, fontFamily: KO, fontSize: 104, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap', opacity: cta, transform: `translateY(${(1 - cta) * 28}px)` }}>
            {ending === 'post' ? (
              <>
                자료는 {mark('게시글')}에
              </>
            ) : (
              <>
                댓글에 {mark('「PDF」')}
              </>
            )}
          </div>
          {/* 11-21 시험관 셋 · 독립 검수가 「댓글을 달면 무엇을 받는지 모름 · 끝이 흐지부지」로 짚어 받을 것을 글로도 둔다. */}
          <div style={{ position: 'absolute', left: LEFT + 2, top: 572, fontFamily: KO, fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.18, color: WHITE, whiteSpace: 'nowrap', textShadow: '0 2px 14px rgba(0,0,0,0.75)', opacity: appear(t, E.cta + 0.3), transform: `translateY(${(1 - appear(t, E.cta + 0.3)) * 20}px)` }}>
            {/* r3 독립 검수: 「확인 문장」은 말에도 화면에도 설명이 없다 — 말과 같은 「고르는 법」만 둔다. */}
            {ending === 'post' ? (
              <>
                글로 바꿔도 되는 문서
                <br />
                고르는 법이 있어요
              </>
            ) : (
              <>
                {/* r6 독립 검수: 어디로 받는지(DM)가 없다. r7: 무엇으로 바꾸는지(글로)가 없다. */}
                글로 바꿔도 되는 문서
                <br />
                고르는 법을 DM으로 보내 드려요
              </>
            )}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// ───────────────────────── 본편 ─────────────────────────

export const Film: React.FC<{ bgm?: boolean; voice?: boolean; ending?: Ending }> = ({ bgm = true, voice = true, ending = 'dm' }) => {
  const fr = useCurrentFrame();
  const t = fr / FPS;
  const vo = VO.map((v) => (v.id === 'P2' && ending === 'post' ? { ...v, id: 'P2G', at: P2G_AT } : v));
  const sfx = [...SFX, ...SFX_END[ending]];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Sequence from={0} durationInFrames={F(T.why)} name="처음 · 몽글이">
        <Opening />
      </Sequence>
      {inWin(t, T.why, T.how) && <WhyScene t={t} />}
      {inWin(t, T.how, T.proof) && <HowScene t={t} />}
      {inWin(t, T.proof, T.caution) && <ProofScene t={t} />}
      {inWin(t, T.caution, T.end) && <CautionScene t={t} />}
      <Sequence from={F(T.end)} durationInFrames={TOTAL - F(T.end)} name="끝 · 몽글이">
        <EndScene ending={ending} />
      </Sequence>

      {bgm && <Audio src={staticFile(BGM.file)} volume={(f: number) => MASTER * BGM.vol * interpolate(f, [F(LEN - BGM.fadeOut), F(LEN)], [1, 0.5], clamp)} />}
      {voice &&
        vo.map((v) => (
          <Sequence key={v.id} from={F(v.at)} name={`말 ${v.id}`}>
            <Audio src={staticFile(`vo/${v.id}.wav`)} volume={MASTER} />
          </Sequence>
        ))}
      {voice &&
        sfx.map((x, i) => (
          <Sequence key={i} from={F(x.at)} name={`효과음 ${x.file}`}>
            <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={MASTER * x.v} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
