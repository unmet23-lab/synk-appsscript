// synkbrief B72 「ChatGPT 공부하기 — 답만 달라고 해도 힌트로 되묻게 하기」 본편 — 수요 장부 synkbrief 5번(자료 나눔 꼴, 한 사람의 한 가지 일).
// 결(장부 머리말 「화면 결」): 실제 화면(판)을 아래에 두고, 빈 위쪽은 같은 판을 뒤집어 흐리게 채운 뒤 그늘을 얹는다. 큰 글자가 곧 말이다.
// 검정 · 흰 + 버터 한 곳, SUIT 하나. 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선은 우리가 더하지 않는다.
// 판의 조각은 모두 2026-11-24 ChatGPT에서 받은 실제 화면을 자른 것이고(scripts/재료.py), 글 · 값은 그대로 크게 다시 짰다.
// 움직임은 작게 — 판은 들어올 때 1.03배에서 내려앉고 천천히 다가가며, 빈칸 식은 아이가 답하면 같은 자리에서 채워진 식(다음 답에 실제로 나온 식)으로 바뀐다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import sizes from './sizes.json';
import { S, VO, TAGS, LINES, END_LINES, SOUNDS, FPS, END, N7_AT, STAGES, PLAIN_ANSWER, HINT_AT, SCENE_CHAT, SCENE_SOUNDS, SCENE_DUR, totalOf, bgmOf, type Variant } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IO = Easing.inOut(Easing.cubic);
const sec = (s: number) => Math.round(s * FPS);
const PAPER = 'rgb(252,252,252)'; // 찍은 ChatGPT 밝은 화면의 바탕색 — 자른 조각이 판에 녹는다
const SHADE = '10,10,10';
const BUTTER = '#F5C445';
const X = 84;
const PT = 700; // 판 윗변(본편)
const TEXT_TOP = 322;
const TAG_TOP = 264; // 올리기 전 검사 「위 머리 자리」 안전선 269
const SAFE_BOTTOM = 1430; // 판의 주된 글은 이 위에 둔다(릴스 · 쇼츠 글 자리 위)
const MASTER = 0.8;
const SZ = sizes as unknown as Record<string, [number, number]>;
const img = (n: string) => staticFile(`img/${n}.png`);

// 조각 한 장을 판 좌표 (x, y)에 k배로
const Pic: React.FC<{ n: string; x: number; y: number; k: number; style?: React.CSSProperties }> = ({ n, x, y, k, style }) => {
  const [w, h] = SZ[n];
  return <Img src={img(n)} style={{ position: 'absolute', left: x, top: y, width: w * k, height: h * k, display: 'block', ...style }} />;
};
const right = (n: string, k: number, edge = 905) => edge - SZ[n][0] * k; // 내가 보낸 말풍선은 오른쪽 끝을 905에(오른쪽 단추 자리 밖)
const center = (n: string, k: number) => (1080 - SZ[n][0] * k) / 2;

// 판 높이를 아는 자리(아래 입력 칸이 판 높이에 맞춘다)
const PanelH = React.createContext(1920 - PT);

// 아래 입력 칸 — 실제 화면처럼 판 아래에 둔다(판 아래가 비지 않게)
const Composer: React.FC = () => {
  const h = React.useContext(PanelH);
  return <Pic n="composer" x={(1080 - SZ.composer[0]) / 2} y={h - SZ.composer[1] - 40} k={1} />;
};

// 등장 — 0.2초에 걸쳐 24px 올라오며 뜬다
const inAt = (t: number, a: number, d = 0.2) => interpolate(t, [a - 0.02, a + d], [0, 1], { ...clamp, easing: EASE_OUT });
const Rise: React.FC<{ n: string; x: number; y: number; k: number; p: number }> = ({ n, x, y, k, p }) =>
  p <= 0 ? null : <Pic n={n} x={x} y={y + (1 - p) * 24} k={k} style={{ opacity: p }} />;

