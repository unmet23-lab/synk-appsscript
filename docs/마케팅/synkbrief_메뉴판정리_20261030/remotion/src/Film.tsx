// synkbrief B18 「손글씨 메뉴판 사진 한 장」 본편(31초) — 제작 절차 「한 장면 먼저」 첫 시험 편.
// 뼈대는 원본 gNpXb9i3_3o(비포애프터 「결말은 반전」 41.3초)를 0.75배로: 0초 「전」 + 약속 → 문제(손님이 헷갈림) → 과정 이정표
// (한 줄만 → 품절 부활 · 쪽지 빠짐 → 세 마디 → 그래도 빠진 것만) → 숨 고르기 → 26.0초 뜯기며 「후」 → 끝 3초는 「후」 위 끝 줄.
// 핵심 장면(Reveal)은 2.1초 손님 질문(앞부분)과 23.2초부터 통째로 다시 온다. 무대는 화면 가득 사진(B8 · B14의 청금석 카드 아님),
// 배경음은 「시티팝_147」(B8 · B14 · B15와 다름), 끝 줄은 「요청문은 캡션에」가 아니다.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import { Reveal } from './Reveal';
import PLACE from './vo-place.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const sec = (s: number) => Math.round(s * 30);

// 장면 시작(초) — 원본 컷을 0.75배로 옮긴 자리 근처(오마주.json · 나란히로 맞춘다)
export const S = { hook: 0, ask: 1.2, one: 5.5, cheese: 9.9, note: 12.1, c1: 14.1, c2: 16.9, c3: 18.85, more: 20.3, more2: 21.4, breath: 22.9, order: 27.2, end: 28.2, pair: 29.9 };
export const TOTAL = sec(31.0);
// 원본 박자(×0.75) 1.2 · 2.9 · 4.4 · 6.2 · 8.2 · 9.8 · 11.0 · 11.6 · 14.1 · 16.6 · 19.4 · 22.7 · 24.4 · 25.8 · 27.2 · 29.9초마다 컷이나 장면 안 큰 바뀜(확 다가가기 ·
// 말풍선 · 글줄 등장)을 둔다 — 나란히는 펜 획 같은 작은 움직임은 박자로 세지 않는다.
// 핵심 장면 뒷부분은 Reveal 20프레임부터(다가간 뒤) — 뜯기 104 → 22.9 + 84/30 = 25.7초, 확 다가가기 65 → 24.4초
const REVEAL_FROM = 20;

// 「전」 사진의 자리(1080×1920) — 자료/뜯기층.py
const P = { sticker: { x: 689, y: 511 }, sold: { x: 499, y: 771 }, note: { x: 918, y: 1676 } };

// light: 어두운 장면(대화 화면 · 결과 띠)에서는 흰 판 + 검은 글자 — 검은 판이 검은 바탕과 구분되지 않아 올리기 전 검사 ⑤가 「판 없이 얹은 흰 글자」로 읽었다
const Box: React.FC<{ lines: string[]; at: number; ats?: number[]; y?: number; size?: number; accent?: number; snap?: boolean; light?: boolean; slow?: boolean }> = ({ lines, at, ats, y = 290, size = 64, accent = -1, snap = false, light = false, slow = false }) => {
  const f = useCurrentFrame();
  const pp = (i: number) => interpolate(f, [ats?.[i] ?? at, (ats?.[i] ?? at) + (snap ? 2 : slow ? 14 : 6)], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 70, right: 160, top: y, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.18, letterSpacing: -1, color: light ? (i === accent ? '#d4202a' : '#111') : i === accent ? '#ffd84a' : '#fff',
          background: light ? 'rgba(250,248,242,0.97)' : 'rgba(12,12,12,0.82)', padding: '10px 22px', borderRadius: 16, opacity: pp(i), translate: `0 ${(1 - pp(i)) * 24}px` }}>
          {l}
        </div>
      ))}
    </div>
  );
};

