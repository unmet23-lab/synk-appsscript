import { Composition } from 'remotion';
import './lib/fonts';
import { FullFilm, TOTAL } from './full/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편: A = 인스타 릴스 · 틱톡(끝 줄 「질문 · 수식은 캡션에」), B = 유튜브 쇼츠(「고정 댓글에」). 나머지는 같다. */}
    <Composition id="split-a" component={FullFilm} defaultProps={{ variant: 'A' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="split-b" component={FullFilm} defaultProps={{ variant: 'B' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
