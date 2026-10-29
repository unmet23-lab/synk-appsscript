// B16 여덟 장면. 원본(우리편 「AI 유료 구독, 하나만 고른다면」)의 장면 자리 · 장면 안 박을 그대로 두고 내용만 바꿨다(기획.md 「원본 1:1」).
// 실제 화면은 2026-10-29 ego로 찍은 유료(Pro) 계정 ChatGPT 웹과 OpenAI 한국어 도움말이다(설정은 보기만). 그림 좌표는 원본 픽셀.
// v4(이해 시험 v3 반영): 오해 장면을 O/X로, 강조를 검은 띠로, 짚기를 스포트라이트로, 긴 도움말 문단은 그 줄만 잘라 작게, 끝 말 「내 번호」.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, EASE_OUT } from './lib/anim';
import { Band, BigNum, camAt, Check, fadeUp, Head, Mark, Pill, QChip, settle, Shot, Source, Spot, Stamp, Title, YesNo } from './parts';
import { at, E, land } from './time';
import { C, F, L } from './theme';

// 그림 크기(원본 픽셀)
const DC = { src: 'img/dc.png', w: 1080, h: 2341 }; // 휴대폰 폭 설정 > 데이터 관리
const HOME = { src: 'img/home.png', w: 1080, h: 2341 };
const TYPED = { src: 'img/temp-typed.png', w: 1080, h: 2341 }; // 임시 채팅에 회사 공지 부탁을 넣은 화면(보내기 전)
const ANS = { src: 'img/answer.png', w: 1080, h: 2341 };
const PRO = { src: 'img/pro.png', w: 1016, h: 151 }; // 계정 화면의 「계정 상태 Pro」 줄만
const PC = { src: 'img/pc.png', w: 2256, h: 1520 }; // PC 폭 설정(왼쪽 메뉴 포함, 계정 사진 칸은 잘라 냄)
const BIZ = { src: 'img/help-biz.png', w: 1050, h: 372 };
const FB = { src: 'img/help-feedback.png', w: 1050, h: 372 };

const TITLE_Y = 470;
const W = 836; // 판 폭(오른쪽 160 안쪽)
const TOGGLE = { x: 893, y: 410, w: 108, h: 96 }; // 데이터 관리 화면의 학습 허용 토글
const ROW = { x: 72, y: 352, w: 946, h: 206 }; // 그 줄 전체(이름 + 토글)

/** 장면 안에서 두 판을 바꿔 끼울 때: t 앞은 a, 뒤는 b */
const swap = (f: number, t: number) => interpolate(f, [t - 2, t + 4], [0, 1], { ...clamp, easing: EASE_OUT });

/** 도움말 문단 판(그 줄 언저리만 잘라서): 흰 종이 카드 + 위 꼬리표 */
const HelpCrop: React.FC<{ img: typeof BIZ; y: number; cy: number; h: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({ img, y, cy, h, children, style }) => {
  const z = W / img.w;
  return (
    <div style={{ position: 'absolute', left: L.X, top: y, width: W, ...style }}>
      <div style={{ font: `700 26px/1 ${F.ko}`, color: C.lapisDeep, letterSpacing: '-.02em', margin: '0 0 12px 4px' }}>OpenAI 도움말 원문 · 2026.10.29 확인</div>
      <Shot src={img.src} w={img.w} h={img.h} box={{ x: 0, y: 0, w: W, h }} cam={{ cx: img.w / 2, cy, z }} bg="#fff" radius={22} style={{ position: 'relative' }}>
        {children}
      </Shot>
    </div>
  );
};

// ── 01 훅(0~4.3초): 질문 제목 + 데이터 관리 실제 화면(토글 켜짐에 스포트라이트) + 칩 셋(원본처럼 1.8 · 2.5 · 3.0초)
export const Hook01: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Head />
      <Title visibleAtZero top={TITLE_Y} size={90} lines={['회사 일, ChatGPT에', <>그냥 <Mark p={1}>물어도 될까요?</Mark></>]} />
      <Shot {...DC} box={{ x: L.X, y: 730, w: W, h: 440 }} cam={{ cx: 545, cy: 440, z: 0.83 }} stamp="유료(Pro) 계정 실제 화면">
        <Spot {...ROW} at={-10} dim={0.5} />
      </Shot>
      <div style={{ position: 'absolute', left: L.X, top: 1216, font: `800 34px/1 ${F.ko}`, color: C.muted, letterSpacing: '-.03em', ...fadeUp(f, 54, 12) }}>그래서, 고르는 질문 셋</div>
      <div style={{ position: 'absolute', left: L.X, top: 1270, display: 'flex', gap: 14 }}>
        <QChip n="1" label="한 번만?" at={54} />
        <QChip n="2" label="매일?" at={75} />
        <QChip n="3" label="회사 계정?" at={90} />
      </div>
    </AbsoluteFill>
  );
};

