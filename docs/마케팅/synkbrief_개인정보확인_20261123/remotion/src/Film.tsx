// synkbrief B69 「인터넷에 드러난 내 정보를 ChatGPT로 찾고 지우기」 본편 — 수요 장부 synkbrief 1번(자료 나눔 꼴, 한 사람의 한 가지 일).
// 결: 표지 A 짜임(검정 바탕 · 위 큰 글자 · 아래 실제 화면 · 버터 한 곳 · SUIT 하나)을 첫 화면으로 두고 같은 결로 끝까지 간다.
// 색 꼬리표 · 스티커 · 번호 동그라미 · 색 띠 · 색 상자 · 말풍선 · 고리는 우리가 더하지 않는다(화면 속 초록 · 주황 판정은 ChatGPT 답 그대로다).
// 화면은 모두 2026-11-23 ChatGPT 임시 채팅에서 받은 실제 답(실험 E06)이고, 이름 · 아이디 말고 답에 나온 다른 정보는 재료.py에서 가렸다.
// 움직임은 작게 — 판은 초마다 1~3% 다가가고, 녹화 장면은 실제로 답이 써진 차례대로 바뀐다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import badgeSizes from './badgeSizes.json';
import { S, VO, TAGS, LINES, END_LINES, SOUNDS, FPS, END, N7_AT, REC, COVER_OUT, BADGE_ROWS, totalOf, bgmOf, type Variant } from './timeline';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * FPS);
const INK = '#0E0E0E'; // 찍은 ChatGPT 화면의 바탕색과 같게 — 자른 화면이 바탕에 녹는다
const BUTTER = '#F5C445';
const X = 84;
const MASTER = 0.8; // Remotion은 합친 소리가 0 dBFS를 넘으면 자른다 — 모든 소리에 같은 값을 곱한다
const SHOT_W = 1075; // 찍은 화면 폭(430 × 2.5)
const img = (n: string) => staticFile(`img/${n}.jpg`);

// 재료 그림 크기(재료.py가 자른 값)
const SIZE: Record<string, [number, number]> = {
  bubble: [720, 990], bubble_end: [720, 310], badges: [1004, 572], table: [1020, 1260], order: [1020, 280],
  del_head: [1020, 200], del_rows1: [1020, 570], del_rows2: [1020, 430], excluded: [1020, 940],
};

// 아래 판 — top부터 화면 아래 끝까지(위 가장자리는 검정으로 녹인다). 들어올 때 1.03배에서 내려앉고 천천히 다가간다
const Bleed: React.FC<{ top?: number; drift?: number; origin?: string; fade?: number; children: React.ReactNode }> = ({ top = 760, drift = 0.012, origin = '50% 30%', fade = 60, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.03, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * drift);
  return (
    <div style={{ position: 'absolute', left: 0, top, width: 1080, height: 1920 - top, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>{children}</div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: fade, background: `linear-gradient(to bottom, rgba(14,14,14,1) 0px, rgba(14,14,14,0) ${fade}px)` }} />
    </div>
  );
};

// 잘라 낸 화면 한 장을 (x, y)에 w 폭으로
const Pic: React.FC<{ n: string; x: number; y: number; w: number; opacity?: number; style?: React.CSSProperties }> = ({ n, x, y, w, opacity = 1, style }) => {
  const [iw, ih] = SIZE[n];
  return <Img src={img(n)} style={{ position: 'absolute', left: x, top: y, width: w, height: (ih / iw) * w, display: 'block', opacity, ...style }} />;
};

