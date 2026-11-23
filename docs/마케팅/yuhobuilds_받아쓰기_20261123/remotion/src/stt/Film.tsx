// 「받아쓰기 구독 대신」 본편 — 수요 장부 yuhobuilds 3번(유료 구독 대신 쓰는 무료 도구, 11-23).
// 처음과 끝은 몽글이 장면(구운 그림 · 눈 둘레 조각만 바꿔 끼운다), 가운데는 범수 보이스오버와 큰 그림이다.
// 숫자는 2026-11-23에 직접 잰 값이다(기획.md 「실험 기록」): 44분 43초 녹음 · 노트북 CPU 받아쓰기 · 대본과 견준 글자 일치.
// 화면 결: 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나. 안전 영역 x 65~920 · y 269~1428.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, OUT } from '../lib/motion';
import { BGM, LEN, P2G_AT, SFX, SFX_END, T, TG, VO } from './timeline';
import { ACC, LINES, MINUTES_RUN, REC_LABEL } from './data';

export type Ending = 'dm' | 'post';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const INK = '#0A0A0A';
const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const SUB = 'rgba(255,255,255,0.66)';
const CAP = 'rgba(255,255,255,0.84)';
const LEFT = 79;
const MASTER = 0.8;

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.22) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
/** 몽글이 장면의 빛 숨결 — 2.4초에 한 번 6%만(몽글이는 크게 움직이지 않고 빛으로 작게, 11-20 유호님). */
const glow = (t: number) => 1 + 0.06 * Math.sin((2 * Math.PI * t) / 2.4);
const settle = (t: number, a: number) => 1.035 - 0.035 * appear(t, a, 0.34);

// ───────────────────────── 부품 ─────────────────────────

type Line = { at: number; node: React.ReactNode; size: number; color?: string; gap?: number; weight?: number };
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

const Tag: React.FC = () => (
  <div style={{ position: 'absolute', left: 84, top: 286, fontFamily: KO, fontSize: 34, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap' }}>
    yuhobuilds<span style={{ fontWeight: 500, opacity: 0.7, marginLeft: 16 }}>AI와 회사 만들기</span>
  </div>
);

const Cap: React.FC<{ t: number; at: number; x: number; y: number; size?: number; children: React.ReactNode }> = ({ t, at, x, y, size = 44, children }) => {
  const p = appear(t, at, 0.26);
  if (p <= 0) return null;
  return <div style={{ position: 'absolute', left: x, top: y + (1 - p) * 20, opacity: p, fontFamily: KO, fontSize: size, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.25, color: CAP, whiteSpace: 'nowrap', textShadow: '0 2px 14px rgba(0,0,0,0.75)' }}>{children}</div>;
};

/** 잰 숫자 한 개 — 큰 숫자와 두 줄 이름표. 11-23 첫 컷 다른 눈(#4): 사실을 알리는 정보를 흰 고딕 한 줄로 얹지 않는다. */
const Stat: React.FC<{ t: number; at: number; x: number; y: number; value: React.ReactNode; label: React.ReactNode; size?: number }> = ({ t, at, x, y, value, label, size = 104 }) => {
  const p = appear(t, at, 0.28);
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y + (1 - p) * 22, opacity: p, display: 'flex', alignItems: 'center', gap: 20, fontFamily: KO, whiteSpace: 'nowrap', textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>
      <div style={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1, color: WHITE, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.22, color: 'rgba(255,255,255,0.8)' }}>{label}</div>
    </div>
  );
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
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 500, background: 'linear-gradient(0deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 170px, rgba(10,10,10,0) 500px)' }} />
    </AbsoluteFill>
  );
};

