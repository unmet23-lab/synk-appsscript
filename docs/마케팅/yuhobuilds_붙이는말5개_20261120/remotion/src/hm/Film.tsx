// 「AI한테 일 맡길 때 끝에 붙이는 말 5개」 본편 — 계정 개편 시험 편(11-20).
// 처음과 끝 두 줄은 진행자(승인 얼굴 C · Flow 진행컷을 범수 줄 시각에 맞춰 다시 담은 판 public/pv/p1.mp4 · p2.mp4, git 밖 원본),
// 가운데는 범수 보이스오버와 실제 그림(PC 정리 폴더 벽 · 실제 폴더 창 · 실제 AI 채팅 화면 · 실제로 받은 홈페이지 화면)이다.
// 화면 결: 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳 · SUIT 하나. 첫 화면은 표지 A(계정개편_시안_20261120/표지.html builds_A_얼굴)와 같은 짜임.
import React from 'react';
import { Audio } from '@remotion/media';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from '../lib/fonts';
import { clamp, IN_OUT, OUT } from '../lib/motion';
import { BGM, LEN, SFX, T, VO } from './timeline';
import { Wall } from './Wall';

export const FPS = 30;
export const F = (s: number) => Math.round(s * FPS);
export const TOTAL = F(LEN);

const INK = '#0A0A0A';
const WHITE = '#FFFFFF';
const BUTTER = '#F5C445';
const SUB = 'rgba(255,255,255,0.64)';
const LEFT = 79;

/** 처음 · 끝을 누가 맡나 — face = 진행자(승인 얼굴 C), mong = 몽글이(유호님 11-20 「내얼굴 대신 몽글이가 출연해서 알려주는건 어때?」의 견줄 판). */
export type Host = 'face' | 'mong';

const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const appear = (t: number, a: number, len = 0.22) => interpolate(t, [a, a + len], [0, 1], { ...clamp, easing: OUT });
/** 들어올 때 1.035배에서 당겨 앉음. */
const settle = (t: number, a: number) => 1.035 - 0.035 * appear(t, a, 0.34);

// ───────────────────────── 부품 ─────────────────────────

