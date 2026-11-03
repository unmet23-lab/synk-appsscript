// synkbrief B22 v2(11-03 밤) — 같은 말 · 소리 · 장면에 겉만 「화면 결」로 다시 입힌 판(본보기 synkbrief_요금제질문셋_20261103 FilmV2).
// 유호님 11-03 「누가봐도 ai 슬롭」 → 「응, 둘 다」 — 옛 판의 알약 표시 · 검은 자막 상자 · 점선 말풍선 카드 · 노란 형광 상자 · 빨간 줄 · 빨간 꼬리표를 뺐다.
// 결: 장면을 조금 내리고 위는 같은 장면을 뒤집어 흐리게 · 위 그늘 위 큰 글자가 곧 말(누가 한 말인지는 위 작은 회색 줄) ·
// 검정 · 흰 + 버터 한 곳(「손님 눈으로 읽어 줘」) · 실제 답 화면은 짚는 두 줄 밖을 어둡게 · SUIT 하나 · 마침표 없음 · 안전선 안.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import { S, TOTAL, Shot } from './Film';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);
const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

const BUTTER = '#F5C445';
const GREY = '#A3A3A3';
const X = 74;
const TOP = 284;

// 안내문이 화면 아래쪽에 있어 조금만(160px) 내린다
const Lowered: React.FC<{ d?: number; children: React.ReactNode }> = ({ d = 160, children }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b0b0b' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scaleY(-1)`, transformOrigin: '50% 0%', filter: 'blur(26px) brightness(0.55)' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${d}px) scale(${z})`, transformOrigin: '50% 40%' }}>{children}</div>
    </AbsoluteFill>
  );
};
type Crop = { s: number; cx: number; cy: number; ay?: number };
const Cut: React.FC<{ src: string; start: number; crop: Crop; drift?: number }> = (p) => <Lowered><Shot {...p} /></Lowered>;

const Shade: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.92) 0px, rgba(10,10,10,0.8) 470px, rgba(10,10,10,0.34) 760px, rgba(10,10,10,0) 940px)' }} />
);

const T: React.FC<{ lines: React.ReactNode[]; from: number; to: number; size?: number; meta?: string; below?: React.ReactNode; still?: boolean; soft?: boolean }> = ({ lines, from, to, size = 92, meta, below, still, soft }) => {
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
        <div key={i} style={{ ...up(i + (meta ? 1 : 0)), fontWeight: soft ? 700 : 800, fontSize: size, lineHeight: 1.16, letterSpacing: -2.4, color: soft ? '#D6D6D6' : '#fff', wordBreak: 'keep-all' }}>{l}</div>
      ))}
      {below ? <div style={{ ...up(lines.length + 1), marginTop: 30 }}>{below}</div> : null}
    </div>
  );
};

const Small: React.FC<{ text: string; from: number; to: number; right?: boolean }> = ({ text, from, to, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const pos = right ? { right: 1080 - 920 } : { left: X };
  // 밝은 장면에서도 읽히게 아래쪽만 옅게 눌러 둔다(올리기 전 검사 「흰 기본 글자」)
  return <><div style={{ position: 'absolute', left: 0, right: 0, top: 1240, height: 240, background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.55))' }} /><div style={{ position: 'absolute', ...pos, top: 1372, fontFamily: KO, fontWeight: 700, fontSize: 34, color: 'rgba(255,255,255,0.9)', letterSpacing: -0.4, textShadow: '0 0 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.85), 0 1px 18px rgba(0,0,0,0.8)' }}>{text}</div></>;
};

// 보낸 요청(글은 실제로 보낸 그대로) — 점선 말풍선 · 노란 칠 대신 왼쪽 선 하나와 글
// 2.5초 동안 멈춰 보이지 않게(올리기 전 검사 정지 구간) 바탕은 천천히 다가가고 안내문 두 줄은 늦게 올라온다
const Prompt: React.FC = () => {
  const f = useCurrentFrame();
  const late = interpolate(f, [20, 30], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: '#0e0e0e', overflow: 'hidden' }}>
      <Img src={staticFile('img/밤.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(16px) brightness(0.38)', transform: `scale(${1.04 + f * 0.0012})` }} />
      <div style={{ position: 'absolute', left: X, width: 846, top: 300, fontFamily: KO, textShadow: '0 2px 14px rgba(0,0,0,0.55)', transform: `translateY(${-f * 0.35}px)` }}>
        <div style={{ fontWeight: 600, fontSize: 32, color: GREY, marginBottom: 26 }}>AI(ChatGPT)한테 이렇게 물었어요</div>
        <div style={{ borderLeft: '3px solid rgba(255,255,255,0.55)', paddingLeft: 28, fontSize: 64, fontWeight: 600, lineHeight: 1.38, letterSpacing: -1.4, color: '#EDEDED', wordBreak: 'keep-all' }}>
          우리 카페 계산대에 붙여 둔 안내문이야 <span style={{ fontWeight: 800, color: '#fff' }}>손님 눈으로 읽어 줘</span>
          <div style={{ height: 30 }} />
          <span style={{ color: '#BDBDBD', opacity: late, display: 'inline-block', transform: `translateY(${(1 - late) * 28}px)` }}>1인 1음료 필수!!!<br />음료 미주문 시 이용 불가</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 실제 답 화면 — 노란 상자 대신 짚는 두 줄(1088~1300 · 1494~1606) 밖을 어둡게