const Brand: React.FC = () => (
  <div style={{ position: 'absolute', left: 70, top: 200, fontFamily: KO, fontWeight: 700, fontSize: 30, color: '#fff', background: 'rgba(12,12,12,0.7)', padding: '6px 16px', borderRadius: 999 }}>
    <span style={{ color: '#5d8bff' }}>●</span> SYNK 브리핑
  </div>
);

const Source: React.FC<{ text: string; top?: number }> = ({ text, top = 1370 }) => (
  <div style={{ position: 'absolute', left: 70, right: 160, top, fontFamily: KO, fontWeight: 700, fontSize: 36, color: '#fff', background: 'rgba(12,12,12,0.72)', padding: '6px 14px', borderRadius: 10, width: 'fit-content' }}>
    {text}
  </div>
);

// 「전」 사진의 한 자리를 화면 가운데로 끌어와 크게(카메라가 그 자리로 다가간다)
const Closeup: React.FC<{ at: { x: number; y: number }; from: number; to: number; len: number; ty?: number; punch?: number; src?: string; swap?: number; children?: React.ReactNode }> = ({ at, from, to, len, ty = 900, punch, src = 'img/전.png', swap, children }) => {
  const f = useCurrentFrame();
  // 천천히 다가가기는 일정한 속도로 — 가운데서 빨라지면 나란히가 그 자리를 박자로 센다(세 마디 장면 15.1 · 19.6초)
  const s = interpolate(f, [0, len], [from, to], clamp) * (punch === undefined ? 1 : interpolate(f, [punch, punch + 3], [1, 1.16], clamp));
  const k = interpolate(f, [0, 10], [0, 1], { ...clamp, easing: EASE_OUT });
  // 원점(at) 둘레로 s배 키운 사진이 화면(1080×1920)을 다 덮는 옮김 범위 안에서만 그 자리를 가운데로 끈다
  const fit = (want: number, o: number, size: number) => Math.min(o * s - o, Math.max(size - o - (size - o) * s, want));
  const tx = fit((540 - at.x) * k, at.x, 1080), tyy = fit((ty - at.y) * k, at.y, 1920);
  return (
    <AbsoluteFill style={{ background: '#2a2620', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: `${at.x}px ${at.y}px`, scale: `${s}`, translate: `${tx}px ${tyy}px` }}>
        <Img src={staticFile(swap !== undefined && f >= swap ? 'img/전_들림.png' : src)} style={{ position: 'absolute', inset: 0, width: 1080, height: 1920 }} />
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 빨간 펜 — 동그라미 · 가로줄 · 엑스. at부터 8프레임에 그린다.
const Pen: React.FC<{ d: string; len: number; at: number; color?: string; w?: number }> = ({ d, len, at, color = '#e3262b', w = 10 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  if (p <= 0) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)}
        style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }} />
    </svg>
  );
};
const ellipse = (x: number, y: number, rx: number, ry: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 1.12 * Math.PI * 2 - 2.3;
    const w = 1 + 0.05 * Math.sin(i * 0.7) + 0.04 * (i / 64);
    pts.push(`${(x + Math.cos(t) * rx * w).toFixed(1)},${(y + Math.sin(t) * ry * w).toFixed(1)}`);
  }
  return { d: `M${pts.join(' L')}`, len: 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) * 1.12 * 1.05 };
};

