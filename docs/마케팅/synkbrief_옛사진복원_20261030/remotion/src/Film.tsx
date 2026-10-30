// synkbrief B19 「엄마 옛날 사진」 본편(16.6초) — 제작 절차 「한 장면 먼저」 둘째 시험 편.
// 뼈대는 원본 nw3NFmZKShg(백년컬러 「AI 컬러로 되살아난」 13.5초): 0초 바랜 옛 사진 + 위 고정 제목 + 가운데 3 · 2 · 1(원본과 같은 실제 1.2 · 2.4초)
// → 3.6초 반전(사진이 녹아 살아남 — 원본과 같은 실제 초) → 끝 카드 없이 살아 움직이는 사진으로 끝. 원본은 반전 뒤 한 장면이지만 우리는 그 자리를 셋으로 나눈다:
// V1(「살아 움직이게 해 줘」만 — 크게 웃고 지어낸 목소리로 손님을 맞음) → 실제 Gemini 요청 화면 한 컷 → 같은 글을 크게 → 끝 3.6초 V2(「얼굴은 그대로, 살짝만」 — 얼굴 그대로).
// 「후」(엄마 얼굴 그대로 살아남)는 13.0초에 처음 보인다. 무대는 화면 가득 옛 사진(B16 · B18과 다름), 배경음은 「따뜻_118」(B16 「밝은_052」 · B18 「시티팝_147」과 다름).
// v2 · v6 시험관 넷이 「0~4초 멈춘 카운트다운」을 약한 자리로 짚어 v7부터 카운트다운 · 반전을 원본과 같은 실제 초로 당겼다(오마주.json 「다르게」 박자).
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);

export const S = { c2: 1.2, c1: 2.4, reveal: 3.6, screen: 10.4, big: 11.25, after: 13.6, end: 17.4 };
export const TOTAL = sec(S.end);
// V1 · V2는 Gemini가 만든 10초 영상(720×1280 → 1080×1920). 반전 자리에 V1 1.7초부터, 끝에 V2 0.4초부터.
export const V1_FROM = 1.7, V2_FROM = 0; // V2는 0.6배로 — v9 · v11 · v13 볼 이유 심사 · GPT 「끝 얼굴이 원래보다 둥글다」(미소가 커지기 전까지만)

// 위 고정 제목 — 원본처럼 처음부터 끝까지 그대로(얼굴을 가리지 않게 사진 위 간판 자리). v15부터 「예시 사진」임을 처음부터 밝힌다
// (볼 이유 심사 v2~v13 네 번 「12초에 『가상 인물』이 나오면 『엄마』 이야기가 가짜가 된다 — 진짜 사진이 아니면 틀부터」).
export const Title: React.FC = () => (
  // 원본처럼 위에 꽉 찬 어두운 띠 — 검사 ⑤-2가 글줄 상자를 판 둘레의 밝은 간판까지 넓게 잡아 「얼룩진 바탕 위 글자」로 읽었다(v14 · v16)
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300, background: 'rgba(12,11,10,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 22, paddingBottom: 34 }}>
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 60, letterSpacing: -1, color: '#fff' }}>엄마 옛날 사진, AI로 살린다면?</div>
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 60, letterSpacing: -1, color: '#ffc928' }}>예시 사진으로 해 봤다</div>
  </div>
);

// 가운데 카운트다운(원본 장치) — 숫자는 앞치마 자리(얼굴 아래)에
const Count: React.FC = () => {
  const f = useCurrentFrame();
  const n = f < sec(S.c2) ? 3 : f < sec(S.c1) ? 2 : 1;
  const at = n === 3 ? 0 : n === 2 ? sec(S.c2) : sec(S.c1);
  const p = interpolate(f, [at, at + 5], [1.35, 1], { ...clamp, easing: EASE_OUT });
  // v2 시험관 둘(sonnet · GPT)이 「무슨 카운트다운인지 모르겠다」 — 숫자 위에 이름표, v11 둘(sonnet · haiku)이 「왜 기다리는지」 → 「3초 뒤, 사진이 움직여요」
  return (
    <>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 985, display: 'flex', justifyContent: 'center' }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 50, color: '#fff', background: 'rgba(10,10,10,0.8)', padding: '6px 22px', borderRadius: 14 }}>3초 뒤, 사진이 움직여요</div>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1060, textAlign: 'center', fontFamily: KO, fontWeight: 900, fontSize: 260, color: '#fff', scale: `${p}`,
      textShadow: '0 0 4px rgba(0,0,0,0.75), 0 6px 18px rgba(0,0,0,0.55)' }}>
      {n}
    </div>
    </>
  );
};

