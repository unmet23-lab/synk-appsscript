// synkbrief B23 「원문 그대로」 본편(41.2초) — 제작 절차 「한 장면 먼저」 여섯째 편(장면 심사 세 판 넘김 → 「매일 한 편」 2, v3 장면으로 키움).
// 뼈대는 원본 yR5A_aW6r4Q(Heap 「ChatGPT는 확신에 차서 거짓말한다」 56.4초 · 72.9만 · 평소의 10.3배)의 박자 × 0.72:
//   0초 「ChatGPT가 …」 주장 → 4.7초 빨간 「틀렸어!」 → 6.4~14.3초 설명 아이콘 퀵컷 → 14.3~27.8초 「지금 휴대폰 자판을 보세요」(직접 쳐 보기) →
//   27.8~37.1초 설명 → 37.1초 그 현상의 이름(반전) → 39~53초 돈이 걸린 실제 사례 → 53.4초 시청자를 가리키는 끝.
// 우리는 같은 자리에: 실제 ChatGPT 요약(최대 지원금 140만 원 · 굵은 「6개월 이내에 키오스크를 설치」) → 3.4초 빨간 줄 → 4.6~10.3초 같은 공문 ·
//   바뀐 줄 화면 셋 · 여덟 번 중 여섯 번 → 10.3~20초 확인 한 줄을 치는 실제 화면 · 보냄 · 진짜 줄 → 20~26.7초 두 줄 맞대기 · 원문 종이 ·
//   26.7초 사장님 얼굴로 끊어 들어감(반전) → 28~38.4초 공문과 휴대폰을 견주고 키오스크를 돌아보며 「폐업하면 돌려줘야 한다고?」 · 돈 카드 →
//   38.45초 끝 3초에 v3 장면(사장님 + 뒤집힌 두 줄)을 다시, 끝 카드 없음.
// 화면 글 · 값은 모두 실제 화면 그대로 자르고 키웠고(public/img — scripts/img.py), 우리가 쓴 글은 자막 · 꼬리표 · 여덟 번 표뿐이다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);

// 원본 박자 × 0.7307(우리 41.2초 ÷ 원본 56.38초 — 나란히가 재는 비율과 같게)
export const S = {
  a: 0, line: 0.95, man: 1.75, wrong: 3.43, scan: 4.68, l1: 5.77, flashP: 6.43, l3: 6.65, tally: 7.23, tally2: 8.4, blur: 9.35,
  key: 10.45, typing: 11.84, send: 17.32, prompt: 17.54, ans: 20.09, flip: 20.31, paper: 21.48, ai: 23.16, real: 25.14,
  turn: 27.11, w1: 27.33, p2: 27.47, w2: 27.69, p4: 27.84, wide: 28.5, card1: 30.69, kiosk: 30.98, mutter: 31.13, card: 32.81,
  worry: 34.85, f1: 36.75, f2: 36.9, f3: 37.05, end: 39.02, end2: 39.89, total: 41.2,
};
export const TOTAL = sec(S.total);

const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

