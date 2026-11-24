// 「긴 지시문을 스킬 하나로」 본편 — 수요 장부 yuhobuilds 1번(클로드가 처음이면 스킬과 연결 도구, 11-24 · 장부 Y78).
// 처음과 끝은 몽글이 장면(구운 그림 · 눈 둘레 조각만 바꿔 끼운다), 가운데는 범수 보이스오버와 실제 결과 화면이다.
// 결과는 2026-11-24에 직접 돌린 세 보고다(기획.md 「실험 기록」 · 시안/실험/): 지시문을 붙인 보고 · 「주간 보고 써 줘」만 한 보고 · /주간보고로 부른 보고.
// 화면 결: 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나. 안전 영역 x 65~920 · y 269~1428.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, OUT } from '../lib/motion';
import { BGM, LEN, P2G_AT, SFX, SFX_END, T, TG, VO } from './timeline';
import { INSTR, OURS } from './data';

export type Ending = 'dm' | 'post';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const INK = '#0A0A0A';
const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const SUB = 'rgba(255,255,255,0.7)';
const CAP = 'rgba(255,255,255,0.84)';
const LEFT = 79;
const MASTER = 0.8;

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.22) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
/** 몽글이 장면의 빛 숨결 — 2.4초에 한 번 6%만(몽글이는 크게 움직이지 않고 빛으로 작게, 11-20 유호님). */
const glow = (t: number) => 1 + 0.06 * Math.sin((2 * Math.PI * t) / 2.4);
const settle = (t: number, a: number) => 1.035 - 0.035 * appear(t, a, 0.34);

// ───────────────────────── 부품 ─────────────────────────

type Line = { at: number; node: React.ReactNode; size: number; color?: string; gap?: number };
const Head: React.FC<{ t: number; lines: Line[]; top: number; left?: number }> = ({ t, lines, top, left = LEFT }) => (
  <div style={{ position: 'absolute', left, top, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap' }}>
    {lines
      .filter((l) => t >= l.at - 0.001)
      .map((l, i) => {
        const p = l.at <= 0 ? 1 : appear(t, l.at);
        return (
          <div key={i} style={{ fontSize: l.size, color: l.color ?? WHITE, opacity: p, transform: `translateY(${(1 - p) * 28}px)`, marginTop: l.gap ?? 0 }}>
            {l.node}
          </div>
        );
      })}
  </div>
);

const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

const Tag: React.FC = () => (
  <div style={{ position: 'absolute', left: 84, top: 286, fontFamily: KO, fontSize: 34, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap' }}>
    yuhobuilds<span style={{ fontWeight: 500, opacity: 0.7, marginLeft: 16 }}>AI와 회사 만들기</span>
  </div>
);

const Cap: React.FC<{ t: number; at: number; x: number; y: number; size?: number; children: React.ReactNode }> = ({ t, at, x, y, size = 44, children }) => {
  const p = appear(t, at, 0.26);
  if (p <= 0) return null;
  return <div style={{ position: 'absolute', left: x, top: y + (1 - p) * 20, opacity: p, fontFamily: KO, fontSize: size, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.28, color: CAP, whiteSpace: 'nowrap', textShadow: '0 2px 14px rgba(0,0,0,0.75)' }}>{children}</div>;
};

type Eye = { x: number; y: number; rx: number; ry: number };
const Mong: React.FC<{ a: string; b: string; mix: number; eye: Eye; top: number; s: number; ox: number; oy: number; solid: number; fade: number; light?: number }> = ({ a, b, mix, eye, top, s, ox, oy, solid, fade, light = 1 }) => {
  const mask = `radial-gradient(ellipse ${eye.rx}px ${eye.ry}px at ${eye.x}px ${eye.y}px, #000 58%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: INK }}>
      <div style={{ position: 'absolute', left: 0, top, width: 1080, height: 1620, transform: `scale(${s})`, transformOrigin: `${ox}px ${oy}px`, filter: `brightness(${light})` }}>
        <Img src={staticFile(a)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620 }} />
        {mix > 0 && <Img src={staticFile(b)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620, opacity: mix, WebkitMaskImage: mask, maskImage: mask }} />}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) ${solid}px, rgba(10,10,10,0) ${fade}px)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 420, background: 'linear-gradient(0deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 120px, rgba(10,10,10,0) 420px)' }} />
    </AbsoluteFill>
  );
};

/** 실제 보고 화면(문서 보기를 2배로 찍은 그림 · 1696px 폭) 한 장. 화면 x · y에 놓고 배율 s(1이면 그림 1px = 화면 1px). */
type Box = { x: number; y: number; w: number; h: number; at: number };
const Shot: React.FC<{ src: string; x: number; y: number; s: number; w?: number; h?: number; o?: number; dim?: number; boxes?: Box[]; t: number }> = ({ src, x, y, s, w = 1696, h = 1562, o = 1, dim = 0, boxes = [], t }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${s})`, transformOrigin: '0 0', opacity: o }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, backgroundColor: '#fff', borderRadius: 16 / s, overflow: 'hidden' }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: w }} />
    </div>
    {dim > 0 && <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, backgroundColor: `rgba(10,10,10,${dim})`, borderRadius: 16 / s }} />}
    {boxes.map((b, i) => {
      const p = appear(t, b.at, 0.25);
      return p > 0 ? <div key={i} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: 10, border: `${5 / s}px solid ${BUTTER}`, opacity: p, transform: `scale(${1.04 - 0.04 * p})` }} /> : null;
    })}
  </div>
);

