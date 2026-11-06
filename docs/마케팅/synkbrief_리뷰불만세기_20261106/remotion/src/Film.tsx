// synkbrief B27 「리뷰 불만 세기」(11-06) — 리뷰는 AI한테 「요약해 줘」 말고 「불만을 종류별로 세어서 많은 순서로」.
// 뼈대는 v2_a91A3tIU(오마주.json — 훅 0.7 · 판이 나뉘는 4.9 · 판을 비우는 14.0 · 「근데 제일 대박은」 14.3 · 끝 29.0, 이 편은 원본과 같은 34.4초),
// 겉은 장부 「화면 결」(본보기 synkbrief_요금제질문셋_20261103 FilmV2 · 앞 편 synkbrief_발주메모_20261105 Film):
// 원래 장면 그대로(판을 내리고 위는 같은 장면을 뒤집어 흐리게) · 위 그늘 위 큰 글자가 곧 말 · 검정 · 흰 + 버터 한 곳(「4개」) · 줄 단위 올림 · SUIT 하나 · 마침표 없음 · 안전선 안.
// v4(v3 시험관 · 볼 이유 · 맹검 미학 둘이 같이 짚은 것): 어두운 폰 캡처를 화면 가득 깔지 않고 실제 답의 그 줄만 밝은 장면 위 띠로 크게 ·
// 색 막대그래프 대신 실제 답 표의 두 줄 · 14초 검은 화면 대신 폰을 보는 사장 · 「사흘째」는 낮 → 밤 두 컷 · 머리는 현장 대사 대신 해설 「AI가 국물부터 고치래서요」 ·
// v5(v4 시험관이 같이 짚은 것): 「5. 사장님이 먼저 개선할 3가지」의 「5」를 빼고 1번 줄만 · 순위는 넓은 폭(600) 답의 표 다섯 줄을 순위 · 유형 칸과 건수 칸만 붙여 크게(접힌 줄 · 빠진 2 · 3위) ·
// 보낸 말은 폰 화면 안에(까만 폰 위에 뜬 카드 = 목업 티) · 놀란 얼굴은 한 번만, 22.1초 뒤 바로 진동벨 → 손님 한마디 → 29초부터 손님 미소를 0.66배로 늘려 34.4초 끝(그 구간 컷 소리는 끄고 배경음만 — 원본 길이를 지켜야 나란히 박자가 맞는다) · 14초 글은 첫 프레임부터.
// 글이 얼굴을 덮지 않게 판을 더 내림(유리창 너머 얼굴이 판 맨 위에 있어 첫 장면 560 · 사장 폰 컷 420) · 24.6초 다가감은 줄 대신 깨닫는 사장 얼굴로 · 재연 꼬리표는 처음부터 끝까지 같은 자리.
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

// 장면 시작(초) — 원본 컷 · 박자(34.5초)를 그대로 쓴 자리(판이 나뉘는 자리만 4.9 → 5.3, 허용 0.6초 안 — 사장의 말이 5.25초에 끝난다)
export const S = {
  cold: 0, push0: 0.7, push: 1.9, owner: 4.3, sum: 5.3, second: 7.5, pots: 9.6, night: 12.25, again: 14.0, line: 16.8, chart: 19.3,
  look: 22.1, pager: 24.6, take: 26.4, close: 29.0, wide: 31.4, total: 34.4,
};
export const TOTAL = sec(S.total);
// b27-b(유리창 줄 · 떠나는 손님 2.0~3.5 · 「사장님! 손님 또 가세요!」 3.3~4.9 · 「잠깐만, 국물 좀 보고」 5.1~6.3)를 1.05초부터 — 해설 머리(0.05~2.13) 뒤에 직원 외침이 온다
const COLD = 1.05;
const POTS = 4.0; // b27-a 사장이 냄비를 젓고 맛보는 뒷부분
const LOOK = 3.0; // b27-c2 폰을 보다 고개를 드는 자리

