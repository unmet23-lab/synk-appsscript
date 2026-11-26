// synkbrief B74 「강아지 사진 한 장으로 연말 카드 그림」 본편 — 수요 장부 synkbrief 6번(사진 한 장을 간직할 그림으로, 한 사람의 한 가지 일).
// 결(장부 머리말 「화면 결」): 실제 화면(판)을 아래에 두고, 빈 위쪽은 같은 판을 뒤집어 흐리게 채운 뒤 그늘을 얹는다. 큰 글자가 곧 말이다.
// 검정 · 흰 + 버터 한 곳, SUIT 하나. 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선은 우리가 더하지 않는다(말풍선은 ChatGPT 화면의 것).
// 그림과 말풍선은 모두 2026-11-26 ChatGPT 보통 새 채팅에 실제로 보내고 받은 것이다(scripts/재료.py). 보낸 사진은 AI로 만든 가상 강아지다.
// 여행 동선 편 최종 확인 미흡(글자 가림)에서 배운 것: 글이 든 조각(말풍선 · 카드 글귀)은 처음부터 안전선(가로 65~920 · 아래 1428) 안에 둔다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import sizes from './sizes.json';
import { S, VO, TAGS, LINES, SOUNDS, BGM, DETAILS, FPS, TOTAL, SCENE, SCENE_DUR, STACK } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const sec = (s: number) => Math.round(s * FPS);
const DARK = 'rgb(18,17,16)';
const PAPER = 'rgb(238,234,228)'; // 받은 그림(종이 결)을 놓는 판 — 밝은 화면의 검은 말풍선이 보이게
const SHADE = '10,10,10';
const BUTTER = '#F5C445';
const X = 84;
const PT = 700; // 판 윗변
const TEXT_TOP = 332;
const TAG_TOP = 278; // 올리기 전 검사 「위 머리 자리」 안전선 269(264에서 글자 위 끝이 258px로 걸려 내림)
const MASTER = 0.8;
const SZ = sizes as unknown as Record<string, [number, number]>;
const img = (n: string) => staticFile(`img/${n}.png`);

const Pic: React.FC<{ n: string; x: number; y: number; k: number; style?: React.CSSProperties }> = ({ n, x, y, k, style }) => {
  const [w, h] = SZ[n];
  return <Img src={img(n)} style={{ position: 'absolute', left: x, top: y, width: w * k, height: h * k, display: 'block', ...style }} />;
};
const inAt = (t: number, a: number, d = 0.22) => interpolate(t, [a - 0.02, a + d], [0, 1], { ...clamp, easing: EASE_OUT });