// ───────────────────────── 장면 ─────────────────────────

/** ① 처음 — 바닥까지 늘어진 긴 지시문 종이 앞의 몽글이. 0초부터 「매주 붙여 넣던 지시문 392자」, 1.75초 「이제 한 마디로」. */
const Opening: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const drift = 1 + 0.07 * interpolate(t, [0, T.bad], [0, 1], clamp);
  const lean = 0.03 * interpolate(t, [T.eye - 0.1, T.eye + 0.4], [0, 1], { ...clamp, easing: IN_OUT });
  const pulse = 1 + 0.05 * interpolate(t, [T.l3, T.l3 + 0.12, T.l3 + 0.5], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Mong a="mong/a.jpg" b="mong/a2.jpg" mix={interpolate(t, [T.eye - 0.2, T.eye + 0.2], [0, 1], clamp)} eye={{ x: 756, y: 860, rx: 150, ry: 80 }} top={150} ox={540} oy={1050} s={drift + lean} solid={430} fade={700} light={glow(t)} />
      <Tag />
      <Head
        t={t}
        top={346}
        lines={[
          { at: 0, node: '매주 붙여 넣던', size: 92, color: 'rgba(255,255,255,0.86)' },
          { at: T.l2, node: <>지시문 <Gold>392자</Gold></>, size: 112 },
          {
            at: T.l3,
            node: (
              <span style={{ display: 'inline-block', transform: `scale(${pulse})`, transformOrigin: '0 80%' }}>
                이제 <Gold>한 마디</Gold>로
              </span>
            ),
            size: 118,
            gap: 6,
          },
        ]}
      />
    </AbsoluteFill>
  );
};