// 영상 한 컷: 1080×1920으로 편 영상의 (cx, cy)를 화면 (540, ay)에 두고 s배
type Crop = { s: number; cx: number; cy: number; ay?: number };
const Vid: React.FC<{ src: string; start: number; crop: Crop; drift?: number; rate?: number; free?: boolean }> = ({ src, start, crop, drift = 0.01, rate = 1, free }) => {
  const f = useCurrentFrame();
  const s = crop.s * (1 + (f / 30) * drift);
  const ay = crop.ay ?? 960;
  const x = free ? 540 - crop.cx * s : Math.min(0, Math.max(1080 - 1080 * s, 540 - crop.cx * s));
  const y = free ? ay - crop.cy * s : Math.min(0, Math.max(1920 - 1920 * s, ay - crop.cy * s));
  return (
    <AbsoluteFill style={{ background: '#0e0e0e', overflow: 'hidden' }}>
      <OffthreadVideo muted src={staticFile(src)} startFrom={sec(start)} playbackRate={rate}
        style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${s})` }} />
    </AbsoluteFill>
  );
};

// 그림 한 컷: w×h 그림의 (cx, cy)를 화면 (540, ay)에 두고 s배, 천천히 다가감
const Pic: React.FC<{ src: string; w: number; h: number; s: number; cx: number; cy: number; ay?: number; drift?: number; bg?: string; children?: React.ReactNode }> = ({ src, w, h, s, cx, cy, ay = 960, drift = 0.012, bg = '#0e0e0e', children }) => {
  const f = useCurrentFrame();
  const z = s * (1 + (f / 30) * drift);
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540 - cx * z, top: ay - cy * z, width: w, height: h, transformOrigin: '0 0', transform: `scale(${z})` }}>
        <Img src={staticFile(src)} style={{ width: w, height: h, display: 'block' }} />
        {children}
      </div>
    </AbsoluteFill>
  );
};

// 자막(말과 같은 글) — 판 위에 얹는다(흰 기본 글자 없음)
const Cap: React.FC<{ text: React.ReactNode; from: number; to: number; y?: number; color?: string; size?: number; who?: string; fadeIn?: number; fadeOut?: number }> = ({ text, from, to, y = 1500, color = '#fff', size = 56, who, fadeIn = 3, fadeOut = 3 }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const o = Math.min(interpolate(f, [a, a + fadeIn], [0, 1], clamp), interpolate(f, [b - fadeOut, b], [1, 0], clamp));
  return (
    <div style={{ position: 'absolute', left: 54, right: 54, top: y, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.28, letterSpacing: -1, color, textAlign: 'center', wordBreak: 'keep-all',
        background: 'rgba(12,12,12,0.94)', padding: '12px 26px', borderRadius: 16, maxWidth: 940 }}>
        {who ? <span style={{ fontSize: 36, fontWeight: 700, color: '#bdbdbd', letterSpacing: -0.3, marginRight: 14 }}>{who}</span> : null}
        {text}
      </div>
    </div>
  );
};

// 꼬리표 — 무엇의 화면인지(장면 심사 셋 다 「누구 말인지」를 짚음)
const Tag: React.FC<{ text: string; from: number; to: number; y?: number; x?: number; tone?: 'ai' | 'real' | 'note' }> = ({ text, from, to, y = 230, x = 54, tone = 'note' }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const bg = tone === 'ai' ? '#e5322d' : tone === 'real' ? '#ffd84a' : 'rgba(12,12,12,0.86)';
  const fg = tone === 'real' ? '#111' : '#fff';
  return (
    <div style={{ position: 'absolute', top: y, left: x }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: tone === 'note' ? 36 : 46, color: fg, background: bg, padding: tone === 'note' ? '6px 18px' : '8px 22px', borderRadius: 12, letterSpacing: -1, boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }}>{text}</div>
    </div>
  );
};

// 빨간 줄 · 노란 형광(퍼센트 너비로 그어 나감)
const Strike: React.FC<{ on: number; x: number; y: number; w: number; t?: number }> = ({ on, x, y, w, t = 12 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [sec(on), sec(on) + 9], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', left: x, top: y - t / 2, width: w * p, height: t, background: '#e5322d', borderRadius: t / 2, boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }} />;
};
const Mark: React.FC<{ on: number; x: number; y: number; w: number; h: number }> = ({ on, x, y, w, h }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [sec(on), sec(on) + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', left: x, top: y, width: w * p, height: h, background: 'rgba(255,214,10,0.42)', borderRadius: 6 }} />;
};

// 두 줄 맞대기(장면 v2 · v3의 아래쪽) — 위 AI 요약 굵은 줄(빨간 줄) · 확인 질문 · 진짜 줄 두 덩이(노란 형광). top은 그 판의 위 끝
const Flip: React.FC<{ top: number; strikeAt: number; markAt: number; showAt?: number }> = ({ top, strikeAt, markAt, showAt = -1 }) => {
  const f = useCurrentFrame();
  const shown = f >= sec(showAt);
  return (
    <>
      <Img src={staticFile('img/line_ai_big.png')} style={{ position: 'absolute', left: 33, top: top + 70, width: 1014, height: 84 }} />
      <Strike on={strikeAt} x={33 + 27} y={top + 70 + 42} w={970} />
      <Img src={staticFile('img/q_bubble.png')} style={{ position: 'absolute', left: 300, top: top + 190, width: 680, height: 204, opacity: shown ? 1 : 0 }} />
      {shown ? <>
        <Img src={staticFile('img/ans_b1.png')} style={{ position: 'absolute', left: 64, top: top + 500, width: 690, height: 99 }} />
        <Img src={staticFile('img/ans_b2.png')} style={{ position: 'absolute', left: 64, top: top + 615, width: 952, height: 93 }} />
        <Mark on={markAt} x={64 + 11} y={top + 500} w={666} h={99} />
        <Mark on={markAt + 0.25} x={64 + 9} y={top + 615} w={680} h={93} />
      </> : null}
    </>
  );
};

// 여덟 번 표 — 같은 흐린 스캔 공문을 새 대화로 여덟 번(실제 결과: 기획.md 「결과 화면」)
const RUNS: { ok: boolean; t: string }[] = [
  // 시험관 둘(11-02 첫 렌더): 칸 글 「재판매 금지」 · 「폐업하면 반환」이 뜻이 안 선다 → 바뀌었나 / 그대로인가만
  { ok: false, t: '다른 조건' }, { ok: false, t: '다른 조건' }, { ok: false, t: '다른 조건' }, { ok: false, t: '다른 조건' },
  { ok: false, t: '다른 조건' }, { ok: true, t: '원문대로' }, { ok: true, t: '원문대로' }, { ok: false, t: '다른 조건' },
];
const Tally: React.FC<{ from: number; big?: boolean }> = ({ from, big }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#121212' }}>
      <div style={{ position: 'absolute', top: 360, left: 0, right: 0, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 52, color: '#e8e8e8', letterSpacing: -1.2 }}>같은 공문 · 새 대화 여덟 번</div>
      <div style={{ position: 'absolute', top: 470, left: 60, right: 60, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
        {RUNS.map((r, i) => {
          const o = interpolate(f, [sec(from) + i, sec(from) + i + 3], [0, 1], clamp);
          return (
            <div key={i} style={{ opacity: o, height: 250, borderRadius: 22, background: r.ok ? '#1d3b2a' : '#3d1614', border: `4px solid ${r.ok ? '#3fbf7a' : '#e5322d'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: KO, color: '#fff' }}>
              <div style={{ fontSize: 96, fontWeight: 900, color: r.ok ? '#3fbf7a' : '#ff5a4f', lineHeight: 1.05 }}>{r.ok ? '○' : '✕'}</div>
              <div style={{ fontSize: 34, fontWeight: 800, wordBreak: 'keep-all', textAlign: 'center' }}>{r.t}</div>
            </div>
          );
        })}
      </div>
      {big ? <div style={{ position: 'absolute', left: 0, right: 0, top: 1060, display: 'flex', justifyContent: 'center' }}>
        <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 88, color: '#fff', background: '#e5322d', padding: '10px 36px', borderRadius: 24, letterSpacing: -3 }}>여섯 번 다른 조건</div>
      </div> : null}
    </AbsoluteFill>
  );
};

