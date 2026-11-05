// synkbrief B28 「발주 메모」(11-05) — 손글씨를 AI로 옮길 땐 「확실하지 않은 글자는 추측하지 말고 ?로 남겨 줘」.
// 뼈대는 gNpXb9i3_3o(오마주.json — 비포 → 이정표 → 반전 → 나란히), 겉은 장부 「화면 결」(본보기 synkbrief_요금제질문셋_20261103 FilmV2):
// 원래 장면 그대로(판을 내리고 위는 같은 장면을 뒤집어 흐리게) · 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(「?」) · 줄 단위 올림 · SUIT 하나 · 마침표 없음 · 안전선 안.
// v5(맹검 미학 둘이 같이 짚은 것): 실제 ChatGPT 화면을 화면 가득 깔지 않고 장면 위에 필요한 줄만 잘라 얹는다(값 · 글은 그대로, 짚는 줄 밖은 누름) ·
// 첫 장면은 「콩나물 다섯 상자요! / …네?」 · 얼굴 나오는 밤 · 아침 컷은 얼굴 없는 컷으로 · 작은 표시는 위로.
// v10(맹검 미학 둘이 같이 짚은 「어두운 폰 화면이 너무 많고 표 글자가 안 읽힘」): 폰 화면은 세 번만, 나머지는 밝은 메모 위 「달걀 5」 아래에 실제 답의 그 한 줄만 크게 · 재연 표시는 첫 장면에만.
// v9(볼 이유 · 시험관 셋이 같이 짚은 14~16초 되풀이 · 끝 농담): 가운데는 대사를 다시 틀지 않고 쏟아지는 결과만, 끝 말은 「콩나물 소금빵」으로 또렷하게, 끝은 그 빵으로 다가간다.
// v7(맹검 미학 · 시험관이 같이 짚은 것): 검은 표 카드 대신 손에 든 폰 화면 안에 실제 답을 넣고 짚는 줄로 다가간다 · 가운데 장면은 상자 쿵 → 굳은 얼굴 → 쏟아짐(같은 얼굴 반복 없앰) · 회색 글자 대비 올림.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);
const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

const BUTTER = '#F5C445';
const GREY = '#CFCFCF';
const X = 74;
const TOP = 284;

// 장면 시작(초) — 원본 컷 · 박자(41.3초)를 이 편 길이에 맞춰 줄인 자리
export const S = {
  cold: 0, memo: 2.15, table: 3.47, warn: 5.25, night: 7.29, morning: 9.69,
  key: 11.65, face: 13.0, land: 16.71, egg: 18.0, kong: 19.65, hobak: 22.94, carrot: 23.31, walnut: 23.9, never: 24.55,
  ask: 26.85, prompt: 28.7, q: 30.58, six: 32.1, end: 34.3, punch: 35.6, total: 37.2,
};
export const TOTAL = sec(S.total);
// 컷 d(문 앞 · 말 · 「네?」 · 상자 위로 떨어짐) · c3(가까이 — 웃다 굳고 쟁반이 기욺) · e(끝)에서 쓰는 원본 초
const THUMP_START = 1.0;
const KEY_START = 3.0;
const LAND_START = 4.25;
const END_START = 2.2;

// 판을 d만큼 내리고 위는 같은 장면을 뒤집어 흐리게 채운다. 들어올 때 1.035배에서 내려앉고 아주 천천히 다가간다. dim — 위에 카드를 얹을 때 판을 누른다
const Lowered: React.FC<{ d?: number; dim?: number; drift?: number; children: React.ReactNode }> = ({ d = 260, dim = 0, drift = 0.0011, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) + f * drift;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.55)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 30%' }}>{children}</div>
      {dim ? <AbsoluteFill style={{ background: `rgba(8,8,8,${dim})` }} /> : null}
    </AbsoluteFill>
  );
};
const Vid: React.FC<{ src: string; start?: number }> = ({ src, start = 0 }) => (
  <OffthreadVideo muted src={staticFile(`plate/${src}.mp4`)} startFrom={sec(start)} style={{ width: 1080, height: 1920 }} />
);
const Pic: React.FC<{ src: string }> = ({ src }) => <Img src={staticFile(`img/${src}.png`)} style={{ width: 1080, height: 1920, objectFit: 'cover' }} />;

