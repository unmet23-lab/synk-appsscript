// LAB 21:00 노래 가사판(2026-11-11 v2, 리듬 한국어 준비안 「라」 줄).
// 화면 문법은 만족 사례 S16(관용구 퀴즈 Remotion 재구성판 — 「너무 훌륭한데?? 대박이다」)을 따른다: 따뜻한 오프화이트 바탕 · 거의 검정 글자 ·
// 강조색은 코랄 하나 · 상자 없는 큰 글자가 박에 맞춰 바뀌고 튕김 없는 스프링으로 자리 잡는다. 낱말 노래의 짜임(음절마다 한 박 →
// 이어 부르면 뜻(소리 뒤) → 반주만 흐르는 네 차례)은 한글 노래 「첫 인사」 틀(가이드 §3 「낱말 노래 틀」) 그대로다.
// v1(흰 둥근 판 · 테두리 칸 · 검정 알약)은 맹검에서 「범용 학습 앱 템플릿」으로 기각 — 칸 · 판 · 그림자를 걷고 글자 자체로 보인다.
// v2(그림 카드 + 글 자리)는 「그림을 끼운 템플릿」(카드 모서리 · 그림자가 둘을 가름)으로 기각 — v3는 그림이 아래로 바탕에 스며들어 한 장이 된다.
// v8(11-12 카본 맹검 세 편 기각 뒤): 2초 띠 안에서 그림 · 끝 화면이 굳어 있었다(19초에 줌 1.07은 안 보임). 그림은 가상 카메라가
// 구간마다 몽글 얼굴(hero) · 그 낱말의 사물(obj) · 둘을 담는 자리(wide)로 옮겨 가고, 노래 박마다 밀어 들어간다(영상 굽기 없이).
// 딱지는 코랄 배지(박마다 뛰는 점 · 진짜 속도는 겹화살), 다리 글은 읽는 빠르기로 줄마다 떠오르고, 이어 부르기 · 진짜 속도는
// 음절이 코랄 물결로 지나간다. 끝 화면은 낱말이 박마다 튀고 카메라가 몽글에게 다가간다.
// 위: 그림(stage.img = 장면 속 몽글 · stage.pic = 낱말 그림만 — 11-11 유호님이 mongle을 고르셨다). 아래: 글자 자리. 맨 아래: 손뼉 동그라미
// (네 차례 때 손뼉 칠 박을 켠다 — 글이 아니라 모든 판본에 같은 그림). 글은 안전선(오른쪽 920 · 아래 1428) 안. 화면에 AI 도구 이름 · 계정 이름을 쓰지 않는다.
// 언어판 장치는 퀴즈 은행 틀(언어 프로필 · fitBox · LOC 글꼴)을 그대로 쓴다. 0프레임에 그림과 다리 글 첫 줄이 이미 보인다(되풀이 재생 · 첫 화면).
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { KO, LOC } from './fonts';
import { fitBox, profileFor, textEm } from './lang';
import { SONG, type Part, type SongDoc } from './songDoc';