/** O/X 판: hit에 X가 빨갛게 찍히고 O는 흐려진다. hide에 사라진다. */
const OX: React.FC<{ y: number; hit: number; hide: number }> = ({ y, hit, hide }) => {
  const f = useCurrentFrame();
  const s = settle(f, hit, 20);
  const on = f >= hit;
  const out = interpolate(f, [hide - 2, hide + 4], [1, 0], clamp);
  const tile = (mark: string, label: string, x: number, active: boolean, dim: boolean): React.ReactNode => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 400,
        height: 230,
        borderRadius: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: active ? C.crayon : '#fff',
        color: active ? '#fff' : C.ink,
        boxShadow: active ? '0 30px 60px -28px rgba(160,40,20,.6)' : `inset 0 0 0 3px ${C.hair},0 20px 40px -26px rgba(40,30,10,.4)`,
        opacity: dim ? 0.35 : 1,
        scale: active ? String(interpolate(s, [0, 1], [1.18, 1], clamp)) : '1',
      }}
    >
      <span style={{ font: `900 120px/1 ${F.ko}` }}>{mark}</span>
      <span style={{ font: `800 36px/1 ${F.ko}`, letterSpacing: '-.03em' }}>{label}</span>
    </div>
  );
  return (
    <div style={{ opacity: out }}>
      {tile('O', '괜찮다', L.X, false, on)}
      {tile('X', '아니다', L.X + 436, on, false)}
    </div>
  );
};

// ── 02 오해(4.3~11.2초): 「돈 내면 괜찮다」? O/X → X → 「Pro」 줄 + 켜진 토글을 크게 다시 짜기
export const Myth02: React.FC = () => {
  const f = useCurrentFrame();
  const L0 = land('myth');
  const no = at('myth', E.mythNo);
  const zoom = at('myth', E.mythZoom);
  const s = swap(f, zoom);
  const t = settle(f, zoom + 2, 15);
  return (
    <AbsoluteFill>
      <Head />
      <Title at={L0} top={TITLE_Y} size={90} lines={['“돈 내면 괜찮다”?']} />
      <OX y={640} hit={no} hide={zoom} />
      {/* 실제 화면 한 컷(위 세 줄만) — O/X 아래에 */}
      <div style={{ opacity: 1 - s }}>
        <Shot {...DC} box={{ x: L.X, y: 910, w: W, h: 380 }} cam={{ cx: 545, cy: 420, z: 0.83 }} stamp="설정 > 데이터 관리 · 실제 화면" />
      </div>
      <Title at={zoom} top={TITLE_Y + 112} size={90} lines={[<>유료도 <Mark p={interpolate(f, [zoom + 6, zoom + 16], [0, 1], clamp)}>켜져 있어요</Mark></>]} />
      {/* 크게 다시 짜기: 계정 상태 줄 + 학습 허용 줄 */}
      <div style={{ opacity: s, translate: `0 ${(1 - t) * 40}px` }}>
        <Shot {...PRO} box={{ x: L.X, y: 780, w: W, h: 150 }} cam={{ cx: 508, cy: 75, z: 0.82 }} radius={26} stamp="실제 화면" />
        <Shot {...DC} box={{ x: L.X, y: 950, w: W, h: 250 }} cam={{ cx: 540, cy: 457, z: 0.87 }} radius={26}>
          <Spot {...TOGGLE} at={zoom + 8} dim={0.45} />
        </Shot>
        <div style={{ position: 'absolute', left: 700, top: 1216, padding: '12px 24px', borderRadius: 999, background: C.mark, font: `850 42px/1 ${F.ko}`, letterSpacing: '-.04em', color: C.ink, ...fadeUp(f, zoom + 12, 20) }}>켜짐</div>
      </div>
      <Source y={1300} at={zoom + 14}>
        학습 = 내 대화로 AI를 더 낫게 만드는 것 · 무료 · 플러스 · 프로 모두(OpenAI 도움말)
      </Source>
    </AbsoluteFill>
  );
};

