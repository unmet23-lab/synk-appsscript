// yuhobuilds 「자고 일어나면 영상이 와 있어요」(10-26, 장부 Y9). 기획 · 콘티는 ../../../기획.md.
// 문법은 만족 사례 S22(검정 무대 · 흰 글 · 버터 한 곳, 머리글이 곧 내레이션)와 Y5(10-25) 그대로 — 앞 두 줄은 사진.
//  · 실제 화면: 10-26 ego에서 휴대폰 크기(393×852 · 3배)로 찍은 검토 페이지(Y5 편, 승인된 지금 상태)와
//    그 페이지가 트는 Y5 최종본, 인스타 @yuhobuilds 프로필(../../../자료/검토화면/). 자리 값은 DOM으로 잰 CSS px(393 폭).
//  · 이해 시험 2회(v2 3점 · v4 2점): 폰 속 Y5 영상의 글(「종이봉투처럼 바뀌었어요」)을 이 영상의 이야기로 읽었고,
//    휴대폰 틀 안 작은 글씨 화면은 끝내 안 읽혔다 → v5: 「도착」은 사진 속 폰으로 계속 다가가며 폰 속 영상은 살짝 흐리게(글이 아니라
//    「영상 한 편」으로 읽히게), 승인 · 결과 · 프로필은 휴대폰 틀 없이 필요한 부분만 크게 잘라 판 하나로.
//  · 「승인하기」를 누르는 판에는 그 위 「주고받은 의견」 카드(지금 상태의 승인 기록 10-26 01:54)를 넣지 않고,
//    누른 뒤 판에는 「게시 10월 25일 (일) 오후 9:00」 칩을 넣지 않는다 — Y5는 그 시각에 승인이 없어 안 나갔다(Fable 사실 검수 1 · 2).
//  · 버터는 사람이 누르는 자리와 그 결과(승인 · 알아서 · 규칙)와 우리 덧붙임 꼬리표에만.
import { Audio } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BUTTER, INK, STAGE } from '../film/parts';
import { KO } from '../lib/fonts';
import { clamp } from '../lib/motion';
import { EndCard, endFollow } from './End';
import { at, lineEnd, TIMING, VO, type Cut, type Timing } from './time';
import { ease, EASE_MOVE, Line } from './Type';

const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 잘라 낸다 — 모든 소리에 같은 값을 곱한다(현장 노트)
const MUTED = '#8E8B84';
const FRAME = '#3A3833';
const PAGE_H = 4766; // 검토 페이지 전체 높이(CSS)
const IG_H = 852;

type R = { x: number; y: number; w: number; h: number };
// round-10 · round-12(10-26 21:2x)에서 DOM으로 잰 상자(CSS px, 페이지 맨 위 기준) — 자료/검토화면/자리_*.json
const BOX = {
  approve: { x: 34, y: 4505.2, w: 325.3, h: 52 },
  igFirst: { x: 0, y: 390.7, w: 129.3, h: 173.3 }, // 인스타 프로필 맨 앞칸(그 영상) — 캡처에서 잰 값
} satisfies Record<string, R>;
// 판 하나로 크게 보일 실제 화면 조각(CSS px)
const CROP = {
  buttons: { x: 18, y: 4434, w: 357, h: 138 }, // 「의견만 남기기 · 수정 요청하기」 + 「승인하기」 — 위 의견 칸 · 승인 기록은 빼고
  done: { x: 8, y: 170, w: 377, h: 116 }, // 「승인됐어요. 남은 확인이 없으면 예약한 때에 그대로 올라가요.」 + 「승인됨」 칩
  ig: { x: 0, y: 284, w: 393, h: 288 }, // 팔로우 단추 줄부터 맨 앞 줄 칸까지(v6: 소개 글 줄이 반쯤 잘려 보였다)
} satisfies Record<string, R>;

