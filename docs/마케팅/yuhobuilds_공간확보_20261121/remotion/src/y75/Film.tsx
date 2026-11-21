// Y75 본편 — AI한테 「공간 확보해 줘」를 맡겼더니 52.6GB를 비웠는데, 그 안에 내가 고른 작품 세 편의 작업 파일 1,046개(7.35GB)가 섞여
// PC에서 내려가 클라우드에만 남았다 → 폴더마다 남은 옮긴 목록 → 폴더마다 되살리는 명령 한 줄로 1,046개를 되살림(빠진 파일 0) → 되살리고도 35GB 넘게 비움.
// 사실 검수(11-21 · Opus 5.5)로 「완성작 1,046개」 → 「작품 3편의 작업 파일 1,046개」, 28곳 다시 셈은 영상에서 빼고 캡션으로, 끝은 「35GB 넘게 비우고 작품 3편은 지켰다」.
// 원본(9d0jOC4JUkA)의 뼈대 — 경고 훅 → 약속 → 큰 숫자 1 · 2 · 3 → 끝 — 에 붙일 말 세 마디를 얹는다.
// 화면 결: 위 큰 글자가 곧 말 · 흰 글 + 버터 한 곳(내가 고른 완성작 줄) · SUIT 하나. 진행자 컷 없음(Y73 등과 같은 까닭).
// 무대는 짙은 남색(지난 두 편 Y51 따뜻한 먹색 · Y73 밝은 종이와 다름). 실제 화면은 탐색기 창 한 컷(public/real/films_가림.png).
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO, MONO } from '../lib/fonts';
import { clamp, IN_OUT, OUT } from '../lib/motion';
import { BUNDLES, BUTTER, DARK, INK, NOTE_SIZES, PAPER, rnd, STAGE, STAGE_HI, SUB } from './data';
import { BGM, LEN, SFX, T, VO } from './timeline';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.24) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
const ease = (t: number, a: number, len: number) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: IN_OUT });

// ───────────────────────── 부품 ─────────────────────────

/** 글자 폭 어림(em) — 위 큰 글이 안전선(x 82~918)을 넘지 않게 크기를 줄인다. */
const emWidth = (s: string) =>
  [...s].reduce((w, c) => w + (/[가-힣]/.test(c) ? 0.94 : c === ' ' ? 0.28 : /[0-9]/.test(c) ? 0.6 : /[A-Z]/.test(c) ? 0.68 : /[a-z]/.test(c) ? 0.56 : 0.34), 0);
const textOf = (n: React.ReactNode): string => (typeof n === 'string' ? n : React.isValidElement(n) ? textOf((n.props as { children?: React.ReactNode }).children) : Array.isArray(n) ? n.map(textOf).join('') : '');

type Line = { at: number; until?: number; node: React.ReactNode; size?: number; color?: string };
export const Head: React.FC<{ t: number; lines: Line[]; top?: number }> = ({ t, lines, top = 282 }) => (
  <div style={{ position: 'absolute', left: 82, width: 836, top, fontFamily: KO, fontWeight: 800, lineHeight: 1.14, letterSpacing: -2.4 }}>
    {lines
      .filter((l) => t >= l.at - 0.001 && (l.until === undefined || t < l.until))
      .map((l, i) => {
        const p = l.at <= 0 ? 1 : appear(t, l.at, 0.22);
        const want = l.size ?? 104;
        const size = Math.min(want, Math.floor(820 / Math.max(1, emWidth(textOf(l.node)))));
        return (
          <div key={i} style={{ fontSize: size, color: l.color ?? INK, opacity: p, transform: `translateY(${(1 - p) * 28}px)`, whiteSpace: 'nowrap' }}>
            {l.node}
          </div>
        );
      })}
  </div>
);