// 확인 한 줄을 크게 다시 짠 판 — 글은 실제로 친 요청 그대로(장면 심사 v3 「회색 말풍선이 휴대폰에서 거의 안 읽힌다」)
const PromptCard: React.FC = () => {
  const f = useCurrentFrame();
  const q = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: EASE_OUT });
  // n08(14.57초 = 카드 0.37초) 「6개월 자리엔, 마감일이나 금액을 넣어도 돼요」의 낱말 시각에 맞춰 바꿔 끼운다
  const t = f / 30;
  const kw = t >= 2.75 ? "'6개월'" : t >= 2.0 ? "'만 원'" : t >= 1.41 ? "'마감'" : "'6개월'";
  const swapped = kw !== "'6개월'";
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      <Img src={staticFile('img/r2_top.png')} style={{ position: 'absolute', left: 0, top: -200, width: 1080, height: 2341, filter: 'blur(16px) brightness(0.4)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 520, textAlign: 'center', fontFamily: KO, fontWeight: 800, fontSize: 46, color: '#e6e6e6' }}>요약 뒤에 이렇게 한 줄</div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 620, opacity: q, translate: `0 ${(1 - q) * 28}px`, fontFamily: KO, color: '#f4f4f4', background: '#303030',
        border: '3px dashed #6a6a6a', borderRadius: 40, padding: '44px 46px', fontSize: 72, fontWeight: 800, lineHeight: 1.36, letterSpacing: -1.4, wordBreak: 'keep-all' }}>
        <span style={{ color: '#111', background: swapped ? '#7fe0a8' : '#ffd84a', borderRadius: 8, padding: '0 6px' }}>{kw}</span>이 나오는 줄을 <span style={{ color: '#111', background: '#ffd84a', borderRadius: 8, padding: '0 6px' }}>원문 그대로</span> 옮겨 줘.
      </div>
    </AbsoluteFill>
  );
};