// ── 판의 내용(판 좌표: 0 = 판 윗변) ──
// 0 훅(문제 먼저): 공부하기만 켠 채팅 — 내가 보낸 첫 말 「공부하기 이 문제 풀어 줘」 · (ChatGPT의 빈칸 질문은 옅게) · 「그냥 답만 알려 줘」 → 1.25초 「정답: x = 7」
// 이해 시험 2회 볼 이유 심사 「두 채팅의 앞 질문이 달라 같은 말 비교가 안 된다」 — 두 채팅을 같은 꼴(첫 말 → 같은 말 → 답)로 맞춘다. 다른 것은 첫 말의 한 줄뿐이다
// 내가 올린 숙제 사진 — 실제 채팅에서 첫 말 위 오른쪽에 붙은 자리(이해 시험 3회 s · h · o 「정답 x = 7이 무슨 문제의 답인지 모름」)
const Photo: React.FC<{ w: number; y: number }> = ({ w, y }) => {
  const [pw, ph] = SZ.photo_q;
  const h = (w * ph) / pw;
  return (
    <div style={{ position: 'absolute', left: 905 - w, top: y, width: w, height: h, borderRadius: 22, overflow: 'hidden', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.10)' }}>
      <Img src={img('photo_q')} style={{ width: w, height: h, display: 'block' }} />
    </div>
  );
};
// 미학 맹검(카본) 「노트 카드 윗부분이 제목 판 그늘에 잘림」 · 「흐린 빈칸 질문 위에 식이 없음」 — 사진을 그늘(46px) 아래로 내리고, 두 채팅 모두 ChatGPT의 빈칸 질문 줄은 뺀다(두 채팅의 꼴은 같게: 사진 → 첫 말 → 같은 말 → 답)
const PlainPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.hook + f / FPS;
  const p = inAt(t, PLAIN_ANSWER, 0.16);
  const pop = interpolate(t, [PLAIN_ANSWER, PLAIN_ANSWER + 0.25], [1.12, 1], { ...clamp, easing: EASE_OUT });
  return (
    <>
      <Photo w={380} y={56} />
      <Pic n="u_bubble0" x={right('u_bubble0', 0.95)} y={232} k={0.95} />
      <Pic n="u_bubble" x={right('u_bubble', 1.0)} y={380} k={1.0} />
      {p > 0 ? (
        <div style={{ position: 'absolute', left: 72, top: 536, opacity: p, transform: `scale(${pop})`, transformOrigin: '0% 50%' }}>
          <Pic n="u_answer" x={0} y={0} k={2.25} />
        </div>
      ) : null}
      <Composer />
    </>
  );
};

// 1 뒤집기: 한 줄을 붙인 채팅 — 같은 사진 · 내가 보낸 첫 말(공부하기 + 한 줄) · 같은 말 → 「아까 약속한 대로 정답 대신 힌트를 줄게! 😊」, 「힌트만」에 힌트 줄
const FixPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.fix + f / FPS;
  return (
    <>
      <Photo w={300} y={56} />
      <Pic n="g_bubble" x={right('g_bubble', 0.88)} y={196} k={0.88} />
      <Pic n="g_bubble2" x={right('g_bubble2', 1.0)} y={449} k={1.0} />
      <Pic n="g_refuse" x={72} y={598} k={1.0} />
      <Rise n="g_hint" x={72} y={670} k={1.0} p={inAt(t, HINT_AT)} />
      <Composer />
    </>
  );
};

// 2 켜는 곳: + 메뉴 → 「공부」를 쳐서 뜬 공부하기 → 사진 · 공부하기 · 한 줄이 든 입력 칸. 입력 칸 아래 끝을 같은 자리에 둔다
// (이해 시험 1회 s · h 「공부하기가 무엇이고 어디 있는지 모름」 — + 를 누른 메뉴부터 보인다)
const TurnPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.turn + f / FPS;
  const n = t >= S.turnPhoto ? 'c6' : t >= S.turnStudy ? 'c2' : 'c1';
  const k = 1.04;
  const [w, h] = SZ[n];
  const bottom = SAFE_BOTTOM - PT + 10 - (t - S.turn) * 16; // 올리기 전 검사 ② 「거의 멈춤」 — 1초에 16px 위로 흐른다
  return <Pic n={n} x={(1080 - w * k) / 2} y={bottom - h * k} k={k} />;
};