// ───────────── 장면 ─────────────
const SC = {
  approve: VO.a1 - 4, // 사진 → 「승인하기」 판
  rule: VO.r1 - 6,
  prompt: VO.p1 - 4, // 같은 카드가 규칙 → 요청문 전문으로
  cta: VO.c1 - 6,
};
const EV = {
  tap: at('a1', '승인만') + 2, // 승인하기 누름
  done: VO.a2 - 2, // 누른 뒤 페이지 맨 위 문장 — 「그럼 정한 시간에」와 「예약한 때에 그대로 올라가요」를 맞춘다(v6: 단추 판이 0.8초뿐이라 짧았다)
  ig: at('a2', '알아서') - 4, // 인스타 프로필
};

/** 장면 하나: a에 아래에서 올라와 들어오고 b에 위로 빠진다(8프레임 겹침). 그사이 천천히 밀린다. */
const Scene: React.FC<{ a: number; b: number; children: React.ReactNode; from?: number }> = ({ a, b, children, from = 46 }) => {
  const f = useCurrentFrame();
  if (f < a || f >= b + 8) return null;
  const pin = a === 0 ? 1 : ease(f, a, 9);
  const pout = ease(f, b, 8, EASE_MOVE);
  const s = 1 + Math.min(0.05, 0.0007 * (f - a));
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * from - pout * 46}px) scale(${s})`, transformOrigin: '50% 55%' }}>{children}</div>
  );
};

/** 우리 덧붙임 꼬리표(버터) — 앱 화면의 일부가 아니라는 것이 보이게 Y5 「+ 한 줄」과 같은 꼴. */
const Tag: React.FC<{ x: number; y: number; text: string; p: number }> = ({ x, y, text, p }) =>
  p <= 0 ? null : (
    <div style={{ position: 'absolute', left: x, top: y, padding: '12px 26px 14px', borderRadius: 18, background: BUTTER, boxShadow: '0 6px 18px rgba(0,0,0,0.45)', fontFamily: KO, fontWeight: 780, fontSize: 40, letterSpacing: '-0.02em', color: '#121211', whiteSpace: 'nowrap', opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
      {text}
    </div>
  );

// ───────────── 장면 1·2 · 사진 — 와 있음 → AI가 만든 것 ─────────────
// 이해 시험 1회: 「폰 화면이 흰색이라 영상이 왔다는 느낌이 안 난다」 → 사진 속 폰 화면(빈 흰색)에 그 영상(Y5 최종본, 실제 파일)을 원근대로 얹는다.
// 폰 화면 네 꼭짓점: 사진 941×1672에서 흰 화면을 cv2로 잰 값(왼쪽 위 · 오른쪽 위 · 오른쪽 아래 · 왼쪽 아래, 노치 쪽이 위).
const PHOTO_K = 1920 / 1672; // objectFit cover — 세로가 맞고 가로는 0.3px 넘친다
const PHOTO_X0 = (1080 - 941 * PHOTO_K) / 2;
const QUAD_PHOTO: [number, number][] = [
  [271, 1131],
  [459, 1105],
  [677, 1284],
  [428, 1328],
];
const QC = QUAD_PHOTO.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
// 흰 테가 안 남게 3% 넓힌다(v3: 1.2%는 아래 · 오른쪽 가장자리에 흰 실선이 남음 — 넘친 만큼은 검은 테 위)
const QUAD = QUAD_PHOTO.map(([x, y]) => [PHOTO_X0 + (QC[0] + (x - QC[0]) * 1.03) * PHOTO_K, (QC[1] + (y - QC[1]) * 1.03) * PHOTO_K] as [number, number]);
const SCREEN = { w: 1080, h: 2340 }; // 폰 화면 비(9:19.5) — 9:16 영상은 위아래 검은 띠
/** 원 판(0,0)-(w,h)을 네 점으로 보내는 CSS matrix3d(투영 변환, 가우스 소거 8×8). */
const homography = (w: number, h: number, q: [number, number][]) => {
  const src = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const A: number[][] = [];
  const b: number[] = [];
  src.forEach(([x, y], i) => {
    const [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      for (let j = c; j < 8; j++) A[r][j] -= k * A[c][j];
      b[r] -= k * b[c];
    }
  }
  const [a, bb, c, d, e, ff, g, hh] = b.map((v, i) => v / A[i][i]);
  return `matrix3d(${[a, d, 0, g, bb, e, 0, hh, 0, 0, 1, 0, c, ff, 0, 1].map((x) => +x.toFixed(10)).join(',')})`;
};
const SCREEN_M = homography(SCREEN.w, SCREEN.h, QUAD);
const PHONE_C: [number, number] = [(QUAD[0][0] + QUAD[2][0]) / 2, (QUAD[0][1] + QUAD[2][1]) / 2];
const HOOK_ORIGIN = `${PHONE_C[0].toFixed(1)}px ${PHONE_C[1].toFixed(1)}px`;

/** 사진과 폰 화면 속 영상(같은 판에서 같이 밀린다). play가 false면 영상 첫 장면 정지 그림(표지). soft는 폰 속 영상 흐림(px, 원 판 기준). */
const BedPhoto: React.FC<{ transform: string; play?: boolean; soft?: number }> = ({ transform, play = true, soft = 0 }) => (
  <div style={{ position: 'absolute', inset: 0, transform, transformOrigin: HOOK_ORIGIN }}>
    <Img src={staticFile('img/bed.png')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover' }} />
    <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN.w, height: SCREEN.h, transformOrigin: '0 0', transform: SCREEN_M, borderRadius: 120, overflow: 'hidden', background: '#060606' }}>
      <div style={{ position: 'absolute', inset: 0, filter: soft > 0 ? `blur(${soft.toFixed(1)}px)` : undefined }}>
        {play ? (
          <OffthreadVideo src={staticFile('clip/y5.mp4')} muted style={{ position: 'absolute', left: 0, top: (SCREEN.h - 1920) / 2, width: 1080, height: 1920 }} />
        ) : (
          <Img src={staticFile('img/y5_first.png')} style={{ position: 'absolute', left: 0, top: (SCREEN.h - 1920) / 2, width: 1080, height: 1920 }} />
        )}
      </div>
      {/* 창 빛이 화면에 비친 결 */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,246,228,0.16) 0%, rgba(255,246,228,0.04) 38%, rgba(255,246,228,0) 60%)' }} />
    </div>
  </div>
);

// 「AI가 아침 7시부터」에서 폰으로 다가간다: 폰 가운데를 (540, 1010)으로 올리며 1.08 → 1.85배. 폰 속 영상은 다가갈수록 조금씩 흐리게.
const PhotoScene: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= SC.approve + 8) return null;
  const pre = interpolate(f, [0, VO.h2 - 6], [1, 1.08], clamp);
  const near = ease(f, VO.h2 - 6, Math.max(1, SC.approve - VO.h2 + 4), EASE_MOVE);
  const s = pre * (1 + 0.72 * near);
  const tx = (540 - PHONE_C[0]) * near;
  const ty = (1010 - PHONE_C[1]) * near;
  const tag = ease(f, at('h2', '혼자') - 2, 8);
  return (
    <AbsoluteFill style={{ opacity: 1 - ease(f, SC.approve, 8) }}>
      <BedPhoto transform={`translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`} soft={10 * near} />
      {/* 머리글 자리만 살짝 어둡게(밝은 벽 위 흰 글) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 760, background: 'linear-gradient(180deg, rgba(10,10,10,0.42) 0%, rgba(10,10,10,0.18) 60%, rgba(10,10,10,0) 100%)' }} />
      <Tag x={300} y={1310} text="AI가 만든 영상" p={tag} />
    </AbsoluteFill>
  );
};

/** 검은 띠 머리글(사진 위). 줄마다 띠 하나, Type.Line과 같은 올림. at이 0이면 0프레임부터 다 보인다(표지 노릇). */
const BoxLine: React.FC<{ lines: string[]; accent?: string; at?: number; until: number }> = ({ lines, accent, at: a = 0, until }) => {
  const f = useCurrentFrame();
  if (f >= until || (a > 0 && f < a)) return null;
  return (
    <div style={{ position: 'absolute', left: 72, top: 286, fontFamily: KO, fontWeight: 760, fontSize: 84, lineHeight: 1.0, letterSpacing: '-0.035em', color: INK, opacity: 1 - ease(f, until - 8, 8) }}>
      {lines.map((ln, i) => {
        const k = accent ? ln.indexOf(accent) : -1;
        const p = a <= 0 ? 1 : ease(f, a + 3 * i, 10);
        return (
          <div key={i} style={{ display: 'table', marginBottom: 14, padding: '16px 26px 20px', borderRadius: 22, background: 'rgba(10,10,10,0.9)', opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
            {k < 0 ? (
              ln
            ) : (
              <>
                {ln.slice(0, k)}
                <span style={{ color: BUTTER }}>{accent}</span>
                {ln.slice(k + accent!.length)}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ───────────── 장면 3·4 · 승인 → 알아서 올라감 — 실제 화면 조각을 판 하나로 크게 ─────────────
const PANEL_X = 60;
const PANEL_W = 860; // 오른쪽 끝 920 — 릴스 단추 자리 밖
const PANEL_Y = 640;
/** 실제 화면 한 조각(src 그림의 crop 부분)을 판에 맞춘다. */
const Shot: React.FC<{ src: string; crop: R; fullH: number; children?: React.ReactNode; p?: number; dy?: number }> = ({ src, crop, fullH, children, p = 1, dy = 0 }) => {
  if (p <= 0) return null;
  const k = PANEL_W / crop.w;
  return (
    <div style={{ position: 'absolute', left: PANEL_X, top: PANEL_Y + dy, width: PANEL_W, height: crop.h * k, borderRadius: 30, overflow: 'hidden', background: '#08080A', boxShadow: `inset 0 0 0 2px ${FRAME}, 0 30px 90px rgba(0,0,0,0.6)`, opacity: p }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left: -crop.x * k, top: -crop.y * k, width: 393 * k, height: fullH * k }} />
      {children}
    </div>
  );
};
const ScreenScene: React.FC = () => {
  const f = useCurrentFrame();
  const kB = PANEL_W / CROP.buttons.w;
  const kI = PANEL_W / CROP.ig.w;
  const toDone = ease(f, EV.done, 10);
  const toIg = ease(f, EV.ig, 10, EASE_MOVE);
  const tapRing = ease(f, EV.tap - 10, 6);
  const press = ease(f, EV.tap, 3) * (1 - ease(f, EV.tap + 4, 8));
  const tapDot = ease(f, EV.tap - 8, 5) * (1 - ease(f, EV.tap + 10, 8));
  const igRing = ease(f, EV.ig + 10, 6);
  const btn = BOX.approve;
  const cell = BOX.igFirst;
  return (
    <>
      {/* 「올리기 전 확인 화면」 — 승인하기 단추(위 의견 칸 · 승인 기록은 판 밖) */}
      <Shot src="shot/page.png" crop={CROP.buttons} fullH={PAGE_H} p={1 - toDone} dy={-toDone * 40}>
        <div
          style={{
            position: 'absolute',
            left: (btn.x - CROP.buttons.x - 5) * kB,
            top: (btn.y - CROP.buttons.y - 5) * kB,
            width: (btn.w + 10) * kB,
            height: (btn.h + 10) * kB,
            borderRadius: 44,
            boxShadow: `0 0 0 6px ${BUTTER}`,
            opacity: tapRing,
            transform: `scale(${1.04 - 0.04 * tapRing})`,
          }}
        />
        {tapDot > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: (btn.x - CROP.buttons.x + btn.w * 0.64) * kB - 56,
              top: (btn.y - CROP.buttons.y + btn.h / 2) * kB - 56,
              width: 112,
              height: 112,
              borderRadius: 56,
              background: 'rgba(244,242,236,0.42)',
              boxShadow: '0 0 0 4px rgba(244,242,236,0.8)',
              opacity: tapDot,
              transform: `scale(${1 - 0.22 * press})`,
            }}
          />
        ) : null}
      </Shot>
      {/* 누른 뒤 — 같은 페이지 맨 위 문장 */}
      <Shot src="shot/page.png" crop={CROP.done} fullH={PAGE_H} p={toDone * (1 - toIg)} dy={(1 - toDone) * 40 - toIg * 40} />
      {/* 인스타 프로필 — 맨 앞칸이 그 영상 */}
      <Shot src="shot/ig_profile.png" crop={CROP.ig} fullH={IG_H} p={toIg} dy={(1 - toIg) * 40}>
        <div
          style={{
            position: 'absolute',
            left: (cell.x - CROP.ig.x) * kI + 3,
            top: (cell.y - CROP.ig.y) * kI + 3,
            width: cell.w * kI - 6,
            height: cell.h * kI - 6,
            borderRadius: 10,
            boxShadow: `0 0 0 6px ${BUTTER}`,
            opacity: igRing,
          }}
        />
      </Shot>
      <Tag x={PANEL_X} y={PANEL_Y - 92} text="올리기 전 확인 화면" p={ease(f, SC.approve + 4, 8) * (1 - toIg)} />
      <Tag x={PANEL_X} y={PANEL_Y - 92} text="인스타에 올라감" p={ease(f, EV.ig + 6, 8)} />
    </>
  );
};

// ───────────── 장면 5 · 규칙 한 줄 → 그 규칙을 넣은 요청문(같은 카드) ─────────────
const RULE_SEGS: [string, string][][] = [
  [['내가 ', '내가'], ['승인하기 전엔,', '승인하기']],
  [['올리지 마.', '올리지']],
];
// 요청문 전문(synk.im/prompts 「approve-before-post」와 같은 글, 빈칸은 기본값). 규칙 줄만 버터.
const PROMPT_LINES: [string, boolean][] = [
  ['매일 아침 7시마다 이 일을 해 줘:', false],
  ['오늘 올릴 인스타 글 한 편 쓰기.', false],
  ['다 하면 결과를 나에게 먼저 보여 줘.', false],
  ['내가 「승인」이라고 답하기 전에는', true],
  ['어디에도 올리거나, 보내거나, 예약하지 마.', true],
];
const RuleScene: React.FC = () => {
  const f = useCurrentFrame();
  const a = SC.rule + 6;
  const card = ease(f, SC.rule, 10);
  const toPrompt = ease(f, SC.prompt, 12, EASE_MOVE);
  // 이해 시험 2회: 「규칙 문구 화면이 말 없이 길게 이어진다」 — 처음부터 흰 글로 다 보이고, 「승인하기 전엔」을 읽을 때 버터(v7: 낱말을 inline-block으로 키우면 띄어쓰기가 사라져 뺐다)
  return (
    <div style={{ position: 'absolute', left: 72, top: 560, width: 848, height: 520 + 130 * toPrompt, borderRadius: 30, background: '#161614', boxShadow: `inset 0 0 0 2px ${FRAME}`, opacity: card, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - toPrompt, transform: `translateY(${-toPrompt * 40}px)` }}>
        <div style={{ position: 'absolute', left: 56, top: 50, fontFamily: KO, fontWeight: 700, fontSize: 38, color: '#B6B3AB' }}>AI한테 준 규칙</div>
        <div style={{ position: 'absolute', left: 56, right: 40, top: 150, fontFamily: KO, fontWeight: 780, fontSize: 96, lineHeight: 1.3, letterSpacing: '-0.04em' }}>
          {RULE_SEGS.map((segs, i) => {
            const p = ease(f, a + 3 * i, 10);
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, whiteSpace: 'nowrap' }}>
                {segs.map(([txt, word], k) => {
                  const lit = ease(f, at('r1', word) - 3, 5);
                  const key = word === '승인하기';
                  return (
                    <span key={k} style={{ color: key && lit > 0.5 ? BUTTER : INK }}>
                      {txt}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {toPrompt > 0 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: toPrompt, transform: `translateY(${(1 - toPrompt) * 40}px)` }}>
          <div style={{ position: 'absolute', left: 56, top: 46, fontFamily: KO, fontWeight: 700, fontSize: 36, color: '#B6B3AB' }}>AI에게 붙여 넣는 요청문 · 전문은 아래 글에</div>
          <div style={{ position: 'absolute', left: 56, right: 40, top: 118, fontFamily: KO, fontWeight: 700, fontSize: 44, lineHeight: 1.55, letterSpacing: '-0.03em' }}>
            {PROMPT_LINES.map(([ln, key], i) => (
              <div key={i} style={{ color: key ? BUTTER : '#D9D6CE', whiteSpace: 'nowrap', opacity: ease(f, SC.prompt + 4 + 3 * i, 8) }}>
                {ln}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ───────────── 장면 6 · 끝 질문 — 댓글 칸과 예시 셋(지어낸 남의 댓글처럼 보이지 않게 「예」 칩으로) ─────────────
const EXAMPLES: [string, string][] = [
  ['블로그 글', '매일'],
  ['가게 공지', '맡기고'],
  ['주간 보고', '댓글로'],
];
const CtaScene: React.FC = () => {
  const f = useCurrentFrame();
  const rise = (p: number): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 16}px)` });
  const box = ease(f, SC.cta, 10);
  return (
    <div style={{ position: 'absolute', left: 72, top: 560, width: 848, height: 470, borderRadius: 30, background: '#161614', boxShadow: `inset 0 0 0 2px ${FRAME}`, opacity: box }}>
      <div style={{ position: 'absolute', left: 48, top: 46, fontFamily: KO, fontWeight: 640, fontSize: 32, color: MUTED }}>댓글</div>
      <div style={{ position: 'absolute', left: 48, right: 48, top: 104, height: 108, borderRadius: 26, background: '#121210', boxShadow: `inset 0 0 0 2px ${FRAME}` }}>
        <div style={{ position: 'absolute', left: 32, top: 0, height: 108, display: 'flex', alignItems: 'center', fontFamily: KO, fontWeight: 680, fontSize: 40, color: '#5A5852' }}>매일 AI한테 맡기고 싶은 일은?</div>
      </div>
      <div style={{ position: 'absolute', left: 48, top: 262, fontFamily: KO, fontWeight: 640, fontSize: 30, color: MUTED }}>예를 들면</div>
      <div style={{ position: 'absolute', left: 48, right: 40, top: 320, display: 'flex', gap: 18 }}>
        {EXAMPLES.map(([txt, word], i) => (
          <div key={i} style={{ padding: '18px 28px', borderRadius: 999, background: '#22211E', boxShadow: `inset 0 0 0 2px ${FRAME}`, fontFamily: KO, fontWeight: 700, fontSize: 38, color: INK, letterSpacing: '-0.02em', ...rise(ease(f, at('c1', word) - 2, 9)) }}>
            {txt}
          </div>
        ))}
      </div>
    </div>
  );
};

