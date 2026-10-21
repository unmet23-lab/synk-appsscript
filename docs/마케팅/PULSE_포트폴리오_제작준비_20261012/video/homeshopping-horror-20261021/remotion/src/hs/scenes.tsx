// 홈쇼핑 끼어들기 넷: H1 보여 주기(2초) · H2 키우기(3초) · H3 뒤집기(4초) · HE 끝(4초).
// 같은 틀(LIVE · 마감 시계 · 주문 띠 · 회전 받침)을 세 번 쓰고, 셋째에서 값이 무너진다. 프레임은 각 장면 안 기준(24fps).
import React from 'react';
import { AbsoluteFill, Easing, Freeze, interpolate, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { Band, Countdown, Disclaimer, LiveBug, OrderBar, OrderCounter, Pedestal, PriceStar, ProductName, Sfx, Sparkles, Stamp, Sticker, Sunburst, Turntable, shakeAt, sec } from './parts';

export const LEN = { H1: sec(2), H2: sec(3), H3: sec(4), HE: sec(4) };

// 회전 받침 120장의 가운데(라벨 정면)를 둘러싼 구간만 쓴다
const mid = (len: number) => Math.round(60.5 - len / 2);
const SPARK: [number, number, number][] = [[1050, 330, 26], [1500, 280, 34], [1560, 600, 22], [1010, 640, 18], [1430, 860, 24], [1110, 480, 14]];

const Frame: React.FC<{ palette: 'sky' | 'pop' | 'fire' | 'gold'; children: React.ReactNode; shake?: { x: number; y: number } }> = ({ palette, children, shake }) => (
  <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
    <AbsoluteFill style={{ transform: shake ? `translate(${shake.x}px, ${shake.y}px)` : undefined }}>
      <Sunburst palette={palette} />
      {children}
      <LiveBug />
      <OrderBar />
      <Disclaimer />
    </AbsoluteFill>
  </AbsoluteFill>
);

// H1 · 보여 주기 — 글자가 하나씩: 상품명 → 빨간 띠 → 금빛 별 값
export const H1: React.FC = () => (
  <Frame palette="sky">
    <Turntable cx={1270} bottom={958} h={720} first={mid(LEN.H1)} />
    <Sparkles pts={SPARK} />
    <ProductName at={3} big="맑음 MALGEUM" small="토너 150ml" />
    <Band at={13} text="한정 수량" top={430} />
    <PriceStar at={24} x={470} y={735} R={215} price="99,000원" label="방송 특가" />
    <Countdown from={59} />
    <Sfx at={3} src="swish" vol={0.35} />
    <Sfx at={13} src="pop" vol={0.5} />
    <Sfx at={24} src="ding1" vol={0.45} />
  </Frame>
);

// H2 · 키우기 — 3병 세트, 딱지가 0.35초(8~9프레임)마다
export const H2: React.FC = () => {
  const f = useCurrentFrame();
  const blink = Math.floor(f / 5) % 2 === 0;
  const pops = [2, 10, 19, 27, 36, 44, 53];
  return (
    <Frame palette="pop">
      <Turntable cx={985} bottom={905} h={540} first={mid(LEN.H2) + 6} dim={0.08} />
      <Turntable cx={1560} bottom={905} h={540} first={mid(LEN.H2) - 6} dim={0.08} />
      <Turntable cx={1272} bottom={962} h={680} first={mid(LEN.H2)} />
      <Sparkles pts={SPARK} />
      <ProductName at={0} big="맑음 토너" small="3병 세트" />
      <Sticker at={pops[0]} x={830} y={300} text={'구성\n추가!'} shape="burst" w={128} bg="#FFE14A" fg="#E4001B" size={50} rot={-12} />
      <Sticker at={pops[1]} x={1712} y={380} text={'3병\n세트'} shape="circle" w={210} bg="#E4001B" fg="#FFFFFF" size={62} rot={10} />
      <Sticker at={pops[2]} x={250} y={455} text="무이자 10개월" bg="#1E5BFF" fg="#FFFFFF" size={52} rot={-7} />
      <PriceStar at={pops[3]} x={470} y={735} R={215} price="990,000원" label="방송 특가" />
      <Sticker at={pops[4]} x={1040} y={196} text="방송 중 주문 폭주" bg="#FF7A00" fg="#FFFFFF" size={46} rot={5} />
      <Band at={pops[5]} text="매진 임박" top={760} left={1020} bg="#FFE600" fg="#E4001B" rot={-7} size={76} fromRight />
      {f >= pops[6] ? (
        <div style={{ opacity: blink ? 1 : 0.55 }}>
          <Sticker at={pops[6]} x={800} y={925} text="지금 바로 전화!" bg="#E4001B" fg="#FFFFFF" size={50} rot={0} />
        </div>
      ) : null}
      <Countdown from={31} every={5} />
      {/* 딱지 「뿅」이 성준 줄(15.7초~)의 첫 자음을 덮어 「무이자」가 「의자」로 들렸다 — 줄 밑에서는 작게 */}
      {pops.map((p, i) => <Sfx key={p} at={p} src={i === 3 ? 'ding2' : 'pop'} vol={i === 0 ? 0.45 : 0.28} />)}
    </Frame>
  );
};

// H3 · 뒤집기 — 큰 받침 위 아주 작은 병. 9,900,000원 → 「특별 할인」 도장 → 줄 긋고 9,900원
export const H3: React.FC = () => {
  const f = useCurrentFrame();
  const STAMP = 36; // 1.5초(24.0초) — 성준 「특별 할인!」
  const STRIKE = 54;
  const NEW = 58; // 2.4초 — 혜수 「구천구백 원!」은 25.0초(f60)
  const sh = shakeAt(f, STAMP, 20);
  const arrow = interpolate(f, [6, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Frame palette="gold" shake={sh}>
      <Pedestal cx={1270} bottom={962} w={660} />
      <Turntable cx={1270} bottom={842} h={190} first={mid(LEN.H3)} />
      <Sparkles pts={[[1180, 690, 16], [1360, 650, 22], [1300, 760, 12], [1120, 790, 14]]} />
      <ProductName at={0} big="맑음 토너" small="미니 10ml" />
      <svg width={1920} height={1080} style={{ position: 'absolute', opacity: arrow }}>
        <path d="M1640 520 C1560 560 1460 600 1355 690" stroke="#FFFFFF" strokeWidth={20} fill="none" strokeLinecap="round" strokeDasharray="900" strokeDashoffset={900 * (1 - arrow)} />
        <path d="M1640 520 C1560 560 1460 600 1355 690" stroke="#0B1A4A" strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray="900" strokeDashoffset={900 * (1 - arrow)} />
        {arrow >= 1 ? <path d="M1330 712 L1352 650 L1394 694 Z" fill="#0B1A4A" stroke="#FFFFFF" strokeWidth={6} strokeLinejoin="round" /> : null}
      </svg>
      <Sticker at={6} x={1700} y={480} text="실제 크기" bg="#FFFFFF" fg="#0B1A4A" size={46} rot={8} />
      <Band at={2} text="단 하루!" top={420} />
      <PriceStar at={10} x={480} y={745} R={240} price="9,900,000원" label="방송 특가" struck={STRIKE} wobble={f < STAMP} />
      <Stamp at={STAMP} x={600} y={575} text="특별 할인" size={104} />
      {/* 새 값 별은 도장 「특별 할인」을 가리지 않게 오른쪽 위로(Fable P1 — 900,560 · R235는 「인」을 덮어 「특별 할」만 보였다) */}
      <PriceStar at={NEW} x={1040} y={470} R={215} price="9,900원" label="단 하루" tone="white" />
      <Countdown from={9} every={10} />
      {/* 혜수 「단 하루!」(22.7초 = f5)와 겹치는 쉭 · 딩은 작게 — 믹스 받아쓰기에서 「다음 하루」로 들렸다 */}
      <Sfx at={2} src="swish" vol={0.18} />
      <Sfx at={10} src="ding1" vol={0.18} />
      {/* 도장 쿵 · 붐이 성준 「특별 할인!」과 겹쳐 0dBFS를 넘고 「특별하리」로 들렸다 — 줄이고 목소리를 0.12초 뒤로 */}
      <Sfx at={STAMP} src="thud" vol={0.55} />
      <Sfx at={STAMP} src="boom" vol={0.25} />
      <Sfx at={NEW} src="ding3" vol={0.5} />
      <Sfx at={NEW + 2} src="earn" vol={0.5} />
    </Frame>
  );
};

// HE · 끝 — 주문 +2와 「주문 완료」 도장, 화면을 조금 어둡게 하고 끝 문구 → 로고, 마지막 박에 멈춤(후반 가이드 3절)
export const HE: React.FC = () => {
  const f = useCurrentFrame();
  const FREEZE = 84;
  const DIM = 36;
  const LINE = 36;
  const LOGO = 60;
  const rise = (at: number) => ({
    opacity: interpolate(f, [at, at + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    transform: `translateY(${interpolate(f, [at, at + 10], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.poly(5)) })}px)`,
  });
  // 끝 문구가 어둡힌 병 위에 얹혀 0.58로는 겹쳐 보였다(Fable P2) — 더 어둡게
  const dim = interpolate(f, [DIM, DIM + 8], [0, 0.75], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Freeze frame={FREEZE} active={(x) => x >= FREEZE}>
        <Frame palette="sky">
          <Turntable cx={1270} bottom={958} h={720} first={mid(LEN.HE)} />
          <Sparkles pts={SPARK} />
          <ProductName at={0} big="맑음 MALGEUM" small="토너 150ml" />
          <Stamp at={10} x={430} y={760} text="주문 완료" rot={-10} />{/* 「PULSE」의 P와 겹쳐(Fable P2) 왼쪽 아래로 */}
          <OrderCounter from={1247} to={1249} at={12} />
          <Sfx at={10} src="thud" vol={0.55} />
          {/* 혜수 「주문 감사합니다!」(35.3초) 첫소리를 덮지 않게 앞으로 당기고 작게(「중원」으로 들렸다) */}
          <Sfx at={12} src="ding2" vol={0.25} />
        </Frame>
      </Freeze>
      <AbsoluteFill style={{ background: `rgba(6,10,24,${dim})` }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...rise(LINE), fontFamily: KO, fontWeight: 800, fontSize: 96, color: '#FFFFFF', letterSpacing: -2, marginTop: -90 }}>강도도 사게 만드는 광고</div>
        <div style={{ ...rise(LOGO), fontFamily: EN, fontWeight: 800, fontSize: 132, color: '#FFFFFF', letterSpacing: 26, marginTop: 34, marginRight: -26 }}>PULSE</div>
      </AbsoluteFill>
      <div style={{ ...rise(LINE), position: 'absolute', left: 46, bottom: 128, background: 'rgba(255,255,255,0.92)', borderRadius: 40, padding: '10px 26px', fontFamily: KO, fontWeight: 600, fontSize: 28, color: '#34342F' }}>가상 브랜드 · AI로 만든 가상 모델·음성</div>
      <Sfx at={LOGO} src="snap" vol={0.4} />
    </AbsoluteFill>
  );
};
