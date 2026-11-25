// synkbrief B77 「여행 동선 — 가고 싶은 곳을 붙이고 '하루 세 곳만, 이동 30분 안' 한 줄」 본편 — 수요 장부 synkbrief 8번(자료 나눔 꼴, 한 사람의 한 가지 일).
// 결(장부 머리말 「화면 결」): 실제 화면(판)을 아래에 두고, 빈 위쪽은 같은 판을 뒤집어 흐리게 채운 뒤 그늘을 얹는다. 큰 글자가 곧 말이다.
// 검정 · 흰 + 버터 한 곳, SUIT 하나. 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선은 우리가 더하지 않는다.
// 판의 조각은 모두 2026-11-25 ChatGPT 임시 채팅(끝만 밝은 화면)과 카카오맵에서 받은 실제 화면을 자른 것이다(scripts/재료.py). 지도의 번호 · 길 · 이름은 ChatGPT가 그린 그대로다.
// 움직임은 작게 — 판은 들어올 때 1.03배에서 내려앉고 천천히 다가간다. 날짜를 바꾸면 실제로 바뀐 지도 화면으로 끊어 넘긴다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import sizes from './sizes.json';
import { S, VO, TAGS, LINES, END_LINES, END, SOUNDS, FPS, N7_AT, SCENE_SOUNDS, SCENE_DUR, DRAW_SCENE, DRAW_FILM, ROUTE_STEPS, LEG_LABELS, LEGS_PT, SCENE_END_AT, totalOf, bgmOf, type Variant, type Draw } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * FPS);
const DARK = 'rgb(14,14,14)'; // 찍은 ChatGPT 어두운 화면의 바탕색 — 자른 조각이 판에 녹는다
const WHITE = 'rgb(255,255,255)'; // 카카오맵 화면 바탕
const LIGHT = 'rgb(252,252,252)'; // 끝 — ChatGPT 밝은 화면 바탕(실험 E08)
const SHADE = '10,10,10';
const BUTTER = '#F5C445';
const X = 84;
const PT = 700; // 판 윗변
const TEXT_TOP = 322;
const TAG_TOP = 264; // 올리기 전 검사 「위 머리 자리」 안전선 269
const MASTER = 0.8;
const SZ = sizes as unknown as Record<string, [number, number]>;
const img = (n: string) => staticFile(`img/${n}.png`);

const Pic: React.FC<{ n: string; x: number; y: number; k: number; style?: React.CSSProperties }> = ({ n, x, y, k, style }) => {
  const [w, h] = SZ[n];
  return <Img src={img(n)} style={{ position: 'absolute', left: x, top: y, width: w * k, height: h * k, display: 'block', ...style }} />;
};
const right = (n: string, k: number, edge = 1040) => edge - SZ[n][0] * k; // 내가 보낸 말풍선은 오른쪽에
const center = (n: string, k: number) => (1080 - SZ[n][0] * k) / 2;
const fill = (n: string) => 1080 / SZ[n][0]; // 판 너비에 꽉

const PanelH = React.createContext(1920 - PT);
const Composer: React.FC = () => {
  const h = React.useContext(PanelH);
  return <Pic n="composer" x={(1080 - SZ.composer[0]) / 2} y={h - SZ.composer[1] - 30} k={1} />;
};

const inAt = (t: number, a: number, d = 0.2) => interpolate(t, [a - 0.02, a + d], [0, 1], { ...clamp, easing: EASE_OUT });
const Rise: React.FC<{ n: string; x: number; y: number; k: number; p: number }> = ({ n, x, y, k, p }) =>
  p <= 0 ? null : <Pic n={n} x={x} y={y + (1 - p) * 24} k={k} style={{ opacity: p }} />;

