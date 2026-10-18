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
        {/* v5(10-17): v4a·v4b를 100 BPM으로(20% 느리게, 36초). 음악은 같은 키즈 곡을 음높이 그대로 늘린 bgm_kids_100.wav, 나레이션은 원래 빠르기에 가깝게(대본_v5.mjs). */}
        <Composition id="kids-quiz-v5a" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'v5a' as const, bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, order: [0, 1, 2] }} />
        {/* v5b 몽골어판(10-18): 화면 글 몽골어(i18n.ts MN), 한국어 나레이션(대본_v5mn.mjs), 끝 핸들 @synk.mn */}
        <Composition id="kids-quiz-v5b-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'v5b_mn' as const, bgm: 'bgm_kids_100.wav', lang: 'mn' as const, motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true, order: [2, 1, 0] }} />
        {/* v5b 몽골어판 хүйс 판(10-18): 배꼽 낱말만 хүй → хүйс(검문 두 모델 「хүй는 주로 탯줄」) */}
        <Composition id="kids-quiz-v5b-mn-khuis" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'v5b_mn' as const, bgm: 'bgm_kids_100.wav', lang: 'mn' as const, mnNavel: 'хүйс', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true, order: [2, 1, 0] }} />
        <Composition id="kids-quiz-v5b" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'v5b' as const, bgm: 'bgm_kids_100.wav', motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true, order: [2, 1, 0] }} />
        {/* 나라별 채널판(10-18): 영어 채널은 v5b에 끝 계정만, 나머지는 현지어 화면 글(locales.ts) + 한국어로만 말하는 나레이션(v5b_mn) */}
        {CHANNELS.map((c) => (
          <Composition key={c.cc} id={`kids-quiz-v5b-${c.cc}`} component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: c.lang === 'en' ? ('v5b' as const) : ('v5b_mn' as const), bgm: 'bgm_kids_100.wav', lang: c.lang, handle: c.handle, motion: true, stamp: 'label' as const, tease: true, sayAt: 11 * B, yourTurn: true, shortOptions: true, hook: true, order: [2, 1, 0] }} />
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
