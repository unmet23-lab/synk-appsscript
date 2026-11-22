// LAB 몽골 M72 「있어요 → 계세요」(11-22) — M56 「성함」의 Film.tsx(그 뿌리 M50 「생신」 · M11 「미안 · 죄송합니다」 v9)를 옮겼다(고정 카메라 · 칸마다 같은 인형들의 자세만 바뀜 · 반전 · 끝).
// M56과 다른 것: 무대가 교무실 책상(판짜기 1.12배 · 위 180px — 생각 구름 자리), 반전 알약이 「존중 4/3 ❌」(높임이 넘침 — CELLS의 over), 카메라 축이 구름 쪽(CAM.origin).
// 그림은 칸마다 기준 판(g1, 컵이 나온 뒤는 g5)을 참고로 구운 한 장(누끼 · 얹기 없음)을 판/_판짜기.py가 1080×1920 화면 판으로 미리 짠 것 — 카메라는 고정, 칸은 박자에 바로 바뀐다.
// 화면 글은 원본과 같은 흰 말풍선에 단계 알약 · 몽골 뜻 · 한글 · 키릴 읽기 · 꼬리 — 인형들 얼굴을 비켜 아래 계산대 앞판 자리에 둔다.
// M50과 다른 것: 할아버지도 말한다(CELLS의 who 'g' — 꼬리가 할아버지를 가리키고 알약이 없다). 할머니 이름표 칸(boss)은 그리지 않는다(M50 v8 그대로).
// 판본 틀(11-10): 뜻 · 읽는 법 · 꼬리 · 단계 · 상황 줄 · 끝 카드 · 끝 질문은 판본/<KEY>.json(판본.ts)에서 읽는다 — 그림 · 한국어 · 목소리 · 박자는 그대로.
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { EN, KO } from '../lib/fonts';
import { CAM, CELLS, END_AT, FPS, PUNCH, SFX, TOTAL } from './data';
import { LocPack } from './판본';

const fr = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const MASTER = 0.8; // Remotion은 소리를 16비트로 더해 넘치면 자른다 — 모든 볼륨에 같은 값을 곱한다(현장 노트)
export const TOTAL_FRAMES = fr(TOTAL);
export { FPS };

const INK = '#2B2522';
const CORAL = '#E8503D';
const MEAN = '#B23A26'; // 뜻 줄 — 흰 말풍선 위 진한 산호
const OK = '#0A9A66'; // 맞는 말 — 초록 + ✓(제작 절차 「맞는 말 · 틀린 말」 11-19)
const NG = '#D92D20'; // 틀린 말 — 빨강 + ✗ · 짚은 낱말에 줄
const HL = 'linear-gradient(transparent 58%, #FFE36A 58%, #FFE36A 92%, transparent 92%)'; // 바뀌는 낱말 — 형광 밑줄(맞음 · 틀림이 아닌 강조)
const BUBBLE_TOP = 1030; // 말풍선 위 끝(px) — 책상 앞 모서리(약 1080px)에 살짝 걸침(이해 시험 v1 뒤 1090 → 1030 — 세 줄 말풍선이 아래 앱 글자 자리 1428px를 넘지 않게)
const TAIL_TIP: [number, number] = [800, 975]; // 꼬리 끝 — 책상 위 몽글 자리(밑단 가운데 약 800 · 958px 바로 아래 — 판/_판짜기.py 1.12배 · Y0 180)
const G_TAIL_TIP: [number, number] = [250, 975]; // 선생님이 말할 때 꼬리 끝 — 책상 위 선생님 손 앞
const SCENE_LEFT = 395; // 0~4.6초 상황 줄 · 끝 카드 자리(왼쪽 끝 px) — 게시판 오른쪽 · 선생님 머리 오른쪽 위 벽

const cellAt = (sec: number) => {
  let i = 0;
  CELLS.forEach((c, k) => {
    if (sec >= c.at) i = k;
  });
  return i;
};

// 판은 이미 1080×1920(판/_판짜기.py — 구운 판 1.18배 · 왼쪽 40px · 위 280px 자름, 모자란 아래는 나무 앞판을 거울로) — 카메라는 고정, 칸 안에서만 아주 천천히 다가간다
const Plate: React.FC<{ src: string; push: number }> = ({ src, push }) => (
  <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#2a1d16' }}>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '45% 32%', transform: `scale(${push})` }} />
  </AbsoluteFill>
);