// ── 민감정보 카드 — 실제 카드의 네 줄을 이름 조각 · 판정 조각으로 잘라 크게 다시 짠다(글 · 색은 받은 화면 그대로)
// 줄 k: 이름은 왼쪽(x 70), 판정 알약은 오른쪽 끝(x 1010)에 맞춘다. rows = 줄마다 켜지는 정도(0~1)
const RS = 1.3;
const MS = 1.4;
const MARK_LIFT = 'brightness(1.35)'; // 판정 알약 — 받은 화면 그대로면 검은 바탕과 밝기 차가 약하다(v3 · v4 첫컷검사 흠). 색과 글은 그대로 두고 밝기만 올린다 // 판정 알약 배율 — 이름보다 조금 크게(v3 첫컷검사 흠: 초록 · 주황 글자가 이름보다 작고 어둡다)
// 줄 배율(가장 긴 둘째 줄 이름 560px × 1.3 = 728 — 판정 알약과 35px 띄움)
const bsz = (n: string) => (badgeSizes as Record<string, number[]>)[n];
const BadgeRow: React.FC<{ k: number; y: number; s?: number; o?: number }> = ({ k, y, s = RS, o = 1 }) => {
  const [lw, lh] = bsz(`badge_label${k}`);
  const [mw, mh] = bsz(`badge_mark${k}`);
  return (
    <div style={{ position: 'absolute', left: 0, top: y, width: 1080, height: lh * s, opacity: o, transform: `translateY(${(1 - o) * 26}px)` }}>
      <Img src={img(`badge_label${k}`)} style={{ position: 'absolute', left: 70, top: 0, width: lw * s, height: lh * s }} />
      <Img src={img(`badge_mark${k}`)} style={{ position: 'absolute', left: 1010 - mw * MS * (s / RS), top: (lh * s - mh * MS * (s / RS)) / 2, width: mw * MS * (s / RS), height: mh * MS * (s / RS), filter: MARK_LIFT }} />
    </div>
  );
};
const ROW_GAP = 160;
const BadgeRows: React.FC<{ y: number; rows: number[] }> = ({ y, rows }) => (
  <>
    {[1, 2, 3, 4].map((k) => <BadgeRow key={k} k={k} y={y + (k - 1) * ROW_GAP} o={rows[k - 1]} />)}
    {/* 줄 사이 가는 선 — 받은 카드의 칸 선과 같은 결 */}
    {[1, 2, 3].map((k) => <div key={`l${k}`} style={{ position: 'absolute', left: 70, top: y + k * ROW_GAP - 25, width: 940, height: 2, background: 'rgba(255,255,255,0.08)', opacity: Math.min(rows[k - 1], rows[k]) }} />)}
  </>
);