/** 파일 한 개 — 녹음(파형 막대) 또는 글(줄 막대). 동그라미 · 점 무늬 없이 막대만(11-20 유호님). */
const FileCard: React.FC<{ x: number; y: number; kind: 'audio' | 'text'; name: string; o?: number; fill?: number; t?: number; live?: number }> = ({ x, y, kind, name, o = 1, fill = 1, t = 0, live = 0 }) => {
  const w = 340;
  const h = 430;
  const audioBars = [0.35, 0.7, 0.5, 0.9, 0.42, 0.66, 0.3, 0.78, 0.55, 0.38, 0.84, 0.47];
  const textBars = [0.9, 0.7, 0.82, 0.6, 0.88, 0.5];
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, opacity: o }}>
      {/* 11-23 첫 컷 다른 눈: 큰 제목 아래 상자는 「위 제목 + 아래 상자」(점검표 8) — 테두리 · 바탕 없이 파형과 글 줄만 그린다. */}
      <div style={{ position: 'relative', width: w, height: h }}>
        {kind === 'audio' ? (
          <div style={{ position: 'absolute', left: 34, right: 34, top: 90, height: 250, display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 받아쓰는 동안(live)만 파형이 소리처럼 출렁인다 — 일하는 움직임(r3 시험관 셋: 가운데 검은 글 화면이 지루함). */}
            {audioBars.map((b, i) => {
              const k = b * (1 - 0.3 * live + 0.3 * live * Math.abs(Math.sin(t * 7.3 + i * 1.7)));
              return <div key={i} style={{ flex: 1, height: `${k * 100}%`, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.82)' }} />;
            })}
          </div>
        ) : (
          <div style={{ position: 'absolute', left: 34, right: 34, top: 110 }}>
            {textBars.map((b, i) => {
              const on = Math.max(0, Math.min(1, fill * textBars.length - i));
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, opacity: on }}>
                  <div style={{ width: 54, height: 16, borderRadius: 8, backgroundColor: BUTTER }} />
                  <div style={{ width: `${b * 180}px`, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.7)' }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ marginTop: 22, width: w, textAlign: 'center', fontFamily: KO, fontSize: 50, fontWeight: 800, letterSpacing: '-0.035em', color: kind === 'text' ? BUTTER : WHITE, whiteSpace: 'nowrap' }}>{name}</div>
    </div>
  );
};

// ───────────────────────── 장면 ─────────────────────────

/** ① 처음 — 엉킨 긴 테이프 앞의 몽글이. 0초부터 「45분 녹음」과 「구독 없이」가 보이고 「내 컴퓨터에서 글로」가 뜬다. */
const Opening: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const drift = 1 + 0.07 * interpolate(t, [0, T.ask], [0, 1], clamp);
  const lean = 0.03 * interpolate(t, [T.eye - 0.1, T.eye + 0.4], [0, 1], { ...clamp, easing: IN_OUT });
  const pulse = 1 + 0.05 * interpolate(t, [T.l3, T.l3 + 0.12, T.l3 + 0.5], [0, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Mong
        a="mong/a.jpg"
        b="mong/a2.jpg"
        mix={interpolate(t, [T.eye - 0.2, T.eye + 0.2], [0, 1], clamp)}
        eye={{ x: 690, y: 950, rx: 150, ry: 80 }}
        top={150}
        ox={560}
        oy={1000}
        s={drift + lean}
        solid={440}
        fade={700}
        light={glow(t)}
      />
      <Tag />
      <Head
        t={t}
        top={346}
        lines={[
          { at: 0, node: REC_LABEL, size: 104 },
          { at: T.l2, node: '받아쓰기 구독 없이', size: 92, color: 'rgba(255,255,255,0.86)' },
          {
            at: T.l3,
            node: (
              <span style={{ display: 'inline-block', transform: `scale(${pulse})`, transformOrigin: '0 80%' }}>
                <Gold>내 컴퓨터에서</Gold> 글로
              </span>
            ),
            size: 112,
          },
        ]}
      />
      <Stat t={t} at={T.eye + 0.3} x={84} y={742} size={96} value={<Gold>0원</Gold>} label={<>받아쓰기<br />비용</>} />
    </AbsoluteFill>
  );
};

/** ② 시킨 말 — 요청문이 써진다. */
const ASK = ['이 녹음, 내 컴퓨터에서', '무료로 글로 바꿔 줘.', '말한 시각도 붙여 줘.'];
const AskScene: React.FC<{ t: number }> = ({ t }) => {
  const total = ASK.join('').length;
  const typed = Math.round(total * interpolate(t, [T.aType, T.aEnd], [0, 1], clamp));
  const box = appear(t, T.ask + 0.15, 0.3);
  const push = settle(t, T.ask) * (1 + 0.1 * interpolate(t, [T.ask, T.how], [0, 1], clamp));
  const rise = -36 * interpolate(t, [T.ask, T.how], [0, 1], clamp);
  let left = typed;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.ask - 0.3, node: '클로드에게', size: 92, color: 'rgba(255,255,255,0.86)' },
          { at: T.ask + 0.3, node: '이렇게만 말했어요', size: 112 },
        ]}
      />
      <div style={{ position: 'absolute', left: 84, top: 620 + (1 - box) * 28 + rise, width: 860, opacity: box, transform: `scale(${push})`, transformOrigin: '0px 200px' }}>
        {/* 11-23 첫 컷 다른 눈 #8: 상자 없이, 친 말을 큰 글자 그대로. 왼쪽 가는 세로줄만 입력 자리로 둔다. */}
        <div style={{ borderLeft: '6px solid rgba(255,255,255,0.5)', paddingLeft: 40 }}>
          {ASK.map((line, i) => {
            const n = Math.max(0, Math.min(line.length, left));
            left -= line.length;
            return (
              <div key={i} style={{ fontFamily: KO, fontSize: 70, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.34, color: i === 2 ? BUTTER : WHITE, whiteSpace: 'nowrap', minHeight: 94 }}>
                {line.slice(0, n)}
                {n > 0 && n < line.length && <span style={{ display: 'inline-block', width: 8, height: 66, marginLeft: 6, verticalAlign: '-8px', backgroundColor: BUTTER }} />}
              </div>
            );
          })}
        </div>
      </div>
      {/* r3 시험관 셋: 「클로드 코드」를 어디서 여는지 모름 — 여는 자리를 적는다. */}
      <Cap t={t} at={T.ask + 0.7} x={84} y={1040} size={44}>
        녹음 파일이 든 폴더를
        <br />
        클로드 데스크톱 앱 「코드」 탭에서
        <br />
        열고 이 말을 붙여요
      </Cap>
    </AbsoluteFill>
  );
};

