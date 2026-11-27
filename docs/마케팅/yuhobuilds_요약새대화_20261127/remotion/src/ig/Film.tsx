// 「대화가 길어지면 요약 한 장 들고 새 대화로」 본편 — 수요 장부 yuhobuilds 2번의 다른 일(긴 대화 요약해 새 대화로, 11-27 · 장부 Y89).
// 처음과 끝은 몽글이 Omni 1.2 Flash 샷(영상칸/ — 제작 절차 「정지 그림 칸은 Omni 영상으로」), 가운데는 범수 보이스오버와 실제 화면이다.
// 실제 화면은 2026-11-27에 하위 에이전트(Sonnet 5.5)와 나눈 대화 기록 · 받은 요약 · 새 대화의 답을 꾸밈 없는 문서 보기로 찍은 것(시안/화면/)이다.
// 숫자는 그 기록에 남은 입력 토큰에서 기준선을 뺀 대화 몫(시안/실험/잰값.json)이고, 화면에 옮긴 글은 기록 그대로다.
// 화면 결: 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나. 안전 영역 x 65~920 · y 269~1428.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, OUT } from '../lib/motion';
import { BGM, LEN, LEN_POST, LONG13, MSGS, NEW1, P2G_AT, PAGES, SFX, SFX_END, T, TG, VO } from './timeline';

export type Ending = 'dm' | 'post';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);
export const TOTAL_POST = F(LEN_POST);

const INK = '#0A0A0A';
const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const SOFT = 'rgba(255,255,255,0.78)';
const GREY = '#8C8C8C';
const LEFT = 79;
const MASTER = 0.8;

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.22) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

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

const Small: React.FC<{ t: number; at: number; top: number; left?: number; size?: number; color?: string; children: React.ReactNode }> = ({ t, at, top, left = LEFT, size = 42, color = SOFT, children }) => {
  const p = appear(t, at);
  if (p <= 0) return null;
  return <div style={{ position: 'absolute', left, top: top + (1 - p) * 14, opacity: p, fontFamily: KO, fontSize: size, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, color, whiteSpace: 'nowrap' }}>{children}</div>;
};

const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