// ── 0 훅: 첫 프레임은 표지와 같은 화면(제목 + 민감정보 카드). 0.45초부터 보낸 요청문에 답이 써지는 실제 녹화로 바뀐다 ──
const Hook: React.FC<{ bare?: boolean }> = ({ bare }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const card = t < COVER_OUT ? 1 : 0; // 표지 카드는 0.45초에 끊어 바꾼다(v4 첫컷검사 — 겹쳐 바꾸면 결과 표가 말풍선 위에 잔상으로 남는다)
  // 녹화 — 화면 윗줄 y를 장마다 맞춰 내려가며, 장 사이는 0.12초 겹쳐 바꾼다
  const idx = REC.reduce((a, r, k) => (t >= r.at ? k : a), -1);
  const top = bare ? 0 : 744;
  const H = 1920 - top;
  const scale = 1080 / SHOT_W;
  // 답 화면(rec2)에서는 제목 · 조사 기준일 · 첫 문장(화면 y 600~900)만 남기고 아래를 녹인다 — v3 첫컷검사 #66(본문 여러 문단이 읽히기 전에 넘어간다)
  const ans = idx >= 1 ? interpolate(t, [REC[1].at, REC[1].at + 0.2], [0, 1], clamp) : 0;
  const cut = (905 - REC[1].y) * scale * 1.06;
  const keep = ans > 0 ? `linear-gradient(to bottom, #000 0px, #000 ${cut}px, rgba(0,0,0,${1 - ans}) ${cut + 90}px)` : undefined;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', left: 0, top, width: 1080, height: H, overflow: 'hidden', WebkitMaskImage: keep, maskImage: keep }}>
        {/* 장마다 제 자리(y)에 둔다 — 말풍선 장은 내내 이름 · 아이디가 보이게 움직이지 않고(v4 첫컷검사 #5), 답 장으로 겹쳐 바뀐다 */}
        {REC.map((r, k) => {
          if (k > idx || k < idx - 1) return null;
          const o = k === idx ? interpolate(t, [r.at, r.at + 0.12], [0, 1], clamp) : 1;
          const zz = 1.06 + Math.max(0, t - r.at) * 0.012;
          return (
            <div key={r.img} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 2330 * scale, opacity: o, transform: `translateY(${-r.y * scale}px) scale(${zz})`, transformOrigin: `50% ${((r.y + 300) / 2330) * 100}%` }}>
              <Img src={img(r.img)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 2330 * scale }} />
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 70, background: 'linear-gradient(to bottom, rgba(14,14,14,1), rgba(14,14,14,0))' }} />
      </div>
      {card > 0 ? (
        <div style={{ position: 'absolute', inset: 0, background: INK, opacity: card }}>
          <BadgeRows y={bare ? 760 : 920} rows={[1, 1, 1, 1]} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// 표지 제목 — 훅 내내 선다(「제 이름이랑 아이디로, 인터넷에 드러난 제 정보를 찾아 달라고 했어요」)
const HookTitle: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= sec(S.badge)) return null;
  const o = interpolate(f, [sec(S.badge) - 3, sec(S.badge)], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 79, top: 352, opacity: o, fontFamily: KO, fontWeight: 800, fontSize: 112, letterSpacing: '-0.045em', lineHeight: 1.1, color: '#fff', whiteSpace: 'nowrap' }}>
      <div>내 이름과 아이디로</div>
      <div>인터넷에 드러난</div>
      <div style={{ color: BUTTER }}>내 정보 찾기</div>
    </div>
  );
};

// ── 1 민감정보 카드 — 줄이 말에 맞춰 켜진다(전화번호 · 집 주소 · 생년월일 「확인되지 않음」 → 사진 · 근무처 · 실명 연결 「노출 확인」) ──
const Badge: React.FC<{ bare?: boolean }> = ({ bare }) => {
  const f = useCurrentFrame();
  const y0 = bare ? 760 : 920;
  const shrink = interpolate(f, [sec(BADGE_ROWS[1]) - 6, sec(BADGE_ROWS[1]) + 3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const first = 1; // 첫 줄은 구성 첫 프레임부터 선다(v2 — 넘어오는 0.25초가 까맣게 비었다)
  const rows = BADGE_ROWS.map((a, k) => interpolate(f, [sec(a) + (k ? 3 : 0), sec(a) + (k ? 9 : 6)], [0, 1], { ...clamp, easing: EASE_OUT }));
  // 첫 줄 — 크게(이름 1.9배, 알약은 그 아래 왼쪽) → 네 줄의 첫 자리(1.3배 한 줄)로
  const [lw, lh] = bsz('badge_label1');
  const [mw, mh] = bsz('badge_mark1');
  const BIG = 1.9;
  const s = BIG + (RS - BIG) * shrink;
  const lx = 70, ly = (y0 + 120) + (y0 - (y0 + 120)) * shrink;
  const mxBig = 70, myBig = y0 + 120 + lh * BIG + 26;
  const mxSmall = 1010 - mw * MS, mySmall = y0 + (lh * RS - mh * MS) / 2;
  const mx = mxBig + (mxSmall - mxBig) * shrink, my = myBig + (mySmall - myBig) * shrink;
  const ms = BIG + (MS - BIG) * shrink;
  const z = 1 + (f / FPS) * 0.01;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 62%' }}>
        {[2, 3, 4].map((k) => <BadgeRow key={k} k={k} y={y0 + (k - 1) * ROW_GAP} o={rows[k - 1]} />)}
        {[1, 2, 3].map((k) => <div key={`l${k}`} style={{ position: 'absolute', left: 70, top: y0 + k * ROW_GAP - 25, width: 940, height: 2, background: 'rgba(255,255,255,0.08)', opacity: rows[k] }} />)}
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: first, transform: `translateY(${(1 - first) * 26}px)` }}>
          <Img src={img('badge_label1')} style={{ position: 'absolute', left: lx, top: ly, width: lw * s, height: lh * s }} />
          <Img src={img('badge_mark1')} style={{ position: 'absolute', left: mx, top: my, width: mw * ms, height: mh * ms, filter: MARK_LIFT }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 2 위험도순 표 — 실제 표(둘째 줄 정보 칸은 가림). 위에서 아래로 한 줄씩 내려가며 보인다 ──
const Table: React.FC = () => {
  const f = useCurrentFrame();
  const reveal = interpolate(f, [2, sec(1.2)], [180, 1260], { ...clamp, easing: Easing.out(Easing.cubic) });
  const mask = `linear-gradient(to bottom, #000 ${reveal - 40}px, transparent ${reveal + 40}px)`;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Bleed top={744} drift={0.016} origin="40% 20%">
        <div style={{ position: 'absolute', left: 30, top: 20, width: 1020, height: 1260, WebkitMaskImage: mask, maskImage: mask }}>
          <Pic n="table" x={0} y={0} w={1020} />
        </div>
      </Bleed>
    </AbsoluteFill>
  );
};

// ── 3 보낸 요청문 — 실제로 보낸 말풍선을 크게 ──
const Ask: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Bleed top={760} drift={0.01} origin="50% 10%">
      <Pic n="bubble" x={90} y={40} w={900} />
    </Bleed>
  </AbsoluteFill>
);

