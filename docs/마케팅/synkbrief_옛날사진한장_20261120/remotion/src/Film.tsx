// synkbrief 「엄마 옛날 사진 살릴 때 붙이는 두 줄」 본편 — 계정 개편 시험 편(자료 나눔 꼴, 한 사람의 한 가지 일).
// 결: 표지 A 짜임(검정 바탕 · 위 큰 글자 · 아래 결과 사진 · 보낸 사진 작게 · 버터 한 곳 · SUIT 하나)을 첫 화면으로 두고 같은 결로 끝까지 간다.
// 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선은 없다. 움직임은 작게(판은 초마다 1% 안으로 다가가고, 얼굴로 당기지 않는다).
// 그림 · 영상은 모두 실제로 받은 결과다(scripts/재료.sh). 사진 속 인물은 AI로 만든 예시라 사진 칸마다 위 작은 줄에 적는다.
// 모든 사진 · 영상은 원래 사진(941×1672)과 같은 자리에 놓인다(제미나이 결과는 원래 사진을 같은 짜임으로 키운 판 — 기획.md 「만들기」).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { S, VO, TAGS, LINES, SOUNDS, BGM, FPS, TOTAL_S, PAIR_LABELS } from './timeline';

export const TOTAL = Math.round(TOTAL_S * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * FPS);
const INK = '#0A0A0A';
const BUTTER = '#F5C445';
const X = 84;
const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 자른다 — 모든 소리에 같은 값을 곱한다

// 원래 사진 좌표(941×1672) → 화면. 표지와 같은 「큰 판」: 판 상자(0, 660, 1080×1260) 안에 원래 사진 x 42.9 · y 206.2부터
const OW = 941, OH = 1672;
const K_COVER = 1193.5 / OW;
const COVER = { boxTop: 660, boxH: 1260, left: -54.4, top: -261.5 };
// 「인화지 판」: 원래 사진의 인화지 자리(x 32~904 · y 137~1536)를 통째로, 작게 가운데에
const PRINT = { x0: 32, y0: 137, w: 872, h: 1399 };
const printBox = (h: number, top = 672) => { const k = h / PRINT.h; return { k, box: { left: (1080 - PRINT.w * k) / 2, top, width: PRINT.w * k, height: h } }; };

const Top: React.FC<{ solid: number; fade: number }> = ({ solid, fade }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', background: `linear-gradient(180deg, rgba(10,10,10,1) 0px, rgba(10,10,10,1) ${solid}px, rgba(10,10,10,0) ${solid + fade}px)` }} />
);

// 판 위 한 겹 — 원래 사진 크기의 상자에 그림이나 영상을 꽉 채운다
// 영상은 at(이 구성 안의 프레임)부터 자기 0초로 돈다 — 자른 판(scripts/재료.sh)을 원래 빠르기로
type Media = { img?: string; vid?: string; at?: number; opacity?: number; mask?: string };
const Layer: React.FC<{ m: Media; k: number }> = ({ m, k }) => {
  const st: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: OW * k, height: OH * k, display: 'block', opacity: m.opacity ?? 1, WebkitMaskImage: m.mask, maskImage: m.mask };
  if (m.vid) return (
    <Sequence from={m.at ?? 0} layout="none">
      <OffthreadVideo muted src={staticFile(m.vid)} style={st} />
    </Sequence>
  );
  return <Img src={staticFile(m.img!)} style={st} />;
};

