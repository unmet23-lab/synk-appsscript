// 움직임 시안: 콘티 v2의 03-1(젬은 알아서) → 03-2(젬 → 스킬) → 04(GPTs는 직접).
// 증거 장면은 「흰 무대 · 실제 화면 크게」(선택 하이라이트가 왼쪽부터 · 나머지 조명 어둡게 · 커서 → 클릭 리플 → 확대),
// 비유 장면은 펠트 물건. 장부 S16처럼 튕김 없는 스프링·expo out 감속·박자 격자, 효과는 아끼고 흔들기·회전·글리치는 없다.
// 모든 움직임은 useCurrentFrame()으로만 — 어느 프레임을 뽑아도 같다.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BlurIn, clamp, EASE_IN_OUT, EASE_OUT, ramp } from './lib/anim';
import { beat } from './lib/beat';
import { KO, MONO } from './lib/fonts';

const C = { paper: '#FBFAF7', ink: '#14161B', muted: '#5B6170', lapis: '#3D6BC9', butter: '#F2D36B', ok: '#2F8A4B', no: '#C2412E', screen: '#0B0D12' };
const DY = 180; // SNS 키트 .k-center와 같은 아래 내림(위아래 여백 맞춤)

// 장면 경계(프레임). 박자 격자: beat(3)=73 매치컷, beat(6)=130 하드컷.
const A_END = beat(3) + 8; // 03-1 끝(띠의 「스킬로」 자리로 밀어 들어간 뒤)
const B_END = beat(6); // 03-2 끝 = 04 하드컷 + 펀치
export const MOTION_TEST_FRAMES = beat(15) - 10;

// 튕김 없는 스프링(장부 S16 「튕김 없는 스프링」)
const calm = (f: number, at: number, fps: number, damping = 26) => spring({ frame: f - at, fps, config: { damping, stiffness: 160, mass: 0.9 } });

const Head: React.FC<{ right: string }> = ({ right }) => (
  <div style={{ position: 'absolute', left: 84, right: 160, top: 277 + DY, display: 'flex', justifyContent: 'space-between', font: `500 26px/1 ${MONO}`, color: C.muted, letterSpacing: '.02em' }}>
    <span>synkbrief 뉴스</span>
    <span>{right}</span>
  </div>
);

// 제목: 낱말 블러 인 + 형광펜이 왼쪽부터(kit의 k-mark와 같은 버터색)
const Title: React.FC<{ before: string; mark: string; after?: string; at: number }> = ({ before, mark, after = '', at }) => {
  const f = useCurrentFrame();
  const m = ramp(f, at + 10, 12);
  return (
    <div style={{ position: 'absolute', left: 84, right: 160, top: 350 + DY, font: `800 64px/1.2 ${KO}`, letterSpacing: '-.03em', color: C.ink }}>
      <BlurIn text={before} at={at} />{' '}
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ position: 'absolute', left: -4, right: -4, bottom: 6, height: 26, background: C.butter, transformOrigin: 'left center', scale: `${m} 1`, borderRadius: 4, zIndex: 0 }} />
        <span style={{ position: 'relative' }}><BlurIn text={mark} at={at + 4} /></span>
      </span>
      {after ? <> <BlurIn text={after} at={at + 8} /></> : null}
    </div>
  );
};