// 3 실제로 보낸 한 줄(말풍선) → ChatGPT의 약속
const GuardPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.guard + f / FPS;
  return (
    <>
      <Pic n="g_bubble" x={right('g_bubble', 1.22)} y={40} k={1.22} />
      <Rise n="g_ack" x={72} y={420} k={0.85} p={inAt(t, S.guardAck)} />
      <Composer />
    </>
  );
};

// 4 빈칸 채우기: 단계마다 식 · 질문 → 아이 답 말풍선 → 칭찬 줄과 같은 자리의 채워진 식.
// 다음 단계로 갈 때 앞 단계는 위로 밀려 올라간다(채팅처럼 — 장면 심사 2판 「단계마다 앞 대화가 지워져 녹화로 안 믿긴다」)
const EQ_K = 1.9;
const StageBlock: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const st = STAGES[i];
  // 이해 시험 3회 o 「3x−6에서 x를 옮기는 단계 없이 2x=?로 건너뜀」 — 받은 답의 이항 줄(3x − x = 8 + 6)을 식 위에 둔다
  const preK = 1.5;
  const preH = st.pre ? SZ[st.pre][1] * preK : 0;
  const eqK = st.eq === 'g_eq3' ? 1.5 : st.pre ? 1.6 : EQ_K;
  const eqH = SZ[st.eq][1] * eqK;
  const eqY = st.pre ? 24 + preH + 16 : 30;
  const b = inAt(t, st.bAt);
  const ok = inAt(t, st.okAt, 0.18);
  const pop = interpolate(t, [st.okAt, st.okAt + 0.25], [1.08, 1], { ...clamp, easing: EASE_OUT });
  const qY = eqY + eqH + 34;
  const okY = Math.max(560, qY + 110 + SZ[st.b][1] * 1.15 + 24);
  let okX = 72;
  return (
    <>
      {st.pre ? <Pic n={st.pre} x={center(st.pre, preK)} y={24} k={preK} /> : null}
      <Pic n={st.eq} x={center(st.eq, eqK)} y={eqY} k={eqK} style={{ opacity: st.fill ? interpolate(t, [st.okAt - 0.06, st.okAt], [1, 0], clamp) : 1 }} />
      {st.fill && ok > 0 ? (
        <div style={{ position: 'absolute', left: center(st.fill, eqK), top: eqY + (eqH - SZ[st.fill][1] * eqK) / 2, opacity: ok, transform: `scale(${pop})`, transformOrigin: '50% 50%' }}>
          <Pic n={st.fill} x={0} y={0} k={eqK} />
        </div>
      ) : null}
      <Pic n={st.q} x={72} y={qY} k={st.q === 'g_ask3' ? 0.88 : 1.15} />
      <Rise n={st.b} x={right(st.b, 1.15)} y={qY + 110} k={1.15} p={b} />
      {st.ok.map((n) => {
        const x = okX;
        okX += SZ[n][0] * 1.25 - 6;
        return <Rise key={n} n={n} x={x} y={okY} k={1.25} p={ok} />;
      })}
    </>
  );
};
const StagePanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.fill + f / FPS;
  const idx = STAGES.reduce((a, s, k) => (t >= s.at - 0.001 ? k : a), 0);
  const sw = idx > 0 ? interpolate(t, [STAGES[idx].at, STAGES[idx].at + 0.35], [0, 1], { ...clamp, easing: EASE_IO }) : 1;
  return (
    <>
      {idx > 0 && sw < 1 ? (
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-sw * 260 - (t - STAGES[idx - 1].at) * 14}px)`, opacity: 1 - sw }}>
          <StageBlock i={idx - 1} t={t} />
        </div>
      ) : null}
      {/* 올리기 전 검사 ② 「거의 멈춤」 — 단계마다 1초에 14px 위로 흐른다(채팅이 올라가듯) */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - sw) * 120 - (t - STAGES[idx].at) * 14}px)`, opacity: sw }}>
        <StageBlock i={idx} t={t} />
      </div>
      <Composer />
    </>
  );
};