/** 낱말 뒤 버터 형광(왼쪽에서 오른쪽으로). dark면 글을 짙게. */
const Mark: React.FC<{ children: React.ReactNode; p: number; dark?: boolean }> = ({ children, p, dark }) => (
  <span style={{ backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 100%', backgroundSize: `${p * 100}% 0.12em`, padding: '0 0.04em 0.1em', color: dark ? DARK : undefined }}>{children}</span>
);

/** 비운 네 묶음 — 이름 · 크기 · 크기만큼의 막대. dim: 넷째 말고 흐리게(0~1), frame: 넷째 둘레 테(0~1). */
const BUNDLE_TOP = 610;
const BUNDLE_GAP = 178;
const Bundles: React.FC<{ t: number; at: number[]; total?: number; dim?: number; frame?: number; gb4?: number; totalText?: string }> = ({ t, at, total, dim = 0, frame = 0, gb4, totalText = '= 52.6GB' }) => {
  const sp = total === undefined ? 0 : appear(t, total, 0.3);
  return (
    <>
      {BUNDLES.map((b, i) => {
        const p = at[i] <= 0 ? 1 : appear(t, at[i], 0.26);
        if (p <= 0) return null;
        const y = BUNDLE_TOP + i * BUNDLE_GAP;
        const grow = interpolate(t, [at[i], at[i] + 0.45], [0, 1], { ...clamp, easing: OUT });
        const op = p * (i < 3 ? 1 - 0.72 * dim : 1);
        const gb = i === 3 && gb4 !== undefined ? gb4 : b.gb;
        return (
          <div key={i} style={{ position: 'absolute', left: 0, top: y, width: 1080, opacity: op, transform: `translateX(${(1 - p) * -50}px)` }}>
            <div style={{ position: 'absolute', left: 82, top: 0, fontFamily: KO, fontWeight: 700, fontSize: 50, color: INK, letterSpacing: -1 }}>{b.label}</div>
            <div style={{ position: 'absolute', right: 1080 - 900, top: -6, fontFamily: KO, fontWeight: 800, fontSize: 62, color: INK, letterSpacing: -1 }}>{gb.toFixed(2).replace(/\.?0+$/, '')}GB</div>
            <div style={{ position: 'absolute', left: 82, top: 84, height: 40, width: 818 * (gb / 20.97) * grow, borderRadius: 20, background: '#DCE3EC' }} />
          </div>
        );
      })}
      {frame > 0 && (
        <div style={{ position: 'absolute', left: 58, top: BUNDLE_TOP + 3 * BUNDLE_GAP - 26, width: 964, height: 172, borderRadius: 24, border: `6px solid ${BUTTER}`, opacity: frame, transform: `scale(${1 + 0.06 * (1 - frame)})` }} />
      )}
      {sp > 0 && (
        <>
          <div style={{ position: 'absolute', left: 82, top: 1300, width: 818 * sp, height: 4, background: 'rgba(244,241,234,0.45)' }} />
          <div style={{ position: 'absolute', right: 1080 - 900, top: 1318, fontFamily: KO, fontWeight: 900, fontSize: 84, color: INK, opacity: sp, letterSpacing: -2, transform: `translateY(${(1 - sp) * 20}px)` }}>{totalText}</div>
        </>
      )}
    </>
  );
};

/** 큰 숫자(원본의 1 · 2 · 3 칸). */
const Numeral: React.FC<{ t: number; at: number; n: string; top?: number; size?: number }> = ({ t, at, n, top = 380, size = 1000 }) => {
  const p = appear(t, at, 0.28);
  const s = 1.22 - 0.22 * p + 0.03 * interpolate(t, [at, at + 0.9], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, top, width: 1080, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: size, lineHeight: 1, color: BUTTER, opacity: Math.min(1, p * 1.4), transform: `scale(${s})`, letterSpacing: -20 }}>{n}</div>
  );
};

/**
 * 파일 줄 목록(넷째 묶음 「오래된 영상 · 그림 · 소리」를 펼친 것). 줄 막대는 파일 하나하나의 자리(이름은 그리지 않는다).
 * scroll = 위로 민 픽셀, band = 노란 줄이 열린 정도(0~1), bandY = 노란 줄이 제자리에서 위로 떠난 픽셀(+면 위로), slot = 빈 자리 테 불투명도,
 * right = 노란 줄 오른쪽 글.
 */
