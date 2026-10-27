// LAB 몽골 M3 「내 몽골 이름을 한글로」 — 소리 없는 화면 글 14초(몽골어 먼저).
// 0초 펠트 장면(궁금한 몽글 + 빈 이름표에 「Батбаяр → ?」) → 2.5초 실제 synk.im/name 화면에 한 글자씩 치면 한글이 바로 나옴(바트바야르)
// → 6.0초 둘째 이름은 결과만(Цэцэг → 체첵) → 7.6초 기쁜 몽글 + 이름표 「Таны нэр → ?」 → 9.6초 빈 입력 칸에 커서가 깜빡이는 실제 화면 + synk.im/name + 댓글 놀이.
// 고침 1(올릴 파일 v4 시험 3점): 결과가 나오면 위 띠를 「Батбаяр → 바트바야르 ✓」로(「치는 중 바트바야와 끝 바트바야르 가운데 무엇이 답인지」 · 「빨간 테두리가 정답인지」),
// 둘째 이름은 다시 치지 않고 결과만 1.6초(「6~8초 같은 화면 되풀이에서 넘김」), 도구 화면 내내 「🔗 synk.im/name」(「사이트에서 무엇을 하는지」), 끝 이름표 「Таны нэр → ?」(「? 의 뜻」).
// 고침 2(v5 시험 3점 — 「한글을 못 읽어 바트바야르가 무슨 소리인지 · 맞는지 모름」 · 「4~6초가 빨라 결과가 작다」): 결과가 나오면 도구 화면을 누르고
// 가운데 큰 카드에 키릴 이름 · 한글 · 키릴 읽기(장부 머리말 몽골 판 「한 화면에 한글 · 키릴 읽기 · 몽골 뜻」, 읽기는 M2 · M15처럼 ㅡ → ы), 결과마다 2초 넘게 머문다.
// 도구 화면은 10-27 Edge 헤드리스로 찍은 실제 화면(390×693 CSS px × 2.77 = 1080×1920)의 카드 부분(y 690~1790)이다.
// 관문 조건(장부 M3): 입력 칸은 8초 안에, 마지막은 실제 도구 화면 · 가는 길을 또렷이, 예시는 흔들림 없는 이름만(о · у · ө · 끝 н 없음).
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { T, TA, TB, FPS, fr, TEXT } from './data';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8;
const INK = '#2B2522';
const CORAL = '#F25C4A';
const PAGE = '#FBF7F0'; // synk.im/name 바탕색

const usePop = (start: number, damping = 13) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - fr(start), fps, config: { damping, stiffness: 170, mass: 0.7 } });
};

// 1024×1536 그림을 너비 1080(1.0547배)으로 깔아 아래 1620을 채우고, 위 300은 같은 벽색으로 잇는다.
// 가운데 1080만 보이게 깔면(1.25배) 오른쪽 이름표가 화면 밖으로 잘린다.
const WALL = '#E8D6C7';
const Scene: React.FC<{ src: string; from: number; to: number; zoom: [number, number] }> = ({ src, from, to, zoom }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [fr(from), fr(to)], zoom, clamp);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: WALL }}>
      <div style={{ position: 'absolute', left: 0, top: 300, width: 1080, height: 1620, transform: `scale(${s})`, transformOrigin: '540px 700px' }}>
        <Img src={staticFile(`img/${src}`)} style={{ width: 1080, height: 1620 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 160, background: `linear-gradient(180deg, ${WALL} 0%, rgba(232,214,199,0) 100%)` }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 320, background: WALL, transform: `scale(${s})`, transformOrigin: '540px 1000px' }} />
    </AbsoluteFill>
  );
};