// 판을 d만큼 내리고 위는 같은 장면을 뒤집어 흐리게 채운다. 들어올 때 1.035배에서 내려앉고 아주 천천히 다가간다. dim — 위에 띠를 얹을 때 판을 누른다
const Lowered: React.FC<{ d?: number; dim?: number; drift?: number; settle?: boolean; children: React.ReactNode }> = ({ d = 260, dim = 0, drift = 0.0011, settle = true, children }) => {
  const f = useCurrentFrame();
  const z = (settle ? interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) : 1) + f * drift;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.4)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 30%' }}>{children}</div>
      {dim ? <AbsoluteFill style={{ background: `rgba(8,8,8,${dim})` }} /> : null}
    </AbsoluteFill>
  );
};
const Vid: React.FC<{ src: string; start?: number; rate?: number }> = ({ src, start = 0, rate = 1 }) => (
  <OffthreadVideo muted src={staticFile(`plate/${src}.mp4`)} startFrom={sec(start)} playbackRate={rate} style={{ width: 1080, height: 1920 }} />
);
const Pic: React.FC<{ src: string }> = ({ src }) => <Img src={staticFile(`img/${src}.png`)} style={{ width: 1080, height: 1920, objectFit: 'cover' }} />;
// 한 장면 안에서 z배로 (ox, oy) 쪽에 다가간 판(박 위 컷 — 들어올 때 내려앉는다)
const Zoom: React.FC<{ z: number; ox: number; oy: number; children: React.ReactNode }> = ({ z, ox, oy, children }) => {
  const f = useCurrentFrame();
  const zz = z * interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ width: 1080, height: 1920, transform: `scale(${zz})`, transformOrigin: `${ox}px ${oy}px` }}>{children}</div>;
};

// 위 그늘 — 글자 자리만 어둡게
const Shade: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />
);