const PANEL = { x: 70, y: 600, w: 940, h: 820 };
const BAND_Y = 430; // 판 안 노란 줄 가운데
const Wall: React.FC<{ t: number; scroll: number; band: number; bandY?: number; slot?: number; right?: React.ReactNode; enter?: number; glow?: number; text?: number }> = ({ t, scroll, band, bandY = 0, slot = 0, right = '1,046개', enter = 1, glow = 0, text }) => {
  const rows = [];
  const open = band * 86; // 노란 줄이 들어갈 틈(위 · 아래로 벌어짐)
  for (let i = 0; i < 46; i++) {
    let y = 120 + i * 48 - scroll;
    if (y < BAND_Y) y -= open;
    else y += open;
    if (y < 96 || y > PANEL.h + 10) continue;
    const r = rnd(i);
    rows.push(
      <div key={i} style={{ position: 'absolute', left: 0, top: y, width: PANEL.w, height: 40 }}>
        <div style={{ position: 'absolute', left: 36, top: 4, width: 26, height: 32, borderRadius: 5, border: '2px solid rgba(244,241,234,0.55)' }} />
        <div style={{ position: 'absolute', left: 82, top: 12, width: 250 + 380 * r, height: 18, borderRadius: 9, background: 'rgba(244,241,234,0.36)' }} />
        <div style={{ position: 'absolute', left: 760, top: 12, width: 44 + 44 * rnd(i + 99), height: 18, borderRadius: 9, background: 'rgba(244,241,234,0.24)' }} />
      </div>,
    );
  }
  const bh = 172 * band;
  const g = 1 + 0.06 * glow;
  const tx = text ?? interpolate(band, [0.8, 1], [0, 1], clamp); // 글은 줄이 다 열린 뒤에(열리는 동안 잘린 글이 보이지 않게)
  return (
    <div style={{ position: 'absolute', left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, borderRadius: 30, overflow: 'hidden', background: 'rgba(244,241,234,0.045)', border: '2px solid rgba(244,241,234,0.1)', opacity: enter, transform: `translateY(${(1 - enter) * 40}px)` }}>
      <div style={{ position: 'absolute', left: 36, top: 28, fontFamily: KO, fontWeight: 700, fontSize: 44, color: INK, letterSpacing: -1 }}>오래된 영상 · 그림 · 소리</div>
      <div style={{ position: 'absolute', right: 92, top: 28, fontFamily: KO, fontWeight: 700, fontSize: 44, color: SUB, letterSpacing: -1 }}>20.97GB</div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: PANEL.w, height: PANEL.h }}>{rows}</div>
      {slot > 0 && (
        <div style={{ position: 'absolute', left: 20, top: BAND_Y - 86, width: PANEL.w - 40, height: 172, borderRadius: 22, border: `4px dashed rgba(245,196,69,${0.75 * slot})` }} />
      )}
      {band > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 100, width: PANEL.w, height: PANEL.h - 100, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 20, top: BAND_Y - bh / 2 - bandY - 100, width: PANEL.w - 40, height: bh, borderRadius: 22, background: BUTTER, overflow: 'hidden', opacity: 1 - interpolate(bandY, [90, 560], [0, 1], clamp), boxShadow: `0 0 ${40 + 60 * glow}px rgba(245,196,69,${0.35 + 0.4 * glow})`, transform: `scale(${g})` }}>
          <div style={{ position: 'absolute', left: 36, top: 24, fontFamily: KO, fontWeight: 900, fontSize: 54, color: DARK, letterSpacing: -1.5, opacity: tx }}>내가 고른 작품 3편</div>
          <div style={{ position: 'absolute', left: 36, top: 100, fontFamily: KO, fontWeight: 700, fontSize: 36, color: DARK, letterSpacing: -0.8, opacity: tx * 0.85 }}>컷 그림 · 소리 · 테이크 파일</div>
          <div style={{ position: 'absolute', right: 80, top: 44, fontFamily: KO, fontWeight: 900, fontSize: 80, color: DARK, letterSpacing: -2.5, opacity: tx }}>{right}</div>
        </div>
        </div>
      )}
      {/* 판 위 · 아래 끝은 무대 쪽으로 흐려 줄이 잘린 자리를 감춘다 */}
      <div style={{ position: 'absolute', left: 0, top: 96, width: PANEL.w, height: 40, background: 'linear-gradient(rgba(19,30,46,1), rgba(19,30,46,0))' }} />
      <div style={{ position: 'absolute', left: 0, top: PANEL.h - 60, width: PANEL.w, height: 60, background: 'linear-gradient(rgba(19,30,46,0), rgba(19,30,46,1))' }} />
      {/* 같은 때 바뀌는 것이 있게 — 줄들이 아주 천천히 숨 쉰다 */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 4, height: 4, opacity: 0.01 * Math.sin(t) }} />
    </div>
  );
};

