// LAB 영어 E44 「보고 싶어」(11-15 07시 회차) — 고정 카메라 한 방, 칸마다 몽글 자세 · 떠 있는 폰 · 소품만 바뀐다(판/_판짜기.py가 1080×1920으로 짠 판).
// 화면 글: 모두 위(어두운 벽 자리 285~760)에 — 문자 말풍선(친구는 왼쪽 회색, 몽글은 오른쪽 산호색 — 우리가 Remotion으로 그린 메신저 꼴, 실제 앱 화면이 아니다)과
// 그 아래 배울 말 카드(한국어 · 로마자 읽기 · 영어 뜻). 글은 LOCS[loc](data.ts) — 그림 · 한국어 · 목소리 · 박자는 판마다 같다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { CELLS, FLASH, FLOOD, FPS, Loc, LOCS, OPEN, SFX, T, TOTAL, VO } from './data';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#231F2B';
const CORAL = '#E8503D';
const PAPER = '#FFFDF7';
const GRAY = '#ECE8F2';

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 판은 늘 4% 넉넉히 — 당겨 들어감 · 흔들림에도 가장자리가 비지 않게
const Plate: React.FC<{ src: string; push: number }> = ({ src, push }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#14121c' }}>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '50% 42%', transform: `scale(${push})` }} />
  </AbsoluteFill>
);

const pop = (frame: number, at: number) => interpolate(frame, [fr(at), fr(at) + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });

// 사진이 실제로 쏟아진다(핵심 장면 — 정지 판만 바꾸면 「장면」이 아니다, 제작 절차 「한 장면 먼저」):
// 판/폴라.txt로 녹색 바탕에 구운 펠트 사진 일곱 장(public/img/pola, 바탕을 걷어 오림)을 판 위에 띄운다.
// FLY — 7.7초부터 떠 있는 폰 화면(b5 판에서 잰 자리)에서 서른 장이 위로 솟구쳐 화면 위로 빠져나간다.
// FALL — 12.2초(b7 부끄러움)부터 열두 장이 천천히 흔들리며 깔개 위로 내려앉는다.
const POLA = ['p1.png', 'p2.png', 'p3.png', 'p4.png', 'p5.png', 'p6.png', 'p7.png'];
const PHONE = { x: 330, y: 950 };
type Fly = { t0: number; dur: number; cx: number; cy: number; ex: number; ey: number; rot: number; s: number; img: string };
// 끝 3초(T.burst2)에 같은 쏟아짐을 열여섯 장으로 한 번 더 — 답장 「나도 보고 싶어」와 함께 또 셀카를 보낸다.
const burst = (key: string, n: number, from: number): Fly[] => Array.from({ length: n }, (_, i) => {
  const r = (k: string) => random(`${key}-${i}-${k}`);
  return {
    t0: from + 0.05 + i * 0.045,
    dur: 0.7 + r('d') * 0.4,
    cx: PHONE.x - 140 + r('cx') * 200,
    cy: 300 + r('cy') * 250,
    ex: 80 + r('x') * 1100,
    ey: -260 + r('y') * 140,
    rot: (r('r') - 0.5) * 100,
    s: 0.5 + r('s') * 0.4,
    img: POLA[i % POLA.length],
  };
});
const FLY: Fly[] = [...burst('open', 18, -0.5), ...burst('fly', 30, FLOOD.from), ...burst('fly2', 16, T.burst2)];
type Fall = { t0: number; dur: number; x: number; y1: number; sway: number; rot: number; s: number; img: string };
const FALL: Fall[] = Array.from({ length: 7 }, (_, i) => {
  const r = (k: string) => random(`fall-${i}-${k}`);
  return { t0: 12.25 + i * 0.2, dur: 1.0 + r('d') * 0.2, x: i % 2 ? 70 + r('x') * 170 : 850 + r('x') * 170, y1: 1180 + r('y') * 180, sway: 30 + r('w') * 40, rot: (r('r') - 0.5) * 50, s: 0.42 + r('s') * 0.25, img: POLA[(i + 3) % POLA.length] };
});
const PW = 200; // 사진 한 장의 기본 너비(px)