// ── 판의 내용(판 좌표: 0 = 판 윗변) ──
// A 보낸 사진(화면 너비 가득)과 보낸 한 줄(실제 말풍선, 오른쪽 위 — 강아지 머리 위 벽 자리)
const BUB_K = 0.95;
const OnlyBubble: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const p = inAt(t, 0.3, 0.3); // 볼 이유 심사 1회 「0~2초 움직임이 없다」 — 말풍선이 보내지듯 올라온다
  const out = interpolate(t, [S.split - 0.15, S.split + 0.1], [1, 0], clamp);
  return p * out > 0 ? <Pic n="bub1" x={900 - SZ.bub1[0] * BUB_K} y={34 + (1 - p) * 60} k={BUB_K} style={{ opacity: p * out, filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.35))' }} /> : null;
};
// B 얼굴 가까이 — 「색연필」에 같은 자리에서 받은 그림이 위에서 아래로 쓸어 덮는다(두 그림은 같은 짜임이다)
// 장면 심사 v1(넘김 · 2) 「사진과 그림이 휴대폰 크기에서 거의 똑같다 · 바뀌는 순간이 안 보인다」 — 얼굴을 1.7배로 당겨 색연필 결이 보이게 하고,
// 쓸어 내려가는 끝에 흰 빛 줄을 둔다
const FACE = { x: 640, y: 560, k: 1.7, at: 520 }; // 사진 좌표의 얼굴 가운데 · 배율 · 판 안 높이
// B v3(장면 심사 v2 넘김 · 2 「필터를 씌운 정도로만 보인다 — 사진과 그림을 반씩 갈라 보이게」): 한 얼굴을 세로 줄로 갈라
// 왼쪽은 보낸 사진, 오른쪽은 받은 그림. 줄이 오른쪽 끝에서 가운데로 와서 멈췄다가 왼쪽 끝으로 가며 그림이 다 덮는다
const SplitPanel: React.FC<{ from: number; t0: number; hold: number; at?: number; k?: number; zoomAt?: number }> = ({ from, t0, hold, at, k = 2.0, zoomAt }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  // zoomAt: 보낸 사진(화면 너비, 판 위 -40)에서 얼굴 가까이로 끊지 않고 다가간다(올리기 전 검사 「같은 판을 잘라 키워 이어 붙임」 · 점검표 50)
  const z = zoomAt === undefined ? 1 : interpolate(t, [zoomAt, zoomAt + 0.5], [0, 1], { ...clamp, easing: EASE_IO });
  // 미학 맹검 「가르는 줄이 코 · 입을 지나 얼굴이 비틀려 보인다」 — 줄을 코 오른쪽(갈색 얼룩 경계, 화면 660px)에 세운다
  const d = interpolate(t, [t0, t0 + 0.5, hold, hold + 0.5], [1080, 660, 660, 0], { ...clamp, easing: EASE_IO });
  const sw = 1080 / SZ.photo[0];
  const sc = (k * 1080) / SZ.photo[0];
  const s = sw + (sc - sw) * z;
  const y = at ?? FACE.at;
  const left = (540 - FACE.x * sc) * z;
  const top = -40 + (y - FACE.y * sc + 40) * z;
  const pic = (n: string, style?: React.CSSProperties, dy = 0) => (
    <Img src={img(n)} style={{ position: 'absolute', left, top: top + dy * s, width: SZ[n][0] * s, height: SZ[n][1] * s, display: 'block', ...style }} />
  );
  return (
    <>
      {pic('photo')}
      {d < 1080 ? pic('pencil', { clipPath: `inset(0 0 0 ${d - left}px)` }, 4) : null /* 그림을 사진에 맞춘 값: 얼굴은 세로 4px 아래 */}
      {d > 0 && d < 1080 ? <div style={{ position: 'absolute', left: d - 5, top: -40, width: 10, height: 2400, background: 'rgba(255,255,255,0.96)', boxShadow: '0 0 26px 8px rgba(255,255,255,0.5)' }} /> : null}
    </>
  );
};
// 빈자리 → 글귀 — 받은 빈자리 판(E02_2)에서 받은 카드(E02_3)로 왼쪽부터 쓸어 바뀐다(글귀가 써지는 것처럼 보이게 우리가 만든 움직임)
const WriteCard: React.FC<{ from: number; at: number; x: number; y: number; w: number }> = ({ from, at, x, y, w }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const p = interpolate(t, [at, at + 0.9], [0, 1], { ...clamp, easing: EASE_IO });
  const k = w / SZ.card[0];
  const edge = p * (w + 80) - 40;
  const mask = `linear-gradient(to right, #000 0px, #000 ${edge}px, transparent ${edge + 60}px)`;
  return (
    <>
      <Pic n="blank" x={x} y={y} k={w / SZ.blank[0]} style={CARD_STYLE} />
      {p > 0 ? <Pic n="card" x={x} y={y} k={k} style={{ ...CARD_STYLE, boxShadow: 'none', WebkitMaskImage: mask, maskImage: mask }} /> : null}
    </>
  );
};
// C 무늬 둘 — 왼쪽 보낸 사진, 오른쪽 받은 그림의 같은 자리를 나란히(낱말마다 바뀜). 칸은 세로로 길게 판 너비를 거의 채운다(흠 장부 「화면작음」)
const TW = 500;
const TH = 640;
const DetailPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.c + f / FPS;
  const i = DETAILS.reduce((a, d, k) => (t >= d.at - 2 / FPS ? k : a), 0);
  const d = DETAILS[i];
  const tile = (n: string, left: number) => {
    const [x0, y0, x1] = n === 'pencil' ? d.pbox : d.box;
    const s = TW / (x1 - x0);
    return (
      <div key={n} style={{ position: 'absolute', left, top: 90, width: TW, height: TH, overflow: 'hidden', borderRadius: 18 }}>
        <Img src={img(n)} style={{ position: 'absolute', left: -x0 * s, top: -y0 * s, width: SZ[n][0] * s, height: SZ[n][1] * s }} />
      </div>
    );
  };
  const pop = interpolate(t, [d.at - 0.05, d.at + 0.25], [1.04, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${pop})`, transformOrigin: '50% 30%' }}>
      {tile('photo', 540 - TW - 10)}
      {tile('pencil', 540 + 10)}
    </div>
  );
};
// D · E 한 줄 더 — 앞서 받은 그림 아래에 보낸 말풍선(실제 화면)이 올라오고, 그 말에 같은 자리의 그림이 새로 받은 그림으로 바뀐다
// 말풍선 글은 화면 가로 229~883px · 세로 1160~1367px(안전선 안)
const CARD_W = 640;
const CARD_X = (1080 - CARD_W) / 2;
const CARD_STYLE: React.CSSProperties = { borderRadius: 16, boxShadow: '0 18px 40px rgba(0,0,0,0.28)' };
// 볼 이유 심사 1회 「14~18초 작은 그림이 위쪽에만 떠 아래가 비어 허전」 — 이 칸의 그림(글 없음)은 780으로 키운다
const ASK_W = 780;
const ASK_X = (1080 - ASK_W) / 2;
const AskPanel: React.FC<{ from: number; prev: string; bub: string; pic: string; picAt: number }> = ({ from, prev, bub, pic, picAt }) => {
  const f = useCurrentFrame();
  const t = from + f / FPS;
  const kb = 1.08;
  const pb = inAt(t, from + 0.05, 0.3);
  const out = interpolate(t, [picAt - 0.08, picAt + 0.14], [1, 0], clamp);
  const pp = inAt(t, picAt, 0.3);
  const dim = 1 - 0.28 * pb * out; // 말풍선이 서 있는 동안 앞 그림을 조금 눌러 둔다
  return (
    <>
      <Pic n={prev} x={ASK_X} y={0} k={ASK_W / SZ[prev][0]} style={{ ...CARD_STYLE, filter: `brightness(${dim})` }} />
      {pp > 0 ? <Pic n={pic} x={ASK_X} y={0} k={ASK_W / SZ[pic][0]} style={{ ...CARD_STYLE, opacity: pp }} /> : null}
      {out > 0 && pb > 0 ? <Pic n={bub} x={(1080 - SZ[bub][0] * kb) / 2} y={560 + (1 - pb) * 36} k={kb} style={{ opacity: pb * out, filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))' }} /> : null}
    </>
  );
};
// F1 보낸 세 줄 — 같은 대화에 실제로 보낸 말풍선 셋을 차례로 쌓는다(이해 시험 1회 h · G 「이 세 줄이 한 화면에 모이지 않는다」). 글은 가로 267~842 · 세로 640~1238px 안
const StackPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.f + f / FPS;
  const k = 0.95;
  return (
    <>
      {['bub1', 'bub2', 'bub3'].map((n, i) => {
        const p = inAt(t, STACK[i], 0.28);
        return p > 0 ? <Pic key={n} n={n} x={(1080 - SZ[n][0] * k) / 2} y={40 + i * 208 + (1 - p) * 30} k={k} style={{ opacity: p, filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.22))' }} /> : null;
      })}
    </>
  );
};
// F 끝 — 받은 카드(왼쪽, 살짝 기울임)와 보낸 사진(오른쪽 아래, 흰 테) — 카드 글귀는 안전선 안(가로 170~600 · 아래 1390 안)
const EndPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.f2 + f / FPS;
  const g = interpolate(t, [S.f2, S.f2 + 0.55], [0, 1], { ...clamp, easing: EASE_OUT });
  const kc0 = CARD_W / SZ.card[0];
  const kc1 = 600 / SZ.card[0];
  const kc = kc0 + (kc1 - kc0) * g;
  const cx = CARD_X + (78 - CARD_X) * g;
  const cy = 10 * g;
  const rot = -2.5 * g;
  const pp = inAt(t, S.f2 + 0.3, 0.4);
  const kp = 380 / SZ.photo[0];
  return (
    <>
      <Pic n="card" x={cx} y={cy} k={kc} style={{ ...CARD_STYLE, transform: `rotate(${rot}deg)`, transformOrigin: '50% 50%' }} />
      {pp > 0 ? (
        <div style={{ position: 'absolute', left: 610, top: 400 + (1 - pp) * 40, width: SZ.photo[0] * kp + 28, height: SZ.photo[1] * kp + 28, background: '#fff', borderRadius: 6, boxShadow: '0 16px 36px rgba(0,0,0,0.32)', transform: `rotate(${3.5 * pp}deg)`, opacity: pp }}>
          <Img src={img('photo')} style={{ position: 'absolute', left: 14, top: 14, width: SZ.photo[0] * kp, height: SZ.photo[1] * kp }} />
        </div>
      ) : null}
    </>
  );
};
// E 받은 카드 — 큰 글을 내리고 카드를 크게(장면 심사 v1 「완성 카드는 화면 가득 크게」). 판 윗변 330 · 너비 830 — 카드 글귀는 가로 253~841 · 아래 1394px 안
const BIG_PT = 330;
const BIG_W = 830;
// 한 장면 심사용 — 받은 카드를 화면 가득(글 · 말 없는 판이라 안전선을 따지지 않는다)
const HoldCard: React.FC = () => <Pic n="card" x={0} y={(1920 - SZ.card[1] * (1080 / SZ.card[0])) / 2} k={1080 / SZ.card[0]} />;

// 판 한 장 — 들어올 때 1.03배에서 내려앉고 천천히 다가간다. 위쪽은 같은 판을 뒤집어 흐리게 채우고 그늘을 얹는다
const Board: React.FC<{ pt?: number; drift?: number; origin?: string; bg?: string; children: React.ReactNode }> = ({ pt = PT, drift = 0.012, origin = '50% 30%', bg = DARK, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
  const H = 1920 - pt;
  const inner = <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}</div>;
  return (
    <AbsoluteFill style={{ background: `rgb(${SHADE})` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: pt, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: -40, top: pt, width: 1160, height: H, background: bg, transform: 'scaleY(-1)', transformOrigin: '50% 0%', filter: 'blur(26px)' }}>
          <div style={{ position: 'absolute', left: 40, top: 0, width: 1080, height: H }}>{inner}</div>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(${SHADE},0.95) 0%, rgba(${SHADE},0.86) 62%, rgba(${SHADE},0.62) 100%)` }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: pt, width: 1080, height: H, overflow: 'hidden', background: bg }}>
        {inner}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 46, background: `linear-gradient(to bottom, rgba(${SHADE},0.32), rgba(${SHADE},0))` }} />
      </div>
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string) =>
  l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));