// 5 끝: 붙인 한 줄(실제로 보낸 말풍선)과 「정답이야! 🎉」 · 「스스로 문제를 잘 풀었어.」를 함께 크게
// (이해 시험 1회 s · h 「끝이 안내로만 끝나 흐지부지 · 핵심 한 줄을 다시 보이지 않는다」)
const EndPanel: React.FC = () => (
  <>
    <Pic n="g_bubble" x={right('g_bubble', 1.15)} y={30} k={1.15} />
    <Pic n="g_ok7a" x={72} y={384} k={1.45} />
    <Pic n="g_ok7b" x={62} y={484} k={1.8} />
    <Composer />
  </>
);

// 한 장면 심사용: 한 줄을 붙인 채팅을 실제 차례대로 — 새 줄이 뜰 때 아래 끝이 보이는 칸 안에 오게 위로 올라간다
const SceneChatPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const room = 1430;
  let y = 60;
  const rows = SCENE_CHAT.map((c) => {
    const h = SZ[c.n][1] * c.k;
    const row = { ...c, y, h };
    y += h + 34;
    return row;
  });
  const need = (tt: number) => Math.max(0, ...rows.filter((r) => r.at <= tt).map((r) => r.y + r.h - room));
  const starts = [...new Set(rows.map((r) => r.at))].sort((a, b) => a - b);
  let lift = need(starts[0]);
  for (let i = 1; i < starts.length; i++) {
    const a = starts[i];
    const p = interpolate(t, [a - 0.05, a + 0.4], [0, 1], { ...clamp, easing: EASE_OUT });
    lift = lift + (need(a) - lift) * p;
  }
  return (
    <>
      {rows.map((r) => {
        const p = r.at <= 0 ? 1 : inAt(t, r.at);
        const x = r.r ? right(r.n, r.k) : r.c ? center(r.n, r.k) : 60;
        return p <= 0 ? null : <Pic key={r.n} n={r.n} x={x} y={r.y - lift + (1 - p) * 24} k={r.k} style={{ opacity: p }} />;
      })}
      <Composer />
    </>
  );
};

