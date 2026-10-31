// yuhobuilds Y28(10-31) 「AI 웹툰, 칸마다 따로 그리면 몇 분 사이에 계절이 바뀐다 — 모든 칸 끝에 계절 한 줄」.
// 원본 VMwrKqlumr4(50.3초) 뼈대: 숨은 문제가 있는 결과 → 다시 보기 → 돋보기로 드러냄 → 왜 생기나 → 고치는 법 세 마디 → 고친 결과 →
// 덧붙임 → 끝 한마디. 칸 그림은 같은 지시문으로 실제로 구운 판 그대로(public/real — k<n>_a 계절 줄 없이 · k<n>_b 계절 줄 붙여).
// 무대는 지난 편들(Y25 밤 사진 전체 화면 · 어두운 자막 판, Y27 검은 바탕 3D 칸)과 다르게: 크림색 종이 위 웹툰 네 칸, 흰 자막 판 · 남색 글,
// 끝은 같은 칸 둘(계절 줄 없이 / 한 줄)이 나란히.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, mix, prog as ease } from '../lib/motion';
import { at, B, lineEnd, ORDER, TOTAL, VO } from './time';

const MASTER = 0.8;
const PAPER = '#F4EFE4';
const INK = '#1D2330';
const AMBER = '#E8860C';
const RED = '#D93A2F';
const GREEN = '#2E9E5B';
const WHITE = '#FFFFFF';

// 칸 그림 1122×1402 → 쪽 위 520×649.
const PW = 520;
const PH = 649;
const Y0 = 440;
const POS = [
  { x: 13, y: Y0 },
  { x: 547, y: Y0 },
  { x: 13, y: Y0 + PH + 14 },
  { x: 547, y: Y0 + PH + 14 },
];
/** 칸마다 나무 · 창밖 자리(쪽 좌표). */
const SPOT = [
  { x: 30, y: Y0 + 16, w: 240, h: 240 },
  { x: 560, y: Y0 + 6, w: 495, h: 190 },
  { x: 200, y: Y0 + PH + 18, w: 190, h: 150 },
  { x: 760, y: Y0 + PH + 22, w: 300, h: 400 },
];

const Panel: React.FC<{ n: number; v: 'a' | 'b'; style?: React.CSSProperties }> = ({ n, v, style }) => (
  <Img src={staticFile(`real/k${n}_${v}.jpg`)} style={{ position: 'absolute', width: PW, height: PH, borderRadius: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.12)', ...style }} />
);

/** 네 칸 한 쪽. wipe(0~1)만큼 왼쪽부터 b판으로 덮인다. */
const Page: React.FC<{ wipe?: number }> = ({ wipe = 0 }) => (
  <>
    {POS.map((p, i) => (
      <React.Fragment key={i}>
        <Panel n={i + 1} v="a" style={{ left: p.x, top: p.y }} />
        {wipe > 0 ? (
          <div style={{ position: 'absolute', left: p.x, top: p.y, width: PW * wipe, height: PH, overflow: 'hidden', borderRadius: 6 }}>
            <Img src={staticFile(`real/k${i + 1}_b.jpg`)} style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH }} />
          </div>
        ) : null}
      </React.Fragment>
    ))}
  </>
);

