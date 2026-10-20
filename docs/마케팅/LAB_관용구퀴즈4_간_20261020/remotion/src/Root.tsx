import { Composition } from 'remotion';
import './lib/fonts';
import { B, TEMPO, TOTAL } from './film/timeline';
import { KidsFilm } from './kids/KidsFilm';
import { CHANNELS } from './kids/locales';

// 관용구 퀴즈 #4(10-20)는 퀴즈 #2 v5b 틀(100 BPM, 36초)만 쓴다 — REMOTION_TEMPO=100으로 번들할 때만 판을 등록한다(템포가 다른 판을 잘못 렌더하지 않게).
// 0초 화면 시험(트렌드 스캔 10-19 §4 추천 2): 영어판은 「CREEPY KOREAN FACT」 + 콩알만 한 간부터, 몽골어판은 「간 떨어지다 ≠ элэг унах」(기본 도전 문구 + 오답 딱지)로 떨어지는 간부터.
const V5B = { bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true };

export const RemotionRoot: React.FC = () => {
  if (TEMPO !== 100) return null;
  return (
    <>
      {/* 영어판(@synkkorean): 영어 진행 + 한국어 관용구(대본_q4.mjs → 판 q4en), 순서 콩알 → 떨어지다 → 크다 */}
      <Composition id="q4-en" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q4en' as const, order: [0, 1, 2], hookLine: 'CREEPY KOREAN FACT' }} />
      {/* 몽골어판(인스타 @synk.mn · 페북 synkworld): 화면 글 몽골어(i18n.ts MN), 나레이션은 한국어로만(판 q4ko), 순서 떨어지다 → 콩알 → 크다 */}
      <Composition id="q4-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q4ko' as const, lang: 'mn' as const, order: [1, 0, 2] }} />
      {/* 현지어판(조회 붙은 계정): 샤오훙수(간체)·틱톡 미얀마(버마어) — locales.ts, 몽골어판과 같은 소리·순서 */}
      {CHANNELS.map((c) => (
        <Composition key={c.cc} id={`q4-${c.cc}`} component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q4ko' as const, lang: c.lang, handle: c.handle, order: [1, 0, 2] }} />
      ))}
    </>
  );
};