/** ② 문제 — 지시문 없이 「주간 보고 써 줘」만 한 실제 답: 표가 나오고 말투가 「~다」. */
const BadScene: React.FC<{ t: number }> = ({ t }) => {
  const a = appear(t, T.bad + 0.1, 0.3);
  const rise = 40 * (1 - a);
  const drift = 1 + 0.05 * interpolate(t, [T.bad, T.make], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${drift})`, transformOrigin: '300px 1000px' }}>
        {/* 실제 답 화면(좁은 창으로 찍은 문서 보기): 제목 · 표 · 「~다」 줄까지 위쪽을 거의 1배로(그림 글자 33px). */}
        <Shot src="img/shotB.png" x={84} y={650 + rise} s={0.86} w={1040} h={830} o={a} t={t} boxes={[
          { x: 50, y: 401, w: 901, h: 317, at: T.bTable },
          { x: 48, y: 736, w: 620, h: 70, at: T.bTone },
        ]} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1480, height: 440, background: 'linear-gradient(0deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 160px, rgba(10,10,10,0) 440px)' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 640, backgroundColor: INK }} />
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.bad - 0.25, node: <>지시문 없이 「주간 보고 써 줘」만</>, size: 66, color: 'rgba(255,255,255,0.86)' },
          { at: T.bTable - 0.15, node: <><Gold>표</Gold>가 나오고</>, size: 112, gap: 18 },
          { at: T.bTone - 0.1, node: <>말투도 <Gold>「~다」</Gold>로</>, size: 112 },
        ]}
      />
      <Cap t={t} at={T.bad + 0.65} x={84} y={1376} size={38}>
        지시문 규칙은 「표 없이」 · 「~했습니다」
      </Cap>
    </AbsoluteFill>
  );
};

/** 지시문 덩어리(첫 줄 + 규칙 열 줄) — fold 0이면 그대로, 1이면 위로 접혀 카드 한 장이 된다. */
const InstrBlock: React.FC<{ t: number; at: number; fold: number; y: number; o?: number }> = ({ t, at, fold, y, o = 1 }) => {
  const a = appear(t, at, 0.3) * o;
  // 11-24 장면 심사(Opus): 긴 줄이 오른쪽 끝에서 잘려 보였다 — 줄을 접어 다 보이게 하고 글자를 키운다(안전선 x 920 안).
  return (
    <div style={{ position: 'absolute', left: 84, top: y, width: 830, opacity: a * (1 - fold) * (1 - fold), transform: `scaleY(${1 - 0.9 * fold})`, transformOrigin: '0 0' }}>
      <div style={{ borderLeft: '6px solid rgba(255,255,255,0.45)', paddingLeft: 26 }}>
        {INSTR.map((l, i) => (
          <div key={i} style={{ fontFamily: KO, fontSize: 27, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.38, color: 'rgba(255,255,255,0.84)', marginBottom: 3 }}>{l}</div>
        ))}
      </div>
    </div>
  );
};

/** 접힌 뒤 남는 카드 — 스킬 「주간보고」. */
const SkillCard: React.FC<{ t: number; at: number; x: number; y: number; s?: number }> = ({ t, at, x, y, s = 1 }) => {
  const p = appear(t, at, 0.3);
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${s * (0.9 + 0.1 * p)})`, transformOrigin: '0 50%', opacity: p, display: 'flex', alignItems: 'center', gap: 26, padding: '26px 40px', borderRadius: 22, backgroundColor: BUTTER, fontFamily: KO, whiteSpace: 'nowrap' }}>
      <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(10,10,10,0.72)' }}>스킬</div>
      <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.045em', color: INK }}>주간보고</div>
    </div>
  );
};

/** ③ 만들기 — 「이 지시문을 스킬로 만들어 줘」가 써지고, 지시문이 카드 한 장으로 접힌다. */
const ASK = ['이 지시문을', '스킬로 만들어 줘.'];
const MakeScene: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const total = ASK.join('').length;
  const typed = Math.round(total * interpolate(t, [T.mType, T.mTypeEnd], [0, 1], clamp));
  const fold = interpolate(t, [T.mFold, T.mFold + 0.45], [0, 1], { ...clamp, easing: IN_OUT });
  const push = settle(t, T.make) * (1 + 0.05 * interpolate(t, [T.make, T.one], [0, 1], clamp));
  let left = typed;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {!bare && (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.make - 0.25, node: '그래서 클로드에게', size: 92, color: 'rgba(255,255,255,0.86)' },
            { at: T.make + 0.6, node: <>딱 <Gold>한 번</Gold> 시켰어요</>, size: 112 },
          ]}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '84px 900px' }}>
        <div style={{ position: 'absolute', left: 84, top: 556 }}>
          {ASK.map((line, i) => {
            const n = Math.max(0, Math.min(line.length, left));
            left -= line.length;
            return (
              <div key={i} style={{ fontFamily: KO, fontSize: 80, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.26, color: i === 1 ? BUTTER : WHITE, whiteSpace: 'nowrap', minHeight: 100 }}>
                {line.slice(0, n)}
                {n > 0 && n < line.length && <span style={{ display: 'inline-block', width: 8, height: 72, marginLeft: 6, verticalAlign: '-8px', backgroundColor: BUTTER }} />}
              </div>
            );
          })}
        </div>
        <InstrBlock t={t} at={T.make + 0.2} fold={fold} y={780} />
        <SkillCard t={t} at={T.mFold + 0.3} x={84} y={820} />
      </div>
      {!bare && (
        <Cap t={t} at={T.make + 0.6} x={84} y={1376} size={38}>
          클로드 데스크톱 앱 「코드」 탭에서 해 봤어요
        </Cap>
      )}
    </AbsoluteFill>
  );
};

