// synkbrief B24 「결제 전 질문 셋」 본편(28.75초) — 제작 절차 「한 장면 먼저」 일곱째 편(장면 심사 v2 통과).
// 뼈대는 원본 7Tyo1JTY2BE(온크트리 「AI 유료 요금제, 어떤 기준으로 고를까」 24.2초 · 평소의 7.1배): 한 자리에서 바로 판정 + 아래 카드가 박자마다 바뀜 +
//   18.2초 카드가 사라지며 「전부 결제하지는 마세요」 + 22.9초 끝 말. 우리는 판정 주체를 「내 결제를 막은 옆자리 동료」로 옮겼다.
// 화면 글 · 값은 모두 실제 화면 그대로(public/img — scripts/img.py, public/plate의 1인칭 판 — 합성/판들.py). 우리가 쓴 글은 자막 · 꼬리표 · 세 칸뿐.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { KO } from './lib/fonts';
import PLACE from './vo-place.json';
import FACE from './face-map.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);

// 원본 박자: 3.6 · 6.7 · 9.4 · 11.1 · 13.0 · 14.4 · 16.3 · 18.2 · 22.9
export const S = {
  slap: 1.46, faceA: 2.08, faceB: 4.07, chat: 5.65, laugh: 7.93, q: 8.4, povFile: 12.48, q3: 14.46, povPages: 16.1, free: 16.76, povFree: 17.95, n08: 21.34, pay2: 22.24,
  strike: 23.17, creep: 24.69, slap2: 26.7, faceEnd: 26.82, lunch: 27.27, total: 28.75,
};
export const TOTAL = sec(S.total);
const vo = (id: string) => (PLACE as { id: string; at: number }[]).find((c) => c.id === id)!.at / 30;
const seq = (from: number, to: number, el: React.ReactNode) => <Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{el}</Sequence>;

// 판(이미 1080×1920으로 구운 1인칭 영상)
const Plate: React.FC<{ src: string; start?: number }> = ({ src, start = 0 }) => (
  <AbsoluteFill><OffthreadVideo muted src={staticFile(`plate/${src}.mp4`)} startFrom={sec(start)} style={{ width: 1080, height: 1920 }} /></AbsoluteFill>
);
// 앞에 선 동료(720×1280을 키움, 말은 범수에 맞춰 빠르기만 맞춤)
const Face: React.FC<{ src: string; start: number; rate?: number; z?: number; origin?: string }> = ({ src, start, rate = 1, z = 1, origin = '540px 560px' }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}><OffthreadVideo muted src={staticFile(`plate/${src}.mp4`)} startFrom={sec(start)} playbackRate={rate} style={{ width: 1080, height: 1920, transformOrigin: origin, transform: `scale(${z})` }} /></AbsoluteFill>
);

// 자막(말과 같은 글) — 판 위에(흰 기본 글자 없음)
const Cap: React.FC<{ text: React.ReactNode; from: number; to: number; y?: number; me?: boolean; num?: number; size?: number }> = ({ text, from, to, y = 940, me, num, size = 54 }) => {
  const f = useCurrentFrame();
  const a = sec(from), b = sec(to);
  if (f < a || f >= b) return null;
  const o = Math.min(interpolate(f, [a, a + 2], [0, 1], clamp), interpolate(f, [b - 2, b], [1, 0], clamp));
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: y, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ fontFamily: KO, fontWeight: 800, fontSize: size, lineHeight: 1.26, letterSpacing: -1.2, color: me ? '#141414' : '#fff', textAlign: 'center', wordBreak: 'keep-all',
        background: me ? '#ffffff' : 'rgba(14,14,14,0.94)', padding: '12px 26px', borderRadius: 16, maxWidth: 960, display: 'flex', alignItems: 'center', gap: 16 }}>
        {num ? <span style={{ flex: 'none', width: 62, height: 62, borderRadius: 31, background: '#ffd84a', color: '#141414', fontWeight: 900, fontSize: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{num}</span> : null}
        <span>{text}</span>
      </div>
    </div>
  );
};