// 돈 카드 아래 한 줄 — 원문 「사.」 줄의 뜻 그대로(시험관 haiku 「무엇을 돌려주는지 설명 없음」 · sonnet 「가격 화면이 뜬금없다」). 카드 그림 좌표(×1.9로 커진다)
const MoneyNote: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [6, 12], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 18, top: 336, width: 520, opacity: o, fontFamily: KO, fontWeight: 900, fontSize: 30, lineHeight: 1.3, letterSpacing: -0.8,
      color: '#fff', background: '#e5322d', borderRadius: 10, padding: '6px 14px' }}>
      6개월 안에 폐업하면<br />→ 이 지원금을 돌려줘야
    </div>
  );
};

// 종이 공문(시험에 쓴 흐린 스캔 — 지어낸 예시) — 「사.」 줄(760~823px)
const SCAN = { w: 1241, h: 1754 };
const ScanShot: React.FC<{ s: number; cy: number; ay?: number; markAt?: number }> = ({ s, cy, ay = 960, markAt }) => (
  <Pic src="img/scan_page.png" w={SCAN.w} h={SCAN.h} s={s} cx={620} cy={cy} ay={ay} drift={0.01} bg="#f2f2f2">
    {markAt !== undefined ? <>
      <Mark on={markAt} x={150} y={757} w={960} h={36} />
      <Mark on={markAt + 0.2} x={150} y={796} w={620} h={30} />
    </> : null}
  </Pic>
);

const Sfx: React.FC<{ t: number; src: string; vol: number }> = ({ t, src, vol }) => (
  <Sequence from={sec(t)} durationInFrames={60}><Audio src={staticFile(src)} volume={vol} /></Sequence>
);

const FACE = (s: number) => ({ s, cx: 470, cy: 560, ay: 820 });