/** ④ 한 마디 — 「/주간보고」를 치면 실제 보고가 지시문대로 나온다. 실제 화면(소제목 여섯에 테)을 1초 보인 뒤 소제목 여섯을 크게 다시 짠다. */
const CMD = '/주간보고';
const HEADS = ['이번 주 한 일', '잘된 것', '아쉬운 것', '다음 주 할 일', '도움이 필요한 것', '확인받을 것'];
const OneScene: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const n = Math.round(CMD.length * interpolate(t, [T.oType, T.oTypeEnd], [0, 1], clamp));
  const shot = appear(t, T.oShot, 0.35);
  const lift = interpolate(t, [T.oShot, T.oShot + 0.45], [0, 1], { ...clamp, easing: OUT });
  const big = appear(t, T.oBig, 0.3);
  const shotOut = interpolate(t, [T.oBig - 0.3, T.oBig], [1, 0], clamp);
  const push = settle(t, T.one) * (1 + 0.04 * interpolate(t, [T.one, T.auth], [0, 1], clamp));
  // 11-24 장면 심사: 보고 화면이 오른쪽 끝까지 차 잘려 보였다 — 폭 1696 × 0.54 ≈ 916px로 x 84~1000 안에 둔다.
  const sDrift = 0.53 + 0.01 * interpolate(t, [T.oShot, T.oBig], [0, 1], clamp);
  // 보고 그림(2배 찍음)의 소제목 자리: 이번 주 한 일 · 잘된 것 · 아쉬운 것 · 다음 주 할 일 · 도움이 필요한 것 · 확인받을 것
  const heads = [
    { x: 72, y: 202, w: 238, h: 70 },
    { x: 72, y: 703, w: 146, h: 70 },
    { x: 72, y: 849, w: 180, h: 70 },
    { x: 72, y: 995, w: 238, h: 70 },
    { x: 72, y: 1263, w: 294, h: 70 },
    { x: 72, y: 1409, w: 230, h: 70 },
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {!bare && <Head t={t} top={292} lines={[{ at: T.one - 0.25, node: '다음 주부터는 이 한 마디', size: 76, color: 'rgba(255,255,255,0.86)' }]} />}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '84px 500px' }}>
        <div style={{ position: 'absolute', left: 80, top: 400 - 26 * lift, fontFamily: KO, fontSize: 168 - 40 * lift, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1.1, color: BUTTER, whiteSpace: 'nowrap' }}>
          {CMD.slice(0, n)}
          {n < CMD.length && t >= T.oType - 0.3 && <span style={{ display: 'inline-block', width: 12, height: 150, marginLeft: 8, verticalAlign: '-20px', backgroundColor: BUTTER, opacity: Math.round(t * 4) % 2 ? 1 : 0.3 }} />}
        </div>
        <div style={{ position: 'absolute', left: 86, top: 600 - 50 * lift, opacity: appear(t, T.oTypeEnd + 0.1), fontFamily: KO, fontSize: 52, fontWeight: 700, letterSpacing: '-0.035em', color: SUB, whiteSpace: 'nowrap' }}>+ 이번 주 메모</div>
        {/* 장면 심사 답 4: 매번 붙이던 글과 한 마디의 대비 — 잰 글자 수(지시문 392자 · 「/주간보고」 5자). 보고가 올라오면 물러난다. */}
        <div style={{ position: 'absolute', left: 86, top: 690, opacity: appear(t, T.oType + 0.3) * shotOut, display: 'flex', alignItems: 'baseline', gap: 22, fontFamily: KO, whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.6)', textDecoration: 'line-through', textDecorationThickness: 4 }}>지시문 392자</div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', color: WHITE }}>→ 5자</div>
        </div>
        {/* 앞 장면에서 접힌 카드가 그대로 남아 있다가(빈 화면 없이) 보고가 올라오면 물러난다. */}
        {shot < 1 && (
          <div style={{ opacity: 1 - shot }}>
            <SkillCard t={t} at={T.one - 1} x={84} y={850} />
          </div>
        )}
        {shot > 0 && shotOut > 0 && (
          <Shot src="img/shotC.png" x={84} y={790 + (1 - lift) * 260} s={sDrift} h={1562} o={shot * shotOut} t={t} boxes={heads.map((h) => ({ ...h, at: T.oMark }))} />
        )}
        {big > 0 && (
          <div style={{ position: 'absolute', left: 84, top: 720 + (1 - big) * 24, opacity: big, display: 'grid', gridTemplateColumns: '430px 430px', rowGap: 34, fontFamily: KO, whiteSpace: 'nowrap' }}>
            {HEADS.map((h, i) => {
              const p = appear(t, T.oBig + i * 0.06, 0.24);
              return (
                <div key={i} style={{ opacity: p, fontSize: 56, fontWeight: 800, letterSpacing: '-0.045em', color: BUTTER, lineHeight: 1.2 }}>
                  {h}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {!bare && (
        <Cap t={t} at={T.oBig} x={84} y={1180} size={46}>
          지시문을 붙였을 때와 같은 <span style={{ color: WHITE, fontWeight: 800 }}>소제목 여섯</span>
        </Cap>
      )}
    </AbsoluteFill>
  );
};

/** ⑤ 우리 회사 — 직접 만든 스킬 11개 가운데 다섯을 이름 · 하는 일로. */
const AuthScene: React.FC<{ t: number }> = ({ t }) => {
  const push = settle(t, T.auth) * (1 + 0.04 * interpolate(t, [T.auth, T.end], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.auth - 0.25, node: '저희 회사도', size: 92, color: 'rgba(255,255,255,0.86)' },
          { at: T.a2 - 0.1, node: <>스킬 <Gold>11개</Gold>로 일해요</>, size: 112 },
        ]}
      />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '84px 900px' }}>
        {OURS.map((r, i) => {
          const p = appear(t, T.aList + i * 0.22, 0.26);
          if (p <= 0) return null;
          return (
            <div key={i} style={{ position: 'absolute', left: 84, top: 590 + i * 140 + (1 - p) * 22, opacity: p, fontFamily: KO, whiteSpace: 'nowrap', display: 'flex', alignItems: 'baseline', gap: 26 }}>
              <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.045em', color: BUTTER, minWidth: 330 }}>{r.name}</div>
              <div style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.86)' }}>{r.job}</div>
            </div>
          );
        })}
        <Cap t={t} at={T.aList + 5 * 0.22 + 0.05} x={84} y={1300} size={44}>
          외 6개 · 모두 한 마디로 불러요
        </Cap>
      </div>
    </AbsoluteFill>
  );
};

