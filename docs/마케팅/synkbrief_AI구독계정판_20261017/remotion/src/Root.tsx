import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './Film';
import { Film5, TOTAL5 } from './v5/Film5';
import { FullFilm, TOTAL as FULL_TOTAL } from './full/Film';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="motion-test" component={Film} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="motion-test-v5" component={Film5} durationInFrames={TOTAL5} fps={30} width={1080} height={1920} />
    {/* 본편: A = 인스타 릴스 훅(결과형), B = 유튜브 쇼츠 훅(질문형) */}
    <Composition id="shift-subs-a" component={FullFilm} defaultProps={{ variant: 'A' as const }} durationInFrames={FULL_TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="shift-subs-b" component={FullFilm} defaultProps={{ variant: 'B' as const }} durationInFrames={FULL_TOTAL} fps={30} width={1080} height={1920} />
  </>
);