export const Film: React.FC = () => {
  // 배경음: 처음부터 낮게 → 반전(27.11초)에서 빼고(가게 소리 · 중얼거림만) → 중얼거림 뒤 29.5초부터 다시 → 끝에서 사라짐
  const bgm = (fr: number) => interpolate(fr, [0, sec(0.4), sec(S.turn - 0.3), sec(S.turn), sec(29.5), sec(30.3), sec(S.total - 0.7), sec(S.total)],
    [0, 0.13, 0.13, 0.0, 0.0, 0.1, 0.1, 0], clamp);
  // 사장님 동영상(10초) 시간 나눔 — 같은 대목을 두 번 쓰지 않는다(끝 3초의 장면 되풀이만 빼고)
  const V = { wait: 0.0, react: 2.55, gaze: 4.23, mutter: 6.3 }; // 기다림 0~2.55 · 반응 2.55~4.23 · 키오스크 돌아봄 4.23~6.3 · 중얼거림 6.3~10
  const KIOSK = { s: 1.7, cx: 860, cy: 700, ay: 900 };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* 0초 — 실제 요약 화면의 「최대 지원금 140만 원」(장면 심사 셋: 걸린 돈 · 누구 말인지를 0.5초 안에) → 표 쪽으로 내려감 */}
      {seq(S.a, S.line, <Pic src="img/r2_top.png" w={1080} h={2341} s={1.0} cx={540} cy={640} ay={820} drift={0.015} />)}
      {seq(S.line, S.man, <Pic src="img/r2_top.png" w={1080} h={2341} s={1.0} cx={540} cy={1180} ay={860} drift={0.015} />)}
      {/* 굵은 줄 「6개월 이내에 키오스크를 설치해야」(R1) — 볼 이유 심사 「1.8초 사장님 컷은 장식」 → 요약 줄로 */}
      {seq(S.man, S.wrong, <Pic src="img/r1_bullets.png" w={1080} h={441} s={1.0} cx={540} cy={220} ay={860} drift={0.02} />)}
      {/* 빨간 줄 — 그 줄만 크게(「그런데 원문엔 이런 말이 없어요」) */}
      {seq(S.wrong, S.scan, <AbsoluteFill style={{ background: '#0e0e0e' }}>
        <Img src={staticFile('img/line_ai_big.png')} style={{ position: 'absolute', left: 33, top: 800, width: 1014, height: 84 }} />
        <Strike on={0.05} x={60} y={842} w={970} />
      </AbsoluteFill>)}
      {/* 같은 공문(흐린 스캔) → 바뀐 줄 화면 · 종이 · 바뀐 줄 → 여덟 번 표 → 흐린 글자 가까이(어두운 화면끼리는 컷으로 안 잡혀 사이에 흰 종이를 끼움) */}
      {/* 같은 공문 — 흐려도 읽히는 제목 쪽으로 키움(두 시험관이 두 번 「공문 글씨를 못 읽음」) */}
      {seq(S.scan, S.l1, <Pic src="img/scan_page.png" w={SCAN.w} h={SCAN.h} s={1.15} cx={620} cy={255} ay={860} drift={0.01} bg="#ffffff">
        {/* 제목만 — 작은 본문 글씨는 흰 종이로 덮는다(마지막 확인까지 두 시험관이 세 번 「공문 본문 글씨를 못 읽음」) */}
        <div style={{ position: 'absolute', left: 0, top: 318, width: SCAN.w, height: SCAN.h - 318, background: 'linear-gradient(rgba(255,255,255,0.7) 0, #ffffff 40px)' }} />
      </Pic>)}
      {/* 0.2초 종이 깜빡임은 뺀다(셋째 시험 전: sonnet 「깜빡이는 짧은 컷에서 넘김」) */}
      {seq(S.l1, S.flashP, <Pic src="img/line_R1.png" w={1080} h={385} s={1.0} cx={540} cy={190} ay={860} drift={0.02} />)}
      {seq(S.flashP, S.tally, <Pic src="img/line_R5.png" w={1080} h={502} s={1.0} cx={540} cy={250} ay={760} drift={0.02} />)}
      {seq(S.tally, S.tally2, <Tally from={0} />)}
      {seq(S.tally2, S.blur, <Tally from={-60} big />)}
      {seq(S.blur, S.key, <Pic src="img/line_R2.png" w={1080} h={502} s={1.0} cx={540} cy={250} ay={760} drift={0.015} />)}
      {/* 확인 한 줄 — 바뀐 줄(R2) 위에서 「한 줄이면 돼요」 → 실제 화면에서 치기(입력 칸 가까이, 2.4초) → 바꿔 넣을 낱말 카드 → 보냄 */}
      {seq(S.key, S.typing, <Vid src="img/type.mp4" start={0} crop={{ s: 1.0, cx: 540, cy: 1300, ay: 1000 }} free drift={0.0} rate={0.01} />)}
      {seq(S.typing, 14.2, <Vid src="img/type.mp4" start={0} crop={{ s: 1.35, cx: 440, cy: 1760, ay: 1000 }} free drift={0.0} rate={4.55 / (14.2 - S.typing)} />)}
      {seq(14.2, S.send, <PromptCard />)}
      {seq(S.send, S.prompt, <Vid src="img/type.mp4" start={4.55} crop={{ s: 1.0, cx: 540, cy: 1300, ay: 1000 }} free drift={0.0} />)}
      {/* 답을 기다리는 사장님(재연) — 사장님은 여기서 처음 나온다(볼 이유 심사 「반응은 원문이 드러날 때 바로」) */}
      {seq(S.prompt, S.ans, <Vid src="img/V1.mp4" start={V.wait} crop={FACE(1.35)} drift={0.01} />)}
      {seq(S.ans, S.flip, <Vid src="img/type.mp4" start={6.3} crop={{ s: 1.0, cx: 540, cy: 1100, ay: 860 }} free drift={0.0} />)}
      {/* 두 줄 맞대기 → 곧바로 사장님 반응(공문을 들어 휴대폰과 견줌) → 원문 종이의 그 줄 → 걸린 돈 */}
      {seq(S.flip, S.paper, <AbsoluteFill style={{ background: '#0e0e0e' }}><Flip top={330} strikeAt={0.1} markAt={0.35} /></AbsoluteFill>)}
      {seq(S.paper, S.ai, <Vid src="img/V1.mp4" start={V.react} crop={FACE(1.4)} drift={0.012} />)}
      {seq(S.ai, S.real, <Pic src="img/scan_page.png" w={SCAN.w} h={SCAN.h} s={1.0} cx={620} cy={792} ay={860} drift={0.01} bg="#ffffff">
        {/* 「사.」 두 줄(757~826px)만 남기고 흐리게 — 마지막 시험 두 시험관 「원문 본문 작은 글씨를 못 읽음」 */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: SCAN.w, height: 750, background: 'rgba(255,255,255,0.82)' }} />
        <div style={{ position: 'absolute', left: 0, top: 832, width: SCAN.w, height: SCAN.h - 832, background: 'rgba(255,255,255,0.82)' }} />
        <Mark on={0.15} x={150} y={757} w={960} h={36} />
        <Mark on={0.35} x={150} y={796} w={620} h={30} />
      </Pic>)}
      {seq(S.real, S.turn, <Pic src="img/ans_full.png" w={1080} h={197} s={1.0} cx={540} cy={98} ay={860} drift={0.015}>
        <Mark on={0.1} x={605} y={78} w={380} h={46} />
        <Mark on={0.3} x={30} y={145} w={380} h={46} />
      </Pic>)}
      {/* 반전(원본 37.1초) — 바로 사장님 한마디 「…폐업하면, 돌려줘야 한다고?」(동영상 6.3~10초를 그대로 이어서, 얼굴 → 키오스크 → 얼굴 가까이 → 얼굴) */}
      {seq(S.turn, S.p2, <Vid src="img/V1.mp4" start={V.mutter + (S.turn - S.turn)} crop={FACE(1.45)} drift={0.0} />)}
      {seq(S.p2, S.p4, <Vid src="img/V1.mp4" start={V.mutter + (S.p2 - S.turn)} crop={KIOSK} drift={0.0} />)}
      {seq(S.p4, S.wide, <Vid src="img/V1.mp4" start={V.mutter + (S.p4 - S.turn)} crop={FACE(2.0)} drift={0.005} />)}
      {seq(S.wide, S.card1, <Vid src="img/V1.mp4" start={V.mutter + (S.wide - S.turn)} crop={FACE(1.3)} drift={0.008} />)}
      {/* 「요약만 믿었다면」 — 요약 줄(빨간 줄) → 걸린 돈 → 키오스크를 돌아보는 사장님(동영상 4.2~6.3초) */}
      {seq(S.card1, S.card, <Pic src="img/r1_bullets.png" w={1080} h={441} s={1.0} cx={540} cy={220} ay={860} drift={0.015}><Strike on={0.05} x={372} y={196} w={645} t={10} /></Pic>)}
      {seq(S.card, S.worry, <Pic src="img/card.png" w={1028} h={323} s={1.9} cx={262} cy={150} ay={760} drift={0.015}><MoneyNote /></Pic>)}
      {seq(S.worry, S.f3, <Vid src="img/V1.mp4" start={V.gaze} crop={{ s: 1.25, cx: 700, cy: 640, ay: 900 }} drift={0.008} rate={(V.mutter - V.gaze) / (S.f3 - S.worry)} />)}
      {seq(S.f3, S.end, <ScanShot s={0.86} cy={760} ay={900} markAt={-1} />)}
      {/* 끝 3초 — v3 장면을 다시: 위 사장님(키오스크를 돌아봄 → 39.89초 얼굴 가까이) · 아래 뒤집힌 두 줄 */}
      {seq(S.end, S.total, <AbsoluteFill style={{ background: '#0e0e0e' }}>
        <Sequence durationInFrames={sec(S.end2) - sec(S.end)}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 800, overflow: 'hidden' }}>
            <OffthreadVideo muted src={staticFile('img/V1.mp4')} startFrom={sec(5.4)} playbackRate={0.7}
              style={{ position: 'absolute', left: -101, top: -230, width: 1215, height: 2160 }} />
          </div>
        </Sequence>
        <Sequence from={sec(S.end2) - sec(S.end)}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 800, overflow: 'hidden' }}>
            <OffthreadVideo muted src={staticFile('img/V1.mp4')} startFrom={sec(5.4 + (S.end2 - S.end) * 0.7)} playbackRate={0.7}
              style={{ position: 'absolute', left: -330, top: -420, width: 1215 * 1.45, height: 2160 * 1.45 }} />
          </div>
        </Sequence>
        <Flip top={760} strikeAt={-1} markAt={-1} />
      </AbsoluteFill>)}

      {/* 꼬리표 */}
      <Tag text="ChatGPT 요약" tone="ai" from={S.a} to={S.wrong} y={250} />
      <Tag text="ChatGPT 요약의 이 줄" tone="ai" from={S.wrong} to={S.scan} y={720} />
      <Tag text="지원금 최대 140만 원이 걸린 공문" tone="real" from={S.a} to={S.man} y={330} />
      <Tag text="올린 공문 — 흐릿한 스캔본(예시로 만든 것)" from={S.scan} to={S.l1} y={250} />
      <Tag text="ChatGPT 요약 · 다른 대화" tone="ai" from={S.l1} to={S.flashP} y={250} />
      <Tag text="ChatGPT 요약 · 또 다른 대화" tone="ai" from={S.flashP} to={S.tally} y={250} />
      <Tag text="ChatGPT 요약 · 또 다른 대화" tone="ai" from={S.blur} to={S.key} y={250} />
      <Tag text="요약을 믿고 키오스크를 들인 사장님 · AI 재연" from={S.prompt} to={S.ans} y={250} />
      <Tag text="ChatGPT 요약" tone="ai" from={S.flip} to={S.paper} y={250} />
      <Tag text="원문 그대로 옮긴 답" tone="real" from={S.flip} to={S.paper} y={330 + 420} />
      <Tag text="AI로 지어낸 장면이에요" from={S.paper} to={S.ai} y={250} />
      <Tag text="원문(예시로 만든 공문)" tone="real" from={S.ai} to={S.real} y={250} />
      <Tag text="원문 그대로 옮긴 답" tone="real" from={S.real} to={S.turn} y={250} />
      <Tag text="AI로 지어낸 장면이에요" from={S.turn} to={S.card1} y={250} />
      <Tag text="ChatGPT 요약" tone="ai" from={S.card1} to={S.card} y={250} />
      <Tag text="ChatGPT 요약 화면" tone="ai" from={S.card} to={S.worry} y={250} />
      <Tag text="AI로 지어낸 장면이에요" from={S.worry} to={S.f3} y={250} />
      <Tag text="원문(예시로 만든 공문)" tone="real" from={S.f3} to={S.end} y={250} />
      <Tag text="ChatGPT 요약" tone="ai" from={S.end} to={S.total} y={690} x={54} />
      <Tag text="원문 그대로" tone="real" from={S.end} to={S.total} y={760 + 420} />
      <Tag text="SYNK 브리핑" from={S.end} to={S.total} y={60} />

      {/* 자막 = 말 */}
      <Cap text="흐릿한 공문, AI 요약에 이렇게 나왔어요" from={vo('n01') / 30} to={S.wrong - 0.05} y={1480} />
      <Cap text={<>그런데 원문엔 <span style={{ color: '#ff6a5f' }}>이런 말이 없어요</span></>} from={vo('n02') / 30} to={S.scan} y={1480} />
      <Cap text={<>새 대화로 여덟 번 → <span style={{ color: '#ff6a5f' }}>여섯 번이 조건을 바꿈</span></>} from={vo('n03') / 30} to={S.blur + 0.3} y={1480} />
      <Cap text={<>확인은 한 줄이면 돼요</>} from={vo('n04') / 30} to={14.2} y={1260} />
      <Cap text={<>'6개월' 자리엔 <span style={{ color: '#ffd84a' }}>마감일 · 금액</span>을 넣어도</>} from={vo('n08') / 30} to={S.send} y={1300} />
      <Cap text={<>요약은 <span style={{ color: '#ffd84a' }}>그럴듯한 말로 바꿔 쓰기도</span></>} from={vo('n05') / 30} to={vo('n09') / 30 - 0.1} y={1500} />
      <Cap text={<>같은 6개월인데, <span style={{ color: '#ff6a5f' }}>전혀 다른 조건</span></>} from={vo('n09') / 30} to={S.turn - 0.05} y={1480} />
      <Cap who="사장님" text={<span style={{ color: '#ffd84a' }}>“…폐업하면, 돌려줘야 한다고?”</span>} from={S.turn + 0.2} to={vo('n06') / 30 - 0.1} y={1480} />
      <Cap text="요약만 믿었다면 몰랐을 조건 — 6개월 안에 폐업하면 반환" from={vo('n06') / 30} to={vo('n10') / 30 - 0.1} y={1480} size={50} />
      <Cap text={<>6개월 안에 문 닫으면, <span style={{ color: '#ff6a5f' }}>키오스크값을 고스란히 떠안는 셈</span></>} from={vo('n10') / 30} to={S.end - 0.05} y={1480} size={50} />
      <Cap text={<>지원금이 걸린 줄은, <span style={{ color: '#ffd84a' }}>원문 그대로 한 번 더</span></>} from={vo('n07') / 30} to={S.total} y={1510} size={52} />

      {/* 소리 */}
      <Audio src={staticFile('bgm.wav')} volume={bgm} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at} durationInFrames={TOTAL - c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} /></Sequence>
      ))}
      {/* 사장님 동영상 소리 — 중얼거림(동영상 6.5~8.6초)이 27.3~29.4초에 */}
      <Sequence from={sec(S.turn)} durationInFrames={sec(2.6)}>
        <Audio src={staticFile('img/V1.mp4')} trimBefore={sec(V.mutter)} volume={1.6} />
      </Sequence>
      <Sfx t={S.wrong + 0.05} src="sfx/pen.wav" vol={0.6} />
      <Sfx t={S.l1} src="sfx/tick.wav" vol={0.4} />
      <Sfx t={S.l3} src="sfx/tick.wav" vol={0.4} />
      <Sfx t={S.tally2} src="sfx/thud.wav" vol={0.5} />
      {/* 확인 한 줄을 치는 동안 글자마다 톡(실제 녹화의 타자 4.55초를 11.84~14.2초에) */}
      {Array.from({ length: 22 }, (_, i) => <Sfx key={i} t={S.typing + 0.1 + i * ((14.2 - S.typing - 0.25) / 22)} src="sfx/tick.wav" vol={0.28} />)}
      <Sfx t={S.send} src="sfx/swish.wav" vol={0.5} />
      <Sfx t={S.ans} src="sfx/thud.wav" vol={0.9} />
      <Sfx t={S.flip + 0.1} src="sfx/pen.wav" vol={0.5} />
      <Sfx t={S.turn} src="sfx/thud.wav" vol={0.8} />
      <Sfx t={S.end} src="sfx/tok.wav" vol={0.5} />
    </AbsoluteFill>
  );
};
