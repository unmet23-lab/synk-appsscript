// Y63 본편 — AI 비서한테 SNS 게시물 하나 보냈는데, 요금으로 치면 4.2달러였다.
// 실화(11-16): 메신저 AI 비서가 10-21부터 한 대화를 이어 써서, 게시물 하나 받을 때마다 첫 호출이 지난 대화를 처음부터 다시 읽었다(많을 때 533,347토큰).
// 대화가 5만 토큰을 넘으면 요약하게 하고 그림은 열지 말라고 규칙을 바꾸자, 고친 뒤 첫 게시물에서 요약 뒤 호출이 4만 토큰대였다. 그런데 대화에 남은
// 옛 규칙대로 그림 일곱 장을 또 열어서, 받을 때마다 규칙 파일부터 다시 읽게 했다. 화면 숫자는 모두 기록 값이다(data.ts).
// 화면 결(장부 머리말): 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나. 무대는 밝은 종이 책상(지난 두 편의 강 위 다리 · 먹색 영수증 더미와 다르게).
// r4(이해 시험 r3 반영): 「지침」 → 「규칙」, 「토큰」 풀이를 처음 나올 때 크게, 「SNS 게시물」, 막대 대신 대화 종이 탑 셋, 그림 일곱 장에 이름표,
// 끝은 지난 편들의 「큰 숫자 전후」 대신 요약 한 장이 새 대화 창으로 들어가는 장면.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { IN_OUT, mix, prog } from '../lib/motion';
import { AFTER_IN, BEFORE_IN, REOPENED, SHARES } from './data';
import { READ, ReadScene } from './ReadScene';
import { LEN, SFX, T, TAG_DROPS, VO } from './timeline';
import { BUTTER, GRAY, INK, N, PITCH, PriceTag, SHEET_W, STAGE, Sheet, Tower, followPan } from './Tower';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);
const BGM = 0.34;

const win = (f: number, a: number, b: number) => f >= F(a) && f < F(b);
const fadeOut = (f: number, b: number) => (b >= LEN ? 1 : 1 - prog(f, F(b) - 3, 3));
const slamAt = (f: number, at: number, len = 10) => (f >= F(at) ? Math.max(0, 1 - (f - F(at)) / len) : 0);

/** 바탕 — 밝은 종이 책상. 아주 옅은 빛이 천천히 흐른다. */
const Backdrop: React.FC<{ f: number }> = ({ f }) => {
  const x = 50 + 8 * Math.sin(f / 90);
  return <AbsoluteFill style={{ background: `radial-gradient(120% 70% at ${x}% 22%, #F6F4EE 0%, ${STAGE} 55%, #E2DED4 100%)` }} />;
};

/** 위 흐림 — 탑이 위 큰 글 밑으로 파고들지 않게. */
const TopFade: React.FC<{ o?: number }> = ({ o = 1 }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 860, opacity: o, background: `linear-gradient(180deg, ${STAGE} 0%, ${STAGE} 86%, rgba(236,233,225,0) 100%)` }} />
);

/** 위 큰 글 — 줄 단위로 28px 올라오며 나타남. 검정 글자. */
const Head: React.FC<{ f: number; from: number; to: number; lines: { at: number; node: React.ReactNode }[]; size?: number }> = ({ f, from, to, lines, size = 96 }) => {
  if (!win(f, from, to)) return null;
  const out = fadeOut(f, to);
  return (
    <div style={{ position: 'absolute', left: 74, width: 846, top: 284, fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.4, color: INK }}>
      {lines.map((l, i) => {
        const p = l.at <= from ? (from === 0 ? 1 : prog(f, F(from), 6)) : prog(f, F(l.at), 7);
        return (
          <div key={i} style={{ opacity: p * out, transform: `translateY(${(1 - p) * 28}px)`, whiteSpace: 'nowrap' }}>
            {l.node}
          </div>
        );
      })}
    </div>
  );
};

