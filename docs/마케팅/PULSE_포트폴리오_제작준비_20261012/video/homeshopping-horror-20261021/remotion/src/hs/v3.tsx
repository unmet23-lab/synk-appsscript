// 콘티 v3(10-22 반응 조사, 03_콘티_v3.md)의 홈쇼핑 칸: 쇼호스트(하린) 컷 + 제품 · 가격판 컷을 멀티캠처럼 이어 붙인다.
// 쇼호스트 컷은 말 대신 미소 · 손짓만 하고, 말은 화면 밖 소리와 자막 띠로 간다. 제품은 블렌더 렌더에만 나온다(손에 들지 않는다).
// 각 장면 안 프레임 기준(24fps). 칸 길이(10-22 Fable 설계 검토 뒤 v3.1 — 대사 실측에 맞췄다):
// H1 2.3초(쇼호스트 1.0 + 제품 1.3) · H2 3.0초(1.0 × 3) · H3 4.6초(가격 1.4 + 도장 0.9 + 뚜껑만 1.7 + 굳은 미소 0.6) · E1 0.9초 · E2 2.4초.
import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { HS, HS_EN } from '../lib/fonts';
import { Band, Countdown, Disclaimer, LiveBug, OrderBar, OrderCounter, PriceStar, ProductName, Sfx, Sparkles, Stamp, Sticker, Turntable, ol, sec, shakeAt } from './parts';
import { P2V3, Product } from './product';
import { Frame } from './scenes';

export const LEN_V3 = { H1: sec(2.3), H2: sec(3), H3: sec(4.6), E1: sec(0.9), E2: sec(2.4) };
type P = { p?: Product };
const SPARK: [number, number, number][] = [[1050, 330, 26], [1500, 280, 34], [1560, 600, 22], [1010, 640, 18], [1430, 860, 24], [1110, 480, 14]];
const mid = (len: number, n: number) => Math.round((n + 1) / 2 - len / 2);

// 홈쇼핑 자막 띠: 흰 바탕 · 남색 굵은 글 · 왼쪽 빨간 선. 소리를 꺼도 쇼호스트 말이 읽히게(02_반응조사 §5)
export const CaptionBar: React.FC<{ text: string; at?: number }> = ({ text, at = 0 }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const x = interpolate(f, [at, at + 4], [-40, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 46 + x, bottom: 132, opacity: interpolate(f, [at, at + 3], [0, 1], { extrapolateRight: 'clamp' }), display: 'flex', alignItems: 'stretch', boxShadow: '0 8px 0 rgba(0,0,0,0.25)' }}>
      <div style={{ width: 16, background: '#E4001B' }} />
      <div style={{ background: '#FFFFFF', padding: '12px 34px 6px', fontFamily: HS, fontSize: 64, color: '#0B1A4A', whiteSpace: 'nowrap' }}>{text}</div>
    </div>
  );
};

// 쇼호스트 컷: 밝은 스튜디오 정지컷 위에 LIVE · 마감 시계(또는 주문 수) · 아래 주문 띠만 얹는다(큰 값 · 딱지는 얼굴을 가리지 않게 빼고)
const HostShot: React.FC<{ still: string; p: Product; clock?: number; every?: number; caption?: string; captionAt?: number; ticker?: string; push?: [number, number]; children?: React.ReactNode }> = ({ still, p, clock, every = 6, caption, captionAt = 2, ticker, push = [1.0, 1.03], children }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 24], push, { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Img src={staticFile(`stills/${still}.jpg`)} style={{ width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '50% 40%' }} />
      <LiveBug />
      {clock !== undefined ? <Countdown from={clock} every={every} /> : null}
      {children}
      {caption ? <CaptionBar text={caption} at={captionAt} /> : null}
      <OrderBar phone={p.phone} ticker={ticker} />
      <Disclaimer />
    </AbsoluteFill>
  );
};