// 메모 사진(1086 × 1448) — band 밖을 누르고, z배로 ox를 중심으로 당긴다
const MemoPic: React.FC<{ band?: [number, number]; z?: number; ox?: number }> = ({ band, z = 1, ox = 540 }) => {
  const f = useCurrentFrame();
  const s = 1080 / 1086;
  const dd = band ? 0.7 : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: band ? `${ox}px ${((band[0] + band[1]) / 2) * s}px` : '50% 30%' }}>
      <Img src={staticFile('img/memo.png')} style={{ display: 'block', width: 1080, height: 1448 * s }} />
      {band ? (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: band[0] * s, background: `rgba(0,0,0,${dd})` }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: band[1] * s, height: (1448 - band[1]) * s + 600, background: `rgba(0,0,0,${dd})` }} />
        </>
      ) : null}
    </div>
  );
};

// 위 그늘 — 글자 자리만 어둡게
const Shade: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />
);

// 큰 글자가 곧 말 — 줄마다 28px 아래에서 올라오며 나타난다(줄 사이 3프레임). me = 사람의 말(회색), still = 첫 프레임부터 다 보임, below = 글 아래에 얹는 것(belowAt초부터)
const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; me?: boolean; size?: number; meta?: string; still?: boolean; below?: React.ReactNode; belowAt?: number }> = ({ lines, from, to, me, size = 96, meta, still, below, belowAt }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - 3, b], [1, 0], clamp);
  const up = (k: number, at = a, keep = still) => {
    const p = keep ? 1 : interpolate(f, [at + k * 3, at + k * 3 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 846, top: TOP, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {meta ? <div style={{ ...up(0), fontWeight: 600, fontSize: 36, letterSpacing: -0.5, color: GREY, marginBottom: 18 }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: me ? 700 : 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: me ? GREY : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
      {below ? (
        <div style={{ ...(belowAt !== undefined ? up(0, sec(belowAt), true) : up(lines.length + 1)), marginTop: 40, textShadow: 'none' }}>
          {belowAt !== undefined && f < sec(belowAt) ? null : below}
        </div>
      ) : null}
    </div>
  );
};
const Q = <span style={{ color: BUTTER }}>?</span>;


// 손에 든 폰(1080 × 1920 판) — 꺼진 화면 자리(rect)에 실제 답 캡처(1290 × 2796)를 폭에 맞춰 넣고, band 밖은 누르고, focus(캡처 y) 쪽으로 z배 다가간다
type Rect = [number, number, number, number];
const PHONE: Record<string, Rect> = { phone_night: [222, 262, 853, 1566], phone_morning: [226, 280, 846, 1558] };
const PhoneShot: React.FC<{ bg: 'phone_night' | 'phone_morning'; src: string; band?: [number, number]; focus?: number; z?: number; z0?: number }> = ({ bg, src, band, focus = 1398, z = 1, z0 }) => {
  const f = useCurrentFrame();
  const [x0, y0, x1, y1] = PHONE[bg];
  const s = (x1 - x0) / 1290;
  const fy = y0 + focus * s;
  const zz = interpolate(f, [0, 16], [z0 ?? z, z], { ...clamp, easing: EASE_OUT }) + f * 0.0008;
  const dd = band ? 0.74 : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${zz})`, transformOrigin: `540px ${fy}px` }}>
      <Pic src={bg} />
      <div style={{ position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0, borderRadius: 38, overflow: 'hidden', background: '#0d0d0d' }}>
        <Img src={staticFile(`img/${src}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: 1290 * s, height: 2796 * s, maxWidth: 'none', filter: 'brightness(1.45) contrast(1.12)' }} />
        {band ? (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: band[0] * s, background: `rgba(0,0,0,${dd})` }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: band[1] * s, bottom: 0, background: `rgba(0,0,0,${dd})` }} />
          </>
        ) : null}
        <AbsoluteFill style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 40%)' }} />
      </div>
    </div>
  );
};

// 실제 화면 조각(1290 × 2796 휴대폰 폭 캡처) — crop만 잘라 카드로, band(그림 y) 밖은 누른다. 꼬리표 대신 위에 작은 회색 출처 한 줄
type Crop = [number, number, number, number];
const Shot: React.FC<{ src: string; crop: Crop; band?: [number, number]; note: string; w?: number }> = ({ src, crop, band, note, w = 846 }) => {
  const [x0, y0, x1, y1] = crop;
  const s = w / (x1 - x0);
  const h = (y1 - y0) * s;
  return (
    <div>
      <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 28, color: GREY, marginBottom: 12, letterSpacing: -0.4 }}>{note}</div>
      <div style={{ position: 'relative', width: w, height: h, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', background: '#0d0d0d' }}>
        <Img src={staticFile(`img/${src}.png`)} style={{ position: 'absolute', left: -x0 * s, top: -y0 * s, width: 1290 * s, height: 2796 * s, maxWidth: 'none' }} />
        {band ? (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, (band[0] - y0) * s), background: 'rgba(0,0,0,0.62)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: (band[1] - y0) * s, bottom: 0, background: 'rgba(0,0,0,0.62)' }} />
          </>
        ) : null}
      </div>
    </div>
  );
};