// 실제 화면 칸 — 위 꼬리표는 무엇의 화면인지
const Card: React.FC<{ imgs: { src: string; w: number; h: number; dw?: number }[]; tag: string; from: number; to: number; y?: number; width?: number; tagSize?: number; children?: React.ReactNode }> = ({ imgs, tag, from, to, y = 1050, width = 960, tagSize = 28, children }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const k = interpolate(f, [sec(from), sec(from) + 5], [0.94, 1], { ...clamp, easing: EASE_OUT });
  const o = interpolate(f, [sec(from), sec(from) + 3], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: (1080 - width) / 2, width, top: y, transform: `scale(${k})`, opacity: o, transformOrigin: '50% 50%' }}>
      <div style={{ display: 'inline-block', fontFamily: KO, fontWeight: 700, fontSize: tagSize, color: '#141414', background: '#e8e8e8', padding: '3px 14px', borderRadius: '10px 10px 0 0' }}>{tag}</div>
      <div style={{ background: '#2e2e2e', borderRadius: '0 16px 16px 16px', overflow: 'hidden', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
        {imgs.map((m, i) => {
          const w = m.dw ?? width;
          return <Img key={i} src={staticFile(`img/${m.src}.png`)} style={{ display: 'block', width: w, height: Math.round((m.h * w) / m.w), margin: '0 auto' }} />;
        })}
        {children}
      </div>
    </div>
  );
};

// 형광 줄(카드 안 왼쪽에서 그어 나감)
const Mark: React.FC<{ on: number; x: number; y: number; w: number; h: number; color?: string }> = ({ on, x, y, w, h, color = 'rgba(255,214,10,0.36)' }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [sec(on), sec(on) + 8], [0, 1], { ...clamp, easing: EASE_OUT });
  return <div style={{ position: 'absolute', left: x, top: y, width: w * p, height: h, background: color, borderRadius: 6 }} />;
};

// 세 칸(한도 · 파일 · 긴 문서) — 답이 나오면 「아니요」 메모가 붙는다. 무료 칸부터 초록 판 「셋 다 아니요 = 무료로 충분」
const Slots: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const items = [
    { t: '한도 알림', on: vo('p02'), pen: 'no1' },
    { t: '파일 · 사진', on: vo('n11'), pen: 'no2' },
    { t: '긴 문서', on: vo('p04'), pen: 'no3' },
  ];
  const g = interpolate(f, [sec(S.free), sec(S.free) + 5], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 60, width: 960, top: 1272, height: 150 }}>
      <div style={{ display: 'flex', gap: 14, opacity: 1 - g }}>
        {items.map((m) => {
          const a = sec(m.on);
          const shown = f >= a;
          const k = interpolate(f, [a, a + 4], [1.5, 1], { ...clamp, easing: EASE_OUT });
          const wipe = interpolate(f, [a, a + 7], [0, 100], clamp);
          return (
            <div key={m.t} style={{ flex: 1, height: 146, background: 'rgba(14,14,14,0.94)', borderRadius: 14, position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontFamily: KO, fontWeight: 800, fontSize: 34, color: '#fff', textAlign: 'center', marginTop: 8, letterSpacing: -0.8 }}>{m.t}</div>
              {shown ? (
                <div style={{ position: 'absolute', left: 16, right: 16, top: 56, height: 80, background: '#ffe873', borderRadius: 6, transform: `scale(${k}) rotate(-2.5deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Img src={staticFile(`img/pen_${m.pen}.png`)} style={{ height: 70, clipPath: `inset(0 ${100 - wipe}% 0 0)` }} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {g > 0 ? (
        <div style={{ position: 'absolute', inset: 0, background: '#15803d', borderRadius: 16, opacity: g, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.94 + 0.06 * g})` }}>
          <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 70, color: '#fff', letterSpacing: -2 }}>셋 다 아니요 = 무료로 충분</div>
        </div>
      ) : null}
    </div>
  );
};

// 큰 숫자(₩29,000에 빨간 동그라미 뒤) — 셈이 보이게
const Big: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  const k = interpolate(f, [sec(from), sec(from) + 5], [1.25, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 1000, display: 'flex', justifyContent: 'center', transform: `scale(${k})` }}>
      <div style={{ fontFamily: KO, fontWeight: 900, fontSize: 92, lineHeight: 1.14, letterSpacing: -3, color: '#fff', background: '#d92d27', padding: '14px 34px 18px', borderRadius: 18, textAlign: 'center' }}>
        <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1, opacity: 0.96 }}>₩29,000 × 12달</div>
        1년이면 34만 8천 원
      </div>
    </div>
  );
};