// H1 · 보여 주기(2.2초) — 쇼호스트 「방송 끝나면, 이 가격 다시 없습니다!」 → 꽉 3종 탑 + 9만원대
export const H1V3: React.FC<P> = ({ p = P2V3 }) => {
  const v = p.v3!;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={sec(1.0)}>
        <HostShot still="H1a" p={p} clock={59} caption="방송 끝나면, 이 가격 다시 없습니다!" captionAt={1} />
      </Sequence>
      <Sequence from={sec(1.0)}>
        <Frame palette="sky" phone={p.phone}>
          <Turntable cx={1270} bottom={958} h={p.h1.h} first={mid(sec(1.3), p.main.n)} seq={p.main} />
          <Sparkles pts={SPARK} />
          <ProductName at={0} big={p.h1.big} small={p.h1.small} />
          <Band at={4} text="한정 수량" top={430} />
          <PriceStar at={9} x={470} y={735} R={215} price={v.price.h1[1]} big={v.price.h1[0]} label="방송 특가" />
          <Countdown from={57} />
          <Sfx at={0} src="swish" vol={0.3} />
          <Sfx at={4} src="pop" vol={0.45} />
          <Sfx at={9} src="ding1" vol={0.4} />
        </Frame>
      </Sequence>
    </AbsoluteFill>
  );
};

// H2 · 키우기(3.0초) — 가격판 99만원대 · 6종 세트 · 무이자 10개월 · 주문 폭주 띠 → 뚜껑 잠금 접사 「꽉!」 → 쇼호스트가 렌즈를 가리킨다
export const H2V3: React.FC<P> = ({ p = P2V3 }) => {
  const f = useCurrentFrame();
  const v = p.v3!;
  const [sx, sy, sw] = p.h2.stickerAt ?? [1712, 380, 210];
  const [bl, bt] = p.h2.band ?? [1020, 760];
  const blink = Math.floor(f / 5) % 2 === 0;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={sec(1.0)}>
        <Frame palette="pop" phone={p.phone} ticker={v.ticker}>
          {p.h2.tables.map((t, i) => <Turntable key={i} cx={t.cx} bottom={t.bottom} h={t.h} first={mid(sec(3), p.main.n) + t.offset} dim={t.dim} seq={p.main} />)}
          <Sparkles pts={SPARK} />
          <ProductName at={0} big={p.h2.big} small={p.h2.small} />
          <PriceStar at={1} x={470} y={735} R={215} price={v.price.h2[1]} big={v.price.h2[0]} label="방송 특가" />
          {/* 「매진 임박」 띠가 0.3초만 보였다(Fable 최종 P3) — 딱지 간격을 줄여 띠를 12프레임에 */}
          <Sticker at={4} x={830} y={300} text={'구성\n추가!'} shape="burst" w={128} bg="#FFE14A" fg="#E4001B" size={50} rot={-12} />
          <Sticker at={7} x={250} y={455} text={v.muija.h2} bg="#1E5BFF" fg="#FFFFFF" size={52} rot={-7} />
          <Sticker at={10} x={sx} y={sy} text={p.h2.sticker} shape="circle" w={sw} bg="#E4001B" fg="#FFFFFF" size={62} rot={10} />
          <Band at={12} text="매진 임박" top={bt} left={bl} bg="#FFE600" fg="#E4001B" rot={-7} size={76} fromRight />
          <Countdown from={31} every={5} />
          {[1, 4, 7, 10, 12].map((t, i) => <Sfx key={t} at={t} src={i === 0 ? 'ding2' : 'pop'} vol={i === 0 ? 0.4 : 0.26} />)}
        </Frame>
      </Sequence>
      <Sequence from={sec(1.0)} durationInFrames={sec(1.0)}>
        <LatchInsert />
      </Sequence>
      <Sequence from={sec(2.0)}>
        <HostShot still="H2c" p={p} clock={24} every={5} ticker={v.ticker} caption="지금 바로 전화 주세요!" captionAt={1} push={[1.0, 1.05]}>
          <div style={{ opacity: blink ? 1 : 0.55 }}>
            <Sticker at={3} x={1500} y={300} text="지금 바로 전화!" bg="#E4001B" fg="#FFFFFF" size={56} rot={6} />
          </div>
        </HostShot>
      </Sequence>
    </AbsoluteFill>
  );
};