const TopShade: React.FC<{ solid: number; fade: number }> = ({ solid, fade }) => (
  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,10,0.9) 0, rgba(10,10,10,0.82) ${solid}px, rgba(10,10,10,0) ${fade}px)` }} />
);

const Shot: React.FC<{ vid: string; rate?: number; from?: number; zoom?: number; oy?: number }> = ({ vid, rate = 1, from = 0, zoom = 1, oy = 1150 }) => (
  <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `540px ${oy}px` }}>
    <OffthreadVideo src={staticFile(`vid/${vid}`)} muted playbackRate={rate} trimBefore={Math.round(from * FPS)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </AbsoluteFill>
);

/** 실제 문서 쪽 한 장(900px 폭으로 찍은 것)을 w 폭으로. 옅은 그림자와 테로 검은 바탕에서 떠 보이게. */
const Sheet: React.FC<{ src: string; w: number; h?: number; style?: React.CSSProperties }> = ({ src, w, h, style }) => (
  <div style={{ position: 'absolute', width: w, height: h, overflow: 'hidden', borderRadius: 6, backgroundColor: WHITE, boxShadow: '0 12px 40px rgba(0,0,0,0.55)', outline: '1px solid rgba(255,255,255,0.25)', ...style }}>
    <Img src={staticFile(src)} style={{ display: 'block', width: w }} />
  </div>
);

const page = (i: number) => `img/long_p${String(i + 1).padStart(2, '0')}.png`;
// 쪽이 쌓일 때 조금씩 비껴 놓는 자리(왼쪽 · 오른쪽 · 기울기) — 늘 같은 값이라 어느 프레임을 뽑아도 같다
const JIT = [0, 14, -10, 18, -16, 8, -6, 16, -12, 10, -18, 6, -8, 12, -14, 4];
const ROT = [0, 1.6, -1.2, 2.0, -1.8, 1.0, -0.8, 1.8, -1.4, 1.2, -2.0, 0.8, -1.0, 1.4, -1.6, 0.6];

// ───────────────────────── 장면 ─────────────────────────

/** ① 처음 — 몽글이가 노트북에서 쏟아진 대화 종이에 파묻혀 있다가 1.2초에 눈이 커진다(Omni o1). */
const Opening: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Shot vid="o1.mp4" zoom={1 + 0.04 * interpolate(t, [0, T.hook], [0, 1], clamp)} />
      <TopShade solid={420} fade={640} />
      <Tag />
      <Big t={t} at={0} top={352} size={104}>
        대화가 길어지면
      </Big>
    </AbsoluteFill>
  );
};

/** ② 결과 먼저 — 같은 일을 시켰을 때 클로드가 다시 읽은 대화. 왼쪽 긴 대화 실제 기록 16쪽 39,283 대 오른쪽 요약 한 장 1,497 = 26분의 1.
 * r2: 이해 시험 r1에서 haiku · GPT가 「지난 편과 같은 숫자 막대」로 짚어 막대 대신 쪽 더미와 한 장으로, 셋 다 「토큰」을 몰라 그 자리에서 「한글 한 글자쯤」으로 푼다
 * (우리가 잰 요약 1,443자 + 부탁 한 줄 ≈ 1,497토큰). */
const Hook: React.FC<{ t: number }> = ({ t }) => {
  const a = appear(t, T.bars, 0.4);
  const b = appear(t, T.bars + 0.25, 0.4);
  const hold = interpolate(t, [T.hook, T.grow], [0, 1], clamp);
  const PW = 250;
  const PH = Math.round((PW * 1600) / 900);
  const SWD = 250;
  const SHT = Math.round((SWD * 1796) / 900);
  const top = 620;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Big t={t} at={T.hook} top={286} size={66}>
        요약 한 장 들고 <Gold>새 대화로</Gold>
      </Big>
      <Big t={t} at={T.n26 - 0.05} top={384} size={200} color={BUTTER}>
        26분의 1
      </Big>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + 0.03 * hold})`, transformOrigin: '540px 900px' }}>
        {Array.from({ length: PAGES }, (_, i) => (
          <Sheet key={i} src={page(PAGES - 1 - i)} w={PW} h={PH} style={{ left: 110 + JIT[i] * 0.4, top: top + i * 7 + (1 - a) * 40, opacity: a, transform: `rotate(${ROT[i] * 0.6}deg)` }} />
        ))}
        <Sheet src="img/summary.png" w={SWD} h={SHT} style={{ left: 620, top: top + 50 + (1 - b) * 40, opacity: b, outline: `4px solid ${BUTTER}` }} />
        <div style={{ position: 'absolute', left: 110, top: 1200, opacity: a }}>
          <div style={{ fontFamily: KO, fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: SOFT, whiteSpace: 'nowrap' }}>긴 대화</div>
          <div style={{ fontFamily: KO, fontSize: 76, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.05, color: WHITE }}>{fmt(LONG13 * a)}</div>
        </div>
        <div style={{ position: 'absolute', left: 620, top: 1200, opacity: b }}>
          <div style={{ fontFamily: KO, fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: WHITE, whiteSpace: 'nowrap' }}>요약 들고 새 대화</div>
          <div style={{ fontFamily: KO, fontSize: 76, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.05, color: BUTTER }}>{fmt(NEW1)}</div>
        </div>
      </div>
      <Small t={t} at={T.bars + 0.3} top={1356} left={110} size={34}>
        같은 일에 다시 읽은 대화 · 토큰 = 한글 한 글자쯤
      </Small>
    </AbsoluteFill>
  );
};