/** 실제 탐색기 창(영상 10개가 있던 폴더 — 안내 파일 하나만). push = 안내 줄 쪽으로 다가감(0~1), ul = 그 줄 밑줄. */
const Explorer: React.FC<{ t: number; at: number; push: number; ul: number }> = ({ t, at, push, ul }) => {
  const p = appear(t, at, 0.3);
  const W = 1040;
  const k = W / 1400;
  const s = 1 + 0.85 * push; // 창 그림 배율 0.74 × 1.85 ≈ 1.37 — 더 키우면 글자 화소가 뭉개진다(카본 맹검 03)
  // 다가갈 점: 안내 파일 줄(창 그림 좌표 380, 275)
  const fx = 450;
  const fy = 262;
  return (
    <div style={{ position: 'absolute', left: 20, top: 640, width: W, height: 900 * k, overflow: 'hidden', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.45)', opacity: p, transform: `translateY(${(1 - p) * 50}px)` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1400, height: 900, transform: `scale(${k}) translate(${push * (700 - fx * s)}px, ${push * (450 - fy * s)}px) scale(${s})`, transformOrigin: '0 0' }}>
        <Img src={staticFile('real/films_가림.png')} style={{ width: 1400, height: 900, display: 'block' }} />
        <div style={{ position: 'absolute', left: 300, top: 296, width: 165 * ul, height: 6, borderRadius: 3, background: BUTTER }} />
      </div>
    </div>
  );
};

/** 안내 파일을 크게 다시 짠 판 — 옮긴 파일 10개(크기는 그대로, 이름은 막대) · 「다시 쓰려면 → 되살리기」. */
const NoteCard: React.FC<{ t: number; at: number; chip?: number; stack?: number; drift?: number; count?: number }> = ({ t, at, chip = 0, stack = 0, drift = 0, count = 0 }) => {
  const p = appear(t, at, 0.3);
  const card = (dx: number, dy: number, rot: number, op: number, key: string, front: boolean) => (
    <div key={key} style={{ position: 'absolute', left: 82 + dx, top: 600 + dy, width: 916, height: 800, borderRadius: 26, background: PAPER, boxShadow: '0 24px 70px rgba(0,0,0,0.35)', opacity: op, transform: `rotate(${rot}deg) translateY(${-drift}px)` }}>
      {front && (
        <>
          <div style={{ position: 'absolute', left: 48, top: 40, fontFamily: KO, fontWeight: 900, fontSize: 54, color: DARK, letterSpacing: -1.5 }}>Drive로_옮긴_파일</div>
          <div style={{ position: 'absolute', left: 48, top: 112, fontFamily: KO, fontWeight: 600, fontSize: 36, color: '#6B6458', letterSpacing: -0.8 }}>이 폴더의 파일은 클라우드에만 둡니다</div>
          {count > 0 && (
            <div style={{ position: 'absolute', right: 120, top: 30, fontFamily: KO, fontWeight: 900, fontSize: 72, color: DARK, opacity: count, transform: `scale(${1.3 - 0.3 * count})`, letterSpacing: -2 }}>10개</div>
          )}
          {NOTE_SIZES.map((sz, i) => (
            <div key={i} style={{ position: 'absolute', left: 48, top: 186 + i * 48, width: 820, height: 40 }}>
              <div style={{ position: 'absolute', left: 0, top: 13, width: 230 + 300 * rnd(i + 7), height: 16, borderRadius: 8, background: '#D3CCBF' }} />
              <div style={{ position: 'absolute', right: 80, top: 0, fontFamily: KO, fontWeight: 700, fontSize: 36, color: DARK }}>{sz}</div>
            </div>
          ))}
          <div style={{ position: 'absolute', left: 32, top: 676, width: 852, height: 92, borderRadius: 18, background: chip > 0 ? `rgba(245,196,69,${chip})` : 'rgba(21,19,15,0.06)' }} />
          <div style={{ position: 'absolute', left: 64, top: 694, fontFamily: KO, fontWeight: 800, fontSize: 46, color: DARK, letterSpacing: -1 }}>되살리기 명령 한 줄 → PC로 다시 받기</div>
        </>
      )}
    </div>
  );
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
      {stack > 0 && card(-30 * stack, -46 * stack, -4 * stack, 0.55 * stack, 'b2', false)}
      {stack > 0 && card(26 * stack, -24 * stack, 3 * stack, 0.75 * stack, 'b1', false)}
      {card(0, 0, 0, 1, 'f', true)}
    </div>
  );
};