// 작은 표시
const Mini: React.FC<{ text: string; from: number; to: number; x?: number; y?: number; right?: number }> = ({ text, from, to, x, y = 60, right }) => {
  const f = useCurrentFrame();
  if (f < sec(from) || f >= sec(to)) return null;
  return <div style={{ position: 'absolute', left: x, right, top: y, fontFamily: KO, fontWeight: 700, fontSize: 28, color: '#fff', background: 'rgba(14,14,14,0.82)', padding: '4px 14px', borderRadius: 8 }}>{text}</div>;
};

const Sfx: React.FC<{ at: number; src: string; v?: number }> = ({ at, src, v = 0.5 }) => (
  <Sequence from={sec(at)}><Audio src={staticFile(`sfx/${src}.wav`)} volume={v * 0.8} /></Sequence>
);

// 동료 판: face-map.json(scripts/face_map.py)이 판 안 말 덩어리를 대사 자리에 맞춘 조각들
const FacePieces: React.FC = () => (
  <>
    {(FACE as { src: string; at: number; to: number; start: number; rate: number; z?: number }[]).map((p, i) => (
      <React.Fragment key={i}>{seq(p.at, p.to, <Face src={p.src} start={p.start} rate={p.rate} z={p.z} />)}</React.Fragment>
    ))}
  </>
);

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  // 배경음: 첫 사건 동안은 없음 → 질문부터 낮게 → 두 번째 탁에서 뚝 끊김(웃음 자리) → 점심 그림에서 다시
  const bgmV = interpolate(f, [sec(S.q - 0.2), sec(S.q + 0.2), sec(S.slap2) - 1, sec(S.slap2)], [0, 0.16, 0.16, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#0e0e0e' }}>
      {/* 첫 사건 — 장면 v2와 같은 일(결제 화면만 ChatGPT로) */}
      {seq(0, S.faceA, <Plate src="pov_A" />)}
      <FacePieces />
      {/* 대답은 휴대폰 쪽 — 실제 임시 채팅 「오늘 점심 뭐 먹지?」가 끝 말의 복선이다 */}
      {seq(S.chat, S.laugh, <Plate src="pov_chat" />)}
      {seq(S.povFile, S.q3, <Plate src="pov_file" />)}
      {seq(S.povFree, S.n08, <Plate src="pov_free" />)}
      {/* 1년 값 → 그래도 엄지 → 다시 탁 */}
      {seq(S.strike, S.creep, <Plate src="pov_strike" />)}
      {seq(S.creep, S.faceEnd, <Plate src="pov_end" />)}
      {seq(S.lunch, S.total, <Face src="lunch" start={0.3} z={1.22} origin="250px 1700px" />)}

      {/* 글 */}
      <Cap text="AI 유료 결제 1초 전" from={0} to={S.slap} y={210} size={54} />
      <Cap text="잠깐, 그거 어디 쓰려고?" from={vo('n01')} to={S.faceA} y={210} />
      <Cap text="잠깐, 그거 어디 쓰려고?" from={S.faceA} to={vo('p01')} />
      <Mini text="AI로 만든 재연이에요" from={S.faceA} to={S.faceB} x={60} y={1432} />
      <Cap text="다들 쓴다길래…" from={vo('p01')} to={S.faceB} me />
      <Cap text="다들 뭐에 쓰는데?" from={S.faceB} to={vo('p06')} />
      <Cap text="…몰라." from={vo('p06')} to={S.chat} me size={64} />
      <Cap text="어제 뭐 물어봤어?" from={S.chat} to={vo('p07')} y={190} size={60} />
      <Cap text="…오늘 점심 뭐 먹지." from={vo('p07')} to={S.laugh} y={190} me size={60} />

      <Cap text="한도 다 썼다는 알림, 본 적 있어?" from={S.q} to={vo('p02')} num={1} size={50} />
      <Cap text="아니." from={vo('p02')} to={vo('n04')} me size={64} />
      <Cap text="파일이나 사진, 매일 올려?" from={vo('n04')} to={S.povFile} num={2} />
      <Cap text="어… 가끔?" from={vo('p03')} to={vo('n11')} y={210} me size={64} />
      <Cap text="가끔이면 됐고." from={vo('n11')} to={S.q3} y={210} />
      <Cap text="긴 문서, 통째로 넣어?" from={S.q3} to={vo('p04')} num={3} />
      <Cap text="…아니." from={vo('p04')} to={S.free} me size={64} />
      <Card imgs={[{ src: 'card_help', w: 972, h: 58 }]} tag="파일 · 사진 · 음성은 쓰는 양에 한도가 있어요" tagSize={44} from={S.q + 0.3} to={vo('n04')}>
        <Mark on={S.q + 0.7} x={0} y={0} w={348} h={58} />
      </Card>
      <Card imgs={[{ src: 'card_file', w: 1098, h: 144 }]} tag="ChatGPT 무료 요금제(실제 화면)" tagSize={34} from={vo('n04')} to={S.povFile}>
        <Mark on={vo('n04') + 0.5} x={520} y={18} w={280} h={92} />
      </Card>
      <Slots from={S.q + 0.3} to={S.n08} />

      <Cap text="그럼 무료로 충분해." from={S.free} to={S.povFree} size={62} />
      <Cap text="진짜?" from={vo('p08')} to={vo('n07')} y={210} me size={64} />
      <Cap text="챗GPT는 글로만 묻는 건, 무료도 무제한이야." from={vo('n07')} to={S.n08} y={210} />
      <Cap text="하나라도 '예'면," from={S.n08} to={S.pay2} size={62} />
      <Cap text="그때 결제해." from={S.pay2} to={S.strike} size={62} />

      <Big from={S.strike + 0.35} to={S.creep + 0.3} />
      <Cap text="그래도 한 달만…" from={vo('p05')} to={S.slap2} y={210} me />
      <Cap text="그 돈으로 점심이나 사." from={S.faceEnd} to={S.total} size={62} />
      <Mini text="SYNK 브리핑" from={S.total - 3} to={S.total} right={60} y={120} />

      {/* 소리 — 첫 사건 동안 방 소리와 초침, 탁에서 초침이 멈춘다 */}
      <Audio src={staticFile('sfx/room.wav')} volume={(fr: number) => 0.35 * interpolate(fr, [0, 6, sec(S.q - 0.1), sec(S.q + 0.2)], [0.5, 1, 1, 0], clamp)} />
      <Sfx at={0.05} src="tick" v={0.25} />
      <Sfx at={0.55} src="tick" v={0.25} />
      <Sfx at={1.05} src="tick" v={0.25} />
      <Sequence from={sec(S.q - 0.2)}><Audio src={staticFile('bgm.wav')} volume={() => bgmV * 0.8} /></Sequence>
      <Sequence from={sec(S.lunch)}><Audio src={staticFile('plate/lunch_a.wav')} startFrom={sec(0.3)} volume={0.9} /></Sequence>
      <Sequence from={sec(S.lunch)}><Audio src={staticFile('bgm.wav')} startFrom={sec(19)} volume={(fr: number) => 0.13 * interpolate(fr, [0, 4, 36, 44], [0, 1, 1, 0], clamp)} /></Sequence>
      {/* V1 환경음과 탁 — 첫 탁은 V1 원본 2.56초, 끝 탁도 같은 소리 */}
      <Audio src={staticFile('plate/V1_a.wav')} startFrom={sec(1.1)} endAt={sec(5.46)} volume={0.9} />
      <Sequence from={sec(S.slap2 - 2.01)}><Audio src={staticFile('plate/V1_a.wav')} startFrom={sec(0.55)} endAt={sec(3.2)} volume={0.9} /></Sequence>
      <Sfx at={S.slap - 0.01} src="hand" v={0.45} />
      <Sfx at={S.slap2 - 0.01} src="hand" v={0.55} />
      {(PLACE as { id: string; at: number }[]).map((c) => (
        <Sequence key={c.id} from={c.at}><Audio src={staticFile(`vo/${c.id}.wav`)} volume={0.8} /></Sequence>
      ))}
      <Sfx at={vo('p02')} src="pen" v={0.35} />
      <Sfx at={vo('n11')} src="pen" v={0.35} />
      <Sfx at={vo('p04')} src="pen" v={0.35} />
      <Sfx at={S.free} src="tok" v={0.4} />
      <Sfx at={S.strike + 0.2} src="pen" v={0.45} />
    </AbsoluteFill>
  );
};