// ── 4 꼭 붙일 한 줄 — 말풍선 끝 두 줄로 다가간 뒤(16.5), 실제로 뺀 목록(18.22 · 목록은 가림) ──
const Line: React.FC = () => {
  const f = useCurrentFrame();
  const ex = sec(S.lineEx - S.line);
  const zin = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: INK }}>
      {f < ex ? (
        <Bleed top={760} drift={0.012} origin="50% 40%">
          <div style={{ position: 'absolute', left: 40, top: 120, width: 1000, height: 431, opacity: zin }}>
            <Pic n="bubble_end" x={0} y={0} w={1000} />
            {/* 앞 두 줄(「3. 지우고 싶을 때 …」)은 옅게 — 꼭 붙일 끝 두 줄만 또렷하게 */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: 1000, height: 205, background: 'linear-gradient(to bottom, rgba(14,14,14,0.62) 0px, rgba(14,14,14,0.62) 170px, rgba(14,14,14,0) 205px)' }} />
          </div>
        </Bleed>
      ) : (
        <Sequence from={ex} layout="none">
          <Bleed top={744} drift={0.014} origin="50% 10%">
            <Pic n="excluded" x={30} y={30} w={1020} />
          </Bleed>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

// ── 5 지우는 곳 — 실제 창구 표(20.75), 그다음 원본부터라는 답의 문단을 크게(22.1) ──
const Del: React.FC = () => {
  const f = useCurrentFrame();
  const ord = sec(S.delOrder - S.del);
  return (
    <AbsoluteFill style={{ background: INK }}>
      {f < ord ? (
        <Bleed top={744} drift={0.016} origin="50% 10%">
          <Pic n="del_head" x={30} y={30} w={1020} />
          <Pic n="del_rows1" x={30} y={230} w={1020} />
        </Bleed>
      ) : (
        <Sequence from={ord} layout="none">
          <Bleed top={760} drift={0.02} origin="50% 40%" fade={20}>
            <Pic n="order" x={30} y={150} w={1020} />
            <Pic n="del_rows2" x={30} y={470} w={1020} opacity={0.9} />
          </Bleed>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

// ── 끝: 민감정보 카드를 다시 크게(이 편에서 가장 센 결과) ──
const End: React.FC = () => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.04, 1], { ...clamp, easing: EASE_OUT }) * (1 + (f / FPS) * 0.02);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 62%' }}>
        <BadgeRows y={940} rows={[1, 1, 1, 1]} />
      </div>
    </AbsoluteFill>
  );
};

// 줄 안의 [ ] = 버터 글자
const rich = (l: string) => l.split(/(\[[^\]]+\])/).map((p, k) => (p.startsWith('[') ? <span key={k} style={{ color: BUTTER }}>{p.slice(1, -1)}</span> : <React.Fragment key={k}>{p}</React.Fragment>));

