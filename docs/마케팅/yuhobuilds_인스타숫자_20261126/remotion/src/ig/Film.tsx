// 「인스타 숫자 캡처 다섯 장, 클로드에게 어디서 갈렸나 묻기」 본편 — 수요 장부 yuhobuilds 4번(클로드에게 인스타 운영 맡기기, 11-26 · 장부 Y80).
// 처음과 끝은 몽글이 Omni 1.2 Flash 샷(영상칸/ — 제작 절차 「정지 그림 칸은 Omni 영상으로」), 가운데는 범수 보이스오버와 실제 화면이다.
// 실제 화면은 2026-11-26 09:59에 ego(「IG synk.mn」 프로필)로 찍은 @synk.mn 릴스 다섯 편의 인사이트 화면(시안/캡처/)이고, 그 조각을 크게 다시 짰다.
// 값과 글은 찍은 그대로다. 막대는 실제 화면의 픽셀을 왼쪽부터 드러내기만 한다.
// 클로드의 답은 맥락 없는 새 클로드 여섯 번(시안/실험/답_a.md · 답_b.md)이고, 화면에 옮긴 여섯 줄은 그 답의 글 그대로다.
// 화면 결: 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나. 안전 영역 x 65~920 · y 269~1428.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, OUT } from '../lib/motion';
import { BGM, LEN, P2G_AT, SFX, SFX_END, T, TG, VO } from './timeline';

export type Ending = 'dm' | 'post';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const INK = '#0A0A0A';
const IG = '#0C1014'; // 인사이트 화면 바탕(찍은 그림에서 잰 값)
const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const SOFT = 'rgba(255,255,255,0.78)';
const LEFT = 79;
const MASTER = 0.8;

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.22) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });

// 다섯 편 — 조회수 순. 값은 캡처(09:59)에 찍힌 그대로다.
type Reel = { k: string; views: string; nf: number; good: boolean };
const REELS: Reel[] = [
  { k: 'again', views: '95,004', nf: 99, good: true },
  { k: 'imo', views: '30,828', nf: 97.7, good: true },
  { k: 'getoff', views: '16,379', nf: 95.7, good: true },
  { k: 'stick', views: '2,140', nf: 78.5, good: false },
  { k: 'deposit', views: '1,305', nf: 68.8, good: false },
];

// ───────────────────────── 부품 ─────────────────────────