/** 쪽 위 한 점(cx, cy)을 화면 가운데 근처(tx, ty)에 s배로 놓는 카메라. */
const Cam: React.FC<{ s: number; cx: number; cy: number; tx?: number; ty?: number; children: React.ReactNode }> = ({ s, cx, cy, tx = 540, ty = 1000, children }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${tx - cx * s}px, ${ty - cy * s}px) scale(${s})` }}>{children}</div>
);

/** 원 + 꼬리표. */
const Ring: React.FC<{ a: number; x: number; y: number; w: number; h: number; label: string; color: string; lx?: number; ly?: number; size?: number }> = ({ a, x, y, w, h, label, color, lx, ly, size = 44 }) => {
  const f = useCurrentFrame();
  const p = ease(f, a, 9);
  if (f < a) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: '50%', border: `9px solid ${color}`, transform: `scale(${mix(1.25, 1, p)})`, opacity: p }} />
      <div style={{ position: 'absolute', left: lx ?? x, top: ly ?? y + h + 8, background: color, borderRadius: 14, padding: '6px 18px 9px', fontFamily: KO, fontWeight: 900, fontSize: size, color: WHITE, letterSpacing: '-0.03em', opacity: p, whiteSpace: 'nowrap' }}>{label}</div>
    </>
  );
};

/** 위 큰 글(흰 판 · 남색 글). */
const Head: React.FC<{ a: number; top?: number; size?: number; color?: string; children: React.ReactNode }> = ({ a, top = 285, size = 70, color = INK, children }) => {
  const f = useCurrentFrame();
  const p = ease(f, a, 7);
  if (f < a) return null;
  return (
    <div style={{ position: 'absolute', left: 60, width: 960, top, display: 'flex', justifyContent: 'center', opacity: p, transform: `translateY(${mix(14, 0, p)}px)` }}>
      <div style={{ background: WHITE, borderRadius: 24, padding: '12px 32px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', fontFamily: KO, fontWeight: 900, fontSize: size, color, letterSpacing: '-0.035em', lineHeight: 1.18, textAlign: 'center', wordBreak: 'keep-all' }}>{children}</div>
    </div>
  );
};

// ───────────── 칸 ─────────────
/** 0~8.7초: 네 칸 → 칸 1에서 칸 4로 읽어 내려감 → 다시 네 칸, 3초 찾기. */
const Open: React.FC = () => {
  const f = useCurrentFrame();
  // r2: 칸 1 → 칸 4로 훑던 움직임이 원본에 없는 박자 넷(2.6 · 3.9 · 4.2 · 4.4)으로 잡혔다 — 2.4에 한 번 다가가 머물고 4.9에 한 번에 돌아온다.
  const r1 = ease(f, B.read, 5, IN_OUT);
  const back = ease(f, B.game, 4, IN_OUT);
  const read = r1 * (1 - back);
  const s = mix(1, 1.75, read) + 0.0012 * Math.max(0, f - B.read) * read;
  const cx = mix(540, POS[0].x + PW / 2 + 40, read);
  const cy = mix(Y0 + PH + 7, POS[0].y + PH / 2 + 60, read);
  const base = 1 + 0.0006 * f;
  const count = f < B.game ? null : 3 - Math.min(2, Math.floor((f - B.game - 24) / 30));
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Cam s={s * (read > 0 ? 1 : base)} cx={cx} cy={cy} ty={read > 0 ? 1000 : Y0 + PH + 7}>
        <Page />
      </Cam>
      {count !== null && f >= B.game + 24 ? (
        <div style={{ position: 'absolute', left: 540 - 80, top: Y0 + PH + 7 - 80, width: 160, height: 160, borderRadius: '50%', background: WHITE, border: `8px solid ${AMBER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: KO, fontWeight: 900, fontSize: 92, color: AMBER, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
          {Math.max(1, count)}
        </div>
      ) : null}
      {count !== null && f >= B.game + 24 ? (
        <div style={{ position: 'absolute', left: 0, top: Y0 + PH + 7 + 92, width: 1080, textAlign: 'center' }}>
          <span style={{ background: AMBER, borderRadius: 12, padding: '4px 16px 8px', fontFamily: KO, fontWeight: 900, fontSize: 40, color: WHITE }}>이상한 곳 찾기 · 3초</span>
        </div>
      ) : null}
      <Head a={B.hook} size={74} color={INK}>
        이상한 데 하나, <span style={{ color: AMBER }}>보이세요?</span>
      </Head>
    </AbsoluteFill>
  );
};