// 큰 글자가 곧 말 — 첫 줄은 구성이 바뀌는 첫 프레임부터 서 있고, 다음 줄부터 28px 올라오며 뜬다
const BigBlock: React.FC<{ lines: string[]; at: number[]; size: number }> = ({ lines, at, size }) => {
  const f = useCurrentFrame();
  const first = sec(at[0]);
  return (
    <div style={{ position: 'absolute', left: X, top: 352, fontFamily: KO, fontWeight: 800, fontSize: size, letterSpacing: '-0.045em', lineHeight: size >= 110 ? 1.1 : 1.16, color: '#fff', whiteSpace: 'nowrap' }}>
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
  if (f >= sec(ctaAt)) return <BigBlock lines={END[v].cta} at={[ctaAt, ctaAt + 0.35]} size={END[v].ctaSize} />;
  if (f >= sec(S.end)) return <BigBlock lines={END_LINES.lines} at={END_LINES.at} size={END_LINES.size} />;
  const l = LINES.find((x) => f >= sec(x.from) && f < sec(x.to));
  return l ? <BigBlock lines={l.lines} at={l.at} size={l.size} /> : null;
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

const Sound: React.FC<{ v: Variant; bare?: boolean }> = ({ v, bare }) => {
  const total = totalOf(v);
  const bgm = bgmOf(total);
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={(fr) => interpolate(fr, bgm.t.map(sec), bgm.v, clamp) * MASTER} />
      {bare ? null : [...VO, { id: END[v].vo, t: N7_AT }].map((o, i) => (
        <Sequence key={i} from={sec(o.t)}>
          <Audio src={staticFile(`vo/${o.id}.wav`)} volume={MASTER} />
        </Sequence>
      ))}
      {SOUNDS.map((s, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, sec(s.t))} durationInFrames={45}><Audio src={staticFile(s.src)} volume={s.vol * MASTER} /></Sequence>
      ))}
      {bare ? null : <Sequence from={sec(N7_AT + END[v].ctaAt + 0.35)} durationInFrames={45}><Audio src={staticFile('sfx/thud.wav')} volume={0.26 * MASTER} /></Sequence>}
    </>
  );
};

const Seq: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => (
  <Sequence from={sec(a)} durationInFrames={sec(b) - sec(a)}>{children}</Sequence>
);

// bare = 한 장면 심사용(제목 · 큰 글 · 작은 줄 · 말 없이 그 장면의 화면과 소리만)
export const Film: React.FC<{ v: Variant; bare?: boolean }> = ({ v, bare }) => (
  <AbsoluteFill style={{ background: INK }}>
    <Seq a={S.hook} b={S.badge}><Hook bare={bare} /></Seq>
    <Seq a={S.badge} b={S.table}><Badge bare={bare} /></Seq>
    <Seq a={S.table} b={S.ask}><Table /></Seq>
    <Seq a={S.ask} b={S.line}><Ask /></Seq>
    <Seq a={S.line} b={S.del}><Line /></Seq>
    <Seq a={S.del} b={S.end}><Del /></Seq>
    <Seq a={S.end} b={totalOf(v)}><End /></Seq>
    {bare ? null : <><HookTitle /><Big v={v} /><Tag /></>}
    <Sound v={v} bare={bare} />
  </AbsoluteFill>
);