// 큰 글자가 곧 말 — 줄마다 28px 아래에서 올라오며 나타난다(줄 사이 3프레임). me = 사람의 말(회색), still = 첫 프레임부터 다 보임,
// fade — 프레임 수만큼 천천히 스며든다(한 구성 안에서 글이 바뀌는 자리가 박자로 잡히지 않게, v3 나란히)
const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; me?: boolean; size?: number; meta?: string; still?: boolean; top?: number; fade?: number; fadeOut?: number }> = ({ lines, from, to, me, size = 96, meta, still, top = TOP, fade, fadeOut = 3 }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - fadeOut, b], [1, 0], clamp);
  const up = (k: number) => {
    if (fade) return { opacity: interpolate(f, [a, a + fade], [0, 1], clamp) * out };
    const p = still ? 1 : interpolate(f, [a + k * 3, a + k * 3 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 900, top, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {meta ? <div style={{ ...up(0), fontWeight: 600, fontSize: 36, letterSpacing: -0.5, color: GREY, marginBottom: 18 }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: me ? 700 : 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: me ? GREY : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};

// 실제 답 그 줄만(1290 × 2796 휴대폰 폭 캡처의 crop) — 어두운 띠에 넣어 크게, 위에 작은 회색 출처 한 줄. 값 · 글은 손대지 않는다
type Crop = [number, number, number, number];
const Card: React.FC<{ src: string; crop: Crop; y: number; note?: string; w?: number; from: number; to: number; fade?: number }> = ({ src, crop, y, note, w = 846, from, to, fade = 6 }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const o = interpolate(f, [a, a + fade], [0, 1], clamp) * interpolate(f, [b - 3, b], [1, 0], clamp);
  const [x0, y0, x1, y1] = crop;
  const s = w / (x1 - x0);
  return (
    <div style={{ position: 'absolute', left: X - 16, top: y, width: w + 32, opacity: o, fontFamily: KO, background: 'rgba(10,10,10,0.86)', borderRadius: 22, padding: note ? '18px 16px 16px' : '16px', boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}>
      {note ? <div style={{ fontWeight: 600, fontSize: 30, color: GREY, marginBottom: 10, marginLeft: 6, letterSpacing: -0.4 }}>{note}</div> : null}
      <div style={{ position: 'relative', width: w, height: (y1 - y0) * s, borderRadius: 12, overflow: 'hidden', background: '#0d0d0d' }}>
        <Img src={staticFile(`img/${src}.png`)} style={{ position: 'absolute', left: -x0 * s, top: -y0 * s, width: 1290 * s, height: 2796 * s, maxWidth: 'none', filter: 'brightness(1.3) contrast(1.12)' }} />
      </div>
    </div>
  );
};

// 넓은 폭 표(1800 × 3000 캡처) — 순위 · 유형 칸(x 45~950)과 건수 칸(x 1560~1770)만 붙여 크게, 1위 · 국물 줄 밖은 누른다. 값 · 글은 그대로
const TABLE_Y: [number, number] = [1200, 1838];
const KEEP: [number, number][] = [[1322, 1398], [1650, 1730]]; // 1위 · 공동 4위 국물
const TableCard: React.FC<{ y: number; from: number; to: number; note: string }> = ({ y, from, to, note }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const o = interpolate(f, [a, a + 9], [0, 1], clamp) * interpolate(f, [b - 3, b], [1, 0], clamp);
  const dimIn = interpolate(f, [a + 12, a + 30], [0, 0.62], clamp);
  const L: [number, number] = [45, 950], R: [number, number] = [1560, 1770];
  const W = 822, s = W / ((L[1] - L[0]) + (R[1] - R[0]));
  const [y0, y1] = TABLE_Y;
  const part = (x: [number, number]) => (
    <div style={{ position: 'relative', width: (x[1] - x[0]) * s, height: (y1 - y0) * s, overflow: 'hidden' }}>
      <Img src={staticFile('img/s_table.png')} style={{ position: 'absolute', left: -x[0] * s, top: -y0 * s, width: 1800 * s, height: 3000 * s, maxWidth: 'none', filter: 'brightness(1.3) contrast(1.12)' }} />
    </div>
  );
  const bands: [number, number][] = [[y0, KEEP[0][0]], [KEEP[0][1], KEEP[1][0]], [KEEP[1][1], y1]];
  return (
    <div style={{ position: 'absolute', left: 66, top: y, width: W + 32, opacity: o, fontFamily: KO, background: 'rgba(10,10,10,0.88)', borderRadius: 22, padding: '18px 16px 16px', boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}>
      <div style={{ fontWeight: 600, fontSize: 30, color: GREY, marginBottom: 10, marginLeft: 6, letterSpacing: -0.4 }}>{note}</div>
      <div style={{ position: 'relative', display: 'flex', borderRadius: 12, overflow: 'hidden', background: '#0d0d0d' }}>
        {part(L)}{part(R)}
        {bands.map(([b0, b1], i) => <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: (b0 - y0) * s, height: (b1 - b0) * s, background: 'rgba(0,0,0,' + dimIn + ')' }} />)}
      </div>
    </div>
  );
};

// 손에 든 폰(폰 그림 1080 × 1920) — 꺼진 화면 자리에 실제 화면 캡처(1290 × 2796)를 폭에 맞춰 넣고 focus(캡처 y) 쪽으로 z0 → z배 다가간다
const SCREEN: [number, number, number, number] = [304, 352, 820, 1444];
const PhoneShot: React.FC<{ src: string; focus: number; z: number; z0?: number }> = ({ src, focus, z, z0 }) => {
  const f = useCurrentFrame();
  const [x0, y0, x1, y1] = SCREEN;
  const s = (x1 - x0) / 1290;
  const fy = y0 + focus * s;
  const zz = interpolate(f, [0, 16], [z0 ?? z, z], { ...clamp, easing: EASE_OUT }) + f * 0.0006;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: 'scale(' + zz + ')', transformOrigin: '562px ' + fy + 'px' }}>
      <Img src={staticFile('img/phone.png')} style={{ width: 1080, height: 1920 }} />
      <div style={{ position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0, borderRadius: 40, overflow: 'hidden', background: '#0d0d0d' }}>
        <Img src={staticFile('img/' + src + '.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1290 * s, height: 2796 * s, maxWidth: 'none', filter: 'brightness(1.25)' }} />
        <AbsoluteFill style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 40%)' }} />
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
const Clip: React.FC<{ at: number; to: number; src: string; start: number; v: number }> = ({ at, to, src, start, v }) => (
  <Sequence from={sec(at)}><Audio src={staticFile(`plate/${src}.mp4`)} startFrom={sec(start)} endAt={sec(start + to - at)} volume={v} /></Sequence>
);

// 실제 화면 자르는 자리(캡처 px) — 시안/실제_*.png를 눈금으로 잼
// v6(맹검 둘 「검은 둥근 띠 = 발표 슬라이드 · 기본 자막 띠」): 제목 한 줄만 자르지 않고 답 본문 세 줄까지 — 실제 답 조각으로 읽히게
// v7(맹검 둘 · Opus · 시험관 넷 「6~10초 빽빽한 답 상자 · 2번 「대기」가 반전을 미리 흘림」): 1번 줄 하나만 크게, 2번 상자 · 「기다림은 그다음」 줄은 뺌
const FIRST: Crop = [40, 280, 900, 368]; // 「1 국물 맛 표준화 — 최우선 / 육수 농도, 염도, 조리 시간 …」(v5: 위 「5. 사장님이 먼저 개선할 3가지」의 「5」가 헷갈려 빼고 출처 줄에 「먼저 개선할 3가지」)
const ASK: Crop = [30, 1880, 1260, 2300]; // 입력창 — 보낸 말 두 줄 + 붙인 리뷰 첫 줄들(v6: 폰 그림 대신 — 맹검 둘 「폰 스톡 구도 · 뜬 카드 = 목업」)

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const bgmV = interpolate(
    f,
    [0, sec(2.0), sec(S.sum) - 4, sec(S.sum) + 6, sec(S.look) - 4, sec(S.look), sec(S.pager), sec(27.4), sec(29.0), sec(29.4), sec(31.2), sec(31.5), sec(33.8), sec(34.0), TOTAL],
    [0.12, 0.06, 0.06, 0.15, 0.15, 0.08, 0.15, 0.06, 0.06, 0.2, 0.2, 0.09, 0.09, 0.16, 0],
    clamp,
  );
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      {seq(S.cold, S.push0, <Lowered drift={0.0002} d={560}><Vid src="b27-b" start={COLD} /></Lowered>)}
      {seq(S.push0, S.push, <Lowered drift={0.0002} d={560} settle={false}><Zoom z={1.3} ox={540} oy={200}><Vid src="b27-b" start={COLD + S.push0} /></Zoom></Lowered>)}
      {seq(S.push, S.owner, <Lowered drift={0.0002} d={560}><Vid src="b27-b" start={COLD + S.push} /></Lowered>)}
      {seq(S.owner, S.sum, <Lowered drift={0.0002} d={200} settle={false}><Zoom z={1.55} ox={230} oy={1300}><Vid src="b27-b" start={COLD + S.owner} /></Zoom></Lowered>)}
      {seq(S.sum, S.second, <Lowered d={300} dim={0.42} drift={0.0004}><Pic src="kitchen" /></Lowered>)}
      {/* v6: 「사흘 밤낮」은 밤 한 장(낮 주방 되풀이를 없앰 — haiku 8~12초 넘김 · Opus 약한 자리) */}
      {seq(S.second, S.pots, <Lowered drift={0.0009} d={260}><Pic src="night" /></Lowered>)}
      {seq(S.pots, S.again, <Lowered drift={0.0003} d={200}><Vid src="b27-a" start={3.95} rate={0.93} /></Lowered>)}
      {seq(S.again, S.line, <Lowered drift={0.0003} d={420}><Vid src="b27-c2" start={0} /></Lowered>)}
      {seq(S.line, S.look, <Lowered d={420} dim={0.6} drift={0.0003}><Vid src="b27-a" start={0} /></Lowered>)}
      {/* v6: 만화 같은 놀란 얼굴(b27-c2 3초 뒤 — 맹검 · Opus) 대신 유리창 밖에서 사장을 보는 손님(아직 안 쓴 b27-b 뒷부분) */}
      {seq(S.look, S.pager, <Lowered drift={0.0004} d={560}><Vid src="b27-b" start={6.3} rate={0.69} /></Lowered>)}
      {seq(S.pager, S.take, <Lowered drift={0.0002} d={120}><Vid src="b27-d2" start={0} /></Lowered>)}
      {seq(S.take, S.close, <Lowered drift={0.0002} d={120} settle={false}><Zoom z={1.22} ox={700} oy={1000}><Vid src="b27-d2" start={S.take - S.pager} /></Zoom></Lowered>)}
      {/* v6: 끝 두 칸이 같은 정지 컷(맹검 둘 · haiku · GPT) → 손님 얼굴(29~31.4) → 진동벨을 든 줄 전체로 물러나며(31.4~) 따라 할 한 줄로 맺음 */}
      {seq(S.close, S.wide, <Lowered drift={0.0002} d={120} settle={false}><Zoom z={1.5} ox={720} oy={960}><Vid src="b27-d2" start={S.close - S.pager} rate={0.83} /></Zoom></Lowered>)}
      {seq(S.wide, S.total, <Lowered drift={0.0003} d={120}><Vid src="b27-d2" start={5.4} rate={0.88} /></Lowered>)}
      <Shade />

      <Small text="AI로 만든 재연이에요" from={0} to={S.total} />
      <Small text="SYNK 브리핑" from={27.5} to={S.total} right />
      <T lines={['AI가 국물부터', '고치래서요']} from={0.05} to={2.2} size={104} />
      <T lines={['사장님!', '손님 또 가세요!']} from={2.2} to={4.0} size={104} still />
      <T lines={['잠깐만,', '국물 좀 보고…']} from={4.0} to={S.sum} me size={104} still />
      <T lines={['리뷰 100개를 요약시켰더니', '1번이 국물']} from={S.sum} to={S.second} size={88} />
      <Card src="s_first" crop={FIRST} y={650} w={932} note="ChatGPT 실제 답 · 먼저 개선할 3가지 · 예시 리뷰 100개" from={S.sum} to={S.second} />
      <T lines={['사흘 밤낮', '국물만 끓였는데']} from={vo('n13')} to={S.again} size={96} />
      <T lines={['줄은 그대로']} from={S.pots} to={S.again} size={96} top={TOP + 236} fade={12} />
      <T lines={['근데 같은 리뷰를', '이렇게 다시 물었어요']} from={S.again} to={S.line} still />
      <T meta="같은 리뷰 100개를 붙이고 보낸 말" lines={['불만을 종류별로 세어서', '많은 순서로']} from={S.line} to={S.chart} size={92} />
      <Card src="s_ask" crop={ASK} y={630} w={932} note="ChatGPT 입력창 · 실제 화면" from={S.line} to={S.chart} fade={9} />
      <T meta="ChatGPT 실제 답" lines={['1위는 기다림', <>국물은 100개 중 <span style={{ color: BUTTER }}>4개</span></>]} from={S.chart} to={S.look} />
      <TableCard y={630} from={S.chart} to={S.look} note="같은 리뷰 · 새 대화 · ChatGPT 실제 답" />
      <T lines={['그날부터', '국자 대신 진동벨']} from={vo('n07')} to={27.5} fade={18} fadeOut={15} />
      <T lines={['국물은 원래', '맛있었어요']} from={27.5} to={S.wide} me size={104} fade={15} fadeOut={12} />
      <T lines={['리뷰는 요약 말고', '세어 달라고 하세요']} from={S.wide} to={S.total} fade={15} />

      {/* 소리 */}
      <Audio src={staticFile('bgm.wav')} volume={() => bgmV * 0.8} />
      <Clip at={S.cold} to={S.sum} src="b27-b" start={COLD} v={0.95} />
      <Clip at={S.second} to={S.again} src="b27-c2" start={3.0} v={0.7} />
      <Clip at={S.again} to={S.line} src="b27-c2" start={0} v={0.85} />
      <Clip at={S.line} to={S.pager} src="b27-c2" start={3.0} v={0.55} />
      <Clip at={S.pager} to={29.4} src="b27-d2" start={0} v={0.95} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.8} /></Sequence>
      ))}
      <Sfx at={S.sum} src="snap" v={0.45} />
      <Sfx at={S.second} src="tok" v={0.25} />
      <Sfx at={S.chart} src="tick" v={0.35} />
    </AbsoluteFill>
  );
};