// ── 03 질문 ①(11.2~18.2초): 한 번만? [예] → 첫 화면 오른쪽 위 임시 채팅 단추 → 회사 공지를 넣은 실제 임시 채팅(제목 줄 + 넣은 글) → 알약
export const Q1: React.FC = () => {
  const f = useCurrentFrame();
  const L0 = land('q1');
  const yes = at('q1', E.q1Yes);
  const tmp = at('q1', E.q1Temp);
  const pill = at('q1', E.q1Pill);
  const s = swap(f, tmp);
  return (
    <AbsoluteFill>
      <BigNum n="1" at={L0} />
      <Head />
      <div style={{ position: 'absolute', left: L.X, top: TITLE_Y - 6 }}>
        <QChip n="1" label="한 번만?" at={L0} on />
      </div>
      <Title at={L0 + 3} top={TITLE_Y + 92} size={88} lines={['한 번만 묻고', '끝인가요?']} />
      <YesNo x={L.X} y={TITLE_Y + 312} at={L0 + 6} tap={yes} />
      <div style={{ opacity: 1 - s }}>
        <Shot {...HOME} box={{ x: L.X, y: 900, w: W, h: 290 }} cam={{ cx: 945, cy: 66, z: 2.0 }} stamp="첫 화면 오른쪽 위">
          <Spot x={968} y={20} w={90} h={90} at={yes + 2} r={45} dim={0.5} />
        </Shot>
      </div>
      <div style={{ opacity: s }}>
        <Shot {...TYPED} box={{ x: L.X, y: 900, w: W, h: 190 }} cam={{ cx: 540, cy: 905, z: 0.82 }} radius={26} stamp="임시 채팅 · 실제 화면" />
        <Shot {...TYPED} box={{ x: L.X, y: 1104, w: W, h: 150 }} cam={{ cx: 540, cy: 1946, z: 0.82 }} radius={26} />
      </div>
      <Pill x={L.X} y={1276} w={W} lead="한 번만" result="임시 채팅" at={pill} />
    </AbsoluteFill>
  );
};

