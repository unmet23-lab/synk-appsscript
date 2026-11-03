// synkbrief B26 「클로드 디자인, 없어진다?」(11-04) — 판정편 시험. 뼈대는 sVqUbBiP60Q(오마주.json), 겉은 장부 「화면 결」(본보기 synkbrief_요금제질문셋_20261103 FilmV2).
// 재연(화환 · 디자이너 · 세 물건)은 AI 영상, 도움말은 실제 화면(1080 폭 캡처를 그대로 움직이고 값 · 글은 손대지 않는다, 짚는 줄은 그 줄 밖을 어둡게 → 그 줄을 원문 그대로 크게).
// 검정 · 흰 + 버터 한 곳(12월 14일) · SUIT 하나 · 위 그늘 위 큰 글자 · 마침표 없음 · 안전선(x 65~920 · y 269~1428) 안.
// 시험 v1(11-04) 고침: 「클로드 디자인」 뜻 작은 글 · 영문 화면을 줄이고 원문을 크게(셋이 같이 짚음) · 「못 옮기는 셋」을 물건으로, 챙기는 손(볼 이유 심사) · 링크를 왜 적나.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE = Easing.bezier(0.45, 0, 0.2, 1);
const sec = (s: number) => Math.round(s * 30);
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

const BUTTER = '#F5C445';
const GREY = '#A3A3A3';
const X = 74;
const TOP = 284;

// 장면 시작(초) — 원본 박자 0.3 · 1.0 · 3.2 · 4.9 · 6.3 · 10.8 · 15.2 · 18.8 · 19.9 · 21.6 · 23.4 · 28.0 · 30.1에 맞춘다
export const S = {
  ribbon: 0, hand: 0.4, wide: 1.0, open: 3.2, door: 4.9, line: 5.3, react: 6.35, close: 6.85, load: 8.25, move: 9.6, things: 11.0, chats: 13.4, comments: 13.98, key: 14.55, keyPage: 15.0,
  phone: 15.75, black: 18.8, date: 19.9, three: 21.6, s1: 23.4, s2: 26.25, s3: 27.55, card: 29.2, end: 30.55, total: 33.55,
};
export const TOTAL = sec(S.total);

// AI 재연 판 — 컷이 들어올 때 1.035배에서 내려앉고 아주 천천히 다가간다
const Plate: React.FC<{ src: string; start?: number; z?: number; origin?: string }> = ({ src, start = 0, z = 1, origin = '50% 50%' }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) + f * 0.00012;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <OffthreadVideo muted src={staticFile(`plate/${src}.mp4`)} startFrom={sec(start)} style={{ width: 1080, height: 1920, transformOrigin: origin, transform: `scale(${z * s})` }} />
    </AbsoluteFill>
  );
};