type Line = { at: number; node: React.ReactNode; size: number; color?: string; gap?: number; weight?: number };
/** 위 큰 글 — 줄 단위로 28px 올라오며(마스크로 자르지 않는다). */
const Head: React.FC<{ t: number; lines: Line[]; top: number; left?: number; still?: boolean }> = ({ t, lines, top, left = LEFT, still }) => (
  <div style={{ position: 'absolute', left, top, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap' }}>
    {lines
      .filter((l) => still || t >= l.at - 0.001)
      .map((l, i) => {
        const p = still ? 1 : appear(t, l.at);
        return (
          <div key={i} style={{ fontSize: l.size, fontWeight: l.weight ?? 800, color: l.color ?? WHITE, opacity: p, transform: `translateY(${(1 - p) * 28}px)`, marginTop: l.gap ?? 0 }}>
            {l.node}
          </div>
        );
      })}
  </div>
);

/** 계정 이름표 — 표지와 같은 자리 · 크기. */
const Tag: React.FC = () => (
  <div style={{ position: 'absolute', left: 84, top: 292, fontFamily: KO, fontSize: 34, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2, color: WHITE, whiteSpace: 'nowrap' }}>
    yuhobuilds<span style={{ fontWeight: 500, opacity: 0.7, marginLeft: 16 }}>AI와 회사 만들기</span>
  </div>
);

/** 진행자 — 진행컷을 아래로 내리고 위는 검정 그늘(표지와 같은 짜임). (ox, oy)는 컷 안 한 점(1080 × 1920 기준), 그 점을 붙들고 s배. */
const Presenter: React.FC<{ src: string; top: number; s: number; ox: number; oy: number; dx?: number; solid: number; fade: number }> = ({ src, top, s, ox, oy, dx = 0, solid, fade }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: INK }}>
    <div style={{ position: 'absolute', left: dx, top, width: 1080, height: 1920, transform: `scale(${s})`, transformOrigin: `${ox}px ${oy}px` }}>
      <OffthreadVideo src={staticFile(src)} muted style={{ width: 1080, height: 1920, display: 'block' }} />
    </div>
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,10,1) 0, rgba(10,10,10,1) ${solid}px, rgba(10,10,10,0) ${fade}px)` }} />
  </AbsoluteFill>
);

/** 몽글이 장면 — 구운 그림(2:3)을 폭 1080 · 높이 1620으로 깔고 위는 검정 그늘. 눈만 다른 두 장(a → b)을 mix만큼 겹쳐 넘긴다. (ox, oy)는 그림 안 한 점. */
const Mong: React.FC<{ a: string; b?: string; mix?: number; top: number; s: number; ox: number; oy: number; solid: number; fade: number }> = ({ a, b, mix = 0, top, s, ox, oy, solid, fade }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: INK }}>
    <div style={{ position: 'absolute', left: 0, top, width: 1080, height: 1620, transform: , transformOrigin:  }}>
      <Img src={staticFile(a)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620 }} />
      {b && mix > 0 && <Img src={staticFile(b)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1620, opacity: mix }} />}
    </div>
    <div style={{ position: 'absolute', inset: 0, background:  }} />
  </AbsoluteFill>
);

/** 실제 그림 한 장 — 28px 올라와 앉고 아주 천천히 다가간다. */
const Shot: React.FC<{ t: number; at: number; end: number; src: string; x: number; y: number; w: number; h: number; pos?: string; r?: number }> = ({ t, at, end, src, x, y, w, h, pos = '50% 50%', r = 20 }) => {
  const p = appear(t, at, 0.3);
  if (p <= 0) return null;
  const push = (1 + 0.07 * interpolate(t, [at, end], [0, 1], clamp)) * settle(t, at);
  return (
    <div style={{ position: 'absolute', left: x, top: y + (1 - p) * 28, width: w, height: h, opacity: p, borderRadius: r, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.22)', backgroundColor: '#161616' }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, transform: `scale(${push})` }} />
    </div>
  );
};

/** 그림 위 작은 이름표 — 그 그림이 무엇인지 한마디(그 칸 내내 서 있다). */
const Cap: React.FC<{ t: number; at: number; x: number; y: number; children: React.ReactNode }> = ({ t, at, x, y, children }) => {
  const p = appear(t, at, 0.26);
  return <div style={{ position: 'absolute', left: x, top: y + (1 - p) * 20, opacity: p, fontFamily: KO, fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, color: SUB, whiteSpace: 'nowrap' }}>{children}</div>;
};

/** 다섯 줄 가운데 몇 번째인지 — 가는 선 다섯(번호 · 동그라미 없이). */
const Ticks: React.FC<{ t: number; at: number; idx: number }> = ({ t, at, idx }) => (
  <div style={{ position: 'absolute', left: 84, top: 296, display: 'flex', gap: 20 }}>
    {[0, 1, 2, 3, 4].map((i) => {
      const on = i === idx ? appear(t, at, 0.3) : 0;
      return (
        <div key={i} style={{ width: 150, height: 6, borderRadius: 3, backgroundColor: i < idx ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
          {i === idx && <div style={{ width: `${on * 100}%`, height: '100%', backgroundColor: WHITE }} />}
        </div>
      );
    })}
  </div>
);

/** 붙이는 말 한 줄 — 위: 언제 쓰는지(작게) + 붙이는 말(크게, 말과 함께), 아래: 실제 그림. */
const Tip: React.FC<{ t: number; at: number; idx: number; label: string; lines: Line[]; children?: React.ReactNode }> = ({ t, at, idx, label, lines, children }) => {
  const p = appear(t, at);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Ticks t={t} at={at} idx={idx} />
      <div style={{ position: 'absolute', left: 82, top: 320 + (1 - p) * 28, opacity: p, fontFamily: KO, fontSize: 68, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap' }}>{label}</div>
      <Head t={t} top={408} lines={lines} />
      {children}
    </AbsoluteFill>
  );
};

const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: BUTTER }}>{children}</span>;

// ───────────────────────── 장면 ─────────────────────────

/** ① 처음 — 표지 짜임 → 진행자가 말하고, 「53기가」로 가며 얼굴이 끊김 없이 가까워진다(같은 판을 잘라 붙이지 않는다). Sequence 안이라 frame은 0부터. */
const Opening: React.FC<{ host: Host }> = ({ host }) => {
  const t = useCurrentFrame() / FPS;
  const near = t >= T.close;
  const a = interpolate(t, [0, T.wall], [0, 1], clamp);
  const q = interpolate(t, [T.say + 0.3, T.close + 0.25], [0, 1], { ...clamp, easing: IN_OUT });
  return (
    <AbsoluteFill>
      {host === 'mong' ? (
        // 몽글이 판: 눈 뜬 몽글이와 폴더 탑(표지와 같은 화면) → 「53기가」에서 뿌듯한 눈으로 바뀌며 조금 다가간다
        <Mong a="mong/a2.jpg" b="mong/a.jpg" mix={interpolate(t, [T.close - 0.12, T.close + 0.12], [0, 1], clamp)} top={150 - 40 * q} ox={600} oy={880} s={(1 + 0.045 * a) * (1 + 0.2 * q)} solid={430 - 30 * q} fade={640 - 40 * q} />
      ) : (
        <Presenter src="pv/p1.mp4" top={500 - 124 * q} ox={543} oy={262} s={(1 + 0.03 * a) * (1 + 0.36 * q)} solid={660 - 85 * q} fade={940 - 150 * q} />
      )}
      {!near && <Tag />}
      {t < T.say && (
        <Head
          t={t}
          still
          top={352}
          lines={[
            { at: 0, node: 'AI한테 일 맡길 때', size: 116 },
            { at: 0, node: '끝에 붙이는', size: 116 },
            { at: 0, node: <Gold>말 5개</Gold>, size: 116 },
          ]}
        />
      )}
      {inWin(t, T.say, T.close) && (
        <Head
          t={t}
          top={352}
          lines={[
            { at: T.say, node: 'PC 정리 맡겼더니', size: 100 },
            { at: T.n53, node: <>폴더 <Gold>53기가</Gold>를</>, size: 128 },
          ]}
        />
      )}
      {near && (
        <Head
          t={t}
          top={296}
          lines={[
            { at: T.close - 1, node: <>폴더 <Gold>53기가</Gold>를</>, size: 134 },
            { at: T.okay, node: '치워도 된대요', size: 110 },
          ]}
        />
      )}
    </AbsoluteFill>
  );
};

/** ② 실제 그림 — 칸 하나가 실제 폴더 하나인 벽. 53기가가 어두워지고 6.7기가만 남는다(남는 덩이는 글 바로 아래 오른쪽 위). */
const WallScene: React.FC<{ t: number }> = ({ t }) => {
  const k = settle(t, T.wall) * (1 + 0.025 * interpolate(t, [T.wall, T.n67], [0, 1], clamp)) * (1 + 0.13 * interpolate(t, [T.n67, T.ask], [0, 1], { ...clamp, easing: IN_OUT }));
  const why = appear(t, T.real + 0.45); // 칸이 어두워지는 동안 까닭이 먼저 뜨고, 그 위에 「6.7기가」가 앉는다
  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 668, width: 1080, height: 1300, transform: `scale(${k})`, transformOrigin: '859px 0px' }}>
        <Wall t={t} rise={T.wall - 2} dim={T.dim} gold={T.n67} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 668, backgroundColor: INK }} />
      {t < T.real ? (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.wall + 0.03, node: '끝까지 따라가 보니', size: 100 },
            { at: T.wall + 0.03, node: 'AI가 고른 폴더 53기가', size: 50, weight: 600, color: SUB, gap: 18 },
          ]}
        />
      ) : (
        <>
          <Head
            t={t}
            top={288}
            lines={[
              { at: T.real, node: '진짜 지워도 되는 건', size: 84 },
              { at: T.n67, node: <Gold>6.7기가</Gold>, size: 184 },
            ]}
          />
          <div style={{ position: 'absolute', left: 84, top: 590 + (1 - why) * 20, opacity: why, fontFamily: KO, fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, color: SUB, whiteSpace: 'nowrap' }}>나머지는 쓰던 폴더였어요</div>
        </>
      )}
    </AbsoluteFill>
  );
};

/** ③ 끝에 한마디 — 맡기는 글 끝에 한 줄이 붙는다(글은 공개한 요청문의 첫머리). */
const AskScene: React.FC<{ t: number }> = ({ t }) => {
  const p1 = appear(t, T.ask + 0.1, 0.3);
  const p1b = appear(t, T.ask + 0.5, 0.3);
  const p2 = appear(t, T.add, 0.26);
  const p2b = appear(t, T.add + 0.4, 0.26);
  const push = settle(t, T.ask) * (1 + 0.03 * interpolate(t, [T.ask, T.t1], [0, 1], clamp));
  const bar = interpolate(t, [T.add, T.add + 0.3], [264, 528], { ...clamp, easing: OUT });
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Head
        t={t}
        top={292}
        lines={[
          { at: T.ask - 0.3, node: '이제 일을 맡길 땐', size: 104 }, // 컷 첫 장부터 보인다(검정 장이 끼지 않게)
          { at: T.tail, node: <>끝에 <Gold>한마디</Gold></>, size: 150 },
        ]}
      />
      <div style={{ position: 'absolute', left: 84, top: 790, transform: `scale(${push})`, transformOrigin: '0 264px', fontFamily: KO, letterSpacing: '-0.04em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
        <div style={{ position: 'absolute', left: 0, top: 6, width: 5, height: bar, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)', opacity: p1 }} />
        <div style={{ marginLeft: 40, fontSize: 110, fontWeight: 600, color: 'rgba(255,255,255,0.46)' }}>
          <div style={{ opacity: p1, transform: `translateY(${(1 - p1) * 28}px)` }}>이 폴더 용량을</div>
          <div style={{ opacity: p1b, transform: `translateY(${(1 - p1b) * 28}px)` }}>정리해 줘.</div>
        </div>
        <div style={{ marginLeft: 40, fontSize: 110, fontWeight: 800, color: WHITE }}>
          <div style={{ opacity: p2, transform: `translateY(${(1 - p2) * 28}px)` }}>단, 아무것도</div>
          <div style={{ opacity: p2b, transform: `translateY(${(1 - p2b) * 28}px)` }}>지우지 마.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** ④-4 자동화 — 「완료」 보고가 세 주 쌓였는데 새로 쌓인 자료는 0개(공개한 요청문 설명의 그 일). 실제 화면이 개발 화면뿐이라 글자로 보인다. */
const DoneRows: React.FC<{ t: number }> = ({ t }) => {
  const rows = [T.t4 + 0.2, T.t4 + 0.75, T.t4 + 1.7];
  const z = appear(t, 20.49, 0.26);
  return (
    <div style={{ position: 'absolute', left: 84, top: 700, width: 790, fontFamily: KO, letterSpacing: '-0.04em', whiteSpace: 'nowrap', transform: `scale(${1 + 0.07 * interpolate(t, [T.t4, T.t5], [0, 1], clamp)})`, transformOrigin: '250px 300px' }}>
      {rows.map((at, i) => {
        const p = appear(t, at, 0.24);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', height: 116, borderBottom: '2px solid rgba(255,255,255,0.16)', opacity: p * (1 - 0.45 * z), transform: `translateY(${(1 - p) * 28}px)` }}>
            <span style={{ fontSize: 54, fontWeight: 600, color: SUB }}>{i + 1}주째 보고</span>
            <span style={{ fontSize: 84, fontWeight: 800, color: 'rgba(255,255,255,0.78)' }}>「완료」</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 44, opacity: z, transform: `translateY(${(1 - z) * 28}px)` }}>
        <span style={{ fontSize: 62, fontWeight: 700, color: WHITE }}>새로 쌓인 자료</span>
        <span style={{ fontSize: 190, fontWeight: 800, color: WHITE, lineHeight: 1 }}>0개</span>
      </div>
    </div>
  );
};

const Tips: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.t2)
    return (
      <Tip
        t={t}
        at={T.t1}
        idx={0}
        label="정리를 맡길 땐"
        lines={[
          { at: 12.29, node: '지우지 말고', size: 128 },
          { at: 12.77, node: <Gold>옮겨</Gold>, size: 128 },
        ]}
      >
        <Cap t={t} at={T.t1 + 0.1} x={84} y={716}>실제로 옮겨 둔 폴더예요 · 이름은 가렸어요</Cap>
        <Shot t={t} at={T.t1 + 0.36} end={T.t2} src="img/moved.jpg" x={70} y={784} w={850} h={578} pos="0% 0%" />
      </Tip>
    );
  if (t < T.t3)
    return (
      <Tip
        t={t}
        at={T.t2}
        idx={1}
        label="올리기를 맡길 땐"
        lines={[
          { at: 14.41, node: <Gold>승인 전엔</Gold>, size: 128 },
          { at: 14.87, node: '올리지 마', size: 128 },
        ]}
      >
        <Cap t={t} at={T.t2 + 0.1} x={84} y={770}>내가 끝에 붙인 말</Cap>
        <Shot t={t} at={T.t2 + 0.08} end={T.t3} src="img/up_ask.jpg" x={70} y={832} w={850} h={113} r={10} />
        <Cap t={t} at={T.t2 + 0.6} x={84} y={1020}>AI가 한 답</Cap>
        <Shot t={t} at={T.t2 + 0.58} end={T.t3} src="img/up_reply.jpg" x={70} y={1082} w={850} h={105} r={10} />
      </Tip>
    );
  if (t < T.t4)
    return (
      <Tip
        t={t}
        at={T.t3}
        idx={2}
        label="글을 맡길 땐"
        lines={[
          { at: 16.35, node: '모르는 건', size: 108 },
          { at: 16.77, node: '지어내지 말고', size: 108 },
          { at: 17.62, node: <Gold>빈칸으로</Gold>, size: 108 },
        ]}
      >
        <Cap t={t} at={T.t3 + 0.1} x={84} y={794}>AI가 써 온 글 · 모르는 후기는 비워 뒀어요</Cap>
        <Shot t={t} at={T.t3 + 0.08} end={T.t4} src="img/blank.jpg" x={70} y={858} w={850} h={368} />
      </Tip>
    );
  if (t < T.t5)
    return (
      <Tip
        t={t}
        at={T.t4}
        idx={3}
        label="자동화를 맡길 땐"
        lines={[
          { at: 19.71, node: '「완료」 말고', size: 112 },
          { at: 20.49, node: <><Gold>몇 개</Gold> 했는지 적어</>, size: 112 },
        ]}
      >
        <DoneRows t={t} />
      </Tip>
    );
  return (
    <Tip
      t={t}
      at={T.t5}
      idx={4}
      label="홈페이지를 맡길 땐"
      lines={[
        { at: 22.82, node: <>우리 가게 <Gold>포장지</Gold></>, size: 112 },
        { at: 23.56, node: '색과 글씨로', size: 112 },
      ]}
    >
      <Cap t={t} at={T.t5 + 0.1} x={84} y={794}>빵집은 종이봉투</Cap>
      <Cap t={t} at={T.t5 + 0.52} x={515} y={794}>꽃집은 포장지</Cap>
      <Shot t={t} at={T.t5 + 0.08} end={T.end} src="img/h1.jpg" x={79} y={858} w={409} h={472} pos="50% 0%" />
      <Shot t={t} at={T.t5 + 0.55} end={T.end} src="img/h2.jpg" x={510} y={858} w={409} h={472} pos="50% 0%" />
    </Tip>
  );
};

/** ⑤ 끝 — 진행자(처음과 다른 크기 · 높이 · 방향) → 끝 3초는 「53기가 → 6.7기가」 + 「댓글에 「한마디」」. Sequence 안이라 frame은 0부터. */
const Ending: React.FC<{ host: Host }> = ({ host }) => {
  const t = useCurrentFrame() / FPS + T.end;
  const q = interpolate(t, [T.cta - 0.08, T.cta + 0.42], [0, 1], { ...clamp, easing: IN_OUT });
  const drift = 1 + 0.03 * interpolate(t, [T.end, LEN], [0, 1], clamp) + 0.014 * appear(t, T.last, 0.3);
  const s = (1.46 + (1.3 - 1.46) * q) * drift * settle(t, T.end);
  const row = appear(t, T.cta);
  const cta = appear(t, T.cta + 0.1);
  const under = interpolate(t, [T.key, T.key + 0.3], [0, 100], { ...clamp, easing: OUT });
  return (
    <AbsoluteFill>
      {host === 'mong' ? (
        // 몽글이 판: 폴더 세 개와 봉투 옆에서 민망해하다가 「한마디」에서 웃는 눈으로
        <Mong a="mong/c.jpg" b="mong/c2.jpg" mix={interpolate(t, [T.key - 0.12, T.key + 0.12], [0, 1], clamp)} top={150} ox={470} oy={950} s={(1.1 + 0.06 * q) * drift * settle(t, T.end)} solid={520 + 60 * q} fade={720 + 60 * q} />
      ) : (
        <Presenter src="pv/p2.mp4" top={352 + 45 * q} ox={503} oy={258} dx={58} s={s} solid={545 + 65 * q} fade={760 + 70 * q} />
      )}
      {t < T.cta ? (
        <Head
          t={t}
          top={292}
          lines={[
            { at: T.end + 0.03, node: '붙여 넣을', size: 116 },
            { at: 25.47, node: '전체 문장은', size: 116 },
          ]}
        />
      ) : (
        <>
          <div style={{ position: 'absolute', left: LEFT, top: 284, display: 'flex', alignItems: 'flex-end', gap: 20, fontFamily: KO, fontWeight: 800, letterSpacing: '-0.045em', whiteSpace: 'nowrap', opacity: row, transform: `translateY(${(1 - row) * 28}px)` }}>
            <div>
              <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', color: SUB, lineHeight: 1.1 }}>AI는</div>
              <div style={{ fontSize: 96, lineHeight: 1.16, color: 'rgba(255,255,255,0.66)' }}>53기가</div>
            </div>
            <div style={{ fontSize: 76, lineHeight: 1.5, color: SUB, fontWeight: 500 }}>→</div>
            <div>
              <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', color: SUB, lineHeight: 1.1 }}>진짜는</div>
              <div style={{ fontSize: 132, lineHeight: 1.1, color: WHITE }}>6.7기가</div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: LEFT, top: 486, fontFamily: KO, fontSize: 104, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.1, color: WHITE, whiteSpace: 'nowrap', opacity: cta, transform: `translateY(${(1 - cta) * 28}px)` }}>
            댓글에{' '}
            <span style={{ color: BUTTER, backgroundImage: `linear-gradient(${BUTTER}, ${BUTTER})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 100%', backgroundSize: `${under}% 7px`, paddingBottom: 6 }}>「한마디」</span>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// ───────────────────────── 본편 ─────────────────────────