const U: React.FC<{ children: React.ReactNode; p?: number }> = ({ children, p = 1 }) => (
  <span style={{ backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 92%', backgroundSize: `${p * 100}% 0.22em` }}>{children}</span>
);

/** 풀이 · 출처 줄. dark이면 검은 바탕 흰 글자(그림 위에서도 읽히게). */
const Note: React.FC<{ f: number; f0: number; f1: number; text: React.ReactNode; top: number; left?: number; dark?: boolean; size?: number }> = ({ f, f0, f1, text, top, left = 74, dark = false, size = 44 }) => {
  if (!win(f, f0, f1)) return null;
  const p = prog(f, F(f0), 8);
  return (
    <div style={{ position: 'absolute', left, top, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: -1, color: dark ? '#fff' : INK, opacity: p * fadeOut(f, f1), transform: `translateY(${(1 - p) * 12}px)`, background: dark ? INK : 'rgba(14,15,18,0.08)', borderRadius: 16, padding: '10px 22px', whiteSpace: 'nowrap', boxShadow: dark ? '0 12px 26px rgba(0,0,0,0.25)' : 'none' }}>{text}</div>
  );
};

const LinkSvg: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
);

/** 0~4.1초 — 말풍선 「SNS 게시물 하나」를 보내자 4.18달러 꼬리표가 찍힌다. */
const Hook: React.FC<{ f: number }> = ({ f }) => {
  if (!win(f, 0, T.tags)) return null;
  const out = fadeOut(f, T.tags);
  const pop = prog(f, F(T.bubble), 8);
  const up = prog(f, F(T.sent), 10, IN_OUT);
  const bill = prog(f, F(T.bill), 9);
  const tag = f >= F(T.tag) ? prog(f, F(T.tag), 7) : 0;
  const slam = slamAt(f, T.tag);
  const drift = mix(1, 1.03, f / F(T.tags));
  // 꼬리표가 찍히는 순간 그쪽으로 한 번에 다가가는 컷(원본 박자 자리), 그 뒤 천천히 물러남
  const cut = f >= F(T.tag) ? 1.09 - 0.06 * prog(f, F(T.tag) + 1, 20, IN_OUT) : 1;
  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${drift * cut}) translateY(${slam * Math.sin(f) * 6}px)`, transformOrigin: f >= F(T.tag) ? '28% 60%' : '50% 60%' }}>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: mix(900, 660, up), display: 'flex', justifyContent: 'flex-end', paddingRight: mix(200, 240, up), boxSizing: 'border-box', opacity: Math.min(1, pop * 1.6), transform: `scale(${mix(1.3, 1, pop) * mix(1.2, 1, up)})`, transformOrigin: '80% 50%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: INK, color: '#fff', fontFamily: KO, fontWeight: 800, fontSize: 60, letterSpacing: -1.6, borderRadius: '44px 44px 10px 44px', padding: '24px 40px', whiteSpace: 'nowrap', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
          <LinkSvg size={54} />
          SNS 게시물 하나
        </div>
      </div>
      <div style={{ position: 'absolute', left: 74, top: 830, width: 846, opacity: bill, transform: `translateY(${(1 - bill) * 40}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 84, height: 84, borderRadius: 42, background: INK, color: '#fff', fontFamily: KO, fontWeight: 900, fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>AI</div>
          <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 50, letterSpacing: -1.2, color: INK }}>AI 비서가 받음</div>
        </div>
        <div style={{ marginTop: 26, background: '#fff', borderRadius: 30, height: 300, boxShadow: '0 24px 50px rgba(40,30,0,0.15)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 44, top: 46, fontFamily: KO, fontWeight: 800, fontSize: 46, color: GRAY, letterSpacing: -1 }}>이 한 건의 요금</div>
          <PriceTag usd={SHARES[4].usd} p={tag} left={40} top={120} size={150} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 4.1~5.3초 — 고치기 전 다섯 건의 꼬리표가 떨어져 쌓임. 버터는 가장 비싼 한 건(11월 15일 밤)만. */
const Tags: React.FC<{ f: number }> = ({ f }) => {
  if (!win(f, T.tags, T.read)) return null;
  const out = fadeOut(f, T.read);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {SHARES.map((s, i) => {
        const p = prog(f, F(TAG_DROPS[i]), 6);
        if (p <= 0) return null;
        const hot = i === SHARES.length - 1;
        const top = 600 + i * 132;
        return (
          <div key={i} style={{ position: 'absolute', left: 74, top: mix(top - 120, top, p), opacity: Math.min(1, p * 1.5), width: 846, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: KO }}>
            <div style={{ fontWeight: 800, fontSize: 54, letterSpacing: -1.4, color: INK, whiteSpace: 'nowrap' }}>{s.when}</div>
            <div style={{ transform: `rotate(${[-4, 3, -2, 4, -6][i]}deg) scale(${mix(1.25, 1, p)})`, background: hot ? BUTTER : '#fff', color: INK, fontWeight: 900, fontSize: 92, letterSpacing: -3.4, lineHeight: 1, padding: '14px 30px 14px 54px', borderRadius: 16, clipPath: 'polygon(30px 0, 100% 0, 100% 100%, 30px 100%, 0 50%)', fontVariantNumeric: 'tabular-nums', boxShadow: '0 10px 22px rgba(40,30,0,0.14)', whiteSpace: 'nowrap' }}>
              {s.usd.toFixed(2)}
              <span style={{ fontSize: 44, letterSpacing: -1, marginLeft: 6 }}>달러</span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 작은 대화 종이 탑 — 높이 = 다시 읽은 양. 장마다 「AI」 점과 풍선 둘. */
const MiniStack: React.FC<{ x: number; bottom: number; h: number; w: number; hot?: boolean; dark?: boolean }> = ({ x, bottom, h, w, hot = false, dark = false }) => {
  const n = Math.max(1, Math.floor(h / 30));
  return (
    <div style={{ position: 'absolute', left: x, top: bottom - h, width: w, height: h }}>
      {Array.from({ length: n }, (_, i) => {
        const r = ((Math.sin((i + x) * 12.99) * 43758.5) % 1 + 1) % 1;
        const top = i === n - 1 && hot;
        return (
          <div key={i} style={{ position: 'absolute', left: Math.sin(i * 3.1 + x) * 6, top: h - (i + 1) * 30, width: w, height: 25, borderRadius: 6, background: dark ? INK : top ? BUTTER : '#fff', boxShadow: '0 3px 7px rgba(40,30,0,0.13)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', boxSizing: 'border-box' }}>
            <div style={{ width: 13, height: 13, borderRadius: 7, background: dark ? '#fff' : INK, flex: 'none' }} />
            <div style={{ height: 7, width: `${30 + 30 * r}%`, borderRadius: 4, background: dark ? 'rgba(255,255,255,0.45)' : 'rgba(14,15,18,0.18)' }} />
            <div style={{ flex: 1 }} />
            <div style={{ height: 9, width: '22%', borderRadius: 5, background: dark ? 'rgba(255,255,255,0.7)' : '#2A2C31' }} />
          </div>
        );
      })}
    </div>
  );
};

/** 10.2~14.6초 — 날짜 줄(한 대화가 10월 21일부터 이어짐)과 게시물마다 첫 호출이 다시 읽은 양을 대화 종이 탑 셋으로. */
const Line: React.FC<{ f: number }> = ({ f }) => {
  if (!win(f, T.line, T.fix)) return null;
  const out = fadeOut(f, T.fix);
  const ap = prog(f, F(T.line), 8);
  const grow = prog(f, F(T.line) + 4, F(T.line2) - F(T.line) - 4, IN_OUT);
  const done = prog(f, F(T.line2), 6);
  const stacks = [
    { label: '11월 7일', v: SHARES[0].first, at: T.line2 },
    { label: '11월 11일', v: SHARES[3].first, at: 12.44 },
    { label: '11월 15일', v: SHARES[4].first, at: T.bar3 },
  ];
  const slam = slamAt(f, 13.04);
  const MAXH = 400;
  const bottom = 1410;
  return (
    <AbsoluteFill style={{ opacity: out * ap }}>
      <div style={{ position: 'absolute', left: 74, top: 590, width: 846, fontFamily: KO, color: INK }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 48, letterSpacing: -1.2 }}>
          <span>10월 21일</span>
          <span style={{ opacity: done }}>11월 15일</span>
        </div>
        <div style={{ position: 'relative', height: 68, marginTop: 14, borderRadius: 34, background: 'rgba(14,15,18,0.08)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${grow * 100}%`, borderRadius: 34, background: INK, display: 'flex', alignItems: 'center', paddingLeft: 30, boxSizing: 'border-box', color: '#fff', fontWeight: 800, fontSize: 40, letterSpacing: -1, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            한 대화 · 26일째 이어 씀
          </div>
        </div>
      </div>
      {stacks.map((b, i) => {
        const p = prog(f, F(b.at), 5);
        if (p <= 0) return null;
        const hot = i === 2;
        const h = (b.v / BEFORE_IN) * MAXH * p;
        const x = 74 + i * 290;
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: x, top: bottom - h - 150, width: 270, fontFamily: KO, color: INK, opacity: Math.min(1, p * 2), whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: -1, color: GRAY }}>{b.label}</div>
              <div style={{ fontWeight: 900, fontSize: hot ? 82 : 66, letterSpacing: -2.6, lineHeight: 1.1, transform: `scale(${1 + 0.16 * (hot ? slam : 0)})`, transformOrigin: '0 80%' }}>{`${(b.v / 10000).toFixed(1)}만`}</div>
            </div>
            <MiniStack x={x} bottom={bottom} h={h} w={250} hot={hot} />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/** 요약 한 장(검은 종이). */
const SummarySheet: React.FC<{ top: number; o: number; left?: number }> = ({ top, o, left = 190 }) => (
  <div style={{ position: 'absolute', left, top, width: SHEET_W, opacity: o, fontFamily: KO }}>
    <div style={{ background: INK, color: '#fff', borderRadius: 14, height: 96, display: 'flex', alignItems: 'center', gap: 22, padding: '0 30px', boxShadow: '0 16px 30px rgba(0,0,0,0.25)' }}>
      <div style={{ fontWeight: 900, fontSize: 52, letterSpacing: -1.4 }}>요약</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 10, width: '90%', borderRadius: 5, background: 'rgba(255,255,255,0.5)' }} />
        <div style={{ height: 10, width: '60%', borderRadius: 5, background: 'rgba(255,255,255,0.35)' }} />
      </div>
    </div>
  </div>
);

/** 14.6~18.3초 — 탑이 눌려 「요약」 한 장이 되고, 규칙 칩 둘. */
const Squash: React.FC<{ f: number }> = ({ f }) => {
  if (!win(f, T.fix, T.two)) return null;
  const out = fadeOut(f, T.two);
  const ap = prog(f, F(T.fix), 8);
  const sq = prog(f, F(T.squash), 12, IN_OUT);
  const slam = slamAt(f, T.squash + 0.4, 8);
  const c1 = prog(f, F(T.chip1), 7);
  const c2 = prog(f, F(T.chip2), 7);
  const keep = 3;
  return (
    <AbsoluteFill style={{ opacity: out * ap }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `translateY(${slam * 8}px)` }}>
        {Array.from({ length: N }, (_, i) => {
          const fromY = 976 + (N - 1 - i) * 34;
          const k = Math.max(0, i - (N - keep));
          const toY = 1500 - (k + 1) * PITCH;
          const gone = i < N - keep ? sq : 0;
          const y = i >= N - keep ? mix(fromY, toY, sq) : mix(fromY, 1510, sq);
          return (
            <div key={i} style={{ position: 'absolute', left: 0, top: y, width: 1080, opacity: 1 - gone, transform: `scaleY(${mix(1, 0.2, gone)})` }}>
              <Sheet i={i} read={0} band={0} />
            </div>
          );
        })}
        <SummarySheet top={mix(1580, 1500 - (keep + 1) * PITCH - 30, sq)} o={sq} />
      </div>
      <TopFade o={1 - sq} />
      <div style={{ position: 'absolute', left: 74, top: 580, fontFamily: KO, color: INK, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[
          { p: c1, t: '① 길어지면 요약해서 줄이기' },
          { p: c2, t: '② 그림은 열지 말라고 적기' },
        ].map((c, i) => (
          <div key={i} style={{ opacity: c.p, transform: `translateX(${(1 - c.p) * 30}px)`, background: '#fff', borderRadius: 20, padding: '18px 30px', fontWeight: 800, fontSize: 58, letterSpacing: -1.6, whiteSpace: 'nowrap', boxShadow: '0 12px 26px rgba(40,30,0,0.12)', alignSelf: 'flex-start' }}>{c.t}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 18.3~22.2초 — 두 탑: 많을 때 53만 · 고친 뒤 요약하고 나서 4.4만. */
const Two: React.FC<{ f: number }> = ({ f }) => {
  if (!win(f, T.two, T.but)) return null;
  const out = fadeOut(f, T.but);
  const ap = prog(f, F(T.two), 8);
  const g = prog(f, F(T.grow), 10);
  const num = prog(f, F(T.num), 4);
  const slam = slamAt(f, T.num);
  const push = prog(f, F(T.push2), 14, IN_OUT);
  const scan = prog(f, F(18.7), F(1.0), (x) => x);
  const lab = prog(f, F(T.grow), 6);
  const count = Math.round(AFTER_IN * prog(f, F(T.grow), F(T.num) - F(T.grow), (x) => x));
  const H = 540;
  const bottom = 1410;
  return (
    <AbsoluteFill style={{ opacity: out * ap, transform: `scale(${mix(1, 1.08, push)})`, transformOrigin: '72% 80%' }}>
      <div style={{ position: 'absolute', left: 74, top: 600, width: 420, fontFamily: KO, color: INK }}>
        <div style={{ fontWeight: 800, fontSize: 46, letterSpacing: -1.2, color: GRAY }}>많을 때</div>
        <div style={{ fontWeight: 900, fontSize: 110, letterSpacing: -4, lineHeight: 1.05 }}>53만</div>
      </div>
      <MiniStack x={90} bottom={bottom} h={H * prog(f, F(T.two), 12)} w={330} />
      {/* 왼쪽 탑을 맨 아래부터 다시 훑는 띠(고치기 전 — 게시물마다 이만큼) */}
      {scan > 0 && scan < 1 ? <div style={{ position: 'absolute', left: 80, top: bottom - H * scan - 20, width: 350, height: 40, borderRadius: 10, background: 'rgba(245,196,69,0.8)' }} /> : null}
      <div style={{ position: 'absolute', left: 520, top: 1000, width: 400, fontFamily: KO, color: INK, opacity: lab }}>
        <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: -1.2, color: GRAY, whiteSpace: 'nowrap', marginBottom: 14 }}>고친 뒤 · 요약하고 나서</div>
        <div style={{ fontWeight: 900, fontSize: 132, letterSpacing: -5, lineHeight: 1.05, display: 'inline-block', background: num > 0 ? BUTTER : 'rgba(14,15,18,0.08)', borderRadius: 16, padding: '0 14px', transform: `scale(${1 + 0.1 * slam})`, transformOrigin: '10% 100%', fontVariantNumeric: 'tabular-nums' }}>{num > 0 ? '4.4만' : `${(count / 10000).toFixed(1)}만`}</div>
      </div>
      <MiniStack x={560} bottom={bottom} h={Math.max(30, H * (AFTER_IN / BEFORE_IN)) * g} w={330} dark />
      <Note f={f} f0={T.num + 0.2} f1={T.but} top={1210} left={540} text="11월 16일 새벽 · 한 건" size={40} />
    </AbsoluteFill>
  );
};

/** 22.2~23.9초 — 「그런데」: 적어 둔 규칙 ②가 흔들리고, AI 비서가 「대화에 남은 옛 규칙대로」. */
const But: React.FC<{ f: number }> = ({ f }) => {
  if (!win(f, T.but, T.grid)) return null;
  const out = fadeOut(f, T.grid);
  const ap = prog(f, F(T.but), 8);
  const shake = f >= F(23.0) && f < F(23.0) + 10 ? Math.sin((f - F(23.0)) * 2.2) * 10 * (1 - (f - F(23.0)) / 10) : 0;
  return (
    <AbsoluteFill style={{ opacity: out * ap }}>
      <div style={{ position: 'absolute', left: 74, top: 640, fontFamily: KO, color: INK, transform: `translateX(${shake}px)` }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '18px 30px', fontWeight: 800, fontSize: 58, letterSpacing: -1.6, whiteSpace: 'nowrap', boxShadow: '0 12px 26px rgba(40,30,0,0.12)', display: 'inline-block' }}>② 그림은 열지 말라고 적기</div>
        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: INK, color: '#fff', fontWeight: 900, fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>AI</div>
          <div style={{ background: '#E7E4DC', borderRadius: '8px 30px 30px 30px', padding: '22px 30px', fontWeight: 800, fontSize: 50, letterSpacing: -1.2, whiteSpace: 'nowrap', opacity: prog(f, F(22.9), 8) }}>대화에 남은 옛 규칙대로</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 23.9~26.3초 — 받은 그림 일곱 장을 또 열었다. */
const Reopen: React.FC<{ f: number }> = ({ f }) => {
  if (!win(f, T.grid, T.rule3)) return null;
  const out = fadeOut(f, T.rule3);
  const ap = prog(f, F(T.grid), 8);
  const all = slamAt(f, T.allOpen, 10);
  return (
    <AbsoluteFill style={{ opacity: out * ap }}>
      <div style={{ position: 'absolute', left: 74, top: 590, fontFamily: KO, fontWeight: 800, fontSize: 50, letterSpacing: -1.2, color: INK }}>받은 그림 일곱 장</div>
      {Array.from({ length: REOPENED }, (_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 74 + col * 290 + (row === 2 ? 290 : 0);
        const y = 680 + row * 250;
        const o = prog(f, F(T.open) + i * 3, 6);
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, width: 266, height: 220, borderRadius: 22, background: o > 0 ? '#2A2C31' : '#D9D5CC', transform: `rotate(${[-3, 2, -1, 3, -2, 1, -3][i]}deg) scale(${mix(0.9, 1, o) + 0.06 * all})`, boxShadow: '0 12px 24px rgba(40,30,0,0.16)', overflow: 'hidden' }}>
            <svg viewBox="0 0 92 76" width={266} height={220} style={{ display: 'block' }} preserveAspectRatio="none">
              <circle cx={68} cy={22} r={9} fill={o > 0 ? BUTTER : 'rgba(255,255,255,0.7)'} />
              <path d="M0 76 L30 36 L50 56 L64 44 L92 76 Z" fill={o > 0 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.6)'} />
            </svg>
            {o > 0 ? (
              <div style={{ position: 'absolute', right: 14, top: 14, width: 64, height: 64, borderRadius: 32, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: o, transform: `scale(${mix(1.6, 1, o)})` }}>
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx={12} cy={12} r={3} />
                </svg>
              </div>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 26.3~27.5초 — ③ 받을 때마다 규칙 파일부터(도장). 27.5~30초 — 저장할 한 장. */
const Rules: React.FC<{ f: number }> = ({ f }) => {
  if (!win(f, T.rule3, T.end)) return null;
  const out = fadeOut(f, T.end);
  const ap = prog(f, F(T.rule3), 8);
  const st = prog(f, F(26.6), 6);
  const sv = prog(f, F(T.save), 10, IN_OUT);
  const u3 = prog(f, F(T.save2), 12);
  const rows = ['길어지면 요약해서 줄이기', '그림은 열지 말라고 적기', '받으면 규칙 파일부터 읽기'];
  return (
    <AbsoluteFill style={{ opacity: out * ap }}>
      <div style={{ position: 'absolute', left: 74, width: 846, top: mix(700, 600, sv), fontFamily: KO, color: INK }}>
        <div style={{ background: '#fff', borderRadius: 30, padding: '40px 44px 46px', boxShadow: '0 26px 60px rgba(40,30,0,0.16)', position: 'relative' }}>
          <div style={{ fontWeight: 800, fontSize: 46, letterSpacing: -1.2, color: GRAY, height: mix(0, 64, sv), opacity: sv, overflow: 'hidden', whiteSpace: 'nowrap' }}>AI 비서 대화 · 이렇게 줄였다</div>
          {rows.map((r, i) => {
            const show = i === 2 ? 1 : sv;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: i === 2 && sv < 0.5 ? 0 : mix(0, 26, sv), height: i === 2 ? undefined : mix(0, 86, sv), opacity: show, overflow: 'hidden', fontWeight: 900, fontSize: 56, letterSpacing: -2, whiteSpace: 'nowrap', alignItems: 'center' }}>
                <span style={{ color: GRAY, fontWeight: 800 }}>{['①', '②', '③'][i]}</span>
                {i === 2 ? <U p={Math.max(st * (1 - sv), u3)}>{r}</U> : r}
                <span style={{ marginLeft: 'auto', flex: 'none', width: 48, height: 48, borderRadius: 24, background: INK, color: '#fff', fontSize: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: prog(f, F([28.2, 28.75, T.save2][i]), 4), transform: `scale(${mix(1.6, 1, prog(f, F([28.2, 28.75, T.save2][i]), 5))})`, alignSelf: 'center' }}>✓</span>
              </div>
            );
          })}
          <div style={{ position: 'absolute', right: 36, top: -40, opacity: st * (1 - sv), transform: `rotate(-8deg) scale(${mix(1.8, 1, st)})`, background: BUTTER, color: INK, fontWeight: 900, fontSize: 56, letterSpacing: -1.4, borderRadius: 14, padding: '6px 22px', whiteSpace: 'nowrap' }}>한 줄 더</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 30.05초~끝 — 핵심 장면을 다시: 맨 아래부터 빠르게 훑고, 탑이 눌려 「요약」 한 장이 되어 새 대화 창으로 들어간다. */
const End: React.FC<{ f: number }> = ({ f }) => {
  if (f < F(T.end)) return null;
  const t = (f - F(T.end)) / FPS;
  const scanLen = T.endSquash - T.end - 0.25;
  const s = Math.min(N, (t / scanLen) * N);
  const pan = followPan(Math.min(N - 1, s));
  const sq = prog(f, F(T.endSquash), 12, IN_OUT);
  const mv = prog(f, F(T.newChat), 18, IN_OUT);
  const win2 = prog(f, F(T.newChat) - 6, 10);
  const punch = slamAt(f, T.punch, 12);
  const push = mix(1, 1.04, prog(f, F(T.newChat), F(LEN - T.newChat), (x) => x));
  const blink = Math.floor((f - F(T.punch)) / 15) % 2 === 0 ? 1 : 0.15;
  const sumTop = mix(1100, 1010, mv);
  const sumLeft = mix(190, 110, mv);
  return (
    <AbsoluteFill style={{ opacity: prog(f, F(T.end), 6) }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - sq, transform: `scaleY(${mix(1, 0.35, sq)})`, transformOrigin: '50% 100%' }}>
        <Tower pan={mix(pan, 0, sq)} s={s} />
      </div>
      <TopFade o={1 - sq} />
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 62%' }}>
        <div style={{ position: 'absolute', left: 74, top: 820, width: 932, height: 600, borderRadius: 36, background: '#fff', boxShadow: '0 30px 70px rgba(40,30,0,0.18)', opacity: win2, transform: `translateY(${(1 - win2) * 60}px) scale(${mix(0.96, 1, win2)})`, fontFamily: KO, overflow: 'hidden' }}>
          <div style={{ height: 120, display: 'flex', alignItems: 'center', gap: 20, padding: '0 40px', borderBottom: '2px solid rgba(14,15,18,0.08)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: INK, color: '#fff', fontWeight: 900, fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>AI</div>
            <div style={{ fontWeight: 900, fontSize: 60, letterSpacing: -1.8, color: INK }}>새 대화</div>
          </div>
          <div style={{ position: 'absolute', left: 40, right: 40, bottom: 40, height: 92, borderRadius: 46, background: '#F1EFE9', display: 'flex', alignItems: 'center', padding: '0 34px', opacity: prog(f, F(T.punch) - 4, 8) }}>
            <div style={{ width: 4, height: 46, background: INK, opacity: blink }} />
            <div style={{ flex: 1 }} />
            <div style={{ width: 64, height: 64, borderRadius: 32, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: sumLeft, top: sumTop, width: mix(SHEET_W, 860, mv), opacity: sq, transform: `scale(${1 + 0.05 * punch})`, transformOrigin: '50% 50%' }}>
          <div style={{ background: INK, color: '#fff', borderRadius: 18, height: 120, display: 'flex', alignItems: 'center', gap: 24, padding: '0 34px', boxShadow: `0 16px 30px rgba(0,0,0,0.25), 0 0 0 ${mix(0, 6, mv)}px ${BUTTER}`, fontFamily: KO }}>
            <div style={{ fontWeight: 900, fontSize: 60, letterSpacing: -1.6 }}>요약</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ height: 12, width: '92%', borderRadius: 6, background: 'rgba(255,255,255,0.5)' }} />
              <div style={{ height: 12, width: '64%', borderRadius: 6, background: 'rgba(255,255,255,0.35)' }} />
            </div>
          </div>
        </div>
        {[0, 1, 2].map((k) => (
          <div key={k} style={{ position: 'absolute', left: 0, top: 1210 + k * PITCH, width: 1080, opacity: sq * (1 - mv) }}>
            <Sheet i={N - 1 - k} read={0} band={0} />
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 장면마다 천천히 흐름(멈춘 화면 막기) — 구간마다 22px 아래로. */
const CUTS = [0, T.tags, T.read, T.line, T.fix, T.two, T.but, T.grid, T.rule3, T.end, LEN];
const driftY = (t: number) => {
  for (let i = 1; i < CUTS.length; i++) if (t < CUTS[i]) return 22 * (t - CUTS[i - 1]) / (CUTS[i] - CUTS[i - 1]);
  return 22;
};
/** 원본 박자 자리의 짧은 당김(0.2초). */
const BUMPS = [T.bill, T.tag, 8.48, 9.62, T.line2, 12.44, T.bar3, T.squash, T.chip1, T.chip2, T.num, T.allOpen, T.save2, T.punch];
const bumpAt = (t: number) => BUMPS.reduce((m, b) => Math.max(m, t >= b && t < b + 0.2 ? 1 - (t - b) / 0.2 : 0), 0);

export const Film: React.FC<{ bgm: boolean; voice: boolean }> = ({ bgm, voice }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const readT = t - T.read;
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Backdrop f={f} />
      <AbsoluteFill style={{ transform: `translateY(${driftY(t)}px) scale(${1 + 0.04 * bumpAt(t)})`, transformOrigin: '50% 62%' }}>
      <Hook f={f} />
      <Tags f={f} />
      {win(f, T.read, T.line) ? (
        <AbsoluteFill style={{ opacity: prog(f, F(T.read), 5) * fadeOut(f, T.line) }}>
          <ReadScene t={Math.min(readT, READ.len)} showCounter counterTop={560} />
        </AbsoluteFill>
      ) : null}
      <Line f={f} />
      <Squash f={f} />
      <Two f={f} />
      <But f={f} />
      <Reopen f={f} />
      <Rules f={f} />
      <End f={f} />
      </AbsoluteFill>

      <Head f={f} from={0} to={T.tags} size={80} lines={[{ at: 0, node: <>AI 비서한테</> }, { at: 0, node: <>SNS 게시물 하나 보냈는데</> }]} />
      <Head f={f} from={T.tags} to={T.read} lines={[{ at: T.tags, node: <>한 번만</> }, { at: T.tags2, node: <>그런 게 아니었다</> }]} />
      <Head f={f} from={T.read} to={T.line} lines={[{ at: T.read, node: <>받을 때마다</> }, { at: 8.1, node: <>처음부터 <U p={prog(f, F(8.6), 12)}>다시 읽었다</U></> }]} />
      <Head f={f} from={T.line} to={T.bars} lines={[{ at: T.line, node: <>몇 주째</> }, { at: T.line, node: <>한 대화를 이어 썼다</> }]} />
      <Head f={f} from={T.bars} to={T.fix} lines={[{ at: T.bars, node: <>많을 땐 한 번에</> }, { at: 13.0, node: <>53만 토큰</> }]} />
      <Head f={f} from={T.fix} to={T.two} lines={[{ at: T.fix, node: <>그래서</> }, { at: T.squash, node: <>규칙을 바꿨다</> }]} />
      <Head f={f} from={T.two} to={T.but} lines={[{ at: T.two, node: <>고친 뒤 첫 게시물</> }, { at: T.num, node: <>요약하고 나니 4만대</> }]} />
      <Head f={f} from={T.but} to={T.rule3} size={90} lines={[{ at: T.but, node: <>그런데 옛 규칙대로</> }, { at: T.open, node: <>그림을 또 열었다</> }]} />
      <Head f={f} from={T.rule3} to={T.end} lines={[{ at: T.rule3, node: <>받을 때마다</> }, { at: 27.4, node: <>규칙 파일부터 다시</> }]} />
      <Head f={f} from={T.end} to={T.endSquash} lines={[{ at: T.end, node: <>AI는 한 줄마다</> }, { at: 31.6, node: <>처음부터 다시 읽는다</> }]} />
      <Head f={f} from={T.endSquash} to={LEN + 1} size={104} lines={[{ at: T.endSquash, node: <>길어졌으면</> }, { at: 33.4, node: <>요약해서 <U p={prog(f, F(34.2), 12)}>새 대화로</U></> }]} />

      <Note f={f} f0={T.tag + 0.1} f1={T.tags} top={1300} text="API 요금으로 센 값 · 11월 15일 밤" size={46} />
      <Note f={f} f0={T.tags + 0.2} f1={T.read} top={1300} text="게시물 다섯 건 · API 요금으로 센 값" size={46} />
      <Note f={f} f0={6.3} f1={T.line} top={1330} dark text="토큰 = AI가 읽는 글 조각" size={50} />
      <Note f={f} f0={15.5} f1={T.two} top={850} dark text="규칙 = 비서에게 적어 둔 일하는 법" size={46} />

      {voice ? VO.map((v) => <Sequence key={v.id} from={F(v.at)}><Audio src={staticFile(`vo/${v.id}.wav`)} /></Sequence>) : null}
      {bgm ? <Audio src={staticFile('bgm.wav')} volume={(x) => (x < F(0.4) ? mix(0.12, BGM, x / F(0.4)) : x > F(LEN) - F(1.0) ? mix(BGM, 0, (x - (F(LEN) - F(1.0))) / F(1.0)) : BGM)} /> : null}
      {SFX.map((s, i) => <Sequence key={i} from={F(s.at)}><Audio src={staticFile(`sfx/${s.id}.wav`)} volume={s.vol} /></Sequence>)}
    </AbsoluteFill>
  );
};
