// synkbrief B22 「안내문 한 줄」 본편(32.9초) — 제작 절차 「한 장면 먼저」 다섯째 편.
// 뼈대는 원본 lmy-SIrQhiU(인생24 「텀블러 3개 내밀며 반말 깠다가 털린 손님」 33.0초 · 23.6만 · 평소의 12.8배):
//   0~10초 카운터 갈등 한 구도 → 10초 넓은 그림 → 13.8초 음악 끼움으로 숨 끊기(14.4 박자) → 16.9초 직원이 규칙으로 되받기 →
//   18.0 · 19.4초 펀치 · 굳는 얼굴 → 21.8초 1초 정적 → 22.9초 정리 → 30.5초 직원 얼굴 한 컷 「다음 손님 오세요」로 끝.
// 우리는 같은 자리에: 「필수!!!」를 가리키는 손가락 · 굳는 손님(심사를 넘은 장면) → 6.7초 손님이 나가고 → 10초 케이크와 안내문만 남음 →
//   13.8초 그날 밤 → 14.4초 실제 ChatGPT 화면 「손님 눈으로 읽어 줘」 → 16.9초 실제 답 → 18초 그 답을 크게 → 19.4초 「사장님이 좀 예민하신가?」에 굳는 사장 →
//   21.8초 정적 → 22.9초 다음 날 같은 구도, 바뀐 안내문을 읽은 손님이 웃으며 음료를 더한다 → 30.5초 같은 장면 가까이로 끝(끝 카드 없음).
// 컷 · 박자는 원본 초 그대로(길이 거의 같음). 무대는 낡은 동네 카페 계산대, 소리는 13.8초까지 음악 없이 → 따뜻한 곡(B19 뒤 처음) — B20 · B21과 다르다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);

export const S = {
  a: 0, leave: 4.0, cake: 10.0, closer: 26.2, night: 13.8, typed: 14.4, ans: 16.9, big: 18.0, face: 19.4, quiet: 21.8,
  after: 22.9, end: 30.4, total: 32.9,
};
export const TOTAL = sec(S.total);

const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at;

