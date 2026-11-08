// 10번 도담중공업 「이 아이를 보냅니다」 내레이션 자막(2026-11-08, Claude) — 16:9 약 66초 · b2b-factory-20261026/최종편집.py가
//   화면(p10/picture.mp4 — 위아래 60px 띠와 끝 로고까지 구운 판) · 소리(p10/sound.wav)를 넣고 이 판을 굽는다.
//   시각: 최종소리.py가 내레이션 토막을 놓으며 쓴 timing.json(받아쓰기 낱말 시각) — 한 화면 한 문장, 1.5초 이상, 컷 경계 1~3장 앞뒤면 경계에 맞춤.
// 결(11-08 밤 유호님 「C4로 가」, 02_콘티 23절): 그림 안 아래 — 명조 44px + 자간 넓은 영문 대문자 22px 한 줄. 마침표 · 쉼표 없음(슬롭 점검표 6번).
//   브랜드 폰트 정본 §10-2 감성 편(명조 + 가는 고딕, 테두리 없음). 들어올 때 흐림이 풀리며 10px 올라온다(10-29 영상 글자 방법).
//   어둠은 글자 뒤 넓고 옅은 타원으로만(가운데 32%) — 화면 아래 전체에 깔면 51초 노을 바닥 반사를 절반쯤 꺼뜨린다(11-08 맹검). 숫자는 SUIT — 명조의 라틴 숫자는 Times처럼 튄다.
//   자막 아홉 순간 모두 그림 아래 가운데에 얼굴이 없다(23초 조립동 와이드만 양 끝에 작업자 발치). 27번 극접사(44~46초)에는 지금 원고에 말이 없어 자막이 뜨지 않는다.
// 앞 결(15:08 판까지)은 아래 검은 띠 60px 안 44px 고딕이었다 — 유호님 「자막이 약간 슬롭티나는데」, 맹검 「DVD · 유튜브 CC 자막 그대로」. 커밋 873c74252에 있다.
import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO } from '../lib/fonts';
import { ramp } from '../lib/motion';
import { SERIF } from './serif';
import timing from './timing.json';

const FPS = 24;
export const P10_FRAMES = timing.frames;   // 37컷 1441장 + 끝 장면 CG(최종소리.py가 timing.json에 적는다 · 최종편집.py가 렌더 뒤 장 수를 대조한다)
const WARM = '#EFE7DA';    // 글자 — 필름의 따뜻한 흰빛
const lin = (x: number) => x;
type Line = { a: number; b: number; s: string };
const LINES = timing.lines as Line[];
const noDot = (s: string) => s.replace(/[.。]+$/, '');

// 영문 한 줄(해외 거래처가 보는 포트폴리오) — 대문자로 보이니 첫 글자는 신경 쓰지 않는다
const EN_LINE: Record<string, string> = {
  '이게 다 크면 300톤 나갑니다': 'Fully grown, it will weigh 300 tons',
  '날개는 한 장씩 손으로 달아 줬습니다': 'Every blade, fitted by hand',
  '볼트 하나도 그냥 넘긴 적 없습니다': 'Not one bolt went unchecked',
  '3년을 매일 들여다봤습니다': 'Every day for three years, we watched over it',   // 옛 「Three years, watched over every day」(아르곤 「주어 없는 조각」) → 「we looked in on it」(아르곤 「잠깐 들러 안부를 살핀다는 뜻」) → 이 줄
  '다 컸습니다': 'All grown up',
  '이제 처음으로 깨워 봅니다': 'Now, we wake it for the first time',
  '오늘은': 'Today',
  '이 아이를 보냅니다': 'we send it on its way',
  '어디서든 잘 돌아갑니다': 'Wherever it goes, it will keep turning',   // 「돌아갑니다」 = 터빈이 돈다 · 아이가 잘 지낸다. 옛 「It will run well, wherever it goes」는 Gemini · 아르곤 「run well이 평이한 직역」
};

const digitsKO = (s: string) =>
  s.split(/(\d+)/).map((p, i) => (/^\d+$/.test(p) ? <span key={i} style={{ fontFamily: KO, fontWeight: 500, letterSpacing: '-0.01em' }}>{p}</span> : p));

const Caption: React.FC<{ c: Line; t: number }> = ({ c, t }) => {
  const k = ramp(t, c.a, 0.5);
  const k2 = ramp(t, c.a + 0.18, 0.5);   // 영문은 0.18초 늦게
  const o = Math.min(k, 1 - ramp(t, c.b - 0.25, 0.25, lin));
  const s = noDot(c.s);
  const w = Math.max(860, s.length * 44 * 0.95 * 2.2);   // 타원 폭 — 글자 폭(한글 한 자 약 0.95em) × 2.2
  return (
    <>
      {/* 첫 판 42%는 밝은 바닥 · 도시 위에서 「둥근 얼룩」으로 읽혔다(11-08 Gemini) — 옅게 넓게, 끝은 부드럽게 빠지게 */}
      <div style={{ position: 'absolute', left: 960 - w / 2, width: w, top: 826, height: 270, opacity: o,
        background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.28) 25%, rgba(0,0,0,0.16) 50%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 902, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: o }}>
        <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 44, lineHeight: 1, letterSpacing: '0.01em', color: WARM, textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          transform: `translateY(${(1 - k) * 10}px)`, filter: `blur(${(1 - k) * 6}px)`, whiteSpace: 'pre' }}>
          {digitsKO(s)}
        </div>
        <div style={{ marginTop: 18, fontFamily: KO, fontWeight: 400, fontSize: 22, lineHeight: 1, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: WARM, opacity: 0.85 * k2, textShadow: '0 1px 6px rgba(0,0,0,0.55)', whiteSpace: 'pre' }}>
          {EN_LINE[c.s] ?? ''}
        </div>
      </div>
    </>
  );
};

export const P10: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const c = LINES.find((l) => t >= l.a && t < l.b);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('p10/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      {c && <Caption c={c} t={t} />}
      <Audio src={staticFile('p10/sound.wav')} />
    </AbsoluteFill>
  );
};