// 뚜껑 잠금 접사(블렌더 kkwak/latch_####.png, 24장) — 잠금 날개가 내려가고 진공 단추가 들어간다. 받침 없이 밝은 바탕 위
const LatchInsert: React.FC = () => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 23], [1.0, 1.12], { extrapolateRight: 'clamp' });
  const idx = Math.min(24, f + 1);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FFE7F1 55%, #FFC1DA 100%)', overflow: 'hidden' }}>
      <Img src={staticFile(`kkwak/latch_${String(idx).padStart(4, '0')}.png`)} style={{ position: 'absolute', width: 1920, height: 1080, objectFit: 'cover', transform: `scale(${s})` }} />
      {f >= 9 ? <Sticker at={9} x={1450} y={330} text="꽉!" shape="burst" w={150} bg="#FFE14A" fg="#E4001B" size={84} rot={-10} /> : null}
      <Sfx at={9} src="snap" vol={0.55} />
      <Sfx at={10} src="thud" vol={0.35} />
      <LiveBug />
    </AbsoluteFill>
  );
};

// H3 · 뒤집기(4.6초) — 990만원대 · 무이자 360개월 · 월 27,500원 · 오늘 단 하루 → 「특별 할인」 쾅 → 뚜껑만 1개 · 9천원대 · ※ 본체 별매
// (무이자 360개월은 그대로 깜박) → 쇼호스트 굳은 미소(소리 없이 환호만 — 자본주의 미소는 말 없이가 더 웃긴다, Fable P2-4)
export const H3V3: React.FC<P> = ({ p = P2V3 }) => {
  const f = useCurrentFrame();
  const v = p.v3!;
  // 도장은 혜수 「오늘 단 하루!」(1.36초)가 끝난 뒤에 — 「쾅」이 「하루!」를 덮었다(Fable P2-2)
  const STAMP = sec(1.4) + 1;
  const blink = Math.floor(f / 6) % 2 === 0;
  const sh = shakeAt(f, STAMP, 20);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={sec(2.3)}>
        <Frame palette="gold" phone={p.phone} ticker={v.ticker} shake={sh}>
          <Turntable cx={1270} bottom={958} h={p.h1.h} first={mid(sec(2), p.main.n)} seq={p.main} />
          <Sparkles pts={SPARK} />
          {/* 「평생 세트」에 무이자 360개월(30년) — 「특별 할인」 뒤에야 「뚜껑만 1개」가 드러난다(가격 구조를 깔았다 뒤집기, 02_반응조사 §2) */}
          <ProductName at={0} big={p.h3.big} small="평생 세트" />
          <Band at={1} text="오늘 단 하루!" top={420} />
          <PriceStar at={4} x={480} y={745} R={240} price={v.price.h3[1]} big={v.price.h3[0]} label="방송 특가" wobble={f < STAMP} />
          <Sticker at={8} x={1660} y={450} text={v.muija.h3} bg="#1E5BFF" fg="#FFFFFF" size={58} rot={7} />
          {/* 990만 ÷ 360 = 딱 27,500 — 실제 홈쇼핑이 「월 ○○원」으로 쪼개 보이는 꼴 그대로(Fable P3 · 숨은 개그) */}
          <Sticker at={12} x={1660} y={560} text="월 27,500원" bg="#FFFFFF" fg="#1E5BFF" size={56} rot={7} font={HS_EN} />
          <Stamp at={STAMP} x={640} y={575} text="특별 할인" size={104} />
          <Countdown from={9} every={10} />
          <Sfx at={1} src="swish" vol={0.18} />
          <Sfx at={4} src="ding1" vol={0.18} />
          <Sfx at={STAMP} src="thud" vol={0.55} />
          <Sfx at={STAMP} src="boom" vol={0.25} />
        </Frame>
      </Sequence>
      <Sequence from={sec(2.3)} durationInFrames={sec(1.7)}>
        <Frame palette="gold" phone={p.phone} ticker={v.ticker}>
          {p.h3.solo ? <Turntable cx={1270} bottom={962} h={p.h3.solo.h} first={mid(sec(1), p.h3.solo.seq.n)} seq={p.h3.solo.seq} shadow={p.h3.solo.shadow} /> : null}
          <Sparkles pts={[[1180, 690, 16], [1360, 650, 22], [1300, 760, 12], [1120, 790, 14]]} />
          <ProductName at={0} big={p.h3.big} small={p.h3.small} />
          <Sticker at={0} x={1700} y={480} text={p.h3.sticker} bg="#FFFFFF" fg="#0B1A4A" size={46} rot={8} />
          <PriceStar at={0} x={480} y={745} R={240} price={v.price.h3[1]} big={v.price.h3[0]} label="방송 특가" struck={2} wobble={false} />
          <PriceStar at={5} x={1040} y={470} R={215} price={v.price.after[1]} big={v.price.after[0]} label="단 하루" tone="white" />
          <div style={{ opacity: blink ? 1 : 0.45 }}>
            <Sticker at={0} x={1660} y={760} text={v.muija.h3} bg="#1E5BFF" fg="#FFFFFF" size={52} rot={7} />
          </div>
          {/* 뚜껑만 1개에 붙는 면책 — 실제 홈쇼핑 화면의 작은 면책 줄 꼴(Fable P3 · 숨은 개그) */}
          <div style={{ position: 'absolute', left: 46, bottom: 128, background: 'rgba(8,14,40,0.72)', padding: '6px 18px 2px', fontFamily: HS, fontSize: 52, color: '#FFFFFF' }}>※ 본체 별매</div>
          <Countdown from={3} every={10} />
          <Sfx at={5} src="ding3" vol={0.5} />
          <Sfx at={7} src="earn" vol={0.45} />
        </Frame>
      </Sequence>
      <Sequence from={sec(4.0)}>
        <HostShot still="H3d" p={p} clock={1} every={12} ticker={v.ticker} push={[1.02, 1.06]} />
      </Sequence>
    </AbsoluteFill>
  );
};