// 한 컷: 1080×1920 영상의 (cx, cy)를 화면 (540, ay)에 두고 s배 — 넘치는 쪽은 가장자리에 맞춘다
type Crop = { s: number; cx: number; cy: number; ay?: number };
export const Shot: React.FC<{ src: string; start: number; crop: Crop; drift?: number }> = ({ src, start, crop, drift = 0.012 }) => {
  const f = useCurrentFrame();
  const s = crop.s * (1 + (f / 30) * drift);
  const ay = crop.ay ?? 960;
  const x = Math.min(0, Math.max(1080 - 1080 * s, 540 - crop.cx * s));
  const y = Math.min(0, Math.max(1920 - 1920 * s, ay - crop.cy * s));
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <OffthreadVideo muted src={staticFile(src)} startFrom={sec(start)}
        style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${s})` }} />
    </AbsoluteFill>
  );
};

// 아래 자막(말과 같은 글) — 사장 · 손님 말은 흰 글, 해설 끝 줄은 노랑. 판 위에 얹는다(흰 기본 글자 없음)
const Cap: React.FC<{ text: React.ReactNode; from: number; to: number; y?: number; color?: string; size?: number; who?: string; label?: string; fadeOut?: number; fadeIn?: number }> = ({ text, from, to, y = 1075, color = '#fff', size = 54, who, label, fadeOut = 3, fadeIn = 3 }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const o = Math.min(interpolate(f, [a, a + fadeIn], [0, 1], clamp), interpolate(f, [b - fadeOut, b], [1, 0], clamp));
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: y, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.28, letterSpacing: -1, color, textAlign: 'center', wordBreak: 'keep-all',
        background: 'rgba(12,12,12,0.94)', padding: '12px 26px', borderRadius: 16, maxWidth: 900 }}>
        {label ? <div style={{ fontSize: 32, fontWeight: 700, color: '#bdbdbd', letterSpacing: -0.3, marginBottom: 4 }}>{label}</div> : null}
        {who ? <span style={{ fontSize: 34, fontWeight: 700, color: '#bdbdbd', letterSpacing: -0.3, marginRight: 14 }}>{who}</span> : null}
        {text}
      </div>
    </div>
  );
};

const Pill: React.FC<{ text: string; from: number; to: number; y?: number; right?: boolean; big?: boolean }> = ({ text, from, to, y = 150, right, big }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  return (
    <div style={{ position: 'absolute', top: y, ...(right ? { right: 60 } : { left: 60 }) }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: big ? 50 : 36, color: big ? '#ffd84a' : '#fff', background: 'rgba(12,12,12,0.86)', padding: big ? '10px 24px' : '6px 18px', borderRadius: 12 }}>{text}</div>
    </div>
  );
};

export const Hl: React.FC<{ on: number; children: React.ReactNode; color?: string }> = ({ on, children, color = '#ffd84a' }) => {
  const f = useCurrentFrame();
  const w = interpolate(f, [sec(on), sec(on) + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  return <span style={{ fontWeight: 900, color: '#111', backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 50%', backgroundSize: `${w * 100}% 100%`, padding: '0 4px', borderRadius: 6 }}>{children}</span>;
};

// 보낸 요청을 크게 다시 짠 판 — 글은 실제로 보낸 요청 그대로(마지막 확인: 「말풍선 글이 작아 따라 칠 말인지 헷갈린다」 둘).
// 실제 화면은 바로 뒤 16.9초 답 화면 위쪽에 그대로 보인다.
const PromptCard: React.FC = () => (
  <AbsoluteFill style={{ background: '#0e0e0e' }}>
    {/* 바탕은 그날 밤 카페(최종 확인: 검은 화면에서 흐름이 끊긴다) */}
    <Img src={staticFile('img/밤.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(14px) brightness(0.45)' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 46, color: '#e6e6e6' }}>AI(ChatGPT)한테 이렇게 물었어요</div>
    <div style={{ position: 'absolute', left: 60, right: 60, top: 570, fontFamily: KO, color: '#f4f4f4', background: '#303030', border: '3px dashed #6a6a6a', borderRadius: 40,
      padding: '42px 46px', fontSize: 64, fontWeight: 700, lineHeight: 1.42, letterSpacing: -1.2, wordBreak: 'keep-all' }}>
      우리 카페 계산대에 붙여 둔 안내문이야. <span style={{ color: '#111', background: '#ffd84a', borderRadius: 8, padding: '0 6px' }}>손님 눈으로 읽어 줘.</span>
      <div style={{ height: 34 }} />
      1인 1음료 필수!!!<br />음료 미주문 시 이용 불가
    </div>
  </AbsoluteFill>
);

// 실제 답 화면(위쪽만 — 따로 제안한 안내문 칸은 넣지 않는다) · 그 줄에 형광펜
const Ans: React.FC = () => {
  const o = 0.55; // 처음부터 켠다(서서히 켜면 박자로 잡혀 원본 칸 수를 넘었다)
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      <Img src={staticFile('img/ans.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
      <div style={{ position: 'absolute', left: 22, width: 1036, top: 1088, height: 212, background: `rgba(255,216,74,${o * 0.3})`, border: `6px solid rgba(255,216,74,${o * 1.8})`, borderRadius: 14 }} />
      {/* AI가 고친 문구까지 같이 내 준 줄(「같은 규칙을 유지하면서 조금 더 부드럽게 쓰면 이렇게 할 수 있어요.」) — 최종 확인: 「고친 문구는 어디서 나왔나」 */}
      <div style={{ position: 'absolute', left: 22, width: 1036, top: 1494, height: 112, background: `rgba(255,216,74,${o * 0.3})`, border: `6px solid rgba(255,216,74,${o * 1.8})`, borderRadius: 14 }} />
    </AbsoluteFill>
  );
};

// 실제 안내문 위에 AI가 읽은 대로 줄을 긋는다 — 낱말은 실제 답 그대로(11-01 넷째 답 「혼나는 듯한 느낌」 · 「거절하는 인상」).
// 뒤는 같은 장면에서 손님 얼굴이 굳은 그림(판/굳은얼굴) — 볼 이유 심사 「글자가 손님의 굳는 얼굴로 바뀌는 한 장면」. 줄 · 이름표는 첫 장면부터(18.0초 찍힘이 비지 않게)
const SignNote: React.FC = () => {
  const strike = (x0: number, x1: number, y: number) => (
    <div style={{ position: 'absolute', left: x0, top: y - 9, width: x1 - x0, height: 18, background: '#e5322d', borderRadius: 9, transform: 'rotate(-2deg)', transformOrigin: '0 50%', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }} />
  );
  const tag: React.CSSProperties = { position: 'absolute', fontFamily: KO, fontWeight: 900, fontSize: 50, letterSpacing: -1.5, color: '#fff', background: '#e5322d', padding: '6px 22px', borderRadius: 14, whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' };
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      <Img src={staticFile('img/굳은얼굴.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 285, display: 'flex', justifyContent: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 44, color: '#fff', background: 'rgba(12,12,12,0.86)', padding: '8px 24px', borderRadius: 12 }}>AI(ChatGPT)가 손님 눈으로 읽은 답</div>
      </div>
      {strike(596, 944, 1232)}
      {strike(686, 904, 1386)}
      {/* 최종 시험: 이름표 뜻이 소리를 들어야 들어온다(sonnet) · 판단이 어디서 나왔나(haiku) → 어느 낱말이 어떻게 읽혔는지 이름표에 */}
      <div style={{ ...tag, right: 170, top: 1050 }}>「필수!!!」는 혼나는 듯한 느낌</div>
      <div style={{ ...tag, right: 170, top: 1462 }}>「이용 불가」는 거절하는 인상</div>
    </AbsoluteFill>
  );
};

// (앞 판) 같은 답을 크게 다시 짠 글 판 — 18초가 흐린 검은 화면으로 찍혀 쓰지 않는다
export const Big: React.FC = () => {
  const f = useCurrentFrame();
  const q = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      <Img src={staticFile('img/ans.jpg')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(18px) brightness(0.4)' }} />
      <div style={{ position: 'absolute', left: 56, right: 56, top: 560, opacity: q, translate: `0 ${(1 - q) * 30}px`, fontFamily: KO, color: '#f2f2f2', background: '#212121',
        borderRadius: 28, padding: '40px 44px', fontSize: 66, fontWeight: 700, lineHeight: 1.45, letterSpacing: -1.2, wordBreak: 'keep-all' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#9a9a9a', marginBottom: 14 }}>AI가 손님 눈으로 읽은 답</div>
        특히 “필수!!!”는 <Hl on={0.15}>혼나는 듯한 느낌</Hl>을 줄 수 있고, “이용 불가”는 손님을 <Hl on={0.15}>거절하는 인상</Hl>으로 다가올 수 있어요.
      </div>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ t: number; src: string; vol: number }> = ({ t, src, vol }) => (
  <Sequence from={sec(t)} durationInFrames={60}><Audio src={staticFile(src)} volume={vol} /></Sequence>
);
// 동영상에 든 말 · 실내음을 그 컷 길이만큼
const Live: React.FC<{ from: number; to: number; src: string; start: number; vol: number }> = ({ from, to, src, start, vol }) => (
  <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>
    <Audio src={staticFile(src)} trimBefore={sec(start)} volume={vol} />
  </Sequence>
);

const WIDE = { s: 1.0, cx: 540, cy: 960 };

export const Film: React.FC = () => {
  // 따뜻한 곡: 13.8초 밤부터, 21.8~22.9초 정적에서 거의 빼고, 다음 날 다시(곡은 13.8초에 0초부터 시작)
  const bgm = (fr: number) => interpolate(fr + sec(8.6), [sec(8.6), sec(9.6), sec(S.quiet - 0.3), sec(S.quiet), sec(S.after), sec(S.after + 0.8), sec(S.total - 0.6), sec(S.total)],
    [0, 0.2, 0.2, 0.03, 0.03, 0.16, 0.16, 0], clamp);
  const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* 심사를 넘은 장면 — 「필수!!!」를 가리키는 손가락, 굳는 손님, 안내문 옆에 내려놓는 케이크 */}
      {/* 셋째 볼 이유 심사: 0~1.5초 웃는 손님이 광고처럼 보인다 → A 1.0초(손가락이 안내문을 가리키고 웃음이 꺼지기 시작)부터 */}
      {seq(S.a, S.leave, <Shot src="img/A.mp4" start={1.0} crop={WIDE} drift={0.006} />)}
      {/* 손님이 나간다 → 케이크와 안내문만 남는다(장면 심사 ④) */}
      {/* 4~10초 늘어진다(GPT 판마다 · haiku 마지막 확인) → 6초 동안 남은 케이크와 안내문 쪽으로 천천히 다가간다(장면 심사 ④). 컷은 더하지 않는다(원본 칸 수) */}
      {seq(S.leave, S.cake, <Shot src="img/K.mp4" start={0} crop={{ s: 1.0, cx: 550, cy: 1300, ay: 1180 }} drift={0.035} />)}
      {/* 그날 밤 — 사장이 안내문을 내려다본다(둘째 시험: 6~12초 같은 안내문 · 빈 가게가 늘어진다 → 밤으로 일찍 넘긴다) */}
      {seq(S.cake, S.night, <Shot src="img/N.mp4" start={5.6} crop={{ s: 1.05, cx: 540, cy: 960 }} drift={0.006} />)}
      {/* 그날 밤 */}
      {seq(S.night, S.typed, <Shot src="img/N.mp4" start={0.2} crop={{ s: 1.25, cx: 540, cy: 720, ay: 820 }} />)}
      {seq(S.typed, S.ans, <PromptCard />)}
      {seq(S.ans, S.big, <Ans />)}
      {seq(S.big, S.face, <SignNote />)}
      {seq(S.face, S.quiet, <Shot src="img/N.mp4" start={1.6} crop={{ s: 1.6, cx: 540, cy: 560, ay: 640 }} drift={0.008} />)}
      {seq(S.quiet, S.after, <Shot src="img/N.mp4" start={4.0} crop={WIDE} drift={0.004} />)}
      {/* 처음부터 이 안내문이었다면 — 같은 구도로 다시(둘째 시험: 「같은 손님이 왜 다시 왔나」 → 다시 그 순간으로 보이게). 안내문은 AI가 낸 문구 두 줄 */}
      {seq(S.after, S.closer, <Shot src="img/F.mp4" start={0} crop={WIDE} drift={0.004} />)}
      {/* 올리기 전 검사 ⑬(같은 구성 6.5초) · 볼 이유 「후 장면이 길다」 → 웃는 순간 가까이 */}
      {seq(S.closer, S.end, <Shot src="img/F.mp4" start={S.closer - S.after} crop={{ s: 1.2, cx: 540, cy: 820, ay: 860 }} drift={0.008} />)}
      {seq(S.end, S.total, <Shot src="img/F.mp4" start={S.end - S.after} crop={{ s: 1.12, cx: 540, cy: 980, ay: 960 }} drift={0.008} />)}

      {/* 「재연」이 무슨 뜻인지 · 실제인지 연출인지(시험관 둘이 세 번 짚음) → 쉬운 말로 */}
      <Pill text="AI로 지어낸 장면이에요" from={S.a} to={S.cake} y={285} />
      {/* 셋째 시험: 「AI가 써 줬나 사장이 고쳤나」(둘) · 노란 질문형 머리 글이 지난 편과 같아 보임(haiku) → 흰 알림 글로 */}
      <Pill text="AI가 고쳐 준 안내문으로, 같은 순간 다시" from={S.after} to={S.end} y={285} />
      <Pill text="SYNK 브리핑" from={S.end} to={S.total} y={285} />

      <Cap who="사장" text="저희 1인 1음료라서요." from={0.05} to={2.4} y={1530} />
      <Cap who="손님" text="…아, 그럼 됐어요." from={3.8} to={5.6} y={1530} />
      <Cap text="규칙대로 말했을 뿐인데, 손님은 케이크만 두고 나갔어요." from={vo('n00') / 30} to={vo('n01') / 30 - 0.1} y={700} fadeIn={15} />
      <Cap text={<>그날 밤, AI한테 딱 한 줄<br /><span style={{ color: '#ffd84a' }}>「손님 눈으로 읽어 줘」</span></>} from={vo('n01') / 30} to={S.typed} y={250} />
      <Cap text="「필수!!!」는 혼나는 느낌, 「이용 불가」는 거절" from={vo('n02') / 30} to={S.big} y={250} />
      <Cap label="AI가 읽어 준 손님 마음" text={<span style={{ color: '#ffd84a' }}>“사장님이 좀 예민하신가?”</span>} from={S.face + 0.1} to={S.quiet} y={1240} size={64} />
      <Cap text="규칙은 그대로, 말투만 바꿨어요." from={vo('n03') / 30} to={S.after + 1.4} y={1530} fadeOut={12} />
      {/* 새 안내문(이 편의 보상)을 가리지 않게 손과 안내문 사이 띠에 */}
      <Cap who="손님" text="아, 그럼 아메리카노 두 잔이랑 이거요!" from={S.after + 2.5} to={S.end} y={935} size={50} fadeIn={12} />
      {/* 끝은 원본처럼 한마디로 — 20초 「사장님이 좀 예민하신가?」를 되받는 손님 속마음(재연 · 지어낸 말이라 AI 표시 없이, 볼 이유 심사 제안) */}
      <Cap label="손님 속마음" text={<span style={{ color: '#ffd84a' }}>“여기 사장님, 친절하시네.”</span>} from={vo('q02') / 30} to={S.total} y={925} size={60} />

      {['n00', 'n01', 'n02', 'q01', 'n03', 'q02'].map((id) => (
        <Sequence key={id} from={vo(id)}><Audio src={staticFile(`vo/${id}.wav`)} volume={id === 'q01' || id === 'q02' ? 1.05 : 1} /></Sequence>
      ))}
      {/* 사장은 화면 밖 — 사장 말은 0초에, 손님 말부터는 화면과 맞춘 소리(A를 1.0초 늦게 시작) */}
      <Live from={S.a} to={2.3} src="img/A.mp4" start={0} vol={2.1} />
      <Live from={2.3} to={5.6} src="img/A.mp4" start={3.3} vol={2.1} />
      <Live from={S.leave} to={S.cake} src="img/K.mp4" start={0} vol={1.6} />
      <Live from={S.cake} to={S.night} src="img/N.mp4" start={5.6} vol={1.4} />
      <Live from={S.night} to={S.typed} src="img/N.mp4" start={0.2} vol={1.4} />
      <Live from={S.face} to={S.quiet} src="img/N.mp4" start={1.6} vol={1.4} />
      <Live from={S.quiet} to={S.after} src="img/N.mp4" start={4.0} vol={1.4} />
      {/* 다음 순간 소리는 사장의 「네, 감사합니다」 앞에서 끊는다(끝은 속마음 한마디) */}
      <Live from={S.after} to={30.25} src="img/F.mp4" start={0} vol={1.5} />
      <Sfx t={S.typed + 0.05} src="sfx/tok.wav" vol={0.28} />
      <Sfx t={S.big} src="sfx/pop.wav" vol={0.22} />
      <Sequence from={sec(8.6)}><Audio src={staticFile('bgm.wav')} volume={(fr) => bgm(fr)} /></Sequence>
    </AbsoluteFill>
  );
};