// 실제 도움말 — 판을 d만큼 내리고 from → to(그림 y)로 움직인다. hi: 밝게 둘 줄(그림 y 위 · 아래), 그 밖은 어둡게.
// qa · quote: 그 줄을 먼저 그대로 보인 뒤(제작 절차 「실제 화면은 크게 다시 짜기」) qa초에 그 줄을 원문 그대로 크게 다시 짠다
type Band = [number, number];
const Page: React.FC<{ src: string; d?: number; from?: number; to?: number; dur?: number; hi?: Band; qa?: number; quote?: string }> = ({ src, d = 600, from = 0, to = 0, dur = 20, hi, qa = 999, quote }) => {
  const f = useCurrentFrame();
  const y = interpolate(f, [0, dur], [from, to], { ...clamp, easing: EASE });
  const z = interpolate(f, [0, 8], [1.02, 1], { ...clamp, easing: EASE_OUT }) + f * 0.00008;
  const dim = hi ? interpolate(f, [0, 5], [0, 0.72], clamp) : 0;
  const q = interpolate(f, [sec(qa), sec(qa) + 7], [0, 1], { ...clamp, easing: EASE_OUT });
  const top = hi ? hi[0] - y + d : 0;
  const bot = hi ? hi[1] - y + d : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '50% 40%' }}>
        <Img src={staticFile(`img/${src}.png`)} style={{ position: 'absolute', left: 0, top: d - y, width: 1080, height: 2341 }} />
        {hi ? (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, top), background: `rgba(8,8,8,${dim})` }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: bot, bottom: 0, background: `rgba(8,8,8,${dim})` }} />
          </>
        ) : null}
      </div>
      {quote ? (
        <>
          <AbsoluteFill style={{ background: `rgba(8,8,8,${q * 0.9})` }} />
          <div style={{ position: 'absolute', left: X, width: 860, top: 680, fontFamily: KO, opacity: q, transform: `translateY(${(1 - q) * 28}px)` }}>
            <div style={{ fontWeight: 600, fontSize: 76, lineHeight: 1.2, letterSpacing: -1.8, color: '#fff' }}>{quote}</div>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// 위 그늘 — 글자 자리만 어둡게
const Shade: React.FC<{ strong?: boolean }> = ({ strong }) => (
  <AbsoluteFill style={{ background: strong ? 'linear-gradient(to bottom, rgba(10,10,10,0.98) 0px, rgba(10,10,10,0.98) 590px, rgba(10,10,10,0) 640px)' : 'linear-gradient(to bottom, rgba(10,10,10,0.9) 0px, rgba(10,10,10,0.78) 500px, rgba(10,10,10,0.3) 720px, rgba(10,10,10,0) 900px)' }} />
);

// 큰 글자가 곧 말 — 줄마다 28px 아래에서 올라온다. still = 첫 프레임부터 다 보임(0초 훅)
const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; size?: number; meta?: string; still?: boolean }> = ({ lines, from, to, size = 104, meta, still }) => {
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
      {meta ? <div style={{ ...up(0), fontWeight: 600, fontSize: 34, letterSpacing: -0.5, color: '#D6D6D6', marginBottom: 16 }}>{meta}</div> : null}
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.6, color: '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
    </div>
  );
};

// 작은 표시 — 30px · 아래 안전선 줄
const Small: React.FC<{ text: string; from: number; to: number; right?: boolean }> = ({ text, from, to, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 920 } : { left: X };
  return <div style={{ position: 'absolute', ...pos, top: 1372, fontFamily: KO, fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,0.86)', letterSpacing: -0.4, textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>{text}</div>;
};

// 실제 화면 출처 — 꼬리표 대신 큰 글자 아래 작은 회색 한 줄
const Src: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  return <div style={{ position: 'absolute', left: X, top: 552, fontFamily: KO, fontWeight: 600, fontSize: 28, color: GREY, letterSpacing: -0.4 }}>공식 도움말 · 실제 화면 · 11월 4일 확인</div>;
};

// 12월 14일 — 검정 화면 위 가장 큰 글자(버터는 여기 한 곳). 원본 19.9초 화면 뒤집기 자리
const DateCard: React.FC = () => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 7], [1.12, 1], { ...clamp, easing: EASE_OUT });
  const three = interpolate(f, [sec(S.three - S.date), sec(S.three - S.date) + 9], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', left: X, top: 560, width: 930, fontFamily: KO, fontWeight: 900, fontSize: 196, lineHeight: 1.04, letterSpacing: -7, color: BUTTER, transform: `scale(${s})`, transformOrigin: '0% 50%' }}>
        12월<br />14일 전에
      </div>
      <div style={{ position: 'absolute', left: X, top: 1010, width: 846, fontFamily: KO, fontWeight: 800, fontSize: 92, letterSpacing: -2.4, color: '#fff', opacity: three, transform: `translateY(${(1 - three) * 28}px)` }}>세 가지만 하세요</div>
    </AbsoluteFill>
  );
};