// ───────────── 머리글 ─────────────
const Heads: React.FC<{ t: Timing }> = ({ t }) => (
  <>
    <BoxLine lines={['자고 일어나면', '영상이 와 있어요']} accent="영상" until={VO.h2 - 3} />
    <BoxLine lines={['AI가 아침 7시부터', '혼자 만든 영상']} accent="혼자 만든" at={VO.h2 - 3} until={SC.approve + 2} />
    <Line lines={['저는 보고', '승인만 눌러요']} accent="승인" at={VO.a1 - 3} until={VO.a2 - 3} />
    <Line lines={['정한 시간에', '알아서 올라가요']} accent="알아서" at={VO.a2 - 3} until={SC.rule} />
    <Line lines={['AI가 혼자 못 올리게', '규칙 하나는 꼭']} accent="규칙 하나" at={VO.r1 - 3} until={SC.prompt} />
    <Line lines={['이 규칙을 넣은 요청문은', '아래 글에 그대로']} accent="아래 글에" at={VO.p1 - 3} until={SC.cta} />
    <Line lines={['여러분은 AI한테', '매일 뭘 맡기고 싶어요?']} accent="매일" at={VO.c1 - 3} until={t.end} />
  </>
);

// ───────────── 소리 ─────────────
type Hit = { at: number; src: string; v: number };
const hits = (t: Timing): Hit[] => [
  { at: VO.h2 - 6, src: 'sfx/swish.wav', v: 0.14 },
  { at: SC.approve - 2, src: 'sfx/swish.wav', v: 0.18 },
  { at: EV.tap, src: 'sfx/tok.wav', v: 0.32 },
  { at: EV.done, src: 'sfx/tick2.wav', v: 0.16 },
  { at: EV.ig, src: 'sfx/snap.wav', v: 0.18 },
  ...[SC.rule, SC.cta].map((a) => ({ at: a - 2, src: 'sfx/swish.wav', v: 0.15 })),
  { at: at('r1', '승인하기') - 1, src: 'sfx/tick.wav', v: 0.16 },
  { at: SC.prompt, src: 'sfx/snap.wav', v: 0.14 },
  ...EXAMPLES.map(([, w]) => ({ at: at('c1', w) - 2, src: 'sfx/tick.wav', v: 0.12 })),
  { at: t.end, src: 'sfx/swish.wav', v: 0.18 },
  { at: endFollow(t), src: 'sfx/tok.wav', v: 0.42 },
];

