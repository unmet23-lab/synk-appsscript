// synkbrief 「사진 한 장에 붙여 넣는 요청문 3개」 본편 — 계정 개편 시험 첫 편(자료 나눔 꼴).
// 결: 유호님이 고르신 표지 A 짜임(검정 바탕 · 위 큰 글자 · 아래 결과 사진 · 버터 한 곳 · SUIT 하나)을 첫 화면으로 두고 같은 짜임으로 끝까지 간다.
// 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선은 없다. 움직임은 작게(컷이 1.035배에서 내려앉고 판은 아주 천천히 다가간다).
// 그림은 모두 앞 세 편에서 실제로 받은 결과다(scripts/재료.sh) — 빈 방 · 손글씨 메뉴판 · 옛날 사진은 예시로 만든 그림.
// 세 칸 모두 같은 문법이다: 보낸 사진 + 요청문(큰 글 = 말) → 말하는 동안 사진이 결과로 바뀐다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { S, VO, TAGS, LINES, SOUNDS, BGM, FPS, TOTAL_S } from './timeline';

export const TOTAL = Math.round(TOTAL_S * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * FPS);
const INK = '#0A0A0A';
const BUTTER = '#F5C445';
const X = 84;
// Remotion은 합친 소리가 0 dBFS를 넘으면 그 자리에서 자른다 — 모든 소리에 같은 값을 곱한다(현장 노트 영상)
const MASTER = 0.8;

// 위 검정이 사진으로 녹아드는 그늘(표지 A와 같은 꼴)
const Top: React.FC<{ solid: number; fade: number }> = ({ solid, fade }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', background: `linear-gradient(180deg, rgba(10,10,10,1) 0px, rgba(10,10,10,1) ${solid}px, rgba(10,10,10,0) ${solid + fade}px)` }} />
);

// 컷이 들어올 때 1.035배에서 내려앉고, 그 뒤 아주 천천히 다가간다
const useSettle = (drift = 0.006) => {
  const f = useCurrentFrame();
  return interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
};

// 위에서 아래로 바뀌는 가림(말하는 동안 결과가 내려온다) — y = 바뀌는 선의 자리(판 안 px), feather = 번지는 폭
// 선은 긋지 않는다(장면 심사: 가로 선이 닦인 자국처럼 보인다). 글자가 든 메뉴판은 두 글이 겹쳐 비치지 않게 폭을 좁힌다
const wipeMask = (y: number, feather = 90) => `linear-gradient(to bottom, #000 0px, #000 ${y - feather}px, rgba(0,0,0,0) ${y}px)`;

// ── 0 훅: 표지 A와 같은 화면(게시/표지_1080x1920.jpg). 제목은 HookTitle이 3.7초까지 세워 둔다 ──
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const push = 1 + 0.02 * t;
  // 보낸 사진이 천천히 들린다 — 2.0초에 그 사진이 아래 큰 사진 자리로 온다
  const lift = interpolate(t, [0.2, 1.2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', left: 0, top: 660, width: 1080, height: 1260, overflow: 'hidden' }}>
        <Img src={staticFile('img/room_after.jpg')} style={{ display: 'block', width: 1080, height: 1260, objectFit: 'cover', objectPosition: '50% 100%', transform: `scale(${push})`, transformOrigin: '50% 60%' }} />
      </div>
      <Top solid={770} fade={280} />
      <div style={{ position: 'absolute', left: X, top: 796, fontFamily: KO, fontWeight: 500, fontSize: 30, lineHeight: 1.4, letterSpacing: '-0.01em', color: '#fff', opacity: 0.8, whiteSpace: 'nowrap' }}>작은 사진을 보냈더니, 큰 사진이 왔어요</div>
      <Img
        src={staticFile('img/room_before.jpg')}
        style={{ position: 'absolute', left: 70, top: 1196, width: 270, height: 405, boxSizing: 'border-box', objectFit: 'cover', border: '9px solid #fff', borderRadius: 10, boxShadow: `0 ${22 + 10 * lift}px ${50 + 16 * lift}px rgba(0,0,0,0.5)`, transform: `translateY(${-30 * lift}px) rotate(${-4 + 3 * lift}deg) scale(${1 + 0.12 * lift})` }}
      />
    </AbsoluteFill>
  );
};