// E1 · 주문 완료(0.9초 — 끝 웃음은 E2라 짧게, Fable P2-6) — 꽉 3종 탑 화면으로 돌아와 주문 +2와 도장
export const E1V3: React.FC<P> = ({ p = P2V3 }) => (
  <Frame palette="sky" phone={p.phone}>
    <Turntable cx={1270} bottom={958} h={p.h1.h} first={mid(LEN_V3.E1, p.main.n)} seq={p.main} />
    <Sparkles pts={SPARK} />
    <ProductName at={0} big={p.he.big} small={p.he.small} />
    <OrderCounter from={1247} to={1249} at={2} />
    <Stamp at={5} x={430} y={760} text="주문 완료" rot={-10} />
    <Sfx at={2} src="ding2" vol={0.3} />
    <Sfx at={5} src="thud" vol={0.55} />
  </Frame>
);

// E2 · 쇼호스트가 강도에게(2.4초) — 「후드 쓰신 고객님~ 주문 감사합니다!」(입모양을 소리에 맞출 컷)
export const E2V3: React.FC<P> = ({ p = P2V3 }) => (
  <HostShot still="E2" p={p} caption="후드 쓰신 고객님~ 주문 감사합니다!" captionAt={1} push={[1.0, 1.06]}>
    <div style={{ position: 'absolute', right: 46, top: 34, textAlign: 'right' }}>
      <div style={{ fontFamily: HS, fontSize: 32, color: '#FFFFFF', textShadow: ol('#0B1A4A', 4) }}>방송 중 주문</div>
      <div style={{ fontFamily: HS, fontSize: 80, lineHeight: 1, color: '#FFE14A', textShadow: ol('#0B1A4A', 6) }}>1,249건</div>
    </div>
  </HostShot>
);