// 큰 판(표지와 같은 자리) — drift = 초마다 다가가는 몫(얼굴로 당기지 않게 판 가운데 아래쪽을 축으로)
const CoverView: React.FC<{ layers: Media[]; drift?: number; settle?: boolean }> = ({ layers, drift = 0.01, settle = true }) => {
  const f = useCurrentFrame();
  const z = (settle ? interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) : 1) * (1 + (f / FPS) * drift);
  return (
    <div style={{ position: 'absolute', left: 0, top: COVER.boxTop, width: 1080, height: COVER.boxH, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 55%' }}>
        <div style={{ position: 'absolute', left: COVER.left, top: COVER.top }}>
          {layers.map((m, i) => <Layer key={i} m={m} k={K_COVER} />)}
        </div>
      </div>
    </div>
  );
};

// 인화지 판 — 보낸 사진 한 장이 통째로 보인다(둥근 모서리로 잘라 영상의 흰 가장자리를 감춘다)
const PrintView: React.FC<{ layers: Media[]; drift?: number; h?: number; top?: number }> = ({ layers, drift = 0.008, h = 1060, top = 672 }) => {
  const f = useCurrentFrame();
  const { k: K_PRINT, box: PRINT_BOX } = printBox(h, top);
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
  return (
    <div style={{ position: 'absolute', ...PRINT_BOX, overflow: 'hidden', borderRadius: 16, boxShadow: '0 26px 60px rgba(0,0,0,0.55)', transform: `scale(${z})`, transformOrigin: '50% 50%' }}>
      <div style={{ position: 'absolute', left: -PRINT.x0 * K_PRINT, top: -PRINT.y0 * K_PRINT }}>
        {layers.map((m, i) => <Layer key={i} m={m} k={K_PRINT} />)}
      </div>
    </div>
  );
};

// 겹쳐 뜨기(앞 판 위에 다음 판이 frames 동안 떠오른다)
const fadeIn = (f: number, at: number, n = 6) => interpolate(f, [at, at + n], [0, 1], clamp);

// ── 0 훅: 표지와 같은 화면. 아래 큰 판은 제미나이가 깨끗하게 복원한 사진, 보낸 원래 사진이 작게 놓였다 들린다 ──
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const lift = interpolate(t, [0.25, 1.3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <CoverView layers={[{ img: 'img/restored.jpg' }]} drift={0.02} settle={false} />
      <Top solid={770} fade={280} />
      <div style={{ position: 'absolute', left: X, top: 796, fontFamily: KO, fontWeight: 500, fontSize: 30, lineHeight: 1.4, color: '#fff', opacity: 0.8, whiteSpace: 'nowrap' }}>사진 속 인물은 AI로 만든 예시예요</div>
      <Img
        src={staticFile('img/orig.png')}
        style={{ position: 'absolute', left: 70, top: 1196, width: 270, height: 405, boxSizing: 'border-box', objectFit: 'cover', objectPosition: '50% 45%', border: '9px solid #fff', borderRadius: 10, boxShadow: `0 ${22 + 10 * lift}px ${50 + 16 * lift}px rgba(0,0,0,0.5)`, transform: `translateY(${-30 * lift}px) rotate(${-4 + 3 * lift}deg) scale(${1 + 0.12 * lift})` }}
      />
    </AbsoluteFill>
  );
};

// 표지 제목 — 아래 판이 보낸 사진으로 바뀌는 자리에서 걷힌다(인화지 판과 겹치지 않게)
const HookTitle: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= sec(S.sent)) return null;
  const o = interpolate(f, [sec(S.sent) - 3, sec(S.sent)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 79, top: 352, opacity: o, fontFamily: KO, fontWeight: 800, fontSize: 124, letterSpacing: '-0.045em', lineHeight: 1.1, color: '#fff', whiteSpace: 'nowrap' }}>
      <div>엄마 옛날 사진</div>
      <div>살릴 때 붙이는</div>
      <div style={{ color: BUTTER }}>두 줄</div>
    </div>
  );
};

// ── 1 보낸 사진 → 「살아 움직이게 해 줘」의 결과(V1): 같은 자리에서 움직이기 시작해 스스로 다가가며 말을 한다 ──
const Fail: React.FC = () => {
  const f = useCurrentFrame();
  const v = sec(S.ask) - sec(S.sent);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <PrintView drift={0.006} layers={[{ img: 'img/orig.png' }, ...(f >= v ? [{ vid: 'img/v1.mp4', at: v, opacity: fadeIn(f, v, 5) } as Media] : [])]} />
      <Top solid={600} fade={70} />
    </AbsoluteFill>
  );
};
// V1이 스스로 다가간 뒤로는 큰 판에서 이어 본다(같은 영상 · 같은 빠르기 — 「모르는 목소리로 말을 했어요」)
const FailTalk: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <CoverView layers={[{ vid: 'img/v1_talk.mp4' }]} drift={0.006} />
    <Top solid={COVER.boxTop + 110} fade={240} />
  </AbsoluteFill>
);