/** 저장할 한 장 — 정리 맡길 때 붙이는 세 마디. */
const SaveCard: React.FC<{ t: number }> = ({ t }) => {
  const c = appear(t, T.save, 0.3);
  const u = t - T.save;
  const up = ease(t, T.mark1, 0.4); // 28.9초 — 머리 글이 물러나고 카드가 위로(한 구성 4초 넘지 않게)
  const line = (at: number, n: string, a: React.ReactNode, top: number) => {
    const p = appear(t, at, 0.26);
    return (
      <div style={{ position: 'absolute', left: 44, top, width: 830, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
        <div style={{ position: 'absolute', left: 0, top: -6, fontFamily: KO, fontWeight: 900, fontSize: 84, color: DARK }}>{n}</div>
        <div style={{ position: 'absolute', left: 90, top: 0, width: 740, fontFamily: KO, fontWeight: 800, fontSize: 68, lineHeight: 1.18, color: DARK, letterSpacing: -1.8 }}>{a}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 82, top: 600 - 250 * up, width: 916, height: 700, borderRadius: 28, background: PAPER, boxShadow: '0 24px 70px rgba(0,0,0,0.35)', opacity: c, transformOrigin: '458px 0px', transform: `translateY(${(1 - c) * 50 - 30 * interpolate(u, [0, 3.7], [0, 1], clamp) - 24 * interpolate(t, [T.mark1 + 0.4, T.end], [0, 1], clamp)}px) scale(${1 + 0.04 * interpolate(u, [0, 3.7], [0, 1], clamp) + 0.06 * up})` }}>
        {line(T.L1, '1', <><Mark p={appear(t, T.mark1, 0.45)}>내가 고른 작업 목록과</Mark><br /><Mark p={appear(t, T.mark1 + 0.3, 0.4)}>겹치면 먼저 빼</Mark></>, 64)}
        {line(T.L2, '2', '옮긴 파일 목록을 남겨', 286)}
        {line(T.L3, '3', '되살리는 명령을 남겨', 426)}
        <div style={{ position: 'absolute', left: 44, top: 590, fontFamily: KO, fontWeight: 700, fontSize: 42, color: '#6B6458', opacity: appear(t, T.foot, 0.3), transform: `translateY(${(1 - appear(t, T.foot, 0.3)) * 16}px)` }}>정리를 맡길 때 그대로 붙여 넣기</div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── 장면 ─────────────────────────

/** 0~3.6초 — 「공간 확보해 줘」 · 비운 네 묶음 · 52.6GB. */
const OpenScene: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ transform: `scale(${1 + 0.02 * interpolate(t, [0, 3.6], [0, 1], clamp)}) translateY(${-46 * interpolate(t, [0, 3.6], [0, 1], clamp)}px)`, transformOrigin: '540px 900px' }}>
      <Bundles t={t} at={[0, T.b2, T.b3, T.b4]} total={T.total} />
    </AbsoluteFill>
    <Head
      t={t}
      lines={[
        { at: 0, until: T.total, node: 'AI한테', size: 96, color: SUB },
        { at: 0, until: T.total, node: '"공간 확보해 줘"', size: 112 },
        { at: T.total, node: '52.6GB를', size: 120 },
        { at: T.total + 0.12, node: '비웠는데…', size: 120 },
      ]}
    />
  </AbsoluteFill>
);