/** ③ 어떻게 — 녹음 파일이 내 컴퓨터 안에서 글 파일이 된다. */
const HowScene: React.FC<{ t: number }> = ({ t }) => {
  const a = appear(t, T.how + 0.15, 0.3);
  const run = interpolate(t, [T.hRun, T.proof - 0.2], [0, 1], { ...clamp, easing: IN_OUT });
  // 첫 렌더는 11초까지 오른쪽이 비었다 — 받아쓴 글 자리를 처음부터 흐리게 세워 두고 받아쓰는 동안 밝힌다.
  const b = 0.35 * appear(t, T.how + 0.35, 0.3) + 0.65 * appear(t, T.hRun + 0.2, 0.3);
  const push = settle(t, T.how) * (1 + 0.04 * interpolate(t, [T.how, T.proof], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.how - 0.3, node: '무료 받아쓰기 프로그램으로', size: 76, color: 'rgba(255,255,255,0.86)' },
          { at: T.hRun - 0.05, node: <><Gold>내 컴퓨터</Gold> 안에서</>, size: 112 },
        ]}
      />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '500px 900px' }}>
        <FileCard x={80} y={610} kind="audio" name="녹음.mp3" o={a} t={t} live={run > 0 && run < 1 ? 1 : 0} />
        {/* 가운데 화살 — 받아쓰는 동안 차는 막대 */}
        <div style={{ position: 'absolute', left: 436, top: 816, width: 136, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.18)', opacity: a }}>
          <div style={{ width: `${run * 100}%`, height: '100%', borderRadius: 7, backgroundColor: BUTTER }} />
        </div>
        <FileCard x={588} y={610} kind="text" name="받아쓴 글" o={b} fill={run} />
      </div>
      {/* r3 시험관 둘(sonnet · GPT): 「무료 받아쓰기 프로그램」이 무엇인지 모름 — 이름을 둔다. */}
      <Cap t={t} at={T.hProg + 0.3} x={84} y={1150} size={44}>
        프로그램 이름은 faster-whisper(무료 공개)
      </Cap>
      <Cap t={t} at={T.hRun + 0.1} x={84} y={1218} size={44}>
        녹음 파일은 인터넷에 올리지 않아요
      </Cap>
    </AbsoluteFill>
  );
};