// ── 판의 내용(판 좌표: 0 = 판 윗변) ──
// 0 보낸 글: 가고 싶은 곳 열두 곳과 붙인 한 줄(실제 말풍선 그대로)
// (첫 컷 검사 v4 「말풍선 맨 아래 두 조건이 작다」 — 원래 크기 1.0배로 두고, 아래 입력 칸은 말풍선에 가려 뺀다)
const HookPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.list + f / FPS;
  // 이해 시험 2회 h 「「한 줄만 더했어요」가 무슨 줄인지 16초에야 나온다」 — 「한 줄만」(4.0초)에 말풍선이 끝 줄 쪽으로 커져 그 줄을 크게 보인다
  const g = interpolate(t, [3.95, 4.4], [0, 1], { ...clamp, easing: EASE_OUT });
  const k = 1 + 0.42 * g;
  const h = SZ.bubble[1];
  const y = 40 + g * (620 - 40 - h * 1.42);
  return <Pic n="bubble" x={right('bubble', k)} y={y} k={k} />;
};
// 1 · 2 펼친 지도 — 답 속 지도를 펼친 실제 화면(모든 날짜: 세 날의 길과 번호 1~9) · 날짜 고르기를 바꾼 화면(1일차 · 2일차 · 3일차)
const MapPanel: React.FC<{ n: string }> = ({ n }) => <Pic n={n} x={0} y={0} k={fill(n)} />;
// 1 길 그리기 — 길만 지운 바탕(핀 · 지명은 그대로) 위에 날마다 실제 흰 길이 첫 핀부터 드러난다. 다 그려지면 원래 화면(map_all)과 같다
const RoutePanel: React.FC<{ draws: Draw[]; legs?: boolean }> = ({ draws, legs }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const [w] = SZ.map_all;
  const k = 1080 / w;
  const done = draws.every((x) => t >= x.b);
  // 그날 길이 다 그려지면 카카오맵으로 잰 구간 시간을 길 옆에(흰 글자 · 그늘, 판 · 색 상자 없음)
  const labels = legs
    ? LEG_LABELS.map((l) => {
        const x = draws.find((dd) => dd.d === l.d);
        const p = x ? inAt(t, x.b + 0.05, 0.2) : 0;
        return p <= 0 ? null : (
          <div key={l.d} style={{ position: 'absolute', left: l.x * k, top: l.y * k + (1 - p) * 14, opacity: p, fontFamily: KO, fontWeight: 800, fontSize: 46, letterSpacing: '-0.02em', color: '#fff', whiteSpace: 'nowrap', textShadow: '0 2px 10px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9)' }}>{l.text}</div>
        );
      })
    : null;
  if (done) return <><MapPanel n="map_all" />{labels}</>;
  return (
    <>
      <Img src={img('map_base')} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: SZ.map_all[1] * k, display: 'block' }} />
      {draws.map((x) => {
        const p = interpolate(t, [x.a, x.b], [0, 1], clamp);
        if (p <= 0) return null;
        const step = Math.min(ROUTE_STEPS - 1, Math.floor(p * ROUTE_STEPS));
        return <Img key={x.d} src={staticFile(`img/route/d${x.d}_${String(step).padStart(2, '0')}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: SZ.map_all[1] * k, display: 'block' }} />;
      })}
      {labels}
    </>
  );
};
// 「구간마다」 — 다 그려진 원래 화면(모든 날짜) 위에 카카오맵으로 잰 구간 시간을 길 옆에(장면 심사 v7 「선마다 이동 시간」)
// 올리기 전 검사 「아래 앱 글자 자리」 — 우리가 얹은 「10분 · 6분」 · 「21분 · 13분」이 화면 아래 캡션 자리에 들어 판을 위로 올렸다(판 윗변 LEGS_PT).
// 판 위쪽은 큰 글 밑에 들어가니 그늘을 얹는다
const LegsPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.legs + f / FPS;
  const k = 1080 / SZ.map_all_tall[0];
  return (
    <>
      <Pic n="map_all_tall" x={0} y={0} k={k} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 330, background: `linear-gradient(to bottom, rgba(${SHADE},0.97) 0%, rgba(${SHADE},0.9) 45%, rgba(${SHADE},0) 100%)` }} />
      {LEG_LABELS.map((l, i) => {
        const p = inAt(t, S.legs + 0.1 + i * 0.12, 0.2);
        return p <= 0 ? null : (
          <div key={l.d} style={{ position: 'absolute', left: l.x * k, top: (l.yl ?? l.y) * k + (1 - p) * 14, opacity: p, fontFamily: KO, fontWeight: 800, fontSize: 50, letterSpacing: '-0.02em', color: '#fff', whiteSpace: 'nowrap', textShadow: '0 2px 10px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9)' }}>{l.text}</div>
        );
      })}
    </>
  );
};
// 끝 — 지도 없이 온 답(E07)에 이어 보낸 「지도로도 보여 줘.」(실제 말풍선) → 「지도로도」에 그 답의 지도 카드가 올라온다(E08, 밝은 화면)
const EndAsk: React.FC = () => <Pic n="end_ask" x={right('end_ask', 1.3, 1030)} y={40} k={1.3} />;
const EndPanel: React.FC<{ v: Variant }> = ({ v }) => {
  const f = useCurrentFrame();
  const t = S.end + f / FPS;
  const ka = 1.3;
  const ya = 40;
  const ym = ya + SZ.end_ask[1] * ka + 34;
  const km = (1920 - PT - ym - 24) / SZ.end_map[1];
  return (
    <>
      <Rise n="end_map" x={center('end_map', km)} y={ym} k={km} p={inAt(t, N7_AT + END[v].cta2At, 0.28)} />
    </>
  );
};
const DaysPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.d1 + f / FPS;
  const lead = 2 / FPS; // 큰 글은 뜨는 초보다 2칸 먼저 올라오기 시작한다 — 지도도 그 칸에 바꾼다(이해 시험 2회 G 「셋째 날 글인데 지도는 2일차」)
  const n = t >= S.d3 - lead ? 'map_d3' : t >= S.d2 - lead ? 'map_d2' : 'map_d1';
  return <MapPanel n={n} />;
};
// 3 뺀 곳 — 답 첫 문단(12곳 중 3곳은 제외) → 「제외한 3곳」과 까닭(「곳은」에 올라온다)
const ExclPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.excl + f / FPS;
  const k1 = 1.0;
  const k2 = 1.04; // 이해 시험 1회 s · G 「10초 제외 사유가 작아 못 읽음」 — 판 너비 끝까지 키운다(다가가며 양끝이 잘리지 않게 1.04배)
  const y2 = 40 + SZ.intro1[1] * k1 + 40;
  return (
    <>
      <Pic n="intro1" x={center('intro1', k1)} y={40} k={k1} />
      <Rise n="excluded" x={center('excluded', k2)} y={y2} k={k2} p={inAt(t, 9.3 + 0.558)} />
      <Composer />
    </>
  );
};
// 4 카카오맵 자동차 길찾기 — 태종대유원지 → 흰여울문화마을 21분 6.7km(길찾기 칸 위쪽)와 지도 위 길
const KakaoPanel: React.FC = () => {
  // 이해 시험 2회 s · h 「카카오맵 화면 글씨가 작다」 — 출발 · 도착, 자동차, 「21분 6.7km」를 따로 잘라 크게 놓고 그 아래 지도 위 길
  const kr = 1.9;
  const km = 1.45;
  const kt = 3.2;
  const yr = 26;
  const ym = yr + SZ.kakao_route[1] * kr + 18;
  const yt = ym + SZ.kakao_mode[1] * km + 14;
  const yp = yt + SZ.kakao_time[1] * kt + 20;
  return (
    <>
      <Pic n="kakao_route" x={center('kakao_route', kr)} y={yr} k={kr} />
      <Pic n="kakao_mode" x={center('kakao_mode', km)} y={ym} k={km} />
      <Pic n="kakao_time" x={84} y={yt} k={kt} />
      <Pic n="kakao_map" x={0} y={yp} k={1080 / SZ.kakao_map[0]} />
    </>
  );
};
// 한 줄 없이 보낸 답(E06) — 날마다 네 곳 표 → 「먼 곳까지」에 화면을 올려 열두 곳 지도(해동용궁사까지)를 크게(미학 맹검 「지도가 손톱만 하다」)
const WithoutPanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.without + f / FPS;
  const kt = 1.04;
  const km = 0.95;
  const yt = 30;
  const ym = yt + SZ.e06_table[1] * kt + 26;
  const at = 16.15 + 0.912;
  const up = interpolate(t, [at - 0.05, at + 0.45], [0, ym - 150], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 0, top: -up, width: 1080, height: 2400 }}>
      <Pic n="e06_table" x={center('e06_table', kt)} y={yt} k={kt} />
      <Rise n="e06_map" x={center('e06_map', km)} y={ym} k={km} p={inAt(t, at, 0.3)} />
    </div>
  );
};
// 5 붙인 한 줄 — 말풍선 끝 줄을 「하루에」에 크게, 그 아래 답의 「관광지 사이 이동이 30분 이내가 되도록 계획했어」
const FADE_TOP: React.CSSProperties = { WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 34%)', maskImage: 'linear-gradient(to bottom, transparent 0%, #000 34%)' };
const LinePanel: React.FC = () => {
  const f = useCurrentFrame();
  const t = S.line + f / FPS;
  const g = interpolate(t, [S.lineIn - 0.05, S.lineIn + 0.3], [1.15, 1.42], { ...clamp, easing: EASE_OUT });
  const y2 = 90 + SZ.bubble_line[1] * 1.42 + 70;
  return (
    <>
      {/* 보낸 말풍선의 아래 끝(실제 화면) — 위 가장자리는 말풍선이 위로 이어지게 흐린다(미학 맹검 「오려 붙인 띠」) */}
      <Pic n="bubble_line" x={right('bubble_line', g)} y={90} k={g} style={FADE_TOP} />
      <Rise n="intro2" x={center('intro2', 1.06)} y={y2} k={1.06} p={inAt(t, 19.55 + 2.727)} />
      <Composer />
    </>
  );
};

// 판 한 장 — 들어올 때 1.03배에서 내려앉고 천천히 다가간다. 위쪽은 같은 판을 뒤집어 흐리게 채우고 그늘을 얹는다
// front = 판 앞에만 놓고 위쪽 거울에는 비치지 않는 조각(밝은 판 위의 검은 말풍선이 위쪽에 얼룩으로 비치지 않게)
const Board: React.FC<{ pt?: number; drift?: number; origin?: string; bg?: string; front?: React.ReactNode; children: React.ReactNode }> = ({ pt = PT, drift = 0.012, origin = '50% 30%', bg = DARK, front, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
  const H = 1920 - pt;
  const wrap = (withFront: boolean) => (
    <PanelH.Provider value={H}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}{withFront ? front : null}</div>
    </PanelH.Provider>
  );
  const inner = wrap(false);
  return (
    <AbsoluteFill style={{ background: `rgb(${SHADE})` }}>
      {pt > 0 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: pt, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: -40, top: pt, width: 1160, height: H, background: bg, transform: 'scaleY(-1)', transformOrigin: '50% 0%', filter: 'blur(26px)' }}>
            <div style={{ position: 'absolute', left: 40, top: 0, width: 1080, height: H }}>{inner}</div>
          </div>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(${SHADE},0.95) 0%, rgba(${SHADE},0.86) 62%, rgba(${SHADE},0.62) 100%)` }} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, top: pt, width: 1080, height: H, overflow: 'hidden', background: bg }}>
        {wrap(true)}
        {pt > 0 ? <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 46, background: `linear-gradient(to bottom, rgba(${SHADE},0.32), rgba(${SHADE},0))` }} /> : null}
      </div>
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string, live = false) => {
  if (live) return <span style={{ color: BUTTER }}>{l.replace(/[[\]]/g, '')}</span>;
  return l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));
};