// 표지 제목 — 아래 사진이 빈 방으로 바뀐 뒤에도 보낸 한 줄이 뜰 때까지 서 있다
const HookTitle: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= sec(S.line)) return null;
  const o = interpolate(f, [sec(S.line) - 3, sec(S.line)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 79, top: 352, opacity: o, fontFamily: KO, fontWeight: 800, fontSize: 128, letterSpacing: '-0.045em', lineHeight: 1.1, color: '#fff', whiteSpace: 'nowrap' }}>
      <div>사진 한 장에</div>
      <div>붙여 넣는</div>
      <div style={{ color: BUTTER }}>요청문 3개</div>
    </div>
  );
};

// ── 1 빈 방 → 채워진 방: 보낸 한 줄을 말하는 동안 위에서 아래로 채워진다 ──
const Room: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS + S.room;
  // 판은 초마다 1%씩 다가간다(빈 방 · 채워진 방이 서 있는 동안 화면이 멈춰 보이지 않게 — 올리기 전 검사 「거의 멈춘 시간」)
  const z = useSettle(0.01);
  // 바뀌는 선은 위 그늘이 걷히기 시작하는 자리(판 안 230px)에서 떠나 같은 빠르기로 내려간다 — 그늘 속에서 1초를 보내지 않는다
  const p = interpolate(t, [S.fill0, S.fill1], [0, 1], clamp);
  const y = interpolate(p, [0, 1], [230, 1350]);
  const img: React.CSSProperties = { position: 'absolute', left: 0, top: 0, display: 'block', width: 1080, height: 1260, objectFit: 'cover', objectPosition: '50% 100%' };
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', left: 0, top: 660, width: 1080, height: 1260, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 60%' }}>
          <Img src={staticFile('img/room_before.jpg')} style={img} />
          {p > 0 ? (
            <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: wipeMask(y), maskImage: wipeMask(y) }}>
              <Img src={staticFile('img/room_after.jpg')} style={img} />
            </div>
          ) : null}
        </div>
      </div>
      <Top solid={770} fade={280} />
    </AbsoluteFill>
  );
};

// 세로 사진 한 장을 판 자리(zone부터 화면 끝까지)에 놓는다
const Sheet: React.FC<{ zone: number; children: React.ReactNode; drift?: number; origin?: string }> = ({ zone, children, drift = 0.006, origin = '50% 40%' }) => {
  const z = useSettle(drift);
  return (
    <div style={{ position: 'absolute', left: 0, top: zone, width: 1080, height: 1920 - zone, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}</div>
    </div>
  );
};
const ZONE = 650;

// ── 2 손글씨 메뉴판 → 새 메뉴판: 같은 자리 · 같은 너비로 놓고 위에서 아래로 바뀐다 ──
const Menu: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS + S.menu;
  const p = interpolate(t, [S.menuFill0, S.menuFill1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const y = interpolate(p, [0, 1], [40, 1400]);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sheet zone={ZONE} drift={0.01}>
        <Img src={staticFile('img/menu_before.jpg')} style={{ position: 'absolute', left: 109.5, top: -160, width: 861, height: 1530 }} />
        {p > 0 ? (
          <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: wipeMask(y, 14), maskImage: wipeMask(y, 14) }}>
            <div style={{ position: 'absolute', left: 109.5, top: 0, width: 861, height: 1270, background: INK }} />
            <Img src={staticFile('img/menu_after.jpg')} style={{ position: 'absolute', left: 110, top: -12, width: 860, height: 1290 }} />
          </div>
        ) : null}
      </Sheet>
      <Top solid={ZONE} fade={60} />
    </AbsoluteFill>
  );
};

