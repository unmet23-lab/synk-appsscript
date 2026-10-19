import { Composition } from 'remotion';
import './lib/fonts';
import { Film } from './film/Film';
import { B, TEMPO, TOTAL } from './film/timeline';
import { KidsFilm } from './kids/KidsFilm';
import { CHANNELS } from './kids/locales';

// 120 BPM 판(v1~v4)과 100 BPM 판(v5)은 박 길이가 번들 때 정해져서 섞어 등록하지 않는다 — 템포가 다른 판을 잘못 렌더하지 않게.
export const RemotionRoot: React.FC = () => {
  if (TEMPO === 100) {
    return (
      <>
        {/* 관용구 퀴즈 #3(10-19): 퀴즈 #2 v5b 틀(100 BPM, 36초) 그대로. 나레이션은 모든 판이 한국어로만(대본_q3.mjs → 판 q3), 문제 순서는 data.ts 그대로(미역국 → 식은 죽 → 김칫국). */}
        {/* 몽골어판: 화면 글 몽골어(i18n.ts MN), 끝 핸들 @synk.mn */}
        <Composition id="kids-quiz-v5b-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'q3' as const, bgm: 'bgm_kids_100.wav', lang: 'mn' as const, motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true, order: [0, 1, 2] }} />
        {/* 영어 화면판(@synkkorean 원본 자리) */}
        <Composition id="kids-quiz-v5b" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'q3' as const, bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true, order: [0, 1, 2] }} />
        {/* 현지어판: 샤오훙수(간체)·틱톡 미얀마(locales.ts CHANNELS) */}
        {CHANNELS.map((c) => (
          <Composition key={c.cc} id={`kids-quiz-v5b-${c.cc}`} component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'q3' as const, bgm: 'bgm_kids_100.wav', lang: c.lang, handle: c.handle, motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true, order: [0, 1, 2] }} />
        ))}
      </>
    );
  }
  return (
    <>
      <Composition id="topik-quiz" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'none' as const }} />
      <Composition id="topik-quiz-natural" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'natural' as const }} />
      <Composition id="topik-quiz-fun" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'fun' as const }} />
      <Composition id="kids-quiz" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'none' as const, bgm: 'bgm_kids.wav' }} />
      {/* v2(10-17): 그림 개그·뜻 그림 움직임 + 몽글 깜빡임·숨쉬기(src/kids/motion.ts) */}
      <Composition id="kids-quiz-v2" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'none' as const, bgm: 'bgm_kids.wav', motion: true }} />
      {/* v3(10-17): v2 + NOPE 도장을 오답 딱지 위에 작게(그림 개그가 통째로 보이게) */}
      <Composition id="kids-quiz-v3" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'none' as const, bgm: 'bgm_kids.wav', motion: true, stamp: 'label' as const }} />
      {/* v4(10-17): v3 + 다음 문제 미리보기 · SAY IT 5.5초 + YOUR TURN · 두 낱말 보기 · 나레이션. v4b는 + 그림 개그 0초부터 · 배꼽 → 귀 → 입 */}
      <Composition id="kids-quiz-v4a" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'v4a' as const, bgm: 'bgm_kids.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, order: [0, 1, 2] }} />
      <Composition id="kids-quiz-v4b" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'v4b' as const, bgm: 'bgm_kids.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true, order: [2, 1, 0] }} />
      <Composition id="kids-quiz-fun" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'fun' as const, bgm: 'bgm_kids.wav' }} />
      <Composition id="kids-quiz-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'mn' as const, bgm: 'bgm_kids.wav', lang: 'mn' as const }} />
      <Composition id="kids-quiz-mn-music" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'none' as const, bgm: 'bgm_kids.wav', lang: 'mn' as const }} />
    </>
  );
};