export const Film: React.FC<{ bgm?: boolean; voice?: boolean; host?: Host }> = ({ bgm = true, voice = true, host = 'face' }) => {
  const fr = useCurrentFrame();
  const t = fr / FPS;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Sequence from={0} durationInFrames={F(T.wall)} name="처음 · 진행자">
        <Opening host={host} />
      </Sequence>
      {inWin(t, T.wall, T.ask) && <WallScene t={t} />}
      {inWin(t, T.ask, T.t1) && <AskScene t={t} />}
      {inWin(t, T.t1, T.end) && <Tips t={t} />}
      <Sequence from={F(T.end)} durationInFrames={TOTAL - F(T.end)} name="끝 · 진행자">
        <Ending host={host} />
      </Sequence>

      {bgm && <Audio src={staticFile(BGM.file)} volume={(f: number) => BGM.vol * interpolate(f, [F(LEN - BGM.fadeOut), F(LEN)], [1, 0.55], clamp)} />}
      {voice &&
        VO.map((v) => (
          <Sequence key={v.id} from={F(v.at)} name={`말 ${v.id}`}>
            <Audio src={staticFile(`vo/${v.id}.wav`)} />
          </Sequence>
        ))}
      {voice &&
        SFX.map((x, i) => (
          <Sequence key={i} from={F(x.at)} name={`효과음 ${x.file}`}>
            <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={x.v} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
