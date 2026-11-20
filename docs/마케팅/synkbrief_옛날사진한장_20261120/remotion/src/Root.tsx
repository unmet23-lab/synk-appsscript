import { Composition } from 'remotion';
import './lib/fonts';
import { Film, TOTAL } from './Film';
import { FPS } from './timeline';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 본편 하나(인스타 @synkbrief 릴스 — 계정 개편 시험 편이라 인스타 판만) */}
    <Composition id="oldphoto" component={Film} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
  </>
);
