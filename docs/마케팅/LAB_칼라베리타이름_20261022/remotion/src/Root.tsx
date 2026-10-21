import { Composition } from 'remotion';
import './lib/fonts';
import { B, TEMPO, TOTAL } from './film/timeline';
import { KidsFilm } from './kids/KidsFilm';

// LAB 「칼라베리타에 내 이름을 한글로」(10-22)도 관용구 퀴즈 #2 v5b 틀(100 BPM, 끝 4.5초 판 33.3초)만 쓴다 — REMOTION_TEMPO=100으로 번들할 때만 판을 등록한다.
// 판은 스페인어 하나(YouTube @synkkorean, 멕시코 저녁). 0초 약속 「¿TU NOMBRE EN COREANO?」(i18n.ts hook), 문제 순서 Juan → Regina → Guillermo(j → g → gu·ll, 쉬운 것부터).
const V5B = { bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true };

export const RemotionRoot: React.FC = () => {
  if (TEMPO !== 100) return null;
  return (
    <>
      {/* 스페인어판(@synkkorean): 화면 글 스페인어, 나레이션은 한국어로만(대본_name.mjs → 판 nko) */}
      <Composition id="name-es" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'nko' as const, lang: 'es' as const, order: [0, 1, 2] }} />
    </>
  );
};