/** ⑥ 끝 — 작은 카드 한 장 옆 몽글이(가까이)가 「스킬로 만들어 달라는 말」을 꺼내고, 끝 3초는 핵심 장면(긴 지시문 → /주간보고)으로 바뀌어 행동 안내를 얹는다. */
const EndScene: React.FC<{ ending: Ending }> = ({ ending }) => {
  const E = ending === 'post' ? TG : T;
  const t = useCurrentFrame() / FPS + T.end;
  const drift = 1 + 0.06 * interpolate(t, [T.end, E.cta], [0, 1], clamp);
  const row = appear(t, E.cta);
  const cta = appear(t, E.cta + 0.1);
  const under = interpolate(t, [E.key, E.key + 0.3], [0, 100], { ...clamp, easing: OUT });
  const smile = interpolate(t, [E.smile - 0.2, E.smile + 0.2], [0, 1], clamp);
  const coreIn = appear(t, E.cta - 0.05, 0.3);
  const coreDrift = 0.5 + 0.03 * interpolate(t, [E.cta, LEN], [0, 1], clamp);
  const mark = (label: string) => (
    <span style={{ color: BUTTER, backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 100%', backgroundSize: `${under}% 7px`, paddingBottom: 6 }}>{label}</span>
  );
  return (
    <AbsoluteFill>
      {coreIn < 1 && (
        <AbsoluteFill style={{ opacity: 1 - coreIn }}>
          <Mong a="mong/c.jpg" b="mong/c2.jpg" mix={smile} eye={{ x: 670, y: 900, rx: 170, ry: 85 }} top={150} ox={600} oy={1000} s={1.02 * drift * settle(t, T.end)} solid={500} fade={720} light={glow(t) * (0.96 + 0.08 * smile)} />
        </AbsoluteFill>
      )}
      {coreIn > 0 && (
        <AbsoluteFill style={{ backgroundColor: INK, opacity: coreIn }}>
          {/* 핵심 장면 다시: 지시문대로 나온 실제 보고(소제목 여섯) 위에 /주간보고 한 마디. */}
          <Shot src="img/shotC.png" x={150} y={900} s={coreDrift} dim={0.35} t={t} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1000, background: 'linear-gradient(180deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 880px, rgba(10,10,10,0) 960px)' }} />
        </AbsoluteFill>
      )}
      {t < E.cta ? (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.end - 0.25, node: '스킬로 만들어', size: 100 },
            { at: E.eL2, node: '달라는 말', size: 128 },
          ]}
        />
      ) : (
        <>
          <div style={{ position: 'absolute', left: LEFT, top: 286, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', whiteSpace: 'nowrap', opacity: row, transform: `translateY(${(1 - row) * 28}px)` }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>지시문 392자 대신</div>
            <div style={{ fontSize: 150, lineHeight: 1.05, color: BUTTER }}>/주간보고</div>
          </div>
          <div style={{ position: 'absolute', left: LEFT, top: 556, fontFamily: KO, fontSize: 96, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap', opacity: cta, transform: `translateY(${(1 - cta) * 28}px)` }}>
            {ending === 'post' ? <>{mark('글에')} 다 있어요</> : <>댓글에 {mark('「스킬」')}</>}
          </div>
          <div style={{ position: 'absolute', left: LEFT + 2, top: 682, fontFamily: KO, fontSize: 54, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap', opacity: appear(t, E.cta + 0.3), transform: `translateY(${(1 - appear(t, E.cta + 0.3)) * 20}px)` }}>
            {ending === 'post' ? <>스킬로 만들어 달라는 말과 부르는 법까지</> : <>스킬로 만들어 달라는 말을 DM으로</>}
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
      <Sequence from={0} durationInFrames={F(T.bad)} name="처음 · 몽글이">
        <Opening />
      </Sequence>
      {inWin(t, T.bad, T.make) && <BadScene t={t} />}
      {inWin(t, T.make, T.one) && <MakeScene t={t} />}
      {inWin(t, T.one, T.auth) && <OneScene t={t} />}
      {inWin(t, T.auth, T.end) && <AuthScene t={t} />}
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

/** 핵심 장면만(장면 심사용 · 제목 · 설명 없이) — 시킨 말이 써지고 지시문이 카드로 접힌 뒤 /주간보고 → 실제 보고. */
export const SCENE_FROM = 8.6;
export const SCENE_TO = 13.9;
export const Scene: React.FC = () => {
  const t = useCurrentFrame() / FPS + SCENE_FROM;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {inWin(t, T.make, T.one) && <MakeScene t={t} bare />}
      {inWin(t, T.one, T.auth) && <OneScene t={t} bare />}
      {VO.filter((v) => v.id === 'V3' || v.id === 'V4').map((v) => (
        <Sequence key={v.id} from={F(v.at - SCENE_FROM)} name={`말 ${v.id}`}>
          <Audio src={staticFile(`vo/${v.id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {SFX.filter((x) => x.at >= SCENE_FROM && x.at < SCENE_TO).map((x, i) => (
        <Sequence key={i} from={F(x.at - SCENE_FROM)} name={`효과음 ${x.file}`}>
          <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={MASTER * x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