const Ans: React.FC = () => {
  const dim = (top: number, h: number) => <div style={{ position: 'absolute', left: 0, right: 0, top, height: h, background: 'rgba(0,0,0,0.62)' }} />;
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      <Img src={staticFile('img/ans.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
      {dim(0, 1088)}
      {dim(1300, 194)}
      {dim(1606, 314)}
    </AbsoluteFill>
  );
};

const Still: React.FC<{ src: string }> = ({ src }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#0e0e0e', overflow: 'hidden' }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, transform: `scale(${interpolate(f, [0, 8], [1.035, 1], { ...clamp, easing: EASE_OUT }) + f * 0.0002})` }} />
    </AbsoluteFill>
  );
};

// 실제 답(ChatGPT) 가운데 그 줄을 글로 — 맹검 둘이 「캡처 · 별표가 가장 싸 보인다」를 같이 짚어 캡처 대신(실제 화면은 블로그 그림 2)
const AnsText: React.FC = () => {
  const f = useCurrentFrame();
  const q = interpolate(f, [3, 12], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      <Img src={staticFile('img/밤.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(16px) brightness(0.38)' }} />
      <div style={{ position: 'absolute', left: X, width: 846, top: 720, fontFamily: KO, borderLeft: '3px solid rgba(255,255,255,0.55)', paddingLeft: 28, opacity: q, transform: `translateY(${(1 - q) * 28}px)` }}>
        <div style={{ fontWeight: 600, fontSize: 32, color: '#C8C8C8', marginBottom: 16 }}>ChatGPT 답 그대로</div>
        <div style={{ fontWeight: 600, fontSize: 56, lineHeight: 1.36, letterSpacing: -1.2, color: '#EDEDED', wordBreak: 'keep-all' }}>특히 “필수!!!”는 혼나는 듯한 느낌을 줄 수 있고, “이용 불가”는 손님을 거절하는 인상으로 다가올 수 있어요</div>
      </div>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ t: number; src: string; vol: number }> = ({ t, src, vol }) => (
  <Sequence from={sec(t)} durationInFrames={60}><Audio src={staticFile(src)} volume={vol} /></Sequence>
);
const Live: React.FC<{ from: number; to: number; src: string; start: number; vol: number }> = ({ from, to, src, start, vol }) => (
  <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>
    <Audio src={staticFile(src)} trimBefore={sec(start)} volume={vol} />
  </Sequence>
);

const WIDE = { s: 1.0, cx: 540, cy: 960 };

export const FilmV2: React.FC = () => {
  const bgm = (fr: number) => interpolate(fr + sec(8.6), [sec(8.6), sec(9.6), sec(S.quiet - 0.3), sec(S.quiet), sec(S.after), sec(S.after + 0.8), sec(S.total - 0.6), sec(S.total)],
    [0, 0.2, 0.2, 0.03, 0.03, 0.16, 0.16, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {seq(S.a, S.leave, <Cut src="img/A.mp4" start={1.0} crop={WIDE} drift={0.006} />)}
      {seq(S.leave, S.cake, <Cut src="img/K.mp4" start={0} crop={{ s: 1.0, cx: 550, cy: 1300, ay: 1180 }} drift={0.035} />)}
      {seq(S.cake, S.night, <Cut src="img/N.mp4" start={5.6} crop={{ s: 1.05, cx: 540, cy: 960 }} drift={0.006} />)}
      {seq(S.night, S.typed, <Cut src="img/N.mp4" start={0.2} crop={{ s: 1.25, cx: 540, cy: 720, ay: 820 }} />)}
      {seq(S.typed, S.ans, <Prompt />)}
      {seq(S.ans, S.big, <AnsText />)}
      {seq(S.big, S.face, <Still src="img/굳은얼굴.jpg" />)}
      {seq(S.face, S.quiet, <Cut src="img/N.mp4" start={1.6} crop={{ s: 1.6, cx: 540, cy: 560, ay: 640 }} drift={0.008} />)}
      {seq(S.quiet, S.after, <Cut src="img/N.mp4" start={4.0} crop={WIDE} drift={0.004} />)}
      {seq(S.after, S.closer, <Cut src="img/F.mp4" start={0} crop={WIDE} drift={0.004} />)}
      {seq(S.closer, S.end, <Cut src="img/F.mp4" start={S.closer - S.after} crop={{ s: 1.2, cx: 540, cy: 820, ay: 860 }} drift={0.008} />)}
      {seq(S.end, S.total, <Cut src="img/F.mp4" start={S.end - S.after} crop={{ s: 1.12, cx: 540, cy: 980, ay: 960 }} drift={0.008} />)}
      {/* 그늘은 사람 장면 위에만 — 요청 · 답 화면은 제 바탕이 있다 */}
      {seq(S.a, S.typed, <Shade />)}
      {seq(S.ans, S.total, <Shade />)}

      <T meta="사장" lines={['저희 1인 1음료라서요']} from={0} to={2.4} size={84} still />
      <T meta="손님" soft lines={['…아, 그럼 됐어요']} from={3.8} to={vo('n00')} size={84} />
      <T lines={['규칙대로 말했을 뿐인데,', '손님은 케이크만', '두고 나갔어요']} from={vo('n00')} to={vo('n01') - 0.1} size={84} />
      <T meta="그날 밤" lines={['AI한테 딱 한 줄', <span style={{ color: BUTTER }}>「손님 눈으로 읽어 줘」</span>]} from={vo('n01')} to={S.typed} size={84} />
      <T lines={['「필수!!!」는 혼나는 느낌,', '「이용 불가」는 거절']} from={vo('n02')} to={S.big} size={68} />
      <T meta="AI(ChatGPT)가 손님 눈으로 읽은 답" lines={['「필수!!!」', '혼나는 듯한 느낌', '「이용 불가」', '거절하는 인상']} from={S.big} to={S.face} size={80} />
      <T meta="AI가 읽어 준 손님 마음" soft lines={['“사장님이', '좀 예민하신가?”']} from={S.face + 0.1} to={S.quiet} size={96} />
      <T meta="AI가 고쳐 준 안내문으로, 같은 순간 다시" lines={['규칙은 그대로,', '말투만 바꿨어요']} from={vo('n03')} to={S.after + 2.4} size={92} />
      <T meta="손님" soft lines={['아, 그럼 아메리카노', '두 잔이랑 이거요!']} from={S.after + 2.5} to={vo('q02')} size={84} />
      <T meta="손님 속마음" lines={['“여기 사장님,', '친절하시네”']} from={vo('q02')} to={S.total} size={100} />

      <Small text="AI로 지어낸 장면이에요" from={S.a} to={S.typed} />
      <Small text="SYNK 브리핑" from={S.total - 2.4} to={S.total} right />

      {['n00', 'n01', 'n02', 'q01', 'n03', 'q02'].map((id) => (
        <Sequence key={id} from={sec(vo(id))}><Audio src={staticFile(`vo/${id}.wav`)} volume={id === 'q01' || id === 'q02' ? 1.05 : 1} /></Sequence>
      ))}
      <Live from={S.a} to={2.3} src="img/A.mp4" start={0} vol={2.1} />
      <Live from={2.3} to={5.6} src="img/A.mp4" start={3.3} vol={2.1} />
      <Live from={S.leave} to={S.cake} src="img/K.mp4" start={0} vol={1.6} />
      <Live from={S.cake} to={S.night} src="img/N.mp4" start={5.6} vol={1.4} />
      <Live from={S.night} to={S.typed} src="img/N.mp4" start={0.2} vol={1.4} />
      <Live from={S.face} to={S.quiet} src="img/N.mp4" start={1.6} vol={1.4} />
      <Live from={S.quiet} to={S.after} src="img/N.mp4" start={4.0} vol={1.4} />
      <Live from={S.after} to={30.25} src="img/F.mp4" start={0} vol={1.5} />
      <Sfx t={S.typed + 0.05} src="sfx/tok.wav" vol={0.28} />
      <Sfx t={S.big} src="sfx/pop.wav" vol={0.22} />
      <Sequence from={sec(8.6)}><Audio src={staticFile('bgm.wav')} volume={(fr) => bgm(fr)} /></Sequence>
    </AbsoluteFill>
  );
};

export { TOTAL };
