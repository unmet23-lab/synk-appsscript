// synkbrief B24 v2(11-03 밤) — 같은 말 · 같은 소리 · 같은 판 조각에 겉만 「화면 결」로 다시 입힌 판.
// 유호님 11-03 「누가봐도 ai 슬롭」 — 옛 판의 꼬리표 · 번호 동그라미 · 노란 메모 · 초록 띠 · 빨간 상자 · 흰 말풍선을 모두 뺐다.
// 결은 yuhobuilds 장부 「화면 결」과 같다: 원래 장면 그대로(판을 아래로 내리고 위는 같은 장면을 뒤집어 흐리게) · 위 그늘 위 큰 글자가 곧 말 ·
// 검정 · 흰 + 버터 한 곳(돈 — 34만 8천 원) · 줄 단위 올림 · 박 위 컷 + 살짝 당김 · SUIT 하나 · 안전선(x 65~920 · y 269~1428) 안 글자 · 마침표 없음.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import FACE from './face-map.json';
import { S, TOTAL } from './Film';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);
const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

const BUTTER = '#F5C445';
const GREY = '#A3A3A3';
const X = 74;
const TOP = 284;

// 판을 D만큼 내리고, 빈 위쪽은 같은 장면 윗부분을 뒤집어 흐리게 채운다. 컷이 들어올 때 1.035배에서 내려앉고, 그 뒤로 아주 천천히 다가간다.
const Lowered: React.FC<{ d?: number; children: React.ReactNode }> = ({ d = 320, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) + f * 0.00012;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.55)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 30%' }}>{children}</div>
    </AbsoluteFill>
  );
};

const PlateV: React.FC<{ src: string; dir?: string; start?: number; rate?: number; z?: number; origin?: string }> = ({ src, dir = 'plate', start = 0, rate = 1, z = 1, origin = '540px 560px' }) => (
  <OffthreadVideo muted src={staticFile(`${dir}/${src}.mp4`)} startFrom={sec(start)} playbackRate={rate} style={{ width: 1080, height: 1920, transformOrigin: origin, transform: `scale(${z})` }} />
);
const Plate: React.FC<{ src: string; dir?: string; d?: number }> = ({ src, dir, d }) => <Lowered d={d}><PlateV src={src} dir={dir} /></Lowered>;

// 위 그늘 — 글자 자리만 어둡게
const Shade: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />
);