/** 받아쓴 글 파일을 연 실제 화면 한 장(상자 없이 화면 가득). 짚은 세 줄(13:59~14:02) 밖은 어둡게 누른다.
 * 11-23 첫 컷 다른 눈 #8 · r3 시험관 셋(13초 화면이 작고 잘리고 무엇을 보라는지 모름) — 3.3배로 깔고 세 줄만 밝힌다. 캡처 글은 그대로다. */
const SHOT_S = 3.3; // 캡처(850 × 620 CSS) 배율 — 줄 높이 약 86px
const ShotLayer: React.FC<{ y: number; mark: number; drift?: number; o?: number }> = ({ y, mark, drift = 1, o = 1 }) => (
  <AbsoluteFill style={{ opacity: o, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: 850, height: 620, transform: `translate(0px, ${y}px) scale(${SHOT_S * drift})`, transformOrigin: '0px 0px' }}>
      <div style={{ position: 'absolute', left: -400, top: -400, width: 1700, height: 1500, backgroundColor: '#fff' }} />
      <Img src={staticFile('img/shot.png')} style={{ position: 'absolute', left: 0, top: 0, width: 850, height: 620 }} />
      <div style={{ position: 'absolute', left: -400, top: -400, width: 1700, height: 506, backgroundColor: `rgba(10,10,10,${0.55 * mark})` }} />
      <div style={{ position: 'absolute', left: -400, top: 190, width: 1700, height: 1100, backgroundColor: `rgba(10,10,10,${0.55 * mark})` }} />
      <div style={{ position: 'absolute', left: 3, top: 106, width: 272, height: 84, borderRadius: 5, border: `1.5px solid ${BUTTER}`, opacity: mark }} />
    </div>
  </AbsoluteFill>
);
const SHOT_Y = 600; // 증거 장면에서 캡처 맨 위가 놓이는 화면 자리(제목 아래) — 세 줄이 화면 y 950~1227