/** ③ 쌓임 — 한 대화로 열세 번 주고받은 실제 기록 열여섯 쪽이 차례로 쌓이고, 말 한 번에 읽은 대화가 228 → 39,283으로 는다. */
const Grow: React.FC<{ t: number }> = ({ t }) => {
  let cur = MSGS[0];
  for (const m of MSGS) if (t >= T.page0 + m.page * T.pageGap + 0.1) cur = m;
  const shown = t < T.page0 + 0.1 ? 0 : cur.v;
  // 쌓인 쪽이 위 숫자를 가리지 않게: 쪽 360px 폭 · 한 장에 11px씩 · 가운데 x 700. 가장 왼쪽으로 기운 쪽의 위 모서리가 x 480이고 숫자(124px)는 x 460 안(r2 프레임에서 39,283 끝이 쪽에 가려 고침).
  const W = 360;
  const H = Math.round((W * 1600) / 900);
  const lift = 11;
  // r2: V2 끝에 「그만큼 한도도 빨리 닿고요」를 더해(GPT · 장면 심사 「내게 무엇이 좋아지나」) 9.02초에 머리 글이 바뀌고 쌓인 쪽이 다가간다.
  const lim = interpolate(t, [T.limit, T.ask], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Big t={t} at={T.grow + 0.08} out={T.limit} top={286} size={84}>
        말 한 번마다
      </Big>
      <Big t={t} at={T.all} out={T.limit} top={388} size={84}>
        앞의 대화까지 <Gold>다</Gold>
      </Big>
      <Big t={t} at={T.limit} top={286} size={84}>
        그만큼
      </Big>
      <Big t={t} at={T.limit + 0.32} top={388} size={84}>
        <Gold>한도</Gold>도 빨리 닿아요
      </Big>
      <div style={{ position: 'absolute', left: LEFT, top: 540, opacity: appear(t, T.page0) }}>
        <div style={{ fontFamily: KO, fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', color: SOFT }}>{cur.n}번째 말에 다시 읽은 대화</div>
        <div style={{ fontFamily: KO, fontSize: 124, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.05, color: WHITE, transform: `scale(${1 + 0.0000006 * shown})`, transformOrigin: '0 50%' }}>{fmt(shown)}</div>
      </div>
      {Array.from({ length: PAGES }, (_, i) => {
        const at = T.page0 + i * T.pageGap;
        const p = interpolate(t, [at, at + 0.2], [0, 1], { ...clamp, easing: OUT });
        if (p <= 0) return null;
        const x = 700 + JIT[i] - W / 2;
        const y = 1520 - H - i * lift - (1 - p) * 260;
        return <Sheet key={i} src={page(i)} w={W} h={H} style={{ left: x, top: y, opacity: Math.min(1, p * 2), transform: `rotate(${ROT[i]}deg) scale(${1 + 0.04 * lim})`, transformOrigin: '50% 100%' }} />;
      })}
    </AbsoluteFill>
  );
};

/** ④ 보낸 말 — 실제로 보낸 열두 번째 말(위)과 그 말을 크게(아래). */
const ASK = ['지금까지 정한 것과', '남은 일만 요약해 줘']; // 맹검(K6): 큰 글 끝 마침표 뺌
const Ask: React.FC<{ t: number }> = ({ t }) => {
  const total = ASK.join('').length;
  const typed = Math.floor(interpolate(t, [T.type, T.type + 1.1], [0, total], clamp));
  let left = typed;
  const push = interpolate(t, [T.ask, T.key], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Small t={t} at={T.ask + 0.05} top={286} size={48} color={WHITE}>
        그래서 보낸 말
      </Small>
      <div style={{ position: 'absolute', left: 65, top: 370, width: 855, opacity: appear(t, T.ask + 0.1, 0.3), transform: `translateY(${(1 - appear(t, T.ask + 0.1, 0.3)) * 30}px) scale(${1 + 0.02 * push})`, transformOrigin: '0 0' }}>
        <div style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: WHITE, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          <Img src={staticFile('img/ask12.png')} style={{ display: 'block', width: 855 }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: LEFT, top: 760, fontFamily: KO, fontSize: 96, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.16, color: WHITE, whiteSpace: 'nowrap', transform: `scale(${1 + 0.03 * interpolate(t, [T.type, T.key], [0, 1], clamp)})`, transformOrigin: '0 0' }}>
        {t >= T.type &&
          ASK.map((line, i) => {
            const n = Math.max(0, Math.min(line.length, left));
            left -= line.length;
            return <div key={i}>{line.slice(0, n)}{n === 0 ? ' ' : ''}</div>;
          })}
      </div>
      <Big t={t} at={T.last} top={1020} size={60} color={BUTTER}>
        바뀐 조건은 마지막 값만
      </Big>
    </AbsoluteFill>
  );
};

/** ⑤ 핵심 장면 — 긴 대화 열여섯 쪽에서 요약 한 장이 빠져나와 새 대화 첫 말이 되고, 같은 표를 시킬 때 읽은 대화가 39,283 → 1,497로 떨어진다. */
export const Key: React.FC<{ t: number; bare?: boolean }> = ({ t, bare = false }) => {
  // 첫 컷 판정 v1(다시): 요약이 빠져나오는 움직임이 안 보임 · 「긴 대화 16쪽」이 쪽 더미 뒤에 가림 · 39,283 끝자리가 화면 밖 · 쪽이 작음
  // → 쪽 290px · 요약 360px로 키우고, 요약은 0.9초에 걸쳐 더미 위로 떠올랐다가 오른쪽으로 옮겨 가며, 글은 더미 아래에 두고, 막대는 480px까지만.
  // 장면 심사 v2(Opus · 넘김 · 볼 이유 2): 막대 하나가 줄어들면 무엇과 견주는지가 사라진다 → 긴 대화 막대(회색)는 남기고, 새 대화 막대(버터)가 그 아래에서 39,283 → 1,497로 줄어든다.
  const SW = 262;
  const SH = Math.round((SW * 1600) / 900);
  const STACK_X = 92;
  const STACK_Y = 450;
  const GAP = 9;
  const lift = interpolate(t, [T.sum, T.sum + 0.35], [0, 1], { ...clamp, easing: OUT });
  const move = interpolate(t, [T.sum + 0.3, T.sum + 0.95], [0, 1], { ...clamp, easing: OUT });
  const sumW = 324;
  const sumH = Math.round((sumW * 1796) / 900);
  const SUM_Y = 410; // 맹검(C130): 두 이름표 높이를 맞추려고 요약을 올림 · 「새 대화 첫 말」 이름표는 제목과 겹쳐 뺌
  const sx = STACK_X + (566 - STACK_X) * move;
  const sy = STACK_Y + (PAGES - 1) * GAP - 120 * lift - (STACK_Y + (PAGES - 1) * GAP - 120 - SUM_Y) * move;
  const sw = SW + (sumW - SW) * move;
  const num = appear(t, T.same, 0.3);
  const nb = appear(t, T.drop - 0.05, 0.15);
  const d = interpolate(t, [T.drop, T.drop + 0.55], [0, 1], { ...clamp, easing: OUT });
  const v = LONG13 + (NEW1 - LONG13) * d;
  const BMAX = 480;
  const bw = Math.max(16, (BMAX * v) / LONG13);
  const push = interpolate(t, [T.key, T.table], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {!bare && (
        <Big t={t} at={T.key + 0.05} top={286} size={72}>
          요약 한 장을 <Gold>새 대화 첫 말</Gold>에
        </Big>
      )}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + 0.025 * push})`, transformOrigin: '500px 900px' }}>
        {Array.from({ length: PAGES }, (_, i) => (
          <Sheet key={i} src={page(PAGES - 1 - i)} w={SW} h={SH} style={{ left: STACK_X + JIT[i] * 0.5, top: STACK_Y + i * GAP, transform: `rotate(${ROT[i] * 0.7}deg)`, opacity: 1 - 0.3 * move }} />
        ))}
        <Small t={t} at={T.key} top={STACK_Y + SH + (PAGES - 1) * GAP + 22} left={STACK_X} size={46} color={WHITE}>
          긴 대화 16쪽
        </Small>
        {lift > 0 && <Sheet src="img/summary.png" w={sw} h={Math.round((sw * 1796) / 900)} style={{ left: sx, top: sy, transform: `rotate(${-2 * (1 - move)}deg)`, outline: `${move > 0.95 ? 4 : 1}px solid ${move > 0.95 ? BUTTER : 'rgba(255,255,255,0.25)'}`, zIndex: 3 }} />}
        <Small t={t} at={T.sum + 0.85} top={STACK_Y + SH + (PAGES - 1) * GAP + 22} left={566} size={46} color={BUTTER}>
          요약 1장
        </Small>
      </div>
      {/* 같은 표를 시킬 때 읽은 대화(토큰) — 위 회색은 긴 대화로 남고, 아래 버터가 줄어든다 */}
      <div style={{ position: 'absolute', left: LEFT, top: 1176, opacity: num }}>
        <div style={{ fontFamily: KO, fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', color: SOFT, whiteSpace: 'nowrap' }}>같은 일 · 긴 대화에서 다시 읽은 대화</div>
        <div style={{ position: 'relative', marginTop: 8, height: 58 }}>
          <div style={{ position: 'absolute', left: 0, top: 4, width: BMAX * num, height: 50, borderRadius: 2, backgroundColor: GREY }} />
          <div style={{ position: 'absolute', left: BMAX * num + 22, top: -8, fontFamily: KO, fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, color: WHITE, whiteSpace: 'nowrap' }}>{fmt(LONG13)}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: LEFT, top: 1300, opacity: nb }}>
        <div style={{ fontFamily: KO, fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', color: WHITE, whiteSpace: 'nowrap' }}>요약 들고 새 대화</div>
        <div style={{ position: 'relative', marginTop: 8, height: 58 }}>
          <div style={{ position: 'absolute', left: 0, top: 4, width: bw, height: 50, borderRadius: 2, backgroundColor: BUTTER }} />
          <div style={{ position: 'absolute', left: bw + 22, top: -14, fontFamily: KO, fontSize: 80, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.05, color: BUTTER, whiteSpace: 'nowrap', transform: `scale(${1 + 0.15 * interpolate(t, [T.drop + 0.4, T.drop + 0.6, T.table], [0, 1, 0.7], clamp)})`, transformOrigin: '0 50%' }}>
            {fmt(v)}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** ⑥ 같은 표 — 새 대화의 실제 답(표). 중간에 바꾼 할인 조건(3개 이상 15%)이 그대로 들어갔다. */
const TW = 855;
const TS = TW / 900;
const SALE = { y: 158.6, h: 117.1, x: 26.5, w: 847 }; // 시안/화면/shots.json 「표」 줄 3(r2 · 31px로 다시 찍은 표)
const TableS: React.FC<{ t: number }> = ({ t }) => {
  const box = appear(t, T.sale, 0.3);
  const push = interpolate(t, [T.table, T.end], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Big t={t} at={T.table + 0.1} top={286} size={80}>
        바꾼 할인 조건도
      </Big>
      <Big t={t} at={T.sale + 0.77} top={384} size={80} color={BUTTER}>
        표에 그대로
      </Big>
      <Small t={t} at={T.table + 0.15} top={540} size={40}>
        요약 들고 간 새 대화의 답
      </Small>
      <div style={{ position: 'absolute', left: 65, top: 610, width: TW, opacity: appear(t, T.table + 0.15, 0.3), transform: `scale(${1 + 0.05 * push})`, transformOrigin: `420px ${(SALE.y + SALE.h / 2) * TS}px` }}>
        <div style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: WHITE, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          <Img src={staticFile('img/table.png')} style={{ display: 'block', width: TW }} />
        </div>
        {box > 0 && <div style={{ position: 'absolute', left: SALE.x * TS - 4, top: SALE.y * TS - 6, width: SALE.w * TS + 8, height: SALE.h * TS + 12, border: `6px solid ${BUTTER}`, borderRadius: 8, opacity: box, transform: `scale(${1.04 - 0.04 * box})` }} />}
      </div>
    </AbsoluteFill>
  );
};

/** ⑦ 끝 — 몽글이(Omni e1)가 요약 한 장 앞에서 웃는다. 끝 3초는 가장 센 숫자 「26분의 1」을 제목 크기로 다시 둔다.
 * r2: 이해 시험 r1에서 haiku · GPT가 「끝 카드가 지난 편과 같다(가운데 큰 숫자 + 웃는 몽글이 + 댓글 DM)」로 짚어, 왼쪽 정렬로 바꾸고 가져갈 한 줄을 흰 쪽지에 그대로 둔다. */
// 실제로 보낸 말 12의 첫 문장 그대로(끝까지는 자료에)
const NOTE_LINES = ['지금까지 정한 것과 남은 일만', '요약해 줘.'];
const EndScene: React.FC<{ ending: Ending }> = ({ ending }) => {
  const t = useCurrentFrame() / FPS + T.end;
  const len = ending === 'post' ? LEN_POST : LEN;
  const cta = ending === 'post' ? TG.cta : T.cta;
  const note = appear(t, T.end + 0.35, 0.3);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Shot vid="e1.mp4" from={0.4} rate={3.5 / (len - T.end + 0.05)} zoom={1 + 0.03 * interpolate(t, [T.end, len], [0, 1], clamp)} />
      <TopShade solid={600} fade={790} />
      <Big t={t} at={T.end + 0.05} top={276} size={176} color={BUTTER}>
        26분의 1
      </Big>
      <Big t={t} at={T.end + 0.2} out={cta} top={474} size={54}>
        요약 한 장 들고 새 대화로
      </Big>
      <Big t={t} at={cta} top={474} size={54}>
        {ending === 'post' ? (
          <>
            <Gold>게시글</Gold>에 그대로 있어요
          </>
        ) : (
          <>
            <Gold>「요약」</Gold> 남기면 이 한 줄을 DM으로
          </>
        )}
      </Big>
      <div style={{ position: 'absolute', left: LEFT, top: 556 + (1 - note) * 20, width: 841, opacity: note, backgroundColor: '#FBF7EE', borderRadius: 14, padding: '18px 28px 22px', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
        <div style={{ fontFamily: KO, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: '#6B6B6B' }}>붙여 넣을 한 줄</div>
        <div style={{ marginTop: 6, fontFamily: KO, fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.22, color: INK, whiteSpace: 'nowrap' }}>
          {NOTE_LINES.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── 본편 ─────────────────────────

export const Film: React.FC<{ bgm?: boolean; voice?: boolean; ending?: Ending }> = ({ bgm = true, voice = true, ending = 'dm' }) => {
  const t = useCurrentFrame() / FPS;
  const len = ending === 'post' ? LEN_POST : LEN;
  const vo = VO.map((v) => (v.id === 'P2' && ending === 'post' ? { ...v, id: 'P2G', at: P2G_AT } : v));
  const sfx = [...SFX, ...SFX_END[ending]];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Sequence from={0} durationInFrames={F(T.hook)} name="처음 · 몽글이">
        <Opening />
      </Sequence>
      {inWin(t, T.hook, T.grow) && <Hook t={t} />}
      {inWin(t, T.grow, T.ask) && <Grow t={t} />}
      {inWin(t, T.ask, T.key) && <Ask t={t} />}
      {inWin(t, T.key, T.table) && <Key t={t} />}
      {inWin(t, T.table, T.end) && <TableS t={t} />}
      <Sequence from={F(T.end)} durationInFrames={F(len) - F(T.end)} name="끝 · 몽글이">
        <EndScene ending={ending} />
      </Sequence>

      {bgm && <Audio src={staticFile(BGM.file)} volume={(f: number) => MASTER * BGM.vol * interpolate(f, [F(len - BGM.fadeOut), F(len)], [1, 0.5], clamp)} />}
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

/** 핵심 장면만(장면 심사용 · 제목 없이) — 요약 한 장이 빠져나와 새 대화로 가고, 읽은 대화가 떨어지기까지(13.8~17.5초). */
export const SCENE_A: [number, number] = [13.8, 17.5];
export const SCENE_LEN = SCENE_A[1] - SCENE_A[0];
export const Scene: React.FC = () => {
  const t = useCurrentFrame() / FPS + SCENE_A[0];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Key t={t} bare />
      <Sequence from={0} name="말 V4">
        <Audio src={staticFile('vo/V4.wav')} trimBefore={F(SCENE_A[0] - 13.8)} volume={MASTER} />
      </Sequence>
      {SFX.filter((x) => x.at >= SCENE_A[0] && x.at < SCENE_A[1]).map((x, i) => (
        <Sequence key={i} from={F(x.at - SCENE_A[0])} name={`효과음 ${x.file}`}>
          <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={MASTER * x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