// 큰 글자가 곧 말 — 첫 줄은 구성 첫 프레임부터 서 있고, 다음 줄부터 28px 올라오며 뜬다
const BigBlock: React.FC<{ lines: string[]; at: number[]; size: number; from: number }> = ({ lines, at, size, from }) => {
  const f = useCurrentFrame();
  const first = sec(from);
  return (
    <div style={{ position: 'absolute', left: X, top: TEXT_TOP, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: '-0.045em', lineHeight: size >= 104 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap' }}>
      {lines.map((s, k) => {
        const a = sec(at[k]);
        const p = a <= first ? 1 : interpolate(f, [a - 2, a + 4], [0, 1], { ...clamp, easing: EASE_OUT });
        return <div key={k} style={{ opacity: p, transform: `translateY(${(1 - p) * 28}px)` }}>{rich(s)}</div>;
      })}
    </div>
  );
};
const Big: React.FC = () => {
  const f = useCurrentFrame();
  const l = LINES.find((x) => f >= sec(x.from) && f < sec(x.to));
  return l ? <BigBlock lines={l.lines} at={l.at} size={l.size} from={l.from} /> : null;
};

// 위 작은 줄 — 굵은 낱말 | 옅은 설명
const Tag: React.FC = () => {
  const f = useCurrentFrame();
  const g = TAGS.find((x) => f >= sec(x.from) && f < sec(x.to));
  if (!g) return null;
  return (
    <div style={{ position: 'absolute', left: X, top: TAG_TOP, fontFamily: KO, fontWeight: 700, fontSize: 40, letterSpacing: '0.01em', lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap' }}>
      {g.b}
      <span style={{ display: 'inline-block', width: 2, height: 30, margin: '0 20px', background: 'rgba(255,255,255,0.42)', verticalAlign: '-3px' }} />
      <span style={{ fontWeight: 500, opacity: 0.74 }}>{g.i}</span>
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, BGM.t.map(sec), BGM.v, clamp) * MASTER} />
    {VO.map((o, i) => (
      <Sequence key={i} from={sec(o.t)}>
        <Audio src={staticFile(`vo/${o.id}.wav`)} volume={MASTER} />
      </Sequence>
    ))}
    {SOUNDS.map((s, i) => (
      <Sequence key={`s${i}`} from={Math.max(0, sec(s.t))} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
    ))}
  </>
);

const Seq: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={sec(a)} durationInFrames={sec(b) - sec(a)}>{children}</Sequence>
);

const CARD_PT = 600; // 받은 그림 판 — 카드 글귀 아래 끝이 1428px 위에 오게(카드 그림 속 글귀 · 장식은 그림 높이의 96.5%까지)

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: `rgb(${SHADE})` }}>
    <Seq a={S.a} b={S.c}><Board drift={0.03} origin="50% 37%"><SplitPanel from={S.a} t0={S.splitAt} hold={S.wipe} k={1.8} zoomAt={S.split - 0.1} /><OnlyBubble /></Board></Seq>
    <Seq a={S.c} b={S.d}><Board drift={0.03} origin="50% 30%"><DetailPanel /></Board></Seq>
    <Seq a={S.d} b={S.e}><Board pt={CARD_PT} drift={0.03} origin="50% 40%" bg={PAPER}><AskPanel from={S.d} prev="pencil" bub="bub2" pic="blank" picAt={S.dPic} /></Board></Seq>
    <Seq a={S.e} b={S.ePic}><Board pt={CARD_PT} drift={0.03} origin="50% 40%" bg={PAPER}><AskPanel from={S.e} prev="blank" bub="bub3" pic="card" picAt={S.ePic + 9} /></Board></Seq>
    <Seq a={S.ePic} b={S.f}><Board pt={BIG_PT} drift={0.035} origin="50% 45%" bg={PAPER}><Pic n="card" x={(1080 - BIG_W) / 2} y={0} k={BIG_W / SZ.card[0]} style={CARD_STYLE} /></Board></Seq>
    <Seq a={S.f} b={S.f2}><Board pt={CARD_PT} drift={0.03} origin="50% 30%" bg={PAPER}><StackPanel /></Board></Seq>
    <Seq a={S.f2} b={TOTAL}><Board pt={CARD_PT} drift={0.02} origin="40% 45%" bg={PAPER}><EndPanel /></Board></Seq>
    <Big />
    <Tag />
    <Sound />
  </AbsoluteFill>
);
export { HoldCard };