const W = 1080;
// S16 theme 그대로 — 한 화면에 강조색 하나
const C = {
  bg: '#F2EFE9',
  ink: '#111112',
  muted: '#6F6A63',
  sub: '#4F4A44', // 끝 화면 낱말 아래 뜻(v8 맹검 — #6F6A63 48px이 「폰에서 흐린 얼룩」)
  hair: 'rgba(17,17,18,0.10)',
  ghost: 'rgba(17,17,18,0.13)',
  accent: '#F96859',
  accentInk: '#C9382A',
};
const PAD = 96;
export const REAL_LEAD = 0.5; // 진짜 속도 딱지가 그 구간보다 먼저 뜨는 초(아래 딱지 구간)
const RIGHT = 920; // 오른쪽 단추 열 — 글자 검사 · 올리기 전 검사 안전선(SAFE right 920 · bottom 1428, tools/올리기전검사.js)과 같게(11-12 — S16의 930 · 1536으로 짰더니 걸렸다)
const SAFE_BOTTOM = 1400; // 글 아래 끝(검사 선 1428에 여유)
const TEXT_W = RIGHT - PAD;
const CJK_FONT: Record<string, string> = {
  ja: "'Yu Gothic', 'Yu Gothic UI', 'Meiryo', 'SUIT', sans-serif", // UI판은 가나가 좁고 「…」이 바닥에 붙는다 — 전각 가나 · 가운데 「…」
  'zh-Hans': "'Microsoft YaHei UI', 'Microsoft YaHei', 'SUIT', sans-serif",
  'zh-Hant': "'Microsoft JhengHei UI', 'Microsoft JhengHei', 'SUIT', sans-serif",
};
const READ_FONT = `'Inter Tight', ${LOC}`; // 발음 줄 — 로마자 · 키릴은 Inter Tight, 그 밖의 문자는 그 언어 글꼴
const LABEL_BOX = 760; // 딱지 글 상자 폭(판본지도 clap · say · real 상자 — 새편.mjs와 같은 값, 최소 36px로 이 폭에 든다)
const CARD = { x: 0, y: 0, w: W, h: 1000, fade: 260 }; // 위 전체 폭, 아래 fade px은 바탕으로 스민다(위 269px은 앱 머리 자리라 그림만)
const Y = { label: 960, glyph: 1010, meter: 1566 }; // 글은 SAFE_BOTTOM(1400 · 검사 선 1428) 안, 박 동그라미(글 아님)는 그 아래
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** 쾅: 0프레임에 이미 다 보이는 크기에서 제자리로(블러 · 페이드 없이) — S16 slam. */
const slam = (f: number, at: number, fps: number, from = 1.12) => {
  if (f < at) return 1;
  const s = spring({ frame: f - at, fps, config: { damping: 20, stiffness: 220, mass: 0.6 } });
  return from - (from - 1) * s;
};
/** 블러 인 한 조각의 모양(S16 BlurIn) */
const blurIn = (f: number, at: number, fps: number, rise = 26, blur = 6) => {
  // 흐림은 작게 · 빨리(v2 맹검 — 14px 흐림이 「얼룩처럼」 읽혔다)
  const s = spring({ frame: f - at, fps, config: { damping: 22, stiffness: 200, mass: 0.6 } });
  return { opacity: interpolate(s, [0, 0.6], [0, 1], clamp), filter: `blur(${(1 - s) * blur}px)`, translate: `0 ${(1 - s) * rise}px` } as React.CSSProperties;
};
/** 따옴표 안 띄어쓰기는 줄을 바꾸지 않는다(「I'm / hungry」로 갈리지 않게). */
const keepQuoted = (s: string) => s.replace(/([“"«「『])([^”"»」』]+)([”"»」』])/g, (_m, a, b, c) => a + b.replace(/ /g, ' ') + c);
/** 두 글자 이하 낱말(in · to · a …)은 다음 낱말과 한 줄에(「in / your language?」로 갈리지 않게). */
const glueShort = (s: string) => s.replace(/(^|\s)(\S{1,2}) (?=\S)/gu, (_m, sp, w) => `${sp}${w} `);

/** 박 직후 1 → 0으로 사그라드는 값. from보다 앞선 박(그 구간이 열리기 전 박)은 세지 않는다(11-12 맹검 — 네 차례 첫 칸에 앞 박이 켜져 있었다). */
const beatPulse = (doc: SongDoc, t: number, from: number, tau = 0.12) => {
  if (t < doc.first) return 0;
  const b = 60 / doc.bpm;
  const bt = doc.first + Math.floor((t - doc.first) / b) * b;
  return bt >= from - 1e-6 ? Math.exp(-(t - bt) / tau) : 0;
};

// ── 가상 카메라(v9) ──────────────────────────────────────────────────────────────
// 그림은 가로 3:2 한 장이다. 구간(카운트인 · 끊어 · 이어 · 네 차례 · 진짜 속도 · 끝)마다 다른 구도의 「컷」으로 딱 끊어 넘어가고
// (전체 wide · 몽글 가까이 hero · 그 낱말의 사물 obj), 컷 안에서는 한 방향으로만 천천히 다가간다. 모든 판본에 같은 그림이다(글과 무관).
// v8은 자리 사이를 이어 옮기고 박마다 2~4% 밀어 들어갔더니 카본 맹검이 「영상을 앞뒤로 돌린 핑퐁 루프 · 이음매에서 움찔 튐」으로 읽었다(11-12).
type Pt = [number, number];
type Cam = { u: number; v: number; z: number };
const pct = (s: string | undefined, i: number, d: number) => {
  const n = parseFloat((s ?? '').trim().split(/\s+/)[i] ?? '');
  return Number.isFinite(n) ? n / 100 : d;
};
function camAt(doc: SongDoc, t: number): Cam {
  // v10: 편 전체를 한 방향으로 한 번에 옮겨 간다 — 컷 · 되돌림 없이(v8 「핑퐁 루프」, v9 「같은 구도 컷을 잇달아 붙임 · 확대 점프」 — K50).
  // stage.cam.from → to(그림 안 비율 [가로, 세로, 줌]). 없으면 wide → hero로 다가간다. 일정한 빠르기(2초 띠마다 같은 만큼 움직인다).
  const st = doc.stage;
  const base: Pt = [pct(st.focus, 0, 0.5), pct(st.focus, 1, 0.5)];
  const wide = st.cam?.wide ?? base;
  const hero = st.cam?.hero ?? wide;
  const from = st.cam?.from ?? [wide[0], wide[1], 1.0];
  const to = st.cam?.to ?? [hero[0], hero[1], 1.2];
  const r = interpolate(t, [0, doc.duration], [0, 1], clamp);
  return { u: from[0] + (to[0] - from[0]) * r, v: from[1] + (to[1] - from[1]) * r, z: from[2] + (to[2] - from[2]) * r };
}

type Glyph = { mode: 'ghost' | 'on' | 'done' | 'ask'; scale: number };

function glyphStates(doc: SongDoc, f: number, fps: number): { glyphs: Glyph[]; part: Part } {
  const t = f / fps;
  const n = doc.syl.length;
  const part = doc.parts.find((p) => t >= p.t && t < p.end) ?? doc.parts[doc.parts.length - 1];
  const sung = doc.parts.some((p) => (p.kind === 'chop' || p.kind === 'whole' || p.kind === 'real') && p.t <= t);
  const glyphs: Glyph[] = Array.from({ length: n }, () => ({ mode: sung ? 'done' : 'ghost', scale: 1 }));
  const at = (sec: number) => Math.round(sec * fps);
  if (part.kind === 'chop') {
    // 처음 한 바퀴의 끊어 부르기에서는 아직 안 부른 음절을 흐린 글자로(노래방처럼 부른 데까지 짙어진다)
    const firstPass = !doc.parts.some((p) => (p.kind === 'chop' || p.kind === 'whole' || p.kind === 'real') && p.t < part.t);
    if (firstPass) part.at.forEach((a, i) => { if (i < n && t < a) glyphs[i] = { mode: 'ghost', scale: 1 }; });
    // 낱말을 두 번 끊어 부르면(메들리 B 「가! 자! 가! 자!」) at이 음절 수보다 길다 — 음절을 차례로 돌려 켠다(한 번이면 예전과 같다)
    part.at.forEach((a, i) => {
      const g = i % n;
      if (t < a) return;
      glyphs[g] = { mode: 'on', scale: slam(f, at(a), fps, 1.16) };
      const next = part.at[i + 1];
      if (next !== undefined && t >= next) glyphs[g] = { mode: 'done', scale: 1 };
    });
  }
  if (part.kind === 'whole' || part.kind === 'real') {
    // 이어 부를 때마다 낱말 전체가 한 번에 코랄로 켜졌다가 검정으로(v8 — 검정 그대로 살짝 커지기만 해서 「부르는 순간 반응이 없다」).
    // v9: 음절마다 차례로 지나가는 물결은 0.25초 띠에서 「불규칙한 점멸 · 정신사납다」로 읽혀 한 번에 켜고 끈다. 진짜 속도는 더 짧게.
    // v10: 이어 부르기는 0.3초만(켜진 채 다음 부르기와 붙어 「코랄 단색에 1초 넘게 멈춤」이 되지 않게), 진짜 속도는 음절이 빠르게 차례로 켜져
    // 말 빠르기가 보이게(v9 맹검 — 「빠른 순차 점등이나 리듬 모션 없이 통째로 코랄에 멈춰 속도감이 없다」).
    const real = part.kind === 'real';
    const last = [...part.at].reverse().find((a) => t >= a);
    if (last !== undefined) {
      const nextA = part.at.find((a) => a > last) ?? part.end;
      if (real) {
        const step = Math.min(0.06, (nextA - last) / (n + 2));
        for (let i = 0; i < n; i++) {
          const on = last + i * step;
          glyphs[i] = t < on ? { mode: 'done', scale: 1 } : { mode: t < on + 0.16 ? 'on' : 'done', scale: slam(f, at(on), fps, 1.08) };
        }
      } else {
        const hold = Math.min(0.3, (nextA - last) * 0.6);
        for (let i = 0; i < n; i++) glyphs[i] = { mode: t < last + hold ? 'on' : 'done', scale: slam(f, at(last), fps, 1.1) };
      }
    }
  }
  if (part.kind === 'rest') {
    const beat = 60 / doc.bpm;
    const k = Math.floor((t - doc.first) / beat);
    const beatAt = doc.first + k * beat;
    for (let i = 0; i < n; i++) glyphs[i] = { mode: 'ask', scale: beatAt >= part.t ? slam(f, at(beatAt), fps, 1.07) : 1 };
  }
  return { glyphs, part };
}

type Seg = { t0: number; t1: number; text: string; kind: 'clap' | 'say' | 'real' };
/** 딱지 구간 — 네 차례(손뼉 · 말하기)와 진짜 속도(그 구간보다 REAL_LEAD초 먼저) */
const labelSegs = (doc: SongDoc): Seg[] => {
  const out: Seg[] = [];
  for (const p of doc.parts) {
    if (p.kind === 'rest') out.push({ t0: p.t, t1: p.end, text: p.mode === 'clap' ? doc.loc.clap : doc.loc.say, kind: p.mode });
    if (p.kind === 'real') out.push({ t0: p.t - REAL_LEAD, t1: p.end, text: doc.loc.real, kind: 'real' });
  }
  return out.sort((a, b) => a.t0 - b.t0);
};

export const Song: React.FC<{ doc?: SongDoc }> = ({ doc = SONG }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const loc = doc.loc;
  const prof = profileFor(loc.lang);
  // 한자 · 가나 판은 그 언어 글꼴을 맨 앞에(v9 — 공용 언어 프로필 글꼴 줄이 'Inter Tight', 'SUIT', 'Yu Gothic' 순이라 「…」은 라틴 글꼴, 「！？、」는
  // 한국어 SUIT가 맡아 가나 사이에서 가늘게 겉돌았다 — 카본 맹검 「폴백 폰트 느낌」 「마침표 셋」). 발음 줄의 로마자는 Inter Tight 그대로(readFont).
  const locFont = CJK_FONT[prof.code] ?? (prof.script === 'kana' || prof.script === 'han' ? `${prof.font.replace(/'Inter Tight',\s*|'SUIT',\s*/g, '')}` : prof.font);
  const { glyphs, part } = glyphStates(doc, f, fps);
  const n = doc.syl.length;
  const gap = n <= 3 ? 44 : 32;
  const G = Math.min(230, Math.floor((TEXT_W - (n - 1) * gap) / n / 0.98)); // 음절 글자 크기(11-12 250 → 230 — 뜻 줄이 아래 캡션 자리로 내려갔다)
  const fr = (sec: number) => Math.round(sec * fps);

  const count = doc.parts.find((p) => p.kind === 'count');
  const firstWhole = doc.parts.find((p) => p.kind === 'whole');
  const endPart = doc.parts.find((p) => p.kind === 'end');
  // 카운트인 → 음절 이음: 끝 0.3초 동안 다리 글은 위로 빠지고 음절 줄은 아래에서 올라와 겹친다(v5 맹검 — 통째로 바뀌는 「슬라이드 넘김」)
  const swapEase = { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) };
  const swapOut = count ? interpolate(t, [count.end - 0.3, count.end - 0.12], [0, 1], swapEase) : 1; // 다리 글이 먼저 빠지고
  const swap = count ? interpolate(t, [count.end - 0.2, count.end], [0, 1], swapEase) : 1; // 음절 줄이 뒤따른다
  const showBridge = !!count && t < count.end + 0.02;
  const showGlyphs = !count || t >= count.end - 0.3;
  const inEnd = !!endPart && t >= endPart.t;
  const meanAt = firstWhole ? firstWhole.at[0] + 0.25 : Infinity; // 뜻은 소리 뒤
  const leave = inEnd ? interpolate(f, [fr(endPart!.t), fr(endPart!.t) + 8], [0, 1], { ...clamp, easing: EASE_OUT }) : 0;

  // 박 — 첫 박부터 센다(되풀이 재생에서도 같은 자리). v10: 맨 아래 손뼉 동그라미 넷은 뺐다(v9 맹검 「기본 웹 UI 부품 · 점 인디케이터」 — K8),
  // 네 차례의 박은 음절이 박마다 코랄로 번쩍이는 것과 뜻 줄 자리의 안내 글이 맡는다
  const askFlash = part.kind === 'rest' ? beatPulse(doc, t, part.t) : 0; // 네 차례 — 그 구간 안의 박만

  // 카메라
  const cam = camAt(doc, t);
  const z = cam.z;
  const aspect = doc.stage.aspect ?? 1.5;
  const baseW = Math.max(CARD.w, CARD.h * aspect);
  const baseH = baseW / aspect;
  const dispW = baseW * z, dispH = baseH * z;
  const CX = CARD.w / 2, CY = 470; // 얼굴이 놓이는 자리 — 카드 가운데보다 조금 위(아래 260px은 바탕으로 스민다)
  const camLeft = Math.min(0, Math.max(CARD.w - dispW, CX - cam.u * dispW));
  const camTop = Math.min(0, Math.max(CARD.h - dispH, CY - cam.v * dispH));

  const readMax = loc.read.reduce((a, b) => (b.length > a.length ? b : a), '');
  const readSize = fitBox(readMax, prof, G + gap - 8, 52, 28, 1).size;
  const meanSize = fitBox(`—— ${loc.mean}`, prof, TEXT_W, 76, 44, 1).size; // 76: 뜻 줄 아래 끝이 SAFE_BOTTOM 안(11-12)
  const img = doc.stage.mode === 'mongle' ? doc.stage.img : doc.stage.pic;

  // v10: 안내(손뼉 · 말하기 · 진짜 속도)는 뜻 줄 자리에 코랄 글로 바뀌어 든다 — 스티커 · 알약 배지 없이 같은 조판 안에서
  // (v8 · v9 맹검 「기본 도형 알약 · 값싼 스티커 · 튀는 팝」 — K8). 글은 판본지도 상자(폭 760 · 최소 36px)에 드는 가장 큰 크기(뜻 줄 크기 · 60 넘지 않게).
  const segs = labelSegs(doc);
  const cue = inEnd ? undefined : segs.find((sg) => t >= sg.t0 && t < sg.t1);
  const cueSize = cue ? fitBox(cue.text, prof, LABEL_BOX, Math.min(60, meanSize), 36, 1).size : 0;
  // 뜻 ↔ 안내는 차례로 바뀐다(같은 자리에서 겹쳐 보이지 않게): 뜻이 0.08초에 위로 빠진 뒤 안내가 오르고, 안내가 끝 0.1초에 빠진 뒤 뜻이 돌아온다.
  // 이어지는 안내(진짜 속도 → 말하기)와 끝 물음 앞에서는 뜻이 돌아오지 않는다.
  const cueIn = cue ? interpolate(t, [cue.t0 + 0.06, cue.t0 + 0.2], [0, 1], { ...clamp, easing: EASE_OUT }) * (1 - interpolate(t, [cue.t1 - 0.1, cue.t1], [0, 1], clamp)) : 0;
  let meanHide = 0;
  for (const sg of segs) {
    if (t >= sg.t0 && t < sg.t1) meanHide = Math.max(meanHide, interpolate(t, [sg.t0, sg.t0 + 0.08], [0, 1], clamp));
    else if (t >= sg.t1 && t < sg.t1 + 0.14) meanHide = Math.max(meanHide, 1 - interpolate(t, [sg.t1 + 0.02, sg.t1 + 0.14], [0, 1], clamp));
  }

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden', ['--loc-font' as string]: locFont }}>
      <Audio src={staticFile(doc.audio)} />

      {/* 그림 카드 — 장면(몽글) 또는 낱말 그림. 카메라가 그림 안을 움직인다 */}
      {img ? (
        <div style={{ position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, overflow: 'hidden',
          maskImage: `linear-gradient(to bottom, #000 ${CARD.h - CARD.fade}px, transparent ${CARD.h}px)`,
          WebkitMaskImage: `linear-gradient(to bottom, #000 ${CARD.h - CARD.fade}px, transparent ${CARD.h}px)` }}>
          <Img src={staticFile(img)} style={{ position: 'absolute', left: 0, top: 0, width: baseW, height: baseH, transformOrigin: '0 0',
            transform: `translate(${camLeft}px, ${camTop}px) scale(${z})` }} />
        </div>
      ) : null}

      {/* 카운트인 — 이 낱말을 쓰는 상황 한 줄. 첫 줄은 0프레임에 이미 보이고, 다음 줄은 읽는 빠르기로 줄마다 떠오른다
          (v8 맹검 — 흐린 회색 줄이 검정으로 툭 바뀌었다. 띄어쓰기 없는 말은 줄 하나가 통째로 「낱말 하나」였다) */}
      {showBridge ? (() => {
        // 줄을 \n에서만 나누는 말(타이 · 크메르 · 버마어 · 한자 · 가나)은 띄어쓰기 · 「、」「，」 뒤에서 나눈 판도 재서 가장 큰 크기를 고른다
        // (끝 물음과 같은 셈 — 11-12 v8 렌더에서 태국어 다리 글이 한 줄 56px로 오른쪽 안전선 밖 1055px까지 나갔다)
        const availB = SAFE_BOTTOM - (Y.label + 8);
        let box = fitBox(loc.bridge, prof, TEXT_W, 100, 56, 4);
        if (prof.breaks === 'phrase') {
          const cands = [loc.bridge];
          if (/ /.test(loc.bridge)) cands.push(loc.bridge.replace(/ +/g, '\n'));
          if (/[、，,]/.test(loc.bridge)) cands.push(loc.bridge.replace(/([、，,])[ \t]*\n?/g, '$1\n').replace(/\n$/, ''));
          let best = box.over ? 0 : box.size;
          for (const c of cands) {
            const b = fitBox(c, prof, TEXT_W, 100, 56, 4);
            if (!b.over && b.lines.length * b.size * 1.12 <= availB && b.size > best) { box = b; best = b.size; }
          }
          // 일본어는 조사(が · を · に · で · と · は · も · へ · や) 뒤 낱말 경계에서도 줄을 나눠 더 크게(v9 — 12자 한 줄에 묶여 66px
          // 「아주 작은 기본 고딕」으로 읽혔다). 다음 낱말이 조사 · 「の」 · 부호면 나누지 않는다(「韓国語で / は…」가 되지 않게).
          const SegCtor = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment(x: string): Iterable<{ segment: string }> } }).Segmenter;
          if (prof.code === 'ja' && SegCtor) {
            const seg = new SegCtor('ja', { granularity: 'word' });
            const PART = new Set(['が', 'を', 'に', 'で', 'と', 'は', 'も', 'へ', 'や']);
            const punct = /^[、。，．・：；？！…‥」』）\s]+$/;
            const chunksOf = (line: string) => {
              const ss = [...seg.segment(line)].map((x) => x.segment);
              const out = [''];
              ss.forEach((w, i) => {
                out[out.length - 1] += w;
                const nx = ss[i + 1];
                if (nx !== undefined && PART.has(w) && !PART.has(nx) && nx !== 'の' && !punct.test(nx)) out.push('');
              });
              return out;
            };
            const hard = loc.bridge.split('\n').map(chunksOf);
            // 줄을 하나 더 나눌 때마다 20%씩 깎아 견준다 — 「バスが / 行っちゃう！」처럼 짧게 쪼개지 않게(크기 이득이 클 때만 나눈다)
            let score = best;
            for (let sz = 100; sz > best; sz -= 2) {
              const lines: string[] = [];
              for (const chunks of hard) {
                let cur = '';
                for (const c of chunks) {
                  if (cur && textEm(cur + c, prof) * sz > TEXT_W * 0.97) { lines.push(cur); cur = c; } else cur += c;
                }
                lines.push(cur);
              }
              const sc = sz * (1 - 0.2 * (lines.length - hard.length));
              if (lines.length <= 4 && lines.every((l) => textEm(l, prof) * sz <= TEXT_W * 0.97) && lines.length * sz * 1.12 <= availB && sc > score) {
                box = { size: sz, lines }; score = sc;
              }
            }
          }
        }
        // 남는 높이(아래 안전선까지)의 40%만큼 내려 놓는다 — 위에 몰린 작은 두 줄 아래가 비어 보였다(11-12 맹검)
        const bridgeTop = Y.label + 8 + Math.max(0, (SAFE_BOTTOM - (Y.label + 8) - box.lines.length * box.size * 1.12) * 0.4);
        const lens = box.lines.map((l) => [...l.replace(/\s+/g, '')].length || 1);
        const total = lens.reduce((a, b) => a + b, 0);
        const span = Math.max(0.6, count!.end - 1.1 - doc.first);
        let acc = 0;
        return (
          <div style={{ position: 'absolute', left: PAD, top: bridgeTop, width: TEXT_W, fontFamily: LOC, fontWeight: 800, fontSize: box.size, lineHeight: 1.12,
            letterSpacing: '-0.025em', color: C.ink, opacity: 1 - swapOut, translate: `0 ${-36 * swapOut}px` }}>
            {box.lines.map((l, i) => {
              const at2 = i === 0 ? null : doc.first + (span * acc) / total;
              acc += lens[i];
              const st: React.CSSProperties = at2 === null ? {} : t < at2 ? { opacity: 0 } : blurIn(f, fr(at2), fps, 30, 5);
              // nowrap을 걸지 않는다 — 어림(textEm)보다 실제 글이 넓으면 브라우저가 줄을 바꿔 안전선 안에 둔다
              return <div key={i} style={st}>{l}</div>;
            })}
          </div>
        );
      })() : null}


      {/* 음절 — 상자 없이 글자 그대로. 흐림 → 부를 때 코랄로 쾅 → 검정. 네 차례엔 글자가 박마다 코랄로 번쩍 */}
      {showGlyphs ? (
        <div style={{ position: 'absolute', left: PAD, top: Y.glyph, display: 'flex', gap, opacity: (1 - leave) * swap, translate: `0 ${36 * (1 - swap) - 24 * leave}px` }}>
          {glyphs.map((g, i) => {
            // 네 차례(ask): 검정 글자가 박마다 코랄로 번쩍 — 손뼉 · 말할 자리(속 빈 테두리는 가변 글꼴의 겹친 획이 드러났고, 회색은 「꺼진 화면」으로 읽혔다)
            const color = g.mode === 'on' ? C.accent : g.mode === 'ghost' ? C.ghost : g.mode === 'ask' ? (askFlash > 0.3 ? C.accent : C.ink) : C.ink; // 사이 색(적갈색) 없이 켜고 끈다
            return (
              <div key={i} style={{ width: G * 0.98, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontFamily: KO, fontWeight: 900, fontSize: G, lineHeight: 1, letterSpacing: '-0.04em', color,
                  scale: `${g.scale}`, transformOrigin: '50% 85%' }}>
                  {doc.syl[i]}
                </div>
                <div style={{ marginTop: 10, fontFamily: READ_FONT, fontWeight: 500, fontSize: readSize, color: g.mode === 'on' ? C.accentInk : C.muted,
                  opacity: g.mode === 'ghost' ? 0 : 1, whiteSpace: 'nowrap' }}>{loc.read[i] ?? ''}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 뜻 — 이어 부른 소리 뒤에 블러 인. v10: 앞의 코랄 줄을 뺐다(v9 맹검 「뜻 줄 앞에 생경한 하이픈」 — v3의 「=」 수식을 바꾼 짧은 코랄 줄이었다).
          네 차례 · 진짜 속도 안내가 뜨면 뜻은 위로 빠지고 그 자리에 코랄 안내가 오른다 */}
      {t >= meanAt && !inEnd ? (
        <div style={{ position: 'absolute', left: PAD, top: Y.glyph + G + readSize + 26, width: TEXT_W, height: meanSize * 1.2 }}>
          {/* 떠오르는 폭 12px — 26px이면 들어오는 동안 아래 캡션 자리(1428)를 15px 넘었다(11-12) */}
          <div style={{ position: 'absolute', left: 0, top: 0, fontFamily: LOC, fontWeight: 500, fontSize: meanSize, lineHeight: 1.15, letterSpacing: '-0.03em', color: C.ink,
            whiteSpace: 'nowrap', opacity: 1 - meanHide, translate: `0 ${-12 * meanHide}px` }}>
            <span style={{ display: 'inline-block', ...blurIn(f, fr(meanAt), fps, 12) }}>{loc.mean}</span>
          </div>
          {cue ? (
            <div style={{ position: 'absolute', left: 0, top: (meanSize - cueSize) * 0.55, fontFamily: LOC, fontWeight: 800, fontSize: cueSize, lineHeight: 1.15, letterSpacing: '-0.015em',
              color: C.accent, whiteSpace: 'nowrap', opacity: cueIn, translate: `0 ${14 * (1 - cueIn)}px` }}>{cue.text}</div>
          ) : null}
        </div>
      ) : null}

      {/* 끝 물음 — 낱말과 뜻을 한 줄로 접고, 물음을 크게 */}
      {inEnd ? (() => {
        const q = glueShort(keepQuoted(loc.end));
        // 물음은 한 단계 작게 — 기억할 것은 위의 낱말(v4 맹검: 「배고파가 작은 설명표로 밀린다」). 아래 안전선(SAFE_BOTTOM) 안에 들게
        // 줄 수마다 들어가는 가장 큰 크기를 고른다(11-12 영어 셋째 줄이 아래 캡션 자리를 65px 침범).
        const wordSize = Math.min(140, G * 0.6);
        const meanEnd = Math.min(58, meanSize); // v8 — 48px 흐린 회색이 「얼룩」으로 읽혔다
        const qTop = Y.label - 10 + wordSize + 10 + meanEnd * 1.1 + 50;
        const avail = SAFE_BOTTOM - qTop;
        let box = fitBox(q, prof, TEXT_W, 92, 34, 4);
        let qPick = q; // 고른 줄바꿈 그대로 그린다(띄어쓰기 없는 한자 · 가나는 브라우저가 못 나눈다)
        // 92: 끝 물음이 마지막 화면을 잡게(11-12 맹검 「작은 검정 한 줄」)
        let best = 0;
        // 줄을 \n에서만 나누는 꼴(타이 · 크메르 · 버마어 — 띄어쓰기가 절 경계)은 띄어쓰기에서 나눈 판도 잰다
        // (11-12 태국어 끝 물음이 한 줄에 욱여넣어져 다른 언어보다 눈에 띄게 작았다). 화면은 그 크기에서 브라우저가 띄어쓰기에서 나눈다.
        const qs = [q];
        if (prof.breaks === 'phrase' && / /.test(q)) qs.push(q.replace(/ +/g, '\n'));
        if (prof.breaks === 'phrase' && /[、，,]/.test(q)) qs.push(q.replace(/([、，,])\s*/g, '$1\n')); // 「、」「，」 뒤에서도(11-12 일본어 끝 물음이 한 줄에 작게)
        for (let nl = 1; nl <= 4; nl++) { // 줄 수마다 들어가는 크기를 재고 가장 큰 쪽(한 줄에 작게 욱여넣지 않게)
          const cap = Math.floor(avail / (nl * 1.12));
          if (cap < 34) break;
          for (const qq of qs) {
            const b = fitBox(qq, prof, TEXT_W, Math.min(92, cap), 34, nl);
            if (!b.over && b.lines.length <= nl && b.size <= cap && b.size > best) { box = b; best = b.size; qPick = qq; }
          }
        }
        const at0 = fr(endPart!.t);
        const qWords = qPick.split(/( +|\n)/).filter((x) => x !== ''); // 보통 띄어쓰기로만 — 붙여 둔 NBSP( )는 낱말 안에 남긴다
        const nWords = qWords.filter((w) => w !== '\n' && !/^ +$/.test(w)).length;
        const stagger = Math.max(2, Math.min(6, Math.round(18 / Math.max(1, nWords)))); // 낱말이 적은 말(일본어 두 덩이)도 차례가 보이게
        const endPulse = beatPulse(doc, t, endPart!.t + 0.4, 0.14); // 낱말이 박마다 튄다(v8 — 끝 화면 2초가 굳어 있었다)
        let qk = -1;
        return (
          <>
            {/* 낱말 아래 줄에 뜻(v6 맹검 — 옆에 작게 붙인 뜻이 「매달린 주석」으로 읽혔다) */}
            <div style={{ position: 'absolute', left: PAD, top: Y.label - 10, display: 'flex', flexDirection: 'column', gap: 10, whiteSpace: 'nowrap', ...blurIn(f, at0 + 5, fps, 18, 10) }}>
              <span style={{ fontFamily: KO, fontWeight: 900, fontSize: wordSize, lineHeight: 1, letterSpacing: '-0.005em', color: C.accent,
                display: 'inline-block', alignSelf: 'flex-start', scale: `${1 + 0.08 * endPulse}`, transformOrigin: '0% 90%' }}>{doc.word}</span>
              <span style={{ fontFamily: LOC, fontWeight: 600, fontSize: meanEnd, lineHeight: 1.1, color: C.sub, ...blurIn(f, at0 + 9, fps, 10, 4) }}>{loc.mean}</span>
            </div>
            {/* 줄은 균형 있게(「in」이 홀로 남지 않게 — text-wrap: balance), 낱말마다 차례로 */}
            <div style={{ position: 'absolute', left: PAD, top: qTop, width: TEXT_W, fontFamily: LOC, fontWeight: 800, fontSize: box.size, lineHeight: 1.12,
              letterSpacing: '-0.025em', color: C.ink, textWrap: 'balance' } as React.CSSProperties}>
              {(() => {
                // 따옴표 안 말(그 낱말의 뜻)만 코랄 — 끝 물음의 강약, 박마다 살짝 뛴다(멈춘 끝 화면이 되지 않게)
                let inQ = false;
                return qWords.map((w, i) => {
                  if (w === '\n') return <br key={i} />;
                  if (/^ +$/.test(w)) return <span key={i}>{w}</span>;
                  qk += 1;
                  const opens = /^[“"«「『]/.test(w);
                  const closes = /[”"»」』][?!.,…]*$/.test(w);
                  const hot = inQ || opens;
                  if (opens && !closes) inQ = true;
                  if (closes) inQ = false;
                  const beatPop = hot ? 1 + 0.04 * endPulse : 1;
                  // v10: 물음표 뛰기는 뺐다(v9 맹검 「물음표만 유독 위로 솟아」) — 박마다 뛰는 것은 위의 코랄 낱말만
                  const qm = /^(.*?)([?？]+)$/su.exec(w);
                  const body = qm ? qm[1] : w;
                  return <span key={i} style={{ display: 'inline-block', color: hot ? C.accent : C.ink, scale: `${beatPop}`, transformOrigin: '50% 80%',
                    ...blurIn(f, at0 + 12 + qk * stagger, fps, 22) }}>{body}{qm ? qm[2] : null}</span>;
                });
              })()}
            </div>
          </>
        );
      })() : null}

    </AbsoluteFill>
  );
};