// 키네틱 자막: 덩어리마다 블러 인, 강조 낱말은 청금석 + 버터 밑줄. 아래끝 y 1236(+180).
const Caption: React.FC<{ chunks: { t: string; at: number; em?: boolean }[]; out?: number }> = ({ chunks, out }) => {
  const f = useCurrentFrame();
  const o = out ? 1 - ramp(f, out, 6) : 1;
  return (
    <div style={{ position: 'absolute', left: 84, right: 160, bottom: 1920 - (1236 + DY), font: `800 60px/1.25 ${KO}`, letterSpacing: '-.03em', color: C.ink, opacity: o }}>
      {chunks.map((c, i) => (
        <React.Fragment key={i}>
          {i ? ' ' : ''}
          {/* 강조 밑줄은 낱말이 보인 뒤 왼쪽부터 그어진다(먼저 보이면 빈 노란 막대만 남는다) */}
          <span style={c.em ? { position: 'relative', display: 'inline-block', color: C.lapis } : undefined}>
            {c.em ? <span style={{ position: 'absolute', left: -2, right: -2, bottom: 4, height: 18, background: C.butter, borderRadius: 3, transformOrigin: 'left center', scale: `${ramp(f, c.at + 6, 10)} 1` }} /> : null}
            <span style={{ position: 'relative' }}><BlurIn text={c.t} at={c.at} rise={26} blur={12} /></span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

// 날짜 도장 칩: 눌리듯 1.22 → 1, −4°(키트 chip-stamp)
const Stamp: React.FC<{ at: number; num: string; word: string; left: number; top: number }> = ({ at, num, word, left, top }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < at) return null;
  const s = calm(f, at, fps, 30);
  return (
    <div style={{ position: 'absolute', left, top, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 26px', borderRadius: 16, background: '#fff', color: C.ink, font: `800 46px/1 ${KO}`, letterSpacing: '-.03em', boxShadow: `0 0 0 4px ${C.ink}, ${8 * s}px ${8 * s}px 0 ${C.ink}`, rotate: '-4deg', scale: `${1.22 - 0.22 * s}`, opacity: interpolate(f - at, [0, 2], [0, 1], clamp) }}>
      <b style={{ font: `500 46px/1 ${MONO}`, color: C.lapis, letterSpacing: '-.04em' }}>{num}</b>{word}
    </div>
  );
};

// 03-1: 실제 제미나이 안내 띠(670×185 캡처 → 폭 912)
const SceneGem: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = calm(f, 6, fps);
  const sel1 = ramp(f, beat(1), 12);
  const sel2 = ramp(f, beat(1) + 12, 6);
  const dim = ramp(f, beat(1) + 4, 10);
  // 매치컷: beat(3)부터 「스킬로」 자리(카드 안 474,96)로 밀어 들어간다
  const push = ramp(f, beat(3), 8, EASE_IN_OUT);
  const W = 856, H = Math.round(185 * (856 / 670)); // 글자 끝 x 940 안(쇼츠 단추 열 960 밖)
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Head right="젬" />
      <Title before="젬은" mark="알아서" at={0} />
      <div style={{ position: 'absolute', left: 84, top: 500 + DY, width: W, height: H, borderRadius: 26, overflow: 'hidden', background: C.screen, boxShadow: `0 0 0 2px ${C.ink}, 0 26px 44px -26px rgba(0,0,0,.55)`, opacity: interpolate(rise, [0, 0.5], [0, 1], clamp), translate: `0 ${(1 - rise) * 70}px`, transformOrigin: '474px 96px', scale: `${1 + push * 1.6}` }}>
        <Img src={staticFile('img/gemini_crop.png')} style={{ width: W, height: H, display: 'block' }} />
        <span style={{ position: 'absolute', left: 508, top: 75, width: 259 * sel1, height: 41, borderRadius: 6, background: C.lapis, mixBlendMode: 'screen' }} />
        <span style={{ position: 'absolute', left: 28, top: 130, width: 68 * sel2, height: 41, borderRadius: 6, background: C.lapis, mixBlendMode: 'screen' }} />
        <span style={{ position: 'absolute', left: 21, top: 69, width: 758, height: 109, borderRadius: 14, boxShadow: `0 0 0 3000px rgba(6,8,12,${0.58 * dim})` }} />
      </div>
      <div style={{ position: 'absolute', left: 84, top: 780 + DY, font: `500 24px/1.3 ${MONO}`, color: C.muted, opacity: 1 - push }}>화면: 제미나이 Gems · 2026.10.17</div>
      <div style={{ opacity: 1 - push }}><Stamp at={beat(2)} num="11.17" word="부터" left={520} top={812 + DY} /></div>
      <Caption chunks={[{ t: '11월 17일부터', at: 14 }, { t: '알아서', at: 26, em: true }, { t: '옮겨지기 시작', at: 38 }]} out={beat(3)} />
      <AbsoluteFill style={{ background: C.paper, opacity: interpolate(f, [A_END - 3, A_END], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
};

// 03-2: 띠의 「스킬」 자리가 펠트 스킬 카드가 되고, 보석이 쓱 들어가 O
const SceneSkill: React.FC = () => {
  const f = useCurrentFrame(); // 이 장면 안의 프레임(0 = A_END)
  const { fps } = useVideoConfig();
  const card = calm(f, 0, fps);
  const gemIn = calm(f, 6, fps);
  const join = ramp(f, beat(5) - A_END, 10);
  const o = f >= beat(5) - A_END ? calm(f, beat(5) - A_END, fps, 18) : 0;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Head right="젬 → 스킬" />
      <Title before="젬 →" mark="스킬" at={0} />
      <Img src={staticFile('img/skillcard.webp')} style={{ position: 'absolute', left: 600, top: 520 + DY, width: 300, scale: `${1.5 - 0.5 * card}`, opacity: interpolate(card, [0, 0.4], [0, 1], clamp), filter: 'drop-shadow(0 26px 30px rgba(0,0,0,.28))' }} />
      <Img src={staticFile('img/gem.webp')} style={{ position: 'absolute', left: interpolate(gemIn, [0, 1], [-320, 150]) + join * 560, top: 600 + DY + join * 40, width: 280, scale: `${1 - join * 0.45}`, filter: 'drop-shadow(0 26px 30px rgba(0,0,0,.28))' }} />
      <div style={{ position: 'absolute', left: 800, top: 430 + DY, font: `800 170px/1 'Inter Tight', ${KO}`, color: C.ok, scale: `${0.6 + 0.4 * o}`, opacity: o, textShadow: '0 6px 0 #fff' }}>O</div>
      <div style={{ position: 'absolute', left: 84, right: 160, top: 940 + DY, font: `700 34px/1.35 ${KO}`, letterSpacing: '-.02em', color: C.ink }}>
        <BlurIn text="스킬 = 저장해 둔 지시를 / 로 불러 쓰기" at={14} rise={20} blur={10} stagger={2} />
        <div style={{ marginTop: 6, font: `500 24px/1.3 ${MONO}`, color: C.muted, opacity: ramp(f, 24, 10) }}>Gemini 고객센터 「Gem에서 스킬로의 전환」</div>
      </div>
      <Caption chunks={[{ t: '가만히 있어도', at: 4 }, { t: '스킬', at: 14, em: true }, { t: '이 돼요', at: 20 }]} />
    </AbsoluteFill>
  );
};

// 04: 「내 GPT」 실제 화면(877×530 → 폭 760). 커서 → 클릭 리플 → 단추 쪽으로 확대 + 나머지 어둡게 → 12.11 도장 → 작은 ✕
const SceneGpt: React.FC = () => {
  const f = useCurrentFrame(); // 0 = B_END(하드컷)
  const { fps } = useVideoConfig();
  const at = (k: number) => beat(k) - B_END;
  const punch = 1 + 0.04 * (1 - ramp(f, 0, 8));
  const W = 760, H = Math.round(530 * (760 / 877));
  const bx = 439, by = 399; // 단추 가운데(카드 안)
  const curMove = ramp(f, at(7) + 2, 16, EASE_IN_OUT);
  const click = at(8);
  const zoom = ramp(f, click, 12);
  const dim = ramp(f, click, 10);
  const rip = f >= click ? ramp(f, click, 18) : 0;
  const press = f >= click && f < click + 5 ? 0.94 : 1;
  const x = calm(f, at(10), fps, 20);
  const cx = interpolate(curMove, [0, 1], [700, bx + 70]);
  const cy = interpolate(curMove, [0, 1], [H + 140, by + 6]);
  return (
    <AbsoluteFill style={{ background: C.paper, scale: `${punch}` }}>
      <Head right="GPTs" />
      <Title before="GPTs는" mark="직접" at={0} />
      <div style={{ position: 'absolute', left: 84, top: 470 + DY, width: W, height: H, borderRadius: 26, overflow: 'hidden', background: C.screen, boxShadow: `0 0 0 2px ${C.ink}, 0 26px 44px -26px rgba(0,0,0,.55)` }}>
        <div style={{ position: 'absolute', inset: 0, transformOrigin: `${bx}px ${by}px`, scale: `${1 + 0.22 * zoom}` }}>
          <Img src={staticFile('img/mygpt_list.png')} style={{ width: W, height: H, display: 'block' }} />
          <span style={{ position: 'absolute', left: bx - 144, top: by - 33, width: 288, height: 66, borderRadius: 999, boxShadow: `0 0 0 3000px rgba(6,8,12,${0.58 * dim})`, scale: `${press}` }} />
          <span style={{ position: 'absolute', left: bx - 150, top: by - 39, width: 300, height: 78, borderRadius: 999, border: `5px solid ${C.lapis}`, opacity: dim, boxShadow: `0 0 0 ${10 * dim}px rgba(61,107,201,.22)` }} />
          {rip > 0 && rip < 1 ? <span style={{ position: 'absolute', left: cx - 70, top: cy - 70, width: 140, height: 140, borderRadius: 999, border: `4px solid rgba(255,255,255,${0.85 * (1 - rip)})`, scale: `${0.3 + rip}` }} /> : null}
          {f >= at(7) ? (
            <svg viewBox="0 0 48 64" style={{ position: 'absolute', left: cx - 4, top: cy - 2, width: 52, height: 66, scale: `${press}` }}>
              <path d="M4 2 L4 50 L17 38 L26 60 L35 56 L26 34 L44 34 Z" fill="#fff" stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
            </svg>
          ) : null}
        </div>
      </div>
      <Stamp at={at(9)} num="12.11" word="전에" left={600} top={372 + DY} />
      {f >= at(10) ? <div style={{ position: 'absolute', left: 770, top: 860 + DY, font: `800 120px/1 'Inter Tight', ${KO}`, color: C.no, scale: `${1.3 - 0.3 * x}`, opacity: x, textShadow: '0 5px 0 #fff' }}>✕</div> : null}
      <div style={{ position: 'absolute', left: 84, right: 160, top: 956 + DY, font: `700 34px/1.35 ${KO}`, letterSpacing: '-.02em', color: C.ink }}>
        {f >= at(10) ? <><span style={{ color: C.lapis }}><BlurIn text="플러그인으로 마이그레이션" at={at(10)} rise={20} blur={10} /></span> <BlurIn text="= 옮기기" at={at(10) + 6} rise={20} blur={10} /></> : null}
      </div>
      <Caption chunks={[{ t: '직접', at: 10, em: true }, { t: '옮겨야 해요', at: 18 }]} />
    </AbsoluteFill>
  );
};

// 효과음: [프레임, 파일, 음량] — 박자 격자에 붙는다
const SFX: [number, string, number][] = [
  [6, 'tok', 0.5], [beat(1), 'tick', 0.9], [beat(2), 'stamp', 0.55], [beat(3), 'whoosh', 0.9],
  [A_END + 6, 'swish', 0.9], [beat(5), 'ding', 0.45],
  [B_END, 'punch', 0.5], [beat(8), 'click', 0.6], [beat(8), 'ripple', 0.9], [beat(9), 'stamp', 0.55], [beat(10), 'buzz', 0.35],
];

export const MotionTest: React.FC = () => (
  <AbsoluteFill style={{ background: C.paper }}>
    <Audio src={staticFile('bgm.wav')} volume={(f) => interpolate(f, [0, 10, MOTION_TEST_FRAMES - 20, MOTION_TEST_FRAMES], [0, 0.32, 0.32, 0], clamp)} />
    {SFX.map(([at, name, vol], i) => (
      <Sequence key={i} from={at} durationInFrames={40}>
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
      </Sequence>
    ))}
    <Sequence from={0} durationInFrames={A_END}><SceneGem /></Sequence>
    <Sequence from={A_END} durationInFrames={B_END - A_END}><SceneSkill /></Sequence>
    <Sequence from={B_END} durationInFrames={MOTION_TEST_FRAMES - B_END}><SceneGpt /></Sequence>
  </AbsoluteFill>
);

void EASE_OUT;
