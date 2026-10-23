import { Composition } from 'remotion';
import './lib/fonts';
import { Film, type FilmProps } from './lesson/Film';
import { TOTAL } from './lesson/time';
import { FPS, H, W } from './lesson/tokens';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 맛보기 수업 본편 16:9 — 콘티 v1.1(유호님 10-23 「콘티 v1.1 좋아 … 이미지 콘티로」) */}
    <Composition id="lesson" component={Film} durationInFrames={TOTAL} fps={FPS} width={W} height={H} defaultProps={{ shot: undefined, bgm: undefined } as FilmProps} />
  </>
);