// ── 3 옛날 사진 → 살짝 웃는 영상. 받은 영상(720×1280)을 보낸 사진과 같은 자리 · 같은 크기로 겹쳐 띄운다 ──
// 받은 영상은 흰 바탕 위 둥근 모서리 사진이다(사진 자리 x 23~694 · y 103~1178). 창(WIN)으로 잘라 흰 띠와 둥근 모서리를 감춘다.
// 얼굴로 당기지 않는다(독립 검수: 얼굴이 커지면 볼이 넓어 보여 다른 사람처럼 읽힌다) — 판 전체가 초마다 1%씩 다가갈 뿐이다(칸 전체에서 6% 안).
// 영상은 요청문과 맞는 구간(받은 영상 4.7~8.57초 — 입 다문 옅은 웃음 · 8.21~8.42초 눈 깜빡임 한 번)을 원래 빠르기로 쓴다(scripts/재료.sh).
const K_PHOTO = 1.3125; // 영상 속 사진 너비를 보낸 사진 속 사진 너비에 맞춘 배율
const WIN = { left: 110, top: 31, width: 857, height: 1239 }; // 판 안 자리 — 영상의 사진 자리에서 모서리 반지름만큼 안쪽
const Photo: React.FC = () => {
  const f = useCurrentFrame();
  const move = sec(S.photoMove) - sec(S.photo);
  const o = interpolate(f, [move, move + 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sheet zone={ZONE} drift={0.01}>
        <div style={{ position: 'absolute', left: WIN.left, top: WIN.top, width: WIN.width, height: WIN.height, overflow: 'hidden' }}>
          {o < 1 ? <Img src={staticFile('img/photo_before.jpg')} style={{ position: 'absolute', left: 69.5 - WIN.left, top: -100 - WIN.top, width: 941, height: 1672 }} /> : null}
          {f >= move ? (
            <div style={{ position: 'absolute', inset: 0, opacity: o }}>
              <Sequence from={move} layout="none">
                <OffthreadVideo muted src={staticFile('img/photo_after.mp4')} style={{ position: 'absolute', left: 67 - WIN.left, top: -126 - WIN.top, width: 720 * K_PHOTO, height: 1280 * K_PHOTO }} />
              </Sequence>
            </div>
          ) : null}
        </div>
      </Sheet>
      <Top solid={ZONE + 20} fade={70} />
    </AbsoluteFill>
  );
};

// ── 모음: 보낸 사진 세 장(빈 방 · 손글씨 메뉴판 · 옛날 사진)이 하나씩 놓인다 — 표지의 작은 사진과 같은 꼴 ──
const PRINTS: { src: string; x: number; y: number; r: number; pos: string }[] = [
  { src: 'img/room_before.jpg', x: 34, y: 884, r: -4, pos: '50% 50%' },
  { src: 'img/menu_before.jpg', x: 362, y: 850, r: 2, pos: '50% 46%' },
  { src: 'img/photo_before.jpg', x: 690, y: 890, r: -2.5, pos: '50% 42%' },
];
const Recap: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: INK }}>
      {PRINTS.map((q, i) => {
        const a = 1 + i * 9;
        const p = interpolate(f, [a, a + 7], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <Img key={i} src={staticFile(q.src)} style={{ position: 'absolute', left: q.x, top: q.y, width: 356, height: 534, boxSizing: 'border-box', objectFit: 'cover', objectPosition: q.pos, border: '9px solid #fff', borderRadius: 10, boxShadow: '0 22px 50px rgba(0,0,0,0.5)', opacity: p, transform: `translateY(${(1 - p) * 26}px) rotate(${q.r}deg) scale(${1.05 - 0.05 * p})` }} />
        );
      })}
    </AbsoluteFill>
  );
};

// ── 끝: 채워진 방이 화면 가득. 판을 내리고 빈 위쪽은 같은 장면 윗부분을 뒤집어 흐리게 채운 뒤 위 그늘(천장 등 자리는 그늘에 묻는다) ──
const End: React.FC = () => {
  const z = useSettle(0.008);
  const d = 390;
  const pic: React.CSSProperties = { position: 'absolute', left: -101, top: 0, width: 1282, height: 1920, display: 'block' };
  const mask = 'linear-gradient(to bottom, rgba(0,0,0,0) 0px, #000 150px)';
  return (
    <AbsoluteFill style={{ background: INK, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(34px) brightness(0.9)' }}>
        <Img src={staticFile('img/room_after.jpg')} style={pic} />
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 45%', WebkitMaskImage: mask, maskImage: mask }}>
        <Img src={staticFile('img/room_after.jpg')} style={pic} />
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.97) 0px, rgba(10,10,10,0.96) 560px, rgba(10,10,10,0.5) 760px, rgba(10,10,10,0) 980px)' }} />
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string) => l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));