// 「전」 옛 사진 — 숫자가 바뀔 때마다 한 단계씩 확 다가간다(원본 박자 1.2 · 2.4초). 끝 0.25초에 녹아 사라진다.
export const Before: React.FC<{ fadeAt: number }> = ({ fadeAt }) => {
  const f = useCurrentFrame();
  const step = f < sec(S.c2) ? 1.0 : f < sec(S.c1) ? 1.07 : 1.14;
  const drift = interpolate(f, [0, sec(S.reveal)], [0, 0.03], clamp);
  const o = interpolate(f, [fadeAt, fadeAt + 8], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Img src={staticFile('img/전.png')} style={{ width: 1080, height: 1920, transformOrigin: '540px 640px', scale: `${step + drift}` }} />
    </AbsoluteFill>
  );
};

// 화면 아래 자막 판(말과 같은 글만) — 얼굴을 가리지 않게 아래쪽
const Cap: React.FC<{ text: string; from: number; to: number; y?: number; color?: string; quote?: boolean }> = ({ text, from, to, y = 1430, color = '#fff', quote = false }) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [sec(from), sec(from) + 5], [0, 1], clamp), interpolate(f, [sec(to) - 4, sec(to)], [1, 0], clamp));
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: y, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: quote ? 46 : 60, lineHeight: 1.25, letterSpacing: -1, color, textAlign: 'center', wordBreak: 'keep-all',
        background: quote ? 'rgba(250,246,236,0.95)' : 'rgba(10,10,10,0.8)', padding: '12px 26px', borderRadius: 16, maxWidth: 940, ...(quote ? { color: '#2a1d10' } : {}) }}>
        {text}
      </div>
    </div>
  );
};

const Brand: React.FC = () => (
  <div style={{ position: 'absolute', left: 60, top: 1745, display: 'flex', gap: 12, alignItems: 'center' }}>
    <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 30, color: '#fff', background: 'rgba(10,10,10,0.72)', padding: '6px 16px', borderRadius: 999 }}>
      <span style={{ color: '#5d8bff' }}>●</span> SYNK 브리핑
    </div>
  </div>
);

// 「예시 사진은 AI로 만든 가상 인물」 표시 — v2 · v6 · v9 볼 이유 심사(감정이 식는다)와 v9 시험관 둘(haiku 「엄마 이야기와 어긋남」 · GPT 「작아서 못 읽음」) → v10부터 지시문 카드의 붙인 사진 옆에 크게(Screen 안).

