import { Composition } from 'remotion';
import './lib/fonts';
import { FullFilm, TOTAL } from './full/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편: A = 인스타 릴스 훅(손해 피하기), B = 유튜브 쇼츠 훅(질문) */}
    <Composition id="claude-a" component={FullFilm} defaultProps={{ variant: 'A' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="claude-b" component={FullFilm} defaultProps={{ variant: 'B' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