/** 8.7~14.6초: 칸 1 나무 가까이 → 컷, 네 칸 창밖에 표시. */
const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  if (f < B.win) {
    const z = ease(f, B.tree, 6, IN_OUT);
    const t = SPOT[0];
    return (
      <AbsoluteFill style={{ background: PAPER }}>
        <Cam s={mix(1, 2.6, z)} cx={mix(540, t.x + t.w / 2, z)} cy={mix(Y0 + PH + 7, t.y + t.h / 2, z)} ty={mix(Y0 + PH + 7, 900, z)}>
          <Page />
          <Ring a={B.ring} x={t.x} y={t.y} w={t.w} h={t.h} label="3월 초 · 거의 맨가지" color={AMBER} size={22} />
        </Cam>
      </AbsoluteFill>
    );
  }
  // r7: 11~14초가 거의 멈춤(올리기 전 검사) — 천천히 다가간다.
  const k = 1 + 0.0016 * (f - B.win);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${k})`, transformOrigin: '50% 52%' }}>
      <Page />
      <Ring a={B.win} x={SPOT[0].x} y={SPOT[0].y} w={SPOT[0].w} h={SPOT[0].h} label="3월 초 · 거의 맨가지" color={AMBER} size={34} />
      {SPOT.slice(1).map((t, i) => (
        <Ring key={i} a={B.win + 2} x={t.x} y={t.y} w={t.w} h={t.h} label="초록 잎 가득" color={RED} size={36} lx={t.x + t.w - 250} ly={t.y + t.h - 30} />
      ))}
      </div>
    </AbsoluteFill>
  );
};

/** 14.6~20.0초: 칸 1 나무 · 칸 4 창밖 나란히 → 칸마다 따로 → 칸마다 계절 꼬리표. */
const Why: React.FC = () => {
  const f = useCurrentFrame();
  if (f < B.apart) {
    const p = ease(f, B.pair, 10);
    const crop = (n: number, sx: number, left: number, label: string, tag: string, color: string) => (
      <div style={{ position: 'absolute', left, top: 520, width: 520, height: 650, overflow: 'hidden', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', transform: `translateY(${mix(30, 0, p)}px)`, opacity: p }}>
        <Img src={staticFile(`real/k${n}_a.jpg`)} style={{ position: 'absolute', left: -sx * (520 / 700), top: 0, width: 1122 * (520 / 700), height: 1402 * (520 / 700) }} />
        <div style={{ position: 'absolute', left: 14, top: 14, background: WHITE, borderRadius: 12, padding: '4px 14px 7px', fontFamily: KO, fontWeight: 900, fontSize: 38, color: INK }}>{label}</div>
        <div style={{ position: 'absolute', left: 14, bottom: 16, background: color, borderRadius: 12, padding: '4px 16px 8px', fontFamily: KO, fontWeight: 900, fontSize: 44, color: WHITE }}>{tag}</div>
      </div>
    );
    return (
      <AbsoluteFill style={{ background: PAPER }}>
        {crop(1, 0, 13, '칸 1 · 정문', '3월 초 · 거의 맨가지', AMBER)}
        {crop(4, 420, 547, '칸 4 · 몇 분 뒤', '초록 잎 가득', RED)}
        <div style={{ position: 'absolute', left: 0, top: 1196, width: 1080, textAlign: 'center', opacity: ease(f, B.pair + 8, 8) }}>
          <span style={{ background: INK, borderRadius: 16, padding: '8px 26px 12px', fontFamily: KO, fontWeight: 900, fontSize: 52, color: WHITE }}>같은 날 아침, 몇 분 사이</span>
        </div>
        <div style={{ position: 'absolute', left: 500, top: 790, width: 80, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 96, color: RED, opacity: ease(f, B.pair + 8, 8) }}>≠</div>
      </AbsoluteFill>
    );
  }
  const sp = ease(f, B.apart, 16, IN_OUT);
  const straight = ease(f, B.tags, 5, IN_OUT);
  const rot = [-4, 3, 2.5, -3];
  const dx = [-30, 30, -30, 30];
  const dy = [-40, -40, 40, 40];
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      {POS.map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: p.x, top: p.y, width: PW, height: PH, transform: `translate(${dx[i] * sp}px, ${dy[i] * sp}px) rotate(${rot[i] * sp * (1 - straight)}deg) scale(${mix(1, 0.88, sp) * mix(1, 1.04, straight)})` }}>
          <Panel n={i + 1} v="a" style={{ left: 0, top: 0 }} />
          {f >= B.tags ? (
            <div style={{ position: 'absolute', left: 16, bottom: 18, background: i === 0 ? AMBER : RED, borderRadius: 12, padding: '4px 16px 8px', fontFamily: KO, fontWeight: 900, fontSize: 46, color: WHITE, opacity: ease(f, B.tags, 5) }}>
              {i === 0 ? '거의 맨가지' : '초록 잎'}
            </div>
          ) : null}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 20.0~25.3초: 같은 인물 시트를 넣었다 — 얼굴 · 옷은 이어지는데 창밖 계절은 아니다(r4: 「칸 1 · 4 · 8」 다른 작업 이야기는 글로 뺐다). */
const Mark: React.FC<{ a: number; x: number; y: number; text: string; color: string }> = ({ a, x, y, text, color }) => {
  const f = useCurrentFrame();
  const p = ease(f, a, 7);
  if (f < a) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, background: color, borderRadius: 14, padding: '6px 18px 10px', fontFamily: KO, fontWeight: 900, fontSize: 46, color: WHITE, opacity: p, transform: `scale(${mix(1.2, 1, p)})`, whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(0,0,0,0.18)' }}>{text}</div>
  );
};
const Story: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.story, 10);
  // r7: 20~25.3초 한 구성 5.3초 · 23~25초 멈춤 — 23초에 칸 4 창밖으로 다가간다.
  const zz = ease(f, B.storyZoom, 12, IN_OUT);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${mix(1, 1.32, zz) + 0.0008 * (f - B.story)})`, transformOrigin: '880px 720px' }}>
      <div style={{ position: 'absolute', left: 30, top: 560, width: 420, height: 560, background: WHITE, borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.12)', overflow: 'hidden', opacity: p, transform: `translateX(${mix(-40, 0, p)}px)` }}>
        <Img src={staticFile('real/sheet.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: 420, height: 560 }} />
      </div>
      <div style={{ position: 'absolute', left: 30, top: 440, width: 420, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 46, lineHeight: 1.2, color: INK, opacity: p }}>칸마다 참고로<br />넣은 인물 그림</div>
      <div style={{ position: 'absolute', left: 452, top: 780, fontFamily: KO, fontWeight: 900, fontSize: 80, color: INK, opacity: p }}>→</div>
      <Panel n={4} v="a" style={{ left: 530, top: 520, opacity: p }} />
      <Mark a={at('v4', '얼굴이랑')} x={620} y={1060} text="얼굴 ✓" color={GREEN} />
      <Mark a={at('v4', '옷은')} x={800} y={1060} text="옷 ✓" color={GREEN} />
      <Mark a={at('v4', '계절은')} x={700} y={560} text="창밖 계절 ✗" color={RED} />
      </div>
    </AbsoluteFill>
  );
};

/** 25.3~33.9초: 실제 지시문 카드 — 끝에 계절 줄이 쳐지고, 세 마디를 크게. */
// r4: 실제 지시문을 다 보이니 글이 작고 빨라 셋이 같이 짚었다 — 칸 4 줄 하나 뒤에 계절 줄이 붙는 것만 크게.
const PROMPT: string[] = [];
const SEASON = '계절: 3월 첫 주 이른 봄. 나무는 아직 잎 없는 맨가지(창밖 나무도 똑같이). 초록 잎 · 벚꽃 없음.';
const Fix: React.FC = () => {
  const f = useCurrentFrame();
  const inP = ease(f, B.card, 10);
  const typed = Math.round(interpolate(f, [B.type, B.h1 - 2], [0, SEASON.length], clamp));
  if (f < B.h2) {
    return (
      <AbsoluteFill style={{ background: PAPER }}>
        <Img src={staticFile('real/k4_a.jpg')} style={{ position: 'absolute', left: -60, top: 200, width: 1200, height: 1500, opacity: 0.35, filter: 'blur(6px)' }} />
        <div style={{ position: 'absolute', left: 50, top: 470, width: 980, background: WHITE, borderRadius: 22, padding: '34px 40px 40px', boxShadow: '0 6px 24px rgba(0,0,0,0.16)', fontFamily: KO, fontWeight: 700, fontSize: 46, lineHeight: 1.4, color: '#5A6273', letterSpacing: '-0.02em', opacity: inP, transform: `translateY(${mix(40, 0, inP)}px)` }}>
          <div style={{ fontWeight: 900, fontSize: 44, color: '#8A92A3', marginBottom: 8 }}>그림 AI에 보내는 글(지시문) 끝에 한 줄</div>
          {PROMPT.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          <div style={{ marginTop: 22, background: f >= B.h1 ? '#FFE7C2' : '#FFF4E3', borderRadius: 12, padding: '14px 18px', color: INK, fontWeight: 900, fontSize: 54, lineHeight: 1.35, minHeight: 220 }}>
            {SEASON.slice(0, typed)}
            {typed < SEASON.length && f >= B.type ? <span style={{ color: AMBER }}>▍</span> : null}
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  const parts: [string, number][] = [
    ['3월 첫 주, 나무는 아직 맨가지', B.card],
    ['창밖 나무도 똑같이', B.h2],
    ['초록 잎 · 벚꽃 없음', B.h3],
  ];
  // r5: 글줄만 8초 이어져 그림이 사라졌다(볼 이유 심사) — 칸 4를 두고 마지막 마디에 맨가지 판으로.
  const z = ease(f, B.h2, 10);
  const sw = ease(f, B.h3, 8, IN_OUT);
  return (
    <AbsoluteFill style={{ background: '#FFF4E3' }}>
      <div style={{ position: 'absolute', left: 280, top: 420, width: PW, height: PH, transform: `scale(${mix(0.97, 1, z)})` }}>
        <Panel n={4} v="a" style={{ left: 0, top: 0 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, opacity: sw }}>
          <Panel n={4} v="b" style={{ left: 0, top: 0 }} />
        </div>
      </div>
      {parts.map(([t, a], i) => {
        const p = ease(f, a, 8);
        return (
          <div key={i} style={{ position: 'absolute', left: 60, width: 960, top: 1090 + i * 104, textAlign: 'center', opacity: i === 0 ? 1 : p }}>
            <span style={{ display: 'inline-block', background: WHITE, borderRadius: 16, padding: '10px 26px 14px', borderLeft: `12px solid ${i === 2 ? RED : AMBER}`, fontFamily: KO, fontWeight: 900, fontSize: 54, color: INK, letterSpacing: '-0.03em', boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}>{t}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 33.9~44.4초: 컷 — 계절 줄 판 네 칸(r4: 덮기 중간에 두 판이 겹쳐 보였다) → 39.5 · 43.3 세로 웹툰처럼 두 칸씩. */
const Result: React.FC = () => {
  const f = useCurrentFrame();
  if (f < B.bag) {
    // r7: 35~39.5초 멈춤 · 한 구성 5.5초 — 천천히 다가가다 37초에 아래 줄(칸 3 · 4)로.
    const k = 1 + 0.0012 * (f - B.result);
    const lo = ease(f, B.lower, 12, IN_OUT);
    return (
      <AbsoluteFill style={{ background: PAPER }}>
        <Cam s={k * mix(1, 1.45, lo)} cx={540} cy={mix(Y0 + PH + 7, Y0 + PH + 14 + PH / 2, lo)} ty={mix(Y0 + PH + 7, 960, lo)}>
          <Page wipe={1} />
          {SPOT.map((t, i) => (
            <Ring key={i} a={B.wipeDone} x={t.x} y={t.y} w={t.w} h={t.h} label="맨가지" color={GREEN} size={36} lx={i % 2 ? t.x + t.w - 170 : t.x} ly={i === 3 ? t.y + t.h - 30 : undefined} />
          ))}
        </Cam>
      </AbsoluteFill>
    );
  }
  const pair = f < B.bag2 ? [1, 2] : [3, 4];
  const a = f < B.bag2 ? B.bag : B.bag2;
  const drift = (f - a) * 0.6;
  const W = 640;
  const H = Math.round((W * 1402) / 1122);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      {pair.map((n, i) => (
        <Img key={n} src={staticFile(`real/k${n}_b.jpg`)} style={{ position: 'absolute', left: 220, top: 430 + i * (H + 16) - drift, width: W, height: H, borderRadius: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }} />
      ))}
      {pair.map((n, i) => (
        <div key={`t${n}`} style={{ position: 'absolute', left: 870, top: 460 + i * (H + 16) - drift, background: INK, borderRadius: 12, padding: '4px 14px 8px', fontFamily: KO, fontWeight: 900, fontSize: 40, color: WHITE }}>칸 {n}</div>
      ))}
    </AbsoluteFill>
  );
};

/** 44.4초~끝: 같은 칸 4 — 계절 줄 없이 / 한 줄 나란히(가장 센 그림이 끝). */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const p = ease(f, B.end, 10);
  const lab = ease(f, B.end2, 8);
  const push = 1 + 0.0009 * (f - B.end);
  const fin = ease(f, B.fin, 6);
  const last = ease(f, B.last, 8, IN_OUT);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push * mix(1, 1.06, last)})`, transformOrigin: '75% 60%' }}>
        <Panel n={4} v="a" style={{ left: 13, top: 560, opacity: p * mix(1, 0.45, fin) }} />
        <Panel n={4} v="b" style={{ left: 547, top: 560, opacity: p, transform: `scale(${mix(1, 1.06, fin)})`, boxShadow: `0 0 0 ${Math.round(10 * fin)}px ${GREEN}` }} />
        <div style={{ position: 'absolute', left: 13, top: 490, width: PW, textAlign: 'center', opacity: lab }}>
          <span style={{ background: RED, borderRadius: 12, padding: '4px 16px 8px', fontFamily: KO, fontWeight: 900, fontSize: 42, color: WHITE }}>계절 줄 없이</span>
        </div>
        <div style={{ position: 'absolute', left: 547, top: 490, width: PW, textAlign: 'center', opacity: lab }}>
          <span style={{ background: GREEN, borderRadius: 12, padding: '4px 16px 8px', fontFamily: KO, fontWeight: 900, fontSize: 42, color: WHITE }}>계절 한 줄</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 1300, width: 1080, textAlign: 'center', fontFamily: KO, fontWeight: 700, fontSize: 34, color: 'rgba(29,35,48,0.6)', opacity: ease(f, B.brand - 30, 20) }}>@yuhobuilds</div>
    </AbsoluteFill>
  );
};

// ───────────── 자막 ─────────────
const KEY = ['맨가지', '초록', '계절', '삼월', '벚꽃', '이상한', '따로', '같은', '찾으셨어요'];
// 위 큰 글이 같은 말을 하는 자리(첫 질문 · 지시문 카드)는 자막을 비운다.
const CELLS: { a: number; b: number; text: string }[] = [
  { a: VO.v2, b: B.pair, text: '정문에선 나무가 거의 맨가지인데, 몇 분 뒤 강의실 창밖은 초록 잎이 가득해요.' },
  { a: B.pair, b: B.apart, text: '이른 봄, 삼월 초 이야기인데요.' },
  { a: B.apart, b: B.story, text: '칸마다 따로 그리니까, 계절을 안 적은 칸은 초록으로 채운 거예요.' },
  { a: B.story, b: B.card, text: '같은 인물 그림을 넣어도, 얼굴이랑 옷은 붙잡는데 계절은 안 붙잡아요.' },
  { a: B.card, b: B.type, text: '그래서 모든 칸 끝에 계절 한 줄을 붙였어요.' },
  { a: VO.v6, b: B.bag, text: '같은 네 칸을 다시 그리니까, 창밖까지 전부 맨가지가 됐어요.' },
  { a: B.bag, b: B.end, text: '얼굴, 옷, 가방, 창밖까지. 이제 네 칸이 같은 아침이에요.' },
  { a: VO.v8, b: TOTAL, text: '처음에, 몇 초 만에 찾으셨어요?' },
];
const Caption: React.FC = () => {
  const f = useCurrentFrame();
  const c = CELLS.find((x) => f >= x.a && f < x.b);
  if (!c) return null;
  const ws = c.text.split(' ');
  return (
    <div style={{ position: 'absolute', left: 60, width: 960, top: 285, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: WHITE, borderRadius: 22, padding: '14px 28px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 48, lineHeight: 1.26, letterSpacing: '-0.03em', wordBreak: 'keep-all', color: INK }}>
        {ws.map((w, k) => (
          <span key={k} style={{ color: KEY.some((x) => w.includes(x)) ? AMBER : INK }}>
            {w}
            {k < ws.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const HITS: Hit[] = [
  { at: B.hook, src: 'sfx/tok.wav', v: 0.16 },
  { at: B.read, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.game, src: 'sfx/swish.wav', v: 0.1 },
  { at: B.game + 24, src: 'sfx/tick.wav', v: 0.16 },
  { at: B.game + 54, src: 'sfx/tick.wav', v: 0.16 },
  { at: B.game + 84, src: 'sfx/tick.wav', v: 0.16 },
  { at: B.ring, src: 'sfx/ding.wav', v: 0.14 },
  { at: at('v2', '초록'), src: 'sfx/thud.wav', v: 0.22 },
  { at: B.pair, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.apart, src: 'sfx/snap.wav', v: 0.12 },
  { at: B.tags, src: 'sfx/tok.wav', v: 0.12 },
  { at: at('v4', '얼굴이랑'), src: 'sfx/tok.wav', v: 0.12 },
  { at: at('v4', '옷은'), src: 'sfx/tok.wav', v: 0.12 },
  { at: at('v4', '계절은'), src: 'sfx/thud.wav', v: 0.16 },
  { at: B.bag2, src: 'sfx/swish.wav', v: 0.1 },
  { at: B.card, src: 'sfx/swish.wav', v: 0.12 },
  { at: B.h2, src: 'sfx/tick2.wav', v: 0.14 },
  { at: B.h3, src: 'sfx/tick2.wav', v: 0.14 },
  { at: B.result, src: 'sfx/snap.wav', v: 0.14 },
  { at: B.wipeDone, src: 'sfx/ding.wav', v: 0.14 },
  { at: B.bag, src: 'sfx/swish.wav', v: 0.1 },
  { at: B.end, src: 'sfx/tok.wav', v: 0.14 },
];

// ───────────── 본편 ─────────────
const Scene: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b) return null;
  return <>{children}</>;
};

export const SeasonFilm: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const voice = ORDER.map((id) => [VO[id], lineEnd(id)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (TOTAL - fr) / 15);
    const v = Math.max(0, ...voice.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.3 - 0.13 * v) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Scene a={0} b={B.tree}>
        <Open />
      </Scene>
      <Scene a={B.tree} b={B.pair}>
        <Reveal />
      </Scene>
      <Scene a={B.pair} b={B.story}>
        <Why />
      </Scene>
      <Scene a={B.story} b={B.card}>
        <Story />
      </Scene>
      <Scene a={B.card} b={B.result}>
        <Fix />
      </Scene>
      <Scene a={B.result} b={B.end}>
        <Result />
      </Scene>
      <Scene a={B.end} b={TOTAL}>
        <End />
      </Scene>
      <Caption />
      {ORDER.map((id) => (
        <Sequence key={id} from={VO[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {HITS.map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile('bgm.wav')} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

/** 표지: 같은 칸 4 둘 나란히 + 머리글. */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    <Panel n={4} v="a" style={{ left: 13, top: 520 }} />
    <Panel n={4} v="b" style={{ left: 547, top: 520 }} />
    <div style={{ position: 'absolute', left: 60, width: 960, top: 300, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: WHITE, borderRadius: 26, padding: '16px 34px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', fontFamily: KO, fontWeight: 900, fontSize: 70, color: INK, letterSpacing: '-0.035em', lineHeight: 1.2, textAlign: 'center' }}>
        몇 분 사이에 <span style={{ color: RED }}>계절이 바뀐</span>
        <br />
        AI 웹툰
      </div>
    </div>
  </AbsoluteFill>
);
