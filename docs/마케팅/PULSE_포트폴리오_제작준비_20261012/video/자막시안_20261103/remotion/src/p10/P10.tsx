// 10번 도담중공업 「이 아이를 보냅니다」 내레이션 자막(2026-11-08, Claude) — 16:9 60.04초 · b2b-factory-20261026/최종편집.py가
//   화면(p10/picture.mp4 — 위아래 60px 띠와 끝 로고까지 구운 판) · 소리(p10/sound.wav)를 넣고 이 판을 굽는다.
//   11-08 유호님 「나레이션은 자막도 넣어줘, 슬롭처럼 만들지마」.
//   자리: 아래 검은 띠(그림 2:1 밖, y 1020~1080) 가운데 — 그림 위에는 글자를 얹지 않는다. 27번(준호 눈 극접사)은 턱 · 입이 그림 아래 끝까지 차서
//     그림 안 아래 가운데 자막은 얼굴을 덮는다(드라마 자막 규칙 1 · 2 — 영상은 위, 글자는 그 아래 어두운 자리).
//   결: 이야기 영화 말자막(6번 · s1 · rs와 같은 결) — 가는 흰 글자 한 줄 44px, 말한 사람 표시 · 마침표 · 쉼표 없음(슬롭 점검표 6번), 들고 날 때 짧은 페이드만.
//     첫 판(36px · 쉼표 · 「오늘은,」 뒤에 이어 붙이기)은 11-08 Fable · 아르곤 둘 다 「휴대폰에서 안 읽힘(390px 폭에 글자 6.7px) · 가자막처럼 작음」 ·
//     「앞 토막이 가운데에서 비켜 떠 있어 정렬 실수처럼 보임」으로 짚어 44px(띠 60px 안 위아래 여백 약 10px)로 키우고 화면마다 한 번에 띄운다
//   시각: 최종소리.py가 내레이션 토막을 놓으며 쓴 timing.json(받아쓰기 낱말 시각) — 한 화면 한 문장, 1.5초 이상, 컷 경계 1~3장 앞뒤면 경계에 맞춤.
import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { KO } from '../lib/fonts';
import { ramp } from '../lib/motion';
import timing from './timing.json';

const FPS = 24;
export const P10_FRAMES = 1441;
const PAPER = '#F2EFE8';
const BAR_TOP = 1020;   // 최종편집.py BAR(60) — 그림은 y 60~1020
const lin = (x: number) => x;
// parts: 1.5초를 못 채운 앞 화면을 뒤 화면과 한 줄로 묶은 것 — 줄 전체 자리를 처음부터 잡아 두고 뒷부분만 목소리가 말할 때 떠오른다(앞 낱말이 움직이지 않게)
type Line = { a: number; b: number; s: string; parts?: { s: string; a: number }[] };
const LINES = timing.lines as Line[];
const noDot = (s: string) => s.replace(/[.。]+$/, '');

const Caption: React.FC<{ t: number }> = ({ t }) => {
  const c = LINES.find((l) => t >= l.a && t < l.b);
  if (!c) return null;
  const o = Math.min(ramp(t, c.a, 0.12, lin), 1 - ramp(t, c.b - 0.16, 0.16, lin));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: BAR_TOP, height: 1080 - BAR_TOP, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: KO, fontWeight: 450, fontSize: 44, lineHeight: 1, letterSpacing: '-0.01em', color: PAPER, opacity: o, whiteSpace: 'pre' }}>
      {c.parts
        ? c.parts.map((p, i) => <span key={i} style={{ opacity: i === 0 ? 1 : ramp(t, p.a, 0.14, lin) }}>{i === c.parts!.length - 1 ? noDot(p.s) : p.s}</span>)
        : noDot(c.s)}
    </div>
  );
};

export const P10: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile('p10/picture.mp4')} muted style={{ width: '100%', height: '100%' }} />
      <Caption t={t} />
      <Audio src={staticFile('p10/sound.wav')} />
    </AbsoluteFill>
  );
};