// ── 04 질문 ②(18.2~24.4초): 매일? [예] → PC 설정 왼쪽 메뉴(크게) → 「데이터 관리」 → 그 줄 크게 + 「이 칸 끄기」
export const Q2: React.FC = () => {
  const f = useCurrentFrame();
  const L0 = land('q2');
  const yes = at('q2', E.q2Yes);
  const path = at('q2', E.q2Path);
  const zoom = at('q2', E.q2Zoom);
  const s = swap(f, zoom);
  return (
    <AbsoluteFill>
      <BigNum n="2" at={L0} />
      <Head />
      <div style={{ position: 'absolute', left: L.X, top: TITLE_Y - 6 }}>
        <QChip n="2" label="매일?" at={L0} on />
      </div>
      <Title at={L0 + 3} top={TITLE_Y + 92} size={88} lines={['매일 쓰나요?']} />
      <YesNo x={L.X} y={TITLE_Y + 206} at={L0 + 6} tap={yes} />
      <div style={{ position: 'absolute', left: L.X, top: TITLE_Y + 316, display: 'flex', alignItems: 'center', gap: 14, font: `800 44px/1 ${F.ko}`, letterSpacing: '-.04em', color: C.ink, ...fadeUp(f, path, 18) }}>
        <span style={{ padding: '12px 20px', borderRadius: 14, background: '#fff', boxShadow: `inset 0 0 0 2px ${C.hair}` }}>설정</span>
        <span style={{ color: C.lapisDeep }}>→</span>
        <span style={{ padding: '12px 20px', borderRadius: 14, background: C.mark }}>데이터 관리</span>
      </div>
      <div style={{ opacity: 1 - s }}>
        <Shot {...PC} box={{ x: L.X, y: 900, w: W, h: 400 }} cam={{ cx: 330, cy: 1300, z: 1.05 }} stamp="PC 설정 · 실제 화면">
          <Spot x={14} y={1414} w={530} h={72} at={path + 2} dim={0.5} />
        </Shot>
      </div>
      <div style={{ opacity: s }}>
        <Shot {...DC} box={{ x: L.X, y: 900, w: W, h: 250 }} cam={{ cx: 540, cy: 457, z: 0.87 }} radius={26}>
          <Spot {...TOGGLE} at={zoom + 4} dim={0} />
        </Shot>
        <div style={{ position: 'absolute', left: 560, top: 1174, display: 'flex', alignItems: 'center', gap: 12, ...fadeUp(f, zoom + 8, 22) }}>
          <span style={{ padding: '14px 26px', borderRadius: 999, background: C.ink, color: '#fff', font: `850 44px/1 ${F.ko}`, letterSpacing: '-.04em' }}>이 칸 끄기</span>
        </div>
        <Source y={1270} at={zoom + 12}>
          대화 기록 · 메모리는 그대로, 새 대화부터 학습에 안 써요
        </Source>
      </div>
    </AbsoluteFill>
  );
};