// 판 한 장 — 들어올 때 1.03배에서 내려앉고 천천히 다가간다. 위쪽은 같은 판을 뒤집어 흐리게 채우고 그늘을 얹는다
const Board: React.FC<{ pt?: number; drift?: number; origin?: string; children: React.ReactNode }> = ({ pt = PT, drift = 0.012, origin = '50% 25%', children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
  const H = 1920 - pt;
  const inner = (
    <PanelH.Provider value={H}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}</div>
    </PanelH.Provider>
  );
  return (
    <AbsoluteFill style={{ background: `rgb(${SHADE})` }}>
      {pt > 0 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: pt, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: -40, top: pt, width: 1160, height: H, background: PAPER, transform: 'scaleY(-1)', transformOrigin: '50% 0%', filter: 'blur(26px)' }}>
            <div style={{ position: 'absolute', left: 40, top: 0, width: 1080, height: H }}>{inner}</div>
          </div>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(${SHADE},0.95) 0%, rgba(${SHADE},0.86) 62%, rgba(${SHADE},0.62) 100%)` }} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, top: pt, width: 1080, height: H, overflow: 'hidden', background: PAPER }}>
        {inner}
        {pt > 0 ? <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 46, background: `linear-gradient(to bottom, rgba(${SHADE},0.32), rgba(${SHADE},0))` }} /> : null}
      </div>
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string) => l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));

// 큰 글자가 곧 말 — 첫 줄은 구성 첫 프레임부터 서 있고, 다음 줄부터 28px 올라오며 뜬다
const BigBlock: React.FC<{ lines: string[]; at: number[]; size: number }> = ({ lines, at, size }) => {
  const f = useCurrentFrame();
  const first = sec(at[0]);
  return (
    <div style={{ position: 'absolute', left: X, top: TEXT_TOP, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: '-0.045em', lineHeight: size >= 110 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap' }}>
      {lines.map((s, k) => {
        const a = sec(at[k]);
        const p = a <= first ? 1 : interpolate(f, [a - 2, a + 4], [0, 1], { ...clamp, easing: EASE_OUT });
        return <div key={k} style={{ opacity: p, transform: `translateY(${(1 - p) * 28}px)` }}>{rich(s)}</div>;
      })}
    </div>
  );
};
const Big: React.FC<{ v: Variant }> = ({ v }) => {
  const f = useCurrentFrame();
  const ctaAt = N7_AT + END[v].ctaAt;
  if (f >= sec(ctaAt)) return <BigBlock lines={END[v].cta} at={[ctaAt, N7_AT + END[v].cta2At]} size={120} />;
  if (f >= sec(S.end)) return <BigBlock lines={END_LINES.lines} at={END_LINES.at} size={END_LINES.size} />;
  const l = LINES.find((x) => f >= sec(x.from) && f < sec(x.to));
  return l ? <BigBlock lines={l.lines} at={l.at} size={l.size} /> : null;
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

const Sound: React.FC<{ v: Variant }> = ({ v }) => {
  const total = totalOf(v);
  const bgm = bgmOf(total);
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, bgm.t.map(sec), bgm.v, clamp) * MASTER} />
      {[...VO, { id: END[v].vo, t: N7_AT }].map((o, i) => (
        <Sequence key={i} from={sec(o.t)}>
          <Audio src={staticFile(`vo/${o.id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {SOUNDS.map((s, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, sec(s.t))} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
      ))}
      <Sequence from={sec(N7_AT + END[v].cta2At)} durationInFrames={45}><Audio src={staticFile('sfx/thud.wav')} volume={0.26 * MASTER} /></Sequence>
    </>
  );
};

const Seq: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={sec(a)} durationInFrames={sec(b) - sec(a)}>{children}</Sequence>
);

// 판들의 차례 — 빈칸 채우기(S.fill~S.end)는 한 판으로 이어 간다
const Boards: React.FC<{ v: Variant }> = ({ v }) => (
  <>
    <Seq a={S.hook} b={S.fix}><Board drift={0.012}><PlainPanel /></Board></Seq>
    <Seq a={S.fix} b={S.turn}><Board drift={0.014}><FixPanel /></Board></Seq>
    <Seq a={S.turn} b={S.guard}><Board drift={0.012} origin="50% 60%"><TurnPanel /></Board></Seq>
    <Seq a={S.guard} b={S.fill}><Board drift={0.016} origin="60% 20%"><GuardPanel /></Board></Seq>
    <Seq a={S.fill} b={S.end}><Board drift={0.004} origin="50% 40%"><StagePanel /></Board></Seq>
    <Seq a={S.end} b={totalOf(v)}><Board drift={0.018} origin="30% 20%"><EndPanel /></Board></Seq>
  </>
);

export const Film: React.FC<{ v: Variant }> = ({ v }) => (
  <AbsoluteFill style={{ background: `rgb(${SHADE})` }}>
    <Boards v={v} />
    <Big v={v} />
    <Tag />
    <Sound v={v} />
  </AbsoluteFill>
);

// 한 장면 심사용 — 한 줄을 붙인 채팅을 실제 차례대로(글 · 말 없이, 그 장면의 화면과 소리만). 위 글 자리가 없어 판을 맨 위부터 둔다
export const Scene: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    <Board pt={0} drift={0.004} origin="50% 40%"><SceneChatPanel /></Board>
    <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, [0, 8, sec(SCENE_DUR) - 20, sec(SCENE_DUR)], [0.14, 0.24, 0.24, 0], clamp) * MASTER} />
    {SCENE_SOUNDS.map((s, i) => (
      <Sequence key={i} from={sec(s.t)} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
    ))}
  </AbsoluteFill>
);