// 저장할 한 장 — 세 단계. 한 줄씩 들어오고 끝까지 남는다
const STEPS = [['1', '보낸 공개 링크', '적어 두기'], ['2', '채팅 · 댓글에서', '남길 말 복사'], ['3', 'Share → Project HTML', '→ Export로 파일 받기']];
const SaveCard: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#0b0b0b', fontFamily: KO }}>
      <div style={{ position: 'absolute', left: X, top: 284, fontWeight: 800, fontSize: 76, letterSpacing: -2, color: '#fff' }}>12월 14일 전에</div>
      <div style={{ position: 'absolute', left: X, top: 386, fontWeight: 600, fontSize: 38, letterSpacing: -0.8, color: GREY }}>옮기기 단추가 보이면 옮기기부터</div>
      {STEPS.map(([n, a, b], i) => {
        const p = interpolate(f, [i * 4, i * 4 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <div key={n} style={{ position: 'absolute', left: X, width: 846, top: 490 + i * 290, opacity: p, transform: `translateY(${(1 - p) * 28}px)` }}>
            <div style={{ fontWeight: 600, fontSize: 40, color: GREY, marginBottom: 6 }}>{n}</div>
            <div style={{ fontWeight: 800, fontSize: 68, lineHeight: 1.18, letterSpacing: -1.8, color: '#fff' }}>{a}</div>
            <div style={{ fontWeight: 800, fontSize: 68, lineHeight: 1.18, letterSpacing: -1.8, color: '#fff' }}>{b}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.5 }) => (
  <Sequence from={sec(at)}><Audio src={staticFile(`sfx/${src}.wav`)} volume={v * 0.8} /></Sequence>
);

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  const strong = (f >= sec(S.open) && f < sec(S.door)) || (f >= sec(S.close) && f < sec(S.load)) || (f >= sec(S.move) && f < sec(S.things)) || (f >= sec(S.keyPage) && f < sec(S.phone)) || (f >= sec(S.s3) && f < sec(S.card));
  const shaded = f < sec(S.black) || (f >= sec(S.s1) && f < sec(S.card)) || f >= sec(S.end);
  // 말 아래 배경음 — 문이 열린 뒤 깔고, 쿵에서 뚝 끊고, 날짜에서 다시, 끝 대사 앞에서 줄인다
  const bgm = interpolate(f, [sec(S.close - 0.1), sec(S.close + 0.3), sec(S.black) - 1, sec(S.black), sec(S.date), sec(S.date + 0.2), sec(S.end - 0.2), sec(S.end + 0.2), sec(S.total - 0.5), sec(S.total)], [0, 0.15, 0.15, 0, 0, 0.15, 0.15, 0.08, 0.08, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#0b0b0b' }}>
      {/* 0.0 · 0.4 · 1.0 — 액자, 손수건을 짚고 전체로 */}
      {seq(S.ribbon, S.hand, <Plate src="a" start={0} z={2.6} origin="84% 62%" />)}
      {seq(S.hand, S.wide, <Plate src="a" start={0.4} z={2.5} origin="46% 66%" />)}
      {seq(S.wide, S.open, <Plate src="a" start={1.0} z={1.3} origin="50% 92%" />)}
      {/* 실제 도움말 — 첫 쪽이 스크롤 */}
      {seq(S.open, S.door, <Page src="help_top" from={0} to={420} dur={40} />)}
      {/* 반전 — 문이 열림 · 대사 · 굳은 조문객(장면 심사 v0 「대사 뒤 굳은 얼굴 한 박자」) */}
      {seq(S.door, S.line, <Plate src="b" start={0} z={1.5} origin="52% 88%" />)}
      {seq(S.line, S.react, <Plate src="c" start={0.2} />)}
      {seq(S.react, S.close, <Plate src="b" start={3.2} z={2.15} origin="50% 66%" />)}
      {/* 닫히는 건 사이트 — 실제 줄 → 원문 그대로 크게 */}
      {seq(S.close, S.load, <Page src="help_top" from={420} to={420} hi={[765, 1135]} qa={0.45} quote="The standalone Claude Design site … will close on December 14, 2026" />)}
      {/* 디자인은 직접 옮긴다 — 짐 싣기 → 실제 줄 */}
      {seq(S.load, S.move, <Plate src="f" start={0.3} />)}
      {seq(S.move, S.things, <Page src="help_top2" from={250} to={270} dur={40} hi={[600, 690]} qa={0.4} quote="Move your design systems now." />)}
      {/* 못 넣는 셋 — 문 앞에 남은 물건(볼 이유 심사 답 4) */}
      {seq(S.things, S.chats, <Plate src="g" start={0} />)}
      {seq(S.chats, S.comments, <Plate src="g" start={2.4} z={1.7} origin="10% 82%" />)}
      {seq(S.comments, S.key, <Plate src="g" start={3.0} z={1.6} origin="48% 44%" />)}
      {seq(S.key, S.keyPage, <Plate src="g" start={3.6} z={2.1} origin="72% 84%" />)}
      {seq(S.keyPage, S.phone, <Page src="help_carry" from={0} to={0} hi={[640, 770]} />)}
      {/* 손해 — 전화 */}
      {seq(S.phone, S.black, <Plate src="d" start={0.3} />)}
      {/* 날짜 뒤집기 */}
      {seq(S.date, S.s1, <DateCard />)}
      {/* 세 단계 — 조문객이 경건하게 건넴(볼 이유 심사 v2 답 4) · 실제 줄 */}
      {seq(S.s1, S.s2, <Plate src="h" start={0.4} />)}
      {seq(S.s2, S.s3, <Plate src="h" start={4.4} />)}
      {seq(S.s3, S.card, <Page src="help_share" from={520} to={520} hi={[930, 1300]} />)}
      {seq(S.card, S.end, <SaveCard />)}
      {/* 끝 — 화환을 가져가는 조문객 */}
      {seq(S.end, S.total, <Plate src="e" start={0.2} />)}

      {shaded ? <Shade strong={strong} /> : null}

      <T meta="AI로 시안 만드는 도구" lines={['클로드 디자인이', '12월에 없어진대요']} from={0} to={S.open} size={96} still />
      <T lines={['공식 안내문을', '열어 보니']} from={S.open} to={S.door} />
      <T lines={['저희…', '이사 가는데요?']} from={S.line} to={S.react} />
      <T lines={['닫히는 건', '사이트뿐이에요']} from={S.close} to={S.load} />
      <T lines={['디자인은', '직접 옮기면 돼요']} from={S.load} to={S.things} />
      <T lines={['근데 이삿짐에', '못 넣는 게 셋']} from={S.things} to={S.chats} />
      <T lines={['채팅']} from={S.chats} to={S.comments} />
      <T lines={['댓글']} from={S.comments} to={S.key} />
      <T lines={['그리고', '공개 링크']} from={S.key} to={S.phone} />
      <T lines={['거래처에 보낸 링크가', '그날부터 안 열려요']} from={S.phone} to={S.black} size={84} />
      <T meta="1" lines={['보낸 링크는 적어 뒀다가', '새 링크로 다시 보내고']} from={S.s1} to={S.s2} size={80} />
      <T meta="2" lines={['남길 말은', '복사하고']} from={S.s2} to={S.s3} />
      <T meta="3" lines={['프로젝트는', '파일로 받아 두고']} from={S.s3} to={S.card} />
      <T lines={['그리고 화환은…', '가져가 주세요']} from={S.end + 0.3} to={S.total} />

      <Small text="AI로 만든 재연이에요" from={S.wide} to={S.open} />
      <Src from={S.open} to={S.door} />
      <Src from={S.close} to={S.load} />
      <Src from={S.move} to={S.things} />
      <Src from={S.keyPage} to={S.phone} />
      <Small text="SYNK 브리핑" from={S.end} to={S.total} right />

      {/* 소리 */}
      <Sequence from={0} durationInFrames={sec(S.open)}><Audio src={staticFile('plate/a.wav')} volume={0.8} /></Sequence>
      <Sequence from={sec(S.door)} durationInFrames={sec(S.line - S.door)}><Audio src={staticFile('plate/b.wav')} volume={0.9} /></Sequence>
      <Sequence from={sec(S.line)} durationInFrames={sec(S.close - S.line)}><Audio src={staticFile('plate/c.wav')} startFrom={sec(0.2)} volume={0.95} /></Sequence>
      <Sequence from={sec(S.end)} durationInFrames={sec(S.total - S.end)}><Audio src={staticFile('plate/e.wav')} startFrom={sec(0.2)} volume={0.95} /></Sequence>
      <Audio src={staticFile('bgm.wav')} volume={() => bgm * 0.8} />
      <Sfx at={S.black - 0.02} src="thud" v={0.8} />
      <Sfx at={S.date} src="hand" v={0.35} />
      <Sfx at={S.chats} src="tok" v={0.3} />
      <Sfx at={S.comments} src="tok" v={0.3} />
      <Sfx at={S.key} src="tok" v={0.35} />
      <Sfx at={S.s1} src="tok" v={0.3} />
      <Sfx at={S.s2} src="tok" v={0.3} />
      <Sfx at={S.s3} src="tok" v={0.3} />
      <Sfx at={S.card} src="snap" v={0.3} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.8} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
