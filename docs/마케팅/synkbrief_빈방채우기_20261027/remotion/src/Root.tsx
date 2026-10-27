import { Composition } from 'remotion';
import './lib/fonts';
import { FullFilm, TOTAL } from './full/Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편: A = 인스타 릴스(끝 줄 「요청문은 캡션에」), B = 유튜브 쇼츠(「고정 댓글에」), C = 틱톡(「아래 글에」). 나머지는 같다. */}
    <Composition id="room-a" component={FullFilm} defaultProps={{ variant: 'A' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="room-b" component={FullFilm} defaultProps={{ variant: 'B' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="room-c" component={FullFilm} defaultProps={{ variant: 'C' as const }} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
