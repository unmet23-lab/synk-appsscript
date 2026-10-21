import { Composition } from 'remotion';
import './lib/fonts';
import { B, TEMPO, TOTAL } from './film/timeline';
import { KidsFilm } from './kids/KidsFilm';

// LAB 「한국어로 시간 읽기」 퀴즈(10-22)도 관용구 퀴즈 #2 v5b 틀(100 BPM, 끝 4.5초 판 33.3초)만 쓴다 — REMOTION_TEMPO=100으로 번들할 때만 판을 등록한다(템포가 다른 판을 잘못 렌더하지 않게).
// 0초 약속은 판마다 다르다(영어판 B 「2 NUMBER SYSTEMS? 1 RULE.」 · 몽골어판 A 「СОЛОНГОСООР ХЭДЭН ЦАГ ВЭ?」 — i18n.ts hook). 문제 순서는 두 판 같다(3:30 → 1:10 → 2:30, 쉬운 셈에서 「반」으로).
const V5B = { bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true };

export const RemotionRoot: React.FC = () => {
  if (TEMPO !== 100) return null;
  return (
    <>
      {/* 영어판(@synkkorean): 영어 진행 + 한국어 읽기(대본_time.mjs → 판 ten) */}
      <Composition id="time-en" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'ten' as const, order: [0, 1, 2] }} />
      {/* 몽골어판(인스타 @synk.mn · 페북 synkworld): 화면 글 몽골어(i18n.ts), 나레이션은 한국어로만(판 tko) */}
      <Composition id="time-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'tko' as const, lang: 'mn' as const, order: [0, 1, 2] }} />
    </>
  );
};