// ── 2 바꾼 한 줄의 결과(M2 — 11-20 실험 1): 보낸 사진에서 같은 자리로 영상이 겹쳐 뜨고, 큰 판에서 살짝 웃는 얼굴 ──
const Fix: React.FC = () => {
  const f = useCurrentFrame();
  const v = sec(S.fixVid) - sec(S.fix);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <PrintView drift={0.006} top={724} h={1040} layers={[{ img: 'img/orig.png' }, ...(f >= v ? [{ vid: 'img/m1_a.mp4', at: v, opacity: fadeIn(f, v, 6) } as Media] : [])]} />
      <Top solid={600} fade={70} />
    </AbsoluteFill>
  );
};
// 앞 결과(왼쪽 · V1 「살아 움직이게 해 줘」)와 바꾼 결과(오른쪽 · M2 「입은 다문 채 …」)를 나란히 — 같은 사진에서 나온 두 영상.
// 두 칸 모두 큰 판과 같은 배율로 원래 사진의 얼굴 자리를 가운데에 둔다(얼굴로 당기지 않는다).
// V1은 스스로 다가가는 영상이라 그 구간 첫머리(V1 4.6초)의 자리 맞춤(원래 사진 좌표 = 영상 좌표 × 1.0 + (140, 154))으로 놓는다 — 그 뒤로 더 다가가는 것은 V1 그대로다.
const PAIR = { top: 700, h: 1170, w: 510, gap: 20, faceX: 439, faceY: 620, faceAt: 330 };
const V1_AT = { k: 1.0, tx: 140, ty: 154 };
const PairCell: React.FC<{ x: number; label: string; children: React.ReactNode }> = ({ x, label, children }) => (
  <>
    <div style={{ position: 'absolute', left: x + X - 20, top: PAIR.top - 58, fontFamily: KO, fontWeight: 600, fontSize: 38, color: '#fff', opacity: 0.86, whiteSpace: 'nowrap' }}>{label}</div>
    <div style={{ position: 'absolute', left: x, top: PAIR.top, width: PAIR.w, height: PAIR.h, overflow: 'hidden', borderRadius: 16, boxShadow: '0 26px 60px rgba(0,0,0,0.55)' }}>
      <div style={{ position: 'absolute', left: PAIR.w / 2 - PAIR.faceX * K_COVER, top: PAIR.faceAt - PAIR.faceY * K_COVER }}>{children}</div>
    </div>
  </>
);
const Pair: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 8], [0, 1], { ...clamp, easing: EASE_OUT });
  const x0 = (1080 - PAIR.w * 2 - PAIR.gap) / 2;
  const v1: React.CSSProperties = { position: 'absolute', left: V1_AT.tx * K_COVER, top: V1_AT.ty * K_COVER, width: 720 * V1_AT.k * K_COVER, height: 1280 * V1_AT.k * K_COVER, display: 'block' };
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', inset: 0, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
        <PairCell x={x0} label={PAIR_LABELS[0]}><OffthreadVideo muted src={staticFile('img/v1_pair.mp4')} style={v1} /></PairCell>
        <PairCell x={x0 + PAIR.w + PAIR.gap} label={PAIR_LABELS[1]}><Layer m={{ vid: 'img/m1_p.mp4' }} k={K_COVER} /></PairCell>
      </div>
    </AbsoluteFill>
  );
};

// ── 3 깨끗하게: 보낸 사진(얼룩 · 접힌 자국 · 찢긴 귀퉁이)이 위에서 아래로 복원한 사진으로 바뀐다 ──
const wipeMask = (y: number, feather = 80) => `linear-gradient(to bottom, #000 0px, #000 ${y - feather}px, rgba(0,0,0,0) ${y}px)`;
const Clean: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS + S.clean;
  const p = interpolate(t, [S.wipe0, S.wipe1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  // 가림은 원래 사진 좌표로 — 인화지 위(y 137)에서 아래(y 1536)까지
  const H = 1180; // 얼룩 · 접힌 자국이 보이게 앞 칸보다 크게
  const y = interpolate(p, [0, 1], [PRINT.y0, PRINT.y0 + PRINT.h + 80]) * printBox(H).k;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <PrintView h={H} drift={0.006} layers={[{ img: 'img/orig.png' }, ...(p > 0 ? [{ img: 'img/restored.jpg', mask: wipeMask(y) } as Media] : [])]} />
      <Top solid={600} fade={70} />
    </AbsoluteFill>
  );
};