// 실제 답 한 줄(1290 × 2796 캡처의 row 띠, 품목 · 수량 칸 x 290~1290)을 크게 — 메모 위 y 자리에, 위에 작은 회색 출처 한 줄
const Strip: React.FC<{ src: string; row: [number, number]; y: number; note: string }> = ({ src, row, y, note }) => {
  const x0 = 290, x1 = 1290, w = 900;
  const s = w / (x1 - x0);
  const r0 = row[0] - 8, r1 = row[1] + 8;
  return (
    <div style={{ position: 'absolute', left: X - 16, top: y, width: w + 32, fontFamily: KO, background: 'rgba(10,10,10,0.86)', borderRadius: 22, padding: '18px 16px 16px', boxShadow: '0 18px 50px rgba(0,0,0,0.5)' }}>
      <div style={{ fontWeight: 600, fontSize: 32, color: GREY, marginBottom: 12, marginLeft: 6, letterSpacing: -0.4 }}>{note}</div>
      <div style={{ position: 'relative', width: w, height: (r1 - r0) * s, borderRadius: 14, overflow: 'hidden', background: '#0d0d0d' }}>
        <Img src={staticFile(`img/${src}.png`)} style={{ position: 'absolute', left: -x0 * s, top: -r0 * s, width: 1290 * s, height: 2796 * s, maxWidth: 'none', filter: 'brightness(1.35) contrast(1.15)' }} />
      </div>
    </div>
  );
};

// 실제 답 한 줄 — 작은 글을 원문 그대로 크게
const Quote: React.FC<{ text: string; note: string }> = ({ text, note }) => (
  <div style={{ fontFamily: KO, borderLeft: '3px solid rgba(255,255,255,0.5)', paddingLeft: 22 }}>
    <div style={{ fontWeight: 600, fontSize: 28, color: GREY, marginBottom: 8, letterSpacing: -0.4 }}>{note}</div>
    <div style={{ fontWeight: 500, fontSize: 42, color: '#EDEDED', letterSpacing: -0.8, lineHeight: 1.32 }}>{text}</div>
  </div>
);

// 열일곱 번의 셋째 줄 답(실제 순서) — 하나씩 켜진다
const SEVENTEEN = ['콩나물', '호박', '당근', '콩나물', '콩기름', '호박', '호박', '호박', '콩나물', '콩나물', '호박', '호박', '콩나물', '호박', '콩나물', '당근', '호두볼'];
const Tally: React.FC<{ from: number }> = ({ from }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ fontFamily: KO }}>
      <div style={{ fontWeight: 600, fontSize: 34, color: GREY, marginBottom: 14, letterSpacing: -0.4 }}>셋째 줄에 나온 답 · 실제 순서</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 30, rowGap: 6, width: 846 }}>
        {SEVENTEEN.map((w, i) => {
          const at = sec(from) + 4 + i * 2;
          const o = interpolate(f, [at, at + 3], [0, 1], clamp);
          return <span key={i} style={{ opacity: o, fontWeight: 700, fontSize: 52, color: '#EDEDED', letterSpacing: -1 }}>{w}</span>;
        })}
      </div>
    </div>
  );
};

// 작은 표시 — 위 안전선 줄(28px 회색), 알림은 왼쪽 · 브랜드는 오른쪽
const Small: React.FC<{ text: string; from: number; to: number; right?: boolean }> = ({ text, from, to, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 920 } : { left: X };
  return <div style={{ position: 'absolute', ...pos, top: 206, fontFamily: KO, fontWeight: 600, fontSize: 28, color: 'rgba(255,255,255,0.72)', letterSpacing: -0.4 }}>{text}</div>;
};

const Sfx: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.5 }) => (
  <Sequence from={sec(at)}><Audio src={staticFile(`sfx/${src}.wav`)} volume={v * 0.8} /></Sequence>
);