// 큰 글자가 곧 말 — 첫 줄은 구성 첫 프레임부터 서 있고, 다음 줄부터 28px 올라오며 뜬다
const BigBlock: React.FC<{ lines: string[]; at: number[]; size: number; live?: boolean }> = ({ lines, at, size, live }) => {
  const f = useCurrentFrame();
  const first = sec(at[0]);
  const shown = at.filter((a) => f >= sec(a) - 2).length - 1; // live: 마지막으로 뜬 줄만 버터
  return (
    <div style={{ position: 'absolute', left: X, top: TEXT_TOP, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: '-0.045em', lineHeight: size >= 110 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap' }}>
      {lines.map((s, k) => {
        const a = sec(at[k]);
        const p = a <= first ? 1 : interpolate(f, [a - 2, a + 4], [0, 1], { ...clamp, easing: EASE_OUT });
        const plain = live ? s.replace(/[[\]]/g, '') : s;
        return <div key={k} style={{ opacity: live && k < shown ? Math.min(p, 0.62) : p, transform: `translateY(${(1 - p) * 28}px)` }}>{live && k === shown ? rich(plain, true) : rich(plain)}</div>;
      })}
    </div>
  );
};
const Big: React.FC<{ v: Variant }> = ({ v }) => {
  const f = useCurrentFrame();
  if (f >= sec(S.end)) return <BigBlock lines={END_LINES.lines} at={[S.end, N7_AT + END[v].cta2At, N7_AT + END[v].cta3At]} size={END_LINES.size} />;
  const l = LINES.find((x) => f >= sec(x.from) && f < sec(x.to));
  return l ? <BigBlock lines={l.lines} at={l.at} size={l.size} live={l.live} /> : null;
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

const Boards: React.FC<{ v: Variant }> = ({ v }) => (
  <>
    <Seq a={S.hook} b={S.list}><Board drift={0.016} origin="45% 50%"><RoutePanel draws={DRAW_FILM} /></Board></Seq>
    <Seq a={S.list} b={S.d1}><Board drift={0.03} origin="70% 95%"><HookPanel /></Board></Seq>
    <Seq a={S.d1} b={S.excl}><Board drift={0.03} origin="50% 55%"><DaysPanel /></Board></Seq>
    <Seq a={S.excl} b={S.kakao}><Board drift={0.012} origin="50% 45%"><ExclPanel /></Board></Seq>
    <Seq a={S.kakao} b={S.legs}><Board drift={0.016} origin="20% 15%" bg={WHITE}><KakaoPanel /></Board></Seq>
    <Seq a={S.legs} b={S.without}><Board pt={LEGS_PT} drift={0.03} origin="45% 45%"><LegsPanel /></Board></Seq>
    <Seq a={S.without} b={S.line}><Board drift={0.025} origin="50% 30%"><WithoutPanel /></Board></Seq>
    <Seq a={S.line} b={S.end}><Board drift={0.03} origin="70% 15%"><LinePanel /></Board></Seq>
    <Seq a={S.end} b={totalOf(v)}><Board drift={0.02} origin="50% 40%" bg={LIGHT} front={<EndAsk />}><EndPanel v={v} /></Board></Seq>
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

// 한 장면 심사용 — 보낸 글 → 펼친 지도 1 · 2 · 3일차 → 모든 날짜(글 · 말 없이, 그 장면의 화면과 소리만)
// 장면 위: 내가 보낸 한 줄(실제 말풍선) → 4.1초 「세 날 다 / 차로 30분 안」 큰 글(쿵)
const SceneTop: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const out = interpolate(t, [SCENE_END_AT - 0.12, SCENE_END_AT + 0.1], [1, 0], clamp);
  return (
    <>
      {out > 0 ? <Pic n="bubble_line" x={right('bubble_line', 1.18)} y={PT - SZ.bubble_line[1] * 1.18 - 70 - (1 - out) * 30} k={1.18} style={{ opacity: out }} /> : null}
      {t >= SCENE_END_AT - 0.07 ? <BigBlock lines={['구간마다 다', '차로 [30분] 안']} at={[SCENE_END_AT, SCENE_END_AT]} size={120} /> : null}
    </>
  );
};
// 장면: 위 빈 자리에 내가 보낸 한 줄(실제 말풍선), 아래 펼친 지도에서 날마다 길이 이어 그려진다
export const Scene: React.FC = () => (
  <AbsoluteFill style={{ background: `rgb(${SHADE})` }}>
    <Board drift={0.012} origin="45% 50%"><RoutePanel draws={DRAW_SCENE} legs /></Board>
    <SceneTop />
    <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, [0, 8, sec(SCENE_DUR) - 20, sec(SCENE_DUR)], [0.14, 0.24, 0.24, 0], clamp) * MASTER} />
    {SCENE_SOUNDS.map((s, i) => (
      <Sequence key={i} from={sec(s.t)} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
    ))}
  </AbsoluteFill>
);