// 한 장면 심사용 — 얼굴 가까이 사진 → 「색연필」 자리에서 받은 그림으로 쓸어 바뀜 → 받은 카드(글 · 말 없이, 그 장면의 화면과 소리만)
export const Scene: React.FC = () => {
  const fullW = Math.round(SZ.card[0] * (1920 / SZ.card[1])); // 카드를 세로로 꽉(좌우가 조금 잘림)
  return (
    <AbsoluteFill style={{ background: `rgb(${SHADE})` }}>
      <Seq a={0} b={SCENE.card}><Board pt={0} drift={0.02} origin="50% 40%"><SplitPanel from={0} t0={SCENE.wipe} hold={SCENE.wipeAll} at={820} k={2.0} /></Board></Seq>
      <Seq a={SCENE.card} b={SCENE_DUR}><Board pt={0} drift={0.02} origin="50% 75%" bg={PAPER}><WriteCard from={SCENE.card} at={SCENE.write} x={(1080 - fullW) / 2} y={0} w={fullW} /></Board></Seq>
      <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, [0, 8, sec(SCENE_DUR) - 20, sec(SCENE_DUR)], [0.14, 0.24, 0.24, 0], clamp) * MASTER} />
      <Sequence from={sec(SCENE.wipe - 0.02)} durationInFrames={45}><Audio src={staticFile('sfx/swish.wav')} volume={0.24 * MASTER} /></Sequence>
      <Sequence from={sec(SCENE.wipeAll - 0.02)} durationInFrames={45}><Audio src={staticFile('sfx/swish.wav')} volume={0.2 * MASTER} /></Sequence>
      <Sequence from={sec(SCENE.card - 0.03)} durationInFrames={45}><Audio src={staticFile('sfx/pop.wav')} volume={0.2 * MASTER} /></Sequence>
      <Sequence from={sec(SCENE.write + 0.85)} durationInFrames={45}><Audio src={staticFile('sfx/thud.wav')} volume={0.24 * MASTER} /></Sequence>
    </AbsoluteFill>
  );
};