/** ④ 증거 — 실제 화면 → 짚은 세 줄을 검정 위에 크게 → 잰 숫자 둘. */
const ProofScene: React.FC<{ t: number }> = ({ t }) => {
  const shot = appear(t, T.pShot - 0.15, 0.3) * (1 - appear(t, T.pBig - 0.05, 0.35));
  const big = appear(t, T.pBig, 0.3);
  const drift = 1 + 0.04 * interpolate(t, [T.proof, T.pBig], [0, 1], clamp);
  const push = 1 + 0.07 * interpolate(t, [T.pBig, T.cond], [0, 1], clamp);
  const mark = appear(t, T.pShot + 0.45, 0.3);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {shot > 0 && (
        <>
          <ShotLayer y={SHOT_Y} mark={mark} drift={drift} o={shot} />
          {/* 첫 컷 다른 눈 v2(#4): 출처를 흰 고딕 한 줄로 얹지 않는다 — 실제 화면이라는 것은 준비.json 「화면캡처」와 자료에 둔다. */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 700, opacity: shot, background: 'linear-gradient(180deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 598px, rgba(10,10,10,0) 640px)' }} />
        </>
      )}
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.proof - 0.3, node: '말한 시각이 붙은', size: 92, color: 'rgba(255,255,255,0.86)' },
          { at: T.proof + 0.4, node: <><Gold>글이</Gold> 나왔어요</>, size: 112 },
        ]}
      />
      {big > 0 && (
        <div style={{ position: 'absolute', left: LEFT, top: 590 + (1 - big) * 28, opacity: big, transform: `scale(${push})`, transformOrigin: '0px 300px' }}>
          {LINES.map((l, i) => {
            const p = appear(t, T.pBig + 0.1 + i * 0.28, 0.26);
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, marginBottom: 34, fontFamily: KO, whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: '0.01em', color: BUTTER, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{l.time}</div>
                <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em', color: WHITE, lineHeight: 1.25 }}>{l.text}</div>
              </div>
            );
          })}
        </div>
      )}
      {/* 걸린 시간은 다른 작업이 CPU를 거의 다 쓰던 때의 실측이다. 96.6%는 숫자 · 영어 표기 차이를 뺀 값(자료에 그대로 견준 92.3%도). */}
      <Stat t={t} at={T.pAcc} x={84} y={1150} value={ACC} label={<>대본과 견준 글자 일치<br />(숫자 · 영어 표기 차이 뺌)</>} />
      <Stat t={t} at={T.pAcc + 0.3} x={84} y={1290} size={88} value={MINUTES_RUN} label={<>걸린 시간<br />(노트북 CPU · 다른 작업과 함께)</>} />
    </AbsoluteFill>
  );
};

