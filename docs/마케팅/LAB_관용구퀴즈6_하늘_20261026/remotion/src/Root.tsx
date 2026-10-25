import { Composition } from 'remotion';
import './lib/fonts';
import { B, TEMPO, TOTAL } from './film/timeline';
import { KidsFilm } from './kids/KidsFilm';
import { CHANNELS } from './kids/locales';

// 관용구 퀴즈 #6(10-26)도 퀴즈 #2 v5b 틀(100 BPM, 끝 4.5초 판 33.3초)만 쓴다 — REMOTION_TEMPO=100으로 번들할 때만 판을 등록한다(템포가 다른 판을 잘못 렌더하지 않게).
// 0초 화면: 모든 판이 바람에 얼굴을 맞는 곰부터, 문제 순서도 모든 판이 같다(바람맞다 → 하늘의 별 따기 → 해가 서쪽에서 뜨다).
// 10-26: 10-23 이해 시험의 「따라 말할 틈」 — SAY IT 알약을 한 박 반 당긴다(11박 → 10.5박 = 6.3초, 해요체 줄 6.36초와 같은 자리).
const V5B = { bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: Math.round(10.5 * B), yourTurn: true, shortOptions: true, hook: true };

export const RemotionRoot: React.FC = () => {
  if (TEMPO !== 100) return null;
  return (
    <>
      {/* 영어판(@synkkorean): 영어 진행 + 한국어 관용구(대본_q6.mjs → 판 q6en). 10-26 첫 렌더 이해 시험의 답 1이 「세 표현을 맞히는 퀴즈」에 머물러
          첫 문제 0초 도전 문구를 「NOT WHAT IT SAYS!」(글자 그대로가 아니다)로 — 퀴즈 #4 hookLine 자리. v2 시험 통과(답 1에 세 뜻 · 끝까지 · 4점).
          v3 「GUESS THE REAL MEANING!」은 최종본 시험에서 답 1이 형식에 머물고 3점이라 되돌렸다 */}
      <Composition id="q6-en" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q6en' as const, order: [0, 1, 2], hookLine: 'NOT WHAT IT SAYS!' }} />
      {/* 몽골어판(인스타 @synk.mn · 페북 synkworld): 화면 글 몽골어(i18n.ts MN), 나레이션은 한국어로만(판 q6ko) */}
      <Composition id="q6-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q6ko' as const, lang: 'mn' as const, order: [0, 1, 2], hookLine: 'ШУУД УТГААРАА БИШ!', listRecap: true }} />
      {/* 현지어판(조회 붙은 계정): 샤오훙수(간체)·틱톡 미얀마(버마어) — locales.ts, 몽골어판과 같은 소리·순서.
          10-26 최종본 이해 시험(몽골어 · 버마어 3점, 답 1이 「퀴즈 형식」)에 영어판과 같은 0초 문구 「글자 그대로의 뜻이 아니다」를 그 나라 말로(대조기 「정상」) */}
      {CHANNELS.map((c) => (
        <Composition key={c.cc} id={`q6-${c.cc}`} component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ ...V5B, vo: 'q6ko' as const, lang: c.lang, handle: c.handle, order: [0, 1, 2], hookLine: c.hook, listRecap: true }} />
      ))}
    </>
  );
};