// 실제 ChatGPT 대화(휴대폰 폭으로 다시 그린 저장본)에서 오린 내 요청 말풍선 + 붙인 사진
const Chat: React.FC<{ bubble: string; h: number; photo?: boolean; late?: number; zoomAt?: number; shift?: number; marks?: { x: number; y: number; w: number }[] }> = ({ bubble, h, photo = true, late = 0, zoomAt, shift = 0, marks = [] }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 10], [0, 1], { ...clamp, easing: EASE_OUT });
  const q = interpolate(f, [late, late + 6], [0, 1], { ...clamp, easing: EASE_OUT });
  // 원본 박자(8.2초)에 형광 밑줄 두 줄로 확 다가간다 — 실제 화면을 한 컷 보인 뒤 핵심 줄만 크게(제작 절차 「실제 화면은 크게 다시 짜기」,
  // v5 · v8 시험관 둘이 「6~9초 검은 화면의 긴 요청문이 읽기 귀찮다」)
  const zp = zoomAt === undefined ? 0 : interpolate(f, [zoomAt, zoomAt + 5], [0, 1], { ...clamp, easing: EASE_OUT });
  const top = (photo ? 1010 : 760) + shift * 1.35; // shift: 말풍선 그림 위를 오려 낸 만큼(빈 첨부 칸 테두리)
  const fx = marks.length ? -420 + 1.35 * (Math.min(...marks.map((m) => m.x)) + Math.max(...marks.map((m) => m.x + m.w))) / 2 : 540;
  const fy = marks.length ? top + 1.35 * (Math.min(...marks.map((m) => m.y)) + Math.max(...marks.map((m) => m.y)) + 50) / 2 : 1350;
  return (
    <AbsoluteFill style={{ background: '#0d0d0d', transformOrigin: `${fx}px ${fy}px`, scale: `${1 + 0.3 * zp}`, translate: `${(540 - fx) * zp}px ${(980 - fy) * zp}px` }}>
      {photo && <Img src={staticFile('img/전.png')} style={{ position: 'absolute', right: 70, top: 560, width: 240, height: 427, borderRadius: 18, opacity: p }} />}
      <Img src={staticFile(bubble)} style={{ position: 'absolute', left: -420, top, width: 1458, height: h * 1.35, opacity: q, translate: `0 ${(1 - q) * 30}px` }} />
      {/* 말풍선 위에 굵은 노란 밑줄(글자를 가리지 않게 글줄 아래) — 「메뉴 이름과 가격은 한 글자도 바꾸지 말고」 */}
      {marks.map((m, i) => {
        const w = interpolate(f, [(zoomAt ?? 0) + 4 + i * 6, (zoomAt ?? 0) + 10 + i * 6], [0, 1], { ...clamp, easing: EASE_OUT });
        return <div key={i} style={{ position: 'absolute', left: -420 + m.x * 1.35, top: top + (m.y + 42) * 1.35, width: m.w * 1.35 * w, height: 12, background: '#ffd84a', borderRadius: 6 }} />;
      })}
    </AbsoluteFill>
  );
};

// 실제 ChatGPT 결과(한 줄만 보낸 판)의 띠 하나만 크게 — 결과 전체는 끝까지 보여 주지 않는다
const Band: React.FC<{ y0: number; y1: number; punch?: number; src?: string; children?: React.ReactNode }> = ({ y0, y1, punch, src = 'img/후_한줄.png', children }) => {
  const f = useCurrentFrame();
  const z = punch === undefined ? 1 : interpolate(f, [punch, punch + 3], [1, 1.12], clamp);
  const k = 1000 / 1024;
  const p = interpolate(f, [0, 10], [0, 1], { ...clamp, easing: EASE_OUT });
  const h = (y1 - y0) * k;
  const top = 880 - h / 2;
  return (
    <AbsoluteFill style={{ background: '#1b1915' }}>
      <div style={{ position: 'absolute', left: 40, top, width: 1000, height: h, overflow: 'hidden', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.6)', scale: `${(0.96 + 0.04 * p) * z}`, opacity: p }}>
        <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: -y0 * k, width: 1000, height: 1536 * k }} />
      </div>
      <AbsoluteFill style={{ transformOrigin: '540px 880px', scale: `${z}` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const Pair: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: EASE_OUT });
  const card = (src: string, x: number, label: string) => (
    <div style={{ position: 'absolute', left: x, top: 520, width: 510, height: 907, borderRadius: 16, overflow: 'hidden', border: '5px solid #fff', boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
      translate: `${(x < 540 ? -40 : 40) * (1 - p)}px 0`, opacity: p }}>
      <Img src={staticFile(src)} style={{ width: 510, height: 907 }} />
      <div style={{ position: 'absolute', left: 14, top: 14, fontFamily: KO, fontWeight: 800, fontSize: 40, color: '#fff', background: 'rgba(17,17,17,0.86)', padding: '4px 18px', borderRadius: 12 }}>{label}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#1b1915' }}>
      <Img src={staticFile('img/후_벽.png')} style={{ position: 'absolute', inset: -40, width: 1160, height: 2000, filter: 'blur(28px) brightness(0.5)' }} />
      {card('img/전.png', 20, '전')}
      {card('img/후_벽.png', 550, '후')}
    </AbsoluteFill>
  );
};