// 큰 글자가 곧 말 — 줄 단위로 28px 올라오며 뜬다. off = 이 구성이 본편의 몇 초부터인지(장면 판에서 쓴다)
const Big: React.FC<{ off?: number }> = ({ off = 0 }) => {
  const f = useCurrentFrame() + sec(off);
  return (
    <>
      {LINES.map((l, i) => {
        if (f < sec(l.from) - (l.hard ? 0 : 2) || f >= sec(l.to)) return null;
        return (
          <div key={i} style={{ position: 'absolute', left: X, top: 352, fontFamily: KO, fontWeight: 800, fontSize: l.size, letterSpacing: '-0.045em', lineHeight: l.size >= 120 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap', textShadow: l.size >= 140 ? '0 2px 18px rgba(0,0,0,0.55)' : undefined }}>
            {l.lines.map((s, k) => {
              const a = sec(l.at[k] ?? l.from);
              const p = l.hard ? 1 : interpolate(f, [a - 2, a + 4], [0, 1], { ...clamp, easing: EASE_OUT });
              return <div key={k} style={{ opacity: p, transform: `translateY(${(1 - p) * 28}px)` }}>{rich(s)}</div>;
            })}
          </div>
        );
      })}
    </>
  );
};

// 위 작은 줄 — 굵은 낱말 + 옅은 설명(표지의 「SYNK 브리핑 따라 하는 AI」 꼴)
const Tag: React.FC<{ off?: number }> = ({ off = 0 }) => {
  const f = useCurrentFrame() + sec(off);
  const g = TAGS.find((x) => f >= sec(x.from) && f < sec(x.to));
  if (!g) return null;
  const size = g.size ?? 40;
  return (
    <div style={{ position: 'absolute', left: X, top: size === 34 ? 292 : 286, fontFamily: KO, fontWeight: 700, fontSize: size, letterSpacing: '0.01em', lineHeight: 1.2, color: '#fff', whiteSpace: 'nowrap', textShadow: f >= sec(S.end) ? '0 1px 10px rgba(0,0,0,0.7)' : undefined }}>
      {g.b}
      {g.bar ? <span style={{ display: 'inline-block', width: 2, height: 30, margin: '0 20px', background: 'rgba(255,255,255,0.42)', verticalAlign: '-3px' }} /> : null}
      {g.i ? <span style={{ fontWeight: 500, opacity: size === 34 ? 0.7 : 0.74, marginLeft: g.bar ? 0 : 16 }}>{g.i}</span> : null}
    </div>
  );
};

const Sound: React.FC<{ from?: number; to?: number }> = ({ from = 0, to = TOTAL_S }) => (
  <>
    <Audio src={staticFile('bgm.wav')} trimBefore={sec(from)} volume={(fr) => interpolate(fr + sec(from), BGM.t.map(sec), BGM.v, clamp) * MASTER} />
    {VO.filter((v) => v.t >= from && v.t < to).map((v) => (
      <Sequence key={v.id} from={sec(v.t - from)}><Audio src={staticFile(`vo/${v.id}.wav`)} volume={MASTER} /></Sequence>
    ))}
    {SOUNDS.filter((s) => s.t >= from && s.t < to).map((s, i) => (
      <Sequence key={i} from={Math.max(0, sec(s.t - from))} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
    ))}
  </>
);

const Seq: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={sec(a)} durationInFrames={sec(b) - sec(a)}>{children}</Sequence>
);

export const Film: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Seq a={S.hook} b={S.room}><Hook /></Seq>
    <Seq a={S.room} b={S.menu}><Room /></Seq>
    <Seq a={S.menu} b={S.photo}><Menu /></Seq>
    <Seq a={S.photo} b={S.recap}><Photo /></Seq>
    <Seq a={S.recap} b={S.end}><Recap /></Seq>
    <Seq a={S.end} b={S.total}><End /></Seq>
    <HookTitle />
    <Big />
    <Tag />
    <Sound />
  </AbsoluteFill>
);

// 한 장면 판 — 빈 방이 보낸 한 줄을 따라 채워지는 장면만(제목 · 위 작은 줄 없이, 그 장면의 소리째)
export const SCENE_FROM = S.line - 0.3;
export const SCENE_TOTAL = sec(S.menu) - sec(SCENE_FROM);
export const SceneRoom: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence from={sec(S.room) - sec(SCENE_FROM)}><Room /></Sequence>
    <Big off={SCENE_FROM} />
    <Sound from={SCENE_FROM} to={S.menu} />
  </AbsoluteFill>
);