// 큰 글자가 곧 말 — 줄마다 28px 아래에서 올라오며 나타난다(줄 사이 3프레임). me = 「나」의 말(회색)
// still = 첫 프레임부터 다 보임(0초 훅 · 표지)
const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; me?: boolean; size?: number; meta?: string; below?: React.ReactNode; still?: boolean }> = ({ lines, from, to, me, size = 96, meta, below, still }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const out = interpolate(f, [b - 3, b], [1, 0], clamp);
  const up = (k: number) => {
    const p = still ? 1 : interpolate(f, [a + k * 3, a + k * 3 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 28}px)` };
  };
  return (
    <div style={{ position: 'absolute', left: X, width: 846, top: TOP, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
      {meta ? <div style={{ ...up(0), fontWeight: 600, fontSize: 32, letterSpacing: -0.5, color: GREY, marginBottom: 18 }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: me ? 700 : 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: me ? GREY : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
      {below ? <div style={{ ...up(lines.length + 1), marginTop: 34 }}>{below}</div> : null}
    </div>
  );
};

// 실제 화면 조각 — 꼬리표 대신 위에 작은 회색 출처 한 줄
const Shot: React.FC<{ src: string; w: number; h: number; note: string }> = ({ src, w, h, note }) => (
  <div>
    <div style={{ fontFamily: KO, fontWeight: 600, fontSize: 28, color: GREY, marginBottom: 12, letterSpacing: -0.4 }}>{note}</div>
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', width: 846 }}>
      <Img src={staticFile(`img/${src}.png`)} style={{ display: 'block', width: 846, height: Math.round((h * 846) / w) }} />
    </div>
  </div>
);

// 공식 도움말 원문 한 줄 — 흰 바탕 캡처 띠 대신 글로(값 · 글은 원문 그대로)
const Quote: React.FC<{ text: string; note: string }> = ({ text, note }) => (
  <div style={{ fontFamily: KO, borderLeft: '3px solid rgba(255,255,255,0.5)', paddingLeft: 22 }}>
    <div style={{ fontWeight: 600, fontSize: 28, color: GREY, marginBottom: 8, letterSpacing: -0.4 }}>{note}</div>
    <div style={{ fontWeight: 500, fontSize: 40, color: '#EDEDED', letterSpacing: -0.8, lineHeight: 1.3 }}>{text}</div>
  </div>
);

// 줄로만 늘어놓는 표 — 셋을 다 물은 뒤의 물음 · 답, 무료로 되는 것 · 한도 있는 것
const Rows: React.FC<{ rows: string[][]; wide?: boolean }> = ({ rows, wide }) => (
  <div style={{ fontFamily: KO }}>
    {rows.map(([q, a]) => (
      <div key={q} style={{ display: 'flex', gap: 28, fontSize: 40, lineHeight: 1.6, letterSpacing: -0.8 }}>
        <span style={{ width: wide ? 360 : 250, fontWeight: 700, color: '#fff' }}>{q}</span>
        <span style={{ fontWeight: 600, color: '#CFCFCF' }}>{a}</span>
      </div>
    ))}
  </div>
);
const Tally: React.FC = () => <Rows rows={[['한도 알림', '아니'], ['파일 · 사진', '가끔'], ['긴 문서', '아니']]} />;

// 작은 표시는 한 규칙 — 30px · 아래 안전선 줄, 알림은 왼쪽 · 브랜드는 오른쪽
const Small: React.FC<{ text: string; from: number; to: number; right?: boolean }> = ({ text, from, to, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 920 } : { left: X };
  return <div style={{ position: 'absolute', ...pos, top: 1372, fontFamily: KO, fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,0.86)', letterSpacing: -0.4, textShadow: '0 1px 10px rgba(0,0,0,0.75)' }}>{text}</div>;
};

const Sfx: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.5 }) => (
  <Sequence from={sec(at)}><Audio src={staticFile(`sfx/${src}.wav`)} volume={v * 0.8} /></Sequence>
);

// 같은 정면 컷이 이어진다는 맹검 지적(11-03) — 질문마다 거리를 바꾼다(조각 번호 → 키움 · 중심)
const FRAME: Record<number, [number, string]> = {
  2: [1.16, '540px 520px'], 3: [1.16, '540px 520px'],
  7: [1.3, '540px 500px'],
  8: [1.12, '700px 620px'], 9: [1.12, '700px 620px'],
};
const FacePieces: React.FC = () => (
  <>
    {(FACE as { src: string; at: number; to: number; start: number; rate: number; z?: number }[]).map((p, i) => (
      <React.Fragment key={i}>{seq(p.at, p.to, <Lowered><PlateV src={p.src} start={p.start} rate={p.rate} z={FRAME[i]?.[0] ?? p.z} origin={FRAME[i]?.[1]} /></Lowered>)}</React.Fragment>
    ))}
  </>
);

export const FilmV2: React.FC = () => {
  const f = useCurrentFrame();
  const bgmV = interpolate(f, [sec(S.q - 0.2), sec(S.q + 0.2), sec(S.slap2) - 1, sec(S.slap2)], [0, 0.16, 0.16, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      {seq(0, S.faceA, <Plate src="pov_A" />)}
      <FacePieces />
      {seq(S.chat, S.laugh, <Plate src="pov_chat" />)}
      {seq(S.povFile, S.q3, <Plate src="pov_file" dir="plate2" />)}
      {seq(S.povFree, S.n08, <Plate src="pov_free" dir="plate2" />)}
      {seq(S.strike, S.creep, <Plate src="pov_strike" dir="plate2" />)}
      {seq(S.creep, S.faceEnd, <Plate src="pov_end" dir="plate2" />)}
      {seq(S.lunch, S.total, <Lowered d={220}><PlateV src="lunch" start={0.3} z={1.22} origin="250px 1700px" /></Lowered>)}
      <Shade />

      <T lines={['AI 유료 결제', '1초 전']} from={0} to={S.slap} size={112} still />
      <T lines={['잠깐, 그거', '어디 쓰려고?']} from={vo('n01')} to={vo('p01')} />
      <T lines={['다들 쓴다길래…']} from={vo('p01')} to={S.faceB} me />
      <T lines={['다들', '뭐에 쓰는데?']} from={S.faceB} to={vo('p06')} />
      <T lines={['…몰라']} from={vo('p06')} to={S.chat} me />
      <T lines={['어제 뭐', '물어봤어?']} from={S.chat} to={vo('p07')} />
      <T lines={['…오늘 점심', '뭐 먹지']} from={vo('p07')} to={S.laugh} me />

      <T meta="질문 1 / 3" lines={['한도 다 썼다는', '알림, 본 적 있어?']} from={S.q} to={vo('p02')} size={88}
        below={<Quote text="파일 · 사진 · 음성은 쓰는 양에 한도가 있어요" note="ChatGPT 도움말 「한도에 도달하면 ChatGPT에서 알려드립니다」" />} />
      <T lines={['아니']} from={vo('p02')} to={vo('n04')} me />
      <T meta="질문 2 / 3" lines={['파일이나 사진,', '매일 올려?']} from={vo('n04')} to={S.povFile} size={88}
        below={<Shot src="card_file" w={1098} h={144} note="ChatGPT 무료 요금제 · 실제 화면" />} />
      <T lines={['어… 가끔?']} from={vo('p03')} to={vo('n11')} me />
      <T lines={['가끔이면 됐고']} from={vo('n11')} to={S.q3} />
      <T meta="질문 3 / 3" lines={['긴 문서,', '통째로 넣어?']} from={S.q3} to={vo('p04')} size={88} />
      <T lines={['…아니']} from={vo('p04')} to={S.free} me />
      <T lines={['그럼 무료로', '충분해']} from={S.free} to={S.povFree} below={<Tally />} />
      <T lines={['진짜?']} from={vo('p08')} to={vo('n07')} me />
      <T lines={['챗GPT는 글로만', '묻는 건,', '무료도 무제한이야']} from={vo('n07')} to={S.n08} size={84}
        below={<Rows rows={[['글로 묻기', '무제한'], ['파일 · 사진 · 음성', '한도 있음']]} wide />} />
      <T lines={['하나라도', "'예'면,"]} from={S.n08} to={S.pay2} />
      <T lines={['그때 결제해']} from={S.pay2} to={S.strike} />
      <T meta="₩29,000 × 12달" lines={['1년이면', <span style={{ color: BUTTER }}>34만 8천 원</span>]} from={S.strike + 0.35} to={S.creep + 0.3} size={112} />
      <T lines={['그래도 한 달만…']} from={vo('p05')} to={S.slap2} me />
      <T lines={['그 돈으로', '점심이나 사']} from={S.faceEnd} to={S.total} size={104} />

      <Small text="AI로 만든 재연이에요" from={S.faceA} to={S.faceB} />
      <Small text="SYNK 브리핑" from={S.total - 2.6} to={S.total} right />

      {/* 소리 — 옛 판과 같다 */}
      <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.35 * interpolate(fr, [0, 6, sec(S.q - 0.1), sec(S.q + 0.2)], [0.5, 1, 1, 0], clamp)} />
      <Sfx at={0.05} src="tick" v={0.25} />
      <Sfx at={0.55} src="tick" v={0.25} />
      <Sfx at={1.05} src="tick" v={0.25} />
      <Sequence from={sec(S.q - 0.2)}><Audio src={staticFile('bgm.wav')} volume={() => bgmV * 0.8} /></Sequence>
      <Sequence from={sec(S.lunch)}><Audio src={staticFile('plate/lunch_a.wav')} startFrom={sec(0.3)} volume={0.9} /></Sequence>
      <Sequence from={sec(S.lunch)}><Audio src={staticFile('bgm.wav')} startFrom={sec(19)} volume={(fr: number) => 0.13 * interpolate(fr, [0, 4, 36, 44], [0, 1, 1, 0], clamp)} /></Sequence>
      <Audio src={staticFile('plate/V1_a.wav')} startFrom={sec(1.1)} endAt={sec(5.46)} volume={0.9} />
      <Sequence from={sec(S.slap2 - 2.01)}><Audio src={staticFile('plate/V1_a.wav')} startFrom={sec(0.55)} endAt={sec(3.2)} volume={0.9} /></Sequence>
      <Sfx at={S.slap - 0.01} src="hand" v={0.45} />
      <Sfx at={S.slap2 - 0.01} src="hand" v={0.55} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.8} /></Sequence>
      ))}
      <Sfx at={S.free} src="tok" v={0.35} />
    </AbsoluteFill>
  );
};

export { TOTAL };