// 단계 알약 글 — 판본 level의 {n} 자리에 단계 수
// M56 이해 시험 v2 · v3: haiku가 두 번 「숫자가 무엇을 세는지 모름」 — 수는 「n/3」으로 셋 가운데 몇인지 보인다(글은 그대로)
const levelText = (L: LocPack, n: number | string) => L.level.split('{n}').join(typeof n === 'number' ? `${n}/3` : n);
// M72 이해 시험 v1: 시험관 넷이 「3/3 · 4/3」 숫자를 못 읽거나 헷갈려 함 — 알약은 판본 pills(누구에게 쓰는 말인가)로 쓴다
const pillText = (L: LocPack, lv: number | string) => (typeof lv === 'number' ? L.pills[lv - 1] : L.pills[4]);

const Bubble: React.FC<{ i: number; L: LocPack }> = ({ i, L }) => {
  const frame = useCurrentFrame();
  const c = CELLS[i];
  // 판본 글(판본/<KEY>.json): 뜻 · 꼬리는 말풍선 차례 c.b로, 읽는 법은 배울 세 낱말(단계 1~3)만
  const read = typeof c.level === 'number' && c.level <= L.reads.length ? L.reads[c.level - 1] : undefined;
  const tip = c.who === 'g' ? G_TAIL_TIP : TAIL_TIP;
  const mean = L.means[c.b];
  const meanSize = L.meanSizes[c.b];
  const tag = L.tags[c.b] || undefined;
  // 칸이 바뀔 때 말풍선만 4프레임 살짝 튀어나온다(그림은 바로 바뀜)
  const p = c.cont ? 1 : interpolate(frame, [fr(c.at), fr(c.at) + 4], [0.9, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const enFont = L.font;
  // 목소리 박자대로 밝아지는 줄 — v5부터 줄 전체가 처음부터 흐리게 보이고, 말한 낱말만 진해진다(3.2초 동안 끝 낱말까지 읽히게)
  const koLine = c.words ? (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.16 }}>
      {c.words.map(([w, t, hot], k) => {
        if (w === '\n') return <br key={k} />;
        const at = fr(c.voAt + t);
        const q = interpolate(frame, [at, at + 3], [0, 1], clamp);
        return (
          <span key={k} style={{ display: 'inline-block', opacity: 0.55 + 0.45 * q, // v6: 아직 말 안 한 낱말을 0.32 → 0.55로(이해 시험 v6 「흐린 글씨 연출의 의도를 모름」)
            transform: `scale(${1 + 0.06 * q * (1 - q) * 4})`, color: hot && q > 0.5 ? CORAL : INK, marginRight: 18 }}>
            {w}
          </span>
        );
      })}
    </div>
  ) : (
    <div style={{ fontFamily: KO, fontWeight: 800, fontSize: c.koSize, color: INK, lineHeight: 1.16, whiteSpace: 'pre-line' }}>
      {c.hot && c.ko.includes(c.hot)
        ? c.ko.split(c.hot).map((part, k, all) => (
            <React.Fragment key={k}>
              {part}
              {k < all.length - 1 ? (
                <span
                  style={
                    c.mark === 'ng'
                      ? { color: NG, textDecoration: 'line-through', textDecorationThickness: 6 }
                      : c.mark === 'ok'
                        ? { color: OK }
                        : { background: HL, padding: '0 4px' }
                  }
                >
                  {c.hot}
                </span>
              ) : null}
            </React.Fragment>
          ))
        : c.ko}
    </div>
  );
  return (
    <>
      {/* 인형들 얼굴(위)을 비켜 아래 계산대 앞판 자리 — 꼬리 자리(몽글 760~816px · 할아버지 230~286px)가 늘 말풍선 안에 들게 가장 좁아도 560px, 할아버지 말은 왼쪽으로 붙인다 */}
      <div style={{ position: 'absolute', top: BUBBLE_TOP, left: c.who === 'g' ? 70 : 140, width: 800, display: 'flex', justifyContent: c.who === 'g' ? 'flex-start' : 'center' }}>
        <div
          style={{
            display: 'inline-block',
            minWidth: 560,
            maxWidth: 760,
            textAlign: 'center',
            background: '#FFFDF7',
            border: `6px solid ${INK}`,
            borderRadius: 48,
            padding: '14px 40px 16px',
            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            transform: `scale(${p})`,
            transformOrigin: c.who === 'g' ? '30% 0%' : '60% 0%',
          }}
        >
          {c.over ? (
            <div style={{ marginBottom: 4 }}>
              <span style={{ display: 'inline-block', background: NG, color: '#fff', fontFamily: enFont, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {L.pills[3]}
              </span>
            </div>
          ) : null}
          {c.zero ? (
            <div style={{ marginBottom: 4 }}>
              <span style={{ display: 'inline-block', background: INK, color: '#fff', fontFamily: enFont, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {levelText(L, 0)} ❌
              </span>
            </div>
          ) : null}
          {/* 단계 알약 — 1 · 2단계는 짙은 색(산호색은 8초 틀린 말 빨강 알약과 거의 같아 보여서 · 맞음 · 틀림이 아닌 강조에는 빨강 · 초록 계열을 쓰지 않는다), 3단계 맞는 말은 초록 */}
          {c.level ? (
            <div style={{ marginBottom: 4 }}>
              <span style={{ display: 'inline-block', background: c.mark === 'ok' ? OK : INK, color: '#fff', fontFamily: enFont, fontWeight: 800, fontSize: 44, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999 }}>
                {pillText(L, c.level)}
              </span>
            </div>
          ) : null}
          <div style={{ fontFamily: enFont, fontWeight: 800, fontSize: meanSize, color: MEAN, lineHeight: Math.max(1.16, L.lineH), marginBottom: 8, whiteSpace: 'pre-line' }}>
            {mean}
          </div>
          {koLine}
          {/* v5: 읽기 44 → 50px · 꼬리 40 → 44px(이해 시험 v4 셋이 「작은 줄을 못 읽음」) */}
          {/* 두 채널 판(11-14): 로마자 「saeng-sin chu-ka-deu-ryeo-yo」(28자)는 50px로 말풍선 안 폭(680px)을 넘어 「yo」만 줄이 넘어갔다 — 긴 읽기만 44px 한 줄 */}
          {/* M56 이해 시험 v2: GPT · 그록 둘이 「한글 아래 읽기 줄이 작아 못 읽음」 — 읽기 50 → 54px(22자 「сонхами оттокэ двэсэё?」가 말풍선 안 폭 680px에 한 줄로 드는 크기) · 색 한 단계 진하게, 꼬리 44 → 46px(48px는 3단계 꼬리가 「✓」에서 줄이 넘어 앱 글자 자리에 닿음) */}
          {/* M72 이해 시험 v2: 그록 · GPT 「읽기 줄이 작아 못 읽음」 — 읽기 54 → 58px, 꼬리 52 → 56px */}
          {read ? <div style={{ fontFamily: EN, fontWeight: 800, fontSize: read.length > 22 ? 44 : 58, whiteSpace: 'nowrap', color: '#3A2D24', lineHeight: 1.15, marginTop: 2 }}>{read}</div> : null}
          {tag ? <div style={{ marginTop: 8, fontFamily: enFont, fontWeight: 800, fontSize: 56, color: '#3A2D24', lineHeight: Math.max(1.15, L.lineH), whiteSpace: 'pre-line' }}>→ {tag}</div> : null}
        </div>
      </div>
      {/* 꼬리 — 말풍선 위 끝에서 계산대 위 말하는 인형으로 */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: p }}>
        <path
          d={`M ${tip[0] - 30} ${BUBBLE_TOP + 8} L ${tip[0] + 26} ${BUBBLE_TOP + 8} L ${tip[0]} ${tip[1]} Z`}
          fill="#FFFDF7"
          stroke={INK}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <rect x={tip[0] - 27} y={BUBBLE_TOP + 5} width={50} height={9} fill="#FFFDF7" />
      </svg>
    </>
  );
};

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile('bgm.wav')} volume={(i) => 0.19 * MASTER * interpolate(i, [fr(TOTAL) - 20, fr(TOTAL)], [1, 0], clamp)} />
    {CELLS.filter((c) => c.vo).map((c) => (
      <Sequence key={c.vo} from={fr(c.voAt)} layout="none">
        <Audio src={staticFile(`vo/${c.vo}.wav`)} volume={MASTER} startFrom={c.voFrom ? fr(c.voFrom) : undefined} endAt={c.voTo ? fr(c.voTo) : undefined} />
      </Sequence>
    ))}
    {SFX.map(([t, f, v]) => (
      <Sequence key={`${t}-${f}`} from={fr(t)} layout="none">
        <Audio src={staticFile(`sfx/${f}`)} volume={v * MASTER} endAt={f === 'wind.wav' ? fr(0.9) : undefined} />
      </Sequence>
    ))}
  </>
);

// 끝 카드 · 끝 질문(판본 endCard · ask, 선택) — 마지막 칸 말 뒤(END_AT) 할아버지 모자 오른쪽, 0~4.6초 상황 줄과 같은 자리 · 같은 꼴.
// 둘 다 비우면 그리지 않는다(몽골판 그대로). 오른쪽 끝 900px — 오른쪽 단추 자리(920px) 안.
const EndCard: React.FC<{ L: LocPack }> = ({ L }) => {
  const frame = useCurrentFrame();
  if (frame < fr(END_AT) || (!L.endCard && !L.ask)) return null;
  const p = interpolate(frame, [fr(END_AT), fr(END_AT) + 5], [0.86, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <div style={{ position: 'absolute', left: SCENE_LEFT + 20, top: 290, maxWidth: 540, textAlign: 'left', transform: `scale(${p})`, transformOrigin: '0% 0%' }}>
      <span style={{ display: 'inline-block', background: '#FFFDF7', color: INK, border: `4px solid ${INK}`, boxShadow: '0 6px 16px rgba(0,0,0,0.3)', fontFamily: L.font, fontWeight: 800, lineHeight: Math.max(1.2, L.lineH), padding: '10px 22px 12px', borderRadius: 22, whiteSpace: 'pre-line' }}>
        {L.endCard ? <span style={{ display: 'block', fontSize: L.endSize, color: CORAL }}>{L.endCard}</span> : null}
        {L.ask ? <span style={{ display: 'block', fontSize: L.askSize, color: '#4F3F33', marginTop: L.endCard ? 6 : 0 }}>{L.ask}</span> : null}
      </span>
    </div>
  );
};

// L = 판본 글(판본/<KEY>.json) — Root가 판본마다 컴포지션 gyeseyo-<KEY>로 넘긴다
// bare = 장면 심사용(제목 · 이름표 · 말풍선 · 끝 카드 없이 그림과 소리만 — 제작 절차 「한 장면 먼저」 ①)
export const Film: React.FC<{ L: LocPack; bare?: boolean }> = ({ L, bare }) => {
  const frame = useCurrentFrame();
  const i = cellAt(frame / FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a1d16' }}>
      {/* 칸 안의 아주 느린 다가감 + 핵심 장면 카메라(CAM — 「근데…」부터 끝까지 다가가고, 커피를 뿜을 때 살짝 흔들림) */}
      <AbsoluteFill
        style={{
          transformOrigin: CAM.origin, // 생각 구름 쪽 — 구름의 왕관이 위로 밀려 앱 머리 자리에 들지 않게
          transform: `translateX(${frame >= fr(CAM.shakeFrom) && frame < fr(CAM.shakeTo) ? Math.sin(frame * 2.1) * 5 : 0}px) scale(${1 + CAM.zoom * interpolate(frame, [fr(CAM.from), fr(CAM.to)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) })})`,
        }}
      >
        <Plate
          src={CELLS[i].img}
          push={
            interpolate(frame, [fr(CELLS[i].at), fr(i + 1 < CELLS.length ? CELLS[i + 1].at : TOTAL)], [1, 1.035], clamp) *
            // 단계 당기기(data.ts PUNCH) — 칸이 바뀌는 4프레임 동안 앞 칸 배율에서 이 칸 배율로
            interpolate(frame, [fr(CELLS[i].at), fr(CELLS[i].at) + 4], [i > 0 ? PUNCH[i - 1] ?? 1 : 1, PUNCH[i] ?? 1], { ...clamp, easing: Easing.out(Easing.cubic) })
          }
        />
      </AbsoluteFill>
      {/* 상황 한 줄 — 어디서 누구에게(0~4.6초) · 판본의 첫 2초 카드. 첫 렌더에서 한 줄(nowrap)이 오른쪽 끝을 넘어 잘려 판본 글의 줄 바꿈으로 두 줄 */}
      {!bare && frame < fr(CELLS[3].at) ? (
        <div style={{ position: 'absolute', left: SCENE_LEFT, top: 290, maxWidth: 600, textAlign: 'left' }}>
          <span style={{ display: 'inline-block', whiteSpace: 'pre-line', background: '#FFFDF7', color: INK, border: `4px solid ${INK}`, boxShadow: '0 6px 16px rgba(0,0,0,0.3)', fontFamily: L.font, fontWeight: 800, fontSize: L.sceneSize, lineHeight: Math.max(1.2, L.lineH), padding: '10px 22px 12px', borderRadius: 22 }}>{L.scene}</span>
        </div>
      ) : null}
      {/* 할머니 이름표(0~2.3초) — 할머니 가디건 위, 「👆」가 얼굴을 가리킨다 */}
      {/* v8: 할머니 이름표는 그리지 않는다 — 카본 맹검 「이름표가 할머니 팔 · 국그릇을 덮고 템플릿 티」, 상황 줄과 그림만으로 할머니가 읽힌다(판본 boss 칸은 틀 호환으로 남김) */}
      {false && !bare && frame < fr(CELLS[2].at) ? (
        <div style={{ position: 'absolute', left: 50, top: 730, opacity: interpolate(frame, [0, 4], [0, 1], clamp) }}>
          <span style={{ display: 'inline-block', background: '#FFFDF7', color: INK, border: `5px solid ${INK}`, fontFamily: L.font, fontWeight: 800, fontSize: 52, lineHeight: 1, padding: '10px 24px 12px', borderRadius: 999, boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }}>👆 {L.boss}</span>
        </div>
      ) : null}
      {bare ? null : <Bubble i={i} L={L} />}
      {bare ? null : <EndCard L={L} />}
      <Sound />
    </AbsoluteFill>
  );
};