/** 개인 계정 · 회사 계정 견줌 판 */
const VsCard: React.FC<{ x: number; y: number; name: string; plans: string; rule: string; good: boolean; at: number; hi?: number }> = ({ x, y, name, plans, rule, good, at: a, hi }) => {
  const f = useCurrentFrame();
  const s = settle(f, a, 16);
  const lit = hi !== undefined && f >= hi;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 400,
        height: 300,
        borderRadius: 28,
        padding: '30px 30px',
        boxSizing: 'border-box',
        background: good ? '#fff' : C.paperShade,
        boxShadow: lit ? `0 0 0 7px ${C.mark},0 26px 50px -26px rgba(60,40,0,.55)` : `inset 0 0 0 2px ${C.hair}`,
        opacity: interpolate(s, [0, 0.3], [0, good ? 1 : 0.85], clamp),
        translate: `0 ${(1 - s) * 50}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <span style={{ font: `900 50px/1 ${F.ko}`, letterSpacing: '-.045em', color: C.ink }}>{name}</span>
      <span style={{ font: `700 30px/1.2 ${F.ko}`, letterSpacing: '-.03em', color: C.muted }}>{plans}</span>
      <span style={{ marginTop: 'auto', font: `850 38px/1.2 ${F.ko}`, letterSpacing: '-.04em', color: good ? C.ink : C.crayon, display: 'flex', alignItems: 'center', gap: 10 }}>
        {rule}
        {good && lit ? <Check at={hi as number} size={48} /> : null}
      </span>
    </div>
  );
};

// ── 05 질문 ③(24.4~31.4초): 회사 계정? [예] → 개인 계정 · 회사 계정 견줌 → 회사 계정 쪽 + 원문 그 줄
export const Q3: React.FC = () => {
  const f = useCurrentFrame();
  const L0 = land('q3');
  const yes = at('q3', E.q3Yes);
  const hi = at('q3', E.q3Hi);
  return (
    <AbsoluteFill>
      <BigNum n="3" at={L0} />
      <Head />
      <div style={{ position: 'absolute', left: L.X, top: TITLE_Y - 6 }}>
        <QChip n="3" label="회사 계정?" at={L0} on />
      </div>
      <Title at={L0 + 3} top={TITLE_Y + 92} size={88} lines={['회사 계정이 있나요?']} />
      <YesNo x={L.X} y={TITLE_Y + 206} at={L0 + 6} tap={yes} />
      <div style={{ position: 'absolute', left: L.X, top: TITLE_Y + 312, font: `750 32px/1.2 ${F.ko}`, letterSpacing: '-.03em', color: C.muted, ...fadeUp(f, L0 + 8, 14) }}>회사 관리자가 따로 있는 업무용 ChatGPT</div>
      <VsCard x={L.X} y={840} name="개인 계정" plans="무료 · 플러스 · 프로" rule="켜져 있으면 학습" good={false} at={L0 + 8} />
      <VsCard x={L.X + 436} y={840} name="회사 계정" plans="비즈니스 · 엔터프라이즈" rule="기본으로 학습 X" good at={L0 + 11} hi={hi} />
      <HelpCrop img={BIZ} y={1170} cy={122} h={164} style={fadeUp(f, hi, 24)}>
        <Band x={28} y={158} w={560} h={54} at={hi + 4} />
      </HelpCrop>
    </AbsoluteFill>
  );
};

// ── 06 덤(반전, 31.4~38.9초): 꺼 둬도 이 단추 → 답 아래 평가 단추를 크게 → 그 줄(도움말 원문) → 도장
export const Extra06: React.FC = () => {
  const f = useCurrentFrame();
  const L0 = land('extra');
  const ring = at('extra', E.exRing);
  const doc = at('extra', E.exDoc);
  const hi = at('extra', E.exHi);
  const st = at('extra', E.exStamp);
  const cam = camAt(f, [
    [ring - 1, { cx: 540, cy: 1200, z: 0.74 }],
    [ring + 5, { cx: 250, cy: 1470, z: 2.3 }],
  ]);
  const up = settle(f, doc, 14);
  return (
    <AbsoluteFill>
      <Head />
      <Title at={L0} top={TITLE_Y} size={88} lines={['하나 더,', <>꺼 둬도 <Mark p={interpolate(f, [ring, ring + 10], [0, 1], clamp)}>이 단추는</Mark></>]} />
      <div style={{ opacity: interpolate(f, [doc - 1, doc + 4], [1, 0.45], clamp) }}>
        <Shot {...ANS} box={{ x: L.X, y: 740, w: W, h: 250 }} cam={cam} stamp="답 화면 · 실제 화면">
          <Spot x={110} y={1436} w={74} h={78} at={ring + 4} r={16} dim={0.45} />
        </Shot>
      </div>
      <div style={{ position: 'absolute', left: L.X + 8, top: 1008, font: `850 40px/1 ${F.ko}`, letterSpacing: '-.04em', color: C.ink, ...fadeUp(f, ring + 8, 14) }}>좋아요 · 싫어요</div>
      <HelpCrop img={FB} y={1070} cy={250} h={176} style={{ opacity: interpolate(up, [0, 0.4], [0, 1], clamp), translate: `0 ${(1 - up) * 200}px` }}>
        <Band x={498} y={224} w={494} h={56} at={hi} />
        <Band x={30} y={283} w={318} h={56} at={hi + 6} />
      </HelpCrop>
      <Stamp x={500} y={968} at={st} rotate={-5} size={46}>
        누르면 대화째
      </Stamp>
    </AbsoluteFill>
  );
};

/** 정리 줄: 번호 + 앞말 → 결론 + 체크. on 전에는 흐리다. */
const SumRow: React.FC<{ n: string; lead: string; result: string; y: number; on: number }> = ({ n, lead, result, y, on }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [on - 2, on + 5], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: L.X, top: y, width: W, display: 'flex', alignItems: 'center', gap: 18, padding: '24px 26px', borderRadius: 26, background: '#fff', boxShadow: `inset 0 0 0 2px ${C.hair},0 20px 40px -26px rgba(40,30,10,.45)`, opacity: 0.38 + 0.62 * p }}>
      <span style={{ width: 62, height: 62, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.ink, color: '#fff', font: `900 36px/1 ${F.ko}`, flex: 'none' }}>{n}</span>
      <span style={{ font: `750 40px/1.15 ${F.ko}`, color: C.muted, letterSpacing: '-.035em', whiteSpace: 'nowrap' }}>{lead}</span>
      <span style={{ font: `800 40px/1 ${F.ko}`, color: C.lapisDeep }}>→</span>
      <span style={{ font: `850 46px/1.15 ${F.ko}`, letterSpacing: '-.04em', flex: 1, color: C.ink }}>{result}</span>
      {f >= on ? <Check at={on} size={62} /> : <span style={{ width: 62 }} />}
    </div>
  );
};

// ── 07 정리(38.9~43.9초): 고르는 질문, 딱 셋 — 체크가 박마다 하나씩
export const Sum07: React.FC = () => {
  const L0 = land('sum');
  return (
    <AbsoluteFill>
      <Head />
      <Title at={L0} top={TITLE_Y} size={92} lines={['고르는 질문,', '딱 셋']} />
      <SumRow n="1" lead="한 번만" result="임시 채팅" y={760} on={L0 + 2} />
      <SumRow n="2" lead="매일" result="이 칸 끄기" y={920} on={at('sum', E.sum2)} />
      <SumRow n="3" lead="회사 계정" result="그 계정으로" y={1080} on={at('sum', E.sum3)} />
    </AbsoluteFill>
  );
};

// ── 08 끝(43.9초~): 「내 번호는?」 큰 번호 판 셋 → 「댓글에 숫자 하나」
export const End08: React.FC = () => {
  const f = useCurrentFrame();
  const L0 = land('end');
  const line = at('end', E.endLine);
  const tiles: [string, string][] = [
    ['1', '한 번만'],
    ['2', '매일'],
    ['3', '회사 계정'],
  ];
  const tw = 260;
  const gap = (W - tw * 3) / 2;
  return (
    <AbsoluteFill>
      <Head />
      <Title at={L0 - 6} top={TITLE_Y} size={110} lines={['내 번호는?']} />
      {tiles.map(([n, label], i) => {
        const s = settle(f, L0 + 3 + i * 3, 18);
        return (
          <div
            key={n}
            style={{
              position: 'absolute',
              left: L.X + i * (tw + gap),
              top: 700,
              width: tw,
              height: 300,
              borderRadius: 30,
              background: '#fff',
              boxShadow: `inset 0 0 0 3px ${C.hair},0 24px 48px -28px rgba(40,30,10,.45)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
              translate: `0 ${(1 - s) * 60}px`,
            }}
          >
            <span style={{ width: 130, height: 130, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.ink, color: '#fff', font: `900 84px/1 ${F.ko}` }}>{n}</span>
            <span style={{ font: `800 38px/1 ${F.ko}`, letterSpacing: '-.035em', color: C.ink }}>{label}</span>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: L.X, right: L.X, top: 1080, textAlign: 'center', font: `850 60px/1.1 ${F.ko}`, letterSpacing: '-.045em', color: C.ink, ...fadeUp(f, line, 22) }}>
        댓글에 <Mark p={interpolate(f, [line + 4, line + 14], [0, 1], clamp)}>숫자 하나</Mark>
      </div>
    </AbsoluteFill>
  );
};