// ── 끝: 살짝 웃는 얼굴이 화면 가득(M3 — 깨끗하게 하는 줄로 받은 사진에 움직이는 줄을 보낸 결과, 덧붙인 실험 4). 판을 내리고 빈 위쪽은 같은 영상 윗부분을 뒤집어 흐리게 채운 뒤 위 그늘 ──
const End: React.FC = () => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * 0.008);
  const k = 1.42;
  const pic: React.CSSProperties = { position: 'absolute', left: (1080 - OW * k) / 2 + 6, top: -300, width: OW * k, height: OH * k, display: 'block' };
  const mask = 'linear-gradient(to bottom, rgba(0,0,0,0) 0px, #000 160px)';
  const d = 410;
  return (
    <AbsoluteFill style={{ background: INK, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(34px) brightness(0.85)' }}>
        <OffthreadVideo muted src={staticFile('img/m1_c.mp4')} style={pic} />
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 40%', WebkitMaskImage: mask, maskImage: mask }}>
        <OffthreadVideo muted src={staticFile('img/m1_c.mp4')} style={pic} />
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.97) 0px, rgba(10,10,10,0.95) 600px, rgba(10,10,10,0.45) 800px, rgba(10,10,10,0) 1000px)' }} />
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string) => l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));

// 큰 글자가 곧 말 — 첫 줄은 구성이 바뀌는 첫 프레임부터 서 있고, 다음 줄부터 28px 올라오며 뜬다
const Big: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      {LINES.map((l, i) => {
        if (f < sec(l.from) || f >= sec(l.to)) return null;
        return (
          <div key={i} style={{ position: 'absolute', left: X, top: 352, fontFamily: KO, fontWeight: 800, fontSize: l.size, letterSpacing: '-0.045em', lineHeight: l.size >= 120 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap', textShadow: l.size >= 140 ? '0 2px 18px rgba(0,0,0,0.55)' : undefined }}>
            {l.lines.map((s, k) => {
              const a = sec(l.at[k] ?? l.from);
              const p = l.hard || k === 0 ? 1 : interpolate(f, [a - 2, a + 4], [0, 1], { ...clamp, easing: EASE_OUT });
              return <div key={k} style={{ opacity: p, transform: `translateY(${(1 - p) * 28}px)` }}>{rich(s)}</div>;
            })}
          </div>
        );
      })}
    </>
  );
};

// 위 작은 줄 — 굵은 낱말 + 옅은 설명. bar = 둘 사이에 가는 선(한 문장으로 붙어 읽히지 않게)
const Tag: React.FC = () => {
  const f = useCurrentFrame();
  const g = TAGS.find((x) => f >= sec(x.from) && f < sec(x.to));
  if (!g) return null;
  const size = g.size ?? 40;
  return (
    <div style={{ position: 'absolute', left: X, top: size === 34 ? 292 : 286, fontFamily: KO, fontWeight: 700, fontSize: size, letterSpacing: '0.01em', lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap' }}>
      {g.b}
      {g.bar ? <span style={{ display: 'inline-block', width: 2, height: 30, margin: '0 20px', background: 'rgba(255,255,255,0.42)', verticalAlign: '-3px' }} /> : null}
      {g.i ? <span style={{ fontWeight: 500, opacity: size === 34 ? 0.7 : 0.74, marginLeft: g.bar ? 0 : 16 }}>{g.i}</span> : null}
    </div>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, BGM.t.map(sec), BGM.v, clamp) * MASTER} />
    {VO.map((v) => (
      <Sequence key={v.id} from={sec(v.t)}><Audio src={staticFile(`vo/${v.id}.wav`)} volume={MASTER} /></Sequence>
    ))}
    {SOUNDS.map((s, i) => (
      <Sequence key={i} from={Math.max(0, sec(s.t))} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
    ))}
  </>
);

const Seq: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={sec(a)} durationInFrames={sec(b) - sec(a)}>{children}</Sequence>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Seq a={S.hook} b={S.sent}><Hook /></Seq>
    <Seq a={S.sent} b={S.talk}><Fail /></Seq>
    <Seq a={S.talk} b={S.fix}><FailTalk /></Seq>
    <Seq a={S.fix} b={S.pair}><Fix /></Seq>
    <Seq a={S.pair} b={S.clean}><Pair /></Seq>
    <Seq a={S.clean} b={S.end}><Clean /></Seq>
    <Seq a={S.end} b={S.total}><End /></Seq>
    <HookTitle />
    <Big />
    <Tag />
    <Sound />
  </AbsoluteFill>
);