// 빈 펠트 이름표 위 글 — 그림 속 이름표 자리(1080 화면 좌표, 확대 전)에 맞춘다
const CardText: React.FC<{ card: { x: number; y: number; w: number; h: number; rot: number }; from: number; to: number; zoom: [number, number]; instant?: boolean; children: React.ReactNode }> = ({ card, from, to, zoom, instant, children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [fr(from), fr(to)], zoom, clamp);
  const pop = usePop(from + 0.2, 14);
  const p = instant ? 1 : pop;
  // 장면과 같은 점(540, 1000)을 중심으로 같이 커진다
  const cx = 540 + (card.x + card.w / 2 - 540) * s;
  const cy = 1000 + (card.y + card.h / 2 - 1000) * s;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - (card.w * s) / 2,
        top: cy - (card.h * s) / 2,
        width: card.w * s,
        height: card.h * s,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${card.rot}deg) scale(${0.85 + 0.15 * p})`,
        opacity: p,
        color: INK,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
};

// instant — 첫 장면은 0초 정지컷(표지 · 넘기는 손)에도 글이 다 보여야 한다(v1 시험 「0초에 글자 없이 인형과 빈 판만」)
const TopBand: React.FC<{ from: number; lines: string[]; size: number; dark?: boolean; instant?: boolean }> = ({ from, lines, size, dark, instant }) => {
  const pop = usePop(from, 14);
  const p = instant ? 1 : pop;
  return (
    <div style={{ position: 'absolute', top: 262, left: 50, width: 980, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div
        style={{
          display: 'inline-block',
          background: dark ? 'rgba(43,37,34,0.9)' : 'rgba(255,253,248,0.94)',
          color: dark ? '#fff' : INK,
          borderRadius: 34,
          padding: '20px 40px 26px',
          fontFamily: EN,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.16)',
        }}
      >
        {lines.map((l, i) => (
          <React.Fragment key={l}>
            {i > 0 ? <br /> : null}
            {l}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ── 실제 도구 화면 ──────────────────────────────────────────────────────────
const TOOL_Y = 540; // 잘라 온 카드(1080×975, 0.9배)를 놓는 높이 — 위 띠와 주소 알약 아래
const Tool: React.FC<{ seq: { file: string; at: number }[]; ringAt: number; from: number; to: number }> = ({ seq, ringAt, from, to }) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  let file = seq[0].file;
  for (const s of seq) if (sec >= s.at) file = s.file;
  const ring = usePop(ringAt, 11);
  const s = 0.9 * interpolate(frame, [fr(from), fr(to)], [1.0, 1.12], clamp); // 1.03이면 결과 뒤 2초가 「거의 멈춤」(올리기 전 검사 24%)
  const pulse = sec >= ringAt ? 1 + 0.025 * Math.sin((sec - ringAt) * Math.PI * 2.2) : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: PAGE }}>
      <div style={{ position: 'absolute', left: 0, top: TOOL_Y, width: 1080, height: 962, overflow: 'hidden', transform: `scale(${s})`, transformOrigin: '540px 0px' }}>
        <Img src={staticFile(`img/tool/${file}`)} style={{ width: 1080, height: 1100 }} />
        {/* 결과(한글 이름) 둘레 — 잘라 온 카드 안 y 700~950 */}
        {sec >= ringAt ? (
          <div
            style={{
              position: 'absolute',
              left: 70,
              top: 690,
              width: 760,
              height: 270,
              border: `10px solid ${CORAL}`,
              borderRadius: 36,
              opacity: ring,
              transform: `scale(${(0.9 + 0.1 * ring) * pulse})`,
              boxShadow: '0 0 0 8px rgba(242,92,74,0.18)',
            }}
          >
            <div style={{ position: 'absolute', right: -34, top: -34, width: 76, height: 76, borderRadius: 38, background: CORAL, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 50, lineHeight: '76px', textAlign: 'center' }}>✓</div>
          </div>
        ) : null}
      </div>
      {/* 결과 카드 뒤 그늘 — 잘라 온 화면만 누르면 회색 네모로 보여 화면 전체에 깐다 */}
      <AbsoluteFill style={{ background: 'rgba(43,37,34,0.38)', opacity: interpolate(frame, [fr(ringAt + 0.3), fr(ringAt + 0.5)], [0, 1], clamp) }} />
      <UrlChip from={from} />
    </AbsoluteFill>
  );
};

// 도구 화면 위 주소 알약 — 이 화면이 어디인지(v4 시험 「링크는 보이지만 거기서 뭘 하는지 모르겠다」)
const UrlChip: React.FC<{ from: number }> = ({ from }) => {
  const p = usePop(from + 0.1, 13);
  return (
    <div style={{ position: 'absolute', top: 455, left: 0, width: 1080, textAlign: 'center', opacity: p }}>
      <span style={{ display: 'inline-block', background: INK, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 44, padding: '10px 30px 13px', borderRadius: 999 }}>🔗 synk.im/name</span>
    </div>
  );
};

// 끝 — 실제 도구 화면(빈 입력 칸, 회색 예시 글 앞에 커서가 깜빡임). 카드 아래(잘라 온 화면 y 700~)는 덮고 댓글 놀이를 둔다.
const ToolEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const pu = usePop(T.tend + 0.15, 13);
  const p1 = usePop(T.tend + 0.6, 13);
  const caret = Math.floor((sec - T.tend) * 2.2) % 2 === 0;
  const ring = 1 + 0.02 * Math.sin((sec - T.tend) * Math.PI * 2);
  const s = interpolate(frame, [fr(T.tend), fr(T.total)], [1.0, 1.1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: PAGE }}>
      <div style={{ position: 'absolute', left: 0, top: 560, width: 1080, height: 700, overflow: 'hidden', transform: `scale(${s})`, transformOrigin: '540px 240px' }}>
        <Img src={staticFile('img/tool/t_focus.jpg')} style={{ width: 1080, height: 1100 }} />
        <div style={{ position: 'absolute', left: 172, top: 196, width: 6, height: 88, background: INK, borderRadius: 3, opacity: caret ? 1 : 0 }} />
        <div style={{ position: 'absolute', left: 122, top: 152, width: 836, height: 170, border: `9px solid ${CORAL}`, borderRadius: 34, transform: `scale(${ring})` }} />
      </div>
      <div style={{ position: 'absolute', top: 440, left: 0, width: 1080, textAlign: 'center', opacity: pu, transform: `scale(${0.8 + 0.2 * pu})` }}>
        <span style={{ display: 'inline-block', background: INK, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 58, padding: '12px 38px 16px', borderRadius: 999 }}>🔗 synk.im/name</span>
      </div>
      <div style={{ position: 'absolute', top: 1310, left: 0, width: 1080, textAlign: 'center', opacity: p1, transform: `scale(${0.8 + 0.2 * p1})` }}>
        <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: CORAL, color: '#fff', fontFamily: EN, fontWeight: 800, fontSize: 40, padding: '14px 32px 18px', borderRadius: 999, boxShadow: '0 10px 28px rgba(0,0,0,0.18)' }}>{TEXT.endComment}</span>
      </div>
      {/* 「한국어 배우는 친구에게 보내 주세요」 줄은 38px · y 1440이라 릴스 아래 캡션 덮개에 걸려(Fable P2) 캡션으로 옮겼다 */}
    </AbsoluteFill>
  );
};

// 결과 카드 — 키릴 이름 → 한글(크게) · 키릴 읽기. 도구 화면 위 가운데에 띄운다
const ResultCard: React.FC<{ from: number; m: { from: string; ko: string; read: string } }> = ({ from, m }) => {
  const p = usePop(from, 12);
  return (
    <div style={{ position: 'absolute', top: 640, left: 0, width: 1080, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
      <div style={{ display: 'inline-block', minWidth: 720, background: '#fff', borderRadius: 44, padding: '34px 56px 40px', border: `8px solid ${CORAL}`, boxShadow: '0 18px 50px rgba(0,0,0,0.3)', transform: `scale(${0.85 + 0.15 * p})` }}>
        <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 64, color: INK, lineHeight: 1.1 }}>{m.from}</div>
        <div style={{ fontFamily: "'Inter Tight', 'Segoe UI', sans-serif", fontWeight: 800, fontSize: 64, color: CORAL, lineHeight: 1.1, margin: '6px 0' }}>↓</div>
        <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 132, color: INK, lineHeight: 1.12 }}>{m.ko} <span style={{ color: CORAL, fontSize: 96 }}>✓</span></div>
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 54, color: '#7A5A44', lineHeight: 1.2, marginTop: 10 }}>{m.read}</div>
      </div>
    </div>
  );
};

// ── 소리 ───────────────────────────────────────────────────────────────────
const Sfx: React.FC<{ file: string; t: number; vol?: number }> = ({ file, t, vol = 1 }) => (
  <Sequence from={Math.max(0, fr(t))} layout="none">
    <Audio src={staticFile(`sfx/${file}`)} volume={vol * MASTER} />
  </Sequence>
);

const Sound: React.FC = () => {
  const total = fr(T.total);
  const bgm = (i: number) => 0.16 * MASTER * interpolate(i, [0, 8], [0, 1], clamp) * interpolate(i, [total - 24, total], [1, 0], clamp);
  return (
    <>
      <Audio src={staticFile('bgm.wav')} volume={bgm} />
      <Sfx file="pop.wav" t={0.25} vol={0.3} />
      {TA.keys.map((k) => (
        <Sfx key={`a${k}`} file="tick.wav" t={k} vol={0.28} />
      ))}
      <Sfx file="ding1.wav" t={TA.ring} vol={0.45} />
      {TB.keys.map((k) => (
        <Sfx key={`b${k}`} file="tick.wav" t={k} vol={0.28} />
      ))}
      <Sfx file="ding1.wav" t={TB.ring} vol={0.45} />
      <Sfx file="sparkle.wav" t={T.end + 0.1} vol={0.35} />
      <Sfx file="pop.wav" t={T.tend + 0.1} vol={0.3} />
      <Sfx file="tok.wav" t={T.tend + 0.6} vol={0.3} />
    </>
  );
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  return (
    <AbsoluteFill style={{ backgroundColor: PAGE }}>
      {sec < T.toolA ? (
        <>
          <Scene src="mongle_curious.jpg" from={0} to={T.toolA} zoom={[1.0, 1.1]} />
          <CardText card={TEXT.cardHook} from={0} to={T.toolA} zoom={[1.0, 1.1]} instant>
            <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 70, lineHeight: 1.05, marginRight: 70 }}>Батбаяр</div>
            {/* SUIT에는 →가 없어 「>」로 찍혔다 — 화살표는 Inter Tight · Segoe UI로 */}
            <div style={{ fontFamily: "'Inter Tight', 'Segoe UI', sans-serif", fontWeight: 800, fontSize: 88, color: CORAL, lineHeight: 1.1, marginRight: 70 }}>→ ?</div>
          </CardText>
          <TopBand from={0} lines={TEXT.hook} size={62} instant />
        </>
      ) : null}
      {sec >= T.toolA && sec < T.toolB ? (
        <>
          <Tool seq={TA.seq} ringAt={TA.ring} from={T.toolA} to={T.toolB} />
          <TopBand from={T.toolA} lines={TEXT.tool} size={52} dark />
          {sec >= TA.ring + 0.3 ? <ResultCard from={TA.ring + 0.3} m={TEXT.mapA} /> : null}
        </>
      ) : null}
      {sec >= T.toolB && sec < T.end ? (
        <>
          <Tool seq={TB.seq} ringAt={TB.ring} from={T.toolB} to={T.end} />
          <TopBand from={T.toolB} lines={TEXT.tool} size={52} dark instant />
          {sec >= TB.ring + 0.2 ? <ResultCard from={TB.ring + 0.2} m={TEXT.mapB} /> : null}
        </>
      ) : null}
      {sec >= T.end && sec < T.tend ? (
        <>
          <Scene src="mongle_happy.jpg" from={T.end} to={T.tend} zoom={[1.0, 1.1]} />
          <CardText card={TEXT.cardEnd} from={T.end} to={T.tend} zoom={[1.0, 1.1]}>
            <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 64, lineHeight: 1.05, marginRight: 60 }}>{TEXT.cardEndName}</div>
            <div style={{ fontFamily: "'Inter Tight', 'Segoe UI', sans-serif", fontWeight: 800, fontSize: 88, color: CORAL, lineHeight: 1.1, marginRight: 60 }}>→ ?</div>
          </CardText>
          <TopBand from={T.end} lines={TEXT.end} size={52} />
        </>
      ) : null}
      {sec >= T.tend ? (
        <>
          <ToolEnd />
          <TopBand from={T.tend} lines={TEXT.tryIt} size={60} dark />
        </>
      ) : null}
      <Sound />
    </AbsoluteFill>
  );
};