/** 4.4~12.3초 — 하나: 내가 고른 건 먼저 빼라고 · 노란 줄 · 클라우드로. */
const StepOne: React.FC<{ t: number }> = ({ t }) => {
  const toWall = t >= T.wall;
  const steps = 240 * ease(t, T.sc1, 0.3) + 240 * ease(t, T.sc2, 0.3);
  const scroll = 40 + 60 * interpolate(t, [T.wall, T.band], [0, 1], clamp) + steps;
  const band = ease(t, T.band - 0.2, 0.75);
  const lift = interpolate(t, [T.lift, T.lift + 1.1], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill>
      {!toWall && <Bundles t={t} at={[0, 0, 0, 0]} dim={appear(t, T.pick, 0.3)} frame={appear(t, T.pick, 0.3)} />}
      {toWall && <Wall t={t} scroll={scroll} band={band} bandY={lift * 760} slot={lift} enter={appear(t, T.wall, 0.3)} text={appear(t, T.band + 0.85, 0.3)} />}
      {t >= T.lift && (
        <div style={{ position: 'absolute', left: 82, top: 1300, fontFamily: KO, fontWeight: 800, fontSize: 54, color: BUTTER, opacity: appear(t, T.lift + 0.5, 0.3), letterSpacing: -1 }}>↑ 클라우드 보관함으로</div>
      )}
      <Head
        t={t}
        lines={[
          { at: T.s1, until: T.one, node: '그래서 이제 AI한테', size: 96, color: SUB },
          { at: T.s1, until: T.one, node: '세 마디를 붙여요', size: 110 },
          { at: T.one, until: VO[2].at, node: '하나,', size: 96, color: SUB },
          { at: T.one + 0.45, until: VO[2].at, node: '내가 고른 건 먼저 빼', size: 110 },
          { at: VO[2].at, until: VO[3].at, node: '내가 고른 작품 3편의', size: 96, color: SUB },
          { at: VO[2].at + 0.4, until: VO[3].at, node: '작업 파일이 섞였어요', size: 110 },
          { at: VO[3].at, node: 'PC에서는 사라지고', size: 96, color: SUB },
          { at: VO[3].at + 1.0, node: '클라우드에만', size: 120 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 13.1~19.1초 — 둘: 옮긴 목록을 남기라고 · 실제 탐색기 창 · 안내 파일 · 28곳 더. */
const StepTwo: React.FC<{ t: number }> = ({ t }) => {
  const push = interpolate(t, [T.real + 0.6, T.real + 2.0], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill>
      {t < T.real && <Wall t={t} scroll={316 + 30 * (t - T.n2)} band={0} slot={1} enter={appear(t, T.s2, 0.3)} />}
      {inWin(t, T.real, T.note) && (
        <>
          <Explorer t={t} at={T.real} push={push} ul={appear(t, T.real + 1.0, 0.4)} />
          <div style={{ position: 'absolute', left: 82, top: 1336, fontFamily: KO, fontWeight: 800, fontSize: 52, color: INK, opacity: appear(t, T.real + 0.4, 0.3), letterSpacing: -1 }}>영상 10개 자리에 남은 파일 하나</div>
        </>
      )}
      {t >= T.note && <div style={{ transform: `scale(${1 + 0.07 * interpolate(t, [T.note, T.n3], [0, 1], clamp)})`, transformOrigin: '540px 1000px' }}><NoteCard t={t} at={T.note} count={appear(t, T.more, 0.3)} drift={50 * interpolate(t, [T.note, T.n3], [0, 1], clamp)} /></div>}
      <Head
        t={t}
        lines={[
          { at: T.s2 - 0.5, until: VO[5].at, node: '둘,', size: 96, color: SUB },
          { at: T.s2 + 0.2, until: VO[5].at, node: '옮긴 목록을 남겨', size: 116 },
          { at: VO[5].at, node: '폴더마다', size: 96, color: SUB },
          { at: VO[5].at + 0.25, node: '뭐가 클라우드에 있는지', size: 104 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 19.6~25.2초 — 셋: 되살리는 명령도 남기라고 · 그 한 줄로 전부 · 빠진 파일 0개. */
const StepThree: React.FC<{ t: number }> = ({ t }) => {
  const drop = interpolate(t, [T.drop, T.drop + 0.7], [0, 1], { ...clamp, easing: OUT });
  return (
    <AbsoluteFill>
      {t < T.back && (
        // 둘째 마디의 안내 파일과 같은 화면이 되지 않게(최종본 검사 「같은 그림 두 번」), 안내 파일 맨 아래 줄만 한 장으로 크게.
        <div style={{ position: 'absolute', left: 82, top: 700, width: 916, height: 420, borderRadius: 30, background: PAPER, boxShadow: '0 24px 70px rgba(0,0,0,0.35)', opacity: appear(t, T.s3 - 0.3, 0.3), transform: `translateY(${(1 - appear(t, T.s3 - 0.3, 0.3)) * 50}px) scale(${1 + 0.1 * interpolate(t, [T.s3 - 0.3, T.back], [0, 1], clamp)})` }}>
          <div style={{ position: 'absolute', left: 48, top: 44, fontFamily: KO, fontWeight: 700, fontSize: 40, color: '#6B6458', letterSpacing: -0.8 }}>Drive로_옮긴_파일 속 되살리기 명령(경로는 가림)</div>
          <div style={{ position: 'absolute', left: 32, top: 118, width: 852, height: 130, borderRadius: 22, background: `rgba(245,196,69,${appear(t, T.chip, 0.3)})` }} />
          <div style={{ position: 'absolute', left: 64, top: 150, fontFamily: MONO, fontWeight: 500, fontSize: 58, color: DARK, letterSpacing: -1 }}>되살리기 "{'…' + String.fromCharCode(92) + 'films'}" --실행</div>
          <div style={{ position: 'absolute', left: 48, top: 290, fontFamily: KO, fontWeight: 800, fontSize: 56, color: DARK, letterSpacing: -1.5, opacity: appear(t, T.chip + 0.1, 0.3) }}>→ 클라우드에서 PC로 다시 받기</div>
        </div>
      )}
      {t >= T.back && (
        <Wall
          t={t}
          scroll={316 + 160 * interpolate(t, [T.back, T.save], [0, 1], clamp)}
          band={drop}
          bandY={(1 - drop) * 760}
          slot={1 - drop}
          right="1,046개"
          enter={appear(t, T.back, 0.3)}
          glow={appear(t, T.zero, 0.3) * (1 - appear(t, T.zero + 0.6, 0.6))}
        />
      )}
      {t >= T.drop + 0.5 && (
        <div style={{ position: 'absolute', left: 82, top: 1300, fontFamily: KO, fontWeight: 800, fontSize: 54, color: BUTTER, opacity: appear(t, T.drop + 0.5, 0.3), letterSpacing: -1 }}>↓ 다시 PC로</div>
      )}
      <Head
        t={t}
        lines={[
          { at: T.s3 - 0.4, until: VO[7].at, node: '셋,', size: 96, color: SUB },
          { at: T.s3, until: VO[7].at, node: '되살리는 명령도 남겨', size: 108 },
          { at: VO[7].at, until: T.zero, node: '폴더마다 한 줄씩', size: 96, color: SUB },
          { at: VO[7].at + 0.9, until: T.zero, node: '1,046개 다 되살림', size: 116 },
          { at: T.zero, node: '빠진 파일', size: 96, color: SUB },
          { at: T.zero + 0.08, node: '0개', size: 150 },
        ]}
      />
    </AbsoluteFill>
  );
};

/** 25.2~31.3초 — 저장할 한 장. */
const SaveScene: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill>
    <SaveCard t={t} />
    <Head
      t={t}
      lines={[
        { at: T.save, until: T.mark1, node: '정리 맡길 때', size: 96, color: SUB },
        { at: T.title, until: T.mark1, node: '붙일 세 마디', size: 120 },
      ]}
    />
  </AbsoluteFill>
);

/** 31.3초~ — 끝: 가장 센 장면의 노란 줄이 화면을 채우는 한 장 「내가 고른 작품 3편 · 1,046개」 — 31.3초 꺼진 판으로 놓이고 32.0초에 켜진다(원본 끝 자리).
 *  이해 시험(sonnet · haiku)이 「앞서 본 목록 반복 · 52.6과 35가 엇갈림」으로 흐지부지라 해서, 목록 대신 한 장 카드로 크게 두고 머리 글을 말 그대로 「되살리고도 35GB 넘게」로. */
const EndScene: React.FC<{ t: number }> = ({ t }) => {
  const on = 1;
  const c = appear(t, T.lit, 0.25);
  const z = 0.94 + 0.06 * c + 0.05 * ease(t, T.lit, 1.6) + 0.03 * appear(t, T.last, 0.3);
  const glow = Math.max(on * (1 - appear(t, T.lit + 0.3, 0.6)), appear(t, T.glow, 0.3) * (1 - 0.6 * appear(t, T.glow + 0.5, 0.8)));
  const stamp = appear(t, 33.6, 0.3); // 말 「작품 셋은 지켰어요」와 함께(카본 맹검 05 — 늦게 툭 뜸)
  const ink = on > 0.5 ? DARK : INK;
  if (t < T.lit) {
    // 31.3~32.0초: 처음의 비운 묶음 막대 — 넷째(20.97GB)가 되살린 만큼(작품 3편 7.35 + 28곳 8.49 + 밤 12곳 1.17) 줄어 3.96GB, 합 35.6GB
    const k = ease(t, T.end + 0.1, 0.55);
    const g4 = 20.97 - 17.01 * k;
    return (
      <AbsoluteFill style={{ transform: `translateY(${-20 * interpolate(t, [T.end, T.lit], [0, 1], clamp)}px)` }}>
        <Bundles t={t} at={[0, 0, 0, 0]} total={0} gb4={g4} totalText={`= ${(52.64 - 17.01 * k).toFixed(1)}GB`} />
        <Head t={t} lines={[{ at: T.end, node: '되살리고도 35GB 넘게 비우고', size: 92, color: SUB }]} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 82, top: 640, width: 916, height: 640, borderRadius: 36, opacity: c, transform: `translateY(${-30 * interpolate(t, [T.end, LEN], [0, 1], clamp)}px) scale(${z})`, transformOrigin: '540px 960px', background: on > 0 ? `rgba(245,196,69,${0.1 + 0.9 * on})` : 'rgba(244,241,234,0.08)', border: '2px solid rgba(244,241,234,0.14)', boxShadow: `0 0 ${60 + 80 * glow}px rgba(245,196,69,${0.15 + 0.45 * glow})` }}>
        <div style={{ position: 'absolute', left: 56, top: 52, fontFamily: KO, fontWeight: 900, fontSize: 74, color: ink, letterSpacing: -2 }}>내가 고른 작품 3편</div>
        <div style={{ position: 'absolute', left: 56, top: 148, fontFamily: KO, fontWeight: 700, fontSize: 44, color: ink, opacity: 0.8, letterSpacing: -1 }}>컷 그림 · 소리 · 테이크 파일</div>
        <div style={{ position: 'absolute', left: 50, top: 236, fontFamily: KO, fontWeight: 900, fontSize: 210, lineHeight: 1, color: ink, letterSpacing: -8 }}>1,046개</div>
        <div style={{ position: 'absolute', left: 56, top: 500, fontFamily: KO, fontWeight: 800, fontSize: 54, color: ink, letterSpacing: -1.2, opacity: stamp, transform: `translateY(${(1 - stamp) * 20}px)` }}>다시 PC로 · 빠진 파일 0개</div>
      </div>
      <Head
        t={t}
        lines={[
          { at: 0, node: '되살리고도 35GB 넘게 비우고', size: 92, color: SUB },
          { at: T.lit, node: <><Mark p={appear(t, 33.5, 0.45)}>작품 3편</Mark>은 지켰어요</>, size: 124 },
        ]}
      />
    </AbsoluteFill>
  );
};

export const Film: React.FC<{ bgm?: boolean; voice?: boolean }> = ({ bgm = true, voice = true }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 75% at ${50 + 8 * Math.sin(f / 90)}% ${46 + 5 * Math.cos(f / 110)}%, ${STAGE_HI} 0%, ${STAGE} 62%, #0A121D 100%)` }} />
      {inWin(t, T.open, T.n1) && <OpenScene t={t} />}
      {inWin(t, T.n1, T.s1) && (
        <>
          <Numeral t={t} at={T.n1} n="1" top={520} size={860} />
          <Head t={t} lines={[{ at: 0, node: '그래서 이제 AI한테', size: 96, color: SUB }, { at: 0, node: '세 마디를 붙여요', size: 110 }]} />
        </>
      )}
      {inWin(t, T.s1, T.n2) && <StepOne t={t} />}
      {inWin(t, T.n2, T.s2) && <Numeral t={t} at={T.n2} n="2" />}
      {inWin(t, T.s2, T.n3) && <StepTwo t={t} />}
      {inWin(t, T.n3, T.s3) && <Numeral t={t} at={T.n3} n="3" />}
      {inWin(t, T.s3, T.save) && <StepThree t={t} />}
      {inWin(t, T.save, T.end) && <SaveScene t={t} />}
      {t >= T.end && <EndScene t={t} />}
      {bgm && <Audio src={staticFile(BGM.file)} volume={(fr: number) => BGM.vol * interpolate(fr, [F(LEN - BGM.fadeOut), F(LEN)], [1, 0.25], clamp)} />}
      {voice &&
        VO.map((v) => (
          <Sequence key={v.id} from={F(v.at)}>
            <Audio src={staticFile(`vo/${v.id}.wav`)} />
          </Sequence>
        ))}
      {voice &&
        SFX.map((x, i) => (
          <Sequence key={i} from={F(x.at)}>
            <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={x.v} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

/** 한 장면 먼저(말 · 위 큰 글 없이) — 펼친 목록 속 한 줄이 노랗게 「내가 고른 완성작 1,046개」 → 위로 빠져나가 빈 자리. */
export const HERO_LEN = 6.0;
export const HeroScene: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  // 본편의 5.7~11.1초를 그대로(5.7 → 0)
  const u = t + T.wall;
  const steps = 240 * ease(u, T.sc1, 0.3) + 240 * ease(u, T.sc2, 0.3);
  const scroll = 40 + 60 * interpolate(u, [T.wall, T.band], [0, 1], clamp) + steps;
  const band = ease(u, T.band - 0.2, 0.75);
  const lift = interpolate(u, [T.lift, T.lift + 1.1], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 75% at 50% 46%, ${STAGE_HI} 0%, ${STAGE} 62%, #0A121D 100%)` }} />
      <AbsoluteFill style={{ transform: 'translateY(-120px)' }}>
        <Wall t={u} scroll={scroll} band={band} bandY={lift * 760} slot={lift} enter={appear(u, T.wall, 0.3)} text={appear(u, T.band + 0.85, 0.3)} />
      </AbsoluteFill>
      {[
        { file: 'swish', at: 0, v: 0.4 },
        { file: 'tick', at: T.sc1 - T.wall, v: 0.3 },
        { file: 'tick', at: T.sc2 - T.wall, v: 0.3 },
        { file: 'thud', at: T.band - T.wall, v: 0.7 },
        { file: 'swish', at: T.lift - T.wall, v: 0.45 },
      ].map((x, i) => (
        <Sequence key={i} from={F(x.at)}>
          <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