const Tag: React.FC<{ o?: number }> = ({ o = 1 }) => (
  <div style={{ position: 'absolute', left: 84, top: 286, opacity: o, fontFamily: KO, fontSize: 34, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap' }}>
    yuhobuilds<span style={{ fontWeight: 500, opacity: 0.7, marginLeft: 16 }}>AI와 회사 만들기</span>
  </div>
);

const Big: React.FC<{ t: number; at: number; top: number; size: number; color?: string; left?: number; out?: number; children: React.ReactNode }> = ({ t, at, top, size, color = WHITE, left = LEFT, out, children }) => {
  const p = appear(t, at) * (out ? interpolate(t, [out - 0.08, out], [1, 0], clamp) : 1);
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', left, top: top + (1 - appear(t, at)) * 26, opacity: p, fontFamily: KO, fontSize: size, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color, whiteSpace: 'nowrap', textShadow: '0 2px 24px rgba(10,10,10,0.45)' }}>
      {children}
    </div>
  );
};

const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

/** 실제 막대 조각 — 막대 자리(조각 px: x 43~1010 · y bar)만 왼쪽부터 드러낸다. 조각 폭 1170px을 w로 줄여 놓는다. */
const Strip: React.FC<{ src: string; w: number; barY: [number, number]; p: number }> = ({ src, w, barY, p }) => {
  const s = w / 1170;
  const x0 = 38 * s;
  const x1 = 1015 * s;
  return (
    <div style={{ position: 'relative', width: w }}>
      <Img src={staticFile(src)} style={{ display: 'block', width: w }} />
      <div style={{ position: 'absolute', left: x0 + (x1 - x0) * p, top: barY[0] * s - 2, width: Math.max(0, (x1 - x0) * (1 - p)), height: (barY[1] - barY[0]) * s + 4, backgroundColor: IG }} />
    </div>
  );
};

const Frame: React.FC<{ o: number; c?: string; pad?: number; r?: number; w?: number }> = ({ o, c = BUTTER, pad = 10, r = 16, w = 6 }) =>
  o > 0 ? <div style={{ position: 'absolute', left: -pad, top: -pad, right: -pad, bottom: -pad, border: `${w}px solid ${c}`, borderRadius: r, opacity: o, transform: `scale(${1.04 - 0.04 * o})` }} /> : null;

const TopShade: React.FC<{ solid: number; fade: number }> = ({ solid, fade }) => (
  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,10,0.92) 0, rgba(10,10,10,0.86) ${solid}px, rgba(10,10,10,0) ${fade}px)` }} />
);

const Shot: React.FC<{ vid: string; rate?: number; from?: number; zoom?: number; oy?: number }> = ({ vid, rate = 1, from = 0, zoom = 1, oy = 1150 }) => (
  <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `540px ${oy}px` }}>
    <OffthreadVideo src={staticFile(`vid/${vid}`)} muted playbackRate={rate} trimBefore={Math.round(from * FPS)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </AbsoluteFill>
);

// ───────────────────────── 장면 ─────────────────────────

/** ① 처음 — 몽글이가 카드 다섯 장을 보다 1.4초에 눈이 커진다(Omni o1). 0초부터 「제일 잘된 릴스는」. */
const Opening: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Shot vid="o1.mp4" />
      <TopShade solid={430} fade={640} />
      <Tag />
      <Big t={t} at={0} top={350} size={96}>
        제일 잘된 릴스는
      </Big>
    </AbsoluteFill>
  );
};

/** ② 결과 먼저 — 제일 잘된 편의 실제 인사이트 「Views」 칸. 99%가 팔로워가 아닌 사람. 오른쪽은 그 릴스의 첫 화면. */
const BLOCK_W = 855;
const Hook: React.FC<{ t: number }> = ({ t }) => {
  const s = BLOCK_W / 1170;
  const push = 1 + 0.05 * interpolate(t, [T.hook, T.five], [0, 1], clamp);
  const bar = interpolate(t, [T.hook + 0.08, T.hook + 0.7], [0, 1], { ...clamp, easing: OUT });
  const box = appear(t, T.nf, 0.3);
  const thumb = appear(t, T.hook, 0.3);
  // 숫자가 선 뒤에도 화면이 멎지 않게(올리기 전 검사 r7 2.5~3.5초 정지): 첫 화면 속으로 천천히 다가가고, 99%가 조금씩 커진다.
  const hold = interpolate(t, [T.hook, T.five], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: IG }}>
      <Tag />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${1 + 0.05 * hold})`, transformOrigin: `${LEFT}px 470px` }}>
        <Big t={t} at={T.n99 - 0.05} top={360} size={230} color={BUTTER}>
          99%
        </Big>
      </div>
      <Big t={t} at={T.nf} top={630} size={64}>
        팔로워가 아닌 사람
      </Big>
      <div style={{ position: 'absolute', left: 660, top: 290, width: 260, height: 462, opacity: thumb, transform: `translateY(${(1 - thumb) * 30 - 20 * hold}px)`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
        <Img src={staticFile('img/th_again.jpg')} style={{ width: 260, height: 462, objectFit: 'cover', transform: `scale(${1 + 0.16 * hold})`, transformOrigin: '50% 40%' }} />
      </div>
      <div style={{ position: 'absolute', left: 65, top: 790, width: BLOCK_W, transform: `scale(${push})`, transformOrigin: '420px 260px' }}>
        <Strip src="img/block_again.png" w={BLOCK_W} barY={[460, 483]} p={bar} />
        <div style={{ position: 'absolute', left: 22 * s, top: 388 * s, width: 1135 * s, height: 108 * s }}>
          <Frame o={box} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** ③ 다섯 편 → ④ 보낸 말 — 같은 주에 올린 다섯 편의 실제 첫 화면이 크게 섰다가, 5.95초에 위로 작아져 붙임처럼 줄 서고 실제로 보낸 질문이 써진다. */
const GW = 250;
const GH = 444;
const GRID = [
  [98, 400],
  [368, 400],
  [638, 400],
  [233, 930],
  [503, 930],
];
const ASK_SMALL = '내 인스타 릴스 다섯 편의 인사이트 캡처야.';
const ASK_PLAIN = ['잘된 편과 안된 편이', '어디서 갈렸는지,', '다음 편 고를 기준을', '세 줄로 알려 줘.'];
const FiveAsk: React.FC<{ t: number }> = ({ t }) => {
  const m = interpolate(t, [T.ask, T.ask + 0.45], [0, 1], { ...clamp, easing: OUT });
  const total = ASK_PLAIN.join('').length;
  const typed = Math.floor(interpolate(t, [T.type, T.type + 0.9], [0, total], clamp));
  let left = typed;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Big t={t} at={T.five + 0.05} out={T.ask} top={286} size={72}>
        같은 주에 올린 <Gold>5편</Gold>
      </Big>
      <Big t={t} at={T.ask} top={286} size={56} color={SOFT}>
        캡처 다섯 장과 함께 보낸 말
      </Big>
      {REELS.map((r, i) => {
        const p = appear(t, T.th0 + i * T.thGap, 0.16);
        const [gx, gy] = GRID[i];
        const w = GW + (112 - GW) * m;
        const h = GH + (199 - GH) * m;
        const x = gx + (LEFT + i * 128 - gx) * m;
        const y = gy + (380 - gy) * m + (1 - p) * 40;
        const label = 1 - m;
        // 다섯 장이 다 선 뒤 4.5~5.9초가 통째로 멎었다(r7): 첫 화면마다 속으로 천천히 다가간다.
        // 붙임 줄로 작아질 때는 다시 첫 화면 전체가 보이게 돌아온다.
        const kb = 1 + 0.12 * interpolate(t, [T.th0 + i * T.thGap, T.ask, T.ask + 0.45], [0, 1, 0], clamp);
        return (
          <div key={r.k} style={{ position: 'absolute', left: x, top: y, width: w, opacity: p }}>
            <div style={{ width: w, height: h, borderRadius: 12, overflow: 'hidden', boxSizing: 'border-box', border: `2px solid rgba(255,255,255,${0.22 + 0.06 * m})` }}>
              <Img src={staticFile(`img/th_${r.k}.jpg`)} style={{ width: w, height: h, objectFit: 'cover', transform: `scale(${kb})`, transformOrigin: '50% 40%' }} />
            </div>
            {label > 0.02 && <div style={{ marginTop: 8, opacity: label, fontFamily: KO, fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', color: WHITE, textAlign: 'center', whiteSpace: 'nowrap' }}>{r.views}회</div>}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: LEFT, top: 640, opacity: appear(t, T.type - 0.1), fontFamily: KO, fontSize: 44, fontWeight: 700, color: SOFT, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>{ASK_SMALL}</div>
      <div style={{ position: 'absolute', left: LEFT, top: 720, transform: `scale(${1 + 0.03 * interpolate(t, [T.type, T.bars], [0, 1], clamp)})`, transformOrigin: '0 0', fontFamily: KO, fontSize: 88, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.16, color: WHITE, whiteSpace: 'nowrap' }}>
        {t >= T.type &&
          ASK_PLAIN.map((line, i) => {
            const n = Math.max(0, Math.min(line.length, left));
            left -= line.length;
            const shown = line.slice(0, n);
            return <div key={i}>{i === 1 ? <Gold>{shown}</Gold> : shown}{n === 0 ? ' ' : ''}</div>;
          })}
      </div>
    </AbsoluteFill>
  );
};

/** ⑤ 핵심 장면 — 다섯 편의 조회수와 실제 「Non-followers」 막대. 잘된 셋은 팔로워 밖으로 퍼졌고(막대가 끝까지), 안된 둘은 몇천 회에서 멈췄다. */
const ROW_Y = 470;
const ROW_H = 196;
const NF_W = 718;
export const Bars: React.FC<{ t: number; bare?: boolean }> = ({ t, bare = false }) => {
  const good = appear(t, T.good, 0.3);
  const bad = appear(t, T.bad, 0.3);
  const push = 1 + 0.02 * interpolate(t, [T.bars, T.scene], [0, 1], clamp);
  // 9.5~12.5초가 멎었다(r7): 짚지 않은 줄은 천천히 물러나고, 짚은 줄의 조회수는 말하는 동안 조금씩 커지고, 첫 화면 속으로 다가간다.
  const goodSlow = interpolate(t, [T.good, T.bad], [0, 1], clamp);
  const badSlow = interpolate(t, [T.bad, T.scene], [0, 1], clamp);
  const kb = 1 + 0.28 * interpolate(t, [T.bar0, T.scene], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: IG }}>
      {!bare && (
        <>
          <Big t={t} at={T.bars} top={286} size={76}>
            팔로워 밖으로
          </Big>
          <Big t={t} at={T.good} out={T.bad} top={372} size={56} color={BUTTER}>
            퍼진 3편
          </Big>
          <Big t={t} at={T.bad} top={372} size={56}>
            못 퍼진 2편
          </Big>
        </>
      )}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${push})`, transformOrigin: '490px 900px' }}>
        {REELS.map((r, i) => {
          const p = appear(t, T.bars + 0.05 * i, 0.24);
          const a = T.bar0 + T.barGap * i;
          const bar = interpolate(t, [a, a + 0.55], [0, 1], { ...clamp, easing: OUT });
          const on = r.good ? good * (1 - bad) : bad;
          const grow = r.good ? goodSlow * (1 - bad) : badSlow;
          const dim = r.good ? 1 - 0.55 * badSlow : 1 - 0.45 * goodSlow * (1 - bad);
          const y = ROW_Y + i * ROW_H;
          return (
            <div key={r.k} style={{ position: 'absolute', left: 75, top: y + (1 - p) * 30, opacity: p * dim }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 100, height: 178, borderRadius: 10, overflow: 'hidden', boxSizing: 'border-box', border: '2px solid rgba(255,255,255,0.22)' }}>
                <Img src={staticFile(`img/th_${r.k}.jpg`)} style={{ width: 100, height: 178, objectFit: 'cover', transform: `scale(${kb})`, transformOrigin: '50% 40%' }} />
              </div>
              <div style={{ position: 'absolute', left: 126, top: -8, transform: `scale(${1 + 0.06 * on + 0.14 * grow})`, transformOrigin: '0 50%', fontFamily: KO, fontSize: 74, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, color: r.good ? BUTTER : WHITE, whiteSpace: 'nowrap' }}>
                {r.views}
                <span style={{ fontSize: 44, marginLeft: 6 }}>회</span>
              </div>
              <div style={{ position: 'absolute', left: 112, top: 92, width: NF_W }}>
                <Strip src={`img/nf_${r.k}.png`} w={NF_W} barY={[70, 93]} p={bar} />
                <Frame o={on} c={r.good ? BUTTER : WHITE} pad={14} w={5} />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** ⑥ 갈린 곳 — 잘된 셋은 한 장면에 한 마디, 안된 둘은 읽어야 아는 설명(클로드 답). 첫 화면은 찍은 그대로다. */
const Compare: React.FC<{ t: number }> = ({ t }) => {
  const W = 250;
  const H = 444;
  const g = appear(t, T.sGood, 0.3);
  const b = appear(t, T.sBad, 0.3);
  const pos = [
    [98, 420],
    [368, 420],
    [638, 420],
    [233, 920],
    [503, 920],
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Big t={t} at={T.scene + 0.05} out={T.sGood} top={286} size={84}>
        갈린 건 <Gold>장면</Gold>
      </Big>
      <Big t={t} at={T.sGood} out={T.sBad} top={286} size={70}>
        잘된 편: <Gold>한 장면에 한마디</Gold>
      </Big>
      <Big t={t} at={T.sBad} top={286} size={70}>
        안된 편: 읽어야 아는 설명
      </Big>
      {REELS.map((r, i) => {
        const p = appear(t, T.scene + 0.08 * i, 0.3);
        const [x, y] = pos[i];
        const on = r.good ? g * (1 - b) : b;
        const dim = r.good ? 1 - 0.85 * b : 1 - 0.55 * g * (1 - b);
        const s = 1 + 0.05 * on;
        // 「안된 편」 때 두 장이 위로 올라와 커진다(380×675) — 글 상자가 읽히게
        const bi = r.good ? -1 : i - 3;
        const bw = W + (380 - W) * b;
        const bh = H + (675 - H) * b;
        const bx = bi < 0 ? x : x + ((bi === 0 ? 103 : 503) - x) * b;
        const by = bi < 0 ? y : y + (430 - y) * b;
        const w = bi < 0 ? W : bw;
        const h = bi < 0 ? H : bh;
        return (
          <div key={r.k} style={{ position: 'absolute', left: bx, top: by + (1 - p) * 30, width: w, height: h, opacity: p * dim, transform: `scale(${bi < 0 ? s : 1})`, zIndex: bi < 0 ? 1 : 2 }}>
            <div style={{ width: w, height: h, borderRadius: 12, overflow: 'hidden', boxSizing: 'border-box', border: '2px solid rgba(255,255,255,0.22)' }}>
              <Img src={staticFile(`img/th_${r.k}.jpg`)} style={{ width: w, height: h, objectFit: 'cover' }} />
            </div>
            <Frame o={on} c={r.good ? BUTTER : WHITE} pad={8} w={5} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** ⑦ 여섯 번 — 같은 질문을 새 클로드에게 여섯 번. 아래 여섯 줄은 답의 글 그대로다(시안/실험/). */
const QUOTES: [string, string, string][] = [
  // [앞, 노랗게 짚을 낱말, 뒤] — 이어 붙이면 답의 글 그대로다
  ['모두 상황 ', '한 장면에 말 한마디', '였습니다'],
  ['글은 큰 말풍선 ', '한 마디', '로 줄인다'],
  ['', '설명 없이', ' 감정이 먼저 보여야 하고'],
  ['', '설명 없이', ' 한눈에 읽히는 일상 장면이다'],
  ['', '첫 장면만 봐도', ' 상황이 이해되는 편입니다'],
  ['', '보는 순간', ' 이해되는 생활 장면이고'],
];
const Six: React.FC<{ t: number }> = ({ t }) => {
  const q = appear(t, T.quotes, 0.35);
  const rise = 44 * interpolate(t, [T.six, T.end], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Big t={t} at={T.six + 0.1} top={286} size={88}>
        여섯 번 물어도
      </Big>
      <Big t={t} at={T.same} top={392} size={88} color={BUTTER}>
        같은 답
      </Big>
      <div style={{ position: 'absolute', left: LEFT - 14, top: 580 - rise, opacity: q }}>
        <div style={{ fontFamily: KO, fontSize: 40, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.02em', marginBottom: 26 }}>새 대화에서 여섯 번 물은 답</div>
        {QUOTES.map(([pre, key, post], i) => (
          <div key={i} style={{ fontFamily: KO, fontSize: 50, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.04em', lineHeight: 1.16, padding: '16px 0 16px 26px', borderLeft: '4px solid rgba(255,255,255,0.35)', marginBottom: 12, whiteSpace: 'nowrap', opacity: interpolate(t, [T.quotes + 0.04 * i, T.quotes + 0.04 * i + 0.2], [0, 1], clamp) }}>
            「{pre}
            <span style={{ color: BUTTER }}>{key}</span>
            {post}」
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** ⑧ 끝 — 몽글이(Omni e1, 1초에 웃음). 끝 3초는 가장 센 숫자 99%를 제목 크기로 다시 둔다. 지난 편들의 왼쪽 위 글 더미와 달리 가운데에 세우고, 안내는 그 아래 한 줄로 둔다(이해 시험 r4 h · G 「끝 카드가 같아 보임」). */
const Center: React.FC<{ t: number; at: number; top: number; size: number; color?: string; out?: number; children: React.ReactNode }> = ({ t, at, top, size, color = WHITE, out, children }) => {
  const p = appear(t, at) * (out ? interpolate(t, [out - 0.08, out], [1, 0], clamp) : 1);
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: 65, width: 855, top: top + (1 - appear(t, at)) * 24, opacity: p, textAlign: 'center', fontFamily: KO, fontSize: size, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color, whiteSpace: 'nowrap', textShadow: '0 2px 24px rgba(10,10,10,0.5)' }}>
      {children}
    </div>
  );
};
const EndScene: React.FC<{ ending: Ending }> = ({ ending }) => {
  const t = useCurrentFrame() / FPS + T.end;
  const cta = ending === 'post' ? TG.cta : T.cta;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Shot vid="e1.mp4" from={0.4} rate={3.6 / (LEN - T.end + 0.05)} zoom={1 + 0.07 * interpolate(t, [T.end, LEN], [0, 1], clamp)} />
      <TopShade solid={600} fade={780} />
      <Center t={t} at={T.end + 0.05} top={286} size={190} color={BUTTER}>
        99%
      </Center>
      <Center t={t} at={T.end + 0.2} top={500} size={60}>
        팔로워가 아닌 사람
      </Center>
      <Center t={t} at={T.end + 0.1} out={cta} top={596} size={58}>
        찍을 화면과 물어볼 한 줄
      </Center>
      <Center t={t} at={cta} top={596} size={58}>
        {ending === 'post' ? (
          <>
            <Gold>게시글</Gold>에 그대로 있어요
          </>
        ) : (
          <>
            <Gold>「캡처」</Gold> 댓글이면 DM으로
          </>
        )}
      </Center>
    </AbsoluteFill>
  );
};

// ───────────────────────── 본편 ─────────────────────────

export const Film: React.FC<{ bgm?: boolean; voice?: boolean; ending?: Ending }> = ({ bgm = true, voice = true, ending = 'dm' }) => {
  const t = useCurrentFrame() / FPS;
  const vo = VO.map((v) => (v.id === 'P2' && ending === 'post' ? { ...v, id: 'P2G', at: P2G_AT } : v));
  const sfx = [...SFX, ...SFX_END[ending]];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Sequence from={0} durationInFrames={F(T.hook)} name="처음 · 몽글이">
        <Opening />
      </Sequence>
      {inWin(t, T.hook, T.five) && <Hook t={t} />}
      {inWin(t, T.five, T.bars) && <FiveAsk t={t} />}
      {inWin(t, T.bars, T.scene) && <Bars t={t} />}
      {inWin(t, T.scene, T.six) && <Compare t={t} />}
      {inWin(t, T.six, T.end) && <Six t={t} />}
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

/** 핵심 장면만(장면 심사용 · 제목 · 설명 없이) — 다섯 막대가 서고, 잘된 셋 · 안된 둘이 갈리기까지(8.6~12.5초). */
export const SCENE_A: [number, number] = [8.6, 12.5];
export const SCENE_LEN = SCENE_A[1] - SCENE_A[0];
export const Scene: React.FC = () => {
  const t = useCurrentFrame() / FPS + SCENE_A[0];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Bars t={t} bare />
      <Sequence from={0} name="말 V4">
        <Audio src={staticFile('vo/V4.wav')} trimBefore={F(SCENE_A[0] - 8.55)} volume={MASTER} />
      </Sequence>
      {SFX.filter((x) => x.at >= SCENE_A[0] && x.at < SCENE_A[1]).map((x, i) => (
        <Sequence key={i} from={F(x.at - SCENE_A[0])} name={`효과음 ${x.file}`}>
          <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={MASTER * x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