const Polas: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const items: React.ReactNode[] = [];
  FLY.forEach((p, i) => {
    const u0 = (t - p.t0) / p.dur;
    if (u0 < 0 || u0 > 1) return;
    if (p.t0 < T.rewind && t >= T.rewind) return; // 여는 칸의 사진은 되감기에서 사라진다
    const u = Easing.out(Easing.quad)(u0);
    const x = (1 - u) * (1 - u) * PHONE.x + 2 * (1 - u) * u * p.cx + u * u * p.ex;
    const y = (1 - u) * (1 - u) * PHONE.y + 2 * (1 - u) * u * p.cy + u * u * p.ey;
    const sc = 0.15 + (p.s - 0.15) * Math.min(1, u0 * 2.5);
    items.push(<Img key={`f${i}`} src={staticFile(`img/pola/${p.img}`)} style={{ position: 'absolute', left: x - PW / 2, top: y - PW * 0.7, width: PW, transform: `rotate(${p.rot * u}deg) scale(${sc})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.45))', opacity: Math.min(1, u0 * 8) }} />);
  });
  FALL.forEach((p, i) => {
    const u0 = (t - p.t0) / p.dur;
    if (u0 < 0 || u0 > 1) return;
    const y = -280 + (p.y1 + 280) * Easing.in(Easing.quad)(u0);
    const x = p.x + Math.sin(u0 * Math.PI * 2.2 + i) * p.sway;
    items.push(<Img key={`d${i}`} src={staticFile(`img/pola/${p.img}`)} style={{ position: 'absolute', left: x - PW / 2, top: y - PW * 0.7, width: PW, transform: `rotate(${p.rot + Math.sin(u0 * 6 + i) * 18}deg) scale(${p.s})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.45))', opacity: interpolate(u0, [0.85, 1], [1, 0], clamp) }} />);
  });
  return <AbsoluteFill style={{ pointerEvents: 'none' }}>{items}</AbsoluteFill>;
};

// 문자 말풍선 — side: 'l' 친구(회색) · 'r' 몽글(산호)
const Msg: React.FC<{ at: number; side: 'l' | 'r'; ko: string; sub?: string; font: string; top: number; size?: number }> = ({ at, side, ko, sub, font, top, size = 64 }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at)) return null;
  const p = pop(frame, at);
  const left = side === 'l';
  return (
    <div style={{ position: 'absolute', top, left: 70, width: 840, display: 'flex', flexDirection: 'column', alignItems: left ? 'flex-start' : 'flex-end', opacity: p, transform: `translateY(${(1 - p) * 24}px) scale(${0.92 + 0.08 * p})`, transformOrigin: left ? '0% 100%' : '100% 100%' }}>
      <div style={{ maxWidth: 760, background: left ? GRAY : CORAL, color: left ? INK : '#fff', fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.15, padding: '18px 34px 20px', borderRadius: 44, borderBottomLeftRadius: left ? 10 : 44, borderBottomRightRadius: left ? 44 : 10, boxShadow: '0 10px 26px rgba(0,0,0,0.35)' }}>{ko}</div>
      {sub ? <div style={{ marginTop: 10, fontFamily: font, fontWeight: 700, fontSize: 44, color: '#fff', background: 'rgba(20,18,28,0.72)', borderRadius: 18, padding: '6px 18px 8px', lineHeight: 1.15, maxWidth: 820, textAlign: left ? 'left' : 'right', whiteSpace: 'pre-line' }}>{sub}</div> : null}
    </div>
  );
};

