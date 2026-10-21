import { Composition } from 'remotion';
import './lib/fonts';
import { B, TEMPO, TOTAL } from './film/timeline';
import { KidsFilm } from './kids/KidsFilm';
import { CHANNELS } from './kids/locales';

// 관용구 퀴즈 #5(10-21)도 퀴즈 #2 v5b 틀(100 BPM, 끝 4.5초 판 33.3초)만 쓴다 — REMOTION_TEMPO=100으로 번들할 때만 판을 등록한다(템포가 다른 판을 잘못 렌더하지 않게).
// 0초 화면: 두 판 모두 연처럼 날린 파리부터(고양이 세수는 글자 그대로와 뜻이 가까워 「≠」 훅이 약하다 — Opus 역번역 10-21). 문제 순서만 판마다 다르다.
const V5B = { bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true };

export const RemotionRoot: React.FC = () => {
  if (TEMPO !== 100) return null;
  return (
    <>
      {/* 영어판(@synkkorean): 영어 진행 + 한국어 관용구(대본_q5.mjs → 판 q5en), 순서 파리 → 개구리 → 고양이 */}
      <Composition id="q5-en" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q5en' as const, order: [0, 1, 2] }} />
      {/* 몽골어판(인스타 @synk.mn · 페북 synkworld): 화면 글 몽골어(i18n.ts MN), 나레이션은 한국어로만(판 q5ko), 순서 파리 → 고양이 → 개구리 */}
      <Composition id="q5-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q5ko' as const, lang: 'mn' as const, order: [0, 2, 1] }} />
      {/* 현지어판(조회 붙은 계정): 샤오훙수(간체)·틱톡 미얀마(버마어) — locales.ts, 몽골어판과 같은 소리·순서 */}
      {CHANNELS.map((c) => (
        <Composition key={c.cc} id={`q5-${c.cc}`} component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q5ko' as const, lang: c.lang, handle: c.handle, order: [0, 2, 1] }} />
      ))}
    </>
  );
};