/** ⑤ 조건 — 컴퓨터의 클로드 코드에서. */
const CondScene: React.FC<{ t: number }> = ({ t }) => {
  const rows: { at: number; main: React.ReactNode; sub: string; dim?: boolean }[] = [
    { at: T.c1, main: '휴대폰 · 웹 클로드는 안 돼요', sub: '내 컴퓨터의 프로그램을 못 돌려요', dim: true },
    { at: T.c2, main: <>컴퓨터의 <Gold>클로드 코드</Gold></>, sub: '데스크톱 앱 「코드」 탭 · 프로 요금제부터' },
  ];
  const push = settle(t, T.cond) * (1 + 0.04 * interpolate(t, [T.cond, T.end], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.cond - 0.3, node: '단, 이건', size: 92, color: 'rgba(255,255,255,0.86)' },
          { at: T.cond + 0.2, node: <><Gold>컴퓨터에서</Gold> 돼요</>, size: 118 },
        ]}
      />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '84px 900px' }}>
        {rows.map((r, i) => {
          const p = appear(t, r.at, 0.26);
          if (p <= 0) return null;
          return (
            <div key={i} style={{ position: 'absolute', left: 84, top: 650 + i * 232 + (1 - p) * 22, opacity: p, fontFamily: KO, whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.045em', color: r.dim ? 'rgba(255,255,255,0.72)' : WHITE, lineHeight: 1.2 }}>{r.main}</div>
              <div style={{ fontSize: 46, fontWeight: 600, letterSpacing: '-0.03em', color: SUB, lineHeight: 1.3 }}>{r.sub}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** ⑥ 끝 — 정리된 글 종이 옆 몽글이(가까이)가 「클로드에게 그대로 붙여 넣을 말」을 꺼내고, 끝 3초는 핵심 장면(실제 받아쓴 글 · 세 줄)으로 바뀌어
 * 「45분 녹음을 0원에 글로」와 「댓글에 「받아쓰기」」를 얹는다. r3 시험관 셋: 지난 PDF 편과 끝 카드(웃는 몽글이 + 댓글 DM)가 같다 —
 * 제작 절차 「한 장면 먼저」대로 가장 센 장면을 끝에 다시 둔다. */
const EndScene: React.FC<{ ending: Ending }> = ({ ending }) => {
  const E = ending === 'post' ? TG : T;
  const t = useCurrentFrame() / FPS + T.end;
  const drift = 1 + 0.06 * interpolate(t, [T.end, E.cta], [0, 1], clamp);
  const row = appear(t, E.cta);
  const cta = appear(t, E.cta + 0.1);
  const under = interpolate(t, [E.key, E.key + 0.3], [0, 100], { ...clamp, easing: OUT });
  const smile = interpolate(t, [E.smile - 0.2, E.smile + 0.2], [0, 1], clamp);
  const shotIn = appear(t, E.cta - 0.05, 0.3);
  const shotDrift = 1 + 0.035 * interpolate(t, [E.cta, LEN], [0, 1], clamp) + 0.01 * appear(t, E.last, 0.3);
  const mark = (label: string) => (
    <span style={{ color: BUTTER, backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 100%', backgroundSize: `${under}% 7px`, paddingBottom: 6 }}>{label}</span>
  );
  return (
    <AbsoluteFill>
      {shotIn < 1 && (
        <AbsoluteFill style={{ opacity: 1 - shotIn }}>
          <Mong a="mong/c.jpg" b="mong/c2.jpg" mix={smile} eye={{ x: 385, y: 870, rx: 160, ry: 80 }} top={150} ox={430} oy={1000} s={1.02 * drift * settle(t, T.end)} solid={500} fade={720} light={glow(t) * (0.96 + 0.08 * smile)} />
        </AbsoluteFill>
      )}
      {shotIn > 0 && (
        <AbsoluteFill style={{ backgroundColor: INK, opacity: shotIn }}>
          <ShotLayer y={770} mark={1} drift={shotDrift} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 900, background: 'linear-gradient(180deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) 768px, rgba(10,10,10,0) 820px)' }} />
        </AbsoluteFill>
      )}
      {t < E.cta ? (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.end - 0.3, node: '클로드에게 그대로', size: 100 },
            { at: E.eL2, node: '붙여 넣을 말', size: 128 },
          ]}
        />
      ) : (
        <>
          <div style={{ position: 'absolute', left: LEFT, top: 286, display: 'flex', alignItems: 'baseline', gap: 22, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', whiteSpace: 'nowrap', opacity: row, transform: `translateY(${(1 - row) * 28}px)` }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>45분 녹음을</div>
            <div style={{ fontSize: 112, lineHeight: 1.08, color: WHITE }}><Gold>0원에</Gold> 글로</div>
          </div>
          <div style={{ position: 'absolute', left: LEFT, top: 424, fontFamily: KO, fontSize: 104, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap', opacity: cta, transform: `translateY(${(1 - cta) * 28}px)` }}>
            {ending === 'post' ? <>{mark('글에')} 다 있어요</> : <>댓글에 {mark('「받아쓰기」')}</>}
          </div>
          <div style={{ position: 'absolute', left: LEFT + 2, top: 566, fontFamily: KO, fontSize: 60, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.18, color: WHITE, whiteSpace: 'nowrap', opacity: appear(t, E.cta + 0.3), transform: `translateY(${(1 - appear(t, E.cta + 0.3)) * 20}px)` }}>
            {ending === 'post' ? (
              <>
                클로드에게 붙여 넣을 말과
                <br />
                확인하는 법까지
              </>
            ) : (
              <>
                클로드에게 붙여 넣을 말을
                <br />
                DM 한 통에 담아 드려요
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
      <Sequence from={0} durationInFrames={F(T.ask)} name="처음 · 몽글이">
        <Opening />
      </Sequence>
      {inWin(t, T.ask, T.how) && <AskScene t={t} />}
      {inWin(t, T.how, T.proof) && <HowScene t={t} />}
      {inWin(t, T.proof, T.cond) && <ProofScene t={t} />}
      {inWin(t, T.cond, T.end) && <CondScene t={t} />}
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