// 배울 말 카드 — 흰 판 위 한국어 · 읽기 · 뜻. 판을 1.25배로 짜 몽글이 세로 860~1260에 앉으므로 글은 모두 위 벽(285~760)에 둔다 —
// 쇼츠 안전선(위 269 · 아래 앱 글자 1428 · 오른쪽 단추 920 · 왼쪽 65, 올리기 전 검사)을 넘지 않게. right면 오른쪽(920)에 붙인다(끝 판 하트를 비킨다).
const Card: React.FC<{ at: number; to?: number; children: React.ReactNode; top?: number; right?: boolean }> = ({ at, to, children, top = 425, right }) => {
  const frame = useCurrentFrame();
  if (frame < fr(at) || (to !== undefined && frame >= fr(to))) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: 'absolute', top, left: 70, width: 850, display: 'flex', justifyContent: right ? 'flex-end' : 'center', opacity: Math.min(1, p * 1.4), transform: `scale(${0.9 + 0.1 * p})`, transformOrigin: right ? '100% 0%' : '50% 0%' }}>
      <div style={{ background: PAPER, border: `6px solid ${INK}`, borderRadius: 44, padding: '18px 40px 20px', textAlign: 'center', boxShadow: '0 10px 28px rgba(0,0,0,0.35)', maxWidth: 850 }}>{children}</div>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.2 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    <Audio src={staticFile('sfx/room.wav')} volume={0.1 * MASTER} endAt={fr(TOTAL)} />
    {VO.map(([t, v]) => (
      <Sequence key={v} from={fr(t)} layout="none">
        <Audio src={staticFile(`vo/${v}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} />
      </Sequence>
    ))}
  </>
);

export const Film: React.FC<{ loc: Loc; bare?: boolean }> = ({ loc, bare }) => {
  const frame = useCurrentFrame();
  const L = LOCS[loc];
  const i = cellAt(frame / FPS);
  const zoom = 1 + FLOOD.zoom * interpolate(frame, [fr(FLOOD.from), fr(FLOOD.to)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  // 첫 2초 — 문자가 닿는 순간(0.35초) 화면이 톡 튀고, 몽글 얼굴 쪽으로 밀어 들어간다(볼 이유 v2 「0~2초 몽글이 가만히 서 있다」)
  const bump = interpolate(frame, [fr(T.msg1), fr(T.msg1) + 3, fr(T.msg1) + 8], [0, 0.035, 0], clamp);
  const open = frame >= fr(T.rewind) && frame < fr(T.hookTo) ? 1 + bump + OPEN.zoom * interpolate(frame, [fr(OPEN.from), fr(OPEN.to)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) }) : 1;
  // 플래시는 짧게(장면 심사 v1 「화면 전체를 하얗게 지우는 플래시를 짧게」) — 한 프레임 0.5에서 세 프레임 만에 꺼진다
  const flash = FLASH.reduce((a, t) => Math.max(a, interpolate(frame, [fr(t), fr(t) + 1, fr(t) + 4], [0, 0.5, 0], clamp)), 0);
  const kw = (big: string, read: string, mean: string, color = INK) => (
    <>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 96, color, lineHeight: 1.1 }}>{big}</div>
      <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: 50, color: '#5A5266', lineHeight: 1.2, marginTop: 4 }}>{read}</div>
      <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 54, color: CORAL, lineHeight: 1.15, marginTop: 6 }}>{mean}</div>
    </>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: '#14121c' }}>
      <AbsoluteFill style={{ transformOrigin: OPEN.origin, transform: `scale(${open})` }}>
      <AbsoluteFill style={{ transformOrigin: '50% 40%', transform: `scale(${zoom})` }}>
        <Plate src={CELLS[i].img} push={interpolate(frame, [fr(CELLS[i].at), fr(i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL)], [1.04, 1.07], clamp)} />
        <Polas />
      </AbsoluteFill>
      </AbsoluteFill>
      {flash > 0 ? <AbsoluteFill style={{ backgroundColor: '#fff', opacity: flash }} /> : null}
      {bare ? null : (
        <>
          {/* 여는 칸(0~0.85초) — 사진이 쏟아지는 끝장과 「+37 photos sent」, 그리고 되감기 딱지 */}
          {frame < fr(T.rewind) ? <Msg at={0.05} side="r" ko={L.sent} sub={L.openSub} font={L.font} top={285} size={60} /> : null}
          {frame >= fr(T.rewind) && frame < fr(T.rewind + 1.05) ? (
            <div style={{ position: 'absolute', top: 290, left: 70, fontFamily: L.font, fontWeight: 800, fontSize: 40, color: '#fff', background: 'rgba(20,18,28,0.78)', borderRadius: 999, padding: '8px 24px 10px' }}>{L.rewind}</div>
          ) : null}
          {/* 몽글의 오해 — 몽글 아래(깔개 앞) 산호 말풍선(v4: 카드에서 빼 몽글 몫으로) */}
          {frame >= fr(T.literal + 0.1) && frame < fr(T.selfie) ? <Msg at={T.literal + 0.1} side="r" ko="보고 싶어? 나를?!" sub={L.mongleThinks} font={L.font} top={1252} size={52} /> : null}
          {/* 이름표(되감은 뒤 ~2.3초) */}
          {frame >= fr(T.rewind) && frame < fr(T.hookTo) ? (
            <div style={{ position: 'absolute', top: 372, left: 82, width: 840, fontFamily: L.font, fontWeight: 700, fontSize: 42, color: 'rgba(255,255,255,0.86)', lineHeight: 1.15, textShadow: '0 3px 10px rgba(0,0,0,0.8)', whiteSpace: 'pre-line' }}>{L.hook}</div>
          ) : null}
          {/* 친구 문자 — 처음부터 답장 전까지 */}
          {frame < fr(T.sent) ? <Msg at={T.msg1} side="l" ko="보고 싶어~ 🥺" sub={frame < fr(T.literal) ? L.msgRead : undefined} font={L.font} top={frame < fr(T.hookTo) ? 435 : 285} size={72} /> : null}
          {/* 말 그대로 읽기 */}
          <Card at={T.literal} to={T.selfie}>
            <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: 40, color: '#8A8296', marginBottom: 2 }}>{L.literalSum}</div>
            <div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 84, color: INK }}>보고</div>
                <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 52, color: CORAL }}>{L.literalSee}</div>
              </div>
              <div>
                <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 84, color: INK }}>싶어</div>
                <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 52, color: CORAL }}>{L.literalWant}</div>
              </div>
            </div>
            <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: 50, color: '#5A5266', marginTop: 8 }}>bo-go si-peo</div>
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 48, color: INK, marginTop: 8 }}>{L.literalSay}</div>
          </Card>
          {/* 셀카 — 몽글 말 */}
          <Card at={T.selfie} to={T.sent}>
            {kw('알았어! 찰칵!', 'a-ra-sseo! chal-kak!', L.selfie)}
          </Card>
          {/* 사진 수십 장 */}
          {frame >= fr(T.sent) && frame < fr(T.reply) ? <Msg at={T.sent} side="r" ko={L.sent} font={L.font} top={285} size={60} /> : null}
          {/* 친구 답장 */}
          {frame < fr(T.fix) ? <Msg at={T.reply} side="l" ko="ㅋㅋㅋ 아니 그게 아니라…" sub={L.replyMean} font={L.font} top={285} size={60} /> : null}
          {/* 몽글 「아…」 — 부끄러워 줄어든 몽글 머리 옆(벽 아래 칸) */}
          {frame >= fr(T.oh) && frame < fr(T.ohTo) ? <Msg at={T.oh} side="r" ko="아… 😳" sub={L.ohMean} font={L.font} top={900} size={58} /> : null}
          {/* 바로잡기 */}
          <Card at={T.fix} to={T.my} top={290}>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 104, color: INK, lineHeight: 1.1 }}>보고 싶어</div>
            <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: 50, color: '#5A5266', marginTop: 4 }}>bo-go si-peo</div>
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 66, color: CORAL, marginTop: 6 }}>{L.fixMean} ✓</div>
            <div style={{ fontFamily: L.font, fontWeight: 700, fontSize: 44, color: '#5A5266', marginTop: 6, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{L.fixNot}</div>
          </Card>
          {/* 몽글 답장 · 끝 질문 */}
          {frame >= fr(T.my) ? <Msg at={T.my} side="r" ko="나도 보고 싶어 ❤️" sub={L.myMean} font={L.font} top={285} size={68} /> : null}
          <Card at={T.ask} top={505} right>
            <div style={{ fontFamily: L.font, fontWeight: 800, fontSize: 52, color: INK, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{L.ask}</div>
          </Card>
        </>
      )}
      <Sound />
    </AbsoluteFill>
  );
};