// ───────────── 본편 ─────────────
export const MorningFilm: React.FC<{ cut: Cut; bgm?: boolean }> = ({ cut, bgm = true }) => {
  const t = TIMING[cut];
  const ranges = t.order.map((id) => [t.vo[id], lineEnd(id, t)] as [number, number]);
  const bgmVolume = (fr: number) => {
    const tail = Math.min(1, (t.total - fr) / 20);
    const voice = Math.max(0, ...ranges.map(([a, b]) => interpolate(fr, [a - 10, a, b, b + 10], [0, 1, 1, 0], clamp)));
    return (0.42 - 0.16 * voice) * tail * MASTER;
  };
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <Stage t={t} />
      <Heads t={t} />
      <EndGate t={t} />
      {t.order.map((id) => (
        <Sequence key={id} from={t.vo[id]} layout="none">
          <Audio src={staticFile(`vo/${id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {hits(t).map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={60} layout="none">
          <Audio src={staticFile(x.src)} volume={x.v * MASTER} />
        </Sequence>
      ))}
      {bgm ? <Audio src={staticFile(`bgm_${cut}.wav`)} volume={bgmVolume} /> : null}
    </AbsoluteFill>
  );
};

const Stage: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  if (f >= t.end + 8) return null;
  const gone = ease(f, t.end, 8);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone }}>
      <PhotoScene />
      <Scene a={SC.approve} b={SC.rule}>
        <ScreenScene />
      </Scene>
      <Scene a={SC.rule} b={SC.cta}>
        <RuleScene />
      </Scene>
      <Scene a={SC.cta} b={t.end}>
        <CtaScene />
      </Scene>
    </div>
  );
};

const EndGate: React.FC<{ t: Timing }> = ({ t }) => {
  const f = useCurrentFrame();
  if (f < t.end) return null;
  return (
    <AbsoluteFill style={{ opacity: ease(f, t.end, 8) }}>
      <EndCard t={t} />
    </AbsoluteFill>
  );
};

/** 표지: 첫 장면 사진(폰 화면에 그 영상 첫 장면) + 머리글(S22 표지 규칙 — 큰 제목은 약속, 작은 줄은 답). */
export const CoverStill: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <BedPhoto transform="scale(1.04)" play={false} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 900, background: 'linear-gradient(180deg, rgba(10,10,10,0.5) 0%, rgba(10,10,10,0.2) 60%, rgba(10,10,10,0) 100%)' }} />
    <div style={{ position: 'absolute', left: 72, top: 300, fontFamily: KO, fontWeight: 760, fontSize: 84, lineHeight: 1.0, letterSpacing: '-0.035em', color: INK }}>
      {['자고 일어나면', '영상이 와 있어요'].map((ln, i) => (
        <div key={i} style={{ display: 'table', marginBottom: 14, padding: '16px 26px 20px', borderRadius: 22, background: 'rgba(10,10,10,0.9)' }}>
          {i === 1 ? (
            <>
              <span style={{ color: BUTTER }}>영상</span>이 와 있어요
            </>
          ) : (
            ln
          )}
        </div>
      ))}
      <div style={{ display: 'table', marginTop: 8, padding: '12px 22px 14px', borderRadius: 18, background: 'rgba(10,10,10,0.82)', fontSize: 44, fontWeight: 680, color: '#D9D6CE', letterSpacing: '-0.02em' }}>AI가 만들고, 저는 승인만</div>
    </div>
  </AbsoluteFill>
);