// 실제 Gemini 요청 화면 한 컷(그대로, 0.55초) → 같은 글을 큰 카드로 다시 짠다(제작 절차 「실제 화면은 크게 다시 짜기」 — 글은 보낸 그대로).
// v2 · v6 시험관 넷이 「입력창 글씨가 작아 못 읽음」 · 「Argon」 · 「어느 도구인지 모름」 → 칩을 빼고, 도구 이름표와 큰 글로.
const PROMPT: [string, boolean][] = [['얼굴은 그대로', true], [' 두고, ', false], ['살짝', true], [' 웃으며 눈을 한 번 깜빡이는 정도로만 움직여 줘. 카메라는 고정.', false]];
const Screen: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: EASE_OUT });
  const bigAt = sec(S.big - S.screen);
  const q = interpolate(f, [bigAt - 15, bigAt + 15], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1) });
  const W = 1000, k = W / 658; // 요청_V2_글.png 658×190(실제 Gemini 입력창에서 붙인 사진과 지시문 두 줄만)
  const hl = (i: number) => interpolate(f, [bigAt + 8 + i * 8, bigAt + 16 + i * 8], [0, 1], { ...clamp, easing: EASE_OUT });
  let mark = 0;
  return (
    <AbsoluteFill style={{ background: '#1b1612' }}>
      <Img src={staticFile('img/전.png')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, filter: 'blur(22px) brightness(0.42)', scale: '1.1' }} />
      <Img src={staticFile('img/요청_V2_글.png')} style={{ position: 'absolute', left: 40, top: 760, width: W, height: 190 * k, borderRadius: 24, opacity: p * (1 - q), scale: `${1 + 0.06 * q}` }} />
      <div style={{ position: 'absolute', left: 44, right: 44, top: 560, opacity: q, translate: `0 ${(1 - q) * 30}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <Img src={staticFile('img/전.png')} style={{ width: 96, height: 170, objectFit: 'cover', borderRadius: 12, border: '3px solid rgba(250,246,236,0.9)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 54, color: '#fff', background: 'rgba(10,10,10,0.85)', padding: '8px 20px', borderRadius: 14, width: 'fit-content' }}>구글 제미나이 앱 · 동영상 만들기</div>
          </div>
        </div>
        <div style={{ fontFamily: KO, fontWeight: 700, fontSize: 66, lineHeight: 1.34, wordBreak: 'keep-all', letterSpacing: -1, color: '#1d1a16', background: 'rgba(250,246,236,0.97)', padding: '26px 34px', borderRadius: 26 }}>
          {PROMPT.map(([t, key], i) => {
            if (!key) return <span key={i}>{t}</span>;
            const w = hl(mark++);
            return <span key={i} style={{ fontWeight: 900, backgroundImage: 'linear-gradient(#ffd84a, #ffd84a)', backgroundRepeat: 'no-repeat', backgroundPosition: '0 88%', backgroundSize: `${w * 100}% 38%` }}>{t}</span>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 원래 사진 얼굴을 작은 창으로(장면 심사 v1 답 4 「반전을 말로만 전한다 — 원래 얼굴과 나란히」). 컷이 아니라 서서히 커지며 들어온다.
const Inset: React.FC<{ top?: number }> = ({ top = 960 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 9], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 56, top, width: 330, opacity: p, scale: `${0.85 + 0.15 * p}`, transformOrigin: '0 50%' }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 38, color: '#2a1d10', background: 'rgba(250,246,236,0.96)', padding: '4px 14px', borderRadius: '12px 12px 0 0', width: 'fit-content' }}>원래 사진</div>
      <Img src={staticFile('img/원래얼굴.png')} style={{ width: 330, height: 336, objectFit: 'cover', border: '6px solid rgba(250,246,236,0.96)', borderRadius: '0 14px 14px 14px', display: 'block' }} />
    </div>
  );
};

const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at;

// 끝 — V2(얼굴 그대로)에 천천히 다가가 엄마 얼굴을 오래 잡는다(v2 볼 이유 심사 「끝은 엄마다운 눈빛 하나를 가까이 오래」)
const PushIn: React.FC = () => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 30, TOTAL - sec(S.after)], [1, 1.4, 1.6], { ...clamp, easing: Easing.bezier(0.33, 0, 0.67, 1) });
  // 원래 사진(전.png)과 V2 프레임은 얼굴 자리가 같다(눈 · 입이 몇 px 안) — 얼굴로 다가간 뒤(1.4초) 원래 사진을 같은 자리에 겹쳤다가 2.3초에 다시 V2로(v11 볼 이유 심사 「같은 자리에서 겹쳐 바꿔 같은 얼굴임을」)
  const o = interpolate(f, [30, 38, 58, 66], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ transformOrigin: '540px 640px', scale: `${s}` }}>
      <OffthreadVideo src={staticFile('img/V2.mp4')} startFrom={sec(V2_FROM)} playbackRate={0.6} style={{ width: 1080, height: 1920 }} volume={0.6} />
      <Img src={staticFile('img/전.png')} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920, opacity: o }} />
      <div style={{ position: 'absolute', left: 340, top: 500, opacity: o, fontFamily: KO, fontWeight: 800, fontSize: 52, color: '#2a1d10', background: 'rgba(250,246,236,0.96)', padding: '4px 18px', borderRadius: 12, scale: `${1 / s}`, transformOrigin: '0 0' }}>원래 사진</div>
    </AbsoluteFill>
  );
};

export const Film: React.FC = () => {
  // V1 소리(지어낸 목소리)는 해설 v02 직전에 낮춘다
  const v1Vol = (x: number) => interpolate(x, [0, sec(7.65 - S.reveal), sec(7.95 - S.reveal)], [1, 1, 0.12], clamp);
  const music = (x: number) => interpolate(x, [0, sec(S.reveal), sec(S.reveal) + 6, sec(S.after), sec(S.after) + 12], [0.16, 0.16, 0.07, 0.07, 0.3], clamp);
  return (
    <AbsoluteFill style={{ background: '#1b1612' }}>
      {/* 4.8초부터 V1 — 전 사진 아래에서 이미 돌고, 전이 0.25초에 녹아 사라진다 */}
      <Sequence from={sec(S.reveal) - 8} durationInFrames={sec(S.screen - S.reveal) + 8}>
        {/* V1 첫 부분은 인화지 흰 테두리가 아래 · 오른쪽에 보여 1.08배로 가린다(v15 haiku 「4초 흰 배경으로 바뀐다」) */}
        <OffthreadVideo src={staticFile('img/V1.mp4')} startFrom={sec(V1_FROM) - 8} style={{ width: 1080, height: 1920, transformOrigin: '540px 760px', scale: '1.08' }} volume={(x) => v1Vol(x - 8)} />
      </Sequence>
      <Sequence from={0} durationInFrames={sec(S.reveal) + 1}>
        <Before fadeAt={sec(S.reveal) - 8} />
        <Count />
      </Sequence>
      <Sequence from={sec(S.screen)} durationInFrames={sec(S.after - S.screen)}>
        <Screen />
      </Sequence>
      <Sequence from={sec(S.after)} durationInFrames={TOTAL - sec(S.after)}>
        <PushIn />
      </Sequence>
      {/* 「원래 사진」 창은 v02보다 먼저 — v13 시험관 셋이 「8초 『엄마가 아니에요』가 얼굴인지 목소리인지」 */}
      <Sequence from={vo('v02') - 9} durationInFrames={sec(S.screen) - vo('v02') + 9}>
        <Inset />
      </Sequence>

      <Title />
      {/* V1이 하는 말(지어낸 목소리) — 소리 없이 보는 사람도 「말까지 한다」를 알게 */}
      <Cap text="「어서 오세요.」" from={3.8} to={5.0} quote y={1500} />
      <Cap text="「날씨가 많이 춥죠? 얼른 들어와요.」" from={5.0} to={7.75} quote y={1500} />
      <Cap text="근데… 얼굴이, 우리 엄마가 아니에요." from={vo('v02') / 30} to={S.screen} />
      <Cap text="얼굴은 그대로, 살짝만." from={vo('v03') / 30} to={S.after + 0.3} color="#ffd84a" y={1330} />
      <Cap text="이제야, 우리 엄마예요." from={vo('v04') / 30} to={S.end} />
      <Brand />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}>
          <Audio src={staticFile(`vo/${c.id}.wav`)} />
        </Sequence>
      ))}
      {[0, sec(S.c2), sec(S.c1)].map((t) => (
        <Sequence key={t} from={t} durationInFrames={20}>
          <Audio src={staticFile('sfx/tick.wav')} volume={0.35} />
        </Sequence>
      ))}
      <Sequence from={sec(S.reveal) - 6} durationInFrames={30}>
        <Audio src={staticFile('sfx/swish.wav')} volume={0.3} />
      </Sequence>
      <Audio src={staticFile('bgm.mp3')} volume={music} />
    </AbsoluteFill>
  );
};
