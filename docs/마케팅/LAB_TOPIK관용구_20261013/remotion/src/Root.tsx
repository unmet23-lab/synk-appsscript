import { Composition } from 'remotion';
import './lib/fonts';
import { Film } from './film/Film';
import { TOTAL } from './film/timeline';
import { KidsFilm } from './kids/KidsFilm';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="topik-quiz" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'none' as const }} />
      <Composition id="topik-quiz-natural" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'natural' as const }} />
      <Composition id="topik-quiz-fun" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'fun' as const }} />
      <Composition id="kids-quiz" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'none' as const, bgm: 'bgm_kids.wav' }} />
      <Composition id="kids-quiz-fun" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'fun' as const, bgm: 'bgm_kids.wav' }} />
      <Composition id="kids-quiz-mn" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'mn' as const, bgm: 'bgm_kids.wav', lang: 'mn' as const }} />
      <Composition id="kids-quiz-mn-music" component={KidsFilm} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ vo: 'none' as const, bgm: 'bgm_kids.wav', lang: 'mn' as const }} />
    </>
  );
};