// soft: 원본 박자 자리가 아닌 도장은 천천히 나타나게(나란히가 큰 바뀜을 박자로 세서 칸 수 · 박자 짝이 어긋난다)
const Stamp: React.FC<{ text: string; x: number; y: number; at: number; soft?: boolean }> = ({ text, x, y, at, soft = false }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + (soft ? 14 : 4)], [soft ? 1.12 : 1.8, 1], { ...clamp, easing: EASE_OUT });
  const o = interpolate(f, [at, at + (soft ? 12 : 2)], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: x, top: y, fontFamily: KO, fontWeight: 900, fontSize: 80, color: '#e3262b', border: '8px solid #e3262b', borderRadius: 14,
      padding: '2px 18px', rotate: '-8deg', scale: `${p}`, opacity: o, background: 'rgba(255,255,255,0.9)' }}>
      {text}
    </div>
  );
};

// 배경음 크기: 말 동안 0.12, 말 없을 때 0.24, 숨 고르기 · 공개 동안(말 없을 때) 0.42(오디오 크기 함수는 프레임마다 따로 불린다)
const bgmAt = (fr: number) => {
  if ((PLACE as { at: number; end: number }[]).some((c) => fr >= c.at - 3 && fr <= c.end + 3)) return 0.12;
  return fr >= sec(S.breath) && fr < sec(S.end) ? 0.42 : 0.24;
};

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#111' }}>
      {/* 1 훅 — 「전」만 화면 가득(글은 0프레임부터 떠 있다) */}
      <Sequence from={0} durationInFrames={sec(S.ask)}>
        <Closeup at={{ x: 540, y: 960 }} from={1.04} to={1.06} len={sec(S.ask)} ty={960} />
        <Box lines={['이런 메뉴판,', '손님이 꼭 물어봐요']} at={-99} />
      </Sequence>
      {/* 2 손님 — 핵심 장면 앞부분: 스티커로 다가가고(1.2초) 손님 말(2.17초~) · 글이 뜨는 2.9초에 스티커가 들려 밑의 옛 값 3,500이 보이고
          · 「사천」(3.1초)에 4,000 동그라미 · 「삼천오백」(4.4초)에 확 다가가며 3,500 동그라미와 물음표(v5 · v7 · v8 시험관이 「3,500이 어디서」를 짚음) */}
      <Sequence from={sec(S.ask)} durationInFrames={sec(S.one - S.ask)}>
        <Closeup at={{ x: 650, y: 511 }} from={1.45} to={1.55} len={sec(S.one - S.ask)} ty={760} punch={sec(4.4 - S.ask)} swap={sec(2.93 - S.ask)}>
          <Pen {...ellipse(P.sticker.x + 48, P.sticker.y - 10, 92, 50)} at={sec(3.11 - S.ask)} />
          <Pen {...ellipse(P.sticker.x - 120, P.sticker.y + 20, 62, 42)} at={sec(4.4 - S.ask)} color="#ffd84a" />
          <Pen d={`M${P.sticker.x + 150},${P.sticker.y - 30} c0,-34 52,-40 52,-6 c0,26 -30,26 -30,52 M${P.sticker.x + 172},${P.sticker.y + 44} l0,4`} len={170} at={sec(4.4 - S.ask)} w={9} />
        </Closeup>
        <Box lines={['“사장님, 이거 4,000원이에요?', '3,500원이에요?”']} at={sec(2.93 - S.ask)} y={1230} size={52} />
      </Sequence>
      {/* 3 한 줄만 — 실제 요청 말풍선(붙인 사진 → 6.2초 말풍선 → 8.2초 둘째 글줄) */}
      <Sequence from={sec(S.one)} durationInFrames={sec(S.cheese - S.one)}>
        <Chat bubble="img/말_한줄만.png" h={430} late={sec(6.15 - S.one)} zoomAt={sec(8.18 - S.one)} shift={50} marks={[{ x: 647, y: 171, w: 300 }, { x: 392, y: 237, w: 464 }]} />
        <Box lines={['ChatGPT에 사진 주고', '「한 글자도 바꾸지 마」']} at={4} ats={[4, sec(8.18 - S.one)]} accent={1} light />
      </Sequence>
      {/* 4 품절 부활 — 실제 결과에서 그 띠만(11.0초 확 다가가며 동그라미 · 11.6초 도장) */}
      <Sequence from={sec(S.cheese)} durationInFrames={sec(S.note - S.cheese)}>
        <Band y0={455} y1={845} punch={sec(10.96 - S.cheese)}>
          <Pen {...ellipse(540, 880, 470, 62)} at={sec(10.96 - S.cheese)} />
          <Stamp text="품절인데?" x={600} y={600} at={sec(11.56 - S.cheese)} />
        </Band>
        <Box lines={['품절된 치즈김밥까지', '살려 놨어요']} at={4} accent={0} light />
        <Source text="실제 ChatGPT 결과 · 2026.10.30" />
      </Sequence>
      {/* 5 쪽지 빠짐 — 한 줄만 보낸 실제 결과의 아래 띠: 「카드 가능」이 없다(v7 시험관 셋이 「엑스」가 무슨 뜻인지 헷갈림) */}
      <Sequence from={sec(S.note)} durationInFrames={sec(S.c1 - S.note)}>
        <Band y0={1380} y1={1536}>
          <Stamp text="「카드 가능」 없음" x={470} y={960} at={8} soft />
        </Band>
        <Box lines={['「카드 가능」 쪽지는', '빼 버리고요']} at={4} accent={0} light />
        <Source text="실제 ChatGPT 결과 · 2026.10.30" />
      </Sequence>
      {/* 6~8 세 마디 — 함정마다 다가가 펜으로 */}
      <Sequence from={sec(S.c1)} durationInFrames={sec(S.c2 - S.c1)}>
        <Closeup at={{ x: 640, y: 511 }} from={1.7} to={1.85} len={sec(S.c2 - S.c1)} src="img/전_들림.png">
          <Pen {...ellipse(P.sticker.x, P.sticker.y, 122, 60)} at={sec(1.3)} />
        </Closeup>
        <Box lines={['요청에 세 마디를 더했어요', '+ 고친 가격 그대로']} at={4} accent={1} />
      </Sequence>
      <Sequence from={sec(S.c2)} durationInFrames={sec(S.c3 - S.c2)}>
        <Closeup at={P.sold} from={1.25} to={1.35} len={sec(S.c3 - S.c2)}>
          <Pen {...ellipse(P.sold.x, P.sold.y, 455, 62)} at={3} />
        </Closeup>
        <Box lines={['+ 지운 메뉴는 빼고']} at={2} accent={0} />
      </Sequence>
      <Sequence from={sec(S.c3)} durationInFrames={sec(S.more - S.c3)}>
        <Closeup at={P.note} from={1.6} to={1.7} len={sec(S.more - S.c3)}>
          <Pen {...ellipse(P.note.x, P.note.y, 130, 92)} at={3} />
        </Closeup>
        <Box lines={['+ 「카드 가능」 쪽지까지']} at={2} accent={0} />
      </Sequence>
      {/* 9 세 마디 뒤 실제 결과의 아래 띠만(쪽지가 또 빠짐 — 결과 전체는 끝까지 아낀다) → 이어 보낸 말풍선 */}
      <Sequence from={sec(S.more)} durationInFrames={sec(S.more2 - S.more)}>
        <Band y0={1320} y1={1536} src="img/후_카드빠짐.png">
          <Stamp text="카드 가능?" x={640} y={700} at={12} soft />
        </Band>
        <Box lines={['그래도 쪽지가 또 빠져서']} at={0} accent={0} light snap />
        <Source text="실제 ChatGPT 결과" />
      </Sequence>
      <Sequence from={sec(S.more2)} durationInFrames={sec(S.breath - S.more2)}>
        <Chat bubble="img/말_그것만.png" h={350} photo={false} />
        <Box lines={['그것만 넣어 달라고']} at={0} accent={0} light snap />
      </Sequence>
      {/* 10~12 숨 고르기 → 뜯기며 「후」 → 끝 줄(핵심 장면이 통째로 다시) */}
      <Sequence from={sec(S.breath)} durationInFrames={TOTAL - sec(S.breath)}>
        <Sequence from={-REVEAL_FROM} layout="none">
          <Reveal sound={false} extra punch={65} />
        </Sequence>
        {f >= sec(S.order) && f < sec(S.end) && <Box lines={['“사장님, 원조김밥 하나요!”']} at={sec(S.order - S.breath)} size={56} snap light />}
        {f >= sec(S.end) && <Box lines={['붙이기 전엔,', '원래 사진이랑 한 줄씩']} at={sec(S.end - S.breath)} accent={1} light slow />}
        {f >= sec(S.end) && <Source text="실제 ChatGPT 결과 · 벽 사진은 합성" top={484} />}
      </Sequence>
      {/* 끝 장치(원본 39.8초 전후 나란히) — 두 메뉴판을 자르지 않고 통째로, 끝 줄은 위에 그대로 */}
      <Sequence from={sec(S.pair)} durationInFrames={TOTAL - sec(S.pair)}>
        <Pair />
        <Box lines={['붙이기 전엔,', '원래 사진이랑 한 줄씩']} at={-99} accent={1} light />
      </Sequence>
      <Brand />
      {/* 소리 */}
      <Audio src={staticFile('bgm.mp3')} volume={bgmAt} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at} durationInFrames={sec(7)}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={1} /></Sequence>
      ))}
      <Sequence from={sec(3.11)} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.85} /></Sequence>
      <Sequence from={sec(4.4)} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.75} /></Sequence>
      <Sequence from={sec(10.96)} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.85} /></Sequence>
      <Sequence from={sec(11.56)} durationInFrames={12}><Audio src={staticFile('sfx/thud.wav')} volume={0.5} /></Sequence>
      <Sequence from={sec(S.note) + 6} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.85} /></Sequence>
      <Sequence from={sec(S.c1 + 1.3)} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.8} /></Sequence>
      <Sequence from={sec(S.c2) + 3} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.8} /></Sequence>
      <Sequence from={sec(S.c3) + 3} durationInFrames={12}><Audio src={staticFile('sfx/pen.wav')} volume={0.8} /></Sequence>
      <Sequence from={sec(S.breath) + 104 - REVEAL_FROM - 3} durationInFrames={27}><Audio src={staticFile('sfx/tear.wav')} volume={1} /></Sequence>
      <Sequence from={sec(S.breath) + 114 - REVEAL_FROM} durationInFrames={15}><Audio src={staticFile('sfx/thud.wav')} volume={0.6} /></Sequence>
      {[124, 132, 140].map((k) => (
        <Sequence key={k} from={sec(S.breath) + k - REVEAL_FROM} durationInFrames={6}><Audio src={staticFile('sfx/tick.wav')} volume={0.9} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