// 실제 화면 자르는 자리(그림 px) — 시안/실제_*.png를 눈금으로 잼
const TABLE: Record<string, Crop> = {
  s_kong: [20, 905, 1270, 1690],
  s_hobak: [20, 845, 1270, 1630],
  s_carrot: [20, 905, 1270, 1690],
  s_walnut: [20, 910, 1270, 1695],
  s_q: [20, 1100, 1270, 1860],
};
const ROW3: Record<string, [number, number]> = { s_kong: [1232, 1338], s_hobak: [1172, 1278], s_carrot: [1232, 1338], s_walnut: [1238, 1344], s_q: [1424, 1530] };
const ASK: Crop = [380, 455, 1270, 780];
const EGG: [number, number] = [585, 745];
const WARN: [number, number] = [1785, 2045];

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const bgmV = interpolate(
    f,
    [0, sec(S.memo) - 2, sec(S.memo) + 4, sec(S.key) - 4, sec(S.key), sec(S.egg), sec(S.egg) + 8, sec(36.75), sec(36.95), TOTAL - 4, TOTAL],
    [0, 0, 0.15, 0.15, 0.03, 0.03, 0.15, 0.15, 0.32, 0.32, 0],
    clamp,
  );
  const memoBg = (dim: number, band?: [number, number], z = 1, ox = 540) => <Lowered d={360} dim={dim}><MemoPic band={band} z={z} ox={ox} /></Lowered>;
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      {seq(S.cold, 1.62, <Lowered drift={0.00012} d={230}><Vid src="b28-d" start={0} /></Lowered>)}
      {seq(1.62, S.memo, <Lowered drift={0.00012} d={230}><div style={{ width: 1080, height: 1920, transform: 'scale(1.3)', transformOrigin: '470px 430px' }}><Vid src="b28-d" start={1.62} /></div></Lowered>)}
      {seq(S.memo, S.table, memoBg(0))}
      {seq(S.table, S.warn, <Lowered d={300}><PhoneShot bg="phone_night" src="s_kong" focus={1330} z0={1.1} z={1.55} /></Lowered>)}
      {seq(S.warn, S.night, <Lowered d={300}><PhoneShot bg="phone_night" src="s_kong" band={WARN} focus={1915} z0={1.22} z={1.5} /></Lowered>)}
      {seq(S.night, S.morning, <Lowered d={220}><div style={{ width: 1080, height: 1920, filter: 'brightness(1.8) contrast(1.05)' }}><Pic src="night" /></div></Lowered>)}
      {seq(S.morning, S.key, <Lowered d={220}><Pic src="morning" /></Lowered>)}
      {seq(S.key, S.face, <Lowered drift={0.00012} d={200}><Vid src="b28-b" start={THUMP_START} /></Lowered>)}
      {seq(S.face, S.land, <Lowered drift={0.00012} d={120}><Vid src="b28-c3" start={KEY_START} /></Lowered>)}
      {seq(S.land, S.egg, <Lowered drift={0.00012} d={230}><Vid src="b28-d" start={LAND_START} /></Lowered>)}
      {seq(S.egg, S.kong, memoBg(0, EGG, 1.18))}
      {seq(S.kong, S.hobak, <Lowered d={200} dim={0.35}><Pic src="shoot" /></Lowered>)}
      {seq(S.hobak, S.never, memoBg(0.2, EGG, 1.6, 200))}
      {seq(S.kong, S.hobak, <Strip src="s_kong" row={ROW3.s_kong} y={1180} note="ChatGPT 실제 답" />)}
      {seq(S.hobak, S.carrot, <Strip src="s_hobak" row={ROW3.s_hobak} y={1150} note="같은 사진, 새 대화 · 실제 답" />)}
      {seq(S.carrot, S.walnut, <Strip src="s_carrot" row={ROW3.s_carrot} y={1150} note="같은 사진, 새 대화 · 실제 답" />)}
      {seq(S.walnut, S.never, <Strip src="s_walnut" row={ROW3.s_walnut} y={1150} note="같은 사진, 새 대화 · 실제 답" />)}
      {seq(S.never, S.ask, memoBg(0.55, EGG, 2.0, 200))}
      {seq(S.ask, S.q, <Lowered d={300}><PhoneShot bg="phone_night" src="s_q" band={[455, 780]} focus={617} z0={1.3} z={1.75} /></Lowered>)}
      {seq(S.q, S.end, memoBg(0, EGG, 1.18))}
      {seq(S.q, S.end, <Strip src="s_q" row={ROW3.s_q} y={1150} note="이 한 줄을 붙였더니 · 실제 답" />)}
      {seq(S.end, S.punch, <Lowered drift={0.00012} d={240}><Vid src="b28-e" start={END_START} /></Lowered>)}
      {seq(S.punch, S.total, <Lowered drift={0.00012} d={240}><div style={{ width: 1080, height: 1920, transform: 'scale(1.55)', transformOrigin: '640px 1120px' }}><Vid src="b28-e" start={END_START + S.punch - S.end} /></div></Lowered>)}
      <Shade />

      <T meta="AI로 만든 재연이에요" lines={['콩나물 다섯 상자요!']} from={0} to={1.62} size={88} still />
      <T meta="AI로 만든 재연이에요" lines={['…네?']} from={1.62} to={S.memo} me size={112} still />
      <T lines={['시킨 건', '달걀이었어요']} from={S.memo} to={S.table} />
      <T meta="ChatGPT 실제 답 · 예시 메모" lines={['이 메모를', 'AI한테 맡겼거든요']} from={S.table} to={S.warn} size={88} />
      <T meta="표 아래 작은 글 · 실제 답 그대로" lines={['표가 깔끔해서', '아래 작은 글은 안 읽고']} from={S.warn} to={S.night} size={88}
        below={<div style={{ fontWeight: 600, fontSize: 46, color: '#EDEDED', letterSpacing: -0.8, lineHeight: 1.3, borderLeft: '3px solid rgba(255,255,255,0.6)', paddingLeft: 22 }}>일부 품목은 정확한 확인이 필요합니다</div>} />
      <T lines={['보내고 퇴근']} from={S.night} to={S.morning} />
      <T lines={['아침', '달걀 들어오는 날']} from={vo('n03')} to={S.key} />
      <T lines={['달걀 대신', '콩나물 다섯 상자']} from={vo('n10')} to={S.land} />
      <T lines={['메모엔', '달걀 다섯']} from={S.egg} to={S.kong} />
      <T lines={['사람은 읽는 글자를', '콩나물로 읽었어요']} from={S.kong} to={S.hobak} size={88} />
      <T lines={['호박']} from={S.hobak} to={S.carrot} size={88} still />
      <T lines={['호박, 당근']} from={S.carrot} to={S.walnut} size={88} still />
      <T meta="메모에 없는 말까지" lines={['호박, 당근, 호두볼']} from={S.walnut} to={S.never} size={88} still />
      <T lines={['열일곱 번 넣었는데', '달걀은 한 번도 안 나왔어요']} from={S.never} to={S.ask} size={84} below={<Tally from={S.never} />} />
      <T meta="같은 사진에 보낸 말 · 실제 화면" lines={['끝에 이걸 붙여요']} from={S.ask} to={S.prompt} />
      <T lines={['확실하지 않은 글자는', '추측하지 말고', <>{Q}로 남겨 줘</>]} from={S.prompt} to={S.six} size={84} />
      <T lines={['여섯 번 다', <>그 칸에 {Q}</>]} from={S.six} to={S.end} still />
      <T meta="SYNK 브리핑" lines={['남은 콩나물은', '콩나물 소금빵이 됐고요']} from={vo('n09')} to={S.total} />


      {/* 소리 */}
      <Audio src={staticFile('bgm.wav')} volume={() => bgmV * 0.8} />
      <Sequence from={sec(S.cold)}><Audio src={staticFile('plate/b28-d.mp4')} startFrom={0} endAt={sec(S.memo)} volume={0.9} /></Sequence>
      <Sfx at={S.table} src="snap" v={0.5} />
      <Sfx at={S.night} src="tok" v={0.35} />
      <Sequence from={sec(S.key)}><Audio src={staticFile('plate/b28-b.mp4')} startFrom={sec(THUMP_START)} endAt={sec(THUMP_START + S.face - S.key)} volume={0.85} /></Sequence>
      <Sequence from={sec(S.face)}><Audio src={staticFile('plate/b28-c3.mp4')} startFrom={sec(KEY_START)} endAt={sec(KEY_START + S.land - S.face)} volume={0.85} /></Sequence>
      <Sequence from={sec(S.land)}><Audio src={staticFile('plate/b28-d.mp4')} startFrom={sec(LAND_START)} endAt={sec(LAND_START + S.egg - S.land)} volume={0.9} /></Sequence>
      <Sequence from={sec(S.end)}><Audio src={staticFile('plate/b28-e.mp4')} startFrom={sec(END_START)} endAt={sec(END_START + S.total - S.end)} volume={0.6} /></Sequence>
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.8} /></Sequence>
      ))}
      <Sfx at={S.q} src="tok" v={0.45} />
      <Sfx at={S.hobak} src="tick" v={0.3} />
      <Sfx at={S.carrot} src="tick" v={0.3} />
      <Sfx at={S.walnut} src="tick" v={0.3} />
    </AbsoluteFill>
  );
};
